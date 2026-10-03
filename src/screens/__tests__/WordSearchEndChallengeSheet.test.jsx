/* eslint-env jest */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { StyleSheet, Text } from 'react-native';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import WordSearchScreen from '../WordSearchScreen';
import { apiFetch } from '../../utils/apiFetch';

const mockSocket = { on: jest.fn(), off: jest.fn(), emit: jest.fn() };
let mockPartnerOnline = true;

jest.mock('react-native-haptic-feedback', () => ({ trigger: jest.fn() }));
jest.mock('react-native-confetti-cannon', () => () => null);
jest.mock('../../utils/safeAudioPlayer', () => ({ createSafeAudioPlayer: () => null }));
jest.mock('react-native-linear-gradient', () => ({ children }) => children);
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('../../context/SocketContext', () => ({ useSocketContext: () => ({ socket: mockSocket }) }));
jest.mock('../../hooks/usePresence', () => {
    const refreshPresence = jest.fn();
    return { __esModule: true, default: () => ({ partnerOnline: mockPartnerOnline, isConnected: true, refreshPresence, sendNudge: jest.fn() }) };
});
jest.mock('../../i18n/uiTranslation', () => ({
    translateUiText: text => text,
    translateUiTemplate: (template, values) => template.replace('{{0}}', values[0]),
}));
jest.mock('../../utils/apiFetch', () => ({ apiFetch: jest.fn() }));
jest.mock('lucide-react-native', () => {
    const Icon = () => null;
    return Object.fromEntries(
        ['Bell', 'Check', 'ChevronLeft', 'HelpCircle', 'LogOut', 'MoreVertical', 'RotateCcw', 'Swords', 'Timer', 'User', 'X']
            .map(name => [name, Icon]),
    );
});
jest.mock('../../utils/authStorage', () => ({
    getUser: () => ({ id: 'user-1' }),
    storage: { getString: () => null, set: jest.fn() },
}));

const game = {
    _id: 'game-1', protocolVersion: 2,
    creatorId: 'user-1',
    partnerId: 'partner-1',
    mode: 'duel',
    status: 'active',
    gridSize: 8,
    grid: Array(8).fill('ABCDEFGH'),
    words: [{ word: 'ABC', foundBy: null }],
    totalWords: 1,
    foundCount: 0,
};

const pressText = (renderer, label) => {
    const text = renderer.root.findAllByType(Text).find(node => node.props.children === label);
    expect(text).toBeDefined();
    let button = text.parent;
    while (button && typeof button.props.onPress !== 'function') button = button.parent;
    expect(button).toBeDefined();
    button.props.onPress();
};

test('confirmation sheet cancels safely and preserves selected settings on confirm', async () => {
    apiFetch.mockReset();
    mockSocket.on.mockClear();
    apiFetch.mockImplementation(url => Promise.resolve({
        ok: true,
        json: async () => url.endsWith('/abandon')
            ? { success: true, data: { status: 'abandoned' } }
            : { success: true, data: { ...game, _id: 'game-2' } },
    }));

    let renderer;
    await ReactTestRenderer.act(() => {
        renderer = ReactTestRenderer.create(
            <WordSearchScreen
                navigation={{ goBack: jest.fn() }}
                route={{ params: { partnerId: 'partner-1', partnerName: 'Partner', gameData: game } }}
            />,
        );
    });
    const presenceHandler = mockSocket.on.mock.calls.find(([event]) => event === 'presence:status')[1];
    await ReactTestRenderer.act(() => presenceHandler());
    const sheets = renderer.root.findAllByType(BottomSheetModal);
    const settingsSheet = sheets[0].instance;
    const confirmationSheet = sheets[1].instance;
    const presentConfirmation = jest.spyOn(confirmationSheet, 'present');
    const dismissConfirmation = jest.spyOn(confirmationSheet, 'dismiss');
    jest.spyOn(settingsSheet, 'dismiss').mockImplementation(() => settingsSheet.props.onDismiss?.());

    await ReactTestRenderer.act(() => pressText(renderer, 'Hard'));
    await ReactTestRenderer.act(() => pressText(renderer, 'Start Fresh Puzzle'));
    expect(presentConfirmation).toHaveBeenCalledTimes(1);
    await ReactTestRenderer.act(() => pressText(renderer, 'Keep playing'));
    expect(dismissConfirmation).toHaveBeenCalledTimes(1);
    expect(apiFetch).not.toHaveBeenCalled();

    await ReactTestRenderer.act(() => pressText(renderer, 'Start Fresh Puzzle'));
    expect(presentConfirmation).toHaveBeenCalledTimes(2);
    await ReactTestRenderer.act(() => pressText(renderer, 'Start new'));
    expect(dismissConfirmation).toHaveBeenCalledTimes(2);
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(apiFetch.mock.calls[0][0]).toContain('/create');
    expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toMatchObject({ difficulty: 'hard', mode: 'duel', forceNew: true, replaceGameId: 'game-1' });

    await ReactTestRenderer.act(() => renderer.unmount());
});

