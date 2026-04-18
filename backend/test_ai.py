import sys
import os

# add backend dir to path if needed (already running in backend)
try:
    import services
    print("Testing ai_recommend_places...")
    res = services.ai_recommend_places(25.0339, 121.5619, user_prompt='test', place_type='restaurant')
    print("RESULT:", res)
except Exception as e:
    print("EXCEPTION:", e)
