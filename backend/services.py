import os
import json
import googlemaps
from google import genai
from dotenv import load_dotenv

load_dotenv()

# ================================
# 設定 Google Maps API
# ================================
MAP_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
gmaps_client = googlemaps.Client(key=MAP_API_KEY) if MAP_API_KEY and MAP_API_KEY != "your_google_maps_api_key_here" else None

def get_directions_time(origin: str, destination: str, mode: str = "driving") -> int:
    """呼叫 Google Directions API 即時計算行程時間"""
    if not gmaps_client:
        return 35 if mode == "driving" else 55

    try:
        directions_result = gmaps_client.directions(origin, destination, mode=mode, language="zh-TW")
        if directions_result:
            duration_sec = directions_result[0]['legs'][0]['duration']['value']
            return duration_sec // 60
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
    """任務9：讓大語言模型 (LLM) 判斷路徑並給出順路的觀光建議與預估時長"""
    if not ai_client:
        # Mock 資料防呆
        return [
            {"id": "ai1", "name": "防呆測試：松山文創園區", "rating": 4.5, "durationMins": 120, "tag": "Mock：文青必逛、高度順路"},
            {"id": "ai2", "name": "防呆測試：台北 101 觀景台", "rating": 4.6, "durationMins": 90, "tag": "Mock：無縫銜接下午行程"}
        ]
        
    prompt = f"""
    我正在規劃一段旅程，目前的停靠點是：「{prev_place}」，下一個預計抵達的點是：「{next_place}」。
    請推薦最少 {count} 個順路、適合安插在中間的熱門景點給觀光客。
    
    請你完全以 JSON Array 的格式回傳，陣列中的每個物件應該包含以下欄位：
    - id: 生成一個簡短的不重複英文代號 (如 p1, p2)
    - name: 景點名稱 (字串)
    - rating: Google Maps 預估星級評分 (浮點數, 例如 4.5)
    - durationMins: 建議停留的合理時間(分鐘) (整數, 例如 90)
    - tag: 一句簡練且吸睛的推薦理由 (字串, 限 15 字以內)
    
    絕對不要有任何 markdown 標記 (如 ```json) 或是回覆文字，請純粹輸出合法的 JSON。
    """
    
    try:
        response = ai_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        
        # 簡單的 JSON 清理
        clean_text = response.text.replace("```json", "").replace("```", "").strip()
        data = json.loads(clean_text)
        return data
        
    except Exception as e:
        print("AI Recommendation Error:", e)
        return []
