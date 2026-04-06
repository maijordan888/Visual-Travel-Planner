import { useState } from 'react';
import { Search, Map as MapIcon, X, Sparkles, MapPin } from 'lucide-react';
import './MapModal.css';

export default function MapModal({ onClose }) {
  const [searchQuery, setSearchQuery] = useState('');

  // 模擬呼叫 AI 演算後的推薦清單
  const aiRecommendations = [
    { id: 'm1', name: '松山文創園區', rating: 4.5, dur: 120, tag: 'AI 推薦：文青必逛、高度順路' },
    { id: 'm2', name: '台北 101 觀景台', rating: 4.6, dur: 90, tag: 'AI 推薦：無縫銜接下午行程' }
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}><X size={20} /></button>

        <div className="modal-layout">
          {/* 左半部：搜尋列與 AI 推薦名單 */}
          <div className="modal-sidebar">
            <h3 className="modal-title">加入新景點</h3>
            
            <div className="search-box">
              <Search size={18} color="#6b7280" />
              <input 
                type="text" 
                placeholder="輸入景點名稱..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="ai-recommend-section">
              <h4 className="section-title">
                  <Sparkles size={16} color="var(--primary)" /> 
                  AI 智能推薦 (分析起終點沿途)
              </h4>
              <div className="rec-list">
                {aiRecommendations.map(place => (
                  <div key={place.id} className="rec-card">
                    <div className="rec-info">
                      <div className="top-row">
                          <span className="rec-name">{place.name}</span> 
                          <span className="rec-rating">⭐ {place.rating}</span>
                      </div>
                      <span className="rec-tag">{place.tag}</span>
                      <span className="rec-dur">建議停留：{place.dur} 分鐘</span>
                    </div>
                    <button className="btn outline small" onClick={onClose}>加入</button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 右半部：地圖預覽 (Mock Google Maps) */}
          <div className="modal-map-area">
            <div className="mock-map">
               <MapIcon size={48} color="#94a3b8" />
               <p style={{ marginTop: '16px', color: '#64748b', fontWeight: 500 }}>Google Maps 區域</p>
               <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>預期將實時顯示左右測景點的相對座標標記</p>
               
               <div className="mock-pin" style={{ top: '35%', left: '30%' }}><MapPin size={32} color="#fb923c" fill="white"/></div>
               <div className="mock-pin" style={{ top: '65%', left: '70%' }}><MapPin size={32} color="#3b82f6" fill="white"/></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
