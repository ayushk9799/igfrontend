import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Dimensions,
    ScrollView,
    StyleSheet,
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

import { borderRadius, spacing } from '../theme';
import { fontFamily } from '../constants/fonts';
import { translateUiTemplate, translateUiText } from '../i18n/uiTranslation';

const { width } = Dimensions.get('window');
const CARD_WIDTH = Math.min(width - 40, 360);
const HEART_PATH = 'M12 21.2C11.4 20.7 10.5 19.9 9.4 18.9C5.2 15.2 2 12.2 2 8.2C2 5.2 4.2 3 7.2 3C9.1 3 10.8 3.9 12 5.3C13.2 3.9 14.9 3 16.8 3C19.8 3 22 5.2 22 8.2C22 12.2 18.8 15.2 14.6 18.9C13.5 19.9 12.6 20.7 12 21.2Z';

const BellIcon = ({ color = '#FFFFFF', size = 24 }) => (
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

            {/* Low, diffused depth keeps the heart dimensional without a sticker-like drop shadow. */}
            <Use
                href={`#${heartId}`}
                transform="translate(0 0.6)"
                fill="#351126"
                opacity={0.14}
            />

            {/* Keep each completion state in its original solid color. */}
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

            {/* Shared translucent lighting inflates both halves without replacing their colors. */}
            <G clipPath={`url(#${shapeId})`}>
                <Rect x="1" y="2" width="22" height="20" fill={`url(#${surfaceId})`} />
                <Rect x="1" y="2" width="22" height="20" fill={`url(#${highlightId})`} />

                {/* The split remains readable, but recedes into the form. */}
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
    onChatNow = () => {},
}) {
    const insets = useSafeAreaInsets();
    const opacity = useRef(new Animated.Value(0)).current;
    const heartScale = useRef(new Animated.Value(0.8)).current;
    const heartFloat = useRef(new Animated.Value(0)).current;
    const contentTranslateY = useRef(new Animated.Value(14)).current;
    const cardTranslateY = useRef(new Animated.Value(24)).current;
    const cardOpacity = useRef(new Animated.Value(0)).current;
    const countScale = useRef(new Animated.Value(0.6)).current;
    const countOpacity = useRef(new Animated.Value(0)).current;
    const hasShownInitialHeart = useRef(false);

    const youComplete = Boolean(hasCompletedMyPart || streak?.youComplete);
    const partnerComplete = Boolean(streak?.partnerComplete);
    const isFullHeart = youComplete && partnerComplete;
    const currentStreak = Number(streak?.currentStreak) || 0;

    useEffect(() => {
        const entrance = Animated.parallel([
            Animated.timing(opacity, {
                toValue: 1,
                duration: 380,
                useNativeDriver: true,
            }),
            Animated.spring(contentTranslateY, {
                toValue: 0,
                friction: 8,
                tension: 75,
                useNativeDriver: true,
            }),
            Animated.sequence([
                Animated.spring(heartScale, {
                    toValue: 1.06,
                    friction: 5,
                    tension: 90,
                    useNativeDriver: true,
                }),
                Animated.spring(heartScale, {
                    toValue: 1,
                    friction: 6,
                    tension: 80,
                    useNativeDriver: true,
                }),
            ]),
            Animated.sequence([
                Animated.delay(100),
                Animated.parallel([
                    Animated.spring(cardTranslateY, {
                        toValue: 0,
                        friction: 8,
                        tension: 75,
                        useNativeDriver: true,
                    }),
                    Animated.timing(cardOpacity, {
                        toValue: 1,
                        duration: 320,
                        useNativeDriver: true,
                    }),
                ]),
            ]),
        ]);

        const floatingHeart = Animated.loop(
            Animated.sequence([
                Animated.timing(heartFloat, {
                    toValue: -4,
                    duration: 1400,
                    useNativeDriver: true,
                }),
                Animated.timing(heartFloat, {
                    toValue: 3,
                    duration: 1800,
                    useNativeDriver: true,
                }),
                Animated.timing(heartFloat, {
                    toValue: 0,
                    duration: 1200,
                    useNativeDriver: true,
                }),
            ]),
        );

        entrance.start(({ finished }) => {
            if (finished) floatingHeart.start();
        });

        return () => {
            entrance.stop();
            floatingHeart.stop();
        };
    }, [cardOpacity, cardTranslateY, contentTranslateY, heartFloat, heartScale, opacity]);

    useEffect(() => {
        countScale.setValue(0.6);
        countOpacity.setValue(0);

        const countEntrance = Animated.sequence([
            Animated.delay(220),
            Animated.parallel([
                Animated.spring(countScale, {
                    toValue: 1,
                    friction: 5,
                    tension: 100,
                    useNativeDriver: true,
                }),
                Animated.timing(countOpacity, {
                    toValue: 1,
                    duration: 220,
                    useNativeDriver: true,
                }),
            ]),
        ]);

        countEntrance.start();
        return () => countEntrance.stop();
    }, [countOpacity, countScale, currentStreak]);

    useEffect(() => {
        if (!hasShownInitialHeart.current) {
            hasShownInitialHeart.current = true;
            return undefined;
        }

        heartScale.setValue(0.88);
        const stateChangePulse = Animated.sequence([
            Animated.spring(heartScale, {
                toValue: 1.08,
                friction: 5,
                tension: 95,
                useNativeDriver: true,
            }),
            Animated.spring(heartScale, {
                toValue: 1,
                friction: 6,
                tension: 80,
                useNativeDriver: true,
            }),
        ]);

        stateChangePulse.start();
        return () => stateChangePulse.stop();
    }, [heartScale, partnerComplete, youComplete]);

    return (
        <View style={styles.screen}>
            <LinearGradient
                colors={['#FFE2EF', '#FFF9FC', '#FFEAF3']}
                locations={[0, 0.5, 1]}
                style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.topOrb} />
            <View style={styles.bottomOrb} />

            {showConfetti && (
                <ConfettiCannon
                    count={80}
                    origin={{ x: width / 2, y: 80 }}
                    fadeOut
                    explosionSpeed={250}
                    fallSpeed={2200}
                />
            )}

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                    styles.content,
                    { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl },
                ]}
            >
                <Animated.View style={[
                    styles.inner,
                    { opacity, transform: [{ translateY: contentTranslateY }] },
                ]}>
                    <View style={styles.titleRow}>
                        <Text style={styles.titleDark}>{translateUiText("Ritual")}</Text>
                        <Text style={styles.titlePink}>{translateUiText("Complete!")}</Text>
                    </View>

                    <Animated.View style={[
                        styles.heartWrap,
                        { transform: [{ translateY: heartFloat }, { scale: heartScale }] },
                    ]}>
                        <HeartStateIcon
                            youComplete={youComplete}
                            partnerComplete={partnerComplete}
                        />
                    </Animated.View>

                    <Animated.View style={[
                        styles.streakCard,
                        { opacity: cardOpacity, transform: [{ translateY: cardTranslateY }] },
                    ]}>
                        <Text style={styles.streakLabel}>{translateUiText("Current Streak")}</Text>
                        <Animated.View
                            style={[
                                styles.countWrap,
                                { opacity: countOpacity, transform: [{ scale: countScale }] },
                            ]}
                        >
                            <Text style={styles.streakNumber}>{currentStreak}</Text>
                            <Text style={styles.streakUnit}>{currentStreak === 1 ? translateUiText("DAY") : translateUiText("DAYS")}</Text>
                        </Animated.View>
                    </Animated.View>

                    <TouchableOpacity
                        activeOpacity={0.88}
                        onPress={isFullHeart ? onCompareWithPartner : onRemindPartner}
                        style={styles.primaryButton}
                    >
                        {isFullHeart ? <Text style={styles.buttonEmoji}>💕</Text> : <BellIcon />}
                        <Text
                            style={styles.primaryButtonText}
                            numberOfLines={2}
                            adjustsFontSizeToFit
                            minimumFontScale={0.78}
                        >
                            {isFullHeart
                                ? translateUiTemplate("Chat with {{0}}", [partnerName])
                                : translateUiTemplate("Remind {{0}} to Play", [partnerName])}
                        </Text>
                    </TouchableOpacity>

                    {!isFullHeart && (
                        <TouchableOpacity
                            activeOpacity={0.84}
                            style={styles.chatButton}
                            onPress={onChatNow}
                        >
                            <Text style={styles.chatButtonText}>{translateUiText("Chat now")}</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity style={styles.backButton} onPress={onBack}>
                        <Text style={styles.backText}>{translateUiText("← Back to Home")}</Text>
                    </TouchableOpacity>
                </Animated.View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        overflow: 'hidden',
        backgroundColor: '#FFF6FA',
    },
    content: {
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    inner: {
        width: '100%',
        alignItems: 'center',
    },
    topOrb: {
        position: 'absolute',
        top: -140,
        alignSelf: 'center',
        width: width * 1.2,
        height: width * 1.2,
        borderRadius: width,
        backgroundColor: 'rgba(255,255,255,0.55)',
    },
    bottomOrb: {
        position: 'absolute',
        bottom: -160,
        alignSelf: 'center',
        width: width * 1.3,
        height: 260,
        borderRadius: width,
        backgroundColor: 'rgba(255,255,255,0.48)',
    },
    titleRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        flexWrap: 'wrap',
    },
    titleDark: {
        fontFamily: fontFamily.extraBold,
        fontSize: width < 380 ? 36 : 42,
        lineHeight: width < 380 ? 44 : 50,
        fontWeight: '800',
        color: '#21184F',
    },
    titlePink: {
        fontFamily: fontFamily.extraBold,
        fontSize: width < 380 ? 36 : 42,
        lineHeight: width < 380 ? 44 : 50,
        fontWeight: '800',
        color: '#F4477B',
    },
    heartWrap: {
        width: 200,
        height: 200,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: spacing.xl,
        marginBottom: spacing.lg,
    },
    streakCard: {
        width: CARD_WIDTH,
        minHeight: 190,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderWidth: 1,
        borderColor: '#FFFFFF',
        shadowColor: '#E89AB6',
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.16,
        shadowRadius: 25,
        elevation: 7,
    },
    streakLabel: {
        fontFamily: fontFamily.medium,
        fontSize: 17,
        fontWeight: '600',
        color: '#675F7B',
    },
    countWrap: {
        alignItems: 'center',
    },
    streakNumber: {
        marginTop: -2,
        fontFamily: fontFamily.extraBold,
        fontSize: 72,
        lineHeight: 78,
        fontWeight: '800',
        color: '#F44778',
    },
    streakUnit: {
        marginTop: -8,
        fontFamily: fontFamily.extraBold,
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: 0.6,
        color: '#F44778',
    },
    primaryButton: {
        width: CARD_WIDTH,
        minHeight: 60,
        marginTop: spacing.lg,
        borderRadius: borderRadius.full,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        paddingHorizontal: 18,
        paddingVertical: 10,
        backgroundColor: '#FF4D7D',
        shadowColor: '#F43F78',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.28,
        shadowRadius: 16,
        elevation: 7,
    },
    primaryButtonText: {
        flexShrink: 1,
        fontFamily: fontFamily.extraBold,
        fontSize: 16.5,
        fontWeight: '800',
        color: '#FFFFFF',
        textAlign: 'center',
    },
    buttonEmoji: {
        fontSize: 22,
    },
    chatButton: {
        width: CARD_WIDTH,
        minHeight: 52,
        marginTop: spacing.md,
        borderRadius: borderRadius.full,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#F44778',
        backgroundColor: 'rgba(255,255,255,0.82)',
        paddingHorizontal: 18,
    },
    chatButtonText: {
        fontFamily: fontFamily.extraBold,
        fontSize: 16,
        fontWeight: '800',
        color: '#F44778',
    },
    backButton: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.lg,
    },
    backText: {
        fontFamily: fontFamily.bold,
        fontSize: 15,
        fontWeight: '700',
        color: '#655D78',
    },
});
