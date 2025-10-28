/**
 * 血氧仪调试工具类
 * 提供完整的调试功能，包括数据监控、日志记录、错误分析等
 */
const YimiOximeterProtocol = require('./YimiOximeterProtocol.js');
const YimiBluetoothManager = require('./YimiBluetoothManager.js');

class OximeterDebugger {
  constructor() {
    this.protocol = new YimiOximeterProtocol();
    this.bluetoothManager = new YimiBluetoothManager();

    // 调试配置
    this.debugConfig = {
      enableLog: true,
      enableDataLog: true,
      enableErrorLog: true,
      maxLogEntries: 1000,
      autoSaveInterval: 5000, // 5秒自动保存一次
      dataFormat: 'hex' // hex, binary, decimal
    };

    // 数据存储
    this.dataStorage = {
      realtimeData: [],
      historyData: [],
      deviceInfo: null,
      logs: [],
      errors: [],
      connectionHistory: []
    };

    // 调试状态
    this.debugState = {
      isDebugging: false,
      startTime: null,
      totalDataPoints: 0,
      errorCount: 0,
      lastActivity: null
    };

    // 自动保存定时器
    this.autoSaveTimer = null;

    this.init();
  }

  /**
   * 初始化调试器
   */
  init() {
    // 设置协议解析器
    this.bluetoothManager.setProtocol(this.protocol);

    // 绑定事件监听
    this.bindEvents();

    console.log('血氧仪调试器初始化完成');
  }

  /**
   * 绑定事件监听
   */
  bindEvents() {
    // 蓝牙管理器事件
    this.bluetoothManager.on('connected', (data) => {
      this.log('info', '设备已连接', data);
      this.addConnectionHistory('connected', data);
      this.log('info', '等待设备自动推送测量数据...');
      
      // 不再自动发送任何查询命令，等待设备主动上报
    });

    this.bluetoothManager.on('disconnected', (data) => {
      this.log('warning', '设备已断开连接', data);
      this.addConnectionHistory('disconnected', data);
      // 触发断开连接事件，通知外部
      this.emit('disconnected', data);
    });

    this.bluetoothManager.on('deviceFound', (device) => {
      this.log('info', `发现设备: ${device.name} (${device.deviceId})`, device);
    });

    // 协议解析器事件
    this.protocol.on('realtimeData', (data) => {
      this.handleRealtimeData(data);
    });

    this.protocol.on('historyData', (data) => {
      this.handleHistoryData(data);
    });

    this.protocol.on('deviceInfo', (info) => {
      this.handleDeviceInfo(info);
    });
  }

  /**
   * 开始调试
   */
  async startDebug() {
    try {
      this.debugState.isDebugging = true;
      this.debugState.startTime = Date.now();
      this.debugState.totalDataPoints = 0;
      this.debugState.errorCount = 0;

      this.log('info', '开始调试会话');
      this.log('info', '开始初始化蓝牙适配器');

      // 初始化蓝牙
      await this.bluetoothManager.initAdapter();
      this.log('info', '蓝牙适配器初始化完成', {
        bluetoothState: this.bluetoothManager.bluetoothState
      });

      // 开始搜索设备
      this.log('info', '开始搜索血氧仪设备...');
      const devices = await this.bluetoothManager.searchDevices(15000);

      if (devices.length === 0) {
        throw new Error('未找到血氧仪设备');
      }

      this.log('info', `找到 ${devices.length} 个设备`);

      // 连接第一个设备
      const targetDevice = devices[0];
      this.log('info', `正在连接设备: ${targetDevice.name}`);

      await this.bluetoothManager.connectDevice(targetDevice.deviceId);

      // 启动自动保存
      this.startAutoSave();

      this.log('success', '调试会话启动成功');

      return {
        success: true,
        device: targetDevice,
        message: '调试会话启动成功'
      };

    } catch (error) {
      const context = {
        step: 'startDebug',
        bluetoothState: this.bluetoothManager && this.bluetoothManager.bluetoothState,
        connectionState: this.bluetoothManager && this.bluetoothManager.getConnectionState ? this.bluetoothManager.getConnectionState() : null,
        rawError: error,
        message: error && error.message,
        errCode: error && error.errCode,
        stack: error && error.stack
      };
      this.log('error', '调试会话启动失败', context);
      this.debugState.isDebugging = false;

      return {
        success: false,
        error: (error && error.message) || '启动失败',
        details: context
      };
    }
  }

