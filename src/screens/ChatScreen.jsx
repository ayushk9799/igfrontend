import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import GradientBackground from '../components/GradientBackground';
import { colors, spacing, borderRadius } from '../theme';
import { API_BASE } from '../constants/Api';
import { ChatBubble, ChatInput } from '../components/chat';
import { useSocket } from '../hooks/useSocket';
import { useSelector } from 'react-redux';
import { selectUser } from '../store/slices/userSlice';
import { translateUiTemplate, translateUiText } from '../i18n/uiTranslation';
import { apiFetch } from '../utils/apiFetch';

/**
 * ChatScreen - Individual chat conversation screen
 * Shows question context, both answers, and real-time messaging
 */
export default function ChatScreen({
    chatId,
    chat: initialChat,
    userId,
    userName,
    partnerName = 'Partner',
    onBack,
    chatMode = 'legacy',
}) {
    const insets = useSafeAreaInsets();
    const socket = useSocket();
    const flatListRef = useRef(null);
    const userData = useSelector(selectUser);
    const bottomInset = Math.max(insets.bottom, 12);

    const hasInitialMessages = Array.isArray(initialChat?.messages) && initialChat.messages.length > 0;
    const [chat, setChat] = useState(initialChat || null);
    const [messages, setMessages] = useState(hasInitialMessages ? initialChat.messages : []);
    const [loading, setLoading] = useState(!initialChat || (!hasInitialMessages && !initialChat.prompt && !initialChat.questionText));
    const [sending, setSending] = useState(false);
    const [partnerTyping, setPartnerTyping] = useState(false);
    const [showQuestionCard, setShowQuestionCard] = useState(true);
    const isQuestionV2Chat = chatMode === 'questionV2';

    // Keep chat and messages synced if initialChat prop updates
    useEffect(() => {
        if (initialChat) {
            setChat(initialChat);
            if (Array.isArray(initialChat.messages) && initialChat.messages.length > 0 && messages.length === 0) {
                setMessages(initialChat.messages);
            }
        }
    }, [initialChat]);

    // Fetch chat and messages
    const fetchChat = useCallback(async () => {
        try {
            const url = isQuestionV2Chat
                ? `${API_BASE}/api/v2/question-chats/${chatId}?userId=${userId}&limit=50`
                : `${API_BASE}/api/chat/${chatId}?limit=50`;
            const response = await apiFetch(url);
            const json = await response.json();

            if (json.success) {
                setChat(json.data.chat);
                setMessages(json.data.messages || []);
            }
        } catch (err) {
            console.error('Error fetching chat:', err);
        } finally {
            setLoading(false);
        }
    }, [chatId, isQuestionV2Chat, userId]);

    useEffect(() => {
        fetchChat();
    }, [fetchChat]);

    // Socket event handlers
    useEffect(() => {
        if (!socket || !chatId) return;

        if (isQuestionV2Chat) {
            const handleQuestionV2Message = (data) => {
                if (data.chatId !== chatId || !data.message) return;
                setMessages(prev => {
                    const exists = prev.some(m => String(m._id) === String(data.message._id));
                    return exists ? prev : [...prev, data.message];
                });
            };

            socket.on('questionChatV2:message', handleQuestionV2Message);

            return () => {
                socket.off('questionChatV2:message', handleQuestionV2Message);
            };
        }

        const joinAndMarkRead = () => {
            socket.emit('chat:join', { chatId });
            socket.emit('chat:read', { chatId });
        };

        // Join chat room & mark as read on mount
        joinAndMarkRead();

        // Re-join chat room if socket reconnects
        socket.on('connect', joinAndMarkRead);

        // Listen for new messages
        const handleNewMessage = (data) => {
            if (data.message && data.message.chatId === chatId) {
                const newMsg = data.message;
                const newSenderId = String(newMsg.senderId?._id || newMsg.senderId);
                const currentUserId = String(userId);

                // If it's our own message, replace the temp message instead of adding duplicate
                if (newSenderId === currentUserId) {
                    setMessages(prev => {
                        // Check if we have a temp message with similar content (our optimistic add)
                        const tempIndex = prev.findIndex(m =>
                            m.isTemp && m.content === newMsg.content
                        );

                        if (tempIndex !== -1) {
                            // Replace temp message with real one
                            const updated = [...prev];
                            updated[tempIndex] = newMsg;
                            return updated;
                        }

                        // No temp found, check if message already exists by _id
                        const exists = prev.some(m => String(m._id) === String(newMsg._id));
                        if (exists) return prev;

                        return [...prev, newMsg];
                    });
                } else {
                    // Partner's message - clear partner typing state immediately
                    setPartnerTyping(false);

                    // Haptic feedback for incoming message
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

                    // Add partner message
                    setMessages(prev => {
                        const exists = prev.some(m => String(m._id) === String(newMsg._id));
                        if (exists) return prev;
                        return [...prev, newMsg];
                    });

                    // Mark as read
                    socket.emit('chat:read', { chatId });
                }
            }
        };

        // Listen for typing indicator
        const handleTyping = (data) => {
            if (data.chatId === chatId && String(data.userId) !== String(userId)) {
                setPartnerTyping(data.isTyping);
            }
        };

        // Listen for read receipts - update messages when partner reads them
        const handleReadReceipt = (data) => {
            if (data.chatId === chatId && String(data.readBy) !== String(userId)) {
                // Partner read our messages - update all our sent messages to show as read
                setMessages(prev => prev.map(msg => {
                    // Only mark our own messages as read
                    const isSent = String(msg.senderId?._id || msg.senderId) === String(userId);
                    if (isSent && !msg.isRead) {
                        return { ...msg, isRead: true, readAt: data.readAt };
                    }
                    return msg;
                }));
            }
        };

        socket.on('chat:newMessage', handleNewMessage);
        socket.on('chat:typing', handleTyping);
        socket.on('chat:readReceipt', handleReadReceipt);

        return () => {
            socket.emit('chat:leave', { chatId });
            socket.off('connect', joinAndMarkRead);
            socket.off('chat:newMessage', handleNewMessage);
            socket.off('chat:typing', handleTyping);
            socket.off('chat:readReceipt', handleReadReceipt);
        };
    }, [socket, chatId, userId, isQuestionV2Chat]);

    // Send message handler
    const handleSend = useCallback(async (content) => {
        if (!content.trim() || sending) return;

        // Haptic feedback for sent message
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

        setSending(true);

        // Optimistically add message
        const tempMessage = {
            _id: `temp-${Date.now()}`,
            chatId,
            senderId: userId,
            senderName: userName,
            content: content.trim(),
            createdAt: new Date().toISOString(),
            isTemp: true,
        };
        setMessages(prev => [...prev, tempMessage]);

        try {
            if (isQuestionV2Chat) {
                const response = await apiFetch(`${API_BASE}/api/v2/question-chats/${chatId}/messages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        senderId: userId,
                        content: content.trim(),
                    }),
                });
                const json = await response.json();

                if (json.success) {
                    setMessages(prev =>
                        prev.map(m => m._id === tempMessage._id ? json.data.message : m)
                    );
                } else {
                    setMessages(prev => prev.filter(m => m._id !== tempMessage._id));
                }
                return;
            }

            if (socket?.connected) {
                // Use socket for real-time
                socket.emit('chat:message', { chatId, content: content.trim() });
            } else {
                // Fallback to HTTP via apiFetch
                const response = await apiFetch(`${API_BASE}/api/chat/${chatId}/message`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, content: content.trim() }),
                });
                const json = await response.json();

                if (json.success) {
                    // Replace temp message with real one
                    setMessages(prev =>
                        prev.map(m => m._id === tempMessage._id ? json.data : m)
                    );
                } else {
                    setMessages(prev => prev.filter(m => m._id !== tempMessage._id));
                }
            }
        } catch (err) {
            console.error('Error sending message:', err);
            // Remove temp message on error
            setMessages(prev => prev.filter(m => m._id !== tempMessage._id));
        } finally {
            setSending(false);
        }
    }, [socket, chatId, userId, userName, sending, isQuestionV2Chat]);

    // Handle typing indicator
    const handleTyping = useCallback((isTyping) => {
        if (isQuestionV2Chat) return;
        if (socket?.connected) {
            socket.emit('chat:typing', { chatId, isTyping });
        }
    }, [socket, chatId, isQuestionV2Chat]);

    // Build messages list - Reversed for Inverted FlatList
    const allMessages = React.useMemo(() => {
        return [...messages].reverse();
    }, [messages]);

    const renderMessage = ({ item, index }) => {
        const itemSenderId = String(item.senderId?._id || item.senderId);
        const currentUserId = String(userId);
        const isSent = itemSenderId === currentUserId;

        // For Inverted list: Check previous index (which is visually 'below') or if first index (bottom-most)
        // This places avatar at the BOTTOM of the message group
        const prevSenderId = index > 0
            ? String(allMessages[index - 1]?.senderId?._id || allMessages[index - 1]?.senderId)
            : null;
        const showAvatar = index === 0 || (prevSenderId !== itemSenderId);

        // Prioritize local storage/thumbnails for instant display
        let avatarSource = item.senderId?.avatar;

        if (isSent) {
            // For me: Use my local thumbnail if available, then my local full avatar
            avatarSource = userData?.avatarThumbnail || userData?.avatar || avatarSource;
        } else {
            // For partner: Check if this message is from my partner (it should be in a 2-person chat)
            // and use their cached thumbnail if available
            const partnerId = userData?.partnerId ? String(userData.partnerId) : null;
            if (partnerId && itemSenderId === partnerId) {
                avatarSource = userData?.partnerAvatarThumbnail || userData?.partnerAvatar || avatarSource;
            }
        }

        // Use ChatBubble for all messages including answers
        return (
            <ChatBubble
                message={item}
                isSent={isSent}
                showAvatar={showAvatar}
                senderName={isSent ? userName : partnerName}
                senderAvatar={avatarSource}
                isRead={item.isRead}
                questionCategory={isQuestionV2Chat ? chat?.format : chat?.questionCategory}
            />
        );
    };

    const renderQuestionCard = () => {
        if (!chat || !showQuestionCard) return null;

        const questionText = isQuestionV2Chat ? chat.prompt : chat.questionText;
        if (!questionText) return null;

        return (
            <View style={styles.questionCard}>
                <Text
                    style={styles.questionText}
                    numberOfLines={3}
                >
                    {questionText}
                </Text>
            </View>
        );
    };

    const renderTypingIndicator = () => {
        if (!partnerTyping) return null;

        return (
            <View style={styles.typingContainer}>
                <View style={styles.typingDots}>
                    <View style={[styles.typingDot, styles.typingDot1]} />
                    <View style={[styles.typingDot, styles.typingDot2]} />
                    <View style={[styles.typingDot, styles.typingDot3]} />
                </View>
                <Text style={styles.typingText}>{translateUiTemplate("{{0}} is typing...", [partnerName])}</Text>
            </View>
        );
    };

    if (loading) {
        return (
            <GradientBackground variant="light" showOrbs={true} showParticles={true}>
                <View style={[styles.container, styles.centerContent, { paddingTop: insets.top, backgroundColor: 'transparent' }]}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </GradientBackground>
        );
    }

    return (
        <GradientBackground variant="light" showOrbs={true} showParticles={true}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <TouchableOpacity
                    onPress={onBack}
                    style={styles.backButton}
                    accessibilityRole="button"
                    accessibilityLabel={translateUiText("Back to chats")}
                    activeOpacity={0.8}
                >
                    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                        <Path
                            d="M15 18l-6-6 6-6"
                            stroke="#1B1237"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </Svg>
                </TouchableOpacity>

                {/* Centered typing status */}
                <View style={styles.headerCenter}>
                    {partnerTyping && (
                        <Text style={styles.headerTypingText}>{translateUiText("typing...")}</Text>
                    )}
                </View>

                {/* Spacer for centering */}
                <View style={styles.headerSpacer} />
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? -(bottomInset - 6) : 0}
            >
                {/* Question card */}
                {renderQuestionCard()}

                {/* Messages: Inverted FlatList where ListHeaderComponent renders at the visual bottom (near newest messages/input) */}
                <FlatList
                    ref={flatListRef}
                    data={allMessages}
                    renderItem={renderMessage}
                    keyExtractor={(item, index) => item._id || item.id || `msg-${index}`}
                    style={{ flex: 1 }}
                    inverted
                    contentContainerStyle={styles.messagesContent}
                    showsVerticalScrollIndicator={false}
                    ListHeaderComponent={renderTypingIndicator}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="interactive"
                />

                {/* Input with safe bottom inset */}
                <View style={{ marginBottom: bottomInset }}>
                    <ChatInput
                        onSend={handleSend}
                        onTyping={handleTyping}
                        partnerName={partnerName}
                        disabled={sending}
                    />
                </View>
            </KeyboardAvoidingView>
        </GradientBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    centerContent: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingVertical: 8,
        backgroundColor: 'transparent',
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#FAE8FF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 0,
    },
    headerCenter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        gap: 8,
    },
    headerTypingText: {
        fontSize: 12,
        color: colors.textSecondary,
        fontStyle: 'italic',
    },
    headerSpacer: {
        width: 44,
        height: 44,
    },
    questionCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#FAE8FF',
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginHorizontal: spacing.md,
        marginTop: spacing.xs,
        marginBottom: spacing.xs,
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 0,
    },
    questionText: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.text,
        lineHeight: 21,
    },
    messagesContent: {
        paddingVertical: spacing.md,
        flexGrow: 1,
    },
    typingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        gap: spacing.sm,
    },
    typingDots: {
        flexDirection: 'row',
        gap: 4,
    },
    typingDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.textSecondary,
    },
    typingDot1: {
        opacity: 0.4,
    },
    typingDot2: {
        opacity: 0.7,
    },
    typingDot3: {
        opacity: 1,
    },
    typingText: {
        fontSize: 13,
        color: colors.textSecondary,
    },
});
