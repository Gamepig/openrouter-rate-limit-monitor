/**
 * Configuration Manager
 * 處理配置檔案和 API Keys 的管理
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// 載入 dotenv 配置
try {
  require('dotenv').config();
} catch (error) {
  // dotenv 載入失敗時不影響正常運作
}

class ConfigManager {
  constructor(configPath = null) {
    this.configDir = configPath || this.getDefaultConfigDir();
    this.configFile = path.join(this.configDir, 'config.json');
    this.keysFile = path.join(this.configDir, 'keys.json');
    this.secretKey = this.getOrCreateSecretKey();
    
    this.ensureConfigDir();
    this.loadConfig();
  }

  /**
   * 獲取預設配置目錄
   * @returns {string} 配置目錄路徑
   */
  getDefaultConfigDir() {
    const homeDir = os.homedir();
    
    switch (process.platform) {
      case 'win32':
        return path.join(process.env.APPDATA || homeDir, 'openrouter-monitor');
      case 'darwin':
        return path.join(homeDir, '.config', 'openrouter-monitor');
      default:
        return path.join(homeDir, '.config', 'openrouter-monitor');
    }
  }

  /**
   * 確保配置目錄存在
   */
  ensureConfigDir() {
    try {
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true, mode: 0o700 });
      }
    } catch (error) {
      console.warn('配置目錄創建失敗:', error.message);
    }
  }

  /**
   * 載入配置
   */
  loadConfig() {
    this.config = this.getDefaultConfig();
    
    // 載入全域配置
    if (fs.existsSync(this.configFile)) {
      try {
        const fileConfig = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
        this.config = { ...this.config, ...fileConfig };
      } catch (error) {
        console.warn('配置檔案載入失敗，使用預設配置:', error.message);
      }
    }

    // 載入專案配置
    const projectConfig = this.loadProjectConfig();
    if (projectConfig) {
      this.config = { ...this.config, ...projectConfig };
    }
  }

  /**
   * 載入專案配置
   * @returns {Object|null} 專案配置
   */
  loadProjectConfig() {
    const projectConfigFiles = [
      '.openrouter-monitor.json',
      '.openrouter-monitor.js',
      'openrouter-monitor.config.json'
    ];

    for (const filename of projectConfigFiles) {
      const filePath = path.join(process.cwd(), filename);
      if (fs.existsSync(filePath)) {
        try {
          if (filename.endsWith('.js')) {
            delete require.cache[require.resolve(filePath)];
            return require(filePath);
          } else {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
          }
        } catch (error) {
          console.warn(`專案配置檔案 ${filename} 載入失敗:`, error.message);
        }
      }
    }

    return null;
  }

  /**
   * 獲取預設配置
   * @returns {Object} 預設配置
   */
  getDefaultConfig() {
    return {
      defaultApiKey: null,
      interval: 60,
      warnThreshold: 80,
      alertThreshold: 95,
      notificationEnabled: false,
      quiet: false,
      outputFormat: 'table',
      historyRetentionDays: 30
    };
  }

  /**
   * 獲取配置值
   * @param {string} key - 配置鍵
   * @param {*} defaultValue - 預設值
   * @returns {*} 配置值
   */
  get(key, defaultValue = null) {
    // 優先檢查環境變數
    const envKey = `OPENROUTER_MONITOR_${key.toUpperCase().replace(/([A-Z])/g, '_$1')}`;
    if (process.env[envKey]) {
      const value = process.env[envKey];
      // 嘗試轉換類型
      if (value === 'true') return true;
      if (value === 'false') return false;
      if (!isNaN(value) && !isNaN(parseFloat(value))) return parseFloat(value);
      return value;
    }

    return this.config[key] !== undefined ? this.config[key] : defaultValue;
  }

  /**
   * 設定配置值
   * @param {string} key - 配置鍵
   * @param {*} value - 配置值
   */
  set(key, value) {
    this.config[key] = value;
    this.saveConfig();
  }

  /**
   * 儲存配置
   */
  saveConfig() {
    try {
      const configToSave = { ...this.config };
      delete configToSave.defaultApiKey; // 不儲存 API Key 到一般配置
      
      fs.writeFileSync(this.configFile, JSON.stringify(configToSave, null, 2), {
        mode: 0o600
      });
    } catch (error) {
      throw new Error(`配置儲存失敗: ${error.message}`);
    }
  }

  /**
   * 重置配置
   */
  reset() {
    this.config = this.getDefaultConfig();
    this.saveConfig();
  }

  /**
   * 獲取所有配置
   * @returns {Object} 所有配置
   */
  getAll() {
    return { ...this.config };
  }

  // API Keys 管理

  /**
   * 載入 API Keys
   * @returns {Object} API Keys
   */
  loadKeys() {
    if (!fs.existsSync(this.keysFile)) {
      return {};
    }

    try {
      const encrypted = fs.readFileSync(this.keysFile, 'utf8');
      const decrypted = this.decrypt(encrypted);
      return JSON.parse(decrypted);
    } catch (error) {
      console.warn('API Keys 檔案載入失敗:', error.message);
      return {};
    }
  }

  /**
   * 儲存 API Keys
   * @param {Object} keys - API Keys
   */
  saveKeys(keys) {
    try {
      const data = JSON.stringify(keys, null, 2);
      const encrypted = this.encrypt(data);
      fs.writeFileSync(this.keysFile, encrypted, { mode: 0o600 });
    } catch (error) {
      throw new Error(`API Keys 儲存失敗: ${error.message}`);
    }
  }

  /**
   * 新增 API Key
   * @param {string} name - Key 名稱
   * @param {string} key - API Key
   */
  addKey(name, key) {
    const keys = this.loadKeys();
    keys[name] = {
      key: key,
      createdAt: new Date().toISOString(),
      lastUsed: null
    };
    this.saveKeys(keys);
  }

  /**
   * 移除 API Key
   * @param {string} name - Key 名稱
   * @returns {boolean} 是否成功移除
   */
  removeKey(name) {
    const keys = this.loadKeys();
    if (keys[name]) {
      delete keys[name];
      this.saveKeys(keys);
      return true;
    }
    return false;
  }

  /**
   * 獲取 API Key
   * @param {string} name - Key 名稱
   * @returns {string|null} API Key
   */
  getKey(name) {
    const keys = this.loadKeys();
    return keys[name] ? keys[name].key : null;
  }

  /**
   * 列出所有 API Key 名稱
   * @returns {Array} Key 名稱陣列
   */
  listKeys() {
    const keys = this.loadKeys();
    return Object.keys(keys).map(name => ({
      name,
      createdAt: keys[name].createdAt,
      lastUsed: keys[name].lastUsed
    }));
  }

  /**
   * 更新 Key 最後使用時間
   * @param {string} name - Key 名稱
   */
  updateKeyLastUsed(name) {
    const keys = this.loadKeys();
    if (keys[name]) {
      keys[name].lastUsed = new Date().toISOString();
      this.saveKeys(keys);
    }
  }

  /**
   * 獲取或建立密鑰
   * @returns {string} 密鑰
   */
  getOrCreateSecretKey() {
    const keyFile = path.join(this.configDir, '.secret');
    
    if (fs.existsSync(keyFile)) {
      try {
        return fs.readFileSync(keyFile, 'utf8').trim();
      } catch (error) {
        console.warn('密鑰檔案讀取失敗，將建立新密鑰');
      }
    }

    // 建立新密鑰
    const newKey = crypto.randomBytes(32).toString('hex');
    try {
      // 確保目錄存在
      this.ensureConfigDir();
      fs.writeFileSync(keyFile, newKey, { mode: 0o600 });
    } catch (error) {
      console.warn('密鑰檔案儲存失敗:', error.message);
      // 如果無法儲存到檔案，返回一個暫時的密鑰
      return crypto.randomBytes(32).toString('hex');
    }
    
    return newKey;
  }

  /**
   * 加密資料
   * @param {string} text - 要加密的文字
   * @returns {string} 加密後的資料
   */
  encrypt(text) {
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, this.secretKey);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return JSON.stringify({
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      data: encrypted
    });
  }

  /**
   * 解密資料
   * @param {string} encryptedData - 加密的資料
   * @returns {string} 解密後的文字
   */
  decrypt(encryptedData) {
    try {
      const { iv, authTag, data } = JSON.parse(encryptedData);
      const algorithm = 'aes-256-gcm';
      const decipher = crypto.createDecipher(algorithm, this.secretKey);
      
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));
      
      let decrypted = decipher.update(data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error('資料解密失敗，可能是密鑰錯誤或資料損毀');
    }
  }
}

module.exports = ConfigManager;