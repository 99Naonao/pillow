/**
 * 亿米蓝牙血氧仪通信协议解析类
 * 基于：亿米蓝牙血氧仪通信协议(透传) V1.3
 * 文档编号：KF-1602-01-002(V1.3)
 */
class YimiOximeterProtocol {
  constructor() {
    this.MODULE_ID = 0x09; // SPO2模块ID
    this.FRAME_HEADER = 0xFF; // 帧头
    this.TRANSMISSION_FREQUENCY = 100; // 默认发送频率100Hz
    this.SELF_CHECK_TIME = 4000; // 自检时间4秒
    this.STABILIZATION_TIME = 5000; // 稳定期5秒
    this.ACK_TIMEOUT = 200; // 应答超时200ms
    this.MAX_RETRY = 3; // 最大重试次数

    // 数据缓存
    this.receiveBuffer = [];
    this.callbacks = {};

    // 统计数据
    this.stats = {
      totalFrames: 0,
      validFrames: 0,
      errorFrames: 0,
      lastValidTime: null
    };
  }

  /**
   * 计算帧校验和
   * @param {Array} frameData 帧数据（不包括帧头和校验和）
   * @returns {number} 校验和
   */
  calculateChecksum(frameData) {
    let sum = 0;
    for (let byte of frameData) {
      sum = (sum + byte) & 0xFF;
    }
    // 如果和等于0xFF，则减1
    if (sum === 0xFF) {
      sum = 0xFE;
    }
    return sum;
  }

  /**
   * 构建帧
   * @param {number} command 命令ID
   * @param {Array} data 命令数据
   * @param {boolean} needAck 是否需要应答
   * @returns {Array} 完整的帧数据
   */
  buildFrame(command, data = [], needAck = false) {
    // 帧数据：模块ID(含ACK标记) + 命令 + 命令数据
    const frameData = [];
    
    // 模块ID + ACK标记
    let moduleByte = this.MODULE_ID;
    if (needAck) {
      moduleByte |= 0x40; // Bit6 = 1 表示需要应答
    }
    frameData.push(moduleByte);
    
    // 命令
    frameData.push(command);
    
    // 命令数据
    frameData.push(...data);
    
    // 计算校验和
    const checksum = this.calculateChecksum(frameData);
    
    // 帧长度 = 模块ID + 命令 + 命令数据 + 校验和
    const frameLength = frameData.length + 1;
    
    // 构建完整帧：帧头 + 帧长 + 帧数据 + 校验和
    const frame = [this.FRAME_HEADER, frameLength, ...frameData, checksum];
    
    return frame;
  }

  /**
   * 信息查询帧 (0x11)
   * @param {number} queryType 查询信息类型 0=软件版本
   * @returns {Array} 帧数据
   */
  buildInfoQueryFrame(queryType = 0) {
    const data = [queryType & 0x0F]; // Bit0-Bit3: 查询信息类型
    return this.buildFrame(0x11, data, false);
  }

  /**
   * 设备绑定设置帧 (0x12)
   * @param {number} bindingStatus 绑定状态 0=解锁 1=绑定
   * @returns {Array} 帧数据
   */
  buildDeviceBindingFrame(bindingStatus = 0) {
    const data = [bindingStatus & 0x1F]; // Bit0-Bit4: 绑定参数
    return this.buildFrame(0x12, data, false);
  }

  /**
   * 应答帧 (0x17)
   * @param {number} frameId 需要应答的帧ID
   * @returns {Array} 帧数据
   */
  buildAckFrame(frameId) {
    const data = [frameId & 0x7F]; // Bit0-Bit6: 帧ID
    return this.buildFrame(0x17, data, false);
  }

  /**
   * 发送ACK应答帧
   * @param {number} frameId - 需要应答的帧ID（通常是命令ID）
   */
  sendAckFrame(frameId) {
    console.log(`[协议] 📤 发送ACK应答帧，应答命令: 0x${frameId.toString(16).padStart(2, '0')}`);
    const ackFrame = this.buildAckFrame(frameId);
    const buffer = this.frameToArrayBuffer(ackFrame);
    
    // 触发发送事件，由蓝牙管理器发送
    this.emit('sendAck', buffer);
  }

