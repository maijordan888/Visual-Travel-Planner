import os
from dotenv import load_dotenv
load_dotenv()
from services import search_nearby_places

print("Testing Text Search...")
res = search_nearby_places(
    lat=25.0339, 
    lng=121.5619, 
    radius=500, 
    place_type="restaurant", 
    keyword="拉麵", 
    max_count=5
)
print(res)
print("Done.")
