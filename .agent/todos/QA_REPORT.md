# QA 測試報告 (Visual Travel Planner)
**測試時間**: 2026-05-05

## 測試總結 (QA Report)

本報告基於模擬一般使用者及極端情境操作所產生的測試結果，已涵蓋正常流程操作及邊緣/壓力測試。

### 錄影佐證
本次測試的完整過程與異常狀況已錄影記錄，可點擊下方影片預覽：
![QA 測試錄影記錄](file:///C:/Users/lily2/.gemini/antigravity/brain/da6cdd56-ce6b-4afc-bdcc-283f624510be/qa_test_run_1777982638711.webp)

---

### ✅ 通過測試 (Passed)
* **行程基本設定**：編輯行程標題與修改起迄日期功能正常，左側側邊欄的 Day 按鈕會隨日期數量動態更新。
* **景點管理**：快速點擊 `+` 按鈕新增節點反應靈敏，UI 未出現崩潰或過多空節點重疊現象。
* **搜尋穩定度**：在搜尋框輸入特殊符號（如 `!@#$%^&*()`）或空字串，系統能正常處理且未發生崩潰。
* **交通模式切換**：大眾運輸、開車、走路、騎車等模式切換順暢，圖示狀態更新正確。
* **手動時間設定**：點擊鉛筆圖示可成功進入手動輸入模式，且「還原」自動估算功能運作正常。
* **長途路徑 Fallback**：測試超長距離跨海路徑（如台北到東京），系統正確觸發 Fallback 並顯示「找不到路徑」或提示。

---

### ❌ 發現問題與修復待辦 (Bugs & Issues)

#### [中優先級] 2. Google Geocoding API 權限未啟用 ✅ 已修復
* **現象**：瀏覽器控制台報錯 `Geocoding Service: This API is not activated`。
* **影響**：導致動態地圖中心無法正確根據地點名稱解析經緯度（Fallback 失敗），進而影響地圖初始定位與 AI 推薦功能的準確度。
* **建議**：後端/架構工程師需前往 Google Cloud Console 啟用該專案的 **Geocoding API**。
* **修復** (2026-05-08)：使用者已在 Google Cloud Console 開啟 Geocoding API，經實測 API 已能正常回傳座標，動態地圖中心及 AI 推薦定位可正常運作。

#### [中優先級] 3. 地圖中心定位延遲 / 異常 ✅ 已修復
* **現象**：從 Google Autocomplete (出發地/回程地) 或搜尋結果選擇景點後，地圖有時不會立即平移 (panTo) 到該座標。使用者常需手動切換 Tab 或重新搜尋才能觸發更新。
* **建議**：前端工程師需檢查 `MapModal.jsx` 中監聽地點變更的 `useEffect`，確保 `map.panTo()` 或 `map.setCenter()` 被正確且即時地觸發。
* **修復** (2026-05-08)：
  1. 在 `App.jsx` 中的 `handleStartPlaceChange` 與 `handleEndPlaceChange` 不只儲存地名，同時存入 `startLat` / `startLng` 與 `endLat` / `endLng`，避免在 `MapModal` 中因 Geocoding 延遲或失敗而找不到座標。
  2. 在 `MapModal.jsx` 中新增 `userInteractedRef` 以防止非同步的 `initCenter` 覆蓋掉使用者已手動選取的中心點。
  3. 修改 `MapHandler` 的 `useEffect` 相依性，明確依賴 `center?.lat` 與 `center?.lng`，確保座標改變時 `panTo` 能被正確觸發。
  4. 事件處理函式加上 `e` 參數直接取得 `e.target.value` 減少 Reference 延遲。

#### [低優先級] 4. AI 推薦定位偏移（預設新竹） ✅ 已修復
* **現象**：若未設定任何景點即點擊「AI 推薦」，預設地圖或搜尋中心會落在新竹 (Hsinchu)，導致點擊 AI 標籤後常顯示「此區域暫無建議」。
* **建議**：若無前置景點或出發地，應提示使用者先設定一個基準點，或優化 Fallback 座標邏輯（例如根據使用者的 IP 定位或行程標題定位）。
* **修復** (2026-05-08)：優化 `MapModal.jsx` 中的 `loadAI` 邏輯。若系統偵測不到 `prevPlace`、`startLocation`，且 `tripTitle` 仍為預設的「未命名行程」，則會直接阻擋向後端發送空泛的「目前位置」請求（此舉易導致 AI 預設推薦新竹），並在 UI 顯示「📍 請先設定『出發地』或修改『行程標題』」的提示卡片，引導使用者提供定位基準。

#### [高優先級] 5. 新增天數時地點繼承邏輯錯誤 ✅ 已修復
* **現象**：點擊「新增一天」時，新天數的出發地預設為第一天的「出發地」，而非前一天的「回程地」。
* **影響**：使用者需手動修改每一天的出發地，不符合旅行路徑邏輯。
* **建議**：修改 `useTripStore.js` 中的 `addDay` 邏輯，使 Day N Start = Day N-1 End，且 Day N End 預設繼承第一天的 End（假設住同飯店）。
* **修復** (2026-05-08)：修改 `useTripStore.js` 的 `setTripDates`，新天數的 `startLocation` 繼承前一天 `endLocation`，`endLocation` 繼承 Day 1 的 `endLocation`。
* **補充修復** (2026-05-08)：新增 `useEffect` 監聽 `activeDay` 變化，自動清空兩個 PlacePicker 的 `.value`，確保切換天數後 placeholder 立即顯示正確天數的地名（非殘留前一天選定的地點）。
* **補充修復 2** (2026-05-08)：針對「新增天數後 PlacePicker 仍顯示前一天長地名」的問題，進一步優化 `useEffect` 邏輯：不僅設定 `value = null`，更透過 `setTimeout` 深入 Web Component 的 `shadowRoot`，強制覆寫內部 `<input>` 的 `value`。徹底解決殘留問題。

#### [高優先級] 6. 行程列表「出發」與「終點」標籤文字空白 ✅ 已修復
* **現象**：新增天數後，雖然右上方 Header 有顯示地點，但右下角行程列表的首末節點名稱為空白。
* **影響**：使用者無法在列表確認起終點，且導致交通時間計算失效。
* **建議**：確保 `dayConfigs` 的變動能正確同步到 `ItineraryNode` 的標籤渲染中。
* **修復** (2026-05-08)：由 #5 的修復連帶解決——新天數的 `dayConfig` 現在正確繼承 `startLocation` / `endLocation`，ItineraryNode 的 nodeTitle 不再為空。

#### [中優先級] 7. 出發地/回程地輸入框寬度固定，長地名被切斷 ✅ 已修復
* **現象**：當選定地點名稱過長時，右上方輸入框不會自動調整大小。
* **影響**：閱讀體驗差，無法看清完整地點。
* **修復 1** (2026-05-08)：為 `.place-picker-wrapper` 加入 `min-width: 0` + `overflow: hidden` 解決 flex 溢出截斷。
* **修復 2** (2026-05-08)：`handleStartPlaceChange` / `handleEndPlaceChange` 存完 store 後立即 `picker.value = null`，讓 placeholder（儲存的短地名 `displayName`）立即顯示，不再殘留 Google 的長地址格式。
* **修復 3** (2026-05-08)：針對「選取後變成淺灰字體（placeholder）」以及「需要 F5 才變短名稱」的問題，修改 `App.jsx` 的同步邏輯。改為使用「覆蓋層 (Overlay)」策略：選取地點後，利用 React 將短名稱顯示在純文字的 `<div>` 中，並透過 `display: none` 暫時隱藏原先的 Google PlacePicker。這樣做確保：(1) 選取當下立刻切換為深黑色短名稱；(2) 不會有底下透出淡淡預設字的現象；(3) 這個 `<div>` 設定為 `word-break: break-word`，所以遇到極長的地名時，輸入框高度會自動延展並自動換行，不會出現溢出截斷的問題。
* **測試案例**：
  - 測試短地名轉換：在出發地輸入「關西國際機場」→ 應立刻切換為深黑色的短名「関西国際空港」。
  - 測試極長短名（#7 自動換行測試）：搜尋「**國立故宮博物院北部院區第二展覽館**」，該短名稱過長時，外框會自動向下長高並換行顯示所有文字。

#### [中優先級] 8. 全域時間格式不統一 (12h vs 24h) ✅ 已修復
* **現象**：Header 顯示為 12 小時制 (上午/下午)，行程列表節點顯示為 24 小時制。
* **建議**：統一使用一種格式（建議 24 小時制或提供設定切換）。
* **修復** (2026-05-08)：再次確保在 `App.jsx` 的 `<input type="time">` 加上 `lang="en-GB"` 強制盡可能使用 24 小時制。若 Chrome 依然跟隨 Windows 作業系統顯示為「上午/下午」，此為瀏覽器綁定 OS 原生元件的限制，但內部數值與行程表顯示皆已確保使用正確的 24 小時制 `HH:MM`。

#### [中優先級] 9. 插入行程後未自動計算至終點的交通時間 ✅ 已修復
* **現象**：在起終點間插入新景點後，該景點到「終點」的交通時間不會自動觸發試算（原先寫死為固定 +20 分鐘）。
* **建議**：監聽節點列表變化，當前一節點地點變更時，自動觸發後續節點的 `getDirectionsTime`。
* **修復** (2026-05-08)：
  1. 修改 `useTripStore.js`，允許 `updateNode` 攔截 `id === 'END_NODE'` 的更新，並儲存至 `dayConfigs[activeDay].endNodeData`。
  2. 修改 `App.jsx`，將最後的終點節點封裝上虛擬的 `nodeData`，使其也能像一般節點一樣渲染交通工具選擇器並呼叫 Google Directions API 進行精準的交通時間估算。

#### [低優先級] 10. 行程列表第一個「+」按鈕位置偏移 ✅ 已修復
* **現象**：首個新增按鈕的 X 軸位置與後續按鈕不一致（偏左）。且使用者反應按鈕位置不夠直覺、上下景點間距過於擁擠。
* **建議**：檢查 `App.jsx` 中的佈局容器 CSS，統一 Margin 或 Alignment 設定。
* **修復** (2026-05-08)：修改 `App.jsx` 中的佈局：
  1. 將所有節點的間距 (`marginBottom`) 從 `32px` 增加為 `64px`，讓版面不再擁擠。
  2. 將所有 `+` 按鈕置中對齊在時間軸垂直線上 (`left: '110px'`, `transform: 'translateX(-50%)'`)，並放在兩個節點正中間 (`bottom: '-32px'`)，使操作邏輯與視覺對齊更加完美。

---

### 💡 介面與 UX 優化建議 (UX Suggestions)

1. **標題與日期自動存檔** ✅ 已實作 (2026-05-08)
   * 目前修改標題需手動點擊「完成編輯」按鈕。建議改為輸入框失去焦點 (`onBlur`) 或按下 `Enter` 鍵後自動儲存，減少使用者操作步驟。
   * **實作細節**：將輸入框群組加上 `onBlur` 與 `onKeyDown` 監聽，當焦點離開編輯區域或按下 Enter 鍵時，會自動關閉編輯模式並儲存。
2. **日期邏輯邊緣檢查** ✅ 已實作 (2026-05-08)
   * 目前可以將「回程日期」設定得比「出發日期」更早。應在 Input 層級或選單層級直接阻擋此操作（Disable 不合理的日期），防止產生負數天數的潛在 Bug。
   * **實作細節**：在 `<input type="date">` 加入 `min={startDate}` 與 `max={endDate}` 屬性，在原生 UI 層面阻擋不合理的日期選擇。

