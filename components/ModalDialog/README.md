# ModalDialog 弹窗组件

一个功能丰富、可配置的微信小程序弹窗组件，支持标题、图标、视频内容以及确定、取消按钮。

## 功能特性

- ✅ 可配置标题和图标
- ✅ 支持视频播放
- ✅ 可自定义按钮文字和样式
- ✅ 支持遮罩点击关闭
- ✅ 响应式设计，适配不同屏幕
- ✅ 支持深色模式
- ✅ 丰富的动画效果
- ✅ 完整的事件回调

## 使用方法

### 1. 在页面JSON中引入组件

```json
{
  "usingComponents": {
    "modal-dialog": "/components/ModalDialog/modalDialog"
  }
}
```

### 2. 在WXML中使用組件

```xml
<!-- 基础弹窗 -->
<modal-dialog
  visible="{{showModal}}"
  title="提示"
  content="这是一个基础弹窗"
  bind:confirm="onConfirm"
  bind:cancel="onCancel"
  bind:close="onClose"
></modal-dialog>

<!-- 带图标的弹窗 -->
<modal-dialog
  visible="{{showIconModal}}"
  title="成功"
  icon="/static/success.png"
  content="操作成功完成"
  confirm-text="知道了"
  show-cancel="{{false}}"
  bind:confirm="onConfirm"
></modal-dialog>

<!-- 视频弹窗 -->
<modal-dialog
  visible="{{showVideoModal}}"
  title="视频教程"
  video-src="{{videoUrl}}"
  video-poster="{{videoPoster}}"
  video-controls="{{true}}"
  bind:confirm="onConfirm"
  bind:cancel="onCancel"
></modal-dialog>

<!-- 自定义内容弹窗 -->
<modal-dialog
  visible="{{showCustomModal}}"
  title="自定义内容"
  bind:confirm="onConfirm"
  bind:cancel="onCancel"
>
  <view slot="content">
    <text>这里是自定义内容</text>
    <image src="/static/custom.png" style="width: 200rpx; height: 200rpx;"></image>
  </view>
</modal-dialog>
```

### 3. 在JS中處理事件

```javascript
Page({
  data: {
    showModal: false,
    showIconModal: false,
    showVideoModal: false,
    showCustomModal: false,
    videoUrl: 'https://example.com/video.mp4',
    videoPoster: '/static/video-poster.jpg'
  },

  // 显示弹窗
  showModal() {
    this.setData({
      showModal: true
    });
  },

  // 确定按钮点击
  onConfirm(e) {
    console.log('确定按钮被点击', e.detail);
    this.setData({
      showModal: false
    });
  },

  // 取消按钮点击
  onCancel(e) {
    console.log('取消按钮被点击', e.detail);
    this.setData({
      showModal: false
    });
  },

  // 关闭弹窗
  onClose(e) {
    console.log('弹窗被关闭', e.detail);
    this.setData({
      showModal: false
    });
  }
});
```

## 属性配置

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| visible | Boolean | false | 是否显示弹窗 |
| title | String | '' | 标题文字 |
| icon | String | '' | 图标路径 |
| content | String | '' | 内容文字 |
| videoSrc | String | '' | 视频源地址 |
| videoPoster | String | '' | 视频封面 |
| videoControls | Boolean | true | 视频是否显示控制条 |
| videoAutoplay | Boolean | false | 视频是否自动播放 |
| showCancel | Boolean | true | 是否显示取消按钮 |
| showConfirm | Boolean | true | 是否显示确定按钮 |
| showClose | Boolean | true | 是否显示关闭按钮 |
| cancelText | String | '取消' | 取消按钮文字 |
| confirmText | String | '确定' | 确定按钮文字 |
| cancelType | String | 'default' | 取消按钮类型 |
| confirmType | String | 'primary' | 确定按钮类型 |
| confirmLoading | Boolean | false | 确定按钮加载状态 |
| maskClosable | Boolean | true | 点击遮罩是否关闭 |
| width | String | '600rpx' | 弹窗宽度 |
| height | String | 'auto' | 弹窗高度 |

## 事件回调

| 事件名 | 说明 | 回调参数 |
|--------|------|----------|
| confirm | 确定按钮点击 | {visible: false} |
| cancel | 取消按钮点击 | {visible: false} |
| close | 弹窗关闭 | {visible: false} |
| show | 弹窗显示 | {visible: true} |
| videoplay | 视频播放 | 视频事件详情 |
| videopause | 视频暂停 | 视频事件详情 |
| videoerror | 视频错误 | 视频事件详情 |

## 方法调用

组件提供了以下方法供外部调用：

```javascript
// 获取组件实例
const modal = this.selectComponent('#modal');

// 显示弹窗
modal.show();

// 关闭弹窗
modal.close();

// 切换显示状态
modal.toggle();
```

## 样式自定义

组件支持通过CSS变量进行样式自定义：

```css
/* 自定义弹窗样式 */
.modal-container {
  --modal-border-radius: 20rpx;
  --modal-bg-color: #fff;
  --modal-title-color: #333;
  --modal-text-color: #666;
}
```

## 注意事项

1. 视频播放需要在小程序后台配置相应的域名白名单
2. 建议在真机上测试视频播放功能
3. 组件使用了TDesign的图标组件，确保已正确引入
4. 自定义内容通过slot插槽实现，支持任意WXML结构
