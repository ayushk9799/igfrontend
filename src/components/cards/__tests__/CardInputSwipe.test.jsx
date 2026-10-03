/* eslint-env jest */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Platform, TextInput as NativeTextInput, TouchableOpacity } from 'react-native';
import { GestureDetector, ScrollView, TextInput } from 'react-native-gesture-handler';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import AnimatedCardStack from '../AnimatedCardStack';

jest.mock('react-native-reanimated', () => ({
    ...require('react-native-reanimated/mock'),
    useReducedMotion: () => false,
}));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light' } }));
jest.mock('react-native-linear-gradient', () => ({ children }) => children);
jest.mock('react-native-svg', () => ({
    __esModule: true,
    default: ({ children }) => children,
    Path: () => null,
    Circle: () => null,
}));
jest.mock('../../../i18n/uiTranslation', () => ({ translateUiText: text => text }));
jest.mock('../LikelyToCard', () => () => null);
jest.mock('../NeverHaveIEverCard', () => () => null);
jest.mock('../TakePhotoCard', () => () => null);
jest.mock('../SliderCard', () => () => null);
jest.mock('../VoiceRecordCard', () => () => null);
jest.mock('../ChoiceQuestionCard', () => () => null);
jest.mock('../PremiumLockOverlay', () => () => null);
jest.mock('react-native-keyboard-controller', () => ({
    KeyboardAwareScrollView: ({ ScrollViewComponent, children, ...props }) => {
        const ReactModule = require('react');
        return ReactModule.createElement(ScrollViewComponent, props, children);
    },
}));

afterEach(() => jest.restoreAllMocks());

test.each(['ios', 'android'])('%s input shares the deck swipe while remaining editable', async os => {
    jest.replaceProperty(Platform, 'OS', os);
    const onAnswerSubmit = jest.fn();
    const onIndexChange = jest.fn();
    let renderer;

    await ReactTestRenderer.act(() => {
        renderer = ReactTestRenderer.create(
            <AnimatedCardStack
                tasks={[{ _id: 'deep-1', category: 'deep', taskstatement: 'What matters to you?', originalIndex: 4 }]}
                currentIndex={0}
                hasPartner
                autoAdvanceOnSubmit={false}
                onAnswerSubmit={onAnswerSubmit}
                onIndexChange={onIndexChange}
            />,
        );
    });

    const gesture = renderer.root.findByType(GestureDetector).props.gesture;
    const input = renderer.root.findByType(TextInput);
    // The native input must recognize touches alongside the actual deck gesture.
    expect(input.props.simultaneousHandlers).toBe(gesture.config.ref);
    expect(gesture.config.ref.current).toBe(gesture);
    expect(gesture.config.activeOffsetXStart).toBeLessThan(0);
    expect(gesture.config.activeOffsetXEnd).toBeGreaterThan(0);
    expect(gesture.config.failOffsetYStart).toBeLessThan(0);
    expect(gesture.config.failOffsetYEnd).toBeGreaterThan(0);

    if (os === 'android') {
        const keyboardScroll = renderer.root.findByType(KeyboardAwareScrollView);
        expect(keyboardScroll.props.ScrollViewComponent).toBe(ScrollView);
        expect(keyboardScroll.props.simultaneousHandlers).toBe(gesture.config.ref);
        expect(keyboardScroll.props.disallowInterruption).toBe(false);
    }

    await ReactTestRenderer.act(() => {
        input.props.onFocus();
        renderer.root.findByType(NativeTextInput).props.onChangeText('  Time together  ');
    });

    await ReactTestRenderer.act(() => {
        gesture.handlers.onUpdate({ translationX: -24, translationY: 0 });
        gesture.handlers.onEnd({ translationX: -24, translationY: 0, velocityX: 0, velocityY: 0 }, true);
    });

    expect(onIndexChange).not.toHaveBeenCalled();
    expect(renderer.root.findByType(NativeTextInput).props.value).toBe('  Time together  ');

    await ReactTestRenderer.act(() => {
        const submit = renderer.root.findAllByType(TouchableOpacity)
            .find(button => button.props.disabled === false);
        submit.props.onPress();
    });

    expect(onAnswerSubmit).toHaveBeenCalledWith(4, 'Time together');
    await ReactTestRenderer.act(() => renderer.unmount());
});
