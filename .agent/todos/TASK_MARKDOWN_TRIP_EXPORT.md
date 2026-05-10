# TASK: Markdown/PDF 離線行程匯出

> 狀態更新（2026-05-10）：PDF 匯出流程已移除。後續以「Markdown + 可下載 HTML 手冊」作為支援的離線輸出；本檔下方早期 PDF/列印規劃只保留作為歷史背景，不再代表目前實作目標。

## Summary

製作一套「雜誌導覽風」Markdown 模板系統，讓目前網頁底層行程資料與 Google Sheets 註記可以組成一份可讀、可列印成 PDF、適合手機離線查看的行程文件。

第一版採「Markdown 預覽 + 匯出 `.md` + 瀏覽器列印 PDF」，不在專案內建 AI，不引入後端 PDF engine，也不先做多人同步或自動合併。

## Current Context

此任務必須以目前 Google Sheets v1 同步結果為基準，不沿用早期只輸出 regular 景點的假設。

- Google Sheets visible trip sheet 已包含完整 route rows：`start`、`regular`、`end`。
- `node_count` 仍只計算 confirmed regular 景點，但 Markdown/PDF 匯出必須輸出每日起點、景點、終點。
- regular 景點 notes 來源是 `node.notes`。
- 起點與終點 notes 來源是 `dayConfigs[day].startNotes` / `dayConfigs[day].endNotes`。
- Sheet 交通欄位語意是 `Transport From Previous (mins)`，不是前往下一站。
- regular 節點可取得 `planned_arrival_time`、`planned_departure_time`、`transport_time_mins`。
- 匯出資料可能同時包含 `PlaceID`、`Address`、`lat`、`lng`、`photo_url`、`rating`、`types`、`tags`。
- 若景點有從 Google Maps / Places 取得的 `photo_url`，Markdown/PDF 應可輸出對應縮圖，增加旅遊雜誌感。
- UI 目前已統一以 24 小時制 `HH:MM` 顯示行程時間，Markdown/PDF 也應保持同一格式。

## Goals

- 產出適合手機閱讀與列印 PDF 的離線行程文件。
- 將起點、景點、終點視為同一條每日路線輸出。
- 保留 Google Sheets notes 與網頁內註記。
- 保留地址、PlaceID、座標與 Google Maps link 等備援資訊。
- 讓模板元素可重用，未來能被 UI 按鈕、測試或 Codex workflow 呼叫。
- 在接入正式 UI 前，先做 sample preview 讓使用者確認美學方向。

## Non-Goals

- v1 不做自動離線同步。
- v1 不做自動衝突合併或多人共同編輯。
- v1 不引入 Puppeteer、Playwright PDF、後端 PDF engine 或大型排版套件。
- v1 不在專案內建 AI 產圖；若需要圖片，只使用通用靜態素材。
- v1 不把網頁版功能鍵、編輯按鈕、modal 裝飾 UI 放入 Markdown。

## Data Contract

### Input Sources

Markdown renderer 需支援兩種來源：

1. **目前畫面資料**
   - Zustand store 的 `tripId`、`tripTitle`、`startDate`、`endDate`
   - `dayConfigs`
   - `nodesByDay`
   - `localLastModifiedUtc`
   - `sheetLastModifiedUtc`

2. **先從 Google Sheet 載入後的資料**
   - 透過既有 `importTripFromSheet(tripId)` 取得
   - 使用 `loadTripFromArchive(trip_data)` 更新後，再以同一個 renderer 匯出
   - 若 import 回傳 validation warnings，匯出 modal 應提示使用者

### Normalized Export Model

新增純函式：

```js
normalizeTripForExport(tripData, options)
```

回傳建議 shape：

```js
{
  meta: {
    tripId,
    title,
    startDate,
    endDate,
    generatedAtUtc,
    source,
    localLastModifiedUtc,
    sheetLastModifiedUtc,
  },
  days: [
    {
      dayNumber,
      date,
      start: RoutePoint,
      items: RoutePoint[],
      end: RoutePoint,
      warnings: string[],
    }
  ],
  appendix: {
    places: RoutePoint[],
    unmatchedNotes: Note[],
    validationWarnings: string[],
  }
}
```

