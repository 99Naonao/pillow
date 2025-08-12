const ProtocolManager = require('../../utils/protocolManager');

Component({
  properties: {
    // 协议类型：'service', 'user', 'privacy'
    protocolType: {
      type: String,
      value: 'service'
    },
    // 是否显示
    visible: {
      type: Boolean,
      value: false
    }
  },

  data: {
    protocolTitle: '',
    protocolContent: '',
    loading: false,
    error: false,
    errorMessage: ''
  },

  lifetimes: {
    attached() {
      this.protocolManager = new ProtocolManager();
    }
  },

  observers: {
    'visible, protocolType': function(visible, protocolType) {
      if (visible && protocolType) {
        this.loadProtocol(protocolType);
      }
    }
  },

  methods: {
    /**
     * 加载协议内容
     */
    async loadProtocol(type) {
      if (!type) return;

      this.setData({
        loading: true,
        error: false,
        errorMessage: ''
      });

      try {
        const title = this.protocolManager.getProtocolTitle(type);
        const content = await this.protocolManager.getProtocolContent(type);
        
        this.setData({
          protocolTitle: title,
          protocolContent: content,
          loading: false
        });
      } catch (error) {
        console.error('加载协议失败:', error);
        this.setData({
          loading: false,
          error: true,
          errorMessage: '加载协议内容失败，请稍后重试'
        });
      }
    },

    /**
     * 关闭弹窗
     */
    onClose() {
      this.triggerEvent('close');
    },

    /**
     * 阻止事件冒泡
     */
    onModalTap() {
      // 阻止事件冒泡
    },

    /**
     * 重新加载
     */
    onRetry() {
      if (this.data.protocolType) {
        this.loadProtocol(this.data.protocolType);
      }
    }
  }
}); 