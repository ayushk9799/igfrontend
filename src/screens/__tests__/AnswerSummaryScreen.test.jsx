/* eslint-env jest */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Image, Modal, Text, TouchableOpacity } from 'react-native';
import AnswerSummaryScreen from '../AnswerSummaryScreen';
import { getCoupleAnswers } from '../../utils/answerApi';
import { apiFetch } from '../../utils/apiFetch';
import { ChatInput } from '../../components/chat';
import VoiceBubble from '../../components/chat/VoiceBubble';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 20 }) }));
jest.mock('react-native-linear-gradient', () => ({ children }) => children);
jest.mock('react-native-svg', () => ({ __esModule: true, default: () => null, Path: () => null }));
jest.mock('react-native-keyboard-controller', () => {
    const { View } = require('react-native');
    return { KeyboardAvoidingView: ({ children }) => <View>{children}</View> };
});
jest.mock('lucide-react-native', () => Object.fromEntries([
    'ChevronLeft', 'ChevronRight', 'Lock', 'Bell', 'Sparkles', 'MessageCircle', 'Check', 'X', 'Maximize2',
].map(name => [name, () => null])));
jest.mock('expo-blur', () => ({ BlurView: () => null }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' } }));
jest.mock('../../components/chat', () => ({ ChatInput: () => null }));
jest.mock('../../components/chat/VoiceBubble', () => () => null);
jest.mock('../../utils/answerApi', () => ({ getCoupleAnswers: jest.fn() }));
jest.mock('../../utils/apiFetch', () => ({ apiFetch: jest.fn() }));
jest.mock('../../constants/Api', () => ({ API_BASE: 'https://example.com' }));
jest.mock('../../i18n/uiTranslation', () => ({
    translateUiText: text => text,
    translateUiTemplate: (text, values) => text.replace(/\{\{(\d+)\}\}/g, (_, index) => values[index]),
    getUiLocale: () => 'en-US',
}));
jest.mock('../../utils/dateUtils', () => ({ formatDisplayDate: () => 'Oct 2, 2026', isToday: () => true }));

let renderer;
const makeData = () => ({
    challenge: {
        _id: 'ritual-1',
        tasks: ['deep', 'likelyto', 'neverhaveiever', 'takephoto', 'slider', 'voicerecord'].map((category, index) => ({
            _id: `task-${index}`, category, taskstatement: `Question ${index + 1}`, minValue: 1, maxValue: 10,
        })),
    },
    user: {
        userId: { _id: 'user-1', name: 'Rajiv', avatar: 'https://example.com/user-avatar.jpg' },
        isComplete: true,
        answers: ['My reflection', 'you', 'I have', 'https://example.com/my-photo.jpg', 5, 'https://example.com/my-voice.m4a']
            .map(value => ({ value })),
    },
    partner: {
        userId: { _id: 'partner-1', name: 'Partner', avatar: 'https://example.com/partner-avatar.jpg' },
        isComplete: true,
        answers: ['Partner reflection', 'partner', 'Never', 'https://example.com/partner-photo.jpg', 5, 'https://example.com/partner-voice.m4a']
            .map(value => ({ value })),
    },
    bothComplete: true,
    chat: { _id: 'ritual-chat', messages: [] },
});

const mount = async (data, props = {}) => {
    getCoupleAnswers.mockResolvedValue({ success: true, data });
    await ReactTestRenderer.act(async () => {
        renderer = ReactTestRenderer.create(
            <AnswerSummaryScreen date="2026-10-02" userId="user-1" partnerName="Partner" {...props} />,
        );
    });
};
const visibleText = () => renderer.root.findAllByType(Text).map(node => node.props.children);
const imageUris = () => renderer.root.findAllByType(Image).map(node => node.props.source?.uri);
const action = label => renderer.root.findAllByType(TouchableOpacity).find(node => node.props.accessibilityLabel === label);

beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    apiFetch.mockResolvedValue({ json: async () => ({ success: true }) });
});
afterEach(async () => {
    if (renderer) await ReactTestRenderer.act(() => renderer.unmount());
    renderer = undefined;
    jest.clearAllTimers();
    jest.useRealTimers();
});

test('completed rituals show answers, ME / You labels, profile avatars, and the shared rating marker', async () => {
    await mount(makeData());
    expect(visibleText()).toEqual(expect.arrayContaining([
        'My reflection', 'Partner reflection', 'ME', 'You', 'I have', 'Never', 'Not at all', 'Absolutely',
    ]));
    expect(imageUris()).toEqual(expect.arrayContaining([
        'https://example.com/user-avatar.jpg', 'https://example.com/partner-avatar.jpg',
        'https://example.com/my-photo.jpg', 'https://example.com/partner-photo.jpg',
    ]));
    expect(renderer.root.findAllByType(VoiceBubble).map(node => node.props.audioUri)).toEqual([
        'https://example.com/partner-voice.m4a', 'https://example.com/my-voice.m4a',
    ]);
    await ReactTestRenderer.act(() => renderer.root.findByProps({ testID: 'slider-plot-task-4' }).props.onLayout({
        nativeEvent: { layout: { width: 232 } },
    }));
    expect(renderer.root.findByProps({ testID: 'rating-marker-shared' })).toBeTruthy();
});

