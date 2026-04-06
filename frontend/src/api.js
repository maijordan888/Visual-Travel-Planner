const API_BASE = "http://localhost:8000";

export const api = {
    async getDirectionsTime(origin, destination, mode, forceRefresh) {
        const res = await fetch(`${API_BASE}/directions/calculate-time`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ origin, destination, mode, force_refresh: forceRefresh })
        });
        const data = await res.json();
        return data.travel_time_mins || 0;
    },

    async getAIRecommendations(prevPlace, nextPlace, count = 3) {
        const res = await fetch(`${API_BASE}/recommend-places`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prev_place: prevPlace, next_place: nextPlace, count })
        });
        const data = await res.json();
        return data.recommendations || [];
    },

    async getItinerary(tripId) {
        const res = await fetch(`${API_BASE}/itinerary/${tripId}`);
        return await res.json();
    },

    async saveNode(nodeData) {
        const res = await fetch(`${API_BASE}/itinerary/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nodeData)
        });
        return await res.json();
    }
};