  /**
   * 停止调试
   */
  async stopDebug() {
    try {
      this.debugState.isDebugging = false;

      this.log('info', '停止调试会话');

      // 停止自动保存
      this.stopAutoSave();

      // 断开蓝牙连接
      await this.bluetoothManager.disconnect();

      // 保存最终数据
      this.saveDebugData();

      this.log('success', '调试会话已停止');

      return {
        success: true,
        message: '调试会话已停止'
      };

    } catch (error) {
      this.log('error', '停止调试会话失败', error);

      return {
        success: false,
        error: error.message || '停止失败'
      };
    }
  }

  /**
   * 处理实时数据
   * @param {Object} data - 实时数据
   */
  handleRealtimeData(data) {
    console.log('[OximeterDebugger] 收到实时数据:', JSON.stringify(data, null, 2));
    
    this.debugState.totalDataPoints++;
    this.debugState.lastActivity = Date.now();

    // 添加到实时数据缓存
    this.dataStorage.realtimeData.push(data);

    // 限制缓存大小
    if (this.dataStorage.realtimeData.length > 1000) {
      this.dataStorage.realtimeData = this.dataStorage.realtimeData.slice(-500);
    }

    // 数据验证
    this.validateRealtimeData(data);

    // 记录数据日志
    if (this.debugConfig.enableDataLog) {
      this.logData('realtime', data);
    }

    // 触发数据事件
    console.log('[OximeterDebugger] 触发 realtimeData 事件');
    this.emit('realtimeData', data);
  }

  /**
   * 处理历史数据
   * @param {Array} records - 历史数据记录
   */
  handleHistoryData(records) {
    this.dataStorage.historyData = this.dataStorage.historyData.concat(records);

    this.log('info', `收到 ${records.length} 条历史数据记录`);

    // 触发历史数据事件
    this.emit('historyData', records);
  }

  /**
   * 处理设备信息
   * @param {Object} info - 设备信息
   */
  handleDeviceInfo(info) {
    this.dataStorage.deviceInfo = info;

    this.log('info', '收到设备信息', info);

    // 触发设备信息事件
    this.emit('deviceInfo', info);
  }

  /**
   * 验证实时数据
   * @param {Object} data - 实时数据
   */
  validateRealtimeData(data) {
    const errors = [];

    // 血氧饱和度验证 (70-100%)
    if (data.spo2 !== undefined && (data.spo2 < 70 || data.spo2 > 100)) {
      errors.push(`血氧饱和度异常: ${data.spo2}%`);
    }

    // 脉率验证 (25-300 bpm，根据协议)
    if (data.pulseRate !== undefined && (data.pulseRate < 25 || data.pulseRate > 300)) {
      errors.push(`脉率异常: ${data.pulseRate} bpm`);
    }

    // 灌注度验证 (0-100)
    if (data.perfusionIndex !== undefined && (data.perfusionIndex < 0 || data.perfusionIndex > 100)) {
      errors.push(`灌注度异常: ${data.perfusionIndex}`);
    }

    // 电池电压验证 (0-5V)
    if (data.batteryVoltage !== undefined && data.batteryVoltage !== null && (data.batteryVoltage < 0 || data.batteryVoltage > 5)) {
      errors.push(`电池电压异常: ${data.batteryVoltage}V`);
    }

    if (errors.length > 0) {
      this.debugState.errorCount++;
      this.log('warning', '数据验证失败', { errors, data });

      // 记录错误
      this.dataStorage.errors.push({
        timestamp: Date.now(),
        type: 'data_validation',
        errors: errors,
        data: data
      });
    }
  }

  /**
   * 发送命令
   * @param {number} cmd - 命令字
   * @param {ArrayBuffer} data - 命令数据
   */
  async sendCommand(cmd, data = new ArrayBuffer(0)) {
    try {
      if (!this.bluetoothManager.connected) {
        throw new Error('设备未连接');
      }

      const frame = this.protocol.buildFrame(cmd, data);

      this.log('info', `发送命令: 0x${cmd.toString(16).padStart(2, '0')}`, {
        cmd: cmd,
        dataLength: data.byteLength,
        frameLength: frame.byteLength
      });

      await this.bluetoothManager.sendData(frame);

      return {
        success: true,
        message: '命令发送成功'
      };

    } catch (error) {
      this.log('error', '命令发送失败', error);

      return {
        success: false,
        error: error.message || '发送失败'
      };
    }
  }

