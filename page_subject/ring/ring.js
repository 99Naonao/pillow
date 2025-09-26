// page_subject/ring/ring.js
const HealthConfig = require('../../utils/healthConfig');
const DeviceManager = require('../../utils/deviceManager');

Page({
  /**
   * 页面的初始数据
   */
  data: {
    // 心率异常提醒
    hrTooFast: 110,
    hrTooSlow: 45,
    
    // 呼吸率异常提醒
    brTooFast: 30,
    brTooSlow: 10,
    
    // 离床预警提醒
    outbedExceed: 30,
    outbedStartTime: "22:00",
    outbedEndTime: "06:00",
    isOutbedVoice: true,
    
    // 时间选择器相关（已移除，直接使用picker组件）
    
    // 配置修改标记
    hasConfigChanged: false,
    
    // 配置是否被禁用（當沒有手機號時）
    configDisabled: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    this.loadConfig();
    // 頁面加載時也檢查是否有緊急聯繫人
    this.checkLocalPhoneNumbers();
  },

  /**
   * 頁面顯示時檢查緊急聯繫人
   */
  onShow() {
    this.checkLocalPhoneNumbers();
  },

  /**
   * 返回按钮点击事件
   */
  onBack() {
    wx.navigateBack();
  },

  /**
   * 加载配置
   */
  loadConfig() {
    // 先從本地加載，然後從服務器同步
    this.loadLocalConfig();
    this.syncConfigFromServer();
  },

  /**
   * 從本地加載配置
   */
  loadLocalConfig() {
    try {
      const configData = wx.getStorageSync('healthConfig');
      if (configData) {
        const config = new HealthConfig(configData);
        this.setData({
          hrTooFast: config.hrTooFast,
          hrTooSlow: config.hrTooSlow,
          brTooFast: config.brTooFast,
          brTooSlow: config.brTooSlow,
          outbedExceed: config.outbedExceed,
          outbedStartTime: config.outbedStartTime,
          outbedEndTime: config.outbedEndTime,
          isOutbedVoice: config.isOutbedVoice
        });
      }
    } catch (error) {
      console.error('加载本地配置失败:', error);
    }
  },

  /**
   * 檢查本地是否有緊急聯繫人
   */
  checkLocalPhoneNumbers() {
    const localConfig = wx.getStorageSync('healthConfig');
    const hasPhoneNumbers = localConfig && 
                           localConfig.phone_list && 
                           Array.isArray(localConfig.phone_list) && 
                           localConfig.phone_list.length > 0;
    
    if (!hasPhoneNumbers) {
      console.log('本地沒有緊急聯繫人，禁用預警設置');
      this.setData({
        configDisabled: true
      });
    }
  },

  /**
   * 從服務器同步配置
   */
  syncConfigFromServer() {
    const deviceManager = new DeviceManager(this);
    const wifiMac = require('../../utils/commonUtil').getSavedWifiMac();
    
    if (!wifiMac) {
      console.log('未找到WiFi MAC地址，跳過服務器同步');
      return;
    }

    deviceManager.getDeviceWarningSetting(wifiMac)
      .then(res => {
        if (res.ret === 0 && res.data) {
          console.log('從服務器獲取配置成功:', res.data);
          // 檢查是否有手機號
          this.checkPhoneNumbers(res.data);
        } else {
          console.log('服務器配置獲取失敗:', res.msg);
        }
      })
      .catch(err => {
        console.error('同步服務器配置失敗:', err);
      });
  },

  /**
   * 檢查設備預警信息中是否有手機號
   */
  checkPhoneNumbers(serverData) {
    // 檢查服務器返回的數據中是否有手機號
    const serverHasPhoneNumbers = serverData.phone_list && 
                                 Array.isArray(serverData.phone_list) && 
                                 serverData.phone_list.length > 0;
    
    // 檢查本地配置中是否有手機號
    const localConfig = wx.getStorageSync('healthConfig');
    const localHasPhoneNumbers = localConfig && 
                                localConfig.phone_list && 
                                Array.isArray(localConfig.phone_list) && 
                                localConfig.phone_list.length > 0;
    
    // 如果服務器和本地都沒有手機號，則禁用預警設置
    if (!serverHasPhoneNumbers && !localHasPhoneNumbers) {
      console.log('服務器和本地都沒有手機號，提示用戶先設置緊急聯繫人');
      wx.showModal({
        title: '預警設置提醒',
        content: '檢測到沒有設置緊急聯繫人，請先設置緊急聯繫人後再進行預警設置。',
        confirmText: '去設置',
        cancelText: '稍後設置',
        success: (res) => {
          if (res.confirm) {
            // 跳轉到個人中心設置緊急聯繫人
            console.log('用戶確認跳轉到緊急聯繫人設置頁面');
            // 先跳轉到個人中心頁面
            wx.switchTab({
              url: '/pages/mine/mine'
            });
            // 延遲一點時間後再設置參數
            setTimeout(() => {
              console.log('準備打開緊急聯繫人彈窗');
              // 這裡我們需要通過其他方式來觸發彈窗
              // 可以通過全局事件或者直接調用方法
              getCurrentPages()[getCurrentPages().length - 1].openContactModal();
            }, 1000);
          } else {
            // 用戶選擇稍後設置，仍然更新配置但不允許修改預警設置
            this.updateConfigFromServer(serverData);
            this.setData({
              configDisabled: true // 禁用預警設置
            });
          }
        }
      });
    } else {
      // 有手機號（服務器或本地），正常更新配置
      this.updateConfigFromServer(serverData);
    }
  },

  /**
   * 從服務器數據更新配置
   */
  updateConfigFromServer(serverData) {
    this.setData({
      hrTooFast: serverData.hr_too_fast || this.data.hrTooFast,
      hrTooSlow: serverData.hr_too_slow || this.data.hrTooSlow,
      brTooFast: serverData.br_too_fast || this.data.brTooFast,
      brTooSlow: serverData.br_too_slow || this.data.brTooSlow,
      outbedExceed: serverData.outbed_exceed || this.data.outbedExceed,
      outbedStartTime: serverData.outbed_start_time || this.data.outbedStartTime,
      outbedEndTime: serverData.outbed_end_time || this.data.outbedEndTime,
      isOutbedVoice: serverData.is_outbed_voice !== undefined ? serverData.is_outbed_voice : this.data.isOutbedVoice
    });
  },

  /**
   * 保存配置
   */
  saveConfig() {
    try {
      const config = new HealthConfig({
        hr_too_fast: this.data.hrTooFast,
        hr_too_slow: this.data.hrTooSlow,
        br_too_fast: this.data.brTooFast,
        br_too_slow: this.data.brTooSlow,
        outbed_exceed: this.data.outbedExceed,
        outbed_start_time: this.data.outbedStartTime,
        outbed_end_time: this.data.outbedEndTime,
        is_outbed_voice: this.data.isOutbedVoice
      });

      // 验证配置
      const validation = config.validate();
      if (!validation.isValid) {
        wx.showToast({
          title: '配置参数无效',
          icon: 'none'
        });
        return;
      }

      // 保存到本地存储
      wx.setStorageSync('healthConfig', config.getAllConfig());
      
      // 只有在用户修改了配置时才同步到服务器
      if (this.data.hasConfigChanged) {
        this.syncConfigToServer(config);
        // 重置修改标记
        this.setData({
          hasConfigChanged: false
        });
      } else {
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });
      }
      
    } catch (error) {
      console.error('保存配置失败:', error);
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      });
    }
  },

  /**
   * 同步配置到服务器
   */
  syncConfigToServer(config) {
    const deviceManager = new DeviceManager(this);
    
    deviceManager.setDeviceWarningSetting(config)
      .then(res => {
        if (res.ret === 0) {
          wx.showToast({
            title: '保存成功',
            icon: 'success'
          });
        } else {
          wx.showToast({
            title: `保存失败: ${res.msg}`,
            icon: 'none'
          });
        }
      })
      .catch(err => {
        console.error('同步到服务器失败:', err);
        wx.showToast({
          title: '服务器同步失败',
          icon: 'none'
        });
      });
  },

  /**
   * 编辑心率过速提醒值
   */
  editHrTooFast() {
    if (this.data.configDisabled) {
      this.showConfigDisabledMessage();
      return;
    }
    
    wx.showModal({
      title: '心率过速提醒值',
      editable: true,
      placeholderText: '请输入90-160之间的数值',
      success: (res) => {
        if (res.confirm && res.content) {
          const value = parseInt(res.content);
          if (value >= 90 && value <= 160) {
            this.setData({
              hrTooFast: value,
              hasConfigChanged: true
            });
            this.saveConfig();
          } else {
            wx.showToast({
              title: '请输入90-160之间的数值',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  /**
   * 编辑心率过缓提醒值
   */
  editHrTooSlow() {
    if (this.data.configDisabled) {
      this.showConfigDisabledMessage();
      return;
    }
    
    wx.showModal({
      title: '心率过缓提醒值',
      editable: true,
      placeholderText: '请输入30-60之间的数值',
      success: (res) => {
        if (res.confirm && res.content) {
          const value = parseInt(res.content);
          if (value >= 30 && value <= 60) {
            this.setData({
              hrTooSlow: value,
              hasConfigChanged: true
            });
            this.saveConfig();
          } else {
            wx.showToast({
              title: '请输入30-60之间的数值',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  /**
   * 编辑呼吸率过速提醒值
   */
  editBrTooFast() {
    if (this.data.configDisabled) {
      this.showConfigDisabledMessage();
      return;
    }
    
    wx.showModal({
      title: '呼吸率过速提醒值',
      editable: true,
      placeholderText: '请输入20-40之间的数值',
      success: (res) => {
        if (res.confirm && res.content) {
          const value = parseInt(res.content);
          if (value >= 20 && value <= 40) {
            this.setData({
              brTooFast: value,
              hasConfigChanged: true
            });
            this.saveConfig();
          } else {
            wx.showToast({
              title: '请输入20-40之间的数值',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  /**
   * 编辑呼吸率过缓提醒值
   */
  editBrTooSlow() {
    if (this.data.configDisabled) {
      this.showConfigDisabledMessage();
      return;
    }
    
    wx.showModal({
      title: '呼吸率过缓提醒值',
      editable: true,
      placeholderText: '请输入5-12之间的数值',
      success: (res) => {
        if (res.confirm && res.content) {
          const value = parseInt(res.content);
          if (value >= 5 && value <= 12) {
            this.setData({
              brTooSlow: value,
              hasConfigChanged: true
            });
            this.saveConfig();
          } else {
            wx.showToast({
              title: '请输入5-12之间的数值',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  /**
   * 编辑离床未归提醒值
   */
  editOutbedExceed() {
    if (this.data.configDisabled) {
      this.showConfigDisabledMessage();
      return;
    }
    
    wx.showModal({
      title: '离床未归提醒值',
      editable: true,
      placeholderText: '请输入1-60之间的数值',
      success: (res) => {
        if (res.confirm && res.content) {
          const value = parseInt(res.content);
          if (value >= 1 && value <= 60) {
            this.setData({
              outbedExceed: value,
              hasConfigChanged: true
            });
            this.saveConfig();
          } else {
            wx.showToast({
              title: '请输入1-60之间的数值',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  /**
   * 开始时间选择器变化
   */
  onStartTimeChange(e) {
    if (this.data.configDisabled) {
      this.showConfigDisabledMessage();
      return;
    }
    
    const time = e.detail.value;
    this.setData({
      outbedStartTime: time,
      hasConfigChanged: true
    });
    this.saveConfig();
  },

  /**
   * 结束时间选择器变化
   */
  onEndTimeChange(e) {
    if (this.data.configDisabled) {
      this.showConfigDisabledMessage();
      return;
    }
    
    const time = e.detail.value;
    this.setData({
      outbedEndTime: time,
      hasConfigChanged: true
    });
    this.saveConfig();
  },

  /**
   * 显示心率参考值
   */
  showHeartRateReference() {
    wx.showModal({
      title: '参考值说明',
      content: '心率正常范围：60-100次/分，建议根据个人情况调整提醒阈值',
      showCancel: false
    });
  },
    /**
   * 显示呼吸率参考值
   */
  showBreathRateReference() {
    wx.showModal({
      title: '参考值说明',
      content: '呼吸率正常范围：12-20次/分，建议根据个人情况调整提醒阈值',
      showCancel: false
    });
  },
    /**
   * 离床预警语音提醒开关切换
   */
  onOutbedVoiceChange(e) {
    if (this.data.configDisabled) {
      this.showConfigDisabledMessage();
      return;
    }
    
    this.setData({
      isOutbedVoice: e.detail.value,
      hasConfigChanged: true
    });
    this.saveConfig();
  },

  /**
   * 显示配置被禁用的提示
   */
  showConfigDisabledMessage() {
    wx.showModal({
      title: '预警设置不可用',
      content: '请先设置紧急联系人后再进行预警设置',
      confirmText: '去设置',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          console.log('用戶確認跳轉到緊急聯繫人設置頁面（禁用提示）');
          // 先跳轉到個人中心頁面
          wx.switchTab({
            url: '/pages/mine/mine'
          });
          // 延遲一點時間後再設置參數
          setTimeout(() => {
            console.log('準備打開緊急聯繫人彈窗（禁用提示）');
            // 這裡我們需要通過其他方式來觸發彈窗
            getCurrentPages()[getCurrentPages().length - 1].openContactModal();
          }, 1000);
        }
      }
    });
  },

  /**
   * 离床预警说明
   */
  showLeaveBedReference() {
    wx.showModal({
      title: '离床预警说明',
      content: '当您在区间开始值到区间结束值之间离开超过您设置的提醒值后，我们会拨打预警电话，建议根据个人情况调整提醒阈值',
      showCancel: false
    });
  }
})