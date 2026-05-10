---
description: 從前端匯出離線 Markdown 行程，並用瀏覽器列印成 PDF。
---

# 匯出 Markdown / PDF Workflow

此 workflow 對應 `TripExportModal`。v1 目標是產生可離線保存的 Markdown，並用瀏覽器列印功能另存 PDF；不做自動離線同步、不引入後端 PDF engine。

## 前置條件

1. 前端已啟動，例如 `npm.cmd run dev -- --host 127.0.0.1`。
2. 若要使用「先載入雲端最新」，後端需啟動且 `/sheets/import/{trip_id}` 可正常讀取 Google Sheets。
3. 目前行程最好已先透過「儲存 / 載入」同步到 Google Sheets，這樣 Sheet notes 與最新時間欄位會一起納入匯出。

## 開啟匯出視窗

1. 進入主畫面。
2. 在左側 sidebar 點擊「匯出行程」。
3. 確認 modal 標題顯示「匯出行程」。
4. 確認 Markdown 預覽區會顯示目前行程資料。

## 匯出目前畫面資料

1. 不點「先載入雲端最新」。
2. 確認預覽區右上角來源顯示「目前畫面資料」。
3. 可按「複製 Markdown」將內容複製到剪貼簿。
4. 可按「下載 .md」下載 Markdown 檔。
5. 可按「開啟列印版」開啟新分頁，再用瀏覽器列印或另存 PDF。

## 先讀取 Google Sheets 最新資料後匯出

1. 點擊「先載入雲端最新」。
2. 前端會呼叫 `GET /sheets/import/{trip_id}`。
3. 成功後 modal 會改用雲端資料產生 Markdown，並顯示「來源：雲端最新資料」。
4. 若 import 回傳 validation warnings，modal 會顯示提醒；仍可匯出，但需人工檢查。
5. 此動作也會呼叫 `loadTripFromArchive(trip_data)`，讓目前畫面同步成雲端最新行程。

## 景點縮圖

- 「顯示景點縮圖」預設開啟。
- regular 景點若有 `photo_url`，Markdown 會輸出 `![景點名稱](photo_url)`。
- 列印版會用同一個 `photo_url` 顯示圖片。
- 若關閉「顯示景點縮圖」，Markdown 與列印版都會輸出純文字版本。
- 沒有 `photo_url` 的景點不會出現破圖占位。

## 驗證重點

- 每天都應包含起點、regular 景點、終點。
- 起點 notes 來自 `dayConfigs[day].startNotes`。
- regular 景點 notes 來自 `node.notes`。
- 終點 notes 來自 `dayConfigs[day].endNotes`。
- 交通文案應是「從上一站到此站」，對應 `transportFromPreviousMins`。
- 時間格式應維持 24 小時制 `HH:MM`。
- Markdown 預覽、下載 `.md`、列印版三者內容應一致。

## 列印版風格

- `TripExportModal` 的列印版選項是整體風格，不是單張封面。
- 目前可選：和風手帳、清爽機場、復古鐵道、海岸週末、動漫風、夜城市。
- 風格會同時影響封面圖、色票、頁面背景、插圖分隔帶與桌面版左右側固定裝飾。
- 新增或調整風格時，先使用 `.agent/skills/trip-export-style-builder/SKILL.md`，依照該 skill 的 style contract 建立資產、style object、預覽檢查與文件更新。

## HTML / PDF 兩段式輸出

- 一般閱讀先按「開啟 HTML」，會開啟同一份旅行手冊 HTML 頁，可在 Codex 或瀏覽器直接預覽。
- 需要 PDF 時再按「列印 / PDF」，會開同一份 HTML 並觸發瀏覽器列印流程，使用者可另存 PDF。
- Markdown、HTML 預覽與 PDF 列印頁都使用同一份 normalized export data。
## Export preview implementation note

- `開啟 HTML` stores the generated booklet HTML in `sessionStorage` and navigates the current tab to `/export-preview`.
- This avoids popup and `blob:` URL restrictions in the Codex in-app browser.
- `列印 / PDF` uses the same `/export-preview?print=1` route and triggers browser print from that preview page.
- When adding or changing print styles, verify dark themes in all sections, including appendix tables, memo boxes, links, and empty-state text.
- `新視窗開啟` lets users open `/export-preview` in a separate tab/window for side-by-side style comparison; if the browser blocks the popup, the app falls back to the current tab.

## Export modal layout note

- `TripExportModal` groups controls into three blocks: data/content options, print style selection, and output actions. Keep same-purpose action buttons at a consistent width.
- Print style selection is a collapsed dropdown by default. When opened, it should show style thumbnails and labels so users can compare the visual direction before opening HTML.
- The collapsed style selector is intentionally a large preview card: label on top, larger artwork below. Do not shrink it back to a compact single-line select unless the export modal layout changes again.
- Header stays fixed while `.trip-export-body` scrolls internally, so Markdown preview remains reachable even when controls take more vertical space.
- The booklet memo is user-entered in the export modal through `tripMemo`. It is rendered into Markdown and HTML only when filled; do not render blank handwriting boxes as placeholders.
