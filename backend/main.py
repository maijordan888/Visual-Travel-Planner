from fastapi import FastAPI, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import models, schemas, services
from database import engine, SessionLocal

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Travel Planner API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- request/response models ---
class DirectionsRequest(BaseModel):
    origin: str
    destination: str
    mode: str = "transit"
    force_refresh: bool = False

class RecommendRequest(BaseModel):
    prev_place: str
    next_place: str
    count: int = 3
    trip_context: Optional[str] = ""

class PlacesSearchRequest(BaseModel):
    lat: float
    lng: float
    radius: int = 1000
    place_type: str = "tourist_attraction"
    keyword: Optional[str] = ""
    min_rating: float = 3.5
    max_count: int = 10

class AiRecommendRequest(BaseModel):
    lat: float
    lng: float
    radius: int = 1500
    place_type: str = "tourist_attraction"
    user_prompt: Optional[str] = ""
    max_recommend: int = 5

# --- API Endpoints ---
@app.get("/")
def health_check():
    return {"status": "ok", "message": "後端服務正常運行！"}

@app.post("/directions/calculate-time")
def calculate_travel_time(req: DirectionsRequest, db: Session = Depends(get_db)):
    mins = services.get_directions_time(db, req.origin, req.destination, req.mode, req.force_refresh)
    if mins == -1:
        return {"error": "無法計算"}
    return {"origin": req.origin, "destination": req.destination, "travel_time_mins": mins, "mode": req.mode}

@app.post("/recommend-places")
def get_ai_recommendations(req: RecommendRequest):
    """呼叫 AI 取得兩點之間的推薦點 (含建議停留時間) - 舊版，保留相容"""
    results = services.recommend_places(req.prev_place, req.next_place, req.count, req.trip_context)
    return {"recommendations": results}

# --- NEW: Places API Endpoints ---
@app.post("/api/places/search")
def search_places(req: PlacesSearchRequest):
    """
    Google 模式：使用 Places API (New) SearchNearby 搜尋周邊地點。
    依評分高低排序，並依 min_rating 過濾。
    """
    results = services.search_nearby_places(
        lat=req.lat,
        lng=req.lng,
        radius=req.radius,
        place_type=req.place_type,
        keyword=req.keyword or "",
        min_rating=req.min_rating,
        max_count=req.max_count,
    )
    return {"places": results, "total": len(results), "mode": "google"}


@app.post("/api/places/ai-recommend")
def ai_recommend_places(req: AiRecommendRequest):
    """
    AI 模式 (Option B)：
    1. Google Places 抓 20 個候選
    2. 送交 Gemini 過濾排名，附上 tags & reason
    3. 後端 Merge 後回傳完整地點資訊
    """
    results = services.ai_recommend_places(
        lat=req.lat,
        lng=req.lng,
        radius=req.radius,
        place_type=req.place_type,
        user_prompt=req.user_prompt or "",
        max_recommend=req.max_recommend,
    )
    return {"places": results, "total": len(results), "mode": "ai"}


# --- Trip Endpoints ---
@app.post("/trips/", response_model=schemas.TripResponse)
def create_trip(trip: schemas.TripCreate, db: Session = Depends(get_db)):
    db_trip = models.Trip(**trip.model_dump())
    db.add(db_trip)
    db.commit()
    db.refresh(db_trip)
    return db_trip

@app.get("/trips/{trip_id}", response_model=schemas.TripResponse)
def get_trip(trip_id: str, db: Session = Depends(get_db)):
    trip = db.query(models.Trip).filter(models.Trip.trip_id == trip_id).first()
    return trip

# --- Node Endpoints ---
@app.get("/itinerary/{trip_id}", response_model=List[schemas.DailyNodeResponse])
def get_itinerary(trip_id: str, db: Session = Depends(get_db)):
    nodes = db.query(models.DailyNode).filter(models.DailyNode.trip_id == trip_id).order_by(models.DailyNode.day_index, models.DailyNode.node_order).all()
    return nodes

@app.post("/itinerary/", response_model=schemas.DailyNodeResponse)
def create_or_update_node(node: schemas.DailyNodeCreate, db: Session = Depends(get_db)):
    db_node = db.query(models.DailyNode).filter(models.DailyNode.node_id == node.node_id).first()
    if db_node:
        for key, value in node.model_dump().items():
            setattr(db_node, key, value)
    else:
        db_node = models.DailyNode(**node.model_dump())
        db.add(db_node)
    db.commit()
    db.refresh(db_node)
    return db_node

@app.delete("/itinerary/{node_id}")
def delete_node(node_id: str, db: Session = Depends(get_db)):
    db_node = db.query(models.DailyNode).filter(models.DailyNode.node_id == node_id).first()
    if db_node:
        db.delete(db_node)
        db.commit()
        return {"status": "deleted"}
    return {"status": "not_found"}
