/**
 * 蓝牙管理器 - OximeterDebugger专用
 * 独立实现，不依赖其他工具
 */
class BluetoothManager {
  constructor() {
    this.deviceId = null;
    this.serviceId = null;
    this.characteristicId = null;
    this.connected = false;
    this.protocol = null;

    // 蓝牙状态
    this.bluetoothState = {
      available: false,
      discovering: false
    };

    // 事件回调
    this.callbacks = {};

    this.initBluetoothListener();
  }

  /**
   * 初始化蓝牙监听器
   */
  initBluetoothListener() {
    // 监听蓝牙适配器状态变化
    wx.onBluetoothAdapterStateChange((res) => {
      console.log('蓝牙适配器状态变化:', res);
      this.bluetoothState.available = res.available;
      this.bluetoothState.discovering = res.discovering;

      this.emit('adapterStateChange', res);

      if (!res.available) {
        this.handleBluetoothUnavailable();
      }
    });

    // 监听蓝牙连接状态变化
    wx.onBLEConnectionStateChange((res) => {
      console.log('蓝牙连接状态变化:', res);

      if (res.deviceId === this.deviceId) {
        this.connected = res.connected;

        if (res.connected) {
          this.emit('connected', { deviceId: this.deviceId });
        } else {
          this.handleDisconnection();
        }
      }
    });

    // 监听特征值变化
    wx.onBLECharacteristicValueChange((res) => {
      if (res.deviceId === this.deviceId &&
          res.serviceId === this.serviceId &&
          res.characteristicId === this.characteristicId) {

        console.log('收到特征值数据:', res.value);
        this.handleReceivedData(res.value);
      }
    });
  }

  /**
   * 初始化蓝牙适配器
   * @returns {Promise}
   */
  initAdapter() {
    return new Promise((resolve, reject) => {
      wx.openBluetoothAdapter({
        success: (res) => {
          console.log('蓝牙适配器初始化成功:', res);
          this.bluetoothState.available = true;
          resolve(res);
        },
        fail: (res) => {
          console.error('蓝牙适配器初始化失败:', res);
          this.bluetoothState.available = false;

          let errorMsg = '蓝牙初始化失败';
          if (res.errCode === 10001) {
            errorMsg = '请检查手机蓝牙是否打开';
          }

          reject({ ...res, errorMsg });
        }
      });
    });
  }

  /**
   * 搜索设备
   * @param {number} timeout - 搜索超时时间（毫秒）
   * @returns {Promise}
   */
  searchDevices(timeout = 10000) {
    return new Promise((resolve, reject) => {
      if (!this.bluetoothState.available) {
        reject({ errorMsg: '蓝牙不可用' });
        return;
      }

      const devices = [];
      let searchTimer = null;

      // 开始搜索
      wx.startBluetoothDevicesDiscovery({
        services: [],
        allowDuplicatesKey: false,
        success: () => {
          console.log('开始搜索蓝牙设备');
          this.bluetoothState.discovering = true;

          // 监听发现的设备
          wx.onBluetoothDeviceFound((res) => {
            res.devices.forEach(device => {
              if (device.name && device.name.includes('YM')) {
                console.log('发现目标设备:', device);

                const deviceInfo = {
                  deviceId: device.deviceId,
                  name: device.name,
                  RSSI: device.RSSI,
                  localName: device.localName
                };

                const existingIndex = devices.findIndex(d => d.deviceId === device.deviceId);
                if (existingIndex >= 0) {
                  devices[existingIndex] = deviceInfo;
                } else {
                  devices.push(deviceInfo);
                }

                this.emit('deviceFound', deviceInfo);
              }
            });
          });

          // 设置搜索超时
          searchTimer = setTimeout(() => {
            this.stopSearch();
            resolve(devices);
          }, timeout);
        },
        fail: (res) => {
          console.error('开始搜索失败:', res);
          reject(res);
        }
      });
    });
  }

  /**
   * 停止搜索
   */
  stopSearch() {
    if (this.bluetoothState.discovering) {
      wx.stopBluetoothDevicesDiscovery({
        success: () => {
          console.log('停止搜索蓝牙设备');
          this.bluetoothState.discovering = false;
        }
      });
    }
  }

  /**
   * 连接设备
   * @param {string} deviceId - 设备ID
   * @returns {Promise}
   */
  connectDevice(deviceId) {
    return new Promise((resolve, reject) => {
      this.deviceId = deviceId;

      console.log(`正在连接设备: ${deviceId}`);

      wx.createBLEConnection({
        deviceId: deviceId,
        success: (res) => {
          console.log('设备连接成功:', res);

          setTimeout(() => {
            this.discoverServices(deviceId)
              .then(() => resolve(res))
              .catch(reject);
          }, 500);
        },
        fail: (res) => {
          console.error('设备连接失败:', res);
          reject(res);
        }
      });
    });
  }

