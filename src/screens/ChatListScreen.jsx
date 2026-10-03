import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    Animated,
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    Image,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { Video } from 'lucide-react-native';
import { colors, spacing, borderRadius } from '../theme';
import GradientBackground from '../components/GradientBackground';
import { API_BASE } from '../constants/Api';
import { QuestionChatsV2Api } from '../api/questionsV2Api';
import { useSocket } from '../hooks/useSocket';
import { TOPIC_CATEGORIES } from '../constants/Categories';
import { fontFamily, fontWeight } from '../constants/fonts';
import { storage } from '../utils/authStorage';
import { formatDisplayDate } from '../utils/dateUtils';
import { formatRelativeTime, getUiLocale, translateUiTemplate, translateUiText } from '../i18n/uiTranslation';

const TOPIC_CONFIG = TOPIC_CATEGORIES;

// Fallback config for categories without images
const FALLBACK_CONFIG = {
    dailychallenge: { title: "Daily Ritual", emoji: '🔥', gradient: ['#FFDECE', '#FFF3EB'], textColor: '#EA580C' },
    likelyto: { title: "Most Likely To", emoji: '🎯', gradient: ['#E8EAF6', '#C5CAE9'], textColor: '#283593' },
    neverhaveiever: { title: "Never Have I Ever", emoji: '🤫', gradient: ['#FCE4EC', '#F8BBD0'], textColor: '#AD1457' },
    deep: { title: "Deep Talk", emoji: '💭', gradient: ['#EDE7F6', '#D1C4E9'], textColor: '#4527A0' },
    wouldyourather: { title: "Would You Rather", emoji: '⚖️', gradient: ['#FFF0F6', '#FCE4EC'], textColor: '#C92C68' },
    thisorthat: { title: "This or That", emoji: '✨', gradient: ['#E6FFFA', '#CCFBF1'], textColor: '#0D9488' },
    slider: { title: "Slider", emoji: '📏', gradient: ['#F3E8FF', '#E8D5FF'], textColor: '#7E22CE' },
    voicerecord: { title: "Voice Notes", emoji: '🎙️', gradient: ['#F5E8FF', '#E9D5FF'], textColor: '#6D3CA1' },
    takephoto: { title: "Photo Set", emoji: '📸', gradient: ['#FFE4EC', '#FFD1DC'], textColor: '#C9255A' },
};

const DEFAULT_GRADIENT = ['#F3E8FF', '#E8D5FF'];
const DEFAULT_TEXT_COLOR = '#6B21A8';

const chatListCache = new Map();
const CHAT_LIST_CACHE_PREFIX = 'chat_list_cache_';
const VIDEO_CHAT_GUIDE_PREFIX = 'chat_list_video_chat_guide:';

const getCacheKey = (userId) => `${CHAT_LIST_CACHE_PREFIX}${userId}`;

const normalizeV2Chat = (chat) => {
    const rawPreview = chat.lastMessage;
    let fallbackPreview = translateUiText('New question thread');
    if (chat.format === 'voicerecord') fallbackPreview = `🎙️ ${translateUiText('Voice note')}`;
    else if (chat.format === 'takephoto') fallbackPreview = `📸 ${translateUiText('Photo shared')}`;
    else if (chat.format === 'slider') fallbackPreview = `📏 ${translateUiText('Rating shared')}`;

    const source = (chat.topicId && TOPIC_CONFIG[chat.topicId])
        ? chat.topicId
        : (chat.format && (TOPIC_CONFIG[chat.format] || FALLBACK_CONFIG[chat.format]))
            ? chat.format
            : chat.topicId || chat.format || 'deep';

    return {
        ...chat,
        _id: String(chat._id),
        chatMode: 'questionV2',
        isQuestionV2: true,
        hasUserMessages: Boolean(chat.hasUserMessages),
        userMessageCount: Number(chat.userMessageCount || 0),
        questionSource: source,
        questionText: chat.prompt || chat.questionText,
        lastMessagePreview: rawPreview || fallbackPreview,
        lastMessageAt: chat.lastMessageAt || chat.updatedAt || chat.createdAt,
        unreadCount: typeof chat.unreadCount === 'number' ? chat.unreadCount : 0,
    };
};

