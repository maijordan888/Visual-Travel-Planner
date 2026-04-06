from pydantic import BaseModel
from typing import Optional, Dict, Any

class ItineraryNodeBase(BaseModel):
    trip_id: str
    day_number: int
    day_config: Optional[Dict[str, Any]] = None
    node_order: int
    
    place_id: str
    place_name: str
    address: str
    duration_mins: int
    arrival_time: str
    departure_time: str
    notes: Optional[str] = None

class ItineraryNodeCreate(ItineraryNodeBase):
    pass

class ItineraryNodeResponse(ItineraryNodeBase):
    id: int

    class Config:
        from_attributes = True # v2 的 orm_mode
