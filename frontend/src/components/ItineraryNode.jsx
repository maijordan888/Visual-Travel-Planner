import { useState, useEffect } from 'react';
import { MapPin, Navigation, Car, Bus, Plus, Clock, AlertTriangle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import './ItineraryNode.css';
import { useTripStore } from '../store/useTripStore';
import { api } from '../api';

export default function ItineraryNode({ 
    isStartEndpoint, 
    isEndEndpoint, 
    nodeTitle, 
    time, 
    nodeData,
    prevNodeName,
    onOpenModal,
    isOvertime
}) {
  const [isBackupExpanded, setIsBackupExpanded] = useState(false);
  const [transportTime, setTransportTime] = useState(null);
  const [isLoadingTime, setIsLoadingTime] = useState(false);
  const { updateNode, confirmOption } = useTripStore();

  // 首尾節點
  if (isStartEndpoint || isEndEndpoint) {
    return (
      <div className="itinerary-node endpoint">
        <div className="node-time">{time}</div>
        <div className="node-icon endpoint-icon">
          <MapPin size={20} color="white" />
        </div>
        <div className="node-content">
          <h4 style={{ color: 'var(--text-main)', fontSize: '1.1rem' }}>
            {isStartEndpoint ? '出發：' : '終點：'} {nodeTitle}
          </h4>
        </div>
      </div>
    );
  }

  const { status, selected_place_name, planned_stay_duration, transport_mode, rating, options } = nodeData;

  // 動態計算交通時間：有前一站名稱 + 自己已確認時才呼叫 API
  useEffect(() => {
    if (!prevNodeName || !selected_place_name || status !== 'confirmed') {
      setTransportTime(null);
      return;
    }

    let cancelled = false;
    async function fetchTime() {
      setIsLoadingTime(true);
      try {
        const mins = await api.getDirectionsTime(prevNodeName, selected_place_name, transport_mode);
        if (!cancelled) setTransportTime(mins);
      } catch (e) {
        console.error('Failed to fetch transport time:', e);
        if (!cancelled) setTransportTime(null);
      }
      if (!cancelled) setIsLoadingTime(false);
    }
    fetchTime();
    return () => { cancelled = true; };
  }, [prevNodeName, selected_place_name, transport_mode, status]);

  const handleModeChange = (mode) => updateNode(nodeData.id, { transport_mode: mode });
  const handleDurationChange = (e) => updateNode(nodeData.id, { planned_stay_duration: Number(e.target.value) });

  const renderTransportTime = () => {
    if (isLoadingTime) {
      return (
        <span className="transport-time loading">
          <Loader2 size={14} className="animate-spin" style={{ color: 'var(--primary)', marginRight: 4 }} />
          AI 試算中...
        </span>
      );
    }
    if (transportTime !== null && transportTime > 0) {
      return (
        <span className="transport-time">
          AI 試算時間：{transportTime} 分鐘
          {transport_mode === 'transit' && <span style={{fontSize: '0.8rem', color: 'var(--primary)', marginLeft: 8}}>[變更路線]</span>}
        </span>
      );
    }
    return (
      <span className="transport-time" style={{ opacity: 0.5 }}>
        交通時間待試算
      </span>
    );
  };

  return (
    <div className="itinerary-node animate-slide-down">
      {/* 交通工具切換區 (預設大眾運輸) */}
      <div className="transport-layer">
        <div className="transport-selector">
          <button className={`icon-btn ${transport_mode === 'driving' ? 'active' : ''}`} onClick={() => handleModeChange('driving')}>
            <Car size={16} />
          </button>
          <button className={`icon-btn ${transport_mode === 'transit' ? 'active' : ''}`} onClick={() => handleModeChange('transit')}>
            <Bus size={16} />
          </button>
          {renderTransportTime()}
        </div>
      </div>

      <div className="node-dot"></div>
      
      {/* 節點卡片. 若為備選中，外觀顏色可能不同; 若超時則加上 danger mode */}
      <div className={`node-card ${status === 'pending_options' ? 'pending-mode' : ''} ${isOvertime ? 'danger-mode' : ''}`}>
        
        {/* === 已確認狀態 UI === */}
        {status === 'confirmed' && (
           <>
              <div className="card-header">
                  <h4>{selected_place_name}</h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="rating">⭐ {rating}</div>
                    <button onClick={() => useTripStore.getState().removeNode(nodeData.id)} style={{background: 'transparent', border:'none', cursor:'pointer'}} title="移除此景點">🗑️</button>
                  </div>
              </div>
              <div className="card-details">
                  <div className="duration-edit">
                      <Clock size={16} />
                      <span>設定停留時間：</span>
                      <input type="number" value={planned_stay_duration} onChange={handleDurationChange} className="duration-input" />
                      <span>分鐘</span>
                  </div>
              </div>

              {/* 隱藏的備選清單，允許重新展開 */}
              <button className="toggle-backups-btn" onClick={() => setIsBackupExpanded(!isBackupExpanded)}>
                  {isBackupExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />} 
                  {isBackupExpanded ? '收起備選項' : (options.length > 0 ? `顯示 ${options.length} 個備選方案 (可切換)` : '新增其他備選方案')}
              </button>
              
              {isBackupExpanded && (
                  <div className="backup-list">
                    {options && options.map(opt => (
                        <div key={opt.id} className="backup-item">
                            <div className="info">
                                <span className="name">{opt.name}</span>
                                <span className="sub-info">AI 預設 {opt.durationMins} 分鐘 | ⭐ {opt.rating}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button className="btn outline small" onClick={() => {
                                  confirmOption(nodeData.id, opt.id);
                                  setIsBackupExpanded(false);
                              }}>切換採用</button>
                              <button className="btn outline small" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} 
                               onClick={() => useTripStore.getState().removeOption(nodeData.id, opt.id)}>
                                移除
                              </button>
                            </div>
                        </div>
                    ))}
                    <button className="btn outline full-width add-more" onClick={onOpenModal} style={{ marginTop: '8px' }}>
                        <Plus size={16} /> 開啟地圖/交由 AI 推薦
                    </button>
                  </div>
              )}
           </>
        )}

        {/* === 備選中狀態 UI (Pending Options) === */}
        {status === 'pending_options' && (
           <>
              <div className="card-header pending">
                  <h4 style={{ color: 'var(--text-muted)' }}>📍 待決定目的地...</h4>
                  <button onClick={() => useTripStore.getState().removeNode(nodeData.id)} style={{background: 'transparent', border:'none', cursor:'pointer'}} title="移除此景點">🗑️</button>
              </div>
              <p style={{fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16}}>請從下方備選清單選擇，或呼叫 AI 新增：</p>
              
              <div className="backup-list expanded">
                  {options.map(opt => (
                      <div key={opt.id} className="backup-item pending-item">
                          <div className="info">
                              <span className="name">{opt.name}</span>
                              <span className="sub-info">AI 預估停留 {opt.durationMins} 分鐘 | ⭐ {opt.rating}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn primary small" onClick={() => confirmOption(nodeData.id, opt.id)}>
                               確認並建立節點
                            </button>
                            <button className="btn outline small" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} 
                             onClick={() => useTripStore.getState().removeOption(nodeData.id, opt.id)}>
                              移除
                            </button>
                          </div>
                      </div>
                  ))}
                  <button className="btn outline full-width add-more" onClick={onOpenModal}>
                      <Plus size={16} /> 開啟地圖/交由 AI 推薦
                  </button>
              </div>
           </>
        )}
      </div>
    </div>
  );
}
