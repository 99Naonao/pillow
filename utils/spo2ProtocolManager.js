/**
 * SPO2模块通信协议管理工具类
 * 基于：亿米蓝牙血氧仪通信协议(透传) V1.3
 * 文档编号：KF-1602-01-002(V1.3)
 */
class Spo2ProtocolManager {
    constructor() {
        this.MODULE_ID = 0x09; // SPO2模块ID
        this.FRAME_HEADER = 0xFF; // 帧头
        this.TRANSMISSION_FREQUENCY = 100; // 默认发送频率100Hz
        this.SELF_CHECK_TIME = 4000; // 自检时间4秒
        this.STABILIZATION_TIME = 5000; // 稳定期5秒
        this.ACK_TIMEOUT = 200; // 应答超时200ms
        this.MAX_RETRY = 3; // 最大重试次数
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
     * 解析测量结果帧 (0x52)
     * @param {Array} frameData 接收到的帧数据
     * @returns {Object} 解析后的测量结果
     */
    parseMeasurementResultFrame(frameData) {
        if (!frameData || frameData.length < 9) {
            console.error('测量结果帧数据长度不足');
            return null;
        }

        const data1 = frameData[0]; // Data1 - 状态信息
        const data2 = frameData[1]; // Data2 - 血氧值
        const data3 = frameData[2]; // Data3 - 脉率低8位
        const data4 = frameData[3]; // Data4 - 脉率高8位
        const data5 = frameData[4]; // Data5 - 灌注度低8位
        const data6 = frameData[5]; // Data6 - 灌注度高8位
        
        // 解析状态信息
        const leadStatus = (data1 & 0x01) !== 0; // Bit0: 导联状态
        const pulseSearchStatus = (data1 & 0x02) !== 0; // Bit1: 脉搏搜索状态
        const weakPerfusionStatus = (data1 & 0x04) !== 0; // Bit2: 弱灌注信息
        const interferenceStatus = (data1 & 0x08) !== 0; // Bit3: 干扰信息
        const arrestStatus = (data1 & 0x10) !== 0; // Bit4: 停搏信息
        const patientType = (data1 >> 5) & 0x03; // Bit5-Bit6: 患者类型
        
        // 解析测量值
        const spo2 = data2 & 0x7F; // 血氧值 0-100
        const pulseRate = (data4 << 8) | data3; // 脉率 25-300 BPM
        const perfusionIndex = ((data6 << 8) | data5) * 0.01; // 灌注度 0-1000 (单位0.01)
        
        // 判断数据是否有效
        const isSpo2Valid = spo2 >= 0 && spo2 <= 100 && spo2 !== 110;
        const isPulseRateValid = pulseRate >= 25 && pulseRate <= 300 && pulseRate !== 400;
        const isPerfusionIndexValid = perfusionIndex >= 0 && perfusionIndex <= 10 && perfusionIndex !== 31;
        
        // 解析电池电压（如果存在）
        let batteryVoltage = null;
        if (frameData.length >= 11) {
            const data7 = frameData[6];
            const data8 = frameData[7];
            batteryVoltage = ((data8 << 8) | data7) * 0.001; // 电池电压 0-4000 mV
        }
        
        return {
            // 状态信息
            leadStatus, // 导联状态
            pulseSearchStatus, // 脉搏搜索状态
            weakPerfusionStatus, // 弱灌注状态
            interferenceStatus, // 干扰信息
            arrestStatus, // 停搏信息
            patientType: ['成人', '小儿', '新生儿', '未定义'][patientType], // 患者类型
            
            // 测量值
            spo2: isSpo2Valid ? spo2 : null, // 血氧值
            pulseRate: isPulseRateValid ? pulseRate : null, // 脉率
            perfusionIndex: isPerfusionIndexValid ? perfusionIndex.toFixed(2) : null, // 灌注度
            batteryVoltage: batteryVoltage, // 电池电压
            
            // 数据有效性
            isValid: isSpo2Valid && isPulseRateValid && isPerfusionIndexValid
        };
    }

    /**
     * 解析描记波帧 (0x53)
     * @param {Array} frameData 接收到的帧数据
     * @returns {Array} 解析后的波形数据数组
     */
    parseWaveformFrame(frameData) {
        if (!frameData || frameData.length < 3) {
            console.error('描记波帧数据长度不足');
            return [];
        }

        const waveforms = [];
        let index = 0;
        
        while (index + 3 <= frameData.length) {
            const data1 = frameData[index]; // 描记波数据
            const data2 = frameData[index + 1]; // 棒图数据 + 脉搏声音
            const data3 = frameData[index + 2]; // 波形系列号
            
            const waveformData = data1 & 0x7F; // 描记波数据 0-100
            const barGraphData = data2 & 0x3F; // 棒图数据 0-15
            const pulseSound = (data2 & 0x40) !== 0; // 脉搏声音
            const waveformSerialNumber = data3; // 波形系列号 0-255
            
            waveforms.push({
                waveformData, // 描记波数据
                barGraphData, // 棒图数据
                pulseSound, // 是否有脉搏音
                waveformSerialNumber // 波形系列号
            });
            
            index += 3;
        }
        
        return waveforms;
    }

    /**
     * 解析版本信息帧 (0x56)
     * @param {Array} frameData 接收到的帧数据
     * @returns {Object} 版本信息
     */
    parseVersionInfoFrame(frameData) {
        if (!frameData || frameData.length < 4) {
            console.error('版本信息帧数据长度不足');
            return null;
        }

        const data1 = frameData[0]; // 版本类型
        const data2 = frameData[1]; // 软件主版本
        const data3 = frameData[2]; // 软件次版本
        const data4 = frameData[3]; // 软件低版本
        
        const versionType = data1 & 0x7F;
        const majorVersion = data2 & 0x7F;
        const minorVersion = data3 & 0x7F;
        const patchVersion = data4 & 0x7F;
        
        const versionString = `V${majorVersion.toString().padStart(2, '0')}.${minorVersion}.${patchVersion}`;
        
        return {
            versionType: versionType === 0 ? '软件版本' : '未定义',
            majorVersion,
            minorVersion,
            patchVersion,
            versionString
        };
    }

    /**
     * 验证帧格式
     * @param {Array} frame 完整帧数据
     * @returns {boolean} 是否为有效帧
     */
    validateFrame(frame) {
        if (!frame || frame.length < 5) {
            return false;
        }
        
        // 检查帧头
        if (frame[0] !== this.FRAME_HEADER) {
            return false;
        }
        
        // 检查帧长度
        const frameLength = frame[1];
        if (frame.length !== frameLength + 2) {
            return false;
        }
        
        // 检查校验和
        const frameData = frame.slice(2, frame.length - 1);
        const calculatedChecksum = this.calculateChecksum(frameData);
        const receivedChecksum = frame[frame.length - 1];
        
        return calculatedChecksum === receivedChecksum;
    }

    /**
     * 转换ArrayBuffer为帧数据
     * @param {ArrayBuffer} buffer 接收到的ArrayBuffer
     * @returns {Array} 帧数据数组
     */
    arrayBufferToFrame(buffer) {
        const bytes = new Uint8Array(buffer);
        return Array.from(bytes);
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
}

module.exports = Spo2ProtocolManager;

