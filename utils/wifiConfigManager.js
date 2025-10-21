/**
 * WiFi配置管理模块
 */
const WifiManager = require('./wifiManager');

// 引用airkiss插件
const airkiss = requirePlugin('airkiss');

class WifiConfigManager {
    constructor(page) {
        this.page = page;
        this.wifiManager = new WifiManager();
        this.airkissManager = null; // 延迟初始化airkiss
    }

    /**
     * 判断设备类型
     * @returns {string} 'old' 旧设备, 'new' 新设备
     */
    _getDeviceType() {
        const connectedDevice = this.page.data.devices?.find(d => d.deviceId === this.page.data.connectedDeviceId);
        const deviceName = connectedDevice?.name || '';
        
        if (deviceName.startsWith('GoodSleep')) {
            console.log('检测到新设备:', deviceName);
            return 'new';
        } else if (deviceName.startsWith('GOODSLEEP')) {
            console.log('检测到旧设备:', deviceName);
            return 'old';
        } else {
            console.log('未知设备类型，默认使用旧设备配网:', deviceName);
            return 'old';
        }
    }

    /**
     * 初始化airkiss管理器
     */
    _initAirkissManager() {
        if (!this.airkissManager) {
            try {
                // 检查airkiss插件是否可用
                if (!airkiss) {
                    console.error('airkiss插件未找到，请检查插件配置');
                    return null;
                }
                
                this.airkissManager = airkiss;
                console.log('airkiss管理器初始化成功');
            } catch (error) {
                console.error('airkiss管理器初始化失败:', error);
                console.error('请确保：');
                console.error('1. 在微信开发者工具中已安装airkiss插件');
                console.error('2. project.config.json和app.json中已正确配置插件');
                console.error('3. 微信开发者工具版本支持插件功能');
                this.airkissManager = null;
            }
        }
        return this.airkissManager;
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
    async sendWifiConfig(wifiConfig = null) {
        // 进入新的配网流程前，先清理所有旧的超时定时器
        this._clearWifiConfigTimeout();
        if (this._airkissTimeout) {
            clearTimeout(this._airkissTimeout);
            this._airkissTimeout = null;
            console.log('清理历史 airkiss 超时定时器');
        }

        // 如果没有传入WiFi配置，使用页面数据
        const config = wifiConfig || {
            ssid: this.page.data.wifiName,
            password: this.page.data.wifiPassword
        };
        
        if (!config.password) {
            wx.showToast({ title: '请输入WiFi密码', icon: 'none' });
            return;
        }

        if (!this.page.data.connectedDeviceId) {
            wx.showToast({ title: '请先连接蓝牙设备', icon: 'none' });
            return;
        }

        try {
            console.log('开始发送配网指令');
            
            // 判断设备类型
            const deviceType = this._getDeviceType();
            console.log('设备类型:', deviceType);
            
            // 显示加载提示
            wx.showLoading({ title: 'Wi-Fi连接中...', mask: true });
            
            // 构建WiFi配置信息
            const wifiConfigInfo = {
                ssid: config.ssid,
                password: config.password
            };
            
            console.log('WiFi配置信息:', wifiConfigInfo);
            
            let success = false;
            
            if (deviceType === 'old') {
                // 旧设备：使用Good Sleep配网指令
                console.log('使用旧设备配网方式');
                success = await this._sendGoodSleepWifiConfig(wifiConfigInfo);
            } else if (deviceType === 'new') {
                // 新设备：使用airkiss配网
                console.log('使用新设备airkiss配网方式');
                try {
                    success = await this._sendAirkissWifiConfig(wifiConfigInfo);
                } catch (airkissError) {
                    console.error('airkiss配网出现异常:', airkissError);
                }
            }
            
            if (success) {
                wx.showToast({ title: '配网指令已发送', icon: 'success' });
                
                // 更新步骤状态 - 不直接进入第三步，等待配网结果
                this.page.setData({
                    stepsCompleted: [true, true, false],
                    currentTab: 1, // 保持在第二步
                    isConfiguring: true // 标记正在配网中
                });
                
                // 开始监听设备配网结果
                if (deviceType === 'old') {
                    this._startGoodSleepWifiConfigListener();
                } else {
                    this._startAirkissWifiConfigListener();
                }
                
                // 设置配网超时处理
                this._setWifiConfigTimeout();
                
            } else {
                wx.hideLoading();
                wx.showToast({ title: '发送失败', icon: 'none' });
                // 配网发送失败则回到第一步，断开蓝牙连接，保留密码
                this._resetToFirstStep();
            }
            
        } catch (error) {
            wx.hideLoading();
            console.error('发送Good Sleep配网指令失败:', error);
            wx.showToast({ title: '发送失败', icon: 'none' });
            this._resetToFirstStep();
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
            
            // 构建Good Sleep配网指令数据
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
     * 构建Good Sleep WiFi配网指令
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
                    
                    // 清除配网超时定时器
                    this._clearWifiConfigTimeout();
                    
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
        
        // 设置总超时时间（60秒）
        this.wifiConfigTimeout = setTimeout(() => {
            console.log('配网总超时（60秒），停止配网');
            wx.hideLoading();
            wx.showToast({ title: '配网超时', icon: 'none' });
            
            // 停止所有配网相关操作
            this.stopWifiConfig();
            
            // 回到第一步
            this._resetToFirstStep();
        }, 60000); // 60秒总超时
        
        console.log('配网超时定时器已设置（60秒）');
    }

    /**
     * 手动停止配网
     */
    stopWifiConfig() {
        console.log('手动停止配网');
        this._clearWifiConfigTimeout();
        
        // 停止airkiss配网
        this.stopAirkissConfig();
        
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

    /**
     * 发送airkiss WiFi配网
     */
    _sendAirkissWifiConfig(wifiConfig) {
        try {
            const airkissManager = this._initAirkissManager();
            if (!airkissManager) {
                console.error('airkiss管理器初始化失败');
                return false;
            }
            
            console.log('开始airkiss配网:', wifiConfig);
            
            // 验证WiFi配置数据
            if (!wifiConfig.ssid || !wifiConfig.password) {
                console.error('WiFi配置数据不完整');
                return false;
            }
                      
            // 初始化WiFi
            // this._initWifiForAirkiss().catch(wifiError => {
            //     console.warn('WiFi初始化失败，继续尝试配网:', wifiError);
            // });
            
            // 使用airkiss发送WiFi配置
            return this._sendAirkissWifiCredentials(wifiConfig).then(configResult => {
                if (!configResult) {
                    console.error('airkiss WiFi配置发送失败');
                    return false;
                }
                
                console.log('airkiss配网指令发送成功');
                return true;
            });
            
        } catch (error) {
            console.error('发送airkiss WiFi配网失败:', error);
            return false;
        }
    }

    /**
     * 初始化WiFi（参考安信可示例）
     */
    async _initWifiForAirkiss() {
        return new Promise((resolve, reject) => {
            wx.startWifi({
                success: (res) => {
                    console.log('WiFi初始化成功:', res.errMsg);
                    resolve(res);
                },
                fail: (res) => {
                    console.warn('WiFi初始化失败:', res);
                    reject(res);
                }
            });
        });
    }

    /**
     * 停止airkiss配网
     */
    stopAirkissConfig() {
        try {
            const airkissManager = this._initAirkissManager();
            if (airkissManager && airkissManager.stopAirkiss) {
                airkissManager.stopAirkiss();
                console.log('airkiss配网已停止');
            }
            
            // 清理定时器
            if (this._airkissTimeout) {
                clearTimeout(this._airkissTimeout);
                this._airkissTimeout = null;
            }
        } catch (error) {
            console.error('停止airkiss配网失败:', error);
        }
    }


    /**
     * 发送airkiss WiFi凭据
     */
    async _sendAirkissWifiCredentials(wifiConfig) {
        try {
            const airkissManager = this._initAirkissManager();
            if (!airkissManager) {
                console.error('airkiss管理器未初始化');
                return false;
            }
            
            console.log('发送airkiss WiFi凭据:', wifiConfig);
            
            // 验证WiFi配置数据格式
            if (!this._validateWifiConfigData(wifiConfig)) {
                console.error('WiFi配置数据格式无效');
                return false;
            }
            
            // 使用airkiss插件发送WiFi配置
            return new Promise((resolve) => {
                try {
                    console.log('调用airkiss.startAirkiss:', wifiConfig.ssid, wifiConfig.password);
                    airkissManager.startAirkiss(
                        wifiConfig.ssid,
                        wifiConfig.password,
                        (res) => {
                            try {
                                console.log('airkiss 回调结果:', res);
                                wx.hideLoading();
                                
                                switch (res.code) {
                                    case 0:
                                        wx.showModal({
                                            title: '初始化失败',
                                            content: res.result,
                                            showCancel: false,
                                            confirmText: '收到',
                                        });
                                        resolve(false);
                                        break;
                                    case 1:
                                        // 清除配网超时定时器
                                        this._clearWifiConfigTimeout();
                                        
                                        // 更新页面状态
                                        if (this.page && this.page.setData) {
                                            this.page.setData({
                                                stepsCompleted: [true, true, true],
                                                currentTab: 2,
                                                isConfiguring: false
                                            });
                                        }
                                        // wx.showModal({
                                        //     title: '配网成功',
                                        //     content: '设备IP：' + res.ip + '\r\n 设备Mac：' + res.bssid,
                                        //     showCancel: false,
                                        //     confirmText: '好的',
                                        // });
                                        resolve(true);
                                        break;
                                    case 2:
                                        wx.showModal({
                                            title: '配网失败',
                                            content: '请检查密码是否正确',
                                            showCancel: false,
                                            confirmText: '收到',
                                        });
                                        this._resetToFirstStep();
                                        resolve(false);
                                        break;
                                    default:
                                        console.warn('airkiss 未知回调:', res);
                                        resolve(false);
                                        break;
                                }
                            } catch (cbErr) {
                                console.error('airkiss 回调处理异常:', cbErr);
                                wx.hideLoading();
                                resolve(false);
                            }
                        }
                    );
                } catch (callErr) {
                    console.error('调用 airkiss.startAirkiss 异常:', callErr);
                    resolve(false);
                }
            });
            
        } catch (error) {
            console.error('发送airkiss WiFi凭据失败:', error);
            return false;
        }
    }

    /**
     * 验证WiFi配置数据
     */
    _validateWifiConfigData(wifiConfig) {
        try {
            if (!wifiConfig || typeof wifiConfig !== 'object') {
                console.error('WiFi配置不是有效对象');
                return false;
            }
            
            if (!wifiConfig.ssid || typeof wifiConfig.ssid !== 'string') {
                console.error('SSID无效');
                return false;
            }
            
            if (!wifiConfig.password || typeof wifiConfig.password !== 'string') {
                console.error('密码无效');
                return false;
            }
            
            // 检查SSID和密码长度
            if (wifiConfig.ssid.length === 0 || wifiConfig.ssid.length > 32) {
                console.error('SSID长度无效:', wifiConfig.ssid.length);
                return false;
            }
            
            if (wifiConfig.password.length === 0 || wifiConfig.password.length > 63) {
                console.error('密码长度无效:', wifiConfig.password.length);
                return false;
            }
            
            // 检查是否包含特殊字符
            const ssidValid = /^[a-zA-Z0-9\-_]+$/.test(wifiConfig.ssid);
            if (!ssidValid) {
                console.warn('SSID包含特殊字符，可能导致配网问题');
            }
            
            console.log('WiFi配置数据验证通过');
            return true;
            
        } catch (error) {
            console.error('WiFi配置数据验证失败:', error);
            return false;
        }
    }

    /**
     * 开始airkiss配网监听
     */
    _startAirkissWifiConfigListener() {
        try {
            const airkissManager = this._initAirkissManager();
            if (!airkissManager) {
                console.error('airkiss管理器未初始化');
                return;
            }
                      
            // 启动前先清理旧的 airkiss 超时定时器
            if (this._airkissTimeout) {
                clearTimeout(this._airkissTimeout);
                this._airkissTimeout = null;
                console.log('启动前清理旧的 airkiss 超时定时器');
            }

            // 设置配网超时检查（与总超时时间协调）
            this._airkissTimeout = setTimeout(() => {
                console.log('airkiss配网超时');
                wx.hideLoading();
                wx.showToast({ title: '配网超时', icon: 'none' });
                this._resetToFirstStep();
            }, 50000); // 50秒超时，比总超时时间短10秒
                        
            console.log('airkiss配网监听已启动');
            
        } catch (error) {
            console.error('启动airkiss配网监听失败:', error);
        }
    }

    /**
     * 重置到第一步：断开蓝牙连接，保留密码信息
     */
    _resetToFirstStep() {
        try {
            // 断开当前蓝牙连接
            if (this.page && this.page.data.connectedDeviceId) {
                console.log('配网失败，断开蓝牙连接:', this.page.data.connectedDeviceId);
                this.page.blueDeviceManager.disconnectBluetooth(this.page.data.connectedDeviceId);
            }
            
            // 清除本地存储的设备信息
            wx.removeStorageSync('connectedDevice');
            
            // 重置页面状态到第一步，保留密码信息
            if (this.page && this.page.setData) {
                this.page.setData({
                    isConfiguring: false,
                    currentTab: 0,
                    stepsCompleted: [false, false, false],
                    connectedDeviceId: '',
                    devices: [],
                    isSearching: false,
                    // 保留密码信息
                    // wifiPassword: this.page.data.wifiPassword, // 密码保持不变
                    // wifiName: this.page.data.wifiName, // WiFi名称保持不变
                    savedWifiConfig: null // 清除保存的WiFi配置
                });
            }
            
            // 重新初始化WiFi步骤
            console.log('配网失败回到第一步，重新初始化WiFi');
            this.initWifiStep();
            
            console.log('已重置到第一步，蓝牙连接已断开，密码信息已保留');
            
        } catch (error) {
            console.error('重置到第一步失败:', error);
        }
    }
}

module.exports = WifiConfigManager; 