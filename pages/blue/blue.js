const { checkWifiAuth, checkBluetoothAndLocationByDeviceType } = require('../../utils/permissionUtil');
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
        
        // 保存的WiFi配置（用于蓝牙连接成功后配网）
        savedWifiConfig: null, // {ssid: '', password: ''}
        
        // 授权说明弹窗（第二步）
        guideModalVisible: false,
        guideVideoSrc: 'https://zhongshu.xinglu.shop/uploads/video/video.mp4',
        guideVideoPoster: '/static/bg.jpg',

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
            
            // 进入页面后自动开始搜索蓝牙设备
            if (this.data.devices.length === 0 && !this.data.isSearching) {
                console.log('进入页面，自动开始搜索蓝牙设备');
                this.startBluetoothSearch();
            }
        } else if (this.data.currentTab === 1) {
            // 第二步：WiFi配置
            console.log('第二步：WiFi配置步骤');
           
        }
    },

    // 引导弹窗确认
    onGuideConfirm() {
        this.setData({ guideModalVisible: false });
        
        // 用户点击"已进入配网模式"后，再次检查权限
        this.checkAllPermissions()
            .then(() => {
                console.log('用户确认后继续搜索蓝牙设备');
                // 蓝牙搜索已在onShow时自动开始，这里不需要再次搜索
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
        
    },

    // 检查所有权限
    checkAllPermissions() {
        return checkBluetoothAndLocationByDeviceType();
    },

    // 检测iOS平台
    _detectIOSPlatform() {
        try {
            const systemInfo = wx.getSystemInfoSync();
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
    initWifiStep() {
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
            wx.showToast({ title: '断开失败', icon: 'none' });
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
                currentTab: 0
            });
            console.log('已清除本地存储的设备信息');
        }
        
        wx.showToast({ title: '设备已断开', icon: 'success' });
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
                    
                    // 处理每个GoodSleep设备，提取MAC地址并保存（只保存第一个GoodSleep设备的MAC）
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
                            if (typeof device.advertisData === 'string') {
                                // BluFi返回的是十六进制字符串，转换为ArrayBuffer
                                console.log('广播数据（十六进制字符串）:', device.advertisData);
                                console.log('数据长度:', device.advertisData.length, '字符');
                                
                                // 将十六进制字符串转换为ArrayBuffer
                                const arrayBuffer = BluetoothManager.hexStringToArrayBuffer(device.advertisData);
                                
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
                                        
                                        // 只在还没保存MAC且成功提取到MAC时保存
                                        if (extractedMac && !hasSavedMac) {
                                            wx.setStorageSync('wifi_device_mac', extractedMac);
                                            this.setData({ wifiMac: extractedMac });
                                            console.log('iOS设备已保存GoodSleep设备的WiFi MAC地址:', extractedMac);
                                            hasSavedMac = true; // 标记已保存，后续设备不再保存
                                        } else if (extractedMac && hasSavedMac) {
                                            console.log('WiFi MAC地址已保存，跳过重复保存');
                                        }
                                    }
                                }
                            } else if (device.advertisData instanceof ArrayBuffer) {
                                // 如果是ArrayBuffer，提取MAC地址
                                const data = new Uint8Array(device.advertisData);
                                const hexString = Array.from(data).map(b => '0x' + b.toString(16).toUpperCase());
                                console.log('广播数据（十六进制）:', hexString);
                                console.log('广播数据（字节数组）:', Array.from(data));
                                console.log('数据长度:', data.length, '字节');
                                
                                // 提取MAC地址
                                if (hexString.length >= 11) {
                                    extractedMac = BluetoothManager.extractMacFromHexArray(hexString);
                                    console.log('iOS设备提取的MAC地址:', extractedMac);
                                    
                                    // 只在还没保存MAC且成功提取到MAC时保存
                                    if (extractedMac && !hasSavedMac) {
                                        wx.setStorageSync('wifi_device_mac', extractedMac);
                                        this.setData({ wifiMac: extractedMac });
                                        console.log('iOS设备已保存GoodSleep设备的WiFi MAC地址:', extractedMac);
                                        hasSavedMac = true; // 标记已保存，后续设备不再保存
                                    } else if (extractedMac && hasSavedMac) {
                                        console.log('WiFi MAC地址已保存，跳过重复保存');
                                    }
                                }
                            }
                        } else {
                            console.log('广播数据: 无 或 非iOS设备');
                        }
                        console.log('========================');
                        
                        // 格式化设备显示名称
                        const displayName = this._formatDeviceName(device);
                        
                        // 保存提取的MAC地址到设备对象
                        return {
                            ...device,
                            extractedMac: extractedMac,
                            displayName: displayName
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
                    // let errorMessage = '设备连接失败';
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
                    
                //     wx.showModal({
                //         title: '连接失败',
                //         content: errorMessage + '\n\n请尝试：\n1. 确保设备已进入配网模式\n2. 检查设备是否在附近\n3. 重启设备后重试',
                //         showCancel: true,
                //         cancelText: '重试',
                //         confirmText: '确定',
                //         success: (res) => {
                //             if (res.cancel) {
                //                 // 用户选择重试，重新搜索设备
                //                 this.startBluetoothSearch();
                //             }
                //         }
                //     });
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
                        const wifiMac = BluetoothManager.calculateWifiMac(this.data.connectedDeviceId);
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

    // 静态方法（已注释，保留以便参考）
    // writeCharacteristicValue: function(data) {
    //     console.log('[writeCharacteristicValue]:', data);
    //     const { connectedDeviceId } = this.data;
    //     if (!connectedDeviceId) {
    //         console.error('没有已连接的设备ID');
    //         return;
    //     }
    //
    //     // 静态UUID（固定值）
    //     const serviceId = "0000FFFF-0000-1000-8000-00805F9B34FB";
    //     const characteristicId = "0000FF01-0000-1000-8000-00805F9B34FB";
    //
    //     // 直接使用固定UUID写入特征值
    //     wx.writeBLECharacteristicValue({
    //         deviceId: connectedDeviceId,
    //         serviceId: serviceId,
    //         characteristicId: characteristicId,
    //         value: data,
    //         success: (res) => {
    //             console.log('特征值写入成功:', res);
    //         },
    //         fail: (res) => {
    //             console.error('特征值写入失败:', res);
    //         }
    //     });
    // },

    // 动态方法：自动获取UUID并写入特征值
    writeCharacteristicValue: function(data) {
        console.log('[writeCharacteristicValue]:', data);
        const { connectedDeviceId } = this.data;
        
        if (!connectedDeviceId) {
            console.error('没有已连接的设备ID');
            return;
        }

        // 动态获取设备的所有服务（不使用固定UUID）
        wx.getBLEDeviceServices({
            deviceId: connectedDeviceId,
            success: (res) => {
                console.log('获取蓝牙服务成功，所有服务:', res.services);
                
                if (!res.services || res.services.length === 0) {
                    console.error('未找到任何服务');
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
                            }
                        });
                    },
                    fail: (charErr) => {
                        console.error('获取特征值失败:', charErr);
                    }
                });
            },
            fail: (res) => {
                console.error('获取蓝牙服务失败:', res);
            }
        });
    },

    // 检查并标记弹窗是否已显示（防止重复显示）
    _checkAndMarkModal(modalName) {
        if (!this.data._modalShown[modalName]) {
            this.setData({
                [`_modalShown.${modalName}`]: true
            });
            return false; // 未显示过，返回false表示可以显示
        }
        return true; // 已显示过，返回true表示不显示
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
                currentTab: 1 //  回到WiFi配置步骤
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
        }, 60000); // 20秒超时
    }
});