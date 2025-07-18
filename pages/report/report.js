// pages/report/report.js
import * as echarts from '../../components/ec-canvas/echarts';

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
    // 默认日期为今天
    const today = this.formatDate(new Date());
    this.setData({
      shallowPercent: 58,
      awakePercent: 15,
      deepPercent: 27,
      currentDate: today.replace(/-/g, '.'),
      calendarValue: today
    });
    this.calculateSleepTime();
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
    // 可在此处根据日期请求报告数据
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
  }
});