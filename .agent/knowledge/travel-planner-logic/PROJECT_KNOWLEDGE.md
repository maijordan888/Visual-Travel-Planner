# Skill: Visual Travel Planner Architecture

此 Skill 旨在提供專案開發者與 AI Agent 快速理解「Visual Travel Planner」的技術框架與核心邏輯。

## 1. 技術棧 (Tech Stack)
- **Frontend**: React (Vite) + Zustand (State Management + Persist) + Google Maps SDK (vis.gl)
- **Backend**: FastAPI (Python) + SQLAlchemy (SQLite)
- **AI/API**: Google Gemini (Recommendations) + Google Places API New + Google Directions API

## 2. 核心數據模型 (Data Model)
### 前端狀態 (Zustand Store — `useTripStore.js`)
- `nodesByDay`: `{[day: number]: ItineraryNode[]}`。行程的核心，存儲每天的景點節點。
- `dayConfigs`: `{[day: number]: DayConfig}`。存儲每天的出發/回程地、時間等元數據。
- `activeDay`: 目前操作的天數索引。
- `tripId`: 行程穩定 ID，供 Google Sheets export/import 對應遠端 sheet。
- `localLastModifiedUtc`: 本機行程資料最後修改時間。所有會改變行程內容的 store action 都應同步更新。
- `sheetLastModifiedUtc`: 雲端 sheet 最後寫入時間。export 成功後回寫；不代表本機內容有改動。
- **持久化**: 使用 Zustand `persist` middleware，資料存於 localStorage key `travel-planner-store`。`partialize` 保存核心資料（tripId, tripTitle, startDate, endDate, localLastModifiedUtc, sheetLastModifiedUtc, dayConfigs, nodesByDay），不存暫態如 activeDay。

### PlaceSnapshot 契約
confirmed node 與 `options` 使用同一份地點資料 shape，避免備選點交換或雲端匯出入時遺失 PlaceID、地址與座標：

```js
{
  place_id: string | null,
  name: string,
  rating: number | null,
  address: string,
  lat: number | null,
  lng: number | null,
  photo_url: string | null,
  types: string[],
  tags: string[],
  notes: string,
}
```

node 仍保留 UI 現有欄位（如 `selected_place_id`, `selected_place_name`, `planned_stay_duration`），但資料寫入時會從 PlaceSnapshot 正規化。

### 節點狀態 (Node Status)
- `confirmed`: 已選定地點的景點節點。
- `pending_options`: 佔位節點，尚末选定地點，可顯示多個備選方案 (options)。

## 3. 核心業務邏輯 (Business Logic)
### 行程節點操作流程
1. **插入節點**: `insertEmptyNode(afterId)` 會在特定位置插入一個空的 `pending_options` 節點。
2. **選取地點**: 通過 `MapModal` 呼叫 `addOptionToNode`。此動作會將選中地點設為該節點的主要內容，並將原內容移至 `options` 清單中。
3. **動態計算**: 前端會根據 `nodesByDay` 直接計算渲染，避免使用失效的 Getter。
4. **自動捲動**: 新增節點後 `App.jsx` 會透過 `useRef` + `useEffect` 監聽 `dailyNodes.length` 變化，自動 `scrollIntoView({ behavior: 'smooth', block: 'center' })` 到最新節點。

### 備選方案切換 (Backup Option Swapping)
- `confirmOption(nodeId, optionId)` 現在會：
  1. 將目前已選定的地點完整轉成 PlaceSnapshot 後放回 `options` 清單
  2. 將被選中的 option 從清單中移除
  3. 設定新選中的 option 為 confirmed 狀態，並同步 `selected_place_id/name`, address, lat/lng, photo_url, types, tags, notes
- 此邏輯防止資料遺失與重複，確保切換備選方案時原本的選擇不會消失。

### 天數管理
- **刪除天數**: `removeDay(dayNumber)` 將指定天刪除，後續天數自動遞補 (Day 3 → Day 2)，`endDate` 同步調整。最少保留一天。
- **Delete UI (二次確認)**: 點擊垃圾桶進入 `confirming` 狀態（顯示「確定？」），再次點擊才執行刪除。3秒未點擊自動重設。
- **後端 AI 推薦**: 支援全域推薦（不限台灣），並可接收 `trip_context`（如行程標題）以提高地理相關性。
- **動態地圖中心**: 優先使用 `startLocation` Geocode。若失敗或無資料，則對 `tripTitle` 進行 Geocode fallback。若連 Geocoder 都失效（API 未啟動），會改用 `PlacesService.findPlaceFromQuery` 進行地點搜尋定位。不預設中心，改由使用者輸入動態調整。