  /**
   * 解析接收到的数据（直接处理，不使用缓冲区）
   * @param {ArrayBuffer} data 接收到的原始数据
   */
  parseData(data) {
    // 将ArrayBuffer转换为数组
    const dataView = new DataView(data);
    const receivedBytes = [];
    for (let i = 0; i < data.byteLength; i++) {
      const byte = dataView.getUint8(i);
      receivedBytes.push(byte);
    }
    
    // 直接处理这个数据包，不使用缓冲区
    this.parseSinglePacket(receivedBytes);
  }

  /**
   * 解析单个数据包（不使用缓冲区）
   * @param {Array} packet 数据包字节数组
   */
  parseSinglePacket(packet) {
    // 检查最小帧长度
    if (packet.length < 5) {
      return;
    }
    
    // 检查帧头
    if (packet[0] !== this.FRAME_HEADER) {

      return;
    }
    
    // 解析帧长度
    const frameLength = packet[1];
    const frameTotalLength = 1 + 1 + frameLength; // 帧头 + 长度字段 + 数据长度
      
    // 检查数据包长度
    if (packet.length < frameTotalLength) {
      return;
    }
    
    // 提取完整帧
    const frame = packet.slice(0, frameTotalLength);
    
    // 验证校验和
    const frameData = frame.slice(1, frame.length - 1);
    const calculatedChecksum = this.calculateChecksum(frameData);
    const receivedChecksum = frame[frame.length - 1];
    
    if (calculatedChecksum !== receivedChecksum) {
      return;
    }
    
    // 解析命令ID和数据
    const moduleAndAck = frame[2];
    const commandId = frame[3];
    const data = frame.slice(4, frame.length - 1);
    
    // 检查commandId是否有效
    if (commandId === undefined || isNaN(commandId)) {
      console.error('[协议] ❌ commandId无效:', commandId);
      return;
    }
    
    // 提取Module-ID和ACK标记
    const moduleId = moduleAndAck & 0x3F;
    const needAck = (moduleAndAck & 0x40) !== 0;
    
    // 处理帧
    this.handleFrame(commandId, data, needAck);
    
    // 更新统计
    this.stats.totalFrames++;
    this.stats.validFrames++;
    this.stats.lastValidTime = Date.now();
  }

  /**
   * 解析完整的协议帧（保留原方法，但不再使用）
   */
  parseFrames() {
    while (this.receiveBuffer.length >= 5) {
      // 查找帧头
      let headerIndex = -1;
      for (let i = 0; i < this.receiveBuffer.length; i++) {
        if (this.receiveBuffer[i] === this.FRAME_HEADER) {
          headerIndex = i;
          break;
        }
      }

      if (headerIndex === -1) {
        // 没有找到帧头，清空缓存
        // console.log('[协议] 未找到帧头，清空缓存');
        this.receiveBuffer = [];
        break;
      }

      // 移除帧头前的数据
      if (headerIndex > 0) {
        // console.log(`[协议] 帧头不在开头，偏移${headerIndex}字节，移除前导数据`);
        this.receiveBuffer.splice(0, headerIndex);
        this.stats.errorFrames++;
      }

      // 检查是否有足够的数据来解析帧
      if (this.receiveBuffer.length < 5) {
        break;
      }
      const frameLength = this.receiveBuffer[1];

      const frameTotalLength = 1 + 1 + frameLength;
      
      // 检查是否有完整的帧
      if (this.receiveBuffer.length < frameTotalLength) {
        // console.log(`[协议] 数据不足，需要${frameTotalLength}字节，实际${this.receiveBuffer.length}字节`);
        break;
      }

      // 提取完整帧
      const frame = this.receiveBuffer.slice(0, frameTotalLength);

      // 验证校验和
      const frameData = frame.slice(1, frame.length - 1);
      const calculatedChecksum = this.calculateChecksum(frameData);
      const receivedChecksum = frame[frame.length - 1];

      if (calculatedChecksum !== receivedChecksum) {
        this.receiveBuffer.splice(0, 1);
        this.stats.errorFrames++;
        continue;
      }

      // 解析命令ID和数据
      const moduleAndAck = frame[2];
      const commandId = frame[3];
      const data = frame.slice(4, frame.length - 1);
      
      // 检查commandId是否有效
      if (commandId === undefined || isNaN(commandId)) {
        console.error('[协议] ❌ commandId无效:', commandId);
        this.receiveBuffer.splice(0, frameTotalLength);
        this.stats.errorFrames++;
        continue;
      }
      
      // 提取Module-ID和ACK标记
      const moduleId = moduleAndAck & 0x3F;
      const needAck = (moduleAndAck & 0x40) !== 0;

      // 处理帧
      this.handleFrame(commandId, data, needAck);

      // 移除已处理的帧
      this.receiveBuffer.splice(0, frameTotalLength);
      this.stats.totalFrames++;
      this.stats.validFrames++;
      this.stats.lastValidTime = Date.now();
    }
  }