### RoutePoint

`start`、`regular`、`end` 都應正規化成同一種匯出資料：

```js
{
  nodeType: 'start' | 'regular' | 'end',
  dayNumber,
  title,
  arrivalTime,
  departureTime,
  stayDurationMins,
  transportFromPreviousMins,
  transportMode,
  address,
  mapsUrl,
  placeId,
  lat,
  lng,
  rating,
  photoUrl,
  types,
  tags,
  notes,
}
```

注意：

- `transportFromPreviousMins` 表示「從上一站到這一站」，輸出文字也要用此語意。
- 起點通常沒有 `transportFromPreviousMins`。
- 終點應可顯示從最後一個景點到終點的交通時間。
- `notes` 不存在時不輸出空區塊。
- `photoUrl` 存在時，regular 景點優先輸出縮圖；起點/終點可支援圖片但不強制。
- `photoUrl` 不存在或載入失敗時，不輸出破圖占位，改維持純文字資訊卡。
- 缺地址或時間時仍可正常輸出，不產生 `undefined` 或破版欄位。

## Template Elements

模板元素需拆成小函式，避免直接綁死 React component：

- `renderCover(exportTrip, options)`
  - 旅程標題、日期、目的地摘要、封面圖或純文字封面。
- `renderTripSummary(exportTrip)`
  - 天數、主要城市、住宿/起終點、每日重點。
- `renderDaySection(day)`
  - Day N、日期、每日起點、終點、當日節奏。
- `renderTimelineItem(routePoint)`
  - 到達/離開時間、地點、地址、停留時間、交通時間、備註與景點縮圖。
- `renderPlaceImage(routePoint)`
  - 若 `photoUrl` 存在，輸出 Markdown image 或 print view image block。
  - 圖片 alt text 使用景點名稱，例如 `![清水寺](...)`。
  - renderer 需提供選項控制是否輸出圖片，避免使用者在離線或列印情境想要純文字版。
- `renderTransportBlock(routePoint)`
  - 從上一站前往此站的交通時間、交通模式與 Google Maps link。
- `renderNotesBlock(notes)`
  - Google Sheet notes、網頁內手動備註、提醒事項。
- `renderAppendix(exportTrip)`
  - PlaceID、地址清單、座標、備援資訊、未對應註記。

公開入口：

```js
buildTripMarkdown(tripData, options)
```

輸出：Markdown string。

## Markdown Structure

建議第一版輸出結構：

```md
# 東京 2 日遊

> 2026-05-08 - 2026-05-09

## 行程摘要

- 天數：2 天
- 主要城市：大阪、京都
- 起點：關西國際機場
- 終點：關西國際機場

## Day 1 - 2026-05-08

### 09:00 出發｜關西國際機場

備註：...

### 10:20 抵達｜飯店名稱

![飯店名稱](https://example.com/place-photo.jpg)

- 地址：...
- 停留：30 分鐘
- 從上一站交通：約 80 分鐘
- Google Maps：...

備註：...

## Appendix

### 地點備援資訊

| Day | Type | Name | PlaceID | Address |
| --- | --- | --- | --- | --- |
```

## UX Flow

### Entry Point

在行程庫/雲端同步附近新增「匯出行程」入口。建議位置：

- sidebar 的行程庫按鈕附近，作為同層級資料操作。
- 或 `TripLibraryModal` 內新增匯出入口，但不讓使用者誤以為一定要先同步雲端才能匯出。

### TripExportModal

新增 `TripExportModal`，提供：

- Markdown 預覽。
- 複製 Markdown。
- 下載 `.md`。
- 開啟列印版頁面，讓使用者用瀏覽器另存 PDF。
- 勾選「匯出前先從 Google Sheet 載入最新資料」。
- 顯示 import validation warnings。

### Print View

列印版可採：