test('partner text, media, and rating stay hidden until the user completes the ritual', async () => {
    const data = makeData();
    data.bothComplete = false;
    data.user.isComplete = false;
    data.user.answers.pop();
    const onStartDailyChallenge = jest.fn();
    await mount(data, { onStartDailyChallenge });
    expect(visibleText()).not.toContain('Partner reflection');
    expect(visibleText()).toContain('Answer to reveal');
    expect(imageUris()).not.toContain('https://example.com/partner-photo.jpg');
    expect(renderer.root.findAllByType(VoiceBubble)).toHaveLength(0);
    await ReactTestRenderer.act(() => renderer.root.findByProps({ testID: 'slider-plot-task-4' }).props.onLayout({
        nativeEvent: { layout: { width: 232 } },
    }));
    expect(renderer.root.findAllByProps({ testID: 'rating-marker-partner' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ testID: 'rating-marker-shared' })).toHaveLength(0);
    await ReactTestRenderer.act(() => action('Tap to record').props.onPress());
    expect(onStartDailyChallenge).toHaveBeenCalledTimes(1);
});

test.each([true, false])('unfinished partner ritual shows waiting placeholders when user completion is %s', async (userComplete) => {
    const data = makeData();
    data.bothComplete = false;
    data.partner.isComplete = false;
    data.partner.answers = data.partner.answers.slice(0, 1);
    data.user.isComplete = userComplete;
    if (!userComplete) data.user.answers.pop();
    await mount(data);
    expect(visibleText().filter(text => text === 'Waiting for partner response...')).toHaveLength(data.challenge.tasks.length);
    expect(visibleText()).not.toContain('Hidden');
    expect(visibleText()).not.toContain('Answer to reveal');
    expect(visibleText()).not.toContain('Partner reflection');
});

test('zero is retained as a submitted rating and counts toward completing the ritual', async () => {
    const data = makeData();
    data.challenge.tasks = [{ _id: 'zero-task', category: 'slider', taskstatement: 'Rate this', minValue: 0, maxValue: 9 }];
    data.bothComplete = false;
    data.user.isComplete = false;
    data.partner.isComplete = false;
    data.user.answers = [{ value: 0 }];
    data.partner.answers = [{ value: 0 }];
    await mount(data);
    await ReactTestRenderer.act(() => renderer.root.findByProps({ testID: 'slider-plot-zero-task' }).props.onLayout({
        nativeEvent: { layout: { width: 232 } },
    }));
    expect(renderer.root.findByProps({ testID: 'rating-marker-shared' })).toBeTruthy();
    expect(visibleText()).not.toContain('Hidden');
    expect(visibleText()).toContain(0);
});

test('photos still open in the full screen viewer', async () => {
    await mount(makeData());
    const photoButton = renderer.root.findAllByType(TouchableOpacity).find(node => (
        node.props.accessibilityLabel === 'Open this memory'
        && node.findAllByType(Image).some(img => img.props.source?.uri === 'https://example.com/my-photo.jpg')
    ));
    await ReactTestRenderer.act(() => photoButton.props.onPress());
    expect(renderer.root.findByType(Modal).props.visible).toBe(true);
    expect(renderer.root.findAllByType(Image).some(node => (
        node.props.resizeMode === 'contain' && node.props.source?.uri === 'https://example.com/my-photo.jpg'
    ))).toBe(true);
});

test('daily ritual uses the discussion on this screen without per-question chat links', async () => {
    const data = makeData();
    await mount(data);
    expect(action('Discuss in chat')).toBeUndefined();
    expect(visibleText()).not.toContain('Discuss in chat');
    expect(visibleText()).toContain('Ritual Discussion');
    await ReactTestRenderer.act(async () => renderer.root.findByType(ChatInput).props.onSend('A lovely ritual'));
    expect(apiFetch).toHaveBeenCalledWith('https://example.com/api/chat/ritual-chat/message', expect.objectContaining({
        method: 'POST', body: JSON.stringify({ userId: 'user-1', content: 'A lovely ritual', messageType: 'text' }),
    }));
    expect(visibleText()).toContain('A lovely ritual');
});

test('loading the summary marks the displayed ritual chat as read for the current user', async () => {
    const data = makeData();
    data.chat.messages = [{
        _id: 'partner-message', senderId: 'partner-1', content: 'Hello from your partner',
        messageType: 'text', createdAt: '2026-10-02T08:00:00Z',
    }];
    await mount(data);
    expect(visibleText()).toContain('Hello from your partner');
    expect(apiFetch).toHaveBeenCalledTimes(1);
    expect(apiFetch).toHaveBeenCalledWith('https://example.com/api/chat/ritual-chat/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'user-1' }),
    });
});

test('a summary without a chat does not send a read request', async () => {
    const data = makeData();
    data.chat = null;
    await mount(data);
    expect(apiFetch).not.toHaveBeenCalled();
});

test('a failed read request leaves the ritual summary visible', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
        apiFetch.mockRejectedValueOnce(new Error('Connection failed'));
        await mount(makeData());
        expect(visibleText()).toContain('Partner reflection');
        expect(warn).toHaveBeenCalledWith('Failed to mark ritual chat as read:', expect.any(Error));
    } finally {
        warn.mockRestore();
    }
});

test.each([
    ['you', 'partner', true],
    ['partner', 'you', true],
    ['you', 'you', false],
    ['partner', 'partner', false],
])('Likely To match results compare the chosen person (%s, %s)', async (userChoice, partnerChoice, samePerson) => {
    const data = makeData();
    data.challenge.tasks = [{ _id: 'likely-task', category: 'likelyto', taskstatement: 'Who would plan a trip?' }];
    data.user.answers = [{ value: userChoice }];
    data.partner.answers = [{ value: partnerChoice }];
    await mount(data);
    expect(visibleText().some(text => typeof text === 'string' && text.includes('Matches!'))).toBe(samePerson);
});
