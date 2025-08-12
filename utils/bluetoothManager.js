/**
 * 蓝牙管理工具类
 */
class BluetoothManager {
    constructor() {
        this.isPageActive = false;
        this.bluetoothConnectionListener = null;
    }

    /**
     * 安全启动蓝牙设备搜索
     */
    async safeStartBluetoothDevicesDiscovery() {
        try {
            await this.openBluetoothAdapter();
            await this.getBluetoothDevices();
            return true;
        } catch (error) {
            console.error('启动蓝牙设备搜索失败:', error);
            return false;
        }
    }

    /**
     * 搜索蓝牙设备
     */
    async searchBluetoothDevices(callback) {
        console.log('开始搜索蓝牙设备');
        
        try {
            const success = await this.safeStartBluetoothDevicesDiscovery();
            if (!success) {
                throw new Error('启动蓝牙搜索失败');
            }

            // 先获取已发现的设备
            const existingDevicesRes = await this.getBluetoothDevices();
            console.log('已发现的设备:', existingDevicesRes.devices);
            
            if (callback && existingDevicesRes.devices.length > 0) {
                callback(existingDevicesRes.devices);
            }

            // 监听新设备
            wx.onBluetoothDeviceFound((res) => {
                console.log('发现新设备:', res.devices);
                if (callback && res.devices && res.devices.length > 0) {
                    callback(res.devices);
                }
            });

            // 开始搜索
            wx.startBluetoothDevicesDiscovery({
                success: () => {
                    console.log('开始搜索蓝牙设备成功');
                },
                fail: (err) => {
                    console.error('开始搜索蓝牙设备失败:', err);
                    throw err;
                }
            });
        } catch (error) {
            console.error('搜索蓝牙设备失败:', error);
            throw error;
        }
    }

    /**
     * 打开蓝牙适配器
     */
    openBluetoothAdapter() {
        return new Promise((resolve, reject) => {
            wx.openBluetoothAdapter({
                success: resolve,
                fail: reject
            });
        });
    }

    /**
     * 获取蓝牙设备
     */
    getBluetoothDevices() {
        return new Promise((resolve, reject) => {
            wx.getBluetoothDevices({
                success: resolve,
                fail: reject
            });
        });
    }

    /**
     * 停止蓝牙设备搜索
     */
    stopBluetoothDevicesDiscovery() {
        return new Promise((resolve, reject) => {
            wx.stopBluetoothDevicesDiscovery({
                success: resolve,
                fail: reject
            });
        });
    }

    /**
     * 连接蓝牙设备
     */
    connectBluetooth(deviceId, device) {
        return new Promise((resolve, reject) => {
            console.log('准备连接蓝牙设备:', {
                deviceId: deviceId,
                deviceName: device ? device.name : '未知',
                deviceInfo: device
            });

            // 检查deviceId是否有效
            if (!deviceId) {
                const error = new Error('deviceId 不能为空');
                console.error('连接失败:', error);
                reject(error);
                return;
            }

            wx.createBLEConnection({
                deviceId,
                success: () => {
                    console.log('蓝牙连接成功:', deviceId);
                    resolve({ deviceId, device });
                },
                fail: (err) => {
                    console.error('蓝牙连接失败:', err);
                    reject(err);
                }
            });
        });
    }

    /**
     * 获取服务和特征值
     */
    async getServiceAndCharacteristics(deviceId) {
        console.log('获取服务列表，deviceId:', deviceId);
        
        try {
            const servicesRes = await this.getBLEDeviceServices(deviceId);
            console.log('服务列表:', servicesRes.services);
            
            // 选第一个自定义服务或主服务
            const service = servicesRes.services.find(s => 
                s.uuid.toUpperCase().indexOf('6E400001') !== -1 || s.isPrimary
            );
            
            if (!service) {
                throw new Error('未找到合适的服务');
            }

            const serviceId = service.uuid;
            console.log('选中的服务ID:', serviceId);

            const characteristicsRes = await this.getBLEDeviceCharacteristics(deviceId, serviceId);
            console.log('特征值列表:', characteristicsRes.characteristics);

            return {
                serviceId,
                characteristics: characteristicsRes.characteristics
            };
        } catch (error) {
            console.error('获取服务和特征值失败:', error);
            throw error;
        }
    }

    /**
     * 获取蓝牙设备服务
     */
    getBLEDeviceServices(deviceId) {
        return new Promise((resolve, reject) => {
            wx.getBLEDeviceServices({
                deviceId,
                success: resolve,
                fail: reject
            });
        });
    }

    /**
     * 获取蓝牙设备特征值
     */
    getBLEDeviceCharacteristics(deviceId, serviceId) {
        return new Promise((resolve, reject) => {
            wx.getBLEDeviceCharacteristics({
                deviceId,
                serviceId,
                success: resolve,
                fail: reject
            });
        });
    }

    /**
     * 开始蓝牙连接监听
     */
    startBluetoothConnectionListener() {
        if (this.bluetoothConnectionListener) {
            return;
        }

        this.bluetoothConnectionListener = wx.onBLEConnectionStateChange((res) => {
            console.log('蓝牙连接状态变化:', res);
            
            if (!res.connected) {
                console.log('蓝牙设备断开连接:', res.deviceId);
                // 可以在这里处理断开连接的逻辑
            }
        });
    }

    /**
     * 停止蓝牙连接监听
     */
    stopBluetoothConnectionListener() {
        if (this.bluetoothConnectionListener) {
            wx.offBLEConnectionStateChange(this.bluetoothConnectionListener);
            this.bluetoothConnectionListener = null;
        }
    }

    /**
     * 断开蓝牙连接
     */
    disconnectBluetooth(deviceId) {
        return new Promise((resolve, reject) => {
            wx.closeBLEConnection({
                deviceId,
                success: resolve,
                fail: reject
            });
        });
    }
}

module.exports = BluetoothManager; 