# 血氧仪设备管理使用指南

## 概述

血氧仪设备（oximeter）和枕头是两个独立的设备：
- **枕头（zzZMinga）**：通过WiFi连接，数据通过后端API获取
- **血氧仪**：通过蓝牙连接，使用SPO2协议通信

## 文件结构

```
utils/
├── spo2ProtocolManager.js      # SPO2协议解析工具（已存在）
├── oximeterDeviceManager.js    # 血氧仪蓝牙连接和设备管理（新建）
└── OXIMETER_USAGE.md          # 使用说明（本文档）
```

## 使用方法

### 1. 在页面中引入

```javascript
const OximeterDeviceManager = require('../../utils/oximeterDeviceManager');

Page({
  data: {
    spo2: null,           // 血氧值
    pulseRate: null,      // 脉率
    perfusionIndex: null, // 灌注度
    batteryVoltage: null  // 电池电压
  },

  onLoad() {
    // 初始化血氧仪管理器
    this.oximeterManager = new OximeterDeviceManager(this);
    
    // 设置数据更新回调
    this.oximeterManager.setOnDataUpdateCallback((data) => {
      this.setData({
        spo2: data.spo2,
        pulseRate: data.pulseRate,
        perfusionIndex: data.perfusionIndex,
        batteryVoltage: data.batteryVoltage
      });
    });
  }
})
```

### 2. 搜索并连接设备

```javascript
async connectOximeter() {
  try {
    // 1. 搜索血氧仪设备
    wx.showLoading({ title: '搜索设备中...' });
    
    const devices = await this.oximeterManager.startBluetoothSearch();
    
    if (devices.length === 0) {
      wx.hideLoading();
      wx.showModal({
        title: '提示',
        content: '未找到血氧仪设备，请确保设备已开启蓝牙',
        showCancel: false
      });
      return;
    }
    
    // 2. 连接第一个找到的设备（实际应用中可以让用户选择）
    const targetDevice = devices[0];
    
    await this.oximeterManager.connectDevice(targetDevice.deviceId);
    
    wx.hideLoading();
    wx.showToast({
      title: '连接成功',
      icon: 'success'
    });
  } catch (error) {
    wx.hideLoading();
    wx.showModal({
      title: '连接失败',
      content: error.message || '无法连接血氧仪设备',
      showCancel: false
    });
  }
}
```

### 3. 断开连接

```javascript
disconnectOximeter() {
  this.oximeterManager.disconnectDevice();
  
  // 清空显示数据
  this.setData({
    spo2: null,
    pulseRate: null,
    perfusionIndex: null,
    batteryVoltage: null
  });
}
```

### 4. 页面卸载时断开连接

```javascript
onUnload() {
  if (this.oximeterManager) {
    this.oximeterManager.disconnectDevice();
  }
}
```

## 完整示例

### home.js

```javascript
const OximeterDeviceManager = require('../../utils/oximeterDeviceManager');
const DeviceManager = require('../../utils/deviceManager');

Page({
  data: {
    // 枕头数据
    heartRate: null,
    breathRate: null,
    
    // 血氧仪数据
    spo2: null,
    perfusionIndex: null,
    batteryVoltage: null
  },

  onLoad() {
    // 初始化管理器
    this.deviceManager = new DeviceManager(this);  // 枕头设备
    this.oximeterManager = new OximeterDeviceManager(this);  // 血氧仪
    
    // 设置血氧仪数据更新回调
    this.oximeterManager.setOnDataUpdateCallback((data) => {
      this.setData({
        spo2: data.spo2,
        perfusionIndex: data.perfusionIndex,
        batteryVoltage: data.batteryVoltage
      });
    });
  },

  // 连接血氧仪
  async connectOximeter() {
    try {
      wx.showLoading({ title: '搜索设备中...' });
      const devices = await this.oximeterManager.startBluetoothSearch();
      
      if (devices.length === 0) {
        wx.hideLoading();
        wx.showModal({
          title: '提示',
          content: '未找到血氧仪设备',
          showCancel: false
        });
        return;
      }
      
      await this.oximeterManager.connectDevice(devices[0].deviceId);
      wx.hideLoading();
      wx.showToast({ title: '连接成功', icon: 'success' });
    } catch (error) {
      wx.hideLoading();
      wx.showModal({ title: '连接失败', content: error.message, showCancel: false });
    }
  },

  // 断开血氧仪
  disconnectOximeter() {
    this.oximeterManager.disconnectDevice();
    this.setData({
      spo2: null,
      perfusionIndex: null,
      batteryVoltage: null
    });
  },

  onUnload() {
    if (this.oximeterManager) {
      this.oximeterManager.disconnectDevice();
    }
  }
})
```

## 数据流程

```
血氧仪设备 ←→ 蓝牙连接 ←→ oximeterDeviceManager ←→ spo2ProtocolManager ←→ 页面数据
```

1. **搜索设备**：`startBluetoothSearch()` 搜索名称包含 "oximeter" 的蓝牙设备
2. **连接设备**：`connectDevice(deviceId)` 建立蓝牙连接，获取服务和特征值
3. **启用通知**：自动启用数据接收通知
4. **发送查询命令**：自动发送查询信息命令（0x11）
5. **接收数据**：`handleDataReceive()` 解析收到的蓝牙数据
6. **更新页面**：通过回调函数 `onDataUpdate` 更新页面显示

## 注意事项

1. **设备名称**：当前搜索逻辑要求设备名称包含 "oximeter"，需要根据实际设备修改
2. **服务UUID**：默认查找包含 "FFF0" 的服务，需要根据实际血氧仪的服务UUID调整
3. **权限**：确保已获取蓝牙相关权限
4. **连接状态**：连接成功后会自动发送查询命令，设备会返回数据
5. **数据解析**：使用 `spo2ProtocolManager` 进行协议解析，支持解析：
   - 测量结果帧 (0x52)：血氧值、脉率、灌注度、电池电压
   - 描记波帧 (0x53)：波形数据
   - 版本信息帧 (0x56)：版本信息

## 调试

启用详细日志查看连接和数据接收过程：

```javascript
// 在设备连接后查看日志
[血氧仪] 连接成功
[血氧仪] 获取到服务: [...]
[血氧仪] 获取到特征值: [...]
[血氧仪] 启用通知成功
[血氧仪] 查询信息命令发送成功
[血氧仪] 接收到命令: 52
[血氧仪] 测量结果: {...}
```

