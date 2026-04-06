# 視覺化旅遊行程規劃系統 (Project Context)

本專案是一個具備高度視覺化、支援 AI 推薦與行程時間防呆的行程規劃工具，採用 React/Vite 作為前端，將以 Python FastAPI 作為後端。

## 目前進度摘要 (Progress)
這份檔案是留給未來的 AI Agent 快速掌握現況的指引：

1. **Phase 1 & 2 (Frontend) - [COMPLETED]**
   - 建立並套用全域 CSS 與 RWD 響應式排版 (玻璃擬態、動態 UI)。
   - 使用 Zustand 代碼化為 `useTripStore.js` 處理全域狀態（設定每日時間範圍、加入與刪除備選景點、狀態切換）。
   - 實作防呆警告視覺效果（紅底背景與頂端橫幅）。
   - 完成單線瀑布流的 `ItineraryNode` 節點 UI 與交通工具變更切換功能。

2. **Phase 3 (Backend API) - [NEXT STEP PENDING]**
   - **目標**：接手撰寫後端 API。
   - **需求**：
     - 使用 SQLite 作為主邏輯資料庫，建置 `Trips` 與 `Daily_Nodes` 資料表，並將 Google Sheets 退階為純粹匯出功能的備份端點。
     - 整合 Google Directions API 計算交通時間，並實作 SQLite 緩存與前端傳入的 `force_refresh` 決定是否要打外部 API (`dayConfig.autoUpdate`)。
     - 整合 Google GenAI 或符合的 LLM，以系統指定的 Prompt 生成順路景點與預估的停留時間 (`durationMins`) 給前台作為備選名單 `options`。
   - **實作建議**：請查閱 `C:\Users\user\.gemini\antigravity\brain\...` 中的 `implementation_plan.md` 與 `task.md`。或可從這個 Git Repo 中查看 `frontend/src/store/useTripStore.js` 來對齊前端所需的 JSON 資料結構。

## 環境設定 (Environments)
- **Node.js**: v20+ 
- **Python**: 3.11+ 
- Frontend 開發伺服器執行方式：`cd frontend && npm run dev`
- Backend 將使用 FastAPI，目前 `/backend` 存在舊有檔案，請依照上述原則重構。
