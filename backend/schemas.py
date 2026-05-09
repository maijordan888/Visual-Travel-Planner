from pydantic import BaseModel, Field
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

# ======== Google Sheets Sync ========
class TripMeta(BaseModel):
    tripId: str
    tripTitle: str
    startDate: str
    endDate: str
    localLastModifiedUtc: Optional[str] = None
    sheetLastModifiedUtc: Optional[str] = None

class TripExportPayload(BaseModel):
    meta: TripMeta
    dayConfigs: Dict[str, Any] = Field(default_factory=dict)
    nodesByDay: Dict[str, List[Dict[str, Any]]] = Field(default_factory=dict)

class SheetValidationIssue(BaseModel):
    row: Optional[int] = None
    field: str
    issue: str
    severity: str = "warning"
    auto_fixed: bool = False
    original_value: Optional[str] = None
    corrected_value: Optional[str] = None

class SheetTripSummary(BaseModel):
    trip_id: str
    trip_name: str
    start_date: str
    end_date: str
    days_count: int
    node_count: int
    last_modified_utc: str
    status: str = "active"

class SheetExportResponse(BaseModel):
    success: bool
    sheet_url: str
    last_modified_utc: str

class SheetImportResponse(BaseModel):
    trip_data: TripExportPayload
    validation_errors: List[SheetValidationIssue] = Field(default_factory=list)

class SheetDeleteResponse(BaseModel):
    success: bool
