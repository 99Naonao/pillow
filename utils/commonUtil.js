/**
 * MAC地址工具类 - 提供MAC地址转换和验证功能
 */
const STORAGE_KEY = 'wifi_device_mac';
class CommonUtil {

  /**
   * 转换蓝牙mac为wifi    
   * @param {string} bluetoothMac 蓝牙MAC地址（格式：XX:XX:XX:XX:XX:XX）
   * @returns {string|null} 转换后的WiFi MAC，失败返回null
   */
  static converAndSaveMac(bluetoothMac){
    console.log('开始转换蓝牙MAC为WiFi MAC，输入:', bluetoothMac);
    const wifiMac = this.convertBluetoothToWifiMac(bluetoothMac);
    if(wifiMac){
      try {
        wx.setStorageSync(STORAGE_KEY,wifiMac);
        console.log('已将wifi mac保存在本地，保存的mac:',wifiMac);
        console.log('WiFi MAC转换成功:', wifiMac);
      } catch (error) {
        console.error('保存mac失败',error)
      }
      return wifiMac
    } else {
      console.log('WiFi MAC转换失败，蓝牙MAC:', bluetoothMac);
      return null;
    }
  }

  /**
   * 从本地存储读取WiFi MAC
   * @returns {string|null} 存储的WiFi MAC，不存在返回null
   */
  static getSavedWifiMac() {
    try {
      const wifiMac = wx.getStorageSync(STORAGE_KEY) || null;
      console.log('从本地存储读取WiFi MAC:', wifiMac);
      return wifiMac;
    } catch (error) {
      console.error('读取WiFi MAC失败:', error);
      return null;
    }
  }

  /**
   * 清除保存的WiFi MAC
   */
  static clearSavedWifiMac() {
    try {
      wx.removeStorageSync(STORAGE_KEY);
      console.log('已清除保存的WiFi MAC');
    } catch (error) {
      console.error('清除WiFi MAC失败:', error);
    }
  }

  /**
   * @param {string} bluetoothMac 蓝牙MAC地址（格式：XX:XX:XX:XX:XX:XX）
   * @returns {string|null} 转换后的WiFi MAC，失败返回null
   */
  static convertBluetoothToWifiMac(bluetoothMac) {
    try {
      // 标准化MAC地址
      const normalizedMac = bluetoothMac
        .toUpperCase()
        .replace(/[^0-9A-F:]/g, '');
      
      // 验证MAC格式
      if (!/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(normalizedMac)) {
        console.error('无效的MAC地址格式:', bluetoothMac);
        return null;
      }
      
      // 分割MAC地址段
      const macSegments = normalizedMac.split(':');
      if (macSegments.length !== 6) {
        console.error('MAC地址段数错误:', bluetoothMac);
        return null;
      }
      
      // 处理最后一个十六进制段（减2）
      const lastSegment = macSegments[5];
      const decimalValue = parseInt(lastSegment, 16);
      const newDecimal = decimalValue - 2;
      
      // 检查数值范围（0-255）
      if (newDecimal < 0 || newDecimal > 255) {
        console.error('转换后的值超出范围:', newDecimal);
        return null;
      }
      
      // 转换为两位十六进制（补0）
      const newHex = newDecimal.toString(16).padStart(2, '0').toUpperCase();
      macSegments[5] = newHex;
      
      // 组装新MAC地址
      return macSegments.join(':');
    } catch (error) {
      console.error('MAC转换失败:', error);
      return null;
    }
  }

  /**
   * 验证MAC地址格式
   * @param {string} macAddress 待验证的MAC地址
   * @returns {boolean} 是否为有效的MAC地址
   */
  static isValidMac(macAddress) {
    if (!macAddress) return false;
    const normalizedMac = macAddress
      .toUpperCase()
      .replace(/[^0-9A-F:]/g, '');
    return /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(normalizedMac);
  }

  /**
   * 获取系统类型（android/ios/other）
   * @returns {string}
   */
  static getSystemType() {
    const sys = wx.getDeviceInfo();
    const platform = (sys.platform || '').toLowerCase();
    if (platform === 'android') return 'android';
    if (platform === 'ios') return 'ios';
    return 'other';
  }

