# OpenRouter Rate Limit Monitor - 詳細使用指南

## 目錄
- [安裝指南](#安裝指南)
- [快速開始](#快速開始)
- [指令參考](#指令參考)
- [配置管理](#配置管理)
- [使用範例](#使用範例)
- [故障排除](#故障排除)
- [最佳實踐](#最佳實踐)

## 安裝指南

### 系統需求
- Node.js 16.0.0 或更高版本
- npm 或 yarn 套件管理器

### 全域安裝
```bash
npm install -g openrouter-rate-limit-monitor
```

### 本地安裝（專案內使用）
```bash
npm install openrouter-rate-limit-monitor
```

### 從原始碼安裝
```bash
git clone https://github.com/yourusername/openrouter-rate-limit-monitor.git
cd openrouter-rate-limit-monitor
npm install
npm link  # 建立全域連結
```

## 快速開始

### 1. 設定 API Key
```bash
# 方法一：使用指令設定
openrouter-monitor keys add default YOUR_API_KEY

# 方法二：設定環境變數
export OPENROUTER_API_KEY=your_api_key_here

# 方法三：使用 .env 檔案
echo "OPENROUTER_API_KEY=your_api_key_here" > .env
```

### 2. 檢查當前狀態
```bash
openrouter-monitor status
```

### 3. 開始監控
```bash
openrouter-monitor watch
```

## 指令參考

### 基本指令

#### `status` - 查看目前狀態
顯示目前的 rate limit 狀態和使用情況。

```bash
openrouter-monitor status [options]

選項:
  -j, --json          以 JSON 格式輸出
  -k, --key <name>    使用特定的 API key
  -v, --verbose       顯示詳細資訊
```

**輸出範例:**
```
┌─────────────────────────────────────────────────────┐
│               OpenRouter API Status                 │
├─────────────────────────────────────────────────────┤
│ API Key: sk-or-v1-****...****                      │
│ Tier: Free                                          │
│ Credits Used: 5.25 / ∞                             │
│ Free Requests: 42 / 1000 (today)                   │
│ Rate Limit: 18 / 20 (per minute)                   │
│ Status: ✅ Healthy                                   │
└─────────────────────────────────────────────────────┘
```

#### `limits` - 查看詳細限制資訊
顯示所有 rate limit 的詳細資訊。

```bash
openrouter-monitor limits [options]

選項:
  -j, --json          以 JSON 格式輸出
  -k, --key <name>    使用特定的 API key
```

#### `watch` - 持續監控模式
啟動持續監控模式，定期檢查 rate limit 狀態。

```bash
openrouter-monitor watch [options]

選項:
  -i, --interval <seconds>  檢查間隔（預設: 60 秒）
  -w, --warn-threshold <n>  警告閾值百分比（預設: 80）
  -a, --alert-threshold <n> 警報閾值百分比（預設: 95）
  -q, --quiet              只顯示警告和錯誤
  -n, --notify             啟用系統通知
```

**監控輸出範例:**
```
🔄 Monitoring OpenRouter API (Press Ctrl+C to stop)
───────────────────────────────────────────────────────

[2024-01-15 14:30:15] ✅ Healthy - 15/20 requests used (75%)
[2024-01-15 14:31:15] ⚠️  Warning - 17/20 requests used (85%)
[2024-01-15 14:32:15] 🚨 Alert - 19/20 requests used (95%)
```

### API Key 管理

#### `keys list` - 列出所有 API Key
```bash
openrouter-monitor keys list
```

#### `keys add` - 新增 API Key
```bash
openrouter-monitor keys add <name> <key>

# 範例
openrouter-monitor keys add production sk-or-v1-abc123...
openrouter-monitor keys add development sk-or-v1-def456...
```

#### `keys remove` - 移除 API Key
```bash
openrouter-monitor keys remove <name>
```

#### `keys test` - 測試 API Key
```bash
openrouter-monitor keys test <name>
```

#### `keys current` - 顯示目前使用的 Key
```bash
openrouter-monitor keys current
```

### 歷史記錄

#### `history` - 查看使用歷史
```bash
openrouter-monitor history [options]

選項:
  -d, --days <n>       顯示最近 n 天（預設: 7）
  -k, --key <name>     特定 API key 的歷史
  -f, --format <type>  輸出格式: table|json|csv（預設: table）
  --export <file>      匯出到檔案
```

#### `history clear` - 清除歷史記錄
```bash
openrouter-monitor history clear [options]

選項:
  --older-than <days>  只清除指定天數之前的記錄
  --confirm           跳過確認提示
```

### 配置管理

#### `config show` - 顯示目前配置
```bash
openrouter-monitor config show
```

#### `config set` - 設定配置值
```bash
openrouter-monitor config set <key> <value>

# 常用配置
openrouter-monitor config set default-interval 30
openrouter-monitor config set warn-threshold 75
openrouter-monitor config set alert-threshold 90
openrouter-monitor config set notification-enabled true
```

#### `config reset` - 重置配置
```bash
openrouter-monitor config reset
```

## 配置檔案

### 全域配置檔案
- Linux/macOS: `~/.config/openrouter-monitor/config.json`
- Windows: `%APPDATA%/openrouter-monitor/config.json`

### 專案配置檔案
在專案根目錄建立 `.openrouter-monitor.json`:

```json
{
  "defaultKey": "production",
  "interval": 60,
  "warnThreshold": 80,
  "alertThreshold": 95,
  "notificationEnabled": true,
  "quiet": false
}
```

### 環境變數
```bash
OPENROUTER_API_KEY=your_default_api_key
OPENROUTER_MONITOR_INTERVAL=60
OPENROUTER_MONITOR_WARN_THRESHOLD=80
OPENROUTER_MONITOR_ALERT_THRESHOLD=95
```

## 使用範例

### 開發環境監控
```bash
# 設定開發環境 API Key
openrouter-monitor keys add dev sk-or-v1-dev123...

# 啟動低頻監控
openrouter-monitor watch --interval 120 --key dev
```

### 生產環境監控
```bash
# 設定生產環境 API Key
openrouter-monitor keys add prod sk-or-v1-prod456...

# 啟動高頻監控，啟用通知
openrouter-monitor watch --interval 30 --key prod --notify
```

### CI/CD 整合
```bash
#!/bin/bash
# 在部署前檢查 API 配額

# 檢查剩餘配額
REMAINING=$(openrouter-monitor status --json | jq '.limits.free.remaining')

if [ "$REMAINING" -lt 50 ]; then
  echo "❌ 警告：API 配額不足 ($REMAINING 次剩餘)"
  exit 1
fi

echo "✅ API 配額充足，繼續部署"
```

### 多專案管理
```bash
# 專案 A
cd project-a
echo '{"defaultKey": "project-a"}' > .openrouter-monitor.json
openrouter-monitor keys add project-a sk-or-v1-...

# 專案 B  
cd ../project-b
echo '{"defaultKey": "project-b"}' > .openrouter-monitor.json
openrouter-monitor keys add project-b sk-or-v1-...
```

### 批次檢查多個 Key
```bash
# 檢查所有 Key 的狀態
for key in $(openrouter-monitor keys list --names-only); do
  echo "檢查 $key:"
  openrouter-monitor status --key "$key"
  echo "---"
done
```

## 故障排除

### 常見問題

#### 1. "API Key not found" 錯誤
```bash
# 檢查目前的 Key
openrouter-monitor keys list

# 設定預設 Key
openrouter-monitor keys add default YOUR_API_KEY
```

#### 2. "Network error" 錯誤
```bash
# 測試網路連接
openrouter-monitor keys test default

# 檢查 OpenRouter 服務狀態
curl -I https://openrouter.ai/api/v1/auth/key
```

#### 3. "Permission denied" 錯誤
```bash
# 檢查檔案權限
ls -la ~/.config/openrouter-monitor/

# 重新建立配置目錄
rm -rf ~/.config/openrouter-monitor/
openrouter-monitor config show
```

#### 4. 監控停止運作
```bash
# 檢查程序
ps aux | grep openrouter-monitor

# 重啟監控
openrouter-monitor watch --interval 60
```

### 除錯模式
```bash
# 啟用詳細日誌
DEBUG=openrouter-monitor:* openrouter-monitor status

# 儲存日誌到檔案
openrouter-monitor watch --verbose 2>&1 | tee monitor.log
```

### 效能問題
```bash
# 降低檢查頻率
openrouter-monitor watch --interval 300  # 5 分鐘一次

# 使用 quiet 模式減少輸出
openrouter-monitor watch --quiet
```

## 最佳實踐

### 1. API Key 管理
- 不要在程式碼中硬編碼 API Key
- 為不同環境使用不同的 Key
- 定期輪換 API Key
- 使用環境變數或配置檔案

### 2. 監控策略
- 開發環境：低頻監控（5-10 分鐘）
- 測試環境：中頻監控（2-5 分鐘）
- 生產環境：高頻監控（30 秒-2 分鐘）

### 3. 警報設定
- 警告閾值：75-80%
- 警報閾值：90-95%
- 啟用系統通知（生產環境）

### 4. 歷史記錄
- 定期匯出歷史資料
- 設定資料保留策略
- 監控使用趨勢

### 5. 自動化整合
```bash
# 定時任務範例（crontab）
*/5 * * * * /usr/local/bin/openrouter-monitor status --json > /var/log/openrouter-status.log

# systemd 服務範例
[Unit]
Description=OpenRouter Monitor
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/openrouter-monitor watch --interval 60
Restart=always

[Install]
WantedBy=multi-user.target
```

### 6. 安全考量
- 定期檢查 API Key 權限
- 監控異常使用模式  
- 使用最小權限原則
- 記錄所有 API 呼叫

## 進階功能

### 自訂輸出格式
```bash
# 自訂 JSON 輸出
openrouter-monitor status --json | jq '.usage.percentage'

# CSV 格式匯出
openrouter-monitor history --format csv --export usage.csv
```

### 腳本整合
```javascript
const { exec } = require('child_process');

// 檢查 API 狀態的 Node.js 函數
function checkAPIStatus() {
  return new Promise((resolve, reject) => {
    exec('openrouter-monitor status --json', (error, stdout) => {
      if (error) reject(error);
      else resolve(JSON.parse(stdout));
    });
  });
}
```

### 監控 Dashboard
結合其他工具建立監控面板：
- Grafana + InfluxDB
- Prometheus + Grafana  
- Datadog 整合
- New Relic 整合

## 支援與社群

- GitHub Issues: [提交問題](https://github.com/yourusername/openrouter-rate-limit-monitor/issues)
- 功能請求: [功能建議](https://github.com/yourusername/openrouter-rate-limit-monitor/discussions)
- 文件貢獻: [改善文件](https://github.com/yourusername/openrouter-rate-limit-monitor/pulls)

## 更新日誌

查看 [CHANGELOG.md](./CHANGELOG.md) 以獲取版本更新資訊。

## 授權

本專案採用 MIT 授權，詳見 [LICENSE](./LICENSE) 檔案。