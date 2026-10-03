/* eslint-env jest */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { ActivityIndicator, AppState, Image, ScrollView, Text, TouchableOpacity } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import WordSearchScreen, { WordSearchBoard } from '../WordSearchScreen';
import { apiFetch } from '../../utils/apiFetch';

const mockHandlers = new Map();
const mockSocket = {
    on: jest.fn((name, handler) => {
        if (!mockHandlers.has(name)) mockHandlers.set(name, new Set());
        mockHandlers.get(name).add(handler);
    }),
    off: jest.fn((name, handler) => mockHandlers.get(name)?.delete(handler)),
    emit: jest.fn(),
};
let mockPartnerOnline = false;
let mockConnected = true;
let mockSavedMode = null;
const mockRefreshPresence = jest.fn();
const mockSendNudge = jest.fn();
const mockRequestPremium = jest.fn();
const mockAudioPlayer = { stopPlayer: jest.fn(), startPlayer: jest.fn(), setVolume: jest.fn() };

jest.mock('../../utils/safeAudioPlayer', () => ({ createSafeAudioPlayer: () => mockAudioPlayer }));
jest.mock('../../../assets/sounds/result.mp3', () => 1);

jest.mock('react-native-haptic-feedback', () => ({ trigger: jest.fn() }));
jest.mock('react-native-confetti-cannon', () => () => null);
jest.mock('react-native-linear-gradient', () => ({ children }) => children);
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('../../context/SocketContext', () => ({ useSocketContext: () => ({ socket: mockSocket }) }));
jest.mock('../../hooks/usePresence', () => ({
    __esModule: true,
    default: () => ({ partnerOnline: mockPartnerOnline, isConnected: mockConnected, refreshPresence: mockRefreshPresence, sendNudge: mockSendNudge }),
}));
jest.mock('../../i18n/uiTranslation', () => ({
    getContentLanguage: () => 'en',
    translateUiText: text => text,
    translateUiTemplate: (template, values) => template.replace(/\{\{(\d+)\}\}/g, (_, index) => values[index]),
}));
jest.mock('../../utils/apiFetch', () => ({ apiFetch: jest.fn() }));
jest.mock('lucide-react-native', () => {
    const Icon = () => null;
    return Object.fromEntries(['Bell', 'Check', 'ChevronLeft', 'MoreVertical', 'RotateCcw', 'Swords', 'Timer', 'User', 'X'].map(name => [name, Icon]));
});
jest.mock('../../utils/authStorage', () => ({
    getAuthToken: () => 'session-token',
    getUser: () => ({ id: 'user-1', partnerId: 'partner-1' }),
    storage: { getString: key => key === 'wordsearch_mode' ? mockSavedMode : null, set: jest.fn() },
}));

const game = {
    _id: 'game-1', protocolVersion: 2, creatorId: 'user-1', partnerId: 'partner-1', currentTurn: 'user-1',
    mode: 'duel', status: 'active', difficulty: 'medium', gridSize: 8,
    grid: Array(8).fill('ABCDEFGH'), words: [{ word: 'ABC', foundBy: null }],
    updatedAt: '2026-10-02T10:00:00.000Z',
};
const nextGame = { ...game, _id: 'game-2', updatedAt: '2026-10-02T10:01:00.000Z' };
const response = data => ({ ok: true, json: async () => ({ success: true, data }) });
const deferred = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
};
const emit = (name, payload) => {
    for (const handler of mockHandlers.get(name) || []) handler(payload);
};
const getBoard = renderer => renderer.root.findByType(WordSearchBoard.type);
const textExists = (renderer, value) => (renderer.root || renderer).findAllByType(Text).some(node => node.props.children === value);
const press = (renderer, label) => {
    let node = renderer.root.findAllByType(Text).find(text => text.props.children === label);
    expect(node).toBeDefined();
    while (node && typeof node.props.onPress !== 'function') node = node.parent;
    node.props.onPress();
};

let renderer;
const mount = async (gameData, navigation = { goBack: jest.fn() }) => {
    await ReactTestRenderer.act(() => {
        renderer = ReactTestRenderer.create(<WordSearchScreen navigation={navigation} route={{ params: { partnerId: 'partner-1', partnerName: 'Partner', gameData } }} onRequestPremium={mockRequestPremium} />);
    });
    return renderer;
};

beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-02T10:00:00.000Z'));
    mockHandlers.clear();
    mockSocket.emit.mockClear();
    mockSendNudge.mockClear();
    mockRequestPremium.mockClear();
    ReactNativeHapticFeedback.trigger.mockClear();
    mockPartnerOnline = true;
    mockConnected = true;
    mockSavedMode = null;
    apiFetch.mockReset();
    mockAudioPlayer.stopPlayer.mockReset().mockResolvedValue(undefined);
    mockAudioPlayer.startPlayer.mockReset().mockResolvedValue(undefined);
    mockAudioPlayer.setVolume.mockReset().mockResolvedValue(undefined);
    jest.spyOn(Image, 'resolveAssetSource').mockReturnValue({ uri: 'asset:/result.mp3' });
});
afterEach(async () => {
    if (renderer) await ReactTestRenderer.act(() => renderer.unmount());
    renderer = null;
    jest.useRealTimers();
    jest.restoreAllMocks();
});

test('presence timeout permits solo creation when no socket status arrives', async () => {
    mockPartnerOnline = false;
    apiFetch.mockImplementation(url => Promise.resolve(response(url.endsWith('/create') ? { ...game, mode: 'single', partnerId: null } : null)));
    await mount();
    expect(apiFetch.mock.calls.filter(([url]) => url.endsWith('/create'))).toHaveLength(0);
    await ReactTestRenderer.act(() => jest.advanceTimersByTime(3000));
    expect(getBoard(renderer).props.game.mode).toBe('single');
});

test.each(['single', 'disconnected'])('%s play starts without waiting for presence', async scenario => {
    mockPartnerOnline = false;
    if (scenario === 'single') mockSavedMode = 'single';
    else mockConnected = false;
    apiFetch.mockImplementation(url => Promise.resolve(response(url.endsWith('/create') ? { ...game, mode: 'single', partnerId: null } : null)));
    await mount();
    expect(getBoard(renderer).props.game.mode).toBe('single');
});

