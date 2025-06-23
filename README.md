# OpenRouter Rate Limit Monitor

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-16%2B-green.svg)](https://nodejs.org/)
[![GitHub Stars](https://img.shields.io/github/stars/Gamepig/openrouter-rate-limit-monitor?style=social)](https://github.com/Gamepig/openrouter-rate-limit-monitor)

🎯 **企業級 OpenRouter API 監控工具** - 可攜式 CLI 工具，精確追蹤額度使用、Rate Limit 和帳戶狀態

## 🎉 v1.1.0 重大更新 - 額度顯示完全修復！

✅ **準確追蹤實際消費** - 整合 OpenRouter `/credits` API，顯示真實帳戶餘額  
✅ **完整監控體驗** - 從 `Credits: 0.21` 升級為 `Used: $0.21 | Left: $14.79`  
✅ **企業級穩定性** - 解決所有已知問題，生產環境就緒

## ✨ 核心特色

- 💰 **準確額度追蹤** - 即時顯示已用/剩餘額度，與 OpenRouter 官網完全一致
- 📊 **智慧 Rate Limit 監控** - 150 requests/10s 精確追蹤，支援警告和警報
- 🔄 **即時監控模式** - 持續背景監控，自動檢測使用異常
- 🔑 **安全 API Key 管理** - AES-256-GCM 加密儲存，支援多環境管理
- 📈 **詳細歷史追蹤** - 本地儲存使用記錄，支援匯出和分析
- 🎨 **專業 CLI 界面** - 彩色表格輸出，一目了然的狀態顯示
- 🚀 **可攜式設計** - 可輕鬆移植到任何專案目錄使用
- 🔔 **跨平台通知** - 支援 macOS、Linux、Windows 系統通知

## 🚀 快速開始

### 1. 安裝專案

```bash
# 複製專案
git clone https://github.com/Gamepig/openrouter-rate-limit-monitor.git
cd openrouter-rate-limit-monitor

# 安裝依賴
npm install
```

### 2. 設定 API Key

```bash
# 方法 1: 使用環境變數檔案（推薦）
cp .env.example .env
# 編輯 .env 檔案，設定你的 OPENROUTER_API_KEY

# 方法 2: 使用指令添加
node bin/openrouter-monitor.js keys add default YOUR_OPENROUTER_API_KEY

# 方法 3: 使用環境變數
export OPENROUTER_API_KEY=your_api_key
```

### 3. 開始使用

```bash
# 檢查 API 狀態
node bin/openrouter-monitor.js status

# 開始即時監控
./watch.sh

# 或直接使用 node
node bin/openrouter-monitor.js watch
```

## 📊 真實輸出展示

### API 狀態檢查
```
┌─────────────────────────────────────────────────────────┐
│                   OpenRouter API 狀態                   │
├──────────────┼──────────────────────────────────────────┤
│      API Key │ sk-or-v1****62b2                         │
│     服務層級 │ Paid                                     │
│     額度使用 │ 已用 $0.21 / 總額 $15.00 (剩餘 $14.79)   │ ← 🎯 準確顯示！
│   Rate Limit │ 0/150 (0%)                               │
│     每日限制 │ 付費帳戶無每日限制                       │
│     健康狀態 │ ✅ 系統運作正常 (0% 使用率)              │
│     最後檢查 │ 剛剛                                     │
└──────────────┴──────────────────────────────────────────┘
```

### 即時監控模式
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

## 📋 完整指令參考

### 基本指令
```bash
# 狀態檢查
node bin/openrouter-monitor.js status              # 基本狀態
node bin/openrouter-monitor.js status --verbose    # 詳細資訊
node bin/openrouter-monitor.js status --json       # JSON 格式
node bin/openrouter-monitor.js status --refresh    # 強制重新檢查

# 即時監控
node bin/openrouter-monitor.js watch                              # 基本監控
node bin/openrouter-monitor.js watch --interval 30               # 30秒間隔
node bin/openrouter-monitor.js watch --warn-threshold 70         # 警告閾值70%
node bin/openrouter-monitor.js watch --alert-threshold 90        # 警報閾值90%
node bin/openrouter-monitor.js watch --notify                    # 啟用系統通知
```

### API Key 管理
```bash
# Key 管理
node bin/openrouter-monitor.js keys list           # 列出所有 Key
node bin/openrouter-monitor.js keys add prod YOUR_KEY    # 添加 Key
node bin/openrouter-monitor.js keys remove dev     # 移除 Key
node bin/openrouter-monitor.js keys test prod      # 測試 Key 有效性
```

### 歷史記錄
```bash
# 歷史查詢
node bin/openrouter-monitor.js history show                    # 最近7天
node bin/openrouter-monitor.js history show --days 30         # 最近30天
node bin/openrouter-monitor.js history show --format json     # JSON格式
node bin/openrouter-monitor.js history show --export report.csv  # 匯出CSV
```

### 配置管理
```bash
# 配置管理
node bin/openrouter-monitor.js config show                # 顯示當前配置
node bin/openrouter-monitor.js config set interval 45    # 設定檢查間隔
node bin/openrouter-monitor.js config reset              # 重置為預設值
```

## 🔧 進階使用

### 一鍵啟動腳本
使用提供的 `watch.sh` 腳本快速啟動監控：

```bash
# 基本使用（使用 .env 中的 API Key）
./watch.sh

# 指定參數
./watch.sh your-api-key 30 80 95
# 參數順序：API Key, 間隔秒數, 警告閾值, 警報閾值
```

### CI/CD 整合
```bash
#!/bin/bash
# 部署前檢查 API 配額
STATUS=$(node bin/openrouter-monitor.js status --json)
REMAINING=$(echo $STATUS | jq -r '.usage.remaining_credits')

if (( $(echo "$REMAINING < 5" | bc -l) )); then
    echo "❌ API 餘額不足 ($REMAINING)，停止部署"
    exit 1
fi

echo "✅ API 餘額充足 ($REMAINING)，繼續部署"
```

### 生產環境監控
```bash
# 使用 PM2 持續監控
npm install -g pm2
pm2 start bin/openrouter-monitor.js --name "openrouter-monitor" -- watch --interval 60 --notify

# 查看監控日誌
pm2 logs openrouter-monitor

# 重啟監控服務
pm2 restart openrouter-monitor
```

## 🎯 使用場景

### 🏢 開發團隊
- 監控共享 API 配額，避免超額停機
- 追蹤不同專案的 API 消費情況
- 建立使用基準線和成本控制

### 🚀 生產環境
- 持續監控防止服務中斷
- 自動警報和通知機制
- 詳細的使用記錄和統計分析

### 💰 成本管理
- 精確追蹤 API 花費
- 設定預算警告和限制
- 匯出報告進行財務分析

## 📚 完整文件

- 📖 [功能說明與使用指南](./docs/FEATURES_AND_USAGE.md) - 13.7KB 詳細使用說明
- 🔧 [技術細節文件](./docs/TECHNICAL_DETAILS.md) - 25.2KB 技術架構說明  
- ⚠️ [限制與改善計劃](./docs/LIMITATIONS_AND_IMPROVEMENTS.md) - 11.0KB 發展藍圖
- 📋 [更新日誌](./docs/CHANGELOG.md) - 完整版本變更記錄
- 📄 [基本使用指南](./USAGE.md) - 快速上手指南

## 🏗️ 技術架構

### 系統需求
- **Node.js**: 16.0.0 或更高版本
- **作業系統**: Windows、macOS、Linux
- **OpenRouter API Key**: 免費或付費帳戶

### 核心依賴
```json
{
  "axios": "^1.6.2",           // HTTP 請求處理
  "chalk": "^4.1.2",           // 終端顏色輸出
  "commander": "^11.1.0",      // CLI 框架
  "node-json-db": "^2.3.0",    // 本地資料庫
  "ora": "^5.4.1",             // 載入動畫
  "table": "^6.8.1"            // 表格格式化
}
```

### 專案結構
```
openrouter-rate-limit-monitor/
├── bin/                     # CLI 入口點
│   └── openrouter-monitor.js
├── src/                     # 核心程式碼
│   ├── commands/           # 指令處理器
│   ├── services/           # 業務邏輯服務
│   └── index.js            # 主要模組
├── docs/                   # 完整文件
├── config/                 # 配置檔案
├── .env.example           # 環境變數範例
├── watch.sh               # 一鍵啟動腳本
└── package.json           # 專案配置
```

## 🛠️ 開發貢獻

### 本地開發環境
```bash
# 複製專案
git clone https://github.com/Gamepig/openrouter-rate-limit-monitor.git
cd openrouter-rate-limit-monitor

# 安裝依賴
npm install

# 運行測試
npm test

# 程式碼檢查
npm run lint
```

### 貢獻指南
1. Fork 專案到你的 GitHub 帳戶
2. 建立功能分支：`git checkout -b feature/amazing-feature`
3. 提交變更：`git commit -m 'Add amazing feature'`
4. 推送分支：`git push origin feature/amazing-feature` 
5. 開啟 Pull Request

### 優先貢獻項目
- 🔍 **新 API 端點測試** - 探索 OpenRouter 更多功能
- 💰 **價格資料維護** - 更新模型價格資訊
- 🧪 **測試覆蓋率** - 增加單元測試和整合測試
- 📚 **文件完善** - 改善使用說明和範例

## 🚨 故障排除

### 常見問題

**Q: API Key 無效錯誤**
```bash
# 檢查 API Key 格式
node bin/openrouter-monitor.js keys test default

# 確認環境變數
echo $OPENROUTER_API_KEY
```

**Q: 網路連線問題**
```bash
# 測試網路連線
curl -H "Authorization: Bearer YOUR_API_KEY" https://openrouter.ai/api/v1/auth/key
```

**Q: 配置目錄權限問題**
```bash
# 手動建立配置目錄
mkdir -p ~/.config/openrouter-monitor
chmod 755 ~/.config/openrouter-monitor
```

### 除錯模式
```bash
# 啟用詳細日誌
node bin/openrouter-monitor.js status --verbose

# 檢查配置
node bin/openrouter-monitor.js config show

# JSON 格式輸出
node bin/openrouter-monitor.js status --json
```

## 📄 授權與致謝

### 授權
本專案採用 **MIT 授權** - 查看 [LICENSE](LICENSE) 檔案了解詳情

### 致謝
- 🤖 [OpenRouter](https://openrouter.ai/) - 提供優秀的 AI API 聚合服務
- ⚙️ [Commander.js](https://github.com/tj/commander.js/) - 強大的 CLI 開發框架
- 🎨 [Chalk](https://github.com/chalk/chalk) - 終端顏色美化工具
- 📊 [Table](https://github.com/gajus/table) - 專業表格格式化

## 📞 支援與聯絡

- 🐛 **問題回報**: [GitHub Issues](https://github.com/Gamepig/openrouter-rate-limit-monitor/issues)
- 💬 **功能討論**: [GitHub Discussions](https://github.com/Gamepig/openrouter-rate-limit-monitor/discussions)
- 📧 **聯絡作者**: [GitHub Profile](https://github.com/Gamepig)

## 🏆 專案狀態

- ✅ **主要功能**: 100% 完成，生產環境就緒
- ✅ **文件完整性**: 企業級文件，總計 50+ KB
- ✅ **安全性**: API Key 加密儲存，無敏感資訊洩露
- ✅ **跨平台**: 支援 Windows、macOS、Linux
- ✅ **維護狀態**: 積極維護，歡迎貢獻

---

## 🌟 立即開始

```bash
git clone https://github.com/Gamepig/openrouter-rate-limit-monitor.git
cd openrouter-rate-limit-monitor
npm install
cp .env.example .env
# 編輯 .env 設定你的 API Key
./watch.sh
```

**⭐ 如果這個工具對你有幫助，請給個 Star 支持我們！**

---

*最後更新: 2025-06-24 | 版本: 1.1.0 | 維護者: [Gamepig](https://github.com/Gamepig)*