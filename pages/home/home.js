// pages/home.js
const DeviceManager = require('../../utils/deviceManager');
const AuthApi = require('../../utils/authApi');
const BluetoothManager = require('../../utils/bluetoothManager');
// const OximeterDeviceManager = require('../../utils/oximeterDeviceManager');
const OximeterTool = require('../../utils/Yimi/OximeterTool'); // 使用完整的Yimi工具集

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
    spo2: null, // 血氧值
    pulseRate: null, // 脉率
    perfusionIndex: null, // 灌注度
    batteryVoltage: null, // 电池电压
    oximeterConnected: false, // 血氧仪连接状态
    _realtimeTimer: null, // 定时器句柄
    _lastCheckTime: 0,    // 上次检查时间戳
    _checkInterval: 30000, // 检查间隔（30秒）
    _pageHidden: false,   // 页面是否隐藏
    _lastPageShowTime: 0,  // 上次页面显示时间
    _lastOnlineTime: 0,    // 设备最后在线时间
    // 设备状态显示相关
    deviceStatusText: '设备离线',
    deviceSubText: '点击连接>',
    deviceStatusClass: 'offline'
  },

  /**
   * 生命周期函数--监听页面加载
   */
  /**
   * 设置血氧仪事件监听
   */
  setupOximeterListeners() {
    if (!this.oximeterTool) return;
    
    // 避免重复绑定（检查是否已经设置过监听器）
    if (this._oximeterListenersSetup) {
      console.log('[home] 监听器已设置，跳过重复绑定');
      return;
    }
    
    console.log('[home] 设置血氧仪事件监听');
    
    // 监听实时数据
    this._onRealtimeData = (data) => {
      console.log('[home] 血氧数据更新:', JSON.stringify(data, null, 2));
      console.log('[home] 字段检查:', {
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
    
    // 监听设备信息
    this._onDeviceInfo = (info) => {
      console.log('[home] 收到设备信息:', info);
    };
    this.oximeterTool.on('deviceInfo', this._onDeviceInfo);
    
    // 监听断开连接
    this._onDisconnected = (data) => {
      console.log('[home] 血氧仪已断开连接:', data);
      this.setData({
        oximeterConnected: false,
        spo2: null,
        pulseRate: null,
        perfusionIndex: null,
        batteryVoltage: null
      });
      wx.showToast({
        title: '血氧仪已断开',
        icon: 'none',
        duration: 2000
      });
    };
    this.oximeterTool.on('disconnected', this._onDisconnected);
    
    this._oximeterListenersSetup = true;
  },

  onLoad(options) {
    this.deviceManager = new DeviceManager(this);
    
    // 初始化血氧仪工具 - 使用完整的OximeterTool
    this.oximeterTool = new OximeterTool();
    
    // 设置事件监听
    this.setupOximeterListeners();
    
    // 检查用户是否已登录
    if (!AuthApi.isLoggedIn()) {
      console.log('[home] 页面加载时用户未登录，跳过设备初始化');
      return;
    }
    
    // 检查是否已有WiFi MAC，如果有则初始化设备状态
    const wifiMac = wx.getStorageSync('wifi_device_mac');
    if (wifiMac) {
      console.log('[home] 页面加载时检测到已保存的WiFi MAC:', wifiMac);
      
      // 再次检查用户登录状态（双重保护）
      if (!AuthApi.isLoggedIn()) {
        console.log('[home] 页面加载时用户登录状态已失效，跳过设备初始化');
        return;
      }
      
      // 延迟初始化，确保页面完全加载
      setTimeout(() => {
        this.restoreRealtimeDataRequest(wifiMac);
      }, 500);
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
    console.log('[home] onShow');
    
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
      console.log('[home] 距离上次检查时间过短且页面未隐藏，跳过设备连接检查');
      return;
    }
    
    // 自动读取本地保存的设备信息
    const device = wx.getStorageSync('connectedDevice');
    const wifiMac = wx.getStorageSync('wifi_device_mac');
    const convertedIds = wx.getStorageSync('convertedCharacteristicIds');
    
    console.log('[home] 读取本地设备信息:', device);
    console.log('[home] WiFi MAC地址:', wifiMac);
    console.log('[home] 转换后的特征值ID:', convertedIds);
    console.log('[home] 页面状态:', { wasHidden, timeSinceLastShow, shouldCheck });
    
    // 智能判断逻辑：检查是否为第二次进入（已有WiFi MAC）
    if (wifiMac && this.data.deviceConnected) {
      // 如果已有WiFi MAC且设备已连接，使用心跳检测验证连接状态
      if (shouldProceed) {
        console.log('[home] 检测到已保存的WiFi MAC且设备已连接，使用心跳检测验证连接状态');
        
        // 使用心跳检测验证设备是否真的在线
        this.verifyDeviceConnectionWithHeartbeat(wifiMac, wasHidden);
        
        this.setData({ _lastCheckTime: now });
      } else {
        console.log('[home] 检测到已保存的WiFi MAC且设备已连接，跳过连接验证');
      }
      return;
    } else if (wifiMac) {
      console.log('[home] 检测到已保存的WiFi MAC，但需要检查用户登录状态');
      
      // 检查用户是否已登录，未登录时不能获取数据
      if (!AuthApi.isLoggedIn()) {
        console.log('[home] 用户未登录，即使有WiFi MAC也无法获取设备数据');
        this.setData({
          deviceConnected: false,
          deviceName: '',
          heartRate: null,
          breathRate: null,
          turnOver: null,
          isLeavePillow: true,
          spo2: null,
          perfusionIndex: null,
          batteryVoltage: null
        });
        this.deviceManager.clearRealtimeTimer();
        
        // 提示用户需要登录
        // wx.showModal({
        //   title: '请先登录',
        //   content: '您需要先登录才能查看设备数据，是否前往登录页面？',
        //   confirmText: '去登录',
        //   cancelText: '稍后',
        //   success: (res) => {
        //     if (res.confirm) {
        //       wx.navigateTo({
        //         url: '/page_subject/login/login'
        //       });
        //     }
        //   }
        // });
        return;
      }
      
      console.log('[home] 检测到已保存的WiFi MAC且用户已登录，使用心跳检测确认设备连接状态');
      
      // 使用心跳检测确认设备连接状态
      this.checkDeviceConnectionWithHeartbeat(wifiMac, device);
      
      // 更新检查时间
      this.setData({ _lastCheckTime: now });
      
    } else if (device && device.deviceId) {
      // 第一次进入：有设备信息但没有WiFi MAC，需要完整流程
      console.log('[home] 第一次进入：有设备信息但没有WiFi MAC，需要完整流程');
      
      // 对于第一次进入，不进行频繁检查限制
      if (shouldProceed) {
        console.log('[home] 开始检查设备连接状态');
        this.setData({ _lastCheckTime: now }); // 更新检查时间
        
        this.checkDeviceConnection(device.deviceId).then(isConnected => {
          if (isConnected) {
            console.log('[home] 设备连接正常，但没有WiFi MAC，需要先配置WiFi');
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
            console.log('[home] 设备未真正连接，清除本地存储');
            wx.removeStorageSync('connectedDevice');
            wx.removeStorageSync('convertedCharacteristicIds');
            this.setData({
              deviceConnected: false,
              deviceName: '',
              heartRate: null,
              breathRate: null,
              turnOver: null,
              isLeavePillow: true
            });
            this.deviceManager.clearRealtimeTimer(); // 无设备时清理定时器
          }
        }).catch(error => {
          console.error('[home] 设备连接检查失败:', error);
          // 检查失败时，不清除存储，只设置为未连接状态
          this.setData({
            deviceConnected: false,
            deviceName: '',
            heartRate: null,
            breathRate: null,
            turnOver: null,
            isLeavePillow: true
          });
          this.deviceManager.clearRealtimeTimer();
        });
      } else {
        console.log('[home] 跳过设备连接检查');
      }
    } else {
      // 没有设备信息也没有WiFi MAC，直接设置为未连接状态
      console.log('[home] 没有设备信息也没有WiFi MAC，设置为未连接状态');
      this.setData({
        deviceConnected: false,
        deviceName: '',
        heartRate: null,
        breathRate: null,
        turnOver: null,
        isLeavePillow: true
      });
      this.deviceManager.clearRealtimeTimer(); // 无设备时清理定时器
    }
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {
    console.log('[home] onHide');
    this.setData({ _pageHidden: true });
    this.deviceManager.clearRealtimeTimer();
    // 停止心跳监控
    this.stopDeviceHeartbeatMonitor();
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {
    this.deviceManager.clearRealtimeTimer();
    // 停止心跳监控
    this.stopDeviceHeartbeatMonitor();
    
    // 移除血氧仪事件监听
    if (this.oximeterTool && this._oximeterListenersSetup) {
      if (this._onRealtimeData) {
        this.oximeterTool.off('realtimeData', this._onRealtimeData);
      }
      if (this._onDeviceInfo) {
        this.oximeterTool.off('deviceInfo', this._onDeviceInfo);
      }
      if (this._onDisconnected) {
        this.oximeterTool.off('disconnected', this._onDisconnected);
      }
      this._oximeterListenersSetup = false;
    }
    
    // 断开血氧仪连接
    if (this.oximeterTool) {
      this.oximeterTool.stop();
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
      // 检查平台：仅 Android 需要申请位置权限
      const systemInfo = wx.getSystemInfoSync();
      const isAndroid = systemInfo && /android/i.test(systemInfo.system || systemInfo.platform || '');
      
      if (isAndroid) {
        wx.showLoading({ title: '检查权限中...' });
        
        // 仅 Android 检查位置权限
        const checkLocationPromise = new Promise((resolve, reject) => {
          wx.getSetting({
            success: (res) => {
              if (res.authSetting['scope.userLocation']) {
                console.log('[home] 位置权限已授权');
                resolve();
              } else {
                console.log('[home] 请求位置权限');
                wx.authorize({
                  scope: 'scope.userLocation',
                  success: () => {
                    console.log('[home] 位置权限授权成功');
                    resolve();
                  },
                  fail: () => {
                    console.log('[home] 位置权限授权失败');
                    wx.showModal({
                      title: '权限提示',
                      content: '需要位置权限以使用蓝牙功能，请在设置中开启',
                      confirmText: '去设置',
                      cancelText: '取消',
                      success: (modalRes) => {
                        if (modalRes.confirm) {
                          wx.openSetting();
                        }
                        reject(new Error('用户拒绝授权'));
                      }
                    });
                  }
                });
              }
            },
            fail: reject
          });
        });
        
        await checkLocationPromise;
      } else {
        console.log('[home] iOS 平台，无需申请位置权限');
      }
      
      wx.showLoading({ title: '搜索设备中...' });
      
      // 启动OximeterTool（会自动搜索和连接设备）
      const result = await this.oximeterTool.start();
      
      wx.hideLoading();
      
      if (result.success) {
        this.setData({ oximeterConnected: true });
        wx.showToast({
          title: '连接成功',
          icon: 'success',
          duration: 2000
        });
        console.log('[home] 已连接设备:', result.device.name);
      } else {
        wx.showModal({
          title: '连接失败',
          content: result.error || '无法连接血氧仪设备',
          showCancel: false
        });
      }
    } catch (error) {
      wx.hideLoading();
      this.setData({ oximeterConnected: false });
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
    if (this.oximeterTool) {
      await this.oximeterTool.stop();
      this.setData({
        oximeterConnected: false,
        spo2: null,
        perfusionIndex: null,
        batteryVoltage: null
      });
      wx.showToast({
        title: '已断开',
        icon: 'success',
        duration: 1500
      });
    }
  },

  // 检查设备连接状态 - 使用心跳检测替代蓝牙检查
  async checkDeviceConnection(deviceId) {
    try {
      console.log('[home] 开始检查设备连接状态，deviceId:', deviceId);
      
      // 检查用户是否已登录
      if (!AuthApi.isLoggedIn()) {
        console.log('[home] 用户未登录，无法检查设备连接状态');
        return false;
      }
      
      // 获取WiFi MAC地址进行心跳检测
      const wifiMac = wx.getStorageSync('wifi_device_mac');
      if (!wifiMac) {
        console.log('[home] 没有WiFi MAC地址，无法进行心跳检测');
        return false;
      }
      
      // 使用心跳检测替代蓝牙检查
      const heartbeatResult = await this.deviceManager.deviceHeartbeat(wifiMac);
      
      if (heartbeatResult.success && heartbeatResult.isOnline) {
        console.log('[home] 设备心跳检测成功，设备在线，状态:', heartbeatResult.status.name);
        return true;
      } else {
        console.log('[home] 设备心跳检测失败或设备离线:', heartbeatResult.error);
        return false;
      }
    } catch (error) {
      console.log('[home] 设备连接状态检查失败，deviceId:', deviceId, '错误:', error);
      return false;
    }
  },

  /**
   * 手动刷新设备状态
   */
  refreshDeviceStatus() {
    console.log('[home] 手动刷新设备状态');
    
    // 检查用户是否已登录
    if (!AuthApi.isLoggedIn()) {
      console.log('[home] 用户未登录，无法刷新设备状态');
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }
    
    // 检查是否有WiFi MAC
    const wifiMac = wx.getStorageSync('wifi_device_mac');
    if (wifiMac && this.data.deviceConnected) {
      console.log('[home] 手动刷新：使用恢复方法重新启动实时数据请求');
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
    const now = Date.now();
    
    if (isOnline) {
      // 设备在线，更新最后在线时间
      this.setData({
        _lastOnlineTime: now
      });
      console.log('[home] 设备在线，更新最后在线时间:', new Date(now).toLocaleTimeString());
    } else {
      console.log('[home] 设备离线:', new Date(now).toLocaleTimeString());
    }
  },

  /**
   * 更新设备状态显示
   * @param {boolean} isConnected 设备是否连接
   * @param {string} deviceName 设备名称
   */
  updateDeviceStatusDisplay(isConnected, deviceName = '') {
    let statusText = '';
    let subText = '';
    let statusClass = '';
    
    if (isConnected) {
      statusText = '设备已连接';
      subText = 'zzzMinga';
      statusClass = 'connected';
    } else {
      statusText = '设备离线';
      subText = '点击连接>';
      statusClass = 'offline';
    }
    
    console.log('[home] 准备更新设备状态显示，setData前:', {
      isConnected,
      deviceName,
      statusText,
      subText,
      statusClass,
      currentData: {
        deviceConnected: this.data.deviceConnected,
        deviceStatusText: this.data.deviceStatusText,
        deviceSubText: this.data.deviceSubText,
        deviceStatusClass: this.data.deviceStatusClass
      }
    });
    
    this.setData({
      deviceStatusText: statusText,
      deviceSubText: subText,
      deviceStatusClass: statusClass
    });
    
    console.log('[home] 设备状态显示更新完成，setData后:', {
      isConnected,
      deviceName,
      statusText,
      subText,
      statusClass,
      updatedData: {
        deviceConnected: this.data.deviceConnected,
        deviceStatusText: this.data.deviceStatusText,
        deviceSubText: this.data.deviceSubText,
        deviceStatusClass: this.data.deviceStatusClass
      }
    });
  },

  /**
   * 使用心跳检测验证设备连接状态
   * @param {string} wifiMac WiFi MAC地址
   * @param {boolean} wasHidden 页面是否刚从隐藏状态恢复
   */
  async verifyDeviceConnectionWithHeartbeat(wifiMac, wasHidden) {
    try {
      console.log('[home] 开始使用心跳检测验证设备连接状态，MAC:', wifiMac);
      
      // 执行心跳检测
      const heartbeatResult = await this.deviceManager.deviceHeartbeat(wifiMac);
      
      // 添加详细的心跳检测结果日志
      console.log('[home] 心跳检测结果分析:', {
        success: heartbeatResult.success,
        isOnline: heartbeatResult.isOnline,
        isOfflineTooLong: heartbeatResult.isOfflineTooLong,
        timeSinceLastUpdate: heartbeatResult.timeSinceLastUpdate,
        error: heartbeatResult.error,
        statusId: heartbeatResult.status?.id,
        statusName: heartbeatResult.status?.name,
        fullResult: heartbeatResult
      });
      
      if (heartbeatResult.success && heartbeatResult.isOnline) {
        console.log('[home] 心跳检测验证成功，设备在线，状态:', heartbeatResult.status.name);
        
        // 更新设备在线状态
        this.updateDeviceOnlineStatus(true);
        
        // 设备在线，确保连接状态正确
        this.setData({
          deviceConnected: true,
          deviceName: 'zzZMinga'
        });
        
        // 更新设备状态显示
        this.updateDeviceStatusDisplay(true, 'zzZMinga');
        
        // 根据页面状态选择数据刷新方式
        if (wasHidden) {
          console.log('[home] 页面刚从隐藏状态恢复，使用专门的恢复方法');
          this.restoreRealtimeDataRequest(wifiMac);
        } else {
          console.log('[home] 正常情况下的数据刷新');
          this.deviceManager.getDeviceRealtimeData(wifiMac);
        }
        
        console.log('[home] 设备连接状态验证完成，设备在线');
      } else {
        console.log('[home] 心跳检测失败或设备离线:', heartbeatResult.error || '设备离线');
        
        // 更新设备离线状态
        this.updateDeviceOnlineStatus(false);
        
        // 设备离线，更新连接状态
        this.setData({
          deviceConnected: false,
          deviceName: '',
          heartRate: null,
          breathRate: null,
          turnOver: null,
          isLeavePillow: true,
          spo2: null,
          perfusionIndex: null,
          batteryVoltage: null
        });
        
        // 更新设备状态显示
        this.updateDeviceStatusDisplay(false, '');
        
        // 停止实时数据定时器和心跳监控
        this.deviceManager.clearRealtimeTimer();
        this.stopDeviceHeartbeatMonitor();
        
        console.log('[home] 设备连接状态验证完成，设备离线');
      }
    } catch (error) {
      console.error('[home] 心跳检测验证异常:', error);
      
      // 检测异常，设置为未连接状态
      this.setData({
        deviceConnected: false,
        deviceName: '',
        heartRate: null,
        breathRate: null,
        turnOver: null,
        isLeavePillow: true
      });
      
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
    try {
      console.log('[home] 开始使用心跳检测确认设备连接状态，MAC:', wifiMac);
      
      // 执行心跳检测
      const heartbeatResult = await this.deviceManager.deviceHeartbeat(wifiMac);
      
      if (heartbeatResult.success && heartbeatResult.isOnline) {
        console.log('[home] 心跳检测成功，设备在线，状态:', heartbeatResult.status.name);
        
        // 更新设备在线状态
        this.updateDeviceOnlineStatus(true);
        
        // 设备在线，设置连接状态
        this.setData({
          deviceConnected: true,
          deviceName: 'zzZMinga'
        });
        
        // 获取设备实时数据
        this.deviceManager.getDeviceRealtimeData(wifiMac);
        this.deviceManager.startRealtimeTimer(wifiMac);
        
        // 启动心跳监控
        this.startDeviceHeartbeatMonitor();
        
        console.log('[home] 设备连接状态确认完成，设备在线');
      } else {
        console.log('[home] 心跳检测失败或设备离线:', heartbeatResult.error || '设备离线');
        
        // 更新设备离线状态
        this.updateDeviceOnlineStatus(false);
        
        // 设备离线，设置未连接状态
        this.setData({
          deviceConnected: false,
          deviceName: '',
          heartRate: null,
          breathRate: null,
          turnOver: null,
          isLeavePillow: true,
          spo2: null,
          perfusionIndex: null,
          batteryVoltage: null
        });
        
        // 停止实时数据定时器
        this.deviceManager.clearRealtimeTimer();
        
        console.log('[home] 设备连接状态确认完成，设备离线');
      }
    } catch (error) {
      console.error('[home] 心跳检测异常:', error);
      
      // 检测异常，设置为未连接状态
      this.setData({
        deviceConnected: false,
        deviceName: '',
        heartRate: null,
        breathRate: null,
        turnOver: null,
        isLeavePillow: true
      });
      
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
      console.log('[home] 没有WiFi MAC地址，无法启动心跳监控');
      return;
    }

    console.log('[home] 启动设备心跳监控，MAC:', wifiMac);
    
    // 启动心跳监控，每30秒检测一次
    this.deviceManager.startHeartbeatMonitor(wifiMac, 30000, (result) => {
      console.log('[home] 心跳检测结果:', result);
      
      if (result.success && result.isOnline) {
        // 设备在线，更新在线状态
        this.updateDeviceOnlineStatus(true);
        
        // 检查是否需要更新连接状态
        const wasOffline = !this.data.deviceConnected;
        
        if (wasOffline) {
          console.log('[home] 心跳检测显示设备从离线回到在线，更新连接状态');
          this.setData({
            deviceConnected: true,
            deviceName: 'zzZMinga'
          });
          
          // 设备从离线回到在线，重新启动数据获取
          console.log('[home] 设备从离线回到在线，重新启动数据获取');
          this.deviceManager.getDeviceRealtimeData(wifiMac);
          this.deviceManager.startRealtimeTimer(wifiMac);
        } else {
          // 设备一直在线，确保数据获取正常
          console.log('[home] 设备保持在线状态，确保数据获取正常');
          if (!this.deviceManager._realtimeTimer) {
            console.log('[home] 实时数据定时器未运行，重新启动');
            this.deviceManager.getDeviceRealtimeData(wifiMac);
            this.deviceManager.startRealtimeTimer(wifiMac);
          }
        }
        
        // 更新设备状态显示
        this.updateDeviceStatusDisplay(true, 'zzZMinga');
        
      } else {
        // 设备离线或检测失败，更新离线状态
        this.updateDeviceOnlineStatus(false);
        
        console.log('[home] 心跳检测显示设备离线，更新连接状态');
        this.setData({
          deviceConnected: false,
          deviceName: '',
          heartRate: null,
          breathRate: null,
          turnOver: null,
          isLeavePillow: true,
          spo2: null,
          perfusionIndex: null,
          batteryVoltage: null
        });
        
        // 更新设备状态显示
        this.updateDeviceStatusDisplay(false, '');
        
        // 停止实时数据定时器
        this.deviceManager.clearRealtimeTimer();
      }
    });
  },

  /**
   * 停止设备心跳监控
   */
  stopDeviceHeartbeatMonitor() {
    console.log('[home] 停止设备心跳监控');
    this.deviceManager.clearHeartbeatTimer();
  },

  /**
   * 使用已有的WiFi MAC初始化设备
   */
  initializeDeviceWithWifiMac(wifiMac) {
    console.log('[home] 使用已有的WiFi MAC初始化设备:', wifiMac);
    
    if (!wifiMac) {
      console.log('[home] WiFi MAC为空，无法初始化设备');
      return;
    }
    
    // 设置设备为已连接状态
    this.setData({
      deviceConnected: true,
      deviceName: 'zzZMinga'
    });
    
    // 开始获取设备实时数据
    if (this.deviceManager) {
      this.deviceManager.getDeviceRealtimeData(wifiMac);
      this.deviceManager.startRealtimeTimer(wifiMac);
      console.log('[home] 设备初始化完成，开始获取实时数据');
    } else {
      console.error('[home] deviceManager未初始化');
    }
  },

  /**
   * 恢复页面实时数据请求
   */
  restoreRealtimeDataRequest(wifiMac) {
    console.log('[home] 恢复页面实时数据请求:', wifiMac);
    
    // 检查用户是否已登录
    if (!AuthApi.isLoggedIn()) {
      console.log('[home] 用户未登录，无法恢复实时数据请求');
      // 清空设备状态
      this.setData({
        deviceConnected: false,
        deviceName: '',
        heartRate: null,
        breathRate: null,
        turnOver: null,
        isLeavePillow: true
      });
      this.deviceManager.clearRealtimeTimer();
      return;
    }
    
    if (!wifiMac) {
      console.log('[home] WiFi MAC为空，无法恢复实时数据请求');
      return;
    }
    
    if (!this.deviceManager) {
      console.error('[home] deviceManager未初始化');
      return;
    }
    
    try {
      // 再次确认用户登录状态（三重保护）
      if (!AuthApi.isLoggedIn()) {
        console.log('[home] 恢复数据请求时用户登录状态已失效，停止操作');
        return;
      }
      
      // 立即获取一次最新数据
      this.deviceManager.getDeviceRealtimeData(wifiMac);
      console.log('[home] 已获取最新设备数据');
      
      // 重新启动实时数据定时器
      this.deviceManager.startRealtimeTimer(wifiMac);
      console.log('[home] 已重新启动实时数据定时器');
      
      // 启动心跳监控
      this.startDeviceHeartbeatMonitor();
      console.log('[home] 已启动心跳监控');
      
    } catch (error) {
      console.error('[home] 恢复实时数据请求失败:', error);
    }
  }
})