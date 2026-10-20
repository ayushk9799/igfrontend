jest.mock('../../constants/Api', () => ({ API_BASE: 'https://example.test' }));
jest.mock('../../utils/apiFetch', () => ({ apiFetch: jest.fn() }));

import { apiFetch } from '../../utils/apiFetch';
import { fetchLetters, sendLetter } from '../lettersApi';

const respond = (status, body) => ({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
});

describe('lettersApi', () => {
    afterEach(() => {
        apiFetch.mockReset();
    });

    test('fetchLetters builds the list query', async () => {
        apiFetch.mockResolvedValue(respond(200, { success: true, data: { letters: [] } }));
        await fetchLetters({ status: 'delivered', limit: 10 });
        expect(apiFetch.mock.calls[0][0]).toBe('https://example.test/api/letters?limit=10&status=delivered');
    });

    test('sendLetter posts the text and bird', async () => {
        apiFetch.mockResolvedValue(respond(201, { success: true, data: { letter: { id: 'l1' } } }));
        const data = await sendLetter({ body: 'Hi', bird: 'pigeon' });
        expect(data.letter.id).toBe('l1');
        expect(apiFetch.mock.calls[0][1]).toEqual({
            method: 'POST',
            body: JSON.stringify({ body: 'Hi', bird: 'pigeon' }),
        });
    });

    test('server error codes reach the caller', async () => {
        apiFetch.mockResolvedValue(respond(403, {
            success: false,
            code: 'premium_required',
            error: 'Falcon is a Premium bird',
        }));
        await expect(sendLetter({ body: 'Hi', bird: 'falcon' })).rejects.toMatchObject({
            status: 403,
            code: 'premium_required',
            message: 'Falcon is a Premium bird',
        });
    });
});
