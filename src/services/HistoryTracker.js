/**
 * History Tracker
 * 處理使用歷史記錄的儲存和查詢
 */

const fs = require('fs');
const path = require('path');
const { JsonDB, Config } = require('node-json-db');

class HistoryTracker {
  constructor(configManager) {
    this.config = configManager;
    this.dbPath = path.join(configManager.configDir, 'history.json');
    this.alertDbPath = path.join(configManager.configDir, 'alerts.json');
    this.db = null;
    this.alertDb = null;
    this.initDatabase();
  }

  /**
   * 初始化資料庫
   */
  initDatabase() {
    try {
      // 初始化主要歷史記錄資料庫
      this.db = new JsonDB(new Config(this.dbPath, true, false, '/'));
      
      // 初始化警報記錄資料庫
      this.alertDb = new JsonDB(new Config(this.alertDbPath, true, false, '/'));
      
      // 確保根路徑存在
      try {
        this.db.getData('/usage_history');
      } catch (error) {
        this.db.push('/usage_history', [], false);
      }
      
      try {
        this.alertDb.getData('/alert_history');
      } catch (error) {
        this.alertDb.push('/alert_history', [], false);
      }
      
    } catch (error) {
      console.warn('資料庫初始化失敗:', error.message);
      this.db = null;
      this.alertDb = null;
    }
  }

  /**
   * 記錄使用狀況
   * @param {Object} status - API 狀態
   * @param {Object} options - 選項
   */
  async record(status, options = {}) {
    if (!this.db) return;

    try {
      const timestamp = Date.now();
      const apiKeyHash = this.hashApiKey(status.apiKey);

      const record = {
        id: this.generateId(),
        timestamp: timestamp,
        api_key_hash: apiKeyHash,
        credits_used: status.usage?.credits || 0,
        credits_limit: status.usage?.limit,
        rate_used: status.limits?.rate?.used || 0,
        rate_limit: status.limits?.rate?.limit || 0,
        daily_used: status.limits?.daily?.used || 0,
        daily_limit: status.limits?.daily?.limit,
        tier: status.tier?.name || 'free',
        health_status: status.health?.status || 'unknown',
        health_percentage: status.health?.percentage || 0,
        raw_data: status,
        created_at: timestamp
      };

      // 獲取現有記錄
      let history;
      try {
        history = this.db.getData('/usage_history');
        if (!Array.isArray(history)) {
          history = [];
        }
      } catch (error) {
        history = [];
      }
      
      history.push(record);
      
      // 儲存更新後的記錄
      this.db.push('/usage_history', history, false);

      // 清理舊記錄
      this.cleanupOldRecords();

    } catch (error) {
      console.warn('記錄儲存失敗:', error.message);
    }
  }

  /**
   * 記錄警報
   * @param {string} apiKey - API Key
   * @param {string} alertType - 警報類型
   * @param {string} message - 訊息
   * @param {number} thresholdValue - 閾值
   * @param {number} actualValue - 實際值
   */
  async recordAlert(apiKey, alertType, message, thresholdValue, actualValue) {
    if (!this.alertDb) return;

    try {
      const timestamp = Date.now();
      const apiKeyHash = this.hashApiKey(apiKey);

      const alert = {
        id: this.generateId(),
        timestamp: timestamp,
        api_key_hash: apiKeyHash,
        alert_type: alertType,
        message: message,
        threshold_value: thresholdValue,
        actual_value: actualValue,
        created_at: timestamp
      };

      // 獲取現有警報記錄
      let alerts;
      try {
        alerts = this.alertDb.getData('/alert_history');
        if (!Array.isArray(alerts)) {
          alerts = [];
        }
      } catch (error) {
        alerts = [];
      }
      
      alerts.push(alert);
      
      // 儲存更新後的記錄
      this.alertDb.push('/alert_history', alerts, false);

    } catch (error) {
      console.warn('警報記錄失敗:', error.message);
    }
  }

  /**
   * 獲取使用歷史
   * @param {Object} options - 查詢選項
   * @returns {Array} 歷史記錄
   */
  async getHistory(options = {}) {
    if (!this.db) return [];

    const {
      days = 7,
      apiKey = null,
      limit = 1000,
      includeRawData = false
    } = options;

    try {
      const sinceTimestamp = Date.now() - (days * 24 * 60 * 60 * 1000);
      let history;
      
      try {
        history = this.db.getData('/usage_history');
      } catch (error) {
        // 如果路徑不存在，初始化為空陣列
        this.db.push('/usage_history', [], false);
        history = [];
      }

      // 篩選條件
      let filteredHistory = history.filter(record => {
        if (record.timestamp < sinceTimestamp) return false;
        if (apiKey && record.api_key_hash !== this.hashApiKey(apiKey)) return false;
        return true;
      });

      // 排序（最新的在前）
      filteredHistory.sort((a, b) => b.timestamp - a.timestamp);

      // 限制數量
      if (limit && filteredHistory.length > limit) {
        filteredHistory = filteredHistory.slice(0, limit);
      }

      // 格式化輸出
      return filteredHistory.map(record => ({
        timestamp: record.timestamp,
        date: new Date(record.timestamp).toISOString(),
        credits_used: record.credits_used,
        credits_limit: record.credits_limit,
        rate_used: record.rate_used,
        rate_limit: record.rate_limit,
        daily_used: record.daily_used,
        daily_limit: record.daily_limit,
        tier: record.tier,
        health_status: record.health_status,
        health_percentage: record.health_percentage,
        rawData: includeRawData ? record.raw_data : undefined
      }));

    } catch (error) {
      console.warn('歷史記錄查詢失敗:', error.message);
      return [];
    }
  }

