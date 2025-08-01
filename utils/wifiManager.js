/**
 * WiFi管理工具類
 */
class WifiManager {
    constructor() {
        this.wifiStatusCheckTimer = null;
    }

    /**
     * 啟動WiFi
     */
    startWifi() {
        return new Promise((resolve, reject) => {
            wx.startWifi({
                success: resolve,
                fail: (error) => {
                    console.error('startWifi 失敗:', error);
                    let errorMessage = '请先在手机上打开WiFi开关。';
                    
                    // 根據不同錯誤碼提供具體的解決方案
                    if (error.errCode === 12005) {
                        errorMessage = 'WiFi功能被禁用，请在手机设置中开发WiFi。';
                    } else if (error.errCode === 12006) {
                        errorMessage = '请先打开手机WiFi开关并授权位置信息。';
                    }
                    
                    // 只記錄錯誤，不顯示提示框，讓調用方處理
                    console.log('WiFi啟動失敗，錯誤信息:', errorMessage);
                    reject(error);
                }
            });
        });
    }

    /**
     * 獲取已連接的WiFi
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
     * 獲取WiFi列表
     */
    getWifiList() {
        return new Promise((resolve, reject) => {
            // 先移除之前的監聽，防止多次註冊
            wx.offGetWifiList && wx.offGetWifiList();
            
            wx.getWifiList({
                success: () => {
                    wx.onGetWifiList((listRes) => {
                        // 獲取系統信息
                        const systemInfo = wx.getDeviceInfo();
                        console.log('獲取WiFi列表 - 當前系統:', systemInfo.platform);
                        
                        // 根據平台過濾WiFi列表
                        let wifiList = [];
                        if (systemInfo.platform === 'ios') {
                            // iOS 設備通過SSID名稱過濾5G WiFi
                            wifiList = (listRes.wifiList || []).filter(item => {
                                if (!item.SSID) return false;
                                
                                const is5G = this.is5GWifiBySSID(item.SSID);
                                const isValidWifi = !is5G;
                                
                                console.log('iOS WiFi過濾:', item.SSID, '是否5G:', is5G, '是否有效:', isValidWifi);
                                return isValidWifi;
                            });
                        } else {
                            // Android 設備通過頻率過濾5G WiFi
                            wifiList = (listRes.wifiList || []).filter(item => {
                                if (!item.SSID) return false;
                                
                                const is5G = item.frequency && item.frequency >= 4900;
                                const isValidWifi = !is5G;
                                
                                console.log('Android WiFi過濾:', item.SSID, '頻率:', item.frequency, '是否5G:', is5G, '是否有效:', isValidWifi);
                                return isValidWifi;
                            });
                        }
                        
                        console.log('過濾後的WiFi列表:', wifiList);
                        resolve(wifiList);
                    });
                },
                fail: (error) => {
                    console.error('獲取WiFi列表失敗:', error);
                    
                    // 根據錯誤碼提供具體的解決方案
                    let errorMessage = '獲取WiFi列表失敗';
                    if (error.errCode === 12005) {
                        errorMessage = 'WiFi功能被禁用，请在手机设置中开放WiFi';
                    } else if (error.errCode === 12006) {
                        errorMessage = '请先打开手机WiFi开关并授权位置信息';
                    }
                    
                    // 只記錄錯誤，不顯示提示框，讓調用方處理
                    console.log('WiFi列表獲取失敗，錯誤信息:', errorMessage);
                    
                    reject(error);
                }
            });
        });
    }

    /**
     * 通過SSID名稱判斷是否為5G WiFi
     */
    is5GWifiBySSID(ssid) {
        if (!ssid) return false;
        
        const ssidUpper = ssid.toUpperCase();
        
        // 常見的5G WiFi後綴
        const fiveGSuffixes = [
            '-5G', '_5G', '5G', '-5GHZ', '_5GHZ', '5GHZ',
            '-5G-', '_5G_', '-5G_', '_5G-',
            '5G_WIFI', '5G-WIFI', '_5G_WIFI', '-5G-WIFI'
        ];
        
        // 檢查是否包含5G後綴
        for (const suffix of fiveGSuffixes) {
            if (ssidUpper.includes(suffix)) {
                console.log('檢測到5G WiFi後綴:', suffix, '在SSID:', ssid);
                return true;
            }
        }
        
        // 檢查是否包含特定關鍵詞
        const fiveGKeywords = ['5G', '5GHZ', 'FIVE_G', 'FIVE-G'];
        for (const keyword of fiveGKeywords) {
            if (ssidUpper.includes(keyword)) {
                console.log('檢測到5G關鍵詞:', keyword, '在SSID:', ssid);
                return true;
            }
        }
        
        console.log('SSID未檢測到5G標識:', ssid);
        return false;
    }

    /**
     * 檢查WiFi狀態
     */
    async checkWifiStatus() {
        try {
            const res = await this.getConnectedWifi();
            console.log('當前連接的WiFi:', res.wifi);
            
            // 檢查是否有有效的WiFi連接
            if (!res.wifi || !res.wifi.SSID) {
                console.log('未檢測到有效的WiFi連接');
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
            
            console.log('WiFi狀態檢查結果:', {
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
            console.error('檢查WiFi狀態失敗:', error);
            return {
                isConnected: false,
                wifiName: '',
                is5G: false
            };
        }
    }

    /**
     * 處理iOS 5G WiFi提示
     */
    handleIOS5GWifi() {
        console.log('处理 iOS 5G WiFi 提示');
        
        // 顯示步驟提示，不嘗試跳轉設置
        wx.showModal({
            title: '溫馨提示',
            content: '当前连接的是5G WiFi，仅支持2.4G WiFi。\n\n请按以下步骤操作：\n1. 打开手机设置\n2. 选择"无线局域网"\n3. 选择非5G WiFi网络\n4. 返回小程序',
            confirmText: '知道了',
            showCancel: false
        });
    }

    /**
     * 處理Android 5G WiFi提示
     */
    handleAndroid5GWifi() {
        console.log('处理Android 5G WiFi 提示');
        
        wx.showModal({
            title: '溫馨提示',
            content: '当前链接的是5G WiFi，仅支持2.4G WiFi，请切换到2.4G WiFi网络。',
            confirmText: '知道了',
            showCancel: false
        });
    }

    /**
     * 開始WiFi狀態檢測
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
        }, 3000); // 每3秒檢查一次
    }

    /**
     * 清除WiFi狀態檢測
     */
    clearWifiStatusCheck() {
        if (this.wifiStatusCheckTimer) {
            clearInterval(this.wifiStatusCheckTimer);
            this.wifiStatusCheckTimer = null;
        }
    }
}

module.exports = WifiManager; 