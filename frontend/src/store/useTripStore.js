import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const nowUtc = () => new Date().toISOString();

const generateTripId = () => {
  const datePart = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `TRIP_${datePart}_${randomPart}`;
};

const withLocalModified = (updates) => ({
  ...updates,
  localLastModifiedUtc: nowUtc(),
});

const toArray = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
};

const toNullableNumber = (value, fallback = null) => {
  if (value === null || value === undefined || value === '') return fallback;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const isGeneratedOptionId = (id) => typeof id === 'string' && id.startsWith('opt_');

const createPlaceSnapshot = (place = {}, fallback = {}) => ({
  place_id: place.place_id ?? place.selected_place_id ?? (!isGeneratedOptionId(place.id) ? place.id : null) ?? fallback.place_id ?? null,
  name: place.name ?? place.selected_place_name ?? fallback.name ?? '',
  rating: toNullableNumber(place.rating, fallback.rating ?? null),
  address: place.address ?? place.formatted_address ?? place.formattedAddress ?? fallback.address ?? '',
  lat: toNullableNumber(place.lat ?? place.latitude, fallback.lat ?? null),
  lng: toNullableNumber(place.lng ?? place.longitude, fallback.lng ?? null),
  photo_url: place.photo_url ?? fallback.photo_url ?? null,
  types: toArray(place.types ?? fallback.types),
  tags: toArray(place.tags ?? place.tag ?? fallback.tags),
  notes: place.notes ?? fallback.notes ?? '',
});

const snapshotToNodeFields = (snapshot) => ({
  selected_place_id: snapshot.place_id,
  selected_place_name: snapshot.name,
  rating: snapshot.rating ?? 0,
  address: snapshot.address,
  lat: snapshot.lat,
  lng: snapshot.lng,
  photo_url: snapshot.photo_url,
  types: snapshot.types,
  tags: snapshot.tags,
  notes: snapshot.notes,
});

const createOptionFromNode = (node) => {
  const snapshot = createPlaceSnapshot(node);
  return {
    id: `opt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    ...snapshot,
    durationMins: node.planned_stay_duration ?? 60,
    rating: snapshot.rating ?? node.rating ?? 0,
  };
};

const normalizeOption = (option) => {
  const snapshot = createPlaceSnapshot(option);
  return {
    id: option.id || `opt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    ...snapshot,
    durationMins: option.durationMins ?? option.planned_stay_duration ?? 60,
    rating: snapshot.rating ?? option.rating ?? 0,
  };
};

const normalizeNode = (node) => {
  const snapshot = createPlaceSnapshot(node);
  return {
    ...node,
    ...snapshotToNodeFields(snapshot),
    rating: snapshot.rating ?? node.rating ?? 0,
    options: (node.options || []).map(normalizeOption),
  };
};

const normalizeNodesByDay = (nodesByDay = {}) => Object.fromEntries(
  Object.entries(nodesByDay).map(([day, nodes]) => [
    day,
    Array.isArray(nodes) ? nodes.map(normalizeNode) : [],
  ])
);

const hasSamePlace = (a, b) => {
  if (a.place_id && b.place_id) return a.place_id === b.place_id;
  return a.name && b.name && a.name === b.name;
};

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

export const useTripStore = create(
  persist(
    (set, get) => ({
      tripId: generateTripId(),
      tripTitle: '台北城市旅遊',
      startDate: '2026-10-10',
      endDate: '2026-10-12',
      localLastModifiedUtc: nowUtc(),
      sheetLastModifiedUtc: null,
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

      nodesByDay: normalizeNodesByDay({
        1: initialNodes1,
        2: initialNodes2,
        3: []
      }),

      // NOTE: dailyNodes 和 dayConfig 不再用 getter，改在 App.jsx 直接計算
      // Zustand 的 Object.assign 會把 getter 變成靜態值導致 state 不更新

      setActiveDay: (day) => set({ activeDay: day }),

      setTripTitle: (title) => set(withLocalModified({ tripTitle: title })),
      
      setTripDates: (start, end) => set((state) => {
        if (!start || !end) return withLocalModified({ startDate: start, endDate: end });
        
        // 防護: 日期未變則不重算
        if (start === state.startDate && end === state.endDate) return {};
        
        const d1 = new Date(start);
        const d2 = new Date(end);
        if (d2 < d1) return withLocalModified({ startDate: start, endDate: start }); // 防止結束日早於開始日
        
        const diffTime = Math.abs(d2 - d1);
        let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        
        // 防護: 上限 30 天，避免溢出
        diffDays = Math.min(diffDays, 30);
        
        const newDayConfigs = {};
        const newNodesByDay = {};
        const day1End = state.dayConfigs[1]?.endLocation || '';
        for (let i = 1; i <= diffDays; i++) {
            if (state.dayConfigs[i]) {
                newDayConfigs[i] = state.dayConfigs[i];
            } else {
                // Day N Start = Day N-1 End（延續前一天路線）
                // Day N End = Day 1 End（假設住同飯店）
                const prevDayEnd = newDayConfigs[i - 1]?.endLocation || day1End;
                newDayConfigs[i] = {
                    startLocation: prevDayEnd,
                    endLocation: day1End,
                    startTime: '09:00',
                    maxReturnTime: '22:00',
                    autoUpdate: true
                };
            }
            newNodesByDay[i] = state.nodesByDay[i] || [];
        }

        return withLocalModified({
          startDate: start,
          endDate: end,
          dayConfigs: newDayConfigs,
          nodesByDay: newNodesByDay,
          activeDay: state.activeDay > diffDays ? 1 : state.activeDay // 防止 activeDay 超出範圍
        });
      }),

      createNewTrip: () => {
        const today = new Date().toISOString().split('T')[0];
        set(withLocalModified({
          tripId: generateTripId(),
          tripTitle: '未命名行程',
          startDate: today,
          endDate: today,
          sheetLastModifiedUtc: null,
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
        }));
      },

      loadTripFromArchive: (tripData) => set(() => {
        const meta = tripData?.meta || tripData || {};
        const today = new Date().toISOString().split('T')[0];
        return withLocalModified({
          tripId: meta.tripId || tripData?.tripId || generateTripId(),
          tripTitle: meta.tripTitle || tripData?.tripTitle || '未命名行程',
          startDate: meta.startDate || tripData?.startDate || today,
          endDate: meta.endDate || tripData?.endDate || meta.startDate || tripData?.startDate || today,
          sheetLastModifiedUtc: meta.sheetLastModifiedUtc || tripData?.sheetLastModifiedUtc || null,
          activeDay: 1,
          dayConfigs: tripData?.dayConfigs || {},
          nodesByDay: normalizeNodesByDay(tripData?.nodesByDay || {}),
        });
      }),

      setSheetLastModified: (lastModifiedUtc) => set({
        sheetLastModifiedUtc: lastModifiedUtc,
      }),

      setDayConfig: (config) => set((state) => withLocalModified({
        dayConfigs: {
          ...state.dayConfigs,
          [state.activeDay]: { ...state.dayConfigs[state.activeDay], ...config }
        }
      })),

      // 動作：更新某個節點的停留時間或交通方式
      updateNode: (id, updates) => set((state) => {
        if (id === 'END_NODE') {
           return withLocalModified({
             dayConfigs: {
               ...state.dayConfigs,
               [state.activeDay]: { 
                 ...state.dayConfigs[state.activeDay], 
                 endNodeData: { ...(state.dayConfigs[state.activeDay].endNodeData || {}), ...updates } 
               }
             }
           });
        }
        const list = state.nodesByDay[state.activeDay] || [];
        return withLocalModified({
          nodesByDay: {
            ...state.nodesByDay,
            [state.activeDay]: list.map(n => n.id === id ? { ...n, ...updates } : n)
          }
        });
      }),

      // 動作：從備選項中「確認採用」— 將目前選定的 place 放回 options，把選定的 option 移出來
      confirmOption: (nodeId, optionId) => set((state) => {
        const list = state.nodesByDay[state.activeDay] || [];
        return withLocalModified({
          nodesByDay: {
            ...state.nodesByDay,
            [state.activeDay]: list.map(n => {
              if(n.id === nodeId) {
                const selected = n.options.find(o => o.id === optionId);
                if (!selected) return n;
                const selectedSnapshot = normalizeOption(selected);

                // 把目前已選定的地點放回 options（如果有的話）
                let newOptions = n.options.filter(o => o.id !== optionId).map(normalizeOption);
                if (n.status === 'confirmed' && n.selected_place_name) {
                  // 避免重複：只在 options 中不存在同名時才加入
                  const currentOption = createOptionFromNode(n);
                  if (!newOptions.find(o => hasSamePlace(o, currentOption))) {
                    newOptions.push(currentOption);
                  }
                }

                return {
                  ...n,
                  status: 'confirmed',
                  ...snapshotToNodeFields(selectedSnapshot),
                  planned_stay_duration: selectedSnapshot.durationMins,
                  rating: selectedSnapshot.rating ?? 0,
                  options: newOptions
                };
              }
              return n;
            })
          }
        });
      }),

      // 動作：移除備選項
      removeOption: (nodeId, optionId) => set((state) => {
        const list = state.nodesByDay[state.activeDay] || [];
        return withLocalModified({
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
        });
      }),

      // 動作：從 AI 或地圖彈跳視窗新增點 (改為自動確認，舊的變備選)
      addOptionToNode: (nodeId, place) => set((state) => {
        const list = state.nodesByDay[state.activeDay] || [];
        return withLocalModified({
          nodesByDay: {
            ...state.nodesByDay,
            [state.activeDay]: list.map(n => {
              if(n.id === nodeId) {
                const oldOptions = (n.options || []).map(normalizeOption);
                const nextPlace = createPlaceSnapshot(place);
                if (n.status === 'confirmed' && n.selected_place_name) {
                   const currentOption = createOptionFromNode(n);
                   if (!oldOptions.find(o => hasSamePlace(o, currentOption))) {
                       oldOptions.push(currentOption);
                   }
                }
                return {
                  ...n,
                  status: 'confirmed',
                  ...snapshotToNodeFields(nextPlace),
                  planned_stay_duration: place.durationMins || place.planned_stay_duration || 60,
                  rating: nextPlace.rating ?? 0,
                  options: oldOptions
                };
              }
              return n;
            })
          }
        });
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
        return withLocalModified({
          nodesByDay: {
            ...state.nodesByDay,
            [state.activeDay]: newList
          }
        });
      }),

      // 動作：移除整個行程節點
      removeNode: (nodeId) => set((state) => {
        const list = state.nodesByDay[state.activeDay] || [];
        return withLocalModified({
          nodesByDay: {
            ...state.nodesByDay,
            [state.activeDay]: list.filter(n => n.id !== nodeId)
          }
        });
      }),

      // 動作：刪除某一天，後續天數往前遞補
      removeDay: (dayNumber) => set((state) => {
        const dayKeys = Object.keys(state.nodesByDay).map(Number).filter(k => !isNaN(k)).sort((a,b) => a-b);
        if (dayKeys.length <= 1) return {};

        const newNodesByDay = {};
        const newDayConfigs = {};
        let newIndex = 1;
        for (const key of dayKeys) {
          if (key === dayNumber) continue;
          newNodesByDay[newIndex] = state.nodesByDay[key] || [];
          newDayConfigs[newIndex] = state.dayConfigs[key] || {
            startLocation: '', endLocation: '', startTime: '09:00', maxReturnTime: '22:00', autoUpdate: true
          };
          newIndex++;
        }

        const totalDays = newIndex - 1;
        
        // 重新計算 endDate
        const startD = new Date(state.startDate);
        const newEnd = new Date(startD);
        if (!isNaN(startD.getTime())) {
          newEnd.setDate(newEnd.getDate() + totalDays - 1);
        }

        // 決定新的 activeDay
        let nextActiveDay = state.activeDay;
        if (state.activeDay === dayNumber) {
          nextActiveDay = 1;
        } else if (state.activeDay > dayNumber) {
          nextActiveDay = state.activeDay - 1;
        }
        if (nextActiveDay > totalDays) nextActiveDay = 1;

        console.log(`[Store] Day ${dayNumber} removed. Total days now: ${totalDays}, ActiveDay: ${nextActiveDay}`);

        return withLocalModified({
          nodesByDay: newNodesByDay,
          dayConfigs: newDayConfigs,
          endDate: isNaN(newEnd.getTime()) ? state.endDate : newEnd.toISOString().split('T')[0],
          activeDay: nextActiveDay
        });
      })
    }),
    {
      name: 'travel-planner-store', // localStorage key
      version: 2,
      partialize: (state) => ({
        // 只持久化核心資料，不存暫態
        tripId: state.tripId,
        tripTitle: state.tripTitle,
        startDate: state.startDate,
        endDate: state.endDate,
        localLastModifiedUtc: state.localLastModifiedUtc,
        sheetLastModifiedUtc: state.sheetLastModifiedUtc,
        dayConfigs: state.dayConfigs,
        nodesByDay: state.nodesByDay,
      }),
      migrate: (persistedState) => ({
        ...persistedState,
        tripId: persistedState?.tripId || generateTripId(),
        localLastModifiedUtc: persistedState?.localLastModifiedUtc || nowUtc(),
        sheetLastModifiedUtc: persistedState?.sheetLastModifiedUtc || null,
        nodesByDay: normalizeNodesByDay(persistedState?.nodesByDay || {}),
      }),
    }
  )
);

