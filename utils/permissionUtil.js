// 检查位置权限（用于蓝牙和WiFi功能）
// 注意：小程序位置权限和微信App系统位置权限是两个不同的权限
// 小程序权限：在小程序设置中授权
// 微信App系统权限：在手机系统设置中授权给微信App

let _locationPermissionModalVisible = false;
let _locationPermissionAwaitingReturn = false;

function isSystemLocationPermissionError(error) {
  if (!error) return false;
  if (error.type === 'miniprogram_permission') return false;

  const errCode = Number(error.errCode);
  const errno = Number(error.errno);
  const errMsg = String(error.errMsg || '').toLowerCase();

  // WiFi API 调用顺序/状态问题，不是权限问题
  if (errCode === 12000 || errMsg.includes('not invoke startwifi')) return false;
  // WiFi 未开、未连 WiFi、系统定位服务未开等
  if (errCode === 12003 || errCode === 12005 || errCode === 12006) return false;
  if (error.type === 'wifi_list_timeout') return false;

  if (errCode === 12012 || errCode === 12010) return true;
  // errno 不能单独判定：1505001 也出现在 errCode 12000（未 startWifi）等场景
  if (errno === 1505004 && (errCode === 12012 || errMsg.includes('permission'))) return true;
  if (error.type === 'system_permission' && (errCode === 12012 || errCode === 12010 || errMsg.includes('permission'))) {
    return true;
  }

  if (errMsg.includes('permission denied') || errMsg.includes('auth deny')) {
    return true;
  }
  // 避免 Android「may be not obtain GPS」在已授权时误判为 App 权限问题
  if (errMsg.includes('gps permission') && !errMsg.includes('may be')) {
    return true;
  }
  return false;
}

function isLocationServiceDisabledError(error) {
  if (!error) return false;
  const errCode = Number(error.errCode);
  const errMsg = String(error.errMsg || '').toLowerCase();
  return errCode === 12006
    || errMsg.includes('location service')
    || errMsg.includes('gps is disabled')
    || errMsg.includes('may be not obtain gps');
}

function showLocationServiceDisabledModal() {
  return new Promise((resolve) => {
    wx.showModal({
      title: '位置服务未开启',
      content: '微信 App 位置权限已开启，但系统定位服务/GPS 可能未打开。\n\n请打开手机「设置 → 位置信息」，开启定位服务后返回小程序重试。',
      confirmText: '知道了',
      showCancel: false,
      success: () => resolve(false)
    });
  });
}

/**
 * 打开微信 App 系统授权设置（位置/蓝牙等）；低版本回退到小程序设置页
 */
function openWechatAppAuthSetting() {
  return new Promise((resolve) => {
    if (typeof wx.openAppAuthorizeSetting === 'function') {
      wx.openAppAuthorizeSetting({
        success: () => resolve(true),
        fail: () => {
          wx.openSetting({
            success: () => resolve(true),
            fail: () => resolve(false)
          });
        }
      });
      return;
    }
    wx.openSetting({
      success: () => resolve(true),
      fail: () => resolve(false)
    });
  });
}

/**
 * 微信 App 未授予系统位置权限时的引导弹窗（防重复）
 */
async function showWechatAppLocationPermissionModal(error) {
  if (_locationPermissionModalVisible) {
    return false;
  }

  const setting = await getSettingAsync();
  const hasMiniProgramLocation = !!(setting && setting.authSetting['scope.userLocation']);
  if (!hasMiniProgramLocation) {
    try {
      await checkLocationAuth();
      return true;
    } catch (authErr) {
      console.warn('[permission] 小程序位置权限未授予:', authErr);
      return false;
    }
  }

  if (error && isLocationServiceDisabledError(error)) {
    return showLocationServiceDisabledModal();
  }

  _locationPermissionModalVisible = true;

  return new Promise((resolve) => {
    wx.showModal({
      title: '权限提醒',
      content: '需要开启微信App的位置权限才能使用WiFi功能。\n\n请按以下步骤操作：\n1. 打开手机系统设置\n2. 找到"微信"应用\n3. 开启"位置信息"权限\n4. 返回小程序重试',
      confirmText: '前往开启',
      cancelText: '取消',
      showCancel: true,
      complete: () => {
        _locationPermissionModalVisible = false;
      },
      success: async (modalRes) => {
        if (modalRes.confirm) {
          _locationPermissionAwaitingReturn = true;
          await openWechatAppAuthSetting();
          resolve(true);
        } else {
          resolve(false);
        }
      }
    });
  });
}

