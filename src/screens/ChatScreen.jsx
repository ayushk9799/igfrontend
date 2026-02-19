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
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import LinearGradient from 'react-native-linear-gradient';
import { colors, spacing, borderRadius } from '../theme';
import { API_BASE } from '../constants/Api';
import { ChatBubble, ChatInput } from '../components/chat';
import { useSocket } from '../hooks/useSocket';
import { useSelector } from 'react-redux';
import { selectUser } from '../store/slices/userSlice';

// Category config with colors and icons
const CATEGORY_CONFIG = {
    future: {
        label: 'Future',
        color: '#5E60CE',
        lightColor: '#E8E8FF',
        gradient: ['#7B7FD5', '#5E60CE'],
    },
    money: {
        label: 'Money',
        color: '#D4AF37',
        lightColor: '#FFF8E1',
        gradient: ['#F5D742', '#D4AF37'],
    },
    hotspicy: {
        label: 'Hot & Spicy',
        color: '#DC3545',
        lightColor: '#FFEBEE',
        gradient: ['#FF6B6B', '#DC3545'],
    },
    political: {
        label: 'Opinions',
        color: '#2D8C7F',
        lightColor: '#E0F2F1',
        gradient: ['#4ECDC4', '#2D8C7F'],
    },
    fitness: {
        label: 'Fitness',
        color: '#4CAF50',
        lightColor: '#E8F5E9',
        gradient: ['#81C784', '#4CAF50'],
    },
    travel: {
        label: 'Travel',
        color: '#2196F3',
        lightColor: '#E3F2FD',
        gradient: ['#64B5F6', '#2196F3'],
    },
    family: {
        label: 'Family',
        color: '#E91E63',
        lightColor: '#FCE4EC',
        gradient: ['#F48FB1', '#E91E63'],
    },
    dailychallenge: {
        label: 'Daily',
        color: '#FF9800',
        lightColor: '#FFF3E0',
        gradient: ['#FFB74D', '#FF9800'],
    },
    likelyto: {
        label: 'Likely To',
        color: '#9C27B0',
        lightColor: '#F3E5F5',
        gradient: ['#BA68C8', '#9C27B0'],
    },
    neverhaveiever: {
        label: 'Never Have I Ever',
        color: '#607D8B',
        lightColor: '#ECEFF1',
        gradient: ['#90A4AE', '#607D8B'],
    },
    deep: {
        label: 'Deep',
        color: '#3F51B5',
        lightColor: '#E8EAF6',
        gradient: ['#7986CB', '#3F51B5'],
    },
};

