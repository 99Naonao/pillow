/**
 * WiFi管理工具类
 */
class WifiManager {
    constructor() {
        this.wifiStatusCheckTimer = null;
    }

    /**
     * 启动WiFi
     */
    startWifi() {
        return new Promise((resolve, reject) => {
            wx.startWifi({
                success: resolve,
                fail: (error) => {
                    console.error('startWifi 失败:', error);
                    let errorMessage = '请先在手机上打开WiFi开关。';
                    
                    // 根据不同错误码提供具体的解决方案
                    if (error.errCode === 12005) {
                        errorMessage = 'WiFi功能被禁用，请在手机设置中开发WiFi。';
                    } else if (error.errCode === 12006) {
                        errorMessage = '请先打开手机WiFi开关并授权位置信息。';
                    }
                    
                    // 只记录错误，不显示提示框，让调用方处理
                    console.log('WiFi启动失败，错误信息:', errorMessage);
                    reject(error);
                }
            });
        });
    }

    /**
     * 获取已连接的WiFi
     */
    getConnectedWifi() {
        return new Promise((resolve, reject) => {
            wx.getConnectedWifi({
                success: resolve,
                fail: reject
            });
        });
    }

    /**
     * 获取WiFi列表
     */
    getWifiList() {
        return new Promise((resolve, reject) => {
            // 先移除之前的监听，防止多次注册
            wx.offGetWifiList && wx.offGetWifiList();
            
            wx.getWifiList({
                success: () => {
                    wx.onGetWifiList((listRes) => {
                        // 获取系统信息
                        const systemInfo = wx.getDeviceInfo();
                        console.log('获取WiFi列表 - 当前系统:', systemInfo.platform);
                        
                        // 根据平台过滤WiFi列表
                        let wifiList = [];
                        if (systemInfo.platform === 'ios') {
                            // iOS 设备通过SSID名称过滤5G WiFi
                            wifiList = (listRes.wifiList || []).filter(item => {
                                if (!item.SSID) return false;
                                
                                const is5G = this.is5GWifiBySSID(item.SSID);
                                const isValidWifi = !is5G;
                                
                                console.log('iOS WiFi过滤:', item.SSID, '是否5G:', is5G, '是否有效:', isValidWifi);
                                return isValidWifi;
                            });
                        } else {
                            // Android 设备通过频率过滤5G WiFi
                            wifiList = (listRes.wifiList || []).filter(item => {
                                if (!item.SSID) return false;
                                
                                const is5G = item.frequency && item.frequency >= 4900;
                                const isValidWifi = !is5G;
                                
                                console.log('Android WiFi过滤:', item.SSID, '频率:', item.frequency, '是否5G:', is5G, '是否有效:', isValidWifi);
                                return isValidWifi;
                            });
                        }
                        
                        console.log('过滤后的WiFi列表:', wifiList);
                        resolve(wifiList);
                    });
                },
                fail: (error) => {
                    console.error('获取WiFi列表失败:', error);
                    
                    // 根据错误码提供具体的解决方案
                    let errorMessage = '获取WiFi列表失败';
                    if (error.errCode === 12005) {
                        errorMessage = 'WiFi功能被禁用，请在手机设置中开放WiFi';
                    } else if (error.errCode === 12006) {
                        errorMessage = '请先打开手机WiFi开关并授权位置信息';
                    }
                    
                    // 只记录错误，不显示提示框，让调用方处理
                    console.log('WiFi列表获取失败，错误信息:', errorMessage);
                    
                    reject(error);
                }
            });
        });
    }

    /**
     * 通过SSID名称判断是否为5G WiFi
     */
    is5GWifiBySSID(ssid) {
        if (!ssid) return false;
        
        const ssidUpper = ssid.toUpperCase();
        
        // 常见的5G WiFi后缀
        const fiveGSuffixes = [
            '-5G', '_5G', '5G', '-5GHZ', '_5GHZ', '5GHZ',
            '-5G-', '_5G_', '-5G_', '_5G-',
            '5G_WIFI', '5G-WIFI', '_5G_WIFI', '-5G-WIFI'
        ];
        
        // 检查是否包含5G后缀
        for (const suffix of fiveGSuffixes) {
            if (ssidUpper.includes(suffix)) {
                console.log('检测到5G WiFi后缀:', suffix, '在SSID:', ssid);
                return true;
            }
        }
        
        // 检查是否包含特定关键词
        const fiveGKeywords = ['5G', '5GHZ', 'FIVE_G', 'FIVE-G'];
        for (const keyword of fiveGKeywords) {
            if (ssidUpper.includes(keyword)) {
                console.log('检测到5G关键词:', keyword, '在SSID:', ssid);
                return true;
            }
        }
        
        console.log('SSID未检测到5G标识:', ssid);
        return false;
    }

    /**
     * 检查WiFi状态
     */
    async checkWifiStatus() {
        try {
            const res = await this.getConnectedWifi();
            console.log('当前连接的WiFi:', res.wifi);
            
            // 检查是否有有效的WiFi连接
            if (!res.wifi || !res.wifi.SSID) {
                console.log('未检测到有效的WiFi连接');
                return {
                    isConnected: false,
                    wifiName: '',
                    is5G: false
                };
            }
            
            const systemInfo = wx.getDeviceInfo();
            let is5G = false;
            
            if (systemInfo.platform === 'ios') {
                is5G = this.is5GWifiBySSID(res.wifi.SSID);
            } else {
                is5G = res.wifi.frequency && res.wifi.frequency >= 4900;
            }
            
            console.log('WiFi状态检查结果:', {
                isConnected: true,
                wifiName: res.wifi.SSID,
                is5G: is5G
            });
            
            return {
                isConnected: true,
                wifiName: res.wifi.SSID,
                is5G: is5G
            };
        } catch (error) {
            console.error('检查WiFi状态失败:', error);
            return {
                isConnected: false,
                wifiName: '',
                is5G: false
            };
        }
    }

    /**
     * 处理iOS 5G WiFi提示
     */
    handleIOS5GWifi() {
        console.log('处理 iOS 5G WiFi 提示');
        
        // 显示步骤提示，不尝试跳转设置
        wx.showModal({
            title: '温馨提示',
            content: '当前连接的是5G WiFi，仅支持2.4G WiFi。\n\n请按以下步骤操作：\n1. 打开手机设置\n2. 选择"无线局域网"\n3. 选择非5G WiFi网络\n4. 返回小程序',
            confirmText: '知道了',
            showCancel: false
        });
    }

    /**
     * 处理Android 5G WiFi提示
     */
    handleAndroid5GWifi() {
        console.log('处理Android 5G WiFi 提示');
        
        wx.showModal({
            title: '温馨提示',
            content: '当前链接的是5G WiFi，仅支持2.4G WiFi，请切换到2.4G WiFi网络。',
            confirmText: '知道了',
            showCancel: false
        });
    }

    /**
     * 开始WiFi状态检测
     */
    startWifiStatusCheck(callback) {
        this.clearWifiStatusCheck();
        
        this.wifiStatusCheckTimer = setInterval(async () => {
            try {
                const wifiStatus = await this.checkWifiStatus();
                if (callback) {
                    callback(wifiStatus);
                }
            } catch (error) {
                console.error('WiFi状态检测失败:', error);
            }
        }, 3000); // 每3秒检查一次
    }

    /**
     * 清除WiFi状态检测
     */
    clearWifiStatusCheck() {
        if (this.wifiStatusCheckTimer) {
            clearInterval(this.wifiStatusCheckTimer);
            this.wifiStatusCheckTimer = null;
        }
    }
}

module.exports = WifiManager; 