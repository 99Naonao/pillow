/**
 * 蓝牙管理工具类
 */
const BASE_URL = 'https://zhongshu.xinglu.shop';
const { getLatestToken } = require('./tokenHelper.js');
class BluetoothManager {
    constructor() {
        this.isPageActive = false;
        this.bluetoothConnectionListener = null;
    }

    /**
     * 安全启动蓝牙设备搜索
     */
    async safeStartBluetoothDevicesDiscovery() {
        try {
            await this.openBluetoothAdapter();
            await this.getBluetoothDevices();
            return true;
        } catch (error) {
            console.error('启动蓝牙设备搜索失败:', error);
            return false;
        }
    }

    /**
     * 搜索蓝牙设备
     */
    async searchBluetoothDevices(callback) {
        console.log('开始搜索蓝牙设备');
        
        try {
            const success = await this.safeStartBluetoothDevicesDiscovery();
            if (!success) {
                throw new Error('启动蓝牙搜索失败');
            }

            // 先获取已发现的设备
            const existingDevicesRes = await this.getBluetoothDevices();
            console.log('已发现的设备:', existingDevicesRes.devices);
            
            if (callback && existingDevicesRes.devices.length > 0) {
                callback(existingDevicesRes.devices);
            }

            // 监听新设备
            wx.onBluetoothDeviceFound((res) => {
                console.log('发现新设备:', res.devices);
                if (callback && res.devices && res.devices.length > 0) {
                    callback(res.devices);
                }
            });

            // 开始搜索
            wx.startBluetoothDevicesDiscovery({
                allowDuplicatesKey: true,  // 允许重复设备（iOS需要）
                interval: 50,              // 50ms间隔（iOS需要）
                success: () => {
                    console.log('开始搜索蓝牙设备成功');
                },
                fail: (err) => {
                    console.error('开始搜索蓝牙设备失败:', err);
                    throw err;
                }
            });
        } catch (error) {
            console.error('搜索蓝牙设备失败:', error);
            throw error;
        }
    }

    /**
     * 打开蓝牙适配器
     */
    openBluetoothAdapter() {
        return new Promise((resolve, reject) => {
            wx.openBluetoothAdapter({
                success: resolve,
                fail: reject
            });
        });
    }

    /**
     * 获取蓝牙设备
     */
    getBluetoothDevices() {
        return new Promise((resolve, reject) => {
            wx.getBluetoothDevices({
                success: resolve,
                fail: reject
            });
        });
    }

    /**
     * 停止蓝牙设备搜索
     */
    stopBluetoothDevicesDiscovery() {
        return new Promise((resolve, reject) => {
            wx.stopBluetoothDevicesDiscovery({
                success: resolve,
                fail: reject
            });
        });
    }

    /**
     * 连接蓝牙设备
     */
    connectBluetooth(deviceId, device) {
        return new Promise((resolve, reject) => {
            console.log('准备连接蓝牙设备:', {
                deviceId: deviceId,
                deviceName: device ? device.name : '未知',
                deviceInfo: device
            });

            // 检查deviceId是否有效
            if (!deviceId) {
                const error = new Error('deviceId 不能为空');
                console.error('连接失败:', error);
                reject(error);
                return;
            }

            wx.createBLEConnection({
                deviceId,
                success: () => {
                    console.log('蓝牙连接成功:', deviceId);
                    resolve({ deviceId, device });
                },
                fail: (err) => {
                    console.error('蓝牙连接失败:', err);
                    reject(err);
                }
            });
        });
    }

    /**
     * 获取服务和特征值
     */
    async getServiceAndCharacteristics(deviceId) {
        console.log('获取服务列表，deviceId:', deviceId);
        
        try {
            const servicesRes = await this.getBLEDeviceServices(deviceId);
            console.log('服务列表:', servicesRes.services);
            
            // 选第一个自定义服务或主服务
            const service = servicesRes.services.find(s => 
                s.uuid.toUpperCase().indexOf('6E400001') !== -1 || s.isPrimary
            );
            
            if (!service) {
                throw new Error('未找到合适的服务');
            }

            const serviceId = service.uuid;
            console.log('选中的服务ID:', serviceId);

            const characteristicsRes = await this.getBLEDeviceCharacteristics(deviceId, serviceId);
            console.log('特征值列表:', characteristicsRes.characteristics);

            return {
                serviceId,
                characteristics: characteristicsRes.characteristics
            };
        } catch (error) {
            console.error('获取服务和特征值失败:', error);
            throw error;
        }
    }

    /**
     * 获取蓝牙设备服务
     */
    getBLEDeviceServices(deviceId) {
        return new Promise((resolve, reject) => {
            wx.getBLEDeviceServices({
                deviceId,
                success: resolve,
                fail: reject
            });
        });
    }

