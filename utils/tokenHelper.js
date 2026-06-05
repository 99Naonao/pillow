const { APP_ID: CONFIG_APP_ID, APP_NAME: CONFIG_APP_NAME } = require('./appConfig');
/** 仅 bed WebSocket 设备令牌走 Node 后端 music.zsyl.cc */
const DETECTION_TOKEN_API_BASE = 'https://music.zsyl.cc/api';
const DETECTION_TOKEN_KEY = 'detectionToken';
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

/**
 * 获取用户登录 token，优先使用 userInfo 内的 token
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

function getMiniProgramAppId() {
  try {
    if (typeof __wxConfig !== 'undefined' && __wxConfig.accountInfo && __wxConfig.accountInfo.appId) {
      return __wxConfig.accountInfo.appId;
    }
  } catch (error) {
    console.warn('[tokenHelper] 读取 __wxConfig.appId 失败:', error);
  }

  try {
    const accountInfo = wx.getAccountInfoSync();
    if (accountInfo && accountInfo.miniProgram && accountInfo.miniProgram.appId) {
      return accountInfo.miniProgram.appId;
    }
  } catch (error) {
    console.warn('[tokenHelper] getAccountInfoSync 失败，使用 appConfig 兜底:', error);
  }

  return CONFIG_APP_ID || '';
}

function getAccessTokenStorageKey() {
  const appId = getMiniProgramAppId();
  return appId ? `${DETECTION_TOKEN_KEY}_${appId}` : DETECTION_TOKEN_KEY;
}

function parseExpiresAt(expiresAt) {
  if (expiresAt == null || expiresAt === '') {
    return null;
  }
  if (typeof expiresAt === 'number') {
    return expiresAt < 1e12 ? expiresAt * 1000 : expiresAt;
  }
  const normalized = String(expiresAt).trim().replace(/-/g, '/');
  const ms = Date.parse(normalized);
  return isNaN(ms) ? null : ms;
}

function saveAccessTokenCache(token, expiresAtMs) {
  try {
    wx.setStorageSync(getAccessTokenStorageKey(), {
      token,
      expiresAt: expiresAtMs
    });
  } catch (error) {
    console.warn('[tokenHelper] 缓存设备token失败:', error);
  }
}

function getStoredAccessTokenCache() {
  try {
    const cache = wx.getStorageSync(getAccessTokenStorageKey());
    if (!cache || typeof cache !== 'object' || typeof cache.token !== 'string' || !cache.token) {
      return null;
    }
    return cache;
  } catch (error) {
    console.warn('[tokenHelper] 读取设备 token 失败:', error);
    return null;
  }
}

function isAccessTokenValid(cache) {
  if (!cache || !cache.token) {
    return false;
  }
  const expiresAt = Number(cache.expiresAt);
  if (!expiresAt || isNaN(expiresAt)) {
    return false;
  }
  return Date.now() < expiresAt - TOKEN_REFRESH_BUFFER_MS;
}

/**
 * 从 Detection/token 响应中解析 access_token
 */
function extractTokenFromResponse(data) {
  if (!data) return '';

  const nested = data.data;
  if (nested && typeof nested === 'object') {
    if (typeof nested.access_token === 'string') return nested.access_token;
    if (typeof nested.token === 'string') return nested.token;
  }
  if (typeof nested === 'string') return nested;
  if (typeof data.access_token === 'string') return data.access_token;
  if (typeof data.token === 'string') return data.token;

  return '';
}

function isShopApiSuccess(data) {
  if (!data || typeof data !== 'object') return false;
  return data.code === 1 || data.code === '1';
}

/**
 * 从后端 GET /api/detection/token 获取访问令牌
 * @param {{ version?: string, forceRefresh?: boolean }} [options]
 * @returns {Promise<{ token: string, raw: object }>}
 */
function fetchDetectionToken(options = {}) {
  const { version = '1', forceRefresh = false } = options;
  const appId = getMiniProgramAppId();

  if (appId && appId !== CONFIG_APP_ID) {
    console.warn('[tokenHelper] AppId 与观心枕配置不一致:', appId, '期望:', CONFIG_APP_ID);
  } else if (appId) {
    console.log('[tokenHelper] 当前小程序:', CONFIG_APP_NAME, appId);
  }

  const query = forceRefresh ? '?forceRefresh=1' : '';

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${DETECTION_TOKEN_API_BASE}/detection/token${query}`,
      method: 'GET',
      header: {
        'content-type': 'application/json',
        'version': version,
        'X-WX-App-Id': appId
      },
      success: (res) => {
        console.log('[tokenHelper] 获取设备token响应:', res);

        if (res.statusCode !== 200) {
          reject(new Error(`获取设备token失败，状态码: ${res.statusCode}`));
          return;
        }

        const body = res.data;
        if (!isShopApiSuccess(body)) {
          reject(new Error((body && body.msg) || '获取设备token失败'));
          return;
        }

        const token = extractTokenFromResponse(body);
        if (!token) {
          console.error('[tokenHelper] code=1 但未解析到 access_token，响应:', body);
          reject(new Error('未获取到设备token'));
          return;
        }

        const nested = body.data || {};
        const expiresAt = parseExpiresAt(nested.expires_at)
          || (nested.expires_in ? Date.now() + Number(nested.expires_in) * 1000 : null);
        if (expiresAt) {
          saveAccessTokenCache(token, expiresAt);
        } else {
          try {
            wx.setStorageSync(getAccessTokenStorageKey(), token);
          } catch (error) {
            console.warn('[tokenHelper] 缓存设备token失败:', error);
          }
        }

        console.log('[tokenHelper] 获取设备token成功:', {
          appId: appId || 'unknown',
          tokenLength: token.length,
          expiresAt: expiresAt ? new Date(expiresAt).toLocaleString() : '(未知)'
        });

        resolve({ token, raw: body });
      },
      fail: (error) => {
        console.error('[tokenHelper] 获取设备token请求失败:', error);
        reject(new Error(error.errMsg || '获取设备token失败'));
      }
    });
  });
}

function clearDetectionToken() {
  try {
    wx.removeStorageSync(getAccessTokenStorageKey());
  } catch (error) {
    console.warn('[tokenHelper] 清除设备 token 失败:', error);
  }
}

function getStoredDetectionToken() {
  const cache = getStoredAccessTokenCache();
  if (cache && cache.token) {
    return cache.token;
  }
  try {
    return wx.getStorageSync(getAccessTokenStorageKey()) || '';
  } catch (error) {
    return '';
  }
}

/**
 * 获取 WebSocket 访问令牌（后端代理 GetAccessToken，24 小时有效）
 * @param {{ version?: string, forceRefresh?: boolean }} [options]
 * @returns {Promise<string>}
 */
async function getDetectionToken(options = {}) {
  const { version = '1', forceRefresh = false } = options;

  if (!forceRefresh) {
    const cache = getStoredAccessTokenCache();
    if (isAccessTokenValid(cache)) {
      console.log('[tokenHelper] 使用缓存设备token, 过期时间:',
        new Date(cache.expiresAt).toLocaleString());
      return cache.token;
    }
  }

  const result = await fetchDetectionToken({ version, forceRefresh });
  return result.token;
}

module.exports = {
  getLatestToken,
  fetchDetectionToken,
  getDetectionToken,
  getStoredDetectionToken,
  clearDetectionToken
};