- 新開 browser tab/window。
- 使用同一份 Markdown renderer 產出的 HTML。
- 套用 print CSS。
- 不引入複雜 PDF engine。

## Aesthetic Direction

第一版方向：雜誌導覽風，但資訊密度要適合手機 PDF。

使用者提供的參考方向：Dcard 日本旅遊文章「大阪6天5夜 自製旅遊手冊＋旅遊雜記」。不要複製其版面或素材，只取其「出遊手冊感」：

- A5 旅遊手冊尺度，手機 PDF 閱讀時仍要像一本可翻閱的小冊子。
- 整體可以比目前網頁版更繽紛，但需避免資訊變難讀。
- 封面圖使用通用旅行插圖候選，不直接使用目前行程的景點照片。
- 頁面周圍可散落低干擾旅行小插圖，例如行李、票券、相機、地圖針、拉麵、印章、鑰匙、雲。
- 航班/交通/住宿資訊可借鏡票券式、章節卡式呈現。
- 城市或地區介紹可做成一日一小導覽，不只列時間表。
- 每日行程可保留可手寫感的備註區，用於旅途中補紀錄。
- 附錄可包含空白筆記、票根/收據記錄、紀念章或備援資訊頁的概念。

設計原則：

- 大封面標題，但不要犧牲第一頁資訊量。
- 每日章節像小型旅遊導覽。
- 景點段落保留清楚時間軸。
- 有 Google Maps / Places 縮圖的景點應輸出圖片，讓文件接近旅遊雜誌閱讀感。
- 地址、交通、備註採資訊卡式排版。
- 附錄可放在文件最後，不打斷閱讀。
- 不使用目前網頁上的功能鍵或編輯 UI 裝飾。

可替代風格：

- 清爽旅行手帳。
- 極簡行程表。
- 詳細備援清單優先版。

## Aesthetic Checkpoint

接入正式 UI 前，必須先完成此 checkpoint：

1. 使用東京 2 日遊 sample data 產生一份 Markdown。
2. 產出瀏覽器預覽頁，模擬手機 PDF 閱讀寬度。
3. 讓使用者確認：
   - 版面密度是否適合手機。
   - 雜誌感是否太重或太花。
   - 景點縮圖比例、大小與出現頻率是否剛好。
   - 景點資訊與 notes 是否好讀。
   - 是否有「旅行手冊 / 出遊小冊」感，而不是只有資料表。
   - 附錄資訊是否太多或太少。
   - 封面/背景圖是否需要保留。
4. 使用者確認後才接入正式 UI。

若需要圖片，可使用內建繪圖產生 1-2 張通用封面/章節背景圖，但只能作為靜態模板素材，不接入專案 AI。

## Implementation Steps

### Phase 1: Planning Artifact

- [x] 新增 `.agent/todos/TASK_MARKDOWN_TRIP_EXPORT.md`。
- [x] 將目前 Sheet v1 schema、起終點 notes、交通時間語意寫入任務書。

### Phase 2: Renderer Foundation

- [x] 新增 `frontend/src/export/tripExport.js`，包含 `normalizeTripForExport()`、`buildTripMarkdown()`、`buildTripPrintHtml()`。
- [x] 新增模板元素函式：cover、summary、day section、timeline item、transport、notes、appendix、place image。
- [x] 以行程庫既有行程資料驗證 Markdown / HTML 內容輸出。
- [ ] 尚未新增 automated unit test；目前以前端 build 與 browser QA 驗證。

### Phase 3: Sample Preview

- [x] 以行程庫既有行程產生 Markdown / HTML 預覽。
- [x] 建立列印版 preview flow：`TripExportModal` 的「開啟列印版」會用同一份 export data 產出小冊風 HTML。
- [x] 列印版已套用旅行小冊方向：封面、票券摘要、每日導覽、景點圖片卡、手寫備註區、票根/紀念章附錄區。
- [x] 新增通用旅行插圖素材，並改為選擇整體 `bookletStyle`，不是單張封面；目前包含 `japan-cute`、`airport-minimal`、`retro-rail`、`coastal-weekend`、`anime-taisho`、`neon-night`。
- [x] 驗證桌面預覽不重疊，並調整寬螢幕側邊背景與風格配色。
- [x] 已交付使用者做美學確認並依回饋調整。

