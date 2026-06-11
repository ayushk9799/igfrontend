import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
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
import LinearGradient from 'react-native-linear-gradient';
import { useSelector } from 'react-redux';

import { AnimatedCardStack } from '../components/cards';
import TopicQuestionsSummaryScreen from './TopicQuestionsSummaryScreen';
import ChatScreen from './ChatScreen';
import { QuestionChatsV2Api, QuestionsV2Api } from '../api/questionsV2Api';
import { colors, spacing, borderRadius } from '../theme';
import { fontFamily } from '../constants/fonts';
import { selectIsPremium, selectUser } from '../store/slices/userSlice';

const PAGE_SIZE = 10;
const { height } = Dimensions.get('window');
const CARD_HEIGHT = height * 0.7;

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



const getFormatTheme = (format) => {
    switch (format) {
        case 'deep':
            return { bg: '#E6F7F0', text: '#0D9488' };
        case 'neverhaveiever':
            return { bg: '#F3E8FF', text: '#7C3AED' };
        case 'likelyto':
            return { bg: '#FCE7F3', text: '#DB2777' };
        case 'wouldyourather':
            return { bg: '#EFF6FF', text: '#2563EB' };
        case 'thisorthat':
            return { bg: '#FEF3C7', text: '#D97706' };
        case 'slider':
            return { bg: '#F1F5F9', text: '#475569' };
        case 'voicerecord':
            return { bg: '#EEF2F6', text: '#4F46E5' };
        case 'takephoto':
            return { bg: '#FFF1F2', text: '#E11D48' };
        default:
            return { bg: '#F3E8FF', text: '#7C3AED' };
    }
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
    const [showSummary, setShowSummary] = useState(false);
    const [singleQuestionToAnswer, setSingleQuestionToAnswer] = useState(null);
    const [summaryRefreshKey, setSummaryRefreshKey] = useState(0);
    const [questionChatToOpen, setQuestionChatToOpen] = useState(null);

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

    useEffect(() => {
        if (!hasPartner && onLinkPartner) {
            onLinkPartner();
        }
    }, [hasPartner, onLinkPartner]);

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
            
            if (response.data?.progress?.completedAt && !append) {
                setShowSummary(true);
            }

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
        setShowSummary(false);
        setPage({ nextCursor: null, hasMore: false, totalQuestions: set.totalQuestions || 0 });
        fetchQuestions({ set, cursor: 0, append: false });
    }, [fetchQuestions, isPremium, onNavigateToPremium]);

    const handleBack = useCallback(() => {
        if (questionChatToOpen) {
            setQuestionChatToOpen(null);
            return;
        }
        if (singleQuestionToAnswer) {
            setSingleQuestionToAnswer(null);
            return;
        }
        if (selectedSet) {
            setSelectedSet(null);
            setQuestions([]);
            setCurrentIndex(0);
            setUserAnswers([]);
            setShowSummary(false);
            return;
        }
        onBack();
    }, [onBack, questionChatToOpen, selectedSet, singleQuestionToAnswer]);

    const openSummaryQuestionChat = useCallback(async (item = {}) => {
        const chatId = item.chatId?._id || item.chatId;
        let chat = chatId ? {
            _id: String(chatId),
            topicId: item.topicId || topic,
            setId: item.setId || selectedSet?.setId,
            questionId: item.questionId,
            format: item.format || selectedSet?.format,
            prompt: item.prompt,
        } : null;

        const topicId = item.topicId || topic;
        const setId = item.setId || selectedSet?.setId;

        if (!chat && effectiveUserId && topicId && setId && item.questionId) {
            const response = await QuestionChatsV2Api.getChatByQuestion({
                userId: effectiveUserId,
                topicId,
                setId,
                questionId: item.questionId,
            });

            if (response.success) {
                chat = response.data?.chat || null;
            }

            if (!chat) {
                const chatsResponse = await QuestionChatsV2Api.getChats(effectiveUserId);
                if (chatsResponse.success) {
                    chat = (chatsResponse.data?.chats || []).find((candidate) => (
                        String(candidate.topicId) === String(topicId)
                        && String(candidate.setId) === String(setId)
                        && String(candidate.questionId) === String(item.questionId)
                    )) || null;
                }
            }
        }

        if (!chat?._id) {
            console.warn('[TopicQuestionsV2] Could not open question chat', {
                chatId,
                topicId,
                setId,
                questionId: item.questionId,
            });
            return;
        }

        setQuestionChatToOpen(chat);
    }, [effectiveUserId, selectedSet?.format, selectedSet?.setId, topic]);

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

    const handleSingleAnswerSubmit = useCallback(async (answer, answerType = 'text') => {
        if (!singleQuestionToAnswer || !selectedSet) return;

        await QuestionsV2Api.submitAnswer({
            userId: effectiveUserId,
            topicId: topic,
            setId: selectedSet.setId,
            questionId: singleQuestionToAnswer.questionId,
            answer,
            answerType,
            cursor: String((singleQuestionToAnswer.index || 0) + 1),
        });

        // Trigger refresh of TopicQuestionsSummaryScreen report
        setSummaryRefreshKey(prev => prev + 1);
        setSingleQuestionToAnswer(null);
    }, [singleQuestionToAnswer, selectedSet, effectiveUserId, topic]);

    const handleComplete = useCallback(() => {
        if (singleQuestionToAnswer) {
            setSingleQuestionToAnswer(null);
            return;
        }
        if (!effectiveUserId || !selectedSet) return;
        QuestionsV2Api.saveProgress({
            userId: effectiveUserId,
            topicId: topic,
            setId: selectedSet.setId,
            action: 'completed',
            cursor: String(questions.length),
        });
        setShowSummary(true);
    }, [effectiveUserId, questions.length, selectedSet, topic, singleQuestionToAnswer]);

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

    const renderSingleQuestionHeader = () => (
        <View style={styles.header}>
            <View style={styles.headerSpacer} />
            <View style={styles.headerTextBlock}>
                <Text style={styles.headerTitle}>Answer Question</Text>
            </View>
            <TouchableOpacity onPress={() => setSingleQuestionToAnswer(null)} style={styles.headerBackBtn}>
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                    <Path d="M18 6L6 18M6 6l12 12" stroke={colors.text} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
            </TouchableOpacity>
        </View>
    );

    const renderSingleQuestionPlayer = () => {
        if (!singleQuestionToAnswer) return null;

        const singleTask = {
            _id: singleQuestionToAnswer.questionId,
            questionId: singleQuestionToAnswer.questionId,
            taskstatement: singleQuestionToAnswer.prompt,
            category: selectedSet?.format || 'deep',
            options: singleQuestionToAnswer.options || [],
            minValue: singleQuestionToAnswer.minValue,
            maxValue: singleQuestionToAnswer.maxValue,
            minLabel: singleQuestionToAnswer.minLabel,
            maxLabel: singleQuestionToAnswer.maxLabel,
            originalIndex: singleQuestionToAnswer.index,
        };

        return (
            <View style={styles.cardsContainer}>
                <AnimatedCardStack
                    tasks={[singleTask]}
                    currentIndex={0}
                    partnerName={partnerName}
                    userName={userName}
                    userAvatar={userData?.avatarThumbnail || userData?.avatar || userAvatar}
                    partnerAvatar={userData?.partnerAvatarThumbnail || userData?.partnerAvatar || partnerAvatar}
                    userId={effectiveUserId}
                    partnerId={effectivePartnerId}
                    hasPartner={hasPartner}
                    onLinkPartner={onLinkPartner}
                    onIndexChange={() => {}}
                    onComplete={() => {
                        setSingleQuestionToAnswer(null);
                    }}
                    onAnswerSubmit={(idx, answer, answerType) => {
                        handleSingleAnswerSubmit(answer, answerType);
                    }}
                    userAnswers={[]}
                    isPremium={isPremium}
                    onNavigateToPremium={onNavigateToPremium}
                    totalCardsOverride={1}
                    cardHeight={CARD_HEIGHT}
                />
            </View>
        );
    };

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
                    const theme = getFormatTheme(set.format);
                    return (
                        <TouchableOpacity
                            key={set.setId}
                            style={styles.setCardTouchable}
                            onPress={() => handleSelectSet(set)}
                            activeOpacity={0.85}
                        >
                            {/* Circular Badge Container */}
                            <View style={[styles.emojiBadgeContainer, { backgroundColor: theme.bg }]}>
                                <Text style={styles.emojiText}>{emoji}</Text>
                            </View>

                            {/* Info Column */}
                            <View style={styles.setCardInfo}>
                                <Text style={styles.setTitle}>{set.title}</Text>
                                
                                <View style={styles.metaRow}>
                                    <View style={[styles.formatBadge, { backgroundColor: theme.bg }]}>
                                        <Text style={[styles.formatBadgeText, { color: theme.text }]}>
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
                                        <Svg width={8} height={8} viewBox="0 0 24 24" fill="none">
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
                    cardHeight={CARD_HEIGHT}
                />
            </View>
        );
    };

    return (
        <LinearGradient
            colors={['#F8D9EC', '#FFF7FA', '#FFF4F7', '#F7D8F2']}
            locations={[0, 0.34, 0.72, 1]}
            start={{ x: 0.25, y: 0 }}
            end={{ x: 0.75, y: 1 }}
            style={styles.screen}
        >
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <GestureHandlerRootView style={styles.container}>
                {questionChatToOpen ? (
                    <ChatScreen
                        chatId={questionChatToOpen._id}
                        chat={questionChatToOpen}
                        chatMode="questionV2"
                        userId={effectiveUserId}
                        userName={userName}
                        partnerName={partnerName}
                        onBack={() => setQuestionChatToOpen(null)}
                    />
                ) : singleQuestionToAnswer ? renderSingleQuestionHeader() : (selectedSet && showSummary ? null : renderHeader())}
                {questionChatToOpen ? null : singleQuestionToAnswer ? (
                    renderSingleQuestionPlayer()
                ) : selectedSet ? (
                    showSummary ? (
                        <TopicQuestionsSummaryScreen
                            key={`summary-${summaryRefreshKey}`}
                            topic={topic}
                            topicTitle={topicTitle}
                            selectedSet={selectedSet}
                            userId={effectiveUserId}
                            partnerName={partnerName}
                            onBack={handleBack}
                            onNavigateToPremium={onNavigateToPremium}
                            isPremium={isPremium}
                            hasPartner={hasPartner}
                            onLinkPartner={onLinkPartner}
                            onAnswerQuestion={(question) => {
                                setSingleQuestionToAnswer(question);
                            }}
                            onOpenQuestionChat={(item) => {
                                openSummaryQuestionChat({
                                    ...item,
                                    topicId: topic,
                                    setId: selectedSet?.setId,
                                    format: selectedSet?.format,
                                });
                            }}
                        />
                    ) : (
                        renderPlayer()
                    )
                ) : (
                    renderSets()
                )}
            </GestureHandlerRootView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
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
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.05)',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 2,
    },
    emojiBadgeContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    emojiText: {
        fontSize: 24,
    },
    setCardInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    setTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
        fontFamily: fontFamily.bold,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    formatBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        marginRight: 6,
    },
    formatBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        fontFamily: fontFamily.medium,
    },
    setQuestionsCount: {
        fontSize: 11,
        color: '#64748B',
        fontFamily: fontFamily.medium,
    },
    setDescription: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 6,
        fontFamily: fontFamily.regular,
    },
    actionContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    premiumBadge: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#F59E0B',
        backgroundColor: 'transparent',
    },
    premiumText: {
        color: '#D97706',
        fontSize: 11,
        fontWeight: '700',
        fontFamily: fontFamily.bold,
    },
    startButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0F172A',
    },
    startButtonText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
        fontFamily: fontFamily.bold,
        marginRight: 4,
    },


    cardsContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.md,
        paddingBottom: Platform.OS === 'ios' ? 28 : 24,
    },
});
