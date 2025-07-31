/**
 * 图表管理器
 * 负责图表的更新和重新渲染
 */

const ChartConfigs = require('./chartConfigs');

class ChartManager {
  constructor(page) {
    this.page = page;
  }

  /**
   * 更新评分圆环图
   * @param {number} score 睡眠评分
   */
  updateScoreCircleChart(score) {
    const remaining = 100 - score;
    const scoreColor = ChartConfigs.getScoreColor(score);
    
    console.log('更新评分圆环图:', { score, scoreColor, remaining });
    
    // 使用闭包保存数据
    const chartData = {
      score: score,
      remaining: remaining,
      scoreColor: scoreColor
    };
    
    // 先清空图表，强制重新渲染
    this.page.setData({
      scoreCircleChart: null
    }, () => {
      console.log('评分圆环图已清空，准备重新设置');
      
      // 延迟一帧后重新设置图表
      setTimeout(() => {
        this.page.setData({
          scoreCircleChart: ChartConfigs.createScoreCircleConfig(
            chartData.score,
            chartData.scoreColor,
            chartData.remaining
          )
        }, () => {
          console.log('评分圆环图配置设置完成');
        });
      }, 50);
    });
  }

  /**
   * 更新睡眠期圆环图
   * @param {Object} stageData 睡眠期数据
   */
  updateStagePieChart(stageData) {
    console.log('初始化睡眠阶段圆环图，当前数据:', stageData);
    
    // 先清空图表，强制重新渲染
    this.page.setData({
      stagePieChart: null
    }, () => {
      console.log('圆环图已清空，准备重新设置');
      
      // 延迟一帧后重新设置图表
      setTimeout(() => {
        this.page.setData({
          stagePieChart: ChartConfigs.createStagePieConfig(stageData)
        }, () => {
          console.log('圆环图配置设置完成');
        });
      }, 50);
    });
  }

  /**
   * 更新趋势图表
   * @param {Object} trendData 趋势数据
   */
  updateTrendCharts(trendData) {
    if (!trendData) {
      console.log('趋势数据为空，跳过更新');
      return;
    }
    
    const { timeLabels, heartRateData, breathRateData, turnData } = trendData;
    
    // 安全检查，确保所有数据都是数组
    const safeTimeLabels = Array.isArray(timeLabels) ? timeLabels : [];
    const safeHeartRateData = Array.isArray(heartRateData) ? heartRateData : [];
    const safeBreathRateData = Array.isArray(breathRateData) ? breathRateData : [];
    const safeTurnData = Array.isArray(turnData) ? turnData : [];
    
    console.log('开始更新趋势图表:', {
      timeLabels: safeTimeLabels.length,
      heartRateData: safeHeartRateData.length,
      breathRateData: safeBreathRateData.length,
      turnData: safeTurnData.length,
      heartRateSample: safeHeartRateData.slice(0, 10),
      breathRateSample: safeBreathRateData.slice(0, 10),
      turnSample: safeTurnData.slice(0, 10)
    });
    
    // 先更新data中的数组数据
    this.page.setData({
      timeLabels: safeTimeLabels,
      heartRateData: safeHeartRateData,
      breathRateData: safeBreathRateData,
      bodyMoveData: safeTurnData
    }, () => {
      console.log('趋势数据已更新到data中');
      console.log('更新后的data数据:', {
        timeLabels: this.page.data.timeLabels.length,
        heartRateData: this.page.data.heartRateData.length,
        breathRateData: this.page.data.breathRateData.length,
        bodyMoveData: this.page.data.bodyMoveData.length
      });
      
      try {
        // 强制重新渲染图表，使用闭包保存数据
        const chartData = {
          timeLabels: safeTimeLabels,
          heartRateData: safeHeartRateData,
          breathRateData: safeBreathRateData,
          bodyMoveData: safeTurnData
        };
        
        console.log('准备设置图表配置，chartData:', chartData);
        
        // 先清空图表，强制重新渲染
        this.page.setData({
          heartTrendChart: null,
          breathTrendChart: null,
          bodyMoveTrendChart: null
        }, () => {
          console.log('图表已清空，准备重新设置');
          
          // 延迟一帧后重新设置图表
          setTimeout(() => {
            this.page.setData({
              heartTrendChart: ChartConfigs.createHeartTrendConfig(chartData),
              breathTrendChart: ChartConfigs.createBreathTrendConfig(chartData),
              bodyMoveTrendChart: ChartConfigs.createBodyMoveTrendConfig(chartData)
            }, () => {
              console.log('图表配置设置完成');
            });
          }, 50);
        });
      } catch (error) {
        console.error('设置图表配置时出错:', error);
      }
    });
  }

  /**
   * 初始化所有图表
   * @param {Object} reportDetail 报告详情
   */
  initAllCharts(reportDetail) {
    // 计算睡眠阶段百分比
    const DataProcessor = require('./dataProcessor');
    const stagePercentages = DataProcessor.calculateSleepStagePercentages(reportDetail);
    
    // 提取趋势数据
    const trendData = DataProcessor.extractTrendData(reportDetail);
    
    // 更新睡眠期圆环图
    this.updateStagePieChart({
      shallow: stagePercentages.lightPercent,
      awake: stagePercentages.awakePercent,
      deep: stagePercentages.deepPercent,
      rem: stagePercentages.remPercent
    });
    
    // 更新评分圆环图
    this.updateScoreCircleChart(reportDetail.sleepScore);
    
    // 更新趋势图表
    this.updateTrendCharts(trendData);
  }
}

module.exports = ChartManager; 