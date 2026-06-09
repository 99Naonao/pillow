const CommonUtil = require('../../utils/commonUtil');
const AuthApi = require('../../utils/authApi');
const BluetoothManager = require('../../utils/bluetoothManager');
Page({
  data: {
    devices: [],
    isLoading: false,
    hasError: false,
    lastUpdated: '',
    pageNo: 1,
    pageSize: 15,
    hasMore: true,
    isLoadingMore: false,
    switchingDeviceMac: null,
    unbindingDeviceId: null,
    currentDeviceMac: null,
    namingDeviceId: null,
    showNameModal: false,
    nameModalDeviceId: null,
    nameModalDeviceName: '',
    nameInputValue: ''
  },

  onLoad() {
    // 获取当前设备MAC
    this._updateCurrentDeviceMac();
    this.loadDevices();
  },

  onPullDownRefresh() {
    this.loadDevices(true);
  },

  onBack() {},

  onRefreshTap() {
    this.loadDevices(true);
  },

  onReachBottom() {
    if (!this.data.hasMore || this.data.isLoading || this.data.isLoadingMore) {
      return;
    }
    this.loadDevices(false, { append: true });
  },

  async loadDevices(showToast = false, options = {}) {
    const { append = false } = options;
    if (append && (!this.data.hasMore || this.data.isLoadingMore)) {
      return;
    }
    if (!append && this.data.isLoading) {
      return;
    }

    const nextPage = append ? this.data.pageNo + 1 : 1;
    this.setData({
      isLoading: append ? false : true,
      isLoadingMore: append,
      hasError: false,
      ...(append ? {} : { pageNo: 1, hasMore: true })
    });

    try {
      const response = await BluetoothManager.GetEquipmentLists(nextPage, this.data.pageSize);
      console.log('设备列表接口返回:', response);
      const { lists, hasMore } = this._transformEquipmentResponse(response, nextPage);
	  
      const nextDevices = append ? [...this.data.devices, ...response.data.lists] : response.data.lists;
	console.log("nextDevices",nextDevices)
      // 更新当前设备MAC
      this._updateCurrentDeviceMac();
      this.setData({
        devices: nextDevices,
        pageNo: nextPage,
        hasMore,
        isLoading: false,
        isLoadingMore: false,
        hasError: false,
        lastUpdated: this._formatTimestamp(new Date())
      });

      if (showToast) {
        wx.showToast({
          title: append ? '加载成功' : '已刷新',
          icon: 'success'
        });
      }
    } catch (error) {
      console.error('加载设备列表失败:', error);
      this.setData({
        isLoading: false,
        isLoadingMore: false,
        hasError: append ? this.data.hasError : true
      });
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    } finally {
      if (!append) {
        wx.stopPullDownRefresh();
      }
    }
  },

  copyMac(event) {
    const { mac } = event.currentTarget.dataset;
    if (!mac) {
      return;
    }
    wx.setClipboardData({
      data: mac,
      success: () => {
        wx.showToast({ title: '已复制', icon: 'success' });
      },
      fail: () => {
        wx.showToast({ title: '复制失败', icon: 'none' });
      }
    });
  },

  onSwitchDeviceTap(event) {
    const { mac } = event.currentTarget.dataset || {};
    if (!mac) {
      wx.showToast({
        title: '设备信息不完整',
        icon: 'none'
      });
      return;
    }
    if (this.data.switchingDeviceMac === mac) {
      return;
    }

    this.setData({ switchingDeviceMac: mac });
    wx.showLoading({
      title: '切换中...',
      mask: true
    });

    try {
      const storageKey = CommonUtil.STORAGE_KEY || 'wifi_device_mac';
      wx.setStorageSync(storageKey, mac);
      // 更新当前设备MAC
      this.setData({ currentDeviceMac: mac });
      wx.showToast({
        title: '切换成功',
        icon: 'success'
      });
      // 可以在这里触发页面刷新或通知其他页面设备已切换
      setTimeout(() => {
        this.loadDevices(false);
      }, 500);
    } catch (error) {
      console.error('切换设备失败:', error);
      wx.showToast({
        title: '切换失败，请稍后重试',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
      this.setData({ switchingDeviceMac: null });
    }
  },

  _appendMac(mac, macSet) {
    if (!mac || typeof mac !== 'string') {
      return;
    }
    const trimmed = mac.trim();
    if (!trimmed) {
      return;
    }
    if (CommonUtil.isValidMac(trimmed)) {
      macSet.add(trimmed.toUpperCase());
    } else {
      macSet.add(trimmed);
    }
  },

  _transformEquipmentResponse(response, pageNo) {
    const payload = response && typeof response === 'object' ? (response.data || response) : {};
    const rawList = this._extractListFromPayload(payload);
    const macSet = new Set();
    rawList.forEach(item => {
      const mac = this._normalizeDeviceEntry(item);
      if (mac) {
        this._appendMac(mac, macSet);
      }
    });
    const devices = Array.from(macSet);

    if (devices.length === 0 && pageNo === 1) {
      const fallbackSet = new Set();
      const associatedMacs = CommonUtil.getAssociatedDeviceMacs();
      associatedMacs.forEach(mac => this._appendMac(mac, fallbackSet));
      const userInfo = AuthApi.getUserInfo() || {};
      this._extractMacsFromUserInfo(userInfo).forEach(mac => this._appendMac(mac, fallbackSet));
      return {
        list: Array.from(fallbackSet),
        hasMore: false
      };
    }

    const totalPages = this._extractTotalPages(response);
    const hasMore = typeof totalPages === 'number'
      ? pageNo < totalPages
      : devices.length >= this.data.pageSize;

    return {
      list: devices,
      hasMore
    };
  },

  _extractListFromPayload(payload) {
    if (!payload) {
      return [];
    }
    if (Array.isArray(payload)) {
      return payload;
    }
    if (typeof payload !== 'object') {
      return [];
    }

    const candidateKeys = ['list', 'rows', 'items', 'data', 'datas', 'records', 'equipment_list', 'equipmentList', 'devices'];
    for (const key of candidateKeys) {
      const value = payload[key];
      if (Array.isArray(value)) {
        return value;
      }
      if (value && typeof value === 'object' && value !== payload) {
        const nestedList = this._extractListFromPayload(value);
        if (nestedList.length) {
          return nestedList;
        }
      }
    }
    return [];
  },

  _extractTotalPages(response) {
    if (!response || typeof response !== 'object') {
      return null;
    }
    const payloads = [response, response.data, response?.data?.data, response.result];
    const pageKeys = ['total_page', 'totalPage', 'totalPages', 'pages', 'page_total', 'last_page', 'pageCount'];

    for (const payload of payloads) {
      if (!payload || typeof payload !== 'object') {
        continue;
      }
      for (const key of pageKeys) {
        const value = payload[key];
        if (typeof value === 'number' && !Number.isNaN(value)) {
          return value;
        }
      }
      const total = payload.total || payload.totalCount || payload.total_count;
      if (typeof total === 'number' && total >= 0) {
        return Math.ceil(total / this.data.pageSize);
      }
    }
    return null;
  },

  _normalizeDeviceEntry(entry) {
    if (!entry) {
      return null;
    }
    if (typeof entry === 'string') {
      return entry.trim();
    }
    if (typeof entry === 'object') {
      const macKeys = ['mac', 'wifi_mac', 'wifiMac', 'device_mac', 'deviceMac', 'device_id', 'deviceId', 'equipment_mac', 'equipmentMac'];
      for (const key of macKeys) {
        const value = entry[key];
        if (typeof value === 'string' && value.trim()) {
          return value.trim();
        }
      }
    }
    return null;
  },

  _extractMacsFromUserInfo(userInfo) {
    const macs = [];
    if (!userInfo || typeof userInfo !== 'object') {
      return macs;
    }

    const candidateKeys = ['deviceList', 'device_list', 'devices', 'equipment', 'equipments', 'equipment_list', 'equipmentList'];
    candidateKeys.forEach(key => {
      const value = userInfo[key];
      if (!value) return;
      if (Array.isArray(value)) {
        value.forEach(item => {
          if (typeof item === 'string') {
            macs.push(item);
          } else if (item && typeof item === 'object') {
            if (item.mac) macs.push(item.mac);
            if (item.wifi_mac) macs.push(item.wifi_mac);
            if (item.device_mac) macs.push(item.device_mac);
          }
        });
      } else if (typeof value === 'string') {
        macs.push(value);
      }
    });

    if (userInfo.mac) macs.push(userInfo.mac);
    if (userInfo.wifi_mac) macs.push(userInfo.wifi_mac);

    return macs;
  },

  _formatTimestamp(date) {
    if (!(date instanceof Date)) {
      return '';
    }
    const pad = (num) => num.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  },

  // 更新当前设备MAC
  _updateCurrentDeviceMac() {
    const currentMac = CommonUtil.getSavedWifiMac();
    this.setData({ currentDeviceMac: currentMac });
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 空函数，用于阻止事件冒泡
  },

  // 设备命名
  onNameDeviceTap(event) {
    const { id, name } = event.currentTarget.dataset || {};
    if (!id) {
      wx.showToast({
        title: '设备信息不完整',
        icon: 'none'
      });
      return;
    }
    if (this.data.namingDeviceId === id) {
      return;
    }

    // 显示命名弹窗
    this.setData({
      showNameModal: true,
      nameModalDeviceId: id,
      nameModalDeviceName: name || '',
      nameInputValue: name || ''
    });
  },

  // 关闭命名弹窗
  onCloseNameModal() {
    this.setData({
      showNameModal: false,
      nameModalDeviceId: null,
      nameModalDeviceName: '',
      nameInputValue: ''
    });
  },

  // 命名输入框变化
  onNameInputChange(e) {
    this.setData({
      nameInputValue: e.detail.value
    });
  },

  // 确认设备命名
  async onConfirmNameDevice() {
    const { nameModalDeviceId, nameInputValue, nameModalDeviceName } = this.data;
    
    if (!nameModalDeviceId) {
      return;
    }

    const deviceName = (nameInputValue || '').trim();
    if (!deviceName) {
      wx.showToast({
        title: '设备名称不能为空',
        icon: 'none'
      });
      return;
    }

    this.setData({ 
      namingDeviceId: nameModalDeviceId,
      showNameModal: false
    });
    
    wx.showLoading({
      title: nameModalDeviceName ? '修改中...' : '命名中...',
      mask: true
    });

    try {
      const result = await BluetoothManager.ChangeName(nameModalDeviceId, deviceName);
      console.log('设备命名响应:', result);
      
      wx.hideLoading();
      
      // 检查响应结果
      if (result.ret === 0 || result.code === 1 || result.code === '1' || result.code === 0) {
        wx.showToast({
          title: nameModalDeviceName ? '修改成功' : '命名成功',
          icon: 'success'
        });
        
        // 刷新设备列表
        setTimeout(() => {
          this.loadDevices(false);
        }, 500);
      } else {
        wx.showModal({
          title: '提示',
          content: result.msg || result.message || (nameModalDeviceName ? '修改失败，请重试' : '命名失败，请重试'),
          showCancel: false,
          confirmText: '确定'
        });
      }
    } catch (error) {
      console.error('设备命名失败:', error);
      wx.hideLoading();
      wx.showModal({
        title: '提示',
        content: error.message || (nameModalDeviceName ? '修改失败，请检查网络后重试' : '命名失败，请检查网络后重试'),
        showCancel: false,
        confirmText: '确定'
      });
    } finally {
      this.setData({ 
        namingDeviceId: null,
        nameModalDeviceId: null,
        nameModalDeviceName: '',
        nameInputValue: ''
      });
    }
  },

  // 解除绑定设备
  async onUnbindDeviceTap(event) {
	  
    const { id } = event.currentTarget.dataset || {};
    if (!id) {
      wx.showToast({
        title: '设备信息不完整',
        icon: 'none'
      });
      return;
    }
    if (this.data.unbindingDeviceId === id) {
      return;
    }

    // 确认解除绑定
    wx.showModal({
      title: '提示',
      content: '确定要解除绑定该设备吗？',
      confirmText: '确定',
      cancelText: '取消',
      success: async (res) => {
        if (res.confirm) {
          this.setData({ unbindingDeviceId: id });
          wx.showLoading({
            title: '解除绑定中...',
            mask: true
          });

          try {
            // 调用解除绑定API，传入user_equipment_id
            const result = await BluetoothManager.calculateWifiMacUnbind(id);
            console.log('解除绑定响应:', result);
            
            wx.hideLoading();
            
            // 检查响应结果
            if (result.ret === 0 || result.code === 1 || result.code === '1') {
              wx.showToast({
                title: '解除绑定成功',
                icon: 'success'
              });
              
              // 刷新设备列表
              setTimeout(() => {
                this.loadDevices(false);
              }, 500);
            } else {
              wx.showModal({
                title: '提示',
                content: result.msg || result.message || '解除绑定失败，请重试',
                showCancel: false,
                confirmText: '确定'
              });
            }
          } catch (error) {
            console.error('解除绑定失败:', error);
            wx.hideLoading();
            wx.showModal({
              title: '提示',
              content: error.message || '解除绑定失败，请检查网络后重试',
              showCancel: false,
              confirmText: '确定'
            });
          } finally {
            this.setData({ unbindingDeviceId: null });
          }
        }
      }
    });
  }
});

