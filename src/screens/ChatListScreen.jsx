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

// Category emoji mapping
const CATEGORY_EMOJI = {
    future: '🔮',
    money: '💰',
    hotspicy: '🌶️',
    political: '⚖️',
    fitness: '💪',
    travel: '✈️',
    family: '👨‍👩‍👧‍👦',
    dailychallenge: '⭐',
    likelyto: '🎯',
    neverhaveiever: '🤫',
    deep: '💭',
};

// Category colors
const CATEGORY_COLORS = {
    future: '#9333EA',
    money: '#F59E0B',
    hotspicy: '#EF4444',
    political: '#6366F1',
    fitness: '#10B981',
    travel: '#0EA5E9',
    family: '#EC4899',
    dailychallenge: '#F97068',
    likelyto: '#8B5CF6',
    neverhaveiever: '#F4A261',
    deep: '#5BB5A6',
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
        const emoji = CATEGORY_EMOJI[item.questionSource] || '💬';
        const categoryColor = CATEGORY_COLORS[item.questionSource] || colors.primary;
        const hasUnread = item.unreadCount > 0;

        return (
            <TouchableOpacity
                style={[styles.chatItem, hasUnread && styles.chatItemUnread]}
                onPress={() => onSelectChat(item)}
                activeOpacity={0.7}
            >
                {/* Category indicator */}
                <View style={[styles.categoryIndicator, { backgroundColor: categoryColor }]}>
                    <Text style={styles.categoryEmoji}>{emoji}</Text>
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
                <ActivityIndicator size="large" color={colors.primary} />
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
                            stroke={colors.text}
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </Svg>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>💬 Chats</Text>
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
                data={chats}
                renderItem={renderChatItem}
                keyExtractor={(item) => item._id}
                contentContainerStyle={[
                    styles.listContent,
                    chats.length === 0 && styles.listEmpty
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
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
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
        borderBottomColor: colors.borderLight,
        backgroundColor: colors.surface,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.backgroundAlt,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.text,
    },
    loadingText: {
        marginTop: spacing.md,
        fontSize: 16,
        color: colors.textSecondary,
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
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.borderLight,
    },
    chatItemUnread: {
        borderColor: colors.primary,
        borderWidth: 1.5,
    },
    categoryIndicator: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    categoryEmoji: {
        fontSize: 22,
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
        color: colors.text,
    },
    chatTime: {
        fontSize: 12,
        color: colors.textMuted,
    },
    questionText: {
        fontSize: 15,
        color: colors.text,
        lineHeight: 20,
        marginBottom: 4,
    },
    chatFooter: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    lastMessage: {
        fontSize: 13,
        color: colors.textSecondary,
        flex: 1,
    },
    statusText: {
        fontSize: 13,
        color: colors.textMuted,
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
        color: colors.text,
        marginBottom: spacing.sm,
    },
    emptyText: {
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
    },
});