  /**
   * 獲取警報歷史
   * @param {Object} options - 查詢選項
   * @returns {Array} 警報記錄
   */
  async getAlertHistory(options = {}) {
    if (!this.db) return [];

    const {
      days = 7,
      apiKey = null,
      alertType = null,
      limit = 100
    } = options;

    try {
      const sinceTimestamp = Date.now() - (days * 24 * 60 * 60 * 1000);
      let query = `
        SELECT timestamp, alert_type, message, threshold_value, actual_value
        FROM alert_history 
        WHERE timestamp >= ?
      `;
      const params = [sinceTimestamp];

      if (apiKey) {
        query += ' AND api_key_hash = ?';
        params.push(this.hashApiKey(apiKey));
      }

      if (alertType) {
        query += ' AND alert_type = ?';
        params.push(alertType);
      }

      query += ' ORDER BY timestamp DESC LIMIT ?';
      params.push(limit);

      const stmt = this.db.prepare(query);
      const rows = stmt.all(...params);

      return rows.map(row => ({
        ...row,
        date: new Date(row.timestamp).toISOString()
      }));

    } catch (error) {
      console.warn('警報歷史查詢失敗:', error.message);
      return [];
    }
  }

  /**
   * 獲取統計資料
   * @param {Object} options - 選項
   * @returns {Object} 統計資料
   */
  async getStatistics(options = {}) {
    if (!this.db) return {};

    const { days = 7, apiKey = null } = options;

    try {
      const sinceTimestamp = Date.now() - (days * 24 * 60 * 60 * 1000);
      let whereClause = 'WHERE timestamp >= ?';
      const params = [sinceTimestamp];

      if (apiKey) {
        whereClause += ' AND api_key_hash = ?';
        params.push(this.hashApiKey(apiKey));
      }

      // 基本統計
      const basicStats = this.db.prepare(`
        SELECT 
          COUNT(*) as total_records,
          AVG(credits_used) as avg_credits_used,
          MAX(credits_used) as max_credits_used,
          AVG(rate_used) as avg_rate_used,
          MAX(rate_used) as max_rate_used,
          AVG(health_percentage) as avg_health_percentage
        FROM usage_history ${whereClause}
      `).get(...params);

      // 警報統計
      const alertStats = this.db.prepare(`
        SELECT 
          alert_type,
          COUNT(*) as count
        FROM alert_history ${whereClause}
        GROUP BY alert_type
      `).all(...params);

      // 每日趨勢
      const dailyTrend = this.db.prepare(`
        SELECT 
          DATE(timestamp / 1000, 'unixepoch') as date,
          AVG(credits_used) as avg_credits,
          AVG(rate_used) as avg_rate,
          COUNT(*) as records
        FROM usage_history ${whereClause}
        GROUP BY DATE(timestamp / 1000, 'unixepoch')
        ORDER BY date DESC
      `).all(...params);

      return {
        basic: basicStats,
        alerts: alertStats.reduce((acc, row) => {
          acc[row.alert_type] = row.count;
          return acc;
        }, {}),
        dailyTrend: dailyTrend
      };

    } catch (error) {
      console.warn('統計資料查詢失敗:', error.message);
      return {};
    }
  }

