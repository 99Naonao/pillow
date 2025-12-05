const AuthApi = require('./authApi');

const STORAGE_KEY = 'accountList';

function normalizeAccount(item, index = 0) {
  if (!item) {
    return null;
  }
  if (typeof item === 'string') {
    return {
      id: `account-${index}`,
      account: item,
      nickname: item,
      role: index === 0 ? '主账号' : '成员',
      status: '已启用',
      mobile: item,
      isOwner: index === 0
    };
  }

  const accountId = item.id || item.account || item.mobile || `account-${index}`;
  const nickname = item.nickname || item.name || item.remark || item.account || `账号${index + 1}`;
  const role = item.role || item.identity || (item.isOwner ? '主账号' : (index === 0 ? '主账号' : '成员'));
  const status = item.status || (item.enabled === false ? '已停用' : '已启用');

  return {
    id: accountId,
    account: item.account || item.mobile || '',
    nickname,
    role,
    status,
    mobile: item.mobile || item.account || '',
    isOwner: typeof item.isOwner === 'boolean' ? item.isOwner : index === 0,
    remark: item.remark || ''
  };
}

function readFromStorage() {
  try {
    const stored = wx.getStorageSync(STORAGE_KEY);
    if (Array.isArray(stored)) {
      return stored;
    }
    return [];
  } catch (error) {
    console.warn('读取账号缓存失败:', error);
    return [];
  }
}

function buildFallbackAccounts() {
  const userInfo = AuthApi.getUserInfo();
  if (!userInfo) {
    return [];
  }
  const primaryAccount = {
    id: userInfo.id || userInfo.account || 'primary-account',
    account: userInfo.account || userInfo.mobile || '',
    nickname: userInfo.nickname || userInfo.account || '主账号',
    role: '主账号',
    status: '已启用',
    mobile: userInfo.mobile || userInfo.account || '',
    isOwner: true
  };
  return [primaryAccount];
}

function getAccountList() {
  const stored = readFromStorage();
  const source = stored.length ? stored : buildFallbackAccounts();
  return source
    .map((item, index) => normalizeAccount(item, index))
    .filter(item => !!item);
}

function saveAccountList(list = []) {
  if (!Array.isArray(list)) {
    return;
  }
  try {
    wx.setStorageSync(STORAGE_KEY, list);
  } catch (error) {
    console.warn('保存账号列表失败:', error);
  }
}

function getAccountCount() {
  return getAccountList().length;
}

module.exports = {
  STORAGE_KEY,
  getAccountList,
  saveAccountList,
  getAccountCount
};

