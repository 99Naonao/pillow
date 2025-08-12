// pages/home.js
const DeviceManager = require('../../utils/deviceManager');

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
    _lastCheckTime: 0,    // 上次檢查時間戳
    _checkInterval: 30000 // 檢查間隔（30秒）
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.deviceManager = new DeviceManager(this);
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
    
    // 檢查是否需要進行設備連接檢查（避免頻繁檢查）
    const now = Date.now();
    const shouldCheck = now - this.data._lastCheckTime > this.data._checkInterval;
    
    if (!shouldCheck) {
      console.log('[home] 距離上次檢查時間過短，跳過設備連接檢查');
      return;
    }
    
    // 自动读取本地保存的设备信息
    const device = wx.getStorageSync('connectedDevice');
    const wifiMac = wx.getStorageSync('wifi_device_mac');
    const convertedIds = wx.getStorageSync('convertedCharacteristicIds');
    
    console.log('[home] 读取本地设备信息:', device);
    console.log('[home] WiFi MAC地址:', wifiMac);
    console.log('[home] 转换后的特征值ID:', convertedIds);
    
    if (device && device.deviceId && wifiMac) {
      // 只有在有設備ID和WiFi MAC時才進行連接檢查
      console.log('[home] 開始檢查設備連接狀態');
      this.setData({ _lastCheckTime: now }); // 更新檢查時間
      
      this.checkDeviceConnection(device.deviceId).then(isConnected => {
        if (isConnected) {
          this.setData({
            deviceConnected: true,
            deviceName: device.name || ''
          });
          this.deviceManager.getDeviceRealtimeData(wifiMac);
          this.deviceManager.startRealtimeTimer(wifiMac); // 启动定时器
        } else {
          // 如果设备未真正连接，清除本地存储
          console.log('[home] 设备未真正连接，清除本地存储');
          wx.removeStorageSync('connectedDevice');
          // 不要清除 WiFi MAC 地址，因為它可能仍然有效
          // wx.removeStorageSync('wifi_device_mac');
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
        console.error('[home] 設備連接檢查失敗:', error);
        // 檢查失敗時，不清除存儲，只設置為未連接狀態
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
      // 沒有設備信息或WiFi MAC，直接設置為未連接狀態
      console.log('[home] 沒有設備信息或WiFi MAC，設置為未連接狀態');
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

  // 檢查設備連接狀態
  async checkDeviceConnection(deviceId) {
    try {
      console.log('[home] 開始檢查設備連接狀態，deviceId:', deviceId);
      
      // 首先檢查藍牙適配器是否可用
      const systemInfo = wx.getSystemInfoSync();
      console.log('[home] 系統信息:', systemInfo.platform, systemInfo.version);
      
      // 嘗試獲取設備的服務列表來檢查連接狀態
      const BluetoothManager = require('../../utils/bluetoothManager');
      const bluetoothManager = new BluetoothManager();
      
      // 設置超時時間，避免長時間等待
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('藍牙檢查超時')), 5000);
      });
      
      const servicesRes = await Promise.race([
        bluetoothManager.getBLEDeviceServices(deviceId),
        timeoutPromise
      ]);
      
      console.log('[home] 設備連接狀態檢查成功，deviceId:', deviceId, '服務數量:', servicesRes.services.length);
      return true;
    } catch (error) {
      console.log('[home] 設備連接狀態檢查失敗，deviceId:', deviceId, '錯誤:', error);
      console.log('[home] 錯誤詳情:', {
        message: error.message,
        errMsg: error.errMsg,
        errCode: error.errCode
      });
      
      // 根據錯誤類型決定是否重試
      if (error.message === '藍牙檢查超時') {
        console.log('[home] 藍牙檢查超時，可能是設備暫時不可用');
      } else if (error.errCode === 10001) {
        console.log('[home] 藍牙適配器不可用');
      } else if (error.errCode === 10012) {
        console.log('[home] 設備未連接');
      }
      
      return false;
    }
  },

  /**
   * 手動刷新設備狀態
   */
  refreshDeviceStatus() {
    console.log('[home] 手動刷新設備狀態');
    // 重置檢查時間，強制進行檢查
    this.setData({ _lastCheckTime: 0 });
    // 觸發 onShow 邏輯
    this.onShow();
  }
})