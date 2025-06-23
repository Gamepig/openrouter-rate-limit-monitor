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
      const response = await axios.get(`${this.baseURL}/auth/key`, {
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      const data = response.data;
      const status = this.formatStatus(data, key);

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
    
    return {
      apiKey: this.maskApiKey(apiKey),
      timestamp: now.toISOString(),
      usage: {
        credits: data.usage || 0,
        limit: data.limit || null,
        unlimited: data.limit === null
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
      health: this.calculateHealth(data),
      lastChecked: now.getTime()
    };
  }

  /**
   * 計算 rate limit 資訊
   * @param {Object} data - API 資料
   * @returns {Object} Rate limit 資訊
   */
  calculateRateLimit(data) {
    // OpenRouter 免費模型每分鐘最多 20 次請求
    const maxPerMinute = 20;
    
    // 這裡需要根據實際的 API 回應調整
    // 目前 OpenRouter 的 /auth/key 端點不直接回傳 rate limit 資訊
    // 所以我們使用預設值和估算
    
    return {
      used: 0, // 需要根據實際情況計算
      limit: maxPerMinute,
      remaining: maxPerMinute,
      resetTime: new Date(Date.now() + 60000).toISOString()
    };
  }

  /**
   * 計算每日限制
   * @param {Object} data - API 資料
   * @returns {Object} 每日限制資訊
   */
  calculateDailyLimit(data) {
    const isFree = data.is_free_tier !== false;
    const hasCredits = data.usage > 10;
    
    // 根據 OpenRouter 文件的限制
    const dailyLimit = isFree ? (hasCredits ? 1000 : 50) : null;
    
    return {
      used: 0, // 需要根據實際使用情況計算
      limit: dailyLimit,
      remaining: dailyLimit ? dailyLimit : null,
      resetTime: this.getNextMidnight().toISOString()
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
}

module.exports = RateLimitService;