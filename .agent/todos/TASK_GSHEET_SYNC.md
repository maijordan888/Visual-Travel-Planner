# Task: Google Sheets 雲端存檔與同步系統

**任務狀態**: 待執行  
**優先級**: 高  
**預估規模**: 大型  
**負責人**: AI Agent / 工程師  
**建立時間**: 2026-05-09  
**最後調整**: 2026-05-09

---

## 背景與目標

目前行程資料主要存在 Zustand persist 的 `localStorage`，無法跨裝置存取，也缺少可閱讀、可手動備份的格式。本任務要建立「Web UI ↔ Google Sheets」的雲端存檔與讀回機制。

v1 目標是穩定完成：

1. 在 App 中查看 Google Sheets 上的行程庫。
2. 將目前行程覆寫同步到 Sheet。
3. 從 Sheet 載入既有行程回 App。
4. 刪除 Sheet 中的行程。
5. Sheet 保持人工可閱讀，允許有限度手動調整。

v1 不做完整多人同步、自動合併、背景自動同步，也不做高風險自動 re-geocode。這些列入 v2。

---

## Phase 0: 資料契約與 Store Migration

在接 Google Sheets 前，必須先補穩前端資料模型。否則 export/import 會因缺少穩定 ID、timestamp 或地點欄位而返工。

### Zustand Store Metadata

**檔案**: `frontend/src/store/useTripStore.js`

新增 persist 欄位：

```js
{
  tripId: string,                 // 穩定行程 ID，格式建議 TRIP_YYYYMMDD_XXXX
  localLastModifiedUtc: string,   // localStorage 最後修改時間，ISO 8601
  sheetLastModifiedUtc: string | null,
}
```

要求：

- `createNewTrip()` 產生新的 `tripId`，並清空 `sheetLastModifiedUtc`。
- 所有會改行程資料的 action 都要更新 `localLastModifiedUtc`。
- `partialize` 必須 persist `tripId`、`localLastModifiedUtc`、`sheetLastModifiedUtc`。
- 舊 localStorage 若沒有 `tripId`，migration 時自動補一個新 `tripId` 與 timestamp。
- 新增 `loadTripFromArchive(tripData)`，用於 import 後一次性還原 `tripTitle`、dates、`dayConfigs`、`nodesByDay`、timestamp。

### PlaceSnapshot 契約

confirmed node 與 options 都應盡量使用同一份地點快照，避免備選點交換後遺失 PlaceID、地址或座標。

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

對應到目前 node 欄位時：

- `selected_place_id` 來自 `place_id`。
- `selected_place_name` 來自 `name`。
- `address`、`lat`、`lng`、`photo_url`、`types`、`tags`、`notes` 直接存在 node 上。
- `notes` 初始為空字串。

### Store Actions 必修

- `addOptionToNode(nodeId, place)` 要把 `place_id`、`address`、`lat`、`lng`、`photo_url`、`types`、`tags` 一起寫入 confirmed node。
- `confirmOption(nodeId, optionId)` 切換備選點時，必須保留完整 PlaceSnapshot，不可只搬 `name`、`durationMins`、`rating`。
- 目前 confirmed node 被放回 options 時，也要放完整 PlaceSnapshot。
- `ExplorePanel.handleAdd` 必須傳入後端已回傳的 `place_id`、`address`、`types`、`lat`、`lng`、`photo_url`。

---

## Phase 1: 後端 Sheets 環境與連線

### 套件

**檔案**: `backend/requirements.txt`

新增：

```txt
gspread
google-auth
```

### Service Account 設定

不要給 Cloud project 層級的「編輯者」角色。建議流程：

1. Google Cloud Console 啟用 Google Sheets API 與 Google Drive API。
2. 建立 Service Account，下載 JSON key。
3. 將 JSON 存為 `backend/credentials/gsheet_service_account.json`。
4. 在目標 Google Spreadsheet 的分享設定中，把 Service Account email 加為編輯者。
5. 在 `backend/.env` 或環境變數加入 `GSHEET_SPREADSHEET_ID=<spreadsheet_id>`。
6. `.gitignore` 必須包含 `backend/credentials/`，金鑰不可進 git。

### `backend/sheets_service.py`

新建後端核心模組，集中處理 Sheets 讀寫：

