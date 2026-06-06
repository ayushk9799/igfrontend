import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';
import { useSelector } from 'react-redux';

import { AnimatedCardStack } from '../components/cards';
import { QuestionsV2Api } from '../api/questionsV2Api';
import { colors, spacing, borderRadius } from '../theme';
import { fontFamily } from '../constants/fonts';
import { selectIsPremium, selectUser } from '../store/slices/userSlice';

const PAGE_SIZE = 10;

const formatLabel = {
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

    // Format based emojis
    if (formatLower.includes('deep')) return '💭';
    if (formatLower.includes('neverhaveiever')) return '🙅';
    if (formatLower.includes('likelyto')) return '📈';
    if (formatLower.includes('wouldyourather')) return '🤔';
    if (formatLower.includes('thisorthat')) return '⚖️';
    if (formatLower.includes('slider')) return '🎚️';
    if (formatLower.includes('voicerecord')) return '🎙️';
    if (formatLower.includes('takephoto')) return '📸';

    return '✨'; // default
};

export default function TopicQuestionsV2Screen({
    topic,
    topicTitle,
    partnerName = 'Your Love',
    userName = 'You',
    userAvatar = null,
    partnerAvatar = null,
    userId,
    partnerId,
    hasPartner = false,
    onLinkPartner = () => { },
    onNavigateToPremium = () => { },
    onBack = () => { },
}) {
    const userData = useSelector(selectUser);
    const isPremium = useSelector(selectIsPremium);
    const effectiveUserId = userId || userData?.id || userData?._id;
    const effectivePartnerId = partnerId || userData?.partnerId;

    const [sets, setSets] = useState([]);
    const [selectedSet, setSelectedSet] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState([]);
    const [setsLoading, setSetsLoading] = useState(true);
    const [questionsLoading, setQuestionsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState({ nextCursor: null, hasMore: false, totalQuestions: 0 });

    const fetchingQuestionsRef = useRef(false);

    const fetchSets = useCallback(async () => {
        setSetsLoading(true);
        setError(null);
        const response = await QuestionsV2Api.getSets(topic);
        if (response.success) {
            setSets(response.data?.sets || []);
        } else {
            setError(response.message || response.error || 'Failed to load question sets');
        }
        setSetsLoading(false);
    }, [topic]);

    useEffect(() => {
        fetchSets();
    }, [fetchSets]);

    const fetchQuestions = useCallback(async ({ set, cursor = 0, append = false }) => {
        if (!set || fetchingQuestionsRef.current) return;
        fetchingQuestionsRef.current = true;
        setQuestionsLoading(!append);
        setError(null);

        const response = await QuestionsV2Api.getSetQuestions({
            topicId: topic,
            setId: set.setId,
            userId: effectiveUserId,
            cursor,
            limit: PAGE_SIZE,
        });

        if (response.success) {
            const nextQuestions = response.data?.questions || [];
            setPage(response.data?.page || { nextCursor: null, hasMore: false, totalQuestions: nextQuestions.length });
            setQuestions((prev) => {
                if (!append) return nextQuestions;
                const existingIds = new Set(prev.map((q) => q.questionId));
                return [...prev, ...nextQuestions.filter((q) => !existingIds.has(q.questionId))];
            });
        } else {
            setError(response.message || response.error || 'Failed to load questions');
        }

        setQuestionsLoading(false);
        fetchingQuestionsRef.current = false;
    }, [effectiveUserId, topic]);

    const handleSelectSet = useCallback((set) => {
        if (set.premium && !isPremium) {
            onNavigateToPremium();
            return;
        }
        setSelectedSet(set);
        setQuestions([]);
        setCurrentIndex(0);
        setUserAnswers([]);
        setPage({ nextCursor: null, hasMore: false, totalQuestions: set.totalQuestions || 0 });
        fetchQuestions({ set, cursor: 0, append: false });
    }, [fetchQuestions, isPremium, onNavigateToPremium]);

    const handleBack = useCallback(() => {
        if (selectedSet) {
            setSelectedSet(null);
            setQuestions([]);
            setCurrentIndex(0);
            setUserAnswers([]);
            return;
        }
        onBack();
    }, [onBack, selectedSet]);

    const handleIndexChange = useCallback((newIndex) => {
        setCurrentIndex(newIndex);

        const passedQuestion = questions[newIndex - 1];
        if (passedQuestion && effectiveUserId && selectedSet) {
            QuestionsV2Api.saveProgress({
                userId: effectiveUserId,
                topicId: topic,
                setId: selectedSet.setId,
                questionId: passedQuestion.questionId,
                action: 'seen',
                cursor: String(newIndex),
            });
        }

        if (selectedSet && page.hasMore && questions.length - newIndex <= 3) {
            fetchQuestions({ set: selectedSet, cursor: page.nextCursor, append: true });
        }
    }, [effectiveUserId, fetchQuestions, page.hasMore, page.nextCursor, questions, selectedSet, topic]);

    const handleAnswerSubmit = useCallback(async (taskIndex, answer, answerType = 'text') => {
        const question = questions[taskIndex];
        if (!question || !selectedSet) return;

        setUserAnswers((prev) => {
            const next = [...prev];
            next[taskIndex] = { answer, questionId: question.questionId, answerType };
            return next;
        });

        await QuestionsV2Api.submitAnswer({
            userId: effectiveUserId,
            topicId: topic,
            setId: selectedSet.setId,
            questionId: question.questionId,
            answer,
            answerType,
            cursor: String(taskIndex + 1),
        });
    }, [effectiveUserId, questions, selectedSet, topic]);

    const handleComplete = useCallback(() => {
        if (!effectiveUserId || !selectedSet) return;
        QuestionsV2Api.saveProgress({
            userId: effectiveUserId,
            topicId: topic,
            setId: selectedSet.setId,
            action: 'completed',
            cursor: String(questions.length),
        });
    }, [effectiveUserId, questions.length, selectedSet, topic]);

    const tasks = useMemo(() => questions.map((question) => ({
        _id: question.questionId,
        questionId: question.questionId,
        taskstatement: question.prompt,
        category: selectedSet?.format || 'deep',
        options: question.options || [],
        minValue: question.minValue,
        maxValue: question.maxValue,
        minLabel: question.minLabel,
        maxLabel: question.maxLabel,
        originalIndex: question.index,
    })), [questions, selectedSet?.format]);

    const renderHeader = () => (
        <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.headerBackBtn}>
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                    <Path d="M15 18l-6-6 6-6" stroke={colors.text} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
            </TouchableOpacity>
           
            <View style={styles.headerSpacer} />
        </View>
    );

    const renderSets = () => {
        if (setsLoading) {
            return (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Loading {topicTitle}</Text>
                </View>
            );
        }

        if (error) {
            return (
                <View style={styles.center}>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity style={styles.primaryButton} onPress={fetchSets}>
                        <Text style={styles.primaryButtonText}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <ScrollView contentContainerStyle={styles.setsContent} showsVerticalScrollIndicator={false}>
                {sets.map((set) => {
                    const locked = set.premium && !isPremium;
                    const emoji = getSetEmoji(set.format, set.title);
                    return (
                        <TouchableOpacity
                            key={set.setId}
                            style={[
                                styles.setCardTouchable,
                                locked ? styles.setCardLocked : styles.setCardUnlocked
                            ]}
                            onPress={() => handleSelectSet(set)}
                            activeOpacity={0.85}
                        >
                            {/* Emoji Badge */}
                            <View style={styles.emojiBadgeContainer}>
                                <Text style={styles.emojiText}>{emoji}</Text>
                            </View>

                            {/* Info Column */}
                            <View style={styles.setCardInfo}>
                                <Text style={styles.setTitle}>{set.title}</Text>
                                <View style={styles.metaRow}>
                                    <View style={styles.formatBadge}>
                                        <Text style={styles.formatBadgeText}>
                                            {formatLabel[set.format] || set.format}
                                        </Text>
                                    </View>
                                    {set.totalQuestions ? (
                                        <Text style={styles.setQuestionsCount}>
                                            • {set.totalQuestions} cards
                                        </Text>
                                    ) : null}
                                </View>
                            </View>

                            {/* Action Area */}
                            <View style={styles.actionContainer}>
                                {locked ? (
                                    <View style={styles.premiumBadge}>
                                        <Text style={styles.premiumText}>✨ Premium</Text>
                                    </View>
                                ) : (
                                    <View style={styles.startButton}>
                                        <Text style={styles.startButtonText}>Start</Text>
                                        <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
                                            <Path d="M9 5l7 7-7 7" stroke="#FFFFFF" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
                                        </Svg>
                                    </View>
                                )}
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        );
    };


    const renderPlayer = () => {
        if (questionsLoading && tasks.length === 0) {
            return (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Loading questions</Text>
                </View>
            );
        }

        if (error && tasks.length === 0) {
            return (
                <View style={styles.center}>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity style={styles.primaryButton} onPress={() => fetchQuestions({ set: selectedSet, cursor: 0, append: false })}>
                        <Text style={styles.primaryButtonText}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (tasks.length === 0) {
            return (
                <View style={styles.center}>
                    <Text style={styles.emptyText}>No questions yet</Text>
                </View>
            );
        }

        return (
            <View style={styles.cardsContainer}>
                <AnimatedCardStack
                    tasks={tasks}
                    currentIndex={currentIndex}
                    partnerName={partnerName}
                    userName={userName}
                    userAvatar={userData?.avatarThumbnail || userData?.avatar || userAvatar}
                    partnerAvatar={userData?.partnerAvatarThumbnail || userData?.partnerAvatar || partnerAvatar}
                    userId={effectiveUserId}
                    partnerId={effectivePartnerId}
                    hasPartner={hasPartner}
                    onLinkPartner={onLinkPartner}
                    onIndexChange={handleIndexChange}
                    onComplete={handleComplete}
                    onAnswerSubmit={handleAnswerSubmit}
                    userAnswers={userAnswers}
                    isPremium={isPremium}
                    onNavigateToPremium={onNavigateToPremium}
                    totalCardsOverride={page.totalQuestions || tasks.length}
                />
            </View>
        );
    };

    return (
        <View style={styles.screen}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <GestureHandlerRootView style={styles.container}>
                {renderHeader()}
                {selectedSet ? renderPlayer() : renderSets()}
            </GestureHandlerRootView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#FFF7FA',
    },
    container: {
        flex: 1,
        paddingTop: Platform.OS === 'ios' ? 58 : 36,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
    },
    headerBackBtn: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: 'rgba(255,255,255,0.86)',
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
        fontSize: 22,
        fontWeight: '900',
        color: colors.text,
        textAlign: 'center',
        fontFamily: fontFamily.extraBold,
    },
    headerMeta: {
        marginTop: 2,
        fontSize: 13,
        color: colors.textSecondary,
        fontFamily: fontFamily.medium,
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
    },
    loadingText: {
        marginTop: spacing.md,
        color: colors.textSecondary,
        fontSize: 16,
        fontFamily: fontFamily.medium,
    },
    errorText: {
        color: colors.textSecondary,
        fontSize: 16,
        textAlign: 'center',
        marginBottom: spacing.lg,
        fontFamily: fontFamily.medium,
    },
    emptyText: {
        color: colors.textSecondary,
        fontSize: 18,
        fontFamily: fontFamily.bold,
    },
    primaryButton: {
        backgroundColor: colors.primary,
        borderRadius: borderRadius.lg,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '800',
        fontFamily: fontFamily.bold,
    },
    setsContent: {
        paddingHorizontal: spacing.lg,
        paddingBottom: 120,
        gap: spacing.md,
    },
    setCardTouchable: {
        minHeight: 92,
        borderRadius: 22,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        shadowColor: '#2E1E3C',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 4,
    },
    setCardUnlocked: {
        backgroundColor: '#1E1428',
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    setCardLocked: {
        backgroundColor: '#2A1836',
        borderColor: 'rgba(254, 240, 138, 0.15)',
    },
    emojiBadgeContainer: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    emojiText: {
        fontSize: 24,
    },
    setCardInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    setTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#FFFFFF',
        fontFamily: fontFamily.bold,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
    },
    formatBadge: {
        backgroundColor: 'rgba(192, 132, 252, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(192, 132, 252, 0.25)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        marginRight: 6,
    },
    formatBadgeText: {
        fontSize: 11,
        color: '#E9D5FF',
        fontWeight: '700',
        fontFamily: fontFamily.medium,
    },
    setQuestionsCount: {
        fontSize: 12,
        color: '#A396B2',
        fontFamily: fontFamily.medium,
    },
    actionContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: spacing.xs,
    },
    premiumBadge: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#EAB308',
        shadowColor: '#EAB308',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
    },
    premiumText: {
        color: '#2E1E3C',
        fontSize: 11,
        fontWeight: '800',
        fontFamily: fontFamily.extraBold,
    },
    startButton: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FF758F',
        shadowColor: '#FF758F',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 5,
        elevation: 2,
    },
    startButtonText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800',
        fontFamily: fontFamily.bold,
        marginRight: 4,
    },


    cardsContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.md,
        paddingBottom: Platform.OS === 'ios' ? 114 : 96,
    },
});