function isAwaitingLocationPermissionReturn() {
  return _locationPermissionAwaitingReturn;
}

function clearLocationPermissionAwaitingReturn() {
  _locationPermissionAwaitingReturn = false;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getSettingAsync() {
  return new Promise((resolve) => {
    wx.getSetting({
      success: resolve,
      fail: () => resolve(null)
    });
  });
}

function startWifiAsync() {
  return new Promise((resolve) => {
    wx.startWifi({
      success: () => resolve(true),
      fail: (error) => {
        console.warn('[permission] startWifi 探测失败:', error);
        resolve(!isSystemLocationPermissionError(error));
      }
    });
  });
}

function getConnectedWifiForProbe() {
  return new Promise((resolve) => {
    wx.getConnectedWifi({
      success: () => resolve(true),
      fail: (error) => {
        console.warn('[permission] getConnectedWifi 探测失败:', error);
        resolve(!isSystemLocationPermissionError(error));
      }
    });
  });
}

/** 探测系统位置权限是否已可用（不弹窗） */
async function probeWifiLocationPermission(options = {}) {
  const retries = options.retries || 5;
  const intervalMs = options.intervalMs || 800;

  for (let i = 0; i < retries; i += 1) {
    const setting = await getSettingAsync();
    if (!setting || !setting.authSetting['scope.userLocation']) {
      return false;
    }

    // 从微信系统授权页返回后，WiFi 模块和位置权限状态可能需要重新同步。
    await startWifiAsync();
    const granted = await getConnectedWifiForProbe();
    if (granted) {
      return true;
    }

    if (i < retries - 1) {
      await delay(intervalMs);
    }
  }

  return false;
}

/** 鸿蒙/Android 上 BLE 扫描常依赖系统定位已激活，扫描前触发一次 */
function ensureLocationForBleScan() {
  const type = CommonUtil.getSystemType();
  if (type !== 'ohos') {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: false,
      success: () => {
        console.log('[BLE] 鸿蒙扫描前 getLocation 成功');
        resolve();
      },
      fail: (err) => {
        console.warn('[BLE] 鸿蒙扫描前 getLocation 失败，可能影响 BLE 扫描:', err);
        resolve();
      }
    });
  });
}

function checkLocationAuth() {
  return new Promise((resolve, reject) => {
      wx.getSetting({
          success(res) {
              if (res.authSetting['scope.userLocation']) {
                  // 小程序已授权位置权限
                  // 注意：即使小程序已授权，如果微信App没有系统位置权限，调用WiFi相关API仍会失败
                  // 这种情况下会在调用API时返回错误，由调用方处理
                  resolve();
              } else {
                  // 未授权则请求授权
                  wx.authorize({
                      scope: 'scope.userLocation',
                      success: () => {
                          // 小程序权限已授权
                          resolve();
                      },
                      fail: () => {
                          // 用户拒绝授权，弹窗提示
                          wx.showModal({
                              title: '权限提醒',
                              content: '需要获取您的位置信息以使用蓝牙和WiFi功能。\n\n请按以下步骤操作：\n1. 在小程序设置中开启"位置信息"权限\n2. 在手机系统设置中开启微信App的"位置信息"权限',
                              confirmText: '去设置',
                              cancelText: '取消',
                              success: (modalRes) => {
                                  if (modalRes.confirm) {
                                      wx.openSetting();
                                  }
                                  reject();
                              }
                          });
                      }
                  });
              }
          },
          fail: (err) => {
              console.error('获取设置失败:', err);
              reject(err);
          }
      });
  });
}