    /**
     * 获取蓝牙设备特征值
     */
    getBLEDeviceCharacteristics(deviceId, serviceId) {
        return new Promise((resolve, reject) => {
            wx.getBLEDeviceCharacteristics({
                deviceId,
                serviceId,
                success: resolve,
                fail: reject
            });
        });
    }

    /**
     * 开始蓝牙连接监听
     */
    startBluetoothConnectionListener() {
        if (this.bluetoothConnectionListener) {
            return;
        }

        this.bluetoothConnectionListener = wx.onBLEConnectionStateChange((res) => {
            console.log('蓝牙连接状态变化:', res);
            
            if (!res.connected) {
                console.log('蓝牙设备断开连接:', res.deviceId);
                // 可以在这里处理断开连接的逻辑
            }
        });
    }

    /**
     * 停止蓝牙连接监听
     */
    stopBluetoothConnectionListener() {
        if (this.bluetoothConnectionListener) {
            wx.offBLEConnectionStateChange(this.bluetoothConnectionListener);
            this.bluetoothConnectionListener = null;
        }
    }

    /**
     * 断开蓝牙连接
     */
    disconnectBluetooth(deviceId) {
        return new Promise((resolve, reject) => {
            wx.closeBLEConnection({
                deviceId,
                success: resolve,
                fail: (error) => {
                    // 忽略连接不存在的错误
                    if (error.errCode === 10006) {
                        console.log('设备连接已不存在，无需断开');
                        resolve(); // 当作成功处理
                    } else {
                        reject(error);
                    }
                }
            });
        });
    }

    /**
     * 将十六进制字符串转换为ArrayBuffer
     * @param {string} hexString 十六进制字符串
     * @returns {ArrayBuffer|null} 转换后的ArrayBuffer，失败返回null
     */
    static hexStringToArrayBuffer(hexString) {
        try {
            if (!hexString || typeof hexString !== 'string') {
                return null;
            }
            
            // 移除空格和冒号
            const cleanHex = hexString.replace(/[\s:]/g, '');
            
            // 确保字符串长度为偶数
            if (cleanHex.length % 2 !== 0) {
                console.error('十六进制字符串长度必须是偶数');
                return null;
            }
            
            // 创建ArrayBuffer
            const arrayBuffer = new ArrayBuffer(cleanHex.length / 2);
            const uint8Array = new Uint8Array(arrayBuffer);
            
            // 将每两个字符转换为一个字节
            for (let i = 0; i < cleanHex.length; i += 2) {
                const byte = parseInt(cleanHex.substring(i, i + 2), 16);
                if (isNaN(byte)) {
                    console.error(`无效的十六进制字符: ${cleanHex.substring(i, i + 2)}`);
                    return null;
                }
                uint8Array[i / 2] = byte;
            }
            
            return arrayBuffer;
        } catch (error) {
            console.error('十六进制字符串转ArrayBuffer失败:', error);
            return null;
        }
    }

    /**
     * 从十六进制数组中提取MAC地址
     * @param {Array} hexArray 十六进制数组，如 ["0x0", "0x0", "0xB4", "0xC", ...]
     * @returns {string|null} 提取的MAC地址，失败返回null
     */
    static extractMacFromHexArray(hexArray) {
        try {
            // 确保有足够的数据
            if (hexArray.length < 11) {
                return null;
            }
            
            // 去除0x前缀并转为大写
            const raw = hexArray.map(item => item.replace('0x', '').toUpperCase());
            
            // 提取MAC地址
            // 数据格式：["0", "0", "B4", "C", "20", "E0", "E", "50", "91", "C", "30"]
            // 目标：B4:C2:E0:E5:91:C3
            const macSegments = [
                raw[2],                        // B4
                raw[3] + raw[4].charAt(0),    // C + 2 → C2
                raw[5],                        // E0
                raw[6] + raw[7].charAt(0),    // E + 5 → E5
                raw[8],                        // 91
                raw[9] + raw[10].charAt(0)     // C + 3 → C3
            ];
            
            return macSegments.join(':');
        } catch (error) {
            console.error('提取MAC地址失败:', error);
            return null;
        }
    }

    /**
     * 从广播数据中提取制造商数据
     * @param {ArrayBuffer} advertisData 广播数据
     * @returns {Object|null} 制造商数据 {companyId, data}，失败返回null
     */
    static extractManufacturerData(advertisData) {
        try {
            if (!advertisData) {
                return null;
            }

            // 将ArrayBuffer转换为Uint8Array
            const data = new Uint8Array(advertisData);

            // 解析广播数据中的制造商数据
            let offset = 0;
            while (offset < data.length) {
                if (offset + 1 >= data.length) break;
                
                const length = data[offset];
                if (length === 0 || offset + length >= data.length) break;
                
                const type = data[offset + 1];
                
                // 制造商特定数据类型为0xFF
                if (type === 0xFF) {
                    if (offset + 3 < data.length) {
                        const manufacturerData = {
                            companyId: (data[offset + 2] << 8) | data[offset + 3], // 公司标识符
                            data: Array.from(data.slice(offset + 4, offset + length + 1)) // 制造商自定义数据
                        };
                        
                        return manufacturerData;
                    }
                }
                
                offset += length + 1;
            }
            
            return null;
        } catch (error) {
            console.error('提取制造商数据失败:', error);
            return null;
        }
    }

