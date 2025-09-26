// components/SleepStageChart/sleepStageChart.js
const echarts = require('../../components/ec-canvas/echarts');

Component({
  properties: {
    sleepReport: {
      type: Array,
      value: []
    },
    sleepStartTime: {
      type: String,
      value: '00:00'
    },
    sleepEndTime: {
      type: String,
      value: '00:00'
    }
  },

  lifetimes: {
    attached() {
      console.log('SleepStageChart組件已附加');
    },
    ready() {
      console.log('SleepStageChart組件已準備就緒');
      // 組件準備就緒後，檢查是否有初始數據
      if (this.data.sleepReport && this.data.sleepReport.length > 0) {
        console.log('組件準備就緒時發現有初始數據，觸發處理');
        this.observers['sleepReport, sleepStartTime, sleepEndTime'].call(this, this.data.sleepReport, this.data.sleepStartTime, this.data.sleepEndTime);
      }
    }
  },

  data: {
    chartData: {
      startTime: '',
      endTime: '',
      stages: []
    },
    timeMarkers: [],
    ecConfig: null
  },

  observers: {
    'sleepReport, sleepStartTime, sleepEndTime': function(sleepReport, sleepStartTime, sleepEndTime) {
      console.log('=== SleepStageChart 數據處理開始 ===');
      console.log('收到數據:', { 
        sleepReport: sleepReport, 
        sleepReportLength: sleepReport ? sleepReport.length : 'undefined',
        sleepStartTime: sleepStartTime, 
        sleepEndTime: sleepEndTime 
      });
      
      if (!sleepReport || sleepReport.length === 0) {
        console.log('沒有睡眠報告數據，sleepReport:', sleepReport);
        this.setData({
          chartData: {
            startTime: sleepStartTime || '00:00',
            endTime: sleepEndTime || '00:00',
            stages: []
          },
          timeMarkers: [],
          ecConfig: null
        });
        return;
      }
      
      // 檢查 sleepReport 數據格式
      console.log('sleepReport 數據格式檢查:', sleepReport.map(item => ({
        state: item.state,
        value: item.value,
        hasState: 'state' in item,
        hasValue: 'value' in item
      })));
      
      console.log('開始處理睡眠數據，sleepReport 樣本:', sleepReport.slice(0, 3));
      this.processSleepData(sleepReport, sleepStartTime, sleepEndTime);
    }
  },

  methods: {
    /**
     * 更新圖表方法 - 供外部調用
     */
    updateChart() {
      console.log('SleepStageChart updateChart 被調用');
      // 重新處理當前數據
      if (this.data.sleepReport && this.data.sleepReport.length > 0) {
        this.processSleepData(this.data.sleepReport, this.data.sleepStartTime, this.data.sleepEndTime);
      }
    },

    /**
     * 處理睡眠數據並生成圖表
     */
    processSleepData(sleepReport, sleepStartTime, sleepEndTime) {
      console.log('處理睡眠數據:', sleepReport);
      console.log('睡眠時間範圍:', sleepStartTime, '到', sleepEndTime);
      
      // 計算總睡眠時長
      const totalMinutes = sleepReport.reduce((sum, item) => sum + item.value, 0);
      if (totalMinutes <= 0) {
        console.log('總睡眠時長為0，無法生成圖表');
        return;
      }

      // 計算實際睡眠時間範圍
      const [startHour, startMinute] = sleepStartTime.split(':').map(Number);
      const [endHour, endMinute] = sleepEndTime.split(':').map(Number);
      const sleepStartMinutes = startHour * 60 + startMinute;
      const sleepEndMinutes = endHour * 60 + endMinute;
      const sleepDurationMinutes = sleepEndMinutes - sleepStartMinutes;
      
      console.log('時間計算:', {
        totalMinutes: totalMinutes,
        sleepDurationMinutes: sleepDurationMinutes,
        sleepStartMinutes: sleepStartMinutes,
        sleepEndMinutes: sleepEndMinutes
      });
      
      // 使用實際睡眠時長來生成時間標記和圖表
      const timeMarkers = this.generateTimeMarkers(sleepReport, sleepDurationMinutes);
      
      // 生成 ECharts 配置
      const ecConfig = this.createEChartsConfig(sleepReport, sleepDurationMinutes);
      
      // 更新組件數據
      this.setData({
        chartData: {
          startTime: sleepStartTime,
          endTime: sleepEndTime,
          stages: sleepReport
        },
        timeMarkers: timeMarkers,
        ecConfig: ecConfig
      });
      
      console.log('SleepStageChart 數據處理完成');
      console.log('設置的 ecConfig:', ecConfig);
      console.log('ecConfig 類型:', typeof ecConfig);
      console.log('ecConfig 是否為 null:', ecConfig === null);
      console.log('ecConfig 是否為 undefined:', ecConfig === undefined);
    },

    /**
     * 生成時間標記
     */
    generateTimeMarkers(sleepReport, totalMinutes) {
      const markers = [];
      const hours = Math.ceil(totalMinutes / 60);
      
      for (let i = 0; i <= hours; i++) {
        const timeInMinutes = i * 60;
        const position = (timeInMinutes / totalMinutes) * 100;
        
        if (position <= 100) {
          const hours = Math.floor(timeInMinutes / 60);
          const minutes = timeInMinutes % 60;
          const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
          
          markers.push({
            time: timeStr,
            position: position
          });
        }
      }
      
      return markers;
    },

    /**
     * 創建 ECharts 配置
     */
    createEChartsConfig(sleepReport, sleepDurationMinutes) {
      console.log('創建 ECharts 配置 - sleepReport:', sleepReport, 'sleepDurationMinutes:', sleepDurationMinutes);
      
      // 預先生成圖表數據
      const chartData = this.generateChartData(sleepReport, sleepDurationMinutes);
      console.log('預生成的圖表數據:', chartData);
      
      // 檢查圖表數據是否有效
      if (!chartData.series || chartData.series.length === 0) {
        console.warn('圖表數據為空，無法創建 ECharts 配置');
        return null;
      }
      
      console.log('準備返回 ECharts 配置對象');
      const config = {
        onInit: (canvas, width, height, dpr) => {
          console.log('ECharts 多行塊狀圖初始化 - canvas:', canvas, 'width:', width, 'height:', height);
          
          // 檢查 canvas 是否存在
          if (!canvas) {
            console.warn('Canvas 為空，無法初始化圖表');
            return null;
          }
          
          try {
            console.log('開始初始化 ECharts，參數:', { width, height, dpr });
            const chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
            console.log('ECharts 實例創建成功:', chart);
            canvas.setChart(chart);
            console.log('Canvas 設置完成');
            
            // 使用簡單的測試圖表配置
            const option = {
              backgroundColor: 'transparent',
              grid: {
                left: '5%',
                right: '5%',
                top: '5%',
                bottom: '15%',
                containLabel: true
              },
              xAxis: {
                type: 'category',
                data: chartData.categories,
                axisLabel: {
                  color: '#fff',
                  fontSize: 10,
                  interval: 'auto'
                },
                axisLine: {
                  show: false
                },
                axisTick: {
                  show: false
                }
              },
              yAxis: {
                type: 'value',
                show: false
              },
              series: [{
                type: 'bar',
                data: chartData.categories.map((_, index) => Math.random() * 100),
                itemStyle: {
                  color: '#5e7fff'
                },
                name: '睡眠階段'
              }],
              tooltip: {
                trigger: 'item',
                formatter: function(params) {
                  return params.name + ': ' + params.value + '分鐘';
                }
              }
            };
            
            console.log('設置 ECharts 選項:', option);
            chart.setOption(option);
            
            // 強制重新渲染
            setTimeout(() => {
              chart.resize();
            }, 100);
            
            return chart;
          } catch (error) {
            console.error('ECharts 初始化失敗:', error);
            return null;
          }
        }
      };
      
      console.log('ECharts 配置對象創建完成:', config);
      return config;
    },

    /**
     * 生成圖表數據
     */
    generateChartData(sleepReport, sleepDurationMinutes) {
      console.log('生成圖表數據 - sleepReport:', sleepReport, 'sleepDurationMinutes:', sleepDurationMinutes);
      
      if (!sleepReport || sleepReport.length === 0) {
        console.log('sleepReport 為空，返回空數據');
        return { categories: [], series: [] };
      }
      
      // 生成時間軸數據 - 根據實際睡眠時長生成
      const categories = [];
      const timeInterval = sleepDurationMinutes / 20; // 分成20個時間段
      for (let i = 0; i <= 20; i++) {
        const timeInMinutes = i * timeInterval;
        const hour = Math.floor(timeInMinutes / 60);
        const minute = Math.floor(timeInMinutes % 60);
        categories.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
      }
      
      // 定義階段配置
      const stageConfigs = [
        { name: '离床', color: '#FF6B6B', state: 5 },
        { name: '清醒', color: '#FFA07A', state: 4 },
        { name: '浅睡', color: '#87CEEB', state: 3 },
        { name: '深睡', color: '#4169E1', state: 1 }
      ];
      
      const series = [];
      
      // 為每個階段生成數據
      stageConfigs.forEach((config, stageIndex) => {
        const data = [];
        let currentTime = 0;
        
        // 遍歷所有睡眠報告項目，按時間順序處理
        sleepReport.forEach((item, index) => {
          console.log(`處理項目 ${index}:`, item, `state: ${item.state}, 匹配階段: ${config.state}`);
          
          if (item.state === config.state) {
            const dataItem = {
              value: item.value,
              name: config.name,
              startTime: this.formatTimeFromMinutes(currentTime),
              endTime: this.formatTimeFromMinutes(currentTime + item.value),
              duration: item.value,
              itemStyle: {
                color: config.color
              }
            };
            
            data.push(dataItem);
            console.log(`添加 ${config.name} 數據塊:`, dataItem);
          }
          // 累計時間（所有項目都累計，不只是當前階段）
          currentTime += item.value;
        });
        
        console.log(`階段 ${config.name} 最終數據:`, data);
        
        // 使用簡單的柱狀圖
        series.push({
          type: 'bar',
          name: config.name,
          data: data,
          stack: 'sleep',
          barWidth: '60%'
        });
      });
      
      console.log('最終圖表數據:', { categories, series });
      return { categories, series };
    },

    /**
     * 從分鐘數格式化時間
     */
    formatTimeFromMinutes(minutes) {
      const hours = Math.floor(minutes / 60);
      const mins = Math.floor(minutes % 60);
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }
  }
});