// 检查蓝牙权限（依赖位置权限，并尝试打开蓝牙适配器）
function checkBluetoothAuth() {
  return new Promise((resolve, reject) => {
      checkLocationAuth()
         .then(() => {
              wx.openBluetoothAdapter({
                  success: resolve,
                  fail: () => {
                      // 蓝牙未开启或无权限，弹窗提示
                      wx.showModal({
                          title: '蓝牙权限提醒',
                          content: '请确保已开启蓝牙功能，并在系统设置中授权蓝牙权限，否则无法正常连接设备。',
                          confirmText: '去设置',
                          cancelText: '取消',
                          success: (modalRes) => {
                              if (modalRes.confirm) {
                                  wx.openSetting();
                              }
                              reject();
                          }
                      });
                  }
              });
          })
         .catch(reject);
  });
}

// 检查WiFi权限（只需位置权限）
function checkWifiAuth() {
  return checkLocationAuth();
}

// 新增：根据设备类型判断权限申请逻辑
const CommonUtil = require('./commonUtil');

/**
 * 根据设备类型申请蓝牙/位置权限
 * iPhone：只申请蓝牙权限（前提用户已开启微信定位权限）
 * Android：申请蓝牙和位置权限
 * @returns {Promise}
 */
function checkBluetoothAndLocationByDeviceType() {
  const type = CommonUtil.getSystemType();
  if (type === 'ios') {
    // iOS 权限处理策略：
    // 1. 先尝试直接打开蓝牙适配器（如果微信App已有系统权限，不会弹窗）
    // 2. 如果失败且是系统权限问题，引导用户去系统设置
    // 3. 如果失败且是小程序权限问题，再申请小程序权限
    return new Promise((resolve, reject) => {
      // 先尝试直接打开蓝牙适配器
      console.log('iOS尝试直接打开蓝牙适配器');
      wx.openBluetoothAdapter({
        success: () => {
          console.log('iOS蓝牙适配器初始化成功（无需额外权限申请）');
          resolve();
        },
        fail: (err) => {
          console.error('iOS蓝牙适配器初始化失败:', err);
          
          // 检查是否是系统权限问题（errCode: 10004 或 10009 表示系统权限未授予）
          if (err.errCode === 10004 || err.errCode === 10009) {
            // 系统权限未授予，引导用户去系统设置
            console.log('iOS系统蓝牙权限未授予，引导用户去系统设置');
            wx.showModal({
              title: '蓝牙权限未开启',
              content: '需要开启微信App的蓝牙权限才能使用蓝牙功能。\n\n请按以下步骤操作：\n1. 打开手机系统设置\n2. 找到"微信"应用\n3. 开启"蓝牙"权限\n4. 返回小程序重试',
              confirmText: '知道了',
              cancelText: '取消',
              showCancel: true,
              success: (modalRes) => {
                if (modalRes.confirm) {
                  // 引导用户去系统设置（iOS无法直接跳转，只能提示）
                  wx.showToast({
                    title: '请在系统设置中开启微信的蓝牙权限',
                    icon: 'none',
                    duration: 3000
                  });
                }
                reject();
              }
            });
            return;
          }
          
          // 检查是否是小程序权限问题（errCode: 10001 可能是蓝牙未开启或小程序权限问题）
          if (err.errCode === 10001) {
            // 可能是蓝牙未开启，先检查小程序权限状态
            wx.getSetting({
              success: (res) => {
                const hasBluetoothAuth = res.authSetting['scope.bluetooth'];
                if (!hasBluetoothAuth) {
                  // 小程序权限未授予，申请小程序权限
                  console.log('iOS小程序蓝牙权限未授予，申请小程序权限');
                  wx.authorize({
                    scope: 'scope.bluetooth',
                    success: () => {
                      console.log('小程序蓝牙权限申请成功，再次尝试打开蓝牙适配器');
                      // 权限申请成功后，再次尝试打开蓝牙适配器
                      wx.openBluetoothAdapter({
                        success: () => {
                          console.log('iOS蓝牙适配器初始化成功');
                          resolve();
                        },
                        fail: (retryErr) => {
                          console.error('iOS蓝牙适配器初始化再次失败:', retryErr);
                          if (retryErr.errCode === 10004 || retryErr.errCode === 10009) {
                            // 系统权限仍未授予
                            wx.showModal({
                              title: '蓝牙权限未开启',
                              content: '需要开启微信App的蓝牙权限才能使用蓝牙功能。\n\n请按以下步骤操作：\n1. 打开手机系统设置\n2. 找到"微信"应用\n3. 开启"蓝牙"权限\n4. 返回小程序重试',
                              confirmText: '知道了',
                              showCancel: false,
                              success: () => reject()
                            });
                          } else {
                            // 其他错误（可能是蓝牙未开启）
                            wx.showModal({
                              title: '蓝牙未开启',
                              content: '请在系统设置中开启蓝牙功能，若您是iOS设备，请额外开启微信App的蓝牙权限，然后重新尝试连接设备。',
                              confirmText: '知道了',
                              showCancel: false,
                              success: () => reject()
                            });
                          }
                        }
                      });
                    },
                    fail: () => {
                      console.log('小程序蓝牙权限申请失败');
                      wx.showModal({
                        title: '蓝牙权限未开启',
                        content: '需要开启蓝牙权限才能使用蓝牙功能。\n\n请按以下步骤操作：\n1. 在小程序设置中开启"蓝牙"权限\n2. 在手机系统设置中开启微信App的"蓝牙"权限',
                        confirmText: '去设置',
                        cancelText: '取消',
                        success: (modalRes) => {
                          if (modalRes.confirm) {
                            wx.openSetting({
                              success: () => {
                                console.log('用户进入小程序设置页面');
                              }
                            });
                          }
                          reject();
                        }
                      });
                    }
                  });
                } else {
                  // 小程序权限已授予，但蓝牙适配器打开失败，可能是蓝牙未开启
                  wx.showModal({
                    title: '蓝牙未开启',
                    content: '请在系统设置中开启蓝牙功能，若您是iOS设备，请额外开启微信App的蓝牙权限，然后重新尝试连接设备。',
                    confirmText: '知道了',
                    showCancel: false,
                    success: () => reject()
                  });
                }
              },
              fail: () => {
                // 获取设置失败，显示通用错误提示
                wx.showModal({
                  title: '蓝牙权限未开启',
                  content: '需要开启蓝牙权限才能使用蓝牙功能。\n\n请按以下步骤操作：\n1. 在小程序设置中开启"蓝牙"权限\n2. 在手机系统设置中开启微信App的"蓝牙"权限',
                  confirmText: '去设置',
                  cancelText: '取消',
                  success: (modalRes) => {
                    if (modalRes.confirm) {
                      wx.openSetting();
                    }
                    reject();
                  }
                });
              }
            });
          } else {
            // 其他未知错误
            wx.showModal({
              title: '蓝牙初始化失败',
              content: '蓝牙功能初始化失败，请检查蓝牙是否已开启，并确保已授予相关权限。',
              confirmText: '知道了',
              showCancel: false,
              success: () => reject()
            });
          }
        }
      });
    });
  } else if (type === 'android' || type === 'ohos') {
    // Android / 鸿蒙：需先申请位置权限再申请蓝牙
    return checkBluetoothAuth();
  } else {
    // 其它设备类型，默认与 Android 相同
    return checkBluetoothAuth();
  }
}


module.exports = {
  checkLocationAuth,
  checkBluetoothAuth,
  checkWifiAuth,
  checkBluetoothAndLocationByDeviceType,
  isSystemLocationPermissionError,
  openWechatAppAuthSetting,
  showWechatAppLocationPermissionModal,
  isAwaitingLocationPermissionReturn,
  clearLocationPermissionAwaitingReturn,
  probeWifiLocationPermission,
  ensureLocationForBleScan
};
