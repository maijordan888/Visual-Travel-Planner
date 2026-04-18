import { useState } from 'react';
import { Plus, ToggleLeft, ToggleRight } from 'lucide-react';
import ItineraryNode from './components/ItineraryNode';
import MapModal from './components/MapModal';
import { useTripStore } from './store/useTripStore';

export default function App() {
  const { 
    activeDay, setActiveDay, setDayConfig, nodesByDay,
    tripTitle, setTripTitle, startDate, endDate, setTripDates, createNewTrip, dayConfigs
  } = useTripStore();
  const dailyNodes = nodesByDay[activeDay] || [];
  const dayConfig = dayConfigs[activeDay] || dayConfigs[1];
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditingTrip, setIsEditingTrip] = useState(false);
  const days = Object.keys(dayConfigs).map(Number).sort((a,b)=>a-b);

  // 模擬超時檢查機制 (此處於前端做一個簡化的運算演示)
  // 若某節點標記為 isWarning = true，整列背景將有變化
  const hasOvertimeWarning = dailyNodes.some(n => n.id === 'n2'); // 這裡暫時 hardcode 觸發警告的條件供視覺展示

  return (
    <>
      <div className="app-container">
        {/* 左方天數導覽 */}
        <aside className="days-sidebar glass-panel">
          {isEditingTrip ? (
            <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input 
                type="text" 
                value={tripTitle} 
                onChange={(e) => setTripTitle(e.target.value)} 
                style={{ width: '100%', padding: '4px' }}
              />
              <div style={{ display: 'flex', gap: '4px' }}>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={(e) => setTripDates(e.target.value, endDate)} 
                  style={{ width: '50%', padding: '4px' }}
                />
                <input 
                  type="date" 
                  value={endDate} 
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
              Day {day} • 行程安排
            </div>
          ))}
          
          <button className="btn outline" style={{ marginTop: 'auto', justifyContent: 'center', marginBottom: '8px' }} onClick={() => {
             const currentEnd = new Date(endDate);
             currentEnd.setDate(currentEnd.getDate() + 1);
             setTripDates(startDate, currentEnd.toISOString().split('T')[0]);
          }}>
            <Plus size={16} /> 新增一天
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
            <div className="input-group">
              <label>出發地</label>
              <input value={dayConfig.startLocation} onChange={(e) => setDayConfig({ startLocation: e.target.value })} />
            </div>
            <div className="input-group">
              <label>出發時間</label>
              <input type="time" value={dayConfig.startTime} onChange={(e) => setDayConfig({ startTime: e.target.value })} />
            </div>
            <div className="input-group">
              <label>回程地 (飯店)</label>
              <input value={dayConfig.endLocation} onChange={(e) => setDayConfig({ endLocation: e.target.value })} />
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
            
            <div style={{ position: 'relative' }}>
              <ItineraryNode 
                isStartEndpoint 
                nodeTitle={dayConfig.startLocation} 
                time={dayConfig.startTime} 
              />
              <div style={{ position: 'absolute', bottom: '-20px', left: '20px', zIndex: 10 }}>
                 <button onClick={() => useTripStore.getState().insertEmptyNode('START')} className="btn small outline" style={{borderRadius: '50%', padding: '4px', background: 'white', border: '1px solid var(--primary)', color: 'var(--primary)'}} title="新增第一站">
                   <Plus size={16} />
                 </button>
              </div>
            </div>

            {dailyNodes.map((node, i) => {
               // 找出前一個節點的地名用作 AI 推薦上下文
               const prevPlace = i === 0 ? dayConfig.startLocation : (dailyNodes[i-1].selected_place_name || "上一個景點");
               const nextPlace = dayConfig.endLocation;

               return (
                 <div key={node.id} style={{ position: 'relative' }}>
                   <ItineraryNode 
                     nodeData={node}
                     onOpenModal={() => setIsModalOpen({ nodeId: node.id, prevPlace, nextPlace })}
                     isOvertime={hasOvertimeWarning && i === 1} // 模擬超時節點
                   />
                   <div style={{ position: 'absolute', bottom: '-40px', left: '44px', zIndex: 10 }}>
                      <button onClick={() => useTripStore.getState().insertEmptyNode(node.id)} className="btn small outline" style={{borderRadius: '50%', padding: '4px', background: 'white', border: '1px solid var(--primary)', color: 'var(--primary)'}} title="新增下一站">
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
                time="22:30" 
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
    </>
  );
}
