import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';

import {
    ANSWER_FORMAT_THEME as FORMAT_THEME,
    SUMMARY_GRADIENT as HOME_GRADIENT,
    ConversationRow,
    SliderRow,
} from '../components/questions/QuestionAnswerSummary';
import { QuestionsV2Api } from '../api/questionsV2Api';
import { fontFamily } from '../constants/fonts';
import { translateUiText } from '../i18n/uiTranslation';
import { spacing } from '../theme';
import {
    mergeQuestionReportWithLocalAnswers,
    QuestionReportCache,
} from '../services/questionReportCache';

const COMPARISON_FORMATS = new Set(['wouldyourather', 'thisorthat']);
const isPresent = value => value !== null && value !== undefined;

function BackIcon({ color = '#2B1238', size = 24 }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={color} strokeWidth={2.7} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
    );
}

function SliderHero({ summary }) {
    const hasComparison = summary.bothAnswered > 0
        && Number.isFinite(summary.similarityPercent);
    return (
        <View style={styles.sliderHero}>
            <View style={styles.brokenHeart}>
                <Text style={styles.brokenHeartText}>{hasComparison ? '💞' : '💗'}</Text>
            </View>
            <View>
                <Text style={styles.similarityText}>
                    {hasComparison
                        ? `${summary.similarityPercent}% ${translateUiText('in sync')}`
                        : translateUiText('Waiting to compare')}
                </Text>
                <Text style={styles.similaritySub}>
                    {hasComparison
                        ? `${translateUiText('Across')} ${summary.bothAnswered} ${translateUiText('ratings')}`
                        : translateUiText('Both answers will appear here')}
                </Text>
            </View>
        </View>
    );
}

