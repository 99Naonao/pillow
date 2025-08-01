/**
 * WiFi配置管理模塊
 */
const WifiManager = require('./wifiManager');

class WifiConfigManager {
    constructor(page) {
        this.page = page;
        this.wifiManager = new WifiManager();
    }

    /**
     * 初始化WiFi步骤
     */
    async initWifiStep() {
        try {
            console.log('开始初始化WiFi步骤');
            await this.wifiManager.startWifi();
            console.log('WiFi启动成功，开始检查WiFi状态');
            await this.checkWifiStatus();
        } catch (error) {
            console.error('初始化WiFi步骤失败:', error);
            // 如果初始化失败，显示WiFi列表
            this.showWifiList();
        }
    }

    /**
     * 检查WiFi状态
     */
    async checkWifiStatus() {
        try {
            console.log('开始检查WiFi状态');
            const wifiStatus = await this.wifiManager.checkWifiStatus();
            console.log('WiFi状态检查结果:', wifiStatus);
            
            if (wifiStatus.isConnected) {
                if (wifiStatus.is5G) {
                    // 处理5G WiFi
                    console.log('检测到5G WiFi');
                    const systemInfo = wx.getDeviceInfo();
                    if (systemInfo.platform === 'ios') {
                        this.wifiManager.handleIOS5GWifi();
                    } else {
                        this.wifiManager.handleAndroid5GWifi();
                    }
                    
                    // 设置5G WiFi状态，让用户可以选择其他WiFi
                    this.page.setData({
                        isWifiConnected: true,
                        wifiName: wifiStatus.wifiName,
                        wifiSelected: true,
                        showWifiList: false,
                        is5GConnected: true
                    });
                } else {
                    // 2.4G WiFi，更新状态
                    console.log('检测到2.4G WiFi，更新状态');
                    this.page.setData({
                        isWifiConnected: true,
                        wifiName: wifiStatus.wifiName,
                        wifiSelected: true,
                        showWifiList: false,
                        is5GConnected: false
                    });
                }
            } else {
                // 未连接WiFi，显示WiFi列表
                console.log('未连接WiFi，显示WiFi列表');
                this.showWifiList();
            }
        } catch (error) {
            console.error('检查WiFi状态失败:', error);
            // 如果检查失败，也显示WiFi列表
            this.showWifiList();
        }
    }

    /**
     * 显示WiFi列表
     */
    async showWifiList() {
        try {
            console.log('开始获取WiFi列表');
            const wifiList = await this.wifiManager.getWifiList();
            console.log('获取到的WiFi列表:', wifiList);
            
            this.page.setData({
                wifiList: wifiList,
                showWifiList: true,
                wifiSelected: false
            });
            console.log('WiFi列表已设置到页面');
        } catch (error) {
            console.error('获取WiFi列表失败:', error);
            
            // 防止重复显示错误提示
            if (this.page.data._isShowingWifiError) {
                return;
            }
            
            // 根据错误类型提供不同的提示和重试选项
            let errorMessage = '获取WiFi列表失败';
            let showRetry = false;
            
            if (error.errCode === 12005) {
                errorMessage = 'WiFi功能被禁用，请在手机设置中开启WiFi';
                showRetry = true;
            } else if (error.errCode === 12006) {
                errorMessage = '请先打开手机WiFi开关并授权位置信息';
                showRetry = true;
            }
            
            if (showRetry) {
                this.page.setData({ _isShowingWifiError: true });
                wx.showModal({
                    title: 'WiFi错误',
                    content: errorMessage + '\n\n请按照以下步骤操作：\n1. 打开手机设置\n2. 进入"无线和网络"\n3. 开启WiFi\n4. 确保已授权位置信息\n5. 点击"重试"',
                    confirmText: '重试',
                    cancelText: '取消',
                    success: (res) => {
                        this.page.setData({ _isShowingWifiError: false });
                        if (res.confirm) {
                            // 重试获取WiFi列表
                            setTimeout(() => {
                                this.showWifiList();
                            }, 1000);
                        }
                    },
                    fail: () => {
                        this.page.setData({ _isShowingWifiError: false });
                    }
                });
            } else {
                wx.showToast({ title: errorMessage, icon: 'none', duration: 3000 });
            }
        }
    }

    /**
     * 选择WiFi
     */
    selectWifi(ssid) {
        console.log('选择WiFi:', ssid);
        
        // 重置WiFi相关状态，确保输入框可用
        this.page.setData({
            wifiName: ssid,
            wifiSelected: true,
            showWifiList: false,
            is5GConnected: false, // 重置5G状态，让输入框可用
            wifiPassword: '' // 清空密码
        });
    }

    /**
     * 发送WiFi配置
     */
    async sendWifiConfig() {
        if (!this.page.data.wifiPassword) {
            wx.showToast({ title: '请输入WiFi密码', icon: 'none' });
            return;
        }

        try {
            // 这里可以添加发送WiFi配置到设备的逻辑
            console.log('发送WiFi配置:', {
                ssid: this.page.data.wifiName,
                password: this.page.data.wifiPassword
            });
            
            wx.showToast({ title: 'WiFi配置已发送', icon: 'success' });
            
            // 更新步骤状态
            this.page.setData({
                stepsCompleted: [true, true, false],
                currentTab: 2
            });
            
        } catch (error) {
            console.error('发送WiFi配置失败:', error);
            wx.showToast({ title: '发送失败', icon: 'none' });
        }
    }

    /**
     * 清除WiFi状态检测
     */
    clearWifiStatusCheck() {
        this.wifiManager.clearWifiStatusCheck();
    }
}

module.exports = WifiConfigManager; 