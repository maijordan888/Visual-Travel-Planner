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

## 5. 開發注意事項
- **Getter 陷阱**: 在 Zustand 中避免使用 `get()` 定義動態計算屬性，應在 Component 層級計算以確保響應式。
- **Google API**: 搜尋功能高度依賴 `Places API (New)`，調用時需確保 `fetchFields` 包含所需欄位。
