# Skill: Visual Travel Planner Architecture

此 Skill 旨在提供專案開發者與 AI Agent 快速理解「Visual Travel Planner」的技術框架與核心邏輯。

## 1. 技術棧 (Tech Stack)
- **Frontend**: React (Vite) + Zustand (State Management) + Google Maps SDK (vis.gl)
- **Backend**: FastAPI (Python) + SQLAlchemy (SQLite)
- **AI/API**: Google Gemini (Recommendations) + Google Places API New + Google Directions API

## 2. 核心數據模型 (Data Model)
### 前端狀態 (Zustand Store)
- `nodesByDay`: `{[day: number]: ItineraryNode[]}`。行程的核心，存儲每天的景點節點。
- `dayConfigs`: `{[day: number]: DayConfig}`。存儲每天的出發/回程地、時間等元數據。
- `activeDay`: 目前操作的天數索引。

### 節點狀態 (Node Status)
- `confirmed`: 已選定地點的景點節點。
- `pending_options`: 佔位節點，尚末选定地點，可顯示多個備選方案 (options)。

## 3. 核心業務邏輯 (Business Logic)
### 行程節點操作流程
1. **插入節點**: `insertEmptyNode(afterId)` 會在特定位置插入一個空的 `pending_options` 節點。
2. **選取地點**: 通過 `MapModal` 呼叫 `addOptionToNode`。此動作會將選中地點設為該節點的主要內容，並將原內容移至 `options` 清單中。
3. **動態計算**: 前端會根據 `nodesByDay` 直接計算渲染，避免使用失效的 Getter。

### AI 智能推薦
- **路徑**: `POST /recommend-places` -> `services.py`。
- **邏輯**: 傳入 `prev_place` 與 `next_place`，由 Gemini 分析沿途合適的景點，並回傳格式化的 JSON 結果。

## 4. 關鍵文件路徑
- **Frontend**:
  - `src/store/useTripStore.js`: 所有的狀態修改邏輯。
  - `src/components/MapModal.jsx`: 搜尋與探索的主要入口。
  - `src/components/ItineraryNode.jsx`: 時間軸上的個別節點 UI。
- **Backend**:
  - `backend/main.py`: API 路由入口。
  - `backend/services.py`: 複雜的 AI 處理與 API 調用邏輯。
  - `backend/models.py`: 數據庫 Schema 定義。

## 5. 已知問題與修復建議 (Known Issues)
- **天數溢出 Bug**: `setTripDates` 在更新 `startDate/endDate` 時會重算 `diffDays`。若觸發頻率過高或在渲染週期內調用，可能導致側邊欄天數無限增加。建議增加 Debounce 或更嚴格的輸入驗證。
- **數據持久化缺失**: 目前重新整理頁面會導致狀態遺失。建議在 `useTripStore` 中引入 Zustand 的 `persist` Middleware。
- **地圖中心同步**: MapModal 開啟時預設中心與目前行程上下文（Context）脫節。應優化 `itineraryCenter` 的初始化邏輯。
- **搜尋範圍偏差**: 若未指定 Bounds，AI 推薦可能回傳非目標區域的地點（例如東京行程出現台北景點）。需在 API Request 中加入 `locationRestriction`。

## 6. 開發注意事項 (Handover Notes)
- **狀態更新**: 注意 `nodesByDay` 是以天數為 Key 的物件，操作時需確保 Immutability。
- **UI 捲動**: 新增節點後應實作自動捲動（Auto-scroll），可利用 `Ref` 與 `scrollIntoView`。
- **API 欄位**: `Places API (New)` 需明確指定 `fetchFields`，否則會導致資料缺失。

## 7. 測試路徑 (Testing Path)
1. 確保 `npm run dev` (Frontend) 與 `uvicorn` (Backend) 皆在運行中。
2. 使用 `Chrome` 或其他現代瀏覽器開啟 `localhost:5173`。
3. 測試「新建行程」->「新增景點」->「AI 推薦」的完整閉環。
