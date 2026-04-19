import os
import json
import time
import hashlib
import requests
import googlemaps
import math
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
        new_cache = models.DirectionsCache(origin=origin, destination=destination, mode=mode, duration_mins=mock_time)
        db.add(new_cache)
        db.commit()
        return mock_time

    try:
        directions_result = gmaps_client.directions(origin, destination, mode=mode, language="zh-TW")
        if directions_result:
            duration_sec = directions_result[0]['legs'][0]['duration']['value']
            duration_mins = duration_sec // 60
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

def recommend_places(prev_place: str, next_place: str, count: int = 3, trip_context: str = ""):
    """利用 Gemini 判斷路徑並推薦順路的景點 (舊版，保留相容)"""
    if not ai_client:
        return [
            {"id": "ai1", "name": "防呆測試：松山文創園區", "rating": "4.5", "durationMins": 120, "tag": "Mock：文青必逛、高度順路"},
            {"id": "ai2", "name": "防呆測試：台北 101 觀景台", "rating": "4.6", "durationMins": 90, "tag": "Mock：無縫銜接下午行程"}
        ]

    prompt = f"""
    我正在規劃一段名為「{trip_context if trip_context else '自由行'}」的旅程。
    目前剛離開地點 A：「{prev_place}」，接下來預計前往地點 B：「{next_place}」。
    請推薦 {count} 個評價 4.0 顆星以上且適合安插在 A 到 B 之間「順路」的景點。
    
    請注意：如果 A 或 B 在日本，請推薦日本的地點；如果在歐洲，請推薦歐洲的地點。
    
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
        print(f"AI Recommendation Error (gemini-2.5-flash): {e}")
        return []


# ================================
# NEW: Google Places API Nearby Search
# ================================
PLACES_API_BASE = "https://places.googleapis.com/v1/places:searchNearby"

# 簡易記憶體快取 (避免重複打同個請求)
_places_cache: dict = {}

def _cache_key(lat: float, lng: float, radius: int, type_: str, keyword: str, min_rating: float) -> str:
    raw = f"{lat:.4f}_{lng:.4f}_{radius}_{type_}_{keyword}_{min_rating}"
    return hashlib.md5(raw.encode()).hexdigest()

def _get_bounding_box(lat: float, lng: float, radius: float):
    # Earth radius in meters
    R = 6378137.0
    dlat = radius / R
    dlng = radius / (R * math.cos(math.pi * lat / 180.0))
    dlat_deg = dlat * 180.0 / math.pi
    dlng_deg = dlng * 180.0 / math.pi
    return {
        "low": {"latitude": lat - dlat_deg, "longitude": lng - dlng_deg},
        "high": {"latitude": lat + dlat_deg, "longitude": lng + dlng_deg}
    }


def search_nearby_places(
    lat: float,
    lng: float,
    radius: int = 1000,
    place_type: str = "tourist_attraction",  # tourist_attraction | restaurant | cafe...
    keyword: str = "",
    min_rating: float = 3.5,
    max_count: int = 10,
) -> list:
    """
    使用 Google Places API (New) SearchNearby 搜尋周邊地點。
    回傳清單，每筆包含 place_id, name, rating, location, types。
    """
    if not MAP_API_KEY:
        # Mock 資料
        return _mock_nearby(lat, lng, max_count)

    cache_k = _cache_key(lat, lng, radius, place_type, keyword, min_rating)
    if cache_k in _places_cache:
        cached = _places_cache[cache_k]
        if time.time() - cached["ts"] < 600:  # 10 分鐘快取
            return cached["data"]

    # 建立 includedTypes — 對應 New Places API 的 type 表
    if place_type == "all":
        included_types = []
    else:
        type_mapping = {
            "tourist_attraction": ["tourist_attraction", "national_park", "museum", "amusement_park", "art_gallery"],
            "restaurant": ["restaurant"],
            "cafe": ["cafe", "coffee_shop"],
            "shopping": ["shopping_mall", "market"],
            "park": ["park"],
        }
        included_types = type_mapping.get(place_type, [place_type])

    # 決定使用哪個 Endpoint
    # 有 keyword 用 searchText (支援文字模糊搜尋)
    # 無 keyword 用 searchNearby (支援按類型搜尋)
    use_text_search = bool(keyword)
    url = "https://places.googleapis.com/v1/places:searchText" if use_text_search else "https://places.googleapis.com/v1/places:searchNearby"

    payload = {
        "maxResultCount": 20,
        "languageCode": "zh-TW"
    }

    if use_text_search:
        # Text Search (New)
        payload["textQuery"] = keyword
        # 改用 locationRestriction 強制要求地點在範圍內，讓使用者明顯有感 500m/1km 切換
        payload["locationRestriction"] = {
            "rectangle": _get_bounding_box(lat, lng, float(radius))
        }
        # 無論是否為景點，只要有明確類型就把 type 卡死，讓切換分類有感
        if included_types:
            payload["includedType"] = included_types[0] # searchText 只支援單一 includedType
    else:
        # Nearby Search (New)
        payload["includedTypes"] = included_types
        payload["locationRestriction"] = {
            "circle": {
                "center": {"latitude": lat, "longitude": lng},
                "radius": float(radius)
            }
        }
        payload["rankPreference"] = "POPULARITY"

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": MAP_API_KEY,
        "X-Goog-FieldMask": "places.id,places.displayName,places.rating,places.userRatingCount,places.location,places.types,places.formattedAddress,places.regularOpeningHours,places.photos"
    }

    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        places_raw = data.get("places", [])

        result = []
        for p in places_raw:
            rating = p.get("rating", 0)
            if rating < min_rating:
                continue
            loc = p.get("location", {})
            photos = p.get("photos", [])
            photo_ref = photos[0]["name"] if photos else None

            result.append({
                "place_id": p.get("id"),
                "name": p.get("displayName", {}).get("text", "未知地點"),
                "rating": rating,
                "user_rating_count": p.get("userRatingCount", 0),
                "types": p.get("types", []),
                "address": p.get("formattedAddress", ""),
                "lat": loc.get("latitude"),
                "lng": loc.get("longitude"),
                "photo_ref": photo_ref,
                "is_open": p.get("regularOpeningHours", {}).get("openNow"),
            })
        
        # 再次排序與篩選
        result.sort(key=lambda x: (-x["rating"], -x["user_rating_count"]))
        final = result[:max_count]


        _places_cache[cache_k] = {"ts": time.time(), "data": final}
        return final

    except Exception as e:
        # 詳細印出錯誤以便偵錯
        print(f"--- Places API Error Detail ---")
        print(f"URL: {url}")
        print(f"Error: {e}")
        if 'resp' in locals():
            print(f"Status Code: {resp.status_code}")
            print(f"Response Body: {resp.text}")
        print(f"-------------------------------")
        return _mock_nearby(lat, lng, max_count)


def _mock_nearby(lat: float, lng: float, count: int) -> list:
    """當 API Key 無效時回傳 Mock 資料，根據經緯度決定返回哪區"""
    # 簡單判斷：若 lng > 130 可能是日本
    if lng > 130:
        mock_places = [
            {"place_id": "m1", "name": "東京鐵塔", "rating": 4.6, "user_rating_count": 50000, "types": ["tourist_attraction"], "address": "Tokyo", "lat": 35.6586, "lng": 139.7454, "photo_ref": None, "is_open": True},
            {"place_id": "m2", "name": "淺草寺", "rating": 4.5, "user_rating_count": 80000, "types": ["tourist_attraction"], "address": "Asakusa", "lat": 35.7148, "lng": 139.7967, "photo_ref": None, "is_open": True},
            {"place_id": "m3", "name": "澀谷交叉口", "rating": 4.5, "user_rating_count": 100000, "types": ["tourist_attraction"], "address": "Shibuya", "lat": 35.6595, "lng": 139.7005, "photo_ref": None, "is_open": True},
        ]
    else:
        mock_places = [
            {"place_id": "mock1", "name": "台北 101", "rating": 4.6, "user_rating_count": 50000, "types": ["tourist_attraction"], "address": "台北市", "lat": 25.0339, "lng": 121.5619, "photo_ref": None, "is_open": True},
            {"place_id": "mock2", "name": "象山步道", "rating": 4.5, "user_rating_count": 30000, "types": ["park"], "address": "台北市", "lat": 25.0283, "lng": 121.5780, "photo_ref": None, "is_open": True},
        ]
    return mock_places[:count]


# ================================
# NEW: AI Recommend (Option B: 先搜後篩)
# ================================
def ai_recommend_places(
    lat: float,
    lng: float,
    radius: int = 1500,
    place_type: str = "tourist_attraction",
    user_prompt: str = "",
    max_recommend: int = 5,
) -> list:
    """
    Option B 模式：
    1. 先用 Google Places 拉 20 個候選地點
    2. 把候選清單 + 使用者 Prompt 送給 Gemini
    3. Gemini 過濾排名，回傳 place_id + tags + reason
    4. 後端做 Merge，確保有完整的 lat/lng 資訊
    """
    # Step 1: 抓 20 個候選
    candidates = search_nearby_places(lat, lng, radius, place_type, keyword=user_prompt, max_count=20, min_rating=3.0)

    if not candidates:
        return []

    if not ai_client:
        # 無 AI 時直接回傳 Google 排序結果
        return [
            {**c, "tags": ["#高評分", "#順路推薦"], "reason": "Google 高評分景點"}
            for c in candidates[:max_recommend]
        ]

    # Step 2: 整理給 Gemini 的候選清單
    candidate_for_ai = [
        {
            "place_id": c["place_id"],
            "name": c["name"],
            "rating": c["rating"],
            "rating_count": c["user_rating_count"],
            "types": c["types"][:3],  # 只取前 3 個 type
        }
        for c in candidates
    ]

    candidate_json = json.dumps(candidate_for_ai, ensure_ascii=False, indent=2)

    type_label = {"tourist_attraction": "景點", "restaurant": "餐廳", "cafe": "咖啡廳", "park": "公園", "shopping": "購物"}.get(place_type, place_type)

    prompt = f"""你是一位專業的全球旅遊導遊，精通世界各地的熱門景點與當地文化。以下是目前搜尋區域（經緯度：{lat}, {lng}）附近的候選地點清單：