test('late bootstrap cannot replace a challenge received by socket', async () => {
    const pending = deferred();
    apiFetch.mockReturnValue(pending.promise);
    await mount();
    await ReactTestRenderer.act(() => emit('wordsearch:invited', { game: nextGame }));
    await ReactTestRenderer.act(() => pending.resolve(response(game)));
    expect(getBoard(renderer).props.game._id).toBe('game-2');
});

test('a partner starting a new game shows a temporary notice without repeating duplicate invitations', async () => {
    const invited = { ...nextGame, creatorId: 'partner-1', partnerId: 'user-1' };
    await mount(game);
    await ReactTestRenderer.act(() => emit('wordsearch:invited', { game: invited }));
    expect(getBoard(renderer).props.game._id).toBe(invited._id);
    expect(textExists(renderer, 'New game started')).toBe(true);
    expect(renderer.root.findAllByProps({ testID: 'word-search-new-game-notice' }).length).toBeGreaterThan(0);
    await ReactTestRenderer.act(() => jest.advanceTimersByTime(2000));
    await ReactTestRenderer.act(() => emit('wordsearch:invited', { game: invited }));
    await ReactTestRenderer.act(() => jest.advanceTimersByTime(2000));
    expect(textExists(renderer, 'New game started')).toBe(false);
    await ReactTestRenderer.act(() => emit('wordsearch:invited', { game: invited }));
    expect(textExists(renderer, 'New game started')).toBe(false);
});

test('starting your own game clears an earlier partner notice and stale invitations cannot reopen it', async () => {
    await mount(game);
    const invited = { ...nextGame, creatorId: 'partner-1', partnerId: 'user-1' };
    await ReactTestRenderer.act(() => emit('wordsearch:invited', { game: invited }));
    expect(textExists(renderer, 'New game started')).toBe(true);
    await ReactTestRenderer.act(() => emit('wordsearch:invited', { game: { ...nextGame, _id: 'game-3' } }));
    expect(textExists(renderer, 'New game started')).toBe(false);
    await ReactTestRenderer.act(() => emit('wordsearch:invited', { game: invited }));
    expect(getBoard(renderer).props.game._id).toBe('game-3');
    expect(textExists(renderer, 'New game started')).toBe(false);
});

test('reconnect rejoins and recovers a missed partner-started game even after an old join response', async () => {
    const pending = deferred();
    apiFetch.mockReturnValue(pending.promise);
    await mount(game);
    await ReactTestRenderer.act(() => emit('connect'));
    await ReactTestRenderer.act(() => emit('wordsearch:joined', { success: true, game }));
    await ReactTestRenderer.act(() => pending.resolve(response(nextGame)));
    expect(getBoard(renderer).props.game._id).toBe('game-2');
    expect(mockSocket.emit).toHaveBeenCalledWith('wordsearch:join', { gameId: 'game-2' });
});

test('focus and foreground recover missed game updates', async () => {
    let focus;
    let foreground;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_, callback) => {
        foreground = callback;
        return { remove: jest.fn() };
    });
    apiFetch.mockResolvedValue(response(nextGame));
    await mount(game, { goBack: jest.fn(), addListener: (_, callback) => { focus = callback; return jest.fn(); } });
    await ReactTestRenderer.act(() => focus());
    expect(getBoard(renderer).props.game._id).toBe('game-2');
    apiFetch.mockResolvedValue(response({ ...nextGame, _id: 'game-3' }));
    await ReactTestRenderer.act(() => foreground('active'));
    expect(getBoard(renderer).props.game._id).toBe('game-3');
});

test('a delayed selection response cannot restore the previous board', async () => {
    const pending = deferred();
    apiFetch.mockReturnValue(pending.promise);
    await mount(game);
    let selection;
    await ReactTestRenderer.act(() => {
        selection = getBoard(renderer).props.onSubmitSelection({ row: 0, col: 0 }, { row: 0, col: 2 });
    });
    await ReactTestRenderer.act(() => emit('wordsearch:invited', { game: nextGame }));
    await ReactTestRenderer.act(async () => {
        pending.resolve(response(game));
        await selection;
    });
    expect(getBoard(renderer).props.game._id).toBe('game-2');
    expect(renderer.root.findAllByProps({ testID: 'word-search-error-notice' })).toHaveLength(0);
});

test('a delayed expiry refresh cannot restore the previous board', async () => {
    const pending = deferred();
    apiFetch.mockReturnValue(pending.promise);
    await mount({ ...game, turnExpiresAt: '2026-10-02T10:00:01.000Z' });
    await ReactTestRenderer.act(() => jest.advanceTimersByTime(1300));
    await ReactTestRenderer.act(() => emit('wordsearch:invited', { game: nextGame }));
    await ReactTestRenderer.act(() => pending.resolve(response(game)));
    expect(getBoard(renderer).props.game._id).toBe('game-2');
});

test('unsafe word entries do not clear or crash the current board', async () => {
    await mount(game);
    await ReactTestRenderer.act(() => emit('wordsearch:updated', { gameId: game._id, game: { ...game, words: [null] } }));
    expect(getBoard(renderer).props.game._id).toBe('game-1');
    expect(textExists(renderer, 'The game data was incomplete. Please try again.')).toBe(true);
});

test('older socket snapshots cannot roll back found words', async () => {
    const newer = {
        ...game, updatedAt: '2026-10-02T10:00:01.000Z', creatorScore: 1,
        words: [{ word: 'ABC', foundBy: 'user-1', start: { row: 0, col: 0 }, end: { row: 0, col: 2 } }],
    };
    await mount(newer);
    await ReactTestRenderer.act(() => emit('wordsearch:updated', { gameId: game._id, game }));
    expect(getBoard(renderer).props.game.foundCount).toBe(1);
    expect(getBoard(renderer).props.game.creatorScore).toBe(1);
});

test('expiry refresh retries after a transient connection failure', async () => {
    apiFetch.mockRejectedValueOnce(new Error('Network unavailable'))
        .mockResolvedValue(response({ ...game, turnExpiresAt: '2026-10-02T10:00:46.000Z', updatedAt: '2026-10-02T10:00:01.000Z' }));
    await mount({ ...game, turnExpiresAt: '2026-10-02T10:00:01.000Z' });
    await ReactTestRenderer.act(() => jest.advanceTimersByTime(1300));
    expect(apiFetch).toHaveBeenCalledTimes(1);
    await ReactTestRenderer.act(() => jest.advanceTimersByTime(1000));
    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(getBoard(renderer).props.game.turnExpiresAt).toBe('2026-10-02T10:00:46.000Z');
});

