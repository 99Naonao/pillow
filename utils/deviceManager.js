class DeviceManager {
  constructor(page) {
    this.page = page; // 传入页面实例
    this._realtimeTimer = null;
  }

  getDeviceRealtimeData(mac) {
    const key = '1f3e1d08bac85daf08eca14e72cde665';
    const method = 'GetDeviceRealtimeData';
    const dataObj = { key, mac, timestamp: 0, waveform: false };
    const postXml =
      "<?xml version='1.0' encoding='utf-8'?>" +
      "<soap:Envelope xmlns:xsi='http://www.w3.org/2001/XMLSchema-instance' xmlns:xsd='http://www.w3.org/2001/XMLSchema' xmlns:soap='http://schemas.xmlsoap.org/soap/envelope/'>" +
      "<soap:Header>" +
      "<MXSoapHeader xmlns='http://bed.cn/'>" +
      "<Username>customerapi</Username>" +
      "<Password>pA2@G8zQ</Password>" +
      "</MXSoapHeader>" +
      "</soap:Header>" +
      "<soap:Body>" +
      `<${method} xmlns='http://bed.cn/'>` +
      `<dataJson>${JSON.stringify(dataObj)}</dataJson>` +
      `</${method}>` +
      "</soap:Body>" +
      "</soap:Envelope>";

    console.log('[DeviceManager] 请求设备实时数据接口:', {
      url: 'https://bed.qssmart.cn/CustomerAPIService.asmx',
      method: 'POST',
      data: postXml,
      header: {
        'content-type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://bed.cn/' + method
      }
    });

    wx.request({
      url: 'https://bed.qssmart.cn/CustomerAPIService.asmx',
      method: 'POST',
      data: postXml,
      header: {
        'content-type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://bed.cn/' + method
      },
      success: (res) => {
        console.log('[DeviceManager] 接口请求成功，返回内容:', res);
        const xml = res.data;
        const match = xml.match(/<GetDeviceRealtimeDataResult>([\s\S]*?)<\/GetDeviceRealtimeDataResult>/);
        if (match && match[1]) {
          try {
            const result = JSON.parse(match[1]);
            console.log('[DeviceManager] 解析后的数据:', result);
            if (result && result.ret === 0 && result.data && result.data.length > 0) {
              const d = result.data[0];
              let heartRate = null, breathRate = null;
              if (d.left && d.left.heart_rate) heartRate = d.left.heart_rate;
              else if (d.right && d.right.heart_rate) heartRate = d.right.heart_rate;
              if (d.left && d.left.respiration_rate) breathRate = d.left.respiration_rate;
              else if (d.right && d.right.respiration_rate) breathRate = d.right.respiration_rate;
              this.page.setData({
                heartRate,
                breathRate,
                turnOver: d.body_movement ? 1 : 0,
                isLeavePillow: !d.inbed
              });
            } else {
              console.warn('[DeviceManager] 返回数据异常或无数据:', result);
              this.page.setData({
                heartRate: null,
                breathRate: null,
                turnOver: null,
                isLeavePillow: true
              });
            }
          } catch (e) {
            console.error('[DeviceManager] 数据解析异常:', e, match[1]);
            wx.showToast({ title: '数据解析失败', icon: 'none' });
            this.page.setData({
              heartRate: null,
              breathRate: null,
              turnOver: null,
              isLeavePillow: true
            });
          }
        } else {
          console.error('[DeviceManager] 接口返回格式错误:', xml);
          wx.showToast({ title: '接口返回格式错误', icon: 'none' });
          this.page.setData({
            heartRate: null,
            breathRate: null,
            turnOver: null,
            isLeavePillow: true
          });
        }
      },
      fail: (err) => {
        console.error('[DeviceManager] 接口调用失败:', err);
        wx.showToast({ title: '接口调用失败', icon: 'none' });
        this.page.setData({
          heartRate: null,
          breathRate: null,
          turnOver: null,
          isLeavePillow: true
        });
      }
    });
  }

  startRealtimeTimer(mac) {
    this.clearRealtimeTimer();
    this._realtimeTimer = setInterval(() => {
      this.getDeviceRealtimeData(mac);
    }, 5000);
    this.page.setData({ _realtimeTimer: this._realtimeTimer });
  }

  clearRealtimeTimer() {
    if (this._realtimeTimer) {
      clearInterval(this._realtimeTimer);
      this._realtimeTimer = null;
      this.page.setData({ _realtimeTimer: null });
    }
  }
}

module.exports = DeviceManager; 