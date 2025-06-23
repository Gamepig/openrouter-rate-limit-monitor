/**
 * Config Commands
 * 處理配置管理相關指令
 */

const chalk = require('chalk');
const inquirer = require('inquirer');
const { table } = require('table');
const OpenRouterMonitor = require('../index');

const configCommand = {
  /**
   * 顯示配置
   */
  async show(options, program) {
    const globalOpts = program.parent ? program.parent.opts() : program.opts();
    const monitor = new OpenRouterMonitor();
    
    try {
      const config = monitor.config.getAll();
      
      if (globalOpts.json) {
        console.log(JSON.stringify(config, null, 2));
        return;
      }

      displayConfigTable(config);
      displayConfigSources();
      
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
   * 設定配置值
   */
  async set(key, value, options, program) {
    const globalOpts = program.parent ? program.parent.opts() : program.opts();
    const monitor = new OpenRouterMonitor();
    
    try {
      // 驗證配置鍵
      const validKeys = [
        'defaultApiKey',
        'interval',
        'warnThreshold',
        'alertThreshold',
        'notificationEnabled',
        'quiet',
        'outputFormat',
        'historyRetentionDays'
      ];

      if (!validKeys.includes(key)) {
        throw new Error(`無效的配置鍵: ${key}\n可用的配置鍵: ${validKeys.join(', ')}`);
      }

      // 類型轉換和驗證
      const parsedValue = parseConfigValue(key, value);
      
      // 設定配置
      monitor.config.set(key, parsedValue);
      
      if (globalOpts.json) {
        console.log(JSON.stringify({ 
          success: true, 
          key,
          value: parsedValue,
          message: `配置 "${key}" 已設定為 "${parsedValue}"`
        }, null, 2));
      } else {
        console.log(chalk.green(`✅ 配置 "${key}" 已設定為 "${parsedValue}"`));
        
        // 顯示相關提示
        displayConfigHints(key, parsedValue);
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
   * 重置配置
   */
  async reset(options, program) {
    const globalOpts = program.parent ? program.parent.opts() : program.opts();
    const monitor = new OpenRouterMonitor();
    
    try {
      // 確認重置
      if (!options.confirm && !globalOpts.quiet) {
        const { shouldReset } = await inquirer.prompt([{
          type: 'confirm',
          name: 'shouldReset',
          message: '確定要重置所有配置到預設值？',
          default: false
        }]);
        
        if (!shouldReset) {
          console.log(chalk.yellow('操作已取消'));
          return;
        }
      }

      // 重置配置
      monitor.config.reset();
      
      if (globalOpts.json) {
        console.log(JSON.stringify({ 
          success: true, 
          message: '所有配置已重置到預設值'
        }, null, 2));
      } else {
        console.log(chalk.green('✅ 所有配置已重置到預設值'));
        console.log(chalk.gray('注意: API Keys 不會被刪除'));
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
 * 顯示配置表格
 * @param {Object} config - 配置物件
 */
function displayConfigTable(config) {
  const tableData = [
    ['配置項目', '目前值', '說明']
  ];

  const configDescriptions = {
    defaultApiKey: 'API Key 參考值',
    interval: '監控檢查間隔 (秒)',
    warnThreshold: '警告閾值 (%)',
    alertThreshold: '警報閾值 (%)',
    notificationEnabled: '啟用系統通知',
    quiet: '安靜模式',
    outputFormat: '預設輸出格式',
    historyRetentionDays: '歷史記錄保留天數'
  };

  Object.entries(config).forEach(([key, value]) => {
    if (key === 'defaultApiKey' && value) {
      value = value.substring(0, 8) + '****' + value.substring(value.length - 4);
    }
    
    const description = configDescriptions[key] || '';
    const displayValue = formatConfigValue(value);
    
    tableData.push([
      chalk.bold(key),
      displayValue,
      chalk.gray(description)
    ]);
  });

  const configTable = table(tableData, {
    header: {
      alignment: 'center',
      content: chalk.bold.blue('目前配置')
    },
    columns: {
      0: { alignment: 'left', width: 20 },
      1: { alignment: 'center', width: 15 },
      2: { alignment: 'left', width: 25 }
    }
  });

  console.log(configTable);
}

/**
 * 顯示配置來源資訊
 */
function displayConfigSources() {
  console.log(chalk.bold.cyan('\n🔧 配置來源 (優先順序):'));
  console.log(chalk.yellow('  1. 環境變數 (OPENROUTER_MONITOR_*)'));
  console.log(chalk.yellow('  2. 專案配置檔案 (.openrouter-monitor.json)'));
  console.log(chalk.yellow('  3. 全域配置檔案 (~/.config/openrouter-monitor/config.json)'));
  console.log(chalk.yellow('  4. 預設值'));

  console.log(chalk.bold.cyan('\n📝 可用的環境變數:'));
  const envVars = [
    'OPENROUTER_API_KEY',
    'OPENROUTER_MONITOR_INTERVAL',
    'OPENROUTER_MONITOR_WARN_THRESHOLD',
    'OPENROUTER_MONITOR_ALERT_THRESHOLD',
    'OPENROUTER_MONITOR_NOTIFICATION_ENABLED'
  ];
  
  envVars.forEach(varName => {
    const isSet = process.env[varName] ? '✅' : '❌';
    console.log(chalk.gray(`  ${isSet} ${varName}`));
  });
}

/**
 * 解析配置值
 * @param {string} key - 配置鍵
 * @param {string} value - 配置值
 * @returns {*} 解析後的值
 */
function parseConfigValue(key, value) {
  switch (key) {
    case 'interval':
    case 'warnThreshold':
    case 'alertThreshold':
    case 'historyRetentionDays':
      const numValue = parseInt(value);
      if (isNaN(numValue) || numValue < 0) {
        throw new Error(`"${key}" 必須是正整數`);
      }
      
      // 特殊驗證
      if (key === 'interval' && numValue < 10) {
        throw new Error('檢查間隔不能少於 10 秒');
      }
      if ((key === 'warnThreshold' || key === 'alertThreshold') && (numValue < 0 || numValue > 100)) {
        throw new Error('閾值必須在 0-100 之間');
      }
      if (key === 'historyRetentionDays' && numValue < 1) {
        throw new Error('歷史記錄保留天數至少為 1 天');
      }
      
      return numValue;
      
    case 'notificationEnabled':
    case 'quiet':
      if (value.toLowerCase() === 'true' || value === '1') return true;
      if (value.toLowerCase() === 'false' || value === '0') return false;
      throw new Error(`"${key}" 必須是 true 或 false`);
      
    case 'outputFormat':
      const validFormats = ['table', 'json', 'csv'];
      if (!validFormats.includes(value.toLowerCase())) {
        throw new Error(`"${key}" 必須是: ${validFormats.join(', ')}`);
      }
      return value.toLowerCase();
      
    case 'defaultApiKey':
      if (!value.startsWith('sk-or-v1-')) {
        throw new Error('無效的 OpenRouter API Key 格式');
      }
      return value;
      
    default:
      return value;
  }
}

/**
 * 格式化配置值顯示
 * @param {*} value - 配置值
 * @returns {string} 格式化的字串
 */
function formatConfigValue(value) {
  if (value === null || value === undefined) {
    return chalk.gray('(未設定)');
  }
  
  if (typeof value === 'boolean') {
    return value ? chalk.green('✅ true') : chalk.red('❌ false');
  }
  
  if (typeof value === 'number') {
    return chalk.cyan(value.toString());
  }
  
  return chalk.white(value.toString());
}

/**
 * 顯示配置提示
 * @param {string} key - 配置鍵
 * @param {*} value - 配置值
 */
function displayConfigHints(key, value) {
  const hints = {
    interval: value < 30 ? 
      chalk.yellow('💡 提示: 過短的檢查間隔可能會快速消耗 API 配額') : null,
    warnThreshold: value >= 90 ? 
      chalk.yellow('💡 提示: 過高的警告閾值可能導致來不及反應') : null,
    alertThreshold: value >= 95 ? 
      chalk.yellow('💡 提示: 過高的警報閾值風險較大') : null,
    notificationEnabled: value ? 
      chalk.blue('💡 提示: 確保系統支援通知功能') : null,
    historyRetentionDays: value > 90 ? 
      chalk.yellow('💡 提示: 過長的保留時間會佔用更多儲存空間') : null
  };

  const hint = hints[key];
  if (hint) {
    console.log(hint);
  }
}

module.exports = configCommand;