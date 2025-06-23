/**
 * OpenRouter Rate Limit Service
 * 處理與 OpenRouter API 的通訊和 rate limit 檢查
 */

const axios = require('axios');

class RateLimitService {
  constructor(configManager) {
    this.config = configManager;
    this.baseURL = 'https://openrouter.ai/api/v1';
    this.cache = new Map();
    this.cacheTimeout = 30000; // 30秒快取
  }

  /**
   * 獲取 API 狀態
   * @param {Object} options - 選項
   * @returns {Promise<Object>} API 狀態
   */
  async getStatus(options = {}) {
    const { apiKey, refresh = false } = options;
    const key = apiKey || this.config.get('defaultApiKey') || process.env.OPENROUTER_API_KEY;
    
    if (!key) {
      throw new Error('未設定 API Key。請使用 keys add 指令或設定環境變數 OPENROUTER_API_KEY');
    }

    const cacheKey = `status:${key}`;
    
    // 檢查快取
    if (!refresh && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      // 並行獲取認證資訊和額度資訊
      const [authResponse, creditsResponse] = await Promise.all([
        axios.get(`${this.baseURL}/auth/key`, {
          headers: {
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }),
        axios.get(`${this.baseURL}/credits`, {
          headers: {
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        })
      ]);

      const authData = authResponse.data.data;
      const creditsData = creditsResponse.data.data;
      
      // 合併資料
      const combinedData = {
        ...authData,
        credits: creditsData
      };
      
      const status = this.formatStatus(combinedData, key);

      // 更新快取
      this.cache.set(cacheKey, {
        data: status,
        timestamp: Date.now()
      });

      return status;
    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.error || error.message;
        
        if (status === 401) {
          throw new Error(`API Key 無效或已過期: ${message}`);
        } else if (status === 429) {
          throw new Error(`Rate limit 已達上限: ${message}`);
        } else if (status >= 500) {
          throw new Error(`OpenRouter 伺服器錯誤 (${status}): ${message}`);
        } else {
          throw new Error(`API 請求失敗 (${status}): ${message}`);
        }
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('請求超時，請檢查網路連線');
      } else {
        throw new Error(`網路錯誤: ${error.message}`);
      }
    }
  }

  /**
   * 獲取詳細的 rate limit 資訊
   * @param {Object} options - 選項
   * @returns {Promise<Object>} 詳細的 rate limit 資訊
   */
  async getLimits(options = {}) {
    const status = await this.getStatus(options);
    return {
      ...status,
      details: this.analyzeLimits(status)
    };
  }

  /**
   * 測試 API Key
   * @param {string} apiKey - API Key
   * @returns {Promise<Object>} 測試結果
   */
  async testApiKey(apiKey) {
    try {
      const status = await this.getStatus({ apiKey, refresh: true });
      return {
        valid: true,
        status: status,
        message: 'API Key 有效'
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
        message: 'API Key 無效'
      };
    }
  }

  /**
   * 格式化狀態資料
   * @param {Object} data - API 回應資料
   * @param {string} apiKey - API Key
   * @returns {Object} 格式化的狀態
   */
  formatStatus(data, apiKey) {
    const now = new Date();
    
    // 處理額度資訊
    const creditsInfo = data.credits || {};
    const totalCredits = creditsInfo.total_credits || 0;
    const totalUsage = creditsInfo.total_usage || 0;
    const remainingCredits = totalCredits - totalUsage;
    
    return {
      apiKey: this.maskApiKey(apiKey),
      timestamp: now.toISOString(),
      usage: {
        credits: totalUsage,
        total_credits: totalCredits,
        remaining_credits: remainingCredits,
        limit: data.limit || null,
        unlimited: data.limit === null,
        note: this.generateCreditsNote(totalCredits, totalUsage, remainingCredits, data.is_free_tier)
      },
      tier: {
        isFree: data.is_free_tier !== false,
        name: data.is_free_tier !== false ? 'Free' : 'Paid'
      },
      limits: {
        rate: this.calculateRateLimit(data),
        daily: this.calculateDailyLimit(data),
        monthly: this.calculateMonthlyLimit(data)
      },
      health: this.calculateHealth({ 
        ...data, 
        usage: totalUsage, 
        total_credits: totalCredits 
      }),
      lastChecked: now.getTime()
    };
  }

  /**
   * 計算 rate limit 資訊
   * @param {Object} data - API 資料
   * @returns {Object} Rate limit 資訊
   */
  calculateRateLimit(data) {
    // 使用 OpenRouter API 實際回傳的 rate_limit 資訊
    const rateLimit = data.rate_limit || {};
    const requests = rateLimit.requests || 20; // 預設值
    const interval = rateLimit.interval || '60s'; // 預設值
    
    // 解析間隔時間
    const intervalMs = this.parseInterval(interval);
    const resetTime = new Date(Date.now() + intervalMs);
    
    return {
      used: 0, // API 沒有提供已使用數量，設為 0
      limit: requests,
      remaining: requests,
      resetTime: resetTime.toISOString(),
      interval: interval
    };
  }

  /**
   * 計算每日限制
   * @param {Object} data - API 資料
   * @returns {Object} 每日限制資訊
   */
  calculateDailyLimit(data) {
    const isFree = data.is_free_tier !== false;
    const creditsInfo = data.credits || {};
    const totalCredits = creditsInfo.total_credits || 0;
    
    // 根據 OpenRouter 官方文件：
    // - 購買至少 10 額度：免費模型每日 1000 次請求
    // - 未購買 10 額度：免費模型每日 50 次請求  
    // - 付費帳戶：通常無每日限制
    let dailyLimit = null;
    
    if (isFree) {
      dailyLimit = totalCredits >= 10 ? 1000 : 50;
    }
    
    return {
      used: 0, // API 沒有提供當日使用量
      limit: dailyLimit,
      remaining: dailyLimit ? dailyLimit : null,
      resetTime: this.getNextMidnight().toISOString(),
      note: isFree ? 
        (totalCredits >= 10 ? '已購買10+額度，享有1000次/日' : '未購買10額度，限制50次/日') :
        '付費帳戶無每日限制'
    };
  }

  /**
   * 計算每月限制
   * @param {Object} data - API 資料
   * @returns {Object} 每月限制資訊
   */
  calculateMonthlyLimit(data) {
    return {
      used: data.usage || 0,
      limit: data.limit,
      remaining: data.limit ? data.limit - (data.usage || 0) : null,
      resetTime: this.getNextMonthStart().toISOString()
    };
  }

  /**
   * 計算健康狀態
   * @param {Object} data - API 資料
   * @returns {Object} 健康狀態
   */
  calculateHealth(data) {
    const usage = data.usage || 0;
    const limit = data.limit;
    
    let status = 'healthy';
    let percentage = 0;
    
    if (limit && limit > 0) {
      percentage = Math.round((usage / limit) * 100);
      
      if (percentage >= 95) {
        status = 'critical';
      } else if (percentage >= 80) {
        status = 'warning';
      }
    }
    
    return {
      status,
      percentage,
      message: this.getHealthMessage(status, percentage)
    };
  }

  /**
   * 分析限制資訊
   * @param {Object} status - 狀態資訊
   * @returns {Object} 分析結果
   */
  analyzeLimits(status) {
    const analysis = {
      riskLevel: 'low',
      recommendations: [],
      predictions: {}
    };

    // 分析 rate limit 風險
    if (status.limits.rate.used / status.limits.rate.limit > 0.8) {
      analysis.riskLevel = 'high';
      analysis.recommendations.push('建議降低請求頻率或等待 rate limit 重置');
    }

    // 分析每日限制風險
    if (status.limits.daily.limit && 
        status.limits.daily.used / status.limits.daily.limit > 0.8) {
      analysis.riskLevel = 'high';
      analysis.recommendations.push('今日配額即將用完，建議明天再進行大量請求');
    }

    return analysis;
  }

  /**
   * 遮蔽 API Key
   * @param {string} apiKey - API Key
   * @returns {string} 遮蔽後的 API Key
   */
  maskApiKey(apiKey) {
    if (!apiKey || apiKey.length < 12) return '****';
    return apiKey.substring(0, 8) + '****' + apiKey.substring(apiKey.length - 4);
  }

  /**
   * 獲取健康狀態訊息
   * @param {string} status - 狀態
   * @param {number} percentage - 使用率
   * @returns {string} 訊息
   */
  getHealthMessage(status, percentage) {
    switch (status) {
      case 'healthy':
        return `系統運作正常 (${percentage}% 使用率)`;
      case 'warning':
        return `使用率偏高 (${percentage}%)，建議注意`;
      case 'critical':
        return `使用率過高 (${percentage}%)，需要立即處理`;
      default:
        return '狀態未知';
    }
  }

  /**
   * 獲取下個午夜時間
   * @returns {Date} 下個午夜
   */
  getNextMidnight() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }

  /**
   * 獲取下個月開始時間
   * @returns {Date} 下個月開始
   */
  getNextMonthStart() {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    nextMonth.setHours(0, 0, 0, 0);
    return nextMonth;
  }

  /**
   * 解析時間間隔字串
   * @param {string} interval - 間隔字串 (例如: "10s", "1m", "1h")
   * @returns {number} 間隔毫秒數
   */
  parseInterval(interval) {
    const match = interval.match(/^(\d+)([smhd])$/);
    if (!match) return 60000; // 預設 1 分鐘

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 60000;
    }
  }

  /**
   * 生成額度說明文字
   * @param {number} totalCredits - 總額度
   * @param {number} totalUsage - 已使用額度
   * @param {number} remainingCredits - 剩餘額度
   * @param {boolean} isFree - 是否為免費帳戶
   * @returns {string} 說明文字
   */
  generateCreditsNote(totalCredits, totalUsage, remainingCredits, isFree) {
    if (isFree) {
      if (totalCredits >= 10) {
        return `剩餘 $${remainingCredits.toFixed(2)} (免費帳戶，已購買10+額度)`;
      } else {
        return `剩餘 $${remainingCredits.toFixed(2)} (免費帳戶，建議購買10額度提升限制)`;
      }
    } else {
      return `剩餘 $${remainingCredits.toFixed(2)} (付費帳戶)`;
    }
  }
}

module.exports = RateLimitService;