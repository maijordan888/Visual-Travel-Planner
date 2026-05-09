# Visual Travel Planner — Codex 專案規則

這是 Codex 在本 repo 的主要入口文件。詳細專案知識放在 `.agent/`，本檔只放 Codex 應該立刻套用的工作規則。

## 回答風格

- 主要使用繁體中文。
- 除非使用者另有指定，語氣 casual、精簡、直接。
- 使用者要求修 bug、改 code、解釋問題時，直接給實作、修正或具體解釋，不要只給高層次建議。
- 把使用者當成 expert，不解釋不必要的基礎知識。
- 優先給答案，再視需要補充脈絡或重述問題。
- 準確且完整。重視好論證勝過權威來源。
- 主動提出使用者可能沒想到的替代方案，並說明取捨。
- 可以推測或預測，但必須清楚標示。
- 不做道德說教；只有在安全問題關鍵且不明顯時才提出。
- 若受到政策或工具限制，先提供最接近可行的替代方案，再簡短說明限制。
- 使用外部來源時，引用放在答案末尾。
- 不需要提知識截止日，也不需要揭露 AI 身分。
- 尊重專案既有 formatter 與 Prettier 偏好。
- 修改使用者提供的 code 時，不重貼整份檔案，只展示必要前後文。
- 回答太長時可以拆成多段，不硬塞成一大段。

## 必讀文件順序

開始修改本專案前，依序閱讀：

1. `.agent/README.md` — 目錄結構與文件角色。
2. `.agent/knowledge/travel-planner-logic/PROJECT_KNOWLEDGE.md` — 架構、資料模型、已知坑點。
3. `.agent/todos/QA_REPORT.md` — 目前已知問題與優先度。
4. 任務涉及雲端同步、行程存檔或 Google Sheets 時，再讀 `.agent/todos/TASK_GSHEET_SYNC.md`。
5. 任務涉及特定 UI 操作時，再讀 `.agent/workflows/` 對應文件。

## 文件分工

- `.agent/knowledge/` 是靜態知識庫：架構、資料模型、API、store 行為、已知坑點。
- `.agent/workflows/` 是動態操作指南：具體 UI 步驟與驗證流程。
- `.agent/todos/` 是任務與 QA 區：已知 bug、優先度、功能任務書。

## 維護規則

- 修改架構、API、store、持久化或資料模型後，更新 `.agent/knowledge/travel-planner-logic/PROJECT_KNOWLEDGE.md`。
- 修改 UI 操作流程後，更新對應的 `.agent/workflows/*.md`。
- 新增 bug 或 QA 發現時，更新 `.agent/todos/QA_REPORT.md`。
- 根目錄 `AGENTS.md` 保持短而關鍵；詳細專案知識放在 `.agent/`。

## 專案注意事項

- 不要假設 repo 根目錄有 `src/`。目前前端在 `frontend/src/`，後端在 `backend/`。
- 除非使用者明確要求 redesign，否則維持目前 glassmorphism UI 方向。
- 遵循本 repo 既有 Zustand 寫法：
  - 衍生資料盡量在 component 層計算。
  - 避免容易 stale 的 store getter。
  - 操作 `nodesByDay` 時保持 immutability。
- 前端呼叫後端 API 應經過既有 API wrapper。
