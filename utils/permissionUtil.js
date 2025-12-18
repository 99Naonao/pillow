// 检查位置权限（用于蓝牙和WiFi功能）
// 注意：小程序位置权限和微信App系统位置权限是两个不同的权限
// 小程序权限：在小程序设置中授权
// 微信App系统权限：在手机系统设置中授权给微信App
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
  } else if (type === 'android') {
    // Android 需先申请位置权限再申请蓝牙
    return checkBluetoothAuth();
  } else {
    // 其它设备类型，默认都申请
    return checkBluetoothAuth();
  }
}


module.exports = {
  checkLocationAuth,
  checkBluetoothAuth,
  checkWifiAuth,
  checkBluetoothAndLocationByDeviceType
};