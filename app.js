// app.js
App({
  onHide() {
    // 小程序被挂起/完全退出时自动断开蓝牙
    try {
      const device = wx.getStorageSync('connectedDevice');
      if (device && device.deviceId) {
        wx.closeBLEConnection({
          deviceId: device.deviceId,
          complete: () => {
            // 断开后清除本地存储
            wx.removeStorageSync('connectedDevice');
            console.log('[app.js] 小程序退出，已断开蓝牙连接');
          }
        });
      }
    } catch (e) {
      console.warn('[app.js] 小程序退出断开蓝牙异常', e);
    }
  }
})
