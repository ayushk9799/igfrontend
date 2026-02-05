import React, { useRef, useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    Animated,
    ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import ConfettiCannon from 'react-native-confetti-cannon';

import { colors, spacing, borderRadius } from '../theme';

const { width } = Dimensions.get('window');

// Category emoji mapping
const categoryEmojis = {
    likelyto: '⚖️',
    neverhaveiever: '🤫',
    deep: '💭',
    takephoto: '📸'
};

export default function DailyChallengeDoneScreen({
    partnerName = 'Your Love',
    userAnswers = [],
    tasks = [],
    isComplete = false,
    showConfetti = false,
    onBack = () => { },
    onCompareWithPartner = () => { },
    onRemindPartner = () => { },
}) {
    const insets = useSafeAreaInsets();
    const [showAnswers, setShowAnswers] = useState(false);

    // Entrance animation
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    // Calculate answered count
    const answeredCount = userAnswers.filter(a => a !== undefined && a !== null).length;

    useEffect(() => {
        // Trigger entrance animation on mount
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 400,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    return (
        <View style={styles.completionWrapper}>
            {/* Gradient Background */}
            <LinearGradient
                colors={['#FDF8F3', '#F8EDE3', '#FFE8D6']}
                style={StyleSheet.absoluteFill}
            />

            {/* Confetti Animation */}
            {showConfetti && (
                <ConfettiCannon
                    count={150}
                    origin={{ x: width / 2, y: -10 }}
                    fadeOut
                    explosionSpeed={350}
                    fallSpeed={2500}
                />
            )}

            <Animated.ScrollView
                style={[
                    styles.completionContainer,
                    {
                        opacity: fadeAnim,
                    }
                ]}
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingTop: insets.top }
                ]}
                showsVerticalScrollIndicator={false}
            >
                <Animated.View style={{ transform: [{ translateY: slideAnim }], width: '100%', alignItems: 'center' }}>
                    <Text style={styles.completionEmoji}>✅</Text>
                    <Text style={styles.completionTitle}>Daily Challenge Done!</Text>
                    <Text style={styles.completionSubtitle}>
                        You've completed today's challenge.{'\n'}Come back tomorrow for more!
                    </Text>

                    {/* Progress indicator */}
                    <View style={styles.progressCard}>
                        <Text style={styles.progressLabel}>Today's Progress</Text>
                        <Text style={styles.progressCount}>{answeredCount}/{tasks.length}</Text>
                        <Text style={styles.progressText}>questions answered</Text>
                    </View>

                    {/* Notify partner message */}
                    {!isComplete && (
                        <View style={styles.notifyCard}>
                            <Text style={styles.notifyEmoji}>💕</Text>
                            <Text style={styles.notifyText}>
                                Waiting for {partnerName} to complete their challenge
                            </Text>
                        </View>
                    )}

                    {isComplete && (
                        <View style={styles.notifyCard}>
                            <Text style={styles.notifyEmoji}>🎉</Text>
                            <Text style={styles.notifyText}>
                                All done! Compare answers with {partnerName}
                            </Text>
                            <TouchableOpacity
                                style={styles.compareBtn}
                                onPress={onCompareWithPartner}
                            >
                                <Text style={styles.compareBtnText}>Compare Answers</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    <TouchableOpacity style={styles.remindBtn} onPress={onRemindPartner}>
                        <Text style={styles.remindBtnText}>Remind {partnerName} to Play</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.viewAnswersBtn}
                        onPress={() => setShowAnswers(!showAnswers)}
                    >
                        <Text style={styles.viewAnswersBtnText}>
                            {showAnswers ? '🔼 Hide My Answers' : '📋 View My Answers'}
                        </Text>
                    </TouchableOpacity>

                    {/* Answers List - Show when toggled */}
                    {showAnswers && (
                        <View style={styles.answersContainer}>
                            {userAnswers.map((item, idx) => {
                                if (!item) return null;
                                return (
                                    <View key={idx} style={styles.answerItem}>
                                        <Text style={styles.answerEmoji}>{categoryEmojis[item.task?.category] || '❓'}</Text>
                                        <View style={styles.answerContent}>
                                            <Text style={styles.answerQuestion} numberOfLines={2}>
                                                {item.task?.taskstatement || `Question ${idx + 1}`}
                                            </Text>
                                            <Text style={styles.answerValue}>
                                                Your answer: {
                                                    item.task?.category === 'likelyto'
                                                        ? (item.answer === 'you' ? 'Me' : 'You')
                                                        : item.answer
                                                }
                                            </Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    )}

                    <TouchableOpacity style={styles.homeLink} onPress={onBack}>
                        <Text style={styles.homeLinkText}>← Back to Home</Text>
                    </TouchableOpacity>
                </Animated.View>
            </Animated.ScrollView>
        </View>
    );
}

/* ===================== STYLES ===================== */

const styles = StyleSheet.create({
    completionWrapper: {
        flex: 1,
    },
    completionContainer: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.lg,
        alignItems: 'center',
        paddingBottom: spacing.xl * 2,
    },
    completionEmoji: {
        fontSize: 64,
        marginTop: spacing.xl,
    },
    completionTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: colors.text,
        marginTop: spacing.md,
    },
    completionSubtitle: {
        fontSize: 16,
        color: colors.textSecondary,
        marginTop: spacing.xs,
        marginBottom: spacing.lg,
        textAlign: 'center',
    },

    // Progress card
    progressCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        padding: spacing.xl,
        alignItems: 'center',
        marginTop: spacing.xl,
        marginBottom: spacing.lg,
        width: '100%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
    },
    progressLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: spacing.xs,
    },
    progressCount: {
        fontSize: 48,
        fontWeight: '800',
        color: colors.primary,
    },
    progressText: {
        fontSize: 16,
        fontWeight: '500',
        color: colors.textSecondary,
    },

    // Notify card
    notifyCard: {
        backgroundColor: 'rgba(255,255,255,0.8)',
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        alignItems: 'center',
        marginBottom: spacing.lg,
        width: '100%',
        borderWidth: 1,
        borderColor: colors.borderLight,
    },
    notifyEmoji: {
        fontSize: 32,
        marginBottom: spacing.sm,
    },
    notifyText: {
        fontSize: 16,
        fontWeight: '500',
        color: colors.text,
        textAlign: 'center',
        lineHeight: 22,
    },

    // Compare button
    compareBtn: {
        backgroundColor: '#FF6B9D',
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
        marginTop: spacing.md,
        shadowColor: '#FF6B9D',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    compareBtnText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },

    // Remind button
    remindBtn: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.md,
        width: '100%',
        alignItems: 'center',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    remindBtnText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },

    // View answers button
    viewAnswersBtn: {
        paddingVertical: spacing.md,
        marginBottom: spacing.sm,
    },
    viewAnswersBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.primary,
    },

    // Answers container
    answersContainer: {
        width: '100%',
        marginBottom: spacing.md,
    },
    answerItem: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: spacing.sm,
        alignItems: 'flex-start',
    },
    answerEmoji: {
        fontSize: 24,
        marginRight: spacing.sm,
    },
    answerContent: {
        flex: 1,
    },
    answerQuestion: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 4,
    },
    answerValue: {
        fontSize: 13,
        color: colors.primary,
        fontWeight: '500',
    },

    // Home link
    homeLink: {
        paddingVertical: spacing.sm,
    },
    homeLinkText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
    },
});
