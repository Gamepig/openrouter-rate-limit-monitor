#!/usr/bin/env node

/**
 * 測試本地請求追蹤功能
 */

const OpenRouterMonitor = require('./src/index');

async function testRequestTracking() {
  console.log('🧪 測試本地請求追蹤功能...\n');
  
  const monitor = new OpenRouterMonitor();
  
  // 先獲取實際的 API key
  const initialStatus = await monitor.getStatus();
  const realApiKey = process.env.OPENROUTER_API_KEY || initialStatus.apiKey;
  
  // 模擬一些請求
  console.log('📝 記錄一些模擬請求...');
  console.log('   使用 API Key:', realApiKey);
  monitor.recordRequest(realApiKey, 'meta-llama/llama-2-70b-chat:free');
  monitor.recordRequest(realApiKey, 'meta-llama/llama-2-70b-chat:free');
  monitor.recordRequest(realApiKey, 'anthropic/claude-3-haiku:free');
  
  // 獲取請求統計
  console.log('📊 當前請求統計:');
  const stats = monitor.getRequestStats();
  console.log('   今日總請求:', stats.today.totalRequests);
  console.log('   使用的模型:', Object.keys(stats.today.models));
  console.log('   模型分布:', stats.today.models);
  
  // 獲取狀態（包含本地追蹤）
  console.log('\n🔍 獲取完整狀態（包含本地追蹤）...');
  try {
    const status = await monitor.getStatus();
    
    console.log('✅ 狀態獲取成功:');
    console.log('   Credits 餘額:', `$${status.usage.remaining_credits.toFixed(2)}`);
    console.log('   Credits 使用:', `$${status.usage.credits.toFixed(2)}`);
    console.log('   每日限制:', status.limits.daily.limit);
    
    if (status.limits.daily.localTracked) {
      const tracked = status.limits.daily.localTracked;
      console.log('   本地追蹤請求:', `${tracked.used}/${status.limits.daily.limit} (${tracked.percentage}%)`);
      console.log('   剩餘請求:', tracked.remaining);
      console.log('   狀態:', tracked.status);
    }
    
    console.log('\n🎯 你的三個需求現在都能滿足:');
    console.log('   1. ✅ 當日請求數量:', status.limits.daily.localTracked ? status.limits.daily.localTracked.used : '0 (本地追蹤)');
    console.log('   2. ✅ Credits 使用量:', `$${status.usage.credits.toFixed(2)}`);
    console.log('   3. ✅ Credits 餘額:', `$${status.usage.remaining_credits.toFixed(2)}`);
    
  } catch (error) {
    console.error('❌ 狀態獲取失敗:', error.message);
  }
}

testRequestTracking().catch(console.error);