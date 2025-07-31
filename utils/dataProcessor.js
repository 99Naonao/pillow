/**
 * 数据处理工具类
 * 包含数据格式化、趋势数据提取等方法
 */

class DataProcessor {
  /**
   * 格式化日期
   * @param {Date} date 日期对象
   * @returns {string} 格式化后的日期字符串 yyyy-MM-dd
   */
  static formatDate(date) {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /**
   * 获取指定日期的下一天
   * @param {string} dateStr 日期字符串，格式为 yyyy-MM-dd
   * @returns {string} 下一天的日期字符串，格式为 yyyy-MM-dd
   */
  static getNextDay(dateStr) {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        console.error('无效的日期格式:', dateStr);
        return dateStr;
      }
      date.setDate(date.getDate() + 1);
      const nextDay = this.formatDate(date);
      console.log('日期计算:', { original: dateStr, nextDay: nextDay });
      return nextDay;
    } catch (error) {
      console.error('计算下一天日期失败:', error);
      return dateStr;
    }
  }

  /**
   * 从日期时间字符串中解析出时间部分
   * @param {string} dateTimeStr 日期时间字符串，格式如 "2023-09-03 16:16" 或直接的时间 "16:16"
   * @returns {string} 时间字符串，格式如 "16:16"
   */
  static parseTimeFromDateTime(dateTimeStr) {
    if (!dateTimeStr) return '00:00';
    
    console.log('解析时间输入:', dateTimeStr, '类型:', typeof dateTimeStr);
    
    try {
      // 如果已经是时间格式（HH:mm），直接返回
      if (typeof dateTimeStr === 'string' && /^\d{1,2}:\d{2}$/.test(dateTimeStr)) {
        console.log('已经是时间格式，直接返回:', dateTimeStr);
        return dateTimeStr;
      }
      
      // 如果是日期时间格式，提取时间部分
      if (typeof dateTimeStr === 'string' && dateTimeStr.includes(' ')) {
        const timePart = dateTimeStr.split(' ')[1];
        console.log('从日期时间中提取时间:', timePart);
        return timePart || '00:00';
      }
      
      // 如果是数字（分钟数），转换为时间格式
      if (typeof dateTimeStr === 'number') {
        const hours = Math.floor(dateTimeStr / 60);
        const minutes = dateTimeStr % 60;
        const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        console.log('从分钟数转换为时间:', timeStr);
        return timeStr;
      }
      
      console.log('无法解析的时间格式，返回默认值');
      return '00:00';
    } catch (error) {
      console.error('解析时间失败:', error);
      return '00:00';
    }
  }

  /**
   * 从日期时间字符串中解析出日期部分
   * @param {string} dateTimeStr 日期时间字符串，格式如 "2023-09-03 16:16"
   * @returns {string} 日期字符串，格式如 "2023-09-03"
   */
  static parseDateFromDateTime(dateTimeStr) {
    if (!dateTimeStr) return '';
    try {
      const datePart = dateTimeStr.split(' ')[0];
      return datePart || '';
    } catch (error) {
      console.error('解析日期失败:', error);
      return '';
    }
  }

  /**
   * 格式化时间显示
   * @param {string} timeStr 时间字符串，格式如 "16:16"
   * @returns {string} 格式化后的时间字符串
   */
  static formatTimeDisplay(timeStr) {
    if (!timeStr) return '00:00';
    try {
      const [hours, minutes] = timeStr.split(':');
      const hour = parseInt(hours) || 0;
      const minute = parseInt(minutes) || 0;
      return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    } catch (error) {
      console.error('格式化时间失败:', error);
      return '00:00';
    }
  }

  /**
   * 格式化时长显示
   * @param {number} minutes 分钟数
   * @returns {string} 格式化后的时长字符串
   */
  static formatDuration(minutes) {
    if (!minutes || minutes <= 0) return '0分钟';
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0 && remainingMinutes > 0) {
      return `${hours}小时${remainingMinutes}分钟`;
    } else if (hours > 0) {
      return `${hours}小时`;
    } else {
      return `${remainingMinutes}分钟`;
    }
  }

  /**
   * 提取趋势数据
   * @param {Object} reportDetail 报告详情
   * @returns {Object} 趋势数据
   */
  static extractTrendData(reportDetail) {
    console.log('完整的报告详情:', reportDetail);
    
    // 从报告详情中提取other_data
    const otherData = reportDetail.otherData || {};
    console.log('otherData:', otherData);
    
    // 根据API返回的数据结构，使用正确的字段名
    const heartRateData = otherData.heartrate || [];
    const breathRateData = otherData.breathrate || [];
    const turnData = otherData.turn || [];
    
    console.log('提取的原始数据:', {
      heartRateData: heartRateData.length,
      breathRateData: breathRateData.length,
      turnData: turnData.length,
      heartRateSample: heartRateData.slice(0, 10),
      breathRateSample: breathRateData.slice(0, 10),
      turnSample: turnData.slice(0, 10)
    });
    
    // 生成时间标签
    const timeLabels = this.generateTimeLabels(
      reportDetail.startSleepTime,
      reportDetail.endSleepTime,
      Math.max(heartRateData.length, breathRateData.length, turnData.length)
    );
    
    console.log('生成的时间标签:', timeLabels);
    
    return {
      timeLabels: timeLabels,
      heartRateData: heartRateData,
      breathRateData: breathRateData,
      turnData: turnData  // 改为turnData以保持一致性
    };
  }

  /**
   * 生成时间标签
   * @param {string} startTime 开始时间
   * @param {string} endTime 结束时间
   * @param {number} dataLength 数据长度
   * @returns {Array} 时间标签数组
   */
  static generateTimeLabels(startTime, endTime, dataLength) {
    if (!startTime || !endTime || dataLength <= 0) {
      return [];
    }
    
    try {
      // 解析开始和结束时间
      const [startHour, startMinute] = startTime.split(':').map(Number);
      const [endHour, endMinute] = endTime.split(':').map(Number);
      
      // 转换为分钟数
      const startMinutes = startHour * 60 + startMinute;
      const endMinutes = endHour * 60 + endMinute;
      
      // 计算总时长（分钟）
      let totalMinutes = endMinutes - startMinutes;
      if (totalMinutes <= 0) {
        totalMinutes += 24 * 60; // 跨天的情况
      }
      
      // 生成时间标签
      const timeLabels = [];
      for (let i = 0; i < dataLength; i++) {
        const currentMinutes = startMinutes + (totalMinutes * i / (dataLength - 1));
        const hour = Math.floor(currentMinutes / 60) % 24;
        const minute = Math.floor(currentMinutes % 60);
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        timeLabels.push(timeStr);
      }
      
      return timeLabels;
    } catch (error) {
      console.error('生成时间标签失败:', error);
      return [];
    }
  }

  /**
   * 计算睡眠阶段百分比
   * @param {Object} reportDetail 报告详情
   * @returns {Object} 睡眠阶段百分比
   */
  static calculateSleepStagePercentages(reportDetail) {
    const totalSleep = reportDetail.sleepDuration;
    const deepSleep = reportDetail.deepSleepDuration;
    const lightSleep = reportDetail.lightSleepDuration;
    const remSleep = reportDetail.remSleepDuration;
    const bedDuration = reportDetail.bedDuration;
    const awake = bedDuration - totalSleep;
    
    // 所有百分比都基于在床时长计算，确保加起来等于100%
    const deepPercent = bedDuration > 0 ? Math.round((deepSleep / bedDuration) * 100) : 0;
    const lightPercent = bedDuration > 0 ? Math.round((lightSleep / bedDuration) * 100) : 0;
    const remPercent = bedDuration > 0 ? Math.round((remSleep / bedDuration) * 100) : 0;
    const awakePercent = bedDuration > 0 ? Math.round((awake / bedDuration) * 100) : 0;
    
    console.log('睡眠阶段计算:', {
      totalSleep, deepSleep, lightSleep, remSleep, bedDuration, awake,
      deepPercent, lightPercent, remPercent, awakePercent,
      totalPercent: deepPercent + lightPercent + remPercent + awakePercent
    });
    
    return {
      deepPercent,
      lightPercent,
      remPercent,
      awakePercent
    };
  }

  /**
   * 格式化睡眠时长显示
   * @param {number} totalSleep 总睡眠时长（分钟）
   * @returns {string} 格式化后的睡眠时长
   */
  static formatSleepTimeDisplay(totalSleep) {
    if (!totalSleep || totalSleep <= 0) return '0h0min';
    
    const sleepTimeHours = Math.floor(totalSleep / 60);
    const sleepTimeMinutes = totalSleep % 60;
    return `${sleepTimeHours}h${sleepTimeMinutes}min`;
  }
}

module.exports = DataProcessor; 