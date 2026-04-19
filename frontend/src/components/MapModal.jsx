import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Sparkles, Loader2, Calendar, Compass } from 'lucide-react';
import { Map, AdvancedMarker, useMap, Pin } from '@vis.gl/react-google-maps';
import { PlacePicker } from '@googlemaps/extended-component-library/react';
import ExplorePanel from './ExplorePanel';
import './MapModal.css';
import { api } from '../api';
import { useTripStore } from '../store/useTripStore';

const defaultCenter = { lat: 25.033, lng: 121.565 }; // 台北 101

// ─── MapHandler：同步地圖中心 + Marker 顯示 ─────────────────────────────────
function MapHandler({ center, itineraryPlace, exploreMarkers, hoveredPlaceId, onCenterChange }) {
  const map = useMap('MAIN_MAP');

  useEffect(() => {
    if (map && center) {
      map.panTo(center);
      if (itineraryPlace) map.setZoom(15);
    }
  }, [map, center, itineraryPlace]);

  // 每次地圖 idle 時回報中心點（供 ExplorePanel 使用）
  useEffect(() => {
    if (!map) return;
    const listener = map.addListener('idle', () => {
      const c = map.getCenter();
      if (c) onCenterChange?.({ lat: c.lat(), lng: c.lng() });
    });
    return () => listener.remove();
  }, [map, onCenterChange]);

  return (
    <Map
      defaultZoom={13}
      defaultCenter={defaultCenter}
      id="MAIN_MAP"
      mapId="MAIN_MAP"
      disableDefaultUI={true}
      zoomControl={true}
      style={{ width: '100%', height: '100%', borderRadius: '12px' }}
    >
      {/* 行程節點 Marker (藍色) */}
      {itineraryPlace && (
        <AdvancedMarker position={center}>
          <Pin background="#6366f1" borderColor="#4f46e5" glyphColor="white" />
        </AdvancedMarker>
      )}

      {/* 探索結果 Markers (橘/紫，hover 高亮) */}
      {exploreMarkers.map(place => (
        place.lat && place.lng ? (
          <AdvancedMarker
            key={place.place_id}
            position={{ lat: place.lat, lng: place.lng }}
            title={place.name}
          >
            <Pin
              background={hoveredPlaceId === place.place_id ? '#f59e0b' : '#8b5cf6'}
              borderColor={hoveredPlaceId === place.place_id ? '#d97706' : '#7c3aed'}
              glyphColor="white"
              scale={hoveredPlaceId === place.place_id ? 1.3 : 1.0}
            />
          </AdvancedMarker>
        ) : null
      ))}
    </Map>
  );
}

