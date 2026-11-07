// REACT_APP_API_URL wins when set; otherwise production builds use the deployed Render API.
const API_URL = (process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? 'https://booka-ru-api.onrender.com' : 'http://localhost:5500')).replace(/\/+$/, '');
const AUTH_CODES = ['AUTH_REQUIRED', 'SESSION_EXPIRED', 'ACCOUNT_NOT_FOUND', 'ACCOUNT_DEACTIVATED'];

// Backend contract: success is always HTTP 200 { success, message, data }; failure is HTTP 422 { success, errors: [{ code, message, field? }] }.
export class ApiError extends Error {
    constructor(errors, status) {
        super(errors.map(item => item.message).join(' '));
        this.errors = errors;
        this.status = status;
    }
}

// Resolves only for HTTP 200 and returns { data, message }. Pass `raw: true` to get { blob } for file downloads.
export async function apiRequest(path, options = {}, user) {
    const { raw, ...fetchOptions } = options;
    const headers = { ...(fetchOptions.body ? { 'Content-Type': 'application/json' } : {}), ...(fetchOptions.headers || {}) };
    const token = user?.token || window.localStorage.getItem('bookaru_session');
    if (token) headers.Authorization = `Bearer ${token}`;
    let response;
    try { response = await fetch(`${API_URL}${path}`, { ...fetchOptions, headers }); }
    catch (error) {
        if (error.name === 'AbortError') throw error;
        throw new ApiError([{ code: 'NETWORK_ERROR', message: 'The server could not be reached.' }], 0);
    }
    if (response.status !== 200) {
        const body = await response.json().catch(() => ({}));
        const errors = Array.isArray(body.errors) && body.errors.length ? body.errors : [{ code: 'REQUEST_FAILED', message: 'The request could not be completed.' }];
        if (token && errors.some(item => AUTH_CODES.includes(item.code))) window.dispatchEvent(new Event('bookaru:auth-lost'));
        throw new ApiError(errors, response.status);
    }
    if (raw) return { blob: await response.blob() };
    const body = await response.json();
    return { data: body.data, message: body.message || '' };
}

export default API_URL;