### 交通時間計算 (Transport Time) — Deep Link + Fallback + Manual 混合模式
- 不再使用硬編碼的 "35 分鐘" / "55 分鐘"。
- `ItineraryNode.jsx` 透過 `useEffect` 呼叫 `api.getDirectionsTime(prevNodeName, selected_place_name, transport_mode)`。
- **三重邏輯**:
  1. **Manual Override (最高優先)**: 若 `nodeData.manual_transport_time` 有值，優先顯示此值，UI 會出現「手動: X 分鐘」。點擊「重設」可回到自動模式。
  2. **API Success**: 顯示 Google Directions API 計算結果。
  3. **Fallback**: transit 失敗時改抓 driving × 1.2。
- **Deep Link**: 所有模式（含手動）均可點擊「查看路線」開啟 Google Maps 檢查即時班次。
- **UI 狀態**:
  - 「AI 試算中...」(loading)
  - 「X 分鐘」(success)
  - 「⚠️ 估算 約 X 分鐘」(fallback)
  - 「手動: [輸入框] 分鐘」(manual) + 「還原」按鈕
- 透過 `updateNode(id, { manual_transport_time: val })` 進行持久化。

### AI 智能推薦 (兩套系統)
#### A. 行程規劃 Tab (ItineraryTab)
- **路徑**: `POST /recommend-places` -> `services.py::recommend_places()`
- **邏輯**: 傳入 `prev_place` 與 `next_place`，由 Gemini 分析沿途合適的景點。

#### B. 探索與推薦 Tab (ExplorePanel)
- **路徑**: `POST /ai-recommend` -> `services.py::ai_recommend_places()`
- **邏輯**: 先用 Google Places Nearby/Text Search 拉 20 個候選，再由 Gemini 過濾排名。
- **搜尋範圍**: 強制使用 `locationRestriction`（矩形或圓形），確保不跨區。
- **收合行為**: 搜尋完成後如有結果，使用即時 `results` 變數（非 stale `places` state）觸發 `setIsFormCollapsed(true)`。
- **Loading 差異化**: Google 模式顯示 skeleton card，AI 模式顯示專屬 sparkle + progress bar overlay。
- **AI Prompt 強化**: 嚴格禁止「高評分」「人氣高」等泛用標籤，要求使用場景型/體驗型/特色型/時段型/對象型標籤。
- **圖片 URL**: ExplorePanel 透過 `buildPhotoUrl(photo_ref)` 將 Google Places Photo Reference 轉為可顯示的 URL，隨 `handleAdd` 傳入 store。

### ExplorePanel 搜尋介面折疊機制
- `isFormCollapsed` state 控制搜尋表單的顯示/隱藏。
- **手動切換**：有搜尋結果時顯示 `collapse-toggle-btn`（含 ChevronUp/ChevronDown icon），點擊切換 collapsed 狀態。不再使用 `onMouseEnter` 自動展開（避免誤觸）。
- 折疊時 `search-form-content` 以 `max-height: 0` + `opacity: 0` 隱藏。
- **模式切換時自動重置**：切換 Google/AI subMode 時會清空 `places`、`error`、`hasSearched`、`isLoading`，避免 stale 結果殘留。
- CSS 透過 `.search-form-container.collapsed .search-form-content` 控制隱藏動畫。

### setTripDates 防護機制
- 同日期不重算（`start === state.startDate && end === state.endDate` → return `{}`）。
- 結束日早於開始日 → 自動校正為 start。
- `diffDays` 上限 30 天，防止溢出。

## 4. 架構層級 (Component Architecture)

### APIProvider 層級
- `APIProvider` 現在位於 `App.jsx` 最外層（非 `MapModal` 內），避免重複包裝或嵌套衝突。
- `MapModal` 不再包含 `APIProvider`，直接使用父層級提供的 API context。
- 這使得 `App.jsx` 中的出發地/回程地 `PlacePicker` 也能正常運作。

### 出發地/回程地自動補全
- `App.jsx` 的 day-config 區域使用 `PlacePicker` Web Component 取代純文字 input。
- 選擇地點後透過 `handleStartPlaceChange` / `handleEndPlaceChange` 更新 `dayConfig.startLocation` / `dayConfig.endLocation`。
- 外包 `.place-picker-wrapper` 提供一致的 border/focus 樣式。