  /**
   * 处理解析后的帧数据
   * @param {number} cmd - 命令字
   * @param {Array} data - 数据内容
   * @param {boolean} needAck - 是否需要应答
   */
  handleFrame(cmd, data, needAck) {
    // 防御性检查：确保cmd有效
    if (cmd === undefined || cmd === null || isNaN(cmd)) {
      console.error('[协议] ❌ handleFrame收到无效的命令字:', cmd);
      return;
    }
    
    console.log(`[协议] 收到命令: 0x${cmd.toString(16).padStart(2, '0')}, 需要应答: ${needAck}`);

    // 如果需要应答，发送ACK帧
    if (needAck) {
      console.log('[协议] 📤 收到需要应答的帧，准备发送ACK应答');
      this.sendAckFrame(cmd);
    }

    switch (cmd) {
      case 0x52: // 测量结果帧
        this.handleMeasurementResult(data);
        break;
        
      case 0x53: // 描记波帧
        this.handleWaveform(data);
        break;
        
      case 0x56: // 版本信息帧
        this.handleVersionInfo(data);
        break;
        
      case 0x17: // 应答帧（设备对我们的应答）
        // console.log('[协议] 收到设备的ACK应答帧');
        this.emit('ackReceived', { frameId: data[0] });
        break;
        
      default:
        console.warn(`[协议] 未知命令: 0x${cmd.toString(16).padStart(2, '0')}`);
    }
  }

  /**
   * 处理测量结果帧 (0x52)
   * @param {Array} data - 实时数据
   */
  handleMeasurementResult(data) {
    console.log('[协议] 开始解析测量结果帧，数据长度:', data.length);
    console.log('[协议] 原始数据:', data.map(b => b.toString(16).padStart(2, '0')).join(' '));
    
    // 协议：测量结果帧(0x52)数据结构
    // Data1: 状态信息（导联、脉搏搜索、弱灌注、干扰、停搏、患者类型）
    // Data2: 血氧值 (0-100, 无效值110)
    // Data3-4: 脉率值 (25-300 BPM, 无效值400, 低字节在前)
    // Data5-6: 灌注度 (0-1000, 单位0.01%, 无效值3100, 低字节在前)
    // Data7-8: 电池电压 (0-4000mV, 可选, 低字节在前)
    // 无电池信息: 6字节数据; 有电池信息: 8字节数据
    if (data.length < 6) {
      console.error('[协议] 测量结果帧数据长度不足，期望至少6字节，实际:', data.length);
      return;
    }

    // 解析状态信息（Data1）
    const statusByte = data[0];
    const leadStatus = (statusByte & 0x01) !== 0;
    const pulseSearchStatus = (statusByte & 0x02) !== 0;
    const weakPerfusionStatus = (statusByte & 0x04) !== 0;
    const interferenceStatus = (statusByte & 0x08) !== 0;
    const arrestStatus = (statusByte & 0x10) !== 0;
    const patientTypeCode = (statusByte >> 5) & 0x03;
    
    // 患者类型映射
    const patientTypes = ['成人', '小儿', '新生儿', '未定义'];
    const patientType = patientTypes[patientTypeCode] || '未定义';
    
    // 解析测量值
    const spo2Raw = data[1] & 0x7F; // Data2: 血氧值 (0-100), 无效值110
    const pulseRateRaw = (data[3] << 8) | data[2]; // Data3+Data4: 脉率 (25-300), 无效值400
    const perfusionIndexRaw = (data[5] << 8) | data[4]; // Data5+Data6: 灌注度 (0-1000, 单位0.01), 无效值3100
    const batteryVoltageRaw = data.length >= 8 ? (data[7] << 8) | data[6] : null; // Data7+Data8: 电池电压 (0-4000, 单位mV)
    
    // 检查无效值并过滤
    const spo2 = spo2Raw === 110 ? null : spo2Raw;
    const pulseRate = pulseRateRaw === 400 ? null : pulseRateRaw;
    const perfusionIndex = perfusionIndexRaw === 3100 ? null : (perfusionIndexRaw * 0.01); // 转换为百分比
    const batteryVoltage = batteryVoltageRaw === null ? null : (batteryVoltageRaw * 0.001); // 转换为V
    
    const result = {
      timestamp: Date.now(),
      // 状态信息
      leadStatus: leadStatus,
      pulseSearchStatus: pulseSearchStatus,
      weakPerfusionStatus: weakPerfusionStatus,
      interferenceStatus: interferenceStatus,
      arrestStatus: arrestStatus,
      patientType: patientType,
      patientTypeCode: patientTypeCode,
      // 测量值
      spo2: spo2,
      pulseRate: pulseRate,
      perfusionIndex: perfusionIndex,
      batteryVoltage: batteryVoltage
    };
    
    console.log('[协议] 字节映射:', {
      'Data1(状态)': '0x' + data[0].toString(16).padStart(2, '0'),
      'Data2(血氧)': '0x' + data[1].toString(16).padStart(2, '0'),
      'Data3(脉率低)': '0x' + data[2].toString(16).padStart(2, '0'),
      'Data4(脉率高)': '0x' + data[3].toString(16).padStart(2, '0'),
      'Data5(灌注低)': '0x' + data[4].toString(16).padStart(2, '0'),
      'Data6(灌注高)': '0x' + data[5].toString(16).padStart(2, '0'),
      'Data7(电池低)': data.length >= 8 ? '0x' + data[6].toString(16).padStart(2, '0') : 'N/A',
      'Data8(电池高)': data.length >= 8 ? '0x' + data[7].toString(16).padStart(2, '0') : 'N/A'
    });

    console.log('[协议] 解析完成，测量结果:', JSON.stringify(result, null, 2));
    console.log('[协议] 触发realtimeData事件');
    this.emit('realtimeData', result);
  }

