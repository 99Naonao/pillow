/**
 * 血氧仪设备管理类 - 使用Yimi工具集
 * 基于：亿米蓝牙血氧仪通信协议(透传) V1.3
 * 
 * 文档编号：KF-1602-01-002(V1.3)
 */
const YimiBluetoothManager = require('./Yimi/YimiBluetoothManager');
const YimiOximeterProtocol = require('./Yimi/YimiOximeterProtocol');

class OximeterDeviceManager {
  constructor(page) {
    this.page = page;
    
    // 使用Yimi工具
    this.bluetoothManager = new YimiBluetoothManager();
    this.protocol = new YimiOximeterProtocol();
    
    // 连接状态
    this.isConnected = false;
    this.isStable = false; // 是否处于稳定期
    this.connectTime = null; // 连接时间
    
    // 数据更新回调
    this.onDataUpdate = null;
    this.onWaveformUpdate = null; // 波形数据回调
    
    // 绑定协议到蓝牙管理器
    this.bluetoothManager.setProtocol(this.protocol);
    
    // 设置协议事件监听
    this.setupProtocolListeners();
    
    console.log('[血氧仪管理器] 初始化完成，使用Yimi工具集');
  }

  /**
   * 设置协议事件监听
   * @private
   */
  setupProtocolListeners() {
    // 监听实时数据
    this.protocol.on('realtimeData', (data) => {
      console.log('[血氧仪] 收到实时数据:', JSON.stringify(data, null, 2));
      
      // 稳定期内不信任测量值（但记录日志）
      if (!this.isStable) {
        const remainingTime = Math.max(0, 5000 - (Date.now() - this.connectTime));
        console.log(`[血氧仪] 稳定期内，忽略测量值（剩余${remainingTime}ms）`);
        return;
      }
      
      // 更新页面数据
      if (this.onDataUpdate) {
        console.log('[血氧仪] 调用onDataUpdate回调，数据:', {
          spo2: data.spo2,
          pulseRate: data.pulseRate,
          perfusionIndex: data.perfusionIndex,
          batteryVoltage: data.batteryVoltage
        });
        this.onDataUpdate({
          spo2: data.spo2,
          pulseRate: data.pulseRate,
          perfusionIndex: data.perfusionIndex,
          batteryVoltage: data.batteryVoltage,
          leadStatus: data.leadStatus,
          pulseSearchStatus: data.pulseSearchStatus,
          weakPerfusionStatus: data.weakPerfusionStatus,
          interferenceStatus: data.interferenceStatus,
          arrestStatus: data.arrestStatus
        });
      } else {
        console.warn('[血氧仪] onDataUpdate回调未设置！');
      }
    });
    
    // 监听波形数据
    this.protocol.on('waveformData', (waveforms) => {
      console.log('[血氧仪] 收到波形数据，数量:', waveforms.length);
      
      if (this.onWaveformUpdate) {
        // 检测脉搏音
        const hasPulseSound = waveforms.some(w => w.pulseSound);
        
        this.onWaveformUpdate({
          hasPulseSound: hasPulseSound,
          waveforms: waveforms
        });
      }
    });
    
    // 监听设备信息
    this.protocol.on('deviceInfo', (info) => {
      console.log('[血氧仪] 版本信息:', info);
      
      wx.showToast({
        title: `版本: ${info.versionString}`,
        icon: 'none',
        duration: 2000
      });
    });
  }

  /**
   * 开始搜索血氧仪设备
   * 搜索名称包含 "YM" 的蓝牙设备
   * @returns {Promise<Array>} 找到的设备列表
   * @example
   * const devices = await this.oximeterManager.startBluetoothSearch();
   * if (devices.length > 0) {
   *   console.log('找到设备:', devices[0]);
   * }
   */
  async startBluetoothSearch() {
    try {
      console.log('[血氧仪] 初始化蓝牙适配器...');
      
      // 初始化蓝牙适配器
      await this.bluetoothManager.initAdapter();
      
      // 搜索设备
      const devices = await this.bluetoothManager.searchDevices(5000);
      
      console.log('[血氧仪] 搜索完成，找到设备数量:', devices.length);
      
      return devices;
    } catch (error) {
      console.error('[血氧仪] 搜索异常:', error);
      throw error;
    }
  }

