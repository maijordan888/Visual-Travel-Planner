---
description: 操作前端「行程庫」進行 Google Sheets 手動同步驗證。
---

# 行程庫雲端同步 Workflow

此 workflow 對應 `TripLibraryModal`，目前 v1 只做手動同步入口，不做自動同步、衝突合併或背景輪詢。

## 前置條件

1. 前端已啟動，例如 `npm.cmd run dev -- --host 127.0.0.1`。
2. 後端若尚未實作 `/sheets/*` endpoint，行程庫會顯示 API 錯誤提示，這是目前可接受狀態。
3. 若要驗證成功路徑，後端需提供：
   - `GET /sheets/trips`
   - `POST /sheets/export/{trip_id}`
   - `GET /sheets/import/{trip_id}`
   - `DELETE /sheets/trips/{trip_id}`

## 開啟行程庫

1. 進入主畫面。
2. 在左側 sidebar 點擊「行程庫」。
3. 確認 modal 標題顯示「行程庫」，列表區標題顯示「雲端行程」。
4. 確認目前行程區會顯示行程名稱、日期範圍、景點數與雲端更新時間。

## 手動覆寫到雲端

1. 在行程庫中點擊「覆寫到雲端」。
2. 前端會送出 `exportTripToSheet(tripId, payload)`。
3. payload 必須使用 Phase 0 store contract：
   - `meta.tripId`
   - `meta.tripTitle`
   - `meta.startDate`
   - `meta.endDate`
   - `meta.localLastModifiedUtc`
   - `meta.sheetLastModifiedUtc`
   - `dayConfigs`
   - `nodesByDay`
4. 成功後，App 必須用回傳的 `last_modified_utc` 呼叫 `setSheetLastModified()`。
5. 若後端尚未啟動，畫面應顯示錯誤提示，按鈕不可卡在 loading。

## 讀回雲端行程

1. 點擊雲端行程列上的「讀回」。
2. 前端會送出 `importTripFromSheet(tripId)`。
3. 成功後，App 必須呼叫 `loadTripFromArchive(trip_data)`。
4. 若回傳 `validation_errors`，modal 需顯示檢查提醒。

## 刪除雲端行程

1. 點擊「刪除」第一次進入確認狀態。
2. 再點一次「確認刪除」才送出 `deleteSheetTrip(tripId)`。
3. 成功後重新載入雲端行程列表。

## 驗證重點

- 行程庫可開關，關閉後不應殘留 modal DOM。
- 後端未完成時，list/export/import/delete 錯誤應顯示在 modal 內，不應造成白屏。
- 此 workflow 不驗證 backend 實際寫入 Google Sheets；成功路徑需等 backend 分支完成後再做整合測試。
