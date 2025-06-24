/**
 * 本地請求追蹤器
 * 用於追蹤對 OpenRouter API 的請求數量
 */

const fs = require('fs');
const path = require('path');

class RequestTracker {
  constructor(configPath = null) {
    this.dataFile = configPath || path.join(process.cwd(), '.openrouter-requests.json');
    this.data = this.loadData();
  }

  /**
   * 載入追蹤資料
   */
  loadData() {
    try {
      if (fs.existsSync(this.dataFile)) {
        const content = fs.readFileSync(this.dataFile, 'utf8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.warn('無法載入請求追蹤資料:', error.message);
    }
    
    return {
      dailyRequests: {},
      totalRequests: 0,
      lastReset: new Date().toISOString().split('T')[0] // YYYY-MM-DD
    };
  }

  /**
   * 儲存追蹤資料
   */
  saveData() {
    try {
      fs.writeFileSync(this.dataFile, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.warn('無法儲存請求追蹤資料:', error.message);
    }
  }

  /**
   * 記錄一次請求
   * @param {string} apiKey - API Key（可選）
   * @param {string} model - 使用的模型（可選）
   */
  recordRequest(apiKey = 'default', model = 'unknown') {
    const today = new Date().toISOString().split('T')[0];
    
    // 檢查是否需要重置每日計數
    if (this.data.lastReset !== today) {
      this.resetDailyCounter();
    }

    // 更新計數
    if (!this.data.dailyRequests[today]) {
      this.data.dailyRequests[today] = {};
    }
    
    if (!this.data.dailyRequests[today][apiKey]) {
      this.data.dailyRequests[today][apiKey] = {
        total: 0,
        models: {}
      };
    }

    this.data.dailyRequests[today][apiKey].total++;
    
    if (!this.data.dailyRequests[today][apiKey].models[model]) {
      this.data.dailyRequests[today][apiKey].models[model] = 0;
    }
    this.data.dailyRequests[today][apiKey].models[model]++;
    
    this.data.totalRequests++;
    
    this.saveData();
  }

  /**
   * 重置每日計數器
   */
  resetDailyCounter() {
    const today = new Date().toISOString().split('T')[0];
    this.data.lastReset = today;
    
    // 只保留最近 30 天的資料
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];
    
    for (const date in this.data.dailyRequests) {
      if (date < cutoffDate) {
        delete this.data.dailyRequests[date];
      }
    }
  }

  /**
   * 獲取今日請求數量
   * @param {string} apiKey - API Key（可選）
   * @returns {number} 今日請求數量
   */
  getTodayRequests(apiKey = 'default') {
    const today = new Date().toISOString().split('T')[0];
    
    if (!this.data.dailyRequests[today] || !this.data.dailyRequests[today][apiKey]) {
      return 0;
    }
    
    return this.data.dailyRequests[today][apiKey].total;
  }

  /**
   * 獲取歷史統計
   * @param {number} days - 天數
   * @returns {Object} 歷史統計
   */
  getHistoryStats(days = 7) {
    const stats = {
      totalDays: days,
      totalRequests: 0,
      dailyBreakdown: {},
      averagePerDay: 0
    };

    const today = new Date();
    
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      let dayTotal = 0;
      if (this.data.dailyRequests[dateStr]) {
        for (const apiKey in this.data.dailyRequests[dateStr]) {
          dayTotal += this.data.dailyRequests[dateStr][apiKey].total;
        }
      }
      
      stats.dailyBreakdown[dateStr] = dayTotal;
      stats.totalRequests += dayTotal;
    }
    
    stats.averagePerDay = Math.round(stats.totalRequests / days);
    
    return stats;
  }

  /**
   * 獲取詳細的今日統計
   * @returns {Object} 今日詳細統計
   */
  getTodayDetailedStats() {
    const today = new Date().toISOString().split('T')[0];
    const todayData = this.data.dailyRequests[today] || {};
    
    const stats = {
      date: today,
      totalRequests: 0,
      apiKeys: {},
      models: {}
    };

    for (const apiKey in todayData) {
      const apiData = todayData[apiKey];
      stats.totalRequests += apiData.total;
      stats.apiKeys[apiKey] = apiData.total;
      
      for (const model in apiData.models) {
        if (!stats.models[model]) {
          stats.models[model] = 0;
        }
        stats.models[model] += apiData.models[model];
      }
    }

    return stats;
  }

  /**
   * 清除所有追蹤資料
   */
  clearAllData() {
    this.data = {
      dailyRequests: {},
      totalRequests: 0,
      lastReset: new Date().toISOString().split('T')[0]
    };
    this.saveData();
  }

  /**
   * 估算剩餘每日配額
   * @param {number} dailyLimit - 每日限制
   * @param {string} apiKey - API Key
   * @returns {Object} 配額資訊
   */
  getQuotaInfo(dailyLimit, apiKey = 'default') {
    const used = this.getTodayRequests(apiKey);
    const remaining = Math.max(0, dailyLimit - used);
    const percentage = dailyLimit > 0 ? Math.round((used / dailyLimit) * 100) : 0;
    
    return {
      used: used,
      limit: dailyLimit,
      remaining: remaining,
      percentage: percentage,
      status: percentage > 95 ? 'critical' : percentage > 80 ? 'warning' : 'healthy'
    };
  }
}

module.exports = RequestTracker;