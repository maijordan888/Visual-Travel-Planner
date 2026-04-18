import { create } from 'zustand';

const initialNodes1 = [
  {
    id: 'n1',
    status: 'confirmed',
    selected_place_name: '台北市立動物園',
    planned_stay_duration: 180,
    transport_mode: 'transit',
    rating: 4.6,
    options: []
  },
  {
    id: 'n2',
    status: 'pending_options',
    selected_place_name: '',
    planned_stay_duration: 0,
    transport_mode: 'transit',
    rating: 0,
    options: [
      { id: 'opt1', name: '饒河街夜市', durationMins: 120, rating: 4.3 },
      { id: 'opt2', name: '寧夏夜市', durationMins: 90, rating: 4.5 }
    ]
  }
];

const initialNodes2 = [
  {
    id: 'n3',
    status: 'confirmed',
    selected_place_name: '台北 101',
    planned_stay_duration: 120,
    transport_mode: 'transit',
    rating: 4.8,
    options: []
  }
];

export const useTripStore = create((set, get) => ({
  tripTitle: 'Trip to Taipei',
  startDate: '2026-10-10',
  endDate: '2026-10-12',
  activeDay: 1,
  
  dayConfigs: {
    1: {
      startLocation: '台北萬豪酒店',
      endLocation: '台北萬豪酒店',
      startTime: '09:00',
      maxReturnTime: '22:00',
      autoUpdate: true
    },
    2: {
      startLocation: '圓山大飯店',
      endLocation: '圓山大飯店',
      startTime: '10:00',
      maxReturnTime: '21:00',
      autoUpdate: true
    },
    3: {
      startLocation: '圓山大飯店',
      endLocation: '台北車站',
      startTime: '09:00',
      maxReturnTime: '18:00',
      autoUpdate: true
    }
  },

  nodesByDay: {
    1: initialNodes1,
    2: initialNodes2,
    3: []
  },

  // NOTE: dailyNodes 和 dayConfig 不再用 getter，改在 App.jsx 直接計算
  // Zustand 的 Object.assign 會把 getter 變成靜態值導致 state 不更新

  setActiveDay: (day) => set({ activeDay: day }),

  setTripTitle: (title) => set({ tripTitle: title }),
  
  setTripDates: (start, end) => set((state) => {
    if (!start || !end) return { startDate: start, endDate: end };
    
    const d1 = new Date(start);
    const d2 = new Date(end);
    if (d2 < d1) return { startDate: start, endDate: start }; // 防止結束日早於開始日
    
    const diffTime = Math.abs(d2 - d1);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    const newDayConfigs = {};
    const newNodesByDay = {};
    for (let i = 1; i <= diffDays; i++) {
        newDayConfigs[i] = state.dayConfigs[i] || {
            startLocation: '自訂起點',
            endLocation: '自訂終點',
            startTime: '09:00',
            maxReturnTime: '22:00',
            autoUpdate: true
        };
        newNodesByDay[i] = state.nodesByDay[i] || [];
    }

    return {
      startDate: start,
      endDate: end,
      dayConfigs: newDayConfigs,
      nodesByDay: newNodesByDay,
      activeDay: state.activeDay > diffDays ? 1 : state.activeDay // 防止 activeDay 超出範圍
    };
  }),

  createNewTrip: () => {
    const today = new Date().toISOString().split('T')[0];
    set({
      tripTitle: 'New Itinerary',
      startDate: today,
      endDate: today,
      activeDay: 1,
      dayConfigs: {
        1: {
          startLocation: '',
          endLocation: '',
          startTime: '09:00',
          maxReturnTime: '22:00',
          autoUpdate: true
        }
      },
      nodesByDay: {
        1: []
      }
    });
  },

  setDayConfig: (config) => set((state) => ({
    dayConfigs: {
      ...state.dayConfigs,
      [state.activeDay]: { ...state.dayConfigs[state.activeDay], ...config }
    }
  })),

  // 動作：更新某個節點的停留時間或交通方式
  updateNode: (id, updates) => set((state) => {
    const list = state.nodesByDay[state.activeDay] || [];
    return {
      nodesByDay: {
        ...state.nodesByDay,
        [state.activeDay]: list.map(n => n.id === id ? { ...n, ...updates } : n)
      }
    };
  }),

  // 動作：從備選項中「確認採用」
  confirmOption: (nodeId, optionId) => set((state) => {
    const list = state.nodesByDay[state.activeDay] || [];
    return {
      nodesByDay: {
        ...state.nodesByDay,
        [state.activeDay]: list.map(n => {
          if(n.id === nodeId) {
            const selected = n.options.find(o => o.id === optionId);
            return {
              ...n,
              status: 'confirmed',
              selected_place_name: selected.name,
              planned_stay_duration: selected.durationMins,
              rating: selected.rating
            };
          }
          return n;
        })
      }
    };
  }),

  // 動作：移除備選項
  removeOption: (nodeId, optionId) => set((state) => {
    const list = state.nodesByDay[state.activeDay] || [];
    return {
      nodesByDay: {
        ...state.nodesByDay,
        [state.activeDay]: list.map(n => {
          if(n.id === nodeId) {
            return {
              ...n,
              options: n.options.filter(o => o.id !== optionId)
            };
          }
          return n;
        })
      }
    };
  }),

  // 動作：從 AI 或地圖彈跳視窗新增點 (改為自動確認，舊的變備選)
  addOptionToNode: (nodeId, place) => set((state) => {
    const list = state.nodesByDay[state.activeDay] || [];
    return {
      nodesByDay: {
        ...state.nodesByDay,
        [state.activeDay]: list.map(n => {
          if(n.id === nodeId) {
            const oldOptions = [...n.options];
            if (n.status === 'confirmed' && n.selected_place_name) {
               if (!oldOptions.find(o => o.name === n.selected_place_name)) {
                   oldOptions.push({
                       id: `opt_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,
                       name: n.selected_place_name,
                       durationMins: n.planned_stay_duration,
                       rating: n.rating
                   });
               }
            }
            return {
              ...n,
              status: 'confirmed',
              selected_place_name: place.name || place.selected_place_name,
              planned_stay_duration: place.durationMins || place.planned_stay_duration || 60,
              rating: place.rating || 0,
              options: oldOptions
            };
          }
          return n;
        })
      }
    };
  }),

  // 動作：新增空的待決定節點
  insertEmptyNode: (afterNodeId) => set((state) => {
    const list = state.nodesByDay[state.activeDay] || [];
    const newNode = {
      id: `n_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,
      status: 'pending_options',
      selected_place_name: '',
      planned_stay_duration: 60,
      transport_mode: 'transit',
      rating: 0,
      options: []
    };
    let newList = [...list];
    if (afterNodeId === 'START') {
        newList.unshift(newNode);
    } else if (afterNodeId) {
        const idx = list.findIndex(n => n.id === afterNodeId);
        if (idx !== -1) {
            newList.splice(idx + 1, 0, newNode);
        } else {
            newList.push(newNode);
        }
    } else {
        newList.push(newNode);
    }
    return {
      nodesByDay: {
        ...state.nodesByDay,
        [state.activeDay]: newList
      }
    };
  }),

  // 動作：移除整個行程節點
  removeNode: (nodeId) => set((state) => {
    const list = state.nodesByDay[state.activeDay] || [];
    return {
      nodesByDay: {
        ...state.nodesByDay,
        [state.activeDay]: list.filter(n => n.id !== nodeId)
      }
    };
  })
}));
