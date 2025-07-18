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
    const wifiMac = wx.getStorageSync('wifi_device_mac')
    console.log('[home] 读取本地设备信息:', device);
    if (device && device.deviceId) {
      this.setData({
        deviceConnected: true,
        deviceName: device.name || ''
      });
      this.deviceManager.getDeviceRealtimeData(wifiMac);
      this.deviceManager.startRealtimeTimer(wifiMac); // 启动定时器
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
})