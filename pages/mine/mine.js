// pages/mine/mine.js
const DeviceManager = require('../../utils/deviceManager');
const AuthApi = require('../../utils/authApi');
const CommonUtil = require('../../utils/commonUtil');

Page({

  /**
   * 页面的初始数据
   */
  data: {
    isLogin: false, // true为已登录，false为未登录
    avatarUrl: '',
    userName: '',
    // 编辑相关
    showAvatarModal: false,
    showNicknameModal: false,
    nicknameInput: '',
    // 新的头像昵称获取相关
    showNewAvatarModal: false,
    tempUserInfo: {
      avatarUrl: '',
      nickName: ''
    },
    // 告警相关
    alarmEnabled: false,
    alarmPhone: '',
    showPhoneModal: false,
    phoneInput: '',
    // 呼吸监测相关
    breathRate: 0,
    breathThreshold: 10, // 呼吸频率阈值
    breathLowCount: 0, // 连续低呼吸次数
    breathLowLimit: 12, // 连续低呼吸限制
    // 心率监测相关
    heartRate: 0,
    heartThreshold: 40, // 心率阈值（低）
    heartHighThreshold: 80, // 心率阈值（高）
    heartLowCount: 0, // 连续心率异常次数
    heartHighCount: 0, // 连续心率异常次数
    heartLowLimit: 12, // 连续心率异常限制
    alarmed: false, // 是否已告警
    // 协议查看相关
    showProtocolViewer: false,
    currentProtocolType: 'service'
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 初始化设备管理器
    this.deviceManager = new DeviceManager(this);
    
    this.loadAlarmSettings();
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
    const token = wx.getStorageSync('token');
    
    if (userInfo && token) {
      // 使用API返回的用户信息，用户名显示为手机号，头像使用默认头像
      this.setData({
        isLogin: true,
        avatarUrl: userInfo.avatar || '/static/default_avatar.png',
        userName: userInfo.account || userInfo.nickname || '用户'
      });
    } else {
      this.setData({
        isLogin: false,
        avatarUrl: '',
        userName: ''
      });
    }
    
    // 加载告警设置
    this.loadAlarmSettings();
    
    // 如果告警已启用且用户已登录，启动监测
    if (this.data.alarmEnabled && AuthApi.isLoggedIn()) {
      this.startBreathMonitor();
    } else if (this.data.alarmEnabled && !AuthApi.isLoggedIn()) {
      // 如果告警已启用但用户未登录，自动关闭告警
      console.log('用户未登录，自动关闭告警功能');
      this.setData({ alarmEnabled: false });
      this.saveAlarmSettings();
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
    this.stopBreathMonitor();
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
   * 加载告警设置
   */
  loadAlarmSettings() {
    try {
      const alarmSettings = wx.getStorageSync('alarmSettings') || {};
      this.setData({
        alarmEnabled: alarmSettings.enabled || false,
        alarmPhone: alarmSettings.phone || '',
        breathThreshold: alarmSettings.breathThreshold || 10,
        breathLowLimit: alarmSettings.breathLowLimit || 3,
        heartThreshold: alarmSettings.heartThreshold || 50,
        heartHighThreshold: alarmSettings.heartHighThreshold || 120,
        heartLowLimit: alarmSettings.heartLowLimit || 3
      });
      console.log('加载告警设置:', alarmSettings);
    } catch (error) {
      console.error('加载告警设置失败:', error);
    }
  },

  /**
   * 保存告警设置
   */
  saveAlarmSettings() {
    try {
      const alarmSettings = {
        enabled: this.data.alarmEnabled,
        phone: this.data.alarmPhone,
        breathThreshold: this.data.breathThreshold,
        breathLowLimit: this.data.breathLowLimit,
        heartThreshold: this.data.heartThreshold,
        heartHighThreshold: this.data.heartHighThreshold,
        heartLowLimit: this.data.heartLowLimit
      };
      wx.setStorageSync('alarmSettings', alarmSettings);
      console.log('保存告警设置:', alarmSettings);
    } catch (error) {
      console.error('保存告警设置失败:', error);
    }
  },

  goLogin() {
    console.log('点击登录按钮');
    wx.navigateTo({
      url: '/page_subject/login/login',
    })
  },

  /**
   * 切换告警开关
   */
  onToggleAlarm(e) {
    if (e.detail.value) {
      // 检查用户是否已登录
      if (!AuthApi.isLoggedIn()) {
        console.log('用户未登录，弹出登录提示');
        wx.showModal({
          title: '请先登录',
          content: '您需要先登录才能设置紧急联系人，是否前往登录页面？',
          confirmText: '去登录',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm) {
              // 跳转到登录页面
              wx.navigateTo({
                url: '/page_subject/login/login'
              });
            }
          }
        });
        // 重置开关状态
        this.setData({ alarmEnabled: false });
        return;
      }
      
      // 打开时弹出手机号输入框
      this.setData({ 
        showPhoneModal: true, 
        phoneInput: this.data.alarmPhone 
      });
    } else {
      // 关闭时直接关闭
      this.setData({ 
        alarmEnabled: false,
        alarmed: false,
        breathLowCount: 0
      });
      this.saveAlarmSettings();
      this.stopBreathMonitor();
      wx.showToast({ title: '已关闭告警通知', icon: 'none' });
    }
  },

  /**
   * 手机号输入
   */
  onPhoneInput(e) {
    this.setData({ phoneInput: e.detail.value });
  },

  /**
   * 确认手机号绑定
   */
  onPhoneModalConfirm() {
    // 再次检查用户是否已登录（双重保护）
    if (!AuthApi.isLoggedIn()) {
      console.log('用户未登录，无法绑定手机号');
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      this.setData({ showPhoneModal: false });
      return;
    }
    
    const phone = this.data.phoneInput.trim();
    
    // 手机号格式验证
    if (!phone) {
      wx.showToast({ title: '请输入手机号', icon: 'none' });
      return;
    }
    
    if (!CommonUtil.isValidChinesePhone(phone)) {
      wx.showModal({
        title: '提示',
        content: '请检查输入的手机号是否有误',
        showCancel: false,
        confirmText: '确定'
      });
      return;
    }

    // 获取当前登录用户的手机号
    const userInfo = wx.getStorageSync('userInfo');
    const currentUserPhone = userInfo ? userInfo.account : '';
    
    // 验证告警手机号不能与注册手机号一致
    if (currentUserPhone && phone === currentUserPhone) {
      wx.showModal({
        title: '温馨提示',
        content: '紧急联系手机号不能与注册手机号一致，请设置其他联系人的手机号',
        showCancel: false,
        confirmText: '我知道了'
      });
      return;
    }

    // 保存手机号和启用告警
    this.setData({
      alarmPhone: phone,
      alarmEnabled: true,
      showPhoneModal: false,
      alarmed: false,
      breathLowCount: 0
    });

    // 保存到本地缓存
    this.saveAlarmSettings();

    // 启动监测
    this.startBreathMonitor();

    wx.showToast({ 
      title: '已绑定告警手机号', 
      icon: 'success',
      duration: 2000
    });

    // 移除測試代碼：不再自動觸發語音告警測試
    // this.testVoiceAlarm();
  },

  /**
   * 取消手机号绑定
   */
  onPhoneModalCancel() {
    this.setData({ 
      showPhoneModal: false,
      alarmEnabled: false
    });
  },

  /**
   * 测试语音告警功能（已屏蔽，保留代碼以備將來需要時使用）
   */
  /*
  testVoiceAlarm() {
    // 检查用户是否已登录
    if (!AuthApi.isLoggedIn()) {
      console.log('用户未登录，无法测试语音告警');
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }
    
    // 延迟2秒后执行测试，确保手机号已保存
    setTimeout(() => {
      console.log('开始测试语音告警功能');
      
      // 检查deviceManager是否存在
      if (!this.deviceManager) {
        console.error('deviceManager未初始化');
        wx.showToast({ 
          title: '设备管理器未初始化，无法测试', 
          icon: 'none',
          duration: 3000
        });
        return;
      }
      
      // 测试呼吸异常告警
      wx.showModal({
        title: '测试语音告警',
        content: '是否立即测试语音告警功能？',
        confirmText: '呼吸异常',
        cancelText: '心率异常',
        success: (res) => {
          if (res.confirm) {
            // 测试呼吸异常告警
            console.log('用户选择测试呼吸异常告警');
            this.triggerVoiceAlarm(1);
          } else if (res.cancel) {
            // 测试心率异常告警
            console.log('用户选择测试心率异常告警');
            this.triggerVoiceAlarm(2);
          }
        },
        fail: (error) => {
          console.error('显示测试对话框失败:', error);
          wx.showToast({ 
            title: '显示测试对话框失败', 
            icon: 'none',
            duration: 2000
          });
        }
      });
    }, 2000);
  },
  */

  /**
   * 启动呼吸监测
   */
  startBreathMonitor() {
    // 检查用户是否已登录
    if (!AuthApi.isLoggedIn()) {
      console.log('用户未登录，无法启动呼吸监测');
      return;
    }
    
    if (this.breathTimer) {
      clearInterval(this.breathTimer);
    }
    
    console.log('启动呼吸监测');
    this.breathTimer = setInterval(() => {
      this.checkBreathRate();
    }, 60000); // 每分钟检查一次
  },

  /**
   * 停止呼吸监测
   */
  stopBreathMonitor() {
    if (this.breathTimer) {
      clearInterval(this.breathTimer);
      this.breathTimer = null;
      console.log('停止呼吸监测');
    }
  },

  /**
   * 检查呼吸频率和心率
   */
  checkBreathRate() {
    // 获取设备实时数据
    const commonUtil = require('../../utils/commonUtil');
    const wifiMac = commonUtil.getSavedWifiMac();
    
    if (!wifiMac) {
      console.log('没有保存的WiFi MAC地址');
      wx.showToast({ title: '请先连接设备', icon: 'none' });
      return;
    }
    
    console.log('当前WiFi MAC地址:', wifiMac);
    
    if (!this.deviceManager) {
      console.error('deviceManager未初始化');
      return;
    }
    
    if (!wifiMac) {
      console.log('没有WiFi MAC地址，无法获取设备数据');
      return;
    }

    this.deviceManager.getDeviceRealtimeData(wifiMac).then(result => {
      if (result && result.ret === 0 && result.data && result.data.length > 0) {
        const deviceData = result.data[0];
        let breathRate = null;
        let heartRate = null;
        
        // 获取呼吸频率
        if (deviceData.left && deviceData.left.respiration_rate) {
          breathRate = deviceData.left.respiration_rate;
        } else if (deviceData.right && deviceData.right.respiration_rate) {
          breathRate = deviceData.right.respiration_rate;
        }

        // 获取心率
        if (deviceData.left && deviceData.left.heart_rate) {
          heartRate = deviceData.left.heart_rate;
        } else if (deviceData.right && deviceData.right.heart_rate) {
          heartRate = deviceData.right.heart_rate;
        }

        // 检查呼吸频率
        if (breathRate !== null) {
          console.log('检查呼吸频率:', breathRate, '阈值:', this.data.breathThreshold);
          
          if (breathRate < this.data.breathThreshold) {
            const newCount = this.data.breathLowCount + 1;
            this.setData({ breathLowCount: newCount });
            console.log('呼吸频率过低，连续次数:', newCount, '限制:', this.data.breathLowLimit);
            
            if (newCount >= this.data.breathLowLimit && !this.data.alarmed) {
              console.log('呼吸频率连续异常达到限制，触发语音告警');
              this.setData({ alarmed: true });
              this.triggerVoiceAlarm(1); // 1呼吸异常
            }
          } else {
            this.setData({ breathLowCount: 0 });
            console.log('呼吸频率正常，重置异常计数');
          }
        }

        // 检查心率
        if (heartRate !== null) {
          console.log('检查心率:', heartRate, '低阈值:', this.data.heartThreshold, '高阈值:', this.data.heartHighThreshold);
          
          if (heartRate < this.data.heartThreshold) {
            const newCount = this.data.heartLowCount + 1;
            this.setData({ heartLowCount: newCount });
            console.log('心率过低，连续次数:', newCount, '限制:', this.data.heartLowLimit);
            
            if (newCount >= this.data.heartLowLimit && !this.data.alarmed) {
              console.log('心率过低连续异常达到限制，触发语音告警');
              this.setData({ alarmed: true });
              this.triggerVoiceAlarm(2); // 2心率异常
            }
          } else if (heartRate > this.data.heartHighThreshold) {
            const newCount = this.data.heartHighCount + 1;
            this.setData({ heartHighCount: newCount });
            console.log('心率过高，连续次数:', newCount, '限制:', this.data.heartLowLimit);
            
            if (newCount >= this.data.heartLowLimit && !this.data.alarmed) {
              console.log('心率过高连续异常达到限制，触发语音告警');
              this.setData({ alarmed: true });
              this.triggerVoiceAlarm(2); // 2心率异常
            }
          } else {
            this.setData({ 
              heartLowCount: 0,
              heartHighCount: 0
            });
            console.log('心率正常，重置异常计数');
          }
        }

        // 如果所有指标都正常，重置告警状态
        if (breathRate >= this.data.breathThreshold && 
            heartRate >= this.data.heartThreshold && 
            heartRate <= this.data.heartHighThreshold) {
          if (this.data.alarmed) {
            console.log('所有指标恢复正常，重置告警状态');
          }
          this.setData({ alarmed: false });
        }
      } else {
        console.log('设备数据获取失败或为空');
      }
    }).catch(error => {
      console.error('获取设备数据失败:', error);
    });
  },

  /**
   * 触发语音告警
   * @param {number} type 告警类型 1呼吸异常、2心率异常、3离床
   */
  triggerVoiceAlarm(type = 1) {
    console.log('=== 开始触发语音告警 ===');
    console.log('告警类型:', type);
    console.log('当前告警状态:', this.data.alarmed);
    console.log('告警手机号:', this.data.alarmPhone);
    
    // 检查用户是否已登录
    if (!AuthApi.isLoggedIn()) {
      console.log('用户未登录，无法触发语音告警');
      return;
    }
    
    if (!this.data.alarmPhone) {
      console.log('告警手机号为空，无法触发语音告警');
      wx.showToast({ title: '请先输入告警手机号', icon: 'none' });
      return;
    }

    // 检查deviceManager是否存在
    if (!this.deviceManager) {
      console.error('deviceManager未初始化');
      wx.showToast({ 
        title: '设备管理器未初始化，无法发送告警', 
        icon: 'none',
        duration: 3000
      });
      return;
    }

    const typeNames = {
      1: '呼吸异常',
      2: '心率异常',
      3: '离床'
    };

    console.log('准备发送语音告警，手机号:', this.data.alarmPhone, '类型:', typeNames[type]);

    // 调用真实的语音告警API
    this.deviceManager.voiceNotifation({
      phone: this.data.alarmPhone,
      type: type
    }).then(res => {
      console.log('语音告警API调用成功，响应:', res);
      if (res.ret === 0) {
        console.log('语音告警发送成功');
        wx.showToast({ 
          title: `语音告警已发送`, 
          icon: 'success',
          duration: 2000
        });
      } else {
        console.error('语音告警API返回错误:', res.msg || '未知错误');
        wx.showToast({ 
          title: `告警发送失败: ${res.msg || '未知错误'}`, 
          icon: 'none',
          duration: 2000
        });
      }
    }).catch(error => {
      console.error('语音告警API调用失败:', error);
      wx.showToast({ 
        title: '语音告警发送失败', 
        icon: 'none',
        duration: 2000
      });
    });
    
    console.log('=== 语音告警触发完成 ===');
  },

  onShowProtocol() {
    this.setData({
      currentProtocolType: 'service',
      showProtocolViewer: true
    });
  },

  onShowAbout() {
    this.setData({
      currentProtocolType: 'user',
      showProtocolViewer: true
    });
  },

  /**
   * 显示隐私政策
   */
  onShowPrivacy() {
    this.setData({
      currentProtocolType: 'privacy',
      showProtocolViewer: true
    });
  },

  /**
   * 关闭协议查看器
   */
  onCloseProtocolViewer() {
    this.setData({
      showProtocolViewer: false
    });
  },

  /**
   * 退出登录
   */
  logout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除用户信息
          AuthApi.clearUserInfo();
          
          // 更新页面状态
          this.setData({
            isLogin: false,
            avatarUrl: '',
            userName: ''
          });
          
          wx.showToast({
            title: '退出登录成功',
            icon: 'success',
            duration: 2000
          });
        }
      }
    });
  },

  /**
   * 阻止事件冒泡
   */
  stopPropagation() {
    // 空方法，用於阻止事件冒泡
  },

  /**
   * 编辑头像
   */
  editAvatar() {
    this.setData({
      showNewAvatarModal: true,
      tempUserInfo: {
        avatarUrl: this.data.avatarUrl || '/static/default_avatar.png',
        nickName: this.data.userName || ''
      }
    });
  },

  /**
   * 使用新的头像获取方式
   */
  useNewAvatarMethod() {
    console.log('使用新的头像昵称获取方式');
    this.setData({
      showNewAvatarModal: true,
      showAvatarModal: false,
      tempUserInfo: {
        avatarUrl: this.data.avatarUrl || '/static/default_avatar.png',
        nickName: this.data.userName || ''
      }
    });
  },

  /**
   * 关闭新的头像昵称获取弹窗
   */
  closeNewAvatarModal() {
    this.setData({
      showNewAvatarModal: false,
      tempUserInfo: {
        avatarUrl: '',
        nickName: ''
      }
    });
  },

  /**
   * 选择头像回调
   */
  onChooseAvatar(e) {
    console.log('选择头像回调:', e);
    const { avatarUrl } = e.detail;
    const { nickName } = this.data.tempUserInfo;
    
    this.setData({
      'tempUserInfo.avatarUrl': avatarUrl,
      'tempUserInfo.nickName': nickName
    });
    
    console.log('更新临时用户信息:', this.data.tempUserInfo);
  },

  /**
   * 昵称输入回调
   */
  onInputChange(e) {
    console.log('昵称输入回调:', e);
    const nickName = e.detail.value;
    const { avatarUrl } = this.data.tempUserInfo;
    
    this.setData({
      'tempUserInfo.nickName': nickName,
      'tempUserInfo.avatarUrl': avatarUrl
    });
    
    console.log('更新临时用户信息:', this.data.tempUserInfo);
  },

  /**
   * 保存新的用户信息
   */
  saveNewUserInfo() {
    const { avatarUrl, nickName } = this.data.tempUserInfo;
    
    console.log('保存新的用户信息:', { avatarUrl, nickName });
    
    if (!avatarUrl || avatarUrl === '/static/default_avatar.png') {
      wx.showToast({
        title: '请选择头像',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    if (!nickName || nickName.trim() === '') {
      wx.showToast({
        title: '请输入昵称',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    // 更新用户信息
    this.updateUserInfoLocal(avatarUrl, nickName.trim());
    
    // 关闭弹窗
    this.closeNewAvatarModal();
    
    wx.showToast({
      title: '头像和昵称更新成功',
      icon: 'success',
      duration: 2000
    });
  },

  /**
   * 关闭头像编辑弹窗
   */
  closeAvatarModal() {
    this.setData({
      showAvatarModal: false
    });
  },

  /**
   * 微信授权获取头像和昵称（已弃用，使用新的方式）
   */
  getWechatAvatar() {
          // 直接使用新的头像昵称获取方式
    this.useNewAvatarMethod();
  },

  /**
   * 获取用户信息
   */
  getUserProfile() {
          console.log('开始获取微信用户信息...');
      wx.getUserProfile({
        desc: '用于完善用户资料',
      success: (res) => {
        console.log('获取微信头像成功:', res);
        console.log('用户信息:', res.userInfo);
        console.log('头像URL:', res.userInfo.avatarUrl);
        
        const avatarUrl = res.userInfo.avatarUrl;
        
                  if (!avatarUrl) {
            console.error('头像URL为空');
            wx.showToast({
              title: '获取头像失败',
            icon: 'none',
            duration: 2000
          });
          return;
        }
        
                  console.log('准备更新头像:', avatarUrl);
          
          // 只更新头像，不更新昵称
        this.updateUserInfoLocal(avatarUrl, null);
        this.closeAvatarModal();
        
        wx.showToast({
          title: '头像更新成功',
          icon: 'success',
          duration: 2000
        });
      },
      fail: (error) => {
        console.error('获取微信头像失败:', error);
        console.error('错误详情:', error.errMsg);
        wx.showToast({
          title: '获取头像失败',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  /**
   * 拍照
   */
  takePhoto() {
    // 先检查相机权限
    wx.getSetting({
      success: (res) => {
        console.log('相机权限设置:', res);
        
        if (res.authSetting['scope.camera']) {
          // 已有权限，直接拍照
          this.captureImage();
        } else {
          // 没有权限，先请求权限
          wx.authorize({
            scope: 'scope.camera',
            success: () => {
              console.log('相机权限授权成功');
              this.captureImage();
            },
            fail: (error) => {
              console.error('相机权限授权失败:', error);
              wx.showModal({
                title: '提示',
                content: '需要访问您的相机，请在设置中开启权限',
                confirmText: '去设置',
                cancelText: '取消',
                success: (modalRes) => {
                  if (modalRes.confirm) {
                    wx.openSetting({
                                        success: (settingRes) => {
                    console.log('设置页面结果:', settingRes);
                    if (settingRes.authSetting['scope.camera']) {
                      this.captureImage();
                    }
                  }
                    });
                  }
                }
              });
            }
          });
        }
      },
      fail: (error) => {
        console.error('获取相机权限设置失败:', error);
        // 如果获取权限设置失败，直接尝试拍照
        this.captureImage();
      }
    });
  },

  /**
   * 拍照功能
   */
  captureImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['camera'],
      success: (res) => {
        console.log('拍照成功:', res);
        const tempFilePath = res.tempFilePaths[0];
        
        // 只更新头像，不更新昵称
        this.updateUserInfoLocal(tempFilePath, null);
        this.closeAvatarModal();
        
        wx.showToast({
          title: '头像更新成功',
          icon: 'success',
          duration: 2000
        });
      },
      fail: (error) => {
        console.error('拍照失败:', error);
        wx.showToast({
          title: '拍照失败',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  /**
   * 从相册选择头像
   */
  chooseFromAlbum() {
    // 先检查相册权限
    wx.getSetting({
      success: (res) => {
        console.log('相册权限设置:', res);
        
        if (res.authSetting['scope.writePhotosAlbum']) {
          // 已有权限，直接选择
          this.chooseImage();
        } else {
          // 没有权限，先请求权限
          wx.authorize({
            scope: 'scope.writePhotosAlbum',
            success: () => {
              console.log('相册权限授权成功');
              this.chooseImage();
            },
            fail: (error) => {
              console.error('相册权限授权失败:', error);
              wx.showModal({
                title: '提示',
                content: '需要访问您的相册，请在设置中开启权限',
                confirmText: '去设置',
                cancelText: '取消',
                success: (modalRes) => {
                  if (modalRes.confirm) {
                    wx.openSetting({
                      success: (settingRes) => {
                        console.log('设置页面结果:', settingRes);
                        if (settingRes.authSetting['scope.writePhotosAlbum']) {
                          this.chooseImage();
                        }
                      }
                    });
                  }
                }
              });
            }
          });
        }
      },
      fail: (error) => {
        console.error('获取相册权限设置失败:', error);
        // 如果获取权限设置失败，直接尝试选择图片
        this.chooseImage();
      }
    });
  },

  /**
   * 选择图片
   */
  chooseImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album'],
      success: (res) => {
        console.log('选择头像成功:', res);
        const tempFilePath = res.tempFilePaths[0];
        
        // 只更新头像，不更新昵称
        this.updateUserInfoLocal(tempFilePath, null);
        this.closeAvatarModal();
        
        wx.showToast({
          title: '头像更新成功',
          icon: 'success',
          duration: 2000
        });
      },
      fail: (error) => {
        console.error('选择头像失败:', error);
        wx.showToast({
          title: '选择头像失败',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  /**
   * 编辑昵称
   */
  editNickname() {
    this.setData({
      showNicknameModal: true,
      nicknameInput: this.data.userName
    });
  },

  /**
   * 关闭昵称编辑弹窗
   */
  closeNicknameModal() {
    this.setData({
      showNicknameModal: false,
      nicknameInput: ''
    });
  },

  /**
   * 昵称输入
   */
  onNicknameInput(e) {
    this.setData({
      nicknameInput: e.detail.value
    });
  },

  /**
   * 保存昵称
   */
  saveNickname() {
    const nickname = this.data.nicknameInput.trim();
    
    if (!nickname) {
      wx.showToast({
        title: '请输入昵称',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // 更新昵称（只保存到本地）
    this.updateUserInfoLocal(null, nickname);
    this.closeNicknameModal();
    
    wx.showToast({
      title: '昵称更新成功',
      icon: 'success',
      duration: 2000
    });
  },

  /**
   * 更新用户信息（只保存到本地）
   */
  updateUserInfoLocal(avatarUrl, nickName) {
          console.log('开始更新本地用户信息...');
      console.log('传入的头像URL:', avatarUrl);
      console.log('传入的昵称:', nickName);
    
    const userInfo = wx.getStorageSync('userInfo');
          console.log('当前本地用户信息:', userInfo);
    
    const updatedUserInfo = {
      ...userInfo,
      avatar: avatarUrl || userInfo.avatar,
      nickname: nickName || userInfo.nickname
    };

          console.log('更新后的用户信息:', updatedUserInfo);

    // 保存到本地存储
    wx.setStorageSync('userInfo', updatedUserInfo);
    console.log('已保存到本地存儲');

    // 更新页面显示
    const newAvatarUrl = updatedUserInfo.avatar || '/static/default_avatar.png';
    const newUserName = updatedUserInfo.nickname || updatedUserInfo.account || '用户';
    
          console.log('准备更新页面显示:');
          console.log('新头像URL:', newAvatarUrl);
      console.log('新用户名:', newUserName);
    
    this.setData({
      avatarUrl: newAvatarUrl,
      userName: newUserName
    });

    console.log('页面显示已更新');
    console.log('本地用户信息更新成功:', updatedUserInfo);
  },

  /**
   * 更新用户信息（保存到本地和服务器）
   */
  updateUserInfo(avatarUrl, nickName) {
    const userInfo = wx.getStorageSync('userInfo');
    const updatedUserInfo = {
      ...userInfo,
      avatar: avatarUrl || userInfo.avatar,
      nickname: nickName || userInfo.nickname
    };

    // 保存到本地存储
    wx.setStorageSync('userInfo', updatedUserInfo);

    // 更新页面显示
    this.setData({
      avatarUrl: updatedUserInfo.avatar || '/static/default_avatar.png',
      userName: updatedUserInfo.nickname || updatedUserInfo.account || '用户'
    });

    // 调用API更新服务器端的用户信息
    AuthApi.updateUserInfo(updatedUserInfo)
      .then(res => {
        console.log('服务器端用户信息更新成功:', res);
      })
      .catch(error => {
        console.error('服务器端用户信息更新失败:', error);
        // 这里可以选择是否要回滚本地更改
      });
  }
});