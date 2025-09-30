// 检查位置权限（用于蓝牙和WiFi功能）
function checkLocationAuth() {
  return new Promise((resolve, reject) => {
      wx.getSetting({
          success(res) {
              if (res.authSetting['scope.userLocation']) {
                  // 已授权
                  resolve();
              } else {
                  // 未授权则请求授权
                  wx.authorize({
                      scope: 'scope.userLocation',
                      success: resolve,
                      fail: () => {
                          // 用户拒绝授权，弹窗提示
                          wx.showModal({
                              title: '权限提醒',
                              content: '需要获取您的位置信息以使用蓝牙和WiFi功能。请在设置中手动开启“位置信息”权限，否则无法正常使用设备连接功能。',
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
    // iOS 需要先检查蓝牙权限状态，再申请权限
    return new Promise((resolve, reject) => {
      // 1. 先检查微信App的蓝牙权限状态
      wx.getSetting({
        success: (res) => {
          console.log('iOS权限检查 - 微信设置:', res.authSetting);
          
          const hasBluetoothAuth = res.authSetting['scope.bluetooth'];
          console.log('蓝牙权限状态:', hasBluetoothAuth);
          
          if (!hasBluetoothAuth) {
            // 2. 申请蓝牙权限
            console.log('iOS需要蓝牙权限，开始申请蓝牙权限');
            wx.authorize({
              scope: 'scope.bluetooth',
              success: () => {
                console.log('蓝牙权限申请成功，初始化蓝牙适配器');
                initBluetoothAdapter();
              },
              fail: () => {
                console.log('蓝牙权限申请失败，引导用户手动开启');
                showBluetoothPermissionModal();
                reject();
              }
            });
          } else {
            // 3. 已有权限，直接初始化
            console.log('蓝牙权限已授权，初始化蓝牙适配器');
            initBluetoothAdapter();
          }
          
          function initBluetoothAdapter() {
            wx.openBluetoothAdapter({
              success: () => {
                console.log('iOS蓝牙适配器初始化成功');
                resolve();
              },
              fail: (err) => {
                console.error('iOS蓝牙适配器初始化失败:', err);
                if (err.errCode === 10001) {
                  // 蓝牙未开启
                  wx.showModal({
                    title: '蓝牙未开启',
                    content: '请在系统设置中开启蓝牙功能，若您是ios设备，请额外开启微信App的蓝牙权限，然后重新尝试连接设备。',
                    confirmText: '知道了',
                    showCancel: false,
                    success: () => reject()
                  });
                } else {
                  // 其他权限问题
                  showBluetoothPermissionModal();
                }
              }
            });
          }
          
          function showBluetoothPermissionModal() {
            wx.showModal({
              title: '蓝牙权限未开启提醒',
              content: '请确保已开启蓝牙功能，您可按如下操作设置蓝牙\n1.手机开启蓝牙权限\n2.iOS设备需开启微信App的蓝牙权限\n3.小程序授予蓝牙权限',
              confirmText: '去设置',
              cancelText: '取消',
              success: (modalRes) => {
                if (modalRes.confirm) {
                  wx.openSetting({
                    success: (settingRes) => {
                      console.log('用户进入设置页面:', settingRes.authSetting);
                    }
                  });
                }
                reject();
              }
            });
          }
        },
        fail: (err) => {
          console.error('获取微信设置失败:', err);
          showBluetoothPermissionModal();
          reject();
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