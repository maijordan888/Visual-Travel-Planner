# Task: 行程管理 UX 與 Google Sheets 時間欄位同步整理

**任務狀態**: 待執行  
**優先級**: 高  
**預估規模**: 中型  
**負責人**: AI Agent / 工程師  
**建立時間**: 2026-05-09  

---

## 背景與目標

Google Sheets v1 已能完成手動「列出雲端行程 / 覆寫到雲端 / 讀回 / 刪除」，但目前操作語意仍偏工程功能，使用者在主畫面不容易理解：

1. 目前正在編輯哪一個行程。
2. 目前行程是否已儲存到雲端。
3. 「覆寫到雲端」是否等同「儲存」。
4. 如何從既有雲端行程切換回目前行程。

另外，端到端測試建立「東京2日遊（KIX進出）」後發現：Google Sheet 的 `Arrival Time`、`Departure Time`、`Transport To Next (mins)` 欄位未完整寫入。這不是 Sheets 服務壞掉，而是目前前端 export payload 沒有把畫面計算出的 arrival/departure/transport 時間穩定送出。

本任務目標是先改善 v1 可用性與資料可讀性，不做 v2 自動同步、自動合併或 re-geocode。

---

## 測試觀察

### 已驗證成功

- 從頁面建立新行程。
- 透過 PlacePicker 設定每日出發地與回程地。
- 透過「新增第一站」與地圖搜尋加入景點。
- 透過「行程庫」點擊「覆寫到雲端」成功寫入 Google Sheets。
- `__SUMMARY__` 能新增行程摘要。
- `__TRIP_METADATA__` 能保存 `dayConfigs`，包含起終點與座標。
- `GET /sheets/import/{trip_id}` 能讀回且無 validation errors。

### 發現問題

- 主畫面沒有固定的「目前行程 / 儲存狀態 / 雲端狀態」區塊。
- 「覆寫到雲端」對一般使用者不像「儲存」。
- 日期編輯 UX 不夠直覺，測試中直接修改日期不穩定，最後用「新增一天」才建立 2 日行程。
- Sheet visible trip row 有 `PlaceID` 和景點名稱，但 `Address`、`photo_url` 常為空。
- Sheet 的 `Arrival Time`、`Departure Time` 沒有寫入。
- Sheet 的 `Transport To Next (mins)` 沒有寫入自動畫面估算時間。

---

## 交通時間前提

目前日本大眾運輸資訊不一定能透過既有 API 可靠取得，因此畫面上顯示的 transit 時間可能是由汽車時間 fallback 推估，例如乘以 2。

因此本任務先不把「KIX 到東京約 450 分鐘」視為演算法錯誤。短期只做：

- 在 UI 上標示 fallback / 估算來源，避免使用者誤以為是精準捷運時間。
- 保留人工修正交通時間入口。
- Sheet 應寫入目前畫面採用的時間值，無論來源是 manual、API estimate 或 fallback estimate。

未來可另開 v2 任務處理日本交通資料來源或更準確估算。

---

## Phase 1: 主畫面行程狀態 UX

### 目標

讓使用者不用打開 modal，也能知道目前正在編輯哪個行程與雲端狀態。

### 預計改動

**檔案**: `frontend/src/App.jsx`

- 在 sidebar 的行程標題區下方顯示：
  - 目前行程名稱。
  - 日期範圍。
  - `tripId` 的短版或同步狀態。
  - `sheetLastModifiedUtc`：尚未同步 / 上次儲存時間。
  - `localLastModifiedUtc` 若晚於 `sheetLastModifiedUtc`，顯示「有未儲存變更」。
- 將目前「點標題進入編輯」改得更明顯，例如增加鉛筆 icon 或「編輯」按鈕。

---

## Phase 2: 行程庫操作語意整理

### 目標

把 `TripLibraryModal` 從工程式同步工具整理成使用者可理解的行程管理入口。

### 預計改動

**檔案**:

- `frontend/src/components/TripLibraryModal.jsx`
- `frontend/src/components/TripLibraryModal.css`
- `.agent/workflows/trip-library-cloud-sync.md`

### UI 文案

- `覆寫到雲端` 改為 `儲存到雲端`。
- 若目前雲端已有同 tripId，按鈕旁或確認文字說明「會覆寫雲端版本」。
- 雲端列表的 `讀回` 可改為 `載入` 或 `切換到此行程`。
- `目前` 標籤保留，但要讓使用者理解這是目前正在編輯的行程。

### 行為

- 儲存前若偵測到雲端版本較新，v1 先顯示確認提示，不做自動合併。
- 載入雲端行程前若本機有未儲存變更，v1 先顯示確認提示。
- 成功儲存後更新目前行程卡片與雲端列表。

---

## Phase 3: Export Payload 補齊時間欄位

### 問題

`backend/sheets_service.py` 已支援：

- `planned_arrival_time` -> `Arrival Time`
- `planned_stay_duration` -> `Stay Duration (mins)`
- `Departure Time` 由 arrival + stay duration 計算
- `manual_transport_time` / `transport_time_mins` / `travel_time_mins` -> `Transport To Next (mins)`

但目前前端送出的 `nodesByDay` 多數只有原始 node 狀態，沒有將 `App.jsx` 畫面計算出的 `arrivalTime` 和有效交通時間寫入 export payload。

### 預計改動

**檔案**: `frontend/src/App.jsx`

