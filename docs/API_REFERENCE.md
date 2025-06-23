# API Reference

OpenRouter Rate Limit Monitor 的完整 API 參考文件。

## 目錄
- [CLI Commands](#cli-commands)
- [JavaScript API](#javascript-api)
- [Configuration](#configuration)
- [Data Structures](#data-structures)

## CLI Commands

### Global Options

所有指令都支援以下全域選項：

| 選項 | 簡寫 | 描述 | 預設值 |
|------|------|------|--------|
| `--key <name>` | `-k` | 使用指定的 API key | - |
| `--json` | `-j` | 以 JSON 格式輸出 | false |
| `--verbose` | `-v` | 顯示詳細資訊 | false |
| `--quiet` | `-q` | 安靜模式，只顯示錯誤 | false |
| `--help` | `-h` | 顯示說明資訊 | - |
| `--version` | `-V` | 顯示版本資訊 | - |

### Status Commands

#### `status`
顯示目前的 API 狀態和 rate limit 資訊。

```bash
openrouter-monitor status [options]
```

**選項:**
- `--refresh`, `-r`: 強制重新檢查，忽略快取

**範例:**
```bash
openrouter-monitor status
openrouter-monitor status --json
openrouter-monitor status --key production --refresh
```

#### `limits`
顯示詳細的 rate limit 資訊（等同於 status 指令）。

```bash
openrouter-monitor limits [options]
```

### Watch Commands

#### `watch`
持續監控 API 使用狀況。

```bash
openrouter-monitor watch [options]
```

**選項:**
- `--interval <seconds>`, `-i`: 檢查間隔秒數（預設: 60）
- `--warn-threshold <percent>`, `-w`: 警告閾值百分比（預設: 80）
- `--alert-threshold <percent>`, `-a`: 警報閾值百分比（預設: 95）
- `--notify`, `-n`: 啟用系統通知

**範例:**
```bash
openrouter-monitor watch
openrouter-monitor watch --interval 30 --warn-threshold 75
openrouter-monitor watch --key development --notify
```

### Keys Management

#### `keys list`
列出所有儲存的 API keys。

```bash
openrouter-monitor keys list [options]
```

**選項:**
- `--names-only`: 只顯示 key 名稱

#### `keys add <name> <key>`
新增一個 API key。

```bash
openrouter-monitor keys add <name> <key>
```

**參數:**
- `<name>`: API key 的名稱（1-50 字元）
- `<key>`: OpenRouter API key（必須以 `sk-or-v1-` 開頭）

#### `keys remove <name>`
移除一個 API key。

```bash
openrouter-monitor keys remove <name>
openrouter-monitor keys rm <name>  # 別名
```

#### `keys test <name>`
測試指定的 API key。

```bash
openrouter-monitor keys test <name>
```

#### `keys current`
顯示目前使用的 API key。

```bash
openrouter-monitor keys current
```

### History Commands

#### `history show`
顯示使用歷史記錄。

```bash
openrouter-monitor history show [options]
```

**選項:**
- `--days <n>`, `-d`: 顯示最近 n 天（預設: 7）
- `--format <type>`, `-f`: 輸出格式: table|json|csv（預設: table）
- `--export <file>`: 匯出到檔案

**範例:**
```bash
openrouter-monitor history show --days 30
openrouter-monitor history show --format csv --export usage.csv
```

#### `history clear`
清除歷史記錄。

```bash
openrouter-monitor history clear [options]
```

**選項:**
- `--older-than <days>`: 只清除指定天數之前的記錄
- `--confirm`: 跳過確認提示

### Configuration Commands

#### `config show`
顯示目前配置。

```bash
openrouter-monitor config show
```

#### `config set <key> <value>`
設定配置值。

```bash
openrouter-monitor config set <key> <value>
```

**可用的配置鍵:**
- `interval`: 檢查間隔（秒）
- `warnThreshold`: 警告閾值（百分比）
- `alertThreshold`: 警報閾值（百分比）
- `notificationEnabled`: 啟用通知（true/false）
- `quiet`: 安靜模式（true/false）
- `outputFormat`: 輸出格式（table/json/csv）
- `historyRetentionDays`: 歷史記錄保留天數

#### `config reset`
重置所有配置到預設值。

```bash
openrouter-monitor config reset [--confirm]
```

## JavaScript API

### OpenRouterMonitor Class

#### Constructor

```javascript
const OpenRouterMonitor = require('openrouter-rate-limit-monitor');

const monitor = new OpenRouterMonitor(options);
```

**Options:**
- `configPath` (string): 自訂配置目錄路徑

#### Methods

##### `getStatus(options)`

獲取當前 API 狀態。

```javascript
const status = await monitor.getStatus({
  apiKey: 'sk-or-v1-...',  // 可選
  refresh: true            // 強制重新檢查
});
```

**回傳:** Promise\<StatusObject\>

##### `getLimits(options)`

獲取詳細的 rate limit 資訊。

```javascript
const limits = await monitor.getLimits({
  apiKey: 'sk-or-v1-...'  // 可選
});
```

**回傳:** Promise\<LimitsObject\>

##### `startMonitoring(options)`

開始監控模式。

```javascript
const controller = monitor.startMonitoring({
  interval: 60,                    // 檢查間隔（秒）
  warnThreshold: 80,              // 警告閾值
  alertThreshold: 95,             // 警報閾值
  onStatus: (status) => {},       // 狀態更新回調
  onWarning: (status, usage) => {}, // 警告回調
  onAlert: (status, usage) => {}  // 警報回調
});

// 停止監控
controller.stop();

// 檢查是否正在運行
console.log(controller.isRunning());
```

**回傳:** MonitorController

##### `calculateUsagePercentage(status)`

計算使用率百分比。

```javascript
const percentage = monitor.calculateUsagePercentage(status);
```

**回傳:** number

##### `getHistory(options)`

獲取使用歷史。

```javascript
const history = await monitor.getHistory({
  days: 7,                 // 天數
  apiKey: 'sk-or-v1-...'  // 可選
});
```

**回傳:** Promise\<Array\<HistoryRecord\>\>

##### `clearHistory(options)`

清除歷史記錄。

```javascript
const deletedCount = await monitor.clearHistory({
  olderThanDays: 30,       // 可選
  apiKey: 'sk-or-v1-...'  // 可選
});
```

**回傳:** Promise\<number\>

##### `testApiKey(apiKey)`

測試 API Key。

```javascript
const result = await monitor.testApiKey('sk-or-v1-...');
```

**回傳:** Promise\<TestResult\>

## Configuration

### 配置檔案位置

配置檔案按優先順序載入：

1. **環境變數** (`OPENROUTER_MONITOR_*`)
2. **專案配置檔案** (`.openrouter-monitor.json`)
3. **全域配置檔案** (`~/.config/openrouter-monitor/config.json`)
4. **預設值**

### 專案配置檔案範例

`.openrouter-monitor.json`:
```json
{
  "defaultKey": "production",
  "interval": 30,
  "warnThreshold": 75,
  "alertThreshold": 90,
  "notificationEnabled": true,
  "quiet": false,
  "outputFormat": "table",
  "historyRetentionDays": 30
}
```

### 環境變數

| 變數名稱 | 描述 | 範例 |
|----------|------|------|
| `OPENROUTER_API_KEY` | 預設 API Key | `sk-or-v1-...` |
| `OPENROUTER_MONITOR_INTERVAL` | 檢查間隔 | `60` |
| `OPENROUTER_MONITOR_WARN_THRESHOLD` | 警告閾值 | `80` |
| `OPENROUTER_MONITOR_ALERT_THRESHOLD` | 警報閾值 | `95` |
| `OPENROUTER_MONITOR_NOTIFICATION_ENABLED` | 啟用通知 | `true` |

## Data Structures

### StatusObject

```javascript
{
  apiKey: "sk-or-v1-****...****",     // 遮蔽的 API Key
  timestamp: "2024-01-15T10:30:00Z",  // ISO 時間戳記
  usage: {
    credits: 5.25,                    // 已使用的額度
    limit: null,                      // 額度限制（null = 無限制）
    unlimited: true                   // 是否無限制
  },
  tier: {
    isFree: true,                     // 是否為免費層級
    name: "Free"                      // 層級名稱
  },
  limits: {
    rate: {                           // Rate limit（每分鐘）
      used: 15,                       // 已使用次數
      limit: 20,                      // 限制次數
      remaining: 5,                   // 剩餘次數
      resetTime: "2024-01-15T10:31:00Z" // 重置時間
    },
    daily: {                          // 每日限制
      used: 42,                       // 已使用次數
      limit: 1000,                    // 限制次數
      remaining: 958,                 // 剩餘次數
      resetTime: "2024-01-16T00:00:00Z" // 重置時間
    },
    monthly: {                        // 每月限制
      used: 5.25,                     // 已使用額度
      limit: null,                    // 限制額度
      remaining: null,                // 剩餘額度
      resetTime: "2024-02-01T00:00:00Z" // 重置時間
    }
  },
  health: {
    status: "healthy",                // 健康狀態
    percentage: 75,                   // 使用率百分比
    message: "系統運作正常 (75% 使用率)" // 狀態訊息
  },
  lastChecked: 1642234200000          // 檢查時間戳記
}
```

### LimitsObject

繼承 StatusObject，並添加：

```javascript
{
  ...StatusObject,
  details: {
    riskLevel: "low",                 // 風險等級
    recommendations: [                // 建議陣列
      "建議降低請求頻率"
    ],
    predictions: {}                   // 預測資料
  }
}
```

### HistoryRecord

```javascript
{
  timestamp: 1642234200000,           // 時間戳記
  date: "2024-01-15T10:30:00Z",      // ISO 日期
  credits_used: 5.25,                // 已使用額度
  credits_limit: null,               // 額度限制
  rate_used: 15,                     // Rate limit 使用
  rate_limit: 20,                    // Rate limit 限制
  daily_used: 42,                    // 每日使用
  daily_limit: 1000,                 // 每日限制
  tier: "Free",                      // 服務層級
  health_status: "healthy",          // 健康狀態
  health_percentage: 75,             // 使用率百分比
  rawData: {}                        // 原始資料（可選）
}
```

### TestResult

```javascript
{
  valid: true,                       // 是否有效
  status: StatusObject,              // 狀態資料（如果有效）
  error: "錯誤訊息",                 // 錯誤訊息（如果無效）
  message: "API Key 有效"            // 結果訊息
}
```

### MonitorController

```javascript
{
  stop: () => void,                  // 停止監控函數
  isRunning: () => boolean           // 檢查運行狀態函數
}
```

## Error Handling

### 常見錯誤類型

1. **API Key 錯誤**
   - `未設定 API Key`
   - `API Key 無效或已過期`
   - `無效的 OpenRouter API Key 格式`

2. **網路錯誤**
   - `請求超時，請檢查網路連線`
   - `網路錯誤: ...`

3. **Rate Limit 錯誤**
   - `Rate limit 已達上限`

4. **伺服器錯誤**
   - `OpenRouter 伺服器錯誤 (5xx)`

5. **配置錯誤**
   - `無效的配置鍵`
   - `檢查間隔不能少於 10 秒`
   - `閾值必須在 0-100 之間`

### 錯誤處理最佳實踐

```javascript
try {
  const status = await monitor.getStatus();
  console.log(status);
} catch (error) {
  if (error.message.includes('API Key')) {
    // 處理 API Key 相關錯誤
  } else if (error.message.includes('網路')) {
    // 處理網路錯誤
  } else {
    // 處理其他錯誤
  }
}
```

## Rate Limits

### OpenRouter 限制

- **免費模型**: 每分鐘最多 20 次請求
- **每日限制**: 
  - 少於 10 個額度: 50 次免費請求/天
  - 10+ 個額度: 1000 次免費請求/天

### 監控工具限制

- **最小檢查間隔**: 10 秒
- **快取時間**: 30 秒
- **最大重試次數**: 3 次
- **請求超時**: 10 秒

## Examples

### 基本使用

```javascript
const OpenRouterMonitor = require('openrouter-rate-limit-monitor');

async function example() {
  const monitor = new OpenRouterMonitor();
  
  // 檢查狀態
  const status = await monitor.getStatus();
  console.log(`使用率: ${monitor.calculateUsagePercentage(status)}%`);
  
  // 開始監控
  const controller = monitor.startMonitoring({
    interval: 60,
    onWarning: (status, usage) => {
      console.log(`警告: 使用率達到 ${usage}%`);
    }
  });
  
  // 5 分鐘後停止
  setTimeout(() => {
    controller.stop();
  }, 5 * 60 * 1000);
}
```

### CI/CD 整合

```bash
#!/bin/bash
# 檢查 API 配額是否足夠
REMAINING=$(openrouter-monitor status --json | jq '.limits.daily.remaining')

if [ "$REMAINING" -lt 50 ]; then
  echo "API 配額不足，停止部署"
  exit 1
fi

echo "API 配額充足，繼續部署"
```

### 專案整合

```javascript
// 在你的專案中使用
const { OpenRouterMonitor } = require('openrouter-rate-limit-monitor');

class MyAIService {
  constructor() {
    this.monitor = new OpenRouterMonitor();
  }
  
  async makeRequest() {
    // 檢查 rate limit
    const status = await this.monitor.getStatus();
    const usage = this.monitor.calculateUsagePercentage(status);
    
    if (usage > 90) {
      throw new Error('Rate limit 接近上限，請稍後重試');
    }
    
    // 執行 AI 請求
    return this.callOpenRouterAPI();
  }
}
```