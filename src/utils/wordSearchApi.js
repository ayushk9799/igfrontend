import { API_BASE } from '../constants/Api';
import { apiFetch } from './apiFetch';

export const WORD_SEARCH_API = `${API_BASE}/api/v2/word-search`;

// Older servers lack the versioned route. Keep those games usable during rollout.
export const wordSearchFetch = async (url, options = {}) => {
    const response = await apiFetch(url, options);
    if (response.status !== 404 || response.headers?.get?.('X-Word-Search-API-Version') === '2' || !url.startsWith(`${WORD_SEARCH_API}/`)) return response;
    const legacyUrl = url.replace('/api/v2/word-search/', '/api/word-search/');
    const body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
    if (options.method === 'POST' && url.endsWith('/create') && body?.forceNew && body.replaceGameId) {
        // The stable server replaces a board through its separate abandon route.
        const abandoned = await apiFetch(`${API_BASE}/api/word-search/${body.replaceGameId}/abandon`, {
            method: 'POST', body: JSON.stringify({ userId: body.creatorId }), signal: options.signal,
        });
        const result = await abandoned.clone().json();
        if (!abandoned.ok || !result.success) return abandoned;
    }
    return apiFetch(legacyUrl, options);
};
