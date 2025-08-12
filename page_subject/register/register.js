// page_subject/register/register.js
const CommonUtil = require('../../utils/commonUtil.js');
const AuthApi = require('../../utils/authApi.js');

Page({
  /**
   * 页面的初始数据
   */
  data: {
    phone: '',
    verificationCode: '',
    password: '',
    confirmPassword: '',
    showPassword: false,
    showConfirmPassword: false,
    agreedToTerms: false,
    canGetCode: false,
    canRegister: false,
    countdown: 0,
    timer: null,
    // 协议查看相关
    showProtocolViewer: false,
    currentProtocolType: 'service'
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    console.log('註冊頁面加載，options:', options);
    console.log('初始數據狀態:', this.data);
    this.checkCanRegister();
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
    this.checkCanRegister();
  },

  // 验证码输入处理
  onVerificationInput(e) {
    const code = e.detail.value;
    this.setData({
      verificationCode: code
    });
    this.checkCanRegister();
  },

  // 密碼輸入框獲得焦點
  onPasswordFocus(e) {
    console.log('註冊頁面密碼輸入框獲得焦點:', e);
    console.log('當前密碼值:', this.data.password);
    console.log('showPassword狀態:', this.data.showPassword);
  },

  // 密碼輸入框失去焦點
  onPasswordBlur(e) {
    console.log('註冊頁面密碼輸入框失去焦點:', e);
    console.log('最終密碼值:', this.data.password);
  },

  // 確認密碼輸入框獲得焦點
  onConfirmPasswordFocus(e) {
    console.log('註冊頁面確認密碼輸入框獲得焦點:', e);
    console.log('當前確認密碼值:', this.data.confirmPassword);
    console.log('showConfirmPassword狀態:', this.data.showConfirmPassword);
  },

  // 確認密碼輸入框失去焦點
  onConfirmPasswordBlur(e) {
    console.log('註冊頁面確認密碼輸入框失去焦點:', e);
    console.log('最終確認密碼值:', this.data.confirmPassword);
  },

  // 密碼輸入
  onPasswordInput(e) {
    console.log('註冊頁面密碼輸入事件:', e);
    console.log('輸入的值:', e.detail.value);
    this.setData({
      password: e.detail.value
    });
    this.checkCanRegister();
  },

  // 確認密碼輸入
  onConfirmPasswordInput(e) {
    console.log('註冊頁面確認密碼輸入事件:', e);
    console.log('輸入的值:', e.detail.value);
    this.setData({
      confirmPassword: e.detail.value
    });
    this.checkCanRegister();
  },

  // 切换密码可见性
  togglePasswordVisibility() {
    this.setData({
      showPassword: !this.data.showPassword
    });
  },

  // 切换确认密码可见性
  toggleConfirmPasswordVisibility() {
    this.setData({
      showConfirmPassword: !this.data.showConfirmPassword
    });
  },

  // 切换协议同意状态
  toggleAgreement() {
    this.setData({
      agreedToTerms: !this.data.agreedToTerms
    });
    this.checkCanRegister();
  },

  // 检查是否可以获取验证码
  checkCanGetCode() {
    const canGetCode = CommonUtil.isValidChinesePhone(this.data.phone) && this.data.countdown === 0;
    this.setData({
      canGetCode: canGetCode
    });
  },

  // 检查是否可以注册
  checkCanRegister() {
    const { phone, verificationCode, password, confirmPassword, agreedToTerms } = this.data;
    
    // 验证密码强度
    const passwordValidation = CommonUtil.validatePassword(password);
    
    // 全部输入完成：手机号、验证码、密码、确认密码、协议同意
    const canRegister = CommonUtil.isValidChinesePhone(phone) && 
                       verificationCode.length === 4 && 
                       passwordValidation.isValid && 
                       password.length > 0 && 
                       confirmPassword.length > 0 && 
                       agreedToTerms;
    
    this.setData({
      canRegister: canRegister
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
    AuthApi.sendRegisterCaptcha(this.data.phone)
      .then(res => {
        wx.hideLoading();

        console.log('要获取验证码的手机号：',this.data.phone)
        console.log('回应消息',res)
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
            content: res.Msg || '验证码发送失败，请重试',
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

  // 查看服务协议
  viewServiceAgreement() {
    this.setData({
      currentProtocolType: 'service',
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

  // 处理注册
  handleRegister() {
    const { phone, verificationCode, password, confirmPassword, agreedToTerms } = this.data;
    
    // 检查基本条件
    if (!this.data.canRegister) {
      // 检查具体的错误原因
      if (!CommonUtil.isValidChinesePhone(phone)) {
        wx.showModal({
          title: '提示',
          content: '请输入正确的手机号',
          showCancel: false,
          confirmText: '确定'
        });
        return;
      }
      
      if (verificationCode.length !== 4) {
        wx.showModal({
          title: '提示',
          content: '请输入4位验证码',
          showCancel: false,
          confirmText: '确定'
        });
        return;
      }
      
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
      
      if (!agreedToTerms) {
        wx.showModal({
          title: '提示',
          content: '请先同意服务协议',
          showCancel: false,
          confirmText: '确定'
        });
        return;
      }
      
      return;
    }
    
    // 检查密码一致性（在点击注册时检查）
    if (password !== confirmPassword) {
      wx.showModal({
        title: '提示',
        content: '两次密码输入不一致',
        showCancel: false,
        confirmText: '确定'
      });
      return;
    }

    // 显示加载提示
    wx.showLoading({
      title: '注册中...'
    });

    // 调用注册API
    AuthApi.register({
      register_source:'7',
      mobile: phone,
      code: verificationCode,
      password: password,
      password_confirm: confirmPassword
    })
      .then(res => {
        console.log('注册信息：：',res)
        wx.hideLoading();
        
        // 检查响应结构
        console.log('响应Code:', res.Code);
        console.log('响应类型:', typeof res.Code);
        
        if (res.Code === 1) {
          // 注册成功
          console.log('注册成功，准备跳转到登录页面');
          wx.showToast({
            title: '注册成功',
            icon: 'success',
            duration: 1500
          });

          // 延迟跳转到登录页面
          setTimeout(() => {
            console.log('开始跳转到登录页面');
            wx.redirectTo({
              url: '/page_subject/login/login',
              success: () => {
                console.log('跳转到登录页面成功');
              },
              fail: (error) => {
                console.error('跳转到登录页面失败:', error);
                // 如果跳转失败，尝试其他方式
                wx.reLaunch({
                  url: '/page_subject/login/login'
                });
              }
            });
          }, 1500);
        } else {
          // 注册失败
          wx.showModal({
            title: '提示',
            content: res.msg || '注册失败，请重试',
            showCancel: false,
            confirmText: '确定'
          });
        }
      })
      .catch(error => {
        wx.hideLoading();
        wx.showModal({
          title: '提示',
          content: '注册失败，请检查网络后重试',
          showCancel: false,
          confirmText: '确定'
        });
        console.error('注册失败:', error);
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