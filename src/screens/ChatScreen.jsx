import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
    Keyboard,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import LinearGradient from 'react-native-linear-gradient';
import GradientBackground from '../components/GradientBackground';
import { colors, spacing, borderRadius } from '../theme';
import { API_BASE } from '../constants/Api';
import { ChatBubble, ChatInput } from '../components/chat';
import { useSocket } from '../hooks/useSocket';
import { useSelector } from 'react-redux';
import { selectUser } from '../store/slices/userSlice';
import { translateUiText } from '../i18n/uiTranslation';

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

    const [chat, setChat] = useState(initialChat || null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [partnerTyping, setPartnerTyping] = useState(false);
    const [showQuestionCard, setShowQuestionCard] = useState(true);
    const [questionExpanded, setQuestionExpanded] = useState(false);
    const isQuestionV2Chat = chatMode === 'questionV2';

    // Fetch chat and messages
    const fetchChat = useCallback(async () => {
        try {
            const url = isQuestionV2Chat
                ? `${API_BASE}/api/v2/question-chats/${chatId}?userId=${userId}&limit=50`
                : `${API_BASE}/api/chat/${chatId}?limit=50`;
            const response = await fetch(url);
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
                    const exists = prev.some(m => m._id === data.message._id);
                    return exists ? prev : [...prev, data.message];
                });
            };

            socket.on('questionChatV2:message', handleQuestionV2Message);

            return () => {
                socket.off('questionChatV2:message', handleQuestionV2Message);
            };
        }

        // Join chat room
        socket.emit('chat:join', { chatId });

        // Listen for new messages
        const handleNewMessage = (data) => {
            if (data.message && data.message.chatId === chatId) {
                const newMsg = data.message;

                // If it's our own message, replace the temp message instead of adding duplicate
                if (newMsg.senderId === userId || newMsg.senderId?._id === userId) {
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
                        const exists = prev.some(m => m._id === newMsg._id);
                        if (exists) return prev;

                        return [...prev, newMsg];
                    });
                } else {
                    // Partner's message - just add it
                    setMessages(prev => {
                        // Check if already exists
                        const exists = prev.some(m => m._id === newMsg._id);
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
            if (data.chatId === chatId && data.userId !== userId) {
                setPartnerTyping(data.isTyping);
            }
        };

        // Listen for read receipts - update messages when partner reads them
        const handleReadReceipt = (data) => {
            if (data.chatId === chatId && data.readBy !== userId) {
                // Partner read our messages - update all our sent messages to show as read
                setMessages(prev => prev.map(msg => {
                    // Only mark our own messages as read
                    const isSent = msg.senderId === userId || msg.senderId?._id === userId;
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

        // Mark as read on mount
        socket.emit('chat:read', { chatId });

        return () => {
            socket.emit('chat:leave', { chatId });
            socket.off('chat:newMessage', handleNewMessage);
            socket.off('chat:typing', handleTyping);
            socket.off('chat:readReceipt', handleReadReceipt);
        };
    }, [socket, chatId, userId, isQuestionV2Chat]);

    // Send message handler
    const handleSend = useCallback(async (content) => {
        if (!content.trim() || sending) return;

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
                const response = await fetch(`${API_BASE}/api/v2/question-chats/${chatId}/messages`, {
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
                // Fallback to HTTP
                const response = await fetch(`${API_BASE}/api/chat/${chatId}/message`, {
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
        const isSent = item.senderId === userId || item.senderId?._id === userId;
        // For Inverted list: Check previous index (which is visually 'below') or if first index (bottom-most)
        // This places avatar at the BOTTOM of the message group
        const showAvatar = index === 0 ||
            (allMessages[index - 1]?.senderId !== item.senderId);

        // Prioritize local storage/thumbnails for instant display
        let avatarSource = item.senderId?.avatar;

        if (isSent) {
            // For me: Use my local thumbnail if available, then my local full avatar
            avatarSource = userData.avatarThumbnail || userData.avatar || avatarSource;
        } else {
            // For partner: Check if this message is from my partner (it should be in a 2-person chat)
            // and use their cached thumbnail if available
            if (userData.partnerId && (item.senderId === userData.partnerId || item.senderId?._id === userData.partnerId)) {
                avatarSource = userData.partnerAvatarThumbnail || userData.partnerAvatar || avatarSource;
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

        return (
            <TouchableOpacity
                style={styles.questionCard}
                onPress={() => setQuestionExpanded(!questionExpanded)}
                activeOpacity={0.9}
            >
                <View style={[
                    styles.questionCardGradient,
                    !questionExpanded && styles.questionCardCollapsed
                ]}>
                    <Text
                        style={styles.questionText}
                        numberOfLines={questionExpanded ? undefined : 2}
                    >
                        {questionText}
                    </Text>
                    <Text style={styles.tapHint}>
                        {questionExpanded ? translateUiText("Tap to collapse") : translateUiText("Tap to expand")}
                    </Text>
                </View>
            </TouchableOpacity>
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
                <Text style={styles.typingText}>{partnerName}{translateUiText("is typing...")}</Text>
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
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                        <Path
                            d="M15 18l-6-6 6-6"
                            stroke={colors.text}
                            strokeWidth={2.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </Svg>
                    <Text style={styles.backText}>{translateUiText("Chats")}</Text>
                </TouchableOpacity>

                {/* Centered avatar and name */}
                <View style={styles.headerCenter}>
                    <View style={styles.headerAvatar}>
                        <Text style={styles.headerAvatarText}>
                            {partnerName?.charAt(0)?.toUpperCase() || '?'}
                        </Text>
                    </View>
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headerName}>{partnerName}</Text>
                        {partnerTyping && (
                            <Text style={styles.headerTypingText}>{translateUiText("typing...")}</Text>
                        )}
                    </View>
                </View>

                {/* Spacer for centering */}
                <View style={styles.headerSpacer} />
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior="padding"
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >

                {/* Question card */}
                {renderQuestionCard()}

                {/* Messages */}
                <FlatList
                    ref={flatListRef}
                    data={allMessages}
                    renderItem={renderMessage}
                    keyExtractor={(item) => item._id}
                    style={{ flex: 1 }}
                    inverted
                    contentContainerStyle={styles.messagesContent}
                    showsVerticalScrollIndicator={false}

                    ListFooterComponent={renderTypingIndicator}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="interactive"
                />

                {/* Input */}
                <View style={{ marginBottom: 15 }}>
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
        flexDirection: 'row',
        alignItems: 'center',
        minWidth: 60,
    },
    backText: {
        fontSize: 17,
        color: colors.text,
        marginLeft: 2,
    },
    headerCenter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        gap: 8,
    },
    headerAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#FAE8FF',
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    headerAvatarText: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.primary,
    },
    headerName: {
        fontSize: 16,
        fontWeight: '800',
        color: colors.text,
    },
    headerTextContainer: {
        flexDirection: 'column',
        alignItems: 'flex-start',
    },
    headerTypingText: {
        fontSize: 12,
        color: colors.textSecondary,
        fontStyle: 'italic',
    },
    headerSpacer: {
        minWidth: 70,

    },
    questionCard: {
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
        marginHorizontal: spacing.md,
        marginTop: spacing.xs,
        marginBottom: spacing.xs,
    },
    questionCardGradient: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 8,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#FAE8FF',
    },
    questionCardCollapsed: {
        maxHeight: 80,
    },
    questionLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: 8,
    },
    questionText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
        lineHeight: 22,
        marginBottom: 6,
    },
    tapHint: {
        fontSize: 11,
        color: colors.textSecondary,
        textAlign: 'center',
        marginTop: 4,
    },
    collapseHintContainer: {
        alignItems: 'center',
    },
    collapseHint: {
        fontSize: 12,
        color: colors.textSecondary,
        fontWeight: '500',
    },
    answersContainer: {
        borderTopWidth: 1,
        borderTopColor: '#FAE8FF',
        paddingTop: spacing.md,
        marginTop: spacing.xs,
        gap: spacing.sm,
    },
    answerCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
    },
    answerAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    answerAvatarText: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.primary,
    },
    answerContent: {
        flex: 1,
    },
    answerLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: 2,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    answerText: {
        fontSize: 14,
        color: colors.text,
        lineHeight: 20,
    },
    messagesContent: {
        paddingVertical: spacing.md,
        flexGrow: 1,
    },
    emptyMessages: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: spacing.xxl,
        paddingHorizontal: spacing.xl,
    },
    emptyIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
        marginBottom: spacing.xs,
    },
    emptyText: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
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
    // Answer message styles
    answerMessageContainer: {
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
    },
    answerMessageBubble: {
        maxWidth: '80%',
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        borderWidth: 2,
        borderStyle: 'dashed',
    },
    answerSent: {
        alignSelf: 'flex-end',
        backgroundColor: colors.primary + '15',
        borderColor: colors.primary + '40',
    },
    answerReceived: {
        alignSelf: 'flex-start',
        backgroundColor: '#FFFFFF',
        borderColor: '#FAE8FF',
    },
    answerMessageLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.textSecondary,
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    answerMessageText: {
        fontSize: 15,
        color: colors.text,
        lineHeight: 21,
    },
    answerTextSent: {
        color: colors.text,
    },
});