test('reconnect during a submission is reconciled when that submission settles', async () => {
    const pending = deferred();
    apiFetch.mockReturnValueOnce(pending.promise).mockResolvedValue(response(nextGame));
    await mount(game);
    let selection;
    await ReactTestRenderer.act(() => {
        selection = getBoard(renderer).props.onSubmitSelection({ row: 0, col: 0 }, { row: 0, col: 2 });
    });
    await ReactTestRenderer.act(() => emit('connect'));
    expect(apiFetch).toHaveBeenCalledTimes(1);
    await ReactTestRenderer.act(async () => {
        pending.resolve(response(game));
        await selection;
    });
    expect(getBoard(renderer).props.game._id).toBe('game-2');
});

test('unrelated presence events do not finish the partner presence check', async () => {
    mockPartnerOnline = false;
    apiFetch.mockImplementation(url => Promise.resolve(response(url.endsWith('/create') ? { ...game, mode: 'single', partnerId: null } : null)));
    await mount();
    await ReactTestRenderer.act(() => emit('presence:online', { userId: 'someone-else' }));
    expect(apiFetch.mock.calls.filter(([url]) => url.endsWith('/create'))).toHaveLength(0);
    await ReactTestRenderer.act(() => emit('presence:offline', { userId: 'partner-1' }));
    expect(getBoard(renderer).props.game.mode).toBe('single');
});

test('rematch countdown reflects the server start time and keeps the board locked', async () => {
    await mount({ ...game, startsAt: '2026-10-02T10:00:06.000Z' });
    expect(textExists(renderer, '6')).toBe(true);
    expect(getBoard(renderer).props.canInteractWithBoard).toBe(false);
    await ReactTestRenderer.act(() => jest.advanceTimersByTime(6000));
    expect(textExists(renderer, 'GO!')).toBe(true);
    expect(getBoard(renderer).props.canInteractWithBoard).toBe(true);
});

test('an intentional resume can return to an older solo puzzle while old invitations stay ignored', async () => {
    mockPartnerOnline = false;
    const solo = { ...game, mode: 'single', partnerId: null, createdAt: '2026-10-02T09:00:00.000Z' };
    const duel = { ...nextGame, createdAt: '2026-10-02T10:00:00.000Z' };
    await mount(solo);
    await ReactTestRenderer.act(() => emit('wordsearch:invited', { game: duel }));
    await ReactTestRenderer.act(() => emit('wordsearch:updated', { gameId: duel._id, game: { ...duel, status: 'completed' } }));
    apiFetch.mockResolvedValue(response(solo));
    await ReactTestRenderer.act(() => press(renderer, 'Start new game'));
    expect(getBoard(renderer).props.game._id).toBe(solo._id);
    await ReactTestRenderer.act(() => emit('wordsearch:invited', { game: duel }));
    expect(getBoard(renderer).props.game._id).toBe(solo._id);
});

test('a hanging submission times out and releases the board', async () => {
    apiFetch.mockImplementation((_, { signal }) => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(Object.assign(new Error('Timed out'), { name: 'AbortError' })));
    }));
    await mount(game);
    let selection;
    await ReactTestRenderer.act(() => {
        selection = getBoard(renderer).props.onSubmitSelection({ row: 0, col: 0 }, { row: 0, col: 2 });
    });
    await ReactTestRenderer.act(async () => {
        jest.advanceTimersByTime(10000);
        await selection;
    });
    expect(getBoard(renderer).props.submitting).toBe(false);
    expect(textExists(renderer, 'Could not connect to server')).toBe(true);
});

test('duel timer and turn stay inside the score card without board instructions', async () => {
    await mount({ ...game, turnExpiresAt: '2026-10-02T10:00:45.000Z' });
    const card = renderer.root.findAllByProps({ testID: 'word-search-score-card' })[0];
    expect(card.findAllByProps({ testID: 'word-search-turn-timer' }).length).toBeGreaterThan(0);
    expect(textExists(card, '0:45')).toBe(true);
    expect(textExists(card, 'Your turn')).toBe(true);
    const content = renderer.root.findByType(ScrollView);
    expect(content.props.scrollEnabled).toBe(false);
    expect(textExists(content, 'YOUR 45-SECOND TURN')).toBe(false);
    expect(textExists(content, 'Find as many as you can')).toBe(false);
    expect(textExists(content, 'Touch, drag across a word, then release')).toBe(false);
    expect(textExists(content, 'Partner offline')).toBe(false);
    jest.setSystemTime(new Date('2026-10-02T10:01:13.000Z'));
    await ReactTestRenderer.act(() => emit('wordsearch:updated', {
        gameId: game._id,
        reason: 'turn_timeout',
        game: { ...game, currentTurn: 'partner-1', turnExpiresAt: '2026-10-02T10:01:30.000Z', updatedAt: '2026-10-02T10:00:45.000Z' },
    }));
    expect(textExists(card, 'Partner’s turn')).toBe(true);
    expect(textExists(card, 'Your turn')).toBe(false);
    expect(textExists(card, '0:17')).toBe(true);
});

test('partner turns disable the board and stale selections until your turn returns', async () => {
    await mount({ ...game, turnExpiresAt: '2026-10-02T10:00:45.000Z' });
    const oldSubmit = getBoard(renderer).props.onSubmitSelection;
    await ReactTestRenderer.act(() => {
        emit('wordsearch:updated', {
            gameId: game._id, game: {
                ...game, currentTurn: 'partner-1', turnExpiresAt: '2026-10-02T10:01:30.000Z',
                updatedAt: '2026-10-02T10:00:45.000Z',
            },
        });
        oldSubmit({ row: 0, col: 0 }, { row: 0, col: 2 });
    });
    expect(apiFetch).not.toHaveBeenCalled();
    expect(getBoard(renderer).props.canInteractWithBoard).toBe(false);
    const grid = renderer.root.findAllByProps({ testID: 'word-search-letter-grid' })[0];
    expect(grid.props.pointerEvents).toBe('none');
    expect(grid.props.accessibilityState.disabled).toBe(true);
    await ReactTestRenderer.act(() => getBoard(renderer).props.onSubmitSelection({ row: 0, col: 0 }, { row: 0, col: 2 }));
    expect(apiFetch).not.toHaveBeenCalled();

    await ReactTestRenderer.act(() => emit('wordsearch:updated', {
        gameId: game._id, game: {
            ...game, turnExpiresAt: '2026-10-02T10:02:15.000Z', updatedAt: '2026-10-02T10:01:30.000Z',
        },
    }));
    expect(getBoard(renderer).props.canInteractWithBoard).toBe(true);
    expect(grid.props.pointerEvents).toBe('auto');
    expect(grid.props.accessibilityState.disabled).toBe(false);
    apiFetch.mockResolvedValue(response({
        ...getBoard(renderer).props.game, creatorScore: 1,
        words: [{ word: 'ABC', foundBy: 'user-1', start: { row: 0, col: 0 }, end: { row: 0, col: 2 } }],
    }));
    await ReactTestRenderer.act(() => getBoard(renderer).props.onSubmitSelection({ row: 0, col: 0 }, { row: 0, col: 2 }));
    expect(apiFetch).toHaveBeenCalledTimes(1);
});

