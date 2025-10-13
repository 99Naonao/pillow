// pages/report/report.js
const DeviceManager = require('../../utils/deviceManager');
const DataProcessor = require('../../utils/dataProcessor');
const ChartManager = require('../../utils/chartManager');

Page({
  data: {
    sleepTime:'',           // 本次睡眠时长
    sleepStartTime:'00:00', // 睡眠开始时间
    sleepEndTime:'06:38',   // 睡眠结束时间
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
    sleepAssessment: '',    // 睡眠评估
    advice: '',             // 建议
    
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
    bodyMoveTrendChart: {},
    
    // 睡眠柱状图数据
    sleepChartData: [],  // 睡眠时间线柱状图数据
    sleepReport: [],     // 睡眠报告数据
    offbedPercent: 0,    // 离床百分比
    offbedDuration: 0,   // 离床时长（小时）
    
    // 睡眠阶段图表数据
    sleepStages: [],
    sleepTimeLabels: [],
    // 點擊效果相關
    selectedBlock: null,
    showBlockInfo: false
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
    const CommonUtil = require('../../utils/commonUtil');
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
    this.loadSleepReports(today, endDate, wifiMac)
    // this.loadSleepReports(today, endDate, "f4:cf:a2:80:9f:ac");
    
    // 知道睡眠报告id以后的获取详细睡眠报告详情测试方法
    // this.testSleepReportDetail("f4:cf:a2:80:9f:ac", 41250);
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
    
    // 手動更新睡眠階段圖表
    setTimeout(() => {
      this.updateSleepStageChart();
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
      offbedPercent: 0,
      shallowDuration: 0,
      deepDuration: 0,
      awakeDuration: 0,
      remDuration: 0,
      offbedDuration: 0,
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
      bodyMoveTrendChart: null,
      // 清空睡眠报告数据
      sleepChartData: [],
      sleepReport: [],
      // 清空睡眠阶段图表数据
      sleepStages: [],
      sleepTimeLabels: [],
      // 清空點擊效果狀態
      selectedBlock: null,
      showBlockInfo: false
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
   * 加载报告详情
   */
  loadReportDetail(reportId) {
    this.deviceManager.getSleepReportDetail({
      report_id: reportId
      // report_id: 41250
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
    
    // 獲取睡眠報告數據
    let sleepReport = [];
    if (report.left && report.right) {
      sleepReport = this.deviceManager.getValidSleepReport(report.left, report.right);
    } else if (report.sleepReport) {
      sleepReport = report.sleepReport;
    }
    
    // 選擇用於計算的報告數據
    let selectedReport = report;
    if (report.left && report.right) {
      // 根據異常檢查選擇有效的報告數據
      const leftAbnormal = this.deviceManager.isReportDataAbnormal(report.left);
      const rightAbnormal = this.deviceManager.isReportDataAbnormal(report.right);
      
      if (!leftAbnormal) {
        selectedReport = report.left;
      } else if (!rightAbnormal) {
        selectedReport = report.right;
      } else {
        // 如果都異常，選擇數據更豐富的
        selectedReport = report.left.sleep_report && report.left.sleep_report.length > 0 ? report.left : report.right;
      }
    }
    
    // 计算睡眠阶段百分比
    const stagePercentages = DataProcessor.calculateSleepStagePercentages(selectedReport);
    
    // 直接使用API返回的评分等级
    const scoreLevel = report.scoreEvaluate || this.deviceManager.getSleepScoreLevel(report.sleepScore);
    
    console.log('displayReport - 獲取到的sleepReport:', sleepReport);
    console.log('displayReport - 選擇的報告數據:', selectedReport);

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
      offbedPercent: stagePercentages.offbedPercent,
      shallowDuration: stagePercentages.lightDuration,
      deepDuration: stagePercentages.deepDuration,
      awakeDuration: stagePercentages.awakeDuration,
      remDuration: stagePercentages.remDuration,
      offbedDuration: stagePercentages.offbedDuration,
      // 睡眠報告數據
      sleepReport: sleepReport,
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
      
      // 生成睡眠柱状图数据
      this.generateSleepChartData();
      
      // SleepStageChart 組件會通過 observers 自動響應數據變化，無需手動觸發
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
    
    // 獲取睡眠報告數據
    let sleepReport = [];
    if (reportDetail.left && reportDetail.right) {
      sleepReport = this.deviceManager.getValidSleepReport(reportDetail.left, reportDetail.right);
    } else if (reportDetail.sleepReport) {
      sleepReport = reportDetail.sleepReport;
    }
    
    console.log('displayReportDetail - 獲取到的sleepReport:', sleepReport);

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
      offbedPercent: stagePercentages.offbedPercent,
      shallowDuration: stagePercentages.lightDuration,
      deepDuration: stagePercentages.deepDuration,
      awakeDuration: stagePercentages.awakeDuration,
      remDuration: stagePercentages.remDuration,
      offbedDuration: stagePercentages.offbedDuration,
      // 睡眠報告數據
      sleepReport: sleepReport,
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
      
      // 生成睡眠柱状图数据
      this.generateSleepChartData();
      
      // 初始化睡眠階段圖表
      this.initSleepStageChart();
    });
  },


  /**
   * 生成睡眠柱状图数据
   */
  generateSleepChartData() {
    const { currentReport } = this.data;
    
    console.log('=== 生成睡眠柱状图数据开始 ===');
    console.log('currentReport:', currentReport);
    
    if (!currentReport) {
      console.log('currentReport为空，清空柱状图数据');
      this.setData({ 
        sleepChartData: [],
        sleepReport: []
      });
      return;
    }
    
    // 檢查必要字段是否存在
    if (!currentReport.startSleepTime || !currentReport.endSleepTime) {
      console.log('缺少必要的時間字段，清空柱状图数据');
      this.setData({ 
        sleepChartData: [],
        sleepReport: []
      });
      return;
    }
    
    // 使用deviceManager的getValidSleepReport方法获取睡眠报告数据
    let sleepReport = [];
    
    if (currentReport.left && currentReport.right) {
      // 如果有left和right数据，使用deviceManager的方法
      sleepReport = this.deviceManager.getValidSleepReport(currentReport.left, currentReport.right);
      console.log('使用deviceManager.getValidSleepReport获取数据:', sleepReport);
    } else if (currentReport.sleepReport) {
      // 如果已经有处理好的sleepReport数据
      sleepReport = currentReport.sleepReport;
      console.log('使用currentReport.sleepReport数据:', sleepReport);
    } else {
      console.log('没有找到有效的睡眠报告数据');
      this.setData({ sleepChartData: [] });
      return;
    }
    
    if (!sleepReport || sleepReport.length === 0) {
      console.log('sleepReport为空或长度为0');
      this.setData({ sleepChartData: [] });
      return;
    }
    
    console.log('从sleep_report生成柱状图数据:', sleepReport);
    
    // 计算总睡眠时长（分钟）
    const totalMinutes = sleepReport.reduce((sum, item) => sum + item.value, 0);
    
    if (totalMinutes <= 0) {
      this.setData({ sleepChartData: [] });
      return;
    }
    
    // 生成柱状图数据（舊樣式）
    const chartData = [];
    let currentTime = 0;
    
    // 計算實際睡眠時間範圍（以分鐘為單位）
    const sleepStartTime = this.data.sleepStartTime; // 格式: "HH:mm"
    const sleepEndTime = this.data.sleepEndTime;   // 格式: "HH:mm"
    const [startHour, startMinute] = sleepStartTime.split(':').map(Number);
    const [endHour, endMinute] = sleepEndTime.split(':').map(Number);
    const sleepStartMinutes = startHour * 60 + startMinute;
    const sleepEndMinutes = endHour * 60 + endMinute;
    // 處理跨天：用循環差確保為非負且 < 1440
    const spanMinutes = (sleepEndMinutes - sleepStartMinutes + 24 * 60) % (24 * 60);
    // 如果跨天導致計算為0（例如同時刻結束），回退到累積段時長
    const sleepDurationMinutes = spanMinutes > 0 ? spanMinutes : totalMinutes;
    
    sleepReport.forEach((item, index) => {
      const duration = item.value; // 分钟
      // 恢復正常的百分比計算
      const width = (duration / sleepDurationMinutes) * 100;
      const left = (currentTime / sleepDurationMinutes) * 100;
      
      // 根据state确定类型
      let type = 'awake';
      switch (item.state) {
        case 1:
          type = 'deep'; // 深睡
          break;
        case 2:
          type = 'rem'; // 中睡（快速眼动）
          break;
        case 3:
          type = 'shallow'; // 浅睡
          break;
        case 4:
          type = 'awake'; // 清醒
          break;
        case 5:
          type = 'offbed'; // 离床
          break;
        default:
          type = 'awake';
      }
      
      // 计算开始和结束时间 - 使用實際睡眠開始時間
      const startTime = this.calculateAbsoluteTime(sleepStartTime, currentTime);
      const endTime = this.calculateAbsoluteTime(sleepStartTime, currentTime + duration);
      const durationMinutes = Math.round(duration);
      
      // 計算動態字體大小
      const fontSize = this.calculateFontSize(width);
      
      // 生成柱状图数据（舊樣式）
      chartData.push({
        name: type,
        value: duration,
        duration: `${durationMinutes}分钟`,
        width: width,
        left: left,
        durationMinutes: durationMinutes,
        startTime: startTime,
        endTime: endTime,
        state: item.state,
        type: type,
        originalData: item,
        fontSize: fontSize // 添加字體大小屬性
      });
      
      currentTime += duration;
    });
    
    this.setData({ 
      sleepChartData: chartData, 
      sleepReport: sleepReport
    });
    console.log('生成睡眠柱状图数据:', chartData);
    console.log('柱状图数据长度:', chartData.length);
    console.log('=== 生成睡眠柱状图数据结束 ===');
  },

  /**
   * 从分钟数格式化时间
   */
  formatTimeFromMinutes(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  },

  /**
   * 計算絕對時間（基於睡眠開始時間）
   */
  calculateAbsoluteTime(sleepStartTime, offsetMinutes) {
    // 解析睡眠開始時間
    const [startHour, startMinute] = sleepStartTime.split(':').map(Number);
    const startTotalMinutes = startHour * 60 + startMinute;
    
    // 計算絕對時間
    const absoluteTotalMinutes = startTotalMinutes + offsetMinutes;
    
    // 處理跨天情況
    const finalMinutes = absoluteTotalMinutes % (24 * 60);
    
    const hours = Math.floor(finalMinutes / 60);
    const mins = Math.floor(finalMinutes % 60);
    
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  },

  /**
   * 从日期时间字符串格式化时间
   */
  formatTimeFromDateTime(dateTimeStr) {
    if (!dateTimeStr) return '00:00';
    const date = new Date(dateTimeStr);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  },

  /**
   * 图表柱状图点击事件
   */
  onChartBarTap(e) {
    const { index, time, type } = e.currentTarget.dataset;
    console.log('点击图表柱状图:', { index, time, type });
    
    const chartData = this.data.sleepChartData;
    if (chartData && chartData[index]) {
      const item = chartData[index];
      console.log('点击的睡眠阶段数据:', item);
      
      // 显示详细信息
      wx.showModal({
        title: '睡眠阶段详情',
        content: `阶段: ${item.type}\n开始时间: ${item.startTime}\n结束时间: ${item.endTime}\n持续时间: ${item.duration}`,
        showCancel: false,
        confirmText: '确定'
      });
    }
  },

  /**
   * 初始化睡眠階段圖表
   */
  initSleepStageChart() {
    console.log('=== 初始化睡眠階段圖表 ===');
    const { sleepReport, sleepStartTime, sleepEndTime } = this.data;
    
    if (!sleepReport || sleepReport.length === 0) {
      console.log('沒有睡眠報告數據，清空圖表數據');
      this.setData({ 
        sleepStages: [],
        sleepTimeLabels: []
      });
      return;
    }
    
    console.log('睡眠報告數據:', sleepReport);
    console.log('睡眠時間範圍:', sleepStartTime, '到', sleepEndTime);
    
    // 計算睡眠時長
    const totalMinutes = sleepReport.reduce((sum, item) => sum + item.value, 0);
    if (totalMinutes <= 0) {
      console.log('總睡眠時長為0，無法生成圖表');
      this.setData({ 
        sleepStages: [],
        sleepTimeLabels: []
      });
      return;
    }
    
    console.log('總睡眠時長（分鐘）:', totalMinutes);
    
    // 生成圖表數據
    const chartData = this.createSleepStageChartData(sleepReport, totalMinutes);
    this.setData(chartData);
    
    console.log('睡眠階段圖表數據已設置:', chartData);
  },

  /**
   * 創建睡眠階段圖表配置
   */
  createSleepStageChartData(sleepReport, totalMinutes) {
    console.log('創建睡眠階段圖表數據 - sleepReport:', sleepReport, 'totalMinutes:', totalMinutes);
    
    // 獲取睡眠開始時間
    const { sleepStartTime } = this.data;
    console.log('睡眠開始時間:', sleepStartTime);
    
    // 定義階段配置 - 按照您的要求：离床、清醒、浅睡、深睡
    const stageConfigs = [
      { name: '离床', color: '#FF6B6B', state: 5 },      // 紅色 - 离床
      { name: '清醒', color: '#FFA07A', state: 4 },      // 橙色 - 清醒
      { name: '浅睡', color: '#87CEEB', state: 3 },      // 淺藍色 - 浅睡
      { name: '深睡', color: '#4169E1', state: 1 }       // 深藍色 - 深睡
    ];
    
    // 生成時間軸標籤
    const timeLabels = [];
    const timeInterval = totalMinutes / 6; // 分成6個時間段
    for (let i = 0; i <= 6; i++) {
      const timeInMinutes = i * timeInterval;
      const hour = Math.floor(timeInMinutes / 60);
      const minute = Math.floor(timeInMinutes % 60);
      timeLabels.push({
        time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
        position: (i / 6) * 100
      });
    }
    
    // 為每個睡眠階段生成數據
    const sleepStages = [];
    let currentTime = 0;
    
    // 先為每個階段初始化空的 blocks 數組
    stageConfigs.forEach((config) => {
      sleepStages.push({
        name: config.name,
        color: config.color,
        blocks: []
      });
    });
    
    // 按時間順序遍歷睡眠報告，為對應階段添加數據
    sleepReport.forEach((item, index) => {
      const startPercent = (currentTime / totalMinutes) * 100;
      const durationPercent = (item.value / totalMinutes) * 100;
      
      console.log(`處理第 ${index + 1} 個項目:`, {
        state: item.state,
        value: item.value,
        currentTime: currentTime,
        startPercent: startPercent,
        durationPercent: durationPercent
      });
      
      // 找到對應的階段配置
      const stageConfig = stageConfigs.find(config => config.state === item.state);
      if (stageConfig) {
        const stageIndex = stageConfigs.findIndex(config => config.state === item.state);
        
        const blockData = {
          left: startPercent,
          width: durationPercent,
          color: stageConfig.color,
          stage: stageConfig.name,
          startTime: this.calculateAbsoluteTime(sleepStartTime, currentTime),
          endTime: this.calculateAbsoluteTime(sleepStartTime, currentTime + item.value),
          duration: item.value
        };
        
        console.log(`添加到階段 ${stageConfig.name}:`, blockData);
        
        sleepStages[stageIndex].blocks.push(blockData);
      } else {
        console.warn(`未找到狀態 ${item.state} 對應的階段配置`);
      }
      
      // 累計時間
      currentTime += item.value;
    });
    
    // 輸出調試信息
    sleepStages.forEach((stage, index) => {
      console.log(`階段 ${stage.name} 數據:`, stage.blocks);
    });
    
    console.log('最終生成的睡眠階段數據:', sleepStages);
    console.log('時間軸標籤:', timeLabels);
    
    return {
      sleepStages: sleepStages,
      sleepTimeLabels: timeLabels
    };
  },

  /**
   * 更新睡眠階段圖表
   */
  updateSleepStageChart() {
    console.log('更新睡眠階段圖表');
    this.initSleepStageChart();
  },

  /**
   * 點擊睡眠階段塊
   */
  onStageBlockTap(e) {
    console.log('點擊事件觸發:', e);
    const { stage, start, end, duration } = e.currentTarget.dataset;
    console.log('點擊睡眠階段塊:', { stage, start, end, duration });
    
    // 找到對應的塊數據，獲取位置信息
    let blockData = null;
    this.data.sleepStages.forEach(stageData => {
      stageData.blocks.forEach(block => {
        if (block.stage === stage && 
            block.startTime === start && 
            block.endTime === end) {
          blockData = block;
        }
      });
    });
    
    console.log('找到的塊數據:', blockData);
    
    this.setData({
      selectedBlock: {
        stage: stage,
        startTime: start,
        endTime: end,
        duration: parseInt(duration),
        left: blockData ? blockData.left : 0
      },
      showBlockInfo: true
    });
    
    console.log('設置後數據狀態:', this.data.showBlockInfo, this.data.selectedBlock);
    console.log('selectedBlock.left:', this.data.selectedBlock.left);
    console.log('selectedBlock.stage:', this.data.selectedBlock.stage);
  },

  /**
   * 關閉睡眠階段信息框
   */
  closeBlockInfo() {
    this.setData({
      selectedBlock: null,
      showBlockInfo: false
    });
  },

  /**
   * 根據柱狀圖寬度計算動態字體大小
   */
  calculateFontSize(widthPercent) {
    const minFontSize = 12; // 最小字體大小
    const maxFontSize = 20; // 最大字體大小
    const minWidth = 5; // 最小寬度百分比
    const maxWidth = 30; // 最大寬度百分比
    
    if (widthPercent < minWidth) return minFontSize;
    if (widthPercent > maxWidth) return maxFontSize;
    
    // 線性插值計算字體大小
    return Math.round(minFontSize + (maxFontSize - minFontSize) * (widthPercent - minWidth) / (maxWidth - minWidth));
  },

  /**
   * 前往商城
   */
  goToShop() {
    console.log('前往商城');
    // 跳转到商城小程序
    wx.navigateToMiniProgram({
      appId: 'wx041bde7c633d4ec0', // 替换为实际的商城小程序appId
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
  },

  /**
   * 測試方法：獲取睡眠報告詳情並打印日誌
   * @param {string} wifiMac WiFi MAC地址
   * @param {report_id} report_id 报告id
   */
  testSleepReportDetail(wifiMac, report_id) {
    console.log('=== 開始測試睡眠報告詳情 ===');
    
    if (!wifiMac) {
      console.log('❌ WiFi MAC地址為空，無法執行測試');
      return;
    }

    // 調用獲取睡眠報告詳情的API
    this.deviceManager.getSleepReportDetail({
      key: wifiMac,
      report_id: report_id
    })
    .then(result => {
      console.log('=== 睡眠報告詳情測試結果 ===');
      console.log('API返回結果:', result);
      
      if (result && result.data && result.data.length > 0) {
        const reportData = result.data[0];
        console.log('=== 第一個報告的詳細數據 ===');
        console.log('報告ID:', reportData.report_id);
        console.log('MAC地址:', reportData.mac);
        console.log('日期:', reportData.date);
        console.log('星期:', reportData.day_of_week);
        
        // 檢查left數據
        if (reportData.left) {
          console.log('=== LEFT數據詳情 ===');
          console.log('bed_duration:', reportData.left.bed_duration);
          console.log('sleep_duration:', reportData.left.sleep_duration);
          console.log('deep_sleep_duration:', reportData.left.deep_sleep_duration);
          console.log('light_sleep_duration:', reportData.left.light_sleep_duration);
          console.log('rem_sleep_duration:', reportData.left.rem_sleep_duration);
          console.log('sleep_score:', reportData.left.sleep_score);
          console.log('score_evaluate:', reportData.left.score_evaluate);
          console.log('start_sleep_time:', reportData.left.start_sleep_time);
          console.log('end_sleep_time:', reportData.left.end_sleep_time);
          console.log('heart_rate:', reportData.left.heart_rate);
          console.log('breath_rate:', reportData.left.breath_rate);
          console.log('turn_count:', reportData.left.turn_count);
          console.log('snore_duration:', reportData.left.snore_duration);
          console.log('snore_count:', reportData.left.snore_count);
          console.log('sleep_onset_time:', reportData.left.sleep_onset_time);
          console.log('sleep_age:', reportData.left.sleep_age);
          console.log('sleep_report長度:', reportData.left.sleep_report ? reportData.left.sleep_report.length : 0);
          console.log('sleep_report數據:', reportData.left.sleep_report);
          
          // 檢查異常狀態
          const leftAbnormal = this.deviceManager.isReportDataAbnormal(reportData.left);
          console.log('LEFT數據是否異常:', leftAbnormal);
        } else {
          console.log('❌ LEFT數據不存在');
        }
        
        // 檢查right數據
        if (reportData.right) {
          console.log('=== RIGHT數據詳情 ===');
          console.log('bed_duration:', reportData.right.bed_duration);
          console.log('sleep_duration:', reportData.right.sleep_duration);
          console.log('deep_sleep_duration:', reportData.right.deep_sleep_duration);
          console.log('light_sleep_duration:', reportData.right.light_sleep_duration);
          console.log('rem_sleep_duration:', reportData.right.rem_sleep_duration);
          console.log('sleep_score:', reportData.right.sleep_score);
          console.log('score_evaluate:', reportData.right.score_evaluate);
          console.log('start_sleep_time:', reportData.right.start_sleep_time);
          console.log('end_sleep_time:', reportData.right.end_sleep_time);
          console.log('heart_rate:', reportData.right.heart_rate);
          console.log('breath_rate:', reportData.right.breath_rate);
          console.log('turn_count:', reportData.right.turn_count);
          console.log('snore_duration:', reportData.right.snore_duration);
          console.log('snore_count:', reportData.right.snore_count);
          console.log('sleep_onset_time:', reportData.right.sleep_onset_time);
          console.log('sleep_age:', reportData.right.sleep_age);
          console.log('sleep_report長度:', reportData.right.sleep_report ? reportData.right.sleep_report.length : 0);
          console.log('sleep_report數據:', reportData.right.sleep_report);
          
          // 檢查異常狀態
          const rightAbnormal = this.deviceManager.isReportDataAbnormal(reportData.right);
          console.log('RIGHT數據是否異常:', rightAbnormal);
        } else {
          console.log('❌ RIGHT數據不存在');
        }
        
        // 測試數據選擇邏輯
        console.log('=== 數據選擇邏輯測試 ===');
        const selectedSleepReport = this.deviceManager.getValidSleepReport(reportData.left, reportData.right);
        console.log('選擇的睡眠報告數據:', selectedSleepReport);
        console.log('選擇的數據長度:', selectedSleepReport.length);
        
        // 測試睡眠階段百分比計算
        console.log('=== 睡眠階段百分比計算測試 ===');
        const stagePercentages = DataProcessor.calculateSleepStagePercentages(reportData);
        console.log('計算的睡眠階段百分比:', stagePercentages);
        
      } else {
        console.log('❌ 沒有找到睡眠報告數據');
      }
      
      console.log('=== 睡眠報告詳情測試完成 ===');
    })
    .catch(error => {
      console.error('❌ 測試睡眠報告詳情失敗:', error);
    });
  }
});
  
  