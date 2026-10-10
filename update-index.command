#!/bin/bash
# macOS 双击入口：重新扫描 reports/ 生成 data/reports.js
cd "$(dirname "$0")" || exit 1
python3 tools/build-index.py
echo ""
echo "按回车键关闭..."
read -r
