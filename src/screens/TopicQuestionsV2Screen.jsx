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
            return { bg: '#0F766E', text: '#FFFFFF' };
        case 'neverhaveiever':
            return { bg: '#7C3AED', text: '#FFFFFF' };
        case 'likelyto':
            return { bg: '#BE185D', text: '#FFFFFF' };
        case 'wouldyourather':
            return { bg: '#1D4ED8', text: '#FFFFFF' };
        case 'thisorthat':
            return { bg: '#B45309', text: '#FFFFFF' };
        case 'slider':
            return { bg: '#475569', text: '#FFFFFF' };
        case 'voicerecord':
            return { bg: '#4F46E5', text: '#FFFFFF' };
        case 'takephoto':
            return { bg: '#BE123C', text: '#FFFFFF' };
        default:
            return { bg: '#7C3AED', text: '#FFFFFF' };
    }
};

const getAvatarSource = (avatar) => {
    if (!avatar) return null;
    return typeof avatar === 'string' ? { uri: avatar } : avatar;
};

const getAvatarInitial = (name) => (name || '?').trim().charAt(0).toUpperCase() || '?';

const isProgressComplete = (progress) => Boolean(progress?.completedAt || progress?.percentComplete >= 100);

const SetStatusAvatar = ({ avatar, name, complete, variant = 'user' }) => {
    const avatarSource = getAvatarSource(avatar);

    return (
        <View style={[
            styles.statusAvatar,
            variant === 'partner' && styles.partnerStatusAvatar,
            variant === 'userOverlap' && styles.userStatusAvatarOverlap,
            complete && styles.statusAvatarComplete,
            !complete && styles.statusAvatarPending,
        ]}>
            {avatarSource ? (
                <Image source={avatarSource} style={styles.statusAvatarImage} resizeMode="cover" />
            ) : (
                <Text style={styles.statusAvatarInitial}>{getAvatarInitial(name)}</Text>
            )}
        </View>
    );
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
    const effectiveUserAvatar = userData?.avatarThumbnail || userData?.avatar || userAvatar;
    const effectivePartnerAvatar = userData?.partnerAvatarThumbnail || userData?.partnerAvatar || partnerAvatar;

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
        const response = await QuestionsV2Api.getSets(topic, effectiveUserId);
        if (response.success) {
            setSets(response.data?.sets || []);
        } else {
            setError(response.message || response.error || 'Failed to load question sets');
        }
        setSetsLoading(false);
    }, [effectiveUserId, topic]);

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

    const handleAnswerSubmit = useCallback((taskIndex, answer, answerType = 'text') => {
        const question = questions[taskIndex];
        if (!question || !selectedSet) return false;

        setUserAnswers((prev) => {
            const next = [...prev];
            next[taskIndex] = { answer, questionId: question.questionId, answerType };
            return next;
        });

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
            }
        }).catch((err) => {
            console.warn('[TopicQuestionsV2] Failed to submit answer', {
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
        setShowSummary(true);
        requestReviewForMoment(REVIEW_MOMENTS.V2_SET_SUMMARY_SHOWN);
    }, [effectiveUserId, questions.length, selectedSet, topic, singleQuestionToAnswer]);

    const tasks = useMemo(() => questions.map((question, questionIndex) => ({
        _id: question.questionId,
        questionId: question.questionId,
        taskstatement: question.prompt,
        category: selectedSet?.format || 'deep',
        options: question.options || [],
        minValue: question.minValue,
        maxValue: question.maxValue,
        minLabel: question.minLabel,
        maxLabel: question.maxLabel,
        originalIndex: questionIndex,
        backendIndex: question.index,
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
                    const iconImageSource = getSetIconImageSource(set);
                    const emoji = set.icon || getSetEmoji(set.format, set.title);
                    const theme = getFormatTheme(set.format);
                    const userComplete = isProgressComplete(set.progress);
                    const partnerComplete = isProgressComplete(set.partnerProgress);
                    return (
                        <TouchableOpacity
                            key={set.setId}
                            style={styles.setCardTouchable}
                            onPress={() => handleSelectSet(set)}
                            activeOpacity={0.85}
                        >
                            <View style={styles.emojiBadgeContainer}>
                                {iconImageSource ? (
                                    <Image source={iconImageSource} style={styles.setIconImage} resizeMode="contain" />
                                ) : (
                                    <Text style={styles.emojiText}>{emoji}</Text>
                                )}
                            </View>

                            {/* Info Column */}
                            <View style={styles.setCardInfo}>
                                <View style={styles.metaRow}>
                                    <View style={[styles.formatBadge, { backgroundColor: theme.bg }]}>
                                        <Text style={[styles.formatBadgeText, { color: theme.text }]}>
                                            {formatLabel[set.format] || set.format}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={styles.setTitle}>{set.title}</Text>
                            </View>

                            {/* Status avatars on the right */}
                            <View style={styles.setCardRightColumn}>
                                <View style={styles.statusAvatarRow}>
                                    {set.partnerProgress ? (
                                        <SetStatusAvatar
                                            avatar={effectivePartnerAvatar}
                                            name={partnerName}
                                            complete={partnerComplete}
                                            variant="partner"
                                        />
                                    ) : null}
                                    <SetStatusAvatar
                                        avatar={effectiveUserAvatar}
                                        name={userName}
                                        complete={userComplete}
                                        variant={set.partnerProgress ? 'userOverlap' : 'user'}
                                    />
                                </View>
                                {set.premium && !isPremium ? (
                                    <View style={[styles.premiumBadge, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                                        <Svg width={11} height={11} viewBox="0 0 24 24" fill="none">
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
                                        <Text style={styles.premiumText}>Locked</Text>
                                    </View>
                                ) : (
                                    <View style={styles.startButton}>
                                        <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
                                            <Path d="M9 5l7 7-7 7" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
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
                    userAvatar={effectiveUserAvatar}
                    partnerAvatar={effectivePartnerAvatar}
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
        paddingHorizontal: 16,
        paddingVertical: 16,
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
        width: 46,
        minHeight: 56,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    emojiText: {
        fontSize: 34,
        lineHeight: 42,
    },
    setIconImage: {
        width: 44,
        height: 44,
    },
    setCardInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    setTitle: {
        marginTop: 6,
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
        fontFamily: fontFamily.bold,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 8,
    },
    formatBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    formatBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        fontFamily: fontFamily.medium,
    },
    statusAvatarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        minWidth: 54,
    },
    setCardRightColumn: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        marginLeft: 12,
        gap: 6,
    },
    statusAvatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 1,
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
        opacity: 0.38,
        borderColor: 'transparent',
    },
    statusAvatarImage: {
        width: '100%',
        height: '100%',
        borderRadius: 14,
    },
    statusAvatarInitial: {
        color: '#B31975',
        fontSize: 11,
        fontWeight: '900',
        fontFamily: fontFamily.extraBold,
    },
    setDescription: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 6,
        fontFamily: fontFamily.regular,
    },
    premiumBadge: {
        paddingHorizontal: 10,
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
        paddingHorizontal: 13,
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
