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
   * 获取设备信息
   * @param {string} mac 设备MAC地址
   * @returns {Promise} 获取结果
   */
  getDeviceInfo(mac) {
    const method = 'GetDeviceInfo';
    const dataObj = {
      key: key, // 使用文档中的秘钥
      mac: mac
    };
    
    console.log('获取设备信息请求数据：', JSON.stringify(dataObj));
    
    return soapRequest(method, dataObj, 'POST')
      .then(res => {
        console.log('获取设备信息成功：', res);
        return res;
      })
      .catch(err => {
        console.error('获取设备信息失败：', err);
        throw err;
      });
  }

  /**
   * 设备心跳检测
   * @param {string} mac 设备MAC地址
   * @returns {Promise<Object>} 心跳检测结果
   */
  async deviceHeartbeat(mac) {
    try {
      console.log('[心跳检测] 开始检测设备心跳，MAC:', mac);
      
      const result = await this.getDeviceInfo(mac);
      
      // 添加详细的响应日志
      console.log('[心跳检测] 原始响应数据:', JSON.stringify(result, null, 2));
      
      // 检查响应是否成功
      if (result.ret === 0 && result.data) {
        const deviceStatus = result.data.status;
        const isOnline = deviceStatus.id !== 4; // 4表示离线状态
        
        // 计算设备最后更新时间距离现在的时间差（毫秒）
        const lastUpdateTime = new Date(deviceStatus.since).getTime();
        const now = Date.now();
        const timeSinceLastUpdate = now - lastUpdateTime;
        
        // 设备离线判断：只要状态为4就是离线
        const isOfflineTooLong = !isOnline;
        
        console.log('[心跳检测] 设备状态分析:', {
          mac: result.data.mac,
          status: deviceStatus.name,
          statusId: deviceStatus.id,
          statusIdType: typeof deviceStatus.id,
          isOnline: isOnline,
          lastUpdate: deviceStatus.since,
          timeSinceLastUpdate: timeSinceLastUpdate,
          isOfflineTooLong: isOfflineTooLong,
          ret: result.ret,
          hasData: !!result.data,
          hasStatus: !!deviceStatus
        });
        
        return {
          success: true,
          isOnline: isOnline,
          isOfflineTooLong: isOfflineTooLong,
          timeSinceLastUpdate: timeSinceLastUpdate,
          deviceInfo: result.data,
          status: deviceStatus,
          timestamp: Date.now()
        };
      } else {
        console.log('[心跳检测] 设备响应异常，详细信息:', {
          ret: result.ret,
          retType: typeof result.ret,
          hasData: !!result.data,
          data: result.data,
          msg: result.msg,
          fullResult: result
        });
        return {
          success: false,
          isOnline: false,
          error: result.msg || '设备响应异常',
          timestamp: Date.now()
        };
      }
    } catch (error) {
      console.error('[心跳检测] 设备心跳检测失败:', error);
      return {
        success: false,
        isOnline: false,
        error: error.message || '网络请求失败',
        timestamp: Date.now()
      };
    }
  }

  /**
   * 启动设备心跳监控
   * @param {string} mac 设备MAC地址
   * @param {number} interval 检测间隔（毫秒），默认30秒
   * @param {Function} onHeartbeat 心跳回调函数
   */
  startHeartbeatMonitor(mac, interval = 30000, onHeartbeat) {
    console.log('[心跳监控] 启动设备心跳监控，MAC:', mac, '间隔:', interval + 'ms');
    
    // 清除之前的定时器
    this.clearHeartbeatTimer();
    
    // 立即执行一次心跳检测
    this.deviceHeartbeat(mac).then(result => {
      if (onHeartbeat) {
        onHeartbeat(result);
      }
    });
    
    // 设置定时器
    this._heartbeatTimer = setInterval(async () => {
      try {
        const result = await this.deviceHeartbeat(mac);
        if (onHeartbeat) {
          onHeartbeat(result);
        }
      } catch (error) {
        console.error('[心跳监控] 心跳检测异常:', error);
        if (onHeartbeat) {
          onHeartbeat({
            success: false,
            isOnline: false,
            error: error.message,
            timestamp: Date.now()
          });
        }
      }
    }, interval);
    
    console.log('[心跳监控] 心跳监控已启动，定时器ID:', this._heartbeatTimer);
  }

  /**
   * 停止设备心跳监控
   */
  clearHeartbeatTimer() {
    if (this._heartbeatTimer) {
      console.log('[心跳监控] 停止设备心跳监控，定时器ID:', this._heartbeatTimer);
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  /**
   * 获取设备预警设置
   * @param {string} mac 设备MAC地址
   * @returns {Promise} 获取结果
   */
  getDeviceWarningSetting(mac) {
    const method = 'GetDeviceWarningSetting';
    const dataObj = {
      key: "1f3e1d08bac85daf08eca14e72cde665",
      mac: mac
    };
    
    console.log('获取设备预警设置请求数据：', JSON.stringify(dataObj));
    
    return soapRequest(method, dataObj, 'POST')
      .then(res => {
        console.log('获取设备预警设置成功：', res);
        return res;
      })
      .catch(err => {
        console.error('获取设备预警设置失败：', err);
        throw err;
      });
  }

/**
 * 设置设备的预警信息
 * @param {*} healthConfig 
 */
setDeviceWarningSetting(healthConfig){
  const method = 'SetDeviceWarningSetting';
  // 验证配置
  const validation = healthConfig.validate();
  if (!validation.isValid) {
    return Promise.reject(new Error(`配置验证失败: ${validation.errors.join(', ')}`));
  }
  // 从HealthConfig实例获取所有配置
  const config = healthConfig.getAllConfig();
  
  console.log('设置设备预警设置请求数据：', JSON.stringify(config));
  
  return soapRequest(method, config, 'POST')
    .then(res => {
      console.log('设置设备预警设置成功：', res);
      return res;
    })
    .catch(err => {
      console.error('设置设备预警设置失败：', err);
      throw err;
    });
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
    const dataObj = { key, mac, timestamp: 1, waveform: false };
    soapRequest(method, dataObj, 'POST')
      .then(result => {
        if (result && result.ret === 0 && result.data && result.data.length > 0) {
          // 獲取最新的一條數據（數組的最後一個元素）
          const d = result.data[result.data.length - 1];

          // 提取時間戳（盡量兼容多種字段名與格式）
          const extractTimestampMs = (record) => {
            // 優先使用 date（字串時間）或 id（可能是時間戳）
            let ts = record?.date
              ?? record?.id
              ?? record?.timestamp
              ?? record?.time
              ?? record?.ts
              ?? record?.time_stamp
              ?? record?.datetime
              ?? record?.timeStr
              ?? record?.time_string
              ?? record?.left?.timestamp
              ?? record?.right?.timestamp
              ?? record?.left?.time
              ?? record?.right?.time;
            if (ts == null) return NaN;
            // 字符串 -> Date 解析
            if (typeof ts === 'string') {
              const ms = Date.parse(ts);
              return isNaN(ms) ? NaN : ms;
            }
            // 數字：可能是秒或毫秒
            if (typeof ts === 'number') {
              // 小於 10^12 視為秒
              return ts < 1e12 ? ts * 1000 : ts;
            }
            return NaN;
          };

          const dataTsMs = extractTimestampMs(d);
          const nowMs = Date.now();
          const isStale = !isNaN(dataTsMs) && (nowMs - dataTsMs > 60000);
          if (isStale) {
            console.log('[实时数据] 最新数据时间过旧，已超过1分钟，清空页面展示。数据时间:', new Date(dataTsMs).toLocaleString());
            this.page.setData({
              // 保持连接状态不变，仅清空指标展示
              heartRate: null,
              breathRate: null,
              turnOver: null,
              isLeavePillow: null
            });
            return;
          }
          
          let heartRate = null, breathRate = null;
          if (d.left && d.left.heart_rate) heartRate = d.left.heart_rate;
          else if (d.right && d.right.heart_rate) heartRate = d.right.heart_rate;
          if (d.left && d.left.respiration_rate) breathRate = d.left.respiration_rate;
          else if (d.right && d.right.respiration_rate) breathRate = d.right.respiration_rate;
          this.page.setData({
            deviceConnected: true,  // 確保設備連接狀態為在線
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
    }, 3000);
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
   * 格式化睡眠报告详情数据 - 优化数据合并逻辑
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
  
    // 辅助函数：检查数据是否有效（不是全0或空数组）
    const isDataValid = (data) => {
      if (!data || data.length === 0) return false;
      
      // 检查是否全为0
      const hasNonZero = data.some(value => value !== 0);
      return hasNonZero;
    };
    
    // 辅助函数：检查数据是否有异常（包含异常值）
    const hasAbnormalData = (data) => {
      if (!data || data.length === 0) return false;
      
      // 检查是否包含异常值（如负数、极大值等）
      const hasAbnormal = data.some(value => {
        if (typeof value === 'number') {
          // 检查数值异常：负数、NaN、无穷大、极大值
          return value < 0 || isNaN(value) || !isFinite(value) || value > 10000;
        }
        return false;
      });
      
      return hasAbnormal;
    };
    
    // 辅助函数：检查睡眠报告数据是否有异常
    const hasAbnormalSleepReport = (sleepReport) => {
      if (!sleepReport || sleepReport.length === 0) return false;
      
      return sleepReport.some(item => {
        // 检查value字段是否异常
        if (item.value && (item.value < 0 || item.value > 10000 || isNaN(item.value))) {
          return true;
        }
        // 检查state字段是否异常（应该在1-5之间）
        if (item.state && (item.state < 1 || item.state > 5)) {
          return true;
        }
        return false;
      });
    };
    
    // 辅助函数：优先使用left数据，如果left无效或异常则使用right数据
    const getValue = (leftKey, rightKey) => {
      const leftValue = left[leftKey];
      const rightValue = right[rightKey];
      
      // 检查left数据是否有效且无异常
      const leftValid = leftValue !== null && leftValue !== undefined && leftValue !== 0;
      const leftNormal = typeof leftValue === 'number' ? 
        (leftValue >= 0 && leftValue <= 10000 && isFinite(leftValue)) : true;
      
      // 检查right数据是否有效且无异常
      const rightValid = rightValue !== null && rightValue !== undefined && rightValue !== 0;
      const rightNormal = typeof rightValue === 'number' ? 
        (rightValue >= 0 && rightValue <= 10000 && isFinite(rightValue)) : true;
      
      // 如果left有有效值且无异常，使用left
      if (leftValid && leftNormal) {
        return leftValue;
      }
      // 如果right有有效值且无异常，使用right
      if (rightValid && rightNormal) {
        return rightValue;
      }
      // 如果都无效或异常，返回0或空字符串
      return typeof leftValue === 'string' ? '' : 0;
    };
    
    // 辅助函数：获取数组数据，优先使用有效且无异常的数据
    const getArrayValue = (leftKey, rightKey) => {
      const leftValue = left[leftKey] || [];
      const rightValue = right[rightKey] || [];
      
      // 检查left数据是否有效且无异常
      const leftValid = isDataValid(leftValue);
      const leftNormal = !hasAbnormalData(leftValue);
      
      // 检查right数据是否有效且无异常
      const rightValid = isDataValid(rightValue);
      const rightNormal = !hasAbnormalData(rightValue);
      
      // 如果left数据有效且无异常，使用left
      if (leftValid && leftNormal) {
        return leftValue;
      }
      // 如果right数据有效且无异常，使用right
      if (rightValid && rightNormal) {
        return rightValue;
      }
      // 如果都无效或异常，返回空数组
      return [];
    };
    
    // 辅助函数：获取other_data中的数组数据，优先使用有效且无异常的数据
    const getOtherDataArray = (key) => {
      const leftOtherData = left.other_data || {};
      const rightOtherData = right.other_data || {};
      
      const leftValue = leftOtherData[key] || [];
      const rightValue = rightOtherData[key] || [];
      
      // 检查left数据是否有效且无异常
      const leftValid = isDataValid(leftValue);
      const leftNormal = !hasAbnormalData(leftValue);
      
      // 检查right数据是否有效且无异常
      const rightValid = isDataValid(rightValue);
      const rightNormal = !hasAbnormalData(rightValue);
      
      // 如果left数据有效且无异常，使用left
      if (leftValid && leftNormal) {
        return leftValue;
      }
      // 如果right数据有效且无异常，使用right
      if (rightValid && rightNormal) {
        return rightValue;
      }
      // 如果都无效或异常，返回空数组
      return [];
    };
    
    // 辅助函数：获取字符串值
    const getStringValue = (leftKey, rightKey) => {
      return left[leftKey] || right[rightKey] || '';
    };
    
    // 辅助函数：获取对象值
    const getObjectValue = (leftKey, rightKey) => {
      return left[leftKey] || right[rightKey] || {};
    };
    
    // 合并other_data
    const mergedOtherData = {
      turn: getOtherDataArray('turn'),
      heartrate: getOtherDataArray('heartrate'),
      breathrate: getOtherDataArray('breathrate')
    };
    
    // 确定数据来源
    const dataSource = {
      heartRate: left.heart_rate ? 'left' : (right.heart_rate ? 'right' : 'none'),
      breathRate: left.breath_rate ? 'left' : (right.breath_rate ? 'right' : 'none'),
      sleepScore: left.sleep_score ? 'left' : (right.sleep_score ? 'right' : 'none'),
      turnCount: left.turn_count ? 'left' : (right.turn_count ? 'right' : 'none'),
      otherData: {
        turn: isDataValid(left.other_data?.turn) ? 'left' : (isDataValid(right.other_data?.turn) ? 'right' : 'none'),
        heartrate: isDataValid(left.other_data?.heartrate) ? 'left' : (isDataValid(right.other_data?.heartrate) ? 'right' : 'none'),
        breathrate: isDataValid(left.other_data?.breathrate) ? 'left' : (isDataValid(right.other_data?.breathrate) ? 'right' : 'none')
      }
    };
    
    return {
      // 基本信息
      reportId: data.report_id,
      mac: data.mac,
      date: data.date,
      dayOfWeek: data.day_of_week,
      
      // 睡眠时长数据 - 使用左右数据合并逻辑
      bedDuration: getValue('bed_duration', 'bed_duration'),
      sleepDuration: getValue('sleep_duration', 'sleep_duration'),
      deepSleepDuration: getValue('deep_sleep_duration', 'deep_sleep_duration'),
      remSleepDuration: getValue('rem_sleep_duration', 'rem_sleep_duration'),
      lightSleepDuration: getValue('light_sleep_duration', 'light_sleep_duration'),
      
      // 睡眠评分
      sleepScore: getValue('sleep_score', 'sleep_score'),
      scoreEvaluate: getStringValue('score_evaluate', 'score_evaluate'),
      
      // 时间信息
      startSleepTime: getStringValue('start_sleep_time', 'start_sleep_time'),
      endSleepTime: getStringValue('end_sleep_time', 'end_sleep_time'),
      sleepOnsetTime: getValue('sleep_onset_time', 'sleep_onset_time'),
      
      // 生理数据
      turnCount: getValue('turn_count', 'turn_count'),
      snoreDuration: getValue('snore_duration', 'snore_duration'),
      snoreCount: getValue('snore_count', 'snore_count'),
      breathRate: getValue('breath_rate', 'breath_rate'),
      heartRate: getValue('heart_rate', 'heart_rate'),
      sleepAge: getValue('sleep_age', 'sleep_age'),
      
      // 其他数据 - 使用合并后的数据，特別處理睡眠報告異常檢測
      sleepReport: this.getValidSleepReport(left, right),
      otherData: mergedOtherData,
      
      // 睡眠评估 - 使用異常檢測
      sleepAssessmentTags: this.getValidSleepAssessmentTags(left, right),
      sleepAssessment: this.getValidSleepAssessment(left, right),
      advice: this.getValidAdvice(left, right),
      questions: getArrayValue('questions', 'questions'),
      
      // 保留原始数据用于调试
      leftData: left,
      rightData: right,
      rawData: data,
      
      // 添加合并状态信息
      dataSource: dataSource,
      
      // 添加调试信息
      debugInfo: {
        leftOtherDataValid: {
          turn: isDataValid(left.other_data?.turn),
          heartrate: isDataValid(left.other_data?.heartrate),
          breathrate: isDataValid(left.other_data?.breathrate)
        },
        rightOtherDataValid: {
          turn: isDataValid(right.other_data?.turn),
          heartrate: isDataValid(right.other_data?.heartrate),
          breathrate: isDataValid(right.other_data?.breathrate)
        },
        mergedOtherDataLength: {
          turn: mergedOtherData.turn.length,
          heartrate: mergedOtherData.heartrate.length,
          breathrate: mergedOtherData.breathrate.length
        }
      }
    };
  }

  /**
   * 获取有效的睡眠报告数据，剔除异常数据
   * @param {Object} left left数据
   * @param {Object} right right数据
   * @returns {Array} 有效的睡眠报告数据
   */
  getValidSleepReport(left, right) {
    const leftSleepReport = left.sleep_report || [];
    const rightSleepReport = right.sleep_report || [];
    
    // 检查left数据是否有效且无异常
    const leftValid = leftSleepReport.length > 0;
    const leftNormal = !this.hasAbnormalSleepReport(leftSleepReport);
    
    // 检查right数据是否有效且无异常
    const rightValid = rightSleepReport.length > 0;
    const rightNormal = !this.hasAbnormalSleepReport(rightSleepReport);
    
    console.log('睡眠报告数据检查:', {
      leftValid,
      leftNormal,
      leftLength: leftSleepReport.length,
      rightValid,
      rightNormal,
      rightLength: rightSleepReport.length
    });
    
    // 如果left数据有效且无异常，使用left
    if (leftValid && leftNormal) {
      console.log('使用left睡眠报告数据');
      return leftSleepReport;
    }
    // 如果right数据有效且无异常，使用right
    if (rightValid && rightNormal) {
      console.log('使用right睡眠报告数据');
      return rightSleepReport;
    }
    // 如果都无效或异常，返回空数组
    console.log('睡眠报告数据无效或异常，返回空数组');
    return [];
  }

  /**
   * 检查睡眠报告数据是否有异常
   * @param {Array} sleepReport 睡眠报告数据
   * @returns {boolean} 是否有异常
   */
  hasAbnormalSleepReport(sleepReport) {
    if (!sleepReport || sleepReport.length === 0) return false;
    
    return sleepReport.some(item => {
      // 检查value字段是否异常
      if (item.value && (item.value < 0 || item.value > 10000 || isNaN(item.value))) {
        console.log('发现异常value值:', item.value);
        return true;
      }
      // 检查state字段是否异常（应该在1-4之间）
      if (item.state && (item.state < 1 || item.state > 5)) {
        console.log('发现异常state值:', item.state);
        return true;
      }
      return false;
    });
  }

  /**
   * 获取有效的睡眠评估标签数据，剔除异常数据
   * @param {Object} left left数据
   * @param {Object} right right数据
   * @returns {Array} 有效的睡眠评估标签数据
   */
  getValidSleepAssessmentTags(left, right) {
    const leftTags = left.sleep_assessment_tags || [];
    const rightTags = right.sleep_assessment_tags || [];
    
    // 检查left数据是否有效且无异常
    const leftValid = leftTags.length > 0;
    const leftNormal = !this.hasAbnormalSleepAssessmentTags(leftTags);
    
    // 检查right数据是否有效且无异常
    const rightValid = rightTags.length > 0;
    const rightNormal = !this.hasAbnormalSleepAssessmentTags(rightTags);
    
    console.log('睡眠评估标签数据检查:', {
      leftValid,
      leftNormal,
      leftLength: leftTags.length,
      rightValid,
      rightNormal,
      rightLength: rightTags.length
    });
    
    // 如果left数据有效且无异常，使用left
    if (leftValid && leftNormal) {
      console.log('使用left睡眠评估标签数据');
      return leftTags;
    }
    // 如果right数据有效且无异常，使用right
    if (rightValid && rightNormal) {
      console.log('使用right睡眠评估标签数据');
      return rightTags;
    }
    // 如果都无效或异常，返回空数组
    console.log('睡眠评估标签数据无效或异常，返回空数组');
    return [];
  }

  /**
   * 获取有效的睡眠评估数据，剔除异常数据
   * @param {Object} left left数据
   * @param {Object} right right数据
   * @returns {string} 有效的睡眠评估数据
   */
  getValidSleepAssessment(left, right) {
    const leftAssessment = left.sleep_assessment || '';
    const rightAssessment = right.sleep_assessment || '';
    
    // 检查left数据是否有效且无异常
    const leftValid = leftAssessment && leftAssessment.trim() !== '';
    const leftNormal = !this.hasAbnormalSleepAssessment(leftAssessment);
    
    // 检查right数据是否有效且无异常
    const rightValid = rightAssessment && rightAssessment.trim() !== '';
    const rightNormal = !this.hasAbnormalSleepAssessment(rightAssessment);
    
    console.log('睡眠评估数据检查:', {
      leftValid,
      leftNormal,
      leftAssessment: leftAssessment+ '...',
      rightValid,
      rightNormal,
      rightAssessment: rightAssessment + '...'
    });
    
    // 如果left数据有效且无异常，使用left
    if (leftValid && leftNormal) {
      console.log('使用left睡眠评估数据');
      return leftAssessment;
    }
    // 如果right数据有效且无异常，使用right
    if (rightValid && rightNormal) {
      console.log('使用right睡眠评估数据');
      return rightAssessment;
    }
    // 如果都无效或异常，返回空字符串
    console.log('睡眠评估数据无效或异常，返回空字符串');
    return '';
  }

  /**
   * 检查睡眠评估标签数据是否有异常
   * @param {Array} tags 睡眠评估标签数据
   * @returns {boolean} 是否有异常
   */
  hasAbnormalSleepAssessmentTags(tags) {
    if (!tags || tags.length === 0) return false;
    
    return tags.some(tag => {
      // 检查tag_text字段是否异常
      if (tag.tag_text && tag.tag_text.toLowerCase().includes('异常')) {
        console.log('发现异常tag_text:', tag.tag_text);
        return true;
      }
      return false;
    });
  }

  /**
   * 检查睡眠评估数据是否有异常
   * @param {string} assessment 睡眠评估数据
   * @returns {boolean} 是否有异常
   */
  hasAbnormalSleepAssessment(assessment) {
    if (!assessment || assessment.trim() === '') return false;
    
    const lowerAssessment = assessment.toLowerCase();
    
    // 检查是否包含异常关键词
    const abnormalKeywords = ['异常', '无法分析', '监测数据无法分析', '数据异常'];
    
    const hasAbnormal = abnormalKeywords.some(keyword => 
      lowerAssessment.includes(keyword.toLowerCase())
    );
    
    if (hasAbnormal) {
      console.log('发现异常睡眠评估:', assessment);
    }
    
    return hasAbnormal;
  }

  /**
   * 获取有效的建议数据，当一边出现异常时使用正常一边的数据
   * @param {Object} left left数据
   * @param {Object} right right数据
   * @returns {Array|string} 有效的建议数据
   */
  getValidAdvice(left, right) {
    const leftAdvice = left.advice || '';
    const rightAdvice = right.advice || '';
    
    // 检查left睡眠评估是否异常
    const leftAssessmentAbnormal = this.hasAbnormalSleepAssessment(left.sleep_assessment || '');
    const leftTagsAbnormal = this.hasAbnormalSleepAssessmentTags(left.sleep_assessment_tags || []);
    const leftHasAbnormal = leftAssessmentAbnormal || leftTagsAbnormal;
    
    // 检查right睡眠评估是否异常
    const rightAssessmentAbnormal = this.hasAbnormalSleepAssessment(right.sleep_assessment || '');
    const rightTagsAbnormal = this.hasAbnormalSleepAssessmentTags(right.sleep_assessment_tags || []);
    const rightHasAbnormal = rightAssessmentAbnormal || rightTagsAbnormal;
    
    // 检查left数据是否有效 - 支持数组和字符串类型
    const leftValid = leftAdvice && (
      (Array.isArray(leftAdvice) && leftAdvice.length > 0) ||
      (typeof leftAdvice === 'string' && leftAdvice.trim() !== '')
    );
    
    // 检查right数据是否有效 - 支持数组和字符串类型
    const rightValid = rightAdvice && (
      (Array.isArray(rightAdvice) && rightAdvice.length > 0) ||
      (typeof rightAdvice === 'string' && rightAdvice.trim() !== '')
    );
    
    console.log('建议数据检查:', {
      leftValid,
      leftHasAbnormal,
      leftAdviceType: typeof leftAdvice,
      leftAdviceIsArray: Array.isArray(leftAdvice),
      leftAdviceLength: Array.isArray(leftAdvice) ? leftAdvice.length : (typeof leftAdvice === 'string' ? leftAdvice.length : 0),
      rightValid,
      rightHasAbnormal,
      rightAdviceType: typeof rightAdvice,
      rightAdviceIsArray: Array.isArray(rightAdvice),
      rightAdviceLength: Array.isArray(rightAdvice) ? rightAdvice.length : (typeof rightAdvice === 'string' ? rightAdvice.length : 0)
    });
    
    // 如果left数据有效且无异常，使用left
    if (leftValid && !leftHasAbnormal) {
      console.log('使用left建议数据');
      return leftAdvice;
    }
    // 如果right数据有效且无异常，使用right
    if (rightValid && !rightHasAbnormal) {
      console.log('使用right建议数据');
      return rightAdvice;
    }
    // 如果left有异常但right正常，使用right
    if (leftHasAbnormal && rightValid && !rightHasAbnormal) {
      console.log('left有异常，使用right建议数据');
      return rightAdvice;
    }
    // 如果right有异常但left正常，使用left
    if (rightHasAbnormal && leftValid && !leftHasAbnormal) {
      console.log('right有异常，使用left建议数据');
      return leftAdvice;
    }
    // 如果都无效或异常，返回空数组或空字符串
    console.log('建议数据无效或异常，返回空值');
    return Array.isArray(leftAdvice) ? [] : '';
  }

  /**
   * 合并左右数据 - 优先使用left，如果left没有则使用right
   * @param {Object} data 原始数据
   * @returns {Object} 合并后的数据
   */
  _mergeLeftRightData(data) {
    const left = data.left || {};
    const right = data.right || {};
    
    // 辅助函数：检查数据是否有效（不是全0或空数组）
    const isDataValid = (data) => {
      if (!data || data.length === 0) return false;
      const hasNonZero = data.some(value => value !== 0);
      return hasNonZero;
    };
    
    // 辅助函数：优先使用left数据，如果left没有则使用right数据
    const getValue = (leftKey, rightKey) => {
      const leftValue = left[leftKey];
      const rightValue = right[rightKey];
      
      // 如果left有有效值（不为0且不为null），使用left
      if (leftValue !== null && leftValue !== undefined && leftValue !== 0) {
        return leftValue;
      }
      // 如果right有有效值（不为0且不为null），使用right
      if (rightValue !== null && rightValue !== undefined && rightValue !== 0) {
        return rightValue;
      }
      // 如果都没有有效值，返回null
      return null;
    };
    
    // 辅助函数：获取数组数据，优先使用有效数据
    const getArrayValue = (leftKey, rightKey) => {
      const leftValue = left[leftKey] || [];
      const rightValue = right[rightKey] || [];
      
      // 如果left数据有效（不是全0），使用left
      if (isDataValid(leftValue)) {
        return leftValue;
      }
      // 如果right数据有效（不是全0），使用right
      if (isDataValid(rightValue)) {
        return rightValue;
      }
      // 如果都无效，返回空数组
      return [];
    };
    
    // 合并other_data
    const mergedOtherData = {
      turn: getArrayValue('turn', 'turn'),
      heartrate: getArrayValue('heartrate', 'heartrate'),
      breathrate: getArrayValue('breathrate', 'breathrate')
    };
    
    return {
      // 心率数据
      heartRate: getValue('heart_rate', 'heart_rate'),
      
      // 呼吸率数据
      breathRate: getValue('respiration_rate', 'respiration_rate'),
      
      // 身体运动数据 - 优先使用left，如果left没有则使用right
      turnOver: data.body_movement ? 1 : 0,
      
      // 离床状态 - 使用全局的inbed状态
      isLeavePillow: !data.inbed,
      
      // 其他可能的数据字段
      leftHeartRate: left.heart_rate || null,
      rightHeartRate: right.heart_rate || null,
      leftBreathRate: left.respiration_rate || null,
      rightBreathRate: right.respiration_rate || null,
      
      // 合并后的other_data
      otherData: mergedOtherData,
      
      // 如果有其他需要合并的字段，可以在这里添加
      // 例如：温度、湿度等
      temperature: getValue('temperature', 'temperature'),
      humidity: getValue('humidity', 'humidity'),
      
      // 时间戳
      timestamp: data.timestamp || Date.now(),
      
      // 设备状态
      deviceStatus: data.device_status || null,
      
      // 信号强度
      signalStrength: getValue('signal_strength', 'signal_strength'),
      
      // 电池电量
      batteryLevel: getValue('battery_level', 'battery_level'),
      
      // 数据来源信息
      dataSource: {
        heartRate: left.heart_rate ? 'left' : (right.heart_rate ? 'right' : 'none'),
        breathRate: left.respiration_rate ? 'left' : (right.respiration_rate ? 'right' : 'none'),
        otherData: {
          turn: isDataValid(left.turn) ? 'left' : (isDataValid(right.turn) ? 'right' : 'none'),
          heartrate: isDataValid(left.heartrate) ? 'left' : (isDataValid(right.heartrate) ? 'right' : 'none'),
          breathrate: isDataValid(left.breathrate) ? 'left' : (isDataValid(right.breathrate) ? 'right' : 'none')
        }
      }
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