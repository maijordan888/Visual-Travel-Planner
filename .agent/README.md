# .agent — AI Agent 工作區導覽

> 此目錄是本專案的「AI Agent 工作文件區」。  
> **工程師或 AI Agent 開始任何任務前，請先閱讀本文件。**

---

## 目錄結構與用途

```
.agent/
├── README.md              ← 你在這裡。導覽整個 .agent 目錄的入口文件
├── instructions.md        ← AI Agent 的行為規範（必讀）
├── knowledge/             ← 「知道什麼」—— 目前主要技術知識庫
│   └── travel-planner-logic/
│       └── PROJECT_KNOWLEDGE.md ← 核心：技術棧、資料模型、API、坑點紀錄
├── skills/                ← 可重複使用的 Agent 技能；部分舊檔僅供歷史參考
│   ├── travel-planner-logic/
│   │   └── SKILL.md       ← Legacy：不要當成最新單一真相來源
│   └── trip-export-style-builder/
│       └── SKILL.md       ← 新增/調整離線匯出 Markdown/HTML 風格時使用
├── workflows/             ← 「怎麼做」—— UI 操作的具體步驟腳本（給 Agent 執行用）
│   ├── delete-day.md
│   ├── explore-and-add-place.md
│   ├── export-trip-markdown-pdf.md
│   ├── itinerary-notes-and-day-switching.md
│   ├── open-add-place-ui.md
│   ├── reset-persistent-data.md
│   ├── search-and-confirm-place.md
│   ├── swap-backup-option.md
│   └── trip-library-cloud-sync.md
└── todos/                 ← 「要做什麼」—— 待辦清單與 QA 報告
    └── QA_REPORT.md
```

---

## Skills vs Workflows — 核心差異

這兩個資料夾最容易混淆，請注意以下區分：

| 維度 | `knowledge/` | `workflows/` |
|------|-----------|--------------|
| **定位** | 靜態知識庫 | 動態操作腳本 |
| **問題** | 「這個系統是怎麼運作的？」 | 「我要怎麼完成這個操作？」 |
| **內容** | 技術架構、資料模型、API 路徑、已知 Bug | UI 點擊步驟、操作序列 |
| **讀者** | 需要了解架構才能開發的工程師或 Agent | 需要執行特定 UI 操作的 Agent |
| **更新時機** | 架構、API、Store 有任何異動時 **必須** 同步更新 | UI 操作流程改變時更新 |

> **簡單記法**：Knowledge = 「know-how（知識）」，Workflows = 「how-to（步驟）」。`skills/` 放可重複使用的 Agent 技能；若技能內容與 `knowledge/` 衝突，仍以 `knowledge/` 的架構契約為準。

---

## AI Agent 建議讀取順序

1. **`instructions.md`** — 了解本專案對 AI Agent 的行為規範
2. **`knowledge/travel-planner-logic/PROJECT_KNOWLEDGE.md`** — 建立技術背景知識（架構/資料模型/坑點）
3. **`todos/QA_REPORT.md`** — 確認目前已知問題與待辦項目
4. **對應 `workflows/*.md`** — 若需要執行特定 UI 操作，再查找對應 workflow
5. **對應 `skills/*/SKILL.md`** — 若任務是可重複製作流程（例如新增匯出風格），再讀相關 skill

> 若只需要執行單一 workflow（例如使用者說「幫我加入一個景點」），可直接跳到步驟 4，但仍建議先讀 `PROJECT_KNOWLEDGE.md` 的核心數據模型章節。

---

## 維護規範

- **架構異動後**：必須更新 `knowledge/travel-planner-logic/PROJECT_KNOWLEDGE.md`
- **UI 操作流程改變後**：更新對應的 `workflows/*.md`
- **新增待辦或 Bug**：記錄到 `todos/QA_REPORT.md`
- **新的操作流程**：在 `workflows/` 新增對應的 `.md` 文件
- **新的可重複製作流程**：在 `skills/` 新增或更新對應 skill，並把細節放到 `references/`
