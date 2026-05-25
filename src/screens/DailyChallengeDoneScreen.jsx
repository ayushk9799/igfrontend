import React, { useRef, useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    Animated,
    Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import ConfettiCannon from 'react-native-confetti-cannon';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors, spacing, borderRadius, shadows } from '../theme';
import { fontFamily } from '../constants/fonts';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = Math.min(width - 40, 360);
const HERO_WIDTH = Math.min(width * 0.66, 270);
const progressRingSize = 92;
const progressRingStroke = 9;
const progressRingRadius = (progressRingSize - progressRingStroke) / 2;
const progressRingCircumference = 2 * Math.PI * progressRingRadius;

const completionAssets = {
    hero: require('../../assets/daily-done/completion-hero.png'),
    penguinLeft: require('../../assets/daily-done/penguin-left.png'),
    penguinRight: require('../../assets/daily-done/penguin-right.png'),
};

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

    const sparkleStyle = { position: 'absolute', left: x, top: y, opacity };

    return (
        <Animated.View style={sparkleStyle}>
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

    const heartStyle = { position: 'absolute', left: x, top: y, opacity, transform: [{ translateY }] };

    return (
        <Animated.View style={heartStyle}>
            <Svg width={size} height={size} viewBox="0 0 24 24">
                <Path
                    fill="#FF8FAB"
                    d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                />
            </Svg>
        </Animated.View>
    );
};