### MapModal 功能分頁
`MapModal` 包含兩個核心分頁，操作前請確認目的再選擇正確 Tab：

1. **行程規劃 Tab (ItineraryTab)**
   - 直接搜尋特定地點，或查看起終點之間的 AI 順路推薦。
   - 適用於：已知要去哪裡，或需要 AI 填補行程空隙。

2. **探索與推薦 Tab (ExplorePanel)**
   - 以地圖中心為基準，搜尋周邊景點/餐廳。
   - **Google 模式**：關鍵字 + 類別分組搜尋。
   - **AI 模式**：透過自然語言 Prompt 讓 Gemini 過濾推薦地點。
   - 適用於：抵達某處後探索附近，或有特殊需求（如：慶生餐廳）。

**交互細節**：
- 搜尋結果出現後，搜尋面板自動收縮（可 hover/click 頂部提示條展開）。
- 列表 hover 時地圖 Marker 會變色放大（雙向同步）。
- 所有地點加入行程皆透過 `useTripStore` 的 `addOptionToNode` 動作。
- 地點資料結構必須包含：`id`, `name`, `rating`, `lat`, `lng`。

### 動態地圖中心 (MapModal)
- `MapModal` 啟動時依序嘗試以下來源決定初始中心：
  1. **prevPlace**（前一個景點名稱）— 讓地圖跟隨行程進度
  2. `currentDayConfig.startLocation`（當日出發地）
  3. 第一個 confirmed 節點的地名
  4. `tripTitle`（行程標題擷取地名）
- 使用 `window.google.maps.Geocoder` 將地名轉為經緯度。
- 如果 geocode 失敗則 fallback 到 `PlacesService.findPlaceFromQuery`。

## 5. 關鍵文件路徑
- **Frontend**:
  - `src/store/useTripStore.js`: 所有的狀態修改邏輯 + Zustand Persist。含 `removeDay`, `confirmOption` (swap logic), `addOptionToNode` 等。
  - `src/components/MapModal.jsx`: 搜尋與探索的主要入口，含 PlacePicker 自動聚焦 + 動態地圖中心。不含 APIProvider。
  - `src/components/ExplorePanel.jsx`: 探索面板，含 Google/AI 雙模式搜尋。
  - `src/components/ExplorePanel.css`: 探索面板樣式，含折疊動畫與 AI Loading overlay。
  - `src/components/ItineraryNode.jsx`: 時間軸上的個別節點 UI，含動態交通時間 API 呼叫 + 景點縮圖顯示。
  - `src/components/ItineraryNode.css`: 節點樣式，含 `.node-thumbnail` 縮圖（cover fit + rounded corners）。
  - `src/App.jsx`: 主頁面，含自動捲動邏輯 + APIProvider 包裝 + PlacePicker 出發地/回程地 + Day 刪除。
  - `src/api.js`: 前端 API 層，封裝所有後端呼叫。
- **Backend**:
  - `backend/main.py`: API 路由入口。
  - `backend/services.py`: 複雜的 AI 處理與 API 調用邏輯。
  - `backend/models.py`: 數據庫 Schema 定義。

