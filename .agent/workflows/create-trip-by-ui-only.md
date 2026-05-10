---
description: 只用瀏覽器可見 UI 建立新行程，禁止直接寫入 store、localStorage、API 或 Google Sheets。
---

# UI-only 建立新行程 Workflow

本 workflow 適用於使用者要求「像一般人一樣操作網頁」時。全程只能使用畫面上可見的按鈕、輸入框、選單與 Google PlacePicker 建議結果。

## 禁止事項

- 不得直接修改 repo 程式或 `.agent/` 以外文件。
- 不得用 DevTools、console、localStorage、Zustand store、後端 API、Google Sheets API 直接寫入行程資料。
- 不得用程式批次塞入節點、日期、座標、圖片或交通時間。
- 不得把純文字地點當成已完成資料；需要 Google 地點資料時必須透過 UI 選 Google 建議結果。

## 建立流程

1. 開啟 `http://localhost:5173`。
2. 若頁面無法載入，先依專案快速啟動方式執行 `npm run dev`，再回瀏覽器重新整理。
3. 點擊畫面上的 `新建行程`。
4. 使用行程標題輸入框填入使用者指定的標題。
5. 使用日期欄位設定開始日期與結束日期。
6. 確認 Sidebar / day switcher 顯示的天數與日期區間正確。
7. 逐日切換 Day，使用畫面上的出發地與回程地 PlacePicker 設定起終點。
8. 每個起點、終點都必須從 Google PlacePicker 建議結果中點選，避免只留下純文字。
9. 行程景點一律依 `.agent/workflows/add-place-with-google-placepicker.md` 新增。
10. 若使用者要求雲端保存，使用畫面上的行程庫 / 雲端同步按鈕保存，不得直接呼叫 Sheets API。

## 驗證

- Sidebar 顯示的 Day 數符合日期區間。
- 行程標題、開始日期、結束日期與使用者指定一致。
- 每一天起點與終點都顯示正確地點名稱。
- 每個 confirmed 景點是透過 UI 加入，且有 Google 地點資訊。
- 畫面顯示保存或同步成功後，重新整理頁面仍保留同一份行程。
- 若使用者要求「UI-only」，最終回覆需明確說明沒有使用 localStorage/API/store 直接寫入資料。
