// app.js
App({
  onLaunch() {
    console.log('[app.js] 小程序启动');
  },

  onShow() {
    console.log('[app.js] 小程序显示');
  },

  onHide() {
    console.log('[app.js] 小程序隐藏（进入后台）');
    // 小程序进入后台时不断开蓝牙，保持连接
  },

  onUnload() {
    console.log('[app.js] 小程序完全关闭');
    
    // 小程序完全关闭时断开所有蓝牙连接
    try {
      // 获取当前连接的设备信息
      const connectedDevice = wx.getStorageSync('connectedDevice');
      if (connectedDevice && connectedDevice.deviceId) {
        console.log('[app.js] 断开蓝牙连接:', connectedDevice.deviceId);
        wx.closeBLEConnection({
          deviceId: connectedDevice.deviceId,
          success: () => {
            console.log('[app.js] 蓝牙连接已断开');
            // 清除本地存储的设备信息
            wx.removeStorageSync('connectedDevice');
          },
          fail: (error) => {
            console.error('[app.js] 断开蓝牙连接失败:', error);
          }
        });
      }
    } catch (error) {
      console.error('[app.js] 处理蓝牙断开时出错:', error);
    }
  },

  onError(error) {
    console.error('[app.js] 小程序错误:', error);
  },

  onUnhandledRejection(res) {
    console.error('[app.js] 未处理的Promise拒绝:', res);
  },

  onPageNotFound(res) {
    console.error('[app.js] 页面不存在:', res);
  },

  onThemeChange(res) {
    console.log('[app.js] 主题变化:', res);
  }
})
