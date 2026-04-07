import { Star, MapPin, ImageOff, Plus } from 'lucide-react';
import './PlaceCard.css';

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

function buildPhotoUrl(photoRef) {
  if (!photoRef || !MAPS_KEY) return null;
  return `https://places.googleapis.com/v1/${photoRef}/media?maxWidthPx=120&key=${MAPS_KEY}`;
}

/**
 * PlaceCard
 * Props:
 *   place       — { place_id, name, rating, user_rating_count, types, address, lat, lng, is_open, photo_ref, tags?, reason? }
 *   isAiMode    — Boolean，AI 模式時顯示 tags & reason
 *   onAdd       — callback(place)
 *   onHover     — callback(place | null)，滑鼠移入移出
 *   isSelected  — 是否被地圖選中高亮
 */
export default function PlaceCard({ place, isAiMode = false, onAdd, onHover, isSelected = false }) {
  const typeLabel = (types = []) => {
    const map = {
      tourist_attraction: '景點',
      restaurant: '餐廳',
      cafe: '咖啡廳',
      park: '公園',
      shopping_mall: '購物',
      museum: '博物館',
      amusement_park: '遊樂園',
      art_gallery: '藝廊',
      market: '市場',
      food: '美食',
      coffee_shop: '咖啡',
      national_park: '國家公園',
    };
    for (const t of types) {
      if (map[t]) return map[t];
    }
    return '地點';
  };

  const formatCount = (n) => {
    if (!n) return '';
    if (n >= 10000) return `(${(n / 10000).toFixed(1)}萬+)`;
    if (n >= 1000) return `(${(n / 1000).toFixed(1)}K)`;
    return `(${n})`;
  };

  const photoUrl = buildPhotoUrl(place.photo_ref);

  return (
    <div
      className={`place-card ${isAiMode ? 'ai-mode' : ''} ${isSelected ? 'selected' : ''}`}
      onMouseEnter={() => onHover?.(place)}
      onMouseLeave={() => onHover?.(null)}
    >
      {/* AI 模式頂部漸層邊框條 */}
      {isAiMode && <div className="ai-border-glow" />}

      <div className="place-card-body">
        {/* 縮圖 */}
        <div className="place-thumb">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={place.name}
              className="place-thumb-img"
              onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
            />
          ) : null}
          <div className="place-thumb-fallback" style={{ display: photoUrl ? 'none' : 'flex' }}>
            <ImageOff size={20} />
          </div>
        </div>

        {/* 主要資訊 */}
        <div className="place-info">
          <div className="place-name-row">
            <span className="place-name">{place.name}</span>
            {place.is_open === true && <span className="open-badge">營業中</span>}
            {place.is_open === false && <span className="closed-badge">休息中</span>}
          </div>

          <div className="place-meta">
            <span className="place-type-badge">{typeLabel(place.types)}</span>
            <span className="place-rating">
              <Star size={12} fill="currentColor" />
              {place.rating?.toFixed(1)} {formatCount(place.user_rating_count)}
            </span>
          </div>

          {place.address && (
            <div className="place-address">
              <MapPin size={11} />
              <span>{place.address}</span>
            </div>
          )}

          {/* AI 模式：tags + reason */}
          {isAiMode && (
            <div className="ai-extra">
              {place.tags?.length > 0 && (
                <div className="ai-tags">
                  {place.tags.map((tag, i) => (
                    <span key={i} className="ai-tag">{tag}</span>
                  ))}
                </div>
              )}
              {place.reason && (
                <p className="ai-reason">💡 {place.reason}</p>
              )}
            </div>
          )}
        </div>

        {/* 右側加入按鈕 */}
        <button
          className="add-place-btn"
          onClick={() => onAdd?.(place)}
          title="加入行程"
        >
          <Plus size={18} />
        </button>
      </div>
    </div>
  );
}

