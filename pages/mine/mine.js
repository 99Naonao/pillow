// pages/mine/mine.js
const DeviceManager = require('../../utils/deviceManager');
const AuthApi = require('../../utils/authApi');
const CommonUtil = require('../../utils/commonUtil');
const HealthConfig = require('../../utils/healthConfig');

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
    emergencyContacts: [], // 紧急联系人列表
    showContactModal: false, // 联系人管理弹窗
    showAddContactModal: false, // 添加联系人弹窗
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
    
    // 調試：打印接收到的參數
    console.log('個人中心頁面接收到的參數:', options);
    console.log('tab參數值:', options.tab);
    
    // 檢查是否有tab參數，如果有則直接打開對應的彈窗
    if (options.tab === 'emergency') {
      console.log('檢測到emergency參數，準備打開緊急聯繫人彈窗');
      // 延遲一點時間確保頁面完全加載
      setTimeout(() => {
        console.log('開始調用openContactModal方法');
        this.openContactModal();
      }, 500);
    } else {
      console.log('沒有檢測到emergency參數，不打開彈窗');
    }
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
      
      // 加载告警设置
      this.loadAlarmSettings();
      
      // 如果用户已登录且有设置紧急联系人，自动开启告警功能
      if (this.data.emergencyContacts && this.data.emergencyContacts.length > 0) {
        console.log('用户已登录且有紧急联系人设置，自动开启告警功能');
        this.setData({ alarmEnabled: true });
        this.saveAlarmSettings();
        // 启动呼吸监测
        this.startBreathMonitor();
      } else {
        console.log('用户已登录但未设置紧急联系人，保持告警功能关闭');
        this.setData({ alarmEnabled: false });
        this.saveAlarmSettings();
      }
    } else {
      this.setData({
        isLogin: false,
        avatarUrl: '',
        userName: ''
      });
      
      // 加载告警设置
      this.loadAlarmSettings();
      
      // 如果告警已启用但用户未登录，自动关闭告警
      if (this.data.alarmEnabled) {
        console.log('用户未登录，自动关闭告警功能');
        this.setData({ 
          alarmEnabled: false,
          alarmed: false,
          breathLowCount: 0,
          heartLowCount: 0,
          heartHighCount: 0
        });
        this.saveAlarmSettings();
      }
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
   * 加载告警设置
   */
  loadAlarmSettings() {
    try {
      const alarmSettings = wx.getStorageSync('alarmSettings') || {};
      this.setData({
        alarmEnabled: alarmSettings.enabled || false,
        emergencyContacts: alarmSettings.contacts || [],
        breathThreshold: alarmSettings.breathThreshold || 10,
        breathLowLimit: alarmSettings.breathLowLimit || 12,
        heartThreshold: alarmSettings.heartThreshold || 50,
        heartHighThreshold: alarmSettings.heartHighThreshold || 120,
        heartLowLimit: alarmSettings.heartLowLimit || 12
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
        contacts: this.data.emergencyContacts,
        breathThreshold: this.data.breathThreshold,
        breathLowLimit: this.data.breathLowLimit,
        heartThreshold: this.data.heartThreshold,
        heartHighThreshold: this.data.heartHighThreshold,
        heartLowLimit: this.data.heartLowLimit
      };
      wx.setStorageSync('alarmSettings', alarmSettings);
      console.log('保存告警设置:', alarmSettings);
      
      // 同步到HealthConfig
      this.syncToHealthConfig();
    } catch (error) {
      console.error('保存告警设置失败:', error);
    }
  },

  /**
   * 同步到HealthConfig并调用API
   */
  syncToHealthConfig() {
    try {
      // 获取现有的健康配置
      const configData = wx.getStorageSync('healthConfig') || {};
      const config = new HealthConfig(configData);
      
      // 更新phone_list
      config.phoneList = [...this.data.emergencyContacts];
      
      // 保存更新后的配置
      wx.setStorageSync('healthConfig', config.getAllConfig());
      
      // 调用API设置设备预警
      if (this.deviceManager) {
        this.deviceManager.setDeviceWarningSetting(config)
          .then(res => {
            console.log('设备预警设置成功:', res);
          })
          .catch(err => {
            console.error('设备预警设置失败:', err);
          });
      }
    } catch (error) {
      console.error('同步到HealthConfig失败:', error);
    }
  },

  goLogin() {
    console.log('点击登录按钮');
    wx.navigateTo({
      url: '/page_subject/login/login',
    })
  },
  
  goRingSet(){
    console.log("点击预警设置");
    wx.navigateTo({
      url: '/page_subject/ring/ring',
    })
  },


  /**
   * 打开联系人管理弹窗
   */
  openContactModal() {
    console.log('openContactModal方法被調用');
    console.log('當前登錄狀態:', AuthApi.isLoggedIn());
    
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
      return;
    }
    
    console.log('用戶已登錄，準備打開緊急聯繫人彈窗');
    this.setData({ showContactModal: true });
    console.log('緊急聯繫人彈窗狀態已設置為true');
  },

  /**
   * 关闭联系人管理弹窗
   */
  closeContactModal() {
    this.setData({ showContactModal: false });
    
    // 如果有紧急联系人，自动开启告警功能
    if (this.data.emergencyContacts && this.data.emergencyContacts.length > 0) {
      this.setData({ alarmEnabled: true });
      this.saveAlarmSettings();
      this.startBreathMonitor();
    } else {
      this.setData({ alarmEnabled: false });
      this.saveAlarmSettings();
      this.stopBreathMonitor();
    }
  },

  /**
   * 添加联系人
   */
  addContact() {
    this.setData({ 
      showAddContactModal: true,
      phoneInput: ''
    });
  },

  /**
   * 关闭添加联系人弹窗
   */
  onAddContactCancel() {
    this.setData({ 
      showAddContactModal: false,
      phoneInput: ''
    });
  },

  /**
   * 手机号输入
   */
  onPhoneInput(e) {
    this.setData({ phoneInput: e.detail.value });
  },

  /**
   * 确认添加联系人
   */
  onAddContactConfirm() {
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

    // 检查是否已存在
    if (this.data.emergencyContacts.includes(phone)) {
      wx.showToast({ title: '该手机号已存在', icon: 'none' });
      return;
    }

    // 添加联系人
    const newContacts = [...this.data.emergencyContacts, phone];
    this.setData({
      emergencyContacts: newContacts,
      showAddContactModal: false,
      phoneInput: ''
    });

    // 保存设置
    this.saveAlarmSettings();
    
    wx.showToast({ 
      title: '添加成功', 
      icon: 'success'
    });
  },

  /**
   * 删除联系人
   */
  deleteContact(e) {
    const index = e.currentTarget.dataset.index;
    const contacts = [...this.data.emergencyContacts];
    contacts.splice(index, 1);
    
    this.setData({
      emergencyContacts: contacts
    });

    // 保存设置
    this.saveAlarmSettings();
    
    wx.showToast({ 
      title: '删除成功', 
      icon: 'success'
    });
  },

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
      return;
    }
    
    console.log('当前WiFi MAC地址:', wifiMac);
    
    if (!this.deviceManager) {
      console.error('deviceManager未初始化');
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
    console.log('紧急联系人:', this.data.emergencyContacts);
    
    // 检查用户是否已登录
    if (!AuthApi.isLoggedIn()) {
      console.log('用户未登录，无法触发语音告警');
      return;
    }
    
    if (!this.data.emergencyContacts || this.data.emergencyContacts.length === 0) {
      console.log('紧急联系人为空，无法触发语音告警');
      wx.showToast({ title: '请先设置紧急联系人', icon: 'none' });
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

    console.log('准备发送语音告警，联系人:', this.data.emergencyContacts, '类型:', typeNames[type]);

    // 为每个联系人发送告警
    const promises = this.data.emergencyContacts.map(phone => {
      return this.deviceManager.voiceNotifation({
        phone: phone,
        type: type
      });
    });

    Promise.all(promises).then(results => {
      console.log('所有语音告警发送完成:', results);
      const successCount = results.filter(res => res.ret === 0).length;
      wx.showToast({ 
        title: `已向${successCount}个联系人发送告警`, 
        icon: 'success',
        duration: 2000
      });
    }).catch(error => {
      console.error('语音告警发送失败:', error);
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
          
          // 停止呼吸监测
          this.stopBreathMonitor();
          
          // 关闭告警功能
          this.setData({ 
            alarmEnabled: false,
            alarmed: false,
            breathLowCount: 0,
            heartLowCount: 0,
            heartHighCount: 0,
            emergencyContacts: []
          });
          
          // 保存告警设置
          this.saveAlarmSettings();
          
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
  }
});