from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel

import models, schemas, services
from database import engine, SessionLocal

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Travel AI Planner API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
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

# --- Models ---
class DirectionsRequest(BaseModel):
    origin: str           
    destination: str      
    mode: str = "driving" 

class RecommendRequest(BaseModel):
    prev_place: str
    next_place: str


# --- API Endpoints ---
@app.get("/")
def health_check():
    return {"status": "ok", "message": "後端服務正常運行！"}

@app.post("/directions/calculate-time")
def calculate_travel_time(req: DirectionsRequest):
    mins = services.get_directions_time(req.origin, req.destination, req.mode)
    if mins == -1:
         return {"error": "無法計算"}
    return {"origin": req.origin, "destination": req.destination, "travel_time_mins": mins, "mode": req.mode}


@app.post("/recommend-places")
def get_ai_recommendations(req: RecommendRequest):
    """呼叫 AI 取得兩點之間的推薦點"""
    results = services.recommend_places(req.prev_place, req.next_place)
    return {"recommendations": results}


@app.get("/itinerary/{trip_id}", response_model=List[schemas.ItineraryNodeResponse])
def get_itinerary(trip_id: str, db: Session = Depends(get_db)):
    nodes = db.query(models.ItineraryNode).filter(models.ItineraryNode.trip_id == trip_id).order_by(models.ItineraryNode.day_number, models.ItineraryNode.node_order).all()
    return nodes

@app.post("/itinerary/", response_model=schemas.ItineraryNodeResponse)
def create_or_update_node(node: schemas.ItineraryNodeCreate, db: Session = Depends(get_db)):
    db_node = models.ItineraryNode(**node.model_dump())
    db.add(db_node)
    db.commit()
    db.refresh(db_node)
    return db_node
