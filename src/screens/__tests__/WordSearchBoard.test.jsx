/* eslint-env jest */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { AccessibilityInfo, Platform } from 'react-native';
import { GestureDetector, State } from 'react-native-gesture-handler';
import { fireGestureHandler } from 'react-native-gesture-handler/jest-utils';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { WordSearchBoard } from '../WordSearchScreen';

jest.mock('react-native-haptic-feedback', () => ({ trigger: jest.fn() }));
jest.mock('react-native-confetti-cannon', () => () => null);
jest.mock('../../utils/safeAudioPlayer', () => ({ createSafeAudioPlayer: () => null }));
jest.mock('react-native-linear-gradient', () => ({ children }) => children);
jest.mock('../../context/SocketContext', () => ({ useSocketContext: () => ({}) }));
jest.mock('../../hooks/usePresence', () => ({ __esModule: true, default: () => ({}) }));
jest.mock('../../i18n/uiTranslation', () => ({
    translateUiText: text => text,
    translateUiTemplate: (template, values) => template.replace(/\{\{(\d+)\}\}/g, (_, index) => values[index]),
}));
jest.mock('../../utils/apiFetch', () => ({ apiFetch: jest.fn() }));
jest.mock('lucide-react-native', () => {
    const Icon = () => null;
    return Object.fromEntries(
        ['Bell', 'Check', 'ChevronLeft', 'HelpCircle', 'LogOut', 'MoreVertical', 'RotateCcw', 'Swords', 'Timer', 'User', 'X']
            .map(name => [name, Icon]),
    );
});

test('screen reader users select endpoints and cannot submit while the board is locked', async () => {
    const enabledSpy = jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
    const onSubmitSelection = jest.fn().mockResolvedValue(undefined);
    const onMessage = jest.fn();
    const announceSpy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
    const game = {
        _id: 'game-1', mode: 'single', status: 'active', gridSize: 8,
        grid: Array(8).fill('ABCDEFGH'), words: [{ word: 'ABC', foundBy: null }],
    };
    const props = {
        game, cellSize: 32, userId: 'user-1', canInteractWithBoard: true,
        submitting: false,
        onSubmitSelection, onMessage,
    };
    let renderer;
    await ReactTestRenderer.act(() => { renderer = ReactTestRenderer.create(<WordSearchBoard {...props} />); });
    const cell = label => renderer.root.findAllByProps({ accessibilityLabel: label }).find(node => typeof node.props.onPress === 'function');
    await ReactTestRenderer.act(() => cell('A, row 1, column 1').props.onPress());
    expect(announceSpy).toHaveBeenCalledWith('Now choose the last letter.');
    expect(onMessage).not.toHaveBeenCalled();
    expect(cell('A, row 1, column 1').props.accessibilityState.selected).toBe(true);
    await ReactTestRenderer.act(() => cell('C, row 1, column 3').props.onPress());
    expect(onSubmitSelection).toHaveBeenCalledWith({ row: 0, col: 0 }, { row: 0, col: 2 });

    await ReactTestRenderer.act(() => cell('A, row 1, column 1').props.onPress());
    await ReactTestRenderer.act(() => cell('C, row 2, column 3').props.onPress());
    expect(onSubmitSelection).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenLastCalledWith('Choose a straight or diagonal line of at least 3 letters.');

    await ReactTestRenderer.act(() => renderer.update(<WordSearchBoard {...props} canInteractWithBoard={false} />));
    expect(cell('A, row 1, column 1').props.disabled).toBe(true);
    await ReactTestRenderer.act(() => cell('A, row 1, column 1').props.onPress());
    expect(onSubmitSelection).toHaveBeenCalledTimes(1);
    await ReactTestRenderer.act(() => renderer.unmount());
    enabledSpy.mockRestore();
});
jest.mock('../../utils/authStorage', () => ({ getUser: jest.fn(), storage: { getString: jest.fn() } }));

beforeEach(() => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
});

afterEach(() => jest.restoreAllMocks());

