/**
 * 健康監測系統配置類
 * 用於管理心率、呼吸率、離床等監測參數
 */
const CommonUtil = require('./commonUtil');

class HealthConfig {
  constructor(config = {}) {
    // 獲取 WiFi MAC 地址
    const wifiMac = CommonUtil.getSavedWifiMac() || "";
    
    // 默認配置
    this._config = {
      // 通用配置
      key: "1f3e1d08bac85daf08eca14e72cde665",
      mac: wifiMac,
      
      // 心率監測參數
      is_hr_message: false,
      is_hr_voice: true,
      hr_too_fast: 110,
      hr_too_slow: 45,
      
      // 呼吸率監測參數
      is_br_message: false,
      is_br_voice: true,
      br_too_fast: 30,
      br_too_slow: 10,
      
      // 離床監測參數
      is_outbed_message: false,
      is_outbed_voice: true,
      outbed_exceed: 30,
      outbed_start_time: "22:00",
      outbed_end_time: "06:00",
      
      // 緊急求助參數
      is_sos_message: false,
      is_sos_voice: false,
      
      // 呼吸暫停監測參數
      is_apnea_message: false,
      is_apnea_voice: true,
      
      // 聯繫人列表
      phone_list: []
    };  
    
    // 合併傳入的配置
    Object.assign(this._config, config);
  }

  // 通用 getter 和 setter
  get(key) {
    return this._config[key];
  }

  set(key, value) {
    if (this._validateValue(key, value)) {
      this._config[key] = value;
      return true;
    }
    return false;
  }

  // 批量設置
  setConfig(config) {
    const errors = [];
    for (const [key, value] of Object.entries(config)) {
      if (!this._validateValue(key, value)) {
        errors.push(`参数 ${key} 验证失败`);
      }
    }
    
    if (errors.length === 0) {
      Object.assign(this._config, config);
      return { success: true };
    } else {
      return { success: false, errors };
    }
  }

  // 獲取所有配置
  getAllConfig() {
    return { ...this._config };
  }

  // 重置為默認配置
  reset() {
    // 获取 WiFi MAC 地址
    const wifiMac = CommonUtil.getSavedWifiMac() || "";
    
    this._config = {
      key: "1f3e1d08bac85daf08eca14e72cde665",
      mac: wifiMac,
      is_hr_message: false,
      is_hr_voice: false,
      hr_too_fast: 100,
      hr_too_slow: 50,
      is_br_message: false,
      is_br_voice: false,
      br_too_fast: 30,
      br_too_slow: 10,
      is_outbed_message: false,
      is_outbed_voice: false,
      outbed_exceed: 30,
      outbed_start_time: "22:00",
      outbed_end_time: "06:00",
      is_sos_message: false,
      is_sos_voice: false,
      is_apnea_message: false,
      is_apnea_voice: true,
      phone_list: []
    };
  }

