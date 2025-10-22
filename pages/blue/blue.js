const { checkWifiAuth, checkBluetoothAndLocationByDeviceType } = require('../../utils/permissionUtil');
const commonUtil = require('../../utils/commonUtil');
const BlueDeviceManager = require('../../utils/blueDeviceManager');
const WifiConfigManager = require('../../utils/wifiConfigManager');
const UuidConverter = require('../../utils/uuidConverter');
const AuthApi = require('../../utils/authApi');

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
        
        // 保存的WiFi配置（用于蓝牙连接成功后配网）
        savedWifiConfig: null, // {ssid: '', password: ''}
        
        // 授权说明弹窗（第二步）
        guideModalVisible: false,
        guideVideoSrc: 'https://zhongshu.xinglu.shop/uploads/video/video.mp4',
        guideVideoPoster: '/static/bg.jpg',

        // 错误处理
        _isShowingWifiError: false, // 防止重复显示WiFi错误提示
        
        // 设备初始化控制
        deviceInitialized: false, // 设备是否已初始化成功
        isInitializing: false, // 是否正在初始化
        
        // 序列号管理（参考项目）
        sequenceCount: 0,
    },

    onLoad() {
        // 初始化管理器
        this.blueDeviceManager = new BlueDeviceManager(this);
        this.wifiConfigManager = new WifiConfigManager(this);
        this.UuidConverter = UuidConverter;
        this.commonUtil = commonUtil;
        
        // 初始化BluFi配网
        this._initBlufi();
        
        // 保護已保存的WiFi MAC信息，從本地存儲讀取
        const savedWifiMac = commonUtil.getSavedWifiMac();
        if (savedWifiMac) {
            this.setData({ wifiMac: savedWifiMac });
            console.log('頁面初始化時恢復已保存的WiFi MAC:', savedWifiMac);
        }
        
        // 檢查是否有已連接的設備
        const device = wx.getStorageSync('connectedDevice');
        if (device && device.deviceId) {
            console.log('onLoad: 發現已連接設備:', device.deviceId);
            this.setData({ connectedDeviceId: device.deviceId });
        }
    },

    onShow() {
        this.isPageActive = true;
        console.log('blue页面显示，当前步骤:', this.data.currentTab);
        
        // 监听蓝牙连接状态变化
        this.blueDeviceManager.startBluetoothConnectionListener();
        
        if (this.data.currentTab === 0) {
            // 第一步：蓝牙连接
            console.log('第一步：搜索蓝牙设备');
            
            // 先检查蓝牙与定位授权
            this.checkAllPermissions()
              .then(() => {
                  // 授权成功后，显示引导弹窗
                  this.setData({ guideModalVisible: true });
              })
              .catch(() => {
                  wx.showToast({ title: '请授权权限', icon: 'none' });
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
                            currentTab: 1 // 跳转到WiFi配置步骤
                        });
                        console.log('设备确实已连接，设置已连接设备ID:', device.deviceId);
                        // 设备已连接，跳转到WiFi配置步骤，等待用户输入WiFi信息
                        this.initWifiStep();
                    } else {
                        console.log('设备未真正连接，清除本地存储');
                        wx.removeStorageSync('connectedDevice');
                        this.setData({ connectedDeviceId: '' });
                    }
                    this.blueDeviceManager.updateDeviceConnectionStatus();
                });
            } else {
                this.blueDeviceManager.updateDeviceConnectionStatus();
            }
            
            // 如果设备列表为空且不在搜索中，且用户已经确认过引导弹窗，才开始搜索
            if (this.data.devices.length === 0 && !this.data.isSearching) {
                // 这里不再自动搜索，等待用户点击引导弹窗确认后再搜索
                console.log('等待用户确认引导弹窗后开始搜索');
            }
        } else if (this.data.currentTab === 1) {
            // 第二步：WiFi配置（已通过initWifi()初始化）
            console.log('第二步：WiFi配置步骤');
            // 不再调用initWifiStep()，因为已经在连接成功时调用了initWifi()
        }
    },

    // 引导弹窗确认
    onGuideConfirm() {
        this.setData({ guideModalVisible: false });
        
        // 用户点击"已进入配网模式"后，再次检查权限并开始搜索蓝牙
        this.checkAllPermissions()
            .then(() => {
                console.log('用户确认后开始搜索蓝牙设备');
                this.startBluetoothSearch();
            })
            .catch(() => {
                wx.showToast({ title: '权限不足', icon: 'none' });
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
        
        // 清除初始化相关计时器
        if (this._initDelayTimer) {
            clearTimeout(this._initDelayTimer);
            this._initDelayTimer = null;
        }
    },

    // 检查所有权限
    checkAllPermissions() {
        return checkBluetoothAndLocationByDeviceType();
    },

    // 初始化WiFi步骤
    initWifiStep() {
        // 使用WiFi配置管理器初始化WiFi步骤
        this.wifiConfigManager.initWifiStep();
    },


    // 开始蓝牙搜索
    startBluetoothSearch() {
        console.log('开始搜索GoodSleep设备');
        
        this.setData({
            devices: [],
            isSearching: true
        });
        
        // 使用BluFi搜索设备
        blufi.notifyStartDiscoverBle({
            isStart: true
        });
    },

    // 下拉刷新
    onContentRefresh() {
        if (this.data.currentTab === 1) {
            this.setData({ isRefreshing: true });
            this.checkAllPermissions()
               .then(() => {
                    this.startBluetoothSearch();
                    this.setData({ isRefreshing: false });
                })
               .catch(() => {
                    this.setData({ isRefreshing: false });
                    wx.showToast({ title: '权限不足', icon: 'none' });
                });
        }
    },

    // 自定义开关点击
    onCustomSwitchTap(e) {
        const deviceId = e.currentTarget.dataset.deviceid || e.currentTarget.dataset.deviceId;
        console.log('点击设备开关，deviceId:', deviceId);
        
        if (!deviceId) {
            console.error('deviceId 为空');
            wx.showToast({ title: '设备ID无效', icon: 'none' });
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
                            // 跳轉到登录頁面
                            wx.navigateTo({
                                url: '/page_subject/login/login'
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
            
            // 设置连接超时定时器（15秒）
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
            }, 30000); // 15秒超时
            
            // 使用BluFi连接设备
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
            // 使用BluFi断开设备
            blufi.notifyConnectBle({
                isStart: false,
                deviceId: deviceId,
                name: 'GoodSleep设备'
            });
            
            console.log('设备连接已断开:', deviceId);
            
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
                    currentTab: 0
                });
                console.log('已清除本地存储的设备信息');
            }
            
            wx.showToast({ title: '设备已断开', icon: 'success' });
        } catch (error) {
            console.error('断开设备连接失败:', error);
            wx.showToast({ title: '断开失败', icon: 'none' });
        }
    },

    // 选择WiFi
    selectWifi(e) {
        const { ssid } = e.currentTarget.dataset;
        console.log('选择WiFi:', ssid);
        // 使用WiFi配置管理器选择WiFi
        this.wifiConfigManager.selectWifi(ssid);
    },

    // 输入WiFi密码
    onInputPassword(e) {
        this.setData({ wifiPassword: e.detail.value });
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

    // 下一步（从WiFi配置到配网）
    nextStep() {
        if (!this.data.wifiName || !this.data.wifiPassword) {
            wx.showToast({ title: '请填写WiFi名称和密码', icon: 'none' });
            return;
        }
        if (this.data.is5GConnected) {
            wx.showToast({ title: '请选择2.4G WiFi', icon: 'none' });
            return;
        }
        
        // 检查设备是否已初始化完成
        if (!this.data.deviceInitialized) {
            wx.showToast({ 
                title: '设备正在初始化中，请稍候', 
                icon: 'none',
                duration: 2000
            });
            return;
        }
        
        console.log('WiFi配置完成，保存WiFi信息:', {
            wifiName: this.data.wifiName,
            wifiPassword: this.data.wifiPassword
        });
        
        // 保存WiFi配置信息
        this.setData({ 
            savedWifiConfig: {
                ssid: this.data.wifiName,
                password: this.data.wifiPassword
            }
        });

        // 开始配网
        this.startWifiConfig();
    },

    // 开始配网（完全使用参考项目代码）
    startWifiConfig() {
        console.log('开始配网');
        
        // 检查WiFi配置
        if (!this.data.wifiName) {
            wx.showToast({
                title: 'SSID不能为空',
                icon: 'none'
            });
            return;
        }
        if (!this.data.wifiPassword) {
            wx.showToast({
                title: '密码不能为空',
                icon: 'none'
            });
            return;
        }
        
        // 使用参考项目的配网方法
        this.connectWifi();
    },

    // 显示WiFi列表
    showWifiList() {
        console.log('用户点击更换WiFi，开始获取WiFi列表');
        // 使用WiFi配置管理器显示WiFi列表
        this.wifiConfigManager.showWifiList();
    },

    // 完成步骤
    completeStep() {
        this.setData({ stepsCompleted: [true, true, true] });
        wx.showToast({ title: '配置完成', icon: 'success' });
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

    // 清除本地存储的设备信息（用于调试）
    clearLocalDeviceInfo() {
        wx.removeStorageSync('connectedDevice');
        this.setData({
            connectedDeviceId: '',
            stepsCompleted: [false, false, false],
            currentTab: 0
        });
        console.log('已手动清除本地存储的设备信息');
        wx.showToast({ title: '已清除本地设备信息', icon: 'success' });
    },

    // 清除设备列表（用于调试）
    clearDeviceList() {
        this.setData({ devices: [] });
        console.log('已清除设备列表');
        wx.showToast({ title: '已清除设备列表', icon: 'success' });
    },

    // 测试WiFi状态检查（用于调试）
    testWifiStatus() {
        console.log('手动测试WiFi状态检查');
        this.checkWifiStatus();
    },

    // 停止配网
    stopWifiConfig() {
        // 停止BluFi扫描
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
                    
                    this.setData({
                        devices: goodSleepDevices
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
                    wx.hideLoading();
                    wx.showToast({
                        title: '连接成功',
                        icon: 'none'
                    });
                    
                    // 更新设备连接状态
                    const updatedDevices = this.data.devices.map(device => ({
                        ...device,
                        isConnected: device.deviceId === result.data.deviceId
                    }));
                    
                    this.setData({
                        connectedDeviceId: result.data.deviceId,
                        stepsCompleted: [true, true, false],
                        devices: updatedDevices,
                        currentTab: 1, // 跳转到WiFi配置步骤
                        sequenceCount: 0 // 重置序列号（参考项目）
                    });
                    
                    console.log('蓝牙连接成功，开始初始化设备');
                    
                    // 立即初始化设备（参考项目）
                    blufi.notifyInitBleEsp32({ deviceId: result.data.deviceId });
                    
                    // 初始化WiFi步骤（参考项目）
                    this.initWifi();
                } else {
                    wx.hideLoading();
                    console.log('设备连接失败:', result.data);
                    
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
                    
                    wx.showModal({
                        title: '连接失败',
                        content: errorMessage + '\n\n请尝试：\n1. 确保设备已进入配网模式\n2. 检查设备是否在附近\n3. 重启设备后重试',
                        showCancel: true,
                        cancelText: '重试',
                        confirmText: '确定',
                        success: (res) => {
                            if (res.cancel) {
                                // 用户选择重试，重新搜索设备
                                this.startBluetoothSearch();
                            }
                        }
                    });
                }
                break;
                
            case blufi.XBLUFI_TYPE.TYPE_CONNECT_ROUTER_RESULT:
                // 配网结果
                wx.hideLoading();
                console.log('配网结果:', result);
                console.log('配网结果詳情:', JSON.stringify(result));
                console.log('當前配網狀態:', this.data.isConfiguring);
                console.log('當前WiFi配置:', this.data.savedWifiConfig);
                
                // 清除配网超时计时器
                if (this._wifiConfigTimeout) {
                    clearTimeout(this._wifiConfigTimeout);
                    this._wifiConfigTimeout = null;
                }
                
                if (!result.result) {
                    // 配网失败
                    this.setData({
                        isConfiguring: false,
                        currentTab: 1 // 回到WiFi配置步骤
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
                        const wifiMac = this._calculateWifiMac(this.data.connectedDeviceId);
                        console.log('配网成功，计算WiFi MAC:', wifiMac);
                        // 保存WiFi MAC地址到本地存储
                        if (wifiMac) {
                            wx.setStorage({
                                key: 'wifi_device_mac',
                                data: wifiMac
                            });
                            console.log('已保存WiFi MAC地址:', wifiMac);
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
                        
                        // wx.showModal({
                        //     title: '配网成功',
                        //     content: '设备已连接至网络',
                        //     showCancel: false
                        // });
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
                    // 设置设备初始化完成状态
                    this.setData({ deviceInitialized: true });
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
                
                console.log('蓝牙MAC:', bluetoothDeviceId);
                console.log('计算WiFi MAC:', wifiMac);
                
                return wifiMac;
            }
        } catch (error) {
            console.error('计算WiFi MAC失败:', error);
        }
        
        return '';
    },

    // UTF8编码函数（参考项目）
    encodeUtf8: function(text) {
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

    // 直接写入特征值（参考项目）
    writeCharacteristicValue: function(data) {
        const { connectedDeviceId } = this.data;
        if (!connectedDeviceId) {
            console.error('没有已连接的设备ID');
            return;
        }

        wx.writeBLECharacteristicValue({
            deviceId: connectedDeviceId,
            serviceId: "0000FFFF-0000-1000-8000-00805F9B34FB",
            characteristicId: "0000FF01-0000-1000-8000-00805F9B34FB",
            value: data,
            success: function (res) {
                console.log('特征值写入成功:', res);
            },
            fail: function (res) {
                console.error('特征值写入失败:', res);
            }
        });
    },

    // 初始化WiFi（完全使用参考项目代码）
    initWifi() {
        wx.startWifi();
        wx.getConnectedWifi({
            success: (res) => {
                if (res.wifi.SSID.indexOf("5G") != -1) {
                    wx.showToast({
                        title: '不支持配置5G WiFi网络',
                        icon: 'none',
                        duration: 3000
                    })
                }
                let password = wx.getStorageSync(res.wifi.SSID)
                console.log("restore password:", password)
                this.setData({
                    wifiName: res.wifi.SSID,
                    wifiPassword: password == undefined ? "" : password,
                    wifiSelected: true // 设置WiFi已选择状态
                })
            },
            fail: (res) => {
                console.log(res);
                this.setData({
                    wifiName: null,
                })
            }
        });
    },

    // 配网方法（完全使用参考项目代码）
    connectWifi() {
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

        var temp_ssid_payload = []
        for(var i = 0; i < this.data.wifiName.length; i++){
            var ssid_utf8 = this.encodeUtf8(this.data.wifiName[i])
            temp_ssid_payload.push(...ssid_utf8);
        }

        ssid_payload.push(temp_ssid_payload.length);
        ssid_payload.push(...temp_ssid_payload);
        var temp_pwd_payload = []
        for(var i = 0; i < this.data.wifiPassword.length; i++){
            var pwd_utf8 = this.encodeUtf8(this.data.wifiPassword[i])
            temp_pwd_payload.push(...pwd_utf8);
        }
        pwd_payload.push(temp_pwd_payload.length);
        pwd_payload.push(...temp_pwd_payload);

        var ssidArray = new Uint8Array(ssid_payload);
        var passwordArray = new Uint8Array(pwd_payload);
        var connectCMD = new Uint8Array(connect_payload);
        console.log('发送配网信息')
        this.writeCharacteristicValue(ssidArray.buffer)
        this.writeCharacteristicValue(passwordArray.buffer)
        this.writeCharacteristicValue(connectCMD.buffer)

        // 设置20秒配网超时（参考项目）
        this._wifiConfigTimeout = setTimeout(() => {
            console.log('[blue] 配网超时（20秒）');
            wx.hideLoading();
            
            this.setData({
                isConfiguring: false,
                currentTab: 1 // 回到WiFi配置步骤
            });
            
            wx.showModal({
                title: '配网超时',
                content: '配网超时，请检查WiFi密码是否正确，或设备是否在配网模式',
                showCancel: true,
                cancelText: '取消',
                confirmText: '重试',
                success: (res) => {
                    if (res.confirm) {
                        this.connectWifi();
                    }
                }
            });
        }, 20000); // 20秒超时
    }
});