// ─── ItineraryTab：原有的行程規劃 (搜尋地點 + AI 順路推薦) ───────────────────
function ItineraryTab({ prevPlace, nextPlace, onAddNode }) {
  const [center, setCenter] = useState(defaultCenter);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const placePickerRef = useRef(null);

  useEffect(() => {
    async function loadAI() {
      setIsLoading(true);
      try {
        const results = await api.getAIRecommendations(
          prevPlace || '目前位置',
          nextPlace || '下個預定點',
          3
        );
        setAiRecommendations(results);
      } catch (e) {
        console.error('Failed to load AI recommendations', e);
      }
      setIsLoading(false);
    }
    loadAI();
  }, [prevPlace, nextPlace]);

  const handlePlaceChange = async () => {
    const place = placePickerRef.current?.value;
    if (!place) return;
    try {
      await place.fetchFields({ fields: ['displayName', 'location', 'rating', 'id'] });
    } catch (error) {
      console.error('Failed to fetch place details:', error);
      alert(
        '無法取得地點資訊：您的 API Key 尚未啟動「Places API (New)」。\n請至 Google Cloud Console 啟用該 API 以正常使用地點搜尋功能。'
      );
    }
    if (place.location) {
      const loc = { lat: place.location.lat(), lng: place.location.lng() };
      setCenter(loc);
      setSelectedPlace({
        id: place.id,
        name: place.displayName || 'Unknown Place',
        rating: place.rating || 4.5,
        durationMins: 90,
        tag: '從地圖搜尋選擇',
      });
    }
  };

  return {
    jsx: (
      <>
        <div className="search-box">
          <Search size={18} color="#6b7280" className="search-icon" />
          <PlacePicker
            ref={placePickerRef}
            onPlaceChange={handlePlaceChange}
            placeholder="地圖搜尋景點或餐廳..."
            style={{ width: '100%', border: 'none', background: 'transparent' }}
          />
        </div>

        {selectedPlace && (
          <div className="rec-card selected-card">
            <div className="rec-info">
              <div className="top-row">
                <span className="rec-name">{selectedPlace.name}</span>
                <span className="rec-rating">⭐ {selectedPlace.rating}</span>
              </div>
              <span className="rec-tag">{selectedPlace.tag}</span>
            </div>
            <button className="btn primary small" onClick={() => onAddNode(selectedPlace)}>
              確認加入
            </button>
          </div>
        )}

        <div className="ai-recommend-section">
          <h4 className="section-title">
            <Sparkles size={16} color="var(--primary)" />
            AI 智能推薦 (分析起終點沿途)
          </h4>
          <div className="rec-list">
            {isLoading ? (
              <div className="loading-placeholder">
                <Loader2 size={28} className="animate-spin" style={{ color: 'var(--primary)' }} />
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
                  <button className="btn outline small" onClick={() => onAddNode(place)}>
                    加入
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </>
    ),
    center,
    markerPlace: selectedPlace,
  };
}

// ─── Main MapModal ────────────────────────────────────────────────────────────
export default function MapModal({ onClose, prevPlace, nextPlace, onAddNode }) {
  const [activeTab, setActiveTab] = useState('itinerary');

  // 從 store 取得當前 day 的 startLocation 作為動態中心
  const { activeDay, dayConfigs, nodesByDay, tripTitle } = useTripStore();
  const currentDayConfig = dayConfigs[activeDay] || dayConfigs[1];
  const currentDayNodes = nodesByDay[activeDay] || [];
  const firstConfirmed = currentDayNodes.find(n => n.status === 'confirmed');

  // 地圖共用狀態
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [itineraryCenter, setItineraryCenter] = useState(defaultCenter);
  const [itineraryMarker, setItineraryMarker] = useState(null);

  // 探索面板的 Marker 狀態
  const [exploreMarkers, setExploreMarkers] = useState([]);
  const [hoveredPlaceId, setHoveredPlaceId] = useState(null);
  // 行程 Tab：PlacePicker 選地點時更新地圖中心
  const [itinerarySelectedPlace, setItinerarySelectedPlace] = useState(null);
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const placePickerRef = useRef(null);

  useEffect(() => {
    async function loadAI() {
      setIsAiLoading(true);
      try {
        const results = await api.getAIRecommendations(
          prevPlace || '目前位置',
          nextPlace || '下個預定點',
          3,
          tripTitle // 傳入行程標題作為 Context
        );
        setAiRecommendations(results);
      } catch (e) {
        console.error('Failed to load AI recommendations', e);
      }
      setIsAiLoading(false);
    }
    loadAI();
  }, [prevPlace, nextPlace]);

  // 動態地圖中心：嘗試用 prevPlace -> startLocation -> tripTitle -> 保持現況
  useEffect(() => {
    if (!window.google?.maps?.Geocoder) return;
    const geocoder = new window.google.maps.Geocoder();
    
    const tryGeocode = (address) => {
      return new Promise((resolve) => {
        // 1. 嘗試原生的 Geocoder
        geocoder.geocode({ address }, (results, status) => {
          if (status === 'OK' && results[0]) {
            const loc = results[0].geometry.location;
            resolve({ lat: loc.lat(), lng: loc.lng() });
            return;
          }
          
          // 2. 如果 Geocoder 失敗（例如沒啟用 API），嘗試 Places Service (findPlaceFromQuery)
          if (window.google?.maps?.places) {
            const service = new window.google.maps.places.PlacesService(document.createElement('div'));
            service.findPlaceFromQuery({
              query: address,
              fields: ['geometry']
            }, (results, status) => {
              if (status === 'OK' && results?.[0]?.geometry?.location) {
                const loc = results[0].geometry.location;
                resolve({ lat: loc.lat(), lng: loc.lng() });
              } else {
                resolve(null);
              }
            });
          } else {
            resolve(null);
          }
        });
      });
    };

    async function initCenter() {
      console.log(`[MapModal] Initializing center. prevPlace: ${prevPlace}, StartLocation: ${currentDayConfig?.startLocation}, TripTitle: ${tripTitle}`);
      
      // 0. 最優先：使用前一個景點的位置（讓地圖跟隨行程進度）
      if (prevPlace) {
        const loc = await tryGeocode(prevPlace);
        if (loc) {
          setMapCenter(loc);
          setItineraryCenter(loc);
          return;
        }
      }

      // 1. 其次用當日出發地
      if (currentDayConfig?.startLocation) {
        const loc = await tryGeocode(currentDayConfig.startLocation);
        if (loc) {
          setMapCenter(loc);
          setItineraryCenter(loc);
          return;
        }
      }

      // 2. 再用第一個確認點
      if (firstConfirmed?.selected_place_name) {
        const loc = await tryGeocode(firstConfirmed.selected_place_name);
        if (loc) {
          setMapCenter(loc);
          setItineraryCenter(loc);
          return;
        }
      }

      // 3. 最後用行程標題 (提取地名，如 "東京三日遊" -> "東京")
      if (tripTitle && tripTitle !== '未命名行程') {
        const hint = tripTitle.replace(/行程|三日遊|自由行|之旅/g, '').substring(0, 10);
        const loc = await tryGeocode(hint);
        if (loc) {
          setMapCenter(loc);
          setItineraryCenter(loc);
          return;
        }
      }
    }

    initCenter();
  }, [prevPlace, currentDayConfig?.startLocation, firstConfirmed?.selected_place_name, tripTitle]);

  // 自動聚焦 PlacePicker
  useEffect(() => {
    const timer = setTimeout(() => {
      const pickerEl = placePickerRef.current;
      if (pickerEl) {
        // PlacePicker Web Component 的 shadow DOM 內有一個 input
        const input = pickerEl.shadowRoot?.querySelector('input') || pickerEl.querySelector('input');
        input?.focus();
      }
    }, 300); // 等 modal 動畫完成
    return () => clearTimeout(timer);
  }, []);

  const handlePlaceChange = async () => {
    const place = placePickerRef.current?.value;
    if (!place) return;
    try {
      await place.fetchFields({ fields: ['displayName', 'location', 'rating', 'id'] });
    } catch (error) {
      console.error('Failed to fetch place details:', error);
      alert(
        '無法取得地點資訊：您的 API Key 尚未啟動「Places API (New)」。\n請至 Google Cloud Console 啟用該 API 以正常使用地點搜尋功能。'
      );
    }
    if (place.location) {
      const loc = { lat: place.location.lat(), lng: place.location.lng() };
      setItineraryCenter(loc);
      setMapCenter(loc);
      const newPlace = {
        id: place.id,
        name: place.displayName || 'Unknown Place',
        rating: place.rating || 4.5,
        durationMins: 90,
        tag: '從地圖搜尋選擇',
      };
      setItinerarySelectedPlace(newPlace);
      setItineraryMarker(newPlace);
    }
  };

  // 探索面板 hover → 地圖 Pan
  const handleHoverPlace = (place) => {
    if (place?.lat && place?.lng) {
      setMapCenter({ lat: place.lat, lng: place.lng });
      setHoveredPlaceId(place.place_id);
    } else {
      setHoveredPlaceId(null);
    }
  };

  // 探索面板結果 → 更新地圖 Markers
  // ExplorePanel 透過 onAddPlace 觸發時不需要這個，但我們需要讓 ExplorePanel 能回傳 markers
  // 這裡用 ExplorePanel 的 onResultsChange callback 不存在，改由 ExplorePanel 內部管理
  // 地圖中心同步：切換 Tab 後地圖 center 對應切換
  const currentCenter = activeTab === 'itinerary' ? itineraryCenter : mapCenter;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose} id="modal-close-btn">
          <X size={20} />
        </button>

          <div className="modal-layout">
            {/* 左半部：Tabs + 內容 */}
            <div className="modal-sidebar">
              {/* ── 頂部 Tab 切換 ── */}
              <div className="modal-tabs">
                <button
                  id="tab-itinerary"
                  className={`modal-tab ${activeTab === 'itinerary' ? 'active' : ''}`}
                  onClick={() => setActiveTab('itinerary')}
                >
                  <Calendar size={15} />
                  行程規劃
                </button>
                <button
                  id="tab-explore"
                  className={`modal-tab explore-tab ${activeTab === 'explore' ? 'active' : ''}`}
                  onClick={() => setActiveTab('explore')}
                >
                  <Compass size={15} />
                  探索與推薦
                </button>
              </div>

              {/* ── 行程規劃 Tab ── */}
              {activeTab === 'itinerary' && (
                <div className="tab-content">
                  <h3 className="modal-title">加入新景點</h3>

                  <div className="search-box">
                    <Search size={18} color="#6b7280" className="search-icon" />
                    <PlacePicker
                      ref={placePickerRef}
                      onPlaceChange={handlePlaceChange}
                      placeholder="地圖搜尋景點或餐廳..."
                      style={{ width: '100%', border: 'none', background: 'transparent' }}
                    />
                  </div>

                  {itinerarySelectedPlace && (
                    <div className="rec-card selected-card">
                      <div className="rec-info">
                        <div className="top-row">
                          <span className="rec-name">{itinerarySelectedPlace.name}</span>
                          <span className="rec-rating">⭐ {itinerarySelectedPlace.rating}</span>
                        </div>
                        <span className="rec-tag">{itinerarySelectedPlace.tag}</span>
                      </div>
                      <button
                        className="btn primary small"
                        onClick={() => {
                          onAddNode(itinerarySelectedPlace);
                        }}
                      >
                        確認加入
                      </button>
                    </div>
                  )}

                  <div className="ai-recommend-section">
                    <h4 className="section-title">
                      <Sparkles size={16} color="var(--primary)" />
                      AI 智能推薦 (分析起終點沿途)
                    </h4>
                    <div className="rec-list">
                      {isAiLoading ? (
                        <div className="loading-placeholder">
                          <Loader2 size={28} className="animate-spin" style={{ color: 'var(--primary)' }} />
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
                            <button className="btn outline small" onClick={() => onAddNode(place)}>
                              加入
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ── 探索與推薦 Tab ── (always mounted, hidden via CSS to preserve state) */}
              <div
                className="tab-content explore-content"
                style={{ display: activeTab === 'explore' ? 'flex' : 'none' }}
              >
                <ExplorePanel
                  mapCenter={mapCenter}
                  onSetCenter={setMapCenter}
                  onAddPlace={(place) => {
                    onAddNode(place);
                  }}
                  onHoverPlace={handleHoverPlace}
                  onPlacesLoaded={(places) => setExploreMarkers(places)}
                  prevPlace={prevPlace}
                />
              </div>
            </div>

            {/* 右半部：Google Maps */}
            <div className="modal-map-area">
              <MapHandler
                center={currentCenter}
                itineraryPlace={activeTab === 'itinerary' ? itineraryMarker : null}
                exploreMarkers={activeTab === 'explore' ? exploreMarkers : []}
                hoveredPlaceId={hoveredPlaceId}
                onCenterChange={setMapCenter}
              />
            </div>
          </div>
      </div>
    </div>
  );
}
