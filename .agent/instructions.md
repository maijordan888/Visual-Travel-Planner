# Project-Specific AI Instructions

為了確保本專案開發的高效與一致性，所有參與開發的 AI Agent 必須遵守以下規範：

## 1. 架構文件維護 (Arch Maintenance)
- **強制要求**：每當完成一個功能開發、修改數據模型（Store/DB）或調整通訊協議（API）時，必須更新 `.agent/skills/travel-planner-logic/SKILL.md`。
- **目的**：這份 SKILL 檔案是後續模型理解專案的「快速道路」，請務必保持其時效性。

## 2. 測試規範
- 涉及行程加入功能修改時，必須執行 `/open-add-place-ui` 與 `/search-and-confirm-place` 工作流進行驗證。

## 3. 代碼風格
- 保持現有的玻璃擬態 (Glassmorphism) UI 風格。
- 遵循 Zustand 狀態管理最佳實踐（在 Component 層級計算衍生數據，避免 Store Getter）。
