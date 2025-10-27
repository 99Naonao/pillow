/**
 * 血氧仪设备管理类
 * 负责血氧仪的蓝牙连接、数据接收和解析
 */
const Spo2ProtocolManager = require('./spo2ProtocolManager');

class OximeterDeviceManager {
  constructor(page) {
    this.page = page;
    this.protocolManager = new Spo2ProtocolManager();
    
    // 蓝牙相关
    this.deviceId = null;
    this.serviceId = null;
    this.notifyCharId = null;
    this.writeCharId = null;
    
    // 连接状态
    this.isConnected = false;
    
    // 数据更新回调
    this.onDataUpdate = null;
  }

  /**
   * 开始搜索血氧仪设备
   */
  startBluetoothSearch() {
    return new Promise((resolve, reject) => {
      wx.startBluetoothDevicesDiscovery({
        allowDuplicatesKey: true,
        interval: 500,
        success: (res) => {
          console.log('[血氧仪] 开始搜索蓝牙设备');
          
          const devices = [];
          
          // 监听发现设备事件
          wx.onBluetoothDeviceFound((res) => {
            res.devices.forEach((device) => {
              if (device.name && device.name.toLowerCase().includes('oximeter')) {
                console.log('[血氧仪] 发现设备:', device.name, device.deviceId);
                devices.push(device);
              }
            });
          });
          
          // 5秒后停止搜索
          setTimeout(() => {
            wx.stopBluetoothDevicesDiscovery({
              success: () => {
                console.log('[血氧仪] 停止搜索，找到设备数量:', devices.length);
                resolve(devices);
              },
              fail: (err) => {
                console.error('[血氧仪] 停止搜索失败:', err);
                reject(err);
              }
            });
          }, 5000);
        },
        fail: (err) => {
          console.error('[血氧仪] 搜索失败:', err);
          reject(err);
        }
      });
    });
  }

  /**
   * 连接血氧仪设备
   * @param {string} deviceId 设备ID
   */
  async connectDevice(deviceId) {
    try {
      console.log('[血氧仪] 开始连接设备:', deviceId);
      
      // 连接蓝牙设备
      await wx.createBLEConnection({
        deviceId,
        success: () => {
          console.log('[血氧仪] 连接成功');
        }
      });
      
      this.deviceId = deviceId;
      
      // 获取服务
      const services = await wx.getBLEDeviceServices({ deviceId });
      console.log('[血氧仪] 获取到服务:', services.services);
      
      // 查找需要的服务UUID（根据实际血氧仪修改）
      const targetService = services.services.find(s => 
        s.isPrimary || s.uuid.toLowerCase().includes('fff0')
      );
      
      if (!targetService) {
        throw new Error('未找到目标服务');
      }
      
      this.serviceId = targetService.uuid;
      
      // 获取特征值
      const characteristics = await wx.getBLEDeviceCharacteristics({
        deviceId: this.deviceId,
        serviceId: this.serviceId,
        success: (res) => {
          console.log('[血氧仪] 获取到特征值:', res.characteristics);
        }
      });
      
      // 查找通知和写入特征值
      for (const char of characteristics.characteristics) {
        if (char.properties.notify || char.properties.indicate) {
          this.notifyCharId = char.uuid;
          
          // 启用通知
          wx.notifyBLECharacteristicValueChange({
            deviceId: this.deviceId,
            serviceId: this.serviceId,
            characteristicId: this.notifyCharId,
            state: true,
            success: () => {
              console.log('[血氧仪] 启用通知成功');
              this.isConnected = true;
            }
          });
        }
        
        if (char.properties.write) {
          this.writeCharId = char.uuid;
        }
      }
      
      // 监听数据接收
      wx.onBLECharacteristicValueChange((res) => {
        this.handleDataReceive(res.value);
      });
      
      // 发送查询命令
      this.queryInfo();
      
      return true;
    } catch (error) {
      console.error('[血氧仪] 连接失败:', error);
      throw error;
    }
  }

  /**
   * 断开连接
   */
  disconnectDevice() {
    if (!this.deviceId || !this.isConnected) {
      return;
    }
    
    wx.closeBLEConnection({
      deviceId: this.deviceId,
      success: () => {
        console.log('[血氧仪] 断开连接成功');
        this.isConnected = false;
        this.deviceId = null;
        this.serviceId = null;
        this.notifyCharId = null;
        this.writeCharId = null;
      }
    });
  }

