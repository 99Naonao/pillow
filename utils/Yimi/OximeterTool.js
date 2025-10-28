/**
 * 亿米蓝牙血氧仪调试工具 - 主入口文件
 *
 * 使用示例：
 *
 * const OximeterTool = require('./OximeterTool.js');
 *
 * // 创建工具实例
 * const tool = new OximeterTool();
 *
 * // 开始调试
 * tool.start().then(result => {
 *   console.log('调试启动结果:', result);
 * });
 *
 * // 监听数据
 * tool.on('data', (data) => {
 *   console.log('收到数据:', data);
 * });
 */

const OximeterDebugger = require('./OximeterDebugger.js');

class OximeterTool {
  constructor() {
    this.debugger = new OximeterDebugger();
    this.isRunning = false;
    this.callbacks = {}; // 事件回调系统

    // 绑定事件
    this.bindEvents();
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    // 监听调试器事件
    this.debugger.on('realtimeData', (data) => {
      this.handleRealtimeData(data);
      // 转发给外部监听者（home.js 等）
      this.emit('realtimeData', data);
    });

    this.debugger.on('deviceInfo', (info) => {
      this.handleDeviceInfo(info);
      // 转发设备信息
      this.emit('deviceInfo', info);
    });

    this.debugger.on('log', (log) => {
      this.handleLog(log);
    });

    this.debugger.on('saveData', (data) => {
      this.handleSaveData(data);
    });

    this.debugger.on('disconnected', (data) => {
      console.log('血氧仪已断开连接', data);
      // 转发断开连接事件给外部监听者
      this.isRunning = false;
      this.emit('disconnected', data);
    });
  }

  /**
   * 启动工具
   * @returns {Promise}
   */
  async start() {
    try {
      console.log('正在启动血氧仪调试工具...');

      const result = await this.debugger.startDebug();

      if (result.success) {
        this.isRunning = true;
        console.log('血氧仪调试工具启动成功');
        console.log(`已连接设备: ${result.device.name}`);
        console.log('设备ID:', result.device.deviceId);
      } else {
        console.error('启动失败:', result.error);
        if (result.details) {
          console.error('失败上下文:', {
            step: result.details.step,
            bluetoothState: result.details.bluetoothState,
            connectionState: result.details.connectionState,
            errCode: result.details.errCode,
            message: result.details.message
          });
        }
      }

      return result;

    } catch (error) {
      console.error('启动工具失败:', error);
      throw error;
    }
  }

  /**
   * 停止工具
   * @returns {Promise}
   */
  async stop() {
    try {
      console.log('正在停止血氧仪调试工具...');

      const result = await this.debugger.stopDebug();

      if (result.success) {
        this.isRunning = false;
        console.log('血氧仪调试工具已停止');
      }

      return result;

    } catch (error) {
      console.error('停止工具失败:', error);
      throw error;
    }
  }

  /**
   * 处理实时数据
   * @param {Object} data - 实时数据
   */
  handleRealtimeData(data) {
    // 兼容当前协议字段：spo2、pulseRate、perfusionIndex、batteryVoltage
    const timestamp = new Date(data.timestamp || Date.now()).toLocaleTimeString();
    const spo2 = (data.spo2 ?? '--');
    const pr = (data.pulseRate ?? data.pr ?? '--');
    const pi = (data.perfusionIndex ?? '--');
    const bv = (data.batteryVoltage ?? '--');
    
    // 优化显示：更清晰的格式，突出脉率（PR）显示
    const spo2Str = typeof spo2 === 'number' ? `${spo2.toFixed(1)}%` : `${spo2}%`;
    const prStr = typeof pr === 'number' ? `${pr} bpm` : `${pr}`;
    const piStr = typeof pi === 'number' ? pi.toFixed(1) : pi;
    const bvStr = typeof bv === 'number' ? `${bv.toFixed(2)}V` : `${bv}`;
    
    console.log(`[${timestamp}] 血氧: ${spo2Str} | 脉率: ${prStr} | PI: ${piStr} | 电量: ${bvStr}`);
  }

