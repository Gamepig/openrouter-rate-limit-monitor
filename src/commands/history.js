/**
 * History Commands
 * 處理使用歷史記錄相關指令
 */

const chalk = require('chalk');
const inquirer = require('inquirer');
const { table } = require('table');
const fs = require('fs');
const path = require('path');
const OpenRouterMonitor = require('../index');

const historyCommand = {
  /**
   * 顯示使用歷史
   */
  async show(options, program) {
    const globalOpts = program.parent ? program.parent.opts() : program.opts();
    const monitor = new OpenRouterMonitor();
    
    try {
      const days = parseInt(options.days) || 7;
      const format = options.format || 'table';
      const apiKey = globalOpts.key;
      
      console.log(chalk.blue(`📊 載入最近 ${days} 天的使用歷史...`));
      
      const history = await monitor.getHistory({ 
        days, 
        apiKey,
        includeRawData: format === 'json'
      });
      
      if (history.length === 0) {
        console.log(chalk.yellow('📝 沒有找到歷史記錄'));
        return;
      }

      // 根據格式輸出
      switch (format.toLowerCase()) {
        case 'json':
          const output = globalOpts.json ? history : JSON.stringify(history, null, 2);
          console.log(output);
          break;
          
        case 'csv':
          const csvData = await monitor.historyTracker.exportData({ 
            format: 'csv', 
            days, 
            apiKey 
          });
          console.log(csvData);
          break;
          
        case 'table':
        default:
          displayHistoryTable(history);
          displayHistoryStats(history);
          break;
      }

      // 匯出到檔案
      if (options.export) {
        await exportToFile(history, options.export, format, monitor);
        console.log(chalk.green(`✅ 已匯出到 ${options.export}`));
      }
      
    } catch (error) {
      if (globalOpts.json) {
        console.log(JSON.stringify({ error: error.message }, null, 2));
      } else {
        console.error(chalk.red('❌ 錯誤:'), error.message);
      }
      process.exit(1);
    }
  },

  /**
   * 清除歷史記錄
   */
  async clear(options, program) {
    const globalOpts = program.parent ? program.parent.opts() : program.opts();
    const monitor = new OpenRouterMonitor();
    
    try {
      const olderThanDays = options.olderThan ? parseInt(options.olderThan) : null;
      const apiKey = globalOpts.key;
      const confirm = options.confirm;
      
      // 確認操作
      if (!confirm && !globalOpts.quiet) {
        const message = olderThanDays ? 
          `確定要清除 ${olderThanDays} 天前的歷史記錄？` :
          '確定要清除所有歷史記錄？';
          
        const { shouldClear } = await inquirer.prompt([{
          type: 'confirm',
          name: 'shouldClear',
          message: message,
          default: false
        }]);
        
        if (!shouldClear) {
          console.log(chalk.yellow('操作已取消'));
          return;
        }
      }

      console.log(chalk.blue('🗑️  正在清除歷史記錄...'));
      
      const deletedCount = await monitor.clearHistory({ 
        olderThanDays, 
        apiKey 
      });
      
      if (globalOpts.json) {
        console.log(JSON.stringify({ 
          success: true, 
          deletedCount,
          message: `已清除 ${deletedCount} 筆記錄`
        }, null, 2));
      } else {
        console.log(chalk.green(`✅ 已清除 ${deletedCount} 筆記錄`));
      }
      
    } catch (error) {
      if (globalOpts.json) {
        console.log(JSON.stringify({ error: error.message }, null, 2));
      } else {
        console.error(chalk.red('❌ 錯誤:'), error.message);
      }
      process.exit(1);
    }
  }
};

/**
 * 顯示歷史記錄表格
 * @param {Array} history - 歷史記錄
 */
