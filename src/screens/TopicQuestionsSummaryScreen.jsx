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
import Svg, { Path, Circle } from 'react-native-svg';
import LinearGradient from 'react-native-linear-gradient';

import { colors, spacing, borderRadius } from '../theme';
import { fontFamily } from '../constants/fonts';
import { QuestionsV2Api } from '../api/questionsV2Api';

const formatLabels = {
    deep: 'Deep',
    neverhaveiever: 'Never Have I Ever',
    likelyto: 'Likely To',
    wouldyourather: 'Would You Rather',
    thisorthat: 'This or That',
    slider: 'Slider',
    voicerecord: 'Voice',
    takephoto: 'Photo',
};

const getSetEmoji = (format, title) => {
    const titleLower = (title || '').toLowerCase();
    const formatLower = (format || '').toLowerCase();

    if (titleLower.includes('spicy') || titleLower.includes('hot') || titleLower.includes('dirty')) return '🔥';
    if (titleLower.includes('love') || titleLower.includes('romance') || titleLower.includes('date')) return '💖';
    if (titleLower.includes('deep') || titleLower.includes('soul') || titleLower.includes('intimate')) return '🔮';
    if (titleLower.includes('fun') || titleLower.includes('game') || titleLower.includes('play')) return '🎉';
    if (titleLower.includes('ice') || titleLower.includes('break')) return '🧊';
    if (titleLower.includes('future') || titleLower.includes('dream') || titleLower.includes('plan')) return '🚀';
    if (titleLower.includes('conflict') || titleLower.includes('hard') || titleLower.includes('tough')) return '🛡️';

    if (formatLower.includes('deep')) return '💭';
    if (formatLower.includes('neverhaveiever')) return '🙅';
    if (formatLower.includes('likelyto')) return '📈';
    if (formatLower.includes('wouldyourather')) return '🤔';
    if (formatLower.includes('thisorthat')) return '⚖️';
    if (formatLower.includes('slider')) return '🎚️';
    if (formatLower.includes('voicerecord')) return '🎙️';
    if (formatLower.includes('takephoto')) return '📸';

    return '✨';
};

const getFormatColors = (format) => {
    switch (format) {
        case 'deep':
            return { primary: '#0D9488', bg: '#E6F7F0', gradient: ['#E6F7F0', '#F0FDFA'] };
        case 'neverhaveiever':
            return { primary: '#7C3AED', bg: '#F3E8FF', gradient: ['#F3E8FF', '#F9F5FF'] };
        case 'likelyto':
            return { primary: '#DB2777', bg: '#FCE7F3', gradient: ['#FCE7F3', '#FDF2F8'] };
        case 'wouldyourather':
            return { primary: '#2563EB', bg: '#EFF6FF', gradient: ['#EFF6FF', '#F8FAFC'] };
        case 'thisorthat':
            return { primary: '#D97706', bg: '#FEF3C7', gradient: ['#FEF3C7', '#FFFDF5'] };
        case 'slider':
            return { primary: '#475569', bg: '#F1F5F9', gradient: ['#F1F5F9', '#F8FAFC'] };
        case 'voicerecord':
            return { primary: '#4F46E5', bg: '#EEF2F6', gradient: ['#EEF2F6', '#F5F7FA'] };
        case 'takephoto':
            return { primary: '#E11D48', bg: '#FFF1F2', gradient: ['#FFF1F2', '#FFF8F8'] };
        default:
            return { primary: '#7C3AED', bg: '#F3E8FF', gradient: ['#F3E8FF', '#F9F5FF'] };
    }
};



