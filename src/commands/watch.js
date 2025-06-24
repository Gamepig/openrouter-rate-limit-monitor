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

  // 監控錯誤處理（不覆蓋全域錯誤處理器）
  const monitoringErrorHandler = (error) => {
    consecutiveErrors++;
    
    if (!quiet) {
      console.log(chalk.red(`❌ [${new Date().toLocaleTimeString()}] 監控錯誤: ${error.message}`));
    }
    
    if (consecutiveErrors >= maxConsecutiveErrors) {
      console.log(chalk.red.bold(`🚨 連續 ${maxConsecutiveErrors} 次錯誤，停止監控`));
      if (controller && controller.stop) {
        controller.stop();
      }
      process.exit(1);
    }
  };

  // 只在監控過程中處理特定錯誤
  const handleMonitoringError = (error) => {
    if (error && error.message && error.message.includes('monitoring')) {
      monitoringErrorHandler(error);
    } else {
      // 讓全域錯誤處理器處理其他錯誤
      throw error;
    }
  };

  // 優雅的退出處理
  const gracefulShutdown = (signal) => {
    if (!quiet) {
      console.log(chalk.yellow('\n\n👋 OpenRouter Monitor 正在關閉...'));
    }
    
    try {
      if (controller && controller.stop) {
        controller.stop();
      }
    } catch (error) {
      console.warn('清理監控器時發生錯誤:', error.message);
    }
    
    process.exit(0);
  };

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);

  // 使用 try-catch 包裝監控啟動，處理初始化錯誤
  try {
    // 確保監控器成功啟動
    if (!controller || typeof controller.stop !== 'function') {
      throw new Error('監控器初始化失败');
    }
  } catch (error) {
    console.error(chalk.red(`❌ 監控啟動失敗: ${error.message}`));
    process.exit(1);
  }
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
  const rateInfo = status.limits.rate.used !== null ? 
    `${status.limits.rate.used}/${status.limits.rate.limit}` :
    `null/${status.limits.rate.limit}`;
  
  // 優先使用本地追蹤的每日使用量
  let dailyInfo;
  if (status.limits.daily.limit) {
    const dailyUsed = status.limits.daily.localTracked ? 
      status.limits.daily.localTracked.used : 
      status.limits.daily.used;
    dailyInfo = `${dailyUsed !== null ? dailyUsed : 'null'}/${status.limits.daily.limit}`;
  } else {
    dailyInfo = '∞';
  }
  
  // 格式化額度資訊 - 顯示已用/剩餘
  let creditsInfo;
  if (status.usage.total_credits !== undefined) {
    const usedCredits = status.usage.credits || 0;
    const remainingCredits = status.usage.remaining_credits || 0;
    creditsInfo = `Used: $${usedCredits.toFixed(2)} | Left: $${remainingCredits.toFixed(2)}`;
  } else {
    creditsInfo = `$${(status.usage.credits || 0).toFixed(2)}`;
  }
  
  // 檢查是否有變化
  const changeIndicators = getChangeIndicators(status, lastStatus);

  console.log(
    chalk[statusColor](
      `[${timestamp}] ${statusIcon} ${statusText} - ` +
      `Rate: ${rateInfo} (${usage}%)${changeIndicators.rate} | ` +
      `Daily: ${dailyInfo}${changeIndicators.daily} | ` +
      `${creditsInfo}${changeIndicators.credits}`
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

  // Rate limit 變化（如果有實際數據）
  if (current.limits.rate.used !== null && last.limits.rate.used !== null) {
    const rateDiff = current.limits.rate.used - last.limits.rate.used;
    if (rateDiff > 0) {
      indicators.rate = chalk.red(` ↑${rateDiff}`);
    } else if (rateDiff < 0) {
      indicators.rate = chalk.green(` ↓${Math.abs(rateDiff)}`);
    }
  }

  // Daily limit 變化（優先使用本地追蹤數據）
  if (current.limits.daily.limit && last.limits.daily.limit) {
    const getCurrentDaily = (status) => {
      return status.limits.daily.localTracked ? 
        status.limits.daily.localTracked.used : 
        status.limits.daily.used;
    };
    
    const currentDaily = getCurrentDaily(current);
    const lastDaily = getCurrentDaily(last);
    
    if (currentDaily !== null && lastDaily !== null) {
      const dailyDiff = currentDaily - lastDaily;
      if (dailyDiff > 0) {
        indicators.daily = chalk.red(` ↑${dailyDiff}`);
      } else if (dailyDiff < 0) {
        indicators.daily = chalk.green(` ↓${Math.abs(dailyDiff)}`);
      }
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