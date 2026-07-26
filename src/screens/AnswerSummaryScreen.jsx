import React, { useEffect, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import LinearGradient from 'react-native-linear-gradient';

import GradientBackground from '../components/GradientBackground';
import { colors, spacing, borderRadius } from '../theme';
import { getCoupleAnswers } from '../utils/answerApi';
import { translateUiText } from '../i18n/uiTranslation';

const categoryConfig = {
    likelyto: { emoji: '⚖️', color: '#FF6B9D', label: "Most likely to..." },
    neverhaveiever: { emoji: '🤫', color: '#F4A261', label: "Never have I ever" },
    deep: { emoji: '💭', color: '#5BB5A6', label: "Deep question" },
    takephoto: { emoji: '📸', color: '#9B59B6', label: "Photo moment" },
};

/**
 * AnswerSummaryScreen - Compare your answers with partner's
 */
export default function AnswerSummaryScreen({
    date,
    userId,
    challengeTitle = "Today's Challenge",
    onBack = () => { },
}) {
    const insets = useSafeAreaInsets();
    const [data, setData] = useState({ user: null, partner: null, bothComplete: false });
    const [loading, setLoading] = useState(true);

    const fetchAnswers = useCallback(async () => {
        try {
            const result = await getCoupleAnswers(date, userId);
            if (result.success) {
                setData(result.data);
            }
        } catch (error) {
            console.error('Failed to fetch couple answers:', error);
        } finally {
            setLoading(false);
        }
    }, [date, userId]);

    useEffect(() => {
        fetchAnswers();
    }, [fetchAnswers]);

    const renderAnswerComparison = (userAnswer, partnerAnswer) => {
        const config = categoryConfig[userAnswer?.category] || categoryConfig.deep;
        const userA = userAnswer?.answer || '—';
        const partnerA = partnerAnswer?.answer || '—';
        const match = userA === partnerA && userA !== '—';

        return (
            <View style={styles.comparisonCard} key={userAnswer?.taskId}>
                <LinearGradient
                    colors={[config.color + '10', config.color + '05']}
                    style={styles.cardGradient}
                />
                <View style={styles.categoryBadge}>
                    <Text>{config.emoji}</Text>
                    <Text style={[styles.categoryLabel, { color: config.color }]}>
                        {translateUiText(config.label)}
                    </Text>
                    {match && (
                        <View style={styles.matchBadge}>
                            <Text style={styles.matchText}>{translateUiText("Match!")}</Text>
                        </View>
                    )}
                </View>

                <View style={styles.answersRow}>
                    {/* Your answer */}
                    <View style={styles.answerBox}>
                        <Text style={styles.answerLabel}>{translateUiText("You")}</Text>
                        {userAnswer?.category === 'takephoto' && userAnswer?.photoUrl ? (
                            <Image source={{ uri: userAnswer.photoUrl }} style={styles.answerPhoto} />
                        ) : (
                            <View style={[styles.answerBubble, { backgroundColor: config.color + '20' }]}>
                                <Text style={[styles.answerText, { color: config.color }]}>
                                    {userA}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* VS divider */}
                    <View style={styles.vsDivider}>
                        <Text style={styles.vsText}>{translateUiText("vs")}</Text>
                    </View>

                    {/* Partner's answer */}
                    <View style={styles.answerBox}>
                        <Text style={styles.answerLabel}>{translateUiText("Partner")}</Text>
                        {partnerAnswer?.category === 'takephoto' && partnerAnswer?.photoUrl ? (
                            <Image source={{ uri: partnerAnswer.photoUrl }} style={styles.answerPhoto} />
                        ) : data.bothComplete ? (
                            <View style={[styles.answerBubble, { backgroundColor: colors.backgroundAlt }]}>
                                <Text style={styles.answerText}>{partnerA}</Text>
                            </View>
                        ) : (
                            <View style={styles.pendingBubble}>
                                <Text style={styles.pendingText}>{translateUiText("Waiting...")}</Text>
                            </View>
                        )}
                    </View>
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <GradientBackground variant="warm">
                <View style={[styles.center, { paddingTop: insets.top }]}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </GradientBackground>
        );
    }

    const userAnswers = data.user?.answers || [];
    const partnerAnswers = data.partner?.answers || [];

    // Create comparison pairs
    const comparisons = userAnswers.map((ua) => {
        const pa = partnerAnswers.find(
            (p) => p.taskId?.toString() === ua.taskId?.toString()
        );
        return { user: ua, partner: pa };
    });

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
                    <Text style={styles.headerTitle}>{translateUiText("Answer Summary")}</Text>
                    <Text style={styles.headerSubtitle}>{challengeTitle}</Text>
                </View>
            </View>

            {/* Status Banner */}
            <View style={[
                styles.statusBanner,
                { backgroundColor: data.bothComplete ? '#10B98120' : '#F59E0B20' }
            ]}>
                <Text style={styles.statusEmoji}>
                    {data.bothComplete ? '💕' : '⏳'}
                </Text>
                <Text style={[
                    styles.statusText,
                    { color: data.bothComplete ? '#10B981' : '#F59E0B' }
                ]}>
                    {data.bothComplete
                        ? translateUiText("Both of you completed the challenge!")
                        : translateUiText("Waiting for your partner to finish...")}
                </Text>
            </View>

            {/* Comparisons */}
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {comparisons.length > 0 ? (
                    comparisons.map(({ user, partner }) =>
                        renderAnswerComparison(user, partner)
                    )
                ) : (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyEmoji}>📝</Text>
                        <Text style={styles.emptyText}>{translateUiText("No answers yet")}</Text>
                    </View>
                )}
            </ScrollView>
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
    statusBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
        marginHorizontal: spacing.lg,
        borderRadius: borderRadius.md,
        marginBottom: spacing.md,
    },
    statusEmoji: {
        fontSize: 18,
        marginRight: spacing.sm,
    },
    statusText: {
        fontSize: 14,
        fontWeight: '600',
        flex: 1,
    },
    scrollContent: {
        padding: spacing.lg,
        paddingTop: 0,
    },
    comparisonCard: {
        borderRadius: borderRadius.lg,
        padding: spacing.md,
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
    categoryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.md,
        gap: 6,
    },
    categoryLabel: {
        fontSize: 14,
        fontWeight: '600',
    },
    matchBadge: {
        marginLeft: 'auto',
        backgroundColor: '#10B981',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    matchText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#fff',
    },
    answersRow: {
        flexDirection: 'row',
        alignItems: 'stretch',
    },
    answerBox: {
        flex: 1,
        alignItems: 'center',
    },
    answerLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: spacing.xs,
    },
    answerBubble: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.md,
        minWidth: 80,
        alignItems: 'center',
    },
    answerText: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.text,
        textAlign: 'center',
    },
    answerPhoto: {
        width: 80,
        height: 80,
        borderRadius: borderRadius.md,
    },
    pendingBubble: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.md,
        backgroundColor: colors.borderLight,
        minWidth: 80,
        alignItems: 'center',
    },
    pendingText: {
        fontSize: 13,
        fontStyle: 'italic',
        color: colors.textMuted,
    },
    vsDivider: {
        justifyContent: 'center',
        paddingHorizontal: spacing.sm,
    },
    vsText: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.textMuted,
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: spacing.xl * 2,
    },
    emptyEmoji: {
        fontSize: 48,
        marginBottom: spacing.md,
    },
    emptyText: {
        fontSize: 16,
        color: colors.textSecondary,
    },
});
