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
    const wifiMac = this.convertBluetoothToWifiMac(bluetoothMac);
    if(wifiMac){
      try {
        wx.setStorageSync(STORAGE_KEY,wifiMac);
        console.log('已将wifi mac保存在本地，保存的mac:',wifiMac);
      } catch (error) {
        console.error('保存mac失败',error)
      }
      return wifiMac
    }
  }

  /**
   * 从本地存储读取WiFi MAC
   * @returns {string|null} 存储的WiFi MAC，不存在返回null
   */
  static getSavedWifiMac() {
    try {
      return wx.getStorageSync(STORAGE_KEY) || null;
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
}

module.exports = CommonUtil;