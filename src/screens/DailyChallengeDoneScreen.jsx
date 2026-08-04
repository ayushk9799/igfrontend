import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    Easing,
    Image,
    Platform,
    ScrollView,
    StyleSheet,
    StatusBar,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import ConfettiCannon from 'react-native-confetti-cannon';
import Svg, {
    ClipPath,
    Defs,
    G,
    LinearGradient as SvgLinearGradient,
    Path,
    RadialGradient,
    Rect,
    Stop,
    Use,
} from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { createSafeAudioPlayer } from '../utils/safeAudioPlayer';

import { borderRadius, spacing } from '../theme';
import { fontFamily } from '../constants/fonts';
import WeeklyStreakStrip from '../components/WeeklyStreakStrip';
import FlameStreakAnimation from '../components/FlameStreakAnimation';
import { translateUiTemplate, translateUiText } from '../i18n/uiTranslation';

const { width } = Dimensions.get('window');
const BUTTON_WIDTH = Math.min(width - 40, 340);
const HEART_PATH = 'M12 21.2C11.4 20.7 10.5 19.9 9.4 18.9C5.2 15.2 2 12.2 2 8.2C2 5.2 4.2 3 7.2 3C9.1 3 10.8 3.9 12 5.3C13.2 3.9 14.9 3 16.8 3C19.8 3 22 5.2 22 8.2C22 12.2 18.8 15.2 14.6 18.9C13.5 19.9 12.6 20.7 12 21.2Z';
const STATUS_TONES = {
    complete: {
        accent: '#D62F68',
        background: '#FFF0F5',
        border: '#F8B8CC',
        text: '#A8174B',
    },
    pending: {
        accent: '#C47A12',
        background: '#FFF8E9',
        border: '#F0D39A',
        text: '#875006',
    },
    active: {
        accent: '#8A4AC2',
        background: '#F8F0FF',
        border: '#DCC1F2',
        text: '#653092',
    },
    reset: {
        accent: '#80758C',
        background: '#F5F1F6',
        border: '#D9D0DC',
        text: '#5E5366',
    },
};

const triggerSuccessHaptic = () => {
    try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {}
    try {
        ReactNativeHapticFeedback.trigger('notificationSuccess', {
            enableVibrateFallback: true,
            ignoreAndroidSystemSettings: false,
        });
    } catch (e) {}
};

const triggerImpactHaptic = () => {
    try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch (e) {}
    try {
        ReactNativeHapticFeedback.trigger('impactMedium', {
            enableVibrateFallback: true,
            ignoreAndroidSystemSettings: false,
        });
    } catch (e) {}
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

const HeartStateIcon = ({
    youComplete = false,
    partnerComplete = false,
    size = 180,
    yourColor = '#C91532',
    partnerColor = '#C91532',
    unfilledColor = '#E9E5EC',
}) => {
    const idSuffix = useRef(Math.random().toString(36).slice(2)).current;
    const heartId = `heart-${idSuffix}`;
    const leftId = `heart-left-${idSuffix}`;
    const rightId = `heart-right-${idSuffix}`;
    const shapeId = `heart-shape-${idSuffix}`;
    const surfaceId = `heart-surface-${idSuffix}`;
    const highlightId = `heart-highlight-${idSuffix}`;
    const leftFill = youComplete ? yourColor : unfilledColor;
    const rightFill = partnerComplete ? partnerColor : unfilledColor;

    return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
            <Defs>
                <Path id={heartId} d={HEART_PATH} />
                <ClipPath id={shapeId}>
                    <Use href={`#${heartId}`} />
                </ClipPath>
                <ClipPath id={leftId}>
                    <Rect x="0" y="0" width="12" height="24" />
                </ClipPath>
                <ClipPath id={rightId}>
                    <Rect x="12" y="0" width="12" height="24" />
                </ClipPath>
                <SvgLinearGradient id={surfaceId} x1="0" y1="0" x2="0.72" y2="1">
                    <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.3} />
                    <Stop offset="0.42" stopColor="#FFFFFF" stopOpacity={0.06} />
                    <Stop offset="0.7" stopColor="#2B1024" stopOpacity={0.02} />
                    <Stop offset="1" stopColor="#1B0713" stopOpacity={0.24} />
                </SvgLinearGradient>
                <RadialGradient
                    id={highlightId}
                    cx="0.34"
                    cy="0.29"
                    rx="0.68"
                    ry="0.62"
                    fx="0.3"
                    fy="0.24"
                >
                    <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.3} />
                    <Stop offset="0.46" stopColor="#FFFFFF" stopOpacity={0.08} />
                    <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
                </RadialGradient>
            </Defs>

            <Use
                href={`#${heartId}`}
                transform="translate(0 0.6)"
                fill="#351126"
                opacity={0.14}
            />

            <Use
                href={`#${heartId}`}
                clipPath={`url(#${leftId})`}
                fill={leftFill}
            />
            <Use
                href={`#${heartId}`}
                clipPath={`url(#${rightId})`}
                fill={rightFill}
            />

            <G clipPath={`url(#${shapeId})`}>
                <Rect x="1" y="2" width="22" height="20" fill={`url(#${surfaceId})`} />
                <Rect x="1" y="2" width="22" height="20" fill={`url(#${highlightId})`} />
                <Path d="M12 5.35V20.92" stroke="#FFFFFF" strokeWidth={0.12} opacity={0.13} />
            </G>

            <Use
                href={`#${heartId}`}
                fill="none"
                stroke="#2A0B1E"
                strokeOpacity={0.1}
                strokeWidth={0.28}
                strokeLinejoin="round"
            />
        </Svg>
    );
};

