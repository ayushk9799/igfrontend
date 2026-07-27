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
import LinearGradient from 'react-native-linear-gradient';

import GradientBackground from '../components/GradientBackground';
import { colors, spacing, borderRadius } from '../theme';
import { getActivityByDate } from '../utils/answerApi';
import { formatRelativeTime, getUiLocale, translateUiTemplate, translateUiText } from '../i18n/uiTranslation';

/**
 * ActivityFeedScreen - Shows who completed today's challenge
 */
export default function ActivityFeedScreen({ onBack = () => { }, onViewUser }) {
    const insets = useSafeAreaInsets();
    const [activity, setActivity] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchActivity = useCallback(async () => {
        try {
            // Get user's local date in YYYY-MM-DD format
            const now = new Date();
            const userLocalDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const result = await getActivityByDate(userLocalDate);
            if (result.success) {
                setActivity(result.data || []);
            }
        } catch (error) {
            console.error('Failed to fetch activity:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchActivity();
    }, [fetchActivity]);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchActivity();
    };

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);

        if (diffMins < 1) return formatRelativeTime(0, 'minute');
        if (diffMins < 60) return formatRelativeTime(-diffMins, 'minute');
        if (diffHours < 24) return formatRelativeTime(-diffHours, 'hour');
        return date.toLocaleDateString(getUiLocale());
    };

    const renderActivityItem = ({ item }) => (
        <TouchableOpacity
            style={styles.activityCard}
            onPress={() => onViewUser?.(item.userId?._id)}
            activeOpacity={0.8}
        >
            <LinearGradient
                colors={['#FFFFFF', '#F8F9FA']}
                style={styles.cardGradient}
            />
            <View style={styles.avatarContainer}>
                {item.userId?.avatar ? (
                    <Image source={{ uri: item.userId.avatar }} style={styles.avatar} />
                ) : (
                    <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarEmoji}>😊</Text>
                    </View>
                )}
                <View style={styles.completeBadge}>
                    <Text style={styles.checkmark}>✓</Text>
                </View>
            </View>
            <View style={styles.activityContent}>
                <Text style={styles.userName}>{item.userId?.name || translateUiText("Anonymous")}</Text>
                <Text style={styles.activityText}>{translateUiText("Completed today's challenge")}</Text>
                <Text style={styles.timeText}>{formatTime(item.completedAt)}</Text>
            </View>
            <View style={styles.statsContainer}>
                <Text style={styles.statsNumber}>{item.tasksCompleted}</Text>
                <Text style={styles.statsLabel}>{translateUiText("tasks")}</Text>
            </View>
        </TouchableOpacity>
    );

    const renderEmptyState = () => (
        <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🌙</Text>
            <Text style={styles.emptyTitle}>{translateUiText("No Activity Yet")}</Text>
            <Text style={styles.emptyText}>{translateUiText("Be the first to complete today's challenge!")}</Text>
        </View>
    );

    if (loading) {
        return (
            <GradientBackground variant="warm">
                <View style={[styles.center, { paddingTop: insets.top }]}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </GradientBackground>
        );
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backBtn}>
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
                <View style={styles.headerContent}>
                    <Text style={styles.headerTitle}>{translateUiText("Today's Activity")}</Text>
                    <Text style={styles.headerSubtitle}>
                        {activity.length === 1
                            ? translateUiTemplate("{{0}} person completed", [activity.length])
                            : translateUiTemplate("{{0}} people completed", [activity.length])}</Text>
                </View>
            </View>

            {/* Activity List */}
            <FlatList
                data={activity}
                keyExtractor={(item) => item._id}
                renderItem={renderActivityItem}
                ListEmptyComponent={renderEmptyState}
                contentContainerStyle={styles.listContent}
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
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    backBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.borderLight,
    },
    headerContent: {
        marginLeft: spacing.md,
        flex: 1,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: colors.text,
    },
    headerSubtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: 2,
    },
    listContent: {
        padding: spacing.lg,
        paddingTop: spacing.sm,
    },
    activityCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.md,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.borderLight,
    },
    cardGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    avatarContainer: {
        position: 'relative',
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
    },
    avatarPlaceholder: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: colors.backgroundAlt,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarEmoji: {
        fontSize: 24,
    },
    completeBadge: {
        position: 'absolute',
        bottom: -2,
        right: -2,
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#10B981',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },
    checkmark: {
        fontSize: 10,
        color: '#fff',
        fontWeight: '700',
    },
    activityContent: {
        flex: 1,
        marginLeft: spacing.md,
    },
    userName: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text,
    },
    activityText: {
        fontSize: 13,
        color: colors.textSecondary,
        marginTop: 2,
    },
    timeText: {
        fontSize: 12,
        color: colors.textMuted,
        marginTop: 4,
    },
    statsContainer: {
        alignItems: 'center',
        paddingLeft: spacing.md,
    },
    statsNumber: {
        fontSize: 20,
        fontWeight: '800',
        color: colors.primary,
    },
    statsLabel: {
        fontSize: 11,
        color: colors.textSecondary,
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: spacing.xl * 2,
    },
    emptyEmoji: {
        fontSize: 48,
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
    },
});