  /**
   * 连接血氧仪设备
   * @param {string} deviceId - 设备ID（从 startBluetoothSearch 获取）
   * @returns {Promise<boolean>} 连接是否成功
   * @example
   * await this.oximeterManager.connectDevice(devices[0].deviceId);
   */
  async connectDevice(deviceId) {
    try {
      console.log('[血氧仪] 开始连接设备:', deviceId);
      
      // 连接设备
      await this.bluetoothManager.connectDevice(deviceId);
      
      this.isConnected = true;
      this.connectTime = Date.now();
      this.isStable = false;
      
      console.log('[血氧仪] 连接完全成功！');
      console.log('[血氧仪] 根据协议说明：模块自检时间 < 4秒，期间不响应任何帧');
      console.log('[血氧仪] 导联连接后需要5秒稳定期，期间测量值均为无效值');
      console.log('[血氧仪] 进入5秒稳定期，忽略测量数据...');
      
      // 根据协议：稳定期为5秒，期间所有测量值均为无效值
      setTimeout(() => {
        this.isStable = true;
        console.log('[血氧仪] 稳定期结束（5秒），开始正常显示测量数据');
      }, 5000);
      
      // 发送查询命令作为测试（5秒后发送，避免干扰自检和稳定期）
      setTimeout(() => {
        console.log('[血氧仪] 🧪 测试：发送0x11查询命令唤醒设备...');
        this.queryInfo();
      }, 5000);
      
      return true;
    } catch (error) {
      console.error('[血氧仪] 连接失败:', error);
      throw error;
    }
  }

  /**
   * 断开连接
   * @example
   * this.oximeterManager.disconnectDevice();
   */
  disconnectDevice() {
    if (!this.isConnected) {
      return;
    }
    
    this.bluetoothManager.disconnect().then(() => {
      console.log('[血氧仪] 断开连接成功');
      this.isConnected = false;
      this.isStable = false;
      this.connectTime = null;
    }).catch((err) => {
      console.error('[血氧仪] 断开连接失败:', err);
    });
  }

  /**
   * 查询设备信息（设备会自动推送数据，通常不需要调用）
   * @private
   */
  queryInfo() {
    if (!this.isConnected) {
      console.error('[血氧仪] 设备未连接');
      return;
    }
    
    try {
      // 构建查询帧
      const queryFrame = this.protocol.buildInfoQueryFrame(0);
      const buffer = this.protocol.frameToArrayBuffer(queryFrame);
      
      // 发送数据
      this.bluetoothManager.sendData(buffer).then(() => {
        console.log('[血氧仪] 查询信息命令发送成功');
      }).catch((err) => {
        console.error('[血氧仪] 发送命令失败:', err);
      });
    } catch (error) {
      console.error('[血氧仪] 构建查询帧失败:', error);
    }
  }

  /**
   * 设置设备绑定状态（高级功能，一般不需要）
   * @param {boolean} bind - 是否绑定（true=绑定, false=解锁）
   * @private
   */
  setDeviceBinding(bind) {
    if (!this.isConnected) {
      console.error('[血氧仪] 设备未连接');
      return;
    }
    
    try {
      const bindingFrame = this.protocol.buildDeviceBindingFrame(bind ? 1 : 0);
      const buffer = this.protocol.frameToArrayBuffer(bindingFrame);
      
      this.bluetoothManager.sendData(buffer).then(() => {
        console.log('[血氧仪] 设备绑定设置命令发送成功，状态:', bind ? '绑定' : '解锁');
      }).catch((err) => {
        console.error('[血氧仪] 发送绑定设置命令失败:', err);
      });
    } catch (error) {
      console.error('[血氧仪] 构建绑定设置帧失败:', error);
    }
  }

  /**
   * 设置数据更新回调
   * @param {Function} callback - 回调函数，接收 { spo2, pulseRate, perfusionIndex, batteryVoltage } 等参数
   * @example
   * this.oximeterManager.setOnDataUpdateCallback((data) => {
   *   this.setData({
   *     spo2: data.spo2,
   *     pulseRate: data.pulseRate,
   *     perfusionIndex: data.perfusionIndex,
   *     batteryVoltage: data.batteryVoltage
   *   });
   * });
   */
  setOnDataUpdateCallback(callback) {
    this.onDataUpdate = callback;
  }

  /**
   * 设置波形数据更新回调（高级功能）
   * @param {Function} callback - 回调函数，接收波形数据
   */
  setOnWaveformUpdateCallback(callback) {
    this.onWaveformUpdate = callback;
  }
}

module.exports = OximeterDeviceManager;
