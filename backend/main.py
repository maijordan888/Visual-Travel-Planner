from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
import sys
import os

# 將當前目錄加入 python path 以便找得到 models, schemas 等
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import models, schemas, services
from database import engine, SessionLocal

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Travel Planner API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # 開發階段允許所有來源
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
    """呼叫 AI 取得兩點之間的推薦點 (含建議停留時間)"""
    results = services.recommend_places(req.prev_place, req.next_place, req.count)
    return {"recommendations": results}

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
    # 這裡採用簡單的 upsert 邏輯：如果有就更新，沒有就建立
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