### Phase 4: UI Integration

- [x] 新增 `TripExportModal`。
- [x] 在 sidebar 或行程庫附近新增「匯出行程」入口。
- [x] 支援目前畫面資料匯出。
- [x] 支援先從 Google Sheet 載入最新資料再匯出。
- [x] 支援複製 Markdown。
- [x] 支援下載 `.md`。
- [x] 支援開啟列印版。

### Phase 5: Workflow Documentation

- [x] 新增 `.agent/workflows/export-trip-markdown-pdf.md`。
- [x] 更新 `.agent/knowledge/travel-planner-logic/PROJECT_KNOWLEDGE.md`，記錄 Markdown export renderer 與 public interface。
- [x] 若新增 UI 操作，更新對應 workflow。

## Public Interfaces

```js
buildTripMarkdown(tripData, options)
```

- input：目前 store / Sheet import 後的 trip data。
- output：Markdown string。
- 不修改 store。

```js
normalizeTripForExport(tripData, options)
```

- 補齊每日日期、時間線、交通時間、Sheet notes、地址、maps link。
- 將 `start`、`regular`、`end` 統一成 `RoutePoint`。
- 不修改 store，只回傳匯出用資料。

```jsx
<TripExportModal
  currentTripPayload={currentTripPayload}
  onImportFromSheet={handleImportFromSheet}
/>
```

- actions：preview、copy Markdown、download `.md`、print PDF view。

## Test Plan

### Markdown Content

- [ ] Day 1/Day 2 順序正確。
- [ ] 每日起點、regular 景點、終點都會輸出。
- [ ] `arrivalTime` / `departureTime` / `transportFromPreviousMins` 有輸出。
- [ ] regular notes、start notes、end notes 都有輸出。
- [ ] 有 `photoUrl` 的景點會輸出縮圖。
- [ ] 沒有 `photoUrl` 或圖片載入失敗時，不顯示破圖或空白圖片區。
- [ ] Sheet import validation warnings 可被提示或附在匯出 modal。
- [ ] address、PlaceID、lat/lng 不因匯出遺失。
- [ ] 沒有時間或地址的景點仍可輸出，不產生破版欄位。
- [ ] 交通時間文案清楚表達「從上一站到此站」。

### UI

- [ ] 從目前行程直接匯出。
- [ ] 先從 Google Sheet 載入再匯出。
- [ ] Markdown preview 可讀。
- [ ] 複製 Markdown 內容正確。
- [ ] `.md` 下載內容正確。
- [ ] 列印版在手機寬度與桌面寬度不重疊。

### Visual Acceptance

- [ ] 用東京 2 日遊 sample 產生第一版模板。
- [ ] 使用者確認美學後才接入正式 UI。
- [ ] 若不喜歡雜誌風，可切回「清爽旅行手帳」或「極簡行程表」。

## Branching Notes

建議分支：

- 規劃與任務書：`codex/markdown-pdf-export-plan`
- renderer foundation：`codex/markdown-export-renderer`
- UI modal：`codex/trip-export-modal`
- print CSS / preview：`codex/trip-export-print-view`

Renderer foundation 與 UI modal 不建議同時改同一批檔案。若平行開工，renderer 分支應只碰 `frontend/src/export/` 與測試 fixture；UI 分支等 renderer public interface 穩定後再接。

## Assumptions

- 第一版不做自動離線同步，只做「匯出成可離線保存的 Markdown/PDF」。
- PDF 由瀏覽器列印產生，不先導入後端 PDF engine。
- 專案內不內建 AI 產圖；若需要圖片，只產生通用靜態素材。
- Google Sheet 的註記來源以目前 import/export schema 裡的 `notes` 為主。
- v1 不做多人協作衝突合併，使用者匯出前可手動選擇是否先載入雲端最新資料。
