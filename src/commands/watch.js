/**
 * Watch Command
 * 處理持續監控功能
 */

const chalk = require('chalk');
const ora = require('ora');
const OpenRouterMonitor = require('../index');

/**
 * Watch 指令處理器
 * @param {Object} options - 指令選項
 * @param {Object} program - Commander 程式物件
 */
async function watchCommand(options, program) {
  const globalOpts = program.parent ? program.parent.opts() : program.opts();
  const monitor = new OpenRouterMonitor();
  
  const interval = parseInt(options.interval) || 60;
  const warnThreshold = parseInt(options.warnThreshold) || 80;
  const alertThreshold = parseInt(options.alertThreshold) || 95;
  const quiet = globalOpts.quiet || false;
  const notify = options.notify || false;

  if (!quiet) {
    console.log(chalk.blue.bold('🔄 OpenRouter API 監控啟動'));
    console.log(chalk.gray(`檢查間隔: ${interval} 秒`));
    console.log(chalk.gray(`警告閾值: ${warnThreshold}%`));
    console.log(chalk.gray(`警報閾值: ${alertThreshold}%`));
    console.log(chalk.gray('按 Ctrl+C 停止監控\n'));
    console.log('─'.repeat(60));
  }

  let consecutiveErrors = 0;
  const maxConsecutiveErrors = 5;
  let lastStatus = null;

  const controller = monitor.startMonitoring({
    interval,
    warnThreshold,
    alertThreshold,
    onStatus: (status) => {
      consecutiveErrors = 0;
      const usage = monitor.calculateUsagePercentage(status);
      const timestamp = new Date().toLocaleString('zh-TW');
      
      if (!quiet) {
        displayStatusUpdate(timestamp, status, usage, lastStatus);
      }
      
      lastStatus = status;
    },
    onWarning: (status, usage) => {
      const message = `使用率達到警告水準 (${usage}%)`;
      
      if (!quiet) {
        console.log(chalk.yellow(`⚠️  [${new Date().toLocaleTimeString()}] ${message}`));
      }
      
      if (notify) {
        sendNotification('OpenRouter 警告', message, 'warning');
      }
    },
    onAlert: (status, usage) => {
      const message = `使用率達到警報水準 (${usage}%)！`;
      
      console.log(chalk.red.bold(`🚨 [${new Date().toLocaleTimeString()}] ${message}`));
      
      if (notify) {
        sendNotification('OpenRouter 警報', message, 'critical');
      }
    }
  });

  // 錯誤處理
  process.on('unhandledRejection', (error) => {
    consecutiveErrors++;
    
    if (!quiet) {
      console.log(chalk.red(`❌ [${new Date().toLocaleTimeString()}] 監控錯誤: ${error.message}`));
    }
    
    if (consecutiveErrors >= maxConsecutiveErrors) {
      console.log(chalk.red.bold(`🚨 連續 ${maxConsecutiveErrors} 次錯誤，停止監控`));
      controller.stop();
      process.exit(1);
    }
  });

  // 優雅的退出處理
  process.on('SIGINT', () => {
    if (!quiet) {
      console.log(chalk.yellow('\n\n👋 監控已停止'));
    }
    controller.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    controller.stop();
    process.exit(0);
  });
}

/**
 * 顯示狀態更新
 * @param {string} timestamp - 時間戳記
 * @param {Object} status - 當前狀態
 * @param {number} usage - 使用率百分比
 * @param {Object} lastStatus - 上次狀態
 */