test('changing mode keeps the offline note space in the options sheet', async () => {
    mockPartnerOnline = false;
    let renderer;
    await ReactTestRenderer.act(() => {
        renderer = ReactTestRenderer.create(
            <WordSearchScreen
                navigation={{ goBack: jest.fn() }}
                route={{ params: { partnerId: 'partner-1', partnerName: 'Partner', gameData: game } }}
            />,
        );
    });

    const getOfflineNote = () => renderer.root.findAllByType(Text)
        .find(node => node.props.children === 'Partner is offline, so the next puzzle will be solo.');
    expect(StyleSheet.flatten(getOfflineNote().props.style).opacity).toBe(0);

    await ReactTestRenderer.act(() => pressText(renderer, 'Duel'));
    expect(getOfflineNote()).toBeDefined();
    expect(StyleSheet.flatten(getOfflineNote().props.style).opacity).toBeUndefined();

    await ReactTestRenderer.act(() => pressText(renderer, 'Solo'));
    expect(StyleSheet.flatten(getOfflineNote().props.style).opacity).toBe(0);

    await ReactTestRenderer.act(() => renderer.unmount());
    mockPartnerOnline = true;
});


test('a blocked fresh puzzle shows Premium without abandoning the current game', async () => {
    const onRequestPremium = jest.fn();
    apiFetch.mockReset();
    mockPartnerOnline = true;
    apiFetch.mockResolvedValue({ ok: false, json: async () => ({
        success: false, code: 'WORD_SEARCH_FREE_LIMIT_REACHED', message: 'Premium required',
    }) });
    let renderer;
    await ReactTestRenderer.act(() => {
        renderer = ReactTestRenderer.create(<WordSearchScreen
            navigation={{ goBack: jest.fn() }}
            route={{ params: { partnerId: 'partner-1', partnerName: 'Partner', gameData: game } }}
            onRequestPremium={onRequestPremium}
        />);
    });
    const settingsSheet = renderer.root.findAllByType(BottomSheetModal)[0].instance;
    jest.spyOn(settingsSheet, 'dismiss').mockImplementation(() => settingsSheet.props.onDismiss?.());
    await ReactTestRenderer.act(() => pressText(renderer, 'Start Fresh Puzzle'));
    await ReactTestRenderer.act(() => pressText(renderer, 'Start new'));
    expect(onRequestPremium).toHaveBeenCalledTimes(1);
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(apiFetch.mock.calls[0][0]).toContain('/create');
    expect(renderer.root.findAllByProps({ testID: 'word-search-score-card' }).length).toBeGreaterThan(0);
    expect(renderer.root.findAllByProps({ testID: 'word-search-error-notice' })).toHaveLength(0);
    await ReactTestRenderer.act(() => renderer.unmount());
});
