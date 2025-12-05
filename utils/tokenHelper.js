/**
 * 获取最新 token，优先使用 userInfo 内的 token 以兼容不同接口返回结构
 */
function getLatestToken() {
  try {
    const userInfo = wx.getStorageSync('userInfo') || {};
    const storedToken = wx.getStorageSync('token');
    return userInfo.token || storedToken || '';
  } catch (error) {
    console.warn('读取本地 token 失败:', error);
    return '';
  }
}

module.exports = {
  getLatestToken
};