```python
SUMMARY_SHEET_NAME = "__SUMMARY__"

def get_client() -> gspread.Client: ...
def get_spreadsheet() -> gspread.Spreadsheet: ...

def ensure_summary_sheet() -> None: ...
def get_all_trips_summary() -> list[dict]: ...
def upsert_trip_summary(trip_id: str, meta: dict) -> dict: ...
def delete_trip_summary(trip_id: str) -> None: ...

def export_trip_to_sheet(trip_id: str, trip_data: dict) -> dict: ...
def import_trip_from_sheet(trip_id: str) -> dict: ...
def delete_trip_sheet(trip_id: str) -> None: ...
```

錯誤處理：

- 缺少 `GSHEET_SPREADSHEET_ID` 回傳明確設定錯誤。
- 找不到 credentials 檔案時回傳明確設定錯誤。
- 找不到 trip sheet 時回傳 404 語意錯誤。

---

## Phase 2: Google Sheet Schema

### 匯總表 `__SUMMARY__`

| 欄 | 欄名 | 型別 | 說明 |
|---|---|---|---|
| A | `trip_id` | String | 穩定行程 ID |
| B | `trip_name` | String | 行程標題 |
| C | `start_date` | Date | `YYYY-MM-DD` |
| D | `end_date` | Date | `YYYY-MM-DD` |
| E | `days_count` | Number | 行程天數 |
| F | `node_count` | Number | regular 景點數 |
| G | `last_modified_utc` | String | Sheet 最後同步時間 |
| H | `status` | String | `active` / `archived` |

### 個別行程表 `{trip_id}`

v1 只 export/import `nodesByDay` 裡的 regular 景點。`dayConfigs` 的起點、終點、每日開始時間保存在 metadata，不轉成 `start/end` rows。

| 欄 | 欄名 | 型別 | 說明 | 是否公式 |
|---|---|---|---|---|
| A | `Day` | Number | 第幾天 | 否 |
| B | `到達時間` | Time | `HH:MM`，可空 | 否 |
| C | `離開時間` | Time | `HH:MM`，可空 | 否 |
| D | `停留時長(分)` | Number | `=IF(C2="","",ROUND((C2-B2)*1440,0))` | 是 |
| E | `景點名稱` | String | display name | 否 |
| F | `詳細地址` | String | formatted address | 否 |
| G | `Google Maps 連結` | URL | PlaceID 連結 | 否 |
| H | `標籤` | String | 逗號分隔 | 否 |
| I | `備註` | String | 使用者備註 | 否 |
| J | `交通到達(分)` | Number | 從上一點到本點的交通時間 | 否 |
| K | `交通方式` | String | `transit / driving / walking / bicycling` | 否 |
| L | `PlaceID` | String | Google Place ID，不帶 `places/` 前綴 | 否 |
| M | `photo_url` | String | 圖片 URL，程式填入 | 否 |

實作要求：

- Row 1 為表頭並凍結。
- 天與天之間不插空行，用 `Day` 欄區分。
- D 欄每列寫入公式；若使用者改成純數字，下次 export 會重新注入公式。
- G 欄可用 `=HYPERLINK(url, "開啟地圖")`。
- 起終點、`dayConfigs`、`tripTitle`、日期、timestamp 建議存於 hidden metadata sheet 或 row-level metadata；若 v1 先不做 hidden metadata，也必須由 API payload 保留並寫回 summary 可還原資訊。
- v1 不使用 `node_type` 欄位；若為了相容保留，值固定為 `regular`，不要讓使用者以為可編輯 start/end row。

---

## Phase 3: 後端 API 契約

**檔案**: `backend/main.py`, `backend/schemas.py`

統一使用下列 endpoint：

```python
@app.get("/sheets/trips")
def list_sheets_trips() -> list[dict]: ...

@app.post("/sheets/export/{trip_id}")
def export_trip(trip_id: str, payload: TripExportPayload) -> dict: ...

@app.get("/sheets/import/{trip_id}")
def import_trip(trip_id: str) -> dict: ...

@app.delete("/sheets/trips/{trip_id}")
def delete_sheets_trip(trip_id: str) -> dict: ...
```

`import` 是讀取動作，v1 統一用 `GET /sheets/import/{trip_id}`，不要混用 POST。

### Pydantic Schema

