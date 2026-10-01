/* eslint-env jest */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { GestureDetector, State } from 'react-native-gesture-handler';
import { fireGestureHandler } from 'react-native-gesture-handler/jest-utils';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { WordSearchBoard } from '../WordSearchScreen';

jest.mock('react-native-haptic-feedback', () => ({ trigger: jest.fn() }));
jest.mock('react-native-confetti-cannon', () => () => null);
jest.mock('react-native-linear-gradient', () => ({ children }) => children);
jest.mock('../../context/SocketContext', () => ({ useSocketContext: () => ({}) }));
jest.mock('../../hooks/usePresence', () => ({ __esModule: true, default: () => ({}) }));
jest.mock('../../i18n/uiTranslation', () => ({
    translateUiText: text => text,
    translateUiTemplate: template => template,
}));
jest.mock('../../utils/apiFetch', () => ({ apiFetch: jest.fn() }));
jest.mock('lucide-react-native', () => {
    const Icon = () => null;
    return Object.fromEntries(
        ['Bell', 'Check', 'ChevronLeft', 'HelpCircle', 'LogOut', 'MoreVertical', 'RotateCcw', 'Swords', 'Timer', 'User', 'X']
            .map(name => [name, Icon]),
    );
});
jest.mock('../../utils/authStorage', () => ({ getUser: jest.fn(), storage: { getString: jest.fn() } }));

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
                myTurn
                message=""
                turnCountdown={null}
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
    expect(ReactNativeHapticFeedback.trigger.mock.calls.filter(([type]) => type === 'selection')).toHaveLength(2);
    await ReactTestRenderer.act(() => renderer.unmount());
    nowSpy.mockRestore();
});