  /**
   * 查询设备信息
   */
  queryInfo() {
    if (!this.deviceId || !this.writeCharId) {
      console.error('[血氧仪] 设备未连接或无写入特征值');
      return;
    }
    
    try {
      // 构建查询帧
      const queryFrame = this.protocolManager.buildInfoQueryFrame(0);
      const buffer = this.protocolManager.frameToArrayBuffer(queryFrame);
      
      // 发送数据
      wx.writeBLECharacteristicValue({
        deviceId: this.deviceId,
        serviceId: this.serviceId,
        characteristicId: this.writeCharId,
        value: buffer,
        success: () => {
          console.log('[血氧仪] 查询信息命令发送成功');
        },
        fail: (err) => {
          console.error('[血氧仪] 发送命令失败:', err);
        }
      });
    } catch (error) {
      console.error('[血氧仪] 构建查询帧失败:', error);
    }
  }

  /**
   * 处理接收到的数据
   * @param {ArrayBuffer} value 接收到的数据
   */
  handleDataReceive(value) {
    try {
      // 转换为数组
      const frameData = this.protocolManager.arrayBufferToFrame(value);
      
      // 验证帧格式
      if (!this.protocolManager.validateFrame(frameData)) {
        console.error('[血氧仪] 帧格式错误');
        return;
      }
      
      // 解析命令ID
      const commandId = frameData[2]; // 模块ID+ACK后是命令
      const data = frameData.slice(3, frameData.length - 1); // 去掉帧头和校验和
      
      console.log('[血氧仪] 接收到命令:', commandId.toString(16));
      
      switch (commandId) {
        case 0x52: // 测量结果帧
          this.parseMeasurementResult(data);
          break;
        
        case 0x53: // 描记波帧
          this.parseWaveform(data);
          break;
        
        case 0x56: // 版本信息帧
          this.parseVersionInfo(data);
          break;
        
        default:
          console.log('[血氧仪] 未知命令:', commandId);
      }
    } catch (error) {
      console.error('[血氧仪] 解析数据失败:', error);
    }
  }

  /**
   * 解析测量结果
   * @param {Array} data 数据部分
   */
  parseMeasurementResult(data) {
    const result = this.protocolManager.parseMeasurementResultFrame(data);
    
    if (!result) {
      return;
    }
    
    console.log('[血氧仪] 测量结果:', result);
    
    // 更新页面数据
    if (this.onDataUpdate) {
      this.onDataUpdate({
        spo2: result.isSpo2Valid ? result.spo2 : null,
        pulseRate: result.isPulseRateValid ? result.pulseRate : null,
        perfusionIndex: result.isPerfusionIndexValid ? result.perfusionIndex : null,
        batteryVoltage: result.batteryVoltage,
        leadStatus: result.leadStatus,
        pulseSearchStatus: result.pulseSearchStatus
      });
    }
  }

  /**
   * 解析描记波数据
   * @param {Array} data 数据部分
   */
  parseWaveform(data) {
    const waveforms = this.protocolManager.parseWaveformFrame(data);
    
    if (!waveforms || waveforms.length === 0) {
      return;
    }
    
    console.log('[血氧仪] 描记波数据，数量:', waveforms.length);
    
    // 可以在这里处理波形数据，比如绘制图表
    waveforms.forEach((wave, index) => {
      console.log(`[血氧仪] 波形 ${index}:`, {
        pulseSound: wave.pulseSound,
        waveformLength: wave.waveformData ? wave.waveformData.length : 0,
        barGraphLength: wave.barGraphData ? wave.barGraphData.length : 0
      });
    });
  }

  /**
   * 解析版本信息
   * @param {Array} data 数据部分
   */
  parseVersionInfo(data) {
    const versionInfo = this.protocolManager.parseVersionInfoFrame(data);
    
    if (!versionInfo) {
      return;
    }
    
    console.log('[血氧仪] 版本信息:', versionInfo);
    
    wx.showToast({
      title: `版本: ${versionInfo.versionString}`,
      icon: 'none',
      duration: 2000
    });
  }

  /**
   * 设置数据更新回调
   * @param {Function} callback 回调函数
   */
  setOnDataUpdateCallback(callback) {
    this.onDataUpdate = callback;
  }
}

module.exports = OximeterDeviceManager;

