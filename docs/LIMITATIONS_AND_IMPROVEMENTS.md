# OpenRouter Rate Limit Monitor - 已知限制與改善計劃

## 📋 目錄

- [當前限制說明](#當前限制說明)
- [技術限制分析](#技術限制分析)
- [改善方案研究](#改善方案研究)
- [開發路線圖](#開發路線圖)
- [社群貢獻指南](#社群貢獻指南)

## ✅ 重大更新：主要限制已解決 (2025-06-24)

### 🎉 額度使用量顯示問題 - 已完全解決！

#### 解決方案
通過深入研究 OpenRouter 官方文件，發現了專門的 `/credits` API 端點並成功整合。

#### 解決前後對比
```bash
# 解決前 ❌
│     額度使用 │ 0.00 (付費帳戶 - 無使用限制)             │

# 解決後 ✅  
│     額度使用 │ 已用 $0.21 / 總額 $15.00 (剩餘 $14.79)   │

# OpenRouter 網頁顯示
Credits: $ 14.79  ← 完全一致！
```

#### 技術實作
- **雙 API 整合**: 同時調用 `/auth/key` 和 `/credits` 端點
- **並行請求**: 使用 `Promise.all` 提升效能  
- **準確計算**: 總額度 - 已使用 = 剩餘額度
- **智慧快取**: 30 秒快取避免過度請求

#### 現已完全解決
- ✅ **準確追蹤實際消費金額**
- ✅ **完整成本監控和預算控制**  
- ✅ **精確的使用趨勢分析**
- ✅ **Rate Limit 監控** (150 requests/10s)
- ✅ **帳戶類型識別** (Paid/Free)
- ✅ **API 狀態檢查**

### 🟡 剩餘次要限制

## 技術限制分析

### 1. OpenRouter API `/auth/key` 端點限制

#### API 回應格式分析
```json
{
  "data": {
    "label": "sk-or-v1-...",
    "limit": null,
    "usage": 0,           // ⚠️ 問題所在：總是回傳 0
    "is_provisioning_key": false,
    "limit_remaining": null,
    "is_free_tier": false,
    "rate_limit": {
      "requests": 150,
      "interval": "10s"
    }
  }
}
```

#### 端點用途分析
`/auth/key` 端點的設計目的：
- ✅ **API Key 驗證**: 確認金鑰有效性
- ✅ **權限檢查**: 確認存取權限
- ✅ **Rate Limit 資訊**: 提供請求限制
- ❌ **帳單查詢**: 非設計目的，不提供詳細消費

#### 可能的技術原因
1. **端點職責分離**: 認證端點與帳單端點分離
2. **隱私考量**: 避免在認證端點暴露敏感財務資訊
3. **快取策略**: 認證資訊可能高度快取，帳單資訊需即時性
4. **計費複雜性**: 不同模型、不同計費方式的複雜計算

### 2. 替代 API 端點調查

#### 已測試的端點
```bash
# ✅ 認證端點（有效但資訊有限）
GET /api/v1/auth/key
回應：基本認證資訊 + Rate Limit

# ❓ 生成端點（需要參數）
GET /api/v1/generation
錯誤：缺少必要參數 'id'

# ❓ 模型列表端點
GET /api/v1/models
狀態：未測試

# ❓ 可能的帳單端點
GET /api/v1/billing       # 推測，未確認
GET /api/v1/usage         # 推測，未確認
GET /api/v1/credits       # 推測，未確認
```

#### OpenRouter 文件研究結果
根據官方文件搜尋結果：
- 📄 **Usage Accounting**: 提及在 API 回應中包含使用資訊
- 📄 **Generation Endpoint**: 可能提供詳細的 token 統計
- 📄 **Parameters**: 支援 `usage: {include: true}` 參數
- ❓ **Billing API**: 未在公開文件中找到專門的帳單 API

### 3. 資料收集策略限制

#### 當前策略
```javascript
// 目前使用的方法
const response = await axios.get('/api/v1/auth/key', {
  headers: { 'Authorization': `Bearer ${apiKey}` }
});

// 獲得的資訊
- ✅ API Key 狀態
- ✅ 服務層級 (Free/Paid)
- ✅ Rate Limit (150 requests/10s)
- ❌ 實際消費金額
```

#### 限制分析
1. **單一端點依賴**: 只能從一個端點獲取資訊
2. **資訊類型受限**: 該端點非為帳單設計
3. **即時性問題**: 可能存在資料同步延遲
4. **權限範圍**: API Key 可能無帳單查詢權限

## 改善方案研究

### 🔍 方案一：探索其他 API 端點

#### 1.1 Generation API 深度整合
```javascript
// 研究方向：使用 generation endpoint
const generationResponse = await axios.get('/api/v1/generation', {
  params: { id: 'some-generation-id' },
  headers: { 'Authorization': `Bearer ${apiKey}` }
});

// 預期獲得：
// - Token 使用統計
// - 具體消費金額
// - 快取狀態
```

**實作計劃**:
1. 研究 generation ID 的獲取方式
2. 測試不同參數組合
3. 分析回應格式和資料完整性
4. 整合到現有監控邏輯

#### 1.2 API 回應增強參數
```javascript
// 研究方向：在現有請求中添加參數
const enhancedResponse = await axios.get('/api/v1/auth/key', {
  params: { 
    include_usage: true,
    include_billing: true,
    detailed: true 
  },
  headers: { 'Authorization': `Bearer ${apiKey}` }
});
```

**測試項目**:
- 各種可能的查詢參數
- 不同的 header 組合
- API 版本參數測試

### 🔧 方案二：本地消費估算

#### 2.1 API 呼叫追蹤系統
```javascript
class UsageTracker {
  trackAPICall(modelName, promptTokens, completionTokens) {
    const cost = this.calculateCost(modelName, promptTokens, completionTokens);
    this.addToLocalBilling(cost);
  }

  calculateCost(model, promptTokens, completionTokens) {
    // 根據 OpenRouter 價格表計算
    const pricing = this.getPricingForModel(model);
    return (promptTokens * pricing.prompt + completionTokens * pricing.completion) / 1000000;
  }
}
```

**功能特色**:
- 🎯 **即時追蹤**: 每次 API 呼叫都記錄
- 💰 **成本計算**: 根據 token 數量和模型價格計算
- 📊 **本地統計**: 累積消費統計
- ⚡ **離線運作**: 不依賴額外 API 呼叫

#### 2.2 模型價格資料庫
```json
{
  "models": {
    "openai/gpt-4": {
      "prompt_cost_per_token": 0.00003,
      "completion_cost_per_token": 0.00006,
      "last_updated": "2025-06-24"
    },
    "anthropic/claude-3-sonnet": {
      "prompt_cost_per_token": 0.000015,
      "completion_cost_per_token": 0.000075,
      "last_updated": "2025-06-24"
    }
  }
}
```

### 🌐 方案三：Web Scraping 整合

#### 3.1 OpenRouter 後台資料抓取
```javascript
class WebPortalIntegration {
  async getAccountBalance(credentials) {
    // 注意：此方案需要額外的身份驗證
    // 可能需要 session token 或 cookie
  }
}
```

**考慮因素**:
- ⚠️ **合規性**: 需確認是否違反服務條款
- 🔐 **安全性**: 需要額外的認證資訊
- 🔄 **穩定性**: 網頁改版可能影響功能
- 📜 **條款限制**: 可能不被官方支援

### 📊 方案四：使用量日誌分析

#### 4.1 反向計算系統
```javascript
class UsageAnalyzer {
  analyzeRateLimitPattern() {
    // 從 rate limit 變化推算使用量
    const rateChanges = this.getRateLimitHistory();
    return this.estimateUsageFromPatterns(rateChanges);
  }
}
```

**分析邏輯**:
1. 監控 Rate Limit 的變化模式
2. 關聯時間戳與使用高峰
3. 建立使用模式基準線
4. 估算大概的 API 呼叫頻率

## 開發路線圖

### 🎯 短期目標 (1-2 週)

#### Phase 1: API 端點深度探索
- [ ] **系統化測試所有可能的 OpenRouter API 端點**
  ```bash
  # 測試計劃
  GET /api/v1/models
  GET /api/v1/generation?id=test
  GET /api/v1/billing
  GET /api/v1/usage
  GET /api/v1/credits
  POST /api/v1/chat/completions?usage=true
  ```

- [ ] **官方文件深度研究**
  - 聯絡 OpenRouter 技術支援
  - 查閱完整的 API 規格文件
  - 研究社群討論和 GitHub issues

- [ ] **參數組合測試**
  ```javascript
  // 測試不同的參數組合
  const testParams = [
    { include_usage: true },
    { detailed: true },
    { billing: true },
    { usage: { include: true } }
  ];
  ```

#### Phase 2: 本地追蹤系統實作
- [ ] **建立模型價格資料庫**
  - 收集所有 OpenRouter 模型的最新價格
  - 實作自動價格更新機制
  - 添加價格變化通知

- [ ] **實作 API 呼叫攔截器**
  ```javascript
  // 在所有 API 呼叫中插入追蹤邏輯
  const originalAxios = axios.request;
  axios.request = function(config) {
    const result = originalAxios.call(this, config);
    trackAPIUsage(result);
    return result;
  };
  ```

### 🚀 中期目標 (1-2 個月)

#### Phase 3: 進階功能開發
- [ ] **成本預警系統**
  ```javascript
  class CostAlert {
    checkDailyBudget(currentSpend, budget) {
      if (currentSpend > budget * 0.8) {
        this.sendAlert('approaching_budget_limit');
      }
    }
  }
  ```

- [ ] **消費趨勢分析**
  - 每日/每週/每月消費圖表
  - 模型使用偏好分析
  - 成本效益建議

- [ ] **多帳戶支援**
  - 團隊帳戶管理
  - 成本分攤計算
  - 使用量配額分配

#### Phase 4: 整合與優化
- [ ] **Dashboard 開發**
  - Web 介面展示
  - 即時圖表和統計
  - 匯出功能強化

- [ ] **API 包裝器**
  ```javascript
  // 提供透明的 OpenRouter API 包裝
  const openrouter = new OpenRouterWrapper({
    apiKey: 'your-key',
    enableTracking: true
  });
  ```

### 🌟 長期目標 (3-6 個月)

#### Phase 5: 生態系統建設
- [ ] **社群整合**
  - GitHub Action 整合
  - Docker 鏡像提供
  - npm 套件發布

- [ ] **企業功能**
  - 多租戶支援
  - 詳細權限控制
  - 稽核日誌

- [ ] **AI 驅動分析**
  - 使用模式 AI 分析
  - 成本優化建議
  - 異常偵測

## 社群貢獻指南

### 🤝 如何貢獻

#### 1. 問題回報
如果你發現任何問題或有改善建議：

```bash
# 1. Fork 專案
git clone https://github.com/your-username/openrouter-rate-limit-monitor.git

# 2. 建立功能分支
git checkout -b feature/billing-integration

# 3. 進行開發和測試
npm test

# 4. 提交 Pull Request
git push origin feature/billing-integration
```

#### 2. 優先貢獻項目
- 🔍 **API 端點發現**: 測試新的 OpenRouter API 端點
- 💰 **價格資料維護**: 更新模型價格資訊
- 🧪 **測試案例**: 增加測試覆蓋率
- 📚 **文件改善**: 完善使用說明和範例

#### 3. 開發環境設定
```bash
# 安裝開發依賴
npm install

# 執行測試
npm test

# 啟動開發模式
npm run dev

# 檢查程式碼品質
npm run lint
```

### 💡 研究方向建議

#### 社群研究項目
1. **OpenRouter API 完整性研究**
   - 挖掘未公開的 API 端點
   - 測試不同的認證方式
   - 分析 OpenRouter 網頁的網路請求

2. **替代資料來源研究**
   - 研究其他 AI API 服務的帳單 API 設計
   - 分析業界最佳實踐
   - 評估 Web3/區塊鏈方案可行性

3. **使用者體驗改善**
   - 收集社群回饋
   - 設計更好的監控介面
   - 優化警報和通知機制

### 📞 聯絡方式

- **GitHub Issues**: [提交問題和建議](https://github.com/Gamepig/openrouter-rate-limit-monitor/issues)
- **Discussions**: [加入社群討論](https://github.com/Gamepig/openrouter-rate-limit-monitor/discussions)
- **Email**: 專案維護者聯絡方式

## 總結

OpenRouter Rate Limit Monitor 是一個功能強大的 API 監控工具，在 Rate Limit 監控、API Key 管理、歷史追蹤等方面表現優秀。儘管在額度使用量顯示方面存在限制，但我們有明確的改善計劃和多種可行的解決方案。

我們歡迎社群參與，共同完善這個工具，讓它成為 OpenRouter API 使用者的必備監控利器。

---

**⭐ 給我們一個 Star，讓更多人受益！**

*最後更新: 2025-06-24*
*維護者: OpenRouter Monitor 開發團隊*