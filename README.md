# OpenRouter Rate Limit Monitor

一個可攜式的 OpenRouter API 速率限制監控 CLI 工具，可輕鬆移植到任何專案使用。

[![npm version](https://badge.fury.io/js/openrouter-rate-limit-monitor.svg)](https://badge.fury.io/js/openrouter-rate-limit-monitor)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js CI](https://github.com/Gamepig/openrouter-rate-limit-monitor/workflows/Node.js%20CI/badge.svg)](https://github.com/Gamepig/openrouter-rate-limit-monitor/actions)

## ✨ 特色功能

- 🔍 **即時監控** - 即時查看 OpenRouter API 的 rate limit 狀態
- 📊 **詳細統計** - 顯示使用量、剩餘配額和歷史趨勢
- 🔄 **持續監控** - 背景監控模式，自動警報
- 🔑 **多 Key 管理** - 支援多組 API Key 管理和切換
- 📱 **跨平台** - 支援 Windows、macOS、Linux
- 🚀 **可攜式** - 可輕鬆移植到任何專案目錄使用
- 🎨 **美觀輸出** - 彩色終端輸出和表格格式化

## 🚀 快速開始

### 安裝

```bash
# 全域安裝
npm install -g openrouter-rate-limit-monitor

# 或在專案內安裝
npm install openrouter-rate-limit-monitor
```

### 基本使用

```bash
# 1. 設定 API Key
openrouter-monitor keys add default YOUR_OPENROUTER_API_KEY

# 2. 檢查狀態
openrouter-monitor status

# 3. 開始監控
openrouter-monitor watch
```

## 📋 主要指令

| 指令 | 說明 | 範例 |
|------|------|------|
| `status` | 顯示目前 API 狀態 | `openrouter-monitor status` |
| `limits` | 查看詳細限制資訊 | `openrouter-monitor limits` |
| `watch` | 持續監控模式 | `openrouter-monitor watch --interval 30` |
| `keys` | 管理 API Keys | `openrouter-monitor keys list` |
| `history` | 查看使用歷史 | `openrouter-monitor history --days 7` |
| `config` | 配置管理 | `openrouter-monitor config show` |

## 📊 輸出範例

### 狀態檢查
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

### 監控模式
```
🔄 Monitoring OpenRouter API (Press Ctrl+C to stop)
───────────────────────────────────────────────────────

[2024-01-15 14:30:15] ✅ Healthy - 15/20 requests used (75%)
[2024-01-15 14:31:15] ⚠️  Warning - 17/20 requests used (85%)
[2024-01-15 14:32:15] 🚨 Alert - 19/20 requests used (95%)
```

## 🔧 配置選項

### 環境變數
```bash
export OPENROUTER_API_KEY=your_api_key
export OPENROUTER_MONITOR_INTERVAL=60
export OPENROUTER_MONITOR_WARN_THRESHOLD=80
```

### 配置檔案
在專案根目錄建立 `.openrouter-monitor.json`:
```json
{
  "defaultKey": "production",
  "interval": 60,
  "warnThreshold": 80,
  "alertThreshold": 95,
  "notificationEnabled": true
}
```

## 🎯 使用場景

### 開發團隊
- 監控共享 API 配額使用情況
- 防止超過 rate limit 導致服務中斷
- 追蹤不同專案的 API 使用量

### CI/CD 整合
```bash
# 部署前檢查 API 配額
if ! openrouter-monitor status --json | jq -e '.limits.free.remaining > 50'; then
  echo "❌ API 配額不足，停止部署"
  exit 1
fi
```

### 生產環境監控
```bash
# 使用 systemd 或 pm2 持續監控
openrouter-monitor watch --interval 30 --notify
```

## 📚 詳細文件

- [📖 詳細使用指南](./USAGE.md) - 完整的使用說明和範例
- [🔧 API 參考](./docs/API_REFERENCE.md) - API 介面文件
- [🚀 安裝指南](./docs/INSTALLATION.md) - 安裝和部署說明

## 🛠️ 開發

### 本地開發
```bash
git clone https://github.com/yourusername/openrouter-rate-limit-monitor.git
cd openrouter-rate-limit-monitor
npm install
npm link  # 建立全域連結
```

### 測試
```bash
npm test           # 執行測試
npm run test:watch # 監控模式測試
npm run lint       # 程式碼檢查
```

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

1. Fork 專案
2. 建立功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交變更 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 開啟 Pull Request

## 📄 授權

本專案採用 MIT 授權 - 查看 [LICENSE](LICENSE) 檔案了解詳情。

## 🙏 致謝

- [OpenRouter](https://openrouter.ai/) - 提供優秀的 AI API 服務
- [Commander.js](https://github.com/tj/commander.js/) - CLI 框架
- [Chalk](https://github.com/chalk/chalk) - 終端顏色處理

## 📞 支援

- 🐛 [回報問題](https://github.com/yourusername/openrouter-rate-limit-monitor/issues)
- 💡 [功能建議](https://github.com/yourusername/openrouter-rate-limit-monitor/discussions)
- 📧 聯絡作者: your.email@example.com

---

**⭐ 如果這個工具對你有幫助，請給個 Star！**