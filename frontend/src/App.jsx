import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Cloud, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { PlacePicker } from '@googlemaps/extended-component-library/react';
import ItineraryNode from './components/ItineraryNode';
import MapModal from './components/MapModal';
import TripLibraryModal from './components/TripLibraryModal';
import { useTripStore } from './store/useTripStore';

const apiKey =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSy_dummy_key_to_prevent_crash_12345';

// Expose API key for Places Photo URL construction
window.__GOOGLE_MAPS_API_KEY__ = apiKey;

export default function App() {
  const {
    activeDay, setActiveDay, setDayConfig, nodesByDay,
    tripTitle, setTripTitle, startDate, endDate, setTripDates, createNewTrip, dayConfigs,
    removeDay, tripId, localLastModifiedUtc, sheetLastModifiedUtc,
    setSheetLastModified, loadTripFromArchive
  } = useTripStore();
  const dailyNodes = nodesByDay[activeDay] || [];
  const dayConfig = dayConfigs[activeDay] || dayConfigs[1];
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTripLibraryOpen, setIsTripLibraryOpen] = useState(false);
  const [isEditingTrip, setIsEditingTrip] = useState(false);
  const [confirmingDeleteDayId, setConfirmingDeleteDayId] = useState(null);
  const days = Object.keys(dayConfigs).map(Number).sort((a, b) => a - b);
  const lastNodeRef = useRef(null);
  const prevNodeCountRef = useRef(dailyNodes.length);
  const startPickerRef = useRef(null);
  const endPickerRef = useRef(null);

  const [startPickerKey, setStartPickerKey] = useState(Date.now());
  const [endPickerKey, setEndPickerKey] = useState(Date.now() + 1);
  const [isStartFocused, setIsStartFocused] = useState(false);
  const [isEndFocused, setIsEndFocused] = useState(false);

  const currentTripPayload = useMemo(() => ({
    meta: {
      tripId,
      tripTitle,
      startDate,
      endDate,
      localLastModifiedUtc,
      sheetLastModifiedUtc,
    },
    dayConfigs,
    nodesByDay,
  }), [
    tripId,
    tripTitle,
    startDate,
    endDate,
    localLastModifiedUtc,
    sheetLastModifiedUtc,
    dayConfigs,
    nodesByDay,
  ]);

  // Auto-scroll: 當新增節點後捲動到最後新增的節點
  useEffect(() => {
    if (dailyNodes.length > prevNodeCountRef.current && lastNodeRef.current) {
      lastNodeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    prevNodeCountRef.current = dailyNodes.length;
  }, [dailyNodes.length]);

  // 模擬超時檢查機制 (此處於前端做一個簡化的運算演示)
  // 若某節點標記為 isWarning = true，整列背景將有變化
  const hasOvertimeWarning = dailyNodes.some(n => n.id === 'n2'); // 這裡暫時 hardcode 觸發警告的條件供視覺展示

  const handleStartPlaceChange = async () => {
    const place = startPickerRef.current?.value;
    if (place?.displayName) {
      try {
        await place.fetchFields({ fields: ['displayName', 'location'] });
      } catch (e) { console.error(e); }
      const locUpdate = { startLocation: place.displayName };
      if (place.location) {
        locUpdate.startLat = place.location.lat();
        locUpdate.startLng = place.location.lng();
      }
      setDayConfig(locUpdate);
      setStartPickerKey(Date.now()); // Remount to clear internal state
      setIsStartFocused(false); // Show overlay immediately
    }
  };

  const handleEndPlaceChange = async () => {
    const place = endPickerRef.current?.value;
    if (place?.displayName) {
      try {
        await place.fetchFields({ fields: ['displayName', 'location'] });
      } catch (e) { console.error(e); }
      const locUpdate = { endLocation: place.displayName };
      if (place.location) {
        locUpdate.endLat = place.location.lat();
        locUpdate.endLng = place.location.lng();
      }
      setDayConfig(locUpdate);
      setEndPickerKey(Date.now() + 1);
      setIsEndFocused(false);
    }
  };

  // 點擊外部時，關閉 Focus 狀態，顯示 Overlay
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.start-picker-container')) setIsStartFocused(false);
      if (!e.target.closest('.end-picker-container')) setIsEndFocused(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 當 Focus 狀態開啟時，自動聚焦 PlacePicker 的內部 input
  useEffect(() => {
    if (isStartFocused && startPickerRef.current) {
      setTimeout(() => startPickerRef.current.shadowRoot?.querySelector('input')?.focus(), 50);
    }
  }, [isStartFocused]);

  useEffect(() => {
    if (isEndFocused && endPickerRef.current) {
      setTimeout(() => endPickerRef.current.shadowRoot?.querySelector('input')?.focus(), 50);
    }
  }, [isEndFocused]);

  // 切換天數時，重置 Picker Key 確保它完全清空，並且取消 Focus 狀態
  useEffect(() => {
    setStartPickerKey(Date.now() + 2);
    setEndPickerKey(Date.now() + 3);
    setIsStartFocused(false);
    setIsEndFocused(false);
  }, [activeDay]);

  const handleDeleteDay = (e, day) => {
    e.stopPropagation();
    if (days.length <= 1) return;

    if (confirmingDeleteDayId === day) {
      removeDay(day);
      setConfirmingDeleteDayId(null);
    } else {
      setConfirmingDeleteDayId(day);
      // 3秒後自動重設確認狀態
      setTimeout(() => setConfirmingDeleteDayId(null), 3000);
    }
  };

  // 時間計算輔助函式
  const addMinutesToTime = (timeStr, mins) => {
    const [h, m] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m + mins, 0);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  // 渲染時計算時間軸
  let currentRefTime = dayConfig.startTime;
  const nodesWithCalculatedTimes = dailyNodes.map((node, i) => {
    // 取得交通時間 (手動優先，其次自動)
    const transport = node.manual_transport_time ?? node.auto_transport_time ?? 0;
    const arrivalTime = addMinutesToTime(currentRefTime, transport);
    // 更新下一個節點的參考時間 (抵達 + 停留)
    currentRefTime = addMinutesToTime(arrivalTime, node.planned_stay_duration || 0);
    return { ...node, arrivalTime };
  });

  // 計算終點時間 (最後一個節點到終點飯店)
  const endNodeTransport = dayConfig.endNodeData?.manual_transport_time ?? dayConfig.endNodeData?.auto_transport_time ?? 0;
  const finalEndpointTime = addMinutesToTime(currentRefTime, endNodeTransport);

  return (
    <APIProvider apiKey={apiKey} version="beta" libraries={['places']}>
      <div className="app-container">
        {/* 左方天數導覽 */}
        <aside className="days-sidebar glass-panel">
          {isEditingTrip ? (
            <div 
              style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}
              onBlur={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) {
                  setIsEditingTrip(false);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setIsEditingTrip(false);
                }
              }}
            >
              <input
                type="text"
                autoFocus
                value={tripTitle}
                onChange={(e) => setTripTitle(e.target.value)}
                style={{ width: '100%', padding: '4px' }}
              />
              <div style={{ display: 'flex', gap: '4px' }}>
                <input
                  type="date"
                  value={startDate}
                  max={endDate}
                  onChange={(e) => setTripDates(e.target.value, endDate)}
                  style={{ width: '50%', padding: '4px' }}
                />
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setTripDates(startDate, e.target.value)}
                  style={{ width: '50%', padding: '4px' }}
                />
              </div>
              <button className="btn outline" onClick={() => setIsEditingTrip(false)} style={{ width: '100%', justifyContent: 'center' }}>完成編輯</button>
            </div>
          ) : (
            <div style={{ cursor: 'pointer', padding: '4px', borderRadius: '8px', transition: 'background 0.2s', ':hover': { background: 'rgba(255,255,255,0.1)' } }} onClick={() => setIsEditingTrip(true)} title="點擊編輯行程資訊">
              <h2 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>{tripTitle}</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>{startDate} ~ {endDate}</p>
            </div>
          )}

          {days.map(day => (
            <div
              key={day}
              className={`day-tab ${activeDay === day ? 'active' : ''}`}
              onClick={() => setActiveDay(day)}
            >
              <span>Day {day} • 行程安排</span>
              {days.length > 1 && (
                <button
                  className={`day-delete-btn ${confirmingDeleteDayId === day ? 'confirming' : ''}`}
                  onClick={(e) => handleDeleteDay(e, day)}
                  title={confirmingDeleteDayId === day ? "點擊再次確認刪除" : `刪除 Day ${day}`}
                >
                  {confirmingDeleteDayId === day ? <span style={{ fontSize: '10px', fontWeight: 'bold' }}>確定？</span> : <Trash2 size={14} />}
                </button>
              )}
            </div>
          ))}

          <button className="btn outline" style={{ marginTop: 'auto', justifyContent: 'center', marginBottom: '8px' }} onClick={() => {
            const currentEnd = new Date(endDate);
            currentEnd.setDate(currentEnd.getDate() + 1);
            setTripDates(startDate, currentEnd.toISOString().split('T')[0]);
          }}>
            <Plus size={16} /> 新增一天
          </button>
          <button className="btn outline" style={{ justifyContent: 'center', marginBottom: '8px' }} onClick={() => setIsTripLibraryOpen(true)}>
            <Cloud size={16} /> 行程庫
          </button>
          <button className="btn" style={{ justifyContent: 'center', background: 'var(--primary)', color: '#fff' }} onClick={() => {
            createNewTrip();
            setIsEditingTrip(true);
          }}>
            新建行程
          </button>
        </aside>

        {/* 右側主畫面 */}
        <main className="main-content">
          {/* 每日基礎設定 */}
          <section className="day-config-section glass-panel">
            <div className="input-group start-picker-container">
              <label>出發地</label>
              <div className="place-picker-wrapper">
                <div style={{ display: (!dayConfig.startLocation || isStartFocused) ? 'block' : 'none' }}>
                  <PlacePicker
                    key={`start-${startPickerKey}`}
                    ref={startPickerRef}
                    onPlaceChange={handleStartPlaceChange}
                    placeholder="搜尋出發地點..."
                    style={{ width: '100%', border: 'none', background: 'transparent' }}
                  />
                </div>
                {dayConfig.startLocation && !isStartFocused && (
                  <div
                    className="place-picker-overlay"
                    onClick={() => setIsStartFocused(true)}
                  >
                    {dayConfig.startLocation}
                  </div>
                )}
              </div>
            </div>
            <div className="input-group">
              <label>出發時間</label>
              <input type="time" value={dayConfig.startTime} onChange={(e) => setDayConfig({ startTime: e.target.value })} />
            </div>
            <div className="input-group end-picker-container">
              <label>回程地 (飯店)</label>
              <div className="place-picker-wrapper">
                <div style={{ display: (!dayConfig.endLocation || isEndFocused) ? 'block' : 'none' }}>
                  <PlacePicker
                    key={`end-${endPickerKey}`}
                    ref={endPickerRef}
                    onPlaceChange={handleEndPlaceChange}
                    placeholder="搜尋回程地點..."
                    style={{ width: '100%', border: 'none', background: 'transparent' }}
                  />
                </div>
                {dayConfig.endLocation && !isEndFocused && (
                  <div
                    className="place-picker-overlay"
                    onClick={() => setIsEndFocused(true)}
                  >
                    {dayConfig.endLocation}
                  </div>
                )}
              </div>
            </div>
            <div className="input-group" style={{ flex: '0.8' }}>
              <label>防呆時間底線</label>
              <input type="time" value={dayConfig.maxReturnTime} onChange={(e) => setDayConfig({ maxReturnTime: e.target.value })} />
            </div>
            <div className="input-group" style={{ flex: '0.5', alignItems: 'center' }}>
              <label>API 即時更新</label>
              <span style={{ cursor: 'pointer', color: dayConfig.autoUpdate ? 'var(--primary)' : '#9ca3af' }}
                onClick={() => setDayConfig({ autoUpdate: !dayConfig.autoUpdate })}>
                {dayConfig.autoUpdate ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
              </span>
            </div>
          </section>

          {/* 時間軸行程 */}
          <section className={`itinerary-timeline glass-panel ${hasOvertimeWarning ? 'timeline-overtime-warning' : ''}`}>
            {hasOvertimeWarning && (
              <div className="global-warning-banner">
                ⚠️ 行程總時間可能超出防呆底線，請調整景點停留時間！ (API 自動更新或手動試算後觸發此警告)
              </div>
            )}

            <div className="node-connector"></div>

            <div style={{ position: 'relative', marginBottom: '64px' }}>
              <ItineraryNode
                isStartEndpoint
                nodeTitle={dayConfig.startLocation}
                time={dayConfig.startTime}
              />
              <div style={{ position: 'absolute', bottom: '-32px', left: '86px', transform: 'translateX(-50%)', zIndex: 10 }}>
                <button onClick={() => useTripStore.getState().insertEmptyNode('START')} className="btn small outline" style={{ borderRadius: '50%', padding: '4px', background: 'white', border: '1px solid var(--primary)', color: 'var(--primary)' }} title="新增第一站">
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {nodesWithCalculatedTimes.map((node, i) => {
              // 找出前一個節點的地名用作 AI 推薦上下文
              const prevPlace = i === 0 ? dayConfig.startLocation : (nodesWithCalculatedTimes[i - 1].selected_place_name || "上一個景點");
              const nextPlace = dayConfig.endLocation;

              return (
                <div key={node.id} style={{ position: 'relative', marginBottom: '64px' }} ref={i === nodesWithCalculatedTimes.length - 1 ? lastNodeRef : null}>
                  <ItineraryNode
                    nodeData={node}
                    time={node.arrivalTime} // 傳遞計算出的時間
                    prevNodeName={prevPlace}
                    onOpenModal={() => setIsModalOpen({ nodeId: node.id, prevPlace, nextPlace })}
                    isOvertime={hasOvertimeWarning && i === 1} // 模擬超時節點
                  />
                  <div style={{ position: 'absolute', bottom: '-32px', left: '86px', transform: 'translateX(-50%)', zIndex: 10 }}>
                    <button onClick={() => useTripStore.getState().insertEmptyNode(node.id)} className="btn small outline" style={{ borderRadius: '50%', padding: '4px', background: 'white', border: '1px solid var(--primary)', color: 'var(--primary)' }} title="新增下一站">
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              )
            })}

            <div style={{ marginTop: '24px' }}>
              <ItineraryNode 
                isEndEndpoint 
                nodeTitle={dayConfig.endLocation} 
                time={finalEndpointTime} // 傳遞動態計算的回程時間
                nodeData={{
                   id: 'END_NODE',
                   status: 'confirmed',
                   selected_place_name: dayConfig.endLocation,
                   transport_mode: dayConfig.endNodeData?.transport_mode || 'transit',
                   manual_transport_time: dayConfig.endNodeData?.manual_transport_time || null,
                   auto_transport_time: dayConfig.endNodeData?.auto_transport_time || null
                }}
                prevNodeName={nodesWithCalculatedTimes.length > 0 ? nodesWithCalculatedTimes[nodesWithCalculatedTimes.length - 1].selected_place_name : dayConfig.startLocation}
              />
            </div>
          </section>
        </main>
      </div>

      {isModalOpen && (
        <MapModal
          onClose={() => setIsModalOpen(false)}
          prevPlace={isModalOpen.prevPlace}
          nextPlace={isModalOpen.nextPlace}
          onAddNode={(place) => {
            useTripStore.getState().addOptionToNode(isModalOpen.nodeId, place);
            setIsModalOpen(false);
          }}
        />
      )}

      <TripLibraryModal
        isOpen={isTripLibraryOpen}
        onClose={() => setIsTripLibraryOpen(false)}
        currentTrip={currentTripPayload}
        onExported={(result) => {
          const lastModifiedUtc = result?.last_modified_utc || result?.lastModifiedUtc;
          if (lastModifiedUtc) {
            setSheetLastModified(lastModifiedUtc);
          }
        }}
        onImported={(tripData) => {
          loadTripFromArchive(tripData);
        }}
      />
    </APIProvider>
  );
}