const BellIcon = ({ color = '#FFFFFF', size = 22 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
            d="M18 8.5A6 6 0 0 0 6 8.5c0 7-3 7.5-3 9.5h18c0-2-3-2.5-3-9.5Z"
            fill={color}
        />
        <Path
            d="M9.25 20a3 3 0 0 0 5.5 0"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
        />
    </Svg>
);

const BookIcon = ({ color = '#FF6F9F', size = 22 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
            d="M4.5 5.5c0-1.1.9-2 2-2H10c1.1 0 2 .9 2 2v15c0-1.1-.9-2-2-2H6.5c-1.1 0-2 .9-2 2v-15Z"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
        />
        <Path
            d="M19.5 5.5c0-1.1-.9-2-2-2H14c-1.1 0-2 .9-2 2v15c0-1.1.9-2 2-2h3.5c1.1 0 2 .9 2 2v-15Z"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
        />
    </Svg>
);

const ProgressRing = ({ answeredCount, totalCount }) => {
    const progress = totalCount > 0 ? Math.min(answeredCount / totalCount, 1) : 0;
    const strokeDashoffset = progressRingCircumference * (1 - progress);

    return (
        <View style={styles.progressRingWrap}>
            <Svg width={progressRingSize} height={progressRingSize} viewBox={`0 0 ${progressRingSize} ${progressRingSize}`}>
                <Circle
                    cx={progressRingSize / 2}
                    cy={progressRingSize / 2}
                    r={progressRingRadius}
                    stroke="#FFE0EA"
                    strokeWidth={progressRingStroke}
                    fill="rgba(255,255,255,0.72)"
                />
                <Circle
                    cx={progressRingSize / 2}
                    cy={progressRingSize / 2}
                    r={progressRingRadius}
                    stroke="#FF7AA6"
                    strokeWidth={progressRingStroke}
                    strokeDasharray={`${progressRingCircumference} ${progressRingCircumference}`}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    fill="transparent"
                    rotation="-90"
                    originX={progressRingSize / 2}
                    originY={progressRingSize / 2}
                />
            </Svg>
            <Text style={styles.progressRingText}>{answeredCount}/{totalCount}</Text>
        </View>
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
    const contentMotionStyle = {
        transform: [{ translateY: slideAnim }],
        width: '100%',
        alignItems: 'center',
    };

    // Calculate answered count
    const answeredCount = userAnswers.filter(a => a !== undefined && a !== null).length;
    const totalCount = Math.max(tasks.length || 6, answeredCount);

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
    }, [fadeAnim, slideAnim]);

    return (
        <View style={styles.completionWrapper}>
            {/* Gradient Background */}
            <LinearGradient
                colors={['#FFD5E8', '#FFF6FB', '#FFF8FB', '#FFDCEC']}
                locations={[0, 0.28, 0.7, 1]}
                start={{ x: 0.25, y: 0 }}
                end={{ x: 0.75, y: 1 }}
                style={StyleSheet.absoluteFill}
            />
            <View style={styles.topGlow} />
            <View style={styles.midHill} />
            <View style={styles.bottomHill} />
            <View style={[styles.plant, styles.plantLeft]}>
                <Text style={styles.plantText}>❦</Text>
            </View>
            <View style={[styles.plant, styles.plantRight]}>
                <Text style={styles.plantText}>❦</Text>
            </View>

            {/* Sparkles and Hearts */}
            <Sparkle x={width * 0.12} y={height * 0.12} size={14} delay={0} />
            <Sparkle x={width * 0.28} y={height * 0.1} size={18} delay={600} />
            <Sparkle x={width * 0.74} y={height * 0.08} size={11} delay={1000} />
            <Sparkle x={width * 0.88} y={height * 0.18} size={16} delay={1400} />
            <Sparkle x={width * 0.18} y={height * 0.4} size={8} delay={400} />
            <Sparkle x={width * 0.12} y={height * 0.86} size={6} delay={900} />
            <FloatingHeart x={width * 0.2} y={height * 0.22} size={18} delay={300} />
            <FloatingHeart x={width * 0.8} y={height * 0.48} size={20} delay={600} />
            <FloatingHeart x={width * 0.9} y={height * 0.84} size={18} delay={1000} />

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
                    { paddingTop: Math.max(insets.top - spacing.xl, 0) }
                ]}
                showsVerticalScrollIndicator={false}
            >
                <Animated.View style={contentMotionStyle}>
                    <Image
                        source={completionAssets.hero}
                        style={styles.heroImage}
                        resizeMode="contain"
                    />
                    <Text style={styles.completionTitle}>Daily Challenge Done!</Text>
                    <Text style={styles.completionSubtitle}>
                        You've completed today's challenge.{'\n'}Come back tomorrow for more!
                    </Text>

                    {/* Progress indicator */}
                    <View style={styles.progressCard}>
                        <ProgressRing answeredCount={answeredCount} totalCount={totalCount} />
                        <View style={styles.progressCopy}>
                            <Text style={styles.progressLabel}>Today's Progress</Text>
                            <Text style={styles.progressText}>questions answered</Text>
                        </View>
                        <Image
                            source={completionAssets.penguinRight}
                            style={styles.progressPenguin}
                            resizeMode="contain"
                        />
                    </View>

                    {/* Notify partner message */}
                    {!isComplete && (
                        <View style={styles.notifyCard}>
                            <Image
                                source={completionAssets.penguinLeft}
                                style={styles.notifyPenguin}
                                resizeMode="contain"
                            />
                            <Text style={styles.notifyText}>
                                Waiting for <Text style={styles.notifyName}>{partnerName}</Text>{'\n'}to complete their challenge
                            </Text>
                            <Text style={styles.notifyHeart}>♥</Text>
                        </View>
                    )}

                    {/* Dynamic Action Button */}
                    {isComplete ? (
                        <TouchableOpacity style={styles.compareBtn} onPress={onCompareWithPartner}>
                            <BookIcon color="#FFFFFF" size={23} />
                            <Text style={styles.compareBtnText}>Chat about today with {partnerName}</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity style={styles.remindBtn} onPress={onRemindPartner}>
                            <BellIcon color="#FFFFFF" size={23} />
                            <Text style={styles.remindBtnText}>Remind {partnerName} to Play</Text>
                        </TouchableOpacity>
                    )}

                    {/* View My Answers Toggle */}
                    <TouchableOpacity style={styles.viewAnswersBtn} onPress={() => setShowAnswers(!showAnswers)}>
                        <BookIcon color="#FF6F9F" size={23} />
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
        overflow: 'hidden',
    },
    completionContainer: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: spacing.lg,
        alignItems: 'center',
        paddingBottom: spacing.xl,
    },
    topGlow: {
        position: 'absolute',
        top: -70,
        alignSelf: 'center',
        width: width * 0.82,
        height: width * 0.82,
        borderRadius: width,
        backgroundColor: 'rgba(255, 255, 255, 0.46)',
    },
    midHill: {
        position: 'absolute',
        top: height * 0.28,
        left: -width * 0.12,
        width: width * 1.24,
        height: 150,
        borderTopLeftRadius: width,
        borderTopRightRadius: width,
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
    },
    bottomHill: {
        position: 'absolute',
        bottom: -72,
        left: -width * 0.18,
        width: width * 1.36,
        height: 170,
        borderTopLeftRadius: width,
        borderTopRightRadius: width,
        backgroundColor: 'rgba(255, 255, 255, 0.62)',
    },
    plant: {
        position: 'absolute',
        opacity: 0.38,
    },
    plantLeft: {
        left: 16,
        bottom: 82,
        transform: [{ rotate: '-18deg' }],
    },
    plantRight: {
        right: 16,
        bottom: 88,
        transform: [{ rotate: '18deg' }],
    },
    plantText: {
        fontSize: 56,
        color: '#FF9EBD',
    },
    heroImage: {
        width: HERO_WIDTH,
        height: HERO_WIDTH * 1.03,
        marginTop: -spacing.lg,
        marginBottom: -spacing.lg,
    },
    completionTitle: {
        fontFamily: fontFamily.extraBold,
        fontSize: width < 380 ? 28 : 32,
        fontWeight: '800',
        color: '#1F1749',
        marginTop: 0,
        textAlign: 'center',
        letterSpacing: 0,
    },
    completionSubtitle: {
        fontFamily: fontFamily.medium,
        fontSize: 15.5,
        color: '#7D739E',
        marginTop: spacing.xs,
        marginBottom: spacing.sm,
        textAlign: 'center',
        lineHeight: 22,
    },

    // Progress card
    progressCard: {
        width: CARD_WIDTH,
        minHeight: 108,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: 28,
        paddingVertical: spacing.sm,
        paddingLeft: spacing.lg,
        paddingRight: 92,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.78)',
        shadowColor: '#F68AB0',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.15,
        shadowRadius: 28,
        elevation: 8,
    },
    progressRingWrap: {
        width: progressRingSize,
        height: progressRingSize,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.lg,
    },
    progressRingText: {
        position: 'absolute',
        fontFamily: fontFamily.extraBold,
        fontSize: 30,
        fontWeight: '800',
        color: '#FF5D93',
    },
    progressCopy: {
        flex: 1,
        minWidth: 0,
    },
    progressLabel: {
        fontFamily: fontFamily.extraBold,
        fontSize: 17,
        fontWeight: '800',
        color: '#1F1749',
        marginBottom: spacing.xs,
    },
    progressText: {
        fontFamily: fontFamily.medium,
        fontSize: 14.5,
        fontWeight: '600',
        color: '#7D739E',
        lineHeight: 19,
    },
    progressPenguin: {
        position: 'absolute',
        right: 14,
        bottom: 12,
        width: 76,
        height: 96,
    },

    // Notify card
    notifyCard: {
        width: CARD_WIDTH,
        minHeight: 68,
        backgroundColor: 'rgba(255, 255, 255, 0.88)',
        borderRadius: 24,
        paddingVertical: spacing.sm,
        paddingLeft: spacing.md,
        paddingRight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.76)',
        ...shadows.sm,
    },
    notifyPenguin: {
        width: 70,
        height: 70,
        marginRight: spacing.md,
    },
    notifyText: {
        flex: 1,
        minWidth: 0,
        fontFamily: fontFamily.bold,
        fontSize: 15,
        fontWeight: '700',
        color: '#746A95',
        lineHeight: 22,
    },
    notifyName: {
        color: '#FF6F9F',
        fontFamily: fontFamily.extraBold,
    },
    notifyHeart: {
        position: 'absolute',
        right: 20,
        top: 22,
        fontSize: 24,
        color: '#FF8EAE',
    },

    // Compare button
    compareBtn: {
        flexDirection: 'row',
        gap: spacing.md,
        backgroundColor: '#FF6F9F',
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.full,
        marginBottom: spacing.md,
        width: CARD_WIDTH,
        minHeight: 52,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#FF5B91',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.32,
        shadowRadius: 22,
        elevation: 9,
    },
    compareBtnText: {
        fontFamily: fontFamily.bold,
        fontSize: 16.5,
        fontWeight: '800',
        color: '#fff',
        flexShrink: 1,
        textAlign: 'center',
    },

    // Remind button
    remindBtn: {
        flexDirection: 'row',
        gap: spacing.md,
        backgroundColor: '#FF6F9F',
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.full,
        marginBottom: spacing.md,
        width: CARD_WIDTH,
        minHeight: 52,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#FF5B91',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.32,
        shadowRadius: 22,
        elevation: 9,
    },
    remindBtnText: {
        fontFamily: fontFamily.bold,
        fontSize: 16.5,
        fontWeight: '800',
        color: '#fff',
        flexShrink: 1,
        textAlign: 'center',
    },

    // View answers button
    viewAnswersBtn: {
        width: CARD_WIDTH,
        minHeight: 48,
        borderRadius: borderRadius.full,
        borderWidth: 1.5,
        borderColor: '#FFB2CB',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.xl,
        marginBottom: spacing.md,
        backgroundColor: 'rgba(255,255,255,0.46)',
    },
    viewAnswersBtnText: {
        fontFamily: fontFamily.bold,
        fontSize: 16,
        fontWeight: '800',
        color: '#FF6F9F',
        flexShrink: 1,
        textAlign: 'center',
    },

    // Answers container
    answersContainer: {
        width: CARD_WIDTH,
        marginBottom: spacing.md,
    },
    answerItem: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.88)',
        padding: spacing.md,
        borderRadius: 18,
        marginBottom: spacing.sm,
        alignItems: 'flex-start',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.76)',
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
    footerPenguins: {
        width: Math.min(width * 0.38, 165),
        height: Math.min(width * 0.23, 104),
        marginTop: -spacing.sm,
        marginBottom: 0,
    },

    // Home link
    homeLink: {
        paddingVertical: spacing.sm,
    },
    homeLinkText: {
        fontFamily: fontFamily.bold,
        fontSize: 15,
        fontWeight: '700',
        color: colors.textSecondary,
    },
});