  /**
   * 处理设备信息
   * @param {Object} info - 设备信息
   */
  handleDeviceInfo(info) {
    console.log('📱 设备信息:');
    console.log(`   设备ID: ${info.deviceId}`);
    console.log(`   固件版本: ${info.firmwareVersion}`);
    console.log(`   硬件版本: ${info.hardwareVersion}`);
    console.log(`   电池类型: ${info.batteryType}`);
  }

  /**
   * 处理日志
   * @param {Object} log - 日志条目
   */
  handleLog(log) {
    // 这里可以添加日志的额外处理，比如写入文件等
    // 默认已经在控制台输出，这里可以添加其他处理逻辑
  }

  /**
   * 处理数据保存
   * @param {Object} data - 要保存的数据
   */
  handleSaveData(data) {
    // 这里可以实现数据保存逻辑，比如写入本地文件
    // 由于微信小程序的限制，实际保存需要通过其他方式实现
    // console.log('💾 数据已缓存，准备保存...');
  }

  /**
   * 获取状态
   * @returns {Object} 当前状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      debugStatus: this.debugger.getDebugStatus(),
      connectionState: this.debugger.bluetoothManager.getConnectionState()
    };
  }

  /**
   * 获取统计数据
   * @returns {Object} 统计数据
   */
  getStats() {
    return this.debugger.getRealtimeStats();
  }

  /**
   * 发送命令
   * @param {number} cmd - 命令字
   * @param {ArrayBuffer} data - 命令数据
   * @returns {Promise}
   */
  sendCommand(cmd, data) {
    return this.debugger.sendCommand(cmd, data);
  }

  /**
   * 获取调试报告
   * @returns {Object} 调试报告
   */
  getDebugReport() {
    return this.debugger.exportDebugReport();
  }

  /**
   * 清除数据
   * @param {string} type - 数据类型
   */
  clearData(type) {
    return this.debugger.clearData(type);
  }

  /**
   * 事件监听
   * @param {string} event - 事件名称
   * @param {Function} callback - 回调函数
   */
  on(event, callback) {
    // 除了realtimeData、deviceInfo等专用事件通过debugger转发
    if (['realtimeData', 'deviceInfo', 'historyData', 'log', 'saveData'].includes(event)) {
      return this.debugger.on(event, callback);
    }
    
    // disconnected等事件通过自己的callback系统
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
    if (['realtimeData', 'deviceInfo', 'historyData', 'log', 'saveData'].includes(event)) {
      return this.debugger.off(event, callback);
    }
    
    if (this.callbacks[event]) {
      const index = this.callbacks[event].indexOf(callback);
      if (index > -1) {
        this.callbacks[event].splice(index, 1);
      }
    }
  }

  /**
   * 获取帮助信息
   * @returns {string} 帮助信息
   */
  getHelp() {
    return `
亿米蓝牙血氧仪调试工具 - 使用说明

基本使用：
1. 创建工具实例: const tool = new OximeterTool();
2. 启动调试: await tool.start();
3. 监听数据: tool.on('realtimeData', (data) => { ... });
4. 停止调试: await tool.stop();

可用命令：
- 实时数据: 0x01
- 历史数据: 0x02
- 设备信息: 0x03
- 设置参数: 0x04
- 心跳包: 0x05

事件监听：
- realtimeData: 实时数据
- deviceInfo: 设备信息
- historyData: 历史数据
- log: 日志信息
- saveData: 数据保存

数据格式：
{
  timestamp: 时间戳,
  spo2: 血氧饱和度(0-100),
  pr: 脉率(bpm),
  signalStrength: 信号强度(0-100),
  battery: 电池电量(0-100)
}
    `;
  }
}

module.exports = OximeterTool;