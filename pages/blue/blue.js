const {
  checkWifiAuth,
  checkBluetoothAndLocationByDeviceType
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
    is5GConnected: false, // 是否5G
    _has5GTip: false, // 防止重复弹出5G提示
    _has5GTipModal: false, // 进入WiFi步骤时重置弹窗标记
    wifiMac: '', // WiFi Mac地址
    isConfiguring: false, // 是否正在配网中

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
    this.isIOS = this._detectIOSPlatform();
    console.log('當前平台:', this.isIOS ? 'iOS' : 'Android/其他');

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
      this.setData({
        _modalShown: {} // 重置所有弹窗标记
      });
      this.initWifiStep();
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

    // 用户点击"已进入配网模式"后，再次检查权限
    this.checkAllPermissions()
      .then(() => {
        console.log('用户确认后继续搜索蓝牙设备');
        // 如果还没有开始搜索，则开始搜索
        if (this.data.devices.length === 0 && !this.data.isSearching) {
          this.startBluetoothSearch();
        }
      })
      .catch(() => {
        wx.showToast({
          title: '权限不足',
          icon: 'none'
        });
      });
  },

  onHide() {
    this.isPageActive = false;
    this.wifiConfigManager.clearWifiStatusCheck();
    this.blueDeviceManager.stopBluetoothConnectionListener();
  },

  onUnload() {
    this.isPageActive = false;
    this.wifiConfigManager.clearWifiStatusCheck();
    this.blueDeviceManager.stopBluetoothConnectionListener();

    // 停止蓝牙搜索
    try {
      blufi.notifyStartDiscoverBle({
        isStart: false
      });
      console.log('页面卸载时已停止蓝牙搜索');
    } catch (error) {
      console.error('停止蓝牙搜索失败:', error);
    }

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

  },

  // 检查所有权限
  checkAllPermissions() {
    return checkBluetoothAndLocationByDeviceType();
  },

  // 检测iOS平台
  _detectIOSPlatform() {
    try {
      const systemInfo = wx.getDeviceInfo();
      const platform = (systemInfo.platform || '').toLowerCase();
      console.log('系统信息:', systemInfo);
      console.log('平台:', platform);
      return platform === 'ios';
    } catch (error) {
      console.error('获取系统信息失败:', error);
      return false;
    }
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

        // 如果当前连接的WiFi与本地保存的WiFi一致，则禁用WiFi配置
        if (currentWifiName && savedWifiName && currentWifiName === savedWifiName) {
          console.log('设备已连接到相同WiFi，禁用WiFi配置');
          this.setData({
            wifiConfigDisabled: true,
            wifiName: currentWifiName,
            wifiSelected: true,
            showWifiList: false
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
        console.error('错误详情:', JSON.stringify(error));
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


  // 开始蓝牙搜索
  startBluetoothSearch() {
    console.log('开始搜索GoodSleep设备（统一使用BluFi）');

    this.setData({
      devices: [],
      isSearching: true
    });

    // 统一使用BluFi搜索
    blufi.notifyStartDiscoverBle({
      isStart: true
    });

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

      console.log('嘗試連接設備:', deviceId);

      // 停止搜索
      blufi.notifyStartDiscoverBle({
        isStart: false
      });

      // 显示连接加载提示
      wx.showLoading({
        title: '连接蓝牙设备中...',
      });

      // 设置连接超时定时器（30秒）
      this._connectionTimeout = setTimeout(() => {
        wx.hideLoading();
        console.log('设备连接超时');

        wx.showModal({
          title: '连接超时',
          content: '设备连接超时，请检查：\n1. 设备是否已进入配网模式\n2. 设备是否在附近\n3. 设备是否被其他应用占用\n\n是否重试连接？',
          showCancel: true,
          cancelText: '取消',
          confirmText: '重试',
          success: (res) => {
            if (res.confirm) {
              // 用户选择重试，重新连接
              this.connectDevice(deviceId);
            }
          }
        });
      }, 30000); // 30秒超时

      // 统一使用BluFi连接
      blufi.notifyConnectBle({
        isStart: true,
        deviceId: deviceId,
        name: device.name || 'GoodSleep设备'
      });

    }
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
            currentTab: 2 // 跳转到配网步骤
          });
          console.log('设备确实已连接，设置已连接设备ID:', device.deviceId);
          // 设备已连接，等待50ms后开始配网
          setTimeout(() => {
            this.startWifiConfig();
          }, 50);
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
  showWifiList() {
    console.log('用户点击更换WiFi，开始获取WiFi列表');

    // 如果WiFi配置被禁用，重置禁用状态，允许用户重新选择WiFi
    if (this.data.wifiConfigDisabled) {
      console.log('WiFi配置被禁用，重置状态允许重新选择WiFi');
      this.setData({
        wifiConfigDisabled: false,
        wifiPassword: '' // 清空密码
      });
    }

    // 使用WiFi配置管理器显示WiFi列表
    this.wifiConfigManager.showWifiList();
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

  // 完成并返回
  finishAndReturn() {
    wx.navigateBack();
  },

  // 返回
  onBack() {
    wx.navigateBack();
  },

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

  /**
   * 处理BluFi结果
   */
  _handleBlufiResult(result) {
    console.log('BluFi结果:', result);
    console.log('BluFi结果类型:', result.type, '結果:', result.result);

    switch (result.type) {
      case blufi.XBLUFI_TYPE.TYPE_GET_DEVICE_LISTS:
        // 设备列表更新
        if (result.result) {
          const allDevices = result.data || [];
          const goodSleepDevices = allDevices.filter(device => {
            if (!device.name) return false;
            return device.name.startsWith('GoodSleep');
          });

          console.log('搜索到的GoodSleep设备:', goodSleepDevices);

          // 处理每个GoodSleep设备，提取MAC地址并保存
          let hasSavedMac = false; // 标记是否已保存MAC地址

          const processedDevices = goodSleepDevices.map((device, index) => {
            console.log(`=== BluFi搜索到的GoodSleep设备 ${index + 1} ===`);
            console.log('设备名称:', device.name);
            console.log('设备ID:', device.deviceId);
            console.log('RSSI:', device.RSSI);
            console.log('广播数据（原始）:', device.advertisData);
            console.log('广告数据类型:', typeof device.advertisData);

            let extractedMac = null;

            // 处理广播数据（iOS设备）
            if (this.isIOS && device.advertisData) {
              const macResult = this._extractIOSMacAddress(device.advertisData, hasSavedMac);
              extractedMac = macResult.extractedMac;
              hasSavedMac = macResult.hasSavedMac;
            } else {
              console.log('广播数据: 无 或 非iOS设备');
            }
            console.log('========================');

            // 格式化设备显示名称
            const displayName = this._formatDeviceName(device);

            // 格式化MAC地址用于显示
            const formattedMac = this._formatMacAddress(extractedMac || device.deviceId || device.uuid);

            // 保存提取的MAC地址到设备对象
            return {
              ...device,
              extractedMac: extractedMac,
              displayName: displayName,
              formattedMac: formattedMac
            };
          });

          this.setData({
            devices: processedDevices
          });
        }
        break;

      case blufi.XBLUFI_TYPE.TYPE_CONNECTED:
        // 设备连接结果
        console.log('连接回调:', JSON.stringify(result));

        // 清除连接超时定时器
        if (this._connectionTimeout) {
          clearTimeout(this._connectionTimeout);
          this._connectionTimeout = null;
        }

        if (result.result) {
          // 停止蓝牙搜索
          blufi.notifyStartDiscoverBle({
            isStart: false,
            success: () => console.log('连接成功后已停止BluFi搜索'),
            fail: (err) => console.log('停止BluFi搜索失败:', err)
          });

          wx.hideLoading();
          // 更新设备连接状态
          const updatedDevices = this.data.devices.map(device => ({
            ...device,
            isConnected: device.deviceId === result.data.deviceId
          }));

          this.setData({
            connectedDeviceId: result.data.deviceId,
            stepsCompleted: [true, true, false], // 第一步和第二步完成
            devices: updatedDevices,
            currentTab: 2, // 跳转到配网步骤
            sequenceCount: 0 // 重置序列号（参考项目）
          });

          console.log('蓝牙连接成功，开始初始化设备');

          // 立即初始化设备
          blufi.notifyInitBleEsp32({
            deviceId: result.data.deviceId
          });

          // 等待50ms后开始配网（使用第一步保存的WiFi信息）
          setTimeout(() => {
            console.log('等待50ms后开始配网，使用保存的WiFi配置:', this.data.savedWifiConfig);
            this.startWifiConfig();
          }, 50);
        } else {
          wx.hideLoading();
          console.log('设备连接失败:', result.data);

          // 提供更详细的错误信息
          if (result.data && result.data.errorCode) {
            const errorCode = result.data.errorCode;
            switch (errorCode) {
              case 10003:
                errorMessage = '连接被拒绝，请确保设备已进入配网模式且未被其他设备连接';
                break;
              case 10004:
                errorMessage = '连接超时，请检查设备是否在附近且信号良好';
                break;
              case 10005:
                errorMessage = '设备不支持，请检查设备是否支持BluFi配网';
                break;
              default:
                errorMessage = `连接失败 (错误码: ${errorCode})`;
            }
          }

        }
        break;

      case blufi.XBLUFI_TYPE.TYPE_CONNECT_ROUTER_RESULT:
        // 配网结果
        wx.hideLoading();
        console.log('配网结果:', result);
        console.log('配网结果详情:', JSON.stringify(result));
        console.log('当前配网状态:', this.data.isConfiguring);
        console.log('当前WiFi配置:', this.data.savedWifiConfig);

        // 清除配网超时计时器
        if (this._wifiConfigTimeout) {
          clearTimeout(this._wifiConfigTimeout);
          this._wifiConfigTimeout = null;
        }

        if (!result.result) {
          // 配网失败
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
            const ssid = result.data.ssid;
            // 根据蓝牙设备MAC地址计算WiFi MAC地址
            const wifiMac = BluetoothManager.calculateWifiMac(this.data.connectedDeviceId);

            console.log('配网成功，计算WiFi MAC:', wifiMac);
            // 保存WiFi MAC地址到本地存储
            if (wifiMac) {
              wx.setStorage({
                key: 'wifi_device_mac',
                data: wifiMac
              });
              BluetoothManager.calculateWifiMacRegister(wifiMac)
              console.log('已保存WiFi MAC地址:', wifiMac);
            }

            // 保存WiFi名称到本地存储（使用用户输入的WiFi名称，而不是配网结果返回的ssid）
            const wifiNameToSave = this.data.savedWifiConfig?.ssid || this.data.wifiName;
            if (wifiNameToSave) {
              wx.setStorage({
                key: 'connected_wifi_name',
                data: wifiNameToSave
              });
              console.log('已保存WiFi名称:', wifiNameToSave);
              console.log('配网结果返回的ssid:', ssid);
            }

            // 保存WiFi密码到本地存储
            if (this.data.savedWifiConfig && this.data.savedWifiConfig.password) {
              wx.setStorage({
                key: ssid,
                data: this.data.savedWifiConfig.password
              });
            }

            this.setData({
              isConfiguring: false,
              currentTab: 2, // 跳转到第三步
              stepsCompleted: [true, true, true],
              wifiMac: wifiMac // 保存到页面数据中
            });
          } else {
            // 配网进行中
            this.setData({
              isConfiguring: true
            });
          }
        }
        break;

      case blufi.XBLUFI_TYPE.TYPE_INIT_ESP32_RESULT:
        // 设备初始化结果
        wx.hideLoading();
        console.log("初始化结果：", JSON.stringify(result))
        if (result.result) {
          console.log('初始化成功')
          // 参考项目：初始化成功后不显示提示，直接允许配网
        } else {
          console.log('初始化失败')
          this.setData({
            connected: false
          })
          wx.showModal({
            title: '温馨提示',
            content: `设备初始化失败`,
            showCancel: false, //是否显示取消按钮
            success: function (res) {
              // 可以添加返回逻辑
            }
          })
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

  // 动态方法：自动获取UUID并写入特征值
  writeCharacteristicValue: function (data) {
    console.log('[writeCharacteristicValue]:', data);
    const {
      connectedDeviceId
    } = this.data;

    if (!connectedDeviceId) {
      console.error('没有已连接的设备ID');
      wx.showToast({
        title: '设备未连接',
        icon: 'none'
      });
      return;
    }

    try {
      // 动态获取设备的所有服务
      wx.getBLEDeviceServices({
        deviceId: connectedDeviceId,
        success: (res) => {
          console.log('获取蓝牙服务成功，所有服务:', res.services);

          if (!res.services || res.services.length === 0) {
            console.error('未找到任何服务');
            wx.showToast({
              title: '未找到蓝牙服务',
              icon: 'none'
            });
            return;
          }

          // 使用第一个服务
          const service = res.services[0];
          console.log('使用服务:', service.uuid);

          // 获取该服务的所有特征值
          wx.getBLEDeviceCharacteristics({
            deviceId: connectedDeviceId,
            serviceId: service.uuid,
            success: (charRes) => {
              console.log('获取特征值成功，所有特征值:', charRes.characteristics);

              if (!charRes.characteristics || charRes.characteristics.length === 0) {
                console.error('未找到任何特征值');
                wx.showToast({
                  title: '未找到特征值',
                  icon: 'none'
                });
                return;
              }

              // 找到具有写入权限的特征值
              let foundCharacteristic = null;
              for (let i = 0; i < charRes.characteristics.length; i++) {
                const char = charRes.characteristics[i];
                console.log(`特征值 ${i}:`, char.uuid, '性质:', char.properties);

                // 检查是否支持写入
                if (char.properties.write || char.properties.writeNoResponse) {
                  foundCharacteristic = char;
                  console.log('找到支持写入的特征值:', char.uuid);
                  break;
                }
              }

              // 如果没找到支持写入的，使用第一个
              if (!foundCharacteristic) {
                foundCharacteristic = charRes.characteristics[0];
                console.log('未找到支持写入的特征值，使用第一个:', foundCharacteristic.uuid);
              }

              // 使用找到的特征值UUID写入
              wx.writeBLECharacteristicValue({
                deviceId: connectedDeviceId,
                serviceId: service.uuid,
                characteristicId: foundCharacteristic.uuid,
                value: data,
                success: (writeRes) => {
                  console.log('特征值写入成功:', writeRes);
                },
                fail: (writeErr) => {
                  console.error('特征值写入失败:', writeErr);
                  wx.showToast({
                    title: '写入失败: ' + (writeErr.errMsg || '未知错误'),
                    icon: 'none',
                    duration: 2000
                  });
                }
              });
            },
            fail: (charErr) => {
              console.error('获取特征值失败:', charErr);
              wx.showToast({
                title: '获取特征值失败: ' + (charErr.errMsg || '未知错误'),
                icon: 'none',
                duration: 2000
              });
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
        }
      });
    } catch (error) {
      console.error('writeCharacteristicValue异常:', error);
      wx.showToast({
        title: '写入异常: ' + error.message,
        icon: 'none'
      });
    }
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

  // 提取iOS设备MAC地址
  _extractIOSMacAddress(advertisData, hasSavedMac) {
    let extractedMac = null;

    if (typeof advertisData === 'string') {
      // BluFi返回的是十六进制字符串，转换为ArrayBuffer
      console.log('广播数据（十六进制字符串）:', advertisData);
      console.log('数据长度:', advertisData.length, '字符');

      // 将十六进制字符串转换为ArrayBuffer
      const arrayBuffer = BluetoothManager.hexStringToArrayBuffer(advertisData);

      if (arrayBuffer) {
        const data = new Uint8Array(arrayBuffer);
        const hexString = Array.from(data).map(b => '0x' + b.toString(16).toUpperCase());
        console.log('广播数据（十六进制数组）:', hexString);
        console.log('广播数据（字节数组）:', Array.from(data));
        console.log('数据长度:', data.length, '字节');

        // 提取MAC地址
        if (hexString.length >= 11) {
          extractedMac = BluetoothManager.extractMacFromHexArray(hexString);
          console.log('iOS设备提取的MAC地址:', extractedMac);
        }
      }
    } else if (advertisData instanceof ArrayBuffer) {
      // 如果是ArrayBuffer，提取MAC地址
      const data = new Uint8Array(advertisData);
      const hexString = Array.from(data).map(b => '0x' + b.toString(16).toUpperCase());
      console.log('广播数据（十六进制）:', hexString);
      console.log('广播数据（字节数组）:', Array.from(data));
      console.log('数据长度:', data.length, '字节');

      // 提取MAC地址
      if (hexString.length >= 11) {
        extractedMac = BluetoothManager.extractMacFromHexArray(hexString);
        console.log('iOS设备提取的MAC地址:', extractedMac);
      }
    }

    // 保存MAC地址（如果成功提取且还未保存）
    if (extractedMac && !hasSavedMac) {
      wx.setStorageSync('wifi_device_mac', extractedMac);
      this.setData({
        wifiMac: extractedMac
      });
      console.log('iOS设备已保存GoodSleep设备的WiFi MAC地址:', extractedMac);
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

  // 格式化设备显示名称
  _formatDeviceName(device) {
    let macSuffix = 'XXXX';

    // iOS设备：从wifiMac中获取MAC地址尾数并+1
    if (this.isIOS) {
      const wifiMac = this.data.wifiMac || '';
      if (wifiMac && wifiMac.length > 0) {
        // 移除分隔符获取纯MAC地址
        const cleanMac = wifiMac.replace(/[:\-]/g, '');
        if (cleanMac.length >= 4) {
          // 获取最后4位十六进制数
          const lastFourHex = cleanMac.slice(-4);
          // 转换为十进制数，+1，再转回十六进制
          const decimalValue = parseInt(lastFourHex, 16);
          const newDecimal = (decimalValue + 1) & 0xFFFF; // 确保不超过4位十六进制
          macSuffix = newDecimal.toString(16).padStart(4, '0').toUpperCase();
        }
      }
    } else {
      // Android设备：从deviceId中提取MAC地址尾数
      const deviceId = device.deviceId || '';
      const cleanId = deviceId.replace(/[:\-]/g, '');
      macSuffix = cleanId.length >= 4 ? cleanId.slice(-4).toUpperCase() : 'XXXX';
    }

    // 生成格式化名称
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
      const systemInfo = wx.getDeviceInfo();

      // 使用WifiManager的檢測方法
      let is5G = false;
      if (systemInfo.platform === 'ios') {
        is5G = this.wifiManager.is5GWifiBySSID(ssid);
      } else {
        is5G = wifiInfo.wifi.frequency && wifiInfo.wifi.frequency >= 4900;
      }

      if (is5G) {
        // 防止重复弹窗
        if (!this._checkAndMarkModal('5G_WIFI_TIP')) {
          // 使用WifiManager的5G提示方法
          const platform = systemInfo.platform === 'ios' ? 'ios' : 'android';
          if (platform === 'ios') {
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
      console.log(res);
      this.setData({
        wifiName: null,
      })
    }
  },
  // 配网方法
  connectWifi() {
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
      wx.showLoading({
        title: '正在配网',
        mask: true
      });
      this.setData({
        isConfiguring: true,
        currentTab: 2 // 跳转到第三步
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

      // 发送配网信息，添加错误处理
      try {
        this.writeCharacteristicValue(ssidArray.buffer);
        this.writeCharacteristicValue(passwordArray.buffer);
        this.writeCharacteristicValue(connectCMD.buffer);
      } catch (writeError) {
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
          currentTab: 0, // 回到WiFi配置步骤
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
        // 检查配网是否已经完成
        if (!this.data.isConfiguring) {
          console.log('[blue] 配网超时定时器触发，但配网已完成，跳过超时处理');
          return;
        }

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
          currentTab: 0, // 回到WiFi配置步骤
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