    /**
     * 根据蓝牙设备MAC地址计算WiFi MAC地址（Android方法）
     * WiFi MAC = 蓝牙MAC尾数 - 1
     * @param {string} bluetoothDeviceId 蓝牙设备ID（MAC地址格式）
     * @returns {string} WiFi MAC地址，失败返回 空字符串
     */
    static calculateWifiMac(bluetoothDeviceId) {
        try {
            // 蓝牙设备ID通常是MAC地址格式，如 "AA:BB:CC:DD:EE:FF"
            // 提取最后两位数字
            const macParts = bluetoothDeviceId.split(':');
            if (macParts.length >= 6) {
                const lastPart = macParts[5]; // 获取最后一部分
                const lastByte = parseInt(lastPart, 16); // 转换为十进制
                const wifiLastByte = lastByte - 1; // WiFi MAC = 蓝牙MAC - 1
                
                // 确保结果在有效范围内 (0-255)
                const validWifiByte = wifiLastByte < 0 ? 255 : wifiLastByte;
                
                // 重新构建WiFi MAC地址
                const wifiMacParts = [...macParts];
                wifiMacParts[5] = validWifiByte.toString(16).padStart(2, '0').toUpperCase();
                const wifiMac = wifiMacParts.join(':');
                
                console.log('蓝牙MAC:', bluetoothDeviceId);
                console.log('计算WiFi MAC:', wifiMac);
                
                return wifiMac;
            }
        } catch (error) {
            console.error('计算WiFi MAC失败:', error);
        }
        
        return '';
    }
	
	/**
	 * 设备注册
	 * WiFi MAC = 蓝牙MAC尾数 - 1
	 * @param {string} bluetoothDeviceId 蓝牙设备ID（MAC地址格式）
	 * @returns {string} WiFi MAC地址，失败返回 空字符串
	 */
	static calculateWifiMacRegister(bluetoothDeviceId) {
	    return new Promise((resolve, reject) => {
	      wx.request({
	        url: `${BASE_URL}/shopapi/UserEquipment/register`,
	        method: 'POST',
        header: {
          'version': '3.1.1',
		  "token": getLatestToken()
        },
	        data: {
	          device_id: bluetoothDeviceId
	        },
	        success: (res) => {
	          console.log('设备注册成功:', res);
	          resolve(res.data);
	        },
	        fail: (error) => {
	          console.error('设备注册失败:', error);
	          reject(error);
	        }
	      });
	    });
  }
  