```python
class TripMeta(BaseModel):
    tripId: str
    tripTitle: str
    startDate: str
    endDate: str
    localLastModifiedUtc: str | None = None
    sheetLastModifiedUtc: str | None = None

class TripExportPayload(BaseModel):
    meta: TripMeta
    dayConfigs: dict
    nodesByDay: dict

class SheetValidationIssue(BaseModel):
    row: int | None = None
    field: str
    issue: str
    severity: str = "warning"   # warning / error
    auto_fixed: bool = False
    original_value: str | None = None
    corrected_value: str | None = None
```

API 回傳：

- export: `{ success, sheet_url, last_modified_utc }`
- import: `{ trip_data, validation_errors }`
- delete: `{ success }`

---

## Phase 4: 前端 API Wrapper 與 TripLibraryModal

### `frontend/src/api.js`

沿用現有 `API_BASE` 與 JSON header 寫法，不要直接呼叫相對路徑。

```js
async listSheetTrips() { ... }                    // GET /sheets/trips
async exportTripToSheet(tripId, payload) { ... }  // POST /sheets/export/{tripId}
async importTripFromSheet(tripId) { ... }         // GET /sheets/import/{tripId}
async deleteSheetTrip(tripId) { ... }             // DELETE /sheets/trips/{tripId}
```

建議同時補一個共用 `requestJson` helper，集中處理非 2xx 與 JSON parse error。

### `TripLibraryModal`

**檔案**: `frontend/src/components/TripLibraryModal.jsx`

原規劃的 `ArchiveModal` 改名為 `TripLibraryModal`，避免「封存」語意限制未來擴展。Header 按鈕文案建議用「行程庫」或「雲端行程」，不要用「時光機」作為主要功能名稱。

功能：

- 開啟時呼叫 `GET /sheets/trips`。
- 顯示 trip title、日期、天數、景點數、最後同步時間。
- 每筆提供：
  - `載入`: 呼叫 `GET /sheets/import/{trip_id}`，成功後 `loadTripFromArchive(trip_data)`。
  - `覆寫同步`: 將目前 Zustand 行程組成 `TripExportPayload`，呼叫 `POST /sheets/export/{trip_id}`。
  - `刪除`: 呼叫 `DELETE /sheets/trips/{trip_id}`，成功後刷新列表。
- v1 不做自動衝突合併；若 `sheetLastModifiedUtc` 比 local 新，先以手動覆寫 / 讀回入口為主，完整衝突確認 UI 放到後續分支。
- import 有 `validation_errors` 時，在 modal 中顯示警告列表。

### Frontend Library Branch Notes

`codex-gsheet-frontend-library` 已先完成前端手動同步入口：

- `frontend/src/api.js` wrapper 名稱固定為 `listSheetTrips()`、`exportTripToSheet()`、`importTripFromSheet()`、`deleteSheetTrip()`。
- `TripLibraryModal` 只處理手動 list/export/import/delete 入口，後端尚未完成時以錯誤提示呈現，不做 mock success。
- App 以 Phase 0 store contract 組 payload；export 成功後回寫 `setSheetLastModified(last_modified_utc)`，import 成功後呼叫 `loadTripFromArchive(trip_data)`。
- UI 操作驗證流程記錄於 `.agent/workflows/trip-library-cloud-sync.md`。

---

## Phase 5: Import Validation Rules

v1 原則：保守讀取，不自動猜測地點。

| 規則 | 偵測方式 | v1 處理 |
|---|---|---|
| 時間格式不標準 | Regex `^\d{1,2}:\d{2}$` | 可補零，記錄 warning |
| 離開時間 < 到達時間 | 比較 C < B | 不自動修正，記錄 warning |
| PlaceID 有值 | 欄 L 非空 | 以 PlaceID 為準，地名只是顯示 |
| PlaceID 缺失但有地名 | 欄 L 空、欄 E 有值 | 不自動 re-geocode，建立 warning；可轉成 `pending_options` |
| 景點名稱空白 | 欄 E 空 | 跳過該 row，記錄 error |
| Day 非數字 | 欄 A 非數字 | 跳過該 row，記錄 error |
| 停留公式被改 | D 欄非公式 | import 可讀數值；下一次 export 重新注入公式 |

自動 re-geocode 放到 v2，避免 v1 因地名歧義、語系、地區 bias 或 quota 造成錯配。

---

## Phase 6: 建議開發順序

