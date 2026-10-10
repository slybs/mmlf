#!/bin/bash
# MLF 报告库 + 记录本地服务（macOS 双击入口）
cd "$(dirname "$0")" || exit 1
python3 tools/notes-server.py
echo ""
echo "按回车键关闭..."
read -r
