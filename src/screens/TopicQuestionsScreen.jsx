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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';

import { AnimatedCardStack } from '../components/cards';
import { colors, spacing, borderRadius } from '../theme';
import { API_BASE } from '../constants/Api';

const { width, height } = Dimensions.get('window');

/**
 * TopicQuestionsScreen - Fetches and displays questions for a specific topic
 * Uses AnimatedCardStack + TaskCard for visual display
 */
export default function TopicQuestionsScreen({
    topic,           // Topic ID: 'future', 'money', 'hotspicy', etc.
    topicTitle,      // Display title: 'Future', 'Money', etc.
    topicEmoji,      // Display emoji: '🔮', '💰', etc.
    partnerName = 'Your Love',
    userName = 'You',
    userAvatar = null,
    partnerAvatar = null,
    userId,
    onBack = () => { },
}) {
    const insets = useSafeAreaInsets();
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState([]);
    const [error, setError] = useState(null);

    // Fetch questions for this topic
    useEffect(() => {
        fetchQuestions();
    }, [topic]);

    const fetchQuestions = async () => {
        try {
            setLoading(true);
            setError(null);
            console.log(`📡 Fetching questions for topic: ${topic}`);

            const res = await fetch(`${API_BASE}/api/questions/topic/${topic}?limit=20&shuffle=true`);
            const json = await res.json();

            if (json.success && json.data?.questions) {
                console.log(`✅ Fetched ${json.data.questions.length} questions for topic: ${topic}`);
                setQuestions(json.data.questions);
            } else {
                console.error('❌ Failed to fetch questions:', json.message);
                setError(json.message || 'Failed to load questions');
            }
        } catch (err) {
            console.error('❌ Fetch error:', err);
            setError('Could not connect to server');
        } finally {
            setLoading(false);
        }
    };

    // Callback for AnimatedCardStack to update the index
    const handleIndexChange = useCallback((newIndex) => {
        setCurrentIndex(newIndex);
    }, []);

    // Callback to handle answer submission
    const handleAnswerSubmit = useCallback(async (taskIndex, answer) => {
        console.log('🎯 [ANSWER] Submitting:', { taskIndex, answer });

        // Save locally
        setUserAnswers(prev => {
            const updated = [...prev];
            updated[taskIndex] = {
                taskIndex,
                answer,
                question: questions[taskIndex],
                answeredAt: new Date().toISOString()
            };
            return updated;
        });

        // TODO: Submit to backend if needed
    }, [questions]);

    // Transform questions to tasks format for AnimatedCardStack
    const tasks = useMemo(() => {
        return questions.map(q => ({
            _id: q._id,
            taskstatement: q.taskstatement || q.question,
            category: q.category,  // Visual type: 'likelyto', 'neverhaveiever', 'deep'
            options: q.options || [],
            topic: q.topic,
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
                <TouchableOpacity style={styles.retryBtn} onPress={fetchQuestions}>
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
                <Text style={styles.emptyEmoji}>{topicEmoji || '📝'}</Text>
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
                            <Text style={styles.headerTitle}>{topicEmoji} {topicTitle}</Text>
                            <Text style={styles.headerSubtitle}>
                                {currentIndex + 1} of {tasks.length} questions
                            </Text>
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
                            userAvatar={userAvatar}
                            partnerAvatar={partnerAvatar}
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
    headerTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
    headerSubtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },

    cardsContainer: {
        flex: 1,
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: spacing.sm,
        paddingHorizontal: spacing.md
    },
});
