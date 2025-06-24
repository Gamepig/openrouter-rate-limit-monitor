#!/usr/bin/env node

/**
 * OpenRouter 監控工具修復驗證腳本
 * 測試修復後的功能是否正確工作
 */

const OpenRouterMonitor = require('./src/index');

async function testMonitorFix() {
  console.log('🔍 測試 OpenRouter 監控工具修復結果...\n');
  
  const monitor = new OpenRouterMonitor();
  
  try {
    // 測試狀態獲取
    console.log('1. 測試狀態獲取...');
    const status = await monitor.getStatus();
    
    // 驗證修復點
    console.log('✅ 修復驗證結果:');
    
    // Rate Limit 修復驗證
    const rateLimit = status.limits.rate;
    console.log(`   Rate Limit: used=${rateLimit.used}, limit=${rateLimit.limit}`);
    if (rateLimit.used === null) {
      console.log('   ✅ Rate Limit 正確顯示為 null (API 不提供使用量)');
    } else {
      console.log('   ❌ Rate Limit 應該為 null');
    }
    
    // 每日限制修復驗證
    const dailyLimit = status.limits.daily;
    console.log(`   每日限制: used=${dailyLimit.used}, limit=${dailyLimit.limit}`);
    if (dailyLimit.used === null) {
      console.log('   ✅ 每日限制正確顯示為 null (API 不提供使用量)');
    } else {
      console.log('   ❌ 每日限制應該為 null');
    }
    
    // API 說明驗證
    if (rateLimit.apiLimitation) {
      console.log('   ✅ 包含 API 限制說明');
    } else {
      console.log('   ❌ 缺少 API 限制說明');
    }
    
    // 帳戶類型驗證
    console.log(`   帳戶類型: ${status.tier.name} (免費: ${status.tier.isFree})`);
    
    // 額度資訊驗證
    const usage = status.usage;
    console.log(`   額度使用: 已用 $${usage.credits.toFixed(2)} / 總額 $${usage.total_credits.toFixed(2)}`);
    
    console.log('\n🎉 所有修復點驗證完成！');
    
  } catch (error) {
    console.error('❌ 測試失敗:', error.message);
    process.exit(1);
  }
}

// 執行測試
testMonitorFix().catch(console.error);