test.each([
    ['WORD_NOT_FOUND', true],
    ['INVALID_SELECTION', true],
    ['SERVER_ERROR', false],
])('%s adds error haptics only for a rejected selection', async (code, expected) => {
    apiFetch.mockResolvedValue({
        ok: false, json: async () => ({ success: false, code, message: 'Selection failed' }),
    });
    await mount(game);
    await ReactTestRenderer.act(() => getBoard(renderer).props.onSubmitSelection({ row: 0, col: 0 }, { row: 0, col: 2 }));
    const errors = ReactNativeHapticFeedback.trigger.mock.calls.filter(([type]) => type === 'notificationError');
    expect(errors).toHaveLength(expected ? 1 : 0);
    if (expected) {
        expect(ReactNativeHapticFeedback.trigger).toHaveBeenCalledWith('notificationError', {
            enableVibrateFallback: true, ignoreAndroidSystemSettings: false,
        });
    }
});

test('wrong words give immediate local error feedback without blocking the board or sending a request', async () => {
    await mount(game);
    await ReactTestRenderer.act(() => getBoard(renderer).props.onSubmitSelection({ row: 0, col: 1 }, { row: 0, col: 3 }));
    expect(apiFetch).not.toHaveBeenCalled();
    expect(getBoard(renderer).props.submitting).toBe(false);
    expect(getBoard(renderer).props.canInteractWithBoard).toBe(true);
    expect(getBoard(renderer).props.game.creatorScore).toBeUndefined();
    expect(textExists(renderer, 'That is not a hidden word.')).toBe(true);
    expect(ReactNativeHapticFeedback.trigger).toHaveBeenCalledWith('notificationError', {
        enableVibrateFallback: true, ignoreAndroidSystemSettings: false,
    });
});

test('valid reverse selections give instant haptics and score only after server confirmation', async () => {
    const pending = deferred();
    apiFetch.mockReturnValue(pending.promise);
    await mount({ ...game, creatorScore: 0 });
    let selection;
    await ReactTestRenderer.act(() => {
        selection = getBoard(renderer).props.onSubmitSelection({ row: 0, col: 2 }, { row: 0, col: 0 });
    });
    expect(ReactNativeHapticFeedback.trigger).toHaveBeenCalledTimes(1);
    expect(ReactNativeHapticFeedback.trigger).toHaveBeenCalledWith('notificationSuccess', {
        enableVibrateFallback: false, ignoreAndroidSystemSettings: false,
    });
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(getBoard(renderer).props.game.creatorScore).toBe(0);
    const accepted = {
        ...game, creatorScore: 1,
        words: [{ word: 'ABC', foundBy: 'user-1', start: { row: 0, col: 0 }, end: { row: 0, col: 2 } }],
    };
    await ReactTestRenderer.act(async () => {
        pending.resolve(response(accepted));
        await selection;
    });
    expect(getBoard(renderer).props.game.creatorScore).toBe(1);
    expect(ReactNativeHapticFeedback.trigger).toHaveBeenCalledTimes(1);
});

test('local validation reads the latest found words even when a selection callback is stale', async () => {
    await mount({ ...game, words: [...game.words, { word: 'DEF', foundBy: null }] });
    const select = getBoard(renderer).props.onSubmitSelection;
    await ReactTestRenderer.act(() => {
        emit('wordsearch:updated', {
            gameId: game._id, game: {
                ...game, partnerScore: 1, updatedAt: '2026-10-02T10:00:01.000Z',
                words: [
                    { word: 'ABC', foundBy: 'partner-1', start: { row: 0, col: 0 }, end: { row: 0, col: 2 } },
                    { word: 'DEF', foundBy: null },
                ],
            },
        });
        select({ row: 0, col: 0 }, { row: 0, col: 2 });
    });
    expect(apiFetch).not.toHaveBeenCalled();
    expect(textExists(renderer, 'That word was already found.')).toBe(true);
});

test('a selection shorter than three letters gives error haptics without a request', async () => {
    await mount(game);
    await ReactTestRenderer.act(() => getBoard(renderer).props.onSubmitSelection({ row: 0, col: 0 }, { row: 0, col: 1 }));
    expect(ReactNativeHapticFeedback.trigger).toHaveBeenCalledWith('notificationError', {
        enableVibrateFallback: true, ignoreAndroidSystemSettings: false,
    });
    expect(apiFetch).not.toHaveBeenCalled();
});

test('solo play has a score and word list without duel controls or status text', async () => {
    await mount({ ...game, mode: 'single', partnerId: null });
    const content = renderer.root.findByType(ScrollView);
    expect(content.findAllByProps({ testID: 'word-search-turn-timer' })).toHaveLength(0);
    expect(textExists(content, 'Solo')).toBe(true);
    expect(textExists(content, 'Words')).toBe(true);
    expect(textExists(content, 'Partner')).toBe(false);
    expect(textExists(content, 'Keep searching')).toBe(false);
    expect(textExists(content, 'Touch, drag across a word, then release')).toBe(false);
});