export default function DailyChallengeDoneScreen({
    partnerName = 'Your Love',
    isComplete = false,
    hasCompletedMyPart = isComplete,
    showConfetti = false,
    streak = null,
    onBack = () => {},
    onCompareWithPartner = () => {},
    onRemindPartner = () => {},
}) {
    const insets = useSafeAreaInsets();
    const audioPlayerRef = useRef(null);
    const [isActionPending, setIsActionPending] = useState(false);
    const streakGainOpacity = useRef(new Animated.Value(0)).current;
    const streakGainScale = useRef(new Animated.Value(0.65)).current;
    const streakGainTranslateY = useRef(new Animated.Value(12)).current;
    const hasPlayedStreakGain = useRef(false);

    // Continuous flame breathing animation (small to big scale pulse)
    const flamePulse = useRef(new Animated.Value(0.92)).current;

    const youComplete = Boolean(hasCompletedMyPart || streak?.youComplete);
    const partnerComplete = Boolean(streak?.partnerComplete);
    const isFullHeart = youComplete && partnerComplete;
    const currentStreak = Number(streak?.currentStreak) || 0;

    // Determine streak status copy and restrained semantic colors.
    let statusBadgeText = '';
    let statusSubtext = '';
    let statusTone = STATUS_TONES.complete;

    if (isFullHeart) {
        statusBadgeText = 'STREAK GAINED';
        statusSubtext = `You and ${partnerName} completed today’s ritual.`;
        statusTone = STATUS_TONES.complete;
    } else if (youComplete && !partnerComplete) {
        statusBadgeText = 'STREAK PENDING';
        statusSubtext = `${partnerName} still needs to complete today’s ritual.`;
        statusTone = STATUS_TONES.pending;
    } else if (currentStreak > 0) {
        statusBadgeText = 'STREAK ACTIVE';
        statusSubtext = `${currentStreak} day${currentStreak > 1 ? 's' : ''} of shared daily love.`;
        statusTone = STATUS_TONES.active;
    } else {
        statusBadgeText = 'START A NEW STREAK';
        statusSubtext = `Complete today with ${partnerName} to ignite a new flame.`;
        statusTone = STATUS_TONES.reset;
    }

    // Play result sound and trigger haptics on entrance
    useEffect(() => {
        triggerSuccessHaptic();

        const player = createSafeAudioPlayer();
        audioPlayerRef.current = player;

        const playSound = async () => {
            try {
                const soundAsset = require('../../assets/sounds/completion-whoosh.mp3');
                const soundUri = Image.resolveAssetSource(soundAsset).uri;
                if (soundUri && audioPlayerRef.current) {
                    await player.stopPlayer().catch(() => {});
                    await player.startPlayer(soundUri);
                    await player.setVolume(0.32);
                }
            } catch (e) {
                // Ignore sound errors
            }
        };

        playSound();

        return () => {
            if (audioPlayerRef.current) {
                audioPlayerRef.current.stopPlayer().catch(() => {});
            }
        };
    }, []);

    useEffect(() => {
        // Keep motion isolated to the decorative flame.
        const flameBreathing = Animated.loop(
            Animated.sequence([
                Animated.timing(flamePulse, {
                    toValue: 1.10,
                    duration: 1500,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(flamePulse, {
                    toValue: 0.92,
                    duration: 1500,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        );

        flameBreathing.start();

        return () => {
            flameBreathing.stop();
        };
    }, [flamePulse]);

    useEffect(() => {
        if (!isFullHeart) {
            hasPlayedStreakGain.current = false;
            return undefined;
        }
        if (hasPlayedStreakGain.current) return undefined;
        hasPlayedStreakGain.current = true;

        streakGainOpacity.setValue(0);
        streakGainScale.setValue(0.65);
        streakGainTranslateY.setValue(12);

        const streakGainAnimation = Animated.sequence([
            Animated.delay(180),
            Animated.parallel([
                Animated.timing(streakGainOpacity, {
                    toValue: 1,
                    duration: 180,
                    useNativeDriver: true,
                }),
                Animated.spring(streakGainScale, {
                    toValue: 1,
                    friction: 5,
                    tension: 110,
                    useNativeDriver: true,
                }),
                Animated.timing(streakGainTranslateY, {
                    toValue: -8,
                    duration: 420,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
            ]),
            Animated.delay(520),
            Animated.parallel([
                Animated.timing(streakGainOpacity, {
                    toValue: 0,
                    duration: 220,
                    useNativeDriver: true,
                }),
                Animated.timing(streakGainScale, {
                    toValue: 0.92,
                    duration: 220,
                    useNativeDriver: true,
                }),
                Animated.timing(streakGainTranslateY, {
                    toValue: -28,
                    duration: 220,
                    easing: Easing.in(Easing.cubic),
                    useNativeDriver: true,
                }),
            ]),
        ]);

        streakGainAnimation.start();
        return () => streakGainAnimation.stop();
    }, [
        isFullHeart,
        streakGainOpacity,
        streakGainScale,
        streakGainTranslateY,
    ]);

    const androidStatusBarHeight = StatusBar.currentHeight || 0;
    const fadeOverlayHeight = Platform.OS === 'android'
        ? Math.max(insets.top, androidStatusBarHeight) + 40
        : Math.max(insets.top + 28, 64);

    const handlePrimaryPress = async () => {
        if (isActionPending) return;

        triggerImpactHaptic();
        if (isFullHeart) {
            onCompareWithPartner();
        } else {
            setIsActionPending(true);
            try {
                await Promise.resolve(onRemindPartner());
            } finally {
                setIsActionPending(false);
            }
        }
    };

    const handleBackPress = () => {
        triggerImpactHaptic();
        onBack();
    };

    return (
        <LinearGradient
            colors={['#FFEBF2', '#FFF5F8', '#FFEEF4', '#FCD5E7']}
            locations={[0, 0.35, 0.7, 1]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={styles.screen}
        >
            <StatusBar
                barStyle="dark-content"
                translucent
                backgroundColor="transparent"
            />
            <LinearGradient
                colors={[
                    '#FFEBF2',
                    'rgba(255, 235, 242, 0.88)',
                    'rgba(255, 235, 242, 0.3)',
                    'rgba(255, 235, 242, 0)',
                ]}
                locations={[0, 0.4, 0.75, 1]}
                style={[styles.topFadeGradient, { height: fadeOverlayHeight }]}
                pointerEvents="none"
            />

            {showConfetti && isFullHeart && (
                <ConfettiCannon
                    count={100}
                    origin={{ x: width / 2, y: -20 }}
                    fadeOut
                    explosionSpeed={300}
                    fallSpeed={2200}
                />
            )}

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                    styles.content,
                    { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xl },
                ]}
            >
                <View style={styles.inner}>
                    {/* TOP LEFT PENGUIN LOGO HEADER */}
                    <View style={styles.topHeaderBar}>
                        <Image
                            source={require('../../assets/images/penguin-text-logo.png')}
                            style={styles.penguinLogo}
                            resizeMode="contain"
                            accessible
                            accessibilityLabel="Penguin"
                        />
                    </View>

                    {/* HERO FLAME SECTION */}
                    <View style={styles.flameHeroContainer}>
                        <Animated.View style={[
                            styles.flameWrapper,
                            { transform: [{ scale: flamePulse }] },
                        ]}>
                            <FlameStreakAnimation
                                width={210}
                                height={210}
                                fallback={(
                                    <HeartStateIcon
                                        youComplete={youComplete}
                                        partnerComplete={partnerComplete}
                                        size={180}
                                    />
                                )}
                            />
                        </Animated.View>
                    </View>

                    {/* STREAK DISPLAY SECTION */}
                    <View style={styles.streakHeroSection}>
                        {/* Big Stylized Streak Number */}
                        <View style={styles.streakNumberContainer}>
                            <Text
                                style={styles.streakNumber}
                                adjustsFontSizeToFit
                                numberOfLines={1}
                                minimumFontScale={0.8}
                            >
                                {currentStreak}
                            </Text>
                            <View style={styles.streakUnitBadge}>
                                <Text style={styles.streakUnitMain}>DAY</Text>
                                <Text style={styles.streakUnitSub}>STREAK</Text>
                            </View>
                            {isFullHeart && (
                                <Animated.View
                                    pointerEvents="none"
                                    style={[
                                        styles.streakGainBurst,
                                        {
                                            opacity: streakGainOpacity,
                                            transform: [
                                                { translateY: streakGainTranslateY },
                                                { scale: streakGainScale },
                                            ],
                                        },
                                    ]}
                                >
                                    <Text style={styles.streakGainText}>+1</Text>
                                </Animated.View>
                            )}
                        </View>

                        {/* Calm semantic status pill */}
                        <View
                            style={[
                                styles.statusPillContainer,
                                {
                                    backgroundColor: statusTone.background,
                                    borderColor: statusTone.border,
                                },
                            ]}
                        >
                            <View
                                style={[
                                    styles.statusPillDot,
                                    { backgroundColor: statusTone.accent },
                                ]}
                            />
                            <Text
                                style={[styles.statusPillText, { color: statusTone.text }]}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                minimumFontScale={0.85}
                            >
                                {statusBadgeText}
                            </Text>
                        </View>

                        {/* Status Subtext explanation */}
                        <Text style={styles.statusSubtext}>{statusSubtext}</Text>
                    </View>

                    {/* WEEKLY PROGRESS STRIP SECTION */}
                    <View style={styles.weeklyStripContainer}>
                        <Text style={styles.weeklySectionTitle}>THIS WEEK'S PROGRESS</Text>
                        <WeeklyStreakStrip
                            week={streak?.week}
                            currentStreak={currentStreak}
                            variant="bare"
                        />
                    </View>

                    {/* PRIMARY ACTION BUTTON */}
                    <TouchableOpacity
                        activeOpacity={0.86}
                        onPress={handlePrimaryPress}
                        disabled={isActionPending}
                        accessibilityRole="button"
                        accessibilityState={{ busy: isActionPending, disabled: isActionPending }}
                        style={[
                            styles.primaryButton,
                            isActionPending && styles.primaryButtonDisabled,
                        ]}
                    >
                        {isFullHeart
                            ? <Text style={styles.buttonEmoji}>💕</Text>
                            : <BellIcon color="#FFFFFF" size={21} />}
                        <Text
                            style={styles.primaryButtonText}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.8}
                        >
                            {isActionPending
                                ? 'Sending reminder…'
                                : isFullHeart
                                    ? `Chat with ${partnerName}`
                                    : `Remind ${partnerName}`}
                        </Text>
                    </TouchableOpacity>

                    {/* SECONDARY ACTION BUTTON */}
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={handleBackPress}
                        activeOpacity={0.65}
                    >
                        <Text style={styles.backText}>← Back to Home</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        overflow: 'hidden',
    },
    topFadeGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 20,
    },
    content: {
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingHorizontal: 20,
    },
    inner: {
        width: '100%',
        alignItems: 'center',
    },

    /* Upper-left brand wordmark */
    topHeaderBar: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingLeft: 2,
        marginTop: -4,
        marginBottom: -2,
    },
    penguinLogo: {
        width: 132,
        height: 42,
    },

    /* Flame Hero Section */
    flameHeroContainer: {
        width: 240,
        height: 200,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        marginVertical: 0,
    },
    flameWrapper: {
        width: 200,
        height: 200,
        alignItems: 'center',
        justifyContent: 'center',
    },

    /* Streak Hero Section */
    streakHeroSection: {
        width: '100%',
        alignItems: 'center',
        marginVertical: spacing.xs,
    },
    streakNumberContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingHorizontal: 12,
        paddingVertical: 2,
        position: 'relative',
    },
    streakNumber: {
        fontFamily: fontFamily.extraBold,
        fontSize: 66,
        fontWeight: '800',
        color: '#FF2A6D',
        includeFontPadding: false,
        textAlignVertical: 'center',
        textShadowColor: 'rgba(255, 42, 109, 0.25)',
        textShadowOffset: { width: 0, height: 3 },
        textShadowRadius: 10,
    },
    streakUnitBadge: {
        flexDirection: 'column',
        justifyContent: 'center',
    },
    streakUnitMain: {
        fontFamily: fontFamily.extraBold,
        fontSize: 16,
        lineHeight: 19,
        fontWeight: '800',
        letterSpacing: 2.5,
        color: '#21184F',
    },
    streakUnitSub: {
        fontFamily: fontFamily.extraBold,
        fontSize: 13.5,
        lineHeight: 17,
        fontWeight: '800',
        letterSpacing: 2.5,
        color: '#FF2A6D',
    },
    streakGainBurst: {
        position: 'absolute',
        top: -2,
        right: -22,
        minWidth: 42,
        height: 30,
        paddingHorizontal: 9,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F8B8CC',
        shadowColor: '#D62F68',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 0,
    },
    streakGainText: {
        fontFamily: fontFamily.extraBold,
        fontSize: 16,
        fontWeight: '800',
        color: '#D62F68',
    },

    /* Restrained status pill without gradients */
    statusPillContainer: {
        alignSelf: 'center',
        maxWidth: width - 36,
        marginVertical: 6,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 38,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: borderRadius.full,
        borderWidth: 1,
    },
    statusPillDot: {
        width: 7,
        height: 7,
        marginRight: 9,
        borderRadius: 4,
    },
    statusPillText: {
        fontFamily: fontFamily.extraBold,
        fontSize: 12.5,
        fontWeight: '800',
        letterSpacing: 0.7,
        includeFontPadding: false,
        textAlignVertical: 'center',
        lineHeight: 17,
        flexShrink: 1,
    },
    statusSubtext: {
        fontFamily: fontFamily.bold,
        fontSize: 13.5,
        color: '#655D78',
        textAlign: 'center',
        marginTop: 4,
        paddingHorizontal: spacing.md,
    },

    /* Weekly Progress Strip */
    weeklyStripContainer: {
        width: '100%',
        maxWidth: 340,
        marginVertical: spacing.sm,
        alignItems: 'center',
    },
    weeklySectionTitle: {
        fontFamily: fontFamily.extraBold,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 2,
        color: '#958DA5',
        marginBottom: spacing.xs,
    },

    /* Primary CTA Button */
    primaryButton: {
        width: BUTTON_WIDTH,
        minHeight: 58,
        marginTop: spacing.sm,
        borderRadius: borderRadius.full,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 11,
        paddingHorizontal: 22,
        backgroundColor: '#F44778',
        borderWidth: 1,
        borderColor: '#E9366A',
        shadowColor: '#FF2A6D',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.22,
        shadowRadius: 12,
        elevation: 0,
    },
    primaryButtonDisabled: {
        opacity: 0.62,
    },
    primaryButtonText: {
        fontFamily: fontFamily.extraBold,
        fontSize: 16.5,
        fontWeight: '800',
        color: '#FFFFFF',
        textAlign: 'center',
    },
    buttonEmoji: {
        fontSize: 21,
    },

    /* Back Button */
    backButton: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        marginTop: spacing.xs,
    },
    backText: {
        fontFamily: fontFamily.bold,
        fontSize: 14,
        fontWeight: '700',
        color: '#7C738D',
    },
});
