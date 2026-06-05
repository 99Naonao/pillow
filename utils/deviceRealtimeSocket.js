const { getDetectionToken } = require('./tokenHelper');
const CommonUtil = require('./commonUtil');

const WS_BASE = 'wss://bed.qssmart.cn/ws/v1/device-data/';

function normalizeMac(mac) {
  return (mac || '').trim().toUpperCase().replace(/-/g, ':');
}

class DeviceRealtimeSocket {
  constructor() {
    this.socketTask = null;
    this.mac = '';
    this.clientId = null;
    this.subscribed = false;
    this.connected = false;
    this.isConnecting = false;
    this.messageHandler = null;
    this.lastPayload = null;
    this._manualClose = false;
    this._connectPromise = null;
    this._pendingSubscribe = false;
    this._session = 0;
    this._subscribeFallbackTimer = null;
    this._lastPayloadAt = 0;
  }

  setMessageHandler(handler) {
    this.messageHandler = typeof handler === 'function' ? handler : null;
  }

  getLastPayload() {
    return this.lastPayload;
  }

  getLastPayloadTime() {
    return this._lastPayloadAt;
  }

  _normalizeMessage(rawData) {
    if (typeof rawData === 'string') {
      return rawData.trim();
    }
    if (rawData instanceof ArrayBuffer) {
      return this._arrayBufferToString(rawData);
    }
    if (ArrayBuffer.isView(rawData)) {
      return this._arrayBufferToString(rawData.buffer);
    }
    return '';
  }

  _arrayBufferToString(buffer) {
    try {
      if (typeof TextDecoder !== 'undefined') {
        return new TextDecoder('utf-8').decode(buffer).trim();
      }
    } catch (error) {
      console.warn('[DeviceRealtimeSocket] TextDecoder 解码失败:', error);
    }
    const arr = new Uint8Array(buffer);
    let str = '';
    for (let i = 0; i < arr.length; i++) {
      str += String.fromCharCode(arr[i]);
    }
    return str.trim();
  }

  /**
   * 连接并订阅设备实时数据
   * @param {string} mac
   * @returns {Promise<void>}
   */
  connect(mac) {
    const normalizedMac = normalizeMac(mac);
    if (!normalizedMac) {
      return Promise.reject(new Error('设备 MAC 不能为空'));
    }

    if (
      this.connected &&
      this.subscribed &&
      this.mac === normalizedMac &&
      this.socketTask
    ) {
      return Promise.resolve();
    }

    if (this.isConnecting && this._connectPromise && this.mac === normalizedMac) {
      return this._connectPromise;
    }

    this.disconnect(false);
    this.mac = normalizedMac;
    this._manualClose = false;
    this._connectPromise = this._connectAndSubscribe();
    return this._connectPromise;
  }

  async _connectAndSubscribe() {
    this.isConnecting = true;
    try {
      let token = await getDetectionToken();
      try {
        await this._openSocket(token);
      } catch (error) {
        console.warn('[DeviceRealtimeSocket] 首次连接失败，尝试刷新 token 重连:', error);
        token = await getDetectionToken({ forceRefresh: true });
        await this._openSocket(token);
      }
    } finally {
      this.isConnecting = false;
    }
  }

  _clearSubscribeFallback() {
    if (this._subscribeFallbackTimer) {
      clearTimeout(this._subscribeFallbackTimer);
      this._subscribeFallbackTimer = null;
    }
  }

  _scheduleSubscribeFallback() {
    this._clearSubscribeFallback();
    this._subscribeFallbackTimer = setTimeout(() => {
      this._subscribeFallbackTimer = null;
      if (this._pendingSubscribe && this.socketTask && !this.subscribed) {
        console.log('[DeviceRealtimeSocket] 未收到欢迎消息，兜底发送订阅');
        this._sendSubscribe();
      }
    }, 1500);
  }

