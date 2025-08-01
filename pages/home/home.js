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
    _realtimeTimer: null // 定时器句柄
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
    // 自动读取本地保存的设备信息
    const device = wx.getStorageSync('connectedDevice');
    const wifiMac = wx.getStorageSync('wifi_device_mac');
    const convertedIds = wx.getStorageSync('convertedCharacteristicIds');
    
    console.log('[home] 读取本地设备信息:', device);
    console.log('[home] WiFi MAC地址:', wifiMac);
    console.log('[home] 转换后的特征值ID:', convertedIds);
    
    if (device && device.deviceId) {
      // 检查设备是否真的已连接
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
          wx.removeStorageSync('wifi_device_mac');
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
      });
    } else {
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
      // 嘗試獲取設備的服務列表來檢查連接狀態
      const BluetoothManager = require('../../utils/bluetoothManager');
      const bluetoothManager = new BluetoothManager();
      const servicesRes = await bluetoothManager.getBLEDeviceServices(deviceId);
      console.log('[home] 設備連接狀態檢查成功，deviceId:', deviceId);
      return true;
    } catch (error) {
      console.log('[home] 設備連接狀態檢查失敗，deviceId:', deviceId, '錯誤:', error);
      return false;
    }
  }
})