  /**
   * 清除歷史記錄
   * @param {Object} options - 清除選項
   * @returns {number} 清除的記錄數
   */
  async clear(options = {}) {
    if (!this.db || !this.alertDb) return 0;

    const { olderThanDays = null, apiKey = null } = options;

    try {
      let deletedCount = 0;

      if (olderThanDays) {
        const cutoffTimestamp = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
        
        // 清理使用歷史
        let history;
        try {
          history = this.db.getData('/usage_history');
          if (!Array.isArray(history)) history = [];
        } catch (error) {
          history = [];
        }
        
        const filteredHistory = history.filter(record => {
          const shouldDelete = record.timestamp < cutoffTimestamp && 
                             (!apiKey || record.api_key_hash === this.hashApiKey(apiKey));
          if (shouldDelete) deletedCount++;
          return !shouldDelete;
        });
        this.db.push('/usage_history', filteredHistory, false);

        // 清理警報歷史
        let alerts;
        try {
          alerts = this.alertDb.getData('/alert_history');
          if (!Array.isArray(alerts)) alerts = [];
        } catch (error) {
          alerts = [];
        }
        
        const filteredAlerts = alerts.filter(record => {
          const shouldDelete = record.timestamp < cutoffTimestamp && 
                             (!apiKey || record.api_key_hash === this.hashApiKey(apiKey));
          if (shouldDelete) deletedCount++;
          return !shouldDelete;
        });
        this.alertDb.push('/alert_history', filteredAlerts, false);

      } else {
        // 清除所有記錄
        if (apiKey) {
          const keyHash = this.hashApiKey(apiKey);
          
          // 清理使用歷史
          let history;
          try {
            history = this.db.getData('/usage_history');
            if (!Array.isArray(history)) history = [];
          } catch (error) {
            history = [];
          }
          
          const filteredHistory = history.filter(record => {
            const shouldDelete = record.api_key_hash === keyHash;
            if (shouldDelete) deletedCount++;
            return !shouldDelete;
          });
          this.db.push('/usage_history', filteredHistory, false);

          // 清理警報歷史
          let alerts;
          try {
            alerts = this.alertDb.getData('/alert_history');
            if (!Array.isArray(alerts)) alerts = [];
          } catch (error) {
            alerts = [];
          }
          
          const filteredAlerts = alerts.filter(record => {
            const shouldDelete = record.api_key_hash === keyHash;
            if (shouldDelete) deletedCount++;
            return !shouldDelete;
          });
          this.alertDb.push('/alert_history', filteredAlerts, false);
        } else {
          let history, alerts;
          try {
            history = this.db.getData('/usage_history');
            if (!Array.isArray(history)) history = [];
          } catch (error) {
            history = [];
          }
          
          try {
            alerts = this.alertDb.getData('/alert_history');
            if (!Array.isArray(alerts)) alerts = [];
          } catch (error) {
            alerts = [];
          }
          
          deletedCount = history.length + alerts.length;
          
          this.db.push('/usage_history', [], false);
          this.alertDb.push('/alert_history', [], false);
        }
      }

      return deletedCount;

    } catch (error) {
      console.warn('歷史記錄清除失敗:', error.message);
      return 0;
    }
  }

  /**
   * 清理舊記錄
   */
  cleanupOldRecords() {
    if (!this.db || !this.alertDb) return;

    try {
      const retentionDays = this.config.get('historyRetentionDays', 30);
      const cutoffTimestamp = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

      // 清理使用歷史
      let history;
      try {
        history = this.db.getData('/usage_history');
        if (Array.isArray(history)) {
          const filteredHistory = history.filter(record => record.timestamp >= cutoffTimestamp);
          this.db.push('/usage_history', filteredHistory, false);
        }
      } catch (error) {
        // 如果路徑不存在，初始化為空陣列
        this.db.push('/usage_history', [], false);
      }

      // 清理警報歷史
      let alerts;
      try {
        alerts = this.alertDb.getData('/alert_history');
        if (Array.isArray(alerts)) {
          const filteredAlerts = alerts.filter(record => record.timestamp >= cutoffTimestamp);
          this.alertDb.push('/alert_history', filteredAlerts, false);
        }
      } catch (error) {
        // 如果路徑不存在，初始化為空陣列
        this.alertDb.push('/alert_history', [], false);
      }

    } catch (error) {
      console.warn('舊記錄清理失敗:', error.message);
    }
  }

  /**
   * 產生唯一 ID
   * @returns {string} 唯一識別碼
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  /**
   * 計算 API Key 的雜湊值
   * @param {string} apiKey - API Key
   * @returns {string} 雜湊值
   */
  hashApiKey(apiKey) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(apiKey).digest('hex').substring(0, 16);
  }

  /**
   * 匯出資料
   * @param {Object} options - 匯出選項
   * @returns {string} 匯出的資料
   */
  async exportData(options = {}) {
    const { format = 'json', ...queryOptions } = options;
    const history = await this.getHistory({ ...queryOptions, includeRawData: true });

    switch (format.toLowerCase()) {
      case 'csv':
        return this.exportToCSV(history);
      case 'json':
      default:
        return JSON.stringify(history, null, 2);
    }
  }

  /**
   * 匯出為 CSV 格式
   * @param {Array} data - 資料
   * @returns {string} CSV 字串
   */
  exportToCSV(data) {
    if (!data.length) return '';

    const headers = [
      'timestamp', 'date', 'credits_used', 'credits_limit',
      'rate_used', 'rate_limit', 'daily_used', 'daily_limit',
      'tier', 'health_status', 'health_percentage'
    ];

    const csvRows = [headers.join(',')];

    data.forEach(row => {
      const values = headers.map(header => {
        const value = row[header];
        return value !== null && value !== undefined ? `"${value}"` : '';
      });
      csvRows.push(values.join(','));
    });

    return csvRows.join('\n');
  }

  /**
   * 關閉資料庫連接
   */
  close() {
    // JSON DB 不需要明確關閉連接
    this.db = null;
    this.alertDb = null;
  }
}

module.exports = HistoryTracker;