  _openSocket(token) {
    return new Promise((resolve, reject) => {
      const url = `${WS_BASE}?token=${encodeURIComponent(token)}`;
      console.log('[DeviceRealtimeSocket] 连接地址:', url);
      console.log('[DeviceRealtimeSocket] 连接信息:', {
        base: WS_BASE,
        mac: this.mac,
        tokenLength: token ? token.length : 0
      });
      const session = ++this._session;
      let settled = false;

      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        fn(value);
      };

      const isActive = () => session === this._session;

      const timeout = setTimeout(() => {
        if (!isActive()) return;
        finish(reject, new Error('WebSocket 连接超时'));
        this.disconnect(false);
      }, 15000);

      this.socketTask = wx.connectSocket({
        url,
        complete: () => {}
      });

      this.socketTask.onOpen(() => {
        if (!isActive()) return;
        console.log('[DeviceRealtimeSocket] WebSocket 已连接');
        this.connected = true;
        this._pendingSubscribe = true;
        this._scheduleSubscribeFallback();
      });

      this.socketTask.onMessage((res) => {
        if (!isActive()) return;
        this._handleMessage(res.data, () => {
          clearTimeout(timeout);
          finish(resolve);
        }, (err) => {
          clearTimeout(timeout);
          finish(reject, err);
        });
      });

      this.socketTask.onError((err) => {
        if (!isActive()) return;
        console.error('[DeviceRealtimeSocket] WebSocket 错误:', err);
        clearTimeout(timeout);
        finish(reject, new Error(err.errMsg || 'WebSocket 连接失败'));
      });

      this.socketTask.onClose((res) => {
        if (!isActive()) return;
        console.log('[DeviceRealtimeSocket] WebSocket 已关闭:', res);
        this.connected = false;
        this.subscribed = false;
        this._pendingSubscribe = false;
        this._clearSubscribeFallback();
        this.socketTask = null;
        if (!this._manualClose && this.mac) {
          setTimeout(() => {
            if (!this._manualClose && this.mac && session === this._session) {
              console.log('[DeviceRealtimeSocket] 尝试自动重连');
              this.connect(this.mac).catch((error) => {
                console.error('[DeviceRealtimeSocket] 自动重连失败:', error);
              });
            }
          }, 3000);
        }
      });
    });
  }

  _handleMessage(rawData, onReady, onFail) {
    const data = this._normalizeMessage(rawData);

    if (!data) {
      return;
    }

    if (data.includes('欢迎连接到服务器')) {
      const match = data.match(/您的ID是[:：]\s*([^\s】]+)/);
      this.clientId = match ? match[1] : null;
      console.log('[DeviceRealtimeSocket] 收到欢迎消息, clientId:', this.clientId);
      if (this._pendingSubscribe) {
        this._sendSubscribe();
      }
      return;
    }

    if (data === 'YES') {
      this.subscribed = true;
      this._pendingSubscribe = false;
      this._clearSubscribeFallback();
      console.log('[DeviceRealtimeSocket] 订阅成功:', this.mac);
      if (onReady) onReady();
      return;
    }

    if (data === 'NO') {
      this.subscribed = false;
      console.error('[DeviceRealtimeSocket] 订阅失败:', this.mac);
      if (onFail) onFail(new Error('设备实时数据订阅失败'));
      return;
    }

    try {
      const payload = JSON.parse(data);
      if (payload && typeof payload === 'object') {
        this.lastPayload = payload;
        this._lastPayloadAt = Date.now();
        if (data.length <= 8000) {
          console.log('[DeviceRealtimeSocket] 收到实时数据(原始JSON):', data);
        } else {
          console.log('[DeviceRealtimeSocket] 收到实时数据(原始JSON过长, 仅前8000字符):', data.slice(0, 8000));
        }
        console.log('[DeviceRealtimeSocket] 收到实时数据(摘要):', CommonUtil.snapshotRealtimePayload(payload));
        console.log('[DeviceRealtimeSocket] 收到实时数据(完整):', CommonUtil.cloneRealtimePayloadForLog(payload));
        if (!this.subscribed) {
          this.subscribed = true;
          if (onReady) onReady();
        }
        if (this.messageHandler) {
          this.messageHandler(payload);
        }
      }
    } catch (error) {
      console.warn('[DeviceRealtimeSocket] 非 JSON 消息:', data.slice(0, 200));
    }
  }

  _sendSubscribe(retryCount = 0) {
    if (!this.socketTask || !this.mac || !this._pendingSubscribe) {
      return;
    }

    const task = this.socketTask;
    if (typeof task.readyState === 'number' && task.readyState !== 1) {
      if (retryCount < 8) {
        setTimeout(() => this._sendSubscribe(retryCount + 1), 200 * (retryCount + 1));
      }
      return;
    }

    const topic = `/qslink/${this.mac}/wx/reply`;
    console.log('[DeviceRealtimeSocket] 发送订阅:', topic);
    task.send({
      data: topic,
      success: () => {
        console.log('[DeviceRealtimeSocket] 订阅消息已发送');
      },
      fail: (err) => {
        console.error('[DeviceRealtimeSocket] 发送订阅失败:', err);
        if (retryCount < 8 && task === this.socketTask && this._pendingSubscribe) {
          setTimeout(() => this._sendSubscribe(retryCount + 1), 300 * (retryCount + 1));
        }
      }
    });
  }

  disconnect(manual = true) {
    this._session += 1;
    this._clearSubscribeFallback();
    this._manualClose = manual;
    this._pendingSubscribe = false;
    this.subscribed = false;
    this.connected = false;
    this.isConnecting = false;
    this._connectPromise = null;

    if (this.socketTask) {
      try {
        this.socketTask.close({});
      } catch (error) {
        console.warn('[DeviceRealtimeSocket] 关闭连接异常:', error);
      }
      this.socketTask = null;
    }

    if (manual) {
      this.mac = '';
      this.lastPayload = null;
      this._lastPayloadAt = 0;
    }
  }
}

let sharedInstance = null;

function getDeviceRealtimeSocket() {
  if (!sharedInstance) {
    sharedInstance = new DeviceRealtimeSocket();
  }
  return sharedInstance;
}

module.exports = {
  DeviceRealtimeSocket,
  getDeviceRealtimeSocket,
  normalizeMac
};
