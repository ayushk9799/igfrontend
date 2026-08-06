import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Image,
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
import { requestReviewForMoment, REVIEW_MOMENTS } from '../utils/inAppReview';
import { translateUiTemplate, translateUiText } from '../i18n/uiTranslation';
import CircularProgressRing from '../components/CircularProgressRing';

const PAGE_SIZE = 10;
const { height } = Dimensions.get('window');
const CARD_HEIGHT = height * 0.7;

const SET_ICON_ASSETS = {
    coupletherapy: require('../../assets/home/couple-therapy.png'),
    longdistance: require('../../assets/home/long-distance.png'),
    naughty: require('../../assets/home/naughty.png'),
    gossip: require('../../assets/home/gossip.png'),
    money: require('../../assets/home/money-bag.png'),
    gettoknow: require('../../assets/home/get-to-know.png'),
    travel: require('../../assets/home/travel-plane.png'),
    family: require('../../assets/home/family.png'),
    future: require('../../assets/home/future-crystal.png'),
    hotspicy: require('../../assets/home/hot-fire.png'),
    lifestyle: require('../../assets/home/lifestyle-arm.png'),
    relationship: require('../../assets/home/together-heart-plant.png'),
};

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

const formatDescription = {
    deep: 'Notice the small things that mean everything',
    neverhaveiever: 'Share stories, surprises and playful truths',
    likelyto: 'Sweet truths about each other',
    wouldyourather: 'Fun choices for unforgettable nights',
    thisorthat: 'Discover how you give and receive love',
    slider: 'Rate, reflect and grow together',
    voicerecord: 'Say what is easier to feel than type',
    takephoto: 'Capture a little moment together',
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

const isRemoteImageUri = (value) => typeof value === 'string' && /^https?:\/\//i.test(value);

const getSetIconImageSource = (set) => {
    if (!set) return null;

    if (set.iconType === 'asset') {
        return SET_ICON_ASSETS[set.iconKey] || SET_ICON_ASSETS[set.icon] || null;
    }

    if (set.iconType === 'image') {
        const uri = set.iconUrl || set.icon;
        return isRemoteImageUri(uri) ? { uri } : null;
    }

    if (set.iconKey && SET_ICON_ASSETS[set.iconKey]) {
        return SET_ICON_ASSETS[set.iconKey];
    }

    const uri = set.iconUrl || set.icon;
    return isRemoteImageUri(uri) ? { uri } : null;
};



const getFormatTheme = (format) => {
    switch (format) {
        case 'deep':
            return { accent: '#C2185B', card: '#FDE7F0' };
        case 'neverhaveiever':
            return { accent: '#7C3AED', card: '#F0E7FD' };
        case 'likelyto':
            return { accent: '#E6530A', card: '#FFF0DE' };
        case 'wouldyourather':
            return { accent: '#7A32D0', card: '#F1E8FD' };
        case 'thisorthat':
            return { accent: '#078B87', card: '#DDF6F2' };
        case 'slider':
            return { accent: '#2864C2', card: '#E3F1FC' };
        case 'voicerecord':
            return { accent: '#5448D9', card: '#EAE8FD' };
        case 'takephoto':
            return { accent: '#BE315C', card: '#FDE7EE' };
        default:
            return { accent: '#C2185B', card: '#FDE8F0' };
    }
};

const getAvatarSource = (avatar) => {
    if (!avatar) return null;
    return typeof avatar === 'string' ? { uri: avatar } : avatar;
};

const getAvatarInitial = (name) => (name || '?').trim().charAt(0).toUpperCase() || '?';

const isProgressComplete = (progress) => Boolean(progress?.completedAt || progress?.percentComplete >= 100);

const SetStatusAvatar = ({
    avatar,
    name,
    complete,
    progress = 0,
    ringColor,
    variant = 'user',
}) => {
    const avatarSource = getAvatarSource(avatar);

    return (
        <CircularProgressRing
            progress={progress}
            color={ringColor}
            trackColor="rgba(255,255,255,0.8)"
            size={36}
            strokeWidth={3}
            style={variant === 'userOverlap' && styles.userStatusAvatarOverlap}
        >
            <View style={[
                styles.statusAvatar,
                variant === 'partner' && styles.partnerStatusAvatar,
                complete && styles.statusAvatarComplete,
                !complete && styles.statusAvatarPending,
            ]}>
                {avatarSource ? (
                    <Image source={avatarSource} style={styles.statusAvatarImage} resizeMode="cover" />
                ) : (
                    <Text style={styles.statusAvatarInitial} allowFontScaling={false}>
                        {getAvatarInitial(name)}
                    </Text>
                )}
            </View>
        </CircularProgressRing>
    );
};

export default function TopicQuestionsV2Screen({
    topic,
    topicTitle,
    topicEmoji = '',
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
    const effectiveUserAvatar = userData?.avatarThumbnail || userData?.avatar || userAvatar;
    const effectivePartnerAvatar = userData?.partnerAvatarThumbnail || userData?.partnerAvatar || partnerAvatar;

    const [sets, setSets] = useState([]);
    const [selectedSet, setSelectedSet] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState([]);
    const [answeredQuestionIds, setAnsweredQuestionIds] = useState([]);
    const [skippedQuestionIds, setSkippedQuestionIds] = useState([]);
    const [initiallyHiddenQuestionIds, setInitiallyHiddenQuestionIds] = useState([]);
    const [setsLoading, setSetsLoading] = useState(true);
    const [questionsLoading, setQuestionsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [page, setPage] = useState({ nextCursor: null, hasMore: false, totalQuestions: 0 });
    const [showSummary, setShowSummary] = useState(false);
    const [summaryReturnsToQuestions, setSummaryReturnsToQuestions] = useState(false);
    const [singleQuestionToAnswer, setSingleQuestionToAnswer] = useState(null);
    const [summaryRefreshKey, setSummaryRefreshKey] = useState(0);
    const [questionChatToOpen, setQuestionChatToOpen] = useState(null);

    const fetchingQuestionsRef = useRef(false);
    const normalizedTaskCacheRef = useRef(new WeakMap());

    const fetchSets = useCallback(async (showLoading = true) => {
        if (showLoading) setSetsLoading(true);
        setError(null);
        const response = await QuestionsV2Api.getSets(topic, effectiveUserId);
        if (response.success) {
            setSets(response.data?.sets || []);
        } else {
            setError(response.message || response.error || 'Failed to load question sets');
        }
        if (showLoading) setSetsLoading(false);
    }, [effectiveUserId, topic]);

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
            const responseProgress = response.data?.progress || {};
            setPage(response.data?.page || { nextCursor: null, hasMore: false, totalQuestions: nextQuestions.length });

            if (!append) {
                const savedAnswers = response.data?.userAnswers || [];
                const answerByQuestionId = new Map(
                    savedAnswers.map((savedAnswer) => [savedAnswer.questionId, savedAnswer])
                );
                const restoredAnswers = [];
                nextQuestions.forEach((question) => {
                    const savedAnswer = answerByQuestionId.get(question.questionId);
                    if (savedAnswer) {
                        restoredAnswers[question.index] = {
                            ...savedAnswer,
                            answer: savedAnswer.answer,
                        };
                    }
                });
                setUserAnswers(restoredAnswers);
                const restoredAnsweredQuestionIds = [
                    ...new Set([
                        ...(responseProgress.answeredQuestionIds || []),
                        ...savedAnswers.map((savedAnswer) => savedAnswer.questionId),
                    ]),
                ];
                const restoredSkippedQuestionIds = responseProgress.skippedQuestionIds || [];
                setAnsweredQuestionIds(restoredAnsweredQuestionIds);
                setSkippedQuestionIds(restoredSkippedQuestionIds);
                setInitiallyHiddenQuestionIds([
                    ...new Set([
                        ...restoredAnsweredQuestionIds,
                        ...restoredSkippedQuestionIds,
                    ]),
                ]);
                setCurrentIndex(0);
            }

            if (responseProgress.completedAt && !append) {
                setSummaryReturnsToQuestions(false);
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
        setAnsweredQuestionIds([]);
        setSkippedQuestionIds([]);
        setInitiallyHiddenQuestionIds([]);
        setSummaryReturnsToQuestions(false);
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
            setAnsweredQuestionIds([]);
            setSkippedQuestionIds([]);
            setInitiallyHiddenQuestionIds([]);
            setSummaryReturnsToQuestions(false);
            setShowSummary(false);
            fetchSets(false);
            return;
        }
        onBack();
    }, [fetchSets, onBack, questionChatToOpen, selectedSet, singleQuestionToAnswer]);

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

        const hiddenQuestionIds = new Set([...answeredQuestionIds, ...skippedQuestionIds]);
        const visibleQuestions = questions.filter(
            (question) => !hiddenQuestionIds.has(question.questionId)
        );
        const passedQuestion = visibleQuestions[newIndex - 1];
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
    }, [
        answeredQuestionIds,
        effectiveUserId,
        fetchQuestions,
        page.hasMore,
        page.nextCursor,
        questions,
        selectedSet,
        skippedQuestionIds,
        topic,
    ]);

    const handleAnswerSubmit = useCallback((taskIndex, answer, answerType = 'text') => {
        const question = questions.find((candidate) => candidate.index === taskIndex);
        if (!question || !selectedSet) return false;

        setUserAnswers((prev) => {
            const next = [...prev];
            next[taskIndex] = { answer, questionId: question.questionId, answerType };
            return next;
        });
        setSkippedQuestionIds((prev) => prev.filter((questionId) => questionId !== question.questionId));

        QuestionsV2Api.submitAnswer({
            userId: effectiveUserId,
            topicId: topic,
            setId: selectedSet.setId,
            questionId: question.questionId,
            answer,
            answerType,
            cursor: String(taskIndex + 1),
        }).then((response) => {
            if (response.success === false) {
                console.warn('[TopicQuestionsV2] Failed to submit answer', {
                    questionId: question.questionId,
                    message: response.message || response.error,
                });
            } else {
                // Refresh an open/final summary after the background save finishes.
                setSummaryRefreshKey((prev) => prev + 1);
            }
        }).catch((err) => {
            console.warn('[TopicQuestionsV2] Failed to submit answer', {
                questionId: question.questionId,
                message: err.message,
            });
        });

        return true;
    }, [effectiveUserId, questions, selectedSet, topic]);

    const handleAnswerTransitionComplete = useCallback((taskIndex) => {
        const question = questions.find((candidate) => candidate.index === taskIndex);
        if (!question) return;

        setAnsweredQuestionIds((prev) => (
            prev.includes(question.questionId) ? prev : [...prev, question.questionId]
        ));
    }, [questions]);

    const handleQuestionSkip = useCallback((taskIndex) => {
        const question = questions.find((candidate) => candidate.index === taskIndex);
        if (!question || !selectedSet) return false;

        setSkippedQuestionIds((prev) => (
            prev.includes(question.questionId) ? prev : [...prev, question.questionId]
        ));
        setAnsweredQuestionIds((prev) => (
            prev.filter((questionId) => questionId !== question.questionId)
        ));

        QuestionsV2Api.saveProgress({
            userId: effectiveUserId,
            topicId: topic,
            setId: selectedSet.setId,
            questionId: question.questionId,
            action: 'skipped',
            cursor: String(taskIndex + 1),
        }).then((response) => {
            if (response.success === false) {
                console.warn('[TopicQuestionsV2] Failed to save skipped question', {
                    questionId: question.questionId,
                    message: response.message || response.error,
                });
            }
        }).catch((err) => {
            console.warn('[TopicQuestionsV2] Failed to save skipped question', {
                questionId: question.questionId,
                message: err.message,
            });
        });

        return true;
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
        setSummaryReturnsToQuestions(false);
        setShowSummary(true);
        requestReviewForMoment(REVIEW_MOMENTS.V2_SET_SUMMARY_SHOWN);
    }, [effectiveUserId, questions.length, selectedSet, topic, singleQuestionToAnswer]);

    const tasks = useMemo(() => {
        const hiddenQuestionIds = new Set(initiallyHiddenQuestionIds);
        const category = selectedSet?.format || 'deep';
        return questions
            .filter((question) => !hiddenQuestionIds.has(question.questionId))
            .map((question) => {
                const cached = normalizedTaskCacheRef.current.get(question);
                if (cached?.category === category) return cached.task;

                const task = {
                    _id: question.questionId,
                    questionId: question.questionId,
                    taskstatement: question.prompt,
                    category,
                    options: question.options || [],
                    minValue: question.minValue,
                    maxValue: question.maxValue,
                    minLabel: question.minLabel,
                    maxLabel: question.maxLabel,
                    order: question.order,
                    originalIndex: question.index,
                    backendIndex: question.index,
                };
                normalizedTaskCacheRef.current.set(question, { category, task });
                return task;
            });
    }, [initiallyHiddenQuestionIds, questions, selectedSet?.format]);

    useEffect(() => {
        setCurrentIndex((prev) => Math.max(0, Math.min(prev, Math.max(tasks.length - 1, 0))));
    }, [tasks.length]);

    useEffect(() => {
        if (
            selectedSet
            && questions.length > 0
            && tasks.length === 0
            && page.hasMore
            && page.nextCursor !== null
            && !questionsLoading
        ) {
            fetchQuestions({
                set: selectedSet,
                cursor: page.nextCursor,
                append: true,
            });
        }
    }, [
        fetchQuestions,
        page.hasMore,
        page.nextCursor,
        questions.length,
        questionsLoading,
        selectedSet,
        tasks.length,
    ]);

    useEffect(() => {
        if (
            selectedSet
            && questions.length > 0
            && tasks.length === 0
            && !questionsLoading
            && !page.hasMore
            && !showSummary
        ) {
            QuestionsV2Api.saveProgress({
                userId: effectiveUserId,
                topicId: topic,
                setId: selectedSet.setId,
                action: 'completed',
                cursor: String(page.totalQuestions || questions.length),
            });
            setSummaryRefreshKey((prev) => prev + 1);
            setSummaryReturnsToQuestions(false);
            setShowSummary(true);
            requestReviewForMoment(REVIEW_MOMENTS.V2_SET_SUMMARY_SHOWN);
        }
    }, [
        effectiveUserId,
        page.hasMore,
        page.totalQuestions,
        questions.length,
        questionsLoading,
        selectedSet,
        showSummary,
        tasks.length,
        topic,
    ]);

    const renderSingleQuestionHeader = () => (
        <View style={styles.header}>
            <View style={styles.headerSpacer} />
            <View style={styles.headerTextBlock}>
                <Text style={styles.headerTitle}>{translateUiText("Answer Question")}</Text>
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
            optionItems: singleQuestionToAnswer.optionItems || [],
            minValue: singleQuestionToAnswer.minValue,
            maxValue: singleQuestionToAnswer.maxValue,
            minLabel: singleQuestionToAnswer.minLabel,
            maxLabel: singleQuestionToAnswer.maxLabel,
            originalIndex: 0,
            backendIndex: singleQuestionToAnswer.index,
        };

        return (
            <View style={styles.cardsContainer}>
                <AnimatedCardStack
                    tasks={[singleTask]}
                    currentIndex={0}
                    partnerName={partnerName}
                    userName={userName}
                    userAvatar={effectiveUserAvatar}
                    partnerAvatar={effectivePartnerAvatar}
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
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                    <Path d="M15 18l-6-6 6-6" stroke={colors.text} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
            </TouchableOpacity>
            <View style={styles.headerTextBlock}>
                <Text style={styles.headerTitle} numberOfLines={1}>
                    {topicEmoji ? `${topicEmoji} ${topicTitle}` : topicTitle}
                </Text>
            </View>
            {selectedSet && answeredQuestionIds.length > 0 ? (
                <TouchableOpacity
                    style={styles.viewAnswersButton}
                    onPress={() => {
                        setSummaryRefreshKey((prev) => prev + 1);
                        setSummaryReturnsToQuestions(true);
                        setShowSummary(true);
                    }}
                    activeOpacity={0.82}
                >
                    <Text style={styles.viewAnswersButtonText}>{translateUiText("View Answers")}</Text>
                </TouchableOpacity>
            ) : (
                <View style={styles.headerSpacer} />
            )}
        </View>
    );

    const renderSets = () => {
        if (setsLoading) {
            return (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>
                        {translateUiTemplate("Loading {{0}}", [topicTitle])}
                    </Text>
                </View>
            );
        }

        if (error) {
            return (
                <View style={styles.center}>
                    <Text style={styles.errorText}>{translateUiText(error)}</Text>
                    <TouchableOpacity style={styles.primaryButton} onPress={fetchSets}>
                        <Text style={styles.primaryButtonText}>{translateUiText("Try Again")}</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <ScrollView contentContainerStyle={styles.setsContent} showsVerticalScrollIndicator={false}>
                {sets.map((set) => {
                    const iconImageSource = getSetIconImageSource(set);
                    const emoji = set.icon || getSetEmoji(set.format, set.title);
                    const theme = getFormatTheme(set.format);
                    const userComplete = isProgressComplete(set.progress);
                    const partnerComplete = isProgressComplete(set.partnerProgress);
                    const percentComplete = Math.max(
                        0,
                        Math.min(100, set.progress?.percentComplete || 0)
                    );
                    return (
                        <TouchableOpacity
                            key={set.setId}
                            style={[styles.setCardTouchable, { backgroundColor: theme.card }]}
                            onPress={() => handleSelectSet(set)}
                            activeOpacity={0.85}
                        >
                            <View style={styles.setCardContent}>
                                <View style={styles.emojiBadgeContainer}>
                                    {iconImageSource ? (
                                        <Image source={iconImageSource} style={styles.setIconImage} resizeMode="contain" />
                                    ) : (
                                        <Text style={styles.emojiText} allowFontScaling={false}>{emoji}</Text>
                                    )}
                                </View>

                                <View style={styles.setCardInfo}>
                                    <View style={styles.metaRow}>
                                        <View style={[styles.formatBadge, { backgroundColor: theme.accent }]}>
                                            <Text style={styles.formatBadgeText} allowFontScaling={false}>
                                                {formatLabel[set.format] || set.format}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text
                                        style={[styles.setTitle, { color: theme.accent }]}
                                        numberOfLines={2}
                                        allowFontScaling={false}
                                    >
                                        {set.title}
                                    </Text>
                                    <Text
                                        style={[styles.setDescription, { color: theme.accent }]}
                                        numberOfLines={2}
                                        allowFontScaling={false}
                                    >
                                        {set.subtitle || set.description || formatDescription[set.format] || translateUiText("A new way to connect together")}
                                    </Text>
                                </View>

                                <View style={styles.setCardRightColumn}>
                                    <View style={styles.statusAvatarRow}>
                                        {set.partnerProgress ? (
                                            <SetStatusAvatar
                                                avatar={effectivePartnerAvatar}
                                                name={partnerName}
                                                complete={partnerComplete}
                                                progress={set.partnerProgress?.percentComplete || 0}
                                                ringColor="#9B63D9"
                                                variant="partner"
                                            />
                                        ) : null}
                                        <SetStatusAvatar
                                            avatar={effectiveUserAvatar}
                                            name={userName}
                                            complete={userComplete}
                                            progress={percentComplete}
                                            ringColor={theme.accent}
                                            variant={set.partnerProgress ? 'userOverlap' : 'user'}
                                        />
                                    </View>
                                    {set.premium && !isPremium ? (
                                        <View style={styles.premiumBadge}>
                                            <Svg width={13} height={13} viewBox="0 0 24 24" fill="none">
                                                <Path
                                                    d="M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2z"
                                                    fill="#D97706"
                                                />
                                                <Path
                                                    d="M7 11V7a5 5 0 0110 0v4"
                                                    stroke="#D97706"
                                                    strokeWidth={2.5}
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                            </Svg>
                                        </View>
                                    ) : (
                                        <View style={[styles.startButton, { backgroundColor: theme.accent }]}>
                                            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                                                <Path d="M9 5l7 7-7 7" stroke="#FFFFFF" strokeWidth={2.7} strokeLinecap="round" strokeLinejoin="round" />
                                            </Svg>
                                        </View>
                                    )}
                                </View>
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
                    <Text style={styles.loadingText}>{translateUiText("Loading questions")}</Text>
                </View>
            );
        }

        if (error && tasks.length === 0) {
            return (
                <View style={styles.center}>
                    <Text style={styles.errorText}>{translateUiText(error)}</Text>
                    <TouchableOpacity style={styles.primaryButton} onPress={() => fetchQuestions({ set: selectedSet, cursor: 0, append: false })}>
                        <Text style={styles.primaryButtonText}>{translateUiText("Try Again")}</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (tasks.length === 0) {
            return (
                <View style={styles.center}>
                    <Text style={styles.emptyText}>{translateUiText("No questions yet")}</Text>
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
                    userAvatar={effectiveUserAvatar}
                    partnerAvatar={effectivePartnerAvatar}
                    userId={effectiveUserId}
                    partnerId={effectivePartnerId}
                    hasPartner={hasPartner}
                    onLinkPartner={onLinkPartner}
                    onIndexChange={handleIndexChange}
                    onComplete={handleComplete}
                    onAnswerSubmit={handleAnswerSubmit}
                    onAnswerTransitionComplete={handleAnswerTransitionComplete}
                    onSkipQuestion={handleQuestionSkip}
                    userAnswers={userAnswers}
                    autoAdvanceOnSubmit={false}
                    showAlreadyAnsweredOverlay={false}
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
            colors={['#F8D9EC', '#FFF9FB', '#FFF6F8', '#F5DDEC']}
            locations={[0, 0.3, 0.72, 1]}
            start={{ x: 0.25, y: 0 }}
            end={{ x: 0.75, y: 1 }}
            style={styles.screen}
        >
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <GestureHandlerRootView style={[styles.container, selectedSet && showSummary && styles.summaryContainer]}>
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
                            userName={userName}
                            partnerName={partnerName}
                            userAvatar={effectiveUserAvatar}
                            partnerAvatar={effectivePartnerAvatar}
                            onBack={() => {
                                if (summaryReturnsToQuestions && tasks.length > 0) {
                                    setSummaryReturnsToQuestions(false);
                                    setShowSummary(false);
                                } else {
                                    handleBack();
                                }
                            }}
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
    summaryContainer: {
        paddingTop: 0,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.xl,
    },
    headerBackBtn: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: 'rgba(255,255,255,0.94)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.98)',
        shadowColor: '#9A5578',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 0,
    },
    headerTextBlock: {
        flex: 1,
        marginHorizontal: spacing.md,
        alignItems: 'center',
    },
    headerSpacer: {
        width: 42,
    },
    viewAnswersButton: {
        minHeight: 36,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.full,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    viewAnswersButtonText: {
        color: '#FFFFFF',
        fontFamily: fontFamily.semiBold,
        fontSize: 13,
    },
    headerTitle: {
        fontSize: 18,
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
        paddingHorizontal: 18,
        paddingBottom: 120,
        gap: 12,
    },
    setCardTouchable: {
        width: '100%',
        minHeight: 112,
        borderRadius: 24,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.92)',
        overflow: 'visible',
        shadowColor: '#A76B89',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.07,
        shadowRadius: 16,
        elevation: 0,
    },
    setCardContent: {
        width: '100%',
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
    },
    emojiBadgeContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        flexShrink: 0,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        backgroundColor: 'rgba(255,255,255,0.58)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.76)',
    },
    emojiText: {
        fontSize: 34,
        lineHeight: 40,
    },
    setIconImage: {
        width: 42,
        height: 42,
    },
    setCardInfo: {
        flex: 1,
        minWidth: 0,
        justifyContent: 'center',
    },
    setTitle: {
        marginTop: 5,
        fontSize: 17,
        lineHeight: 20,
        fontWeight: '800',
        fontFamily: fontFamily.extraBold,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 0,
        gap: 8,
    },
    formatBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    formatBadgeText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700',
        fontFamily: fontFamily.bold,
    },
    statusAvatarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        minWidth: 34,
    },
    setCardRightColumn: {
        width: 58,
        flexShrink: 0,
        minHeight: 82,
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        marginLeft: 6,
    },
    statusAvatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 0,
        borderColor: '#F5A3CB',
        backgroundColor: '#FFE7F2',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    partnerStatusAvatar: {
        backgroundColor: '#F4E8FF',
        borderColor: '#D8B4FE',
    },
    userStatusAvatarOverlap: {
        marginLeft: -8,
        zIndex: 2,
    },
    statusAvatarComplete: {
        opacity: 1,
        borderColor: '#F04F9D',
    },
    statusAvatarPending: {
        opacity: 0.72,
        borderColor: 'transparent',
    },
    statusAvatarImage: {
        width: '100%',
        height: '100%',
        borderRadius: 12,
    },
    statusAvatarInitial: {
        color: '#B31975',
        fontSize: 11,
        fontWeight: '900',
        fontFamily: fontFamily.extraBold,
    },
    setDescription: {
        fontSize: 12,
        lineHeight: 15,
        marginTop: 4,
        opacity: 0.82,
        fontFamily: fontFamily.medium,
    },
    premiumBadge: {
        width: 38,
        height: 38,
        borderRadius: 19,
        borderWidth: 1,
        borderColor: '#F59E0B',
        backgroundColor: 'rgba(255,255,255,0.6)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    premiumText: {
        color: '#D97706',
        fontSize: 11,
        fontWeight: '700',
        fontFamily: fontFamily.bold,
    },
    startButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#7A315D',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.18,
        shadowRadius: 10,
        elevation: 0,
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
