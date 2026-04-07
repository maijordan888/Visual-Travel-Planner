# Visual Travel Planner

一個基於 AI 驅動的視覺化旅遊規劃工具。結合了 Google Maps 的強大互動性與 Gemini AI 的智慧推薦，幫助使用者輕鬆打造完美的旅程。

## 🌟 核心功能

- **互動式地圖規劃**：即時在地圖上查看景點位置，並透過拖拉或點擊快速調整行程。
- **AI 智慧推薦 (Explore & Recommend)**：
  - **Google 模式**：利用 Google Places API (New) 搜尋周邊熱門景點與餐廳。
  - **AI 模式**：輸入個人化需求（如「適合家庭的安靜咖啡廳」），由 Gemini AI 從 Google 搜尋結果中篩選最精準的推薦。
- **交通時間計算**：自動計算景點間的預計行車或大眾運輸時間。
- **動態行程管理**：支援多日行程安排，景點排序與停留時間自定義。

## 🛠️ 技術架構

### 前端 (Frontend)
- **Framework**: React + Vite
- **Maps**: `@vis.gl/react-google-maps`, `@googlemaps/extended-component-library`
- **State Management**: Zustand
- **Icons**: Lucide React
- **Styling**: Vanilla CSS (Premium Glassmorphism Design)

### 後端 (Backend)
- **Framework**: FastAPI (Python 3.11+)
- **Database**: SQLite (SQLAlchemy ORM)
- **AI Engine**: Google Gemini AI (Google Generative AI SDK)
- **Data Source**: Google Places API (New)

## 🚀 快速上手

### 1. 取得 API Key
你需要準備以下兩組 API Key：
- **Google Maps Platform API Key** (需啟用 Maps JavaScript API, Places API (New), Routes API)
- **Google Gemini API Key**

### 2. 後端設定
```bash
cd backend
# 建立虛擬環境 (建議)
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安裝依賴
pip install -r requirements.txt

# 設定環境變數
cp .env.example .env
# 編輯 .env 並填入你的 API Key

# 啟動後端
uvicorn main:app --reload
```

### 3. 前端設定
```bash
cd frontend
# 安裝依賴
npm install

# 設定環境變數
# 確保 src/api.js 或相關設定指向後端 URL (預設 http://localhost:8000)

# 啟動開發伺服器
npm run dev
```

## 📸 介面預覽
*(此處可上傳截圖後補上)*

## 📄 授權
MIT License