## 6. 常見陷阱與修復紀錄 (Gotchas & Fix Log)
- **Stale Closure in ExplorePanel**: `handleSearch` 的 `finally` 區塊中不能引用 `places` state（它是 stale 的），需使用 `try` 區塊內的即時 `results` 變數。
- **Zustand Getter 問題**: `Object.assign` 會把 getter 變成靜態值。不要在 store 中定義 getter（如 `get dailyNodes()`），改在 component 直接計算。
- **天數溢出 Bug**: `setTripDates` 在觸發頻率過高或渲染週期內會陷入無限循環。已加入同日期跳過 + 30 天上限。
- **PlacePicker 聚焦**: Google Web Component 的 input 在 shadow DOM 內，需用 `shadowRoot?.querySelector('input')` 存取。
- **searchText vs searchNearby**: 有 keyword 時走 `searchText`（支援 `includedType` 單一值），無 keyword 時走 `searchNearby`（支援 `includedTypes` 陣列）。
- **APIProvider 嵌套**: 不可重複嵌套 `APIProvider`。現在統一在 `App.jsx` 最外層提供。
- **confirmOption 資料遺失**: 舊版 `confirmOption` 只更新選中項但不保留原 place 的資料。新版會將 current place 放回 options 並從 options 中移除新選中的項目。
- **Transport Time Stale Request**: `ItineraryNode` 的 transport time useEffect 使用 `cancelled` flag 防止 component unmount 後的 stale state 更新。
- **Photo URL 建構**: `ExplorePanel` 使用 `window.__GOOGLE_MAPS_API_KEY__`（由 `App.jsx` 設定）建構 Places Photo URL。`ItineraryNode` 內含 `onError` fallback 隱藏載入失敗的圖片。
- **addOptionToNode photo_url 保存**: store 的 `addOptionToNode` 會將 `place.photo_url` 存入節點資料，持久化後自動保留。
- **終點交通時間計算 (END_NODE)**: 為了讓終點 (回程飯店) 也能動態計算最後一哩路的交通時間，`App.jsx` 渲染 `isEndEndpoint` 時會傳入一個虛擬的 `nodeData` (`id: 'END_NODE'`)。`useTripStore` 的 `updateNode` 方法會攔截 `id === 'END_NODE'`，將交通時間與模式更新存儲到 `dayConfigs[activeDay].endNodeData` 中，並由 `App.jsx` 讀取來精準推算回程時間。

## 7. 開發注意事項 (Handover Notes)
- **狀態更新**: `nodesByDay` 是以天數為 Key 的物件，操作時需確保 Immutability。持久化後，初始 state 只在 localStorage 為空時使用。
- **UI 捲動**: 新增節點後已實作自動捲動（Auto-scroll），利用 `lastNodeRef` + `scrollIntoView`。
- **API 欄位**: `Places API (New)` 需明確指定 `fetchFields`，否則會導致資料缺失。
- **清除持久化資料**: 若需重置測試資料，在 console 執行 `localStorage.removeItem('travel-planner-store')`。
- **節點間距與新增按鈕**: `App.jsx` 中每個節點容器的 `marginBottom` 為 `64px`，使版面不會過於擁擠。而 `+` 號按鈕則精確對齊於時間軸線上 (`left: 86px`, `transform: translateX(-50%)`) 且置於兩個節點正中間 (`bottom: -32px`)。
- **編輯行程防呆與優化**: 行程標題與日期編輯具有 `onBlur` 與 Enter 鍵自動儲存功能。日期選擇器加入 `min` 與 `max` 限制，防止使用者選出回程日期早於出發日期的無效行程。

## 8. 測試路徑 (Testing Path)
1. 確保 `npm run dev` (Frontend) 與 `uvicorn` (Backend) 皆在運行中。
2. 使用 `Chrome` 或其他現代瀏覽器開啟 `localhost:5173`。
3. 測試「新建行程」->「新增景點」->「AI 推薦」的完整閉環。
4. 測試「重新整理頁面」後行程是否保留 (Persist 驗證)。
5. 測試「修改日期」極端情況 (30+ 天、同日期重複觸發)。
6. 測試「刪除天數」— 確認後續天數正確遞補、endDate 更新。
7. 測試「切換備選方案」— 確認原選擇放回 options、新選擇從 options 移除。
8. 測試「交通時間」— 確認 API 呼叫正常、Loading 狀態顯示。

## 9. 專案維護與快速啟動 (Maintenance & Quick Start)
- **快速啟動方式 (推薦)**: 根目錄已配置 `package.json`，使用 `concurrently` 同時啟動前後端。
- **啟動指令**: 在根目錄執行 `npm run dev`。
  - 前後端 Log 會標記顏色並整合在同一個視窗。
- **備用方式**: 根目錄提供 `run_dev.bat`，可分開視窗啟動（適合需要獨立視窗除錯時使用）。

## 10. Google Sheets 前端行程庫 Contract
- `frontend/src/api.js` 提供 Sheets wrapper，沿用 `API_BASE` 與 JSON header：`listSheetTrips()`、`exportTripToSheet(tripId, payload)`、`importTripFromSheet(tripId)`、`deleteSheetTrip(tripId)`。
- `TripLibraryModal` 是 v1 手動同步入口，UI 命名使用「行程庫 / 雲端行程」，不做自動同步或衝突合併。
- 後端 `/sheets/*` endpoint 尚未完成時，`TripLibraryModal` 只顯示錯誤提示，不做前端 mock success。
- export payload 使用 Phase 0 store contract：`meta.tripId`、`tripTitle`、`startDate`、`endDate`、`localLastModifiedUtc`、`sheetLastModifiedUtc`，以及 `dayConfigs`、`nodesByDay`。
- export 成功後由 App 呼叫 `setSheetLastModified(last_modified_utc)`；import 成功後呼叫 `loadTripFromArchive(trip_data)`。
- API path 固定為：`GET /sheets/trips`、`POST /sheets/export/{trip_id}`、`GET /sheets/import/{trip_id}`、`DELETE /sheets/trips/{trip_id}`。
- UI 操作驗證步驟放在 `.agent/workflows/trip-library-cloud-sync.md`。