export default function TopicQuestionsSummaryScreen({
    topic,
    topicTitle = '',
    selectedSet,
    userId,
    userName = 'You',
    partnerName = 'Your Love',
    userAvatar = null,
    partnerAvatar = null,
    onBack,
    hasPartner = false,
    onLinkPartner = () => {},
    onAnswerQuestion,
    onOpenQuestionChat,
    optimisticReport = null,
    refreshVersion = 0,
}) {
    const insets = useSafeAreaInsets();
    const scrollY = useRef(new Animated.Value(0)).current;

    const navBgOpacity = useMemo(() => scrollY.interpolate({
        inputRange: [15, 45],
        outputRange: [0, 0.96],
        extrapolate: 'clamp',
    }), [scrollY]);

    const navBorderOpacity = useMemo(() => scrollY.interpolate({
        inputRange: [20, 50],
        outputRange: [0, 1],
        extrapolate: 'clamp',
    }), [scrollY]);

    const compactTitleOpacity = useMemo(() => scrollY.interpolate({
        inputRange: [30, 65],
        outputRange: [0, 1],
        extrapolate: 'clamp',
    }), [scrollY]);

    const compactTitleTranslateY = useMemo(() => scrollY.interpolate({
        inputRange: [30, 65],
        outputRange: [6, 0],
        extrapolate: 'clamp',
    }), [scrollY]);

    const badgeOpacity = useMemo(() => scrollY.interpolate({
        inputRange: [10, 40],
        outputRange: [1, 0],
        extrapolate: 'clamp',
    }), [scrollY]);

    const initialReportRef = useRef(undefined);
    if (initialReportRef.current === undefined) {
        const cachedReport = QuestionReportCache.get({
            topicId: topic,
            setId: selectedSet?.setId,
            userId,
        });
        initialReportRef.current = mergeQuestionReportWithLocalAnswers(
            cachedReport,
            optimisticReport,
        );
    }
    const reportRef = useRef(initialReportRef.current);
    const [report, setReport] = useState(initialReportRef.current);
    const [loading, setLoading] = useState(!initialReportRef.current);
    const [error, setError] = useState(null);
    const format = selectedSet?.format || 'deep';
    const theme = FORMAT_THEME[format] || FORMAT_THEME.deep;

    useEffect(() => {
        if (!initialReportRef.current) return;
        QuestionReportCache.set({
            topicId: topic,
            setId: selectedSet?.setId,
            userId,
            report: initialReportRef.current,
        });
    }, [selectedSet?.setId, topic, userId]);

    const fetchReport = useCallback(async () => {
        if (!hasPartner) {
            setLoading(false);
            onLinkPartner?.();
            return;
        }
        setLoading(!reportRef.current);
        setError(null);
        try {
            const response = await QuestionsV2Api.getSetReport({ topicId: topic, setId: selectedSet?.setId, userId });
            if (response.success) {
                reportRef.current = response.data;
                setReport(response.data);
                QuestionReportCache.set({
                    topicId: topic,
                    setId: selectedSet?.setId,
                    userId,
                    report: response.data,
                });
            }
            else if (response.message === 'User has no partner linked') onLinkPartner?.();
            else if (!reportRef.current) setError(response.message || response.error || 'Failed to load summary');
        } catch (err) {
            if (!reportRef.current) setError(err.message || 'Failed to load summary');
        } finally {
            setLoading(false);
        }
    }, [hasPartner, onLinkPartner, selectedSet?.setId, topic, userId]);

    useEffect(() => { fetchReport(); }, [fetchReport, refreshVersion]);

    useEffect(() => {
        if (!optimisticReport) return;
        const merged = mergeQuestionReportWithLocalAnswers(reportRef.current, optimisticReport);
        reportRef.current = merged;
        setReport(merged);
        setLoading(false);
    }, [optimisticReport]);

    const items = report?.items || [];
    const summary = report?.summary || { totalQuestions: items.length, bothAnswered: 0, matched: 0, similarityPercent: null };
    const subtitle = useMemo(() => {
        if (format === 'voicerecord') return `🔒  ${translateUiText('Only you two can hear these')}`;
        if (format === 'takephoto') return `${summary.bothAnswered || 0} ${translateUiText('moments shared')}`;
        if (COMPARISON_FORMATS.has(format)) return `☆  ${summary.matched || 0} ${translateUiText('shared favorites')}`;
        if (format === 'slider') return null;
        return `${summary.bothAnswered || 0} ${translateUiText('questions answered together')}`;
    }, [format, summary.bothAnswered, summary.matched]);

    if (loading) {
        return (
            <LinearGradient {...HOME_GRADIENT} style={styles.center}>
                <ActivityIndicator size="large" color={theme.accent} />
                <Text style={styles.loadingText}>{translateUiText('Loading your answers...')}</Text>
            </LinearGradient>
        );
    }

    if (error) {
        return (
            <LinearGradient {...HOME_GRADIENT} style={styles.center}>
                <Text style={styles.errorText}>{translateUiText(error)}</Text>
                <TouchableOpacity style={[styles.retryButton, { backgroundColor: theme.accent }]} onPress={fetchReport}>
                    <Text style={styles.footerText}>{translateUiText('Try Again')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onBack} style={styles.errorBack}><Text>{translateUiText('Back to Sets')}</Text></TouchableOpacity>
            </LinearGradient>
        );
    }

    const openItem = item => {
        const hasAnswer = isPresent(item.userAnswer) || isPresent(item.partnerAnswer) || item.chatId;
        if (hasAnswer) onOpenQuestionChat?.(item);
        else onAnswerQuestion?.(item);
    };

    const renderItem = (item, index) => {
        const rowKey = item.questionId || index;
        const common = {
            item,
            index,
            theme,
            userName,
            partnerName,
            userAvatar,
            partnerAvatar,
            onPress: () => openItem(item),
        };
        if (format === 'slider') return <SliderRow key={rowKey} {...common} />;
        return (
            <ConversationRow
                key={rowKey}
                {...common}
                format={format}
                onAnswer={onAnswerQuestion ? () => onAnswerQuestion(item) : undefined}
            />
        );
    };

    const displayTitle = selectedSet?.title || report?.title || topicTitle || translateUiText('Summary');

    return (
        <LinearGradient {...HOME_GRADIENT} style={styles.screen}>
            <Animated.ScrollView
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: true }
                )}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                    styles.scrollContent,
                    {
                        paddingTop: insets.top + 44 + 14,
                        paddingBottom: Math.max(insets.bottom + 20, 36),
                    },
                ]}
            >
                <View style={styles.largeTitleBlock}>
                    <Text style={styles.largeTitle}>{displayTitle}</Text>
                    {!!subtitle && <Text style={styles.largeSubtitle}>{subtitle}</Text>}
                </View>
                {format === 'slider' && <SliderHero summary={summary} />}
                {items.length ? items.map(renderItem) : (
                    <View style={styles.emptyCard}>
                        <Text style={styles.emptyEmoji}>♡</Text>
                        <Text style={styles.emptyText}>{translateUiText('No answers yet')}</Text>
                    </View>
                )}
            </Animated.ScrollView>

            {/* Apple-Style Collapsing Navigation Bar */}
            <Animated.View
                style={[
                    styles.stickyNavBar,
                    {
                        paddingTop: insets.top,
                        height: insets.top + 44,
                    },
                ]}
                pointerEvents="box-none"
            >
                <Animated.View
                    style={[
                        StyleSheet.absoluteFillObject,
                        styles.navBarBackground,
                        { opacity: navBgOpacity },
                    ]}
                />
                <View style={styles.navBarRow}>
                    <TouchableOpacity onPress={onBack} style={styles.navBackBtn} activeOpacity={0.7}>
                        <BackIcon />
                    </TouchableOpacity>

                    <View style={styles.navTitleContainer} pointerEvents="none">
                        <Animated.Text
                            style={[
                                styles.navCompactTitle,
                                {
                                    opacity: compactTitleOpacity,
                                    transform: [{ translateY: compactTitleTranslateY }],
                                },
                            ]}
                            numberOfLines={1}
                        >
                            {displayTitle}
                        </Animated.Text>
                    </View>

                    <Animated.View
                        style={[
                            styles.navBadgeContainer,
                            { opacity: badgeOpacity },
                        ]}
                        pointerEvents="box-none"
                    >
                        <View style={[styles.formatBadge, { backgroundColor: theme.tint, borderColor: `${theme.accent}33` }]}>
                            <Text style={[styles.formatBadgeText, { color: theme.accent }]}>
                                {theme.icon}  {translateUiText(theme.badge)}
                            </Text>
                        </View>
                    </Animated.View>
                </View>
                <Animated.View style={[styles.navHairline, { opacity: navBorderOpacity }]} />
            </Animated.View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    loadingText: { marginTop: 14, color: '#75647F', fontFamily: fontFamily.medium, fontSize: 15 },
    errorText: { color: '#B42355', fontFamily: fontFamily.bold, fontSize: 16, textAlign: 'center', marginBottom: 18 },
    retryButton: { paddingHorizontal: 28, paddingVertical: 13, borderRadius: 24 },
    errorBack: { padding: 16 },
    scrollContent: { paddingHorizontal: 18, paddingBottom: 36 },
    stickyNavBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
    },
    navBarBackground: {
        backgroundColor: 'rgba(255, 247, 251, 0.94)',
    },
    navBarRow: {
        height: 44,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    navBackBtn: {
        width: 38,
        height: 38,
        justifyContent: 'center',
        alignItems: 'flex-start',
        zIndex: 2,
    },
    navTitleContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 54,
    },
    navCompactTitle: {
        color: '#2A1235',
        fontFamily: fontFamily.extraBold,
        fontSize: 16,
        textAlign: 'center',
    },
    navBadgeContainer: {
        marginLeft: 'auto',
        zIndex: 2,
    },
    formatBadge: {
        borderRadius: 14,
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderWidth: 1,
    },
    formatBadgeText: { fontFamily: fontFamily.bold, fontSize: 12 },
    navHairline: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: StyleSheet.hairlineWidth,
        backgroundColor: 'rgba(122, 49, 93, 0.15)',
    },
    largeTitleBlock: {
        marginBottom: 20,
        paddingHorizontal: 2,
    },
    largeTitle: {
        color: '#2A1235',
        fontFamily: fontFamily.extraBold,
        fontSize: 30,
        lineHeight: 36,
        letterSpacing: -0.4,
    },
    largeSubtitle: {
        color: '#776582',
        fontFamily: fontFamily.medium,
        fontSize: 14,
        lineHeight: 19,
        marginTop: 4,
    },
    /* Slider Rating Styles */
    sliderHero: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 18,
        backgroundColor: 'rgba(255,255,255,0.86)',
        borderRadius: 22,
        padding: 22,
        marginBottom: 16,
        shadowColor: '#444477',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 2,
    },
    brokenHeart: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#F9E4EF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    brokenHeartText: { fontSize: 34 },
    similarityText: { color: '#2B103D', fontFamily: fontFamily.extraBold, fontSize: 27 },
    similaritySub: { color: '#6E5D79', fontFamily: fontFamily.medium, fontSize: 15, marginTop: 4 },
    /* Empty State & Errors */
    emptyCard: { backgroundColor: 'rgba(255,255,255,0.82)', padding: 34, borderRadius: 24, alignItems: 'center' },
    emptyEmoji: { color: '#D9678D', fontSize: 34 },
    emptyText: { color: '#725C7D', fontFamily: fontFamily.bold, fontSize: 16, marginTop: 8 },
    footerText: { color: '#FFFFFF', fontFamily: fontFamily.bold, fontSize: 17 },
});