export default function TopicQuestionsSummaryScreen({
    topic,
    topicTitle,
    selectedSet,
    userId,
    partnerName = 'Your Love',
    onBack,
    onNavigateToPremium,
    isPremium = false,
    hasPartner = false,
    onLinkPartner = () => { },
}) {
    const insets = useSafeAreaInsets();
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const format = selectedSet?.format || 'deep';
    const setColors = getFormatColors(format);
    const emoji = getSetEmoji(format, selectedSet?.title);

    useEffect(() => {
        if (!hasPartner && onLinkPartner) {
            onLinkPartner();
        }
    }, [hasPartner, onLinkPartner]);

    const fetchReport = useCallback(async () => {
        if (!hasPartner) return;
        setLoading(true);
        setError(null);
        try {
            const response = await QuestionsV2Api.getSetReport({
                topicId: topic,
                setId: selectedSet.setId,
                userId,
            });
            if (response.success) {
                setReport(response.data);
            } else {
                if (response.message === 'User has no partner linked' && onLinkPartner) {
                    onLinkPartner();
                    return;
                }
                setError(response.message || 'Failed to load summary');
            }
        } catch (err) {
            if (err.message === 'User has no partner linked' && onLinkPartner) {
                onLinkPartner();
                return;
            }
            setError(err.message || 'An error occurred loading summary');
        } finally {
            setLoading(false);
        }
    }, [topic, selectedSet?.setId, userId, hasPartner, onLinkPartner]);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    const formatAnswer = (ans, formatType) => {
        if (ans === null || ans === undefined) return '—';
        if (formatType === 'likelyto') {
            return ans === 'you' ? 'Me' : ans === 'partner' ? partnerName : ans;
        }
        if (formatType === 'neverhaveiever') {
            return ans === 'have' || ans === 'I have' ? 'I Have 🙋' : 'Never 🙅';
        }
        if (formatType === 'takephoto') {
            return 'Captured Photo 📸';
        }
        if (formatType === 'voicerecord') {
            return 'Voice Note 🎙️';
        }
        return String(ans);
    };

    const renderAnswerPreview = (ans, formatType, isCurrentUser) => {
        if (ans === null || ans === undefined) {
            return (
                <View style={styles.pendingBubble}>
                    <Text style={styles.pendingText}>Waiting...</Text>
                </View>
            );
        }

        const displayVal = formatAnswer(ans, formatType);
        const bubbleBg = isCurrentUser ? setColors.bg : '#F1F5F9';
        const textColor = isCurrentUser ? setColors.primary : '#334155';

        if (formatType === 'takephoto' && typeof ans === 'string' && ans.startsWith('http')) {
            return (
                <Image source={{ uri: ans }} style={styles.answerPhoto} resizeMode="cover" />
            );
        }

        return (
            <View style={[styles.answerBubble, { backgroundColor: bubbleBg }]}>
                <Text style={[styles.answerText, { color: textColor }]}>
                    {displayVal}
                </Text>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={setColors.primary} />
                <Text style={styles.loadingText}>Loading Summary...</Text>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.center}>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: setColors.primary }]}
                    onPress={fetchReport}
                >
                    <Text style={styles.primaryButtonText}>Try Again</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryButton} onPress={onBack}>
                    <Text style={styles.secondaryButtonText}>Back to Sets</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const items = report?.items || [];
    const summary = report?.summary || { totalQuestions: items.length, bothAnswered: 0 };
    const similarity = summary.similarityPercent;

    const ringSize = 100;
    const ringStroke = 10;
    const ringRadius = (ringSize - ringStroke) / 2;
    const ringCircumference = 2 * Math.PI * ringRadius;

    return (
        <LinearGradient
            colors={['#F8D9EC', '#FFF7FA', '#FFF4F7', '#F7D8F2']}
            locations={[0, 0.34, 0.72, 1]}
            start={{ x: 0.25, y: 0 }}
            end={{ x: 0.75, y: 1 }}
            style={styles.screen}
        >
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
                <TouchableOpacity onPress={onBack} style={styles.headerBackBtn}>
                    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                        <Path d="M15 18l-6-6 6-6" stroke={colors.text} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                </TouchableOpacity>
                <View style={styles.headerTextBlock}>
                    <Text style={styles.headerTitle} numberOfLines={1}>{selectedSet?.title}</Text>
                    <View style={[styles.headerBadge, { backgroundColor: setColors.bg }]}>
                        <Text style={[styles.headerBadgeText, { color: setColors.primary }]}>
                            {formatLabels[format] || format}
                        </Text>
                    </View>
                </View>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
               

                {/* Question Breakdown */}
                <Text style={styles.sectionTitle}>Question Breakdown</Text>

                {items.map((item, idx) => {
                    const isMatch = item.match === true;
                    return (
                        <View key={item.questionId || idx} style={styles.questionCard}>
                            <View style={styles.questionHeader}>
                                <View style={[styles.indexBadge, { backgroundColor: setColors.bg }]}>
                                    <Text style={[styles.indexText, { color: setColors.primary }]}>
                                        {idx + 1}
                                    </Text>
                                </View>
                                <Text style={styles.questionPrompt}>
                                    {item.prompt}
                                </Text>
                                {isMatch && (
                                    <View style={styles.matchBadge}>
                                        <Text style={styles.matchText}>Match!</Text>
                                    </View>
                                )}
                            </View>

                            <View style={styles.answersContainer}>
                                <View style={styles.answerBox}>
                                    <Text style={styles.answerLabel}>You</Text>
                                    {renderAnswerPreview(item.userAnswer, format, true)}
                                </View>

                                <View style={styles.heartContainer}>
                                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                                        <Path
                                            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                                            fill={isMatch ? '#FF758F' : 'transparent'}
                                            stroke={isMatch ? '#FF758F' : '#D0C8D9'}
                                            strokeWidth={isMatch ? 0 : 2}
                                        />
                                    </Svg>
                                </View>

                                <View style={styles.answerBox}>
                                    <Text style={styles.answerLabel}>{partnerName}</Text>
                                    {renderAnswerPreview(item.partnerAnswer, format, false)}
                                </View>
                            </View>
                        </View>
                    );
                })}

                <TouchableOpacity
                    style={[styles.doneBtn, { backgroundColor: setColors.primary }]}
                    onPress={onBack}
                >
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                        <Path d="M19 12H5M12 19l-7-7 7-7" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                    <Text style={styles.doneBtnText}>Back to Sets</Text>
                </TouchableOpacity>
            </ScrollView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
    },
    loadingText: {
        marginTop: spacing.md,
        color: '#7C6E8F',
        fontSize: 16,
        fontFamily: fontFamily.medium,
    },
    errorText: {
        color: '#FF758F',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: spacing.lg,
        fontFamily: fontFamily.medium,
    },
    primaryButton: {
        borderRadius: borderRadius.lg,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        marginBottom: spacing.sm,
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: fontFamily.bold,
    },
    secondaryButton: {
        paddingVertical: spacing.sm,
    },
    secondaryButtonText: {
        color: '#7C6E8F',
        fontSize: 15,
        fontFamily: fontFamily.medium,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
        backgroundColor: 'transparent',
    },
    headerBackBtn: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: 'rgba(255, 255, 255, 0.86)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F7DDEA',
    },
    headerTextBlock: {
        flex: 1,
        marginHorizontal: spacing.md,
        alignItems: 'center',
    },
    headerSpacer: {
        width: 42,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: colors.text,
        textAlign: 'center',
        fontFamily: fontFamily.bold,
    },
    headerBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
        marginTop: 4,
    },
    headerBadgeText: {
        fontSize: 11,
        fontFamily: fontFamily.bold,
        fontWeight: '700',
    },
    scrollContent: {
        padding: spacing.lg,
        paddingBottom: spacing.xl * 2,
    },
    heroCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
        borderRadius: 24,
        padding: spacing.xl,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.8)',
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 4,
        marginBottom: spacing.lg,
    },
    emojiContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 1,
    },
    emojiText: {
        fontSize: 32,
    },
    heroTitle: {
        fontSize: 22,
        fontFamily: fontFamily.extraBold,
        fontWeight: '800',
        color: '#2E1E3C',
        textAlign: 'center',
        marginBottom: 6,
    },
    heroSubtitle: {
        fontSize: 14.5,
        fontFamily: fontFamily.medium,
        color: '#7C6E8F',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: spacing.lg,
    },
    similaritySection: {
        width: '100%',
        alignItems: 'center',
    },
    ringContainer: {
        position: 'relative',
        width: 100,
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    ringTextContainer: {
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
    },
    ringText: {
        fontSize: 22,
        fontFamily: fontFamily.extraBold,
        fontWeight: '800',
    },
    ringLabel: {
        fontSize: 10,
        fontFamily: fontFamily.medium,
        color: '#A396B2',
    },
    matchIndicator: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.lg,
    },
    matchLabelText: {
        fontSize: 13,
        fontFamily: fontFamily.bold,
        fontWeight: '700',
    },
    statsGrid: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        borderTopWidth: 1,
        borderTopColor: 'rgba(46, 30, 60, 0.05)',
        paddingTop: spacing.md,
        marginTop: spacing.sm,
    },
    statBox: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 20,
        fontFamily: fontFamily.extraBold,
        fontWeight: '800',
        color: '#2E1E3C',
    },
    statLabel: {
        fontSize: 12,
        fontFamily: fontFamily.medium,
        color: '#7C6E8F',
        marginTop: 2,
    },
    statDivider: {
        width: 1,
        height: 24,
        backgroundColor: 'rgba(46, 30, 60, 0.08)',
    },
    nonComparableSection: {
        alignItems: 'center',
        width: '100%',
    },
    nonComparableBadge: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        marginBottom: spacing.sm,
    },
    nonComparableText: {
        fontSize: 14,
        fontFamily: fontFamily.bold,
        fontWeight: '700',
    },
    nonComparableSub: {
        fontSize: 13,
        fontFamily: fontFamily.medium,
        color: '#7C6E8F',
        textAlign: 'center',
    },
    inProgressSection: {
        width: '100%',
        alignItems: 'center',
        marginTop: spacing.md,
        paddingTop: spacing.md,
        borderTopWidth: 1,
        borderTopColor: 'rgba(46, 30, 60, 0.05)',
    },
    progressBarBg: {
        width: '100%',
        height: 8,
        borderRadius: 4,
        backgroundColor: '#FFF0F3',
        overflow: 'hidden',
        marginBottom: spacing.sm,
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 4,
    },
    inProgressText: {
        fontSize: 12,
        fontFamily: fontFamily.medium,
        color: '#7C6E8F',
        textAlign: 'center',
        lineHeight: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontFamily: fontFamily.bold,
        fontWeight: '700',
        color: '#2E1E3C',
        marginBottom: spacing.md,
        marginTop: spacing.md,
    },
    questionCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: 20,
        padding: spacing.md,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.88)',
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 2,
    },
    questionHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: spacing.md,
        gap: spacing.sm,
    },
    indexBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 2,
    },
    indexText: {
        fontSize: 12,
        fontFamily: fontFamily.bold,
        fontWeight: '700',
    },
    questionPrompt: {
        flex: 1,
        fontSize: 15,
        fontFamily: fontFamily.bold,
        fontWeight: '700',
        color: '#2E1E3C',
        lineHeight: 22,
    },
    matchBadge: {
        backgroundColor: '#D1FAE5',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    matchText: {
        fontSize: 10,
        fontFamily: fontFamily.bold,
        fontWeight: '700',
        color: '#059669',
    },
    answersContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTopWidth: 1,
        borderTopColor: 'rgba(46, 30, 60, 0.05)',
        paddingTop: spacing.md,
    },
    answerBox: {
        flex: 1,
        alignItems: 'center',
    },
    answerLabel: {
        fontSize: 11,
        fontFamily: fontFamily.medium,
        color: '#A396B2',
        marginBottom: 6,
    },
    answerBubble: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: 12,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 4,
        elevation: 1,
    },
    answerText: {
        fontSize: 13,
        fontFamily: fontFamily.bold,
        fontWeight: '600',
        textAlign: 'center',
    },
    answerPhoto: {
        width: '100%',
        height: 80,
        borderRadius: 12,
    },
    pendingBubble: {
        backgroundColor: '#FFF9FB',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: 12,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: '#FFD3E0',
    },
    pendingText: {
        fontSize: 12,
        fontFamily: fontFamily.medium,
        fontStyle: 'italic',
        color: '#FF758F',
    },
    heartContainer: {
        paddingHorizontal: spacing.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    doneBtn: {
        borderRadius: 28,
        paddingVertical: 15,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: spacing.lg,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 3,
        flexDirection: 'row',
        gap: 8,
    },
    doneBtnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: fontFamily.bold,
        fontWeight: '700',
    },
});
