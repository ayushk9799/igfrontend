import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    ActivityIndicator,
    Platform,
    TouchableWithoutFeedback,
    Keyboard,
    Image,
    StatusBar,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { fontFamily } from '../constants/fonts';

// Topic image mapping - matches HomeScreen topic images
const TOPIC_IMAGES = {
    hotspicy: require('../../assets/home/hot-fire.png'),
    money: require('../../assets/home/money-bag.png'),
    future: require('../../assets/home/future-crystal.png'),
    fitness: require('../../assets/home/lifestyle-arm.png'),
    travel: require('../../assets/home/travel-plane.png'),
    family: require('../../assets/home/family.png'),
};
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';

import { AnimatedCardStack } from '../components/cards';
import { colors, spacing, borderRadius } from '../theme';
import { API_BASE } from '../constants/Api';
import { TOPIC_CATEGORIES } from '../constants/Categories';
import { useSelector } from 'react-redux';
import { selectUser, selectIsPremium } from '../store/slices/userSlice';
import { translateUiText } from '../i18n/uiTranslation';

const { width } = Dimensions.get('window');

/**
 * TopicQuestionsScreen - Fetches and displays questions for a specific topic
 * Uses AnimatedCardStack + TaskCard for visual display
 */
export default function TopicQuestionsScreen({
    topic,
    topicTitle,
    topicEmoji,
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
    const insets = useSafeAreaInsets();
    const userData = useSelector(selectUser);
    const isPremium = useSelector(selectIsPremium);
    const topicConfig = TOPIC_CATEGORIES[topic] || {
        title: topicTitle,
        subtitle: translateUiText("Questions made for the two of you"),
        emoji: topicEmoji || '💞',
        color: colors.primary,
        bgGradient: ['#FFE4EF', '#FFF4F8'],
        textColor: '#B4235A',
    };
    const topicImage = TOPIC_IMAGES[topic] || topicConfig.image;
    const pageGradient = [
        topicConfig.bgGradient?.[0] || '#F8D9EC',
        '#FFF9FB',
        topicConfig.bgGradient?.[1] || '#F7D8F2',
    ];
    const firstInitial = (userName || 'You').trim().charAt(0).toUpperCase();
    const partnerInitial = (partnerName || 'Love').trim().charAt(0).toUpperCase();

    // Use prop userId if provided, otherwise fallback to Redux store
    const effectiveUserId = userId || userData?.id;

    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState([]);
    const [error, setError] = useState(null);
    const [totalActiveQuestions, setTotalActiveQuestions] = useState(0);
    const [startingOrder, setStartingOrder] = useState(0);

    // Progress Tracking Refs
    const maxSeenOrderRef = React.useRef(0);
    const lastSyncedOrderRef = React.useRef(0);
    const isFetchingRef = React.useRef(false);
    const userIdRef = React.useRef(effectiveUserId);

    // Keep userIdRef updated
    useEffect(() => {
        userIdRef.current = effectiveUserId;
    }, [effectiveUserId]);

    // Initial load - Refetch when user ID becomes available to ensure we respect progress
    useEffect(() => {
        if (effectiveUserId) {
            fetchQuestions(true);
        } else {
            // Optional: Fetch guest questions if no user, but better to wait?
            // Existing logic allows undefined userId, so we can fetch.
            fetchQuestions(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [topic, effectiveUserId]);

    // Sync progress on unmount
    useEffect(() => {
        return () => {
            syncProgress();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!hasPartner && onLinkPartner) {
            onLinkPartner();
        }
    }, [hasPartner, onLinkPartner]);

    const syncProgress = async () => {
        const maxSeen = maxSeenOrderRef.current;
        const lastSynced = lastSyncedOrderRef.current;
        const currentUserId = userIdRef.current;


        if (maxSeen > lastSynced && currentUserId) {
            try {
                // Using fetch with keepalive: true if supported, or just standard fetch
                // React Native doesn't support keepalive flag standardly but standard fetch usually initiates
                await fetch(`${API_BASE}/api/questions/progress`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: currentUserId,
                        topicId: topic,
                        lastOrder: maxSeen
                    }),
                });
            } catch (err) {
                console.error('❌ [SYNC] Failed to sync progress:', err);
            }
        }
    };

    const fetchQuestions = async (isInitial = false) => {
        if (isFetchingRef.current) return;
        isFetchingRef.current = true;

        try {
            if (isInitial) {
                setLoading(true);
                setError(null);
            }

            if (!isInitial) {
                await syncProgress(); // Sync any pending skips
                lastSyncedOrderRef.current = maxSeenOrderRef.current; // Update ref to avoid double sync
            }

            const url = `${API_BASE}/api/questions/topic/${topic}?userId=${effectiveUserId || ''}&limit=20`;
            const res = await fetch(url);
            const json = await res.json();

            if (json.success && json.data?.questions) {
                const newQuestions = json.data.questions;
                const questionTotal = json.data.totalActiveQuestions ?? json.data.total ?? 0;

                setTotalActiveQuestions(questionTotal);

                if (isInitial) {
                    setQuestions(newQuestions);
                    setStartingOrder(json.data.startingOrder || 0);
                    // Initialize maxSeen based on loaded questions? 
                    // No, maxSeen tracks *user action*. 
                    // But we should start maxSeen at the first question's order - 1?
                    // Actually, if we load Q10, Q11... maxSeen starts at whatever user had.
                    // We only update maxSeen when user SWIPES.
                } else {
                    // Filter duplicates just in case
                    setQuestions(prev => {
                        const existingIds = new Set(prev.map(q => q._id));
                        const uniqueNew = newQuestions.filter(q => !existingIds.has(q._id));
                        return [...prev, ...uniqueNew];
                    });
                }
            } else {
                console.error('❌ Failed to fetch questions:', json.message);
                if (isInitial) setError(json.message || 'Failed to load questions');
            }
        } catch (err) {
            console.error('❌ Fetch error:', err);
            if (isInitial) setError('Could not connect to server');
        } finally {
            if (isInitial) setLoading(false);
            isFetchingRef.current = false;
        }
    };

    // Callback for AnimatedCardStack to update the index
    const handleIndexChange = useCallback((newIndex) => {
        setCurrentIndex(newIndex);

        // Update Max Seen Order
        // If we moved from index 0 -> 1, we have "seen"/passed question at index 0.
        // So maxSeen = questions[newIndex - 1].order
        if (newIndex > 0 && questions[newIndex - 1]) {
            const passedQuestion = questions[newIndex - 1];
            if (passedQuestion.order > maxSeenOrderRef.current) {
                maxSeenOrderRef.current = passedQuestion.order;

                // ⚡️ SAFE SYNC: Sync immediately on swipe to ensure persistence
                // We don't wait for unmount because it can be unreliable
                if (effectiveUserId) {
                    fetch(`${API_BASE}/api/questions/progress`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userId: effectiveUserId,
                            topicId: topic,
                            lastOrder: passedQuestion.order
                        }),
                    }).then(() => {
                        lastSyncedOrderRef.current = passedQuestion.order;
                    }).catch(err => console.error('❌ [SYNC] Auto-sync failed:', err));
                }
            }
        }

        // Infinite Scroll Trigger
        // If we are close to the end (e.g. 5 cards left), fetch more
        if (questions.length - newIndex < 5) {
            fetchQuestions(false);
        }
        // fetchQuestions intentionally reads the latest refs/state from this render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [questions, effectiveUserId, topic]);

    // Callback to handle answer submission
    const handleAnswerSubmit = useCallback(async (taskIndex, answer, answerType = 'text') => {

        const question = questions[taskIndex];

        // Update Progress Refs immediately
        if (question && question.order > maxSeenOrderRef.current) {
            maxSeenOrderRef.current = question.order;
        }

        // Save locally
        setUserAnswers(prev => {
            const updated = [...prev];
            updated[taskIndex] = {
                taskIndex,
                answer,
                answerType,
                question,
                answeredAt: new Date().toISOString()
            };
            return updated;
        });

        if (effectiveUserId && question) {
            // 1. Sync Progress (Answered = Seen)
            try {
                await fetch(`${API_BASE}/api/questions/progress`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: effectiveUserId,
                        topicId: topic,
                        lastOrder: question.order
                    }),
                });
                lastSyncedOrderRef.current = question.order; // Mark as synced
            } catch (pErr) {
                console.error('Failed to sync progress on answer:', pErr);
            }

            // 2. Submit Chat
            try {
                await fetch(`${API_BASE}/api/chat/answer`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: effectiveUserId,
                        questionSource: topic,
                        questionId: question._id,
                        questionText: question.taskstatement || question.question,
                        questionCategory: question.category,
                        answer: typeof answer === 'string' ? answer : JSON.stringify(answer),
                        answerType: answerType,
                    }),
                });
                // ... logging
            } catch (err) {
                // ... logging
            }
        }
    }, [questions, effectiveUserId, topic]);

    // Transform questions to tasks format for AnimatedCardStack
    const tasks = useMemo(() => {
        return questions.map(q => ({
            _id: q._id,
            taskstatement: q.taskstatement || q.question,
            category: q.category || q.visualType,  // Fallback to visualType if category not set
            options: q.options || [],
            minValue: q.minValue,
            maxValue: q.maxValue,
            minLabel: q.minLabel,
            maxLabel: q.maxLabel,
            topic: q.topic,
            visualType: q.visualType,  // Keep original for debugging
            order: q.order,  // Include order for premium restriction check
        }));
    }, [questions]);

    const renderContent = () => {
        if (loading) {
            return (
                <View style={[styles.center, { paddingTop: insets.top }]}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>{translateUiText("Loading")}{topicTitle}{translateUiText("questions...")}</Text>
                </View>
            );
        }

        if (error) {
            return (
                <View style={[styles.center, { paddingTop: insets.top }]}>
                    <Text style={styles.errorEmoji}>😕</Text>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity style={styles.retryBtn} onPress={() => fetchQuestions(true)}>
                        <Text style={styles.retryBtnText}>{translateUiText("Try Again")}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.backBtn} onPress={onBack}>
                        <Text style={styles.backBtnText}>{translateUiText("← Go Back")}</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (tasks.length === 0) {
            return (
                <View style={[styles.center, { paddingTop: insets.top }]}>
                    {topicImage ? (
                        <Image
                            source={topicImage}
                            style={styles.emptyImage}
                            resizeMode="contain"
                        />
                    ) : (
                        <Text style={styles.emptyEmoji}>{topicEmoji || '📝'}</Text>
                    )}
                    <Text style={styles.emptyText}>{translateUiText("No questions available for")}{topicTitle}</Text>
                    <TouchableOpacity style={styles.backBtn} onPress={onBack}>
                        <Text style={styles.backBtnText}>{translateUiText("← Go Back")}</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.flex}>
                    {/* Colorful topic header inspired by the soft category cards. */}
                    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
                        <TouchableOpacity onPress={onBack} style={styles.headerBackBtn} activeOpacity={0.82}>
                            <Svg width={25} height={25} viewBox="0 0 24 24" fill="none">
                                <Path d="M15 18l-6-6 6-6" stroke="#2E2448" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
                            </Svg>
                        </TouchableOpacity>

                        <LinearGradient
                            colors={topicConfig.bgGradient || ['#FFE4EF', '#FFF4F8']}
                            start={{ x: 0, y: 0.5 }}
                            end={{ x: 1, y: 0.5 }}
                            style={styles.topicHero}
                        >
                            <View style={styles.heroIconBubble}>
                                {topicImage ? (
                                    <Image source={topicImage} style={styles.heroTopicImage} resizeMode="contain" />
                                ) : (
                                    <Text style={styles.heroEmoji}>{topicConfig.emoji || topicEmoji}</Text>
                                )}
                            </View>

                            <View style={styles.heroCopy}>
                                <View style={[styles.heroBadge, { backgroundColor: topicConfig.color }]}>
                                    <Text style={styles.heroBadgeText}>{translateUiText("COUPLE QUESTIONS")}</Text>
                                </View>
                                <Text
                                    style={[styles.headerTitle, { color: topicConfig.textColor || topicConfig.color }]}
                                    numberOfLines={1}
                                >
                                    {translateUiText(topicTitle || topicConfig.title)}
                                </Text>
                                <Text
                                    style={[styles.headerSubtitle, { color: topicConfig.textColor || topicConfig.color }]}
                                    numberOfLines={2}
                                >
                                    {translateUiText(
                                        topicConfig.subtitle
                                            || topicConfig.description
                                            || 'Discover more about each other',
                                    ).replace(/\n/g, ' ')}
                                </Text>
                            </View>

                            <View style={styles.heroMeta}>
                                <View style={styles.initialsRow}>
                                    <View style={styles.initialBubble}>
                                        <Text style={[styles.initialText, { color: topicConfig.color }]}>{firstInitial}</Text>
                                    </View>
                                    <View style={[styles.initialBubble, styles.initialBubbleOverlap]}>
                                        <Text style={[styles.initialText, { color: topicConfig.color }]}>{partnerInitial}</Text>
                                    </View>
                                </View>
                                <View style={[styles.progressPill, { backgroundColor: topicConfig.color }]}>
                                    <Text style={styles.progressPillText}>
                                        {currentIndex + 1}/{totalActiveQuestions || tasks.length}
                                    </Text>
                                </View>
                            </View>
                        </LinearGradient>
                    </View>

                    {/* Cards Stack */}
                    <View style={[styles.cardsContainer, { paddingBottom: insets.bottom + 80 }]}>
                        <AnimatedCardStack
                            tasks={tasks}
                            currentIndex={currentIndex}
                            partnerName={partnerName}
                            userName={userName}
                            userAvatar={userData.avatarThumbnail || userData.avatar || userAvatar}
                            partnerAvatar={userData.partnerAvatarThumbnail || userData.partnerAvatar || partnerAvatar}
                            userId={effectiveUserId}
                            partnerId={partnerId || userData?.partnerId}
                            hasPartner={hasPartner}
                            onLinkPartner={onLinkPartner}
                            onIndexChange={handleIndexChange}
                            onAnswerSubmit={handleAnswerSubmit}
                            userAnswers={userAnswers}
                            isPremium={isPremium}
                            onNavigateToPremium={onNavigateToPremium}
                            totalCardsOverride={totalActiveQuestions}
                            displayIndexOffset={startingOrder}
                        />
                    </View>
                </View>
            </TouchableWithoutFeedback>
        );
    };

    return (
        <LinearGradient
            colors={pageGradient}
            locations={[0, 0.48, 1]}
            start={{ x: 0.25, y: 0 }}
            end={{ x: 0.75, y: 1 }}
            style={styles.flex}
        >
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <GestureHandlerRootView style={styles.container}>
                <View
                    pointerEvents="none"
                    style={[
                        styles.ambientOrb,
                        styles.ambientOrbTop,
                        { backgroundColor: topicConfig.color },
                    ]}
                />
                <View
                    pointerEvents="none"
                    style={[
                        styles.ambientOrb,
                        styles.ambientOrbBottom,
                        { backgroundColor: topicConfig.bgGradient?.[0] || colors.primaryLight },
                    ]}
                />
                {renderContent()}
            </GestureHandlerRootView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    container: { flex: 1, backgroundColor: 'transparent' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
    ambientOrb: {
        position: 'absolute',
        borderRadius: 999,
        opacity: 0.13,
    },
    ambientOrbTop: {
        width: width * 0.72,
        height: width * 0.72,
        top: -width * 0.3,
        right: -width * 0.24,
    },
    ambientOrbBottom: {
        width: width * 0.9,
        height: width * 0.9,
        bottom: -width * 0.5,
        left: -width * 0.34,
    },

    loadingText: {
        fontSize: 16,
        color: colors.textSecondary,
        marginTop: spacing.lg,
        fontFamily: fontFamily.medium,
    },

    errorEmoji: { fontSize: 48, marginBottom: spacing.md },
    errorText: {
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.lg,
        fontFamily: fontFamily.medium,
    },
    retryBtn: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        backgroundColor: colors.primary,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.md,
        ...Platform.select({
            ios: {
                shadowColor: '#FF758F',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.15,
                shadowRadius: 10,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    retryBtnText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
        fontFamily: fontFamily.bold,
    },

    emptyEmoji: { fontSize: 48, marginBottom: spacing.md },
    emptyImage: {
        width: 80,
        height: 80,
        marginBottom: spacing.md
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: spacing.lg,
        fontFamily: fontFamily.bold,
    },
    backBtn: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        backgroundColor: 'rgba(255,255,255,0.86)',
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: '#F7DDEA',
        ...Platform.select({
            ios: {
                shadowColor: '#C084FC',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.1,
                shadowRadius: 10,
            },
            android: {
                elevation: 3,
            },
        }),
    },
    backBtnText: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text,
        fontFamily: fontFamily.bold,
    },

    header: {
        width: '100%',
        alignItems: 'flex-start',
        paddingHorizontal: 18,
        paddingBottom: spacing.sm,
        gap: 12,
    },
    headerBackBtn: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: 'rgba(255,255,255,0.92)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.96)',
        ...Platform.select({
            ios: {
                shadowColor: '#A04D79',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.12,
                shadowRadius: 10,
            },
            android: {
                elevation: 3,
            },
        }),
    },
    topicHero: {
        width: '100%',
        minHeight: 126,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 14,
        borderRadius: 28,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.9)',
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: '#AD6688',
                shadowOffset: { width: 0, height: 12 },
                shadowOpacity: 0.1,
                shadowRadius: 22,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    heroIconBubble: {
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.56)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.72)',
    },
    heroTopicImage: {
        width: 52,
        height: 52,
    },
    heroEmoji: {
        fontSize: 40,
    },
    heroCopy: {
        flex: 1,
        minWidth: 0,
        marginLeft: 14,
        marginRight: 8,
    },
    heroBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 9,
        paddingVertical: 5,
        borderRadius: 9,
        marginBottom: 6,
    },
    heroBadgeText: {
        fontSize: 9.5,
        fontWeight: '800',
        letterSpacing: 0.65,
        color: '#FFFFFF',
        fontFamily: fontFamily.extraBold,
    },
    headerTitle: {
        fontSize: width < 380 ? 18 : 20,
        fontWeight: '800',
        lineHeight: width < 380 ? 22 : 24,
        letterSpacing: -0.35,
        fontFamily: fontFamily.extraBold,
    },
    headerSubtitle: {
        fontSize: 12.5,
        lineHeight: 17,
        marginTop: 4,
        opacity: 0.78,
        fontFamily: fontFamily.medium,
    },
    heroMeta: {
        width: 58,
        minHeight: 88,
        alignItems: 'flex-end',
        justifyContent: 'space-between',
    },
    initialsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    initialBubble: {
        width: 31,
        height: 31,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.48)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.64)',
    },
    initialBubbleOverlap: {
        marginLeft: -7,
    },
    initialText: {
        fontSize: 13,
        fontWeight: '800',
        fontFamily: fontFamily.extraBold,
    },
    progressPill: {
        minWidth: 52,
        height: 34,
        paddingHorizontal: 9,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
    },
    progressPillText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800',
        fontFamily: fontFamily.extraBold,
    },

    cardsContainer: {
        flex: 1,
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: spacing.md,
        paddingHorizontal: spacing.md
    },
});
