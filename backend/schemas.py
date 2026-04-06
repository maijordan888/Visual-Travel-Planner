from pydantic import BaseModel
from typing import Optional, Dict, Any, List

# ======== Trips ========
class TripBase(BaseModel):
    name: str
    start_date: str
    days_count: int
    global_config: Optional[Dict[str, Any]] = None

class TripCreate(TripBase):
    trip_id: str

class TripResponse(TripBase):
    trip_id: str

    class Config:
        from_attributes = True

# ======== DailyNodes ========
class DailyNodeBase(BaseModel):
    trip_id: str
    day_index: int
    node_order: int
    status: str = "pending_options"
    
    selected_place_id: Optional[str] = None
    selected_place_name: Optional[str] = None
    
    planned_arrival_time: Optional[str] = None
    planned_stay_duration: int = 0
    
    transport_mode: str = "transit"
    transport_route_prefs: Optional[str] = None
    
    options_json: Optional[List[Dict[str, Any]]] = []
    rating: Optional[str] = None

class DailyNodeCreate(DailyNodeBase):
    node_id: str

class DailyNodeResponse(DailyNodeBase):
    node_id: str

    class Config:
        from_attributes = True
