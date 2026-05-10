import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { CalendarDays, Cloud, FileText, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { PlacePicker } from '@googlemaps/extended-component-library/react';
import ItineraryNode from './components/ItineraryNode';
import MapModal from './components/MapModal';
import TripLibraryModal from './components/TripLibraryModal';
import TripExportModal from './components/TripExportModal';
import { useTripStore } from './store/useTripStore';

const apiKey =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSy_dummy_key_to_prevent_crash_12345';

// Expose API key for Places Photo URL construction
window.__GOOGLE_MAPS_API_KEY__ = apiKey;

const formatDateTime24 = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

const normalizeTime24Input = (value, fallback = '09:00') => {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return fallback;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

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
  const [isTripExportOpen, setIsTripExportOpen] = useState(false);
  const [isEditingTrip, setIsEditingTrip] = useState(false);
  const [tripDraft, setTripDraft] = useState(null);
  const [tripEditError, setTripEditError] = useState('');
  const [confirmingDeleteDayId, setConfirmingDeleteDayId] = useState(null);
  const [isFloatingDaySwitcherOpen, setIsFloatingDaySwitcherOpen] = useState(false);
  const days = Object.keys(dayConfigs).map(Number).sort((a, b) => a - b);
  const lastNodeRef = useRef(null);
  const prevNodeCountRef = useRef(dailyNodes.length);
  const startPickerRef = useRef(null);
  const endPickerRef = useRef(null);
  const currentTripDraft = tripDraft || { title: tripTitle, start: startDate, end: endDate };

  const [startPickerKey, setStartPickerKey] = useState(Date.now());
  const [endPickerKey, setEndPickerKey] = useState(Date.now() + 1);
  const [isStartFocused, setIsStartFocused] = useState(false);
  const [isEndFocused, setIsEndFocused] = useState(false);
  const tripNodeSummary = useMemo(() => (
    Object.values(nodesByDay).reduce((summary, nodes = []) => {
      nodes.forEach((node) => {
        if (node?.status === 'confirmed') summary.confirmed += 1;
        if (node?.status === 'pending_options') summary.pending += 1;
      });
      return summary;
    }, { confirmed: 0, pending: 0 })
  ), [nodesByDay]);
  const hasLocalChanges = Boolean(
    localLastModifiedUtc
      && (!sheetLastModifiedUtc || new Date(localLastModifiedUtc) > new Date(sheetLastModifiedUtc))
  );
  const syncLabel = sheetLastModifiedUtc
    ? (hasLocalChanges ? '本機有未儲存變更' : '已同步到雲端')
    : '尚未儲存到雲端';

  // Auto-scroll: ?嗆憓?暺??脣??唳?敺憓?蝭暺?
  useEffect(() => {
    if (dailyNodes.length > prevNodeCountRef.current && lastNodeRef.current) {
      lastNodeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    prevNodeCountRef.current = dailyNodes.length;
  }, [dailyNodes.length]);

  // 璅⊥頞?瑼Ｘ璈 (甇方??澆?蝡臬?銝?陛????瞍內)
  // ?交?蝭暺?閮 isWarning = true嚗???臬?????
  const hasOvertimeWarning = dailyNodes.some(n => n.id === 'n2'); // ?ㄐ?急? hardcode 閫貊霅血???隞嗡?閬死撅內

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

  // 暺?憭???? Focus ???憿舐內 Overlay
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.start-picker-container')) setIsStartFocused(false);
      if (!e.target.closest('.end-picker-container')) setIsEndFocused(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ??Focus ?????嚗????PlacePicker ???input
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

  // ??憭拇???蔭 Picker Key 蝣箔?摰??冽?蝛綽?銝虫??? Focus ???
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
      // 3蝘??芸??身蝣箄????
      setTimeout(() => setConfirmingDeleteDayId(null), 3000);
    }
  };

  // ??閮?頛?賢?
  const addMinutesToTime = (timeStr, mins) => {
    const [h, m] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m + mins, 0);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const startEditingTrip = () => {
    setTripDraft({ title: tripTitle, start: startDate, end: endDate });
    setTripEditError('');
    setIsEditingTrip(true);
  };

  const cancelTripEdit = () => {
    setTripDraft(null);
    setTripEditError('');
    setIsEditingTrip(false);
  };

  const applyTripEdit = () => {
    const nextTitle = currentTripDraft.title?.trim() || '未命名行程';
    const nextStart = currentTripDraft.start;
    const nextEnd = currentTripDraft.end;
    if (!nextStart || !nextEnd) {
      setTripEditError('請先選擇開始與結束日期');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextStart) || !/^\d{4}-\d{2}-\d{2}$/.test(nextEnd)) {
      setTripEditError('日期格式請使用 YYYY-MM-DD');
      return;
    }
    if (new Date(nextEnd) < new Date(nextStart)) {
      setTripEditError('結束日期不能早於開始日期');
      return;
    }
    if (nextTitle !== tripTitle) setTripTitle(nextTitle);
    if (nextStart !== startDate || nextEnd !== endDate) setTripDates(nextStart, nextEnd);
    setTripDraft(null);
    setTripEditError('');
    setIsEditingTrip(false);
  };

  const currentTripPayload = useMemo(() => {
    const nodesByDayForExport = Object.fromEntries(
      Object.entries(nodesByDay).map(([day, nodes = []]) => {
        const config = dayConfigs[day] || dayConfigs[Number(day)] || {};
        let refTime = config.startTime || '09:00';
        const enrichedNodes = nodes.map((node) => {
          const transportMins = node.manual_transport_time ?? node.auto_transport_time ?? 0;
          const arrivalTime = addMinutesToTime(refTime, transportMins);
          const stayDuration = node.planned_stay_duration || 0;
          const departureTime = addMinutesToTime(arrivalTime, stayDuration);
          refTime = departureTime;
          return {
            ...node,
            planned_arrival_time: arrivalTime,
            planned_departure_time: departureTime,
            transport_time_mins: transportMins,
          };
        });
        return [day, enrichedNodes];
      })
    );

    return {
      meta: {
        tripId,
        tripTitle,
        startDate,
        endDate,
        localLastModifiedUtc,
        sheetLastModifiedUtc,
      },
      dayConfigs,
      nodesByDay: nodesByDayForExport,
    };
  }, [
    tripId,
    tripTitle,
    startDate,
    endDate,
    localLastModifiedUtc,
    sheetLastModifiedUtc,
    dayConfigs,
    nodesByDay,
  ]);

  // 皜脫???蝞??遘
  let currentRefTime = dayConfig.startTime;
  const nodesWithCalculatedTimes = dailyNodes.map((node, i) => {
    // ??鈭日???(???芸?嚗甈∟??
    const transport = node.manual_transport_time ?? node.auto_transport_time ?? 0;
    const arrivalTime = addMinutesToTime(currentRefTime, transport);
    // ?湔銝???暺?????(?菟? + ??)
    currentRefTime = addMinutesToTime(arrivalTime, node.planned_stay_duration || 0);
    return { ...node, arrivalTime };
  });

  // 閮?蝯??? (?敺???暺蝯?憌臬?)
  const endNodeTransport = dayConfig.endNodeData?.manual_transport_time ?? dayConfig.endNodeData?.auto_transport_time ?? 0;
  const finalEndpointTime = addMinutesToTime(currentRefTime, endNodeTransport);

  return (
    <APIProvider apiKey={apiKey} version="beta" libraries={['places']}>
      <div className="app-container">
        {/* 撌行憭拇撠汗 */}
        <aside className="days-sidebar glass-panel">
          {isEditingTrip ? (
            <div 
              style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  applyTripEdit();
                }
                if (e.key === 'Escape') cancelTripEdit();
              }}
            >
              <input
                type="text"
                autoFocus
                value={currentTripDraft.title}
                onChange={(e) => setTripDraft((prev) => ({
                  ...(prev || currentTripDraft),
                  title: e.target.value,
                }))}
                style={{ width: '100%', padding: '4px' }}
              />
              <div style={{ display: 'flex', gap: '4px' }}>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="YYYY-MM-DD"
                  value={currentTripDraft.start}
                  onChange={(e) => setTripDraft((prev) => ({
                    ...(prev || currentTripDraft),
                    start: e.target.value,
                  }))}
                  style={{ width: '50%', padding: '4px' }}
                />
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="YYYY-MM-DD"
                  value={currentTripDraft.end}
                  onChange={(e) => setTripDraft((prev) => ({
                    ...(prev || currentTripDraft),
                    end: e.target.value,
                  }))}
                  style={{ width: '50%', padding: '4px' }}
                />
              </div>
              {tripEditError && <p className="trip-edit-error">{tripEditError}</p>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <button className="btn outline" onClick={cancelTripEdit} style={{ justifyContent: 'center', padding: '8px 10px' }}>取消</button>
                <button className="btn primary" onClick={applyTripEdit} style={{ justifyContent: 'center', padding: '8px 10px' }}>套用</button>
              </div>
            </div>
          ) : (
            <div style={{ cursor: 'pointer', padding: '4px', borderRadius: '8px', transition: 'background 0.2s', ':hover': { background: 'rgba(255,255,255,0.1)' } }} onClick={startEditingTrip} title="暺?蝺刻摩銵?鞈?">
              <h2 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>{tripTitle}</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>{startDate} ~ {endDate}</p>
            </div>
          )}

          <button className="btn outline sidebar-action" onClick={() => setIsTripLibraryOpen(true)}>
            <Cloud size={16} /> 行程庫
          </button>
          <button className="btn outline sidebar-action" onClick={() => setIsTripExportOpen(true)}>
            <FileText size={16} /> 匯出行程
          </button>

          {days.map(day => (
            <div
              key={day}
              className={`day-tab ${activeDay === day ? 'active' : ''}`}
              onClick={() => setActiveDay(day)}
            >
              <span>Day {day}</span>
              {days.length > 1 && (
                <button
                  className={`day-delete-btn ${confirmingDeleteDayId === day ? 'confirming' : ''}`}
                  onClick={(e) => handleDeleteDay(e, day)}
                  title={confirmingDeleteDayId === day ? "暺??活蝣箄??芷" : `?芷 Day ${day}`}
                >
                  {confirmingDeleteDayId === day ? <span style={{ fontSize: '10px', fontWeight: 'bold' }}>確認</span> : <Trash2 size={14} />}
                </button>
              )}
            </div>
          ))}

          <button className="btn outline sidebar-action" onClick={() => {
            const currentEnd = new Date(endDate);
            currentEnd.setDate(currentEnd.getDate() + 1);
            setTripDates(startDate, currentEnd.toISOString().split('T')[0]);
          }}>
            <Plus size={16} /> 新增一天
          </button>
          <button className="btn sidebar-action new-trip-action" onClick={() => {
            createNewTrip();
            setTripDraft(null);
            setTripEditError('');
            setIsEditingTrip(true);
          }}>
            新建行程
          </button>

          <section className={`trip-sync-card ${hasLocalChanges ? 'dirty' : ''}`}>
            <div className="trip-sync-heading">
              <Cloud size={17} />
              <span>{syncLabel}</span>
            </div>
            <dl>
              <div>
                <dt>行程 ID</dt>
                <dd>{tripId}</dd>
              </div>
              <div>
                <dt>景點</dt>
                <dd>{tripNodeSummary.confirmed} 已確認 / {tripNodeSummary.pending} 待決定</dd>
              </div>
              <div>
                <dt>雲端時間</dt>
                <dd>{sheetLastModifiedUtc ? formatDateTime24(sheetLastModifiedUtc) : '尚未儲存'}</dd>
              </div>
            </dl>
            <button className="btn primary trip-sync-save" onClick={() => setIsTripLibraryOpen(true)}>
              <Cloud size={16} /> 儲存 / 載入
            </button>
          </section>
        </aside>

        {/* ?喳銝餌??*/}
        <main className="main-content">
          {/* 瘥?箇?閮剖? */}
          <section className="day-config-section glass-panel">
            <div className="input-group start-picker-container">
              <label>起點</label>
              <div className="place-picker-wrapper">
                <div style={{ display: (!dayConfig.startLocation || isStartFocused) ? 'block' : 'none' }}>
                  <PlacePicker
                    key={`start-${startPickerKey}`}
                    ref={startPickerRef}
                    onPlaceChange={handleStartPlaceChange}
                    placeholder="搜尋起點..."
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
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{1,2}:[0-9]{2}"
                placeholder="09:00"
                value={dayConfig.startTime}
                onChange={(e) => setDayConfig({ startTime: e.target.value })}
                onBlur={(e) => setDayConfig({
                  startTime: normalizeTime24Input(e.target.value, dayConfig.startTime || '09:00'),
                })}
              />
            </div>
            <div className="input-group end-picker-container">
              <label>終點</label>
              <div className="place-picker-wrapper">
                <div style={{ display: (!dayConfig.endLocation || isEndFocused) ? 'block' : 'none' }}>
                  <PlacePicker
                    key={`end-${endPickerKey}`}
                    ref={endPickerRef}
                    onPlaceChange={handleEndPlaceChange}
                    placeholder="搜尋終點..."
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
              <label>最晚回程</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{1,2}:[0-9]{2}"
                placeholder="22:00"
                value={dayConfig.maxReturnTime}
                onChange={(e) => setDayConfig({ maxReturnTime: e.target.value })}
                onBlur={(e) => setDayConfig({
                  maxReturnTime: normalizeTime24Input(e.target.value, dayConfig.maxReturnTime || '22:00'),
                })}
              />
            </div>
            <div className="input-group" style={{ flex: '0.5', alignItems: 'center' }}>
              <label>API 自動更新</label>
              <span style={{ cursor: 'pointer', color: dayConfig.autoUpdate ? 'var(--primary)' : '#9ca3af' }}
                onClick={() => setDayConfig({ autoUpdate: !dayConfig.autoUpdate })}>
                {dayConfig.autoUpdate ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
              </span>
            </div>
          </section>

          {/* ??頠貉?蝔?*/}
          <section className={`itinerary-timeline glass-panel ${hasOvertimeWarning ? 'timeline-overtime-warning' : ''}`}>
            {hasOvertimeWarning && (
              <div className="global-warning-banner">
                ?? 銵?蝮賣???質??粹??蝺?隢矽?湔暺????? (API ?芸??湔???岫蝞?閫貊甇方郎??
              </div>
            )}

            <div className="node-connector"></div>

            <div style={{ position: 'relative', marginBottom: '64px' }}>
              <ItineraryNode
                isStartEndpoint
                nodeTitle={dayConfig.startLocation}
                time={dayConfig.startTime}
                nodeData={{
                  id: 'START_NODE',
                  status: 'confirmed',
                  selected_place_name: dayConfig.startLocation,
                  notes: dayConfig.startNotes || '',
                }}
                onNotesChange={(notes) => setDayConfig({ startNotes: notes })}
              />
              <div style={{ position: 'absolute', bottom: '-32px', left: '86px', transform: 'translateX(-50%)', zIndex: 10 }}>
                <button onClick={() => useTripStore.getState().insertEmptyNode('START')} className="btn small outline" style={{ borderRadius: '50%', padding: '4px', background: 'white', border: '1px solid var(--primary)', color: 'var(--primary)' }} title="新增第一個景點">
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {nodesWithCalculatedTimes.map((node, i) => {
              // ?曉????暺??啣??其? AI ?刻銝???
              const prevPlace = i === 0 ? dayConfig.startLocation : (nodesWithCalculatedTimes[i - 1].selected_place_name || '上一個景點');
              const nextPlace = dayConfig.endLocation;

              return (
                <div key={node.id} style={{ position: 'relative', marginBottom: '64px' }} ref={i === nodesWithCalculatedTimes.length - 1 ? lastNodeRef : null}>
                  <ItineraryNode
                    nodeData={node}
                    time={node.arrivalTime} // ?喲?閮??箇???
                    prevNodeName={prevPlace}
                    onOpenModal={() => setIsModalOpen({ nodeId: node.id, prevPlace, nextPlace })}
                    isOvertime={hasOvertimeWarning && i === 1} // 璅⊥頞?蝭暺?
                  />
                  <div style={{ position: 'absolute', bottom: '-32px', left: '86px', transform: 'translateX(-50%)', zIndex: 10 }}>
                    <button onClick={() => useTripStore.getState().insertEmptyNode(node.id)} className="btn small outline" style={{ borderRadius: '50%', padding: '4px', background: 'white', border: '1px solid var(--primary)', color: 'var(--primary)' }} title="在後面新增景點">
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
                time={finalEndpointTime} // ?喲???閮???蝔???
                nodeData={{
                   id: 'END_NODE',
                   status: 'confirmed',
                   selected_place_name: dayConfig.endLocation,
                   transport_mode: dayConfig.endNodeData?.transport_mode || 'transit',
                   manual_transport_time: dayConfig.endNodeData?.manual_transport_time || null,
                   auto_transport_time: dayConfig.endNodeData?.auto_transport_time || null,
                   notes: dayConfig.endNotes || '',
                }}
                prevNodeName={nodesWithCalculatedTimes.length > 0 ? nodesWithCalculatedTimes[nodesWithCalculatedTimes.length - 1].selected_place_name : dayConfig.startLocation}
                onNotesChange={(notes) => setDayConfig({ endNotes: notes })}
              />
            </div>
          </section>
        </main>
      </div>

      <div className={`floating-day-switcher ${isFloatingDaySwitcherOpen ? 'open' : ''}`}>
        {isFloatingDaySwitcherOpen && (
          <div className="floating-day-menu glass-panel" role="menu" aria-label="切換行程天數">
            {days.map(day => (
              <button
                key={day}
                type="button"
                className={`floating-day-option ${activeDay === day ? 'active' : ''}`}
                onClick={() => {
                  setActiveDay(day);
                  setIsFloatingDaySwitcherOpen(false);
                }}
                role="menuitem"
              >
                Day {day}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          className="floating-day-trigger"
          onClick={() => setIsFloatingDaySwitcherOpen((isOpen) => !isOpen)}
          aria-expanded={isFloatingDaySwitcherOpen}
          aria-label="開啟天數切換"
        >
          <CalendarDays size={18} />
          <span>Day {activeDay}</span>
        </button>
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
      <TripExportModal
        isOpen={isTripExportOpen}
        onClose={() => setIsTripExportOpen(false)}
        currentTrip={currentTripPayload}
        onImported={(tripData) => {
          loadTripFromArchive(tripData);
        }}
      />
    </APIProvider>
  );
}
