from sqlalchemy import Column, Integer, String, JSON, ForeignKey, Boolean
from database import Base

class Trip(Base):
    __tablename__ = "trips"

    trip_id = Column(String, primary_key=True, index=True)
    name = Column(String)
    start_date = Column(String)
    days_count = Column(Integer)
    
    # 存放使用者的全域設定 (出發地、目的地、時間等)
    global_config = Column(JSON, nullable=True)

class DailyNode(Base):
    __tablename__ = "daily_nodes"
    
    node_id = Column(String, primary_key=True, index=True)
    trip_id = Column(String, ForeignKey("trips.trip_id"), index=True)
    day_index = Column(Integer, index=True)  # 第幾天
    node_order = Column(Integer)             # 當日的排序順序
    
    status = Column(String, default="pending_options") # 'pending_options' 或 'confirmed'
    
    selected_place_id = Column(String, nullable=True)  # Google Place ID
    selected_place_name = Column(String, nullable=True)
    
    planned_arrival_time = Column(String, nullable=True) # 不一定要存，前台動態算也可
    planned_stay_duration = Column(Integer, default=0)
    
    transport_mode = Column(String, default="transit")   # 'transit', 'driving', 'walking'
    transport_route_prefs = Column(String, nullable=True)
    
    options_json = Column(JSON, nullable=True)           # 陣列儲存備選項備用清單
    rating = Column(String, nullable=True)

class DirectionsCache(Base):
    __tablename__ = "directions_cache"
    
    id = Column(Integer, primary_key=True, index=True)
    origin = Column(String, index=True)
    destination = Column(String, index=True)
    mode = Column(String, index=True)
    duration_mins = Column(Integer)
