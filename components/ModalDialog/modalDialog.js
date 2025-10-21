Component({
  externalClasses: ['custom-class', 'confirm-class'],
  options: {
    styleIsolation: 'apply-shared'
  },
  /**
   * 组件的属性列表
   */
  properties: {
    // 是否显示弹窗
    visible: {
      type: Boolean,
      value: false
    },
    // 标题
    title: {
      type: String,
      value: ''
    },
    // 图标路径
    icon: {
      type: String,
      value: ''
    },
    // 内容文字
    content: {
      type: String,
      value: ''
    },
    // 视频源地址
    videoSrc: {
      type: String,
      value: ''
    },
    // 视频封面
    videoPoster: {
      type: String,
      value: ''
    },
    // 视频是否显示控制条
    videoControls: {
      type: Boolean,
      value: true
    },
    // 视频是否自动播放
    videoAutoplay: {
      type: Boolean,
      value: false
    },
    // 是否显示取消按钮
    showCancel: {
      type: Boolean,
      value: true
    },
    // 是否显示确定按钮
    showConfirm: {
      type: Boolean,
      value: true
    },
    // 是否显示关闭按钮
    showClose: {
      type: Boolean,
      value: true
    },
    // 取消按钮文字
    cancelText: {
      type: String,
      value: '取消'
    },
    // 确定按钮文字
    confirmText: {
      type: String,
      value: '确定'
    },
    // 取消按钮类型
    cancelType: {
      type: String,
      value: 'default'
    },
    // 确定按钮类型
    confirmType: {
      type: String,
      value: 'primary'
    },
    // 确定按钮加载状态
    confirmLoading: {
      type: Boolean,
      value: false
    },
    // 点击遮罩是否关闭
    maskClosable: {
      type: Boolean,
      value: true
    },
    // 弹窗宽度
    width: {
      type: String,
      value: '600rpx'
    },
    // 弹窗高度
    height: {
      type: String,
      value: 'auto'
    }
  },

  /**
   * 组件的初始数据
   */
  data: {
    // 内部状态数据
  },

  /**
   * 组件的方法列表
   */
  methods: {
    /**
     * 阻止事件冒泡
     */
    stopPropagation() {
      // 空函数，用于阻止事件冒泡
    },

    /**
     * 点击遮罩层
     */
    onMaskTap() {
      if (this.data.maskClosable) {
        this.close();
      }
    },

    /**
     * 点击关闭按钮
     */
    onClose() {
      this.close();
    },

    /**
     * 点击取消按钮
     */
    onCancel() {
      this.triggerEvent('cancel', {
        visible: false
      });
      this.close();
    },

    /**
     * 点击确定按钮
     */
    onConfirm() {
      this.triggerEvent('confirm', {
        visible: false
      });
      // 注意：这里不自动关闭弹窗，让父组件决定是否关闭
    },

    /**
     * 视频播放事件
     */
    onVideoPlay(e) {
      this.triggerEvent('videoplay', e.detail);
    },

    /**
     * 视频暂停事件
     */
    onVideoPause(e) {
      this.triggerEvent('videopause', e.detail);
    },

    /**
     * 视频错误事件
     */
    onVideoError(e) {
      this.triggerEvent('videoerror', e.detail);
    },

    /**
     * 关闭弹窗
     */
    close() {
      this.setData({
        visible: false
      });
      this.triggerEvent('close', {
        visible: false
      });
    },

    /**
     * 显示弹窗
     */
    show() {
      this.setData({
        visible: true
      });
      this.triggerEvent('show', {
        visible: true
      });
    },

    /**
     * 切换弹窗显示状态
     */
    toggle() {
      const visible = !this.data.visible;
      this.setData({
        visible: visible
      });
      this.triggerEvent(visible ? 'show' : 'close', {
        visible: visible
      });
    }
  },

  /**
   * 组件生命周期
   */
  lifetimes: {
    attached() {
      // 组件实例被放入页面节点树时执行
    },
    detached() {
      // 组件实例被从页面节点树移除时执行
    }
  },

  /**
   * 组件所在页面的生命周期
   */
  pageLifetimes: {
    show() {
      // 页面被展示时执行
    },
    hide() {
      // 页面被隐藏时执行
    }
  }
});
