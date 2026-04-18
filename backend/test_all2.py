import os
import sys
import io
from dotenv import load_dotenv
load_dotenv()

from services import search_nearby_places

with open("test_errors2.txt", "w", encoding="utf-8") as f:
    orig_stdout = sys.stdout
    sys.stdout = f
    
    print("=== TEXT SEARCH ===")
    res1 = search_nearby_places(lat=25.0339, lng=121.5619, radius=500, place_type="restaurant", keyword="拉麵", max_count=5)
    print("Returned mock?", res1[0]['place_id'].startswith('mock') if res1 else "No data")

    print("=== NEARBY SEARCH ===")
    res2 = search_nearby_places(lat=25.0339, lng=121.5619, radius=500, place_type="restaurant", keyword="", max_count=5)
    print("Returned mock?", res2[0]['place_id'].startswith('mock') if res2 else "No data")

    sys.stdout = orig_stdout