1. Phase 0：補 `tripId`、timestamp、store migration、`loadTripFromArchive`。
2. Phase 0：統一 PlaceSnapshot，修 `addOptionToNode`、`confirmOption`、`ExplorePanel.handleAdd` payload。
3. Phase 1：安裝依賴、設定 credentials、`.gitignore` 加入 `backend/credentials/`。
4. Phase 1：建立 `sheets_service.py` 連線與 `__SUMMARY__` 初始化。
5. Phase 2/3：完成 export-only MVP 與 `POST /sheets/export/{trip_id}`。
6. Phase 4：加入 `TripLibraryModal` 列表與「覆寫同步」。
7. Phase 5：完成 `GET /sheets/import/{trip_id}` 與 validation warnings。
8. Phase 4：完成「載入」與衝突確認 UI。
9. 完成 `DELETE /sheets/trips/{trip_id}` 與前端刪除。
10. 整合測試與文件更新。

---

## Test Cases

- [ ] 舊 localStorage 沒有 `tripId` 時，migration 會補新 `tripId`，且資料不遺失。
- [ ] 修改 trip title、日期、day config、node、notes 後，`localLastModifiedUtc` 會更新。
- [ ] `ExplorePanel.handleAdd` 加入景點後，node 保留 `place_id`、`address`、`lat`、`lng`、`photo_url`、`types`。
- [ ] `confirmOption` 後，新的 confirmed node 不遺失 PlaceID/address/lat/lng/photo_url/tags。
- [ ] export 3 天 8 個景點後，Sheet row、summary row、公式欄位都正確。
- [ ] export 成功後，前端回寫 `sheetLastModifiedUtc`。
- [ ] frontend wrapper 的 `importTrip` 使用 `GET`，且與後端 endpoint 一致。
- [ ] Sheet 缺 PlaceID 但有地名時，import 不自動錯配地點，會產生 validation warning 或 pending node。
- [ ] Sheet 有 validation warning 時，TripLibraryModal 能顯示警告。
- [ ] 刪除行程後，trip sheet 與 `__SUMMARY__` 對應 row 都移除。

---

## v2 候選功能

- Sheet 缺 PlaceID 時的 re-geocode 流程，需加入地區 bias、候選清單與使用者確認。
- 自動合併 local 與 Sheet 改動，而不是只做二選一覆寫。
- 背景自動同步與 debounce。
- 多 spreadsheet / 多使用者 OAuth。
- Sheet 上更完整的 start/end row 編輯與 round-trip 還原。

---

## 相關檔案路徑

| 檔案 | 狀態 | 說明 |
|---|---|---|
| `frontend/src/store/useTripStore.js` | 需修改 | metadata、timestamp、migration、PlaceSnapshot |
| `frontend/src/components/ExplorePanel.jsx` | 需修改 | 補完整 place payload |
| `frontend/src/components/ItineraryNode.jsx` | 需修改 | notes UI |
| `frontend/src/components/TripLibraryModal.jsx` | 新建 | 行程庫與同步 UI |
| `frontend/src/api.js` | 需修改 | Sheets API wrapper |
| `frontend/src/App.jsx` | 需修改 | Header 加入「行程庫」入口 |
| `backend/sheets_service.py` | 新建 | Sheets API 核心邏輯 |
| `backend/main.py` | 需修改 | `/sheets/` endpoints |
| `backend/schemas.py` | 需修改 | TripExportPayload 與 validation schema |
| `backend/requirements.txt` | 需修改 | `gspread`, `google-auth` |
| `.gitignore` | 需修改 | 排除 `backend/credentials/` |
| `backend/credentials/gsheet_service_account.json` | 手動建立 | Service Account key，不進 git |
| `backend/.env` | 手動建立 | `GSHEET_SPREADSHEET_ID` |

## Implementation Update: Import validation + delete

- `GET /sheets/import/{trip_id}` is implemented.
- Import returns `{ trip_data, validation_errors }` and uses `loadTripFromArchive(trip_data)` on the frontend.
- v1 import does not auto re-geocode rows without `PlaceID`; it keeps the place name and returns a validation warning.
- Import also warns on invalid `HH:MM` times and departure-before-arrival rows.
- `DELETE /sheets/trips/{trip_id}` is implemented and removes the trip worksheet, summary row, and metadata row.
- `__TRIP_METADATA__` stores `meta` and `dayConfigs`; the visible trip sheet remains regular place rows only.
