// components/SleepStageChart/sleepStageChart.js
const echarts = require('../../components/ec-canvas/echarts');

Component({
  properties: {
    sleepReport: {
      type: Object,
      value: {}
    }
  },

  lifetimes: {
    attached() {
      console.log('SleepStageChart組件已附加');
    },
    ready() {
      console.log('SleepStageChart組件已準備就緒');
      // 組件準備就緒後，檢查是否有初始數據
      if (this.data.sleepReport && Object.keys(this.data.sleepReport).length > 0) {
        console.log('組件準備就緒時發現有初始數據，觸發處理');
        this.observers['sleepReport'].call(this, this.data.sleepReport);
      }
    }
  },

  data: {
    chartData: {
      startTime: '',
      endTime: '',
      stages: [],
      startAngle: 0 // 起始角度，0度為12點鐘位置
    },
    legendData: [],
    chartConfig: null
  },

  observers: {
    'sleepReport': function(sleepReport) {
      console.log('=== SleepStageChart 數據處理開始 ===');
      console.log('收到sleepReport數據:', sleepReport);
      console.log('sleepReport類型:', typeof sleepReport);
      console.log('sleepReport是否為null:', sleepReport === null);
      console.log('sleepReport是否為undefined:', sleepReport === undefined);
      console.log('sleepReport是否為空對象:', JSON.stringify(sleepReport) === '{}');
      
      if (sleepReport === null || sleepReport === undefined) {
        console.log('sleepReport為null或undefined，顯示空狀態');
        this.setData({
          chartData: {
            startTime: '',
            endTime: '',
            stages: []
          },
          legendData: []
        });
        return;
      }
      
      // 打印完整的數據結構
      console.log('sleepReport完整結構:', JSON.stringify(sleepReport, null, 2));
      
      // 根據實際數據結構，sleepReport字段直接在根級別
      let sleepData = null;
      
      // 首先檢查是否有直接的sleepReport字段
      if (sleepReport && sleepReport.sleepReport && Array.isArray(sleepReport.sleepReport) && sleepReport.sleepReport.length > 0) {
        console.log('使用sleepReport字段數據:', sleepReport.sleepReport);
        sleepData = sleepReport.sleepReport;
      }
      
      // 檢查LeftData字段（注意大小寫）
      if (!sleepData && sleepReport && sleepReport.LeftData) {
        console.log('找到LeftData字段:', sleepReport.LeftData);
        if (sleepReport.LeftData.sleep_report && sleepReport.LeftData.sleep_report.length > 0) {
          console.log('使用LeftData.sleep_report數據:', sleepReport.LeftData.sleep_report);
          sleepData = sleepReport.LeftData.sleep_report;
        } else if (Array.isArray(sleepReport.LeftData) && sleepReport.LeftData.length > 0) {
          console.log('使用LeftData數組數據:', sleepReport.LeftData);
          sleepData = sleepReport.LeftData;
        }
      }
      
      // 檢查rightData字段
      if (!sleepData && sleepReport && sleepReport.rightData) {
        console.log('找到rightData字段:', sleepReport.rightData);
        if (sleepReport.rightData.sleep_report && sleepReport.rightData.sleep_report.length > 0) {
          console.log('使用rightData.sleep_report數據:', sleepReport.rightData.sleep_report);
          sleepData = sleepReport.rightData.sleep_report;
        } else if (Array.isArray(sleepReport.rightData) && sleepReport.rightData.length > 0) {
          console.log('使用rightData數組數據:', sleepReport.rightData);
          sleepData = sleepReport.rightData;
        }
      }
      
      // 檢查left字段（小寫）
      if (!sleepData && sleepReport && sleepReport.left) {
        console.log('找到left字段:', sleepReport.left);
        if (sleepReport.left.sleep_report && sleepReport.left.sleep_report.length > 0) {
          console.log('使用left.sleep_report數據:', sleepReport.left.sleep_report);
          sleepData = sleepReport.left.sleep_report;
        } else if (Array.isArray(sleepReport.left) && sleepReport.left.length > 0) {
          console.log('使用left數組數據:', sleepReport.left);
          sleepData = sleepReport.left;
        }
      }
      
      // 檢查right字段（小寫）
      if (!sleepData && sleepReport && sleepReport.right) {
        console.log('找到right字段:', sleepReport.right);
        if (sleepReport.right.sleep_report && sleepReport.right.sleep_report.length > 0) {
          console.log('使用right.sleep_report數據:', sleepReport.right.sleep_report);
          sleepData = sleepReport.right.sleep_report;
        } else if (Array.isArray(sleepReport.right) && sleepReport.right.length > 0) {
          console.log('使用right數組數據:', sleepReport.right);
          sleepData = sleepReport.right;
        }
      }
      
      // 最後檢查是否直接是數組
      if (!sleepData && sleepReport && Array.isArray(sleepReport) && sleepReport.length > 0) {
        console.log('直接使用數組數據:', sleepReport);
        sleepData = sleepReport;
      }
      
      if (sleepData) {
        console.log('最終使用的sleepData:', sleepData);
        // 先清空圖表配置，強制重新渲染
        this.setData({
          chartConfig: null
        }, () => {
          // 延遲一幀後重新設置圖表
          setTimeout(() => {
            this.processSleepData(sleepData);
          }, 50);
        });
      } else {
        console.log('沒有找到有效的睡眠數據');
        console.log('sleepReport的所有鍵:', Object.keys(sleepReport || {}));
        // 清空數據
        this.setData({
          chartData: {
            startTime: '',
            endTime: '',
            stages: []
          },
          legendData: [],
          chartConfig: null
        });
      }
      
      console.log('=== SleepStageChart 數據處理結束 ===');
    }
  },

  methods: {
    processSleepData(sleepReport) {
      console.log('=== processSleepData 開始 ===');
      console.log('sleepReport:', sleepReport);
      console.log('sleepReport長度:', sleepReport ? sleepReport.length : 'undefined');
      
      if (!sleepReport || sleepReport.length === 0) {
        console.log('sleepReport為空或長度為0，退出處理');
        this.setData({
          chartData: {
            startTime: '',
            endTime: '',
            stages: []
          },
          legendData: [],
          chartConfig: null
        });
        return;
      }

      // 計算總時長和各階段時長
      let totalDuration = 0;
      const stageDurations = {
        1: 0, // 深睡
        2: 0, // 中睡（快速眼動）
        3: 0, // 浅睡  
        4: 0, // 清醒
        5: 0  // 离床
      };

      // 獲取開始和結束時間
      const startTime = sleepReport[0].start_time;
      const endTime = sleepReport[sleepReport.length - 1].end_time;

      console.log('開始時間:', startTime);
      console.log('結束時間:', endTime);

      // 計算開始時間對應的角度（12小時制）
      const startTimeDate = new Date(startTime);
      const startHour = startTimeDate.getHours();
      const startMinute = startTimeDate.getMinutes();
      const startAngle = ((startHour % 12) * 60 + startMinute) / (12 * 60) * 360; // 12小時制角度計算
      
      console.log('開始時間角度計算:', {
        startTime: startTime,
        startHour: startHour,
        startMinute: startMinute,
        startAngle: startAngle,
        expectedPosition: `${startHour}:${startMinute.toString().padStart(2, '0')}`
      });

      // 計算各階段時長（分鐘）
      sleepReport.forEach((item, index) => {
        console.log(`處理第${index}項數據:`, item);
        const duration = item.value; // 分鐘
        totalDuration += duration;
        if (stageDurations.hasOwnProperty(item.state)) {
          stageDurations[item.state] += duration;
        }
        console.log(`狀態${item.state}增加${duration}分鐘`);
      });

      console.log('睡眠數據處理結果:', {
        totalDuration,
        stageDurations,
        startTime,
        endTime
      });

      // 轉換為小時
      const stageHours = {
        1: (stageDurations[1] / 60).toFixed(1),
        2: (stageDurations[2] / 60).toFixed(1),
        3: (stageDurations[3] / 60).toFixed(1),
        4: (stageDurations[4] / 60).toFixed(1),
        5: (stageDurations[5] / 60).toFixed(1)
      };

      // 生成CSS圓環分段數據
      const stages = this.createCSSStages(sleepReport, totalDuration);
      
      // 生成動態的conic-gradient
      const conicGradient = this.generateConicGradient(sleepReport, totalDuration);

      // 生成圖例數據（只顯示有數據的階段）
      const legendData = [];
      
      if (stageHours[1] > 0) {
        legendData.push({
          name: '深睡',
          duration: stageHours[1] + '小时',
          color: '#5e7fff' // 與圖例一致
        });
      }
      
      if (stageHours[2] > 0) {
        legendData.push({
          name: '中睡',
          duration: stageHours[2] + '小时',
          color: '#9c27b0' // 與圖例一致
        });
      }
      
      if (stageHours[3] > 0) {
        legendData.push({
          name: '浅睡', 
          duration: stageHours[3] + '小时',
          color: '#f7c873' // 與圖例一致
        });
      }
      
      if (stageHours[4] > 0) {
        legendData.push({
          name: '清醒',
          duration: stageHours[4] + '小时', 
          color: '#e97b7b' // 與圖例一致
        });
      }
      
      if (stageHours[5] > 0) {
        legendData.push({
          name: '离床',
          duration: stageHours[5] + '小时', 
          color: '#666666' // 灰色
        });
      }

      // 計算結束時間的實際角度位置（12小時制）
      const endTimeDate = new Date(endTime);
      const endHour = endTimeDate.getHours();
      const endMinute = endTimeDate.getMinutes();
      const endAngle = ((endHour % 12) * 60 + endMinute) / (12 * 60) * 360;
      
      console.log('角度計算結果:', {
        startAngle: startAngle,
        endAngle: endAngle,
        totalDuration: totalDuration,
        startTime: startTime,
        endTime: endTime,
        startHour: startHour,
        startMinute: startMinute,
        endHour: endHour,
        endMinute: endMinute
      });
      
      this.setData({
        chartData: {
          startTime: this.formatTime(startTime),
          endTime: this.formatTime(endTime),
          stages: stages,
          conicGradient: conicGradient,
          startAngle: startAngle, // 添加開始角度
          endAngle: endAngle
        },
        legendData,
        chartConfig: null
      });
    },

    createCSSStages(sleepReport, totalDuration) {
      console.log('=== createCSSStages 開始 ===');
      const stages = [];
      // 從實際睡眠開始時間計算的起始角度
      const startTime = sleepReport[0].start_time;
      const startTimeDate = new Date(startTime);
      const startHour = startTimeDate.getHours();
      const startMinute = startTimeDate.getMinutes();
      const startAngle = ((startHour % 12) * 60 + startMinute) / (12 * 60) * 360;
      let currentAngle = startAngle; // 從實際睡眠開始時間角度開始
      
      sleepReport.forEach((item, index) => {
        const duration = item.value; // 分鐘
        const angle = (duration / (12 * 60)) * 360; // 12小時制，每分鐘對應的角度
        const endAngle = currentAngle + angle;
        
        stages.push({
          color: this.getStageColor(item.state),
          startAngle: currentAngle,
          endAngle: endAngle,
          duration: duration,
          state: item.state
        });
        
        currentAngle = endAngle;
      });
      
      console.log('生成的12小時制CSS分段數據:', stages);
      return stages;
    },

    generateConicGradient(sleepReport, totalDuration) {
      console.log('=== generateConicGradient 開始 ===');
      // 從實際睡眠開始時間計算的起始角度
      const startTime = sleepReport[0].start_time;
      const startTimeDate = new Date(startTime);
      const startHour = startTimeDate.getHours();
      const startMinute = startTimeDate.getMinutes();
      const startAngle = ((startHour % 12) * 60 + startMinute) / (12 * 60) * 360;
      
      // 計算結束時間的實際角度位置
      const endTime = sleepReport[sleepReport.length - 1].end_time;
      const endTimeDate = new Date(endTime);
      const endHour = endTimeDate.getHours();
      const endMinute = endTimeDate.getMinutes();
      const endAngle = ((endHour % 12) * 60 + endMinute) / (12 * 60) * 360;
      
      console.log('conic-gradient角度計算:', {
        startTime: startTime,
        endTime: endTime,
        startAngle: startAngle,
        endAngle: endAngle,
        totalDuration: totalDuration
      });
      
      // 生成睡眠階段的漸變，直接對應時間範圍
      const gradientParts = [];
      let currentAngle = startAngle;
      
      sleepReport.forEach((item, index) => {
        const duration = item.value; // 分鐘
        const angle = (duration / (12 * 60)) * 360; // 12小時制，每分鐘對應的角度
        const itemEndAngle = currentAngle + angle;
        const color = this.getStageColor(item.state);
        
        console.log(`睡眠階段${index}:`, {
          state: item.state,
          duration: duration,
          angle: angle,
          currentAngle: currentAngle,
          itemEndAngle: itemEndAngle,
          color: color
        });
        
        gradientParts.push(`${color} ${currentAngle}deg ${itemEndAngle}deg`);
        currentAngle = itemEndAngle;
      });
      
      // 添加剩餘時間的黑色部分
      // 先從0度到開始角度
      if (startAngle > 0) {
        gradientParts.unshift(`#333 0deg ${startAngle}deg`);
      }
      
      // 再從結束角度到360度
      if (endAngle < 360) {
        gradientParts.push(`#333 ${endAngle}deg 360deg`);
      }
      
      // 使用from 0deg，讓漸變從12點鐘位置開始
      const gradient = `conic-gradient(from 0deg, ${gradientParts.join(', ')})`;
      console.log('生成的12小時制conic-gradient:', gradient);
      return gradient;
    },

    createChartConfig(sleepReport, totalDuration) {
      console.log('=== createChartConfig 開始 ===');
      console.log('sleepReport:', sleepReport);
      console.log('totalDuration:', totalDuration);

      // 生成ECharts pie圖數據
      const pieData = sleepReport.map((item, index) => {
        const duration = item.value; // 分鐘
        const percentage = ((duration / totalDuration) * 100).toFixed(1);
        
        const stageNames = {
          1: '深睡',
          2: '中睡',
          3: '浅睡',
          4: '清醒',
          5: '离床'
        };

        return {
          value: duration,
          name: stageNames[item.state] || '未知',
          itemStyle: {
            color: this.getStageColor(item.state)
          },
          // 保存原始數據用於點擊事件
          originalData: {
            state: item.state,
            duration: duration,
            startTime: this.formatTime(item.start_time),
            endTime: this.formatTime(item.end_time)
          }
        };
      });

      console.log('生成的pieData:', pieData);

      return {
        onInit: (canvas, width, height, dpr) => {
          console.log('睡眠階段圓環圖onInit被調用');
          console.log('Canvas尺寸:', width, height);
          // 強制設置固定尺寸
          const chartWidth = 300;
          const chartHeight = 300;
          console.log('實際使用的圖表尺寸:', chartWidth, chartHeight);
          const chart = echarts.init(canvas, null, { width: chartWidth, height: chartHeight, devicePixelRatio: dpr });
          canvas.setChart(chart);
          
          const option = {
            backgroundColor: 'transparent',
            series: [{
              type: 'pie',
              radius: ['80%', '100%'], // 圓環效果
              center: ['50%', '50%'],
              startAngle: 0, // 從0度開始（12點位置）
              silent: true, // 禁用點擊
              label: { 
                show: false,
                formatter: '' // 強制設置為空字符串
              },
              labelLine: {
                show: false
              },
              data: pieData,
              emphasis: {
                itemStyle: {
                  shadowBlur: 10,
                  shadowOffsetX: 0,
                  shadowColor: 'rgba(0, 0, 0, 0.5)'
                }
              }
            }],
            tooltip: {
              show: false // 完全禁用tooltip
            }
          };

          // 添加分界線標記 - 根據圖片效果
          option.graphic = [
            // 開始位置標記線 (12點位置)
            {
              type: 'line',
              shape: {
                x1: '50%',
                y1: '10%',
                x2: '50%',
                y2: '5%',
                stroke: '#fff',
                lineWidth: 2
              },
              z: 100
            },
            // 結束位置標記線 (6點位置)
            {
              type: 'line',
              shape: {
                x1: '50%',
                y1: '90%',
                x2: '50%',
                y2: '95%',
                stroke: '#fff',
                lineWidth: 2
              },
              z: 100
            },
            // 開始時間標籤 (頂部)
            {
              type: 'text',
              left: '50%',
              top: '1%',
              style: {
                text: this.data.chartData.startTime || '10:32',
                fontSize: 12,
                fill: '#fff',
                textAlign: 'center',
                textVerticalAlign: 'middle'
              },
              z: 100
            },
            // 結束時間標籤 (右下角)
            {
              type: 'text',
              left: '70%',
              top: '80%',
              style: {
                text: this.data.chartData.endTime || '06:00',
                fontSize: 12,
                fill: '#fff',
                textAlign: 'center',
                textVerticalAlign: 'middle'
              },
              z: 100
            }
          ];
          
          console.log('睡眠階段圓環圖配置:', option);
          chart.setOption(option);
          
          // 點擊事件已禁用
          
          return chart;
        }
      };
    },

    getStageColor(state) {
      const colors = {
        1: '#5e7fff', // 深睡 - 與圖例一致
        2: '#9c27b0', // 中睡（快速眼動）- 與圖例一致
        3: '#f7c873', // 浅睡 - 與圖例一致
        4: '#e97b7b', // 清醒 - 與圖例一致
        5: '#666666'  // 离床 - 灰色
      };
      return colors[state] || '#666';
    },

    formatTime(timeString) {
      const date = new Date(timeString);
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    },

    // 手動更新方法
    updateChart() {
      console.log('手動更新圖表');
      const sleepReport = this.data.sleepReport;
      if (sleepReport && Object.keys(sleepReport).length > 0) {
        this.observers['sleepReport'].call(this, sleepReport);
      }
    },

    // 設置起始角度
    setStartAngle(angle) {
      console.log('設置起始角度:', angle);
      this.setData({
        'chartData.startAngle': angle
      }, () => {
        // 重新生成圖表
        this.updateChart();
      });
    },

    // 根據睡眠開始時間計算起始角度
    calculateStartAngle(startTime) {
      const startTimeDate = new Date(startTime);
      const startHour = startTimeDate.getHours();
      const startMinute = startTimeDate.getMinutes();
      return ((startHour % 12) * 60 + startMinute) / (12 * 60) * 360;
    }

  }
});
