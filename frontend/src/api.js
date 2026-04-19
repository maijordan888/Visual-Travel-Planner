const API_BASE = "http://localhost:8000";

export const api = {
  async getDirectionsTime(origin, destination, mode, forceRefresh) {
    const res = await fetch(`${API_BASE}/directions/calculate-time`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destination, mode, force_refresh: forceRefresh }),
    });
    const data = await res.json();
    return data.travel_time_mins || 0;
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
};
