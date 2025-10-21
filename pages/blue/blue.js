const { checkWifiAuth, checkBluetoothAndLocationByDeviceType } = require('../../utils/permissionUtil');
const commonUtil = require('../../utils/commonUtil');
const BlueDeviceManager = require('../../utils/blueDeviceManager');
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
    },

    onLoad() {
        // 初始化管理器
        this.blueDeviceManager = new BlueDeviceManager(this);
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
    },

    onShow() {
        this.isPageActive = true;
        console.log('blue页面显示，当前步骤:', this.data.currentTab);
        
        // 监听蓝牙连接状态变化
        this.blueDeviceManager.startBluetoothConnectionListener();
        
        if (this.data.currentTab === 0) {
            // 第一步：WiFi配置
            console.log('第一步：检查WiFi状态');
            this.initWifiStep();
        } else if (this.data.currentTab === 1) {
            // 第二步：蓝牙连接
            console.log('第二步：搜索蓝牙设备');

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
                        this.setData({ connectedDeviceId: device.deviceId });
                        console.log('设备确实已连接，设置已连接设备ID:', device.deviceId);
                        // 设备已连接，自动进入第三步配网
                        this.startWifiConfig();
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
            } else {
                console.log('已有设备列表，只更新连接状态');
                this.blueDeviceManager.updateDeviceConnectionStatus();
            }
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
        this.blueDeviceManager.stopBluetoothConnectionListener();
    },

    onUnload() {
        this.isPageActive = false;
        this.blueDeviceManager.stopBluetoothConnectionListener();
    },

    // 检查所有权限
    checkAllPermissions() {
        return checkBluetoothAndLocationByDeviceType();
    },

    // 初始化WiFi步骤
    initWifiStep() {
        console.log('开始初始化WiFi步骤');
        // 检查WiFi状态
        this.checkWifiStatus();
    },

    // 检查WiFi状态
    checkWifiStatus() {
        wx.getNetworkType({
            success: (res) => {
                console.log('网络类型:', res.networkType);
                if (res.networkType === 'wifi') {
                    this.setData({
                        isWifiConnected: true,
                        wifiSelected: true
                    });
                    // 获取当前WiFi信息
                    this.getCurrentWifiInfo();
                } else {
                    this.setData({
                        isWifiConnected: false,
                        wifiSelected: false
                    });
                }
            },
            fail: (error) => {
                console.error('获取网络类型失败:', error);
                this.setData({
                    isWifiConnected: false,
                    wifiSelected: false
                });
            }
        });
    },

    // 获取当前WiFi信息
    getCurrentWifiInfo() {
        wx.getWifiList({
            success: (res) => {
                console.log('获取WiFi列表成功:', res.wifiList);
                if (res.wifiList && res.wifiList.length > 0) {
                    // 使用第一个WiFi作为当前WiFi
                    const currentWifi = res.wifiList[0];
                    this.setData({
                        wifiName: currentWifi.SSID,
                        wifiList: res.wifiList
                    });
                }
            },
            fail: (error) => {
                console.error('获取WiFi列表失败:', error);
            }
        });
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
            
            // 使用BluFi连接设备
            blufi.notifyConnectBle({
                isStart: true,
                deviceId: deviceId,
                name: device.displayName || 'GoodSleep设备'
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
        this.setData({
            wifiName: ssid,
            wifiSelected: true,
            showWifiList: false,
            showPassword: false
        });
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

    // 下一步（从WiFi配置到蓝牙连接）
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
        
        // 保存WiFi配置信息，供蓝牙连接成功后使用，并切换到第二步
        this.setData({ 
            currentTab: 1,
            stepsCompleted: [true, false, false],
            // 保存WiFi配置信息
            savedWifiConfig: {
                ssid: this.data.wifiName,
                password: this.data.wifiPassword
            }
        });

        // 进入第二步后，立即触发一次蓝牙搜索（无需下拉）
        // 重置搜索相关状态，避免旧数据影响
        this.setData({ devices: [], isSearching: false });
        // 进入第二步即检查权限，授权成功后弹出视频引导
        this.checkAllPermissions()
            .then(() => {
                this.setData({ guideModalVisible: true });
            })
            .catch(() => {
                // 未授权则提示
                wx.showToast({ title: '请授权权限', icon: 'none' });
            });
    },

    // 开始配网（蓝牙连接成功后自动调用）
    startWifiConfig() {
        console.log('蓝牙连接成功，开始配网');
        
        // 检查是否有保存的WiFi配置
        if (!this.data.savedWifiConfig) {
            console.error('没有保存的WiFi配置信息');
            wx.showToast({ title: 'WiFi配置信息丢失', icon: 'none' });
            return;
        }
        
        console.log('使用保存的WiFi配置进行配网:', this.data.savedWifiConfig);
        
        this.setData({ 
            currentTab: 2,
            isConfiguring: true,
            stepsCompleted: [true, true, false]
        });
        
        // 显示配网加载提示
        wx.showLoading({
            title: '正在配网',
            mask: true
        });
        
        // 发送配网信息（使用BluFi）
        blufi.notifySendRouterSsidAndPassword({
            ssid: this.data.savedWifiConfig.ssid,
            password: this.data.savedWifiConfig.password
        });
    },

    // 显示WiFi列表
    showWifiList() {
        this.setData({
            showWifiList: true
        });
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
        // 监听设备发现
        blufi.listenStartDiscoverBle(true, (options) => {
            if (options.isStart) {
                console.log('开始搜索设备');
            } else {
                console.log('停止搜索设备');
            }
        });

        // 监听设备连接状态变化
        blufi.listenConnectBle(true, (options) => {
            console.log('设备连接状态变化:', options);
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
        console.log('BluFi结果:', result);
        
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
                if (result.result) {
                    wx.hideLoading();
                    wx.showToast({
                        title: '连接成功',
                        icon: 'none'
                    });
                    
                    this.setData({
                        connectedDeviceId: result.data.deviceId,
                        stepsCompleted: [true, true, false]
                    });
                    
                    // 连接成功后初始化设备并开始配网
                    this._initDeviceAndStartConfig();
                } else {
                    wx.hideLoading();
                    console.log('设备连接失败:', result.data);
                    wx.showToast({
                        title: '连接失败',
                        icon: 'none'
                    });
                }
                break;
                
            case blufi.XBLUFI_TYPE.TYPE_CONNECT_ROUTER_RESULT:
                // 配网结果
                wx.hideLoading();
                console.log('配网结果:', result);
                
                if (!result.result) {
                    // 配网失败
                    this.setData({
                        isConfiguring: false
                    });
                    wx.showModal({
                        title: '配网失败',
                        content: '配网失败，请重试',
                        showCancel: false
                    });
                } else {
                    // 配网成功
                    if (result.data && result.data.progress == 100) {
                        const ssid = result.data.ssid;
                        this.setData({
                            isConfiguring: false,
                            stepsCompleted: [true, true, true]
                        });
                        
                        wx.showModal({
                            title: '配网成功',
                            content: `连接成功路由器【${ssid}】`,
                            showCancel: false
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
                console.log('初始化结果:', JSON.stringify(result));
                
                if (result.result) {
                    console.log('初始化成功');
                    this.setData({
                        statusMessage: '设备初始化成功，开始配网...'
                    });
                    
                    // 初始化成功后开始配网
                    this.startWifiConfig();
                } else {
                    console.log('初始化失败');
                    this.setData({
                        isConfiguring: false
                    });
                    wx.showModal({
                        title: '初始化失败',
                        content: '设备初始化失败，请重试',
                        showCancel: false
                    });
                }
                break;
        }
    },

    /**
     * 初始化设备并开始配网
     */
    _initDeviceAndStartConfig() {
        const { connectedDeviceId } = this.data;
        
        console.log('初始化设备:', connectedDeviceId);
        
        // 初始化设备
        blufi.notifyInitBleEsp32({
            deviceId: connectedDeviceId
        });
        
        // 显示初始化加载提示
        wx.showLoading({
            title: '设备初始化中',
        });
    }
});