  // 驗證單個值
  _validateValue(key, value) {
    const validators = {
      key: (v) => typeof v === 'string' && v.length > 0,
      mac: (v) => typeof v === 'string' && (v === '' || /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/.test(v)),
      is_hr_message: (v) => typeof v === 'boolean',
      is_hr_voice: (v) => typeof v === 'boolean',
      hr_too_fast: (v) => typeof v === 'number' && v >= 90 && v <= 160,
      hr_too_slow: (v) => typeof v === 'number' && v >= 30 && v <= 60,
      is_br_message: (v) => typeof v === 'boolean',
      is_br_voice: (v) => typeof v === 'boolean',
      br_too_fast: (v) => typeof v === 'number' && v >= 20 && v <= 40,
      br_too_slow: (v) => typeof v === 'number' && v >= 5 && v <= 12,
      is_outbed_message: (v) => typeof v === 'boolean',
      is_outbed_voice: (v) => typeof v === 'boolean',
      outbed_exceed: (v) => typeof v === 'number' && v >= 1 && v <= 60,
      outbed_start_time: (v) => typeof v === 'string' && /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v),
      outbed_end_time: (v) => typeof v === 'string' && /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v),
      is_sos_message: (v) => typeof v === 'boolean',
      is_sos_voice: (v) => typeof v === 'boolean',
      is_apnea_message: (v) => typeof v === 'boolean',
      is_apnea_voice: (v) => typeof v === 'boolean',
      phone_list: (v) => Array.isArray(v) && v.every(phone => typeof phone === 'string' && /^1[3-9]\d{9}$/.test(phone))
    };

    return validators[key] ? validators[key](value) : true;
  }

  // 驗證所有配置
  validate() {
    const errors = [];
    for (const [key, value] of Object.entries(this._config)) {
      if (!this._validateValue(key, value)) {
        errors.push(`参数 ${key} 值无效: ${value}`);
      }
    }
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // 特定參數的 getter 和 setter
  // 通用配置
  get key() { return this._config.key; }
  set key(value) { this.set('key', value); }

  get mac() { return this._config.mac; }
  set mac(value) { this.set('mac', value); }

  // 心率相關
  get isHrMessage() { return this._config.is_hr_message; }
  set isHrMessage(value) { this.set('is_hr_message', value); }

  get isHrVoice() { return this._config.is_hr_voice; }
  set isHrVoice(value) { this.set('is_hr_voice', value); }

  get hrTooFast() { return this._config.hr_too_fast; }
  set hrTooFast(value) { this.set('hr_too_fast', value); }

  get hrTooSlow() { return this._config.hr_too_slow; }
  set hrTooSlow(value) { this.set('hr_too_slow', value); }

  // 呼吸率相關
  get isBrMessage() { return this._config.is_br_message; }
  set isBrMessage(value) { this.set('is_br_message', value); }

  get isBrVoice() { return this._config.is_br_voice; }
  set isBrVoice(value) { this.set('is_br_voice', value); }

  get brTooFast() { return this._config.br_too_fast; }
  set brTooFast(value) { this.set('br_too_fast', value); }

  get brTooSlow() { return this._config.br_too_slow; }
  set brTooSlow(value) { this.set('br_too_slow', value); }

  // 離床相關
  get isOutbedMessage() { return this._config.is_outbed_message; }
  set isOutbedMessage(value) { this.set('is_outbed_message', value); }

  get isOutbedVoice() { return this._config.is_outbed_voice; }
  set isOutbedVoice(value) { this.set('is_outbed_voice', value); }

  get outbedExceed() { return this._config.outbed_exceed; }
  set outbedExceed(value) { this.set('outbed_exceed', value); }

  get outbedStartTime() { return this._config.outbed_start_time; }
  set outbedStartTime(value) { this.set('outbed_start_time', value); }

  get outbedEndTime() { return this._config.outbed_end_time; }
  set outbedEndTime(value) { this.set('outbed_end_time', value); }

  // 緊急求助相關
  get isSosMessage() { return this._config.is_sos_message; }
  set isSosMessage(value) { this.set('is_sos_message', value); }

  get isSosVoice() { return this._config.is_sos_voice; }
  set isSosVoice(value) { this.set('is_sos_voice', value); }

  // 呼吸暫停相關
  get isApneaMessage() { return this._config.is_apnea_message; }
  set isApneaMessage(value) { this.set('is_apnea_message', value); }

  get isApneaVoice() { return this._config.is_apnea_voice; }
  set isApneaVoice(value) { this.set('is_apnea_voice', value); }

  // 聯繫人列表
  get phoneList() { return [...this._config.phone_list]; }
  set phoneList(value) { this.set('phone_list', value); }

  // 添加電話號碼
  addPhone(phone) {
    if (typeof phone === 'string' && /^1[3-9]\d{9}$/.test(phone)) {
      if (!this._config.phone_list.includes(phone)) {
        this._config.phone_list.push(phone);
        return true;
      }
    }
    return false;
  }

  // 移除電話號碼
  removePhone(phone) {
    const index = this._config.phone_list.indexOf(phone);
    if (index > -1) {
      this._config.phone_list.splice(index, 1);
      return true;
    }
    return false;
  }

  // 檢查是否啟用任何提醒
  hasAnyAlertEnabled() {
    return this._config.is_hr_message || this._config.is_hr_voice ||
           this._config.is_br_message || this._config.is_br_voice ||
           this._config.is_outbed_message || this._config.is_outbed_voice ||
           this._config.is_sos_message || this._config.is_sos_voice ||
           this._config.is_apnea_message || this._config.is_apnea_voice;
  }

  // 檢查心率是否異常
  isHeartRateAbnormal(heartRate) {
    if (typeof heartRate !== 'number') return false;
    return heartRate > this._config.hr_too_fast || heartRate < this._config.hr_too_slow;
  }

  // 檢查呼吸率是否異常
  isBreathRateAbnormal(breathRate) {
    if (typeof breathRate !== 'number') return false;
    return breathRate > this._config.br_too_fast || breathRate < this._config.br_too_slow;
  }

  // 檢查是否在離床監測時間範圍內
  isInOutbedTimeRange() {
    const now = new Date();
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + 
                       now.getMinutes().toString().padStart(2, '0');
    
    const startTime = this._config.outbed_start_time;
    const endTime = this._config.outbed_end_time;
    
    // 處理跨天情況（如 22:00 到 06:00）
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime <= endTime;
    } else {
      return currentTime >= startTime && currentTime <= endTime;
    }
  }

  // 獲取配置摘要
  getConfigSummary() {
    return {
      heartRate: {
        enabled: this._config.is_hr_message || this._config.is_hr_voice,
        tooFast: this._config.hr_too_fast,
        tooSlow: this._config.hr_too_slow
      },
      breathRate: {
        enabled: this._config.is_br_message || this._config.is_br_voice,
        tooFast: this._config.br_too_fast,
        tooSlow: this._config.br_too_slow
      },
      outbed: {
        enabled: this._config.is_outbed_message || this._config.is_outbed_voice,
        exceed: this._config.outbed_exceed,
        timeRange: `${this._config.outbed_start_time} - ${this._config.outbed_end_time}`
      },
      sos: {
        enabled: this._config.is_sos_message || this._config.is_sos_voice
      },
      apnea: {
        enabled: this._config.is_apnea_message || this._config.is_apnea_voice
      },
      phoneCount: this._config.phone_list.length
    };
  }
}

module.exports = HealthConfig;