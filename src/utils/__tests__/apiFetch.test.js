/* eslint-env jest */
import { apiFetch, setAuthErrorHandler } from '../apiFetch';

jest.mock('../authStorage', () => ({ getAuthToken: () => 'test-session' }));
jest.mock('../../i18n/uiTranslation', () => ({ getContentLanguage: () => 'en' }));

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; setAuthErrorHandler(null); });

test('a Premium limit returns its response without signing out or losing its code', async () => {
    const handler = jest.fn();
    setAuthErrorHandler(handler);
    const payload = { success: false, code: 'WORD_SEARCH_FREE_LIMIT_REACHED', message: 'Premium required' };
    const response = { status: 403, ok: false, json: async () => payload };
    global.fetch = jest.fn().mockResolvedValue(response);
    const result = await apiFetch('https://example.invalid/api/v2/word-search/create', { method: 'POST' });
    expect(await result.json()).toEqual(payload);
    expect(handler).not.toHaveBeenCalled();
});

test('an expired session still signs out and rejects the request', async () => {
    const handler = jest.fn();
    setAuthErrorHandler(handler);
    global.fetch = jest.fn().mockResolvedValue({ status: 401, clone: () => ({ json: async () => ({ message: 'Session expired' }) }) });
    await expect(apiFetch('https://example.invalid/api/user/profile')).rejects.toThrow('Authentication Error: Session expired');
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ status: 401, message: 'Session expired' });
});

test('a permission denial is returned to its caller without clearing the session', async () => {
    const handler = jest.fn();
    setAuthErrorHandler(handler);
    const response = { status: 403, ok: false };
    global.fetch = jest.fn().mockResolvedValue(response);
    expect(await apiFetch('https://example.invalid/api/user/profile')).toBe(response);
    expect(handler).not.toHaveBeenCalled();
});
