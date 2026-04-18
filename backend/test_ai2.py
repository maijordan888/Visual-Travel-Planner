import sys
import os

try:
    from backend import services
except Exception:
    import services

with open("test_log.txt", "w", encoding="utf-8") as f:
    try:
        f.write("Testing ai_recommend_places...\n")
        res = services.ai_recommend_places(25.0339, 121.5619, user_prompt='拉麵', place_type='restaurant')
        f.write("RESULT: " + str(res) + "\n")
    except Exception as e:
        f.write("EXCEPTION: " + str(e) + "\n")
