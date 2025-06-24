/**
 * OpenRouter Rate Limit Monitor - 主要模組入口
 * 
 * 提供可程式化介面，供其他應用程式使用
 */

const RateLimitService = require('./services/RateLimitService');
const ConfigManager = require('./services/ConfigManager');
const HistoryTracker = require('./services/HistoryTracker');
const RequestTracker = require('./services/RequestTracker');

class OpenRouterMonitor {
  constructor(options = {}) {
    this.config = new ConfigManager(options.configPath);
    this.rateLimitService = new RateLimitService(this.config);
    this._historyTracker = null;
    this.requestTracker = new RequestTracker(options.requestTrackerPath);
  }

  /**
   * 獲取歷史追蹤器（延遲初始化）
   */
  get historyTracker() {
    if (!this._historyTracker) {
      this._historyTracker = new HistoryTracker(this.config);
    }
    return this._historyTracker;
  }

  /**
   * 獲取當前 API 狀態（包含本地追蹤的請求數量）
   * @param {Object} options - 選項
   * @param {string} options.apiKey - API Key (可選)
   * @param {boolean} options.refresh - 是否強制重新檢查
   * @returns {Promise<Object>} API 狀態資訊
   */
  async getStatus(options = {}) {
    const status = await this.rateLimitService.getStatus(options);
    
    // 添加本地追蹤的請求數量
    const apiKey = options.apiKey || this.config.get('defaultApiKey') || process.env.OPENROUTER_API_KEY || status.apiKey;
    const todayRequests = this.requestTracker.getTodayRequests(apiKey);
    const dailyLimit = status.limits.daily.limit;
    
    if (dailyLimit) {
      const quotaInfo = this.requestTracker.getQuotaInfo(dailyLimit, apiKey);
      status.limits.daily.localTracked = {
        used: quotaInfo.used,
        remaining: quotaInfo.remaining,
        percentage: quotaInfo.percentage,
        status: quotaInfo.status,
        note: `本地追蹤: 今日已使用 ${quotaInfo.used}/${dailyLimit} 次請求`
      };
    }

    return status;
  }

  /**
   * 獲取詳細的 rate limit 資訊
   * @param {Object} options - 選項
   * @returns {Promise<Object>} Rate limit 詳細資訊
   */
  async getLimits(options = {}) {
    return await this.rateLimitService.getLimits(options);
  }

  /**
   * 開始監控模式
   * @param {Object} options - 監控選項
   * @param {number} options.interval - 檢查間隔（秒）
   * @param {number} options.warnThreshold - 警告閾值（百分比）
   * @param {number} options.alertThreshold - 警報閾值（百分比）
   * @param {Function} options.onStatus - 狀態更新回調
   * @param {Function} options.onWarning - 警告回調
   * @param {Function} options.onAlert - 警報回調
   * @returns {Object} 監控控制物件
   */
  startMonitoring(options = {}) {
    const {
      interval = 60,
      warnThreshold = 80,
      alertThreshold = 95,
      onStatus = () => {},
      onWarning = () => {},
      onAlert = () => {}
    } = options;

    let isRunning = true;
    let timeoutId;

    const check = async () => {
      if (!isRunning) return;

      try {
        const status = await this.getStatus();
        const usage = this.calculateUsagePercentage(status);

        // 記錄歷史（使用 Promise.allSettled 避免記錄失敗影響監控）
        try {
          await this.historyTracker.record(status);
        } catch (historyError) {
          console.warn('歷史記錄儲存失敗:', historyError.message);
        }

        // 安全地觸發回調
        try {
          onStatus(status);
        } catch (callbackError) {
          console.warn('狀態回調執行失敗:', callbackError.message);
        }

        // 觸發警報回調
        try {
          if (usage >= alertThreshold) {
            onAlert(status, usage);
            // 記錄警報
            await this.historyTracker.recordAlert(
              status.apiKey, 
              'alert', 
              `使用率達到警報水準 (${usage}%)`, 
              alertThreshold, 
              usage
            );
          } else if (usage >= warnThreshold) {
            onWarning(status, usage);
            // 記錄警告
            await this.historyTracker.recordAlert(
              status.apiKey, 
              'warning', 
              `使用率達到警告水準 (${usage}%)`, 
              warnThreshold, 
              usage
            );
          }
        } catch (alertError) {
          console.warn('警報處理失敗:', alertError.message);
        }

        // 安排下次檢查
        if (isRunning) {
          timeoutId = setTimeout(() => {
            check().catch(error => {
              console.error('監控循環發生未處理錯誤:', error.message);
            });
          }, interval * 1000);
        }
      } catch (error) {
        console.error('監控檢查失敗:', error.message);
        
        // 在錯誤情況下也要繼續監控，但稍微延長間隔
        if (isRunning) {
          const retryInterval = Math.min(interval * 2, 300); // 最多延長到 5 分鐘
          timeoutId = setTimeout(() => {
            check().catch(error => {
              console.error('監控重試發生錯誤:', error.message);
            });
          }, retryInterval * 1000);
        }
      }
    };

    // 開始監控（使用 Promise 包裝，避免初始化錯誤未處理）
    check().catch(error => {
      console.error('監控初始化失敗:', error.message);
    });

    // 返回控制物件
    return {
      stop: () => {
        isRunning = false;
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      },
      isRunning: () => isRunning
    };
  }

  /**
   * 計算使用率百分比
   * @param {Object} status - API 狀態
   * @returns {number} 使用率百分比
   */
  calculateUsagePercentage(status) {
    if (!status.limits || !status.limits.rate) return 0;
    
    const { used, limit } = status.limits.rate;
    return limit > 0 ? Math.round((used / limit) * 100) : 0;
  }

  /**
   * 獲取使用歷史
   * @param {Object} options - 選項
   * @param {number} options.days - 天數
   * @returns {Promise<Array>} 歷史記錄
   */
  async getHistory(options = {}) {
    return await this.historyTracker.getHistory(options);
  }

  /**
   * 清除歷史記錄
   * @param {Object} options - 選項
   * @returns {Promise<number>} 清除的記錄數
   */
  async clearHistory(options = {}) {
    return await this.historyTracker.clear(options);
  }

  /**
   * 測試 API Key
   * @param {string} apiKey - API Key
   * @returns {Promise<Object>} 測試結果
   */
  async testApiKey(apiKey) {
    return await this.rateLimitService.testApiKey(apiKey);
  }

  /**
   * 記錄一次 API 請求（用於本地追蹤）
   * @param {string} apiKey - API Key
   * @param {string} model - 使用的模型
   */
  recordRequest(apiKey = 'default', model = 'unknown') {
    this.requestTracker.recordRequest(apiKey, model);
  }

  /**
   * 獲取本地追蹤的請求統計
   * @param {Object} options - 選項
   * @returns {Object} 請求統計
   */
  getRequestStats(options = {}) {
    const { days = 7, apiKey = 'default' } = options;
    
    return {
      today: this.requestTracker.getTodayDetailedStats(),
      history: this.requestTracker.getHistoryStats(days),
      todayForKey: this.requestTracker.getTodayRequests(apiKey)
    };
  }
}

module.exports = OpenRouterMonitor;