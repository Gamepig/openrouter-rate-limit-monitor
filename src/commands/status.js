/**
 * Status Command
 * 處理狀態查詢相關指令
 */

const chalk = require('chalk');
const { table } = require('table');
const OpenRouterMonitor = require('../index');

/**
 * Status 指令處理器
 * @param {Object} options - 指令選項
 * @param {Object} program - Commander 程式物件
 */
async function statusCommand(options, program) {
  const globalOpts = program.parent ? program.parent.opts() : program.opts();
  const monitor = new OpenRouterMonitor();

  try {
    const status = await monitor.getStatus({
      apiKey: globalOpts.key,
      refresh: options.refresh
    });

    if (globalOpts.json) {
      console.log(JSON.stringify(status, null, 2));
      return;
    }

    displayStatus(status, globalOpts.verbose);

  } catch (error) {
    if (globalOpts.json) {
      console.log(JSON.stringify({ error: error.message }, null, 2));
    } else {
      console.error(chalk.red('❌ 錯誤:'), error.message);
    }
    process.exit(1);
  }
}

/**
 * 顯示狀態資訊
 * @param {Object} status - 狀態資料
 * @param {boolean} verbose - 是否顯示詳細資訊
 */
function displayStatus(status, verbose = false) {
  // 主要狀態表格
  const statusData = [
    ['API Key', status.apiKey],
    ['服務層級', status.tier.name],
    ['額度使用', formatCreditsUsage(status.usage)],
    ['Rate Limit', formatRateLimit(status.limits.rate)],
    ['每日限制', formatDailyLimit(status.limits.daily)],
    ['健康狀態', formatHealthStatus(status.health)],
    ['最後檢查', formatTimestamp(status.timestamp)]
  ];

  const statusTable = table(statusData, {
    header: {
      alignment: 'center',
      content: chalk.bold.blue('OpenRouter API 狀態')
    },
    columns: {
      0: { alignment: 'right', width: 12 },
      1: { alignment: 'left', width: 40 }
    },
    border: {
      topBody: '─',
      topJoin: '┬',
      topLeft: '┌',
      topRight: '┐',
      bottomBody: '─',
      bottomJoin: '┴',
      bottomLeft: '└',
      bottomRight: '┘',
      bodyLeft: '│',
      bodyRight: '│',
      bodyJoin: '│'
    }
  });

  console.log(statusTable);

  // 詳細資訊
  if (verbose) {
    displayDetailedInfo(status);
  }

  // 建議和警告
  displayRecommendations(status);
}

/**
 * 顯示詳細資訊
 * @param {Object} status - 狀態資料
 */
function displayDetailedInfo(status) {
  console.log(chalk.bold.cyan('\n📊 詳細資訊:'));
  
  // 限制詳情
  if (status.limits) {
    console.log(chalk.yellow('\nRate Limits:'));
    console.log(`  每分鐘: ${status.limits.rate.used}/${status.limits.rate.limit} (${Math.round(status.limits.rate.used/status.limits.rate.limit*100)}%)`);
    
    if (status.limits.daily.limit) {
      console.log(`  每日: ${status.limits.daily.used}/${status.limits.daily.limit} (${Math.round(status.limits.daily.used/status.limits.daily.limit*100)}%)`);
    }
    
    if (status.limits.monthly && status.limits.monthly.limit) {
      console.log(`  每月: ${status.usage.credits}/${status.limits.monthly.limit} 額度`);
    }
  }

  // 時間資訊
  console.log(chalk.yellow('\n時間資訊:'));
  console.log(`  Rate Limit 重置: ${formatTimestamp(status.limits.rate.resetTime)}`);
  if (status.limits.daily.resetTime) {
    console.log(`  每日限制重置: ${formatTimestamp(status.limits.daily.resetTime)}`);
  }
}

/**
 * 顯示建議和警告
 * @param {Object} status - 狀態資料
 */
function displayRecommendations(status) {
  const recommendations = [];
  const warnings = [];

  // 檢查健康狀態
  if (status.health.status === 'critical') {
    warnings.push('⚠️  使用率過高，建議暫停請求直到限制重置');
  } else if (status.health.status === 'warning') {
    recommendations.push('💡 使用率偏高，建議監控使用情況');
  }

  // 檢查免費層級
  if (status.tier.isFree) {
    recommendations.push('💰 考慮升級到付費方案以獲得更高的限制');
  }

  // 檢查每日限制
  if (status.limits.daily.limit && status.limits.daily.used / status.limits.daily.limit > 0.8) {
    warnings.push('⚠️  今日配額即將用完');
  }

  // 顯示警告
  if (warnings.length > 0) {
    console.log(chalk.red.bold('\n🚨 警告:'));
    warnings.forEach(warning => console.log(`  ${warning}`));
  }

  // 顯示建議
  if (recommendations.length > 0) {
    console.log(chalk.blue.bold('\n💡 建議:'));
    recommendations.forEach(rec => console.log(`  ${rec}`));
  }
}

/**
 * 格式化額度使用資訊
 * @param {Object} usage - 使用資訊
 * @returns {string} 格式化的字串
 */
function formatCreditsUsage(usage) {
  if (usage.unlimited) {
    return `${usage.credits.toFixed(2)} (無限制)`;
  } else if (usage.limit) {
    const percentage = Math.round((usage.credits / usage.limit) * 100);
    const color = percentage > 90 ? 'red' : percentage > 70 ? 'yellow' : 'green';
    return chalk[color](`${usage.credits.toFixed(2)} / ${usage.limit} (${percentage}%)`);
  } else {
    return `${usage.credits.toFixed(2)}`;
  }
}

/**
 * 格式化 Rate Limit 資訊
 * @param {Object} rate - Rate limit 資訊
 * @returns {string} 格式化的字串
 */
function formatRateLimit(rate) {
  if (!rate.limit) return '無限制';
  
  const percentage = Math.round((rate.used / rate.limit) * 100);
  const color = percentage > 90 ? 'red' : percentage > 70 ? 'yellow' : 'green';
  
  return chalk[color](`${rate.used}/${rate.limit} (${percentage}%)`);
}

/**
 * 格式化每日限制資訊
 * @param {Object} daily - 每日限制資訊
 * @returns {string} 格式化的字串
 */
function formatDailyLimit(daily) {
  if (!daily.limit) return '無限制';
  
  const percentage = Math.round((daily.used / daily.limit) * 100);
  const color = percentage > 90 ? 'red' : percentage > 70 ? 'yellow' : 'green';
  
  return chalk[color](`${daily.used}/${daily.limit} (${percentage}%)`);
}

/**
 * 格式化健康狀態
 * @param {Object} health - 健康狀態
 * @returns {string} 格式化的字串
 */
function formatHealthStatus(health) {
  const icons = {
    healthy: '✅',
    warning: '⚠️',
    critical: '🚨',
    unknown: '❓'
  };
  
  const colors = {
    healthy: 'green',
    warning: 'yellow',
    critical: 'red',
    unknown: 'gray'
  };
  
  const icon = icons[health.status] || icons.unknown;
  const color = colors[health.status] || colors.unknown;
  
  return chalk[color](`${icon} ${health.message}`);
}

/**
 * 格式化時間戳記
 * @param {string} timestamp - ISO 時間字串
 * @returns {string} 格式化的時間
 */
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) {
    return '剛剛';
  } else if (diffMins < 60) {
    return `${diffMins} 分鐘前`;
  } else {
    return date.toLocaleString('zh-TW', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

module.exports = statusCommand;