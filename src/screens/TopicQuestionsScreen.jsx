import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    ActivityIndicator,
    KeyboardAvoidingView,
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
import { useSelector } from 'react-redux';
import { selectUser, selectIsPremium } from '../store/slices/userSlice';

const { width, height } = Dimensions.get('window');

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
                const response = await fetch(`${API_BASE}/api/chat/answer`, {
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
                    <Text style={styles.loadingText}>Loading {topicTitle} questions...</Text>
                </View>
            );
        }

        if (error) {
            return (
                <View style={[styles.center, { paddingTop: insets.top }]}>
                    <Text style={styles.errorEmoji}>😕</Text>
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity style={styles.retryBtn} onPress={() => fetchQuestions(true)}>
                        <Text style={styles.retryBtnText}>Try Again</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.backBtn} onPress={onBack}>
                        <Text style={styles.backBtnText}>← Go Back</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (tasks.length === 0) {
            return (
                <View style={[styles.center, { paddingTop: insets.top }]}>
                    {TOPIC_IMAGES[topic] ? (
                        <Image
                            source={TOPIC_IMAGES[topic]}
                            style={styles.emptyImage}
                            resizeMode="contain"
                        />
                    ) : (
                        <Text style={styles.emptyEmoji}>{topicEmoji || '📝'}</Text>
                    )}
                    <Text style={styles.emptyText}>No questions available for {topicTitle}</Text>
                    <TouchableOpacity style={styles.backBtn} onPress={onBack}>
                        <Text style={styles.backBtnText}>← Go Back</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={{ flex: 1 }}>
                    {/* Header */}
                    <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
                        <TouchableOpacity onPress={onBack} style={styles.headerBackBtn}>
                            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                                <Path d="M15 18l-6-6 6-6" stroke={colors.text} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                            </Svg>
                        </TouchableOpacity>
                        <View style={styles.headerContent}>
                            <View style={styles.headerTitleRow}>
                                {TOPIC_IMAGES[topic] ? (
                                    <Image
                                        source={TOPIC_IMAGES[topic]}
                                        style={styles.headerTopicImage}
                                        resizeMode="contain"
                                    />
                                ) : (
                                    <Text style={styles.headerEmoji}>{topicEmoji}</Text>
                                )}
                                <Text style={styles.headerTitle}>{topicTitle}</Text>
                            </View>
                        </View>
                        <View style={{ width: 48 }} />
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
            colors={['#F8D9EC', '#FFF7FA', '#FFF4F7', '#F7D8F2']}
            locations={[0, 0.34, 0.72, 1]}
            start={{ x: 0.25, y: 0 }}
            end={{ x: 0.75, y: 1 }}
            style={{ flex: 1 }}
        >
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <GestureHandlerRootView style={styles.container}>
                {renderContent()}
            </GestureHandlerRootView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'transparent' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },

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
        ...Platform.select({
            ios: {
                shadowColor: '#C084FC',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.1,
                shadowRadius: 12,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    headerContent: { marginLeft: spacing.md, flex: 1 },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTopicImage: {
        width: 32,
        height: 32,
        marginRight: 8,
    },
    headerEmoji: {
        fontSize: 24,
        marginRight: 8,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: colors.text,
        letterSpacing: -0.5,
        fontFamily: fontFamily.extraBold,
    },
    headerSubtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: 2,
        fontFamily: fontFamily.medium,
    },

    cardsContainer: {
        flex: 1,
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: spacing.sm,
        paddingHorizontal: spacing.md
    },
});
