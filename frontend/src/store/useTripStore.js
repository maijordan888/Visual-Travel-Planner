import { create } from 'zustand';

// 初始模擬資料
const initialNodes = [
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

export const useTripStore = create((set, get) => ({
  activeDay: 1,
  setActiveDay: (day) => set({ activeDay: day }),

  dayConfig: {
    startLocation: '台北萬豪酒店',
    endLocation: '台北萬豪酒店',
    startTime: '09:00',
    maxReturnTime: '22:00',
    autoUpdate: true // 自動觸發 API 重新計算時間的開關
  },
  setDayConfig: (config) => set((state) => ({ dayConfig: { ...state.dayConfig, ...config } })),

  dailyNodes: initialNodes,
  
  // 動作：更新某個節點的停留時間或交通方式
  updateNode: (id, updates) => set((state) => ({
    dailyNodes: state.dailyNodes.map(n => n.id === id ? { ...n, ...updates } : n)
  })),

  // 動作：從備選項中「確認採用」
  confirmOption: (nodeId, optionId) => set((state) => ({
    dailyNodes: state.dailyNodes.map(n => {
      if(n.id === nodeId) {
        const selected = n.options.find(o => o.id === optionId);
        return {
          ...n,
          status: 'confirmed',
          selected_place_name: selected.name,
          planned_stay_duration: selected.durationMins,
          rating: selected.rating
          // 注意：我們依循您的回饋，將其餘備選項留在 n.options 裡面不動，只改變狀態
        };
      }
      return n;
    })
  })),

  // 動作：移除備選項
  removeOption: (nodeId, optionId) => set((state) => ({
    dailyNodes: state.dailyNodes.map(n => {
      if(n.id === nodeId) {
        return {
          ...n,
          options: n.options.filter(o => o.id !== optionId)
        };
      }
      return n;
    })
  })),

  // 動作：從 AI 或地圖彈跳視窗新增備選點
  addOptionToNode: (nodeId, place) => set((state) => ({
    dailyNodes: state.dailyNodes.map(n => {
      if(n.id === nodeId) {
        // 防止重複加入
        if(n.options.find(o => o.id === place.id)) return n;
        return {
          ...n,
          options: [...n.options, place]
        };
      }
      return n;
    })
  }))
}));
