from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import models, schemas, services, sheets_service
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
    result = services.get_directions_time(db, req.origin, req.destination, req.mode, req.force_refresh)
    mins = result["mins"]
    if mins == -1:
        return {
            "error": "no_route",
            "detail": f"找不到從 {req.origin} 到 {req.destination} 的路徑",
            "google_maps_url": result["google_maps_url"],
        }
    if mins == -2:
        return {
            "error": "api_error",
            "detail": "API 呼叫失敗，請檢查後端日誌",
            "google_maps_url": result["google_maps_url"],
        }
    return {
        "origin": req.origin,
        "destination": req.destination,
        "travel_time_mins": mins,
        "mode": req.mode,
        "is_fallback": result["is_fallback"],
        "google_maps_url": result["google_maps_url"],
    }

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


# --- Google Sheets Endpoints ---
@app.get("/sheets/trips", response_model=List[schemas.SheetTripSummary])
def list_sheets_trips():
    try:
        return sheets_service.get_all_trips_summary()
    except sheets_service.SheetsConfigError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Google Sheets error: {exc}") from exc


@app.post("/sheets/export/{trip_id}", response_model=schemas.SheetExportResponse)
def export_trip_to_sheets(trip_id: str, payload: schemas.TripExportPayload):
    try:
        return sheets_service.export_trip_to_sheet(trip_id, payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except sheets_service.SheetsConfigError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Google Sheets error: {exc}") from exc


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
