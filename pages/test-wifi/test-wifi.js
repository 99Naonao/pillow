// pages/test-wifi/test-wifi.js
const BlueDeviceManager = require('../../utils/blueDeviceManager');
const EnvUtil = require('../../utils/envUtil');
const UuidConverter = require('../../utils/uuidConverter');
const CommonUtil = require('../../utils/commonUtil');

// 引用BluFi配网库
const blufi = require('../../utils/blufi/xBlufi');

Page({
  /**
   * 页面的初始数据
   */
  data: {
    // WiFi信息
    wifiName: '',
    wifiPassword: '',
    wifiMac: '', // WiFi MAC地址
    wifiList: [], // 设备扫描的WiFi列表
    selectedWifiIndex: 0, // 选中的WiFi索引
    
    // 蓝牙相关
    isBluetoothConnected: false,
    isConfiguring: false,
    isSearching: false,
    connectedDeviceId: '',
    devices: [], // BlueDeviceManager 需要的设备列表
    bluetoothDevices: [], // 搜索到的蓝牙设备列表
    showDeviceList: false, // 是否显示设备列表
    
    // 设备状态
    isInitOK: false, // 设备是否初始化成功
    connected: true, // 蓝牙连接状态
    
    // 状态信息
    statusMessage: '请连接蓝牙设备',
    showStatusModal: false,
    statusModalTitle: '',
    statusModalContent: ''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    console.log('[test-wifi] 配网测试页面加载');
    // 检查是否为开发环境
    if (!EnvUtil.isDev()) {
      wx.showModal({
        title: '访问受限',
        content: '此页面仅在开发环境可用',
        showCancel: false,
        confirmText: '确定',
        success: () => {
          wx.navigateBack();
        }
      });
      return;
    }
    
    // 初始化工具类
    this.UuidConverter = UuidConverter;
    this.commonUtil = CommonUtil;
    
    // 初始化设备管理器
    this.blueDeviceManager = new BlueDeviceManager(this);
    
    // 初始化BluFi配网
    this._initBlufi();
    
    // 如果有传入的设备ID，直接连接并初始化
    if (options.deviceId) {
      this.setData({
        connectedDeviceId: options.deviceId,
        connected: true
      });
      this._initDeviceAndStartConfig();
    }
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {
    console.log('[test-wifi] 配网测试页面卸载');
    
    // 停止配网
    this.stopWifiConfig();
    
    // 停止BluFi扫描
    if (blufi) {
      blufi.stopDiscoverBle();
    }
    
    // 清除连接超时定时器
    if (this._connectionTimeout) {
      clearTimeout(this._connectionTimeout);
      this._connectionTimeout = null;
    }
    
    // 清理资源
    if (this.blueDeviceManager) {
      this.blueDeviceManager.disconnectBluetooth();
    }
  },

  /**
   * WiFi名称输入
   */
  onWifiNameInput(e) {
    this.setData({
      wifiName: e.detail.value
    });
  },

  /**
   * WiFi密码输入
   */
  onWifiPasswordInput(e) {
    this.setData({
      wifiPassword: e.detail.value
    });
  },

  /**
   * 下一步 - 开始蓝牙连接
   */
  onNextStep() {
    const { wifiName, wifiPassword } = this.data;
    
    // 验证输入
    if (!wifiName.trim()) {
      wx.showToast({
        title: '请输入WiFi名称',
        icon: 'none'
      });
      return;
    }
    
    if (!wifiPassword.trim()) {
      wx.showToast({
        title: '请输入WiFi密码',
        icon: 'none'
      });
      return;
    }
    
    // 更新状态
    this.setData({
      currentStep: 2,
      statusMessage: '正在搜索蓝牙设备...'
    });
    
    // 开始搜索蓝牙设备
    this.startBluetoothSearch();
  },

  /**
   * 开始蓝牙搜索
   */
  startBluetoothSearch() {
    console.log('[test-wifi] 开始搜索GoodSleep设备');
    
    // 清空之前的设备列表
    this.setData({
      bluetoothDevices: [],
      showDeviceList: false,
      statusMessage: '正在搜索GoodSleep设备...'
    });
    
    // 使用BluFi搜索设备（按照原版BluFi项目的方式）
    blufi.notifyStartDiscoverBle({
      isStart: true
    });
  },

  /**
   * 选择蓝牙设备
   */
  selectBluetoothDevice(e) {
    const deviceId = e.currentTarget.dataset.deviceId;
    const deviceName = e.currentTarget.dataset.deviceName;
    
    console.log('[test-wifi] 选择设备:', deviceName, deviceId);
    
    // 停止搜索（按照原版BluFi项目的方式）
    blufi.notifyStartDiscoverBle({
      isStart: false
    });
    
    // 隐藏设备列表
    this.setData({
      showDeviceList: false,
      statusMessage: '正在连接设备...',
      isConfiguring: true
    });
    
    // 显示连接加载提示
    wx.showLoading({
      title: '连接蓝牙设备中...',
    });
    
    // 设置连接超时定时器（15秒）
    this._connectionTimeout = setTimeout(() => {
      wx.hideLoading();
      console.log('[test-wifi] 设备连接超时');
      
      this.setData({
        isBluetoothConnected: false,
        statusMessage: '设备连接超时',
        isConfiguring: false
      });
      
      this.showStatusModal('连接超时', '设备连接超时，请检查：\n1. 设备是否已进入配网模式\n2. 设备是否在附近\n3. 设备是否被其他应用占用\n\n是否重试连接？');
    }, 15000); // 15秒超时
    
    // 使用BluFi连接设备（按照原版BluFi项目的方式）
    blufi.notifyConnectBle({
      isStart: true,
      deviceId: deviceId,
      name: deviceName
    });
  },

  /**
   * 根据蓝牙设备MAC地址计算WiFi MAC地址
   * WiFi MAC = 蓝牙MAC尾数 - 1
   */
  _calculateWifiMac(bluetoothDeviceId) {
    try {
      // 蓝牙设备ID通常是MAC地址格式，如 "AA:BB:CC:DD:EE:FF"
      // 提取最后两位数字
      const macParts = bluetoothDeviceId.split(':');
      if (macParts.length >= 6) {
        const lastPart = macParts[5]; // 获取最后一部分
        const lastByte = parseInt(lastPart, 16); // 转换为十进制
        const wifiLastByte = lastByte - 1; // WiFi MAC = 蓝牙MAC - 1
        
        // 确保结果在有效范围内 (0-255)
        const validWifiByte = wifiLastByte < 0 ? 255 : wifiLastByte;
        
        // 重新构建WiFi MAC地址
        const wifiMacParts = [...macParts];
        wifiMacParts[5] = validWifiByte.toString(16).padStart(2, '0').toUpperCase();
        const wifiMac = wifiMacParts.join(':');
        
        console.log('[test-wifi] 蓝牙MAC:', bluetoothDeviceId);
        console.log('[test-wifi] 计算WiFi MAC:', wifiMac);
        
        return wifiMac;
      }
    } catch (error) {
      console.error('[test-wifi] 计算WiFi MAC失败:', error);
    }
    
    return '';
  },

  /**
   * 初始化BluFi配网
   */
  _initBlufi() {
    try {
      // 初始化BluFi
      blufi.initXBlufi(blufi.XMQTT_SYSTEM.WeChat); // 微信小程序
      console.log('[test-wifi] BluFi初始化成功');
      
      // 设置BluFi事件监听
      this._setupBlufiListeners();
    } catch (error) {
      console.error('[test-wifi] BluFi初始化失败:', error);
    }
  },

  /**
   * 设置BluFi事件监听
   */
  _setupBlufiListeners() {
    // 监听设备发现
    blufi.listenStartDiscoverBle(true, (options) => {
      if (options.isStart) {
        console.log('[test-wifi] 开始搜索设备');
      } else {
        console.log('[test-wifi] 停止搜索设备');
      }
    });

    // 监听设备连接状态变化
    blufi.listenConnectBle(true, (options) => {
      console.log('[test-wifi] 设备连接状态变化:', options);
    });

    // 监听设备消息
    blufi.listenDeviceMsgEvent(true, (result) => {
      this._handleBlufiResult(result);
    });
  },

  /**
   * 处理BluFi结果
   */
  _handleBlufiResult(result) {
    console.log('[test-wifi] BluFi结果:', result);
    
    switch (result.type) {
      case blufi.XBLUFI_TYPE.TYPE_GET_DEVICE_LISTS:
        // 设备列表更新（按照原版BluFi项目的方式）
        if (result.result) {
          const allDevices = result.data || [];
          const goodSleepDevices = allDevices.filter(device => {
            if (!device.name) return false;
            return device.name.startsWith('GoodSleep');
          });
          
          console.log('[test-wifi] 所有设备:', allDevices);
          console.log('[test-wifi] GoodSleep设备:', goodSleepDevices);
          
          this.setData({
            bluetoothDevices: goodSleepDevices,
            showDeviceList: true,
            statusMessage: `找到 ${goodSleepDevices.length} 个GoodSleep设备`
          });
        }
        break;
        
      case blufi.XBLUFI_TYPE.TYPE_GET_DEVICE_LISTS_START:
        // 搜索开始（按照原版BluFi项目的方式）
        if (!result.result) {
          console.log('[test-wifi] 蓝牙未开启:', result);
          wx.showToast({
            title: '蓝牙未开启',
            icon: 'none'
          });
        } else {
          console.log('[test-wifi] 蓝牙搜索开始');
          this.setData({
            statusMessage: '正在搜索GoodSleep设备...'
          });
        }
        break;
        
      case blufi.XBLUFI_TYPE.TYPE_GET_DEVICE_LISTS_STOP:
        // 搜索停止（按照原版BluFi项目的方式）
        if (result.result) {
          console.log('[test-wifi] 蓝牙停止搜索成功');
        } else {
          console.log('[test-wifi] 蓝牙停止搜索失败');
        }
        this.setData({
          statusMessage: '搜索已停止'
        });
        break;
        
      case blufi.XBLUFI_TYPE.TYPE_CONNECTED:
        // 设备连接结果（按照原版BluFi项目的方式）
        console.log('[test-wifi] 连接回调:', JSON.stringify(result));
        
        // 清除连接超时定时器
        if (this._connectionTimeout) {
          clearTimeout(this._connectionTimeout);
          this._connectionTimeout = null;
        }
        
        if (result.result) {
          wx.hideLoading();
          wx.showToast({
            title: '连接成功',
            icon: 'none'
          });
          
          this.setData({
            isBluetoothConnected: true,
            connectedDeviceId: result.data.deviceId,
            statusMessage: '设备连接成功，正在初始化...',
            showDeviceList: false
          });
          
          // 连接成功后初始化设备并开始配网
          this._initDeviceAndStartConfig();
        } else {
          wx.hideLoading();
          console.log('[test-wifi] 设备连接失败:', result.data);
          
          // 提供更详细的错误信息
          let errorMessage = '设备连接失败';
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
          
          this.setData({
            isBluetoothConnected: false,
            statusMessage: '设备连接失败',
            isConfiguring: false
          });
          this.showStatusModal('连接失败', errorMessage + '\n\n请尝试：\n1. 确保设备已进入配网模式\n2. 检查设备是否在附近\n3. 重启设备后重试');
        }
        break;
        
      case blufi.XBLUFI_TYPE.TYPE_CONNECT_ROUTER_RESULT:
        // 配网结果（按照原版BluFi项目的方式）
        wx.hideLoading();
        console.log('[test-wifi] 配网结果:', result);
        
        // 清除配网超时定时器
        if (this._wifiConfigTimeout) {
          clearTimeout(this._wifiConfigTimeout);
          this._wifiConfigTimeout = null;
        }
        
        if (!result.result) {
          // 配网失败
          this.setData({
            statusMessage: 'WiFi配网失败',
            isConfiguring: false
          });
          this.showStatusModal('配网失败', '配网失败，请重试');
        } else {
          // 配网成功
          if (result.data && result.data.progress == 100) {
            const ssid = result.data.ssid;
            
            // 根据蓝牙设备MAC地址计算WiFi MAC地址
            const wifiMac = this._calculateWifiMac(this.data.connectedDeviceId);
            
            console.log('[test-wifi] 配网成功，计算WiFi MAC:', wifiMac);
            
            // 保存WiFi MAC地址到本地存储
            if (wifiMac) {
              wx.setStorage({
                key: 'wifi_device_mac',
                data: wifiMac
              });
              console.log('[test-wifi] 已保存WiFi MAC地址:', wifiMac);
            }
            
            // 保存WiFi密码到本地存储（按照参考项目的方式）
            wx.setStorage({
              key: wifiName,
              data: wifiPassword
            });
            
            this.setData({
              statusMessage: 'WiFi配网成功！',
              isConfiguring: false,
              wifiMac: wifiMac // 保存到页面数据中
            });
            
            // 显示成功信息（按照原版BluFi项目的方式）
            this.showStatusModal('配网成功', `连接成功路由器【${ssid}】\nWiFi MAC: ${wifiMac || '计算失败'}`);
          } else {
            // 配网进行中
            this.setData({
              statusMessage: '配网进行中...',
              isConfiguring: true
            });
          }
        }
        break;
        
      case blufi.XBLUFI_TYPE.TYPE_STATUS_CONNECTED:
        // 
        console.log('[test-wifi] 设备连接状态变化:', result);
        this.setData({
          isBluetoothConnected: result.result
        });
        
        if (!result.result) {
          // 设备断开连接
          this.setData({
            statusMessage: '设备连接断开',
            isConfiguring: false
          });
          this.showStatusModal('连接断开', '小程序与设备异常断开');
        }
        break;
        
      case blufi.XBLUFI_TYPE.TYPE_INIT_ESP32_RESULT:
        // 设备初始化结果
        wx.hideLoading();
        console.log('[test-wifi] 初始化结果:', JSON.stringify(result));
        
        if (result.result) {
          console.log('[test-wifi] 初始化成功');
          // 初始化成功后获取手机当前连接的WiFi
          this.getCurrentWifiInfo();
        } else {
          console.log('[test-wifi] 初始化失败');
          this.setData({
            connected: false,
            isInitOK: false
          });
          wx.showModal({
            title: '温馨提示',
            content: '设备初始化失败',
            showCancel: false,
            success: (res) => {
              wx.navigateBack();
            }
          });
        }
        break;
    }
  },

  /**
   * 获取手机当前连接的WiFi信息
   */
  getCurrentWifiInfo() {
    console.log('[test-wifi] 开始获取手机当前WiFi信息');
    
    // 先启动WiFi模块
    wx.startWifi({
      success: () => {
        console.log('[test-wifi] WiFi模块启动成功');
        // 获取当前连接的WiFi
        wx.getConnectedWifi({
          success: (res) => {
            console.log('[test-wifi] 获取到当前WiFi:', res.wifi);
            const wifiInfo = res.wifi;
            
            this.setData({
              wifiName: wifiInfo.SSID,
              wifiList: [wifiInfo.SSID], // 只包含当前WiFi
              selectedWifiIndex: 0,
              isInitOK: true
            });
            
            console.log('[test-wifi] 已设置当前WiFi:', wifiInfo.SSID);
          },
          fail: (err) => {
            console.error('[test-wifi] 获取当前WiFi失败:', err);
            // 如果获取失败，显示手动输入界面
            this.setData({
              isInitOK: true
            });
            wx.showToast({
              title: '请手动输入WiFi信息',
              icon: 'none'
            });
          }
        });
      },
      fail: (err) => {
        console.error('[test-wifi] WiFi模块启动失败:', err);
        // 如果WiFi模块启动失败，显示手动输入界面
        this.setData({
          isInitOK: true
        });
        wx.showToast({
          title: '请手动输入WiFi信息',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 初始化设备并开始配网
   */
  _initDeviceAndStartConfig() {
    const { connectedDeviceId } = this.data;
    
    console.log('[test-wifi] 初始化设备:', connectedDeviceId);
    
    // 初始化设备（按照参考项目的方式）
    blufi.notifyInitBleEsp32({
      deviceId: connectedDeviceId
    });
    
    // 显示初始化加载提示
    wx.showLoading({
      title: '设备初始化中',
    });
  },

  /**
   * 选择WiFi
   */
  onWifiPickerChange(e) {
    const index = e.detail.value;
    const selectedWifi = this.data.wifiList[index];
    
    console.log('[test-wifi] 选择WiFi:', selectedWifi);
    
    this.setData({
      selectedWifiIndex: index,
      wifiName: selectedWifi
    });
    
    // 检查是否有保存的密码
    const savedPassword = wx.getStorageSync(selectedWifi);
    if (savedPassword) {
      this.setData({
        wifiPassword: savedPassword
      });
    }
  },

  /**
   * 手动输入WiFi名称
   */
  onWifiNameInput(e) {
    this.setData({
      wifiName: e.detail.value
    });
  },

  /**
   * 输入WiFi密码
   */
  onPasswordInput(e) {
    this.setData({
      wifiPassword: e.detail.value
    });
  },

  /**
   * 开始WiFi配网
   */
  startWifiConfig() {
    const { wifiName, wifiPassword } = this.data;
    
    console.log('[test-wifi] 开始BluFi配网:', wifiName);
    
    this.setData({
      statusMessage: '正在发送WiFi信息到设备...',
      isConfiguring: true
    });
    
    // 显示加载提示（按照原版BluFi项目的方式）
    wx.showLoading({
      title: '正在配网',
      mask: true
    });
    
    // 设置配网超时定时器（30秒）
    this._wifiConfigTimeout = setTimeout(() => {
      console.log('[test-wifi] 配网超时');
      wx.hideLoading();
      this.setData({
        statusMessage: '配网超时',
        isConfiguring: false
      });
      this.showStatusModal('配网超时', '配网超时，请检查设备是否支持BluFi配网或重试');
    }, 30000);
    
    // 发送配网信息（按照原版BluFi项目的方式）
    blufi.notifySendRouterSsidAndPassword({
      ssid: wifiName,
      password: wifiPassword
    });
  },

  /**
   * 显示状态弹窗
   */
  showStatusModal(title, content) {
    this.setData({
      showStatusModal: true,
      statusModalTitle: title,
      statusModalContent: content
    });
  },

  /**
   * 关闭状态弹窗
   */
  closeStatusModal() {
    this.setData({
      showStatusModal: false
    });
  },

  /**
   * 停止配网
   */
  stopWifiConfig() {
    // 停止BluFi扫描
    if (blufi) {
      try {
        blufi.notifyStartDiscoverBle({
          isStart: false
        });
        console.log('[test-wifi] 已停止BluFi配网');
      } catch (error) {
        console.error('[test-wifi] 停止BluFi配网失败:', error);
      }
    }
    
    // 清除配网超时定时器
    if (this._wifiConfigTimeout) {
      clearTimeout(this._wifiConfigTimeout);
      this._wifiConfigTimeout = null;
    }
    
    wx.hideLoading();
    this.setData({
      statusMessage: '配网已停止',
      isConfiguring: false
    });
  },

  /**
   * 重新开始
   */
  restart() {
    // 停止当前配网
    this.stopWifiConfig();
    
    this.setData({
      currentStep: 1,
      wifiName: '',
      wifiPassword: '',
      isBluetoothConnected: false,
      isConfiguring: false,
      connectedDeviceId: '',
      statusMessage: '请填写WiFi信息'
    });
    
    // 断开蓝牙连接
    if (this.blueDeviceManager) {
      this.blueDeviceManager.disconnectBluetooth();
    }
  },


  /**
   * 返回上一步
   */
  onPrevStep() {
    if (this.data.currentStep > 1) {
      this.setData({
        currentStep: this.data.currentStep - 1,
        statusMessage: '请填写WiFi信息'
      });
    }
  }
});
