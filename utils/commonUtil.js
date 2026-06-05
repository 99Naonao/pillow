/**
 * MAC地址工具类 - 提供MAC地址转换和验证功能
 */
const STORAGE_KEY = 'wifi_device_mac';
const STORAGE_LIST_KEY = 'associated_device_macs';
class CommonUtil {

  /**
   * 转换蓝牙mac为wifi    
   * @param {string} bluetoothMac 蓝牙MAC地址（格式：XX:XX:XX:XX:XX:XX）
   * @param {string} deviceName 设备名称，用于判断使用-1还是-2
   * @returns {string|null} 转换后的WiFi MAC，失败返回null
   */
  static converAndSaveMac(bluetoothMac, deviceName = ''){
    console.log('开始转换蓝牙MAC为WiFi MAC，输入:', bluetoothMac, '设备名称:', deviceName);
    const wifiMac = this.convertBluetoothToWifiMac(bluetoothMac, deviceName);
    if(wifiMac){
      try {
        wx.setStorageSync(STORAGE_KEY,wifiMac);
        console.log('已将wifi mac保存在本地，保存的mac:',wifiMac);
        console.log('WiFi MAC转换成功:', wifiMac);
        this._appendAssociatedMac(wifiMac);
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
   * 获取所有已关联的设备MAC列表（去重）
   * @returns {string[]} 设备MAC列表
   */
  static getAssociatedDeviceMacs() {
    try {
      const list = wx.getStorageSync(STORAGE_LIST_KEY) || [];
      const current = this.getSavedWifiMac();
      const macSet = new Set(Array.isArray(list) ? list : []);
      if (current) {
        macSet.add(current);
      }
      return Array.from(macSet);
    } catch (error) {
      console.error('读取关联设备列表失败:', error);
      return [];
    }
  }

  /**
   * 将新的MAC写入关联列表
   * @param {string} mac
   */
  static _appendAssociatedMac(mac) {
    try {
      if (!mac) return;
      const list = wx.getStorageSync(STORAGE_LIST_KEY) || [];
      if (Array.isArray(list) && list.includes(mac)) {
        return;
      }
      const nextList = Array.isArray(list) ? [...list, mac] : [mac];
      wx.setStorageSync(STORAGE_LIST_KEY, nextList);
    } catch (error) {
      console.error('追加关联设备MAC失败:', error);
    }
  }

  /**
   * @param {string} bluetoothMac 蓝牙MAC地址（格式：XX:XX:XX:XX:XX:XX）
   * @param {string} deviceName 设备名称，用于判断使用-1还是-2
   * @returns {string|null} 转换后的WiFi MAC，失败返回null
   */
  static convertBluetoothToWifiMac(bluetoothMac, deviceName = '') {
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
      
      // 根据设备名称判断使用-1还是-2
      let offset = -2; // 默认使用-2（旧设备）
      let deviceType = '旧设备';
      
      if (deviceName && deviceName.startsWith('GoodSleep')) {
        offset = -1; // 新设备使用-1
        deviceType = '新设备';
      } else if (deviceName && deviceName.startsWith('GOODSLEEP')) {
        offset = -2; // 旧设备使用-2
        deviceType = '旧设备';
      }
      
      console.log(`设备类型判断: ${deviceName} -> ${deviceType}, 使用偏移量: ${offset}`);
      
      // 使用判断出的偏移量进行转换
      let wifiMac = this._tryConvertMacWithOffset(macSegments, offset);
      if (wifiMac) {
        console.log(`MAC转换成功（${deviceType}）:`, bluetoothMac, '->', wifiMac);
        return wifiMac;
      }
      
      console.error(`MAC转换失败（${deviceType}，偏移量${offset}）`);
      return null;
    } catch (error) {
      console.error('MAC转换失败:', error);
      return null;
    }
  }

  /**
   * 尝试使用指定偏移量转换MAC地址
   * @param {Array} macSegments MAC地址段数组
   * @param {number} offset 偏移量（-1或-2）
   * @returns {string|null} 转换后的MAC地址，失败返回null
   */
  static _tryConvertMacWithOffset(macSegments, offset) {
    try {
      const lastSegment = macSegments[5];
      const decimalValue = parseInt(lastSegment, 16);
      const newDecimal = decimalValue + offset; // offset是负数，所以用加法
      
      // 检查数值范围（0-255）
      if (newDecimal < 0 || newDecimal > 255) {
        console.log(`MAC偏移${offset}超出范围:`, newDecimal);
        return null;
      }
      
      // 转换为两位十六进制（补0）
      const newHex = newDecimal.toString(16).padStart(2, '0').toUpperCase();
      const newMacSegments = [...macSegments];
      newMacSegments[5] = newHex;
      
      // 组装新MAC地址
      return newMacSegments.join(':');
    } catch (error) {
      console.error(`MAC偏移${offset}转换失败:`, error);
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
   * 获取系统类型（android/ios/ohos/other）
   * @returns {string}
   */
  static getSystemType() {
    const sys = wx.getDeviceInfo();
    const platform = (sys.platform || '').toLowerCase();
    const system = sys.system || '';
    if (platform === 'ohos') return 'ohos';
    if (platform === 'android') return 'android';
    if (platform === 'ios') return 'ios';
    // 开发者工具模拟鸿蒙时 platform 为 devtools
    if (platform === 'devtools' && system.includes('HarmonyOS')) return 'ohos';
    return 'other';
  }

  /**
   * 是否与 Android 共用蓝牙/WiFi 逻辑（含鸿蒙）
   * @param {string} [type] 不传则自动读取当前系统类型
   * @returns {boolean}
   */
  static isAndroidLike(type) {
    const platform = type || this.getSystemType();
    return platform === 'android' || platform === 'ohos' || platform === 'other';
  }

  /**
   * 是否 iOS
   * @param {string} [type]
   * @returns {boolean}
   */
  static isIOS(type) {
    return (type || this.getSystemType()) === 'ios';
  }

  /**
   * 是否鸿蒙
   * @param {string} [type]
   * @returns {boolean}
   */
  static isOhos(type) {
    return (type || this.getSystemType()) === 'ohos';
  }

  /**
   * WiFi MAC 统一从 BLE advertisData 广播解析（全平台）
   * @returns {boolean}
   */
  static usesAdvertisDataMac() {
    return true;
  }

  /**
   * 标准化 BLE UUID 便于比较
   * @param {string} uuid
   * @returns {string}
   */
  static normalizeBleUuid(uuid) {
    return (uuid || '').toUpperCase().replace(/-/g, '');
  }

  /**
   * 判断 BLE UUID 是否匹配（支持完整 UUID 或短 ID 如 FFFF、FF01）
   * @param {string} uuid
   * @param {string} shortOrFullId
   * @returns {boolean}
   */
  static bleUuidMatches(uuid, shortOrFullId) {
    const normalized = this.normalizeBleUuid(uuid);
    const target = this.normalizeBleUuid(shortOrFullId);
    if (!normalized || !target) return false;
    return normalized === target || normalized.includes(target) || target.includes(normalized);
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

  /**
   * 安全返回上一页；若无上一页则跳转 fallback（tab 用 switchTab）
   * @param {string} [fallbackTab='/pages/mine/mine']
   */
  static navigateBackSafe(fallbackTab = '/pages/mine/mine') {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack({
        delta: 1,
        fail: (err) => {
          console.warn('[navigateBackSafe] navigateBack 失败，跳转兜底页:', err);
          CommonUtil._openFallbackPage(fallbackTab);
        }
      });
      return;
    }
    CommonUtil._openFallbackPage(fallbackTab);
  }

  static _openFallbackPage(url) {
    const tabPages = ['/pages/home/home', '/pages/report/report', '/pages/mine/mine'];
    if (tabPages.includes(url)) {
      wx.switchTab({ url });
      return;
    }
    wx.redirectTo({
      url,
      fail: () => {
        wx.switchTab({ url: '/pages/mine/mine' });
      }
    });
  }

  /** 实时数据单侧摘要（日志用） */
  static snapshotRealtimeSide(side) {
    if (!side || typeof side !== 'object') {
      return null;
    }
    return {
      heart_rate: side.heart_rate,
      respiratory_rate: side.respiratory_rate ?? side.respiration_rate,
      is_move: side.is_move
    };
  }

  /** 实时数据整包摘要（日志用） */
  static snapshotRealtimePayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return {};
    }
    return {
      is_bed: payload.is_bed ?? payload.inbed,
      left: CommonUtil.snapshotRealtimeSide(payload.left),
      right: CommonUtil.snapshotRealtimeSide(payload.right)
    };
  }

  /**
   * 完整实时数据（日志用，wave 过长时只保留长度与前几项预览）
   * @param {object} payload
   * @param {number} [maxWavePoints=10]
   */
  static cloneRealtimePayloadForLog(payload, maxWavePoints = 10) {
    if (!payload || typeof payload !== 'object') {
      return payload;
    }

    const trimSide = (side) => {
      if (!side || typeof side !== 'object') {
        return side;
      }
      const next = {
        heart_rate: side.heart_rate,
        respiratory_rate: side.respiratory_rate ?? side.respiration_rate,
        respiration_rate: side.respiration_rate,
        is_move: side.is_move,
        body_movement: side.body_movement
      };
      const wave = side.wave ?? side.heart_rate_wave;
      if (Array.isArray(wave)) {
        if (wave.length <= maxWavePoints) {
          next.wave = wave;
        } else {
          next.wave = {
            _truncated: true,
            length: wave.length,
            preview: wave.slice(0, maxWavePoints)
          };
        }
      } else if (wave != null) {
        next.wave = wave;
      }
      const extraKeys = Object.keys(side).filter(
        (k) => !['heart_rate', 'respiratory_rate', 'respiration_rate', 'is_move', 'body_movement', 'wave', 'heart_rate_wave'].includes(k)
      );
      extraKeys.forEach((k) => {
        next[k] = side[k];
      });
      return next;
    };

    const result = {
      is_bed: payload.is_bed ?? payload.inbed,
      inbed: payload.inbed,
      body_movement: payload.body_movement
    };
    if (payload.left) {
      result.left = trimSide(payload.left);
    }
    if (payload.right) {
      result.right = trimSide(payload.right);
    }
    Object.keys(payload).forEach((key) => {
      if (!['is_bed', 'inbed', 'left', 'right', 'body_movement'].includes(key)) {
        result[key] = payload[key];
      }
    });
    return result;
  }

  /**
   * 单侧有效数据评分：心率、呼吸率非 0 各 +2，用于选有效侧
   */
  static scoreRealtimeSide(side) {
    if (!side || typeof side !== 'object') {
      return -1;
    }
    let score = 0;
    const hr = Number(side.heart_rate);
    const br = Number(side.respiratory_rate ?? side.respiration_rate);
    if (Number.isFinite(hr) && hr !== 0) {
      score += 2;
    }
    if (Number.isFinite(br) && br !== 0) {
      score += 2;
    }
    return score;
  }
}

CommonUtil.STORAGE_KEY = STORAGE_KEY;

module.exports = CommonUtil;