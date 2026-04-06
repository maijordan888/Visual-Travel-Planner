# 視覺化旅遊行程規劃系統 (Project Context)

本專案是一個具備高度視覺化、支援 AI 推薦與行程時間防呆的行程規劃工具，採用 React/Vite 作為前端，將以 Python FastAPI 作為後端。

## 目前進度摘要 (Progress)
這份檔案是留給未來的 AI Agent 快速掌握現況的指引：

1. **Phase 1 & 2 (Frontend) - [COMPLETED]**
   - 建立並套用全域 CSS 與 RWD 響應式排版 (玻璃擬態、動態 UI)。
   - 使用 Zustand 代碼化為 `useTripStore.js` 處理全域狀態。
   - 實作防呆警告視覺效果（確保 CSS 疊層與 Z-index 修正）。
   - 完成單線瀑布流的 `ItineraryNode` 節點 UI 與備選項切換。

2. **Phase 3 (Backend API) - [COMPLETED]**
   - 使用 SQLite (`Trips`, `Daily_Nodes`, `Directions_Cache`) 建構資料庫。
   - 整合 Gemini AI 以 Prompt 生成順路景點與預估停留時間。
   - 實作 `services.py` 處理推薦與交通時間計算 (快取)。

3. **Phase 4 (Frontend Integration & Maps) - [IN PROGRESS]**
   - **完成項目**：將 `MapModal.jsx` 與後端 Gemini 生成端點串接，AI 推薦的資料可成功加入 Zustand State (`addOptionToNode`)。
   - **完成項目**：引入 `@react-google-maps/api` 實裝真實 Google 地圖與 Places Autocomplete。
   - **⚠️ 待解決/已知坑點 ⚠️**：
     目前 `@react-google-maps/api` 的 Autocomplete 使用了「舊版 Places API (Legacy)」。Google 對 2025 年後建立的新專案強制鎖定禁用舊版功能。
     目前已提供兩條路徑供後續開發者選擇（明天待定）：
       A. 使用隱藏網址強制開通 Legacy Places API 即可跑起預設。
       B. 改用 `@vis.gl/react-google-maps` 全面升級以應對 Google 新版 Places API (New)。

## 環境設定 (Environments)
- **Node.js**: v20+ (`frontend/.env` 需設定 `VITE_GOOGLE_MAPS_API_KEY`)
- **Python**: 3.11+ (`backend/.env` 需設定 `GOOGLE_MAPS_API_KEY`, `GEMINI_API_KEY`)
- 前端啟動：`cd frontend && npm run dev`
- 後端啟動：`cd backend && py -3.11 -m uvicorn main:app --reload`
