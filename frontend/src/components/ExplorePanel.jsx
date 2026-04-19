import { useState, useCallback, useRef } from 'react';
import { Search, Sparkles, SlidersHorizontal, MapPin, AlertCircle, Loader2, ChevronUp, ChevronDown } from 'lucide-react';
import { PlacePicker } from '@googlemaps/extended-component-library/react';
import PlaceCard from './PlaceCard';
import { api } from '../api';
import './ExplorePanel.css';

const TYPE_OPTIONS = [
  { value: 'all', label: '🌟 全部' },
  { value: 'tourist_attraction', label: '🏛 景點' },
  { value: 'restaurant', label: '🍜 餐廳' },
  { value: 'cafe', label: '☕ 咖啡廳' },
  { value: 'park', label: '🌳 公園' },
  { value: 'shopping', label: '🛍 購物' },
];

const RADIUS_OPTIONS = [
  { value: 500,  label: '500m' },
  { value: 1000, label: '1km' },
  { value: 2000, label: '2km' },
  { value: 3000, label: '3km' },
];

const SUGGESTED_PROMPTS = [
  '適合帶父母去的台菜餐廳',
  '風景優美人不多的咖啡廳',
  'CP值高且評價極佳的景點',
  '文青感十足的書店或藝廊',
  '網美打卡熱點',
];

/**
 * ExplorePanel
 * Props:
 *   mapCenter   — { lat, lng }，目前地圖中心
 *   onAddPlace  — callback(place)，加入行程
 *   onHoverPlace — callback(place | null)，觸發地圖 Marker 高亮
 */
const GOOGLE_PHOTO_BASE = `https://places.googleapis.com/v1`;

function buildPhotoUrl(photoRef, maxWidth = 400) {
  if (!photoRef) return null;
  const apiKey = window.__GOOGLE_MAPS_API_KEY__ || '';
  return `${GOOGLE_PHOTO_BASE}/${photoRef}/media?maxWidthPx=${maxWidth}&key=${apiKey}`;
}