- 建立 export 專用 payload builder，例如 `buildCurrentTripPayload()`。
- 以目前畫面同一套時間計算邏輯產出每個 confirmed node 的：
  - `planned_arrival_time`
  - `planned_departure_time`（可選；若後端仍自行算 departure，可先不送）
  - `transport_time_mins` 或統一命名的 `auto_transport_time`
- 對「從上一站到本景點」與「本景點到下一站」的欄位語意重新確認。

**檔案**: `backend/sheets_service.py`

- 確認 `Transport To Next (mins)` 欄位目前實際寫的是哪一段交通：
  - 若 node 上存的是「從上一站到本點」，Sheet 欄名應改成 `Transport From Previous (mins)`。
  - 若要維持 `Transport To Next (mins)`，前端需在 export payload 中把下一段交通時間放到前一個 node。
- v1 建議二選一，避免 Sheet 欄名與資料方向不一致。

### 建議方向

短期建議把欄位改成 `Transport From Previous (mins)`，因為目前 UI 的交通時間顯示在景點上方，語意是「從上一站到此景點」。

---

## Phase 4: 地點資料補齊

### 問題

透過 `MapModal` 的「行程規劃」PlacePicker 加入景點時，目前常只保存：

- `place_id`
- `name`
- `rating`
- `tag`

但沒有保存：

- `address`
- `lat`
- `lng`
- `photo_url`
- `types`

這導致 Sheet 的 `Address` 欄空白，也降低 import 後的可用性。

### 預計改動

**檔案**:

- `frontend/src/components/MapModal.jsx`
- `frontend/src/components/ExplorePanel.jsx`
- `frontend/src/store/useTripStore.js`

要求：

- `MapModal.handlePlaceChange` fetch fields 時補齊：
  - `formattedAddress`
  - `location`
  - `photos`
  - `types`
  - `rating`
  - `id`
- 傳入 `onAddNode()` 的 place shape 應符合 `PlaceSnapshot`。
- `ExplorePanel` 與 `MapModal` 加入景點時使用一致資料契約。

---

## Phase 5: 日期與天數編輯 UX

### 問題

測試中直接修改日期不夠穩定，且目前「新增一天」會自然延長 endDate，但使用者不一定知道日期與 Day tabs 的關係。

### 預計改動

- 日期編輯區加入明確的「套用日期」或即時錯誤提示。
- 當 start/end date 會影響天數時，顯示將新增/移除的 Day 數。
- 防止 onBlur 太早關閉編輯模式，造成 date input 尚未套用完成。

---

## Test Cases

- [x] 主畫面能看出目前行程是否已儲存到雲端。
- [x] 點 `儲存到雲端` 後，`sheetLastModifiedUtc` 更新且顯示為已同步。
- [x] 有未儲存變更時，主畫面顯示提示。
- [x] 載入雲端行程前，若本機有未儲存變更，會出現確認。
- [x] Export 後 Sheet 有 `Arrival Time`。
- [x] Export 後 Sheet 有 `Departure Time`。
- [x] Export 後 Sheet 有交通時間，且欄位名稱與資料方向一致。
- [x] 從 MapModal 加入的景點，在 Sheet 中保留 PlaceID、Address、lat/lng 或可還原座標。
- [x] 日期直接編輯能穩定建立 2 日以上行程。

---

## 非本任務範圍

- 自動背景同步。
- 多人同時編輯合併。
- Sheet 缺 PlaceID 時自動 re-geocode。
- 日本大眾運輸時間的精準資料源整合。
- 多 spreadsheet / OAuth 使用者帳號管理。

## Implementation Update: 2026-05-09

- Completed the Sheet time export fix: `App.jsx` now enriches the export payload with `planned_arrival_time`, `planned_departure_time`, and `transport_time_mins` for each itinerary node before calling `POST /sheets/export/{trip_id}`.
- Renamed the visible trip sheet transport column to `Transport From Previous (mins)` because the frontend node stores travel time from the previous stop to the current stop. Backend import still accepts the previous `Transport To Next (mins)` header for older sheets.
- Extended `MapModal` direct PlacePicker additions to pass `place_id`, `address`, `lat`, `lng`, `photo_url`, `types`, and `tags`, so newly added places have enough PlaceSnapshot data for Sheet export.
- Added visible Sheet `lat` / `lng` columns and import support, so PlaceSnapshot coordinates can round-trip when present.
- Completed the main-screen trip/sync status block in the sidebar: current trip id, confirmed/pending counts, cloud timestamp, and local-dirty status are now visible without opening the modal.
- Cleaned up `TripLibraryModal` wording and destructive/overwriting actions: `儲存到雲端`, `確認儲存`, `載入`, `確認載入`, and `確認刪除`.
- Completed date/title edit UX cleanup: edits are staged locally, `套用` commits changes, `取消` discards changes, and invalid date ranges show an inline error instead of mutating the store immediately.
- Completed Test Cases verification:
  - `npm.cmd run build` passed.
  - Backend compile passed.
  - Browser UI verified main sync card, local dirty state, TripLibraryModal copy, and import confirmation.
  - UI export verified `sheetLastModifiedUtc` updates and main screen shows `已同步到雲端`.
  - Temporary Google Sheets export/import/delete verified `Arrival Time`, derived `Departure Time`, `Transport From Previous (mins)`, `PlaceID`, `Address`, `lat`, `lng`, and `photo_url` round-trip.
  - Browser UI verified direct date editing can apply a 2-day range and restore a 3-day range.