test('selection errors show temporary feedback and clear when a new board arrives', async () => {
    await mount(game);
    await ReactTestRenderer.act(() => getBoard(renderer).props.onSubmitSelection({ row: 0, col: 0 }, { row: 0, col: 1 }));
    expect(textExists(renderer, 'Choose a straight or diagonal line of at least 3 letters.')).toBe(true);
    await ReactTestRenderer.act(() => jest.advanceTimersByTime(3500));
    expect(renderer.root.findAllByProps({ testID: 'word-search-error-notice' })).toHaveLength(0);
    await ReactTestRenderer.act(() => getBoard(renderer).props.onSubmitSelection({ row: 0, col: 0 }, { row: 0, col: 1 }));
    expect(textExists(renderer, 'Choose a straight or diagonal line of at least 3 letters.')).toBe(true);
    await ReactTestRenderer.act(() => emit('wordsearch:invited', { game: nextGame }));
    expect(renderer.root.findAllByProps({ testID: 'word-search-error-notice' })).toHaveLength(0);
});

test.each(['duel', 'single'])('a completed %s waits for an explicit new game and keeps its mode', async mode => {
    const completed = { ...game, mode, partnerId: mode === 'single' ? null : game.partnerId, status: 'completed' };
    await mount(completed);
    expect(textExists(renderer, 'Start new game')).toBe(true);
    await ReactTestRenderer.act(() => jest.advanceTimersByTime(60000));
    expect(getBoard(renderer).props.game.status).toBe('completed');
    expect(apiFetch).not.toHaveBeenCalled();
    const started = { ...nextGame, mode, partnerId: completed.partnerId };
    apiFetch.mockResolvedValue(response(started));
    await ReactTestRenderer.act(() => press(renderer, 'Start new game'));
    expect(getBoard(renderer).props.game._id).toBe('game-2');
    expect(apiFetch).toHaveBeenCalledTimes(1);
    const createCall = apiFetch.mock.calls.find(([url]) => url.endsWith('/create'));
    expect(JSON.parse(createCall[1].body)).toMatchObject({ mode, forceNew: false });
});

test('the final word keeps the result even if an older server supplies an automatic rematch', async () => {
    const completed = { ...game, status: 'completed', creatorScore: 1, winner: 'user-1',
        words: [{ word: 'ABC', foundBy: 'user-1', start: { row: 0, col: 0 }, end: { row: 0, col: 2 } }] };
    apiFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, foundWord: 'ABC', data: completed, rematch: nextGame }) });
    await mount(game);
    await ReactTestRenderer.act(() => getBoard(renderer).props.onSubmitSelection({ row: 0, col: 0 }, { row: 0, col: 2 }));
    await ReactTestRenderer.act(() => emit('wordsearch:rematchStarted', { game: nextGame }));
    await ReactTestRenderer.act(() => jest.advanceTimersByTime(60000));
    expect(getBoard(renderer).props.game._id).toBe(game._id);
    expect(getBoard(renderer).props.game.status).toBe('completed');
    expect(textExists(renderer, 'Start new game')).toBe(true);
    expect(apiFetch).toHaveBeenCalledTimes(1);
});

test('socket completion waits for a user-started partner invitation', async () => {
    await mount(game);
    await ReactTestRenderer.act(() => emit('wordsearch:updated', { gameId: game._id, game: { ...game, status: 'completed' } }));
    await ReactTestRenderer.act(() => jest.advanceTimersByTime(60000));
    expect(getBoard(renderer).props.game.status).toBe('completed');
    expect(apiFetch).not.toHaveBeenCalled();
    await ReactTestRenderer.act(() => emit('wordsearch:invited', { game: { ...nextGame, creatorId: 'partner-1', partnerId: 'user-1' } }));
    expect(getBoard(renderer).props.game._id).toBe(nextGame._id);
    expect(textExists(renderer, 'New game started')).toBe(true);
});

test('a failed new-game request preserves the result and allows retry', async () => {
    await mount({ ...game, status: 'completed' });
    apiFetch.mockRejectedValueOnce(new Error('Could not start game.')).mockResolvedValue(response(nextGame));
    await ReactTestRenderer.act(() => press(renderer, 'Start new game'));
    expect(getBoard(renderer).props.game.status).toBe('completed');
    expect(textExists(renderer, 'Could not start game.')).toBe(true);
    await ReactTestRenderer.act(() => press(renderer, 'Start new game'));
    expect(getBoard(renderer).props.game._id).toBe(nextGame._id);
});

test.each(['duel', 'single'])('starting a new %s shows immediate progress until the request finishes', async mode => {
    const pending = deferred();
    apiFetch.mockReturnValue(pending.promise);
    await mount({ ...game, mode, status: 'completed' });
    const button = renderer.root.findByProps({ testID: 'word-search-start-game' });
    await ReactTestRenderer.act(() => press(renderer, 'Start new game'));
    expect(textExists(button, 'Starting game…')).toBe(true);
    expect(button.findAllByType(ActivityIndicator)).toHaveLength(1);
    expect(button.props.disabled).toBe(true);
    expect(button.props.accessibilityState).toEqual({ disabled: true, busy: true });
    expect(getBoard(renderer).props.game.status).toBe('completed');
    await ReactTestRenderer.act(() => button.props.onPress());
    expect(apiFetch).toHaveBeenCalledTimes(1);
    await ReactTestRenderer.act(() => pending.resolve(response({ ...nextGame, mode })));
    expect(getBoard(renderer).props.game._id).toBe(nextGame._id);
    expect(textExists(renderer, 'Starting game…')).toBe(false);
});

test.each(['SERVER_ERROR', 'WORD_SEARCH_FREE_LIMIT_REACHED'])('a pending start clears its progress after %s and enables retry', async code => {
    const pending = deferred();
    apiFetch.mockReturnValue(pending.promise);
    await mount({ ...game, status: 'completed' });
    await ReactTestRenderer.act(() => press(renderer, 'Start new game'));
    expect(textExists(renderer, 'Starting game…')).toBe(true);
    await ReactTestRenderer.act(() => pending.resolve({ ok: false, json: async () => ({ success: false, code, message: 'Could not start game.' }) }));
    const button = renderer.root.findByProps({ testID: 'word-search-start-game' });
    expect(button.props.disabled).toBe(false);
    expect(textExists(button, 'Start new game')).toBe(true);
    expect(button.findAllByType(ActivityIndicator)).toHaveLength(0);
    expect(mockRequestPremium).toHaveBeenCalledTimes(code === 'WORD_SEARCH_FREE_LIMIT_REACHED' ? 1 : 0);
});

