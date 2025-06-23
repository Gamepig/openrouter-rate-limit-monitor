#!/bin/bash

# OpenRouter Rate Limit Monitor - 一鍵啟動監控腳本
# 使用方法: ./watch.sh [API_KEY] [間隔秒數] [警告閾值] [警報閾值]

set -e

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 顯示標題
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║              OpenRouter Rate Limit Monitor                   ║${NC}"
echo -e "${CYAN}║                  一鍵啟動監控腳本                           ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo

# 載入 .env 檔案（如果存在）
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# 參數設定
API_KEY=${1:-""}
INTERVAL=${2:-60}
WARN_THRESHOLD=${3:-80}
ALERT_THRESHOLD=${4:-95}

# 檢查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ 錯誤: 未安裝 Node.js${NC}"
    echo -e "${YELLOW}請先安裝 Node.js 16+ 版本${NC}"
    exit 1
fi

# 檢查 npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ 錯誤: 未安裝 npm${NC}"
    exit 1
fi

# 顯示系統資訊
echo -e "${BLUE}🔍 系統檢查:${NC}"
echo -e "   Node.js: $(node --version)"
echo -e "   npm: $(npm --version)"
echo -e "   作業系統: $(uname -s)"
echo

# 檢查是否在專案目錄內
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ 錯誤: 請在 openrouter-rate-limit-monitor 專案目錄內執行此腳本${NC}"
    exit 1
fi

# 檢查依賴是否已安裝
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 正在安裝依賴套件...${NC}"
    npm install
    echo -e "${GREEN}✅ 依賴套件安裝完成${NC}"
    echo
fi

# API Key 設定
if [ -z "$API_KEY" ]; then
    # 檢查環境變數
    if [ -n "$OPENROUTER_API_KEY" ]; then
        echo -e "${GREEN}🔑 使用環境變數中的 API Key${NC}"
        MASKED_KEY="${OPENROUTER_API_KEY:0:8}****${OPENROUTER_API_KEY: -4}"
        echo -e "   Key: $MASKED_KEY"
    else
        # 檢查是否有儲存的 Key
        KEY_COUNT=$(node -e "
            try {
                const monitor = require('./src/index');
                const m = new monitor();
                console.log(m.config.listKeys().length);
            } catch(e) {
                console.log(0);
            }
        ")
        
        if [ "$KEY_COUNT" -gt 0 ]; then
            echo -e "${GREEN}🔑 找到 $KEY_COUNT 個已儲存的 API Key${NC}"
            echo -e "${BLUE}使用 'node bin/openrouter-monitor.js keys list' 查看${NC}"
        else
            echo -e "${RED}❌ 未找到 API Key${NC}"
            echo -e "${YELLOW}設定方法:${NC}"
            echo -e "   1. 設定環境變數: export OPENROUTER_API_KEY=your_key"
            echo -e "   2. 儲存 Key: node bin/openrouter-monitor.js keys add default your_key"
            echo -e "   3. 執行時指定: ./watch.sh your_key"
            echo
            read -p "是否要現在設定 API Key？(y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                echo -n "請輸入您的 OpenRouter API Key: "
                read -s USER_API_KEY
                echo
                
                if [[ $USER_API_KEY == sk-or-v1-* ]]; then
                    node bin/openrouter-monitor.js keys add default "$USER_API_KEY"
                    echo -e "${GREEN}✅ API Key 已儲存${NC}"
                else
                    echo -e "${RED}❌ 無效的 API Key 格式${NC}"
                    exit 1
                fi
            else
                echo -e "${YELLOW}監控已取消${NC}"
                exit 0
            fi
        fi
    fi
fi

# 顯示監控設定
echo -e "${BLUE}📊 監控設定:${NC}"
if [ -n "$API_KEY" ]; then
    MASKED_KEY="${API_KEY:0:8}****${API_KEY: -4}"
    echo -e "   API Key: $MASKED_KEY"
fi
echo -e "   檢查間隔: ${INTERVAL} 秒"
echo -e "   警告閾值: ${WARN_THRESHOLD}%"
echo -e "   警報閾值: ${ALERT_THRESHOLD}%"
echo

# 確認啟動
read -p "是否開始監控？(Y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Nn]$ ]]; then
    echo -e "${YELLOW}監控已取消${NC}"
    exit 0
fi

# 建立監控指令
MONITOR_CMD="node bin/openrouter-monitor.js watch --interval $INTERVAL --warn-threshold $WARN_THRESHOLD --alert-threshold $ALERT_THRESHOLD --notify"

# 如果有指定 API Key，添加到指令中
if [ -n "$API_KEY" ]; then
    MONITOR_CMD="$MONITOR_CMD --key $API_KEY"
fi

echo -e "${GREEN}🚀 啟動監控...${NC}"
echo -e "${CYAN}指令: $MONITOR_CMD${NC}"
echo -e "${YELLOW}按 Ctrl+C 停止監控${NC}"
echo

# 錯誤處理函數
cleanup() {
    echo
    echo -e "${YELLOW}👋 監控已停止${NC}"
    exit 0
}

# 設定信號處理
trap cleanup SIGINT SIGTERM

# 執行監控
eval $MONITOR_CMD