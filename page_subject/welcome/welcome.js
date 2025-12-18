// page_subject/welcome/welcome.js
const AuthApi = require('../../utils/authApi.js');

Page({
  /**
   * 页面的初始数据
   */
  data: {
    wechatPhoneLoginLoading: false,
    agreedToTerms: false,
    showProtocolViewer: false,
    currentProtocolType: 'user'
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    console.log('欢迎页面加载，options:', options);
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

  },

  // 返回上一页
  onBack() {
    wx.navigateBack({
      delta: 1
    });
  },

  // 跳转到账号登录页面
  goToAccountLogin() {
    wx.navigateTo({
      url: '/page_subject/login/login'
    });
	// wx.navigateTo({
	//   url: '/page_subject/welcome/welcome'
	// });
  },

  // 微信手机号授权登录
  onWeChatPhoneAuthorize(event, retryCount = 0) {
    if (!this.data.agreedToTerms) {
      wx.showModal({
        title: '提示',
        content: '请先同意用户协议',
        showCancel: false
      });
      return;
    }

    if (this.data.wechatPhoneLoginLoading) {
      return;
    }

    const { errMsg, encryptedData, iv, code: phoneCode } = event.detail || {};

    if (errMsg !== 'getPhoneNumber:ok') {
      wx.showToast({
        title: '已取消授权',
        icon: 'none'
      });
      return;
    }

    // 验证必要参数
    if (!phoneCode) {
      wx.showToast({
        title: '获取手机号失败，请稍后重试',
        icon: 'none'
      });
      return;
    }

    // 记录详细的授权信息用于调试
    console.log('微信手机号授权信息:', {
      hasPhoneCode: !!phoneCode,
      hasEncryptedData: !!encryptedData,
      hasIv: !!iv,
      phoneCodeLength: phoneCode ? phoneCode.length : 0,
      retryCount
    });

    this.setData({
      wechatPhoneLoginLoading: true
    });

    // 先获取最新的微信登录码，确保不过期
    this.getWxLoginCode()
      .then(wxCode => {
        if (!wxCode) {
          throw new Error('获取微信登录凭证失败');
        }

        // 构建请求参数，确保所有字段都存在
        const loginParams = {
          wxCode,
          phoneCode
        };

        // 如果存在旧版能力的额外数据，也一并传递
        if (encryptedData) {
          loginParams.encryptedData = encryptedData;
        }
        if (iv) {
          loginParams.iv = iv;
        }

        console.log('准备调用登录接口，参数:', {
          hasWxCode: !!loginParams.wxCode,
          hasPhoneCode: !!loginParams.phoneCode,
          hasEncryptedData: !!loginParams.encryptedData,
          hasIv: !!loginParams.iv
        });

        return AuthApi.loginWithWeChatPhone(loginParams);
      })
      .then(res => {
        console.log('登录接口响应:', res);
        
        if (res.code === 1) {
          // 登录成功，重置loading状态
          this.setData({
            wechatPhoneLoginLoading: false
          });
          this.handleLoginSuccess(res.data);
        } else {
          // 登录失败，重置loading并显示错误信息
          const errorMsg = res.msg || '授权登录失败';
 
          // 如果登录失败，需要用户重新授权
          this.setData({
            wechatPhoneLoginLoading: false
          });
           
          wx.showModal({
            title: '提示',
            content: '授权登录失败，请重新授权',
            showCancel: false,
            confirmText: '确定'
          });
        }
      })
      .catch(error => {
        console.error('微信手机号授权登录失败:', error);
        
        // 检查是否是网络错误（可以重试的情况）
        const isNetworkError = error.message?.includes('timeout') || 
                               error.message?.includes('超时') ||
                               error.message?.includes('网络') ||
                               error.errMsg?.includes('timeout') ||
                               error.errMsg?.includes('fail');
        
        // 只有网络错误且未达到重试次数时才重试
        // 注意：重试时仍然使用相同的 phoneCode，因为微信手机号授权是一次性的
        // 如果重试仍然失败，说明可能是网络问题，但最多只重试1次
        if (isNetworkError && retryCount < 1) {
          console.log(`网络错误，准备重试 (${retryCount + 1}/1)`);
          wx.showToast({
            title: '网络异常，正在重试...',
            icon: 'loading',
            duration: 1500
          });
          
          // 延迟后重试，重新获取微信登录码（phoneCode保持不变，因为是一次性的）
          setTimeout(() => {
            // 验证 event 是否仍然有效
            if (event && event.detail && event.detail.code) {
              this.onWeChatPhoneAuthorize(event, retryCount + 1);
            } else {
              // event 无效，重置loading并提示用户重新授权
              this.setData({
                wechatPhoneLoginLoading: false
              });
              wx.showModal({
                title: '提示',
                content: '授权已过期，请重新授权',
                showCancel: false,
                confirmText: '确定'
              });
            }
          }, 1500);
          return;
        }

        // 达到重试次数或非网络错误，重置loading并显示错误
        this.setData({
          wechatPhoneLoginLoading: false
        });
        
        const errorMessage = error.message || error.errMsg || '授权登录失败，请检查网络后重试';
        wx.showModal({
          title: '提示',
          content: '授权登录失败，请重新授权',
          showCancel: false,
          confirmText: '确定'
        });
      });
  },

  // 切换协议勾选状态
  toggleAgreement() {
    this.setData({
      agreedToTerms: !this.data.agreedToTerms
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

  // 获取微信登录凭证
  getWxLoginCode() {
    return new Promise((resolve, reject) => {
      wx.login({
        timeout: 10000, // 增加超时时间到10秒
        success: (loginRes) => {
          if (loginRes.code) {
            console.log('获取微信登录凭证成功，code长度:', loginRes.code.length);
            resolve(loginRes.code);
          } else {
            console.error('微信登录返回的code为空');
            reject(new Error('未获取到微信登录凭证'));
          }
        },
        fail: (err) => {
          console.error('获取微信登录凭证失败:', err);
          reject(new Error(err.errMsg || '获取微信登录凭证失败'));
        }
      });
    });
  },

  // 统一处理登录成功逻辑
  handleLoginSuccess(userInfo) {
    if (!userInfo) {
      wx.showModal({
        title: '提示',
        content: '登录数据异常，请重试',
        showCancel: false
      });
      return;
    }

    AuthApi.saveUserInfo(userInfo);

    wx.showToast({
      title: '登录成功',
      icon: 'success',
      duration: 1500
    });

    setTimeout(() => {
      wx.switchTab({
        url: '/pages/mine/mine'
      });
    }, 1500);
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