  	/**
	 * 设备命名
	 * WiFi MAC = 蓝牙MAC尾数 - 1
	 * @param {string} user_equipment_id ID
	 * @param {string} name 命名
	 * @returns {string} WiFi MAC地址，失败返回 空字符串
	 */
	static ChangeName(user_equipment_id,name) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${BASE_URL}/shopapi/UserEquipment/changeName`,
        method: 'POST',
    header: {
      'version': '3.1.1',
      "token": getLatestToken()
    },
        data: {
          user_equipment_id: user_equipment_id,
      name:name
        },
        success: (res) => {
          console.log('成功:', res);
          resolve(res.data);
        },
        fail: (error) => {
          console.error('失败:', error);
          reject(error);
        }
      });
    });
}
	
	/**
	 * 设备解绑
	 * WiFi MAC = 蓝牙MAC尾数 - 1
	 * @param {string} user_equipment_id 蓝牙设备ID（MAC地址格式）
	 * @returns {string} WiFi MAC地址，失败返回 空字符串
	 */
	static calculateWifiMacUnbind(user_equipment_id) {
	    return new Promise((resolve, reject) => {
	      wx.request({
	        url: `${BASE_URL}/shopapi/UserEquipment/unbind`,
	        method: 'POST',
	    header: {
	      'version': '3.1.1',
		  "token": getLatestToken()
	    },
	        data: {
	          user_equipment_id: user_equipment_id
	        },
	        success: (res) => {
	          console.log('设备注册成功:', res);
	          resolve(res.data);
	        },
	        fail: (error) => {
	          console.error('设备注册失败:', error);
	          reject(error);
	        }
	      });
	    });
	}
	
	/**
	 * 设备列表
	 * WiFi MAC = 蓝牙MAC尾数 - 1
	 * @param {string} page_no 蓝牙设备ID（MAC地址格式）
	 * * @param {string} page_size 蓝牙设备ID（MAC地址格式）
	 * @returns {string} WiFi MAC地址，失败返回 空字符串
	 */
	static GetEquipmentLists(page_no,page_size) {
	    return new Promise((resolve, reject) => {
	      wx.request({
	        url: `${BASE_URL}/shopapi/UserEquipment/getEquipmentLists`,
	        method: 'POST',
        header: {
          'version': '3.1.1',
		  "token": getLatestToken()
        },
	        data: {
	          page_no: page_no,
			  page_size:page_size
	        },
	        success: (res) => {
	          resolve(res.data);
	        },
	        fail: (error) => {
	          reject(error);
	        }
	      });
	    });
	}
	
	/**
	 * 获取快捷用户列表
	 * WiFi MAC = 蓝牙MAC尾数 - 1
	 * @param {string} page_no 蓝牙设备ID（MAC地址格式）
	 * * @param {string} page_size 蓝牙设备ID（MAC地址格式）
	 * @returns {string} WiFi MAC地址，失败返回 空字符串
	 */
	static GetFastUserList(page_no,page_size) {
	    return new Promise((resolve, reject) => {
	      wx.request({
	        url: `${BASE_URL}/shopapi/UserEquipment/getFastUserList`,
	        method: 'POST',
        header: {
          'version': '3.1.1',
		  "token": getLatestToken()
        },
	        data: {
	          page_no: page_no,
			  page_size:page_size
	        },
	        success: (res) => {
	          resolve(res.data);
	        },
	        fail: (error) => {
	          reject(error);
	        }
	      });
	    });
	}
	
	/**
	 * 添加快捷用户
	 * WiFi MAC = 蓝牙MAC尾数 - 1
	 * @param {string} account 账号
	 * @param {string} password 密码
	 * @returns {Promise<object>} 接口响应
	 */
	static AddFastUser(account,password) {
	    return new Promise((resolve, reject) => {
	      wx.request({
	        url: `${BASE_URL}/shopapi/UserEquipment/addFastUser`,
	        method: 'POST',
        header: {
          'version': '3.1.1',
		  "token": getLatestToken()
        },
	        data: {
	          account: account,
			  password:password
	        },
	        success: (res) => {
	          resolve(res.data);
	        },
	        fail: (error) => {
	          reject(error);
	        }
	      });
	    });
	}
	
	/**
	 * 解绑快捷用户
	 * WiFi MAC = 蓝牙MAC尾数 - 1
	 * @param {string} target_user_id id
	 * @returns {Promise<object>} 接口响应
	 */
	static UnbindFast(target_user_id) {
	    return new Promise((resolve, reject) => {
	      wx.request({
	        url: `${BASE_URL}/shopapi/UserEquipment/unbindFast`,
	        method: 'POST',
	    header: {
	      'version': '3.1.1',
		  "token": getLatestToken()
	    },
	        data: {
	          target_user_id: target_user_id,
	        },
	        success: (res) => {
	          resolve(res.data);
	        },
	        fail: (error) => {
	          reject(error);
	        }
	      });
	    });
	}
	
	
	
	
	/**
	 * 获取重置密码短信
	 * WiFi MAC = 蓝牙MAC尾数 - 1
	 * @param {string} mobile 手机号
	 * @returns {Promise<object>} 接口响应
	 */
	static ResetPasswordCaptcha(mobile) {
	    return new Promise((resolve, reject) => {
	      wx.request({
	        url: `${BASE_URL}/shopapi/user/resetPasswordCaptcha`,
	        method: 'POST',
	    header: {
	      'version': '3.1.1',
		  "token": getLatestToken()
	    },
	        data: {
	          mobile: mobile,
	        },
	        success: (res) => {
	          resolve(res.data);
	        },
	        fail: (error) => {
	          reject(error);
	        }
	      });
	    });
	}
	
	/**
	 * 重置密码
	 * WiFi MAC = 蓝牙MAC尾数 - 1
	 * @param {string} mobile 手机号
	 * @returns {Promise<object>} 接口响应
	 */
	static ResetPassword(password,code,mobile) {
	    return new Promise((resolve, reject) => {
	      wx.request({
	        url: `${BASE_URL}/shopapi/user/resetPassword`,
	        method: 'POST',
	    header: {
	      'version': '3.1.1',
		  "token": getLatestToken()
	    },
	        data: {
				password:password,
				code:code,
				mobile: mobile,
	        },
	        success: (res) => {
	          resolve(res.data);
	        },
	        fail: (error) => {
	          reject(error);
	        }
	      });
	    });
	}
}

module.exports = BluetoothManager; 