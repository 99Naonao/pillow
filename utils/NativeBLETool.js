/**
 * 原生蓝牙工具类（微信小程序 wx.* API）
 * 功能：初始化/搜索/连接/发现服务特征/开启通知/监听特征值
 * 设备筛选：名称或本地名称以“YM”开头
 */

class NativeBLETool {
  constructor() {
    this.deviceId = null;
    this.serviceId = null;
    this.notifyCharId = null;
    this.writeCharId = null;
    this.discovering = false;
    this._events = {};
    this._searchTimer = null;
    this._listenerBound = false;

    this._bindGlobalListeners();
  }

  // 事件 API
  on(event, cb) {
    if (!this._events[event]) this._events[event] = [];
    this._events[event].push(cb);
  }
  off(event, cb) {
    const list = this._events[event];
    if (!list) return;
    const i = list.indexOf(cb);
    if (i > -1) list.splice(i, 1);
  }
  emit(event, payload) {
    const list = this._events[event];
    if (!list || list.length === 0) return;
    list.slice().forEach(fn => {
      try { fn(payload); } catch (e) {}
    });
  }

  _bindGlobalListeners() {
    // 适配器状态
    wx.onBluetoothAdapterStateChange((res) => {
      this.emit('adapterStateChange', res);
    });

    // 连接状态
    wx.onBLEConnectionStateChange((res) => {
      if (res.deviceId === this.deviceId) {
        if (!res.connected) this.emit('disconnected', { deviceId: res.deviceId });
      }
    });

    if (!this._listenerBound) {
      wx.onBLECharacteristicValueChange((res) => {
        if (!res || !res.value) return;
        if (res.deviceId !== this.deviceId || res.serviceId !== this.serviceId) return;
        if (this.notifyCharId && res.characteristicId !== this.notifyCharId) return;
        this.emit('characteristicValue', res.value);
      });
      this._listenerBound = true;
    }
  }

  // 初始化适配器
  initAdapter() {
    return new Promise((resolve, reject) => {
      wx.openBluetoothAdapter({
        success: resolve,
        fail: reject
      });
    });
  }

  // 搜索设备（筛选名称/本地名称以 YM 开头）
  searchDevices(timeout = 15000, prefix = 'YM') {
    return new Promise((resolve, reject) => {
      const found = [];
      const seen = new Set();
      const filter = String(prefix || 'YM').toUpperCase();

      const pushIfMatch = (d) => {
        const name = (d.name || d.localName || '').toUpperCase();
        if (!name || !name.startsWith(filter)) return;
        if (seen.has(d.deviceId)) return;
        seen.add(d.deviceId);
        const info = {
          deviceId: d.deviceId,
          name: d.name || '',
          localName: d.localName || '',
          RSSI: d.RSSI,
          advertisData: d.advertisData || null,
          advertisServiceUUIDs: d.advertisServiceUUIDs || null
        };
        found.push(info);
        this.emit('deviceFound', info);
      };

      // 先解绑，再绑定，避免重复绑定导致收不到回调
      try { wx.offBluetoothDeviceFound(); } catch (e) {}
      wx.onBluetoothDeviceFound((res) => {
        const list = Array.isArray(res.devices)
          ? res.devices
          : (res.devices ? [res.devices] : (res.device ? [res.device] : []));
        if (!list || list.length === 0) return;
        list.forEach(pushIfMatch);
      });

      wx.startBluetoothDevicesDiscovery({
        allowDuplicatesKey: true,
        services: [],
        success: () => {
          this.discovering = true;
          this._searchTimer && clearTimeout(this._searchTimer);
          this._searchTimer = setTimeout(() => {
            this.stopSearch();
            resolve(found);
          }, timeout);
        },
        fail: reject
      });
    });
  }

  stopSearch() {
    if (!this.discovering) return;
    this.discovering = false;
    try { clearTimeout(this._searchTimer); } catch (e) {}
    wx.stopBluetoothDevicesDiscovery({ complete: () => {} });
    try { wx.offBluetoothDeviceFound(); } catch (e) {}
  }

  // 连接并开启通知
  async connectAndListen(deviceId) {
    this.deviceId = deviceId;
    await this._createConnection(deviceId);
    const serviceId = await this._pickService(deviceId);
    const { notifyId, writeId } = await this._pickCharacteristics(deviceId, serviceId);
    await this._enableNotify(deviceId, serviceId, notifyId);
    this.emit('connected', { deviceId, serviceId, characteristicId: notifyId });
  }

  _createConnection(deviceId) {
    return new Promise((resolve, reject) => {
      wx.createBLEConnection({
        deviceId,
        success: resolve,
        fail: reject
      });
    });
  }

  _pickService(deviceId) {
    return new Promise((resolve, reject) => {
      wx.getBLEDeviceServices({
        deviceId,
        success: (res) => {
          // 优先非标准主服务
          const firstCustom = (res.services || []).find(s => s.isPrimary && !/00001800|00001801|0000180A|0000180D/i.test(s.uuid));
          const target = firstCustom || (res.services || []).find(s => s.isPrimary) || (res.services || [])[0];
          if (!target) { reject({ errorMsg: 'no-service' }); return; }
          this.serviceId = target.uuid;
          resolve(target.uuid);
        },
        fail: reject
      });
    });
  }

  _pickCharacteristics(deviceId, serviceId) {
    return new Promise((resolve, reject) => {
      wx.getBLEDeviceCharacteristics({
        deviceId,
        serviceId,
        success: (res) => {
          const list = res.characteristics || [];
          const notifyOnly = list.find(c => c.properties && c.properties.notify && !c.properties.indicate);
          const anyNotify = list.find(c => (c.properties && (c.properties.notify || c.properties.indicate)));
          const write = list.find(c => c.properties && (c.properties.write || c.properties.writeNoResponse));
          const notifyId = (notifyOnly || anyNotify || {}).uuid;
          if (!notifyId) { reject({ errorMsg: 'no-notify' }); return; }
          this.notifyCharId = notifyId;
          this.writeCharId = write ? write.uuid : notifyId;
          resolve({ notifyId: this.notifyCharId, writeId: this.writeCharId });
        },
        fail: reject
      });
    });
  }

  _enableNotify(deviceId, serviceId, characteristicId) {
    return new Promise((resolve, reject) => {
      wx.notifyBLECharacteristicValueChange({
        deviceId,
        serviceId,
        characteristicId,
        state: true,
        success: resolve,
        fail: reject
      });
    });
  }

  // 写入（可选）
  write(buffer) {
    return new Promise((resolve, reject) => {
      if (!this.deviceId || !this.serviceId || !this.writeCharId) {
        reject({ errorMsg: 'not-connected' });
        return;
      }
      wx.writeBLECharacteristicValue({
        deviceId: this.deviceId,
        serviceId: this.serviceId,
        characteristicId: this.writeCharId,
        value: buffer,
        success: resolve,
        fail: reject
      });
    });
  }
}

module.exports = NativeBLETool;