### Google Sheets import/delete implementation notes
- Backend `/sheets/*` now supports list/export/import/delete. `TripLibraryModal` uses real API results and does not mock success.
- Visible `{trip_id}` sheets now include full route rows with `Node Type` values `start`, `regular`, and `end`. Start/end rows are for route readability and are imported back into `dayConfigs`, while `regular` rows are imported into `nodesByDay`.
- Each visible route row supports `Notes`. Regular place notes live on `node.notes`; endpoint notes live on `dayConfigs[day].startNotes` and `dayConfigs[day].endNotes`.
- Import validation keeps v1 conservative: PlaceID is authoritative when present; rows without PlaceID are imported by name only and return a warning, with no automatic re-geocode. Invalid time formats and departure-before-arrival also return validation warnings.
- Export payload is enriched in `App.jsx` before calling Sheets export: each regular node receives `planned_arrival_time`, `planned_departure_time`, and `transport_time_mins` based on the same per-day timeline calculation shown in the UI.
- The visible trip sheet transport column is now `Transport From Previous (mins)`, matching the current node data model where `manual_transport_time` / `auto_transport_time` describes travel from the previous stop to the current stop. Import remains backward-compatible with old `Transport To Next (mins)` sheets.
- `MapModal` PlacePicker now fetches and forwards `formattedAddress`, `location`, `photos`, `types`, `rating`, and `id` so direct map additions preserve PlaceSnapshot fields for Sheet export.
- Visible trip sheets include `lat` and `lng` columns in addition to `PlaceID`, `Address`, and `photo_url`; import reads those coordinates back when present. Existing sheets without these columns still import with null coordinates.
- UI date-time labels in the cloud sync surfaces use 24-hour time (`hour12: false`), and day config time inputs set `lang="en-GB"` so the top controls match timeline `HH:MM` display.
- Long itineraries can be switched from a fixed bottom-right floating day switcher in `App.jsx`. It opens a compact scrollable day list, calls the same `setActiveDay(day)` flow as the sidebar, then closes after selection. Styles live in `frontend/src/index.css` under `.floating-day-switcher`.

## 11. Markdown/PDF Offline Export Contract

- `frontend/src/export/tripExport.js` provides pure export helpers:
  - `normalizeTripForExport(tripData, options)` normalizes current store / imported Sheet trip data into `meta`, `days`, and `appendix`.
  - `buildTripMarkdown(tripData, options)` returns a Markdown string for offline reading.
  - `buildTripPrintHtml(tripData, options)` returns a self-contained HTML print view for browser "Save as PDF".
- `TripExportModal` is the v1 UI entry for offline export. It supports current-screen export, optional `GET /sheets/import/{trip_id}` refresh, Markdown preview, copy, `.md` download, and opening the print view.
- Export data treats every day as a full route: `start`, confirmed `regular` nodes, and `end`. This differs from `node_count`, which still counts only confirmed regular景點.
- Notes mapping:
  - start row: `dayConfigs[day].startNotes`
  - regular row: `node.notes`
  - end row: `dayConfigs[day].endNotes`
- Transport wording uses "from previous stop to this stop". Renderer field name is `transportFromPreviousMins`.
- If a regular place has `photo_url`, Markdown exports `![place name](photo_url)` when `includeImages` is true. Print HTML uses the same URL for magazine-like place images. Missing photos produce no placeholder.
- Print cover art does not use trip place photos. It uses generated static assets under `frontend/public/export-assets/` and selects an overall `bookletStyle`, not a single cover image. Current styles are `japan-cute`, `airport-minimal`, `retro-rail`, `coastal-weekend`, and `neon-night`; each style controls the cover art, palette, doodle strip, and fixed side decorations in the desktop print preview.
- v1 PDF is produced by browser print; do not add a backend PDF engine unless a later task explicitly changes this scope.
