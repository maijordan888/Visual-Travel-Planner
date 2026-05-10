---
description: 操作行程時間軸上的景點註記與右下角 Day 快速切換器。
---

# 行程註記與 Day 快速切換 Workflow

此 workflow 對應 `App.jsx` 與 `ItineraryNode.jsx` 的行程時間軸操作。適用於行程很長、需要快速切換天數，或需要替起點、景點、終點補充備註的情境。

## 景點註記

1. 進入主畫面並選定要編輯的 Day。
2. 在時間軸上找到要加註記的 route point：
   - 起點
   - confirmed regular 景點
   - 終點
3. 點擊節點上的「新增註記」或「查看註記」。
4. 節點會往下展開 textarea。
5. 輸入交通提醒、訂位資訊、票券、營業時間或其他備註。
6. 再次點擊「收合註記」可收起 textarea；內容仍會保留在 store。

## 註記資料位置

- regular 景點註記存於 `node.notes`。
- 起點註記存於 `dayConfigs[day].startNotes`。
- 終點註記存於 `dayConfigs[day].endNotes`。
- Google Sheets export/import 會透過 visible Sheet 的 `Notes` 欄位 round-trip 這些註記。

## 右下角 Day 快速切換器

1. 當行程很長、不方便回到左側 sidebar 時，使用畫面右下角固定的 `Day N` 按鈕。
2. 點擊 `Day N` 按鈕後會展開 compact Day 清單。
3. 點擊目標天數，例如 `Day 3`。
4. App 會切換到該天，並自動收合清單。
5. 此切換器使用與左側 sidebar 相同的 `setActiveDay(day)` 流程，不會改變行程資料。

## 驗證重點

- 捲動長行程時，右下角 `Day N` 按鈕應固定在 viewport，不跟著內容捲走。
- Day 清單天數很多時，清單本身可捲動，不應撐爆畫面。
- 切換 Day 後，起點、終點、時間軸節點應全部更新為目標 Day 的資料。
- 在起點、regular 景點、終點輸入 notes 後，儲存到 Google Sheets 時應寫入 `Notes` 欄。
