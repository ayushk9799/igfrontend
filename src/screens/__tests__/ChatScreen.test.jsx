/* eslint-env jest */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { FlatList, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import ChatScreen from '../ChatScreen';

const mockSocket = {
    connected: true,
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
};

jest.mock('../../hooks/useSocket', () => ({
    useSocket: () => mockSocket,
}));

jest.mock('react-redux', () => ({
    useSelector: jest.fn(selector => {
        return {
            id: 'user-1',
            name: 'Me',
            partnerId: 'partner-1',
            partnerUsername: 'My Partner',
        };
    }),
}));

jest.mock('react-native-safe-area-context', () => ({
    useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

jest.mock('react-native-keyboard-controller', () => ({
    KeyboardAvoidingView: ({ children }) => children,
}));

jest.mock('expo-haptics', () => ({
    impactAsync: jest.fn().mockResolvedValue(undefined),
    notificationAsync: jest.fn().mockResolvedValue(undefined),
    selectionAsync: jest.fn().mockResolvedValue(undefined),
    ImpactFeedbackStyle: {
        Light: 'light',
        Medium: 'medium',
        Heavy: 'heavy',
    },
    NotificationFeedbackType: {
        Success: 'success',
        Warning: 'warning',
        Error: 'error',
    },
}));

jest.mock('../../components/GradientBackground', () => {
    return ({ children }) => children;
});

let mockChatBubbleProps = [];
let mockChatInputProps = null;

jest.mock('../../components/chat', () => ({
    ChatBubble: (props) => {
        mockChatBubbleProps.push(props);
        return null;
    },
    ChatInput: (props) => {
        mockChatInputProps = props;
        return null;
    },
}));

jest.mock('../../i18n/uiTranslation', () => ({
    translateUiTemplate: (template, values) => `${values[0]} is typing...`,
    translateUiText: text => text,
}));

const mockApiFetch = jest.fn();

jest.mock('../../utils/apiFetch', () => ({
    apiFetch: (...args) => mockApiFetch(...args),
}));

describe('ChatScreen', () => {
    let socketListeners = {};

    beforeEach(() => {
        jest.clearAllMocks();
        mockChatBubbleProps = [];
        mockChatInputProps = null;
        socketListeners = {};

        mockSocket.on.mockImplementation((event, handler) => {
            socketListeners[event] = handler;
        });

        mockApiFetch.mockImplementation(() =>
            Promise.resolve({
                json: () => Promise.resolve({
                    success: true,
                    data: {
                        chat: {},
                        messages: [
                            {
                                _id: 'msg-1',
                                senderId: { _id: 'user-1', name: 'Me' },
                                content: 'Visiting Paris',
                                createdAt: new Date().toISOString(),
                            },
                        ],
                    },
                }),
            })
        );
    });

    it('hydrates initial messages without flashing full-screen loading spinner', async () => {
        const initialChat = {
            _id: 'chat-1',
            questionText: 'What is your favorite memory?',
            messages: [
                {
                    _id: 'msg-1',
                    senderId: { _id: 'user-1', name: 'Me' },
                    content: 'Visiting Paris',
                    createdAt: new Date().toISOString(),
                },
            ],
        };

        let renderer;
        await ReactTestRenderer.act(() => {
            renderer = ReactTestRenderer.create(
                <ChatScreen
                    chatId="chat-1"
                    chat={initialChat}
                    userId="user-1"
                    userName="Me"
                    partnerName="My Partner"
                    onBack={jest.fn()}
                />
            );
        });

        const flatList = renderer.root.findByType(FlatList);
        expect(flatList).toBeTruthy();
        expect(flatList.props.data.length).toBe(1);
        expect(flatList.props.inverted).toBe(true);

        // ListHeaderComponent must be used for inverted list typing indicator
        expect(flatList.props.ListHeaderComponent).toBeDefined();

        await ReactTestRenderer.act(() => renderer.unmount());
    });

    it('groups avatars correctly when senderId is a populated object', async () => {
        // Two consecutive messages from partner-1, then one from user-1
        const initialChat = {
            _id: 'chat-1',
            questionText: 'Question',
            messages: [
                {
                    _id: 'msg-1',
                    senderId: { _id: 'partner-1', name: 'Partner' },
                    content: 'First partner message',
                    createdAt: '2026-09-10T01:00:00.000Z',
                },
                {
                    _id: 'msg-2',
                    senderId: { _id: 'partner-1', name: 'Partner' },
                    content: 'Second partner message',
                    createdAt: '2026-09-10T01:01:00.000Z',
                },
            ],
        };

        mockApiFetch.mockImplementation(() =>
            Promise.resolve({
                json: () => Promise.resolve({
                    success: true,
                    data: {
                        chat: initialChat,
                        messages: initialChat.messages,
                    },
                }),
            })
        );

        let renderer;
        await ReactTestRenderer.act(() => {
            renderer = ReactTestRenderer.create(
                <ChatScreen
                    chatId="chat-1"
                    chat={initialChat}
                    userId="user-1"
                    userName="Me"
                    partnerName="Partner"
                    onBack={jest.fn()}
                />
            );
        });

        const flatList = renderer.root.findByType(FlatList);
        // allMessages is reversed: [msg-2, msg-1]
        // index 0 (msg-2, bottom-most visually): showAvatar should be true
        // index 1 (msg-1, visually above msg-2): senderId matches msg-2, so showAvatar should be false
        const renderedItem0 = flatList.props.renderItem({ item: flatList.props.data[0], index: 0 });
        const renderedItem1 = flatList.props.renderItem({ item: flatList.props.data[1], index: 1 });

        expect(renderedItem0.props.showAvatar).toBe(true);
        expect(renderedItem1.props.showAvatar).toBe(false);

        await ReactTestRenderer.act(() => renderer.unmount());
    });

    it('resets partner typing and marks as read when partner sends a message via socket', async () => {
        let renderer;
        await ReactTestRenderer.act(() => {
            renderer = ReactTestRenderer.create(
                <ChatScreen
                    chatId="chat-123"
                    userId="user-1"
                    userName="Me"
                    partnerName="Partner"
                    onBack={jest.fn()}
                />
            );
        });

        // Trigger typing indicator
        await ReactTestRenderer.act(() => {
            socketListeners['chat:typing']?.({ chatId: 'chat-123', userId: 'partner-1', isTyping: true });
        });

        // Partner sends message
        await ReactTestRenderer.act(() => {
            socketListeners['chat:newMessage']?.({
                message: {
                    _id: 'msg-new',
                    chatId: 'chat-123',
                    senderId: 'partner-1',
                    content: 'Hello there!',
                    createdAt: new Date().toISOString(),
                },
            });
        });

        // Verify mark as read was emitted
        expect(mockSocket.emit).toHaveBeenCalledWith('chat:read', { chatId: 'chat-123' });

        await ReactTestRenderer.act(() => renderer.unmount());
    });

    it('does not display the partner name or avatar in the top header', async () => {
        let renderer;
        await ReactTestRenderer.act(() => {
            renderer = ReactTestRenderer.create(
                <ChatScreen
                    chatId="chat-123"
                    userId="user-1"
                    userName="Me"
                    partnerName="SecretPartnerName123"
                    onBack={jest.fn()}
                />
            );
        });

        const textNodes = renderer.root.findAllByType(Text);
        const headerNameNode = textNodes.find(t => t.props.children === 'SecretPartnerName123');
        expect(headerNameNode).toBeUndefined();
        const chatsTextNode = textNodes.find(t => t.props.children === 'Chats');
        expect(chatsTextNode).toBeUndefined();

        await ReactTestRenderer.act(() => renderer.unmount());
    });

    it('joins chat room and listens for socket connect event to re-join on reconnect', async () => {
        let renderer;
        await ReactTestRenderer.act(() => {
            renderer = ReactTestRenderer.create(
                <ChatScreen
                    chatId="chat-123"
                    userId="user-1"
                    userName="Me"
                    onBack={jest.fn()}
                />
            );
        });

        // Verifies socket joined and registered connect listener
        expect(mockSocket.emit).toHaveBeenCalledWith('chat:join', { chatId: 'chat-123' });
        expect(mockSocket.emit).toHaveBeenCalledWith('chat:read', { chatId: 'chat-123' });
        expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));

        await ReactTestRenderer.act(() => renderer.unmount());

        expect(mockSocket.emit).toHaveBeenCalledWith('chat:leave', { chatId: 'chat-123' });
        expect(mockSocket.off).toHaveBeenCalledWith('connect', expect.any(Function));
    });

    it('triggers haptic feedback when a message is sent or received', async () => {
        jest.clearAllMocks();
        let renderer;
        await ReactTestRenderer.act(() => {
            renderer = ReactTestRenderer.create(
                <ChatScreen
                    chatId="chat-123"
                    userId="user-1"
                    userName="Me"
                    partnerName="Partner"
                    onBack={jest.fn()}
                />
            );
        });

        // 1. Sending a message triggers Light impact haptic
        await ReactTestRenderer.act(() => {
            mockChatInputProps.onSend('Hello from me!');
        });
        expect(Haptics.impactAsync).toHaveBeenCalledWith('light');

        // 2. Receiving a partner message triggers Medium impact haptic
        await ReactTestRenderer.act(() => {
            socketListeners['chat:newMessage']?.({
                message: {
                    _id: 'msg-partner-haptic',
                    chatId: 'chat-123',
                    senderId: 'partner-1',
                    content: 'Hello from partner!',
                    createdAt: new Date().toISOString(),
                },
            });
        });
        expect(Haptics.impactAsync).toHaveBeenCalledWith('medium');

        await ReactTestRenderer.act(() => renderer.unmount());
    });
});

