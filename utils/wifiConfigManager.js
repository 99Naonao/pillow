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

        if (!this.page.data.connectedDeviceId) {
            wx.showToast({ title: '请先连接蓝牙设备', icon: 'none' });
            return;
        }

        try {
            console.log('开始发送Good Sleep配网指令');
            
            // 显示加载提示
            wx.showLoading({ title: 'Wi-Fi连接中...', mask: true });
            
            // 构建Good Sleep配网指令 - 使用图片中的格式
            const wifiConfig = {
                ssid: this.page.data.wifiName,
                password: this.page.data.wifiPassword
            };
            
            console.log('WiFi配置信息:', wifiConfig);
            
            // 发送配网指令到Good Sleep设备
            const success = await this._sendGoodSleepWifiConfig(wifiConfig);
            
            if (success) {
                wx.showToast({ title: '配网指令已发送', icon: 'success' });
                
                // 更新步骤状态 - 不直接进入第三步，等待配网结果
                this.page.setData({
                    stepsCompleted: [true, true, false],
                    currentTab: 1, // 保持在第二步
                    isConfiguring: true // 标记正在配网中
                });
                
                // 开始监听设备配网结果
                this._startGoodSleepWifiConfigListener();
                
                // 设置配网超时处理
                // this._setWifiConfigTimeout();
                
            } else {
                wx.hideLoading();
                wx.showToast({ title: '发送失败', icon: 'none' });
            }
            
        } catch (error) {
            wx.hideLoading();
            console.error('发送Good Sleep配网指令失败:', error);
            wx.showToast({ title: '发送失败', icon: 'none' });
        }
    }

    /**
     * 发送Good Sleep WiFi配网指令
     */
    async _sendGoodSleepWifiConfig(wifiConfig) {
        try {
            const { connectedDeviceId, serviceId, send_characteristicId } = this.page.data;
            
            if (!connectedDeviceId || !serviceId || !send_characteristicId) {
                console.error('缺少必要的蓝牙连接信息');
                return false;
            }
            
            // 构建Good Sleep配网指令数据 - 使用图片中的格式
            const commandData = this._buildGoodSleepWifiConfigCommand(wifiConfig);
            console.log('Good Sleep配网指令数据:', commandData);
            
            // 通过蓝牙发送配网指令
            const success = await this._writeBLECharacteristicValue(
                connectedDeviceId,
                serviceId,
                send_characteristicId,
                commandData
            );
            
            return success;
            
        } catch (error) {
            console.error('发送Good Sleep WiFi配网指令失败:', error);
            return false;
        }
    }

    /**
     * 构建Good Sleep WiFi配网指令 - 使用图片中的格式
     */
    _buildGoodSleepWifiConfigCommand(wifiConfig) {
        try {
            // Good Sleep WIFI ID:"WiFi名称","WiFi密码"
            const command = `Good Sleep WIFI ID:"${wifiConfig.ssid}","${wifiConfig.password}"`;
            
            // 使用stringToBytes函数转换为字节数组
            const commandBuffer = this._stringToArrayBuffer(command);
            
            console.log('Good Sleep配网指令:', command);
            console.log('指令数据长度:', commandBuffer.byteLength);
            
            return commandBuffer;
            
        } catch (error) {
            console.error('构建Good Sleep配网指令失败:', error);
            throw error;
        }
    }

    /**
     * 字符串转ArrayBuffer - 小程序兼容方式
     */
    _stringToArrayBuffer(str) {
        try {
            // 检查是否有TextEncoder
            if (typeof TextEncoder !== 'undefined') {
                const encoder = new TextEncoder();
                return encoder.encode(str);
            } else {
                // 小程序环境下的兼容处理
                const array = new Uint8Array(str.length);
                for (let i = 0; i < str.length; i++) {
                    array[i] = str.charCodeAt(i);
                }
                return array.buffer;
            }
        } catch (error) {
            console.error('字符串转ArrayBuffer失败:', error);
            throw error;
        }
    }

    /**
     * 写入蓝牙特征值
     */
    _writeBLECharacteristicValue(deviceId, serviceId, characteristicId, value) {
        return new Promise((resolve, reject) => {
            console.log('开始写入蓝牙特征值:', {
                deviceId,
                serviceId,
                characteristicId,
                valueLength: value.byteLength
            });
            
            wx.writeBLECharacteristicValue({
                deviceId,
                serviceId,
                characteristicId,
                value,
                success: (res) => {
                    console.log('蓝牙特征值写入成功:', res);
                    resolve(true);
                },
                fail: (err) => {
                    console.error('蓝牙特征值写入失败:', err);
                    reject(err);
                }
            });
        });
    }

    /**
     * 开始监听Good Sleep WiFi配网结果
     */
    _startGoodSleepWifiConfigListener() {
        try {
            const { connectedDeviceId, serviceId, notify_cId } = this.page.data;
            
            if (!connectedDeviceId || !serviceId || !notify_cId) {
                console.error('缺少通知特征值信息，无法监听配网结果');
                return;
            }
            
            // 启用通知
            wx.notifyBLECharacteristicValueChange({
                deviceId: connectedDeviceId,
                serviceId: serviceId,
                characteristicId: notify_cId,
                state: true,
                success: (res) => {
                    console.log('启用蓝牙通知成功:', res);
                    
                    // 监听特征值变化
                    wx.onBLECharacteristicValueChange((res) => {
                      console.log("特征值变化返回值",res);
                      console.log("当前连接的设备id",connectedDeviceId)
                        if (res.deviceId === connectedDeviceId) {
                            this._handleGoodSleepWifiConfigResult(res.value);
                        }
                    });
                    
                },
                fail: (err) => {
                    console.error('启用蓝牙通知失败:', err);
                }
            });
            
        } catch (error) {
            console.error('启动Good Sleep WiFi配网结果监听失败:', error);
        }
    }

    /**
     * 处理Good Sleep WiFi配网结果 - 根据图片中的状态码
     */
    _handleGoodSleepWifiConfigResult(value) {
        try {
            // 清除配网超时
            this._clearWifiConfigTimeout();
            
            // 将ArrayBuffer转换为字符串 - 使用小程序兼容的方式
            const result = this._arrayBufferToString(value); 
            console.log('收到Good Sleep设备配网结果:', value);
            console.log('配网结果原始数据:', Array.from(new Uint8Array(value)));

            // 检查是否是状态码响应（55 AA 55 AA开头）
            if (this._isStatusResponse(value)) {
                this._handleStatusResponse(value);
                return;
            }
            
            // 解析Good Sleep配网结果
            // if (result.includes('GOODSLEEP_WIFI_SUCCESS')) {
            //     wx.hideLoading();
            //     wx.showToast({ title: '配网成功', icon: 'success' });
            //     this.page.setData({
            //         stepsCompleted: [true, true, true],
            //         currentTab: 2,
            //         isConfiguring: false
            //     });
            // } else if (result.includes('GOODSLEEP_WIFI_FAILED')) {
            //     // 配网失败时不显示弹窗，继续等待
            //     console.log('配网失败，继续等待设备响应...');
            //     // 重新设置配网超时，继续等待
            //     this._setWifiConfigTimeout();
            // } else if (result.includes('GOODSLEEP_WIFI_CONNECTING')) {
            //     wx.showToast({ title: '正在连接WiFi...', icon: 'loading' });
            // } else if (result.includes('GOODSLEEP_WIFI_TIMEOUT')) {
            //     // 配网超时时不显示弹窗，继续等待
            //     console.log('配网超时，继续等待设备响应...');
            //     // 重新设置配网超时，继续等待
            //     this._setWifiConfigTimeout();
            // }
            
        } catch (error) {
            console.error('处理Good Sleep WiFi配网结果失败:', error);
        }
    }

    /**
     * ArrayBuffer转字符串 - 小程序兼容方式
     */
    _arrayBufferToString(buffer) {
        try {
            // 检查是否有TextDecoder
            if (typeof TextDecoder !== 'undefined') {
                const decoder = new TextDecoder("utf-8");
                return decoder.decode(buffer);
            } else {
                // 小程序环境下的兼容处理
                const uint8Array = new Uint8Array(buffer);
                let result = '';
                for (let i = 0; i < uint8Array.length; i++) {
                    result += String.fromCharCode(uint8Array[i]);
                }
                return result;
            }
        } catch (error) {
            console.error('ArrayBuffer转字符串失败:', error);
            return '';
        }
    }

    /**
     * 检查是否是状态码响应
     */
    _isStatusResponse(value) {
        try {
            const uint8Array = new Uint8Array(value);
            // 检查是否以 55 AA 55 AA 开头
            return uint8Array.length >= 4 && 
                   uint8Array[0] === 0x55 && 
                   uint8Array[1] === 0xAA && 
                   uint8Array[2] === 0x55 && 
                   uint8Array[3] === 0xAA;
        } catch (error) {
            return false;
        }
    }

    /**
     * 处理状态码响应 - 根据图片中的状态码
     */
    _handleStatusResponse(value) {
        try {
            const uint8Array = new Uint8Array(value);
            const statusCode = uint8Array[uint8Array.length - 1]; // 最后一个字节是状态码
            
            console.log('收到状态码响应:', statusCode);
            console.log('状态码十六进制:', '0x' + statusCode.toString(16));

            switch (statusCode) {
                case 0x01: // WIFI 连接上
                    console.log('WiFi已连接');
                    break;
                case 0x03: // WIFI 连接失败
                    // 配网失败时不显示弹窗，继续等待
                    console.log('WiFi连接失败，继续等待设备响应...');
                    // 重新设置配网超时，继续等待
                    // this._setWifiConfigTimeout();
                    break;
                case 0x04: // WIFI 连接成功,TCP连接成功
                    wx.hideLoading();
                    wx.showToast({ title: '配网成功', icon: 'success' });
                    this.page.setData({
                        stepsCompleted: [true, true, true],
                        currentTab: 2,
                        isConfiguring: false
                    });
                    break;
                case 0x05: // TCP连接断开
                    console.log('网络连接断开');
                    break;
                case 0x06: // WIFI 连接断开
                    console.log('WiFi连接断开');
                    break;
                case 0x07: // 不在床
                    console.log('检测到离床');
                    break;
                default:
                    console.log('未知状态码:', statusCode);
                    break;
            }
            
        } catch (error) {
            console.error('处理状态码响应失败:', error);
        }
    }

    /**
     * 清除配网超时定时器
     */
    _clearWifiConfigTimeout() {
        if (this.wifiConfigTimeout) {
            clearTimeout(this.wifiConfigTimeout);
            this.wifiConfigTimeout = null;
            console.log('配网超时定时器已清除');
        }
    }

    /**
     * 设置配网超时处理
     */
    _setWifiConfigTimeout() {
        // 清除之前的超时定时器
        this._clearWifiConfigTimeout();
        // 10秒后如果还没有收到配网结果，继续等待
        this.wifiConfigTimeout = setTimeout(() => {
            console.log('Good Sleep配网超时，未收到设备响应，继续等待...');
            // 重新设置配网超时，继续等待
            this._setWifiConfigTimeout();
        }, 15000); // 10秒超时
    }

    /**
     * 手动停止配网
     */
    stopWifiConfig() {
        console.log('手动停止配网');
        this._clearWifiConfigTimeout();
        wx.hideLoading();
        this.page.setData({ isConfiguring: false });
        wx.showToast({ title: '已停止配网', icon: 'none' });
    }

    /**
     * 清除WiFi状态检测
     */
    clearWifiStatusCheck() {
        this.wifiManager.clearWifiStatusCheck();
        
        // 清除配网超时
        this._clearWifiConfigTimeout();
        
        // 取消蓝牙特征值变化监听
        wx.offBLECharacteristicValueChange();
        
        // 重置配网状态
        if (this.page && this.page.setData) {
            this.page.setData({ isConfiguring: false });
        }
    }
}

module.exports = WifiConfigManager; 