const {
  checkWifiAuth,
  checkBluetoothAndLocationByDeviceType,
  isAwaitingLocationPermissionReturn,
  clearLocationPermissionAwaitingReturn,
  probeWifiLocationPermission,
  isSystemLocationPermissionError,
  showWechatAppLocationPermissionModal
} = require('../../utils/permissionUtil');
const commonUtil = require('../../utils/commonUtil');
const BlueDeviceManager = require('../../utils/blueDeviceManager');
const WifiConfigManager = require('../../utils/wifiConfigManager');
const WifiManager = require('../../utils/wifiManager');
const UuidConverter = require('../../utils/uuidConverter');
const AuthApi = require('../../utils/authApi');
const BluetoothManager = require('../../utils/bluetoothManager');

// 引用BluFi配网库
const blufi = require('../../utils/blufi/xBlufi');

// BluFi 标准 UUID（Espressif）
const BLUFI_SERVICE_UUID = '0000FFFF-0000-1000-8000-00805F9B34FB';
const BLUFI_WRITE_CHAR_UUID = '0000FF01-0000-1000-8000-00805F9B34FB';

Page({
  data: {
    // 步骤
    currentTab: 0, // 当前步骤
    stepsCompleted: [false, false, false], // 步骤完成状态
    totalSteps: 3, // 总步骤数

    // 蓝牙
    devices: [], // 搜索到的蓝牙设备 
    connectedDeviceId: '', // 已连接的蓝牙设备ID
    isRefreshing: false, // 下拉刷新状态
    isSearching: false, // 是否正在搜索
    _modalShown: {}, // 记录已显示的弹窗，防止重复显示

    // WiFi
    isWifiConnected: false, // 手机是否已连接WiFi
    wifiName: '', // 当前或已选WiFi名称
    wifiList: [], // 可选WiFi列表
    wifiPassword: '', // WiFi密码
    wifiSelected: false, // 是否已选WiFi
    wifiConnectSuccess: false, // WiFi连接状态
    showWifiList: false, // 是否显示WiFi列表
    isChangingWifi: false, // 更换WiFi按钮加载态
    activeWifiBtn: '', // 当前按下的 WiFi 按钮：next | change
    is5GConnected: false, // 是否5G
    _has5GTip: false, // 防止重复弹出5G提示
    _has5GTipModal: false, // 进入WiFi步骤时重置弹窗标记
    wifiMac: '', // WiFi Mac地址
    isConfiguring: false, // 是否正在配网中
    wifiConfigSuccess: false, // 配网是否已成功完成

    // WiFi状态检测
    showWifiModal: false, // 是否显示WiFi弹窗
    wifiModalContent: '', // WiFi弹窗内容
    showPassword: false, // 是否显示密码
    wifiConfigDisabled: false, // WiFi配置是否被禁用（设备已连接且WiFi一致时禁用）

    // 保存的WiFi配置（用于蓝牙连接成功后配网）
    savedWifiConfig: null, // {ssid: '', password: ''}

    // 授权说明弹窗（第二步）
    guideModalVisible: false,
    guideVideoSrc: 'https://zhongshu.xinglu.shop/uploads/video/video.mp4',
    guideVideoPoster: '/static/bg.jpg',

    // 帮助链接弹窗
    helpModalVisible: false,

    // 错误处理
    _isShowingWifiError: false, // 防止重复显示WiFi错误提示


    // 序列号管理（参考项目）
    sequenceCount: 0,
  },

  onLoad() {
    // 初始化管理器
    this.blueDeviceManager = new BlueDeviceManager(this);
    this.wifiConfigManager = new WifiConfigManager(this);
    this.wifiManager = new WifiManager();
    this.UuidConverter = UuidConverter;
    this.commonUtil = commonUtil;

    // 檢測平台
    this.platform = commonUtil.getSystemType();
    this.isIOS = commonUtil.isIOS(this.platform);
    console.log('当前平台:', this.platform, 'WiFi MAC 来源: advertisData（全平台）');

    // 初始化BluFi配网
    this._initBlufi();

    // 保護已保存的WiFi MAC信息，從本地存儲讀取
    const savedWifiMac = commonUtil.getSavedWifiMac();
    if (savedWifiMac) {
      this.setData({
        wifiMac: savedWifiMac
      });
      console.log('頁面初始化時恢復已保存的WiFi MAC:', savedWifiMac);
    }

    // 檢查是否有已連接的設備
    const device = wx.getStorageSync('connectedDevice');
    if (device && device.deviceId) {
      console.log('onLoad: 發現已連接設備:', device.deviceId);
      // BluetoothManager.calculateWifiMacRegister(device.deviceId)
      this.setData({
        connectedDeviceId: device.deviceId
      });

    }
  },

  onShow() {
    this.isPageActive = true;
    console.log('blue页面显示，当前步骤:', this.data.currentTab);

    // 监听蓝牙连接状态变化
    this.blueDeviceManager.startBluetoothConnectionListener();

    if (this.data.currentTab === 0) {
      // 第一步：WiFi配置
      console.log('第一步：WiFi配置步骤');
      // 若上次 getWifiList 卡住未走 finally，避免按钮一直「加载中...」
      if (this.data.isChangingWifi) {
        wx.hideLoading();
        this.setData({ isChangingWifi: false });
      }
      this.setData({
        _modalShown: {} // 重置所有弹窗标记
      });
      this._resumeWifiStepOnShow();
    } else if (this.data.currentTab === 1) {
      // 第二步：蓝牙连接
      console.log('第二步：搜索蓝牙设备');
      // 使用统一的初始化方法
      this._initBluetoothStep();
    }
  },

  // 引导弹窗确认
  onGuideConfirm() {
    this.setData({
      guideModalVisible: false
    });

    // 用户点击"已进入配网模式"后，直接开始搜索蓝牙设备
    // 注意：权限已经在_initBluetoothStep()中检查过了，这里不需要再次检查
    console.log('用户确认后继续搜索蓝牙设备');
    // 如果还没有开始搜索，则开始搜索
    if (this.data.devices.length === 0 && !this.data.isSearching) {
      this.startBluetoothSearch();
    }
  },

  onHide() {
    this.isPageActive = false;
    this.wifiConfigManager.clearWifiStatusCheck();
    this.blueDeviceManager.stopBluetoothConnectionListener();
  },

  async onUnload() {
    this.isPageActive = false;
    this._clearBlufiWriteCache();
    this.wifiConfigManager.clearWifiStatusCheck();
    this.blueDeviceManager.stopBluetoothConnectionListener();

    await this._stopBluetoothSearch();
    console.log('页面卸载时已停止蓝牙搜索');

    // 清除连接超时定时器
    if (this._connectionTimeout) {
      clearTimeout(this._connectionTimeout);
      this._connectionTimeout = null;
    }

    // 清除配网超时定时器
    if (this._wifiConfigTimeout) {
      clearTimeout(this._wifiConfigTimeout);
      this._wifiConfigTimeout = null;
    }

    this._clearProvisionConfirm();

  },

  // 检查所有权限
  checkAllPermissions() {
    return checkBluetoothAndLocationByDeviceType();
  },

  // 检测是否为 iOS（保留兼容，内部使用 commonUtil）
  _detectIOSPlatform() {
    return commonUtil.isIOS();
  },

  _clearBlufiWriteCache() {
    this._blufiServiceId = null;
    this._blufiWriteCharId = null;
  },

  _delayMs(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  _clearProvisionConfirm() {
    this._provisionConfirmActive = false;
    if (this._provisionConfirmTimer) {
      clearInterval(this._provisionConfirmTimer);
      this._provisionConfirmTimer = null;
    }
  },

  _getProvisionWifiMac() {
    let wifiMac = this.data.wifiMac || '';
    if (!wifiMac) {
      const connected = (this.data.devices || []).find(
        (d) => d.deviceId === this.data.connectedDeviceId
      );
      wifiMac = connected?.deviceWifiMac
        || connected?.extractedMac
        || this._parseMacFromAdvertisData(connected?.advertisData)
        || '';
    }
    return wifiMac;
  },

  _finishProvisionSuccess(ssid) {
    if (this.data.wifiConfigSuccess) {
      return;
    }

    wx.hideLoading();
    this._clearProvisionConfirm();

    if (this._wifiConfigTimeout) {
      clearTimeout(this._wifiConfigTimeout);
      this._wifiConfigTimeout = null;
    }

    const wifiMac = this._getProvisionWifiMac();
    console.log('[配网成功] WiFi MAC(advertisData):', wifiMac);

    if (wifiMac) {
      wx.setStorage({
        key: 'wifi_device_mac',
        data: wifiMac
      });

      BluetoothManager.calculateWifiMacRegister(wifiMac)
        .then(() => {
          console.log('设备注册成功:', wifiMac);
        })
        .catch((err) => {
          console.error('设备注册失败:', err);
        });

      console.log('已保存WiFi MAC地址:', wifiMac);
    } else {
      console.warn('配网成功但未找到WiFi MAC地址，无法注册设备');
    }

    const wifiNameToSave = this.data.savedWifiConfig?.ssid || this.data.wifiName;
    if (wifiNameToSave) {
      wx.setStorage({
        key: 'connected_wifi_name',
        data: wifiNameToSave
      });
      console.log('已保存WiFi名称:', wifiNameToSave);
      if (ssid) {
        console.log('配网结果返回的ssid:', ssid);
      }
    }

    const ssidKey = this.data.savedWifiConfig?.ssid || this.data.wifiName;
    if (this.data.savedWifiConfig && this.data.savedWifiConfig.password && ssidKey) {
      wx.setStorage({
        key: ssidKey,
        data: this.data.savedWifiConfig.password
      });
    }

    this._wifiProvisioningActive = false;
    this._provisionWritesDone = false;
    this.setData({
      isConfiguring: false,
      wifiConfigSuccess: true,
      currentTab: 2,
      stepsCompleted: [true, true, true],
      wifiMac: wifiMac
    });
  },

  _startProvisionConfirmByHeartbeat() {
    if (this._provisionConfirmActive || this.data.wifiConfigSuccess) {
      return;
    }

    const wifiMac = this._getProvisionWifiMac();
    if (!wifiMac) {
      console.warn('[配网] BLE 断开但未获 WiFi MAC，无法心跳确认');
      return;
    }

    this._provisionConfirmActive = true;
    console.log('[配网] BLE 断开，启动心跳确认:', wifiMac);

    if (!this._deviceManager) {
      const DeviceManager = require('../../utils/deviceManager');
      this._deviceManager = new DeviceManager(this);
    }

    let attempts = 0;
    const maxAttempts = 12;
    const tick = async () => {
      if (!this._provisionConfirmActive || this.data.wifiConfigSuccess || !this._wifiProvisioningActive) {
        return;
      }

      attempts += 1;
      try {
        const hb = await this._deviceManager.deviceHeartbeat(wifiMac);
        if (hb.success && hb.isOnline) {
          console.log('[配网] 心跳确认设备在线，配网成功');
          this._clearProvisionConfirm();
          this._finishProvisionSuccess(this.data.savedWifiConfig?.ssid || this.data.wifiName || '');
          return;
        }
      } catch (err) {
        console.warn('[配网] 心跳确认失败:', err);
      }

      if (attempts >= maxAttempts) {
        console.log('[配网] 心跳确认达到上限，继续等待 notify 或总超时');
        this._clearProvisionConfirm();
      }
    };

    tick();
    this._provisionConfirmTimer = setInterval(tick, 2500);
  },

  _getBleConnectErrorMessage(data) {
    const errCode = data && (data.errCode != null ? data.errCode : data.errorCode);
    const errMsg = (data && data.errMsg) || '';
    switch (errCode) {
      case 10001:
        return '蓝牙不可用，请开启手机蓝牙并授权微信蓝牙权限';
      case 10002:
        return '未找到设备，请确认设备已进入配网模式且在附近';
      case 10003:
        return '连接被拒绝，请确保设备已进入配网模式且未被其他设备连接';
      case 10004:
        return '未找到蓝牙服务，请确认设备支持 BluFi 配网';
      case 10005:
        return '未找到蓝牙写入特征值，请确认设备已进入配网模式';
      case 10007:
        return '当前蓝牙特征值不支持写入，请重试';
      case 10012:
        return '连接超时，请检查设备是否在附近且信号良好';
      case 10013:
        return '设备标识无效，请重新搜索设备后重试';
      case 10016:
        return '蓝牙正在连接中，请稍候或重新搜索后再试';
      default:
        if (errMsg) {
          return `连接失败：${errMsg}`;
        }
        return errCode != null ? `连接失败 (错误码: ${errCode})` : '蓝牙连接失败，请重试';
    }
  },

  _showBleConnectFailModal(data) {
    const deviceId = (data && data.deviceId) || this._pendingConnectDeviceId;
    wx.showModal({
      title: '连接失败',
      content: this._getBleConnectErrorMessage(data),
      showCancel: true,
      cancelText: '取消',
      confirmText: '重试',
      success: (res) => {
        if (res.confirm && deviceId) {
          this.connectDevice(deviceId);
        }
      }
    });
  },

  /** 从系统设置返回后先探测权限，避免已授权仍重复弹窗 */
  async _resumeWifiStepOnShow() {
    if (isAwaitingLocationPermissionReturn()) {
      this.setData({ _isShowingWifiError: false });

      // 从系统设置返回后，权限状态同步有延迟，稍等再探测
      // 避免用户已授权但仍重复弹窗
      await new Promise(r => setTimeout(r, 800));
      const granted = await probeWifiLocationPermission({
        retries: 5,
        intervalMs: 800
      });

      if (granted) {
        console.log('[blue] 微信App位置权限已开启，继续初始化WiFi');
      } else {
        console.log('[blue] 微信App位置权限仍未开启');
      }
      clearLocationPermissionAwaitingReturn();
    }
    this.initWifiStep();
  },

  // 初始化WiFi步骤
  async initWifiStep() {
    console.log('开始初始化WiFi步骤');

    // 读取本地保存的WiFi名称（如果有保存的WiFi名称，说明之前配网成功过，需要检查）
    const savedWifiName = wx.getStorageSync('connected_wifi_name');

    console.log('第一步检查：本地保存的WiFi名称:', savedWifiName);

    // 如果有保存的WiFi名称，检查当前连接的WiFi与本地保存的WiFi是否一致
    if (savedWifiName) {
      console.log('检测到保存的WiFi名称，开始检查WiFi一致性');
      try {
        // 获取当前连接的WiFi
        console.log('正在获取当前连接的WiFi...');
        const wifiInfo = await this.wifiManager.getConnectedWifi();
        const currentWifiName = wifiInfo.wifi?.SSID;

        console.log('第一步检查：当前连接的WiFi:', currentWifiName);
        console.log('第一步检查：本地保存的WiFi:', savedWifiName);

        // 如果当前连接的WiFi与本地保存的WiFi一致，询问用户是否要重新配网
        if (currentWifiName && savedWifiName && currentWifiName === savedWifiName) {
          console.log('设备已连接到相同WiFi，询问用户是否重新配网');
          // 先设置WiFi信息，但不禁用配置
          this.setData({
            wifiName: currentWifiName,
            wifiSelected: true,
            showWifiList: false
          });
          
          // 弹出询问弹窗
          wx.showModal({
            title: '提示',
            content: `设备已连接到WiFi"${currentWifiName}"，是否要重新配网？`,
            cancelText: '不需要',
            confirmText: '重新配网',
            success: (res) => {
              if (res.confirm) {
                // 用户选择重新配网，允许配置
                console.log('用户选择重新配网，允许WiFi配置');
                this.setData({
                  wifiConfigDisabled: false,
                  wifiPassword: '' // 清空密码，让用户重新输入
                });
                // 继续初始化WiFi步骤
                this.wifiConfigManager.initWifiStep();
              } else {
                // 用户选择不需要，禁用配置
                console.log('用户选择不需要重新配网，禁用WiFi配置');
                this.setData({
                  wifiConfigDisabled: true
                });
              }
            }
          });
          return;
        } else {
          // 如果检测到WiFi不一致，重置WiFi配置禁用状态
          console.log('设备连接的WiFi与保存的WiFi不一致，允许重新配网');
          this.setData({
            wifiConfigDisabled: false
          });
        }
      } catch (error) {
        console.error('检查WiFi连接状态失败:', error);
        if (isSystemLocationPermissionError(error)) {
          showWechatAppLocationPermissionModal(error);
          return;
        }
        // 如果获取WiFi信息失败，重置禁用状态并继续正常流程
        this.setData({
          wifiConfigDisabled: false
        });
      }
    } else {
      // 如果设备未连接，重置禁用状态
      console.log('设备未连接，跳过WiFi一致性检查');
      this.setData({
        wifiConfigDisabled: false
      });
    }

    // 使用WiFi配置管理器初始化WiFi步骤
    this.wifiConfigManager.initWifiStep();
  },


  // 开始蓝牙搜索（统一 BluFi 扫描）
  startBluetoothSearch() {
    console.log('[blue] 开始搜索 GoodSleep, platform:', this.platform);

    this.setData({
      devices: [],
      isSearching: true
    });

    blufi.notifyStartDiscoverBle({
      isStart: true
    });
  },

  /** 停止蓝牙搜索 */
  _stopBluetoothSearch() {
    blufi.notifyStartDiscoverBle({
      isStart: false
    });
    this.setData({ isSearching: false });
  },

  // 下拉刷新
  onContentRefresh() {
    if (this.data.currentTab === 0) {
      // WiFi配置步骤：刷新WiFi列表
      this.setData({
        isRefreshing: true
      });
      this.wifiConfigManager.showWifiList()
        .then(() => {
          this.setData({
            isRefreshing: false
          });
          console.log('WiFi列表刷新完成');
        })
        .catch((error) => {
          this.setData({
            isRefreshing: false
          });
          console.error('WiFi列表刷新失败:', error);
        });
    } else if (this.data.currentTab === 1) {
      this.setData({
        isRefreshing: true
      });
      this.checkAllPermissions()
        .then(() => {
          this.startBluetoothSearch();
          this.setData({
            isRefreshing: false
          });
        })
        .catch(() => {
          this.setData({
            isRefreshing: false
          });
          wx.showToast({
            title: '权限不足',
            icon: 'none'
          });
        });
    }
  },

  // 自定义开关点击
  onCustomSwitchTap(e) {
    const deviceId = e.currentTarget.dataset.deviceid || e.currentTarget.dataset.deviceId;
    console.log('点击设备开关，deviceId:', deviceId);

    if (!deviceId) {
      console.error('deviceId 为空');
      wx.showToast({
        title: '设备ID无效',
        icon: 'none'
      });
      return;
    }

    const device = this.data.devices.find(d => d.deviceId === deviceId);

    if (device && device.isConnected) {
      wx.showModal({
        title: '断开连接',
        content: `确定要断开与设备 "${device.displayName || 'zzZMinga设备'}" 的连接吗？`,
        confirmText: '断开',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            this.disconnectDevice(deviceId);
          }
        }
      });
    } else {
      // 檢查用戶是否已登录
      if (!AuthApi.isLoggedIn()) {
        console.log('用戶未登录，彈出登录提示');
        wx.showModal({
          title: '请先登录',
          content: '您需要先登录才能连接设备，是否前往登录页面？',
          confirmText: '去登录',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm) {
              wx.navigateTo({
                url: '/page_subject/welcome/welcome'
              });
            }
          }
        });
        return;
      }

      this._connectBleDevice(deviceId, device);
    }
  },

  connectDevice(deviceId) {
    const device = this.data.devices.find(d => d.deviceId === deviceId);
    this._connectBleDevice(deviceId, device);
  },

  /** deviceId 是否为 MAC 格式（Android 常见）；鸿蒙/iOS 多为随机 UUID */
  _analyzeBleDeviceId(deviceId) {
    const id = String(deviceId || '');
    const isMacFormat = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(id);
    const isUuidFormat = /^[0-9A-Fa-f-]{36}$/i.test(id) || /^[0-9A-Fa-f]{32}$/i.test(id);
    return {
      deviceId: id,
      isMacFormat,
      isUuidFormat,
      // 鸿蒙/iOS 的「虚拟」deviceId 仍可用于 createBLEConnection，只要来自本次扫描
      note: isMacFormat
        ? 'MAC 格式 deviceId（Android 常见）'
        : (isUuidFormat ? 'UUID 格式 deviceId（鸿蒙/iOS 隐私标识，可正常连接）' : '非标准 deviceId 格式')
    };
  },

  /** 连接前停止扫描，避免鸿蒙等平台「边扫边连」卡住 */
  _ensureScanStoppedBeforeConnect() {
    blufi.notifyStartDiscoverBle({ isStart: false });
    this.setData({ isSearching: false });
    return new Promise((resolve) => {
      wx.stopBluetoothDevicesDiscovery({
        complete: () => resolve()
      });
    });
  },

  _onBleConnectSuccess(deviceId) {
    if (this._bleConnectHandled) {
      return;
    }
    this._bleConnectHandled = true;

    if (this._connectionTimeout) {
      clearTimeout(this._connectionTimeout);
      this._connectionTimeout = null;
    }

    this._pendingConnectDeviceId = '';
    this._stopBluetoothSearch();

    wx.hideLoading();

    const updatedDevices = this.data.devices.map((device) => ({
      ...device,
      isConnected: device.deviceId === deviceId
    }));

    this.setData({
      connectedDeviceId: deviceId,
      stepsCompleted: [true, true, false],
      devices: updatedDevices,
      currentTab: 2,
      isConfiguring: true,
      wifiConfigSuccess: false,
      sequenceCount: 0
    });

    this._wifiProvisioningActive = false;

    console.log('[BLE] 连接成功, deviceId:', deviceId, this._analyzeBleDeviceId(deviceId));

    this._pendingWifiConfigAfterInit = true;
    blufi.notifyInitBleEsp32({ deviceId });
  },

  _onBleConnectFail(failData) {
    if (this._bleConnectHandled) {
      return;
    }
    this._bleConnectHandled = true;

    if (this._connectionTimeout) {
      clearTimeout(this._connectionTimeout);
      this._connectionTimeout = null;
    }

    wx.hideLoading();
    console.log('[BLE] 连接失败:', failData, this._analyzeBleDeviceId(failData && failData.deviceId));
    this._clearBlufiWriteCache();
    this._showBleConnectFailModal(failData);
  },

  async _connectBleDevice(deviceId, device) {
    if (!deviceId) {
      return;
    }

    const idInfo = this._analyzeBleDeviceId(deviceId);
    console.log('[BLE] 尝试连接:', idInfo);
    console.log('[BLE] 设备 WiFi MAC(advertisData):', device && (device.deviceWifiMac || device.extractedMac));

    this._bleConnectHandled = false;
    this._clearBlufiWriteCache();

    await this._ensureScanStoppedBeforeConnect();
    // 鸿蒙上 stopDiscovery 后立即 connect 偶发无回调，短暂等待更稳
    if (this.platform === 'ohos') {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    wx.showLoading({
      title: '连接蓝牙设备中...',
    });

    if (this._connectionTimeout) {
      clearTimeout(this._connectionTimeout);
    }

    this._connectionTimeout = setTimeout(() => {
      if (this._bleConnectHandled) {
        return;
      }
      wx.hideLoading();
      console.log('[BLE] 页面连接超时(30s), deviceId:', deviceId);

      wx.showModal({
        title: '连接超时',
        content: '设备连接超时，请检查：\n1. 设备是否已进入配网模式\n2. 设备是否在附近\n3. 设备是否被其他应用占用\n\n若 deviceId 为 UUID 属正常；请重新搜索后再连。\n\n是否重试连接？',
        showCancel: true,
        cancelText: '取消',
        confirmText: '重试',
        success: (res) => {
          if (res.confirm) {
            this.connectDevice(deviceId);
          }
        }
      });
    }, 30000);

    this._pendingConnectDeviceId = deviceId;
    blufi.notifyConnectBle({
      isStart: true,
      deviceId: deviceId,
      name: this._getBleDeviceName(device) || 'GoodSleep设备'
    });
  },

  // 断开指定设备
  disconnectDevice(deviceId) {
    try {
      // 统一使用BluFi断开
      blufi.notifyConnectBle({
        isStart: false,
        deviceId: deviceId,
        name: 'GoodSleep设备'
      });

      console.log('设备连接已断开:', deviceId);
      this._handleDisconnectSuccess(deviceId);

    } catch (error) {
      console.error('断开设备连接失败:', error);
      wx.showToast({
        title: '断开失败',
        icon: 'none'
      });
    }
  },

  // 处理断开连接成功
  _handleDisconnectSuccess(deviceId) {
    this._clearBlufiWriteCache();
    // 更新设备状态
    const updatedDevices = this.data.devices.map(device => ({
      ...device,
      isConnected: device.deviceId === deviceId ? false : device.isConnected
    }));

    this.setData({
      devices: updatedDevices,
      connectedDeviceId: this.data.connectedDeviceId === deviceId ? '' : this.data.connectedDeviceId
    });

    // 如果断开的是当前连接的设备，清除本地存储并重置步骤
    if (this.data.connectedDeviceId === deviceId) {
      wx.removeStorageSync('connectedDevice');
      this.setData({
        connectedDeviceId: '',
        stepsCompleted: [false, false, false],
        currentTab: 0,
        wifiConfigDisabled: false // 重置WiFi配置禁用状态
      });
      console.log('已清除本地存储的设备信息');
    }

    wx.showToast({
      title: '设备已断开',
      icon: 'success'
    });
  },

  // 选择WiFi
  selectWifi(e) {
    // 如果WiFi配置被禁用，不允许选择
    if (this.data.wifiConfigDisabled) {
      return;
    }

    const {
      ssid
    } = e.currentTarget.dataset;
    console.log('选择WiFi:', ssid);
    // 使用WiFi配置管理器选择WiFi
    this.wifiConfigManager.selectWifi(ssid);
  },

  // 输入WiFi密码
  onInputPassword(e) {
    // 如果WiFi配置被禁用，不允许输入密码
    if (this.data.wifiConfigDisabled) {
      return;
    }

    this.setData({
      wifiPassword: e.detail.value
    });
  },

  // 切换密码显示/隐藏
  togglePasswordVisibility() {
    const newShowPassword = !this.data.showPassword;
    console.log('切换密码显示状态:', this.data.showPassword, '->', newShowPassword);
    this.setData({
      showPassword: newShowPassword
    });
    console.log('密码显示状态已更新:', this.data.showPassword);
  },

  onWifiBtnTouchStart(e) {
    const btn = e.currentTarget.dataset.btn;
    if (btn === 'next' && (this.data.is5GConnected || this.data.wifiConfigDisabled)) {
      return;
    }
    if (btn === 'change' && this.data.isChangingWifi) {
      return;
    }
    this.setData({ activeWifiBtn: btn });
  },

  onWifiBtnTouchEnd() {
    if (this.data.activeWifiBtn) {
      this.setData({ activeWifiBtn: '' });
    }
  },

  // 下一步（从WiFi配置到蓝牙连接）
  nextStep() {
    // 如果WiFi配置被禁用，不允许进入下一步
    if (this.data.wifiConfigDisabled) {
      wx.showModal({
        title: '提示',
        content: '设备已连接到WiFi，无需重复配网',
        showCancel: false,
        confirmText: '确定'
      });
      return;
    }

    if (!this.data.wifiName || !this.data.wifiPassword) {
      wx.showToast({
        title: '请填写WiFi名称和密码',
        icon: 'none'
      });
      return;
    }
    if (this.data.is5GConnected) {
      wx.showToast({
        title: '请选择2.4G WiFi',
        icon: 'none'
      });
      return;
    }

    console.log('WiFi配置完成，保存WiFi信息:', {
      wifiName: this.data.wifiName,
      wifiPassword: this.data.wifiPassword
    });

    // 保存WiFi配置信息
    const wifiConfig = {
      ssid: this.data.wifiName,
      password: this.data.wifiPassword
    };

    // 边界情况处理：确保WiFi配置有效
    if (!wifiConfig.ssid || !wifiConfig.password) {
      wx.showToast({
        title: 'WiFi配置信息不完整',
        icon: 'none'
      });
      return;
    }

    this.setData({
      savedWifiConfig: wifiConfig,
      stepsCompleted: [true, false, false], // 第一步完成
      currentTab: 1 // 跳转到蓝牙连接步骤
    });

    // 手动触发蓝牙连接步骤的初始化逻辑
    this._initBluetoothStep();
  },

  // 初始化蓝牙连接步骤
  _initBluetoothStep() {
    console.log('初始化蓝牙连接步骤');

    // 先检查蓝牙与定位授权
    this.checkAllPermissions()
      .then(() => {
        // 授权成功后，显示引导弹窗
        this.setData({
          guideModalVisible: true
        });
      })
      .catch(() => {
        wx.showToast({
          title: '请授权权限',
          icon: 'none'
        });
      });

    // 读取本地已连接设备状态
    const device = wx.getStorageSync('connectedDevice');
    console.log('读取本地设备信息:', device);

    // 检查本地存储的设备是否真的已连接
    if (device && device.deviceId) {
      this.blueDeviceManager.checkDeviceConnectionStatus(device.deviceId).then(isConnected => {
        if (isConnected) {
          this.setData({
            connectedDeviceId: device.deviceId,
            currentTab: 2,
            isConfiguring: true,
            wifiConfigSuccess: false
          });
          console.log('设备确实已连接，设置已连接设备ID:', device.deviceId);
          this._pendingWifiConfigAfterInit = true;
          blufi.notifyInitBleEsp32({ deviceId: device.deviceId });
        } else {
          console.log('设备未真正连接，清除本地存储');
          wx.removeStorageSync('connectedDevice');
          this.setData({
            connectedDeviceId: ''
          });
        }
        this.blueDeviceManager.updateDeviceConnectionStatus();
      });
    } else {
      this.blueDeviceManager.updateDeviceConnectionStatus();
    }

    // 进入蓝牙步骤后自动开始搜索蓝牙设备
    if (this.data.devices.length === 0 && !this.data.isSearching) {
      console.log('进入蓝牙步骤，自动开始搜索蓝牙设备');
      this.startBluetoothSearch();
    }
  },

  // 开始配网
  startWifiConfig() {
    console.log('开始配网');
    // 优先使用保存的WiFi配置，如果没有则使用当前数据
    const wifiConfig = this.data.savedWifiConfig || {
      ssid: this.data.wifiName,
      password: this.data.wifiPassword
    };

    // 检查WiFi配置
    if (!wifiConfig.ssid) {
      wx.showToast({
        title: 'SSID不能为空',
        icon: 'none'
      });
      return;
    }
    if (!wifiConfig.password) {
      wx.showToast({
        title: '密码不能为空',
        icon: 'none'
      });
      return;
    }

    // 确保使用保存的WiFi配置进行配网
    this.setData({
      wifiName: wifiConfig.ssid,
      wifiPassword: wifiConfig.password
    });

    console.log('使用WiFi配置进行配网:', wifiConfig);

    // 使用参考项目的配网方法
    this.connectWifi();
  },

  // 显示WiFi列表
  async showWifiList() {
    console.log('[blue] 更换WiFi点击, isChangingWifi:', this.data.isChangingWifi, 'platform:', this.platform);

    if (this.data.isChangingWifi) {
      console.warn('[blue] 更换WiFi进行中，请稍候');
      return;
    }

    this.setData({ isChangingWifi: true });
    wx.showLoading({ title: '加载中...', mask: true });

    try {
      // 如果WiFi配置被禁用，重置禁用状态，允许用户重新选择WiFi
      if (this.data.wifiConfigDisabled) {
        console.log('WiFi配置被禁用，重置状态允许重新选择WiFi');
        this.setData({
          wifiConfigDisabled: false,
          wifiPassword: ''
        });
      }

      // iOS 无法获取 WiFi 列表，引导用户手动更换
      if (this.isIOS) {
        if (this.data.is5GConnected) {
          console.log('iOS设备连接5G WiFi，跳转到系统设置页面');
          wx.openAppAuthorizeSetting({
            success: () => {
              console.log('已跳转到系统设置页面');
            },
            fail: (err) => {
              console.error('跳转系统设置失败:', err);
              wx.showModal({
                title: '更换WiFi',
                content: '当前连接的是5G WiFi，仅支持2.4G WiFi。\n\n请前往系统设置更换为2.4G WiFi后返回小程序。',
                confirmText: '知道了',
                showCancel: false
              });
            }
          });
          return;
        }

        console.log('iOS设备无法显示WiFi列表，清空当前WiFi信息，允许用户重新输入');
        this.setData({
          wifiName: '',
          wifiSelected: false,
          wifiPassword: '',
          showWifiList: false
        });
        await this.initWifiStep();
        wx.showToast({ title: '请重新选择WiFi', icon: 'none' });
        return;
      }

      await this.wifiConfigManager.showWifiList();
      if (this.data.showWifiList) {
        wx.showToast({ title: '请选择WiFi', icon: 'none', duration: 1500 });
      }
    } catch (error) {
      console.error('更换WiFi失败:', error);
      wx.showToast({ title: '获取WiFi列表失败', icon: 'none' });
    } finally {
      wx.hideLoading();
      this.setData({ isChangingWifi: false });
    }
  },

  // 完成步骤
  completeStep() {
    this.setData({
      stepsCompleted: [true, true, true]
    });
    wx.showToast({
      title: '配置完成',
      icon: 'success'
    });
    setTimeout(() => this.finishAndReturn(), 2000);
  },

  // 完成并返回首页（switchTab 关闭配网页；navigateBack 在单页栈或鸿蒙上可能无效）
  finishAndReturn() {
    wx.switchTab({
      url: '/pages/home/home',
      fail: (err) => {
        console.warn('[finishAndReturn] switchTab 失败，尝试安全返回:', err);
        commonUtil.navigateBackSafe('/pages/home/home');
      }
    });
  },

  // 返回（导航由 nav-bar 组件统一处理）
  onBack() {},

  // 断开当前设备
  async disconnectCurrentDevice() {
    await this.blueDeviceManager.disconnectBluetooth(this.data.connectedDeviceId);
    wx.removeStorageSync('connectedDevice');
    this.setData({
      connectedDeviceId: '',
      devices: [],
      stepsCompleted: [false, false, false],
      currentTab: 0
    });
  },
  // 停止配网
  stopWifiConfig() {
    this._wifiProvisioningActive = false;
    // 停止蓝牙搜索（统一使用BluFi）
    if (blufi) {
      blufi.notifyStartDiscoverBle({
        isStart: false
      });
    }

    wx.hideLoading();
    this.setData({
      isConfiguring: false
    });
  },

  /**
   * 初始化BluFi配网
   */
  _initBlufi() {
    try {
      // 初始化BluFi
      blufi.initXBlufi(blufi.XMQTT_SYSTEM.WeChat);
      console.log('BluFi初始化成功');

      // 设置BluFi事件监听
      this._setupBlufiListeners();
    } catch (error) {
      console.error('BluFi初始化失败:', error);
    }
  },

  /**
   * 设置BluFi事件监听
   */
  _setupBlufiListeners() {
    // 监听设备消息
    blufi.listenDeviceMsgEvent(true, (result) => {
      this._handleBlufiResult(result);
    });
  },

  /** 读取 BLE 广播名称（鸿蒙可能只有 localName） */
  _getBleDeviceName(device) {
    if (!device) return '';
    return String(device.localName || device.name || '').trim();
  },

  /** 是否为 GoodSleep 设备（不区分大小写，兼容 localName） */
  _isGoodSleepBleDevice(device) {
    const name = this._getBleDeviceName(device);
    return name.length > 0 && /^goodsleep/i.test(name);
  },

  /**
   * 从 advertisData 广播数据解析 WiFi MAC（全平台，不写 storage）
   * BluFi 层已将 ArrayBuffer 转为十六进制字符串
   */
  _parseMacFromAdvertisData(advertisData) {
    if (!advertisData) {
      return null;
    }

    let hexArray = null;

    if (typeof advertisData === 'string') {
      const arrayBuffer = BluetoothManager.hexStringToArrayBuffer(advertisData);
      if (!arrayBuffer) {
        return null;
      }
      const data = new Uint8Array(arrayBuffer);
      hexArray = Array.from(data).map((b) => '0x' + b.toString(16).toUpperCase());
    } else if (advertisData instanceof ArrayBuffer) {
      const data = new Uint8Array(advertisData);
      hexArray = Array.from(data).map((b) => '0x' + b.toString(16).toUpperCase());
    }

    if (!hexArray || hexArray.length < 11) {
      return null;
    }

    return BluetoothManager.extractMacFromHexArray(hexArray);
  },

  /**
   * 打印 BluFi 回调中的设备列表（便于调试鸿蒙等平台 name/localName 差异）
   */
  _logBlufiDeviceData(data) {
    if (data == null) {
      console.log('[BluFi] data: null');
      return;
    }
    if (!Array.isArray(data)) {
      console.log('[BluFi] data:', JSON.stringify(data));
      return;
    }
    const summary = data.map((device, index) => ({
      index,
      name: device.name || '',
      localName: device.localName || '',
      displayName: this._getBleDeviceName(device),
      isGoodSleep: this._isGoodSleepBleDevice(device),
      deviceId: device.deviceId || '',
      RSSI: device.RSSI,
      // 全平台从 advertisData 解析 WiFi MAC
      advertisData: device.advertisData || '',
      advertisDataLen: device.advertisData ? String(device.advertisData).length : 0,
      macFromAdvertisData: this._parseMacFromAdvertisData(device.advertisData)
    }));
    console.log('[BluFi] data 数量:', data.length);
    console.log('[BluFi] data 摘要:', summary);
    console.log('[BluFi] GoodSleep 匹配数:', summary.filter((item) => item.isGoodSleep).length);
    console.log('[BluFi] data JSON:', JSON.stringify(summary, null, 2));
  },

  /**
   * 处理BluFi结果
   */
  _handleBlufiResult(result) {
    console.log('BluFi结果:', result);
    console.log('BluFi结果类型:', result.type, '結果:', result.result);
    this._logBlufiDeviceData(result.data);

    switch (result.type) {
      case blufi.XBLUFI_TYPE.TYPE_GET_DEVICE_LISTS:
        // 设备列表更新
        if (result.result) {
          const allDevices = result.data || [];
          const goodSleepDevices = allDevices.filter((device) => this._isGoodSleepBleDevice(device));

          console.log('搜索到的GoodSleep设备:', goodSleepDevices.length, goodSleepDevices.map((d) => this._getBleDeviceName(d)));

          // 处理每个GoodSleep设备，提取MAC地址并保存
          let hasSavedMac = false; // 标记是否已保存MAC地址

          const processedDevices = goodSleepDevices.map((device, index) => {
            console.log(`=== BluFi搜索到的GoodSleep设备 ${index + 1} ===`);
            console.log('设备名称:', this._getBleDeviceName(device), '(name:', device.name, 'localName:', device.localName, ')');
            console.log('设备ID:', device.deviceId);
            console.log('RSSI:', device.RSSI);
            console.log('广播数据（原始）:', device.advertisData);
            console.log('广告数据类型:', typeof device.advertisData);

            let extractedMac = null;

            // 全平台：从 advertisData 解析 WiFi MAC
            if (device.advertisData) {
              const macResult = this._extractMacFromAdvertisData(device.advertisData, hasSavedMac);
              extractedMac = macResult.extractedMac;
              hasSavedMac = macResult.hasSavedMac;
            } else {
              console.warn('advertisData 为空，无法解析 WiFi MAC, deviceId:', device.deviceId);
            }
            console.log('========================');

            const deviceWifiMac = this._resolveDeviceWifiMac(device, extractedMac);

            const displayName = this._formatDeviceName(deviceWifiMac);

            const formattedMac = this._formatMacAddress(deviceWifiMac);

            return {
              ...device,
              extractedMac: extractedMac || deviceWifiMac,
              deviceWifiMac,
              displayName,
              formattedMac
            };
          });
          const finalDevices = this._dedupeBleDevices(processedDevices);

          this.setData({
            devices: finalDevices
          });
        }
        break;

      case blufi.XBLUFI_TYPE.TYPE_STATUS_CONNECTED: {
        const stateData = result.data || {};
        console.log('[BLE] 连接状态变化:', result.result, stateData.deviceId);
        if (
          !result.result
          && this._wifiProvisioningActive
          && this._provisionWritesDone
          && !this.data.wifiConfigSuccess
        ) {
          console.log('[配网] 配网过程中 BLE 断开，尝试心跳确认');
          this._startProvisionConfirmByHeartbeat();
        }
        if (
          this.platform === 'ohos'
          && result.result
          && this._pendingConnectDeviceId
          && stateData.deviceId === this._pendingConnectDeviceId
        ) {
          console.log('[BLE] 鸿蒙: 通过连接状态回调确认已连接');
          this._onBleConnectSuccess(stateData.deviceId);
        }
        break;
      }

      case blufi.XBLUFI_TYPE.TYPE_CONNECTED:
        console.log('连接回调:', JSON.stringify(result));
        if (result.result) {
          const connectedId = (result.data && result.data.deviceId) || this._pendingConnectDeviceId;
          this._onBleConnectSuccess(connectedId);
        } else {
          const failData = Object.assign({}, result.data, {
            deviceId: (result.data && result.data.deviceId) || this._pendingConnectDeviceId
          });
          this._onBleConnectFail(failData);
        }
        break;

      case blufi.XBLUFI_TYPE.TYPE_CONNECT_ROUTER_RESULT:
        // 配网结果
        wx.hideLoading();
        console.log('配网结果:', result);
        console.log('配网结果详情:', JSON.stringify(result));
        console.log('当前配网状态:', this.data.isConfiguring, 'active:', this._wifiProvisioningActive);
        console.log('当前WiFi配置:', this.data.savedWifiConfig);

        if (!this._wifiProvisioningActive) {
          console.log('[配网] 忽略非配网阶段的 router 回调（多为 notify 误解析）');
          break;
        }

        // 清除配网超时计时器
        if (this._wifiConfigTimeout) {
          clearTimeout(this._wifiConfigTimeout);
          this._wifiConfigTimeout = null;
        }

        if (!result.result) {
          // 配网失败
          this._wifiProvisioningActive = false;
          this._provisionWritesDone = false;
          this._clearProvisionConfirm();
          console.log('配网失败，断开蓝牙设备并返回WiFi配置步骤');

          // 断开已连接的蓝牙设备
          if (this.data.connectedDeviceId) {
            try {
              blufi.notifyConnectBle({
                isStart: false,
                deviceId: this.data.connectedDeviceId,
                name: 'GoodSleep设备'
              });
              console.log('配网失败，已断开蓝牙设备:', this.data.connectedDeviceId);
            } catch (error) {
              console.error('断开蓝牙设备失败:', error);
            }
          }

          // 清除本地存储的设备信息
          wx.removeStorageSync('connectedDevice');

          this.setData({
            isConfiguring: false,
            wifiConfigSuccess: false,
            currentTab: 0, // 回到WiFi配置步骤
            connectedDeviceId: '',
            devices: [],
            stepsCompleted: [false, false, false]
          });

          wx.showModal({
            title: '配网失败',
            content: '配网失败，请重试',
            showCancel: false
          });
        } else {
          // 配网成功
          if (result.data.progress == 100) {
            this._finishProvisionSuccess(result.data.ssid || '');
          } else if (this._wifiProvisioningActive) {
            // 配网进行中
            this.setData({
              isConfiguring: true,
              wifiConfigSuccess: false
            });
          }
        }
        break;

      case blufi.XBLUFI_TYPE.TYPE_INIT_ESP32_RESULT:
        console.log('初始化结果：', JSON.stringify(result));
        if (result.result) {
          const initData = result.data || {};
          if (initData.serviceId && initData.characteristicId) {
            this._blufiServiceId = initData.serviceId;
            this._blufiWriteCharId = initData.characteristicId;
            console.log('[BluFi] 缓存写入通道:', initData.serviceId, initData.characteristicId);
          }
          if (this._pendingWifiConfigAfterInit) {
            this._pendingWifiConfigAfterInit = false;
            setTimeout(() => {
              console.log('BluFi 初始化完成，开始 GoodSleep 配网');
              this.startWifiConfig();
            }, 150);
          }
        } else {
          this._pendingWifiConfigAfterInit = false;
          wx.hideLoading();
          console.log('初始化失败', result.data);
          this.setData({ connected: false });
          wx.showModal({
            title: '温馨提示',
            content: '设备初始化失败，请重新连接设备',
            showCancel: false
          });
        }
        break;
    }
  },

  // UTF8编码函数
  encodeUtf8: function (text) {
    const code = encodeURIComponent(text);
    const bytes = [];
    for (var i = 0; i < code.length; i++) {
      const c = code.charAt(i);
      if (c === '%') {
        const hex = code.charAt(i + 1) + code.charAt(i + 2);
        const hexVal = parseInt(hex, 16);
        bytes.push(hexVal);
        i += 2;
      } else {
        bytes.push(c.charCodeAt(0));
      }
    }
    return bytes;
  },

  // 使用 BluFi 固定 UUID 写入特征值（返回 Promise，便于串行发送配网包）
  writeCharacteristicValue(data) {
    console.log('[writeCharacteristicValue]:', data);
    const {
      connectedDeviceId
    } = this.data;

    return new Promise((resolve, reject) => {
      if (!connectedDeviceId) {
        console.error('没有已连接的设备ID');
        wx.showToast({
          title: '设备未连接',
          icon: 'none'
        });
        reject(new Error('设备未连接'));
        return;
      }

      const doWrite = (serviceId, characteristicId) => {
        wx.writeBLECharacteristicValue({
          deviceId: connectedDeviceId,
          serviceId,
          characteristicId,
          value: data,
          success: (writeRes) => {
            console.log('BluFi特征值写入成功:', {
              serviceId,
              characteristicId,
              writeRes
            });
            resolve({
              serviceId,
              characteristicId,
              writeRes
            });
          },
          fail: (writeErr) => {
            console.error('BluFi特征值写入失败:', writeErr);
            this._blufiServiceId = null;
            this._blufiWriteCharId = null;
            wx.showToast({
              title: '写入失败: ' + (writeErr.errMsg || '未知错误'),
              icon: 'none',
              duration: 2000
            });
            reject(writeErr);
          }
        });
      };

      if (this._blufiServiceId && this._blufiWriteCharId) {
        doWrite(this._blufiServiceId, this._blufiWriteCharId);
        return;
      }

      try {
        wx.getBLEDeviceServices({
          deviceId: connectedDeviceId,
          success: (res) => {
            console.log('获取蓝牙服务成功，所有服务:', res.services);

            if (!res.services || res.services.length === 0) {
              wx.showToast({
                title: '未找到蓝牙服务',
                icon: 'none'
              });
              reject(new Error('未找到蓝牙服务'));
              return;
            }

            const service = res.services.find(item =>
              commonUtil.bleUuidMatches(item.uuid, BLUFI_SERVICE_UUID) ||
              commonUtil.bleUuidMatches(item.uuid, 'FFFF')
            );

            if (!service) {
              console.error('未找到 BluFi 服务，可用服务:', res.services);
              wx.showToast({
                title: '未找到BluFi蓝牙服务',
                icon: 'none'
              });
              reject(new Error('未找到BluFi蓝牙服务'));
              return;
            }

            console.log('使用 BluFi 服务:', service.uuid);

            wx.getBLEDeviceCharacteristics({
              deviceId: connectedDeviceId,
              serviceId: service.uuid,
              success: (charRes) => {
                console.log('获取特征值成功，所有特征值:', charRes.characteristics);

                if (!charRes.characteristics || charRes.characteristics.length === 0) {
                  wx.showToast({
                    title: '未找到特征值',
                    icon: 'none'
                  });
                  reject(new Error('未找到特征值'));
                  return;
                }

                let writeChar = charRes.characteristics.find(char =>
                  (commonUtil.bleUuidMatches(char.uuid, BLUFI_WRITE_CHAR_UUID) ||
                    commonUtil.bleUuidMatches(char.uuid, 'FF01')) &&
                  (char.properties.write || char.properties.writeNoResponse)
                );

                if (!writeChar) {
                  writeChar = charRes.characteristics.find(char =>
                    commonUtil.bleUuidMatches(char.uuid, BLUFI_WRITE_CHAR_UUID) ||
                    commonUtil.bleUuidMatches(char.uuid, 'FF01')
                  );
                }

                if (!writeChar) {
                  console.error('未找到 BluFi 写入特征值，可用特征值:', charRes.characteristics);
                  wx.showToast({
                    title: '未找到BluFi写入特征值',
                    icon: 'none'
                  });
                  reject(new Error('未找到BluFi写入特征值'));
                  return;
                }

                this._blufiServiceId = service.uuid;
                this._blufiWriteCharId = writeChar.uuid;
                console.log('BluFi 写入特征值:', writeChar.uuid);
                doWrite(service.uuid, writeChar.uuid);
              },
              fail: (charErr) => {
                console.error('获取特征值失败:', charErr);
                wx.showToast({
                  title: '获取特征值失败: ' + (charErr.errMsg || '未知错误'),
                  icon: 'none',
                  duration: 2000
                });
                reject(charErr);
              }
            });
          },
          fail: (res) => {
            console.error('获取蓝牙服务失败:', res);
            wx.showToast({
              title: '获取服务失败: ' + (res.errMsg || '未知错误'),
              icon: 'none',
              duration: 2000
            });
            reject(res);
          }
        });
      } catch (error) {
        console.error('writeCharacteristicValue异常:', error);
        wx.showToast({
          title: '写入异常: ' + error.message,
          icon: 'none'
        });
        reject(error);
      }
    });
  },

  // 检查并标记弹窗是否已显示
  _checkAndMarkModal(modalName) {
    if (!this.data._modalShown[modalName]) {
      this.setData({
        [`_modalShown.${modalName}`]: true
      });
      return false; // 未显示过，返回false表示可以显示
    }
    return true; // 已显示过，返回true表示不显示
  },

  // 从 advertisData 提取并保存 WiFi MAC（全平台）
  _extractMacFromAdvertisData(advertisData, hasSavedMac) {
    const extractedMac = this._parseMacFromAdvertisData(advertisData);

    if (typeof advertisData === 'string') {
      console.log('[advertisData MAC] 十六进制字符串:', advertisData);
      console.log('[advertisData MAC] 长度:', advertisData.length, '字符');
    } else if (advertisData instanceof ArrayBuffer) {
      const data = new Uint8Array(advertisData);
      const hexString = Array.from(data).map((b) => '0x' + b.toString(16).toUpperCase());
      console.log('[advertisData MAC] 字节数组:', Array.from(data));
      console.log('[advertisData MAC] 十六进制:', hexString);
      console.log('[advertisData MAC] 长度:', data.length, '字节');
    }

    if (extractedMac) {
      console.log('[advertisData MAC] 解析 WiFi MAC:', extractedMac);
    } else if (advertisData) {
      console.warn('[advertisData MAC] 有广播数据但未能解析 MAC');
    }

    // 保存MAC地址（如果成功提取且还未保存）
    if (extractedMac && !hasSavedMac) {
      wx.setStorageSync('wifi_device_mac', extractedMac);
      this.setData({
        wifiMac: extractedMac
      });
      console.log('[advertisData MAC] 已保存 WiFi MAC:', extractedMac);
      return {
        extractedMac,
        hasSavedMac: true
      };
    } else if (extractedMac && hasSavedMac) {
      console.log('WiFi MAC地址已保存，跳过重复保存');
    }

    return {
      extractedMac,
      hasSavedMac
    };
  },

  // 解析当前设备的 WiFi MAC（统一从 advertisData）
  _resolveDeviceWifiMac(device, extractedMac) {
    if (extractedMac) {
      return extractedMac;
    }
    if (device && device.deviceWifiMac) {
      return device.deviceWifiMac;
    }
    if (device && device.extractedMac) {
      return device.extractedMac;
    }
    if (this.data.wifiMac) {
      return this.data.wifiMac;
    }
    if (device && device.advertisData) {
      return this._parseMacFromAdvertisData(device.advertisData) || '';
    }
    return '';
  },

  _getBleDeviceUniqueKey(device) {
    const cleanMac = (device.deviceWifiMac || device.extractedMac || '')
      .replace(/[:\-\s]/g, '')
      .toUpperCase();
    if (cleanMac) {
      return `mac:${cleanMac}`;
    }

    if (device.advertisData) {
      return `adv:${String(device.advertisData).toUpperCase()}`;
    }

    return `id:${device.deviceId || device.uuid || ''}`;
  },

  _dedupeBleDevices(devices) {
    const deviceMap = new Map();

    devices.forEach((device) => {
      const key = this._getBleDeviceUniqueKey(device);
      const existing = deviceMap.get(key);

      if (!existing) {
        deviceMap.set(key, device);
        return;
      }

      const existingRssi = Number(existing.RSSI || -999);
      const currentRssi = Number(device.RSSI || -999);
      deviceMap.set(key, currentRssi >= existingRssi ? device : existing);
    });

    const finalDevices = Array.from(deviceMap.values());
    if (finalDevices.length !== devices.length) {
      console.log('[BLE] 去重蓝牙设备:', {
        before: devices.length,
        after: finalDevices.length,
        devices: finalDevices.map((device) => ({
          deviceId: device.deviceId,
          displayName: device.displayName,
          deviceWifiMac: device.deviceWifiMac
        }))
      });
    }

    return finalDevices;
  },

  // 从 WiFi MAC 取后 4 位十六进制作为 zzZMinga_gx_ 后缀
  _getMacSuffixFromMac(mac) {
    if (!mac) {
      return 'XXXX';
    }
    const cleanMac = mac.replace(/[:\-\s]/g, '').toUpperCase();
    return cleanMac.length >= 4 ? cleanMac.slice(-4) : 'XXXX';
  },

  // 格式化设备显示名称，后缀对应设备 WiFi MAC
  _formatDeviceName(deviceWifiMac) {
    const macSuffix = this._getMacSuffixFromMac(deviceWifiMac);
    return `zzZMinga_gx_${macSuffix}`;
  },

  // 格式化MAC地址为 XX:XX:XX:XX:XX:XX 格式
  _formatMacAddress(mac) {
    if (!mac) return '';

    // 移除所有分隔符
    const cleanMac = mac.replace(/[:\-\s]/g, '').toUpperCase();

    // 如果不是有效的MAC地址格式（12个十六进制字符），返回原始值
    if (!/^[0-9A-F]{12}$/.test(cleanMac)) {
      // 如果长度不够，尝试从末尾提取12个字符
      if (cleanMac.length >= 12) {
        const last12 = cleanMac.slice(-12);
        return last12.match(/.{2}/g).join(':');
      }
      return mac; // 返回原始值
    }

    // 每两个字符一组，用冒号分隔
    return cleanMac.match(/.{2}/g).join(':');
  },

  // 处理帮助链接点击
  onHelpLinkTap() {
    this.setData({
      helpModalVisible: true
    });
  },

  // 关闭帮助弹窗
  onHelpModalClose() {
    this.setData({
      helpModalVisible: false
    });
  },

  // 初始化WiFi
  async initWifi() {
    wx.startWifi();

    try {
      const wifiInfo = await this.wifiManager.getConnectedWifi();
      const ssid = wifiInfo.wifi.SSID;

      // 使用WifiManager的检测方法
      let is5G = false;
      if (commonUtil.isIOS()) {
        is5G = this.wifiManager.is5GWifiBySSID(ssid);
      } else {
        is5G = wifiInfo.wifi.frequency && wifiInfo.wifi.frequency >= 4900;
      }

      if (is5G) {
        // 防止重复弹窗
        if (!this._checkAndMarkModal('5G_WIFI_TIP')) {
          if (commonUtil.isIOS()) {
            this.wifiManager.handleIOS5GWifi();
          } else {
            this.wifiManager.handleAndroid5GWifi();
          }
        }
      }

      let password = wx.getStorageSync(ssid)
      console.log("restore password:", password)
      this.setData({
        wifiName: ssid,
        wifiPassword: password == undefined ? "" : password,
        wifiSelected: true, // 设置WiFi已选择状态
        is5GConnected: is5G // 设置5G状态
      })
    } catch (res) {
      console.log('初始化WiFi失败:', res);
      
      // 处理权限错误
      if (isSystemLocationPermissionError(res)) {
        showWechatAppLocationPermissionModal(res);
      }
      
      this.setData({
        wifiName: null,
      })
    }
  },
  // 配网方法
  async connectWifi() {
    // 边界情况处理：检查设备是否还连接
    if (!this.data.connectedDeviceId) {
      wx.showModal({
        title: '设备未连接',
        content: '设备未连接，无法配网，请先连接蓝牙设备',
        showCancel: false,
        confirmText: '确定'
      });
      this.setData({
        isConfiguring: false,
        currentTab: 1 // 回到蓝牙连接步骤
      });
      return;
    }

    // 边界情况处理：检查WiFi配置是否有效
    if (!this.data.wifiName || !this.data.wifiPassword) {
      wx.showModal({
        title: 'WiFi配置不完整',
        content: 'WiFi配置信息不完整，请先完成WiFi配置',
        showCancel: false,
        confirmText: '确定'
      });
      this.setData({
        isConfiguring: false,
        currentTab: 0 // 回到WiFi配置步骤
      });
      return;
    }

    try {
      this._wifiProvisioningActive = true;
      this._provisionWritesDone = false;
      this._clearProvisionConfirm();

      wx.showLoading({
        title: '正在配网',
        mask: true
      });
      this.setData({
        isConfiguring: true,
        wifiConfigSuccess: false,
        currentTab: 2
      });

      // 使用全局序列号（参考项目）
      let ssid_payload = [0x09, 0x00, this.data.sequenceCount++];
      let pwd_payload = [0x0D, 0x00, this.data.sequenceCount++];
      let connect_payload = [0x0C, 0x00, 0x02, this.data.sequenceCount++];

      let temp_ssid_payload = []
      for (let i = 0; i < this.data.wifiName.length; i++) {
        let ssid_utf8 = this.encodeUtf8(this.data.wifiName[i])
        temp_ssid_payload.push(...ssid_utf8);
      }

      ssid_payload.push(temp_ssid_payload.length);
      ssid_payload.push(...temp_ssid_payload);
      let temp_pwd_payload = []
      for (let i = 0; i < this.data.wifiPassword.length; i++) {
        let pwd_utf8 = this.encodeUtf8(this.data.wifiPassword[i])
        temp_pwd_payload.push(...pwd_utf8);
      }
      pwd_payload.push(temp_pwd_payload.length);
      pwd_payload.push(...temp_pwd_payload);

      let ssidArray = new Uint8Array(ssid_payload);
      let passwordArray = new Uint8Array(pwd_payload);
      let connectCMD = new Uint8Array(connect_payload);
      console.log('发送配网信息')

      const writeGapMs = this.platform === 'ohos' ? 200 : 100;
      try {
        await this.writeCharacteristicValue(ssidArray.buffer);
        await this._delayMs(writeGapMs);
        await this.writeCharacteristicValue(passwordArray.buffer);
        await this._delayMs(writeGapMs);
        await this.writeCharacteristicValue(connectCMD.buffer);
        this._provisionWritesDone = true;
        console.log('[配网] 三帧配网数据已全部写入');
      } catch (writeError) {
        this._wifiProvisioningActive = false;
        this._provisionWritesDone = false;
        console.error('发送配网信息失败:', writeError);
        wx.hideLoading();

        console.log('发送配网信息失败，断开蓝牙设备并返回WiFi配置步骤');

        // 断开已连接的蓝牙设备
        if (this.data.connectedDeviceId) {
          try {
            blufi.notifyConnectBle({
              isStart: false,
              deviceId: this.data.connectedDeviceId,
              name: 'GoodSleep设备'
            });
            console.log('发送配网信息失败，已断开蓝牙设备:', this.data.connectedDeviceId);
          } catch (error) {
            console.error('断开蓝牙设备失败:', error);
          }
        }

        // 清除本地存储的设备信息
        wx.removeStorageSync('connectedDevice');

        this.setData({
          isConfiguring: false,
          wifiConfigSuccess: false,
          currentTab: 0,
          connectedDeviceId: '',
          devices: [],
          stepsCompleted: [false, false, false]
        });

        wx.showModal({
          title: '配网失败',
          content: '发送配网信息失败，请检查设备连接状态后重试',
          showCancel: false,
          confirmText: '确定'
        });
        return;
      }

      // 设置配网超时
      this._wifiConfigTimeout = setTimeout(() => {
        if (!this.data.isConfiguring || this.data.wifiConfigSuccess) {
          console.log('[blue] 配网超时定时器触发，但配网已完成，跳过超时处理');
          return;
        }

        this._wifiProvisioningActive = false;
        this._provisionWritesDone = false;
        this._clearProvisionConfirm();
        console.log('[blue] 配网超时（40秒）');
        wx.hideLoading();

        console.log('配网超时，断开蓝牙设备并返回WiFi配置步骤');

        // 断开已连接的蓝牙设备
        if (this.data.connectedDeviceId) {
          try {
            blufi.notifyConnectBle({
              isStart: false,
              deviceId: this.data.connectedDeviceId,
              name: 'GoodSleep设备'
            });
            console.log('配网超时，已断开蓝牙设备:', this.data.connectedDeviceId);
          } catch (error) {
            console.error('断开蓝牙设备失败:', error);
          }
        }

        // 清除本地存储的设备信息
        wx.removeStorageSync('connectedDevice');

        this.setData({
          isConfiguring: false,
          wifiConfigSuccess: false,
          currentTab: 0,
          connectedDeviceId: '',
          devices: [],
          stepsCompleted: [false, false, false]
        });

        wx.showModal({
          title: '配网超时',
          content: '请您检查wifi密码是否正确（可点击输入框旁边的小图标查看密码），然后重新拔插设备电源',
          showCancel: false,
          confirmText: '确定'
        });
      }, 1000 * 40); // 40秒超时

    } catch (error) {
      console.error('connectWifi异常:', error);
      wx.hideLoading();

      console.log('connectWifi异常，断开蓝牙设备并返回WiFi配置步骤');

      // 断开已连接的蓝牙设备
      if (this.data.connectedDeviceId) {
        try {
          blufi.notifyConnectBle({
            isStart: false,
            deviceId: this.data.connectedDeviceId,
            name: 'GoodSleep设备'
          });
          console.log('connectWifi异常，已断开蓝牙设备:', this.data.connectedDeviceId);
        } catch (disconnectError) {
          console.error('断开蓝牙设备失败:', disconnectError);
        }
      }

      // 清除本地存储的设备信息
      wx.removeStorageSync('connectedDevice');

      this.setData({
        isConfiguring: false,
        currentTab: 0, // 回到WiFi配置步骤
        connectedDeviceId: '',
        devices: [],
        stepsCompleted: [false, false, false]
      });

      wx.showModal({
        title: '配网异常',
        content: '配网过程中发生异常: ' + error.message,
        showCancel: false,
        confirmText: '确定'
      });
    }
  }
});
