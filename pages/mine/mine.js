// pages/mine/mine.js
import { autoLogin } from '../../utils/requestUtils';
const DeviceManager = require('../../utils/deviceManager');

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
    phoneInput: '',
    // 呼吸监测相关
    breathRate: 0,
    breathThreshold: 10, // 呼吸频率阈值
    breathLowCount: 0, // 连续低呼吸次数
    breathLowLimit: 3, // 连续低呼吸限制
    // 心率监测相关
    heartRate: 0,
    heartThreshold: 50, // 心率阈值（低）
    heartHighThreshold: 120, // 心率阈值（高）
    heartLowCount: 0, // 连续心率异常次数
    heartHighCount: 0, // 连续心率异常次数
    heartLowLimit: 3, // 连续心率异常限制
    alarmed: false // 是否已告警
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
    
    // 加载告警设置
    this.loadAlarmSettings();
    
    // 如果告警已启用，启动监测
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

  /**
   * 切换告警开关
   */
  onToggleAlarm(e) {
    if (e.detail.value) {
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
    const phone = this.data.phoneInput.trim();
    
    // 手机号格式验证
    if (!phone) {
      wx.showToast({ title: '请输入手机号', icon: 'none' });
      return;
    }
    
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({ title: '请输入有效的手机号', icon: 'none' });
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

    // 添加测试代码：立即触发语音告警测试
    this.testVoiceAlarm();
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
   * 测试语音告警功能
   */
  testVoiceAlarm() {
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

  /**
   * 启动呼吸监测
   */
  startBreathMonitor() {
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
    // 从设备获取最新的呼吸频率和心率
    const wifiMac = wx.getStorageSync('wifiMac');
    const convertedIds = wx.getStorageSync('convertedCharacteristicIds');
    
    console.log('当前WiFi MAC地址:', wifiMac);
    console.log('转换后的特征值ID:', convertedIds);
    
    if (!wifiMac) {
      console.log('未找到设备MAC地址，跳过监测');
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
            console.log('呼吸频率过低，连续次数:', newCount);
            
            if (newCount >= this.data.breathLowLimit && !this.data.alarmed) {
              this.setData({ alarmed: true });
              this.triggerVoiceAlarm(1); // 1呼吸异常
            }
          } else {
            this.setData({ breathLowCount: 0 });
          }
        }

        // 检查心率
        if (heartRate !== null) {
          console.log('检查心率:', heartRate, '低阈值:', this.data.heartThreshold, '高阈值:', this.data.heartHighThreshold);
          
          if (heartRate < this.data.heartThreshold) {
            const newCount = this.data.heartLowCount + 1;
            this.setData({ heartLowCount: newCount });
            console.log('心率过低，连续次数:', newCount);
            
            if (newCount >= this.data.heartLowLimit && !this.data.alarmed) {
              this.setData({ alarmed: true });
              this.triggerVoiceAlarm(2); // 2心率异常
            }
          } else if (heartRate > this.data.heartHighThreshold) {
            const newCount = this.data.heartHighCount + 1;
            this.setData({ heartHighCount: newCount });
            console.log('心率过高，连续次数:', newCount);
            
            if (newCount >= this.data.heartLowLimit && !this.data.alarmed) {
              this.setData({ alarmed: true });
              this.triggerVoiceAlarm(2); // 2心率异常
            }
          } else {
            this.setData({ 
              heartLowCount: 0,
              heartHighCount: 0
            });
          }
        }

        // 如果所有指标都正常，重置告警状态
        if (breathRate >= this.data.breathThreshold && 
            heartRate >= this.data.heartThreshold && 
            heartRate <= this.data.heartHighThreshold) {
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
    if (!this.data.alarmPhone) {
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

    console.log('触发语音告警，手机号:', this.data.alarmPhone, '类型:', typeNames[type]);

    // 调用真实的语音告警API
    this.deviceManager.voiceNotifation({
      phone: this.data.alarmPhone,
      type: type
    }).then(res => {
      console.log('语音告警发送成功:', res);
      if (res.ret === 0) {
        wx.showToast({ 
          title: `语音告警已发送`, 
          icon: 'success',
          duration: 2000
        });
      } else {
        wx.showToast({ 
          title: `告警发送失败: ${res.msg || '未知错误'}`, 
          icon: 'none',
          duration: 2000
        });
      }
    }).catch(error => {
      console.error('语音告警发送失败:', error);
      wx.showToast({ 
        title: '语音告警发送失败', 
        icon: 'none',
        duration: 2000
      });
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
});