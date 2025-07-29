const { checkWifiAuth, checkBluetoothAndLocationByDeviceType } = require('../../utils/permissionUtil');
const commonUtil  = require('../../utils/commonUtil');

Page({
    data: {
        //步骤
        currentTab: 0, // 当前步骤
        stepsCompleted: [false, false, false], // 步骤完成状态
        totalSteps: 3, // 总步骤数
        //蓝牙
        devices: [], // 搜索到的蓝牙设备
        connectedDeviceId: '', // 已连接的蓝牙设备ID.
        send_characteristicId: '', // 写入特征值ID
        notify_cId: '', // 通知特征值ID
        serviceId: '', // 服务ID
        isRefreshing: false, // 下拉刷新状态
        //wifi
        isWifiConnected: false, // 手机是否已连接WiFi
        wifiName: '', // 当前或已选WiFi名称
        wifiList: [], // 可选WiFi列表
        wifiPassword: '', // WiFi密码
        wifiSelected: false, // 是否已选WiFi
        wifiConnectSuccess: false, //wifi连接状态
        showWifiList:false, //是否显示wifi列表
        is5GConnected: false, //是否5G
        _has5GTip: false, // 防止重复弹出5G提示
        _has5GTipModal: false, // 进入WiFi步骤时重置弹窗标记
        wifiMac:'', //wifi Mac地址
        // WiFi状态检测
        showWifiModal: false, // 是否显示WiFi弹窗
        wifiModalContent: '', // WiFi弹窗内容
        wifiStatusCheckTimer: null // WiFi状态检测定时器
    },

    // 页面加载时初始化进度
    onLoad() {

    },

    // 页面显示时，如果在蓝牙步骤则自动搜索设备
    onShow() {

        this.isPageActive = true;
        // 读取本地已连接设备状态
        const device = wx.getStorageSync('connectedDevice');
        if (device && device.deviceId) {
            this.setData({
                connectedDeviceId: device.deviceId
            });
        }
        if (this.data.currentTab === 0) {
            this.checkAllPermissions()
               .then(() => {
                    this.searchBluetoothDevices();
                })
               .catch(() => {
                    wx.showToast({ title: '权限不足，无法搜索设备', icon: 'none' });
                });
        }
    },

    onHide() {
        this.isPageActive = false;
        // 页面隐藏时清除WiFi状态检测定时器
        this.clearWifiStatusCheck();
    },

    onUnload() {
        this.isPageActive = false;
        // 页面卸载时清除WiFi状态检测定时器
        this.clearWifiStatusCheck();
    },

    // 检查所有权限（蓝牙步骤时调用）
    checkAllPermissions() {
        return checkBluetoothAndLocationByDeviceType();
    },

    // scroll-view下拉刷新（仅蓝牙步骤可用）
    onContentRefresh() {
        if (this.data.currentTab === 0) {
            this.setData({ isRefreshing: true });
            this.checkAllPermissions()
               .then(() => {
                    this.searchBluetoothDevices(() => {
                        this.setData({ isRefreshing: false });
                    });
                })
               .catch(() => {
                    this.setData({ isRefreshing: false });
                    wx.showToast({ title: '权限不足，无法搜索设备', icon: 'none' });
                });
        } else {
            this.setData({ isRefreshing: false });
        }
    },

    /**
     * 安全蓝牙扫描，防止频繁调用startBluetoothDevicesDiscovery导致报错
     * 每次扫描前先stop再start，确保系统允许新一轮扫描
     * @returns {Promise}
     */
    async safeStartBluetoothDevicesDiscovery() {
        try {
            console.log('[safeStartBluetoothDevicesDiscovery] 尝试停止上一次扫描');
            await new Promise(res => wx.stopBluetoothDevicesDiscovery({ complete: res }));
            console.log('[safeStartBluetoothDevicesDiscovery] 已停止上一次扫描');
        } catch (e) {
            console.warn('[safeStartBluetoothDevicesDiscovery] stopBluetoothDevicesDiscovery异常', e);
        }
        return new Promise((resolve, reject) => {
            console.log('[safeStartBluetoothDevicesDiscovery] 开始新一轮扫描');
            wx.startBluetoothDevicesDiscovery({
                allowDuplicatesKey: false,
                success: (res) => {
                    console.log('[safeStartBluetoothDevicesDiscovery] 扫描启动成功', res);
                    resolve(res);
                },
                fail: (err) => {
                    console.error('[safeStartBluetoothDevicesDiscovery] 扫描启动失败', err);
                    reject(err);
                }
            });
        });
    },

    /**
     * 搜索蓝牙设备，只显示名称包含GOODSLEEP的设备
     * 每次搜索前重启蓝牙适配器，并用safeStartBluetoothDevicesDiscovery防止频繁扫描报错
     * 支持多次重试，提升首次搜索成功率
     * @param {Function} callback 搜索完成后的回调
     */
    async searchBluetoothDevices(callback) {
        const searchDuration = 2000; // 每次扫描时长（毫秒）
        const maxRetryCount = 3; // 最大重试次数
        let retryCount = 0;
        // 每次搜索前重启蓝牙适配器，提升首次搜索成功率
        try { 
            console.log('[searchBluetoothDevices] 尝试关闭蓝牙适配器');
            wx.closeBluetoothAdapter({ complete: () => {} }); 
            console.log('[searchBluetoothDevices] 蓝牙适配器已关闭');
        } catch(e) {
            console.warn('[searchBluetoothDevices] 关闭蓝牙适配器异常', e);
        }
        while (retryCount < maxRetryCount) {
          try {
            console.log(`[searchBluetoothDevices] 第${retryCount+1}次尝试打开蓝牙适配器`);
            await this.openBluetoothAdapter();
            // 每次扫描前先stop再start，防止频繁报错
            await this.safeStartBluetoothDevicesDiscovery();
            console.log('[searchBluetoothDevices] 扫描中...');
            await new Promise(resolve => setTimeout(resolve, searchDuration));
            const res = await this.getBluetoothDevices();
            // 只筛选名称包含GOODSLEEP的设备
            let goodsleepDevices = res.devices.filter(d => d.name && d.name.indexOf('GOODSLEEP') !== -1);
            // 如果已连接设备不在当前搜索结果中，手动加进去并标记
            const connectedDeviceId = this.data.connectedDeviceId;
            if (connectedDeviceId && !goodsleepDevices.some(d => d.deviceId === connectedDeviceId)) {
                goodsleepDevices = [
                    { deviceId: connectedDeviceId, name: 'GOODSLEEP (已连接)' },
                    ...goodsleepDevices
                ];
            }
            this.setData({ devices: goodsleepDevices });
            await this.stopBluetoothDevicesDiscovery();
            if (goodsleepDevices.length > 0) {
              console.log('[searchBluetoothDevices] 搜索到GOODSLEEP设备，结束扫描');
              if (typeof callback === 'function') callback();
              return;
            } else {
              console.log(`[searchBluetoothDevices] 未搜索到设备，重试(${retryCount+1}/${maxRetryCount})`);
              retryCount++;
            }
          } catch (err) {
            console.error(`[searchBluetoothDevices] 搜索蓝牙设备出错，重试(${retryCount+1}/${maxRetryCount})`, err);
            retryCount++;
          }
        }
        wx.showModal({
          title: '未搜索到设备',
          content: '如长时间未搜索到设备，请尝试关闭手机蓝牙后重新打开再试。',
          showCancel: false
        });
        if (typeof callback === 'function') callback();
    },

    openBluetoothAdapter() {
        return new Promise((resolve, reject) => {
            wx.openBluetoothAdapter({
                success: resolve,
                fail: (err) => {
                    console.error('openBluetoothAdapter失败:', err);
                    wx.showToast({ title: '请打开蓝牙', icon: 'none' });
                    reject(err);
                }
            });
        });
    },

    getBluetoothDevices() {
        return new Promise((resolve, reject) => {
            wx.getBluetoothDevices({
                success: resolve,
                fail: (err) => {
                    console.error('获取蓝牙设备列表失败:', err);
                    reject(err);
                }
            });
        });
    },

    stopBluetoothDevicesDiscovery() {
        return new Promise((resolve, reject) => {
            wx.stopBluetoothDevicesDiscovery({
                success: resolve,
                fail: (err) => {
                    console.error('stopBluetoothDevicesDiscovery失败:', err);
                    reject(err);
                }
            });
        });
    },

    // 连接蓝牙设备
    connectBluetooth(deviceId) {
        // const deviceId = e.currentTarget.dataset.deviceId;
        const device = this.data.devices.find(d => d.deviceId === deviceId);
        wx.createBLEConnection({
            deviceId,
            success: () => {
                console.log('蓝牙连接成功:', deviceId);
                // 保存设备信息到本地，便于home页面自动读取
                wx.setStorageSync('connectedDevice', {
                    deviceId: deviceId,
                    name: device ? device.name : ''
                });
                const wifiMacAddress = commonUtil.converAndSaveMac(deviceId);
                if(wifiMacAddress){
                  this.setData({wifiMac: wifiMacAddress})
                  console.log('已保存wifi mac地址：',wifiMacAddress)
                }
                this.setData({
                    connectedDeviceId: deviceId,
                    stepsCompleted: [true, false, false],
                    currentTab: 1
                });
                this.getServiceAndCharacteristics(deviceId);
                this.initWifiStep();
            },
            fail: (err) => {
                console.error('蓝牙连接失败:', err);
                wx.showToast({ title: '连接失败', icon: 'none' });
            }
        });
    },

    // 动态获取服务和特征值ID
    getServiceAndCharacteristics(deviceId) {
        console.log('获取服务列表，deviceId:', deviceId);
        wx.getBLEDeviceServices({
            deviceId,
            success: (res) => {
                console.log('服务列表:', res.services);
                // 选第一个自定义服务或主服务
                const service = res.services.find(s => s.uuid.toUpperCase().indexOf('6E400001') !== -1 || s.isPrimary);
                if (service) {
                    const serviceId = service.uuid;
                    this.setData({ serviceId });
                    console.log('选中的服务ID:', serviceId);
                    wx.getBLEDeviceCharacteristics({
                        deviceId,
                        serviceId,
                        success: (resCha) => {
                            console.log('特征值列表:', resCha.characteristics);
                            let send_characteristicId = '';
                            let notify_cId = '';
                            // 遍历特征值，按uuid前缀筛选
                            for (let i = 0; i < resCha.characteristics.length; i++) {
                                const uuid = resCha.characteristics[i].uuid;
                                const uuidPrefix = uuid.substring(0, 8).toUpperCase();
                                if (uuidPrefix === "0000C304") {
                                    send_characteristicId = uuid;
                                } else if (uuidPrefix === "0000C305") {
                                    notify_cId = uuid;
                                }
                            }
                            console.log('写入特征值ID:', send_characteristicId, '通知特征值ID:', notify_cId);
                            this.setData({
                                send_characteristicId,
                                notify_cId
                            });
                            // 进入下一步
                            this.onBluetoothConnected();
                        },
                        fail: (err) => {
                            console.error('获取特征值列表失败:', err);
                            wx.showToast({ title: '获取特征值失败', icon: 'none' });
                        }
                    });
                } else {
                    wx.showToast({ title: '未找到服务', icon: 'none' });
                    console.error('未找到目标服务');
                }
            },
            fail: (err) => {
                console.error('获取服务列表失败:', err);
                wx.showToast({ title: '获取服务列表失败', icon: 'none' });
            }
        });
    },

    // 蓝牙连接成功后进入WiFi配网步骤
    onBluetoothConnected() {
        this.setData({
            currentTab: 1,
            stepsCompleted: [true, false, false]
        });
        this._has5GTipModal = false; // 进入WiFi步骤时重置弹窗标记
        this.initWifiStep();
    },

    // 初始化WiFi步骤，判断手机是否已连接WiFi
    async initWifiStep() {
        if (!this.isPageActive) {
            console.log('页面已隐藏，不再进行WiFi初始化');
            return;
        }
        console.log('开始初始化WiFi步骤...');
        
        // 先检查WiFi状态
        const wifiStatus = await this.checkWifiStatus();
        if (!wifiStatus.isWifiEnabled) {
            // WiFi未开启，显示弹窗
            this.showWifiStatusModal('请先打开手机WiFi开关');
            return;
        }
        
        try {
            await checkWifiAuth();
            await this.startWifi();
            console.log('startWifi 成功，准备获取当前已连接WiFi...');
            const res = await this.getConnectedWifi();
            console.log('手机已连接WiFi，SSID:', res.wifi.SSID);
            //判断是否为5G
            const is5G = res.wifi.frequency && res.wifi.frequency >= 3000;
            this.setData({
                isWifiConnected: true,
                wifiName: res.wifi.SSID,
                wifiSelected: true,
                showWifiList: false,
                is5GConnected: is5G
            });
            if (is5G && !this._has5GTipModal) {
                this._has5GTipModal = true;
                wx.showModal({
                    title: '温馨提示',
                    content: '当前连接的是5G WiFi，仅支持2.4G WiFi，请更换WiFi',
                    confirmText: '更换wifi',
                    cancelText: '取消',
                    success: (res) => {
                        if (res.confirm) {
                            this.showWifiList();
                        }
                    }
                });
            }
        } catch (err) {
            console.log('手机未连接WiFi，准备获取WiFi列表...');
            try {
                await this.getWifiList();
            } catch (err) {
                console.error('获取WiFi列表失败');
                this.showWifiStatusModal('获取WiFi列表失败，请确保已打开手机WiFi开关并授权位置信息');
                this.setData({
                    isWifiConnected: false,
                    wifiList: [],
                    wifiSelected: false,
                    showWifiList: false,
                    is5GConnected: false
                });
            }
        }
    },

    /**
     * 检查WiFi状态
     * @returns {Promise<Object>} 返回WiFi状态信息
     */
    async checkWifiStatus() {
        return new Promise((resolve) => {
            wx.getSystemInfo({
                success: (res) => {
                    // 通过尝试启动WiFi来判断WiFi是否开启
                    wx.startWifi({
                        success: () => {
                            resolve({
                                isWifiEnabled: true,
                                systemInfo: res
                            });
                        },
                        fail: () => {
                            resolve({
                                isWifiEnabled: false,
                                systemInfo: res
                            });
                        }
                    });
                },
                fail: () => {
                    resolve({
                        isWifiEnabled: false,
                        systemInfo: null
                    });
                }
            });
        });
    },

    /**
     * 显示WiFi状态弹窗
     * @param {string} content 弹窗内容
     */
    showWifiStatusModal(content) {
        this.setData({
            showWifiModal: true,
            wifiModalContent: content
        });
        // 启动WiFi状态检测定时器
        this.startWifiStatusCheck();
    },

    /**
     * 隐藏WiFi状态弹窗
     */
    hideWifiStatusModal() {
        this.setData({
            showWifiModal: false,
            wifiModalContent: ''
        });
        // 清除WiFi状态检测定时器
        this.clearWifiStatusCheck();
    },

    /**
     * 处理WiFi弹窗确认事件
     */
    onWifiModalConfirm() {
        this.hideWifiStatusModal();
        // 重新检查WiFi状态
        this.checkWifiStatusAndRetry();
    },

    /**
     * 检查WiFi状态并重试
     */
    async checkWifiStatusAndRetry() {
        const wifiStatus = await this.checkWifiStatus();
        if (wifiStatus.isWifiEnabled) {
            // WiFi已开启，重新初始化WiFi步骤
            console.log('WiFi已开启，重新初始化WiFi步骤');
            this.initWifiStep();
        } else {
            // WiFi仍未开启，继续显示弹窗
            this.showWifiStatusModal('请先打开手机WiFi开关');
        }
    },

    /**
     * 开始WiFi状态检测定时器
     */
    startWifiStatusCheck() {
        // 清除之前的定时器
        this.clearWifiStatusCheck();
        
        // 每3秒检查一次WiFi状态
        this.data.wifiStatusCheckTimer = setInterval(() => {
            if (this.data.showWifiModal) {
                this.checkWifiStatusAndRetry();
            }
        }, 3000);
    },

    /**
     * 清除WiFi状态检测定时器
     */
    clearWifiStatusCheck() {
        if (this.data.wifiStatusCheckTimer) {
            clearInterval(this.data.wifiStatusCheckTimer);
            this.data.wifiStatusCheckTimer = null;
        }
    },

    startWifi() {
        return new Promise((resolve, reject) => {
            wx.startWifi({
                success: resolve,
                fail: () => {
                    console.error('startWifi 失败，请先在手机上打开WiFi开关');
                    wx.showModal({
                        title: '提示',
                        content: '请先在手机上打开WiFi开关。',
                        showCancel: false
                    });
                    reject();
                }
            });
        });
    },

    getConnectedWifi() {
        return new Promise((resolve, reject) => {
            wx.getConnectedWifi({
                success: resolve,
                fail: reject
            });
        });
    },

    getWifiList() {
      return new Promise((resolve, reject) => {
        // 先移除之前的监听，防止多次注册
        wx.offGetWifiList && wx.offGetWifiList();
        wx.getWifiList({
          success: () => {
            wx.onGetWifiList((listRes) => {
              // 只保留2.4G WiFi   
              const wifiList = (listRes.wifiList || []).filter(item => item.frequency && item.frequency < 3000 && item.SSID);
              this.setData({
                isWifiConnected: false,
                wifiList: wifiList,
                wifiSelected: false
              });
              resolve();
            });
          },
          fail: reject
        });
      });
    },

    // 点击"更换WiFi"按钮
    showWifiList() {
      this.getWifiList().then(() => {
        this.setData({
          showWifiList: true,
          wifiSelected: false
        });
      });
    },
    
    // 选择WiFi（仅未连接时可选）
    selectWifi(e) {
      const ssid = e.currentTarget.dataset.ssid;
      const wifi = this.data.wifiList.find(w => w.SSID === ssid);
      const is5G = wifi && wifi.frequency >= 4900;
      this.setData({
        wifiName: ssid,
        wifiSelected: true,
        showWifiList: false,
        is5GConnected: is5G
      });
    },
  
    // WiFi密码输入
    onInputPassword(e) {
        console.log('用户输入WiFi密码:', e.detail.value);
        this.setData({
            wifiPassword: e.detail.value
        });
    },
  
    // 发送配网指令
    sendWifiConfig() {
      if (this.data.is5GConnected) return;
      if (!this.data.wifiPassword) {
          wx.showToast({ title: '请输入WiFi密码', icon: 'none' });
          return;
      }
      const cmd = `Good Sleep WIFI ID:"${this.data.wifiName}","${this.data.wifiPassword}"`;
      console.log('发送配网信息',cmd);
      const buffer = this.stringToHex(cmd);
      console.log('写入参数:', {
        deviceId: this.data.connectedDeviceId,
        serviceId: this.data.serviceId,
        characteristicId: this.data.send_characteristicId,
        value: buffer,
        length: buffer.byteLength
      });
      wx.writeBLECharacteristicValue({
          deviceId: this.data.connectedDeviceId,
          serviceId: this.data.serviceId,
          characteristicId: this.data.send_characteristicId,
          value: buffer,
          success: () => {
              wx.showLoading({ title: 'WiFi连接中' });
              this.listenForDeviceStatus();
          },
          fail: (err) => {
              console.error('配网指令发送失败:', err);
              wx.showToast({ title: '发送失败', icon: 'none' });
          }
      });
  },
  
    // 监听设备返回的配网状态
    listenForDeviceStatus() {
        if (!this.isPageActive) {
            console.log('页面已隐藏，不再监听设备状态');
            wx.hideLoading();
            return;
        }
        const { connectedDeviceId, serviceId, notify_cId } = this.data;
        // 先移除旧监听，防止多次回调
        wx.offBLECharacteristicValueChange && wx.offBLECharacteristicValueChange();
        wx.notifyBLECharacteristicValueChange({
            deviceId: connectedDeviceId,
            serviceId: serviceId,
            characteristicId: notify_cId,
            state: true,
            success: () => {
                console.log('notifyBLECharacteristicValueChange 成功，开始监听设备回包');
                wx.onBLECharacteristicValueChange((res) => {
                    console.log('收到设备回包:', res);
                    console.log('设备返回的状态码status',res.value)
                    wx.hideLoading();
                    const value = new Uint8Array(res.value);
                    const status = value[value.length - 1];
                    this.handleDeviceStatus(status);
                });
            },
            fail: (err) => {
                console.error('notifyBLECharacteristicValueChange 失败:', err);
                wx.hideLoading();
                wx.showToast({ title: '监听设备状态失败', icon: 'none' });
            }
        });
    },
  
    handleDeviceStatus(status) {
      if (!this.isPageActive) return;
      if ((status === 0x01 || status === 0x04) && !this.data.wifiConnectSuccess) {
        wx.hideLoading();
        this.setData({ wifiConnectSuccess: true });
        wx.showToast({ title: 'WIFI连接成功', icon: 'success' });
        this.completeStep();
      } else if (status === 0x03) {
        console.error("wifi连接失败，错误码===",status)
      } else if (status === 0x05) {
        console.error("tcp断开，错误码===",status)
         
      } else if (status === 0x06) {
        console.error("wifi断开，错误码===",status)
      } else if (status === 0x07) {
        console.error("不在床，错误码===",status)
      } else {
        console.error("未知状态，错误码===",status)
      }
    },
  
    // 步骤完成，自动进入下一步
    completeStep() {
        const currentTab = this.data.currentTab;
        const stepsCompleted = [...this.data.stepsCompleted];
        stepsCompleted[currentTab] = true;
        let nextTab = currentTab;
        if (currentTab < this.data.totalSteps - 1) {
            nextTab = currentTab + 1;
        }
        this.setData({
            stepsCompleted: stepsCompleted,
            currentTab: nextTab
        });
    },
  
    // 配网完成，返回首页
    finishAndReturn() {
        // this.disconnectBluetooth();
        const stepsCompleted = [...this.data.stepsCompleted];
        stepsCompleted[2] = true;
        this.setData({
            stepsCompleted: stepsCompleted
        });
        wx.switchTab({
          url: '/pages/home/home'
        });
    },
  
    // 字符串转ArrayBuffer
    stringToHex(str) {
        var dataView = new Uint8Array(str.length);
        for (var i = 0, l = str.length; i < l; i++) {
            dataView[i] = str.charCodeAt(i);
        }
        // console.log('字符串转字符数组',dataView)
        return dataView.buffer;
    },
  
    // 返回上一级
    onBack() {
        wx.navigateBack();
    },

    // 断开蓝牙连接
    disconnectBluetooth() {
        if (this.data.connectedDeviceId) {
            wx.closeBLEConnection({
                deviceId: this.data.connectedDeviceId
            });
            this.setData({
                connectedDeviceId: '',
                send_characteristicId: '',
                notify_cId: '',
                serviceId: ''
            });
        }
    },

    // 断开已连接设备
    disconnectCurrentDevice() {
        const deviceId = this.data.connectedDeviceId;
        if (deviceId) {
            wx.closeBLEConnection({
                deviceId,
                complete: () => {
                    wx.removeStorageSync('connectedDevice');
                    this.setData({
                        connectedDeviceId: '',
                        currentTab: 0,   // 断开后回到第一步
                        devices: []      // 清空设备列表，防止显示旧数据
                    });
                    wx.showToast({ title: '已断开设备', icon: 'none' });
                    // 重新刷新设备列表
                    this.searchBluetoothDevices();
                }
            });
        }
    },

    /**
     * 自定义switch点击事件
     */
    onCustomSwitchTap(e) {
      const deviceId = e.currentTarget.dataset.deviceid;
      if (deviceId === this.data.connectedDeviceId) {
          // 已连接时点击，执行断开
          this.disconnectCurrentDevice();
          return;
      }
      this.connectBluetooth(deviceId);
  }
  });