import os
import requests
from dotenv import load_dotenv

load_dotenv()
MAP_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

def test_search():
    url = "https://places.googleapis.com/v1/places:searchNearby"
    payload = {
        "includedTypes": ["restaurant"],
        "maxResultCount": 5,
        "locationRestriction": {
            "circle": {
                "center": {"latitude": 25.033, "longitude": 121.565},
                "radius": 1000.0
            }
        },
        "rankPreference": "RATING",
        "languageCode": "zh-TW",
        "textQuery": "101景觀餐廳" # This should cause a 400 error
    }
    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": MAP_API_KEY,
        "X-Goog-FieldMask": "places.id,places.displayName"
    }
    
    print(f"Testing searchNearby with keyword...")
    resp = requests.post(url, json=payload, headers=headers)
    print(f"Status Code: {resp.status_code}")
    print(f"Response: {resp.text}")

    print("\nTesting searchText with keyword...")
    text_url = "https://places.googleapis.com/v1/places:searchText"
    text_payload = {
        "textQuery": "101景觀餐廳",
        "locationBias": {
            "circle": {
                "center": {"latitude": 25.033, "longitude": 121.565},
                "radius": 1000.0
            }
        },
        "maxResultCount": 5,
        "languageCode": "zh-TW"
    }
    resp = requests.post(text_url, json=text_payload, headers=headers)
    print(f"Status Code: {resp.status_code}")
    print(f"Response: {resp.text}")

if __name__ == "__main__":
    test_search()
