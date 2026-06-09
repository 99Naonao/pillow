const { checkWifiAuth, isSystemLocationPermissionError } = require('./permissionUtil');
const CommonUtil = require('./commonUtil');

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
     * 获取已连接的WiFi（需要位置权限，且须先 startWifi）
     */
    async getConnectedWifi() {
        await checkWifiAuth();
        await this.startWifi();
        try {
            return await this._requestConnectedWifi();
        } catch (error) {
            // 部分机型 startWifi 后需短暂同步，12000 时重试一次
            if (Number(error.errCode) === 12000) {
                await this.startWifi();
                return await this._requestConnectedWifi();
            }
            throw error;
        }
    }

    _requestConnectedWifi() {
        return new Promise((resolve, reject) => {
            wx.getConnectedWifi({
                success: resolve,
                fail: (error) => {
                    if (isSystemLocationPermissionError(error)) {
                        console.error('获取WiFi信息需要位置权限:', error);
                        error.type = error.type || 'system_permission';
                    } else if (Number(error.errCode) === 12000) {
                        console.warn('getConnectedWifi 失败：未先 startWifi（应由调用方保证）:', error);
                    }
                    reject(error);
                }
            });
        });
    }

    /**
     * 获取WiFi列表（含超时，避免鸿蒙等平台 onGetWifiList 不回调导致一直 loading）
     * @param {{ timeoutMs?: number }} [options]
     */
    async getWifiList(options = {}) {
        const timeoutMs = options.timeoutMs || 12000;
        await checkWifiAuth();
        await this.startWifi();

        return new Promise((resolve, reject) => {
            let settled = false;
            let timer = null;

            const cleanup = () => {
                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                }
                if (wx.offGetWifiList) {
                    wx.offGetWifiList(onWifiList);
                }
            };

            const finish = (fn, value) => {
                if (settled) return;
                settled = true;
                cleanup();
                fn(value);
            };

            const onWifiList = (listRes) => {
                const systemInfo = wx.getDeviceInfo();
                console.log('[WifiManager] onGetWifiList, platform:', systemInfo.platform);

                let wifiList = [];
                if (CommonUtil.isIOS()) {
                    wifiList = (listRes.wifiList || []).filter(item => {
                        if (!item.SSID) return false;
                        return !this.is5GWifiBySSID(item.SSID);
                    });
                } else {
                    wifiList = (listRes.wifiList || []).filter(item => {
                        if (!item.SSID) return false;
                        const is5G = item.frequency && item.frequency >= 4900;
                        return !is5G;
                    });
                }

                console.log('[WifiManager] 过滤后的WiFi列表数量:', wifiList.length);
                finish(resolve, wifiList);
            };

            timer = setTimeout(() => {
                console.warn('[WifiManager] getWifiList 超时，未收到 onGetWifiList');
                finish(reject, {
                    errCode: -1,
                    errMsg: 'getWifiList:timeout',
                    type: 'wifi_list_timeout'
                });
            }, timeoutMs);

            wx.onGetWifiList(onWifiList);

            wx.getWifiList({
                success: () => {
                    console.log('[WifiManager] getWifiList 请求已发出，等待 onGetWifiList');
                },
                fail: (error) => {
                    console.error('[WifiManager] getWifiList 失败:', error);
                    if (isSystemLocationPermissionError(error)) {
                        error.type = error.type || 'system_permission';
                    }
                    finish(reject, error);
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
            
            if (CommonUtil.isIOS()) {
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
            
            // 处理权限错误（含鸿蒙 errCode 12010）
            if (isSystemLocationPermissionError(error)) {
                console.error('WiFi权限错误，需要位置权限');
                throw {
                    ...error,
                    type: 'system_permission',
                    message: '需要位置权限才能获取WiFi信息'
                };
            }
            
            // iOS WiFi未打开时，抛出错误让上层处理
            const systemInfo = wx.getDeviceInfo();
            const isIOS = CommonUtil.isIOS();
            
            if (isIOS && (error.errno === 1505002)) {
                // iOS WiFi未打开，抛出错误
                throw error;
            }
            
            // 其他情况返回未连接状态
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
            content: '当前连接的是5G WiFi，仅支持2.4G WiFi，请切换到2.4G WiFi网络。',
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