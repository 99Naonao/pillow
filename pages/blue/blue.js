const { checkWifiAuth, checkBluetoothAndLocationByDeviceType } = require('../../utils/permissionUtil');
const commonUtil = require('../../utils/commonUtil');
const BlueDeviceManager = require('../../utils/blueDeviceManager');
const WifiConfigManager = require('../../utils/wifiConfigManager');
const UuidConverter = require('../../utils/uuidConverter');

Page({
    data: {
        // 步驟
        currentTab: 0, // 當前步驟
        stepsCompleted: [false, false, false], // 步驟完成狀態
        totalSteps: 3, // 總步驟數
        
        // 藍牙
        devices: [], // 搜索到的藍牙設備
        connectedDeviceId: '', // 已連接的藍牙設備ID
        send_characteristicId: '', // 寫入特征值ID
        notify_cId: '', // 通知特征值ID
        serviceId: '', // 服務ID
        convertedSendId: '', // 轉換後的寫入特征值ID
        convertedNotifyId: '', // 轉換後的通知特征值ID
        isRefreshing: false, // 下拉刷新狀態
        isSearching: false, // 是否正在搜索
        
        // WiFi
        isWifiConnected: false, // 手機是否已連接WiFi
        wifiName: '', // 當前或已選WiFi名稱
        wifiList: [], // 可選WiFi列表
        wifiPassword: '', // WiFi密碼
        wifiSelected: false, // 是否已選WiFi
        wifiConnectSuccess: false, // WiFi連接狀態
        showWifiList: false, // 是否顯示WiFi列表
        is5GConnected: false, // 是否5G
        _has5GTip: false, // 防止重複彈出5G提示
        _has5GTipModal: false, // 進入WiFi步驟時重置彈窗標記
        wifiMac: '', // WiFi Mac地址
        
        // WiFi狀態檢測
        showWifiModal: false, // 是否顯示WiFi彈窗
        wifiModalContent: '', // WiFi彈窗內容
        
        // 錯誤處理
        _isShowingWifiError: false, // 防止重複顯示WiFi錯誤提示
    },

    onLoad() {
        // 初始化管理器
        this.blueDeviceManager = new BlueDeviceManager(this);
        this.wifiConfigManager = new WifiConfigManager(this);
        this.UuidConverter = UuidConverter;
        this.commonUtil = commonUtil;
    },

    onShow() {
        this.isPageActive = true;
        console.log('blue页面显示，当前步骤:', this.data.currentTab);
        
        // 读取本地已连接设备状态
        const device = wx.getStorageSync('connectedDevice');
        console.log('读取本地设备信息:', device);
        
        // 检查本地存储的设备是否真的已连接
        if (device && device.deviceId) {
            this.blueDeviceManager.checkDeviceConnectionStatus(device.deviceId).then(isConnected => {
                if (isConnected) {
                    this.setData({ connectedDeviceId: device.deviceId });
                    console.log('设备确实已连接，设置已连接设备ID:', device.deviceId);
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
        
        // 监听蓝牙连接状态变化
        this.blueDeviceManager.startBluetoothConnectionListener();
        
        if (this.data.currentTab === 0) {
            // 如果设备列表为空且不在搜索中，才开始搜索
            if (this.data.devices.length === 0 && !this.data.isSearching) {
                this.checkAllPermissions()
                   .then(() => this.blueDeviceManager.searchBluetoothDevices())
                   .catch(() => wx.showToast({ title: '权限不足，无法搜索设备', icon: 'none' }));
            } else {
                console.log('已有设备列表，只更新连接状态');
                this.blueDeviceManager.updateDeviceConnectionStatus();
            }
        } else if (this.data.currentTab === 1) {
            console.log('重新检查WiFi状态');
            this.wifiConfigManager.initWifiStep();
        }
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
    },

    // 检查所有权限
    checkAllPermissions() {
        return checkBluetoothAndLocationByDeviceType();
    },

    // 下拉刷新
    onContentRefresh() {
        if (this.data.currentTab === 0) {
            this.setData({ isRefreshing: true });
            this.checkAllPermissions()
               .then(() => {
                    this.blueDeviceManager.searchBluetoothDevices(() => {
                        this.setData({ isRefreshing: false });
                    });
                })
               .catch(() => {
                    this.setData({ isRefreshing: false });
                    wx.showToast({ title: '权限不足，无法搜索设备', icon: 'none' });
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
                content: `确定要断开与设备 "${device.name}" 的连接吗？`,
                confirmText: '断开',
                cancelText: '取消',
                success: (res) => {
                    if (res.confirm) {
                        this.disconnectDevice(deviceId);
                    }
                }
            });
        } else {
            console.log('尝试连接设备:', deviceId);
            this.blueDeviceManager.connectBluetooth(deviceId);
        }
    },

    // 断开指定设备
    async disconnectDevice(deviceId) {
        try {
            await this.blueDeviceManager.disconnectBluetooth(deviceId);
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
        this.wifiConfigManager.selectWifi(ssid);
    },

    // 输入WiFi密码
    onInputPassword(e) {
        this.setData({ wifiPassword: e.detail.value });
    },

    // 发送WiFi配置
    async sendWifiConfig() {
        await this.wifiConfigManager.sendWifiConfig();
    },

    // 显示WiFi列表
    async showWifiList() {
        await this.wifiConfigManager.showWifiList();
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
        this.wifiConfigManager.checkWifiStatus();
    }
});