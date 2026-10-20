import { API_BASE } from '../constants/Api';
import { apiFetch } from '../utils/apiFetch';

const LETTERS_API = `${API_BASE}/api/letters`;

export class LettersApiError extends Error {
    constructor(message, { status, code } = {}) {
        super(message);
        this.status = status;
        this.code = code;
    }
}

const parseJson = async (response) => {
    let data = null;
    try {
        data = await response.json();
    } catch {
        data = null;
    }
    if (!response.ok || data?.success === false) {
        throw new LettersApiError(data?.error || data?.message || 'Request failed', {
            status: response.status,
            code: data?.code,
        });
    }
    return data.data;
};

export const fetchLetters = async ({ status, limit = 20, before } = {}) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (status) params.set('status', status);
    if (before) params.set('before', before);
    return parseJson(await apiFetch(`${LETTERS_API}?${params.toString()}`));
};

export const fetchLetter = async (letterId) => (
    parseJson(await apiFetch(`${LETTERS_API}/${encodeURIComponent(letterId)}`))
);

export const sendLetter = async ({ body, bird }) => (
    parseJson(await apiFetch(LETTERS_API, {
        method: 'POST',
        body: JSON.stringify({ body, bird }),
    }))
);

export const recallLetter = async (letterId) => (
    parseJson(await apiFetch(`${LETTERS_API}/${encodeURIComponent(letterId)}/recall`, { method: 'POST' }))
);

export const markLetterRead = async (letterId) => (
    parseJson(await apiFetch(`${LETTERS_API}/${encodeURIComponent(letterId)}/read`, { method: 'POST' }))
);

// City-level points for both partners; nulls when either hides their location.
export const fetchLetterMap = async () => (
    parseJson(await apiFetch(`${LETTERS_API}/map`))
);
