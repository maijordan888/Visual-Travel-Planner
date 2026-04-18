import os
from dotenv import load_dotenv
load_dotenv()
from services import search_nearby_places
import sys

print("Testing Nearby Search...")
try:
    res = search_nearby_places(
        lat=25.0339, 
        lng=121.5619, 
        radius=500, 
        place_type="restaurant", 
        keyword="", 
        max_count=5
    )
    for r in res:
        print(r)
except Exception as e:
    import traceback
    traceback.print_exc()
