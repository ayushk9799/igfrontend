/* eslint-env jest */
import { apiFetch } from '../apiFetch';
import { WORD_SEARCH_API, wordSearchFetch } from '../wordSearchApi';

jest.mock('../apiFetch', () => ({ apiFetch: jest.fn() }));
beforeEach(() => apiFetch.mockReset());
const response = (status, body, version) => ({
    status, ok: status >= 200 && status < 300,
    headers: { get: () => version },
    clone: () => ({ json: async () => body }),
});

test('an old server falls back to the released route', async () => {
    const game = response(200, { success: true });
    apiFetch.mockResolvedValueOnce(response(404)).mockResolvedValueOnce(game);
    expect(await wordSearchFetch(`${WORD_SEARCH_API}/active/user-1`)).toBe(game);
    expect(apiFetch.mock.calls[1][0]).toBe(WORD_SEARCH_API.replace('/api/v2/', '/api/') + '/active/user-1');
});

test('a modern missing game does not fall back and downgrade its rules', async () => {
    const missing = response(404, { message: 'Game not found' }, '2');
    apiFetch.mockResolvedValue(missing);
    expect(await wordSearchFetch(`${WORD_SEARCH_API}/game-1?userId=user-1`)).toBe(missing);
    expect(apiFetch).toHaveBeenCalledTimes(1);
});

test('a Premium rejection never retries through the free legacy route', async () => {
    const denied = response(403, { code: 'WORD_SEARCH_FREE_LIMIT_REACHED' });
    apiFetch.mockResolvedValue(denied);
    expect(await wordSearchFetch(`${WORD_SEARCH_API}/create`, { method: 'POST' })).toBe(denied);
    expect(apiFetch).toHaveBeenCalledTimes(1);
});

test('fresh-puzzle fallback ends the old board before creating its replacement', async () => {
    const game = response(201, { success: true });
    apiFetch.mockResolvedValueOnce(response(404))
        .mockResolvedValueOnce(response(200, { success: true }))
        .mockResolvedValueOnce(game);
    const options = { method: 'POST', body: JSON.stringify({ creatorId: 'user-1', forceNew: true, replaceGameId: 'game-1' }) };
    expect(await wordSearchFetch(`${WORD_SEARCH_API}/create`, options)).toBe(game);
    expect(apiFetch.mock.calls[1][0]).toContain('/api/word-search/game-1/abandon');
    expect(apiFetch.mock.calls[2][0]).toContain('/api/word-search/create');
});

test('a failed abandon on an old server does not create another board', async () => {
    const denied = response(403, { success: false });
    apiFetch.mockResolvedValueOnce(response(404)).mockResolvedValueOnce(denied);
    expect(await wordSearchFetch(`${WORD_SEARCH_API}/create`, { method: 'POST', body: JSON.stringify({ creatorId: 'user-1', forceNew: true, replaceGameId: 'game-1' }) })).toBe(denied);
    expect(apiFetch).toHaveBeenCalledTimes(2);
});