test('the last word still awaiting its HTTP confirmation does not show a new-game loading message', async () => {
    const pending = deferred();
    apiFetch.mockReturnValue(pending.promise);
    await mount(game);
    let selection;
    await ReactTestRenderer.act(() => {
        selection = getBoard(renderer).props.onSubmitSelection({ row: 0, col: 0 }, { row: 0, col: 2 });
    });
    const completed = { ...game, status: 'completed', updatedAt: '2026-10-02T10:00:01.000Z' };
    await ReactTestRenderer.act(() => emit('wordsearch:updated', { gameId: game._id, game: completed }));
    expect(textExists(renderer, 'Starting game…')).toBe(false);
    expect(textExists(renderer, 'Start new game')).toBe(true);
    await ReactTestRenderer.act(async () => { pending.resolve(response(completed)); await selection; });
});

test('partner disconnect freezes the timer and waits for the server clock before resuming', async () => {
    const initial = { ...game, turnExpiresAt: '2026-10-02T10:00:45.000Z' };
    const pending = deferred();
    apiFetch.mockReturnValue(pending.promise);
    await mount(initial);
    await ReactTestRenderer.act(() => jest.advanceTimersByTime(12000));
    mockPartnerOnline = false;
    await ReactTestRenderer.act(() => renderer.update(
        <WordSearchScreen navigation={{ goBack: jest.fn() }} route={{ params: { partnerId: 'partner-1', gameData: initial } }} />,
    ));
    expect(textExists(renderer, 'Partner is offline')).toBe(true);
    expect(textExists(renderer, '0:33')).toBe(true);
    expect(getBoard(renderer).props.canInteractWithBoard).toBe(false);
    await ReactTestRenderer.act(() => jest.advanceTimersByTime(60000));
    expect(textExists(renderer, '0:33')).toBe(true);
    expect(apiFetch).not.toHaveBeenCalled();
    await ReactTestRenderer.act(() => getBoard(renderer).props.onSubmitSelection({ row: 0, col: 0 }, { row: 0, col: 2 }));
    expect(apiFetch).not.toHaveBeenCalled();

    mockPartnerOnline = true;
    await ReactTestRenderer.act(() => renderer.update(
        <WordSearchScreen navigation={{ goBack: jest.fn() }} route={{ params: { partnerId: 'partner-1', gameData: initial } }} />,
    ));
    expect(getBoard(renderer).props.canInteractWithBoard).toBe(false);
    expect(textExists(renderer, '0:33')).toBe(true);
    await ReactTestRenderer.act(() => pending.resolve(response({
        ...initial, turnExpiresAt: '2026-10-02T10:01:45.000Z', updatedAt: '2026-10-02T10:01:12.000Z',
    })));
    expect(getBoard(renderer).props.canInteractWithBoard).toBe(true);
    expect(textExists(renderer, 'Your turn')).toBe(true);
    expect(textExists(renderer, 'Partner is offline')).toBe(false);
    await ReactTestRenderer.act(() => jest.advanceTimersByTime(1000));
    expect(textExists(renderer, '0:32')).toBe(true);
});

test('a persisted pause stays frozen across loading and rejects older unpaused snapshots', async () => {
    const paused = {
        ...game, turnPausedAt: '2026-10-02T10:00:12.000Z', turnRemainingMs: 32750,
        turnExpiresAt: null, offlinePlayerIds: ['partner-1'], updatedAt: '2026-10-02T10:00:12.000Z',
    };
    await mount(paused);
    expect(textExists(renderer, 'Partner is offline')).toBe(true);
    expect(textExists(renderer, '0:33')).toBe(true);
    await ReactTestRenderer.act(() => jest.advanceTimersByTime(90000));
    await ReactTestRenderer.act(() => emit('wordsearch:updated', { gameId: game._id, game }));
    expect(getBoard(renderer).props.game.turnPausedAt).toBe(paused.turnPausedAt);
    expect(getBoard(renderer).props.canInteractWithBoard).toBe(false);
    expect(textExists(renderer, '0:33')).toBe(true);
    expect(apiFetch).not.toHaveBeenCalled();
});

test('your own disconnection shows the correct offline message and freezes the timer', async () => {
    const initial = { ...game, turnExpiresAt: '2026-10-02T10:00:45.000Z' };
    await mount(initial);
    await ReactTestRenderer.act(() => jest.advanceTimersByTime(5000));
    mockConnected = false;
    await ReactTestRenderer.act(() => renderer.update(
        <WordSearchScreen navigation={{ goBack: jest.fn() }} route={{ params: { gameData: initial } }} />,
    ));
    expect(textExists(renderer, 'You are offline')).toBe(true);
    await ReactTestRenderer.act(() => jest.advanceTimersByTime(60000));
    expect(textExists(renderer, '0:40')).toBe(true);
    expect(getBoard(renderer).props.canInteractWithBoard).toBe(false);
});

test('paused rematch hides the countdown until the server supplies a resumed start time', async () => {
    const paused = {
        ...game, startsAt: '2026-10-02T10:00:06.000Z', turnPausedAt: '2026-10-02T10:00:02.000Z',
        turnRemainingMs: 45000, startRemainingMs: 4000, turnExpiresAt: null,
        offlinePlayerIds: ['partner-1'], updatedAt: '2026-10-02T10:00:02.000Z',
    };
    await mount(paused);
    expect(textExists(renderer, 'Partner is offline')).toBe(true);
    await ReactTestRenderer.act(() => jest.advanceTimersByTime(60000));
    expect(textExists(renderer, 'GO!')).toBe(false);
    expect(getBoard(renderer).props.canInteractWithBoard).toBe(false);
    await ReactTestRenderer.act(() => emit('wordsearch:updated', {
        gameId: game._id, game: {
            ...paused, turnPausedAt: null, turnRemainingMs: null, startRemainingMs: null, offlinePlayerIds: [],
            startsAt: '2026-10-02T10:01:04.000Z', turnExpiresAt: '2026-10-02T10:01:49.000Z',
            updatedAt: '2026-10-02T10:01:00.000Z',
        },
    }));
    expect(textExists(renderer, '4')).toBe(true);
    await ReactTestRenderer.act(() => jest.advanceTimersByTime(4000));
    expect(textExists(renderer, 'GO!')).toBe(true);
    expect(getBoard(renderer).props.canInteractWithBoard).toBe(true);
});