  /**
   * 获取实时数据统计
   * @returns {Object} 统计数据
   */
  getRealtimeStats() {
    const data = this.dataStorage.realtimeData;
    if (data.length === 0) {
      return null;
    }

    const spo2Values = data.map(d => d.spo2).filter(v => v !== undefined);
    const prValues = data.map(d => d.pulseRate).filter(v => v !== undefined);

    return {
      sampleCount: data.length,
      timeSpan: data[data.length - 1].timestamp - data[0].timestamp,
      spo2: {
        min: Math.min(...spo2Values),
        max: Math.max(...spo2Values),
        avg: spo2Values.reduce((a, b) => a + b, 0) / spo2Values.length,
        latest: spo2Values[spo2Values.length - 1]
      },
      pulseRate: {
        min: Math.min(...prValues),
        max: Math.max(...prValues),
        avg: prValues.reduce((a, b) => a + b, 0) / prValues.length,
        latest: prValues[prValues.length - 1]
      }
    };
  }

  /**
   * 计算信号质量
   * @param {Array} data - 数据数组
   * @returns {Object} 信号质量信息
   */
  calculateSignalQuality(data) {
    if (data.length === 0) return null;

    const recentData = data.slice(-50); // 最近50个数据点
    const signalStrengths = recentData.map(d => d.signalStrength);

    const avgSignal = signalStrengths.reduce((a, b) => a + b, 0) / signalStrengths.length;

    let quality = 'poor';
    if (avgSignal >= 80) quality = 'excellent';
    else if (avgSignal >= 60) quality = 'good';
    else if (avgSignal >= 40) quality = 'fair';

    return {
      average: avgSignal,
      quality: quality,
      stability: this.calculateStability(signalStrengths)
    };
  }

  /**
   * 计算稳定性
   * @param {Array} values - 数值数组
   * @returns {number} 稳定性评分 (0-100)
   */
  calculateStability(values) {
    if (values.length < 2) return 100;

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // 将标准差转换为稳定性评分 (标准差越小，稳定性越高)
    const stability = Math.max(0, 100 - (stdDev * 2));
    return Math.round(stability);
  }

  /**
   * 获取调试状态
   * @returns {Object} 调试状态
   */
  getDebugStatus() {
    const connectionState = this.bluetoothManager.getConnectionState();
    const protocolStats = this.protocol.getStats();
    const realtimeStats = this.getRealtimeStats();

    return {
      isDebugging: this.debugState.isDebugging,
      connectionState: connectionState,
      protocolStats: protocolStats,
      realtimeStats: realtimeStats,
      dataStorage: {
        realtimeDataCount: this.dataStorage.realtimeData.length,
        historyDataCount: this.dataStorage.historyData.length,
        logCount: this.dataStorage.logs.length,
        errorCount: this.dataStorage.errors.length
      },
      debugState: this.debugState
    };
  }

  /**
   * 记录日志
   * @param {string} level - 日志级别
   * @param {string} message - 日志消息
   * @param {*} data - 相关数据
   */
  log(level, message, data = null) {
    const logEntry = {
      timestamp: Date.now(),
      level: level,
      message: message,
      data: data
    };

    this.dataStorage.logs.push(logEntry);

    // 限制日志数量
    if (this.dataStorage.logs.length > this.debugConfig.maxLogEntries) {
      this.dataStorage.logs = this.dataStorage.logs.slice(-this.debugConfig.maxLogEntries);
    }

    // 控制台输出
    if (this.debugConfig.enableLog) {
      const timeStr = new Date(logEntry.timestamp).toLocaleTimeString();
      const logStr = `[${timeStr}] [${level.toUpperCase()}] ${message}`;

      switch (level) {
        case 'error':
          console.error(logStr, data || '');
          break;
        case 'warning':
          console.warn(logStr, data || '');
          break;
        default:
          console.log(logStr, data || '');
      }
    }

    // 触发日志事件
    this.emit('log', logEntry);
  }

  /**
   * 记录数据日志
   * @param {string} type - 数据类型
   * @param {Object} data - 数据
   */
  logData(type, data) {
    if (!this.debugConfig.enableDataLog) return;

    const dataLog = {
      timestamp: Date.now(),
      type: type,
      data: data
    };

    // 这里可以添加数据日志的专门处理
    this.emit('dataLog', dataLog);
  }

