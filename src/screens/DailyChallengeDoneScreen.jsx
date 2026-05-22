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
import Svg, { Path } from 'react-native-svg';

import { colors, spacing, borderRadius, shadows } from '../theme';
import { fontFamily } from '../constants/fonts';

const { width, height } = Dimensions.get('window');

// Sparkle star component
const Sparkle = ({ x, y, size = 8, delay = 0 }) => {
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animate = Animated.loop(
            Animated.sequence([
                Animated.delay(delay),
                Animated.timing(opacity, {
                    toValue: 0.8,
                    duration: 1200,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 0.1,
                    duration: 1200,
                    useNativeDriver: true,
                }),
                Animated.delay(800),
            ]),
        );
        animate.start();
        return () => animate.stop();
    }, [opacity, delay]);

    return (
        <Animated.View style={{ position: 'absolute', left: x, top: y, opacity }}>
            <Svg width={size} height={size} viewBox="0 0 24 24">
                <Path
                    d="M12 0L14.59 8.41L24 12L14.59 15.59L12 24L9.41 15.59L0 12L9.41 8.41L12 0Z"
                    fill="rgba(255,255,255,0.9)"
                />
            </Svg>
        </Animated.View>
    );
};

// Floating heart
const FloatingHeart = ({ x, y, size = 16, delay = 0 }) => {
    const translateY = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animate = () => {
            translateY.setValue(0);
            opacity.setValue(0);
            Animated.sequence([
                Animated.delay(delay),
                Animated.parallel([
                    Animated.timing(translateY, {
                        toValue: -60,
                        duration: 3500,
                        useNativeDriver: true,
                    }),
                    Animated.sequence([
                        Animated.timing(opacity, {
                            toValue: 0.7,
                            duration: 600,
                            useNativeDriver: true,
                        }),
                        Animated.timing(opacity, {
                            toValue: 0.7,
                            duration: 1800,
                            useNativeDriver: true,
                        }),
                        Animated.timing(opacity, {
                            toValue: 0,
                            duration: 1100,
                            useNativeDriver: true,
                        }),
                    ]),
                ]),
            ]).start(() => animate());
        };
        animate();
        return () => {
            translateY.stopAnimation();
            opacity.stopAnimation();
        };
    }, [delay, translateY, opacity]);

    return (
        <Animated.View style={{ position: 'absolute', left: x, top: y, opacity, transform: [{ translateY }] }}>
            <Svg width={size} height={size} viewBox="0 0 24 24">
                <Path
                    fill="#FF8FAB"
                    d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                />
            </Svg>
        </Animated.View>
    );
};

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
                colors={['#F8D9EC', '#FFF7FA', '#FFF4F7', '#F7D8F2']}
                locations={[0, 0.34, 0.72, 1]}
                start={{ x: 0.25, y: 0 }}
                end={{ x: 0.75, y: 1 }}
                style={StyleSheet.absoluteFill}
            />

            {/* Sparkles and Hearts */}
            <Sparkle x={width * 0.1} y={height * 0.05} size={7} delay={0} />
            <Sparkle x={width * 0.74} y={height * 0.06} size={8} delay={600} />
            <Sparkle x={width * 0.92} y={height * 0.15} size={11} delay={1000} />
            <Sparkle x={width * 0.18} y={height * 0.42} size={7} delay={1400} />
            <Sparkle x={width * 0.8} y={height * 0.52} size={7} delay={400} />
            <Sparkle x={width * 0.12} y={height * 0.86} size={6} delay={900} />
            <FloatingHeart x={width * 0.77} y={height * 0.55} size={20} delay={600} />

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

                    {/* Dynamic Action Button */}
                    {isComplete ? (
                        <TouchableOpacity style={styles.compareBtn} onPress={onCompareWithPartner}>
                            <Text style={styles.compareBtnText}>Compare Answers with {partnerName}</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity style={styles.remindBtn} onPress={onRemindPartner}>
                            <Text style={styles.remindBtnText}>Remind {partnerName} to Play</Text>
                        </TouchableOpacity>
                    )}

                    {/* View My Answers Toggle */}
                    <TouchableOpacity style={styles.viewAnswersBtn} onPress={() => setShowAnswers(!showAnswers)}>
                        <Text style={styles.viewAnswersBtnText}>
                            {showAnswers ? 'Hide My Answers' : 'View My Answers'}
                        </Text>
                    </TouchableOpacity>

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
        fontFamily: fontFamily.extraBold,
        fontSize: 28,
        fontWeight: '800',
        color: colors.text,
        marginTop: spacing.md,
    },
    completionSubtitle: {
        fontFamily: fontFamily.medium,
        fontSize: 16,
        color: colors.textSecondary,
        marginTop: spacing.xs,
        marginBottom: spacing.lg,
        textAlign: 'center',
    },

    // Progress card
    progressCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        borderRadius: borderRadius.xl,
        padding: spacing.xl,
        alignItems: 'center',
        marginTop: spacing.xl,
        marginBottom: spacing.lg,
        width: '100%',
        borderWidth: 1,
        borderColor: 'rgba(250, 232, 255, 0.8)',
        ...shadows.lg,
    },
    progressLabel: {
        fontFamily: fontFamily.bold,
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: spacing.xs,
    },
    progressCount: {
        fontFamily: fontFamily.extraBold,
        fontSize: 48,
        fontWeight: '800',
        color: colors.primary,
    },
    progressText: {
        fontFamily: fontFamily.medium,
        fontSize: 16,
        fontWeight: '500',
        color: colors.textSecondary,
    },

    // Notify card
    notifyCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        alignItems: 'center',
        marginBottom: spacing.lg,
        width: '100%',
        borderWidth: 1,
        borderColor: 'rgba(250, 232, 255, 0.8)',
        ...shadows.md,
    },
    notifyEmoji: {
        fontSize: 32,
        marginBottom: spacing.sm,
    },
    notifyText: {
        fontFamily: fontFamily.medium,
        fontSize: 16,
        fontWeight: '500',
        color: colors.text,
        textAlign: 'center',
        lineHeight: 22,
    },

    // Compare button
    compareBtn: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.full,
        marginTop: spacing.md,
        marginBottom: spacing.md,
        width: '100%',
        minHeight: 48,
        alignItems: 'center',
        justifyContent: 'center',
        ...shadows.glow,
    },
    compareBtnText: {
        fontFamily: fontFamily.bold,
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },

    // Remind button
    remindBtn: {
        backgroundColor: colors.primary,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.full,
        marginBottom: spacing.md,
        width: '100%',
        minHeight: 48,
        alignItems: 'center',
        justifyContent: 'center',
        ...shadows.glow,
    },
    remindBtnText: {
        fontFamily: fontFamily.bold,
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
        fontFamily: fontFamily.bold,
        fontSize: 14,
        fontWeight: '700',
        color: colors.primary,
    },

    // Answers container
    answersContainer: {
        width: '100%',
        marginBottom: spacing.md,
    },
    answerItem: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        padding: spacing.md,
        borderRadius: borderRadius.md,
        marginBottom: spacing.sm,
        alignItems: 'flex-start',
        borderWidth: 1,
        borderColor: 'rgba(250, 232, 255, 0.8)',
        ...shadows.sm,
    },
    answerEmoji: {
        fontSize: 24,
        marginRight: spacing.sm,
    },
    answerContent: {
        flex: 1,
    },
    answerQuestion: {
        fontFamily: fontFamily.bold,
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
        marginBottom: 4,
    },
    answerValue: {
        fontFamily: fontFamily.medium,
        fontSize: 13,
        color: colors.primary,
        fontWeight: '500',
    },

    // Home link
    homeLink: {
        paddingVertical: spacing.md,
        marginTop: spacing.sm,
    },
    homeLinkText: {
        fontFamily: fontFamily.bold,
        fontSize: 15,
        fontWeight: '700',
        color: colors.textSecondary,
    },
});
