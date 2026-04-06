import { useState } from 'react';
import { Plus, ToggleLeft, ToggleRight } from 'lucide-react';
import ItineraryNode from './components/ItineraryNode';
import MapModal from './components/MapModal';
import { useTripStore } from './store/useTripStore';

export default function App() {
  const { activeDay, setActiveDay, dayConfig, setDayConfig, dailyNodes } = useTripStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const days = [1, 2, 3];

  // 模擬超時檢查機制 (此處於前端做一個簡化的運算演示)
  // 若某節點標記為 isWarning = true，整列背景將有變化
  const hasOvertimeWarning = dailyNodes.some(n => n.id === 'n2'); // 這裡暫時 hardcode 觸發警告的條件供視覺展示

  return (
    <>
      <div className="app-container">
        {/* 左方天數導覽 */}
        <aside className="days-sidebar glass-panel">
          <h2 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>Trip to Taipei</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>2026-10-10 ~ 2026-10-12</p>
          
          {days.map(day => (
            <div 
              key={day}
              className={`day-tab ${activeDay === day ? 'active' : ''}`}
              onClick={() => setActiveDay(day)}
            >
              Day {day} • 行程安排
            </div>
          ))}
          
          <button className="btn outline" style={{ marginTop: 'auto', justifyContent: 'center' }}>
            <Plus size={16} /> 新增一天
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
            
            <ItineraryNode 
              isStartEndpoint 
              nodeTitle={dayConfig.startLocation} 
              time={dayConfig.startTime} 
            />

            {dailyNodes.map((node, i) => (
               <ItineraryNode 
                 key={node.id}
                 nodeData={node}
                 onOpenModal={() => setIsModalOpen(true)}
                 isOvertime={hasOvertimeWarning && i === 1} // 模擬超時節點
               />
            ))}

            <ItineraryNode 
              isEndEndpoint 
              nodeTitle={dayConfig.endLocation} 
              time="22:30" 
            />
          </section>
        </main>
      </div>

      {isModalOpen && <MapModal onClose={() => setIsModalOpen(false)} />}
    </>
  );
}
