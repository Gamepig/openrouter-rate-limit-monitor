/**
 * Keys Management Commands
 * 處理 API Keys 管理相關指令
 */

const chalk = require('chalk');
const inquirer = require('inquirer');
const { table } = require('table');
const OpenRouterMonitor = require('../index');

const keysCommand = {
  /**
   * 列出所有 API Keys
   */
  async list(options, program) {
    const globalOpts = program.parent ? program.parent.opts() : program.opts();
    const monitor = new OpenRouterMonitor();
    
    try {
      const keys = monitor.config.listKeys();
      
      if (globalOpts.json) {
        console.log(JSON.stringify(keys, null, 2));
        return;
      }

      if (options.namesOnly) {
        keys.forEach(key => console.log(key.name));
        return;
      }

      if (keys.length === 0) {
        console.log(chalk.yellow('📝 尚未設定任何 API Keys'));
        console.log(chalk.gray('使用 "openrouter-monitor keys add <name> <key>" 新增'));
        return;
      }

      displayKeysTable(keys);
      
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
   * 新增 API Key
   */
  async add(name, key, options, program) {
    const globalOpts = program.parent ? program.parent.opts() : program.opts();
    const monitor = new OpenRouterMonitor();
    
    try {
      // 驗證輸入
      if (!name || !key) {
        throw new Error('請提供 API Key 名稱和金鑰');
      }

      if (name.length < 1 || name.length > 50) {
        throw new Error('API Key 名稱長度應在 1-50 字元之間');
      }

      if (!key.startsWith('sk-or-v1-')) {
        throw new Error('無效的 OpenRouter API Key 格式');
      }

      // 檢查名稱是否已存在
      const existingKeys = monitor.config.listKeys();
      if (existingKeys.find(k => k.name === name)) {
        const { overwrite } = await inquirer.prompt([{
          type: 'confirm',
          name: 'overwrite',
          message: `API Key "${name}" 已存在，是否覆蓋？`,
          default: false
        }]);
        
        if (!overwrite) {
          console.log(chalk.yellow('操作已取消'));
          return;
        }
      }

      // 測試 API Key
      console.log(chalk.blue('🔍 正在測試 API Key...'));
      const testResult = await monitor.testApiKey(key);
      
      if (!testResult.valid) {
        throw new Error(`API Key 測試失敗: ${testResult.error}`);
      }

      // 儲存 API Key
      monitor.config.addKey(name, key);
      
      if (globalOpts.json) {
        console.log(JSON.stringify({ 
          success: true, 
          message: `API Key "${name}" 已成功新增`,
          status: testResult.status
        }, null, 2));
      } else {
        console.log(chalk.green(`✅ API Key "${name}" 已成功新增`));
        console.log(chalk.gray(`層級: ${testResult.status.tier.name}`));
        console.log(chalk.gray(`額度: ${testResult.status.usage.credits.toFixed(2)}`));
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
   * 移除 API Key
   */
  async remove(name, options, program) {
    const globalOpts = program.parent ? program.parent.opts() : program.opts();
    const monitor = new OpenRouterMonitor();
    
    try {
      // 檢查 Key 是否存在
      const existingKeys = monitor.config.listKeys();
      if (!existingKeys.find(k => k.name === name)) {
        throw new Error(`API Key "${name}" 不存在`);
      }

      // 確認刪除
      if (!globalOpts.quiet) {
        const { confirm } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirm',
          message: `確定要刪除 API Key "${name}"？`,
          default: false
        }]);
        
        if (!confirm) {
          console.log(chalk.yellow('操作已取消'));
          return;
        }
      }

      // 刪除 Key
      const success = monitor.config.removeKey(name);
      
      if (success) {
        if (globalOpts.json) {
          console.log(JSON.stringify({ 
            success: true, 
            message: `API Key "${name}" 已刪除` 
          }, null, 2));
        } else {
          console.log(chalk.green(`✅ API Key "${name}" 已刪除`));
        }
      } else {
        throw new Error(`刪除 API Key "${name}" 失敗`);
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
   * 測試 API Key
   */
  async test(name, options, program) {
    const globalOpts = program.parent ? program.parent.opts() : program.opts();
    const monitor = new OpenRouterMonitor();
    
    try {
      // 獲取 API Key
      const key = monitor.config.getKey(name);
      if (!key) {
        throw new Error(`API Key "${name}" 不存在`);
      }

      console.log(chalk.blue('🔍 正在測試 API Key...'));
      
      const testResult = await monitor.testApiKey(key);
      
      if (globalOpts.json) {
        console.log(JSON.stringify(testResult, null, 2));
      } else {
        if (testResult.valid) {
          console.log(chalk.green(`✅ API Key "${name}" 有效`));
          displayTestResult(testResult.status);
          
          // 更新最後使用時間
          monitor.config.updateKeyLastUsed(name);
        } else {
          console.log(chalk.red(`❌ API Key "${name}" 無效`));
          console.log(chalk.red(`錯誤: ${testResult.error}`));
        }
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
   * 顯示目前使用的 API Key
   */
  async current(options, program) {
    const globalOpts = program.parent ? program.parent.opts() : program.opts();
    const monitor = new OpenRouterMonitor();
    
    try {
      // 獲取當前 API Key
      const currentKey = globalOpts.key || 
                        monitor.config.get('defaultApiKey') || 
                        process.env.OPENROUTER_API_KEY;
      
      if (!currentKey) {
        if (globalOpts.json) {
          console.log(JSON.stringify({ current: null, message: '未設定 API Key' }, null, 2));
        } else {
          console.log(chalk.yellow('📝 未設定任何 API Key'));
          console.log(chalk.gray('設定方式:'));
          console.log(chalk.gray('  1. openrouter-monitor keys add <name> <key>'));
          console.log(chalk.gray('  2. export OPENROUTER_API_KEY=<your_key>'));
          console.log(chalk.gray('  3. 使用 --key 參數'));
        }
        return;
      }

      // 檢查是否為儲存的 Key
      const keys = monitor.config.listKeys();
      const namedKey = keys.find(k => monitor.config.getKey(k.name) === currentKey);
      
      if (globalOpts.json) {
        console.log(JSON.stringify({
          current: currentKey.substring(0, 8) + '****' + currentKey.substring(currentKey.length - 4),
          name: namedKey ? namedKey.name : null,
          source: namedKey ? 'stored' : (globalOpts.key ? 'parameter' : 'environment')
        }, null, 2));
      } else {
        console.log(chalk.blue('🔑 目前使用的 API Key:'));
        console.log(`  Key: ${currentKey.substring(0, 8)}****${currentKey.substring(currentKey.length - 4)}`);
        console.log(`  名稱: ${namedKey ? namedKey.name : '(未命名)'}`);
        console.log(`  來源: ${namedKey ? '已儲存' : (globalOpts.key ? '指令參數' : '環境變數')}`);
        
        if (namedKey) {
          console.log(`  建立時間: ${new Date(namedKey.createdAt).toLocaleString('zh-TW')}`);
          if (namedKey.lastUsed) {
            console.log(`  最後使用: ${new Date(namedKey.lastUsed).toLocaleString('zh-TW')}`);
          }
        }
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
 * 顯示 API Keys 表格
 * @param {Array} keys - API Keys 陣列
 */
function displayKeysTable(keys) {
  const tableData = [
    ['名稱', '建立時間', '最後使用', '狀態']
  ];

  keys.forEach(key => {
    const createdAt = new Date(key.createdAt).toLocaleString('zh-TW', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const lastUsed = key.lastUsed ? 
      new Date(key.lastUsed).toLocaleString('zh-TW', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }) : '從未使用';

    const status = key.lastUsed ? chalk.green('✅ 可用') : chalk.gray('⏳ 未測試');

    tableData.push([
      chalk.bold(key.name),
      createdAt,
      lastUsed,
      status
    ]);
  });

  const keysTable = table(tableData, {
    header: {
      alignment: 'center',
      content: chalk.bold.blue(`API Keys 清單 (${keys.length} 個)`)
    },
    columns: {
      0: { alignment: 'left', width: 15 },
      1: { alignment: 'center', width: 15 },
      2: { alignment: 'center', width: 15 },
      3: { alignment: 'center', width: 12 }
    }
  });

  console.log(keysTable);
}

/**
 * 顯示測試結果
 * @param {Object} status - API 狀態
 */
function displayTestResult(status) {
  console.log(chalk.gray(`  層級: ${status.tier.name}`));
  console.log(chalk.gray(`  額度使用: ${status.usage.credits.toFixed(2)}`));
  console.log(chalk.gray(`  健康狀態: ${status.health.message}`));
}

module.exports = keysCommand;