  /**
   * 添加连接历史
   * @param {string} type - 连接事件类型
   * @param {Object} data - 事件数据
   */
  addConnectionHistory(type, data) {
    this.dataStorage.connectionHistory.push({
      timestamp: Date.now(),
      type: type,
      data: data
    });

    // 限制历史记录数量
    if (this.dataStorage.connectionHistory.length > 100) {
      this.dataStorage.connectionHistory = this.dataStorage.connectionHistory.slice(-50);
    }
  }

  /**
   * 开始自动保存
   */
  startAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }

    this.autoSaveTimer = setInterval(() => {
      this.saveDebugData();
    }, this.debugConfig.autoSaveInterval);

    this.log('info', '自动保存已启动');
  }

  /**
   * 停止自动保存
   */
  stopAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }

    this.log('info', '自动保存已停止');
  }

  /**
   * 保存调试数据
   */
  saveDebugData() {
    try {
      const debugData = {
        timestamp: Date.now(),
        sessionInfo: {
          startTime: this.debugState.startTime,
          duration: this.debugState.startTime ? Date.now() - this.debugState.startTime : 0,
          totalDataPoints: this.debugState.totalDataPoints,
          errorCount: this.debugState.errorCount
        },
        dataStorage: this.dataStorage,
        debugStatus: this.getDebugStatus()
      };

      // 触发保存事件，让外部处理实际的保存逻辑
      this.emit('saveData', debugData);

      // this.log('info', '调试数据已保存'); // 暂时注释掉，数据没有被调用

    } catch (error) {
      this.log('error', '保存调试数据失败', error);
    }
  }

  /**
   * 清除数据
   * @param {string} type - 要清除的数据类型
   */
  clearData(type = 'all') {
    switch (type) {
      case 'realtime':
        this.dataStorage.realtimeData = [];
        break;
      case 'history':
        this.dataStorage.historyData = [];
        break;
      case 'logs':
        this.dataStorage.logs = [];
        break;
      case 'errors':
        this.dataStorage.errors = [];
        break;
      case 'all':
      default:
        this.dataStorage.realtimeData = [];
        this.dataStorage.historyData = [];
        this.dataStorage.logs = [];
        this.dataStorage.errors = [];
        this.dataStorage.connectionHistory = [];
        break;
    }

    this.log('info', `已清除 ${type} 数据`);
  }

  /**
   * 导出调试报告
   * @returns {Object} 调试报告
   */
  exportDebugReport() {
    const report = {
      exportTime: Date.now(),
      debugSession: {
        startTime: this.debugState.startTime,
        endTime: this.debugState.isDebugging ? null : Date.now(),
        duration: this.debugState.startTime ?
          (this.debugState.isDebugging ? Date.now() - this.debugState.startTime : null) : null,
        status: this.debugState.isDebugging ? 'running' : 'completed'
      },
      deviceInfo: this.dataStorage.deviceInfo,
      statistics: {
        totalDataPoints: this.debugState.totalDataPoints,
        errorCount: this.debugState.errorCount,
        realtimeDataCount: this.dataStorage.realtimeData.length,
        historyDataCount: this.dataStorage.historyData.length,
        logCount: this.dataStorage.logs.length
      },
      dataSummary: {
        realtimeStats: this.getRealtimeStats(),
        protocolStats: this.protocol.getStats(),
        connectionHistory: this.dataStorage.connectionHistory
      },
      recentErrors: this.dataStorage.errors.slice(-10), // 最近10个错误
      recentLogs: this.dataStorage.logs.slice(-50) // 最近50条日志
    };

    return report;
  }

  /**
   * 事件监听
   * @param {string} event - 事件名称
   * @param {Function} callback - 回调函数
   */
  on(event, callback) {
    if (!this.callbacks) {
      this.callbacks = {};
    }
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
    if (this.callbacks && this.callbacks[event]) {
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
    if (this.callbacks && this.callbacks[event]) {
      const index = this.callbacks[event].indexOf(callback);
      if (index > -1) {
        this.callbacks[event].splice(index, 1);
      }
    }
  }

  /**
   * 发送0x11查询命令
   */
  sendQueryCommand() {
    try {
      // 构建查询帧
      const queryFrame = this.protocol.buildInfoQueryFrame(0);
      const buffer = this.protocol.frameToArrayBuffer(queryFrame);
      
      // 发送数据
      this.bluetoothManager.sendData(buffer).then(() => {
        this.log('info', '查询信息命令发送成功');
      }).catch((err) => {
        this.log('error', '发送查询命令失败:', err);
      });
    } catch (error) {
      this.log('error', '构建查询帧失败:', error);
    }
  }
}

module.exports = OximeterDebugger;