export default function ExplorePanel({ mapCenter, onSetCenter, onAddPlace, onHoverPlace, onPlacesLoaded, prevPlace }) {
  // Sub-mode: 'google' | 'ai'
  const [subMode, setSubMode] = useState('google');

  // 共通篩選
  const [placeType, setPlaceType] = useState('all');
  const [radius, setRadius] = useState(1000);

  // Google 模式
  const [keyword, setKeyword] = useState('');
  const [minRating, setMinRating] = useState(3.5);

  // AI 模式
  const [userPrompt, setUserPrompt] = useState('');

  // 結果
  const [places, setPlaces] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState(null);
  const [isFormCollapsed, setIsFormCollapsed] = useState(false);
  const placePickerRef = useRef(null);

  const handleCenterChange = async () => {
    const place = placePickerRef.current?.value;
    if (!place) return;
    try {
      await place.fetchFields({ fields: ['location'] });
      if (place.location) {
        onSetCenter?.({ lat: place.location.lat(), lng: place.location.lng() });
      }
    } catch (error) {
      console.error('Failed to zoom to place:', error);
    }
  };

  const handleSearch = useCallback(async () => {
    if (!mapCenter?.lat || !mapCenter?.lng) {
      setError('請先在地圖上定位，才能搜尋周邊地點。');
      return;
    }
    setIsLoading(true);
    setError('');
    setPlaces([]);
    setHasSearched(true);

    try {
      let results;
      if (subMode === 'google') {
        results = await api.searchNearbyPlaces({
          lat: mapCenter.lat,
          lng: mapCenter.lng,
          radius,
          placeType,
          keyword,
          minRating,
          maxCount: 10,
        });
      } else {
        results = await api.aiRecommendPlaces({
          lat: mapCenter.lat,
          lng: mapCenter.lng,
          radius,
          placeType,
          userPrompt,
          maxRecommend: 5,
        });
      }
      setPlaces(results);
      onPlacesLoaded?.(results);
      if (results.length === 0) {
        setError('此區域暫無符合條件的建議，可嘗試調大範圍或更換類型。');
      }
      // 使用即時 results 變數（避免 stale closure），有結果就收合
      if (results && results.length > 0) {
        setTimeout(() => setIsFormCollapsed(true), 150);
      }
    } catch (e) {
      console.error(e);
      setError('搜尋失敗，請確認後端服務是否正常運行。');
    } finally {
      setIsLoading(false);
    }
  }, [mapCenter, subMode, placeType, radius, keyword, minRating, userPrompt]);

  const handleHover = (place) => {
    if (place) setSelectedPlaceId(place.place_id);
    else setSelectedPlaceId(null);
    onHoverPlace?.(place);
  };

  const handleAdd = (place) => {
    onAddPlace?.({
      id: place.place_id,
      name: place.name,
      rating: place.rating,
      durationMins: 90,
      tag: place.reason || place.types?.[0] || '周邊推薦',
      lat: place.lat,
      lng: place.lng,
      photo_url: buildPhotoUrl(place.photo_ref),
    });
  };

  return (
    <div className="explore-panel">
      <div 
        className={`search-form-container ${isFormCollapsed && places.length > 0 ? 'collapsed' : ''}`}
      >
        {/* 手動切換 chevron 按鈕 — 有結果時才顯示 */}
        {places.length > 0 && (
          <button
            className="collapse-toggle-btn"
            onClick={() => setIsFormCollapsed(prev => !prev)}
            title={isFormCollapsed ? '展開搜尋設定' : '收合搜尋設定'}
          >
            {isFormCollapsed ? (
              <><ChevronDown size={16} /> 展開搜尋設定</>
            ) : (
              <><ChevronUp size={16} /> 收合搜尋設定</>
            )}
          </button>
        )}
        
        <div className="search-form-content">
          {/* Sub-mode Toggle */}
          <div className="sub-mode-toggle">
            <button
              className={`sub-mode-btn ${subMode === 'google' ? 'active' : ''}`}
              onClick={() => {
                if (subMode !== 'google') {
                  setSubMode('google');
                  setPlaces([]);
                  setError('');
                  setHasSearched(false);
                  setIsLoading(false);
                }
              }}
              id="explore-google-tab"
            >
              <Search size={14} />
              Google 排序
            </button>
            <button
              className={`sub-mode-btn ai ${subMode === 'ai' ? 'active' : ''}`}
              onClick={() => {
                if (subMode !== 'ai') {
                  setSubMode('ai');
                  setPlaces([]);
                  setError('');
                  setHasSearched(false);
                  setIsLoading(false);
                }
              }}
              id="explore-ai-tab"
            >
              <Sparkles size={14} />
              ✨ AI 推薦
            </button>
          </div>

          {/* 自訂搜尋中心 */}
          <div className="filter-group" style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px', display: 'block' }}>基準點搜尋框 (自訂搜尋中心)</label>
              <div className="search-box" style={{ background: '#f1f5f9', borderRadius: '8px', padding: '4px 12px', display: 'flex', alignItems: 'center' }}>
                <Search size={16} color="#6b7280" style={{ marginRight: '8px' }} />
                <PlacePicker
                  ref={placePickerRef}
                  onPlaceChange={handleCenterChange}
                  placeholder={prevPlace ? `預設附近：${prevPlace}` : "搜尋地點以更改中心點..."}
                  style={{ width: '100%', border: 'none', background: 'transparent' }}
                />
              </div>
          </div>

          {/* 共通篩選 */}
          <div className="filter-row">
            <div className="filter-group">
              <label>類型</label>
              <div className="type-pills">
                {TYPE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    className={`type-pill ${placeType === opt.value ? 'active' : ''}`}
                    onClick={() => setPlaceType(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="filter-group radius-group">
              <label>搜尋範圍</label>
              <div className="radius-pills">
                {RADIUS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    className={`radius-pill ${radius === opt.value ? 'active' : ''}`}
                    onClick={() => setRadius(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Google 模式輸入 */}
          {subMode === 'google' && (
            <div className="google-inputs">
              <div className="search-input-wrap">
                <Search size={15} className="input-icon" />
                <input
                  id="google-keyword-input"
                  className="explore-input"
                  placeholder="關鍵字（如：拉麵、夜景...）"
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <div className="rating-filter">
                <span>最低星級</span>
                {[3.0, 3.5, 4.0, 4.5].map(v => (
                  <button
                    key={v}
                    className={`rating-btn ${minRating === v ? 'active' : ''}`}
                    onClick={() => setMinRating(v)}
                  >
                    {v}★
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* AI 模式輸入 */}
          {subMode === 'ai' && (
            <div className="ai-inputs">
              <textarea
                id="ai-prompt-textarea"
                className="ai-textarea"
                placeholder='描述你想要的體驗，例如「適合帶父母去的台菜餐廳」...'
                value={userPrompt}
                onChange={e => setUserPrompt(e.target.value)}
                rows={3}
              />
              <div className="suggested-prompts">
                {SUGGESTED_PROMPTS.map((p, i) => (
                  <button
                    key={i}
                    className="suggested-tag"
                    onClick={() => setUserPrompt(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search Button */}
          <button
            id="explore-search-btn"
            className={`explore-search-btn ${subMode === 'ai' ? 'ai-btn' : ''}`}
            onClick={handleSearch}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="spin-icon" />
                {subMode === 'ai' ? '🧠 Gemini 分析周邊中...' : '搜尋中...'}
              </>
            ) : (
              <>
                {subMode === 'ai' ? <Sparkles size={16} /> : <Search size={16} />}
                {subMode === 'ai' ? '生成 AI 推薦' : '搜尋周邊'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results Area */}
      <div className="results-area">
        {/* Loading: AI 模式用 Overlay，Google 模式用 Skeleton */}
        {isLoading && subMode === 'ai' && (
          <div className="ai-loading-overlay">
            <div className="ai-loading-animation">
              <Sparkles size={36} className="ai-loading-sparkle" />
              <p className="ai-loading-text">🧠 Gemini 正在分析周邊景點...</p>
              <p className="ai-loading-sub">根據你的偏好智能排序中</p>
              <div className="ai-loading-bar"><div className="ai-loading-bar-inner" /></div>
            </div>
          </div>
        )}
        {isLoading && subMode === 'google' && (
          <div className="skeleton-list">
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton-card">
                <div className="skeleton-line wide" />
                <div className="skeleton-line medium" />
                <div className="skeleton-line short" />
              </div>
            ))}
          </div>
        )}

        {/* Error / Empty */}
        {!isLoading && error && (
          <div className="explore-empty">
            <AlertCircle size={32} color="#f87171" />
            <p>{error}</p>
          </div>
        )}

        {/* Initial State (before any search) */}
        {!isLoading && !hasSearched && !error && (
          <div className="explore-empty initial">
            <MapPin size={36} color="var(--primary)" style={{ opacity: 0.5 }} />
            <p>在地圖上移動到你想探索的區域，<br />然後點擊上方按鈕開始搜尋。</p>
          </div>
        )}

        {/* Results */}
        {!isLoading && places.length > 0 && (
          <div className="places-list">
            <p className="results-count">
              {subMode === 'ai' ? '✨ AI 精選推薦' : '🔴 Google 排序結果'} — 共 {places.length} 筆
            </p>
            {places.map(place => (
              <PlaceCard
                key={place.place_id}
                place={place}
                isAiMode={subMode === 'ai'}
                onAdd={handleAdd}
                onHover={handleHover}
                isSelected={selectedPlaceId === place.place_id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