{candidate_json}

使用者的具體需求是：「{user_prompt if user_prompt else '請從中挑選最佳的' + type_label}」

請確保推薦的地點與候選地點清單中的地理座標一致。如果候選清單位於東京，請不要推薦台北的地點。

請從名單中挑選出最符合需求的 {max_recommend} 個地點。按「推薦程度」由高到低排序。
請為每個地點生成一個推薦理由（15 字以內，繁體中文），以及 2~3 個短標籤（例如：#在地激推、#必訪地標）。

輸出格式必須嚴格遵守以下 JSON 陣列，不要有任何 markdown 或說明文字：
[
  {{
    "place_id": "從原始名單取得的 place_id",
    "name": "地點名稱",
    "tags": ["標籤1", "標籤2"],
    "reason": "推薦理由"
  }}
]"""

    try:
        response = ai_client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        clean_text = response.text.replace("```json", "").replace("```", "").strip()
        ai_picks = json.loads(clean_text)

    except Exception as e:
        print(f"AI Recommend API Error (gemini-2.5-flash): {e}")
        # Fallback：直接用 Google 排序
        return [
            {**c, "tags": ["#Google推薦"], "reason": "高評分景點"}
            for c in candidates[:max_recommend]
        ]

    # Step 4: Merge AI 結果與 Google 原始資料（補回 lat/lng/rating 等）
    candidate_map = {c["place_id"]: c for c in candidates}
    result = []
    for ai_place in ai_picks:
        pid = ai_place.get("place_id")
        original = candidate_map.get(pid)
        if not original:
            continue
        merged = {
            **original,
            "tags": ai_place.get("tags", []),
            "reason": ai_place.get("reason", ""),
        }
        result.append(merged)

    return result