  /**
   * 发现服务
   * @param {string} deviceId - 设备ID
   * @returns {Promise}
   */
  discoverServices(deviceId) {
    return new Promise((resolve, reject) => {
      wx.getBLEDeviceServices({
        deviceId: deviceId,
        success: (res) => {
          console.log('发现服务:', res.services);

          const targetService = res.services.find(service =>
            service.uuid.toUpperCase().includes('FFE0')
          );

          if (targetService) {
            this.serviceId = targetService.uuid;
            console.log('找到目标服务:', this.serviceId);

            this.discoverCharacteristics(deviceId, this.serviceId)
              .then(resolve)
              .catch(reject);
          } else {
            reject({ errorMsg: '未找到目标服务' });
          }
        },
        fail: (res) => {
          console.error('发现服务失败:', res);
          reject(res);
        }
      });
    });
  }

  /**
   * 发现特征值
   * @param {string} deviceId - 设备ID
   * @param {string} serviceId - 服务ID
   * @returns {Promise}
   */
  discoverCharacteristics(deviceId, serviceId) {
    return new Promise((resolve, reject) => {
      wx.getBLEDeviceCharacteristics({
        deviceId: deviceId,
        serviceId: serviceId,
        success: (res) => {
          console.log('发现特征值:', res.characteristics);

          const targetCharacteristic = res.characteristics.find(char =>
            char.uuid.toUpperCase().includes('FFE1')
          );

          if (targetCharacteristic) {
            this.characteristicId = targetCharacteristic.uuid;
            console.log('找到目标特征值:', this.characteristicId);

            this.enableNotification(deviceId, serviceId, this.characteristicId)
              .then(resolve)
              .catch(reject);
          } else {
            reject({ errorMsg: '未找到目标特征值' });
          }
        },
        fail: (res) => {
          console.error('发现特征值失败:', res);
          reject(res);
        }
      });
    });
  }

  /**
   * 启用通知
   * @param {string} deviceId - 设备ID
   * @param {string} serviceId - 服务ID
   * @param {string} characteristicId - 特征值ID
   * @returns {Promise}
   */
  enableNotification(deviceId, serviceId, characteristicId) {
    return new Promise((resolve, reject) => {
      wx.notifyBLECharacteristicValueChange({
        deviceId: deviceId,
        serviceId: serviceId,
        characteristicId: characteristicId,
        state: true,
        success: (res) => {
          console.log('启用通知成功:', res);
          this.connected = true;
          resolve(res);
        },
        fail: (res) => {
          console.error('启用通知失败:', res);
          reject(res);
        }
      });
    });
  }

  /**
   * 发送数据
   * @param {ArrayBuffer} data - 要发送的数据
   * @returns {Promise}
   */
  sendData(data) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject({ errorMsg: '设备未连接' });
        return;
      }

      wx.writeBLECharacteristicValue({
        deviceId: this.deviceId,
        serviceId: this.serviceId,
        characteristicId: this.characteristicId,
        value: data,
        success: (res) => {
          console.log('数据发送成功:', res);
          resolve(res);
        },
        fail: (res) => {
          console.error('数据发送失败:', res);
          reject(res);
        }
      });
    });
  }

  /**
   * 处理接收到的数据
   * @param {ArrayBuffer} data - 接收到的数据
   */
  handleReceivedData(data) {
    if (this.protocol) {
      this.protocol.parseData(data);
    }
  }

  /**
   * 断开连接
   * @returns {Promise}
   */
  disconnect() {
    return new Promise((resolve) => {
      if (this.deviceId) {
        wx.closeBLEConnection({
          deviceId: this.deviceId,
          success: () => {
            console.log('断开连接成功');
          },
          complete: () => {
            this.resetConnection();
            resolve();
          }
        });
      } else {
        this.resetConnection();
        resolve();
      }
    });
  }

  /**
   * 重置连接状态
   */
  resetConnection() {
    this.deviceId = null;
    this.serviceId = null;
    this.characteristicId = null;
    this.connected = false;
  }

  /**
   * 处理蓝牙不可用
   */
  handleBluetoothUnavailable() {
    this.resetConnection();
    this.emit('bluetoothUnavailable');
  }

  /**
   * 处理断开连接
   */
  handleDisconnection() {
    this.connected = false;
    this.emit('disconnected', { deviceId: this.deviceId });
  }

  /**
   * 获取连接状态
   * @returns {Object} 连接状态信息
   */
  getConnectionState() {
    return {
      connected: this.connected,
      deviceId: this.deviceId,
      serviceId: this.serviceId,
      characteristicId: this.characteristicId,
      bluetoothAvailable: this.bluetoothState.available,
      bluetoothDiscovering: this.bluetoothState.discovering
    };
  }

  /**
   * 设置协议解析器
   * @param {YimiOximeterProtocol} protocol - 协议解析器实例
   */
  setProtocol(protocol) {
    this.protocol = protocol;
  }

  /**
   * 事件监听
   * @param {string} event - 事件名称
   * @param {Function} callback - 回调函数
   */
  on(event, callback) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(callback);
  }

  /**
   * 触发事件
   * @param {string} event - 事件名称
   * @param {*} data - 事件数据
   */
  emit(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`事件回调错误 [${event}]:`, error);
        }
      });
    }
  }

  /**
   * 移除事件监听
   * @param {string} event - 事件名称
   * @param {Function} callback - 回调函数
   */
  off(event, callback) {
    if (this.callbacks[event]) {
      const index = this.callbacks[event].indexOf(callback);
      if (index > -1) {
        this.callbacks[event].splice(index, 1);
      }
    }
  }
}

module.exports = BluetoothManager;