const isDisplayableChat = (chat) => {
    // Legacy chats are always displayed
    if (!chat.isQuestionV2 && chat.chatMode !== 'questionV2') return true;
    // V2 question chats are only displayed if a user has sent a message
    return Boolean(chat.hasUserMessages) || (chat.userMessageCount > 0);
};

const groupDailyChallengeChats = (chats) => {
    const dailyMap = new Map();
    const result = [];

    for (const chat of chats) {
        if (chat.questionSource === 'dailychallenge') {
            const key = chat.challengeId?._id || chat.challengeId || chat.date || (chat.createdAt ? new Date(chat.createdAt).toISOString().split('T')[0] : chat._id);
            const existing = dailyMap.get(key);
            if (!existing) {
                const normalizedDaily = {
                    ...chat,
                    questionText: chat.questionText || 'Daily Ritual',
                    lastMessagePreview: chat.lastMessagePreview || translateUiText('Tap to view answers'),
                };
                dailyMap.set(key, normalizedDaily);
                result.push(normalizedDaily);
            } else {
                if (getChatTime(chat) > getChatTime(existing)) {
                    const idx = result.indexOf(existing);
                    if (idx !== -1) {
                        const updatedDaily = {
                            ...chat,
                            questionText: chat.questionText || existing.questionText || 'Daily Ritual',
                            lastMessagePreview: chat.lastMessagePreview || existing.lastMessagePreview,
                        };
                        result[idx] = updatedDaily;
                        dailyMap.set(key, updatedDaily);
                    }
                }
            }
        } else {
            result.push(chat);
        }
    }

    return result;
};

const readStoredChatCache = (userId) => {
    if (!userId) return null;

    try {
        const value = storage.getString(getCacheKey(userId));
        return value ? JSON.parse(value) : null;
    } catch (error) {
        console.warn('Error reading chat list cache:', error);
        return null;
    }
};

const writeStoredChatCache = (userId, cacheValue) => {
    if (!userId) return;

    try {
        storage.set(getCacheKey(userId), JSON.stringify(cacheValue));
    } catch (error) {
        console.warn('Error writing chat list cache:', error);
    }
};

const getChatTime = (chat) => new Date(chat.lastMessageAt || chat.updatedAt || chat.createdAt || 0).getTime();

const sortChats = (items) => [...items].sort((a, b) => getChatTime(b) - getChatTime(a));

const formatRitualDate = (chat) => {
    const rawDate = chat.date || chat.createdAt;
    if (!rawDate) return '';

    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) return '';

    // Keep the ritual's calendar day consistent with the summary navigation.
    const day = date.toISOString().split('T')[0];
    return formatDisplayDate(`${day}T00:00:00`);
};

const mergeChats = (currentChats, changedChats) => {
    const byId = new Map(currentChats.map(chat => [chat._id, chat]));

    changedChats.forEach(chat => {
        byId.set(chat._id, {
            ...byId.get(chat._id),
            ...chat,
        });
    });

    const deduped = groupDailyChallengeChats(Array.from(byId.values()));
    return sortChats(deduped.filter(isDisplayableChat));
};

/**
 * ChatListScreen - List of all chat threads for the couple
 */
