# AI Agent 行為規範 (Instructions)

> 此文件定義所有參與本專案開發的 AI Agent 必須遵守的行為規範。  
> **讀取順序**：請先閱讀 `.agent/README.md`（目錄導覽），再閱讀本文件。

---

## 1. 文件讀取規範（Session 開始時）

**每次對話開始前，AI Agent 必須依序讀取：**

1. `.agent/README.md` — 確認目錄結構與 knowledge/workflows 的差異
2. `.agent/knowledge/travel-planner-logic/PROJECT_KNOWLEDGE.md` — 建立技術背景知識
3. `.agent/todos/QA_REPORT.md` — 確認目前已知問題與優先度
4. 若任務涉及特定 UI 操作，再查找 `.agent/workflows/` 對應的 workflow 文件

---

## 2. 架構文件維護（強制）

- **觸發條件**：完成功能開發、修改數據模型（Store/DB Schema）、調整 API 介面時
- **必須動作**：同步更新 `.agent/knowledge/travel-planner-logic/PROJECT_KNOWLEDGE.md`
- **目的**：PROJECT_KNOWLEDGE.md 是後續 Agent 理解專案的「快速道路」，過時的文件會浪費大量 Token 並導致錯誤判斷

---

## 3. 測試驗證規範

- 涉及「加入景點」功能的修改，必須執行以下 workflows 進行驗證：
  - `/open-add-place-ui`
  - `/search-and-confirm-place`
- 涉及「天數管理」的修改，執行 `/delete-day` 驗證

---

## 4. 代碼風格規範

- **UI 風格**：保持玻璃擬態 (Glassmorphism) 設計一致性
- **狀態管理**：遵循 Zustand 最佳實踐
  - 在 Component 層計算衍生數據，**避免** 在 Store 中定義 Getter
  - 操作 `nodesByDay` 時確保 Immutability
- **API 呼叫**：所有後端呼叫需通過 `src/api.js` 封裝層
