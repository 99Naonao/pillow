# SPO2模块通信协议管理工具类使用说明

## 概述

`spo2ProtocolManager.js` 是基于亿米蓝牙血氧仪通信协议(V1.3)实现的工具类，用于处理SPO2模块与上位机之间的通信协议。

## 功能特性

- ✅ 构建标准通信帧
- ✅ 解析返回数据帧
- ✅ 校验帧格式完整性
- ✅ 支持ArrayBuffer与数组之间转换
- ✅ 完整的错误处理

## 基本使用方法

### 1. 引入工具类

```javascript
const Spo2ProtocolManager = require('../../utils/spo2ProtocolManager');
const spo2Manager = new Spo2ProtocolManager();
```

### 2. 构建命令帧

#### 查询软件版本
```javascript
const queryVersionFrame = spo2Manager.buildInfoQueryFrame(0); // 0=软件版本
const buffer = spo2Manager.frameToArrayBuffer(queryVersionFrame);
// 通过蓝牙发送buffer
```

#### 设备绑定设置
```javascript
const bindingFrame = spo2Manager.buildDeviceBindingFrame(1); // 1=绑定
const buffer = spo2Manager.frameToArrayBuffer(bindingFrame);
// 通过蓝牙发送buffer
```

### 3. 解析接收数据

#### 解析测量结果帧 (0x52)
```javascript
const receivedBuffer = /* 从蓝牙接收到的ArrayBuffer */;
const frameData = spo2Manager.arrayBufferToFrame(receivedBuffer);

// 验证帧格式
if (spo2Manager.validateFrame(frameData)) {
    const result = spo2Manager.parseMeasurementResultFrame(frameData.slice(3, -1));
    console.log('血氧值:', result.spo2);
    console.log('脉率:', result.pulseRate);
    console.log('灌注度:', result.perfusionIndex);
    console.log('电池电压:', result.batteryVoltage);
}
```

#### 解析描记波帧 (0x53)
```javascript
const frameData = spo2Manager.arrayBufferToFrame(receivedBuffer);
if (spo2Manager.validateFrame(frameData)) {
    const waveforms = spo2Manager.parseWaveformFrame(frameData.slice(3, -1));
    waveforms.forEach(wave => {
        console.log('描记波数据:', wave.waveformData);
        console.log('棒图数据:', wave.barGraphData);
        console.log('脉搏音:', wave.pulseSound);
    });
}
```

#### 解析版本信息帧 (0x56)
```javascript
const frameData = spo2Manager.arrayBufferToFrame(receivedBuffer);
if (spo2Manager.validateFrame(frameData)) {
    const versionInfo = spo2Manager.parseVersionInfoFrame(frameData.slice(3, -1));
    console.log('版本:', versionInfo.versionString);
    console.log('主版本:', versionInfo.majorVersion);
}
```

## 帧结构说明

### 标准帧格式
```
[帧头(0xFF)] [帧长] [模块ID+ACK] [命令] [命令数据...] [校验和]
```

### 帧域说明
- **帧头**: 0xFF (1字节)
- **帧长**: 模块ID+命令+命令数据+校验和的总长度 (1字节)
- **模块ID**: 0x09 (Bit0-Bit5)，Bit6为ACK标记 (1字节)
- **命令**: 命令ID (1字节)
- **命令数据**: 根据具体命令定义 (N-5字节)
- **校验和**: 字节累加校验和，若和为0xFF则减1 (1字节)

## 支持的命令

### 下行帧（主机发送给模块）

| 命令ID | 名称 | 说明 |
|--------|------|------|
| 0x11 | 信息查询帧 | 查询软件版本等信息 |
| 0x12 | 设备绑定设置帧 | 设置设备绑定状态 |
| 0x17 | 应答帧 | 应答帧（保留） |

### 上行帧（模块发送给主机）

| 命令ID | 名称 | 说明 |
|--------|------|------|
| 0x52 | 测量结果帧 | 包含血氧值、脉率、灌注度等 |
| 0x53 | 描记波帧 | 包含波形数据 |
| 0x54-0x55 | 保留帧 | 保留使用 |
| 0x56 | 版本信息帧 | 包含软件版本信息 |

## 测量数据说明

### 测量结果帧 (0x52) 包含：
- **血氧值**: 0-100，无效值110
- **脉率**: 25-300 BPM，无效值400
- **灌注度**: 0-1000 (单位0.01)，显示为百分比，无效值3100
- **电池电压**: 0-4000 mV (可选)
- **状态信息**: 导联状态、脉搏搜索、弱灌注、干扰、停搏等

### 描记波帧 (0x53) 包含：
- **描记波数据**: 0-100 (用于绘制波形)
- **棒图数据**: 0-15 (用于绘制柱状图)
- **脉搏声音**: 有/无脉搏音
- **波形系列号**: 0-255 (用于数据同步)

## 协议特点

1. **发送频率**: 默认100Hz（定制需客户提出）
2. **自检时间**: < 4秒，期间不响应
3. **稳定期**: 5秒，期间测量值无效
4. **应答超时**: 200ms无应答视为通信错误
5. **数据格式**: 避免浮点数，实际值分别乘以10/100/1000

## 注意事项

1. 模块按接收的先后次序依次执行帧
2. 除周期性返回消息外，其它消息都是执行用户帧引发的
3. 连续2个脉搏音，上位机只触发一次
4. 使用数据时应注意各个参数值实际有效范围

## 完整示例

```javascript
const Spo2ProtocolManager = require('../../utils/spo2ProtocolManager');

Page({
    onLoad() {
        this.spo2Manager = new Spo2ProtocolManager();
    },

    // 查询版本
    async queryVersion() {
        const frame = this.spo2Manager.buildInfoQueryFrame(0);
        const buffer = this.spo2Manager.frameToArrayBuffer(frame);
        
        // 通过蓝牙发送
        await this.sendBluetoothData(buffer);
    },

    // 解析接收数据
    handleBluetoothData(buffer) {
        const frame = this.spo2Manager.arrayBufferToFrame(buffer);
        
        if (!this.spo2Manager.validateFrame(frame)) {
            console.error('帧格式验证失败');
            return;
        }
        
        const command = frame[3];
        const frameData = frame.slice(4, frame.length - 1);
        
        switch(command) {
            case 0x52: // 测量结果
                const result = this.spo2Manager.parseMeasurementResultFrame(frameData);
                console.log('测量结果:', result);
                break;
                
            case 0x53: // 描记波
                const waveforms = this.spo2Manager.parseWaveformFrame(frameData);
                this.drawWaveform(waveforms);
                break;
                
            case 0x56: // 版本信息
                const version = this.spo2Manager.parseVersionInfoFrame(frameData);
                console.log('软件版本:', version.versionString);
                break;
        }
    },

    // 发送蓝牙数据
    async sendBluetoothData(buffer) {
        // 实现蓝牙发送逻辑
    },

    // 绘制波形
    drawWaveform(waveforms) {
        // 实现波形绘制逻辑
    }
});
```

## 技术支持

文档编号：KF-1602-01-002(V1.3)  
版本：V1.3  
公司：深圳市亿米生命科技有限公司

