/* eslint-env jest */
import { checkWordSearchSelection, normalizeWordSearchGame, shouldApplyWordSearchGame } from '../wordSearchState';

const game = {
    _id: 'game-1', creatorId: 'user-1', partnerId: 'partner-1',
    mode: 'duel', status: 'active', gridSize: 8,
    grid: Array(8).fill('ABCDEFGH'), words: [{ word: 'ABC', foundBy: null }],
    updatedAt: '2026-10-02T10:00:00.000Z',
    turnExpiresAt: '2026-10-02T10:00:45.000Z',
};

test.each([
    { words: [null] },
    { words: [{ word: 123 }] },
    { words: [{ word: 'ABC' }, { word: 'ABC' }] },
    { words: [{ word: 'ABC', foundBy: 'user-1' }] },
    { words: [{ word: 'ABC', start: { row: -1, col: 0 }, end: { row: 0, col: 2 } }] },
    { words: [{ word: 'ABC', start: { row: 0, col: 0 }, end: { row: 1, col: 2 } }] },
    { turnExpiresAt: 'invalid' },
    { turnDurationSeconds: 0 },
    { turnPausedAt: 'invalid' },
    { turnRemainingMs: -1 },
    { startRemainingMs: -1 },
    { offlinePlayerIds: ['stranger'] },
    { creatorScore: -1 },
])('rejects unsafe game data: %j', patch => {
    expect(normalizeWordSearchGame({ ...game, ...patch })).toBeNull();
});

test('derives counts from validated entries instead of trusting supplied counters', () => {
    expect(normalizeWordSearchGame({ ...game, totalWords: 100, foundCount: 50 }))
        .toMatchObject({ totalWords: 1, foundCount: 0 });
});

test('rejects a response from a game that has been replaced', () => {
    expect(shouldApplyWordSearchGame({ ...game, _id: 'game-2' }, game, {
        allowSwitch: true, expectedGameId: 'game-1',
    })).toBe(false);
});

test('rejects older scores, expired clocks, and reopening completed games', () => {
    const current = normalizeWordSearchGame(game);
    expect(shouldApplyWordSearchGame(current, { ...current, updatedAt: '2026-10-02T09:59:59.000Z' })).toBe(false);
    expect(shouldApplyWordSearchGame({ ...current, foundCount: 1 }, current)).toBe(false);
    expect(shouldApplyWordSearchGame(current, { ...current, turnExpiresAt: '2026-10-02T10:00:00.000Z' })).toBe(false);
    expect(shouldApplyWordSearchGame({ ...current, status: 'completed' }, current)).toBe(false);
});

test('does not let bootstrap overwrite an invitation but permits rematch recovery after a join', () => {
    const incoming = { ...normalizeWordSearchGame(game), _id: 'game-2' };
    expect(shouldApplyWordSearchGame(game, incoming, {
        allowSwitch: true, expectedGameId: '', requestRevision: 0, currentRevision: 1,
    })).toBe(false);
    expect(shouldApplyWordSearchGame(game, incoming, {
        allowSwitch: true, expectedGameId: 'game-1', requestRevision: 1, currentRevision: 2,
    })).toBe(true);
});

test.each([
    [{ row: 0, col: 0 }, { row: 0, col: 2 }],
    [{ row: 0, col: 2 }, { row: 0, col: 0 }],
    [{ row: 0, col: 0 }, { row: 2, col: 2 }],
])('checks listed words in both endpoint orders and diagonal lines', (start, end) => {
    expect(checkWordSearchSelection(game, start, end)).toEqual({ word: 'ABC' });
});

test.each([
    [{ row: 0, col: 0 }, { row: 0, col: 1 }],
    [{ row: 0, col: 0 }, { row: 2, col: 1 }],
    [{ row: -1, col: 0 }, { row: 0, col: 2 }],
    [{ row: 0, col: 0 }, { row: 0, col: 8 }],
    [{ row: 0.5, col: 0 }, { row: 2, col: 0 }],
])('rejects short, bent, and unsafe selections locally', (start, end) => {
    expect(checkWordSearchSelection(game, start, end)).toEqual({ code: 'INVALID_SELECTION' });
});

test('distinguishes wrong words from already-found words locally', () => {
    expect(checkWordSearchSelection(game, { row: 0, col: 1 }, { row: 0, col: 3 }))
        .toEqual({ code: 'WORD_NOT_FOUND' });
    expect(checkWordSearchSelection({ ...game, words: [{ word: 'ABC', foundBy: 'user-1' }] }, { row: 0, col: 2 }, { row: 0, col: 0 }))
        .toEqual({ code: 'WORD_ALREADY_FOUND' });
});
