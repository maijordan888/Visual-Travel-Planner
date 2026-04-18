import os
import sys
import traceback
from dotenv import load_dotenv
load_dotenv()

from services import search_nearby_places

def save_log(filename, content):
    with open(filename, "a", encoding="utf-8") as f:
        f.write(content + "\n")

with open("test_errors.txt", "w", encoding="utf-8") as f:
    f.write("=== RUNNING TESTS ===\n")

print("Running Text Search")
try:
    save_log("test_errors.txt", "\n[TEXT SEARCH]")
    res1 = search_nearby_places(lat=25.0339, lng=121.5619, radius=500, place_type="restaurant", keyword="拉麵", max_count=5)
    save_log("test_errors.txt", "SUCCESS, len=" + str(len(res1)))
except Exception as e:
    save_log("test_errors.txt", "FAILED: " + str(e))

print("Running Nearby Search")
try:
    save_log("test_errors.txt", "\n[NEARBY SEARCH]")
    res2 = search_nearby_places(lat=25.0339, lng=121.5619, radius=500, place_type="restaurant", keyword="", max_count=5)
    save_log("test_errors.txt", "SUCCESS, len=" + str(len(res2)))
except Exception as e:
    save_log("test_errors.txt", "FAILED: " + str(e))

print("Done")
