import { useState, useEffect } from 'react';
import { MapPin, Navigation, Car, Bus, Plus, Clock, AlertTriangle, ChevronDown, ChevronUp, Loader2, ExternalLink, Edit2, RefreshCcw } from 'lucide-react';
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
  const [transportError, setTransportError] = useState(null);
  const [isLoadingTime, setIsLoadingTime] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const [googleMapsUrl, setGoogleMapsUrl] = useState(null);
  const [isManualMode, setIsManualMode] = useState(!!nodeData?.manual_transport_time);
  const { updateNode, confirmOption } = useTripStore();

  const { 
    status, 
    selected_place_name, 
    planned_stay_duration, 
    transport_mode, 
    rating, 
    options,
    manual_transport_time 
  } = nodeData || {};

  // Helper to sync auto transport time to store
  const syncAutoTime = (val) => {
    if (status === 'confirmed' && nodeData?.auto_transport_time !== val) {
      updateNode(nodeData.id, { auto_transport_time: val });
    }
  };

  // 動態計算交通時間：有前一站名稱 + 自己已確認時才呼叫 API
  useEffect(() => {
    if (!prevNodeName || !selected_place_name || status !== 'confirmed') {
      setTransportTime(null);
      setTransportError(null);
      setIsFallback(false);
      setGoogleMapsUrl(null);
      return;
    }

    let cancelled = false;
    async function fetchTime() {
      setIsLoadingTime(true);
      setTransportError(null);
      setIsFallback(false);
      try {
        const result = await api.getDirectionsTime(prevNodeName, selected_place_name, transport_mode);
        if (cancelled) return;
        if (result.error) {
          setTransportTime(null);
          setTransportError(result.error === 'no_route' ? '找不到路徑' : '試算失敗');
          setGoogleMapsUrl(result.google_maps_url || null);
        } else {
          setTransportTime(result.travel_time_mins);
          setIsFallback(result.is_fallback || false);
          setGoogleMapsUrl(result.google_maps_url || null);
          setTransportError(null);
          syncAutoTime(result.travel_time_mins);
        }
      } catch (e) {
        console.error('Failed to fetch transport time:', e);
        if (!cancelled) {
          setTransportTime(null);
          setTransportError('網路錯誤');
        }
      }
      if (!cancelled) setIsLoadingTime(false);
    }
    fetchTime();
    return () => { cancelled = true; };
  }, [prevNodeName, selected_place_name, transport_mode, status]);

  const handleModeChange = (mode) => updateNode(nodeData.id, { transport_mode: mode });
  const handleDurationChange = (e) => updateNode(nodeData.id, { planned_stay_duration: Number(e.target.value) });
  const handleManualTimeChange = (e) => {
    const val = e.target.value === '' ? null : Number(e.target.value);
    updateNode(nodeData.id, { manual_transport_time: val });
  };
  const toggleManualMode = () => {
    setIsManualMode(!isManualMode);
  };
  const resetToAuto = () => {
    updateNode(nodeData.id, { manual_transport_time: null });
    setIsManualMode(false);
  };

  const renderDeepLink = () => {
    if (!googleMapsUrl) return null;
    return (
      <a
        className="deep-link-btn"
        href={googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="在 Google Maps 查看詳細路線"
      >
        <ExternalLink size={12} />
        查看路線
      </a>
    );
  };

  const renderTransportTime = () => {
    if (isManualMode) {
      return (
        <>
          <div className="manual-time-input-wrapper">
            <span className="manual-label">手動:</span>
            <input 
              type="number" 
              value={manual_transport_time === null ? '' : manual_transport_time} 
              onChange={handleManualTimeChange} 
              className="transport-manual-input"
              placeholder="分鐘"
              autoFocus
            />
            <button className="manual-action-btn" onClick={resetToAuto} title="還原至自動估算">
              <RefreshCcw size={12} />
            </button>
          </div>
          {renderDeepLink()}
        </>
      );
    }

    if (isLoadingTime) {
      return (
        <span className="transport-time loading">
          <Loader2 size={14} className="animate-spin" style={{ color: 'var(--primary)', marginRight: 4 }} />
          AI 試算中...
        </span>
      );
    }
    if (transportError) {
      return (
        <>
          <span className="transport-time" style={{ color: 'var(--danger)', opacity: 0.9 }}>
            ⚠️ {transportError}
          </span>
          <button className="manual-toggle-btn" onClick={toggleManualMode} title="切換為手動輸入">
            <Edit2 size={12} />
          </button>
          {renderDeepLink()}
        </>
      );
    }
    if (transportTime !== null && transportTime >= 0) {
      return (
        <>
          <span className={`transport-time ${isFallback ? 'fallback' : ''}`}>
            {isFallback && <span className="fallback-badge">⚠️ 估算</span>}
            {isFallback ? `約 ${transportTime} 分鐘` : `${transportTime} 分鐘`}
          </span>
          <button className="manual-toggle-btn" onClick={toggleManualMode} title="修正時間">
            <Edit2 size={12} />
          </button>
          {renderDeepLink()}
        </>
      );
    }
    return (
      <>
        <span className="transport-time" style={{ opacity: 0.5 }}>
          交通時間待試算
        </span>
        <button className="manual-toggle-btn" onClick={toggleManualMode} title="手動輸入">
          <Edit2 size={12} />
        </button>
      </>
    );
  };

  return (
    <div className={`itinerary-node ${isStartEndpoint || isEndEndpoint ? 'endpoint-variant' : ''} animate-slide-down`}>
      <div className="node-time">{time}</div>
      
      <div className="node-marker-area">
        {isStartEndpoint || isEndEndpoint ? (
          <div className="endpoint-icon-outer">
             <div className="node-icon endpoint-icon">
                <MapPin size={20} color="white" />
             </div>
          </div>
        ) : (
          <div className="node-dot"></div>
        )}
      </div>

      <div className="node-main-content">
        {/* 交通工具切換區 - 只有非起點節點才有進入交通 */}
        {!isStartEndpoint && (
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
        )}

        {(isStartEndpoint || isEndEndpoint) ? (
          <div className="node-content endpoint-simple-card">
            <h4 style={{ color: 'var(--text-main)', fontSize: '1.1rem', margin: 0 }}>
              {isStartEndpoint ? '出發：' : '終點：'} {nodeTitle}
            </h4>
          </div>
        ) : (
          <div className={`node-card ${status === 'pending_options' ? 'pending-mode' : ''} ${isOvertime ? 'danger-mode' : ''}`}>
            
            {status === 'confirmed' && (
              <>
                  <div className="card-header">
                      {nodeData.photo_url && (
                        <img 
                          className="node-thumbnail" 
                          src={nodeData.photo_url} 
                          alt={selected_place_name}
                          loading="lazy"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      )}
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

                  <button className="toggle-backups-btn" onClick={() => setIsBackupExpanded(!isBackupExpanded)}>
                      {isBackupExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />} 
                      {isBackupExpanded ? '收起備選項' : (options?.length > 0 ? `顯示 ${options.length} 個備選方案 (可切換)` : '新增其他備選方案')}
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

            {status === 'pending_options' && (
              <>
                  <div className="card-header pending">
                      <h4 style={{ color: 'var(--text-muted)' }}>📍 待決定目的地...</h4>
                      <button onClick={() => useTripStore.getState().removeNode(nodeData.id)} style={{background: 'transparent', border:'none', cursor:'pointer'}} title="移除此景點">🗑️</button>
                  </div>
                  <p style={{fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16}}>請從下方備選清單選擇，或呼叫 AI 新增：</p>
                  
                  <div className="backup-list expanded">
                      {options && options.map(opt => (
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
        )}
      </div>
    </div>
  );
}
