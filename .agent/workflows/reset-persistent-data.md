---
description: 如何重置持久化資料（清除 localStorage）
---

1. 開啟瀏覽器 DevTools（F12 或 Ctrl+Shift+I）。
2. 切換到 **Console** 分頁。
3. 輸入以下指令並按 Enter：
```js
localStorage.removeItem('travel-planner-store')
```
4. 重新整理頁面（F5）。
5. 確認行程已歸回初始的 Demo 資料（Trip to Taipei）。

注意：此操作會清除所有本地保存的行程資料，如需保留可先匯出。
