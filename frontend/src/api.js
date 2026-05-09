const API_BASE = "http://localhost:8000";

async function requestJson(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  let data = null;
  try {
    data = await res.json();
  } catch (error) {
    if (res.ok) return null;
    throw new Error(`API ${res.status}: response is not valid JSON`);
  }

  if (!res.ok) {
    const detail = data?.detail || data?.error || data?.message || `API ${res.status}`;
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }

  return data;
}

export const api = {
  async getDirectionsTime(origin, destination, mode, forceRefresh) {
    const res = await fetch(`${API_BASE}/directions/calculate-time`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destination, mode, force_refresh: forceRefresh }),
    });
    const data = await res.json();
    if (data.error) {
      return {
        error: data.error,
        detail: data.detail || '未知錯誤',
        google_maps_url: data.google_maps_url || null,
      };
    }
    return {
      travel_time_mins: data.travel_time_mins,
      is_fallback: data.is_fallback || false,
      google_maps_url: data.google_maps_url || null,
    };
  },

  async getAIRecommendations(prevPlace, nextPlace, count = 3, tripContext = "") {
    const res = await fetch(`${API_BASE}/recommend-places`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prev_place: prevPlace, next_place: nextPlace, count, trip_context: tripContext }),
    });
    const data = await res.json();
    return data.recommendations || [];
  },

  /** Google 模式：SearchNearby 周邊地點 */
  async searchNearbyPlaces({ lat, lng, radius = 1000, placeType = 'tourist_attraction', keyword = '', minRating = 3.5, maxCount = 10 }) {
    const res = await fetch(`${API_BASE}/api/places/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat, lng, radius,
        place_type: placeType,
        keyword,
        min_rating: minRating,
        max_count: maxCount,
      }),
    });
    const data = await res.json();
    return data.places || [];
  },

  /** AI 模式 (Option B)：Gemini 篩選周邊候選地點 */
  async aiRecommendPlaces({ lat, lng, radius = 1500, placeType = 'tourist_attraction', userPrompt = '', maxRecommend = 5 }) {
    const res = await fetch(`${API_BASE}/api/places/ai-recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat, lng, radius,
        place_type: placeType,
        user_prompt: userPrompt,
        max_recommend: maxRecommend,
      }),
    });
    const data = await res.json();
    return data.places || [];
  },

  async getItinerary(tripId) {
    const res = await fetch(`${API_BASE}/itinerary/${tripId}`);
    return await res.json();
  },

  async saveNode(nodeData) {
    const res = await fetch(`${API_BASE}/itinerary/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nodeData),
    });
    return await res.json();
  },

  async listSheetTrips() {
    return await requestJson('/sheets/trips');
  },

  async exportTripToSheet(tripId, payload) {
    return await requestJson(`/sheets/export/${encodeURIComponent(tripId)}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async importTripFromSheet(tripId) {
    return await requestJson(`/sheets/import/${encodeURIComponent(tripId)}`);
  },

  async deleteSheetTrip(tripId) {
    return await requestJson(`/sheets/trips/${encodeURIComponent(tripId)}`, {
      method: 'DELETE',
    });
  },
};
