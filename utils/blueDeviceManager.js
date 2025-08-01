/**
 * 蓝牙设备管理模块
 */
const BluetoothManager = require('./bluetoothManager');

class BlueDeviceManager {
    constructor(page) {
        this.page = page;
        this.bluetoothManager = new BluetoothManager();
    }

    /**
     * 搜索蓝牙设备
     */
    async searchBluetoothDevices(callback) {
        const { data } = this.page;
        
        // 如果正在搜索，直接返回
        if (data.isSearching) {
            console.log('正在搜索中，跳过重复搜索');
            if (callback) callback();
            return;
        }
        
        this.page.setData({ isSearching: true });
        
        try {
            await this.bluetoothManager.searchBluetoothDevices((devices) => {
                console.log('搜索到的所有设备:', devices);
                
                // 检查设备数组是否为空
                if (!devices || devices.length === 0) {
                    console.log('没有搜索到任何设备');
                    if (callback) callback();
                    return;
                }
                
                // 过滤和处理设备列表
                const filteredDevices = this._filterDevices(devices);
                const devicesWithStatus = this._addConnectionStatus(filteredDevices);
                const finalDevices = this._mergeDevices(devicesWithStatus);
                
                this.page.setData({
                    devices: finalDevices,
                    isSearching: false
                });
                
                if (callback) callback();
            });
        } catch (error) {
            console.error('搜索蓝牙设备失败:', error);
            this.page.setData({ isSearching: false });
            wx.showToast({ title: '搜索设备失败', icon: 'none' });
        }
    }

    /**
     * 过滤设备
     */
    _filterDevices(devices) {
        return devices.filter(device => {
            const hasName = device.name && device.name.length > 0;
            const containsGoodsleep = device.name && device.name.includes('GOODSLEEP');
            
            console.log('设备过滤检查:', {
                deviceName: device.name,
                hasName: hasName,
                containsGoodsleep: containsGoodsleep,
                deviceId: device.deviceId,
                uuid: device.uuid
            });
            
            return hasName && containsGoodsleep;
        });
    }

    /**
     * 添加连接状态
     */
    _addConnectionStatus(filteredDevices) {
        return filteredDevices.map(device => {
            const deviceId = device.deviceId || device.uuid;
            console.log('处理设备ID:', {
                originalDeviceId: device.deviceId,
                uuid: device.uuid,
                finalDeviceId: deviceId,
                deviceName: device.name
            });
            
            return {
                ...device,
                deviceId: deviceId,
                isConnected: deviceId === this.page.data.connectedDeviceId
            };
        });
    }

    /**
     * 合并设备列表，去重
     */
    _mergeDevices(devicesWithStatus) {
        const existingDevices = this.page.data.devices || [];
        console.log('现有设备列表:', existingDevices.map(d => ({ deviceId: d.deviceId, name: d.name })));
        console.log('新搜索到的设备:', devicesWithStatus.map(d => ({ deviceId: d.deviceId, name: d.name })));
        
        // 使用Map来确保设备ID的唯一性
        const deviceMap = new Map();
        
        // 先添加现有设备
        existingDevices.forEach(device => {
            deviceMap.set(device.deviceId, device);
        });
        
        // 添加新设备，如果已存在则更新
        devicesWithStatus.forEach(device => {
            deviceMap.set(device.deviceId, device);
        });
        
        const finalDevices = Array.from(deviceMap.values());
        console.log('去重后的设备列表:', finalDevices.map(d => ({ deviceId: d.deviceId, name: d.name })));
        
        return finalDevices;
    }

