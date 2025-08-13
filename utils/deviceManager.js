const key = '1f3e1d08bac85daf08eca14e72cde665';

/**
 * 通用SOAP请求
 * @param {string} method SOAP方法名
 * @param {Object} dataObj 业务参数对象
 * @param {string} httpMethod 'POST' 或 'GET'
 * @returns {Promise} 返回Promise，resolve为解析后的业务数据
 */
function soapRequest(method, dataObj, httpMethod = 'POST') {
  console.log(`[soapRequest] 调用方法: ${method}`);
  console.log(`[soapRequest] 请求参数:`, dataObj);
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

  return new Promise((resolve, reject) => {
    wx.request({
      url: 'https://bed.qssmart.cn/CustomerAPIService.asmx',
      method: httpMethod,
      data: postXml,
      header: {
        'content-type': 'text/xml; charset=utf-8',
        'SOAPAction': 'http://bed.cn/' + method
      },
      success: (res) => {
        console.log('接口返回数据：===', res);
        
        // 检查响应状态码
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP请求失败，状态码：${res.statusCode}`));
          return;
        }
        
        // 处理XML响应
        const xml = res.data;
        console.log("原始返回数据：===",xml);
        if (typeof xml === 'string') {
          // 提取XML中的JSON数据
          const resultPattern = new RegExp(`<${method}Result>([\\s\\S]*?)<\\/${method}Result>`);
          const match = xml.match(resultPattern);
          
          if (match && match[1]) {
            try {
              const result = JSON.parse(match[1]);
              console.log('解析XML中的JSON数据：', result);
              resolve(result);
            } catch (e) {
              console.error('XML数据解析异常:', e);
              console.log('原始XML数据:', xml);
              reject(new Error('数据解析异常:' + e.message));
            }
          } else {
            console.error('未找到XML结果标签或标签为空');
            console.log('完整XML响应：', xml);
            reject(new Error('接口返回格式错误，未找到有效数据'));
          }
        } else {
          console.error('响应数据格式异常：', typeof res.data);
          reject(new Error('接口返回格式错误，数据类型异常'));
        }
      },
      fail: (err) => {
        reject(new Error('接口调用失败:' + (err.errMsg || '')));
      }
    });
  });
}

/**
 * 该类为接口请求类
 */
class DeviceManager {
  constructor(page) {
    this.page = page; // 传入页面实例
    this._realtimeTimer = null;
  }

/**
 * 语音预警通知
 * @param {object} params 请求参数
 * @param {string} params.phone 通知号码
 * @param {int} params.type 通知类型 1呼吸异常、2心率异常、3离床 
 */
voiceNotifation(params){
  const method = 'VoiceAlertNotification';
  const dataObj = {
    key:key,
    phone:params.phone,
    notification_type:params.type
  };
  console.log('请求数据',JSON.stringify(dataObj));
  return soapRequest(method,dataObj,'POST').then(res =>{
    console.log('请求语音预警通知成功：',res)
    return res;
  }).catch(err=>{
    console.error('请求语音预警通知失败：',err);
    throw err;
  })
}

  /**
   * 获取睡眠报告列表数据
   * @param {Object} params 请求参数
   * @param {string} params.mac 设备MAC地址
   * @param {string} params.start_date 开始日期
   * @param {string} params.end_date 结束日期
   */
  getSleepReportData(params) {
    const method = 'GetSleepReportsByDateRange';
    const dataObj = {
      key: key,
      mac: params.mac || '',
      start_date: params.start_date,
      end_date: params.end_date
    };
    console.log('请求数据：',JSON.stringify(dataObj))
    return soapRequest(method, dataObj, 'POST')
      .then(res => {
        console.log('获取睡眠报告列表数据===', res);
        return res;
      })
      .catch(err => {
        console.error('获取睡眠报告失败:', err);
        throw err;
      });
  }

  /**
   * 获取睡眠报告详情
   * @param {Object} params 请求参数
   * @param {string} params.report_id 报告ID
   */
  getSleepReportDetail(params) {
    const method = 'GetSleepReportDetailByReportId';  
    const dataObj = {
      key: key,
      report_id: params.report_id
    };
    
    return soapRequest(method, dataObj, 'POST')
      .then(res => {
        console.log('获取睡眠报告详情===', res);
        return res;
      })
      .catch(err => {
        console.error('获取睡眠报告详情失败:', err);
        throw err;
      });
  }

  /**
   * 获取设备mac
   * @param {*} mac 
   */
  getDeviceRealtimeData(mac) {
    console.log('设备mac信息:',mac)
    const method = 'GetDeviceRealtimeData';
    const dataObj = { key, mac, timestamp: 0, waveform: false };
    soapRequest(method, dataObj, 'POST')
      .then(result => {
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
          this.page.setData({
            heartRate: null,
            breathRate: null,
            turnOver: null,
            isLeavePillow: true
          });
        }
      })
      .catch(err => {
        wx.showToast({ title: err.message || '接口异常', icon: 'none' });
        this.page.setData({
          heartRate: null,
          breathRate: null,
          turnOver: null,
          isLeavePillow: true
        });
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

  /**
   * 格式化睡眠报告详情数据
   * @param {Object} reportDetail 原始报告详情数据
   * @returns {Object} 格式化后的数据
   */
  formatSleepReportDetail(reportDetail) {
    if (!reportDetail || !reportDetail.data) {
      return null;
    }

    const data = reportDetail.data;
    const left = data.left || {};
    const right = data.right || {};

    return {
      // 基本信息
      reportId: data.report_id,
      mac: data.mac,
      date: data.date,
      dayOfWeek: data.day_of_week,
      
      // 睡眠时长数据
      bedDuration: left.bed_duration || 0, // 在床时长（分钟）
      sleepDuration: left.sleep_duration || 0, // 睡眠时长（分钟）
      deepSleepDuration: left.deep_sleep_duration || 0, // 深睡时长（分钟）
      remSleepDuration: left.rem_sleep_duration || 0, // 快速眼动睡眠时长（分钟）
      lightSleepDuration: left.light_sleep_duration || 0, // 浅睡时长（分钟）
      
      // 睡眠评分
      sleepScore: left.sleep_score || 0,
      scoreEvaluate: left.score_evaluate || '',
      
      // 时间信息
      startSleepTime: left.start_sleep_time || '',
      endSleepTime: left.end_sleep_time || '',
      sleepOnsetTime: left.sleep_onset_time || 0, // 入睡时间（分钟）
      
      // 生理数据
      turnCount: left.turn_count || 0, // 翻身次数
      snoreDuration: left.snore_duration || 0, // 打鼾时长（分钟）
      snoreCount: left.snore_count || 0, // 打鼾次数
      breathRate: left.breath_rate || 0, // 呼吸率
      heartRate: left.heart_rate || 0, // 心率
      sleepAge: left.sleep_age || 0, // 睡眠年龄
      
      // 睡眠报告数据
      sleepReport: left.sleep_report || [],
      
      // 其他数据
      otherData: left.other_data || {},
      
      // 睡眠评估
      sleepAssessmentTags: left.sleep_assessment_tags || [],
      sleepAssessment: left.sleep_assessment || '',
      advice: left.advice || '',
      questions: left.questions || [],
      
      // 右侧数据（如果有）
      rightData: right
    };
  }

  /**
   * 获取睡眠阶段百分比
   * @param {Object} reportDetail 报告详情
   * @returns {Object} 各阶段百分比
   */
  getSleepStagePercentages(reportDetail) {
    const data = reportDetail.data?.left || {};
    const totalSleep = data.sleep_duration || 0;
    
    if (totalSleep === 0) {
      return {
        deep: 0,
        rem: 0,
        light: 0,
        awake: 0
      };
    }

    return {
      deep: Math.round((data.deep_sleep_duration || 0) / totalSleep * 100),
      rem: Math.round((data.rem_sleep_duration || 0) / totalSleep * 100),
      light: Math.round((data.light_sleep_duration || 0) / totalSleep * 100),
      awake: Math.round(((data.bed_duration || 0) - totalSleep) / (data.bed_duration || 1) * 100)
    };
  }

  /**
   * 获取睡眠评分等级
   * @param {number} score 睡眠评分
   * @returns {string} 评分等级
   */
  getSleepScoreLevel(score) {
    if (score >= 0 && score < 60) return '待改善';
    if (score >= 60 && score < 70) return '一般';
    if (score >= 70 && score < 80) return '良好';
    if (score >= 80 && score <= 100) return '优秀';
    return '异常'; // 默认值，异常数据
  }
}

module.exports = DeviceManager; 