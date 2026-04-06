from sqlalchemy import Column, Integer, String, JSON
from database import Base

class ItineraryNode(Base):
    __tablename__ = "itinerary_nodes"
    
    id = Column(Integer, primary_key=True, index=True)
    trip_id = Column(String, index=True)      # 用來識別哪一趟旅行
    day_number = Column(Integer, index=True)  # 第幾天
    
    # 每日基礎設定只在 day_number 的第一筆記錄存放 (或者也可以另外開一個 Table)
    # 為了維持極簡化與扁平設計，用 JSON 存入如 {"start_location": "...", "rest_time": "..."}
    day_config = Column(JSON, nullable=True)  
    
    node_order = Column(Integer)              # 當日的排序順序
    place_id = Column(String)                 # Google Place ID
    place_name = Column(String)
    address = Column(String)
    
    duration_mins = Column(Integer)
    arrival_time = Column(String)             # 例如: "14:30"
    departure_time = Column(String)           # 例如: "16:00"
    
    # 用途：未來如果有存備選景點需求，或是交通工具標籤，也可以掛在這裡
    notes = Column(String, nullable=True)
