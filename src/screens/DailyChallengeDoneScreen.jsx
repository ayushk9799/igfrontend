import React, { useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import ConfettiCannon from 'react-native-confetti-cannon';
import Svg, { ClipPath, Defs, Path, Rect } from 'react-native-svg';

import { colors, spacing, borderRadius } from '../theme';
import { fontFamily } from '../constants/fonts';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = Math.min(width - 40, 360);
const HEART_PATH = 'M12 21.2C11.4 20.7 10.5 19.9 9.4 18.9C5.2 15.2 2 12.2 2 8.2C2 5.2 4.2 3 7.2 3C9.1 3 10.8 3.9 12 5.3C13.2 3.9 14.9 3 16.8 3C19.8 3 22 5.2 22 8.2C22 12.2 18.8 15.2 14.6 18.9C13.5 19.9 12.6 20.7 12 21.2Z';

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

const PathSvgCheck = () => (
    <Svg width={38} height={38} viewBox="0 0 24 24" fill="none">
        <Path
            d="M5 12.5L9.2 16.7L19 6.8"
            stroke="#FFFFFF"
            strokeWidth={3.1}
            strokeLinecap="round"
            strokeLinejoin="round"
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

const HeartStateIcon = ({ state = 'empty' }) => {
    const leftClipIdRef = useRef(`heartLeft${Math.random().toString(36).slice(2)}`);
    const rightClipIdRef = useRef(`heartRight${Math.random().toString(36).slice(2)}`);
    const leftFill = state === 'empty' ? '#F3EEF2' : '#C91532';
    const rightFill = state === 'full' ? '#C91532' : '#F3EEF2';

    return (
        <Svg width={112} height={112} viewBox="0 0 24 24">
            <Defs>
                <ClipPath id={leftClipIdRef.current}>
                    <Rect x="0" y="0" width="12" height="24" />
                </ClipPath>
                <ClipPath id={rightClipIdRef.current}>
                    <Rect x="12" y="0" width="12" height="24" />
                </ClipPath>
            </Defs>
            <Path d={HEART_PATH} clipPath={`url(#${leftClipIdRef.current})`} fill={leftFill} />
            <Path d={HEART_PATH} clipPath={`url(#${rightClipIdRef.current})`} fill={rightFill} />
            <Path d={HEART_PATH} fill="none" stroke="#FF5D93" strokeWidth={0.9} strokeLinejoin="round" />
        </Svg>
    );
};

export default function DailyChallengeDoneScreen({
    partnerName = 'Your Love',
    isComplete = false,
    showConfetti = false,
    streak = null,
    onBack = () => { },
    onCompareWithPartner = () => { },
    onRemindPartner = () => { },
}) {
    const insets = useSafeAreaInsets();

    // Entrance animation
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const contentMotionStyle = {
        transform: [{ translateY: slideAnim }],
        width: '100%',
        alignItems: 'center',
    };

    const heartState = streak?.heartState || (isComplete ? 'half' : 'empty');
    const currentStreak = streak?.currentStreak || 0;
    const streakDelta = heartState === 'full' ? '+1 gained today' : '+1 waiting';
    const ritualTitle = heartState === 'full' ? 'Full heart locked' : 'Half heart complete';
    const ritualLine = heartState === 'full'
        ? 'You both kept the streak alive.'
        : `Waiting for ${partnerName} to lock the streak.`;

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
                    <View style={styles.checkBadge}>
                        <PathSvgCheck />
                    </View>
                    <Text style={styles.completionTitle}>Daily Ritual Done</Text>

                    <View style={styles.streakHeroCard}>
                        <LinearGradient
                            colors={['#FFFFFF', '#FFF4F8', '#FFE8F1']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.streakHeroGradient}
                        />
                        <View style={styles.gainedPill}>
                            <Text style={styles.gainedPillText}>{streakDelta}</Text>
                        </View>
                        <View style={styles.heroHeartWrap}>
                            <HeartStateIcon state={heartState} />
                        </View>
                        <Text style={styles.streakNumber}>{currentStreak}</Text>
                        <Text style={styles.streakLabel}>DAY STREAK</Text>
                        <Text style={styles.ritualStatusTitle}>{ritualTitle}</Text>
                        <Text style={styles.ritualStatusText}>{ritualLine}</Text>
                    </View>

                    {/* Dynamic Action Button */}
                    {heartState === 'full' ? (
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
    checkBadge: {
        width: 76,
        height: 76,
        borderRadius: 38,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: spacing.sm,
        marginBottom: spacing.sm,
        backgroundColor: '#FF5D93',
        shadowColor: '#FF5D93',
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.22,
        shadowRadius: 24,
        elevation: 9,
    },
    completionTitle: {
        fontFamily: fontFamily.extraBold,
        fontSize: width < 380 ? 30 : 35,
        fontWeight: '800',
        color: '#1F1749',
        marginTop: spacing.xs,
        marginBottom: spacing.md,
        textAlign: 'center',
        letterSpacing: 0,
    },
    streakHeroCard: {
        width: CARD_WIDTH,
        minHeight: 330,
        borderRadius: 32,
        overflow: 'hidden',
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.xl,
        alignItems: 'center',
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.9)',
        backgroundColor: 'rgba(255,255,255,0.92)',
        shadowColor: '#F68AB0',
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.18,
        shadowRadius: 30,
        elevation: 10,
    },
    streakHeroGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    gainedPill: {
        alignSelf: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: 7,
        borderRadius: borderRadius.full,
        backgroundColor: '#FF5D93',
        marginBottom: spacing.md,
        shadowColor: '#FF5D93',
        shadowOffset: { width: 0, height: 7 },
        shadowOpacity: 0.18,
        shadowRadius: 14,
        elevation: 5,
    },
    gainedPillText: {
        fontFamily: fontFamily.extraBold,
        fontSize: 13,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    heroHeartWrap: {
        width: 118,
        height: 118,
        borderRadius: 59,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 93, 147, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255, 93, 147, 0.28)',
        marginBottom: spacing.sm,
    },
    streakNumber: {
        fontFamily: fontFamily.extraBold,
        fontSize: width < 380 ? 82 : 96,
        lineHeight: width < 380 ? 88 : 102,
        fontWeight: '800',
        color: '#1F1749',
        letterSpacing: 0,
        textAlign: 'center',
    },
    streakLabel: {
        fontFamily: fontFamily.extraBold,
        fontSize: 18,
        fontWeight: '800',
        color: '#FF5D93',
        letterSpacing: 0,
        marginTop: -spacing.xs,
        marginBottom: spacing.md,
        textAlign: 'center',
    },
    ritualStatusTitle: {
        fontFamily: fontFamily.extraBold,
        fontSize: 19,
        fontWeight: '800',
        color: '#1F1749',
        lineHeight: 24,
        textAlign: 'center',
    },
    ritualStatusText: {
        fontFamily: fontFamily.medium,
        fontSize: 14.5,
        fontWeight: '700',
        color: '#7D739E',
        lineHeight: 20,
        marginTop: 5,
        textAlign: 'center',
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
