/**
 * OpenRouter Rate Limit Monitor - 主要模組入口
 * 
 * 提供可程式化介面，供其他應用程式使用
 */

const RateLimitService = require('./services/RateLimitService');
const ConfigManager = require('./services/ConfigManager');
const HistoryTracker = require('./services/HistoryTracker');

class OpenRouterMonitor {
  constructor(options = {}) {
    this.config = new ConfigManager(options.configPath);
    this.rateLimitService = new RateLimitService(this.config);
    this._historyTracker = null;
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
   * 獲取當前 API 狀態
   * @param {Object} options - 選項
   * @param {string} options.apiKey - API Key (可選)
   * @param {boolean} options.refresh - 是否強制重新檢查
   * @returns {Promise<Object>} API 狀態資訊
   */
  async getStatus(options = {}) {
    return await this.rateLimitService.getStatus(options);
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

        // 記錄歷史
        await this.historyTracker.record(status);

        // 觸發回調
        onStatus(status);

        if (usage >= alertThreshold) {
          onAlert(status, usage);
        } else if (usage >= warnThreshold) {
          onWarning(status, usage);
        }

        // 安排下次檢查
        if (isRunning) {
          timeoutId = setTimeout(check, interval * 1000);
        }
      } catch (error) {
        console.error('監控檢查失敗:', error.message);
        if (isRunning) {
          timeoutId = setTimeout(check, interval * 1000);
        }
      }
    };

    // 開始監控
    check();

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
}

module.exports = OpenRouterMonitor;