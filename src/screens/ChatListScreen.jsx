import React, { useEffect, useState, useCallback } from 'react';
import {
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
import Svg, { Path } from 'react-native-svg';
import LinearGradient from 'react-native-linear-gradient';
import { colors, spacing, borderRadius } from '../theme';
import GradientBackground from '../components/GradientBackground';
import { API_BASE } from '../constants/Api';
import { fontFamily, fontWeight } from '../constants/fonts';
import { storage } from '../utils/authStorage';

// Topic config matching HomeScreen's CONNECTION_TOPICS exactly
const TOPIC_CONFIG = {
    future: {
        title: 'Future',
        image: require('../../assets/home/future-crystal.png'),
        gradient: ['#D9B6FF', '#C79BFF'],
        textColor: '#7341C8',
    },
    money: {
        title: 'Money',
        image: require('../../assets/home/money-bag.png'),
        gradient: ['#B6EBCF', '#D7F4DE'],
        textColor: '#087D61',
    },
    hotspicy: {
        title: 'Hot & Spicy',
        image: require('../../assets/home/hot-fire.png'),
        gradient: ['#FFA8B7', '#FFC3CD'],
        textColor: '#B63567',
    },
    political: {
        title: 'Political',
        image: require('../../assets/home/political-ballot.png'),
        gradient: ['#90C8FF', '#AED6FF'],
        textColor: '#1C6EBB',
    },
    fitness: {
        title: 'Lifestyle',
        image: require('../../assets/home/lifestyle-arm.png'),
        gradient: ['#7ADCE1', '#B5EEF0'],
        textColor: '#13788D',
    },
    travel: {
        title: 'Travel',
        image: require('../../assets/home/travel-plane.png'),
        gradient: ['#FFC35C', '#FFD780'],
        textColor: '#A45B13',
    },
    family: {
        title: 'Family',
        image: require('../../assets/home/family.png'),
        gradient: ['#FFB8D0', '#FFD6E4'],
        textColor: '#B63567',
    },
};

// Fallback config for categories without images
const FALLBACK_CONFIG = {
    dailychallenge: { title: 'Daily Challenge', emoji: '⭐', gradient: ['#FFE0B2', '#FFF3E0'], textColor: '#E65100' },
    likelyto: { title: 'Most Likely To', emoji: '🎯', gradient: ['#E8EAF6', '#C5CAE9'], textColor: '#283593' },
    neverhaveiever: { title: 'Never Have I Ever', emoji: '🤫', gradient: ['#FCE4EC', '#F8BBD0'], textColor: '#AD1457' },
    deep: { title: 'Deep Talk', emoji: '💭', gradient: ['#EDE7F6', '#D1C4E9'], textColor: '#4527A0' },
};

const DEFAULT_GRADIENT = ['#F3E8FF', '#E8D5FF'];
const DEFAULT_TEXT_COLOR = '#6B21A8';

const chatListCache = new Map();
const CHAT_LIST_CACHE_PREFIX = 'chat_list_cache_';

const getCacheKey = (userId) => `${CHAT_LIST_CACHE_PREFIX}${userId}`;

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

const mergeChats = (currentChats, changedChats) => {
    const byId = new Map(currentChats.map(chat => [chat._id, chat]));

    changedChats.forEach(chat => {
        byId.set(chat._id, {
            ...byId.get(chat._id),
            ...chat,
        });
    });

    return sortChats(Array.from(byId.values()));
};

/**
 * ChatListScreen - List of all chat threads for the couple
 */
export default function ChatListScreen({
    userId,
    partnerName = 'Partner',
    onSelectChat,
    onBack,
}) {
    const insets = useSafeAreaInsets();
    const [chats, setChats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    const fetchChats = useCallback(async ({ forceFull = false } = {}) => {
        const cacheKey = userId?.toString();
        const memoryCache = cacheKey ? chatListCache.get(cacheKey) : null;
        const storedCache = !memoryCache && cacheKey ? readStoredChatCache(cacheKey) : null;
        const cached = memoryCache || storedCache;

        try {
            setError(null);

            if (cached && !forceFull) {
                setChats(cached.chats);
                setLoading(false);
                if (cacheKey && !memoryCache) {
                    chatListCache.set(cacheKey, cached);
                }
            }

            const url = cached && !forceFull
                ? `${API_BASE}/api/chat/user/${userId}/changes?since=${encodeURIComponent(cached.syncTime)}`
                : `${API_BASE}/api/chat/user/${userId}`;

            const response = await fetch(url);
            const json = await response.json();

            if (json.success) {
                const serverChats = json.data.chats || [];
                const nextChats = cached && !forceFull
                    ? mergeChats(cached.chats, serverChats)
                    : sortChats(serverChats);
                const syncTime = json.data.syncTime || new Date().toISOString();

                setChats(nextChats);

                if (cacheKey) {
                    const cacheValue = {
                        chats: nextChats,
                        syncTime,
                    };

                    chatListCache.set(cacheKey, cacheValue);
                    writeStoredChatCache(cacheKey, cacheValue);
                }
            } else {
                setError(json.message || 'Failed to load chats');
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

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    const getTopicConfig = (source) => {
        if (TOPIC_CONFIG[source]) return { ...TOPIC_CONFIG[source], hasImage: true };
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
                        <Text style={[styles.chatSource, { color: config.textColor }]}>
                            {config.title}
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
                            {item.lastMessagePreview || 'New chat thread'}
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
            <Text style={styles.emptyTitle}>No chats yet</Text>
            <Text style={styles.emptyText}>
                Answer questions with {partnerName} to start discussions!
            </Text>
        </View>
    );

    if (loading) {
        return (
            <GradientBackground variant="light" showOrbs={true} showParticles={true}>
                <View style={[styles.container, styles.centerContent, { paddingTop: insets.top, backgroundColor: 'transparent' }]}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Loading chats...</Text>
                </View>
            </GradientBackground>
        );
    }

    return (
        <GradientBackground variant="light" showOrbs={true} showParticles={true}>
            <View style={[styles.container, { paddingTop: insets.top }]}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                            <Path
                                d="M15 18l-6-6 6-6"
                                stroke={colors.text}
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </Svg>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}> Chats</Text>
                    <View style={{ width: 44 }} />
                </View>

                {/* Error state */}
                {error && (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{error}</Text>
                        <TouchableOpacity style={styles.retryButton} onPress={fetchChats}>
                            <Text style={styles.retryText}>Try Again</Text>
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
        elevation: 3,
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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        borderBottomWidth: 1.5,
        borderBottomColor: '#FAE8FF',
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
        ...cardShadow,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: fontWeight('800'),
        color: colors.text,
        letterSpacing: 0.5,
        fontFamily: fontFamily.extraBold,
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
        fontSize: 14,
        fontWeight: fontWeight('800'),
        fontFamily: fontFamily.extraBold,
    },
    chatTime: {
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
