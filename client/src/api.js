const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5500';

export async function apiRequest(path, options = {}, user) {
    const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
    const token = user?.token || window.localStorage.getItem('bookaru_session');
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${API_URL}${path}`, { ...options, headers });
    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.message || 'The request could not be completed.');
    }
    return response;
}

export default API_URL;
