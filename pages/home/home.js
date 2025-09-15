// pages/home.js
const DeviceManager = require('../../utils/deviceManager');
const AuthApi = require('../../utils/authApi');
const BluetoothManager = require('../../utils/bluetoothManager');

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
    _lastPageShowTime: 0  // 上次页面显示时间
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.deviceManager = new DeviceManager(this);
    
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
      // 如果已有WiFi MAC且设备已连接，检查是否需要刷新数据
      if (shouldProceed) {
        console.log('[home] 检测到已保存的WiFi MAC且设备已连接，进行数据刷新');
        
        // 如果页面刚从隐藏状态恢复，使用专门的恢复方法
        if (wasHidden) {
          console.log('[home] 页面刚从隐藏状态恢复，使用专门的恢复方法');
          this.restoreRealtimeDataRequest(wifiMac);
        } else {
          // 正常情况下的数据刷新
          this.deviceManager.getDeviceRealtimeData(wifiMac);
        }
        
        this.setData({ _lastCheckTime: now });
      } else {
        console.log('[home] 检测到已保存的WiFi MAC且设备已连接，跳过数据刷新');
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
          isLeavePillow: true
        });
        this.deviceManager.clearRealtimeTimer();
        
        // 提示用户需要登录
        wx.showModal({
          title: '请先登录',
          content: '您需要先登录才能查看设备数据，是否前往登录页面？',
          confirmText: '去登录',
          cancelText: '稍后',
          success: (res) => {
            if (res.confirm) {
              wx.navigateTo({
                url: '/page_subject/login/login'
              });
            }
          }
        });
        return;
      }
      
      console.log('[home] 检测到已保存的WiFi MAC且用户已登录，跳过蓝牙连接检查，直接进行设备数据请求');
      
      // 如果有WiFi MAC且用户已登录，直接进行设备数据请求
      this.setData({
        deviceConnected: true,
        deviceName: device ? device.name : 'zzZMinga设备'
      });
      
      // 直接获取设备实时数据
      this.deviceManager.getDeviceRealtimeData(wifiMac);
      this.deviceManager.startRealtimeTimer(wifiMac);
      
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
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {
    this.deviceManager.clearRealtimeTimer();
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
      url: '/pages/blue/blue',
    })
  },

  // 检查设备连接状态
  async checkDeviceConnection(deviceId) {
    try {
      console.log('[home] 开始检查设备连接状态，deviceId:', deviceId);
      
      // 检查用户是否已登录
      if (!AuthApi.isLoggedIn()) {
        console.log('[home] 用户未登录，无法检查设备连接状态');
        return false;
      }
      
      // 首先检查蓝牙适配器是否可用
      const systemInfo = wx.getSystemInfoSync();
      console.log('[home] 系统信息:', systemInfo.platform, systemInfo.version);
      
      // 尝试获取设备的服务列表来检查连接状态
      const bluetoothManager = new BluetoothManager();
      
      // 设置超时时间，避免长时间等待
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('蓝牙检查超时')), 5000);
      });
      
      const servicesRes = await Promise.race([
        bluetoothManager.getBLEDeviceServices(deviceId),
        timeoutPromise
      ]);
      
      console.log('[home] 设备连接状态检查成功，deviceId:', deviceId, '服务数量:', servicesRes.services.length);
      return true;
    } catch (error) {
      console.log('[home] 设备连接状态检查失败，deviceId:', deviceId, '错误:', error);
      console.log('[home] 错误详情:', {
        message: error.message,
        errMsg: error.errMsg,
        errCode: error.errCode
      });
      
      // 根据错误类型决定是否重试
      if (error.message === '蓝牙检查超时') {
        console.log('[home] 蓝牙检查超时，可能是设备暂时不可用');
      } else if (error.errCode === 10001) {
        console.log('[home] 蓝牙适配器不可用');
      } else if (error.errCode === 10012) {
        console.log('[home] 设备未连接');
      } else if (error.errCode === 10013) {
        console.log('[home] 设备连接已断开');
      }
      
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
      deviceName: 'zzZMinga设备'
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
      
    } catch (error) {
      console.error('[home] 恢复实时数据请求失败:', error);
    }
  }
})