    /**
     * 连接蓝牙设备
     */
    async connectBluetooth(deviceId) {
        const device = this.page.data.devices.find(d => d.deviceId === deviceId);
        
        try {
            const result = await this.bluetoothManager.connectBluetooth(deviceId, device);
            
            // 连接成功后，获取服务和特征值来确认连接
            await this._getServiceAndCharacteristics(deviceId);
            
            // 只有在真正连接成功后才保存设备信息到本地
            wx.setStorageSync('connectedDevice', {
                deviceId: deviceId,
                name: device ? device.name : ''
            });
            
            // 获取设备的advertisServiceUUIDs并转换为WiFi MAC地址
            const advertisServiceUUIDs = device ? device.advertisServiceUUIDs : null;
            console.log('设备的advertisServiceUUIDs:', advertisServiceUUIDs);
            
            // 将UUID转换为MAC地址格式
            const bluetoothMac = this.page.UuidConverter.convertUUIDToMacFormat(deviceId, advertisServiceUUIDs);
            console.log('UUID转换为蓝牙MAC地址:', deviceId, '->', bluetoothMac);
            
            const wifiMacAddress = this.page.commonUtil.converAndSaveMac(bluetoothMac);
            if (wifiMacAddress) {
                this.page.setData({ wifiMac: wifiMacAddress });
                console.log('已保存WiFi MAC地址：', wifiMacAddress);
            } else {
                console.log('WiFi MAC地址转换失败，蓝牙MAC:', bluetoothMac);
            }
            
            // 更新设备状态，标记为已连接
            const updatedDevices = this.page.data.devices.map(device => ({
                ...device,
                isConnected: device.deviceId === deviceId
            }));
            
            console.log('连接成功后更新设备状态:', updatedDevices.map(d => ({ 
                deviceId: d.deviceId, 
                name: d.name, 
                isConnected: d.isConnected 
            })));
            
            this.page.setData({
                devices: updatedDevices,
                connectedDeviceId: deviceId,
                stepsCompleted: [true, false, false],
                currentTab: 1,
                // 重置WiFi相关状态
                wifiSelected: false,
                showWifiList: false,
                wifiName: '',
                wifiPassword: '',
                isWifiConnected: false,
                is5GConnected: false,
                // 重置错误处理标记
                _isShowingWifiError: false
            });
            
            // 获取服务和特征值
            await this._getServiceAndCharacteristics(deviceId);
            
            // 初始化WiFi步骤
            console.log('开始初始化WiFi步骤');
            await this.page.wifiConfigManager.initWifiStep();
            
        } catch (error) {
            console.error('连接蓝牙设备失败:', error);
            wx.showToast({ title: '连接失败', icon: 'none' });
        }
    }

    /**
     * 获取服务和特征值
     */
    async _getServiceAndCharacteristics(deviceId) {
        try {
            const result = await this.bluetoothManager.getServiceAndCharacteristics(deviceId);
            
            // 处理特征值
            const characteristics = result.characteristics;
            let sendCharacteristic = null;
            let notifyCharacteristic = null;
            
            for (const characteristic of characteristics) {
                const uuid = characteristic.uuid.toUpperCase();
                if (uuid.includes('6E400002') || characteristic.properties.write) {
                    sendCharacteristic = characteristic;
                }
                if (uuid.includes('6E400003') || characteristic.properties.notify) {
                    notifyCharacteristic = characteristic;
                }
            }
            
            if (sendCharacteristic && notifyCharacteristic) {
                this.page.setData({
                    serviceId: result.serviceId,
                    send_characteristicId: sendCharacteristic.uuid,
                    notify_cId: notifyCharacteristic.uuid,
                    convertedSendId: this.page.UuidConverter.convertUUIDToMacFormat(sendCharacteristic.uuid),
                    convertedNotifyId: this.page.UuidConverter.convertUUIDToMacFormat(notifyCharacteristic.uuid)
                });
                
                console.log('特征值处理完成:', {
                    serviceId: result.serviceId,
                    sendId: sendCharacteristic.uuid,
                    notifyId: notifyCharacteristic.uuid
                });
            }
            
        } catch (error) {
            console.error('获取服务和特征值失败:', error);
        }
    }

    /**
     * 断开蓝牙连接
     */
    async disconnectBluetooth(deviceId) {
        if (deviceId) {
            try {
                await this.bluetoothManager.disconnectBluetooth(deviceId);
                console.log('蓝牙连接已断开');
            } catch (error) {
                console.error('断开蓝牙连接失败:', error);
            }
        }
    }

    /**
     * 检查设备连接状态
     */
    async checkDeviceConnectionStatus(deviceId) {
        try {
            const servicesRes = await this.bluetoothManager.getBLEDeviceServices(deviceId);
            console.log('设备连接状态检查成功，deviceId:', deviceId);
            return true;
        } catch (error) {
            console.log('设备连接状态检查失败，deviceId:', deviceId, '错误:', error);
            return false;
        }
    }

    /**
     * 更新设备连接状态
     */
    updateDeviceConnectionStatus() {
        if (this.page.data.devices.length > 0) {
            const updatedDevices = this.page.data.devices.map(device => ({
                ...device,
                isConnected: device.deviceId === this.page.data.connectedDeviceId
            }));
            
            console.log('更新设备连接状态:', {
                connectedDeviceId: this.page.data.connectedDeviceId,
                devices: updatedDevices.map(d => ({ deviceId: d.deviceId, isConnected: d.isConnected }))
            });
            
            this.page.setData({
                devices: updatedDevices
            });
        }
    }

    /**
     * 启动蓝牙连接监听
     */
    startBluetoothConnectionListener() {
        this.bluetoothManager.startBluetoothConnectionListener();
    }

    /**
     * 停止蓝牙连接监听
     */
    stopBluetoothConnectionListener() {
        this.bluetoothManager.stopBluetoothConnectionListener();
    }
}

module.exports = BlueDeviceManager; 