function displayHistoryTable(history) {
  const tableData = [
    ['時間', '額度使用', 'Rate Used', '每日使用', '健康狀態']
  ];

  // 只顯示最近的記錄（避免表格過長）
  const recentHistory = history.slice(0, 20);

  recentHistory.forEach(record => {
    const timestamp = new Date(record.timestamp).toLocaleString('zh-TW', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    const creditsUsed = record.credits_used ? record.credits_used.toFixed(2) : '0.00';
    const rateUsed = `${record.rate_used || 0}/${record.rate_limit || 20}`;
    const dailyUsed = record.daily_limit ? 
      `${record.daily_used || 0}/${record.daily_limit}` : 
      (record.daily_used || 0).toString();

    const healthStatus = formatHealthForTable(record.health_status, record.health_percentage);

    tableData.push([
      timestamp,
      creditsUsed,
      rateUsed,
      dailyUsed,
      healthStatus
    ]);
  });

  const historyTable = table(tableData, {
    header: {
      alignment: 'center',
      content: chalk.bold.blue(`使用歷史記錄 (最近 ${recentHistory.length} 筆)`)
    },
    columns: {
      0: { alignment: 'center', width: 12 },
      1: { alignment: 'right', width: 10 },
      2: { alignment: 'center', width: 12 },
      3: { alignment: 'center', width: 12 },
      4: { alignment: 'center', width: 15 }
    }
  });

  console.log(historyTable);
}

/**
 * 顯示歷史統計
 * @param {Array} history - 歷史記錄
 */
function displayHistoryStats(history) {
  if (history.length === 0) return;

  console.log(chalk.bold.cyan('\n📈 統計摘要:'));

  // 計算統計資料
  const stats = calculateStats(history);

  console.log(chalk.yellow('\n額度使用:'));
  console.log(`  平均: ${stats.avgCredits.toFixed(2)}`);
  console.log(`  最高: ${stats.maxCredits.toFixed(2)}`);
  console.log(`  總變化: ${stats.creditsTrend > 0 ? '+' : ''}${stats.creditsTrend.toFixed(2)}`);

  console.log(chalk.yellow('\nRate Limit:'));
  console.log(`  平均使用率: ${stats.avgRateUsage.toFixed(1)}%`);
  console.log(`  最高使用率: ${stats.maxRateUsage.toFixed(1)}%`);

  if (stats.dailyStats.hasData) {
    console.log(chalk.yellow('\n每日限制:'));
    console.log(`  平均使用率: ${stats.dailyStats.avgUsage.toFixed(1)}%`);
    console.log(`  最高使用率: ${stats.dailyStats.maxUsage.toFixed(1)}%`);
  }

  console.log(chalk.yellow('\n健康狀態分布:'));
  Object.entries(stats.healthDistribution).forEach(([status, count]) => {
    const percentage = ((count / history.length) * 100).toFixed(1);
    const color = getHealthColor(status);
    console.log(`  ${chalk[color](status)}: ${count} 次 (${percentage}%)`);
  });

  if (history.length > 1) {
    const timeSpan = (history[0].timestamp - history[history.length - 1].timestamp) / (1000 * 60 * 60);
    console.log(chalk.gray(`\n📊 記錄期間: ${timeSpan.toFixed(1)} 小時，共 ${history.length} 筆記錄`));
  }
}

/**
 * 計算統計資料
 * @param {Array} history - 歷史記錄
 * @returns {Object} 統計資料
 */
function calculateStats(history) {
  const stats = {
    avgCredits: 0,
    maxCredits: 0,
    creditsTrend: 0,
    avgRateUsage: 0,
    maxRateUsage: 0,
    dailyStats: { hasData: false, avgUsage: 0, maxUsage: 0 },
    healthDistribution: {}
  };

  if (history.length === 0) return stats;

  // 額度統計
  const credits = history.map(h => h.credits_used || 0);
  stats.avgCredits = credits.reduce((a, b) => a + b, 0) / credits.length;
  stats.maxCredits = Math.max(...credits);
  stats.creditsTrend = credits[0] - credits[credits.length - 1];

  // Rate limit 統計
  const rateUsages = history
    .filter(h => h.rate_limit > 0)
    .map(h => ((h.rate_used || 0) / h.rate_limit) * 100);
  
  if (rateUsages.length > 0) {
    stats.avgRateUsage = rateUsages.reduce((a, b) => a + b, 0) / rateUsages.length;
    stats.maxRateUsage = Math.max(...rateUsages);
  }

  // 每日限制統計
  const dailyUsages = history
    .filter(h => h.daily_limit > 0)
    .map(h => ((h.daily_used || 0) / h.daily_limit) * 100);
  
  if (dailyUsages.length > 0) {
    stats.dailyStats.hasData = true;
    stats.dailyStats.avgUsage = dailyUsages.reduce((a, b) => a + b, 0) / dailyUsages.length;
    stats.dailyStats.maxUsage = Math.max(...dailyUsages);
  }

  // 健康狀態分布
  history.forEach(record => {
    const status = record.health_status || 'unknown';
    stats.healthDistribution[status] = (stats.healthDistribution[status] || 0) + 1;
  });

  return stats;
}

/**
 * 格式化健康狀態表格顯示
 * @param {string} status - 健康狀態
 * @param {number} percentage - 百分比
 * @returns {string} 格式化的字串
 */
function formatHealthForTable(status, percentage) {
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
  
  const icon = icons[status] || icons.unknown;
  const color = colors[status] || colors.unknown;
  
  return chalk[color](`${icon} ${percentage || 0}%`);
}

/**
 * 獲取健康狀態顏色
 * @param {string} status - 健康狀態
 * @returns {string} 顏色名稱
 */
function getHealthColor(status) {
  const colors = {
    healthy: 'green',
    warning: 'yellow',
    critical: 'red',
    unknown: 'gray'
  };
  
  return colors[status] || 'gray';
}

/**
 * 匯出到檔案
 * @param {Array} history - 歷史記錄
 * @param {string} filename - 檔案名稱
 * @param {string} format - 格式
 * @param {Object} monitor - 監控物件
 */
async function exportToFile(history, filename, format, monitor) {
  const exportPath = path.resolve(filename);
  
  let content;
  switch (format.toLowerCase()) {
    case 'csv':
      content = await monitor.historyTracker.exportData({ format: 'csv' });
      break;
    case 'json':
    default:
      content = JSON.stringify(history, null, 2);
      break;
  }
  
  fs.writeFileSync(exportPath, content, 'utf8');
}

module.exports = historyCommand;