function displayStatusUpdate(timestamp, status, usage, lastStatus) {
  let statusIcon = '✅';
  let statusColor = 'green';
  let statusText = 'Healthy';

  // 根據健康狀態設定圖示和顏色
  switch (status.health.status) {
    case 'warning':
      statusIcon = '⚠️';
      statusColor = 'yellow';
      statusText = 'Warning';
      break;
    case 'critical':
      statusIcon = '🚨';
      statusColor = 'red';
      statusText = 'Critical';
      break;
  }

  // 準備顯示資訊
  const rateInfo = `${status.limits.rate.used}/${status.limits.rate.limit}`;
  const dailyInfo = status.limits.daily.limit ? 
    `${status.limits.daily.used}/${status.limits.daily.limit}` : '∞';
  
  // 檢查是否有變化
  const changeIndicators = getChangeIndicators(status, lastStatus);

  console.log(
    chalk[statusColor](
      `[${timestamp}] ${statusIcon} ${statusText} - ` +
      `Rate: ${rateInfo} (${usage}%)${changeIndicators.rate} | ` +
      `Daily: ${dailyInfo}${changeIndicators.daily} | ` +
      `Credits: ${status.usage.credits.toFixed(2)}${changeIndicators.credits}`
    )
  );
}

/**
 * 獲取變化指示器
 * @param {Object} current - 當前狀態
 * @param {Object} last - 上次狀態
 * @returns {Object} 變化指示器
 */
function getChangeIndicators(current, last) {
  const indicators = {
    rate: '',
    daily: '',
    credits: ''
  };

  if (!last) return indicators;

  // Rate limit 變化
  const rateDiff = current.limits.rate.used - last.limits.rate.used;
  if (rateDiff > 0) {
    indicators.rate = chalk.red(` ↑${rateDiff}`);
  } else if (rateDiff < 0) {
    indicators.rate = chalk.green(` ↓${Math.abs(rateDiff)}`);
  }

  // Daily limit 變化
  if (current.limits.daily.limit && last.limits.daily.limit) {
    const dailyDiff = current.limits.daily.used - last.limits.daily.used;
    if (dailyDiff > 0) {
      indicators.daily = chalk.red(` ↑${dailyDiff}`);
    } else if (dailyDiff < 0) {
      indicators.daily = chalk.green(` ↓${Math.abs(dailyDiff)}`);
    }
  }

  // Credits 變化
  const creditsDiff = current.usage.credits - last.usage.credits;
  if (creditsDiff > 0) {
    indicators.credits = chalk.red(` ↑${creditsDiff.toFixed(2)}`);
  } else if (creditsDiff < 0) {
    indicators.credits = chalk.green(` ↓${Math.abs(creditsDiff).toFixed(2)}`);
  }

  return indicators;
}

/**
 * 送出系統通知
 * @param {string} title - 通知標題
 * @param {string} message - 通知訊息
 * @param {string} level - 通知層級
 */
function sendNotification(title, message, level = 'info') {
  // 根據不同平台送出通知
  const { exec } = require('child_process');
  
  try {
    switch (process.platform) {
      case 'darwin': // macOS
        exec(`osascript -e 'display notification "${message}" with title "${title}"'`);
        break;
        
      case 'linux':
        exec(`notify-send "${title}" "${message}"`);
        break;
        
      case 'win32': // Windows
        // Windows 10+ 支援 toast 通知
        const script = `
          [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
          $Template = [Windows.UI.Notifications.ToastTemplateType]::ToastText02
          $ToastXml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent($Template)
          $ToastXml.SelectSingleNode("//text[@id='1']").AppendChild($ToastXml.CreateTextNode("${title}")) | Out-Null
          $ToastXml.SelectSingleNode("//text[@id='2']").AppendChild($ToastXml.CreateTextNode("${message}")) | Out-Null
          $Toast = [Windows.UI.Notifications.ToastNotification]::new($ToastXml)
          [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("OpenRouter Monitor").Show($Toast)
        `;
        exec(`powershell -Command "${script}"`);
        break;
        
      default:
        // 無法送出通知的平台，只在控制台顯示
        console.log(chalk.blue(`📢 ${title}: ${message}`));
    }
  } catch (error) {
    // 通知失敗時不影響主要功能
    console.log(chalk.gray(`通知送出失敗: ${error.message}`));
  }
}

module.exports = watchCommand;