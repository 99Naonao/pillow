# Blue页面WiFi状态检测功能说明

## 功能概述

在设备连接流程的WiFi配网步骤中，新增了WiFi状态检测功能。当用户手机未开启WiFi时，会显示一个友好的弹窗提示，并在用户开启WiFi后自动检测并获取WiFi列表。

## 主要功能

### 1. WiFi状态检测
- 在进入WiFi配网步骤时，自动检测手机WiFi开关状态
- 如果WiFi未开启，显示弹窗提示用户开启WiFi

### 2. 智能弹窗
- 显示友好的WiFi提示弹窗
- 弹窗内容会根据不同情况显示相应的提示信息
- 用户点击"我知道了"后，系统会重新检测WiFi状态

### 3. 自动重试机制
- 当弹窗显示时，系统会每3秒自动检测一次WiFi状态
- 一旦检测到WiFi已开启，会自动隐藏弹窗并继续WiFi配网流程
- 如果WiFi仍未开启，会继续显示弹窗

## 实现细节

### 核心方法

#### `checkWifiStatus()`
```javascript
// 检查WiFi状态
async checkWifiStatus() {
    return new Promise((resolve) => {
        wx.getSystemInfo({
            success: (res) => {
                // 通过尝试启动WiFi来判断WiFi是否开启
                wx.startWifi({
                    success: () => {
                        resolve({
                            isWifiEnabled: true,
                            systemInfo: res
                        });
                    },
                    fail: () => {
                        resolve({
                            isWifiEnabled: false,
                            systemInfo: res
                        });
                    }
                });
            },
            fail: () => {
                resolve({
                    isWifiEnabled: false,
                    systemInfo: null
                });
            }
        });
    });
}
```

#### `showWifiStatusModal(content)`
```javascript
// 显示WiFi状态弹窗
showWifiStatusModal(content) {
    this.setData({
        showWifiModal: true,
        wifiModalContent: content
    });
    // 启动WiFi状态检测定时器
    this.startWifiStatusCheck();
}
```

#### `checkWifiStatusAndRetry()`
```javascript
// 检查WiFi状态并重试
async checkWifiStatusAndRetry() {
    const wifiStatus = await this.checkWifiStatus();
    if (wifiStatus.isWifiEnabled) {
        // WiFi已开启，重新初始化WiFi步骤
        console.log('WiFi已开启，重新初始化WiFi步骤');
        this.initWifiStep();
    } else {
        // WiFi仍未开启，继续显示弹窗
        this.showWifiStatusModal('请先打开手机WiFi开关');
    }
}
```

### 定时器管理

#### `startWifiStatusCheck()`
```javascript
// 开始WiFi状态检测定时器
startWifiStatusCheck() {
    // 清除之前的定时器
    this.clearWifiStatusCheck();
    
    // 每3秒检查一次WiFi状态
    this.data.wifiStatusCheckTimer = setInterval(() => {
        if (this.data.showWifiModal) {
            this.checkWifiStatusAndRetry();
        }
    }, 3000);
}
```

#### `clearWifiStatusCheck()`
```javascript
// 清除WiFi状态检测定时器
clearWifiStatusCheck() {
    if (this.data.wifiStatusCheckTimer) {
        clearInterval(this.data.wifiStatusCheckTimer);
        this.data.wifiStatusCheckTimer = null;
    }
}
```

## 使用流程

1. **进入WiFi步骤**：用户完成蓝牙连接后，自动进入WiFi配网步骤
2. **WiFi状态检测**：系统自动检测手机WiFi开关状态
3. **弹窗提示**：如果WiFi未开启，显示弹窗提示用户
4. **自动重试**：弹窗显示期间，每3秒自动检测一次WiFi状态
5. **自动继续**：检测到WiFi开启后，自动隐藏弹窗并继续配网流程

## 弹窗样式

弹窗采用现代化的设计风格：
- 半透明黑色背景遮罩
- 圆角卡片式弹窗
- WiFi图标和标题
- 居中显示提示内容
- 蓝色渐变按钮

## 注意事项

1. **权限要求**：需要用户授权位置信息权限才能获取WiFi列表
2. **系统兼容**：支持iOS和Android系统
3. **性能优化**：定时器会在页面隐藏或卸载时自动清除
4. **用户体验**：弹窗不会阻塞用户操作，用户可以随时点击按钮

## 错误处理

- 如果WiFi权限被拒绝，会显示相应的错误提示
- 如果获取WiFi列表失败，会显示具体的错误信息
- 所有错误都会通过弹窗友好地提示给用户

## 扩展功能

未来可以考虑添加的功能：
- WiFi信号强度显示
- 自动连接历史WiFi
- WiFi密码记忆功能
- 更多WiFi相关设置选项 