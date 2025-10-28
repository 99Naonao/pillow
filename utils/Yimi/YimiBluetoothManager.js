/**
 * 蓝牙连接管理器
 * 用于管理微信小程序与亿米蓝牙血氧仪的连接
 */
class YimiBluetoothManager {
  constructor() {
    this.deviceId = null;
    this.serviceId = null;
    this.characteristicId = null;
    this.characteristicProperties = null; // 保存特征值的properties
    this.writeCharacteristicId = null; // 用于写入的特征值
    this.notifyCharacteristicId = null; // 用于接收通知的特征值（兼容旧逻辑：首个）
    this.notifyCharacteristicIds = []; // 支持通知/指示的全部特征值列表
    this.connected = false;
    this.protocol = null;
    
    console.log('[蓝牙] 🎯 YimiBluetoothManager 实例被创建');

    // 蓝牙状态
    this.bluetoothState = {
      available: false,
      discovering: false
    };

    // 连接配置
    this.config = {
      // 以下配置可选，如果不配置会自动查找
      serviceUUID: null,  // 服务UUID（null表示自动查找，也可手动指定）
      characteristicUUID: null, // 特征值UUID（null表示自动查找，也可手动指定）
      deviceNameFilter: 'YM', // 设备名称过滤 - 匹配以YM开头的设备
      connectTimeout: 10000, // 连接超时时间
      maxRetries: 3, // 最大重试次数
      
      // 自动查找策略
      autoFindService: true, // 是否自动查找服务（优先使用自定义服务）
      autoFindCharacteristic: true // 是否自动查找特征值（优先使用支持通知/写入的）
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

    // 注意：wx.onBLECharacteristicValueChange 是全局监听器，只能注册一次
    // 如果已经注册过，就不再注册
    if (YimiBluetoothManager._listenerRegistered) {
      console.log('[蓝牙] ⚠️ wx.onBLECharacteristicValueChange 已注册，跳过重复注册');
      return;
    }
    
    console.log('[蓝牙] 注册全局监听器 wx.onBLECharacteristicValueChange');
    
    // 监听特征值变化（使用箭头函数避免this指向问题）
    const self = this;
    
    wx.onBLECharacteristicValueChange((res) => {
      console.log('======================================');
      console.log('[蓝牙] 🔔 收到特征值变化事件');
      console.log('[蓝牙] 设备ID:', res.deviceId);
      console.log('[蓝牙] 服务ID:', res.serviceId);
      console.log('[蓝牙] 特征值ID:', res.characteristicId);
      console.log('[蓝牙] 数据长度:', res.value ? res.value.byteLength : 0);
      console.log('======================================');
      
      // 立即打印十六进制数据，不管匹配不匹配
      if (res.value && res.value.byteLength > 0) {
        const bytes = new Uint8Array(res.value);
        const hexStr = Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
        console.log('[蓝牙] 🔵 原始数据 (UTF-16):', hexStr);
      }
      
      // 先检查是否有设备ID和服务ID设置（说明已经连接）
      if (!self.deviceId || !self.serviceId) {
        console.log('[蓝牙] ⚠️ 收到特征值变化事件，但设备尚未完成连接');
        console.log('[蓝牙] ⚠️ 当前 deviceId:', self.deviceId, 'serviceId:', self.serviceId);
        console.log('[蓝牙] ⚠️ 但还是要打印收到的数据：');
        if (res.value && res.value.byteLength > 0) {
          const bytes = new Uint8Array(res.value);
          const hexStr = Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
          console.log('[蓝牙] 🔵 数据:', hexStr);
        }
        return;
      }
      
      // 检查是否是来自通知特征值的数据（支持多个notify/indicate特征值）
      const targetCharacteristicId = self.notifyCharacteristicId || self.characteristicId;
      const allNotifyIdsRaw = (self.notifyCharacteristicIds && self.notifyCharacteristicIds.length > 0)
        ? self.notifyCharacteristicIds
        : (targetCharacteristicId ? [targetCharacteristicId] : []);
      // 统一大小写，避免不同平台大小写差异
      const allNotifyIds = allNotifyIdsRaw.map(id => (id || '').toUpperCase());
      const incomingCharId = (res.characteristicId || '').toUpperCase();
      
      console.log('[蓝牙] 📊 匹配检查:', {
        '设备ID匹配': res.deviceId === self.deviceId,
        '服务ID匹配': res.serviceId === self.serviceId,
        '特征值是否在监听集合中': allNotifyIds.includes(incomingCharId),
        '实际特征值': incomingCharId,
        '监听集合': allNotifyIds
      });
      
      if (res.deviceId === self.deviceId &&
          res.serviceId === self.serviceId &&
          allNotifyIds.includes(incomingCharId)) {

        console.log('[蓝牙] ✅✅✅ 匹配成功！处理数据');
        self.handleReceivedData(res.value);
      } else {
        console.log('[蓝牙] ⚠️ 特征值ID不在监听集合中，忽略此数据');
      }
    });
    
    console.log('[蓝牙] ✅ wx.onBLECharacteristicValueChange 全局监听器已注册');
    YimiBluetoothManager._listenerRegistered = true;
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
  searchDevices(timeout = 20000) {
    return new Promise((resolve, reject) => {
      if (!this.bluetoothState.available) {
        reject({ errorMsg: '蓝牙不可用' });
        return;
      }

      // 修复：如果上次搜索未停止，先强制停止并等待
      if (this.bluetoothState.discovering) {
        console.log('[蓝牙] ⚠️ 检测到上次搜索未停止，先强制停止并等待');
        this.stopSearch();
        // 等待一小段时间确保状态完全释放
        setTimeout(() => {
          this._startActualSearch(timeout, resolve, reject);
        }, 300);
      } else {
        this._startActualSearch(timeout, resolve, reject);
      }
    });
  }

  /**
   * 实际开始搜索
   */
  _startActualSearch(timeout, resolve, reject) {
    const devices = [];
    let searchTimer = null;
    const systemInfo = wx.getSystemInfoSync ? wx.getSystemInfoSync() : null;
    const isIOS = systemInfo && /ios/i.test(systemInfo.system || '');
    console.log('[蓝牙] 📱 平台信息:', systemInfo);
    console.log('[蓝牙] 📱 是否 iOS:', isIOS);

    // 开始搜索
    wx.startBluetoothDevicesDiscovery({
        services: [], // 不过滤服务，搜索所有设备
        allowDuplicatesKey: true,
        success: () => {
          console.log('开始搜索蓝牙设备');
          this.bluetoothState.discovering = true;

          // 监听发现的设备
          wx.onBluetoothDeviceFound((res) => {
            const list = Array.isArray(res.devices)
              ? res.devices
              : (res.devices ? [res.devices] : (res.device ? [res.device] : []));
            if (!list || list.length === 0) {
              return;
            }
            list.forEach(device => {
              // 注意部分設備只在 localName 有值
              const name = device.name || device.localName || '';
              const key = (this.config.deviceNameFilter || '').toUpperCase();
              const nameOk = key ? name.toUpperCase().includes(key) : true;
              
              
              if (nameOk) {
                console.log('发现目标设备:', device);
                
                // 记录广播数据（如果存在）
                if (device.advertisData) {
                  const advParsed = this.parseAdvertisementData(device.advertisData);
                  console.log('[蓝牙] 📻 设备广播数据:', advParsed);
                  // 打印更易读的详细信息
                  this.printAdvertisementDetails(advParsed);
                }
                if (device.advertisServiceUUIDs) {
                  console.log('[蓝牙] 📻 设备广播服务UUIDs:', device.advertisServiceUUIDs);
                }

                const deviceInfo = {
                  deviceId: device.deviceId,
                  name: device.name,
                  RSSI: device.RSSI,
                  localName: device.localName,
                  advertisData: device.advertisData || null,
                  advertisServiceUUIDs: device.advertisServiceUUIDs || null
                };

                // 检查是否已存在
                const existingIndex = devices.findIndex(d => d.deviceId === device.deviceId);
                if (existingIndex >= 0) {
                  devices[existingIndex] = deviceInfo;
                } else {
                  devices.push(deviceInfo);
                }

                this.emit('deviceFound', deviceInfo);
                if (isIOS && devices.length > 0) {
                  console.log('[蓝牙] iOS 平台已找到首个设备，提前结束搜索');
                  this.stopSearch();
                  resolve(devices);
                }
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
  }

  /**
   * 停止搜索
   */
  stopSearch() {
    if (this.bluetoothState.discovering) {
      console.log('[蓝牙] 🔄 准备停止搜索');
      wx.stopBluetoothDevicesDiscovery({
        success: () => {
          console.log('[蓝牙] ✅ 停止搜索成功');
          this.bluetoothState.discovering = false;
        },
        fail: (err) => {
          console.error('[蓝牙] ❌ 停止搜索失败:', err);
          // 即使失败也重置状态，避免卡住
          this.bluetoothState.discovering = false;
        }
      });
    } else {
      console.log('[蓝牙] ℹ️ 当前未在搜索状态，无需停止');
    }
  }

  /**
   * 连接设备
   * @param {string} deviceId - 设备ID
   * @returns {Promise}
   */
  connectDevice(deviceId) {
    return new Promise((resolve, reject) => {
      // iOS 修复：如果已有旧连接且设备ID不匹配，先完全断开并重置
      if (this.deviceId && this.deviceId !== deviceId) {
        console.log('[蓝牙] ⚠️ 检测到旧连接，先断开旧设备:', this.deviceId);
        // 先调用 wx.closeBLEConnection 再重置状态
        wx.closeBLEConnection({
          deviceId: this.deviceId,
          complete: () => {
            console.log('[蓝牙] 旧设备已完全断开');
            this.resetConnection();
          }
        });
      }
      
      this.deviceId = deviceId;

      console.log(`正在连接设备: ${deviceId}`);

      // 创建连接超时
      const connectTimeout = setTimeout(() => {
        reject({ errorMsg: '连接超时' });
      }, this.config.connectTimeout);

      wx.createBLEConnection({
        deviceId: deviceId,
        success: (res) => {
          clearTimeout(connectTimeout);
          console.log('设备连接成功:', res);

          // 延迟一下再获取服务，确保连接稳定
          setTimeout(() => {
            this.discoverServices(deviceId)
              .then(() => resolve(res))
              .catch(reject);
          }, 500);
        },
        fail: (res) => {
          clearTimeout(connectTimeout);
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

          console.log('=== 所有服务详情 ===');
          res.services.forEach((service, index) => {
            console.log(`服务${index + 1}:`, {
              uuid: service.uuid,
              isPrimary: service.isPrimary
            });
          });
          console.log('====================');

          let targetService = null;
          
          // 1. 如果配置了特定服务UUID，先按配置查找
          if (this.config.serviceUUID) {
            console.log('[蓝牙] 按配置的服务UUID查找:', this.config.serviceUUID);
            targetService = res.services.find(service => {
              const serviceUpper = service.uuid.toUpperCase();
              const configUpper = this.config.serviceUUID.toUpperCase();
              
              // 精确匹配
              if (serviceUpper === configUpper) {
                return true;
              }
              
              // 短UUID匹配（去掉连字符）
              if (configUpper.length <= 8) {
                const serviceWithoutDash = serviceUpper.replace(/-/g, '');
                const configWithoutDash = configUpper.replace(/-/g, '');
                return serviceWithoutDash.includes(configWithoutDash);
              }
              
              // 包含匹配
              return serviceUpper.includes(configUpper);

            });
          }
          
          // 2. 如果自动查找且按配置未找到，自动查找自定义服务
          if (!targetService && this.config.autoFindService) {
            console.log('[蓝牙] 使用自动查找模式，查找自定义服务...');
            targetService = res.services.find(service => {
              const serviceUpper = service.uuid.toUpperCase();
              // 排除标准BLE服务（0x1800, 0x1801, 0x180A等）
              return !serviceUpper.includes('00001800') && 
                     !serviceUpper.includes('00001801') && 
                     !serviceUpper.includes('0000180A') &&
                     !serviceUpper.includes('0000180D'); // Battery Service
            });
          }
          
          // 3. 如果还是找不到，尝试所有主服务
          if (!targetService) {
            console.log('[蓝牙] 尝试使用第一个主服务...');
            targetService = res.services.find(service => service.isPrimary);
          }

          if (targetService) {
            this.serviceId = targetService.uuid;
            console.log('✓ 找到目标服务:', this.serviceId);

            // 直接发现特征值
            this.discoverCharacteristics(deviceId, this.serviceId)
              .then(resolve)
              .catch(reject);
          } else {
            console.error('[蓝牙] 未找到任何可用的服务');
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

  // 已移除设置 MTU 的相关逻辑

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
        success: async (res) => {
          console.log('发现特征值:', res.characteristics);

          // 打印所有特征值详情，方便调试
          console.log('=== 所有特征值详情 ===');
          res.characteristics.forEach((char, index) => {
            console.log(`特征值${index + 1}:`, {
              uuid: char.uuid,
              properties: char.properties,
              可读: char.properties.read,
              可写: char.properties.write,
              无响应写入: char.properties.writeNoResponse,
              通知: char.properties.notify,
              指示: char.properties.indicate
            });
          });
          console.log('====================');

          // 分别查找用于写入和通知的特征值（可能存在多个通知/指示特征值）
          const writeCharacteristic = res.characteristics.find(char => 
            char.properties.write || char.properties.writeNoResponse
          );
          
          // 优先选择仅支持 NOTIFY 的特征值，因为微信对 NOTIFY 的支持更好
          const notifyCharacteristics = res.characteristics.filter(char => 
            char.properties.notify || char.properties.indicate
          );
          
          // 进一步过滤：优先使用仅 NOTIFY（不含 INDICATE）的特征值
          const pureNotifyCharacteristics = res.characteristics.filter(char => 
            char.properties.notify && !char.properties.indicate
          );
          
          const targetNotifyCharacteristics = pureNotifyCharacteristics.length > 0 
            ? pureNotifyCharacteristics 
            : notifyCharacteristics;
          
          console.log('[蓝牙] 找到特征值 - 写入:', writeCharacteristic ? writeCharacteristic.uuid : '无');
          console.log('[蓝牙] 找到特征值 - 通知集合:', notifyCharacteristics.map(c => c.uuid));
          console.log('[蓝牙] 优先使用仅 NOTIFY 特征值:', pureNotifyCharacteristics.length > 0 ? pureNotifyCharacteristics.map(c => c.uuid) : '无');
          
          if (!notifyCharacteristics || notifyCharacteristics.length === 0) {
            console.error('[蓝牙] 未找到支持通知的特征值');
            reject({ errorMsg: '未找到支持通知的特征值' });
            return;
          }
          
          // 保存特征值ID（使用优先级更高的特征值）
          this.notifyCharacteristicIds = targetNotifyCharacteristics.map(c => c.uuid);
          this.notifyCharacteristicId = this.notifyCharacteristicIds[0];
          this.characteristicId = this.notifyCharacteristicId; // 保持兼容
          this.writeCharacteristicId = writeCharacteristic ? writeCharacteristic.uuid : this.notifyCharacteristicId;
          this.characteristicProperties = targetNotifyCharacteristics[0].properties;
          
          console.log('[蓝牙] 使用通知特征值(首选):', this.notifyCharacteristicId);
          if (writeCharacteristic) {
            console.log('[蓝牙] 使用写入特征值:', this.writeCharacteristicId);
          }
          
          // 启用所有通知/指示特征值
          try {
            console.log('[蓝牙] 将为以下特征值开启通知:', this.notifyCharacteristicIds);
            
            // 为所有包含 notify 或 indicate 的特征值都启用通知
            console.log('[蓝牙] 🔧 为所有支持通知/指示的特征值开启通知...');
            const allNotifyIndicateCharacteristics = res.characteristics.filter(char => 
              char.properties.notify || char.properties.indicate
            );
            
            const allTasks = allNotifyIndicateCharacteristics.map(char => 
              this.enableNotification(deviceId, serviceId, char.uuid)
            );
            await Promise.allSettled(allTasks);
            
            // 再次重试一次，处理偶发时序问题
            setTimeout(() => {
              allNotifyIndicateCharacteristics.forEach(char => 
                this.enableNotification(deviceId, serviceId, char.uuid)
              );
            }, 800);
            resolve();
          } catch (error) {
            reject(error);
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
      console.log('[蓝牙] 📝 开始启用通知...');
      console.log('[蓝牙] 启用通知参数:', {
        deviceId: deviceId,
        serviceId: serviceId,
        characteristicId: characteristicId
      });
      
      // 确认监听器已注册
      console.log('[蓝牙] 📝 检查监听器状态:', YimiBluetoothManager._listenerRegistered ? '已注册' : '未注册');
      
      wx.notifyBLECharacteristicValueChange({
        deviceId: deviceId,
        serviceId: serviceId,
        characteristicId: characteristicId,
        state: true,
        success: (res) => {
          console.log('[蓝牙] ✅ 启用通知成功');
          console.log('[蓝牙] ✅ wx.notifyBLECharacteristicValueChange 返回结果:', JSON.stringify(res));
          console.log('[蓝牙] 📌 通知配置:', {
            deviceId: deviceId,
            serviceId: serviceId,
            characteristicId: characteristicId
          });
          
          this.connected = true;
          
          // 触发连接成功事件
          this.emit('connected', {
            deviceId: deviceId,
            serviceId: serviceId,
            characteristicId: characteristicId
          });
          
          // 备选方案：启动轮询读取（某些情况下 INDICATE 可能无法触发事件）
          this.startPollingRead(deviceId, serviceId, characteristicId);
          
          resolve(res);
        },
        fail: (res) => {
          console.error('[蓝牙] ❌ 启用通知失败:', res);
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

      // 使用支持写入的特征值
      const targetCharacteristicId = this.writeCharacteristicId || this.characteristicId;
      
      console.log('[蓝牙] 发送数据到特征值:', targetCharacteristicId);

      wx.writeBLECharacteristicValue({
        deviceId: this.deviceId,
        serviceId: this.serviceId,
        characteristicId: targetCharacteristicId,
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
    console.log('[蓝牙] handleReceivedData 被调用，数据长度:', data.byteLength);
    if (this.protocol) {
      console.log('[蓝牙] 调用 protocol.parseData');
      this.protocol.parseData(data);
    } else {
      console.error('[蓝牙] protocol 未设置！');
    }
  }

  /**
   * 断开连接
   * @returns {Promise}
   */
  disconnect() {
    return new Promise((resolve) => {
      // 确保停止搜索
      this.stopSearch();
      
      if (this.deviceId) {
        wx.closeBLEConnection({
          deviceId: this.deviceId,
          success: () => {
            console.log('[蓝牙] 断开连接成功');
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
    console.log('[蓝牙] 🔄 开始重置连接状态');
    console.log('[蓝牙] 重置前状态:', {
      deviceId: this.deviceId,
      serviceId: this.serviceId,
      connected: this.connected
    });
    
    this.deviceId = null;
    this.serviceId = null;
    this.characteristicId = null;
    this.characteristicProperties = null;
    this.writeCharacteristicId = null;
    this.notifyCharacteristicId = null;
    this.notifyCharacteristicIds = [];
    this.connected = false;
    
    // 停止轮询读取
    this.stopPollingRead();
    
    console.log('[蓝牙] ✅ 连接状态已重置');
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
   * 解析蓝牙广播数据
   * @param {ArrayBuffer} advertisData - 广播数据
   * @returns {Object} 解析后的广播数据
   */
  parseAdvertisementData(advertisData) {
    if (!advertisData) {
      return null;
    }

    const buffer = new Uint8Array(advertisData);
    const hexString = Array.from(buffer).map(b => b.toString(16).padStart(2, '0')).join(' ');
    
    // 尝试解析常见的数据类型
    const parsed = {
      hexString: hexString,
      length: buffer.length,
      bytes: Array.from(buffer)
    };

    // BLE广播数据结构：
    // Length (1 byte) + Type (1 byte) + Data (Length bytes)
    let offset = 0;
    const records = [];
    
    while (offset < buffer.length) {
      const length = buffer[offset];
      if (length === 0 || offset + length + 1 > buffer.length) break;
      
      const type = buffer[offset + 1];
      const data = buffer.slice(offset + 2, offset + 1 + length);
      
      records.push({
        length: length,
        type: `0x${type.toString(16).padStart(2, '0')}`,
        typeName: this.getAdTypeName(type),
        data: Array.from(data)
      });
      
      offset += length + 1;
    }
    
    parsed.records = records;
    return parsed;
  }

  /**
   * 获取BLE广播数据类型名称
   * @param {number} type - 类型值
   * @returns {string} 类型名称
   */
  getAdTypeName(type) {
    const typeNames = {
      0x01: '标志位',
      0x02: '16位服务UUID不完整',
      0x03: '16位服务UUID完整',
      0x04: '32位服务UUID不完整',
      0x05: '32位服务UUID完整',
      0x06: '128位服务UUID不完整',
      0x07: '128位服务UUID完整',
      0x08: '简短本地名称',
      0x09: '完整本地名称',
      0x0A: '发射功率等级',
      0x16: '16位服务UUID服务数据',
      0x21: '128位服务UUID服务数据',
      0xFF: '制造商特定数据'
    };
    return typeNames[type] || '未知';
  }

  /**
   * 以可读方式打印广播包详细信息
   * @param {Object} adv 通过 parseAdvertisementData 返回的对象
   */
  printAdvertisementDetails(adv) {
    try {
      if (!adv || !adv.records) return;
      console.log('[广播包] 十六进制:', adv.hexString);
      adv.records.forEach((rec, idx) => {
        console.log(`[广播包] 记录${idx + 1} -> 长度:${rec.length}, 类型:${rec.type}(${rec.typeName})`);
        console.log('[广播包] 数据:', rec.data.map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
      });
    } catch (e) {
      console.warn('[广播包] 打印失败:', e);
    }
  }

  /**
   * 启动轮询读取（作为 INDICATE 事件的备选方案）
   * @param {string} deviceId - 设备ID
   * @param {string} serviceId - 服务ID
   * @param {string} characteristicId - 特征值ID
   */
  startPollingRead(deviceId, serviceId, characteristicId) {
  }

  /**
   * 停止轮询读取
   */
  stopPollingRead() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
      console.log('[蓝牙] 🔄 轮询读取已停止');
    }
  }

  /**
   * 设置协议解析器
   * @param {YimiOximeterProtocol} protocol - 协议解析器实例
   */
  setProtocol(protocol) {
    this.protocol = protocol;
    
    // 监听协议需要发送ACK的事件
    this.protocol.on('sendAck', (data) => {
      console.log('[蓝牙] 📤 协议要求发送ACK应答帧');
      this.sendData(data).then(() => {
        console.log('[蓝牙] ✅ ACK应答帧发送成功');
      }).catch((err) => {
        console.error('[蓝牙] ❌ ACK应答帧发送失败:', err);
      });
    });
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

module.exports = YimiBluetoothManager;
module.exports = YimiBluetoothManager;