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
} from 'react-native';

// Topic image mapping - matches HomeScreen topic images
const TOPIC_IMAGES = {
    hotspicy: require('../../assets/chilli.png'),
    money: require('../../assets/coins.png'),
    future: require('../../assets/couplecutout.png'),
    fitness: require('../../assets/couplerunning.png'),
    travel: require('../../assets/travel.png'),
    family: require('../../assets/couplekids5.png'),
};
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';

import { AnimatedCardStack } from '../components/cards';
import { colors, spacing, borderRadius } from '../theme';
import { API_BASE } from '../constants/Api';
import { useSelector } from 'react-redux';
import { selectUser } from '../store/slices/userSlice';

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
    onBack = () => { },
}) {
    const insets = useSafeAreaInsets();
    const userData = useSelector(selectUser);

    // Use prop userId if provided, otherwise fallback to Redux store
    const effectiveUserId = userId || userData?.id;
    console.log('👤 [TopicScreen] Effective User ID:', effectiveUserId, 'Provided:', userId, 'Redux:', userData?.id);

    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState([]);
    const [error, setError] = useState(null);

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

    const syncProgress = async () => {
        const maxSeen = maxSeenOrderRef.current;
        const lastSynced = lastSyncedOrderRef.current;
        const currentUserId = userIdRef.current;

        console.log(`💾 [SYNC CHECK] MaxSeen: ${maxSeen}, LastSynced: ${lastSynced}, UserID: ${currentUserId}`);

        if (maxSeen > lastSynced && currentUserId) {
            console.log(`💾 [SYNC] Syncing progress on unmount: ${maxSeen}`);
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

            console.log(`📡 Fetching questions for topic: ${topic} (Initial: ${isInitial})`);

            // If it's not initial, we want to fetch *after* the last question we have
            // But the API uses user's progress. 
            // If we have questions loaded [Q1..Q20], asking API again might return Q21..Q40 if we call with correct params?
            // Actually the API fetches based on DB User progress. 
            // PROBLEM: If user hasn't synced progress yet (local browsing), API will return Q1..Q20 again?
            // SOLUTION: We should pass a `minOrder` param to API if we have local questions?
            // OR checks against `questions` state last element.
            // Let's modify the API call or trust the flow?
            // Current API: `GET /topic?userId=...` -> fetches > user.topicProgress.
            // If user swiped 5 cards locally but didn't sync, API returns card 1 again?
            // Yes.
            // WE NEED TO SYNC PROGRESS BEFORE FETCHING MORE?
            // OR allow API to accept `afterOrder` param.
            // I didn't add `afterOrder` to backend.
            // Hack for now: We assume we sync progress on Answer.
            // For Infinite Scroll to work without answering, we might need to rely on what's loaded.
            // Actually, if we just append, we are fine locally.
            // But if we run out of buffer and need more...
            // Use the `lastSeenOrder` from the *server's perspective*?
            // If I just pass `userId`, it uses server state.
            // If I don't answer, server state is old.
            // I should passes `startingOrder` if I can?
            // But I didn't implement that in backend.
            // Wait, I can just rely on the initial batch being large enough (20)?
            // If user swipes 15, we fetch more.
            // Ideally we'd sync the 15 skips then fetch.
            // I will implement "Sync before Fetch" strategy for infinite scroll.

            if (!isInitial) {
                await syncProgress(); // Sync any pending skips
                lastSyncedOrderRef.current = maxSeenOrderRef.current; // Update ref to avoid double sync
            }

            const url = `${API_BASE}/api/questions/topic/${topic}?userId=${effectiveUserId || ''}&limit=20`;
            console.log(`🔗 [API] Calling: ${url}`);
            const res = await fetch(url);
            const json = await res.json();

            if (json.success && json.data?.questions) {
                const newQuestions = json.data.questions;
                console.log(`✅ Fetched ${newQuestions.length} questions for topic: ${topic}`);

                if (isInitial) {
                    setQuestions(newQuestions);
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
                        console.log(`✅ [SYNC] Auto-synced order ${passedQuestion.order}`);
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
        console.log('🎯 [ANSWER] Submitting:', { taskIndex, answer, answerType });

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
        console.log('🔍 [TopicScreen] First question data:', questions[0]);
        return questions.map(q => ({
            _id: q._id,
            taskstatement: q.taskstatement || q.question,
            category: q.category || q.visualType,  // Fallback to visualType if category not set
            options: q.options || [],
            topic: q.topic,
            visualType: q.visualType,  // Keep original for debugging
        }));
    }, [questions]);

    // Loading state
    if (loading) {
        return (
            <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Loading {topicTitle} questions...</Text>
            </View>
        );
    }

    // Error state
    if (error) {
        return (
            <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
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

    // No questions state
    if (tasks.length === 0) {
        return (
            <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
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
        <GestureHandlerRootView style={styles.container}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={{ flex: 1 }}>
                    {/* Header */}
                    <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
                        <TouchableOpacity onPress={onBack} style={styles.headerBackBtn}>
                            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                                <Path d="M15 18l-6-6 6-6" stroke={colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
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
                        />
                    </View>
                </View>
            </TouchableWithoutFeedback>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },

    loadingText: {
        fontSize: 16,
        color: colors.textSecondary,
        marginTop: spacing.lg
    },

    errorEmoji: { fontSize: 48, marginBottom: spacing.md },
    errorText: {
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.lg
    },
    retryBtn: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        backgroundColor: colors.primary,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.md,
    },
    retryBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },

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
        marginBottom: spacing.lg
    },
    backBtn: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg
    },
    backBtnText: { fontSize: 16, fontWeight: '600', color: colors.primary },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md,
    },
    headerBackBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.borderLight,
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
    headerTitle: { fontSize: 22, fontWeight: '600', color: colors.text, letterSpacing: -0.5 },
    headerSubtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },

    cardsContainer: {
        flex: 1,
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: spacing.sm,
        paddingHorizontal: spacing.md
    },
});
