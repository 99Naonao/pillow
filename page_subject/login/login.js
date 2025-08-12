// page_subject/login/login.js
const CommonUtil = require('../../utils/commonUtil.js');
const AuthApi = require('../../utils/authApi.js');

Page({
  /**
   * 页面的初始数据
   */
  data: {
    loginType: 'password', // 'password' 或 'code'
    phone: '',
    password: '',
    verificationCode: '',
    showPassword: false,
    agreedToTerms: false,
    canGetCode: false,
    canLogin: false,
    countdown: 0,
    timer: null,
    // 协议查看相关
    showProtocolViewer: false,
    currentProtocolType: 'user'
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    console.log('登錄頁面加載，options:', options);
    console.log('初始數據狀態:', this.data);
    
    // 檢查是否有場景參數
    if (options.scene) {
      console.log('場景參數:', options.scene);
      this.setData({
        scene: options.scene
      });
    }
    this.checkCanGetCode();
    this.checkCanLogin();
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

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {
    if (this.data.timer) {
      clearInterval(this.data.timer);
    }
  },

  // 返回上一页
  goBack() {
    wx.navigateBack({
      delta: 1
    });
  },

  // 切换到密码登录
  switchToPassword() {
    this.setData({
      loginType: 'password',
      verificationCode: ''
    });
    this.checkCanLogin();
  },

  // 切换到验证码登录
  switchToCode() {
    this.setData({
      loginType: 'code',
      password: ''
    });
    this.checkCanLogin();
  },

  // 手机号输入处理
  onPhoneInput(e) {
    const phone = e.detail.value;
    this.setData({
      phone: phone
    });
    
    // 如果手机号长度达到11位，进行验证
    if (phone.length === 11) {
      if (!CommonUtil.isValidChinesePhone(phone)) {
        wx.showModal({
          title: '提示',
          content: '请输入正确的手机号',
          showCancel: false,
          confirmText: '确定'
        });
      }
    }
    
    this.checkCanGetCode();
    this.checkCanLogin();
  },

  // 密碼輸入
  onPasswordInput(e) {
    console.log('密碼輸入事件:', e);
    console.log('輸入的值:', e.detail.value);
    this.setData({
      password: e.detail.value
    });
  },

  // 測試輸入框屬性
  testInputProperties() {
    console.log('=== 測試輸入框屬性 ===');
    console.log('當前頁面數據:', this.data);
    
    // 創建一個查詢選擇器來檢查輸入框
    const query = wx.createSelectorQuery();
    query.select('.input-field').boundingClientRect((rect) => {
      console.log('密碼輸入框位置信息:', rect);
    }).exec();
  },

  // 密碼輸入框獲得焦點
  onPasswordFocus(e) {
    console.log('密碼輸入框獲得焦點:', e);
    console.log('當前密碼值:', this.data.password);
    console.log('showPassword狀態:', this.data.showPassword);
    
    // 調用測試方法
    this.testInputProperties();
  },

  // 密碼輸入框失去焦點
  onPasswordBlur(e) {
    console.log('密碼輸入框失去焦點:', e);
    console.log('最終密碼值:', this.data.password);
  },

  // 验证码输入处理
  onVerificationInput(e) {
    const code = e.detail.value;
    this.setData({
      verificationCode: code
    });
    this.checkCanLogin();
  },

  // 切换密码可见性
  togglePasswordVisibility() {
    this.setData({
      showPassword: !this.data.showPassword
    });
  },

  // 切换协议同意状态
  toggleAgreement() {
    this.setData({
      agreedToTerms: !this.data.agreedToTerms
    });
    this.checkCanLogin();
  },

  // 检查是否可以获取验证码
  checkCanGetCode() {
    const canGetCode = CommonUtil.isValidChinesePhone(this.data.phone) && this.data.countdown === 0;
    this.setData({
      canGetCode: canGetCode
    });
  },

  // 检查是否可以登录
  checkCanLogin() {
    const { loginType, phone, password, verificationCode, agreedToTerms } = this.data;
    
    let canLogin = false;
    
    if (loginType === 'password') {
      canLogin = CommonUtil.isValidChinesePhone(phone) && password.length >= 6 && agreedToTerms;
    } else {
      canLogin = CommonUtil.isValidChinesePhone(phone) && verificationCode.length === 4 && agreedToTerms;
    }
    
    this.setData({
      canLogin: canLogin
    });
  },

  // 获取验证码
  getVerificationCode() {
    if (!this.data.canGetCode) {
      // 检查手机号是否有效
      if (!CommonUtil.isValidChinesePhone(this.data.phone)) {
        wx.showModal({
          title: '提示',
          content: '请输入正确的手机号',
          showCancel: false,
          confirmText: '确定'
        });
        return;
      }
      return;
    }

    // 显示加载提示
    wx.showLoading({
      title: '发送中...'
    });

    // 调用获取验证码API
    AuthApi.sendLoginCaptcha(this.data.phone)
      .then(res => {
        wx.hideLoading();
        console.log('获取验证码响应数据',res)
        // 检查API响应
        if (res.code === 1) {
          wx.showToast({
            title: '验证码已发送',
            icon: 'success'
          });

          // 开始倒计时
          this.setData({
            countdown: 60,
            canGetCode: false
          });

          const timer = setInterval(() => {
            if (this.data.countdown > 1) {
              this.setData({
                countdown: this.data.countdown - 1
              });
            } else {
              clearInterval(timer);
              this.setData({
                countdown: 0,
                timer: null
              });
              this.checkCanGetCode();
            }
          }, 1000);

          this.setData({
            timer: timer
          });
        } else {
          // API返回错误
          wx.showModal({
            title: '提示',
            content: res.msg || '验证码发送失败，请重试',
            showCancel: false,
            confirmText: '确定'
          });
        }
      })
      .catch(error => {
        wx.hideLoading();
        wx.showModal({
          title: '提示',
          content: '验证码发送失败，请检查网络后重试',
          showCancel: false,
          confirmText: '确定'
        });
        console.error('发送验证码失败:', error);
      });
  },

  // 忘记密码
  forgotPassword() {
    wx.showModal({
      title: '忘记密码',
      content: '请联系客服重置密码',
      showCancel: false
    });
  },

  // 查看用户协议
  viewUserAgreement() {
    this.setData({
      currentProtocolType: 'user',
      showProtocolViewer: true
    });
  },

  // 查看隐私协议
  viewPrivacyPolicy() {
    this.setData({
      currentProtocolType: 'privacy',
      showProtocolViewer: true
    });
  },

  // 关闭协议查看器
  onCloseProtocolViewer() {
    this.setData({
      showProtocolViewer: false
    });
  },

  // 切换登录方式
  switchLoginType() {
    if (this.data.loginType === 'password') {
      this.switchToCode();
    } else {
      this.switchToPassword();
    }
  },

  // 跳转到注册页面
  goToRegister() {
    wx.navigateTo({
      url: '/page_subject/register/register'
    });
  },

  // 处理登录
  handleLogin() {
    if (!this.data.canLogin) {
      // 检查具体的错误原因
      const { phone, password, verificationCode, agreedToTerms } = this.data;
      
      if (!CommonUtil.isValidChinesePhone(phone)) {
        wx.showModal({
          title: '提示',
          content: '请输入正确的手机号',
          showCancel: false,
          confirmText: '确定'
        });
        return;
      }
      
      if (this.data.loginType === 'password') {
        const passwordValidation = CommonUtil.validatePassword(password);
        if (!passwordValidation.isValid) {
          wx.showModal({
            title: '提示',
            content: passwordValidation.message,
            showCancel: false,
            confirmText: '确定'
          });
          return;
        }
      }
      
      if (this.data.loginType === 'code' && verificationCode.length !== 4) {
        wx.showModal({
          title: '提示',
          content: '请输入4位验证码',
          showCancel: false,
          confirmText: '确定'
        });
        return;
      }
      
      if (!agreedToTerms) {
        wx.showModal({
          title: '提示',
          content: '请先同意用户协议',
          showCancel: false,
          confirmText: '确定'
        });
        return;
      }
      
      return;
    }

    const { loginType, phone, password, verificationCode } = this.data;

    // 显示加载提示
    wx.showLoading({
      title: '登录中...'
    });

    // 准备登录参数
    const loginParams = {
      terminal:'7',
      account: phone,
      scene: loginType === 'password' ? '1' : '2'
    };

    if (loginType === 'password') {
      loginParams.password = password;
    } else {
      loginParams.code = verificationCode;
    }

    // 调用真实的登录API
    AuthApi.login(loginParams)
      .then(res => {
        wx.hideLoading();
        
        if (res.code === 1) {
          // 登录成功，保存用户信息
          AuthApi.saveUserInfo(res.data);
          
          wx.showToast({
            title: '登录成功',
            icon: 'success',
            duration: 2000
          });

          // 延迟跳转到mine页面
          setTimeout(() => {
            wx.switchTab({
              url: '/pages/mine/mine'
            });
          }, 2000);
        } else {
          // 登录失败
          wx.showModal({
            title: '提示',
            content: res.msg || '登录失败，请重试',
            showCancel: false,
            confirmText: '确定'
          });
        }
      })
      .catch(error => {
        wx.hideLoading();
        wx.showModal({
          title: '提示',
          content: '登录失败，请检查网络后重试',
          showCancel: false,
          confirmText: '确定'
        });
        console.error('登录失败:', error);
      });
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    wx.stopPullDownRefresh();
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

  }
})