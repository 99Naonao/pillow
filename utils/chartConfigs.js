/**
 * 图表配置工具类
 * 包含所有图表的配置模板和初始化方法
 */

import * as echarts from '../components/ec-canvas/echarts';

class ChartConfigs {
  /**
   * 创建评分圆环图配置
   * @param {number} score 评分
   * @param {string} scoreColor 评分颜色
   * @param {number} remaining 剩余分数
   * @returns {Object} 图表配置
   */
  static createScoreCircleConfig(score, scoreColor, remaining) {
    return {
      onInit: (canvas, width, height, dpr) => {
        console.log('评分圆环图onInit被调用，分数:', score);
        const chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
        canvas.setChart(chart);
        
        const option = {
          backgroundColor: 'transparent',
          series: [{
            type: 'pie',
            radius: ['90%', '100%'],
            silent: true,
            label: { show: false },
            data: [
              { value: score, name: '得分', itemStyle: { color: scoreColor } },
              { value: remaining, name: '空', itemStyle: { color: '#2a223d' } }
            ]
          }],
        };
        
        console.log('评分圆环图配置:', option);
        chart.setOption(option);
        return chart;
      }
    };
  }

  /**
   * 创建睡眠期圆环图配置
   * @param {Object} stageData 睡眠期数据
   * @returns {Object} 图表配置
   */
  static createStagePieConfig(stageData) {
    return {
      onInit: (canvas, width, height, dpr) => {
        console.log('圆环图onInit被调用，数据:', stageData);
        const chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
        canvas.setChart(chart);
        
        // 构建图表数据，只包含非零值
        const chartData = [];
        if (stageData.shallow > 0) chartData.push({ value: stageData.shallow, name: '浅睡期', itemStyle: { color: '#f7c873' } });
        if (stageData.awake > 0) chartData.push({ value: stageData.awake, name: '清醒期', itemStyle: { color: '#e97b7b' } });
        if (stageData.deep > 0) chartData.push({ value: stageData.deep, name: '深睡期', itemStyle: { color: '#5e7fff' } });
        if (stageData.rem > 0) chartData.push({ value: stageData.rem, name: '快速眼动', itemStyle: { color: '#9c27b0' } });
        
        // 如果所有值都为0，显示默认状态
        if (chartData.length === 0) {
          chartData.push({ value: 100, name: '无数据', itemStyle: { color: '#666' } });
        }
        
        console.log('圆环图最终数据:', chartData);
        
        chart.setOption({
          backgroundColor: 'transparent',
          series: [{
            type: 'pie',
            radius: ['100%', '80%'],
            avoidLabelOverlap: false,
            label: { show: false },
            labelLine: { show: false },
            data: chartData
          }]
        });
        return chart;
      }
    };
  }

  
  /**
   * 创建心率趋势图配置
   * @param {Object} chartData 图表数据
   * @returns {Object} 图表配置
   */
  static createHeartTrendConfig(chartData) {
    return {
      onInit: (canvas, width, height, dpr) => {
        console.log('心率图表onInit被调用，数据长度:', chartData.heartRateData.length);
        console.log('心率数据样本:', chartData.heartRateData.slice(0, 10));
        const chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
        canvas.setChart(chart);
        
        // 计算Y轴范围
        const maxHeartRate = Math.max(...chartData.heartRateData);
        const minHeartRate = Math.min(...chartData.heartRateData);
        const yMax = Math.ceil(maxHeartRate * 1.1);
        const yMin = Math.max(0, Math.floor(minHeartRate * 0.9));
        
        const option = {
          backgroundColor: '#231c36',
          grid: { left: 30, right: 20, top: 30, bottom: 30 },
          tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'line' },
            backgroundColor: 'rgba(0,0,0,0.7)',
            textStyle: { color: '#fff' },
            formatter: function(params) {
              const dataIndex = params[0].dataIndex;
              const time = chartData.timeLabels[dataIndex];
              return `时间: ${time}\n心率: ${params[0].value} bpm`;
            }
          },
          xAxis: {
            type: 'category',
            data: chartData.timeLabels,
            axisLine: { lineStyle: { color: '#aaa' } },
            axisLabel: { show: false },
            axisTick: { show: false }
          },
          yAxis: {
            type: 'value',
            min: yMin,
            max: yMax,
            axisLine: { show: false },
            axisLabel: { color: '#aaa' },
            splitLine: { show: false }
          },
          series: [{
            data: chartData.heartRateData,
            type: 'line',
            smooth: true,
            symbol: 'circle',
            symbolSize: 6,
            lineStyle: { color: '#24C9ED', width: 2 },
            areaStyle: { color: 'rgba(36,201,237,0.15)' }
          }]
        };
        
        console.log('心率图表配置:', option);
        chart.setOption(option);
        return chart;
      }
    };
  }

  /**
   * 创建呼吸率趋势图配置
   * @param {Object} chartData 图表数据
   * @returns {Object} 图表配置
   */
  static createBreathTrendConfig(chartData) {
    return {
      onInit: (canvas, width, height, dpr) => {
        console.log('呼吸率图表onInit被调用，数据长度:', chartData.breathRateData.length);
        console.log('呼吸率数据样本:', chartData.breathRateData.slice(0, 10));
        const chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
        canvas.setChart(chart);
        
        // 计算Y轴范围
        const maxBreathRate = Math.max(...chartData.breathRateData);
        const minBreathRate = Math.min(...chartData.breathRateData);
        const yMax = Math.ceil(maxBreathRate * 1.1);
        const yMin = Math.max(0, Math.floor(minBreathRate * 0.9));
        
        const option = {
          backgroundColor: '#231c36',
          grid: { left: 30, right: 20, top: 30, bottom: 30 },
          tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'line' },
            backgroundColor: 'rgba(0,0,0,0.7)',
            textStyle: { color: '#fff' },
            formatter: function(params) {
              const dataIndex = params[0].dataIndex;
              const time = chartData.timeLabels[dataIndex];
              return `时间: ${time}\n呼吸率: ${params[0].value} 次/分`;
            }
          },
          xAxis: {
            type: 'category',
            data: chartData.timeLabels,
            axisLine: { lineStyle: { color: '#aaa' } },
            axisLabel: { show: false },
            axisTick: { show: false }
          },
          yAxis: {
            type: 'value',
            min: yMin,
            max: yMax,
            axisLine: { show: false },
            axisLabel: { color: '#aaa' },
            splitLine: { show: false }
          },
          series: [{
            data: chartData.breathRateData,
            type: 'line',
            smooth: true,
            symbol: 'circle',
            symbolSize: 6,
            lineStyle: { color: '#7adfa0', width: 2 },
            areaStyle: { color: 'rgba(122,223,160,0.15)' }
          }]
        };
        
        console.log('呼吸率图表配置:', option);
        chart.setOption(option);
        return chart;
      }
    };
  }

  /**
   * 创建体动趋势图配置
   * @param {Object} chartData 图表数据
   * @returns {Object} 图表配置
   */
  static createBodyMoveTrendConfig(chartData) {
    return {
      onInit: (canvas, width, height, dpr) => {
        console.log('体动图表onInit被调用，数据长度:', chartData.bodyMoveData.length);
        console.log('体动数据样本:', chartData.bodyMoveData.slice(0, 10));
        const chart = echarts.init(canvas, null, { width, height, devicePixelRatio: dpr });
        canvas.setChart(chart);
        
        // 计算Y轴范围
        const maxBodyMove = Math.max(...chartData.bodyMoveData);
        const minBodyMove = Math.min(...chartData.bodyMoveData);
        const yMax = Math.ceil(maxBodyMove * 1.1);
        const yMin = Math.max(0, Math.floor(minBodyMove * 0.9));
        
        const option = {
          backgroundColor: '#0B2853',
          grid: { left: 30, right: 20, top: 30, bottom: 30 },
          tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'line' },
            backgroundColor: 'rgba(0,0,0,0.7)',
            textStyle: { color: '#fff' },
            formatter: function(params) {
              const dataIndex = params[0].dataIndex;
              const time = chartData.timeLabels[dataIndex];
              return `时间: ${time}\n体动: ${params[0].value} 次`;
            }
          },
          xAxis: {
            type: 'category',
            data: chartData.timeLabels,
            axisLine: { lineStyle: { color: '#aaa' } },
            axisLabel: { show: false },
            axisTick: { show: false }
          },
          yAxis: {
            type: 'value',
            min: yMin,
            max: yMax,
            axisLine: { show: false },
            axisLabel: { color: '#aaa' },
            splitLine: { show: false }
          },
          series: [{
            data: chartData.bodyMoveData,
            type: 'line',
            smooth: true,
            symbol: 'circle',
            symbolSize: 6,
            lineStyle: { color: '#f7c873', width: 2 },
            areaStyle: { color: 'rgba(247,200,115,0.15)' }
          }]
        };
        
        console.log('体动图表配置:', option);
        chart.setOption(option);
        return chart;
      }
    };
  }

  /**
   * 获取评分颜色
   * @param {number} score 评分
   * @returns {string} 颜色代码
   */
  static getScoreColor(score) {
    if (score >= 80 && score <= 100) {
      return '#00ff00'; // 优秀 - 绿色
    } else if (score >= 70 && score < 80) {
      return '#ffff00'; // 良好 - 黄色
    } else if (score >= 60 && score < 70) {
      return '#ffa500'; // 一般 - 橙色
    } else if (score >= 0 && score < 60) {
      return '#ff6347'; // 待改善 - 红色
    } else {
      return '#8b0000'; // 异常数据 - 深红色
    }
  }
}

module.exports = ChartConfigs; 