# OpenRouter Rate Limit Monitor - 功能說明與使用指南

## 📋 目錄

- [專案概述](#專案概述)
- [核心功能](#核心功能)
- [安裝與設定](#安裝與設定)
- [詳細使用說明](#詳細使用說明)
- [已知限制](#已知限制)
- [故障排除](#故障排除)
- [進階使用](#進階使用)

## 🎉 重大更新 (2025-06-24)

**✅ 額度顯示問題已完全解決！**

通過深入研究 OpenRouter 官方文件，成功整合 `/credits` API 端點，現在可以**準確顯示**：
- 💰 **實際帳戶餘額**: 顯示總額度、已使用、剩餘額度
- 📊 **正確 Rate Limit**: 從 API 實際獲取限制資訊 (150 requests/10s)
- 🎯 **精準每日限制**: 根據購買額度正確判斷 (1000/50 requests/day)

**更新前**: `額度使用: 0.00 (付費帳戶 - 無使用限制)`  
**更新後**: `額度使用: 已用 $0.21 / 總額 $15.00 (剩餘 $14.79)` ← 🎯 完全準確！

## 專案概述

OpenRouter Rate Limit Monitor 是一個可攜式的 CLI 工具，專門用於監控 OpenRouter API 的使用狀況和速率限制。本工具提供即時監控、歷史記錄追蹤、多 API Key 管理等功能，適合開發者和團隊使用。

### 特色

- ✅ **即時監控**: 持續監控 API 使用狀況
- ✅ **準確解析**: 正確顯示 Rate Limit 和帳戶狀態
- ✅ **可攜式設計**: 可輕鬆移植到任何專案目錄
- ✅ **多 Key 管理**: 支援多組 API Key 管理
- ✅ **歷史追蹤**: 本地儲存使用歷史記錄
- ✅ **跨平台**: 支援 Windows、macOS、Linux

## 核心功能

### 1. API 狀態檢查 (`status`)

**功能說明**: 顯示當前 OpenRouter API 的狀態資訊

**使用方法**:
```bash
# 基本狀態檢查
node bin/openrouter-monitor.js status

# 強制重新檢查（忽略快取）
node bin/openrouter-monitor.js status --refresh

# 顯示詳細資訊
node bin/openrouter-monitor.js status --verbose

# JSON 格式輸出
node bin/openrouter-monitor.js status --json
```

**輸出範例**:
```
┌─────────────────────────────────────────────────────────┐
│                   OpenRouter API 狀態                   │
├──────────────┼──────────────────────────────────────────┤
│      API Key │ sk-or-v1****62b2                         │
│     服務層級 │ Paid                                     │
│     額度使用 │ 已用 $0.21 / 總額 $15.00 (剩餘 $14.79)   │ ← 🎯 準確顯示！
│   Rate Limit │ 0/150 (0%)                               │ ← 🎯 實際限制！
│     每日限制 │ 付費帳戶無每日限制                       │ ← 🎯 正確判斷！
│     健康狀態 │ ✅ 系統運作正常 (0% 使用率)              │
│     最後檢查 │ 剛剛                                     │
└──────────────┴──────────────────────────────────────────┘
```

**顯示資訊說明**:
- **API Key**: 遮蔽後的 API 金鑰（安全顯示）
- **服務層級**: Free 或 Paid（根據 `is_free_tier` 判斷）
- **額度使用**: 當前使用量（付費帳戶顯示無限制）
- **Rate Limit**: 當前/總限制（從 API 實際獲取，如 150 requests/10s）
- **每日限制**: 每日請求限制（付費帳戶通常無限制）
- **健康狀態**: 根據使用率計算的狀態指標

### 2. 即時監控 (`watch`)

**功能說明**: 持續監控 API 使用狀況，自動檢測警告和警報

**使用方法**:
```bash
# 基本監控（預設 60 秒間隔）
node bin/openrouter-monitor.js watch

# 自訂檢查間隔
node bin/openrouter-monitor.js watch --interval 30

# 設定警告和警報閾值
node bin/openrouter-monitor.js watch --warn-threshold 70 --alert-threshold 90

# 啟用系統通知
node bin/openrouter-monitor.js watch --notify

# 安靜模式（只顯示警告和錯誤）
node bin/openrouter-monitor.js watch --quiet
```

**輸出範例**:
```
🔄 OpenRouter API 監控啟動
檢查間隔: 30 秒
警告閾值: 80%
警報閾值: 95%
按 Ctrl+C 停止監控

────────────────────────────────────────────────────────────
[2025/6/24 上午1:00:58] ✅ Healthy - Rate: 0/150 (0%) | Daily: ∞ | Used: $0.21 | Left: $14.79
[2025/6/24 上午1:01:03] ✅ Healthy - Rate: 2/150 (1%) ↑2 | Daily: ∞ | Used: $0.23 ↑$0.02 | Left: $14.77
[2025/6/24 上午1:02:06] ⚠️  Warning - Rate: 125/150 (83%) ↑123 | Daily: ∞ | Used: $2.45 ↑$2.22 | Left: $12.55
```

**監控指標說明**:
- **狀態圖示**: ✅ Healthy / ⚠️ Warning / 🚨 Critical
- **Rate Limit**: 當前/總限制（百分比）
- **變化指標**: ↑ 增加 / ↓ 減少（與上次檢查比較）
- **Daily**: 每日限制使用情況（∞ = 無限制）
- **Used**: 已使用額度（實時追蹤）
- **Left**: 剩餘額度（即時計算）

### 3. API Key 管理 (`keys`)

**功能說明**: 管理多組 OpenRouter API Keys

**使用方法**:
```bash
# 顯示所有已儲存的 API Keys
node bin/openrouter-monitor.js keys list

# 新增 API Key
node bin/openrouter-monitor.js keys add production sk-or-v1-your-production-key
node bin/openrouter-monitor.js keys add development sk-or-v1-your-dev-key

# 移除 API Key
node bin/openrouter-monitor.js keys remove development

# 測試 API Key 是否有效
node bin/openrouter-monitor.js keys test production

# 顯示當前使用的 API Key
node bin/openrouter-monitor.js keys current
```

**Key 管理特色**:
- **加密儲存**: API Keys 使用 AES-256-GCM 加密儲存
- **安全顯示**: 顯示時自動遮蔽敏感部分
- **多環境支援**: 支援開發、測試、生產等多環境管理
- **使用追蹤**: 記錄每個 Key 的最後使用時間

### 4. 使用歷史 (`history`)

**功能說明**: 查看和管理 API 使用歷史記錄

**使用方法**:
```bash
# 顯示最近 7 天的使用歷史
node bin/openrouter-monitor.js history show

# 顯示最近 30 天的歷史
node bin/openrouter-monitor.js history show --days 30

# 以不同格式輸出
node bin/openrouter-monitor.js history show --format table   # 表格格式（預設）
node bin/openrouter-monitor.js history show --format json    # JSON 格式
node bin/openrouter-monitor.js history show --format csv     # CSV 格式

# 匯出歷史記錄到檔案
node bin/openrouter-monitor.js history show --export usage-report.csv

# 清除歷史記錄
node bin/openrouter-monitor.js history clear

# 只清除 30 天前的記錄
node bin/openrouter-monitor.js history clear --older-than 30

# 跳過確認提示
node bin/openrouter-monitor.js history clear --confirm
```

**歷史記錄內容**:
- 時間戳記和日期
- API Key 使用情況（雜湊後儲存）
- Rate Limit 使用統計
- 每日/每月限制使用情況
- 系統健康狀態變化
- 警報和警告記錄

### 5. 配置管理 (`config`)

**功能說明**: 管理監控工具的配置設定

**使用方法**:
```bash
# 顯示當前配置
node bin/openrouter-monitor.js config show

# 設定配置值
node bin/openrouter-monitor.js config set interval 45
node bin/openrouter-monitor.js config set warnThreshold 75
node bin/openrouter-monitor.js config set alertThreshold 90

# 重置所有配置到預設值
node bin/openrouter-monitor.js config reset

# 跳過確認提示
node bin/openrouter-monitor.js config reset --confirm
```

**可配置項目**:
- `interval`: 監控檢查間隔（秒）
- `warnThreshold`: 警告閾值（百分比）
- `alertThreshold`: 警報閾值（百分比）
- `notificationEnabled`: 是否啟用系統通知
- `historyRetentionDays`: 歷史記錄保留天數

## 安裝與設定

### 系統需求

- Node.js 16.0.0 或更高版本
- npm 或 yarn 套件管理器
- 有效的 OpenRouter API Key

### 快速安裝

1. **下載專案**:
```bash
git clone https://github.com/Gamepig/openrouter-rate-limit-monitor.git
cd openrouter-rate-limit-monitor
```

2. **安裝依賴**:
```bash
npm install
```

3. **設定 API Key**:
```bash
# 方法 1: 使用 .env 檔案
cp .env.example .env
# 編輯 .env 檔案，設定 OPENROUTER_API_KEY

# 方法 2: 使用指令添加
node bin/openrouter-monitor.js keys add default your-api-key

# 方法 3: 使用環境變數
export OPENROUTER_API_KEY=your-api-key
```

4. **測試安裝**:
```bash
node bin/openrouter-monitor.js status
```

### 一鍵啟動腳本

使用提供的 `watch.sh` 腳本快速啟動監控：

```bash
# 基本使用
./watch.sh

# 指定參數
./watch.sh your-api-key 30 80 95
# 參數順序：API Key, 間隔秒數, 警告閾值, 警報閾值
```

腳本特色：
- 自動檢查系統環境
- 自動安裝依賴（如果需要）
- 自動載入 .env 配置
- 互動式 API Key 設定
- 彩色輸出和使用者友好提示

## 已知限制

### 1. 💰 額度使用量顯示限制

**問題描述**: 
OpenRouter API 的 `/auth/key` 端點回傳的 `usage` 欄位可能不反映實際的帳戶消費金額。

**具體表現**:
- API 回傳 `usage: 0`，但實際帳戶可能有消費記錄
- 付費帳戶可能顯示 0.00，但網頁界面顯示實際消費

**可能原因**:
1. **計費週期差異**: API 統計週期與帳單週期不同
2. **統計範圍限制**: 只統計特定類型的 API 呼叫
3. **即時性問題**: 可能有延遲或只顯示當前會話使用量
4. **端點限制**: `/auth/key` 端點主要用於權限驗證，非帳單查詢

**目前解決方案**:
- 正確顯示帳戶類型（Free/Paid）
- 準確顯示 Rate Limit 資訊
- 標註「付費帳戶 - 無使用限制」以區分免費用戶
- 提供本地使用追蹤（記錄 API 呼叫次數）

**未來改善計劃**:
1. 研究 OpenRouter 是否提供專門的帳單 API
2. 整合 `/generation` 端點進行詳細使用量統計
3. 實作本地消費估算功能
4. 添加手動同步帳單資訊的功能

### 2. 🕒 即時使用量追蹤

**限制**: 無法追蹤其他應用程式的 API 使用量
**影響**: Rate Limit 使用量可能不包含所有來源的請求
**解決方案**: 使用本工具進行一段時間監控，建立使用模式基準

### 3. 📊 歷史統計精確性

**限制**: 依賴本地記錄，無法獲取工具啟用前的歷史
**影響**: 統計分析可能不完整
**解決方案**: 長期使用本工具累積準確的歷史數據

## 故障排除

### 常見問題與解決方案

#### 1. API Key 錯誤
```
❌ API Key 無效或已過期
```
**解決方案**:
- 檢查 API Key 格式（應為 `sk-or-v1-...`）
- 確認 API Key 在 OpenRouter 後台是否有效
- 使用 `keys test` 指令驗證

#### 2. 網路連線問題
```
❌ 網路錯誤: ECONNABORTED
```
**解決方案**:
- 檢查網路連線
- 確認防火牆設定
- 檢查代理伺服器設定

#### 3. 權限錯誤
```
❌ 配置目錄創建失敗
```
**解決方案**:
- 檢查目錄權限
- 手動創建配置目錄：`~/.config/openrouter-monitor`

#### 4. 資料庫錯誤
```
❌ DataError: Can't find dataPath
```
**解決方案**:
- 已在最新版本修復
- 如果仍出現，刪除配置目錄重新初始化

### 除錯模式

啟用詳細日誌：
```bash
node bin/openrouter-monitor.js status --verbose
```

檢查配置：
```bash
node bin/openrouter-monitor.js config show
```

## 進階使用

### 1. CI/CD 整合

**部署前檢查 API 配額**:
```bash
#!/bin/bash
STATUS=$(node bin/openrouter-monitor.js status --json)
HEALTH=$(echo $STATUS | jq -r '.health.status')

if [ "$HEALTH" != "healthy" ]; then
    echo "❌ API 狀態異常，停止部署"
    exit 1
fi

echo "✅ API 狀態正常，繼續部署"
```

### 2. 生產環境監控

**使用 PM2 持續監控**:
```bash
# 安裝 PM2
npm install -g pm2

# 啟動監控
pm2 start bin/openrouter-monitor.js --name "openrouter-monitor" -- watch --interval 60 --notify

# 查看日誌
pm2 logs openrouter-monitor

# 重啟服務
pm2 restart openrouter-monitor
```

### 3. 自動化腳本

**每日報告腳本**:
```bash
#!/bin/bash
DATE=$(date +%Y-%m-%d)
node bin/openrouter-monitor.js history show --days 1 --export daily-report-$DATE.csv
echo "📊 每日報告已產生：daily-report-$DATE.csv"
```

### 4. 多環境管理

**團隊協作設定**:
```bash
# 開發環境
node bin/openrouter-monitor.js keys add dev sk-or-v1-dev-key

# 測試環境  
node bin/openrouter-monitor.js keys add staging sk-or-v1-staging-key

# 生產環境
node bin/openrouter-monitor.js keys add production sk-or-v1-production-key

# 切換環境監控
node bin/openrouter-monitor.js watch --key production
```

### 5. 自訂通知

**整合 Slack 通知**:
```bash
# 監控腳本中添加
if [ $USAGE_PERCENT -gt 90 ]; then
    curl -X POST -H 'Content-type: application/json' \
    --data '{"text":"⚠️ OpenRouter API 使用率過高: '$USAGE_PERCENT'%"}' \
    YOUR_SLACK_WEBHOOK_URL
fi
```

## 技術架構

### 專案結構
```
openrouter-rate-limit-monitor/
├── bin/                    # CLI 入口點
│   └── openrouter-monitor.js
├── src/                    # 核心程式碼
│   ├── commands/          # 指令處理器
│   ├── services/          # 業務邏輯服務
│   └── index.js           # 主要模組
├── docs/                  # 文件
├── package.json           # 專案配置
├── .env.example          # 環境變數範例
└── watch.sh              # 一鍵啟動腳本
```

### 核心類別
- **OpenRouterMonitor**: 主要監控類別
- **RateLimitService**: API 通訊服務
- **ConfigManager**: 配置管理
- **HistoryTracker**: 歷史記錄追蹤

### 資料儲存
- **配置檔**: `~/.config/openrouter-monitor/config.json`
- **API Keys**: `~/.config/openrouter-monitor/keys.json` (加密)
- **歷史記錄**: `~/.config/openrouter-monitor/history.json`
- **警報記錄**: `~/.config/openrouter-monitor/alerts.json`

---

## 🚀 立即開始

1. **複製專案**: `git clone https://github.com/Gamepig/openrouter-rate-limit-monitor.git`
2. **安裝依賴**: `npm install`
3. **設定 API Key**: `node bin/openrouter-monitor.js keys add default your-key`
4. **開始監控**: `./watch.sh`

**需要幫助？** 查看 [故障排除](#故障排除) 或提交 [GitHub Issue](https://github.com/Gamepig/openrouter-rate-limit-monitor/issues)

---

*最後更新: 2025-06-24*
*版本: 1.0.0*