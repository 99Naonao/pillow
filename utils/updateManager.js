const EnvUtil = require('./envUtil');

/**
 * 检查小程序是否有新版本，提示用户重启升级
 */
function checkForUpdate() {
  if (typeof wx.getUpdateManager !== 'function') {
    console.warn('[updateManager] 当前基础库不支持 getUpdateManager');
    return;
  }

  const updateManager = wx.getUpdateManager();

  updateManager.onCheckForUpdate((res) => {
    console.log('[updateManager] 检查更新结果:', res.hasUpdate, EnvUtil.getEnvDescription());
  });

  updateManager.onUpdateReady(() => {
    console.log('[updateManager] 新版本已下载，等待用户重启');
    wx.showModal({
      title: '更新提示',
      content: '新版本已经准备好，是否重启小程序以使用最新功能？',
      confirmText: '立即重启',
      cancelText: '稍后',
      success(modalRes) {
        if (modalRes.confirm) {
          updateManager.applyUpdate();
        }
      }
    });
  });

  updateManager.onUpdateFailed(() => {
    console.error('[updateManager] 新版本下载失败');
    wx.showModal({
      title: '更新提示',
      content: '新版本下载失败，请稍后重试，或删除小程序后重新打开。',
      showCancel: false
    });
  });
}

module.exports = {
  checkForUpdate
};
