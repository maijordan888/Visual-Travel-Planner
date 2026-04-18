import requests
import json
import uuid

BASE_URL = "http://127.0.0.1:8000"

def test_tokyo_itinerary():
    print("=== Starting Tokyo Itinerary Test ===")
    
    # 1. Create a trip
    trip_id = str(uuid.uuid4())
    trip_data = {
        "trip_id": trip_id,
        "name": "東京四天三夜深度遊",
        "start_date": "2024-05-01",
        "days_count": 4,
        "global_config": {"destination": "Tokyo", "notes": "Testing API defects"}
    }
    resp = requests.post(f"{BASE_URL}/trips/", json=trip_data)
    if resp.status_code != 200:
        print(f"Failed to create trip: {resp.text}")
        return
    print(f"Trip created: {trip_id}")

    # Tokyo Coordinate: 35.6812, 139.7671 (Tokyo Station)
    tokyo_station = {"lat": 35.6812, "lng": 139.7671}

    # Day 1: Tokyo Station -> Imperial Palace -> Ginza
    print("\n--- Day 1 Planning ---")
    
    # Search nearby Tokyo Station
    search_req = {
        "lat": tokyo_station["lat"],
        "lng": tokyo_station["lng"],
        "radius": 2000,
        "place_type": "tourist_attraction",
        "keyword": "皇居"
    }
    resp = requests.post(f"{BASE_URL}/api/places/search", json=search_req)
    search_results = resp.json().get("places", [])
    if not search_results:
        print("No places found near Tokyo Station.")
    else:
        print(f"Found {len(search_results)} places. Top: {search_results[0]['name']}")

    # Use AI to recommend next steps
    ai_req = {
        "lat": tokyo_station["lat"],
        "lng": tokyo_station["lng"],
        "radius": 3000,
        "place_type": "tourist_attraction",
        "user_prompt": "適合下午散步的景點，要有東京古蹟感",
        "max_recommend": 3
    }
    resp = requests.post(f"{BASE_URL}/api/places/ai-recommend", json=ai_req)
    ai_results = resp.json().get("places", [])
    print(f"AI Recommendations: {[p['name'] for p in ai_results]}")
    for p in ai_results:
        print(f"  - {p['name']}: {p.get('reason')} (Tags: {p.get('tags')})")

    # Add nodes to Day 1
    if ai_results:
        for i, place in enumerate(ai_results[:3]):
            node_data = {
                "node_id": str(uuid.uuid4()),
                "trip_id": trip_id,
                "day_index": 0,
                "node_order": i,
                "status": "confirmed",
                "selected_place_id": place["place_id"],
                "selected_place_name": place["name"],
                "planned_stay_duration": 60,
                "transport_mode": "transit",
                "options_json": [place]
            }
            requests.post(f"{BASE_URL}/itinerary/", json=node_data)
        print("Day 1 nodes added.")

    # Day 2: Shibuya & Harajuku
    print("\n--- Day 2 Planning ---")
    shibuya = {"lat": 35.6585, "lng": 139.7013}
    ai_req["lat"] = shibuya["lat"]
    ai_req["lng"] = shibuya["lng"]
    ai_req["user_prompt"] = "年輕人最愛的購物跟潮流景點"
    resp = requests.post(f"{BASE_URL}/api/places/ai-recommend", json=ai_req)
    ai_results = resp.json().get("places", [])
    print(f"AI Recommendations: {[p['name'] for p in ai_results]}")

    # Test Directions between two Shibuya spots
    if len(ai_results) >= 2:
        dir_req = {
            "origin": ai_results[0]["name"],
            "destination": ai_results[1]["name"],
            "mode": "walking"
        }
        resp = requests.post(f"{BASE_URL}/directions/calculate-time", json=dir_req)
        print(f"Travel time between {ai_results[0]['name']} and {ai_results[1]['name']}: {resp.json().get('travel_time_mins')} mins")

    # Check overall itinerary
    resp = requests.get(f"{BASE_URL}/itinerary/{trip_id}")
    print(f"\nTrip Itinerary (Nodes count): {len(resp.json())}")

    print("\n=== Test Finished ===")

if __name__ == "__main__":
    test_tokyo_itinerary()
