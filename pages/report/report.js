// pages/report/report.js
import * as echarts from '../../components/ec-canvas/echarts';
const DeviceManager = require('../../utils/deviceManager');

Page({
  data: {
    sleepTime:'',           // 本次睡眠时长
    sleepStartTime:'00:00',           // 睡眠开始时间
    sleepEndTime:'06:38',             // 睡眠结束时间
    currentDate: '',        // 页面显示的日期（yyyy.MM.dd）
    calendarValue: '',      // TDesign日历组件的值（yyyy-MM-dd）
    showCalendar: false,    // 控制日历弹窗显示
    shallowPercent: 58,     // 浅睡占比
    awakePercent: 15,       // 清醒占比
    deepPercent: 27,        // 深睡占比
    sleepReports: [],       // 睡眠报告列表
    loading: false,         // 加载状态
    currentReport: null,    // 当前选中的报告
    wifiMac:'',             //wifiMac地址
    stageData: [
      { name: '清醒期', value: 15, color: '#e97b7b' },
      { name: '浅睡期', value: 58, color: '#f7c873' },
      { name: '深睡期', value: 27, color: '#5e7fff' }
    ],
    score: 85,
    scoreLevel: '良好',
    stagePieChart: {},
    scoreCircleChart: {
      onInit: function (canvas, width, height, dpr) {
        const chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
        canvas.setChart(chart);
        chart.setOption({
          backgroundColor: 'transparent',
          series: [{
            type: 'pie',
            radius: ['90%', '100%'],
            silent: true,
            label: { show: false },
            data: [
              { value: 85, name: '得分', itemStyle: { color: '#ffd700' } },
              { value: 15, name: '空', itemStyle: { color: '#2a223d' } }
            ]
          }],
        });
        return chart;
      }
    },
    heartTrendChart: {
      onInit: function (canvas, width, height, dpr) {
        console.log('[心率折线图] onInit 被调用', {canvas, width, height, dpr});
        const chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
        canvas.setChart(chart);
        // 配置心率折线图的option
        chart.setOption({
          backgroundColor: '#231c36',
          grid: { left: 30, right: 20, top: 30, bottom: 30 },
          tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'line' },
            backgroundColor: 'rgba(0,0,0,0.7)',
            textStyle: { color: '#fff' }
          },
          xAxis: {
            type: 'category',
            data: Array.from({ length: 24 }, (_, i) => (i + 1) + ':00'),
            axisLine: { lineStyle: { color: '#aaa' } },
            axisLabel: { color: '#aaa' }
          },
          yAxis: {
            type: 'value',
            min: 0,
            max: 150,
            axisLine: { show: false },
            axisLabel: { color: '#aaa' },
            splitLine: { show: false }
          },
          series: [{
            data: [64, 62, 65, 66, 68, 70, 72, 68, 66, 65, 64, 63, 62, 61, 60, 62, 64, 66, 68, 70, 72, 74, 76, 78],
            type: 'line',
            smooth: true,
            symbol: 'circle',
            symbolSize: 6,
            lineStyle: { color: '#24C9ED', width: 2 },
            areaStyle: { color: 'rgba(36,201,237,0.15)' }
          }]
        });
        console.log('[心率折线图] option 已设置');
        return chart;
      }
    },
    breathTrendChart: {
      onInit: function (canvas, width, height, dpr) {
        console.log('[呼吸频率折线图] onInit 被调用', {canvas, width, height, dpr});
        const chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
        canvas.setChart(chart);
        // 配置呼吸频率折线图的option
        chart.setOption({
          backgroundColor: '#231c36',
          grid: { left: 30, right: 20, top: 30, bottom: 30 },
          tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'line' },
            backgroundColor: 'rgba(0,0,0,0.7)',
            textStyle: { color: '#fff' }
          },
          xAxis: {
            type: 'category',
            data: Array.from({ length: 24 }, (_, i) => (i + 1) + ':00'),
            axisLine: { lineStyle: { color: '#aaa' } },
            axisLabel: { color: '#aaa' }
          },
          yAxis: {
            type: 'value',
            min: 0,
            max: 40,
            axisLine: { show: false },
            axisLabel: { color: '#aaa' },
            splitLine: { show: false }
          },
          series: [{
            data: [15, 16, 17, 18, 19, 20, 18, 17, 16, 15, 14, 13, 12, 13, 14, 15, 16, 17, 18, 19, 20, 19, 18, 17],
            type: 'line',
            smooth: true,
            symbol: 'circle',
            symbolSize: 6,
            lineStyle: { color: '#7adfa0', width: 2 },
            areaStyle: { color: 'rgba(122,223,160,0.15)' }
          }]
        });
        console.log('[呼吸频率折线图] option 已设置');
        return chart;
      }
    },
    bodyMoveTrendChart: {
      onInit: function (canvas, width, height, dpr) {
        console.log('[体动折线图] onInit 被调用', {canvas, width, height, dpr});
        const chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
        canvas.setChart(chart);
        // 配置体动折线图的option
        chart.setOption({
          backgroundColor: '#231c36',
          grid: { left: 30, right: 20, top: 30, bottom: 30 },
          tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'line' },
            backgroundColor: 'rgba(0,0,0,0.7)',
            textStyle: { color: '#fff' }
          },
          xAxis: {
            type: 'category',
            data: Array.from({ length: 24 }, (_, i) => (i + 1) + ':00'),
            axisLine: { lineStyle: { color: '#aaa' } },
            axisLabel: { color: '#aaa' }
          },
          yAxis: {
            type: 'value',
            min: 0,
            max: 12,
            axisLine: { show: false },
            axisLabel: { color: '#aaa' },
            splitLine: { show: false }
          },
          series: [{
            data: [2, 1, 0, 3, 2, 1, 2, 3, 4, 2, 1, 0, 1, 2, 3, 2, 1, 0, 1, 2, 3, 2, 1, 0],
            type: 'line',
            smooth: true,
            symbol: 'circle',
            symbolSize: 6,
            lineStyle: { color: '#f7c873', width: 2 },
            areaStyle: { color: 'rgba(247,200,115,0.15)' }
          }]
        });
        console.log('[体动折线图] option 已设置');
        return chart;
      }
    },
  },

  onReady() {
    this.initStagePieChart();
  },

  onLoad() {
    // 初始化设备管理器
    this.deviceManager = new DeviceManager(this);
    // 默认日期为今天
    const today = this.formatDate(new Date());
    this.setData({
      wifiMac:wx.getStorageSync('wifi_device_mac'),
      shallowPercent: 58,
      awakePercent: 15,
      deepPercent: 27,
      currentDate: today.replace(/-/g, '.'),
      calendarValue: today
    });
    this.calculateSleepTime();
    
    // 加载今天的睡眠报告
    this.loadSleepReports(today, today,wifiMac);
  },

  initStagePieChart() {
    this.setData({
      stagePieChart: {
        onInit: (canvas, width, height, dpr) => {
          const chart = require('../../components/ec-canvas/echarts').init(canvas, null, { width, height, devicePixelRatio: dpr });
          canvas.setChart(chart);
          const shallow = this.data.shallowPercent;
          const awake = this.data.awakePercent;
          const deep = this.data.deepPercent;
          chart.setOption({
            backgroundColor: 'transparent',
            series: [{
              type: 'pie',
              radius: ['100%', '80%'],
              avoidLabelOverlap: false,
              label: { show: false },
              labelLine: { show: false },
              data: [
                { value: shallow, name: '浅睡期', itemStyle: { color: '#f7c873' } },
                { value: awake, name: '清醒期', itemStyle: { color: '#e97b7b' } },
                { value: deep, name: '深睡期', itemStyle: { color: '#5e7fff' } }
              ]
            }]
          });
          return chart;
        }
      }
    });
  },

  // 日期格式化
  formatDate(date) {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  onShowCalendar() {
    this.setData({ showCalendar: true });
  },

  onCalendarClose() {
    this.setData({ showCalendar: false });
  },

  onCalendarConfirm(e) {
    // e.detail.value 是 yyyy-MM-dd
    const val = e.detail.value;
    this.setData({
      calendarValue: val,
      currentDate: val.replace(/-/g, '.'),
      showCalendar: false
    });
    // 根据选择的日期重新加载报告数据
    this.loadSleepReports(val, val,wifiMac);
  },

  onDateChange(e) {
    // e.detail.value 格式为 yyyy-mm-dd
    const val = e.detail.value;
    this.setData({
      calendarValue: val,
      currentDate: val.replace(/-/g, '.')
    });
  },
  //计算睡眠时长
  calculateSleepTime() {
    const startTime = this.data.sleepStartTime;
    const endTime = this.data.sleepEndTime;

    const startHours = parseInt(startTime.split(':')[0]);
    const startMinutes = parseInt(startTime.split(':')[1]);
    const endHours = parseInt(endTime.split(':')[0]);
    const endMinutes = parseInt(endTime.split(':')[1]);

    let totalMinutes = (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes);
    if (totalMinutes < 0) {
      totalMinutes += 24 * 60; // 处理跨天情况
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    this.setData({
      sleepTime: `${hours}h${minutes}min`
    });
  },

  /**
   * 加载睡眠报告
   * @param {string} startDate 开始日期
   * @param {string} endDate 结束日期
   * @param {string} wifiMac 设备地址
   */
  loadSleepReports(startDate, endDate,wifiMac) {
    this.setData({ loading: true });
    
    // 先获取睡眠报告列表
    this.deviceManager.getSleepReportData({
      start_date: startDate,
      end_date: endDate
    })
    .then(result => {
      console.log('获取睡眠报告列表成功:', result);
      
      if (result && result.data && result.data.length > 0) {
        // 格式化报告列表
        const formattedReports = this.deviceManager.formatSleepReports(result.data);
        this.setData({
          sleepReports: formattedReports,
          loading: false
        });
        
        // 获取第一个报告的详细信息
        const firstReport = result.data[0];
        if (firstReport && firstReport.id) {
          this.loadReportDetail(firstReport.id);
        } else {
          wx.showToast({
            title: '报告数据格式错误',
            icon: 'none',
            duration: 2000
          });
        }
      } else {
        this.setData({
          sleepReports: [],
          loading: false
        });
        wx.showToast({
          title: '该日期范围内无睡眠报告',
          icon: 'none',
          duration: 2000
        });
      }
    })
    .catch(error => {
      console.error('获取睡眠报告列表失败:', error);
      this.setData({ loading: false });
      wx.showToast({
        title: error.message || '获取报告列表失败',
        icon: 'none',
        duration: 2000
      });
    });
  },

  /**
   * 加载睡眠报告详情
   * @param {number} reportId 报告ID
   */
  loadReportDetail(reportId) {
    console.log('开始加载报告详情, 报告ID:', reportId);
    
    this.deviceManager.getSleepReportDetail({
      report_id: reportId
    })
    .then(result => {
      console.log('获取睡眠报告详情成功:', result);
      
      if (result && result.data) {
        // 格式化报告详情
        const formattedDetail = this.deviceManager.formatSleepReportDetail(result);
        if (formattedDetail) {
          this.displayReportDetail(formattedDetail);
        } else {
          wx.showToast({
            title: '报告详情格式化失败',
            icon: 'none',
            duration: 2000
          });
        }
      } else {
        wx.showToast({
          title: '报告详情数据为空',
          icon: 'none',
          duration: 2000
        });
      }
    })
    .catch(error => {
      console.error('获取睡眠报告详情失败:', error);
      wx.showToast({
        title: error.message || '获取报告详情失败',
        icon: 'none',
        duration: 2000
      });
    });
  },

  /**
   * 显示指定的睡眠报告（列表数据）
   * @param {Object} report 报告数据
   */
  displayReport(report) {
    if (!report) return;
    
    // 格式化时间
    const startTimeDisplay = this.deviceManager.formatTimeDisplay(report.startTime);
    const endTimeDisplay = this.deviceManager.formatTimeDisplay(report.endTime);
    
    // 计算睡眠阶段占比
    const totalSleep = report.sleepDuration;
    const deepSleep = report.deepSleepDuration;
    const lightSleep = report.lightSleepDuration;
    const awake = report.inBedDuration - totalSleep;
    
    const deepPercent = totalSleep > 0 ? Math.round((deepSleep / totalSleep) * 100) : 0;
    const lightPercent = totalSleep > 0 ? Math.round((lightSleep / totalSleep) * 100) : 0;
    const awakePercent = totalSleep > 0 ? Math.round((awake / totalSleep) * 100) : 0;
    
    this.setData({
      currentReport: report,
      sleepScore: report.sleepScore,
      scoreLevel: report.sleepScoreLevel,
      sleepStartTime: startTimeDisplay.time,
      sleepEndTime: endTimeDisplay.time,
      sleepTime: this.deviceManager.formatDuration(report.sleepDuration),
      shallowPercent: lightPercent,
      deepPercent: deepPercent,
      awakePercent: awakePercent,
      stageData: [
        { name: '清醒期', value: awakePercent, color: '#e97b7b' },
        { name: '浅睡期', value: lightPercent, color: '#f7c873' },
        { name: '深睡期', value: deepPercent, color: '#5e7fff' }
      ]
    });
    
    // 重新初始化图表
    this.initStagePieChart();
  },

  /**
   * 显示睡眠报告详情
   * @param {Object} reportDetail 报告详情数据
   */
  displayReportDetail(reportDetail) {
    if (!reportDetail) return;
    
    console.log('显示报告详情:', reportDetail);
    
    // 格式化时间
    const startTime = reportDetail.startSleepTime || '00:00';
    const endTime = reportDetail.endSleepTime || '06:00';
    
    // 计算睡眠阶段占比
    const totalSleep = reportDetail.sleepDuration;
    const deepSleep = reportDetail.deepSleepDuration;
    const lightSleep = reportDetail.lightSleepDuration;
    const remSleep = reportDetail.remSleepDuration;
    const bedDuration = reportDetail.bedDuration;
    const awake = bedDuration - totalSleep;
    
    const deepPercent = totalSleep > 0 ? Math.round((deepSleep / totalSleep) * 100) : 0;
    const lightPercent = totalSleep > 0 ? Math.round((lightSleep / totalSleep) * 100) : 0;
    const remPercent = totalSleep > 0 ? Math.round((remSleep / totalSleep) * 100) : 0;
    const awakePercent = bedDuration > 0 ? Math.round((awake / bedDuration) * 100) : 0;
    
    // 格式化睡眠时长
    const sleepTimeHours = Math.floor(totalSleep / 60);
    const sleepTimeMinutes = totalSleep % 60;
    const sleepTimeDisplay = `${sleepTimeHours}h${sleepTimeMinutes}min`;
    
    // 获取睡眠评分等级
    const scoreLevel = this.deviceManager.getSleepScoreLevel(reportDetail.sleepScore);
    
    this.setData({
      currentReport: reportDetail,
      sleepScore: reportDetail.sleepScore,
      scoreLevel: scoreLevel,
      sleepStartTime: startTime,
      sleepEndTime: endTime,
      sleepTime: sleepTimeDisplay,
      shallowPercent: lightPercent,
      deepPercent: deepPercent,
      awakePercent: awakePercent,
      remPercent: remPercent,
      stageData: [
        { name: '清醒期', value: awakePercent, color: '#e97b7b' },
        { name: '浅睡期', value: lightPercent, color: '#f7c873' },
        { name: '深睡期', value: deepPercent, color: '#5e7fff' },
        { name: '快速眼动', value: remPercent, color: '#9c27b0' }
      ],
      // 详细数据
      reportDetail: reportDetail,
      heartRate: reportDetail.heartRate,
      breathRate: reportDetail.breathRate,
      turnCount: reportDetail.turnCount,
      snoreDuration: reportDetail.snoreDuration,
      snoreCount: reportDetail.snoreCount,
      sleepAge: reportDetail.sleepAge,
      sleepOnsetTime: reportDetail.sleepOnsetTime,
      sleepAssessment: reportDetail.sleepAssessment,
      advice: reportDetail.advice
    });
    
    // 重新初始化图表
    this.initStagePieChart();
    
    // 更新评分圆环图
    this.updateScoreCircleChart(reportDetail.sleepScore);
  },

  /**
   * 选择报告
   * @param {Object} e 事件对象
   */
  onSelectReport(e) {
    const index = e.currentTarget.dataset.index;
    const report = this.data.sleepReports[index];
    if (report && report.id) {
      // 获取选中报告的详细信息
      this.loadReportDetail(report.id);
    } else if (report) {
      // 如果没有ID，使用列表数据
      this.displayReport(report);
    }
  },

  /**
   * 更新评分圆环图
   * @param {number} score 睡眠评分
   */
  updateScoreCircleChart(score) {
    const remaining = 100 - score;
    this.setData({
      scoreCircleChart: {
        onInit: function (canvas, width, height, dpr) {
          const chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
          canvas.setChart(chart);
          chart.setOption({
            backgroundColor: 'transparent',
            series: [{
              type: 'pie',
              radius: ['90%', '100%'],
              silent: true,
              label: { show: false },
              data: [
                { value: score, name: '得分', itemStyle: { color: '#ffd700' } },
                { value: remaining, name: '空', itemStyle: { color: '#2a223d' } }
              ]
            }],
          });
          return chart;
        }
      }
    });
  }
});