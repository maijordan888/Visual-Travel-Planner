@echo off
:: 切換到專案根目錄 (以防從其他地方執行)
cd /d "%~dp0"

echo "正在啟動後端伺服器 (新的視窗)..." 
start "Backend Server" cmd /k "cd backend && venv\Scripts\python -m uvicorn main:app --reload"

echo "正在啟動前端開發環境..."
cd frontend
npm run dev
