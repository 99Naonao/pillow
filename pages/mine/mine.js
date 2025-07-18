// pages/mine/mine.js
import { autoLogin } from '../../utils/requestUtils';

Page({

  /**
   * 页面的初始数据
   */
  data: {
    isLogin: false, // true为已登录，false为未登录
    avatarUrl: '',
    userName: '',
    score: 0,
    // 告警相关
    alarmEnabled: false,
    alarmPhone: '',
    showPhoneModal: false,
    phoneInput: ''
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {

  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    // 获取本地用户信息
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo && userInfo.avatarUrl && userInfo.userName) {
      this.setData({
        isLogin: true,
        avatarUrl: userInfo.avatarUrl,
        userName: userInfo.userName,
        score: userInfo.score || 0
      });
    } else {
      this.setData({
        isLogin: false,
        avatarUrl: '',
        userName: '',
        score: 0
      });
    }
    if (this.data.alarmEnabled) {
      this.startBreathMonitor();
    }
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {
    this.stopBreathMonitor();
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  },

  goToShop() {
    wx.showToast({ title: '跳转商城（示例）', icon: 'none' });
    // wx.navigateTo({ url: '/pages/shop/shop' });
  },
  goLogin() {
    autoLogin(() => {
      // 登录成功后刷新页面数据
      const userInfo = wx.getStorageSync('userInfo');
      if (userInfo && userInfo.avatarUrl && userInfo.userName) {
        this.setData({
          isLogin: true,
          avatarUrl: userInfo.avatarUrl,
          userName: userInfo.userName,
          score: userInfo.score || 0
        });
      }
    });
  },
  onToggleAlarm(e) {
    if (e.detail.value) {
      // 打开时弹出手机号输入框
      this.setData({ showPhoneModal: true, phoneInput: this.data.alarmPhone });
    } else {
      // 关闭时直接关闭
      this.setData({ alarmEnabled: false });
      wx.showToast({ title: '已关闭告警通知', icon: 'none' });
    }
  },
  onPhoneInput(e) {
    this.setData({ phoneInput: e.detail.value });
  },
  onPhoneModalConfirm() {
    const phone = this.data.phoneInput.trim();
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({ title: '请输入有效的手机号', icon: 'none' });
      return;
    }
    this.setData({
      alarmPhone: phone,
      alarmEnabled: true,
      showPhoneModal: false
    });
    wx.showToast({ title: '已绑定告警手机号', icon: 'none' });
  },
  onPhoneModalCancel() {
    this.setData({ showPhoneModal: false });
    // switch 仍为关闭
    this.setData({ alarmEnabled: false });
  },
  startBreathMonitor() {
    if (this.breathTimer) return;
    this.breathTimer = setInterval(() => {
      this.checkBreathRate();
    }, 60000);
  },
  stopBreathMonitor() {
    clearInterval(this.breathTimer);
    this.breathTimer = null;
  },
  checkBreathRate() {
    const latestBreath = this.data.breathRate;
    if (latestBreath < this.data.breathThreshold) {
      this.setData({ breathLowCount: this.data.breathLowCount + 1 });
    } else {
      this.setData({ breathLowCount: 0 });
    }
    if (this.data.breathLowCount >= this.data.breathLowLimit && !this.data.alarmed) {
      this.setData({ alarmed: true });
      this.triggerVoiceAlarm();
    }
  },
  triggerVoiceAlarm() {
    if (!this.data.alarmPhone) {
      wx.showToast({ title: '请先输入被告警手机号', icon: 'none' });
      return;
    }
    wx.request({
      url: 'https://你的后端接口/aliyun-voice-alarm',
      method: 'POST',
      data: {
        userId: 'xxx',
        phone: this.data.alarmPhone,
        reason: '呼吸频率低于正常值'
      },
      success: (res) => {
        wx.showToast({ title: '已触发语音告警', icon: 'none' });
      },
      fail: () => {
        wx.showToast({ title: '告警触发失败', icon: 'none' });
      }
    });
  },
  onShowProtocol() {
    wx.showToast({ title: '服务协议', icon: 'none' });
    // wx.navigateTo({ url: '/pages/protocol/protocol' });
  },
  onShowAbout() {
    wx.showToast({ title: '关于我们', icon: 'none' });
    // wx.navigateTo({ url: '/pages/about/about' });
  }
})