test('offline partner has a nudge button below the words that sends once and shows sent feedback', async () => {
    mockPartnerOnline = false;
    await mount({
        ...game, turnPausedAt: '2026-10-02T10:00:00.000Z', turnRemainingMs: 45000,
        turnExpiresAt: null, offlinePlayerIds: ['partner-1'],
    });
    const footer = renderer.root.findAllByProps({ testID: 'word-search-offline-nudge' })[0];
    expect(footer).toBeDefined();
    expect(textExists(footer, 'Nudge your partner')).toBe(true);
    expect(renderer.root.findByType(ScrollView).findAllByProps({ testID: 'word-search-offline-nudge' }).length).toBeGreaterThan(0);
    await ReactTestRenderer.act(() => press(renderer, 'Nudge your partner'));
    expect(mockSendNudge).toHaveBeenCalledTimes(1);
    expect(mockSendNudge).toHaveBeenCalledWith('wordsearch');
    expect(textExists(footer, 'Sent')).toBe(true);
    const button = footer.findByType(TouchableOpacity);
    expect(button.props.disabled).toBe(true);
    expect(button.props.accessibilityState).toEqual({ disabled: true });
    await ReactTestRenderer.act(() => button.props.onPress());
    expect(mockSendNudge).toHaveBeenCalledTimes(1);
});

test('nudge below the words disappears when the partner returns and stays hidden when you disconnect', async () => {
    const initial = { ...game, turnExpiresAt: '2026-10-02T10:00:45.000Z' };
    await mount(initial);
    expect(renderer.root.findAllByProps({ testID: 'word-search-offline-nudge' })).toHaveLength(0);
    mockPartnerOnline = false;
    const update = () => renderer.update(
        <WordSearchScreen navigation={{ goBack: jest.fn() }} route={{ params: { partnerId: 'partner-1', gameData: initial } }} />,
    );
    await ReactTestRenderer.act(update);
    expect(renderer.root.findAllByProps({ testID: 'word-search-offline-nudge' }).length).toBeGreaterThan(0);
    apiFetch.mockResolvedValue(response({ ...initial, updatedAt: '2026-10-02T10:00:01.000Z' }));
    mockPartnerOnline = true;
    await ReactTestRenderer.act(update);
    expect(renderer.root.findAllByProps({ testID: 'word-search-offline-nudge' })).toHaveLength(0);
    mockPartnerOnline = false;
    mockConnected = false;
    await ReactTestRenderer.act(update);
    expect(renderer.root.findAllByProps({ testID: 'word-search-offline-nudge' })).toHaveLength(0);
    expect(mockSendNudge).not.toHaveBeenCalled();
});


test.each([
    { creatorId: 'user-1', partnerId: 'partner-1', winner: 'user-1', creatorScore: 5, partnerScore: 3, isDraw: false, title: 'You won. 🎉', score: 'Final score 5–3' },
    { creatorId: 'partner-1', partnerId: 'user-1', winner: 'partner-1', creatorScore: 5, partnerScore: 3, isDraw: false, title: 'You lost. Partner won.', score: 'Final score 3–5' },
    { creatorId: 'user-1', partnerId: 'partner-1', winner: null, creatorScore: 4, partnerScore: 4, isDraw: true, title: 'It’s a draw.', score: 'Final score 4–4' },
])('completion shows "$title" and scores before the board', async ({ title, score, ...result }) => {
    await mount({ ...game, ...result, status: 'completed' });
    const resultCard = renderer.root.findByProps({ testID: 'word-search-result' });
    expect(textExists(resultCard, title)).toBe(true);
    expect(textExists(resultCard, score)).toBe(true);
    expect(textExists(resultCard, 'Start new game')).toBe(true);
    expect(renderer.root.findAllByProps({ testID: 'word-search-score-card' })).toHaveLength(0);
    const content = renderer.root.findByType(ScrollView);
    expect(content.props.children[0].props.testID).toBe('word-search-result');
    expect(content.props.scrollEnabled).toBe(false);
    expect(getBoard(renderer).props.canInteractWithBoard).toBe(false);
    expect(apiFetch).not.toHaveBeenCalled();
});


test('the fourth-game alert appears only on start and keeps the finished result', async () => {
    await mount({ ...game, status: 'completed' });
    expect(mockRequestPremium).not.toHaveBeenCalled();
    apiFetch.mockResolvedValue({ ok: false, json: async () => ({ success: false, code: 'WORD_SEARCH_FREE_LIMIT_REACHED', message: 'Premium required' }) });
    await ReactTestRenderer.act(() => {
        press(renderer, 'Start new game');
        press(renderer, 'Start new game');
    });
    expect(mockRequestPremium).toHaveBeenCalledTimes(1);
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(getBoard(renderer).props.game.status).toBe('completed');
    expect(textExists(renderer, 'Start new game')).toBe(true);
    expect(renderer.root.findAllByProps({ testID: 'word-search-error-notice' })).toHaveLength(0);
    apiFetch.mockResolvedValue(response(nextGame));
    await ReactTestRenderer.act(() => press(renderer, 'Start new game'));
    expect(getBoard(renderer).props.game._id).toBe(nextGame._id);
});

test('reopening after the free limit shows Premium once without automatic retries', async () => {
    mockSavedMode = 'single';
    apiFetch.mockImplementation(url => Promise.resolve(url.endsWith('/create')
        ? { ok: false, json: async () => ({ success: false, code: 'WORD_SEARCH_FREE_LIMIT_REACHED', message: 'Premium required' }) }
        : response(null)));
    await mount();
    await ReactTestRenderer.act(() => jest.advanceTimersByTime(60000));
    expect(mockRequestPremium).toHaveBeenCalledTimes(1);
    expect(apiFetch.mock.calls.filter(([url]) => url.endsWith('/create'))).toHaveLength(1);
    expect(textExists(renderer, 'Premium is required to start another Word Search game.')).toBe(true);
});

test('the real request wrapper shows the Premium alert without signing out', async () => {
    const realApi = jest.requireActual('../../utils/apiFetch');
    const onAuthError = jest.fn();
    const previousFetch = global.fetch;
    realApi.setAuthErrorHandler(onAuthError);
    global.fetch = jest.fn().mockResolvedValue({
        status: 403, ok: false,
        json: async () => ({ success: false, code: 'WORD_SEARCH_FREE_LIMIT_REACHED', message: 'Premium required' }),
    });
    apiFetch.mockImplementation(realApi.apiFetch);
    try {
        await mount({ ...game, status: 'completed' });
        await ReactTestRenderer.act(() => press(renderer, 'Start new game'));
        expect(mockRequestPremium).toHaveBeenCalledTimes(1);
        expect(onAuthError).not.toHaveBeenCalled();
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.fetch.mock.calls[0][0]).toContain('/api/v2/word-search/create');
        expect(getBoard(renderer).props.game.status).toBe('completed');
    } finally {
        realApi.setAuthErrorHandler(null);
        global.fetch = previousFetch;
    }
});