  /**
   * 处理描记波帧 (0x53)
   * @param {Array} data - 波形数据
   */
  handleWaveform(data) {
    const waveforms = [];
    
    // 每组数据3字节：描记波 + 棒图+脉搏音 + 序列号
    for (let i = 0; i < data.length; i += 3) {
      if (i + 2 < data.length) {
        waveforms.push({
          waveformData: data[i] & 0x7F,
          barGraphData: data[i + 1] & 0x3F,
          pulseSound: (data[i + 1] & 0x40) !== 0,
          waveformSerialNumber: data[i + 2]
        });
      }
    }

    console.log(`[协议] 描记波数据，数量: ${waveforms.length}`);
    this.emit('waveformData', waveforms);
  }

  /**
   * 处理版本信息帧 (0x56)
   * @param {Array} data - 版本信息数据
   */
  handleVersionInfo(data) {
    if (data.length < 4) {
      console.error('[协议] 版本信息帧数据长度不足');
      return;
    }

    const versionInfo = {
      versionType: (data[0] & 0x7F) === 0 ? '软件版本' : '未定义',
      majorVersion: data[1] & 0x7F,
      minorVersion: data[2] & 0x7F,
      patchVersion: data[3] & 0x7F,
      versionString: `V${(data[1] & 0x7F).toString().padStart(2, '0')}.${data[2] & 0x7F}.${data[3] & 0x7F}`
    };

    console.log('[协议] 版本信息:', versionInfo);
    this.emit('deviceInfo', versionInfo);
  }

  /**
   * 转换帧数据为ArrayBuffer
   * @param {Array} frame 帧数据数组
   * @returns {ArrayBuffer} ArrayBuffer
   */
  frameToArrayBuffer(frame) {
    const buffer = new ArrayBuffer(frame.length);
    const view = new Uint8Array(buffer);
    frame.forEach((byte, index) => {
      view[index] = byte;
    });
    return buffer;
  }

  /**
   * 获取统计数据
   * @returns {Object} 统计数据
   */
  getStats() {
    return {
      ...this.stats,
      bufferLength: this.receiveBuffer.length,
      errorRate: this.stats.totalFrames > 0 ?
        (this.stats.errorFrames / this.stats.totalFrames * 100).toFixed(2) + '%' : '0%'
    };
  }

  /**
   * 重置统计数据
   */
  resetStats() {
    this.stats = {
      totalFrames: 0,
      validFrames: 0,
      errorFrames: 0,
      lastValidTime: null
    };
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

module.exports = YimiOximeterProtocol;
