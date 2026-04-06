import { useState, useEffect, useCallback } from 'react';
import { Search, Map as MapIcon, X, Sparkles, MapPin, Loader2, AlertTriangle } from 'lucide-react';
import { useJsApiLoader, GoogleMap, Marker, Autocomplete } from '@react-google-maps/api';
import './MapModal.css';
import { api } from '../api';

const libraries = ['places'];
const mapContainerStyle = { width: '100%', height: '100%', borderRadius: '12px' };
const defaultCenter = { lat: 25.033, lng: 121.565 }; // 預設台北 101

export default function MapModal({ onClose, prevPlace, nextPlace, onAddNode }) {
  const [autocomplete, setAutocomplete] = useState(null);
  const [map, setMap] = useState(null);
  const [center, setCenter] = useState(defaultCenter);
  const [selectedPlace, setSelectedPlace] = useState(null);
  
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "AIzaSy_dummy_key_to_prevent_crash_12345",
    libraries
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const onMapLoad = useCallback((m) => setMap(m), []);

  useEffect(() => {
    async function loadAI() {
      setIsLoading(true);
      try {
        const results = await api.getAIRecommendations(prevPlace || "目前位置", nextPlace || "下個預定點", 3);
        setAiRecommendations(results);
      } catch (e) {
        console.error("Failed to load AI recommendations", e);
      }
      setIsLoading(false);
    }
    loadAI();
  }, [prevPlace, nextPlace]);

  const onPlaceChanged = () => {
    if (autocomplete) {
      const place = autocomplete.getPlace();
      if (place.geometry) {
        const loc = { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };
        setCenter(loc);
        map?.panTo(loc);
        map?.setZoom(15);
        setSelectedPlace({
           id: place.place_id,
           name: place.name,
           rating: place.rating || 4.5,
           durationMins: 90,
           tag: "從地圖搜尋選擇"
        });
      }
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}><X size={20} /></button>

        <div className="modal-layout">
          {/* 左半部：搜尋列與 AI 推薦名單 */}
          <div className="modal-sidebar">
            <h3 className="modal-title">加入新景點</h3>
            
            <div className="search-box" style={{ padding: '0 12px' }}>
              <Search size={18} color="#6b7280" style={{ marginRight: '8px' }} />
              {isLoaded ? (
                <Autocomplete onLoad={setAutocomplete} onPlaceChanged={onPlaceChanged} style={{ width: '100%' }}>
                  <input style={{ width: '100%', padding: '12px 0', border: 'none', background: 'transparent', outline: 'none' }} type="text" placeholder="地圖搜尋景點或餐廳..."/>
                </Autocomplete>
              ) : (
                <input type="text" placeholder="載入地圖引擎中..." disabled style={{ border: 'none', background: 'transparent' }}/>
              )}
            </div>
            
            {/* 搜尋選中目標後的預覽卡片 */}
            {selectedPlace && (
                <div className="rec-card" style={{ marginTop: '12px', border: '2px solid var(--primary)' }}>
                  <div className="rec-info">
                    <div className="top-row">
                        <span className="rec-name">{selectedPlace.name}</span> 
                        <span className="rec-rating">⭐ {selectedPlace.rating}</span>
                    </div>
                    <span className="rec-tag">{selectedPlace.tag}</span>
                  </div>
                  <button className="btn primary small" onClick={() => onAddNode(selectedPlace)}>確認加入</button>
                </div>
            )}

            <div className="ai-recommend-section">
              <h4 className="section-title">
                  <Sparkles size={16} color="var(--primary)" /> 
                  AI 智能推薦 (分析起終點沿途)
              </h4>
              <div className="rec-list">
                {isLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                    <Loader2 size={32} className="animate-spin" style={{ color: 'var(--primary)', marginBottom: '12px' }} />
                    <p>AI 正在計算交通順路度與評價...</p>
                  </div>
                ) : (
                  aiRecommendations.map(place => (
                    <div key={place.id} className="rec-card">
                      <div className="rec-info">
                        <div className="top-row">
                            <span className="rec-name">{place.name}</span> 
                            <span className="rec-rating">⭐ {place.rating}</span>
                        </div>
                        <span className="rec-tag">{place.tag}</span>
                        <span className="rec-dur">建議停留：{place.durationMins} 分鐘</span>
                      </div>
                      <button className="btn outline small" onClick={() => onAddNode(place)}>加入</button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 右半部：實際 Google Maps */}
          <div className="modal-map-area">
            {loadError ? (
              <div className="mock-map">
                 <AlertTriangle size={48} color="#ef4444" />
                 <p style={{ marginTop: '16px', color: '#64748b' }}>地圖載入失敗</p>
                 <p style={{ fontSize: '0.85rem', color: '#ef4444' }}>請檢查 VITE_GOOGLE_MAPS_API_KEY 並重啟前端伺服器</p>
              </div>
            ) : isLoaded ? (
              <GoogleMap
                mapContainerStyle={mapContainerStyle}
                center={center}
                zoom={13}
                onLoad={onMapLoad}
                options={{ disableDefaultUI: true, zoomControl: true }}
              >
                {selectedPlace && <Marker position={center} />}
              </GoogleMap>
            ) : (
              <div className="mock-map">
                 <Loader2 size={48} className="animate-spin" color="#94a3b8" />
                 <p style={{ marginTop: '16px', color: '#64748b' }}>載入 Google Maps 中...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
