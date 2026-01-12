// pages/home.js
const DeviceManager = require('../../utils/deviceManager');
const AuthApi = require('../../utils/authApi');
const BluetoothManager = require('../../utils/bluetoothManager');
const echarts = require('../../components/ec-canvas/echarts');
const OximeterTool = require('../../utils/Yimi/OximeterTool');
const { checkBluetoothAndLocationByDeviceType } = require('../../utils/permissionUtil');

// 常量定义
const CONSTANTS = {
  // 设备状态ID
  STATUS_ID: {
    IN_PILLOW: 1,      // 在枕
    LEAVE_PILLOW: 3,   // 离枕
    OFFLINE: 4         // 离线
  },
  // 延迟时间（毫秒）
  INIT_DELAY: 500,
  // 心跳监控间隔（毫秒）
  HEARTBEAT_INTERVAL: 30000,
  // 血氧数据更新节流间隔（毫秒）
  SPO2_UPDATE_THROTTLE: 200,
  // 日志级别
  LOG_LEVEL: {
    NONE: 0,
    ERROR: 1,
    WARN: 2,
    INFO: 3,
    DEBUG: 4
  },
  // 当前日志级别（生产环境可设置为 INFO 或 WARN）
  CURRENT_LOG_LEVEL: 3
};

// 日志工具函数
const log = {
  debug: (msg, ...args) => {
    if (CONSTANTS.CURRENT_LOG_LEVEL >= CONSTANTS.LOG_LEVEL.DEBUG) {
      console.log(`[home] ${msg}`, ...args);
    }
  },
  info: (msg, ...args) => {
    if (CONSTANTS.CURRENT_LOG_LEVEL >= CONSTANTS.LOG_LEVEL.INFO) {
      console.log(`[home] ${msg}`, ...args);
    }
  },
  warn: (msg, ...args) => {
    if (CONSTANTS.CURRENT_LOG_LEVEL >= CONSTANTS.LOG_LEVEL.WARN) {
      console.warn(`[home] ${msg}`, ...args);
    }
  },
  error: (msg, ...args) => {
    if (CONSTANTS.CURRENT_LOG_LEVEL >= CONSTANTS.LOG_LEVEL.ERROR) {
      console.error(`[home] ${msg}`, ...args);
    }
  }
};