  /**
   * 验证中国手机号格式
   * @param {string} phone 待验证的手机号
   * @returns {boolean} 是否为有效的中国手机号
   */
  static isValidChinesePhone(phone) {
    if (!phone || typeof phone !== 'string') {
      return false;
    }
    
    // 移除所有空格和特殊字符
    const cleanPhone = phone.replace(/\s+/g, '');
    
    // 中国手机号正则表达式
    // 支持以下格式：
    // 1. 13x xxxx xxxx (13开头)
    // 2. 14[5,7] xxxx xxxx (145, 147开头)
    // 3. 15[0-3,5-9] xxxx xxxx (150-153, 155-159开头)
    // 4. 16[6] xxxx xxxx (166开头)
    // 5. 17[0,1,3,5-8] xxxx xxxx (170, 171, 173, 175-178开头)
    // 6. 18[0-9] xxxx xxxx (180-189开头)
    // 7. 19[0-3,5-9] xxxx xxxx (190-193, 195-199开头)
    const phoneRegex = /^1(3\d|4[5,7]|5[0-3,5-9]|6[6]|7[0,1,3,5-8]|8[0-9]|9[0-3,5-9])\d{8}$/;
    
    return phoneRegex.test(cleanPhone);
  }

  /**
   * 格式化手机号显示（添加空格分隔）
   * @param {string} phone 手机号
   * @returns {string} 格式化后的手机号
   */
  static formatPhoneDisplay(phone) {
    if (!phone || typeof phone !== 'string') {
      return '';
    }
    
    // 移除所有空格和特殊字符
    const cleanPhone = phone.replace(/\s+/g, '');
    
    // 如果长度不是11位，直接返回原值
    if (cleanPhone.length !== 11) {
      return cleanPhone;
    }
    
    // 格式化为 1xx xxxx xxxx
    return cleanPhone.replace(/(\d{3})(\d{4})(\d{4})/, '$1 $2 $3');
  }

  /**
   * 获取手机号运营商信息
   * @param {string} phone 手机号
   * @returns {string} 运营商名称
   */
  static getPhoneCarrier(phone) {
    if (!this.isValidChinesePhone(phone)) {
      return '未知';
    }
    
    const prefix = phone.substring(0, 3);
    
    // 中国移动
    if (/^1(3[4-9]|4[7]|5[0-2,7-9]|6[5,7]|7[8]|9[5,7])$/.test(prefix)) {
      return '中国移动';
    }
    // 中国联通
    else if (/^1(3[0-2]|4[5]|5[5,6]|6[6]|7[5,6]|8[5,6])$/.test(prefix)) {
      return '中国联通';
    }
    // 中国电信
    else if (/^1(3[3]|4[9]|5[3]|7[3,7]|8[0,1,9]|9[0,1])$/.test(prefix)) {
      return '中国电信';
    }
    // 虚拟运营商
    else if (/^1(7[0-2,4]|9[4])$/.test(prefix)) {
      return '虚拟运营商';
    }
    else {
      return '其他';
    }
  }

  /**
   * 验证密码强度
   * @param {string} password 密码
   * @returns {Object} 验证结果 {isValid: boolean, message: string}
   */
  static validatePassword(password) {
    if (!password || typeof password !== 'string') {
      return {
        isValid: false,
        message: '密码不能为空'
      };
    }

    if (password.length < 6) {
      return {
        isValid: false,
        message: '密码长度不能少于6位'
      };
    }

    // 检查是否包含数字
    const hasNumber = /\d/.test(password);
    if (!hasNumber) {
      return {
        isValid: false,
        message: '密码必须包含数字'
      };
    }

    // 检查是否包含字母
    const hasLetter = /[a-zA-Z]/.test(password);
    if (!hasLetter) {
      return {
        isValid: false,
        message: '密码必须包含字母'
      };
    }

    return {
      isValid: true,
      message: '密码格式正确'
    };
  }
}

module.exports = CommonUtil;