test.each([
    ['horizontal', { x: 22, y: 22 }, { x: 86, y: 22 }, { row: 0, col: 0 }, { row: 0, col: 2 }],
    ['diagonal', { x: 22, y: 22 }, { x: 86, y: 86 }, { row: 0, col: 0 }, { row: 2, col: 2 }],
    ['reverse', { x: 86, y: 22 }, { x: 22, y: 22 }, { row: 0, col: 2 }, { row: 0, col: 0 }],
])('%s drag submits its selected endpoints', async (_direction, first, last, start, end) => {
    ReactNativeHapticFeedback.trigger.mockClear();
    let clock = 0;
    const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => {
        clock += 100;
        return clock;
    });
    const onSubmitSelection = jest.fn().mockResolvedValue(undefined);
    const game = {
        _id: 'game-1',
        mode: 'single',
        status: 'active',
        gridSize: 8,
        grid: Array(8).fill('ABCDEFGH'),
        words: [{ word: 'ABC', foundBy: null }],
    };
    let renderer;
    await ReactTestRenderer.act(() => {
        renderer = ReactTestRenderer.create(
            <WordSearchBoard
                game={game}
                cellSize={32}
                userId="user-1"
                canInteractWithBoard
                submitting={false}
                onSubmitSelection={onSubmitSelection}
                onMessage={jest.fn()}
            />,
        );
    });

    const gesture = renderer.root.findByType(GestureDetector).props.gesture;
    await ReactTestRenderer.act(() => {
        fireGestureHandler(gesture, [
            { state: State.BEGAN, ...first },
            { state: State.ACTIVE, ...first },
            { state: State.ACTIVE, ...last },
            { state: State.END, ...last },
        ]);
    });

    expect(onSubmitSelection).toHaveBeenCalledWith(start, end);
    expect(ReactNativeHapticFeedback.trigger.mock.calls.filter(([type]) => type === (Platform.OS === 'ios' ? 'impactMedium' : 'selection'))).toHaveLength(2);
    await ReactTestRenderer.act(() => renderer.unmount());
    nowSpy.mockRestore();
});

test.each(['ios', 'android'])('%s gives feedback on touch-down and crossing letters before release', async platform => {
    jest.replaceProperty(Platform, 'OS', platform);
    let now = 1000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    ReactNativeHapticFeedback.trigger.mockClear();
    const onSubmitSelection = jest.fn().mockResolvedValue(undefined);
    let renderer;
    await ReactTestRenderer.act(() => {
        renderer = ReactTestRenderer.create(<WordSearchBoard
            game={{ mode: 'single', status: 'active', gridSize: 8, grid: Array(8).fill('ABCDEFGH'), words: [{ word: 'ABC', foundBy: null }] }}
            cellSize={32} userId="user-1" canInteractWithBoard submitting={false}
            onSubmitSelection={onSubmitSelection} onMessage={jest.fn()}
        />);
    });
    const callbacks = renderer.root.findByType(GestureDetector).props.gesture.handlers;
    const type = platform === 'ios' ? 'impactMedium' : 'selection';
    await ReactTestRenderer.act(() => callbacks.onBegin({ x: 22, y: 22 }));
    expect(ReactNativeHapticFeedback.trigger).toHaveBeenCalledWith(type, {
        enableVibrateFallback: false, ignoreAndroidSystemSettings: false,
    });
    expect(onSubmitSelection).not.toHaveBeenCalled();
    now += 60;
    await ReactTestRenderer.act(() => callbacks.onUpdate({ x: 54, y: 22 }));
    expect(ReactNativeHapticFeedback.trigger).toHaveBeenCalledTimes(2);
    now += 10;
    await ReactTestRenderer.act(() => callbacks.onUpdate({ x: 54, y: 22 }));
    expect(ReactNativeHapticFeedback.trigger).toHaveBeenCalledTimes(2);
    now += 60;
    await ReactTestRenderer.act(() => callbacks.onUpdate({ x: 86, y: 22 }));
    expect(ReactNativeHapticFeedback.trigger).toHaveBeenCalledTimes(3);
    expect(onSubmitSelection).not.toHaveBeenCalled();
    await ReactTestRenderer.act(() => callbacks.onEnd({ x: 86, y: 22 }));
    expect(onSubmitSelection).toHaveBeenCalledWith({ row: 0, col: 0 }, { row: 0, col: 2 });
    await ReactTestRenderer.act(() => renderer.unmount());
});
