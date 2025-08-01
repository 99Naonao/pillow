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
    // 小程序进入后台时不自动断开蓝牙，保持连接
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
