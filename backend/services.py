import os
import json
import googlemaps
from google import genai
from dotenv import load_dotenv
from sqlalchemy.orm import Session
import models

load_dotenv()

# ================================
# 設定 Google Maps API
# ================================
MAP_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
gmaps_client = googlemaps.Client(key=MAP_API_KEY) if MAP_API_KEY and MAP_API_KEY != "your_google_maps_api_key_here" else None

def get_directions_time(db: Session, origin: str, destination: str, mode: str = "transit", force_refresh: bool = False) -> int:
    """呼叫 Google Directions API 即時計算行程時間，並實作 SQLite 緩存"""
    if not origin or not destination:
        return 0

    # 1. 如果不強制更新，先找資料庫有無緩存
    if not force_refresh:
        cached = db.query(models.DirectionsCache).filter(
            models.DirectionsCache.origin == origin,
            models.DirectionsCache.destination == destination,
            models.DirectionsCache.mode == mode
        ).first()
        if cached:
            return cached.duration_mins

    # 2. 如果沒有緩存或強制更新，打 Google API (若無憑證則 mock)
    if not gmaps_client:
        mock_time = 35 if mode == "driving" else 55
        # 存入緩存
        new_cache = models.DirectionsCache(origin=origin, destination=destination, mode=mode, duration_mins=mock_time)
        db.add(new_cache)
        db.commit()
        return mock_time

    try:
        # P.S. `transit` 模式在 Google Directions 中通常需要 departure_time，此處簡化處理
        directions_result = gmaps_client.directions(origin, destination, mode=mode, language="zh-TW")
        if directions_result:
            duration_sec = directions_result[0]['legs'][0]['duration']['value']
            duration_mins = duration_sec // 60
            
            # 存入緩存
            new_cache = models.DirectionsCache(origin=origin, destination=destination, mode=mode, duration_mins=duration_mins)
            db.add(new_cache)
            db.commit()
            return duration_mins
        return -1
    except Exception as e:
        print(f"Directions API Error: {e}")
        return -1

# ================================
# 設定 AI Agent (Gemini) API
# ================================
LLM_API_KEY = os.getenv("GEMINI_API_KEY")
ai_client = genai.Client(api_key=LLM_API_KEY) if LLM_API_KEY and LLM_API_KEY != "your_gemini_api_key_here" else None

def recommend_places(prev_place: str, next_place: str, count: int = 3):
    """利用 Gemini 判斷路徑並推薦順路的景點"""
    if not ai_client:
        return [
            {"id": "ai1", "name": "防呆測試：松山文創園區", "rating": "4.5", "durationMins": 120, "tag": "Mock：文青必逛、高度順路"},
            {"id": "ai2", "name": "防呆測試：台北 101 觀景台", "rating": "4.6", "durationMins": 90, "tag": "Mock：無縫銜接下午行程"}
        ]
        
    prompt = f"""
    我正在規劃一段旅程，剛離開地點 A：「{prev_place}」，接下來預計前往地點 B：「{next_place}」。
    請推薦 {count} 個評價 4.0 顆星以上且適合安插在 A 到 B 之間「順路」的景點。
    
    請以 JSON Array 格式回傳，每個物件包含：
    - id: 生成一個簡短的不重複英文代號 (如 p1, p2)
    - name: 景點名稱 (字串)
    - durationMins: 預估一般人會停留的分鐘數 (整數，例如 90)
    - rating: Google Maps 預估星級評分 (字串，例如 "4.5")
    - tag: 推薦理由 (限 15 字以內)
    
    絕對不要有任何 markdown 標記 (如 ```json) 或是回覆文字，純粹輸出合法 JSON。
    """
    
    try:
        response = ai_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        
        clean_text = response.text.replace("```json", "").replace("```", "").strip()
        data = json.loads(clean_text)
        return data
        
    except Exception as e:
        print("AI Recommendation Error:", e)
        return []
