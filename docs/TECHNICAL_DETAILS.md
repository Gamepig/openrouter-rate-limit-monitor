# OpenRouter Rate Limit Monitor - 技術細節文件

## 📋 目錄

- [技術架構](#技術架構)
- [核心模組說明](#核心模組說明)
- [API 整合詳情](#api-整合詳情)
- [資料儲存機制](#資料儲存機制)
- [錯誤處理策略](#錯誤處理策略)
- [效能最佳化](#效能最佳化)
- [安全性設計](#安全性設計)

## 技術架構

### 整體架構圖
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CLI Layer     │    │  Business Logic │    │  Data Storage   │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │  Commands   │ │───▶│ │   Services  │ │───▶│ │    JSON     │ │
│ │             │ │    │ │             │ │    │ │ Database    │ │
│ │ status      │ │    │ │ RateLimit   │ │    │ │             │ │
│ │ watch       │ │    │ │ Config      │ │    │ │ Config      │ │
│ │ keys        │ │    │ │ History     │ │    │ │ Keys        │ │
│ │ history     │ │    │ │             │ │    │ │ History     │ │
│ │ config      │ │    │ │             │ │    │ │ Alerts      │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │  External APIs  │
                       │                 │
                       │ ┌─────────────┐ │
                       │ │ OpenRouter  │ │
                       │ │ /auth/key   │ │
                       │ └─────────────┘ │
                       └─────────────────┘
```

### 技術棧

#### 核心依賴
```json
{
  "runtime": "Node.js 16+",
  "dependencies": {
    "axios": "^1.6.2",           // HTTP 請求庫
    "chalk": "^4.1.2",           // 終端顏色輸出
    "commander": "^11.1.0",      // CLI 框架
    "node-json-db": "^2.3.0",    // JSON 資料庫
    "dotenv": "^16.3.1",         // 環境變數管理
    "inquirer": "^9.2.12",       // 互動式命令列
    "table": "^6.8.1"            // 表格輸出格式化
  }
}
```

#### 開發工具
```json
{
  "devDependencies": {
    "eslint": "^8.55.0",         // 程式碼檢查
    "jest": "^29.7.0",           // 測試框架
    "eslint-config-standard": "^17.1.0"
  }
}
```

### 專案結構詳解
```
openrouter-rate-limit-monitor/
├── bin/                          # CLI 入口點
│   └── openrouter-monitor.js     # 主要 CLI 程式
│
├── src/                          # 核心程式碼
│   ├── commands/                 # 指令處理器
│   │   ├── status.js            # 狀態查詢指令
│   │   ├── watch.js             # 監控指令
│   │   ├── keys.js              # API Key 管理指令
│   │   ├── history.js           # 歷史記錄指令
│   │   └── config.js            # 配置管理指令
│   │
│   ├── services/                 # 業務邏輯服務
│   │   ├── RateLimitService.js  # OpenRouter API 整合
│   │   ├── ConfigManager.js     # 配置和 Key 管理
│   │   └── HistoryTracker.js    # 歷史記錄追蹤
│   │
│   └── index.js                 # 主要模組入口
│
├── docs/                         # 文件目錄
│   ├── FEATURES_AND_USAGE.md    # 功能說明文件
│   ├── LIMITATIONS_AND_IMPROVEMENTS.md  # 限制說明文件
│   └── TECHNICAL_DETAILS.md     # 本技術文件
│
├── package.json                  # 專案配置
├── .env.example                  # 環境變數範例
├── watch.sh                      # 一鍵啟動腳本
├── README.md                     # 專案說明
└── .gitignore                    # Git 忽略規則
```

## 核心模組說明

### 1. CLI Layer (`bin/openrouter-monitor.js`)

#### 職責
- 解析命令列參數
- 路由到對應的指令處理器
- 處理全域錯誤和信號
- 提供統一的輸出格式

#### 核心程式碼片段
```javascript
// 全域錯誤處理
process.on('uncaughtException', (error) => {
  console.error(chalk.red('❌ 未預期的錯誤:'), error.message);
  if (program.opts().verbose) {
    console.error(error.stack);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('❌ 未處理的 Promise 拒絕:'), reason);
  if (program.opts().verbose) {
    console.error('Promise:', promise);
  }
  process.exit(1);
});
```

#### 指令註冊機制
```javascript
// 動態指令註冊
const commands = [
  { name: 'status', handler: require('../src/commands/status') },
  { name: 'watch', handler: require('../src/commands/watch') },
  { name: 'keys', handler: require('../src/commands/keys') },
  { name: 'history', handler: require('../src/commands/history') },
  { name: 'config', handler: require('../src/commands/config') }
];

commands.forEach(cmd => {
  program.command(cmd.name).action(cmd.handler);
});
```

### 2. RateLimitService (`src/services/RateLimitService.js`)

#### 核心職責
- OpenRouter API 通訊
- 資料格式化和正規化
- 快取管理
- 錯誤處理和重試

#### API 整合邏輯
```javascript
class RateLimitService {
  constructor(configManager) {
    this.config = configManager;
    this.baseURL = 'https://openrouter.ai/api/v1';
    this.cache = new Map();
    this.cacheTimeout = 30000; // 30秒快取
  }

  async getStatus(options = {}) {
    const { apiKey, refresh = false } = options;
    const key = this.resolveApiKey(apiKey);
    
    // 快取檢查
    if (!refresh && this.isCached(key)) {
      return this.getFromCache(key);
    }

    // API 請求
    const response = await this.makeRequest('/auth/key', key);
    const formattedData = this.formatStatus(response.data.data, key);
    
    // 更新快取
    this.updateCache(key, formattedData);
    return formattedData;
  }
}
```

#### 資料格式化
```javascript
formatStatus(data, apiKey) {
  return {
    apiKey: this.maskApiKey(apiKey),
    timestamp: new Date().toISOString(),
    usage: {
      credits: data.usage || 0,
      limit: data.limit || null,
      unlimited: data.limit === null,
      note: this.generateUsageNote(data)
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
    lastChecked: Date.now()
  };
}
```

### 3. ConfigManager (`src/services/ConfigManager.js`)

#### 配置層級系統
```javascript
// 配置優先級（由高到低）
1. 環境變數 (OPENROUTER_MONITOR_*)
2. 專案配置檔 (.openrouter-monitor.json)
3. 全域配置檔 (~/.config/openrouter-monitor/config.json)
4. 預設值
```

#### API Key 安全儲存
```javascript
class ConfigManager {
  // AES-256-GCM 加密
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

  // 金鑰遮蔽顯示
  maskApiKey(apiKey) {
    if (!apiKey || apiKey.length < 12) return '****';
    return apiKey.substring(0, 8) + '****' + apiKey.substring(apiKey.length - 4);
  }
}
```

### 4. HistoryTracker (`src/services/HistoryTracker.js`)

#### 資料儲存結構
```javascript
// 使用記錄結構
const usageRecord = {
  id: this.generateId(),
  timestamp: Date.now(),
  api_key_hash: this.hashApiKey(apiKey),
  credits_used: status.usage.credits,
  credits_limit: status.usage.limit,
  rate_used: status.limits.rate.used,
  rate_limit: status.limits.rate.limit,
  daily_used: status.limits.daily.used,
  daily_limit: status.limits.daily.limit,
  tier: status.tier.name,
  health_status: status.health.status,
  health_percentage: status.health.percentage,
  raw_data: status,
  created_at: Date.now()
};
```

#### 資料操作安全化
```javascript
// 使用 getObjectDefault 避免 DataError
record(status, options = {}) {
  try {
    // 安全獲取現有記錄
    let history = this.db.getObjectDefault('/usage_history', []);
    if (!Array.isArray(history)) {
      history = [];
    }
    
    history.push(record);
    this.db.push('/usage_history', history, false);
    
    // 自動清理舊記錄
    this.cleanupOldRecords();
  } catch (error) {
    console.warn('記錄儲存失敗:', error.message);
  }
}
```

## API 整合詳情

### OpenRouter API 分析

#### 請求格式
```javascript
const config = {
  method: 'GET',
  url: 'https://openrouter.ai/api/v1/auth/key',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'User-Agent': 'OpenRouter-Monitor/1.0.0'
  },
  timeout: 10000
};
```

#### 回應格式解析
```javascript
// 原始 API 回應
{
  "data": {
    "label": "sk-or-v1-b7e...2b2",
    "limit": null,                    // 帳戶額度限制（null = 無限制）
    "usage": 0,                       // 當前週期使用量 ⚠️
    "is_provisioning_key": false,     // 是否為佈建金鑰
    "limit_remaining": null,          // 剩餘額度
    "is_free_tier": false,           // 是否為免費層級
    "rate_limit": {
      "requests": 150,               // 每個時間間隔的請求限制
      "interval": "10s"              // 時間間隔
    }
  }
}

// 內部格式化後
{
  "apiKey": "sk-or-v1****62b2",
  "timestamp": "2025-06-23T16:41:23.302Z",
  "usage": {
    "credits": 0,                    // 從 data.usage 取得
    "limit": null,                   // 從 data.limit 取得
    "unlimited": true,               // 計算得出
    "note": "付費帳戶，無使用限制"     // 生成的說明
  },
  "tier": {
    "isFree": false,                 // 從 data.is_free_tier 反轉
    "name": "Paid"                   // 計算得出
  },
  "limits": {
    "rate": {
      "used": 0,                     // 無法從 API 獲得，設為 0
      "limit": 150,                  // 從 data.rate_limit.requests 取得
      "remaining": 150,              // 計算得出
      "resetTime": "2025-06-23T16:41:33.303Z",  // 計算得出
      "interval": "10s"              // 從 data.rate_limit.interval 取得
    }
  }
}
```

### 時間間隔解析器

#### parseInterval 實作
```javascript
parseInterval(interval) {
  const match = interval.match(/^(\d+)([smhd])$/);
  if (!match) return 60000; // 預設 1 分鐘

  const value = parseInt(match[1]);
  const unit = match[2];

  const conversions = {
    's': 1000,                    // 秒 → 毫秒
    'm': 60 * 1000,              // 分 → 毫秒
    'h': 60 * 60 * 1000,         // 時 → 毫秒
    'd': 24 * 60 * 60 * 1000     // 日 → 毫秒
  };

  return value * (conversions[unit] || 60000);
}
```

#### 支援的時間格式
- `10s` → 10 秒
- `1m` → 1 分鐘
- `1h` → 1 小時
- `1d` → 1 天

## 資料儲存機制

### JSON 資料庫架構

#### 檔案結構
```
~/.config/openrouter-monitor/
├── config.json              # 使用者配置
├── keys.json                # 加密的 API Keys
├── history.json             # 使用歷史記錄
├── alerts.json              # 警報記錄
└── .secret                  # 加密金鑰
```

#### 資料庫初始化
```javascript
class HistoryTracker {
  initDatabase() {
    try {
      // 初始化主要歷史記錄資料庫
      this.db = new JsonDB(new Config(this.dbPath, true, false, '/'));
      
      // 初始化警報記錄資料庫
      this.alertDb = new JsonDB(new Config(this.alertDbPath, true, false, '/'));
      
      // 確保路徑存在，避免 DataError
      this.db.getObjectDefault('/usage_history', []);
      this.alertDb.getObjectDefault('/alert_history', []);
      
    } catch (error) {
      console.warn('資料庫初始化失敗:', error.message);
      this.db = null;
      this.alertDb = null;
    }
  }
}
```

### 資料操作安全機制

#### 防止 DataError 的策略
```javascript
// ❌ 舊的不安全方式
try {
  history = this.db.getData('/usage_history');
} catch (error) {
  this.db.push('/usage_history', [], false);
  history = [];
}

// ✅ 新的安全方式
let history = this.db.getObjectDefault('/usage_history', []);
if (!Array.isArray(history)) {
  history = [];
}
```

#### 資料完整性檢查
```javascript
validateRecord(record) {
  const requiredFields = ['id', 'timestamp', 'api_key_hash'];
  const missingFields = requiredFields.filter(field => !record[field]);
  
  if (missingFields.length > 0) {
    throw new Error(`記錄缺少必要欄位: ${missingFields.join(', ')}`);
  }
  
  return true;
}
```

## 錯誤處理策略

### 分層錯誤處理

#### 1. 網路層錯誤
```javascript
async makeRequest(endpoint, apiKey) {
  try {
    const response = await axios.get(`${this.baseURL}${endpoint}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      timeout: 10000
    });
    return response;
  } catch (error) {
    if (error.response) {
      // HTTP 錯誤回應
      const status = error.response.status;
      const message = error.response.data?.error || error.message;
      
      switch (status) {
        case 401:
          throw new Error(`API Key 無效或已過期: ${message}`);
        case 429:
          throw new Error(`Rate limit 已達上限: ${message}`);
        case 500:
        case 502:
        case 503:
          throw new Error(`OpenRouter 伺服器錯誤 (${status}): ${message}`);
        default:
          throw new Error(`API 請求失敗 (${status}): ${message}`);
      }
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('請求超時，請檢查網路連線');
    } else {
      throw new Error(`網路錯誤: ${error.message}`);
    }
  }
}
```

#### 2. 業務邏輯錯誤
```javascript
async getStatus(options = {}) {
  try {
    // 驗證輸入
    this.validateOptions(options);
    
    // 取得 API Key
    const apiKey = this.resolveApiKey(options.apiKey);
    if (!apiKey) {
      throw new Error('未設定 API Key');
    }
    
    // 執行請求
    const result = await this.makeRequest('/auth/key', apiKey);
    return this.formatStatus(result.data.data, apiKey);
    
  } catch (error) {
    // 記錄錯誤但不中斷程式
    console.error('狀態獲取失敗:', error.message);
    throw error;
  }
}
```

#### 3. 資料層錯誤
```javascript
record(status, options = {}) {
  try {
    const record = this.createRecord(status, options);
    this.validateRecord(record);
    
    let history = this.db.getObjectDefault('/usage_history', []);
    history.push(record);
    
    this.db.push('/usage_history', history, false);
    this.cleanupOldRecords();
    
  } catch (error) {
    // 資料儲存失敗不應影響主要功能
    console.warn('記錄儲存失敗:', error.message);
    // 不重新拋出錯誤
  }
}
```

### 監控中的錯誤處理

#### 持續監控中的錯誤恢復
```javascript
startMonitoring(options = {}) {
  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 5;

  const check = async () => {
    if (!isRunning) return;

    try {
      const status = await this.getStatus();
      consecutiveErrors = 0; // 重置錯誤計數
      
      // 處理正常狀態
      this.handleNormalStatus(status);
      
    } catch (error) {
      consecutiveErrors++;
      console.error('監控檢查失敗:', error.message);
      
      if (consecutiveErrors >= maxConsecutiveErrors) {
        console.error(`連續 ${maxConsecutiveErrors} 次失敗，停止監控`);
        return;
      }
      
      // 錯誤情況下延長檢查間隔
      const retryInterval = Math.min(interval * 2, 300);
      setTimeout(check, retryInterval * 1000);
      return;
    }

    // 正常情況下安排下次檢查
    if (isRunning) {
      setTimeout(check, interval * 1000);
    }
  };

  check(); // 開始監控
}
```

## 效能最佳化

### 快取策略

#### 多層快取系統
```javascript
class RateLimitService {
  constructor(configManager) {
    this.cache = new Map();          // 記憶體快取
    this.cacheTimeout = 30000;       // 30秒過期
    this.diskCache = new Map();      // 磁碟快取（未實作）
  }

  async getStatus(options = {}) {
    const cacheKey = this.generateCacheKey(options);
    
    // 檢查記憶體快取
    if (!options.refresh && this.isInMemoryCache(cacheKey)) {
      return this.getFromMemoryCache(cacheKey);
    }
    
    // 檢查磁碟快取（未來功能）
    // if (this.isDiskCached(cacheKey)) {
    //   return this.getFromDiskCache(cacheKey);
    // }
    
    // 取得新資料
    const data = await this.fetchFreshData(options);
    
    // 更新快取
    this.updateCache(cacheKey, data);
    
    return data;
  }
}
```

#### 智慧快取失效
```javascript
updateCache(key, data) {
  const now = Date.now();
  const ttl = this.calculateTTL(data);
  
  this.cache.set(key, {
    data: data,
    timestamp: now,
    ttl: ttl,
    hits: 0
  });
  
  // 定期清理過期快取
  this.scheduleCacheCleanup();
}

calculateTTL(data) {
  // 根據資料類型動態調整 TTL
  if (data.health.status === 'critical') {
    return 10000; // 10秒，需要頻繁更新
  } else if (data.tier.isFree) {
    return 60000; // 1分鐘，免費用戶限制較嚴格
  } else {
    return 30000; // 30秒，付費用戶標準快取
  }
}
```

### 資料庫效能優化

#### 批次操作
```javascript
batchRecord(records) {
  try {
    let history = this.db.getObjectDefault('/usage_history', []);
    
    // 批次添加記錄
    history.push(...records);
    
    // 單次寫入，減少 I/O
    this.db.push('/usage_history', history, false);
    
    console.log(`批次記錄 ${records.length} 筆資料`);
  } catch (error) {
    console.warn('批次記錄失敗:', error.message);
  }
}
```

#### 索引和查詢優化
```javascript
getHistory(options = {}) {
  const { days = 7, apiKey = null, limit = 1000 } = options;
  
  let history = this.db.getObjectDefault('/usage_history', []);
  
  // 預先過濾，減少後續處理
  const sinceTimestamp = Date.now() - (days * 24 * 60 * 60 * 1000);
  
  // 使用原生陣列方法，效能較好
  const filtered = history
    .filter(record => record.timestamp >= sinceTimestamp)
    .filter(record => !apiKey || record.api_key_hash === this.hashApiKey(apiKey))
    .sort((a, b) => b.timestamp - a.timestamp)  // 降序排列
    .slice(0, limit);  // 限制數量
  
  return filtered.map(this.formatHistoryRecord);
}
```

### 記憶體管理

#### 自動清理機制
```javascript
cleanupOldRecords() {
  if (!this.db || !this.alertDb) return;

  try {
    const retentionDays = this.config.get('historyRetentionDays', 30);
    const cutoffTimestamp = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

    // 清理使用歷史
    let history = this.db.getObjectDefault('/usage_history', []);
    const originalLength = history.length;
    
    if (Array.isArray(history)) {
      const filteredHistory = history.filter(record => 
        record.timestamp >= cutoffTimestamp
      );
      
      if (filteredHistory.length !== originalLength) {
        this.db.push('/usage_history', filteredHistory, false);
        console.log(`清理 ${originalLength - filteredHistory.length} 筆過期記錄`);
      }
    }

    // 清理警報歷史
    let alerts = this.alertDb.getObjectDefault('/alert_history', []);
    if (Array.isArray(alerts)) {
      const filteredAlerts = alerts.filter(record => 
        record.timestamp >= cutoffTimestamp
      );
      this.alertDb.push('/alert_history', filteredAlerts, false);
    }

  } catch (error) {
    console.warn('舊記錄清理失敗:', error.message);
  }
}
```

## 安全性設計

### API Key 保護

#### 多層加密策略
```javascript
class ConfigManager {
  constructor() {
    this.secretKey = this.getOrCreateSecretKey();
    this.algorithm = 'aes-256-gcm';
  }

  // 生成或讀取主金鑰
  getOrCreateSecretKey() {
    const keyFile = path.join(this.configDir, '.secret');
    
    if (fs.existsSync(keyFile)) {
      try {
        return fs.readFileSync(keyFile, 'utf8').trim();
      } catch (error) {
        console.warn('密鑰檔案讀取失敗，將建立新密鑰');
      }
    }

    // 建立新的 256-bit 金鑰
    const newKey = crypto.randomBytes(32).toString('hex');
    
    try {
      fs.writeFileSync(keyFile, newKey, { mode: 0o600 }); // 只有所有者可讀寫
    } catch (error) {
      console.warn('密鑰檔案儲存失敗:', error.message);
      return crypto.randomBytes(32).toString('hex'); // 使用臨時金鑰
    }
    
    return newKey;
  }

  // AES-256-GCM 加密
  encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.algorithm, this.secretKey);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return JSON.stringify({
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      data: encrypted
    });
  }
}
```

### 資料隱私保護

#### API Key 雜湊化
```javascript
hashApiKey(apiKey) {
  // 使用 SHA-256 進行不可逆雜湊
  return crypto
    .createHash('sha256')
    .update(apiKey)
    .digest('hex')
    .substring(0, 16); // 取前 16 字元作為識別碼
}

// 在歷史記錄中只儲存雜湊值
record(status, options = {}) {
  const record = {
    id: this.generateId(),
    timestamp: Date.now(),
    api_key_hash: this.hashApiKey(status.apiKey), // 不儲存原始 API Key
    // ... 其他資料
  };
  
  // 儲存記錄
  this.saveRecord(record);
}
```

#### 敏感資料清理
```javascript
// 清理輸出中的敏感資訊
sanitizeForOutput(data) {
  const sanitized = { ...data };
  
  // 移除原始 API Key
  delete sanitized.raw_api_key;
  
  // 遮蔽部分資訊
  if (sanitized.apiKey) {
    sanitized.apiKey = this.maskApiKey(sanitized.apiKey);
  }
  
  // 移除內部偵錯資訊
  delete sanitized.debug_info;
  delete sanitized.internal_flags;
  
  return sanitized;
}
```

### 檔案系統安全

#### 目錄權限控制
```javascript
ensureConfigDir() {
  try {
    if (!fs.existsSync(this.configDir)) {
      // 建立目錄時設定嚴格權限 (700 = rwx------)
      fs.mkdirSync(this.configDir, { 
        recursive: true, 
        mode: 0o700 
      });
    }
  } catch (error) {
    console.warn('配置目錄創建失敗:', error.message);
  }
}

// 儲存檔案時設定安全權限
saveSecureFile(filePath, content) {
  try {
    fs.writeFileSync(filePath, content, { 
      mode: 0o600  // rw-------，只有所有者可讀寫
    });
  } catch (error) {
    throw new Error(`安全檔案儲存失敗: ${error.message}`);
  }
}
```

### 網路安全

#### HTTPS 強制和驗證
```javascript
// 確保所有 API 請求使用 HTTPS
const axiosConfig = {
  baseURL: 'https://openrouter.ai/api/v1', // 強制 HTTPS
  timeout: 10000,
  headers: {
    'User-Agent': 'OpenRouter-Monitor/1.0.0',
    'Content-Type': 'application/json'
  },
  // 驗證 SSL 憑證
  httpsAgent: new https.Agent({
    rejectUnauthorized: true,
    secureProtocol: 'TLSv1_2_method'
  })
};
```

#### 請求頻率限制
```javascript
class RateLimiter {
  constructor(maxRequests = 10, timeWindow = 60000) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindow;
    this.requests = [];
  }

  canMakeRequest() {
    const now = Date.now();
    
    // 清理超過時間窗口的請求記錄
    this.requests = this.requests.filter(
      timestamp => now - timestamp < this.timeWindow
    );
    
    return this.requests.length < this.maxRequests;
  }

  recordRequest() {
    this.requests.push(Date.now());
  }
}
```

---

這份技術文件提供了 OpenRouter Rate Limit Monitor 的深度技術分析。如需更多特定實作細節，請參考原始碼或聯絡開發團隊。

*最後更新: 2025-06-24*
*文件版本: 1.0.0*