import os
from dotenv import load_dotenv
load_dotenv()
from services import search_nearby_places
import sys
import traceback

with open("proper_out.txt", "w", encoding="utf-8") as f:
    orig_stdout = sys.stdout
    sys.stdout = f
    try:
        print("Testing Text Search...")
        res = search_nearby_places(
            lat=25.0339, 
            lng=121.5619, 
            radius=500, 
            place_type="restaurant", 
            keyword="拉麵", 
            max_count=5
        )
        print("Result:")
        for r in res:
            print(r)
        print("Done.")
    except Exception as e:
        print("Error:")
        traceback.print_exc(file=f)
    sys.stdout = orig_stdout
