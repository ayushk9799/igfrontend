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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { colors, spacing, borderRadius } from '../theme';
import { API_BASE } from '../constants/Api';
import { TOPIC_CATEGORIES } from '../constants/Categories';

// Topic image mapping - matches HomeScreen topic images
const TOPIC_IMAGES = {
    hotspicy: require('../../assets/chilli.png'),
    money: require('../../assets/coins.png'),
    future: require('../../assets/couplecutout.png'),
    fitness: require('../../assets/couplerunning.png'),
    travel: require('../../assets/travel.png'),
    family: require('../../assets/couplekids5.png'),
};

// Fallback emoji for topics without images
const CATEGORY_EMOJI = {
    political: '⚖️',
    dailychallenge: '⭐',
    likelyto: '🎯',
    neverhaveiever: '🤫',
    deep: '💭',
};

// Helper to get topic color from TOPIC_CATEGORIES (same as HomeScreen)
const getTopicColor = (topicId) => {
    return TOPIC_CATEGORIES[topicId]?.color || colors.primary;
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

    const fetchChats = useCallback(async () => {
        try {
            setError(null);
            const response = await fetch(`${API_BASE}/api/chat/user/${userId}`);
            const json = await response.json();

            if (json.success) {
                setChats(json.data.chats || []);
            } else {
                setError(json.message || 'Failed to load chats');
            }
        } catch (err) {
            console.error('Error fetching chats:', err);
            setError('Could not connect to server');
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
        fetchChats();
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

    const renderChatItem = ({ item }) => {
        const topicImage = TOPIC_IMAGES[item.questionSource];
        const emoji = CATEGORY_EMOJI[item.questionSource] || '💬';
        const categoryColor = getTopicColor(item.questionSource);
        const hasUnread = item.unreadCount > 0;

        return (
            <TouchableOpacity
                style={[styles.chatItem, hasUnread && styles.chatItemUnread]}
                onPress={() => onSelectChat(item)}
                activeOpacity={0.7}
            >
                {/* Category indicator */}
                <View style={[styles.categoryIndicator, { backgroundColor: categoryColor }]}>
                    {topicImage ? (
                        <Image source={topicImage} style={styles.categoryImage} resizeMode="contain" />
                    ) : (
                        <Text style={styles.categoryEmoji}>{emoji}</Text>
                    )}
                </View>

                {/* Chat content */}
                <View style={styles.chatContent}>
                    {/* Header with source and time */}
                    <View style={styles.chatHeader}>
                        <Text style={styles.chatSource}>
                            {item.questionSource?.charAt(0).toUpperCase() + item.questionSource?.slice(1) || 'Chat'}
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
            <View style={[styles.container, styles.centerContent, { paddingTop: insets.top }]}>
                <ActivityIndicator size="large" color="#FFFFFF" />
                <Text style={styles.loadingText}>Loading chats...</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                        <Path
                            d="M15 18l-6-6 6-6"
                            stroke="#FFFFFF"
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
                        tintColor="#FFFFFF"
                    />
                }
                showsVerticalScrollIndicator={false}
            />
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
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: '#2A2A2A',
        backgroundColor: '#000000',
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#1A1A1A',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },
    loadingText: {
        marginTop: spacing.md,
        fontSize: 16,
        color: 'rgba(255,255,255,0.6)',
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
    },
    retryButton: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        backgroundColor: colors.primary,
        borderRadius: borderRadius.lg,
    },
    retryText: {
        color: '#FFFFFF',
        fontWeight: '600',
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
        backgroundColor: '#1A1A1A',
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: '#2A2A2A',
    },
    chatItemUnread: {
        borderColor: colors.primary,
        borderWidth: 1.5,
    },
    categoryIndicator: {
        width: 52,
        height: 52,
        borderRadius: 26,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
    },
    categoryEmoji: {
        fontSize: 24,
    },
    categoryImage: {
        width: 34,
        height: 34,
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
        fontWeight: '600',
        color: '#FFFFFF',
    },
    chatTime: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
    },
    questionText: {
        fontSize: 15,
        color: '#FFFFFF',
        lineHeight: 20,
        marginBottom: 4,
    },
    chatFooter: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    lastMessage: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.5)',
        flex: 1,
    },
    statusText: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.4)',
        fontStyle: 'italic',
    },
    unreadBadge: {
        minWidth: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
        marginLeft: spacing.sm,
    },
    unreadCount: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
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
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: spacing.sm,
    },
    emptyText: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
        lineHeight: 22,
    },
});