export default function ChatListScreen({
    userId,
    partnerName = 'Partner',
    partnerOnline = false,
    liveChatDisabled = false,
    onLiveChatPress,
    onSelectChat,
}) {
    const insets = useSafeAreaInsets();
    const socket = useSocket();
    const [chats, setChats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [dismissedVideoChatGuideKey, setDismissedVideoChatGuideKey] = useState(null);
    const [videoChatGuideReady, setVideoChatGuideReady] = useState(false);
    const videoChatGuideAnim = useRef(new Animated.Value(0)).current;
    const videoChatGuideKey = userId ? `${VIDEO_CHAT_GUIDE_PREFIX}${userId}` : null;
    const canShowVideoChatGuide = !loading
        && !liveChatDisabled
        && Boolean(onLiveChatPress)
        && Boolean(videoChatGuideKey)
        && dismissedVideoChatGuideKey !== videoChatGuideKey
        && storage.getBoolean(videoChatGuideKey) !== true;
    const showVideoChatGuide = canShowVideoChatGuide && videoChatGuideReady;

    useEffect(() => {
        setVideoChatGuideReady(false);
        if (!canShowVideoChatGuide) return undefined;

        const timer = setTimeout(() => setVideoChatGuideReady(true), 3000);
        return () => clearTimeout(timer);
    }, [canShowVideoChatGuide, videoChatGuideKey]);

    useEffect(() => {
        if (!showVideoChatGuide) return undefined;

        videoChatGuideAnim.setValue(0);
        Animated.spring(videoChatGuideAnim, {
            toValue: 1,
            friction: 7,
            tension: 40,
            useNativeDriver: true,
        }).start();

        return () => videoChatGuideAnim.stopAnimation();
    }, [showVideoChatGuide, videoChatGuideAnim]);

    const dismissVideoChatGuide = useCallback(() => {
        if (!videoChatGuideKey) return;
        storage.set(videoChatGuideKey, true);
        if (!showVideoChatGuide) {
            setDismissedVideoChatGuideKey(videoChatGuideKey);
            return;
        }

        Animated.timing(videoChatGuideAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
        }).start(({ finished }) => {
            if (finished) setDismissedVideoChatGuideKey(videoChatGuideKey);
        });
    }, [videoChatGuideKey, showVideoChatGuide, videoChatGuideAnim]);

    const handleVideoChatPress = useCallback(() => {
        dismissVideoChatGuide();
        onLiveChatPress?.();
    }, [dismissVideoChatGuide, onLiveChatPress]);

    const fetchChats = useCallback(async ({ forceFull = false } = {}) => {
        const cacheKey = userId?.toString();
        const memoryCache = cacheKey ? chatListCache.get(cacheKey) : null;
        const storedCache = !memoryCache && cacheKey ? readStoredChatCache(cacheKey) : null;
        const cached = memoryCache || storedCache;

        try {
            setError(null);

            if (cached && !forceFull) {
                const filteredCached = groupDailyChallengeChats((cached.chats || []).filter(isDisplayableChat));
                setChats(filteredCached);
                setLoading(false);
                if (cacheKey && !memoryCache) {
                    chatListCache.set(cacheKey, cached);
                }
            }

            const url = cached && !forceFull
                ? `${API_BASE}/api/chat/user/${userId}/changes?since=${encodeURIComponent(cached.syncTime)}`
                : `${API_BASE}/api/chat/user/${userId}`;

            const [legacyResult, v2Result] = await Promise.allSettled([
                fetch(url).then(res => res.json()),
                QuestionChatsV2Api.getChats(userId, { hasUserMessages: true }),
            ]);

            let legacyChats = [];
            let legacySyncTime = new Date().toISOString();
            let hasLegacyData = false;

            if (legacyResult.status === 'fulfilled' && legacyResult.value?.success) {
                legacyChats = legacyResult.value.data?.chats || [];
                legacySyncTime = legacyResult.value.data?.syncTime || legacySyncTime;
                hasLegacyData = true;
            }

            let v2Chats = [];
            let hasV2Data = false;
            if (v2Result.status === 'fulfilled' && v2Result.value?.success) {
                v2Chats = (v2Result.value.data?.chats || [])
                    .map(normalizeV2Chat)
                    .filter(isDisplayableChat);
                hasV2Data = true;
            }

            if (hasLegacyData || hasV2Data) {
                const serverChats = groupDailyChallengeChats([...legacyChats, ...v2Chats]);
                const nextChats = cached && !forceFull
                    ? mergeChats(cached.chats, serverChats)
                    : sortChats(serverChats.filter(isDisplayableChat));

                setChats(nextChats);

                if (cacheKey) {
                    const cacheValue = {
                        chats: nextChats,
                        syncTime: legacySyncTime,
                    };

                    chatListCache.set(cacheKey, cacheValue);
                    writeStoredChatCache(cacheKey, cacheValue);
                }
            } else if (!cached) {
                const errMsg = (legacyResult.status === 'fulfilled' && legacyResult.value?.message)
                    || (v2Result.status === 'fulfilled' && v2Result.value?.error)
                    || 'Failed to load chats';
                setError(errMsg);
            }
        } catch (err) {
            console.error('Error fetching chats:', err);
            if (!cached) {
                setError('Could not connect to server');
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [userId]);

    useEffect(() => {
        fetchChats();
    }, [fetchChats]);

    // Listen for real-time chat updates to keep the list fresh
    useEffect(() => {
        if (!socket) return;

        const handleChatUpdate = () => {
            fetchChats({ forceFull: true });
        };

        socket.on('chat:newMessage', handleChatUpdate);
        socket.on('questionChatV2:message', handleChatUpdate);
        socket.on('questionChatV2:notification', handleChatUpdate);

        return () => {
            socket.off('chat:newMessage', handleChatUpdate);
            socket.off('questionChatV2:message', handleChatUpdate);
            socket.off('questionChatV2:notification', handleChatUpdate);
        };
    }, [socket, fetchChats]);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchChats({ forceFull: true });
    };

    const formatTime = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return formatRelativeTime(0, 'minute');
        if (diffMins < 60) return formatRelativeTime(-diffMins, 'minute');
        if (diffHours < 24) return formatRelativeTime(-diffHours, 'hour');
        if (diffDays < 7) return formatRelativeTime(-diffDays, 'day');
        return date.toLocaleDateString(getUiLocale());
    };

    const getTopicConfig = (source) => {
        if (TOPIC_CONFIG[source]) {
            return {
                ...TOPIC_CONFIG[source],
                textColor: TOPIC_CONFIG[source].textColor || TOPIC_CONFIG[source].color || DEFAULT_TEXT_COLOR,
                hasImage: Boolean(TOPIC_CONFIG[source].image),
            };
        }
        if (FALLBACK_CONFIG[source]) return { ...FALLBACK_CONFIG[source], hasImage: false };
        return {
            title: source?.charAt(0).toUpperCase() + source?.slice(1) || 'Chat',
            emoji: '💬',
            gradient: DEFAULT_GRADIENT,
            textColor: DEFAULT_TEXT_COLOR,
            hasImage: false,
        };
    };

    const renderChatItem = ({ item }) => {
        const config = getTopicConfig(item.questionSource);
        const hasUnread = item.unreadCount > 0;
        const ritualDate = item.questionSource === 'dailychallenge' ? formatRitualDate(item) : '';

        return (
            <TouchableOpacity
                style={[styles.chatItem, hasUnread && styles.chatItemUnread]}
                onPress={() => onSelectChat(item)}
                activeOpacity={0.82}
            >
                {/* Category indicator with gradient - matches HomeScreen topic cards */}
                <LinearGradient
                    colors={config.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.categoryIndicator}
                >
                    {config.hasImage ? (
                        <Image source={config.image} style={styles.categoryImage} resizeMode="contain" />
                    ) : (
                        <Text style={styles.categoryEmoji}>{config.emoji}</Text>
                    )}
                </LinearGradient>

                {/* Chat content */}
                <View style={styles.chatContent}>
                    {/* Header with source and time */}
                    <View style={styles.chatHeader}>
                        <Text
                            style={[styles.chatSource, { color: config.textColor }]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.8}
                        >
                            {translateUiText(config.title)}
                            {ritualDate ? (
                                <Text style={styles.ritualDate}>{` (${ritualDate})`}</Text>
                            ) : null}
                        </Text>
                        <Text style={styles.chatTime}>
                            {formatTime(item.lastMessageAt || item.createdAt)}
                        </Text>
                    </View>

                    {/* Question text */}
                    <Text style={styles.questionText} numberOfLines={2}>
                        {item.questionText}
                    </Text>

                    {/* Last message or status */}
                    <View style={styles.chatFooter}>
                        <Text style={styles.lastMessage} numberOfLines={1}>
                            {item.lastMessagePreview || translateUiText("New chat thread")}
                        </Text>
                    </View>
                </View>

                {/* Unread badge */}
                {hasUnread && (
                    <View style={styles.unreadBadge}>
                        <Text style={styles.unreadCount}>
                            {item.unreadCount > 99 ? '99+' : item.unreadCount}
                        </Text>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    const renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>💬</Text>
            <Text style={styles.emptyTitle}>{translateUiText("No chats yet")}</Text>
            <Text style={styles.emptyText}>
                {translateUiTemplate("Answer questions with {{0}} to start discussions!", [partnerName])}
            </Text>
        </View>
    );

    if (loading) {
        return (
            <GradientBackground variant="light" showOrbs={true} showParticles={true}>
                <View style={[styles.container, styles.centerContent, { paddingTop: insets.top, backgroundColor: 'transparent' }]}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>{translateUiText("Loading chats...")}</Text>
                </View>
            </GradientBackground>
        );
    }

    return (
        <GradientBackground variant="light" showOrbs={true} showParticles={true}>
            <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle} numberOfLines={1}>{translateUiText("Chats")}</Text>
                    <TouchableOpacity
                        style={[styles.liveChatButton, liveChatDisabled && styles.liveChatButtonDisabled]}
                        onPress={handleVideoChatPress}
                        disabled={liveChatDisabled || !onLiveChatPress}
                        activeOpacity={0.84}
                        accessibilityRole="button"
                        accessibilityLabel={translateUiText("Open Video Chat")}
                        accessibilityState={{ disabled: liveChatDisabled || !onLiveChatPress }}
                        accessibilityHint={liveChatDisabled
                            ? translateUiText("Available after your video call ends")
                            : partnerOnline
                                ? translateUiTemplate("{{0}} is online", [partnerName])
                                : translateUiTemplate("{{0}} can join when online", [partnerName])}
                    >
                        <LinearGradient
                            colors={liveChatDisabled ? ['#D9D3D8', '#C8C1C8'] : ['#F94E82', '#D83C73']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.liveChatIcon}
                        >
                            <Video color="#FFFFFF" size={24} strokeWidth={2.5} />
                        </LinearGradient>
                        <View style={[styles.livePresenceDot, partnerOnline && styles.livePresenceDotOnline]} />
                    </TouchableOpacity>
                    {showVideoChatGuide && (
                        <Animated.View
                            style={[
                                styles.videoChatGuide,
                                {
                                    opacity: videoChatGuideAnim,
                                    transform: [
                                        {
                                            scale: videoChatGuideAnim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [0.88, 1],
                                            }),
                                        },
                                        {
                                            translateY: videoChatGuideAnim.interpolate({
                                                inputRange: [0, 1],
                                                outputRange: [-10, 0],
                                            }),
                                        },
                                    ],
                                },
                            ]}
                            accessibilityRole="alert"
                        >
                            <View style={styles.videoChatGuideArrow} />
                            <Text style={styles.videoChatGuideText}>
                                {translateUiText("Video chat with your partner.")}
                            </Text>
                            <TouchableOpacity
                                style={styles.videoChatGuideDismiss}
                                onPress={dismissVideoChatGuide}
                                activeOpacity={0.8}
                                accessibilityRole="button"
                                accessibilityLabel={translateUiText("Dismiss video call guidance")}
                            >
                                <Text style={styles.videoChatGuideDismissText}>{translateUiText("Got it")}</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    )}
                </View>

                {/* Error state */}
                {error && (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{translateUiText(error)}</Text>
                        <TouchableOpacity style={styles.retryButton} onPress={fetchChats}>
                            <Text style={styles.retryText}>{translateUiText("Try Again")}</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Chat list */}
                <FlatList
                    style={{ flex: 1 }}
                    data={chats}
                    renderItem={renderChatItem}
                    keyExtractor={(item) => item._id}
                    contentContainerStyle={[
                        styles.listContent,
                        chats.length === 0 && styles.listEmpty,
                        { paddingBottom: insets.bottom + 80 }
                    ]}
                    ListEmptyComponent={renderEmpty}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={handleRefresh}
                            tintColor={colors.primary}
                        />
                    }
                    showsVerticalScrollIndicator={false}
                />
            </View>
        </GradientBackground>
    );
}

const cardShadow = Platform.select({
    ios: {
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
    },
    android: {
        elevation: 0,
    },
});

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
        zIndex: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 18,
        paddingTop: 6,
        paddingBottom: 4,
        backgroundColor: 'transparent',
    },
    headerTitle: {
        flex: 1,
        marginRight: 12,
        fontFamily: fontFamily.extraBold,
        fontSize: 32,
        fontWeight: fontWeight('800'),
        color: '#202B5E',
        letterSpacing: -0.5,
        marginBottom: 6,
    },
    liveChatButton: {
        width: 44,
        height: 44,
    },
    liveChatButtonDisabled: {
        opacity: 0.65,
    },
    liveChatIcon: {
        width: 44,
        height: 44,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    livePresenceDot: {
        position: 'absolute',
        right: 2,
        bottom: 2,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#B7AFB7',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    livePresenceDotOnline: {
        backgroundColor: '#35C985',
    },
    videoChatGuide: {
        position: 'absolute',
        top: '100%',
        right: 18,
        marginTop: 8,
        width: 240,
        maxWidth: '85%',
        padding: 16,
        borderRadius: 8,
        backgroundColor: '#4B2947',
        shadowColor: '#321B33',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
        elevation: 8,
    },
    videoChatGuideArrow: {
        position: 'absolute',
        top: -6,
        right: 16,
        width: 12,
        height: 12,
        backgroundColor: '#4B2947',
        transform: [{ rotate: '45deg' }],
    },
    videoChatGuideText: {
        color: '#FFFFFF',
        fontFamily: fontFamily.medium,
        fontSize: 14,
        lineHeight: 20,
    },
    videoChatGuideDismiss: {
        alignSelf: 'flex-end',
        minHeight: 44,
        justifyContent: 'center',
        paddingHorizontal: 12,
        marginTop: 8,
    },
    videoChatGuideDismissText: {
        color: '#F7D8E8',
        fontFamily: fontFamily.bold,
        fontSize: 14,
    },
    loadingText: {
        marginTop: spacing.md,
        fontSize: 16,
        color: colors.textSecondary,
        fontFamily: fontFamily.medium,
    },
    errorContainer: {
        padding: spacing.lg,
        alignItems: 'center',
    },
    errorText: {
        fontSize: 16,
        color: colors.error,
        textAlign: 'center',
        marginBottom: spacing.md,
        fontFamily: fontFamily.medium,
    },
    retryButton: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        backgroundColor: colors.primary,
        borderRadius: borderRadius.lg,
    },
    retryText: {
        color: '#FFFFFF',
        fontWeight: fontWeight('600'),
        fontFamily: fontFamily.bold,
    },
    listContent: {
        padding: spacing.md,
    },
    listEmpty: {
        flex: 1,
    },
    chatItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.92)',
        borderRadius: 18,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#F8DDE8',
        ...cardShadow,
    },
    chatItemUnread: {
        borderColor: colors.primary,
        borderWidth: 1.5,
        backgroundColor: 'rgba(255,255,255,0.97)',
    },
    categoryIndicator: {
        width: 52,
        height: 52,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.6)',
        overflow: 'hidden',
    },
    categoryEmoji: {
        fontSize: 24,
    },
    categoryImage: {
        width: 38,
        height: 38,
    },
    chatContent: {
        flex: 1,
    },
    chatHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    chatSource: {
        flexShrink: 1,
        marginRight: 8,
        fontSize: 14,
        fontWeight: fontWeight('800'),
        fontFamily: fontFamily.extraBold,
    },
    chatTime: {
        fontSize: 12,
        color: colors.textSecondary,
        fontFamily: fontFamily.medium,
    },
    ritualDate: {
        fontSize: 12,
        color: colors.textSecondary,
        fontFamily: fontFamily.medium,
    },
    questionText: {
        fontSize: 14,
        color: colors.text,
        lineHeight: 19,
        marginBottom: 4,
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('600'),
    },
    chatFooter: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    lastMessage: {
        fontSize: 13,
        color: colors.textSecondary,
        flex: 1,
        fontFamily: fontFamily.regular,
    },
    statusText: {
        fontSize: 13,
        color: colors.textSecondary,
        fontStyle: 'italic',
        fontFamily: fontFamily.regular,
    },
    unreadBadge: {
        minWidth: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#FF758F',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
        marginLeft: spacing.sm,
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
    },
    unreadCount: {
        fontSize: 11,
        fontWeight: fontWeight('900'),
        color: '#FFFFFF',
        fontFamily: fontFamily.extraBold,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
    },
    emptyEmoji: {
        fontSize: 64,
        marginBottom: spacing.lg,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: fontWeight('800'),
        color: colors.text,
        marginBottom: spacing.sm,
        fontFamily: fontFamily.extraBold,
    },
    emptyText: {
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        fontFamily: fontFamily.medium,
    },
});
