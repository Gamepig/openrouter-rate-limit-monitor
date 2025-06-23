#!/usr/bin/env node

/**
 * OpenRouter Rate Limit Monitor CLI
 * 主要入口點
 */

const { Command } = require('commander');
const chalk = require('chalk');
const package = require('../package.json');

// 引入指令模組
const statusCommand = require('../src/commands/status');
const watchCommand = require('../src/commands/watch');
const keysCommand = require('../src/commands/keys');
const historyCommand = require('../src/commands/history');
const configCommand = require('../src/commands/config');

const program = new Command();

// 程式基本資訊
program
  .name('openrouter-monitor')
  .description('OpenRouter API Rate Limit Monitor - 監控 OpenRouter API 使用量和速率限制')
  .version(package.version, '-v, --version', '顯示版本資訊')
  .helpOption('-h, --help', '顯示說明資訊');

// 全域選項
program
  .option('-k, --key <name>', '使用指定的 API key')
  .option('-j, --json', '以 JSON 格式輸出')
  .option('-v, --verbose', '顯示詳細資訊')
  .option('-q, --quiet', '安靜模式，只顯示錯誤');

// 註冊指令
program
  .command('status')
  .description('顯示目前的 API 狀態和 rate limit 資訊')
  .option('-r, --refresh', '強制重新檢查，忽略快取')
  .action(statusCommand);

program
  .command('limits')
  .description('顯示詳細的 rate limit 資訊')
  .action(statusCommand);

program
  .command('watch')
  .description('持續監控 API 使用狀況')
  .option('-i, --interval <seconds>', '檢查間隔秒數', '60')
  .option('-w, --warn-threshold <percent>', '警告閾值百分比', '80')
  .option('-a, --alert-threshold <percent>', '警報閾值百分比', '95')
  .option('-n, --notify', '啟用系統通知')
  .action(watchCommand);

// Keys 管理指令群組
const keysCmd = program
  .command('keys')
  .description('管理 API keys');

keysCmd
  .command('list')
  .description('列出所有儲存的 API keys')
  .option('--names-only', '只顯示 key 名稱')
  .action(keysCommand.list);

keysCmd
  .command('add <name> <key>')
  .description('新增一個 API key')
  .action(keysCommand.add);

keysCmd
  .command('remove <name>')
  .alias('rm')
  .description('移除一個 API key')
  .action(keysCommand.remove);

keysCmd
  .command('test <name>')
  .description('測試指定的 API key')
  .action(keysCommand.test);

keysCmd
  .command('current')
  .description('顯示目前使用的 API key')
  .action(keysCommand.current);

// History 指令群組
const historyCmd = program
  .command('history')
  .description('查看使用歷史記錄');

historyCmd
  .command('show')
  .description('顯示使用歷史')
  .option('-d, --days <n>', '顯示最近 n 天', '7')
  .option('-f, --format <type>', '輸出格式: table|json|csv', 'table')
  .option('--export <file>', '匯出到檔案')
  .action(historyCommand.show);

historyCmd
  .command('clear')
  .description('清除歷史記錄')
  .option('--older-than <days>', '只清除指定天數之前的記錄')
  .option('--confirm', '跳過確認提示')
  .action(historyCommand.clear);

// Config 指令群組
const configCmd = program
  .command('config')
  .description('配置管理');

configCmd
  .command('show')
  .description('顯示目前配置')
  .action(configCommand.show);

configCmd
  .command('set <key> <value>')
  .description('設定配置值')
  .action(configCommand.set);

configCmd
  .command('reset')
  .description('重置所有配置到預設值')
  .option('--confirm', '跳過確認提示')
  .action(configCommand.reset);

// 錯誤處理
program.on('command:*', (operands) => {
  console.error(chalk.red(`❌ 未知指令: ${operands[0]}`));
  console.log(chalk.yellow('使用 --help 查看可用指令'));
  process.exit(1);
});

// 處理未捕獲的例外
process.on('uncaughtException', (error) => {
  console.error(chalk.red('❌ 未預期的錯誤:'), error.message);
  if (program.opts().verbose) {
    console.error(error.stack);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('❌ 未處理的 Promise 拒絕:'), reason);
  if (program.opts().verbose) {
    console.error('Promise:', promise);
  }
  process.exit(1);
});

// 優雅的退出處理
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n👋 感謝使用 OpenRouter Monitor!'));
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(chalk.yellow('\n👋 OpenRouter Monitor 正在關閉...'));
  process.exit(0);
});

// 解析指令行參數
program.parse(process.argv);

// 如果沒有提供任何指令，顯示說明
if (!process.argv.slice(2).length) {
  program.outputHelp();
}