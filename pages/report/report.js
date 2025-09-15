// pages/report/report.js
import * as echarts from '../../components/ec-canvas/echarts';
const DeviceManager = require('../../utils/deviceManager');
const CommonUtil = require('../../utils/commonUtil');
const DataProcessor = require('../../utils/dataProcessor');
const ChartManager = require('../../utils/chartManager');

Page({
  data: {
    sleepTime:'',           // 本次睡眠时长
    sleepStartTime:'00:00',           // 睡眠开始时间
    sleepEndTime:'06:38',             // 睡眠结束时间
    currentDate: '',        // 页面显示的日期（yyyy.MM.dd） 
    calendarValue: '',      // TDesign日历组件的值（yyyy-MM-dd）
    showCalendar: false,    // 控制日历弹窗显示
    shallowPercent: 0,      // 浅睡占比
    awakePercent: 0,        // 清醒占比
    deepPercent: 0,         // 深睡占比
    remPercent: 0,          // 快速眼动占比
    shallowDuration: 0,     // 浅睡时长(小时)
    awakeDuration: 0,       // 清醒时长(小时)
    deepDuration: 0,        // 深睡时长(小时)
    remDuration: 0,         // 快速眼动时长(小时)
    sleepReports: [],       // 睡眠报告列表
    loading: false,         // 加载状态
    currentReport: null,    // 当前选中的报告
    wifiMac:'',             //wifiMac地址
    stageData: [
      { name: '清醒期', value: 0, color: '#e97b7b' },
      { name: '浅睡期', value: 0, color: '#f7c873' },
      { name: '深睡期', value: 0, color: '#5e7fff' },
      { name: '快速眼动', value: 0, color: '#9c27b0' }
    ],
    score: 0,
    scoreLevel: '良好',
    sleepScore: 0,          // 睡眠评分
    heartRate: 0,           // 平均心率
    breathRate: 0,          // 平均呼吸频率
    turnCount: 0,           // 累积体动次数
    snoreDuration: 0,       // 打鼾时长
    snoreCount: 0,          // 打鼾次数
    sleepAge: 0,            // 睡眠年龄
    sleepOnsetTime: 0,      // 入睡时间
    sleepAssessment: '',     // 睡眠评估
    advice: '',              // 建议
    
    // 曲线图数据数组
    timeLabels: ['00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00'],  // 时间标签
    heartRateData: [60, 65, 70, 68, 72, 75, 70],  // 心率数据
    breathRateData: [12, 15, 18, 16, 20, 22, 19],  // 呼吸率数据
    bodyMoveData: [2, 5, 3, 8, 6, 4, 7],  // 体动数据
    
    // 图表配置
    stagePieChart: {},
    scoreCircleChart: {},
    heartTrendChart: {},
    breathTrendChart: {},
    bodyMoveTrendChart: {}
  },

  onReady() {
    // 页面准备就绪
  },

  onLoad() {
    // 初始化设备管理器
    this.deviceManager = new DeviceManager(this);
    // 初始化图表管理器
    this.chartManager = new ChartManager(this);
    
    // 从 CommonUtil 获取保存的 WiFi MAC 地址
    const wifiMac = CommonUtil.getSavedWifiMac();
    const convertedIds = wx.getStorageSync('convertedCharacteristicIds');
    
    console.log('[report] WiFi MAC地址:', wifiMac);
    console.log('[report] WiFi MAC 類型:', typeof wifiMac);
    console.log('[report] WiFi MAC 是否為空:', !wifiMac);
    console.log('[report] 转换后的特征值ID:', convertedIds);
    
    // 默认日期为今天
    const today = DataProcessor.formatDate(new Date());
    this.setData({
      wifiMac: wifiMac,
      shallowPercent: 0,
      awakePercent: 0,
      deepPercent: 0,
      remPercent: 0,
      currentDate: today.replace(/-/g, '.'),
      calendarValue: today
    });
    
    // 加载今天的睡眠报告，end_date 比 start_date 多一天
    const endDate = DataProcessor.getNextDay(today);
    this.loadSleepReports(today, endDate, wifiMac);
  },

  // 日历相关事件处理
  onShowCalendar() {
    this.setData({ showCalendar: true });
  },

  onCalendarClose() {
    this.setData({ showCalendar: false });
  },

  onCalendarConfirm(e) {
    const selectedDate = e.detail.value;
    const formattedDate = selectedDate.replace(/-/g, '.');
    
    this.setData({
      currentDate: formattedDate,
      calendarValue: selectedDate,
      showCalendar: false
    });
    
    // 加载选中日期的睡眠报告
    const endDate = DataProcessor.getNextDay(selectedDate);
    this.loadSleepReports(selectedDate, endDate, this.data.wifiMac);
  },

  onDateChange(e) {
    const selectedDate = e.detail.value;
    const formattedDate = selectedDate.replace(/-/g, '.');
    
    this.setData({
      currentDate: formattedDate,
      calendarValue: selectedDate
    });
    
    // 加载选中日期的睡眠报告
    const endDate = DataProcessor.getNextDay(selectedDate);
    this.loadSleepReports(selectedDate, endDate, this.data.wifiMac);
    
    // 手動更新圓環組件
    setTimeout(() => {
      const sleepStageChart = this.selectComponent('#sleepStageChart');
      if (sleepStageChart) {
        // sleepStageChart.setStartAngle(90);
        sleepStageChart.updateChart();
      }
    }, 100);
  },

  /**
   * 加载睡眠报告列表
   */
  loadSleepReports(startDate, endDate, wifiMac) {
    console.log('[report] 加载睡眠报告 - WiFi MAC:', wifiMac, '开始日期:', startDate, '结束日期:', endDate);
    console.log('[report] WiFi MAC 類型:', typeof wifiMac, '長度:', wifiMac ? wifiMac.length : 0);
    
    if (!wifiMac) {
      console.warn('[report] WiFi MAC 地址為空，無法加載睡眠報告');
      wx.showToast({
        title: '请先连接设备',
        icon: 'none'
      });
      return;
    }

    this.setData({ loading: true });

    this.deviceManager.getSleepReportData({
      mac: wifiMac,
      start_date: startDate,
      end_date: endDate
    })
      .then(result => {
        console.log('获取到的睡眠报告:', result);
        const reports = result && result.data ? result.data : [];
        const formattedReports = this.formatSleepReports(reports);
        
        this.setData({
          sleepReports: formattedReports,
          loading: false
        });
        
        // 如果有报告，自动选择第一个
        if (formattedReports.length > 0) {
          this.onSelectReport({ detail: { value: formattedReports[0] } });
        } else {
          // 没有数据时，清空页面显示并显示提示
          this.clearReportData();
          wx.showModal({
            title: '提示',
            content: `该日期范围内无睡眠报告数据`,
            showCancel: false,
            confirmText: '确定'
          });
        }
      })
      .catch(error => {
        console.error('获取睡眠报告失败:', error);
        this.setData({ loading: false });
        // 请求失败时也清空数据
        this.clearReportData();
        wx.showToast({
          title: '获取报告失败',
          icon: 'none'
        });
      });
  },

  /**
   * 清空报告数据
   */
  clearReportData() {
    console.log('清空报告数据');
    this.setData({
      currentReport: null,
      sleepScore: 0,
      scoreLevel: '良好',
      sleepStartTime: '00:00',
      sleepEndTime: '00:00',
      sleepTime: '0h0min',
      shallowPercent: 0,
      deepPercent: 0,
      awakePercent: 0,
      remPercent: 0,
      shallowDuration: 0,
      deepDuration: 0,
      awakeDuration: 0,
      remDuration: 0,
      // 详细数据
      heartRate: 0,
      breathRate: 0,
      turnCount: 0,
      snoreDuration: 0,
      snoreCount: 0,
      sleepAge: 0,
      sleepOnsetTime: 0,
      sleepAssessment: '',
      advice: '',
      // 趋势数据
      timeLabels: [],
      heartRateData: [],
      breathRateData: [],
      bodyMoveData: [],
      // 清空图表
      stagePieChart: null,
      scoreCircleChart: null,
      heartTrendChart: null,
      breathTrendChart: null,
      bodyMoveTrendChart: null
    });
  },

  /**
   * 格式化睡眠报告列表
   */
  formatSleepReports(reports) {
    if (!Array.isArray(reports)) return [];
    
    return reports.map(report => {
      const startTime = DataProcessor.parseTimeFromDateTime(report.startSleepTime);
      const endTime = DataProcessor.parseTimeFromDateTime(report.endSleepTime);
      const sleepTimeDisplay = DataProcessor.formatSleepTimeDisplay(report.sleepDuration);
      
      return {
        ...report,
        startTime: startTime,
        endTime: endTime,
        sleepTimeDisplay: sleepTimeDisplay
      };
    });
  },

  /**
   * 加载报告详情
   */
  loadReportDetail(reportId) {
    this.deviceManager.getSleepReportDetail({
      report_id: reportId
    })
      .then(result => {
        console.log('获取到的报告详情:', result);
        // 格式化报告详情
        const reportDetail = this.deviceManager.formatSleepReportDetail(result);
        if (reportDetail) {
          this.displayReportDetail(reportDetail);
        } else {
          wx.showToast({
            title: '报告详情格式化失败',
            icon: 'none'
          });
        }
      })
      .catch(error => {
        console.error('获取报告详情失败:', error);
        wx.showToast({
          title: '获取详情失败',
          icon: 'none'
        });
      });
  },

  /**
   * 显示报告（使用列表数据）
   */
  displayReport(report) {
    if (!report) return;
    
    console.log('displayReport - report對象:', report);
    console.log('displayReport - report.sleep_report:', report.sleep_report);
    console.log('displayReport - report的所有字段:', Object.keys(report));
    
    // 格式化时间
    const startTime = DataProcessor.parseTimeFromDateTime(report.startSleepTime);
    const endTime = DataProcessor.parseTimeFromDateTime(report.endSleepTime);
    const sleepTimeDisplay = DataProcessor.formatSleepTimeDisplay(report.sleepDuration);
    
    // 计算睡眠阶段百分比
    const stagePercentages = DataProcessor.calculateSleepStagePercentages(report);
    
    // 直接使用API返回的评分等级
    const scoreLevel = report.scoreEvaluate || this.deviceManager.getSleepScoreLevel(report.sleepScore);
    
    this.setData({
      currentReport: report,
      sleepScore: report.sleepScore,
      scoreLevel: scoreLevel,
      sleepStartTime: startTime,
      sleepEndTime: endTime,
      sleepTime: sleepTimeDisplay,
      shallowPercent: stagePercentages.lightPercent,
      deepPercent: stagePercentages.deepPercent,
      awakePercent: stagePercentages.awakePercent,
      remPercent: stagePercentages.remPercent,
      shallowDuration: stagePercentages.lightDuration,
      deepDuration: stagePercentages.deepDuration,
      awakeDuration: stagePercentages.awakeDuration,
      remDuration: stagePercentages.remDuration,
      // 详细数据
      heartRate: report.heartRate,
      breathRate: report.breathRate,
      turnCount: report.turnCount,
      snoreDuration: report.snoreDuration,
      snoreCount: report.snoreCount,
      sleepAge: report.sleepAge,
      sleepOnsetTime: report.sleepOnsetTime,
      sleepAssessment: report.sleepAssessment,
      advice: report.advice
    }, () => {
      // 初始化图表
      this.chartManager.initAllCharts(report);
      
      // 手動觸發睡眠階段圖表更新
      const sleepStageChart = this.selectComponent('#sleepStageChart');
      if (sleepStageChart) {
        console.log('手動觸發睡眠階段圖表更新');
        sleepStageChart.updateChart();
      }
    });
  },

  /**
   * 显示报告详情
   */
  displayReportDetail(reportDetail) {
    if (!reportDetail) return;
    
    console.log('displayReportDetail - reportDetail對象:', reportDetail);
    console.log('displayReportDetail - reportDetail.sleep_report:', reportDetail.sleep_report);
    console.log('displayReportDetail - reportDetail的所有字段:', Object.keys(reportDetail));
    console.log('时间数据:', {
      startSleepTime: reportDetail.startSleepTime,
      endSleepTime: reportDetail.endSleepTime,
      startSleepTimeType: typeof reportDetail.startSleepTime,
      endSleepTimeType: typeof reportDetail.endSleepTime
    });
    
    // 格式化时间
    const startTime = DataProcessor.parseTimeFromDateTime(reportDetail.startSleepTime);
    const endTime = DataProcessor.parseTimeFromDateTime(reportDetail.endSleepTime);
    const sleepTimeDisplay = DataProcessor.formatSleepTimeDisplay(reportDetail.sleepDuration);
    
    console.log('格式化后的时间:', {
      startTime: startTime,
      endTime: endTime,
      sleepTimeDisplay: sleepTimeDisplay
    });
    
    // 计算睡眠阶段百分比
    const stagePercentages = DataProcessor.calculateSleepStagePercentages(reportDetail);
    
    // 直接使用API返回的评分等级
    const scoreLevel = reportDetail.scoreEvaluate || this.deviceManager.getSleepScoreLevel(reportDetail.sleepScore);
    
    this.setData({
      currentReport: reportDetail,
      sleepScore: reportDetail.sleepScore,
      scoreLevel: scoreLevel,
      sleepStartTime: startTime,
      sleepEndTime: endTime,
      sleepTime: sleepTimeDisplay,
      shallowPercent: stagePercentages.lightPercent,
      deepPercent: stagePercentages.deepPercent,
      awakePercent: stagePercentages.awakePercent,
      remPercent: stagePercentages.remPercent,
      shallowDuration: stagePercentages.lightDuration,
      deepDuration: stagePercentages.deepDuration,
      awakeDuration: stagePercentages.awakeDuration,
      remDuration: stagePercentages.remDuration,
      // 详细数据
      heartRate: reportDetail.heartRate,
      breathRate: reportDetail.breathRate,
      turnCount: reportDetail.turnCount,
      snoreDuration: reportDetail.snoreDuration,
      snoreCount: reportDetail.snoreCount,
      sleepAge: reportDetail.sleepAge,
      sleepOnsetTime: reportDetail.sleepOnsetTime,
      sleepAssessment: reportDetail.sleepAssessment,
      advice: reportDetail.advice
    }, () => {
      // 初始化图表
      this.chartManager.initAllCharts(reportDetail);
      
      // 手動觸發睡眠階段圖表更新
      const sleepStageChart = this.selectComponent('#sleepStageChart');
      if (sleepStageChart) {
        console.log('手動觸發睡眠階段圖表更新');
        sleepStageChart.updateChart();
      }
    });
  },

  /**
   * 选择报告
   */
  onSelectReport(e) {
    const report = e.detail.value;
    console.log('选择的报告:', report);
    
    if (report && report.id) {
      // 获取选中报告的详细信息
      this.loadReportDetail(report.id);
    } else if (report) {
      // 如果没有ID，使用列表数据
      this.displayReport(report);
    }
  },

  /**
   * 前往商城
   */
  goToShop() {
    console.log('前往商城');
    // 跳转到商城小程序
    wx.navigateToMiniProgram({
      appId: 'wxadc17399e1b28d8b', // 替换为实际的商城小程序appId
      path: 'pages/index/index', // 商城小程序的页面路径
      // extraData: {
      //   from: 'sleep_report', // 标识来源
      //   sleepScore: this.data.sleepScore, // 传递睡眠评分
      //   scoreLevel: this.data.scoreLevel // 传递评分等级
      // },
      success: (res) => {
        console.log('跳转商城成功:', res);
      },
      fail: (error) => {
        console.error('跳转商城失败:', error);
        wx.showToast({
          title: '跳转失败，请稍后重试',
          icon: 'none'
        });
      }
    });
  }
});