test.each([1, undefined])('legacy HTTP rematches work for protocol %s, including the stable backend', async protocolVersion => {
    const legacy = { ...game, protocolVersion };
    const rematch = { ...nextGame, protocolVersion, creatorId: 'partner-1', partnerId: 'user-1', currentTurn: 'partner-1' };
    apiFetch.mockResolvedValue({ ok: true, json: async () => ({
        success: true, foundWord: 'ABC', data: { ...legacy, status: 'completed', creatorScore: 1 }, rematch,
    }) });
    await mount(legacy);
    await ReactTestRenderer.act(() => getBoard(renderer).props.onSubmitSelection({ row: 0, col: 0 }, { row: 0, col: 2 }));
    expect(getBoard(renderer).props.game._id).toBe(nextGame._id);
    expect(getBoard(renderer).props.game.protocolVersion).toBe(1);
});

test('a mixed-version game follows only its own rematch socket event', async () => {
    await mount({ ...game, protocolVersion: 1 });
    const rematch = { ...nextGame, protocolVersion: 1 };
    await ReactTestRenderer.act(() => emit('wordsearch:rematchStarted', { previousGameId: 'other-game', game: rematch }));
    expect(getBoard(renderer).props.game._id).toBe(game._id);
    await ReactTestRenderer.act(() => emit('wordsearch:rematchStarted', { previousGameId: game._id, game: rematch }));
    expect(getBoard(renderer).props.game._id).toBe(nextGame._id);
    await ReactTestRenderer.act(() => emit('wordsearch:rematchStarted', { previousGameId: game._id, game: { ...rematch, _id: 'stale-game' } }));
    expect(getBoard(renderer).props.game._id).toBe(nextGame._id);
});

test('offline presence does not freeze a legacy shared game on the updated app', async () => {
    const initial = { ...game, protocolVersion: 1, turnExpiresAt: '2026-10-02T10:00:45.000Z' };
    mockPartnerOnline = false;
    await mount(initial);
    expect(getBoard(renderer).props.canInteractWithBoard).toBe(true);
    await ReactTestRenderer.act(() => jest.advanceTimersByTime(12000));
    expect(textExists(renderer, '0:33')).toBe(true);
    expect(textExists(renderer, 'Partner is offline')).toBe(false);
    expect(apiFetch).not.toHaveBeenCalled();
});

test.each([
    ['win', { winner: 'user-1', creatorScore: 5, partnerScore: 3 }],
    ['loss', { winner: 'partner-1', creatorScore: 3, partnerScore: 5 }],
    ['draw', { isDraw: true, creatorScore: 4, partnerScore: 4 }],
    ['solo', { mode: 'single', partnerId: null, winner: 'user-1', creatorScore: 6 }],
])('a live %s plays the result sound once despite duplicate socket updates', async (_result, result) => {
    await mount({ ...game, ...result });
    expect(mockAudioPlayer.startPlayer).not.toHaveBeenCalled();
    const completed = { ...game, ...result, status: 'completed', updatedAt: '2026-10-02T10:00:01.000Z' };
    await ReactTestRenderer.act(() => {
        emit('wordsearch:updated', { gameId: game._id, game: completed });
        emit('wordsearch:updated', { gameId: game._id, game: completed });
        emit('wordsearch:joined', { success: true, game: completed });
    });
    expect(mockAudioPlayer.startPlayer).toHaveBeenCalledTimes(1);
    expect(mockAudioPlayer.startPlayer).toHaveBeenCalledWith('asset:/result.mp3');
    expect(mockAudioPlayer.setVolume).toHaveBeenCalledWith(1);
});

test('HTTP completion plays the result sound and later socket completion does not repeat it', async () => {
    const completed = { ...game, status: 'completed', creatorScore: 1, winner: 'user-1',
        updatedAt: '2026-10-02T10:00:01.000Z',
        words: [{ word: 'ABC', foundBy: 'user-1', start: { row: 0, col: 0 }, end: { row: 0, col: 2 } }] };
    apiFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, foundWord: 'ABC', data: completed }) });
    await mount(game);
    await ReactTestRenderer.act(() => getBoard(renderer).props.onSubmitSelection({ row: 0, col: 0 }, { row: 0, col: 2 }));
    await ReactTestRenderer.act(() => emit('wordsearch:updated', { gameId: game._id, game: completed }));
    expect(mockAudioPlayer.startPlayer).toHaveBeenCalledTimes(1);
});

test('a legacy rematch cannot hide its immediately preceding completion sound', async () => {
    await mount({ ...game, protocolVersion: 1 });
    await ReactTestRenderer.act(() => {
        emit('wordsearch:updated', { gameId: game._id, game: {
            ...game, protocolVersion: 1, status: 'completed', updatedAt: '2026-10-02T10:00:01.000Z',
        } });
        emit('wordsearch:rematchStarted', { previousGameId: game._id, game: { ...nextGame, protocolVersion: 1 } });
    });
    expect(getBoard(renderer).props.game._id).toBe(nextGame._id);
    expect(mockAudioPlayer.startPlayer).toHaveBeenCalledTimes(1);
});

test('reopening a finished result does not replay the completion sound', async () => {
    await mount({ ...game, status: 'completed' });
    await ReactTestRenderer.act(() => emit('wordsearch:joined', { success: true, game: { ...game, status: 'completed' } }));
    expect(mockAudioPlayer.startPlayer).not.toHaveBeenCalled();
});

test('unmount cancels a completion sound still waiting for its player', async () => {
    const pending = deferred();
    mockAudioPlayer.stopPlayer.mockReturnValueOnce(pending.promise);
    await mount(game);
    await ReactTestRenderer.act(() => emit('wordsearch:updated', { gameId: game._id, game: { ...game, status: 'completed' } }));
    await ReactTestRenderer.act(() => renderer.unmount());
    renderer = null;
    await ReactTestRenderer.act(() => pending.resolve());
    expect(mockAudioPlayer.startPlayer).not.toHaveBeenCalled();
    expect(mockAudioPlayer.stopPlayer).toHaveBeenCalledTimes(2);
});