// Category icon components
const CategoryIcon = ({ category, size = 28, color = '#FFFFFF' }) => {
    switch (category) {
        case 'future':
            return (
                <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                    <Circle cx="12" cy="12" r="6" fill={color} opacity={0.9} />
                    <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={2} opacity={0.5} />
                    <Path d="M12 6v1M12 17v1M6 12h1M17 12h1" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
                    <Circle cx="10" cy="10" r="1.5" fill={color} opacity={0.6} />
                </Svg>
            );
        case 'money':
            return (
                <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                    <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth={2} />
                    <Path d="M12 6v12M9 9c0-1.1.9-2 2-2h2c1.1 0 2 .9 2 2s-.9 2-2 2h-2c-1.1 0-2 .9-2 2s.9 2 2 2h2c1.1 0 2-.9 2-2" stroke={color} strokeWidth={2} strokeLinecap="round" />
                </Svg>
            );
        case 'hotspicy':
            return (
                <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                    <Path
                        d="M12 2c.3 3.5-1.5 5.5-3 7.5-1.5 2-2 4-2 5.5 0 3.5 2.5 6 6 6s6-2.5 6-6c0-4-3.5-7-4-10.5-.5 2.5-1 3.5-3 2.5z"
                        fill={color}
                    />
                    <Path
                        d="M12 22c-2 0-3.5-1.5-3.5-3.5 0-2 1.5-3 2.5-4 .5.5 1 1 1 2 .5-1.5 1-2.5 1-4 1 1.5 2.5 3 2.5 5.5 0 2-1.5 4-3.5 4z"
                        fill={color}
                        opacity={0.6}
                    />
                </Svg>
            );
        case 'political':
            return (
                <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                    <Path d="M19 5l-7 4V5l-7 4v6l7 4v-4l7 4V5z" fill={color} />
                    <Rect x="3" y="9" width="3" height="6" rx="1" fill={color} opacity={0.8} />
                </Svg>
            );
        case 'fitness':
            return (
                <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                    <Path d="M6 12h12" stroke={color} strokeWidth={3} strokeLinecap="round" />
                    <Rect x="2" y="8" width="4" height="8" rx="1" fill={color} />
                    <Rect x="18" y="8" width="4" height="8" rx="1" fill={color} />
                    <Rect x="4" y="6" width="2" height="12" rx="1" fill={color} opacity={0.7} />
                    <Rect x="18" y="6" width="2" height="12" rx="1" fill={color} opacity={0.7} />
                </Svg>
            );
        case 'travel':
            return (
                <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                    <Path
                        d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"
                        fill={color}
                    />
                </Svg>
            );
        case 'family':
            return (
                <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                    <Path
                        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                        fill={color}
                    />
                    <Circle cx="12" cy="10" r="2" fill={color} opacity={0.5} />
                </Svg>
            );
        case 'dailychallenge':
            return (
                <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                    <Path d="M12 2L9 9l-7 1 5 5-1 7 6-3 6 3-1-7 5-5-7-1-3-7z" fill={color} />
                </Svg>
            );
        default:
            return (
                <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                    <Path
                        d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
                        fill={color}
                    />
                </Svg>
            );
    }
};

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

    // Get category config
    const categoryConfig = CATEGORY_CONFIG[chat?.questionSource] || CATEGORY_CONFIG.deep;

    // Fetch chat and messages
    const fetchChat = useCallback(async () => {
        try {
            const response = await fetch(`${API_BASE}/api/chat/${chatId}?limit=50`);
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
    }, [chatId]);

    useEffect(() => {
        fetchChat();
    }, [fetchChat]);

    // Socket event handlers
    useEffect(() => {
        if (!socket || !chatId) return;

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
    }, [socket, chatId, userId]);

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
    }, [socket, chatId, userId, userName, sending]);

    // Handle typing indicator
    const handleTyping = useCallback((isTyping) => {
        if (socket?.connected) {
            socket.emit('chat:typing', { chatId, isTyping });
        }
    }, [socket, chatId]);

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
                questionCategory={chat?.questionCategory}
            />
        );
    };

    const renderQuestionCard = () => {
        if (!chat || !showQuestionCard) return null;

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
                        {chat.questionText}
                    </Text>
                    <Text style={styles.tapHint}>
                        {questionExpanded ? 'Tap to collapse' : 'Tap to expand'}
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
                <Text style={styles.typingText}>{partnerName} is typing...</Text>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.centerContent, { paddingTop: insets.top }]}>
                <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                        <Path
                            d="M15 18l-6-6 6-6"
                            stroke="#FFFFFF"
                            strokeWidth={2.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </Svg>
                    <Text style={styles.backText}>Chats</Text>
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
                            <Text style={styles.headerTypingText}>typing...</Text>
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
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000000',
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
        backgroundColor: '#000000',
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        minWidth: 60,
    },
    backText: {
        fontSize: 17,
        color: '#FFFFFF',
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
        backgroundColor: '#1A1A1A',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerAvatarText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    headerName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    headerTextContainer: {
        flexDirection: 'column',
        alignItems: 'flex-start',
    },
    headerTypingText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        fontStyle: 'italic',
    },
    headerSpacer: {
        minWidth: 70,

    },
    questionCard: {
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    questionCardGradient: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 8,
        backgroundColor: '#1A1A1A',
        borderRadius: 12,
    },
    questionCardCollapsed: {
        maxHeight: 80,
    },
    questionLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.6)',
        marginBottom: 8,
    },
    questionText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
        lineHeight: 22,
        marginBottom: 6,
    },
    tapHint: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.4)',
        textAlign: 'center',
        marginTop: 4,
    },
    collapseHintContainer: {
        alignItems: 'center',
    },
    collapseHint: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        fontWeight: '500',
    },
    answersContainer: {
        borderTopWidth: 1,
        borderTopColor: '#2A2A2A',
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
        color: '#FFFFFF',
    },
    answerContent: {
        flex: 1,
    },
    answerLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.5)',
        marginBottom: 2,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    answerText: {
        fontSize: 14,
        color: '#FFFFFF',
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
        color: '#FFFFFF',
        marginBottom: spacing.xs,
    },
    emptyText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.5)',
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
        backgroundColor: 'rgba(255,255,255,0.5)',
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
        color: 'rgba(255,255,255,0.5)',
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
        backgroundColor: '#1A1A1A',
        borderColor: '#2A2A2A',
    },
    answerMessageLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.5)',
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    answerMessageText: {
        fontSize: 15,
        color: '#FFFFFF',
        lineHeight: 21,
    },
    answerTextSent: {
        color: '#FFFFFF',
    },
});