Page({

  /**
   * 页面的初始数据
   */
  data: {
    deviceConnected: false,
    deviceName: '',
    heartRate: null,
    breathRate: null,
    turnOver: null,
    isLeavePillow: true,
    _realtimeTimer: null, // 定时器句柄
    _lastCheckTime: 0,    // 上次检查时间戳
    _checkInterval: 30000, // 检查间隔（30秒）
    _pageHidden: false,   // 页面是否隐藏
    _lastPageShowTime: 0,  // 上次页面显示时间
    _lastOnlineTime: 0,    // 设备最后在线时间
    // 设备状态显示相关
    deviceStatusText: '设备离线',
    deviceSubText: '点击连接>',
    deviceStatusClass: 'offline',
    // 折线图配置
    heartRateEc: null,
    respiratoryEc: null,
    // 折线图实例引用
    _heartRateChart: null,
    _respiratoryChart: null,
    // 历史数据数组（用于折线图）
    heartRateHistory: [],
    breathRateHistory: [],
    // 血氧相关数据
    spo2: null, // 血氧值
    pulseRate: null, // 脉率
    perfusionIndex: null, // 灌注度
    batteryVoltage: null, // 电池电压
    oximeterConnected: false // 血氧仪连接状态
  },

  /**
   * 清理设备数据（统一方法）
   */
  clearDeviceData() {
    this.setData({
      deviceConnected: false,
      deviceName: '',
      heartRate: null,
      breathRate: null,
      turnOver: null,
      isLeavePillow: true,
      spo2: null,
      pulseRate: null,
      perfusionIndex: null,
      batteryVoltage: null
    });
  },

  /**
   * 清理血氧数据
   */
  clearOximeterData() {
    this.setData({
      oximeterConnected: false,
      spo2: null,
      pulseRate: null,
      perfusionIndex: null,
      batteryVoltage: null
    });
  },


  /**
   * 统一错误处理
   * @param {Error|string} error 错误对象或错误消息
   * @param {string} context 错误上下文
   */
  handleError(error, context = '') {
    const errorMessage = error instanceof Error ? error.message : error;
    log.error(`${context}失败`, errorMessage);
    
    // 可以根据错误类型进行不同的处理
    if (errorMessage.includes('网络') || errorMessage.includes('timeout')) {
      wx.showToast({
        title: '网络异常，请检查网络连接',
        icon: 'none',
        duration: 2000
      });
    } else if (errorMessage.includes('权限')) {
      wx.showToast({
        title: '权限不足，请检查权限设置',
        icon: 'none',
        duration: 2000
      });
    }
  },

  /**
   * 验证参数类型
   * @param {*} value 要验证的值
   * @param {string} type 期望的类型
   * @param {string} paramName 参数名称
   * @returns {boolean}
   */
  validateParam(value, type, paramName) {
    const actualType = typeof value;
    if (actualType !== type) {
      log.warn(`参数 ${paramName} 类型错误，期望 ${type}，实际 ${actualType}`);
      return false;
    }
    return true;
  },

  /**
   * 设置血氧仪事件监听
   */
  setupOximeterListeners() {
    if (!this.oximeterTool) return;
    
    // 避免重复绑定（检查是否已经设置过监听器）
    if (this._oximeterListenersSetup) {
      log.debug('监听器已设置，跳过重复绑定');
      return;
    }
    
    log.info('设置血氧仪事件监听');
    
    // 血氧数据更新节流
    let lastUpdateTime = 0;
    
    // 监听实时数据
    this._onRealtimeData = (data) => {
      const now = Date.now();
      // 节流处理：避免频繁更新
      if (now - lastUpdateTime < CONSTANTS.SPO2_UPDATE_THROTTLE) {
        return;
      }
      lastUpdateTime = now;
      
      log.debug('血氧数据更新', {
        spo2: data.spo2,
        pulseRate: data.pulseRate,
        perfusionIndex: data.perfusionIndex,
        batteryVoltage: data.batteryVoltage
      });
      
      this.setData({
        spo2: data.spo2,
        pulseRate: data.pulseRate,
        perfusionIndex: data.perfusionIndex,
        batteryVoltage: data.batteryVoltage
      });
    };
    this.oximeterTool.on('realtimeData', this._onRealtimeData);
    
    // 监听连接成功事件（同步连接状态）
    this._onConnected = (data) => {
      log.info('血氧仪连接成功', data);
      this.setData({ oximeterConnected: true });
    };
    this.oximeterTool.on('connected', this._onConnected);
    
    // 监听断开连接
    this._onDisconnected = (data) => {
      log.info('血氧仪已断开连接', data);
      this.clearOximeterData();
      wx.showToast({
        title: '血氧仪已断开',
        icon: 'none',
        duration: 2000
      });
    };
    this.oximeterTool.on('disconnected', this._onDisconnected);
    
    this._oximeterListenersSetup = true;
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.deviceManager = new DeviceManager(this);
    
    // 初始化血氧仪工具 - 使用完整的OximeterTool
    this.oximeterTool = new OximeterTool();
    
    // 设置事件监听
    this.setupOximeterListeners();
    
    // 检查用户是否已登录
    if (!AuthApi.isLoggedIn()) {
      log.info('页面加载时用户未登录，跳过设备初始化');
      return;
    }
    
    // 检查是否已有WiFi MAC，如果有则初始化设备状态
    const wifiMac = wx.getStorageSync('wifi_device_mac');
    if (wifiMac) {
      log.info('页面加载时检测到已保存的WiFi MAC', { wifiMac });
      
      // 再次检查用户登录状态（双重保护）
      if (!AuthApi.isLoggedIn()) {
        log.warn('页面加载时用户登录状态已失效，跳过设备初始化');
        return;
      }
      
      // 延迟初始化，确保页面完全加载
      setTimeout(() => {
        this.restoreRealtimeDataRequest(wifiMac);
      }, CONSTANTS.INIT_DELAY);
    }
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    log.info('onShow');    
    const now = Date.now();
    const wasHidden = this.data._pageHidden;
    const timeSinceLastShow = now - this.data._lastPageShowTime;
    
    // 更新页面状态
    this.setData({
      _pageHidden: false,
      _lastPageShowTime: now
    });
    
    // 检查是否需要进行设备连接检查（避免频繁检查）
    const shouldCheck = now - this.data._lastCheckTime > this.data._checkInterval;
    
    // 如果页面刚从隐藏状态恢复，或者距离上次检查时间足够长，则进行检查
    const shouldProceed = wasHidden || shouldCheck || !this.data._lastCheckTime;
    
    if (!shouldProceed) {
      log.debug('距离上次检查时间过短且页面未隐藏，跳过设备连接检查');
      return;
    }
    
    // 自动读取本地保存的设备信息
    const device = wx.getStorageSync('connectedDevice');
    const wifiMac = wx.getStorageSync('wifi_device_mac');
    const convertedIds = wx.getStorageSync('convertedCharacteristicIds');
    
    log.debug('读取本地设备信息', { device, wifiMac, convertedIds, wasHidden, timeSinceLastShow, shouldCheck });
    
    // 智能判断逻辑：检查是否为第二次进入（已有WiFi MAC）
    if (wifiMac && this.data.deviceConnected) {
      // 如果已有WiFi MAC且设备已连接，使用心跳检测验证连接状态
      if (shouldProceed) {
        log.info('检测到已保存的WiFi MAC且设备已连接，使用心跳检测验证连接状态');
        
        // 使用心跳检测验证设备是否真的在线
        this.verifyDeviceConnectionWithHeartbeat(wifiMac, wasHidden);
        
        this.setData({ _lastCheckTime: now });
      } else {
        log.debug('检测到已保存的WiFi MAC且设备已连接，跳过连接验证');
      }
      return;
    } else if (wifiMac) {
      log.info('检测到已保存的WiFi MAC，但需要检查用户登录状态');
      
      // 检查用户是否已登录，未登录时不能获取数据
      if (!AuthApi.isLoggedIn()) {
        log.warn('用户未登录，即使有WiFi MAC也无法获取设备数据');
        this.clearDeviceData();
        this.deviceManager.clearRealtimeTimer();
        return;
      }
      
      log.info('检测到已保存的WiFi MAC且用户已登录，使用心跳检测确认设备连接状态');
      
      // 使用心跳检测确认设备连接状态
      this.checkDeviceConnectionWithHeartbeat(wifiMac, device);
      
      // 更新检查时间
      this.setData({ _lastCheckTime: now });
      
    } else if (device && device.deviceId) {
      // 第一次进入：有设备信息但没有WiFi MAC，需要完整流程
      log.info('第一次进入：有设备信息但没有WiFi MAC，需要完整流程');
      
      // 对于第一次进入，不进行频繁检查限制
      if (shouldProceed) {
        log.info('开始检查设备连接状态');
        this.setData({ _lastCheckTime: now }); // 更新检查时间
        
        this.checkDeviceConnection(device.deviceId).then(isConnected => {
          if (isConnected) {
            log.info('设备连接正常，但没有WiFi MAC，需要先配置WiFi');
            this.setData({
              deviceConnected: true,
              deviceName: device.name || ''
            });
            // 提示用户需要配置WiFi
            wx.showModal({
              title: '需要配置WiFi',
              content: '设备已连接，但需要配置WiFi才能获取数据。请前往设备配置页面。',
              confirmText: '去配置',
              cancelText: '稍后',
              success: (res) => {
                if (res.confirm) {
                  this.toBlueIndex();
                }
              }
            });
          } else {
            // 如果设备未真正连接，清除本地存储
            log.info('设备未真正连接，清除本地存储');
            wx.removeStorageSync('connectedDevice');
            wx.removeStorageSync('convertedCharacteristicIds');
            this.clearDeviceData();
            this.deviceManager.clearRealtimeTimer(); // 无设备时清理定时器
          }
        }).catch(error => {
          this.handleError(error, '设备连接检查');
          // 检查失败时，不清除存储，只设置为未连接状态
          this.clearDeviceData();
          this.deviceManager.clearRealtimeTimer();
        });
      } else {
        log.debug('跳过设备连接检查');
      }
    } else {
      // 没有设备信息也没有WiFi MAC，直接设置为未连接状态
      log.info('没有设备信息也没有WiFi MAC，设置为未连接状态');
      this.clearDeviceData();
      this.deviceManager.clearRealtimeTimer(); // 无设备时清理定时器
    }
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {
    log.info('onHide');
    this.setData({ _pageHidden: true });
    this.deviceManager.clearRealtimeTimer();
    // 停止心跳监控
    this.stopDeviceHeartbeatMonitor();
    // 清理血氧仪事件监听（防止内存泄漏）
    this.cleanupOximeterListeners();
  },

  /**
   * 清理血氧仪事件监听
   */
  cleanupOximeterListeners() {
    if (this.oximeterTool && this._oximeterListenersSetup) {
      try {
        if (this._onRealtimeData) {
          this.oximeterTool.off('realtimeData', this._onRealtimeData);
        }
        if (this._onConnected) {
          this.oximeterTool.off('connected', this._onConnected);
        }
        if (this._onDisconnected) {
          this.oximeterTool.off('disconnected', this._onDisconnected);
        }
        log.debug('血氧仪事件监听已清理');
      } catch (error) {
        log.error('清理血氧仪事件监听失败', error);
      }
    }
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {
    this.deviceManager.clearRealtimeTimer();
    // 停止心跳监控
    this.stopDeviceHeartbeatMonitor();
    
    // 清理血氧仪事件监听
    this.cleanupOximeterListeners();
    this._oximeterListenersSetup = false;
    
    // 断开血氧仪连接
    if (this.oximeterTool) {
      try {
        this.oximeterTool.stop();
      } catch (error) {
        log.error('断开血氧仪连接失败', error);
      }
    }
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  },
  toBlueIndex(){
    wx.navigateTo({
      url: '/pages/blue/blue'
    })
  },

  /**
   * 连接血氧仪 - 使用OximeterTool
   */
  async connectOximeter() {
    try {
      wx.showLoading({ title: '检查权限中...' });
      
      // 使用统一的权限检查方法（会根据设备类型自动处理）
      await checkBluetoothAndLocationByDeviceType();
      
      wx.showLoading({ title: '搜索设备中...' });
      
      // 启动OximeterTool（会自动搜索和连接设备）
      const result = await this.oximeterTool.start();
      
      wx.hideLoading();
      
      if (result && result.success) {
        // 连接状态会通过事件监听器自动更新
        wx.showToast({
          title: '连接成功',
          icon: 'success',
          duration: 2000
        });
        log.info('已连接设备', result.device?.name || '未知设备');
      } else {
        this.setData({ oximeterConnected: false });
        wx.showModal({
          title: '连接失败',
          content: result?.error || '无法连接血氧仪设备',
          showCancel: false
        });
      }
    } catch (error) {
      wx.hideLoading();
      this.setData({ oximeterConnected: false });
      this.handleError(error, '连接血氧仪');
      wx.showModal({
        title: '连接失败',
        content: error.message || '无法连接血氧仪设备',
        showCancel: false
      });
    }
  },

  /**
   * 断开血氧仪
   */
  async disconnectOximeter() {
    if (!this.oximeterTool) {
      log.warn('血氧仪工具未初始化');
      return;
    }
    
    try {
      await this.oximeterTool.stop();
      this.clearOximeterData();
      wx.showToast({
        title: '已断开',
        icon: 'success',
        duration: 1500
      });
    } catch (error) {
      this.handleError(error, '断开血氧仪');
    }
  },

  // 检查设备连接状态 - 使用心跳检测替代蓝牙检查
  async checkDeviceConnection(deviceId) {
    try {
      log.info('开始检查设备连接状态', { deviceId });
      
      // 检查用户是否已登录
      if (!AuthApi.isLoggedIn()) {
        log.warn('用户未登录，无法检查设备连接状态');
        return false;
      }
      
      // 获取WiFi MAC地址进行心跳检测
      const wifiMac = wx.getStorageSync('wifi_device_mac');
      if (!wifiMac) {
        log.warn('没有WiFi MAC地址，无法进行心跳检测');
        return false;
      }
      
      // 使用心跳检测替代蓝牙检查
      const heartbeatResult = await this.deviceManager.deviceHeartbeat(wifiMac);
      
      if (heartbeatResult && heartbeatResult.success && heartbeatResult.isOnline) {
        log.info('设备心跳检测成功，设备在线', { status: heartbeatResult.status?.name });
        return true;
      } else {
        log.warn('设备心跳检测失败或设备离线', { error: heartbeatResult?.error });
        return false;
      }
    } catch (error) {
      this.handleError(error, '检查设备连接状态');
      return false;
    }
  },

  /**
   * 手动刷新设备状态
   */
  refreshDeviceStatus() {
    log.info('手动刷新设备状态');
    
    // 检查用户是否已登录
    if (!AuthApi.isLoggedIn()) {
      log.warn('用户未登录，无法刷新设备状态');
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }
    
    // 检查是否有WiFi MAC
    const wifiMac = wx.getStorageSync('wifi_device_mac');
    if (wifiMac && this.data.deviceConnected) {
      log.info('手动刷新：使用恢复方法重新启动实时数据请求');
      this.restoreRealtimeDataRequest(wifiMac);
    } else {
      // 重置检查时间和页面状态，强制进行检查
      this.setData({ 
        _lastCheckTime: 0,
        _pageHidden: false
      });
      // 触发 onShow 逻辑
      this.onShow();
    }
  },

  /**
   * 检查设备是否应该显示为离线（超过1分钟才显示离线）
   * @returns {boolean} true表示应该显示为离线，false表示仍显示在线
   */
  shouldShowDeviceOffline() {
    const now = Date.now();
    const offlineDuration = now - this.data._offlineStartTime;
    
    // 如果从未记录过离线时间，或者离线时间未超过阈值，仍显示在线
    if (this.data._offlineStartTime === 0 || offlineDuration < this.data._offlineThreshold) {
      return false;
    }
    
    return true;
  },

  /**
   * 更新设备在线状态
   * @param {boolean} isOnline 设备是否在线
   */
  updateDeviceOnlineStatus(isOnline) {
    if (typeof isOnline !== 'boolean') {
      log.warn('updateDeviceOnlineStatus: isOnline 参数类型错误');
      return;
    }
    
    const now = Date.now();
    
    if (isOnline) {
      // 设备在线，更新最后在线时间
      this.setData({
        _lastOnlineTime: now
      });
      log.debug('设备在线，更新最后在线时间', new Date(now).toLocaleTimeString());
    } else {
      log.debug('设备离线', new Date(now).toLocaleTimeString());
    }
  },

  /**
   * 更新设备状态显示
   * @param {boolean} isConnected 设备是否连接
   * @param {string} statusName 状态名称（来自GetDeviceInfo接口的status.name）
   * @param {number} statusId 状态ID（来自GetDeviceInfo接口的status.id）
   */
  updateDeviceStatusDisplay(isConnected, statusName = '', statusId = null) {
    // 参数验证
    if (typeof isConnected !== 'boolean') {
      log.warn('updateDeviceStatusDisplay: isConnected 参数类型错误');
      return;
    }
    
    if (statusId !== null && typeof statusId !== 'number') {
      log.warn('updateDeviceStatusDisplay: statusId 参数类型错误');
      statusId = null;
    }
    
    let statusText = '';
    let subText = '';
    let statusClass = '';
    
    if (isConnected && statusName) {
      let displayStatusName = statusName;
      if (statusId === CONSTANTS.STATUS_ID.LEAVE_PILLOW) {
        displayStatusName = "离枕";
      } else if (statusId === CONSTANTS.STATUS_ID.IN_PILLOW) {
        displayStatusName = "在枕";
      }
      statusText = '设备' + displayStatusName;
      subText = 'zzzMinga';
      statusClass = 'connected';
    } else if (isConnected) {
      statusText = '设备已连接';
      subText = 'zzzMinga';
      statusClass = 'connected';
    } else {
      statusText = '设备离线';
      subText = '点击连接>';
      statusClass = 'offline';
    }
    
    // 只在状态真正改变时更新和记录日志
    const currentStatusText = this.data.deviceStatusText;
    if (currentStatusText !== statusText) {
      log.debug('更新设备状态显示', { statusText, subText, statusClass });
      this.setData({
        deviceStatusText: statusText,
        deviceSubText: subText,
        deviceStatusClass: statusClass
      });
    }
  },

  /**
   * 使用心跳检测验证设备连接状态
   * @param {string} wifiMac WiFi MAC地址
   * @param {boolean} wasHidden 页面是否刚从隐藏状态恢复
   */
  async verifyDeviceConnectionWithHeartbeat(wifiMac, wasHidden) {
    if (!wifiMac) {
      log.warn('verifyDeviceConnectionWithHeartbeat: wifiMac 参数为空');
      return;
    }
    
    try {
      log.info('开始使用心跳检测验证设备连接状态', { wifiMac });
      
      // 执行心跳检测
      const heartbeatResult = await this.deviceManager.deviceHeartbeat(wifiMac);
      
      log.debug('心跳检测结果', {
        success: heartbeatResult?.success,
        isOnline: heartbeatResult?.isOnline,
        statusId: heartbeatResult?.status?.id,
        statusName: heartbeatResult?.status?.name
      });
      
      if (heartbeatResult && heartbeatResult.success && heartbeatResult.isOnline) {
        const statusName = heartbeatResult.status?.name || '';
        const statusId = heartbeatResult.status?.id;
        log.info('心跳检测验证成功，设备在线', { statusName, statusId });
        
        // 更新设备在线状态
        this.updateDeviceOnlineStatus(true);
        
        // 设备在线，确保连接状态正确
        this.setData({
          deviceConnected: true,
          deviceName: 'zzZMinga'
        });
        
        // 初始化折线图
        this.initCharts();
        
        // 更新设备状态显示（使用接口返回的状态名称和状态ID）
        this.updateDeviceStatusDisplay(true, statusName, statusId);
        
        // 根据页面状态选择数据刷新方式
        if (wasHidden) {
          log.debug('页面刚从隐藏状态恢复，使用专门的恢复方法');
          this.restoreRealtimeDataRequest(wifiMac);
        } else {
          log.debug('正常情况下的数据刷新');
          this.deviceManager.getDeviceRealtimeData(wifiMac);
        }
      } else {
        const statusName = heartbeatResult?.status?.name || '离线';
        const statusId = heartbeatResult?.status?.id;
        log.warn('心跳检测失败或设备离线', { error: heartbeatResult?.error });
        
        // 更新设备离线状态
        this.updateDeviceOnlineStatus(false);
        
        // 设备离线，更新连接状态
        this.clearDeviceData();
        
        // 更新设备状态显示
        this.updateDeviceStatusDisplay(false, statusName, statusId);
        
        // 停止实时数据定时器和心跳监控
        this.deviceManager.clearRealtimeTimer();
        this.stopDeviceHeartbeatMonitor();
      }
    } catch (error) {
      this.handleError(error, '心跳检测验证');
      
      // 检测异常，设置为未连接状态
      this.clearDeviceData();
      
      // 停止实时数据定时器和心跳监控
      this.deviceManager.clearRealtimeTimer();
      this.stopDeviceHeartbeatMonitor();
    }
  },

  /**
   * 使用心跳检测确认设备连接状态
   * @param {string} wifiMac WiFi MAC地址
   * @param {Object} device 设备信息
   */
  async checkDeviceConnectionWithHeartbeat(wifiMac, device) {
    if (!wifiMac) {
      log.warn('checkDeviceConnectionWithHeartbeat: wifiMac 参数为空');
      return;
    }
    
    try {
      log.info('开始使用心跳检测确认设备连接状态', { wifiMac });
      
      // 执行心跳检测
      const heartbeatResult = await this.deviceManager.deviceHeartbeat(wifiMac);
      
      if (heartbeatResult && heartbeatResult.success && heartbeatResult.isOnline) {
        const statusName = heartbeatResult.status?.name || '';
        const statusId = heartbeatResult.status?.id;
        log.info('心跳检测成功，设备在线', { statusName, statusId });
        
        // 更新设备在线状态
        this.updateDeviceOnlineStatus(true);
        
        // 设备在线，设置连接状态
        this.setData({
          deviceConnected: true,
          deviceName: 'zzZMinga'
        });
        
        // 初始化折线图
        this.initCharts();
        
        // 更新设备状态显示
        this.updateDeviceStatusDisplay(true, statusName, statusId);
        
        // 获取设备实时数据
        this.deviceManager.getDeviceRealtimeData(wifiMac);
        this.deviceManager.startRealtimeTimer(wifiMac);
        
        // 启动心跳监控
        this.startDeviceHeartbeatMonitor();
      } else {
        const statusName = heartbeatResult?.status?.name || '离线';
        const statusId = heartbeatResult?.status?.id;
        log.warn('心跳检测失败或设备离线', { error: heartbeatResult?.error });
        
        // 更新设备离线状态
        this.updateDeviceOnlineStatus(false);
        
        // 设备离线，设置未连接状态
        this.clearDeviceData();
        
        // 更新设备状态显示
        this.updateDeviceStatusDisplay(false, statusName, statusId);
        // 停止实时数据定时器
        this.deviceManager.clearRealtimeTimer();
      }
    } catch (error) {
      this.handleError(error, '心跳检测');
      
      // 检测异常，设置为未连接状态
      this.clearDeviceData();
      
      // 停止实时数据定时器
      this.deviceManager.clearRealtimeTimer();
    }
  },

  /**
   * 启动设备心跳监控
   */
  startDeviceHeartbeatMonitor() {
    const wifiMac = wx.getStorageSync('wifi_device_mac');
    if (!wifiMac) {
      log.warn('没有WiFi MAC地址，无法启动心跳监控');
      return;
    }

    log.info('启动设备心跳监控', { wifiMac });
    
    // 启动心跳监控
    this.deviceManager.startHeartbeatMonitor(wifiMac, CONSTANTS.HEARTBEAT_INTERVAL, (result) => {
      log.debug('心跳检测结果', { 
        success: result?.success, 
        isOnline: result?.isOnline,
        statusId: result?.status?.id 
      });
      
      if (result && result.success && result.isOnline) {
        // 设备在线，更新在线状态
        this.updateDeviceOnlineStatus(true);
        
        // 检查是否需要更新连接状态
        const wasOffline = !this.data.deviceConnected;
        
        if (wasOffline) {
          log.info('心跳检测显示设备从离线回到在线，更新连接状态');
          this.setData({
            deviceConnected: true,
            deviceName: 'zzZMinga'
          });
          
          // 初始化折线图
          this.initCharts();
          
          // 设备从离线回到在线，重新启动数据获取
          this.deviceManager.getDeviceRealtimeData(wifiMac);
          this.deviceManager.startRealtimeTimer(wifiMac);
        } else {
          // 设备一直在线，确保数据获取正常
          if (!this.deviceManager._realtimeTimer) {
            log.debug('实时数据定时器未运行，重新启动');
            this.deviceManager.getDeviceRealtimeData(wifiMac);
            this.deviceManager.startRealtimeTimer(wifiMac);
          }
        }
        
        // 更新设备状态显示
        const statusName = result.status?.name || '';
        const statusId = result.status?.id;
        this.updateDeviceStatusDisplay(true, statusName, statusId);
        
      } else {
        // 设备离线或检测失败，更新离线状态
        this.updateDeviceOnlineStatus(false);
        
        log.info('心跳检测显示设备离线，更新连接状态');
        this.clearDeviceData();
        
        // 更新设备状态显示
        const offlineStatusName = result?.status?.name || '离线';
        const offlineStatusId = result?.status?.id;
        this.updateDeviceStatusDisplay(false, offlineStatusName, offlineStatusId);
        
        // 停止实时数据定时器
        this.deviceManager.clearRealtimeTimer();
      }
    });
  },

  /**
   * 停止设备心跳监控
   */
  stopDeviceHeartbeatMonitor() {
    log.info('停止设备心跳监控');
    this.deviceManager.clearHeartbeatTimer();
  },

  /**
   * 使用已有的WiFi MAC初始化设备
   */
  initializeDeviceWithWifiMac(wifiMac) {
    if (!wifiMac) {
      log.warn('WiFi MAC为空，无法初始化设备');
      return;
    }
    
    log.info('使用已有的WiFi MAC初始化设备', { wifiMac });
    
    // 设置设备为已连接状态
    this.setData({
      deviceConnected: true,
      deviceName: 'zzZMinga'
    });
    
    // 初始化折线图
    this.initCharts();
    
    // 开始获取设备实时数据
    if (this.deviceManager) {
      this.deviceManager.getDeviceRealtimeData(wifiMac);
      this.deviceManager.startRealtimeTimer(wifiMac);
      log.info('设备初始化完成，开始获取实时数据');
    } else {
      log.error('deviceManager未初始化');
    }
  },

  /**
   * 初始化折线图
   */
  initCharts() {
    // 检查是否已初始化，避免重复初始化
    if (this._chartsInitialized) {
      log.debug('折线图已初始化，跳过重复初始化');
      return;
    }
    
    log.debug('开始初始化折线图', { deviceConnected: this.data.deviceConnected });
    
    if (!this.data.deviceConnected) {
      log.debug('设备未连接，跳过折线图初始化');
      return;
    }
    
    // 创建简单的波形图配置
    const createWaveformConfig = (color = '#00ffff') => {
      return {
        onInit: (canvas, width, height, dpr) => {
          console.log('[home] 折线图onInit被调用，canvas:', canvas, 'width:', width, 'height:', height);
          
          if (!canvas) {
            console.warn('[home] Canvas为空，无法初始化折线图');
            return null;
          }
          
          try {
            const chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
            canvas.setChart(chart);
            
            // 保存chart实例引用
            if (color === '#ff0064') {
              this._heartRateChart = chart;
              console.log('[home] 心率折线图实例已保存');
            } else {
              this._respiratoryChart = chart;
              console.log('[home] 呼吸折线图实例已保存');
            }
            
            const option = {
              backgroundColor: 'transparent',
              grid: {
                left: 40,
                right: 5,
                top: 5,
                bottom: 5,
                containLabel: false
              },
              xAxis: {
                type: 'category',
                data: [],
                show: false,
                boundaryGap: false
              },
              yAxis: {
                type: 'value',
                show: true,
                scale: false,
                min: color === '#ff0064' ? 0 : 0, // 心率或呼吸率都从0开始
                max: color === '#ff0064' ? 100 : 40, // 心率最大100，呼吸率最大40
                interval: color === '#ff0064' ? 25 : 10, // 心率间隔25，呼吸率间隔10
                axisLine: {
                  show: false
                },
                axisTick: {
                  show: false
                },
                splitLine: {
                  show: true,
                  lineStyle: {
                    color: 'rgba(255, 255, 255, 0.1)',
                    type: 'dashed'
                  }
                },
                axisLabel: {
                  show: true,
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontSize: 10,
                  formatter: function(value) {
                    return Math.round(value);
                  },
                  showMinLabel: true,
                  showMaxLabel: true
                }
              },
              series: [{
                type: 'line',
                data: [],
                smooth: true,
                symbol: 'none',
                lineStyle: {
                  color: color,
                  width: 2
                },
                areaStyle: {
                  color: {
                    type: 'linear',
                    x: 0,
                    y: 0,
                    x2: 0,
                    y2: 1,
                    colorStops: [{
                      offset: 0,
                      color: color + '80'
                    }, {
                      offset: 1,
                      color: color + '00'
                    }]
                  }
                }
              }]
            };
            
            chart.setOption(option);
            console.log('[home] 折线图配置设置完成，初始数据为空数组');
            return chart;
          } catch (error) {
            console.error('[home] 初始化折线图失败:', error);
            return null;
          }
        }
      };
    };
    
    log.debug('准备设置heartRateEc和respiratoryEc');
    this.setData({
      heartRateEc: createWaveformConfig('#ff0064'),
      respiratoryEc: createWaveformConfig('#00ffff')
    }, () => {
      this._chartsInitialized = true;
      log.debug('折线图配置已设置到data中');
    });
  },

  /**
   * 心率折线图初始化回调
   */
  onHeartRateChartInit(e) {
    console.log('[home] ========== 心率折线图初始化回调 ==========');
    console.log('[home] 心率折线图init事件:', e);
    console.log('[home] deviceConnected:', this.data.deviceConnected);
    console.log('[home] heartRateEc:', this.data.heartRateEc);
  },

  /**
   * 呼吸折线图初始化回调
   */
  onRespiratoryChartInit(e) {
    console.log('[home] ========== 呼吸折线图初始化回调 ==========');
    console.log('[home] 呼吸折线图init事件:', e);
    console.log('[home] deviceConnected:', this.data.deviceConnected);
    console.log('[home] respiratoryEc:', this.data.respiratoryEc);
  },

  /**
   * 添加心率到历史数组
   */
  addToHeartRateHistory(value) {
    console.log('[home] 添加心率到历史数组:', value);
    if (!this.data.heartRateHistory) {
      this.data.heartRateHistory = [];
    }
    this.data.heartRateHistory.push(value);
    // 限制数组长度，保留最近的数据点（例如最近50个点）
    const maxLength = 50;
    if (this.data.heartRateHistory.length > maxLength) {
      this.data.heartRateHistory = this.data.heartRateHistory.slice(-maxLength);
    }
    console.log('[home] 心率历史数组长度:', this.data.heartRateHistory.length);
    // 更新折线图
    this.updateHeartRateChart();
  },

  /**
   * 添加呼吸率到历史数组
   */
  addToBreathRateHistory(value) {
    console.log('[home] 添加呼吸率到历史数组:', value);
    if (!this.data.breathRateHistory) {
      this.data.breathRateHistory = [];
    }
    this.data.breathRateHistory.push(value);
    // 限制数组长度，保留最近的数据点（例如最近50个点）
    const maxLength = 50;
    if (this.data.breathRateHistory.length > maxLength) {
      this.data.breathRateHistory = this.data.breathRateHistory.slice(-maxLength);
    }
    console.log('[home] 呼吸率历史数组长度:', this.data.breathRateHistory.length);
    // 更新折线图
    this.updateRespiratoryChart();
  },

  /**
   * 更新心率折线图
   */
  updateHeartRateChart() {
    if (!this._heartRateChart) {
      console.log('[home] 心率折线图实例不存在，跳过更新');
      return;
    }
    
    const history = this.data.heartRateHistory || [];
    if (history.length === 0) {
      console.log('[home] 心率历史数据为空，跳过更新');
      return;
    }
    
    try {
      const xData = history.map((_, index) => index);
      const minValue = Math.min(...history);
      const maxValue = Math.max(...history);
      const padding = (maxValue - minValue) * 0.2 || 10; // 20%的padding，最小10
      
      // 动态计算Y轴范围
      let yMax = 100;
      let interval = 25;
      
      if (maxValue > 100) {
        // 如果数据超过100，动态调整范围
        // 计算合适的最大值（向上取整到25的倍数）
        yMax = Math.ceil(maxValue / 25) * 25;
        // 如果最大值很大，增加间隔
        if (yMax > 200) {
          interval = 50;
          yMax = Math.ceil(maxValue / 50) * 50;
        } else if (yMax > 150) {
          interval = 25;
        }
        console.log('[home] 心率数据超出100，动态调整Y轴范围到:', yMax, '间隔:', interval);
      }
      
      console.log('[home] 更新心率折线图，数据点数量:', history.length, '范围:', minValue, '-', maxValue, 'Y轴范围: 0 -', yMax);
      this._heartRateChart.setOption({
        xAxis: {
          data: xData,
          boundaryGap: false
        },
        yAxis: {
          min: 0,
          max: yMax,
          interval: interval,
          axisLabel: {
            show: true,
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: 10,
            formatter: function(value) {
              return Math.round(value);
            },
            showMinLabel: true,
            showMaxLabel: true
          }
        },
        series: [{
          data: history
        }]
      });
      console.log('[home] 心率折线图数据更新成功');
    } catch (error) {
      console.error('[home] 更新心率折线图失败:', error);
    }
  },

  /**
   * 更新呼吸折线图
   */
  updateRespiratoryChart() {
    if (!this._respiratoryChart) {
      console.log('[home] 呼吸折线图实例不存在，跳过更新');
      return;
    }
    
    const history = this.data.breathRateHistory || [];
    if (history.length === 0) {
      console.log('[home] 呼吸率历史数据为空，跳过更新');
      return;
    }
    
    try {
      const xData = history.map((_, index) => index);
      const minValue = Math.min(...history);
      const maxValue = Math.max(...history);
      const padding = (maxValue - minValue) * 0.2 || 2; // 20%的padding，最小2
      
      // 动态计算Y轴范围
      let yMax = 40;
      let interval = 10;
      
      if (maxValue > 40) {
        // 如果数据超过40，动态调整范围
        // 计算合适的最大值（向上取整到10的倍数）
        yMax = Math.ceil(maxValue / 10) * 10;
        // 如果最大值很大，增加间隔
        if (yMax > 80) {
          interval = 20;
          yMax = Math.ceil(maxValue / 20) * 20;
        } else if (yMax > 60) {
          interval = 15;
          yMax = Math.ceil(maxValue / 15) * 15;
        }
        console.log('[home] 呼吸率数据超出40，动态调整Y轴范围到:', yMax, '间隔:', interval);
      }
      
      console.log('[home] 更新呼吸折线图，数据点数量:', history.length, '范围:', minValue, '-', maxValue, 'Y轴范围: 0 -', yMax);
      this._respiratoryChart.setOption({
        xAxis: {
          data: xData,
          boundaryGap: false
        },
        yAxis: {
          min: 0,
          max: yMax,
          interval: interval,
          axisLabel: {
            show: true,
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: 10,
            formatter: function(value) {
              return Math.round(value);
            },
            showMinLabel: true,
            showMaxLabel: true
          }
        },
        series: [{
          data: history
        }]
      });
      console.log('[home] 呼吸折线图数据更新成功');
    } catch (error) {
      console.error('[home] 更新呼吸折线图失败:', error);
    }
  },

  /**
   * 更新折线图数据（兼容旧方法，使用历史数据）
   */
  updateWaveformCharts(heartRateWave, respiratoryWave) {
    console.log('[home] ========== updateWaveformCharts被调用 ==========');
    console.log('[home] 注意：现在使用历史数据数组来更新折线图');
    console.log('[home] 心率历史数组长度:', this.data.heartRateHistory ? this.data.heartRateHistory.length : 0);
    console.log('[home] 呼吸率历史数组长度:', this.data.breathRateHistory ? this.data.breathRateHistory.length : 0);
    
    // 使用历史数据更新折线图
    this.updateHeartRateChart();
    this.updateRespiratoryChart();
  },

  /**
   * 恢复页面实时数据请求
   */
  restoreRealtimeDataRequest(wifiMac) {
    if (!wifiMac) {
      log.warn('WiFi MAC为空，无法恢复实时数据请求');
      return;
    }
    
    log.info('恢复页面实时数据请求', { wifiMac });
    
    // 检查用户是否已登录
    if (!AuthApi.isLoggedIn()) {
      log.warn('用户未登录，无法恢复实时数据请求');
      // 清空设备状态
      this.clearDeviceData();
      this.deviceManager.clearRealtimeTimer();
      return;
    }
    
    if (!this.deviceManager) {
      log.error('deviceManager未初始化');
      return;
    }
    
    try {
      // 再次确认用户登录状态（三重保护）
      if (!AuthApi.isLoggedIn()) {
        log.warn('恢复数据请求时用户登录状态已失效，停止操作');
        return;
      }
      
      // 立即获取一次最新数据
      this.deviceManager.getDeviceRealtimeData(wifiMac);
      log.debug('已获取最新设备数据');
      
      // 重新启动实时数据定时器
      this.deviceManager.startRealtimeTimer(wifiMac);
      log.debug('已重新启动实时数据定时器');
      
      // 启动心跳监控
      this.startDeviceHeartbeatMonitor();
      log.debug('已启动心跳监控');
      
    } catch (error) {
      this.handleError(error, '恢复实时数据请求');
    }
  }
})