Page({
  data: {
    // 基礎彈窗
    showBasicModal: false,
    
    // 圖標彈窗
    showIconModal: false,
    
    // 視頻彈窗
    showVideoModal: false,
    videoUrl: 'https://example.com/video.mp4',
    videoPoster: '/static/video-poster.jpg',
    
    // 自定義內容彈窗
    showCustomModal: false,
    
    // 警告彈窗
    showWarningModal: false,
    
    // 確認彈窗
    showConfirmModal: false
  },

  /**
   * 顯示基礎彈窗
   */
  showBasicModal() {
    this.setData({
      showBasicModal: true
    });
  },

  /**
   * 顯示圖標彈窗
   */
  showIconModal() {
    this.setData({
      showIconModal: true
    });
  },

  /**
   * 顯示視頻彈窗
   */
  showVideoModal() {
    this.setData({
      showVideoModal: true
    });
  },

  /**
   * 顯示自定義內容彈窗
   */
  showCustomModal() {
    this.setData({
      showCustomModal: true
    });
  },

  /**
   * 顯示警告彈窗
   */
  showWarningModal() {
    this.setData({
      showWarningModal: true
    });
  },

  /**
   * 顯示確認彈窗
   */
  showConfirmModal() {
    this.setData({
      showConfirmModal: true
    });
  },

  /**
   * 基礎彈窗確定
   */
  onBasicConfirm(e) {
    console.log('基礎彈窗確定', e.detail);
    wx.showToast({
      title: '確定按鈕被點擊',
      icon: 'success'
    });
    this.setData({
      showBasicModal: false
    });
  },

  /**
   * 基礎彈窗取消
   */
  onBasicCancel(e) {
    console.log('基礎彈窗取消', e.detail);
    wx.showToast({
      title: '取消按鈕被點擊',
      icon: 'none'
    });
    this.setData({
      showBasicModal: false
    });
  },

  /**
   * 基礎彈窗關閉
   */
  onBasicClose(e) {
    console.log('基礎彈窗關閉', e.detail);
    this.setData({
      showBasicModal: false
    });
  },

  /**
   * 圖標彈窗確定
   */
  onIconConfirm(e) {
    console.log('圖標彈窗確定', e.detail);
    this.setData({
      showIconModal: false
    });
  },

  /**
   * 視頻彈窗確定
   */
  onVideoConfirm(e) {
    console.log('視頻彈窗確定', e.detail);
    this.setData({
      showVideoModal: false
    });
  },

  /**
   * 視頻彈窗取消
   */
  onVideoCancel(e) {
    console.log('視頻彈窗取消', e.detail);
    this.setData({
      showVideoModal: false
    });
  },

  /**
   * 視頻播放事件
   */
  onVideoPlay(e) {
    console.log('視頻開始播放', e.detail);
  },

  /**
   * 視頻暫停事件
   */
  onVideoPause(e) {
    console.log('視頻暫停', e.detail);
  },

  /**
   * 視頻錯誤事件
   */
  onVideoError(e) {
    console.log('視頻播放錯誤', e.detail);
    wx.showToast({
      title: '視頻播放失敗',
      icon: 'error'
    });
  },

  /**
   * 自定義內容彈窗確定
   */
  onCustomConfirm(e) {
    console.log('自定義內容彈窗確定', e.detail);
    this.setData({
      showCustomModal: false
    });
  },

  /**
   * 自定義內容彈窗取消
   */
  onCustomCancel(e) {
    console.log('自定義內容彈窗取消', e.detail);
    this.setData({
      showCustomModal: false
    });
  },

  /**
   * 警告彈窗確定
   */
  onWarningConfirm(e) {
    console.log('警告彈窗確定', e.detail);
    wx.showToast({
      title: '已確認警告',
      icon: 'success'
    });
    this.setData({
      showWarningModal: false
    });
  },

  /**
   * 確認彈窗確定
   */
  onConfirmConfirm(e) {
    console.log('確認彈窗確定', e.detail);
    wx.showModal({
      title: '操作確認',
      content: '您確定要執行此操作嗎？',
      success: (res) => {
        if (res.confirm) {
          wx.showToast({
            title: '操作已執行',
            icon: 'success'
          });
        }
      }
    });
    this.setData({
      showConfirmModal: false
    });
  },

  /**
   * 確認彈窗取消
   */
  onConfirmCancel(e) {
    console.log('確認彈窗取消', e.detail);
    this.setData({
      showConfirmModal: false
    });
  }
});
