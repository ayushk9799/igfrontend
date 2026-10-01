jest.mock('../../constants/Api', () => ({ API_BASE: 'https://example.test' }));
jest.mock('../../utils/apiFetch', () => ({ apiFetch: jest.fn() }));

import { fetchMemories } from '../memoriesApi';

describe('memoriesApi.fetchMemories', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue({
                success: true,
                data: {
                    memories: [],
                    nextCursor: null,
                    hasMore: false,
                },
            }),
        });
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    test('defaults to sort=asc when sort is not specified', async () => {
        await fetchMemories({ userId: 'user-1' });

        expect(global.fetch).toHaveBeenCalledTimes(1);
        const calledUrl = global.fetch.mock.calls[0][0];
        expect(calledUrl).toContain('sort=asc');
        expect(calledUrl).toContain('userId=user-1');
        expect(calledUrl).toContain('limit=20');
    });

    test('passes sort=desc and cursor when requested', async () => {
        await fetchMemories({
            userId: 'user-1',
            cursor: 'cursor-token-123',
            limit: 15,
            sort: 'desc',
        });

        expect(global.fetch).toHaveBeenCalledTimes(1);
        const calledUrl = global.fetch.mock.calls[0][0];
        expect(calledUrl).toContain('sort=desc');
        expect(calledUrl).toContain('cursor=cursor-token-123');
        expect(calledUrl).toContain('limit=15');
    });
});
