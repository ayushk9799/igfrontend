/* eslint-env jest */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { TouchableOpacity, View } from 'react-native';
import ChatListScreen from '../ChatListScreen';
import { storage } from '../../utils/authStorage';
import { QuestionChatsV2Api } from '../../api/questionsV2Api';

const mockStoredValues = new Map();

jest.mock('react-native-safe-area-context', () => ({
    useSafeAreaInsets: () => ({ top: 24, bottom: 20 }),
}));
jest.mock('react-native-linear-gradient', () => ({ children }) => children);
jest.mock('lucide-react-native', () => ({ Video: () => null }));
jest.mock('../../components/GradientBackground', () => ({ children }) => children);
jest.mock('../../hooks/useSocket', () => ({ useSocket: () => null }));
jest.mock('../../constants/Categories', () => ({ TOPIC_CATEGORIES: {} }));
jest.mock('../../constants/Api', () => ({ API_BASE: 'https://example.com' }));
jest.mock('../../api/questionsV2Api', () => ({ QuestionChatsV2Api: { getChats: jest.fn() } }));
jest.mock('../../utils/authStorage', () => ({
    storage: {
        getString: jest.fn(key => mockStoredValues.get(key)),
        getBoolean: jest.fn(key => mockStoredValues.get(key)),
        set: jest.fn((key, value) => mockStoredValues.set(key, value)),
    },
}));
jest.mock('../../i18n/uiTranslation', () => ({
    translateUiText: text => text,
    translateUiTemplate: (text, values) => text.replace(/\{\{(\d+)\}\}/g, (_, index) => values[index]),
    getUiLocale: () => 'en-US',
    formatRelativeTime: () => 'now',
}));

const originalFetch = global.fetch;
let renderer;

const mount = async (props = {}) => {
    await ReactTestRenderer.act(async () => {
        renderer = ReactTestRenderer.create(
            <ChatListScreen userId="guide-user" onLiveChatPress={jest.fn()} {...props} />,
        );
    });
};
const guides = () => renderer.root.findAllByType(View)
    .filter(node => node.props.accessibilityRole === 'alert');
const button = label => renderer.root.findAllByType(TouchableOpacity)
    .find(node => node.props.accessibilityLabel === label);
const advanceTime = async milliseconds => {
    await ReactTestRenderer.act(async () => jest.advanceTimersByTime(milliseconds));
};

beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockStoredValues.clear();
    global.fetch = jest.fn().mockResolvedValue({
        json: async () => ({ success: true, data: { chats: [], syncTime: '2026-10-02T08:00:00Z' } }),
    });
    QuestionChatsV2Api.getChats.mockResolvedValue({ success: true, data: { chats: [] } });
});
afterEach(async () => {
    if (renderer) await ReactTestRenderer.act(() => renderer.unmount());
    renderer = undefined;
    global.fetch = originalFetch;
    jest.useRealTimers();
});

test('the guide waits three seconds after the chat list loads', async () => {
    let finishLoading;
    global.fetch.mockReturnValueOnce(new Promise(resolve => { finishLoading = resolve; }));
    await mount({ userId: 'guide-loading-user' });
    await advanceTime(3000);
    expect(guides()).toHaveLength(0);
    await ReactTestRenderer.act(async () => finishLoading({
        json: async () => ({ success: true, data: { chats: [] } }),
    }));
    expect(guides()).toHaveLength(0);
    await advanceTime(2999);
    expect(guides()).toHaveLength(0);
    await advanceTime(1);
    expect(guides()).toHaveLength(1);
});

test('Got it remembers dismissal for this user across visits', async () => {
    const onLiveChatPress = jest.fn();
    await mount({ onLiveChatPress });
    await advanceTime(3000);
    expect(guides()).toHaveLength(1);
    await ReactTestRenderer.act(() => button('Dismiss video call guidance').props.onPress());
    await advanceTime(300);
    expect(guides()).toHaveLength(0);
    expect(storage.set).toHaveBeenCalledWith('chat_list_video_chat_guide:guide-user', true);
    expect(onLiveChatPress).not.toHaveBeenCalled();
    await ReactTestRenderer.act(() => renderer.unmount());
    await mount({ onLiveChatPress });
    await advanceTime(3000);
    expect(guides()).toHaveLength(0);
    await ReactTestRenderer.act(async () => renderer.update(
        <ChatListScreen userId="another-guide-user" onLiveChatPress={onLiveChatPress} />,
    ));
    await advanceTime(3000);
    expect(guides()).toHaveLength(1);
});

test('tapping the camera dismisses the guide and opens video chat', async () => {
    const onLiveChatPress = jest.fn();
    await mount({ onLiveChatPress });
    await advanceTime(3000);
    await ReactTestRenderer.act(() => button('Open Video Chat').props.onPress());
    await advanceTime(300);
    expect(guides()).toHaveLength(0);
    expect(storage.set).toHaveBeenCalledWith('chat_list_video_chat_guide:guide-user', true);
    expect(onLiveChatPress).toHaveBeenCalledTimes(1);
});

test('the guide waits until video chat becomes available', async () => {
    const onLiveChatPress = jest.fn();
    await mount({ liveChatDisabled: true, onLiveChatPress });
    await advanceTime(3000);
    expect(guides()).toHaveLength(0);
    expect(button('Open Video Chat').props.disabled).toBe(true);
    await ReactTestRenderer.act(async () => renderer.update(
        <ChatListScreen userId="guide-user" liveChatDisabled={false} onLiveChatPress={onLiveChatPress} />,
    ));
    expect(guides()).toHaveLength(0);
    await advanceTime(3000);
    expect(guides()).toHaveLength(1);
});

test('opening video chat before the delay cancels the pending guide', async () => {
    const onLiveChatPress = jest.fn();
    await mount({ onLiveChatPress });
    await advanceTime(1000);
    await ReactTestRenderer.act(() => button('Open Video Chat').props.onPress());
    await advanceTime(3000);
    expect(guides()).toHaveLength(0);
    expect(onLiveChatPress).toHaveBeenCalledTimes(1);
});

test('leaving the screen cancels the delay and a new visit starts it again', async () => {
    await mount();
    await advanceTime(2000);
    await ReactTestRenderer.act(() => renderer.unmount());
    await advanceTime(3000);
    await mount();
    await advanceTime(2999);
    expect(guides()).toHaveLength(0);
    await advanceTime(1);
    expect(guides()).toHaveLength(1);
});

test.each([
    { userId: undefined },
    { onLiveChatPress: undefined },
])('the guide stays hidden when required information is missing: %p', async props => {
    await mount(props);
    await advanceTime(3000);
    expect(guides()).toHaveLength(0);
});
