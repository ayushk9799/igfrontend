// Notification Permission Screen - Ask user to enable notifications
import React, { useRef, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Animated,
    Dimensions,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GradientBackground from '../components/GradientBackground';
import { colors, spacing, borderRadius, shadows } from '../theme';
import { requestNotificationPermission, registerFCMToken } from '../utils/pushNotifications';

const { width, height } = Dimensions.get('window');

// Animated bell component
const AnimatedBell = () => {
    const swing = useRef(new Animated.Value(0)).current;
    const scale = useRef(new Animated.Value(0.8)).current;

    useEffect(() => {
        // Scale in
        Animated.spring(scale, {
            toValue: 1,
            friction: 6,
            tension: 40,
            useNativeDriver: true,
        }).start();

        // Continuous swing
        const swingAnimation = Animated.loop(
            Animated.sequence([
                Animated.timing(swing, { toValue: 1, duration: 400, useNativeDriver: true }),
                Animated.timing(swing, { toValue: -1, duration: 400, useNativeDriver: true }),
                Animated.timing(swing, { toValue: 0.6, duration: 300, useNativeDriver: true }),
                Animated.timing(swing, { toValue: -0.6, duration: 300, useNativeDriver: true }),
                Animated.timing(swing, { toValue: 0, duration: 200, useNativeDriver: true }),
                Animated.delay(2000),
            ])
        );
        swingAnimation.start();
        return () => swingAnimation.stop();
    }, [swing, scale]);

    const rotate = swing.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: ['-20deg', '0deg', '20deg'],
    });

    return (
        <Animated.View style={{ transform: [{ scale }, { rotate }] }}>
            <Text style={styles.bellEmoji}>🔔</Text>
        </Animated.View>
    );
};

// Pulsing ring behind the bell
const PulsingRing = () => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const opacityAnim = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.parallel([
                    Animated.timing(scaleAnim, { toValue: 1.3, duration: 1500, useNativeDriver: true }),
                    Animated.timing(opacityAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
                ]),
                Animated.parallel([
                    Animated.timing(scaleAnim, { toValue: 1, duration: 0, useNativeDriver: true }),
                    Animated.timing(opacityAnim, { toValue: 0.3, duration: 0, useNativeDriver: true }),
                ]),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, [scaleAnim, opacityAnim]);

    return (
        <Animated.View
            style={[
                styles.pulsingRing,
                {
                    opacity: opacityAnim,
                    transform: [{ scale: scaleAnim }],
                },
            ]}
        />
    );
};

// Floating notification badges
const FloatingBadge = ({ emoji, delay, position }) => {
    const translateY = useRef(new Animated.Value(30)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const scale = useRef(new Animated.Value(0.5)).current;

    useEffect(() => {
        const animation = Animated.sequence([
            Animated.delay(delay),
            Animated.parallel([
                Animated.spring(translateY, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
                Animated.spring(scale, { toValue: 1, friction: 6, tension: 50, useNativeDriver: true }),
            ]),
        ]);
        animation.start();
        return () => animation.stop();
    }, [delay, translateY, opacity, scale]);

    return (
        <Animated.View
            style={[
                styles.floatingBadge,
                position,
                {
                    opacity,
                    transform: [{ translateY }, { scale }],
                },
            ]}
        >
            <Text style={styles.badgeEmoji}>{emoji}</Text>
        </Animated.View>
    );
};

const NotificationPermissionScreen = ({ onComplete }) => {
    const insets = useSafeAreaInsets();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(40)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 600,
                useNativeDriver: true,
            }),
        ]).start();
    }, [fadeAnim, slideAnim]);

    const handleAllowNotifications = async () => {
        const granted = await requestNotificationPermission();
        if (granted) {
            // Now that permission is granted, register FCM token with backend
            await registerFCMToken();
        }
        onComplete?.();
    };

    const handleSkip = () => {
        onComplete?.();
    };

    return (
        <GradientBackground variant="light" showOrbs={true} showParticles={true}>
            <View style={[styles.container, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}>
                {/* Hero Section */}
                <Animated.View
                    style={[
                        styles.heroSection,
                        {
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }],
                        },
                    ]}
                >
                    <View style={styles.iconContainer}>
                        <PulsingRing />
                        <View style={styles.bellCircle}>
                            <AnimatedBell />
                        </View>

                        {/* Floating badges around bell */}
                        <FloatingBadge emoji="💌" delay={400} position={{ top: -10, right: -20 }} />
                        <FloatingBadge emoji="🎨" delay={700} position={{ top: 20, left: -25 }} />
                        <FloatingBadge emoji="🎮" delay={1000} position={{ bottom: -5, right: -15 }} />
                        <FloatingBadge emoji="💕" delay={1300} position={{ bottom: 10, left: -20 }} />
                    </View>

                    <Text style={styles.title}>Stay Connected</Text>
                    <Text style={styles.subtitle}>
                        Get notified when your partner sends you love notes, scribbles, and game invites
                    </Text>
                </Animated.View>

                {/* Feature list */}
                <Animated.View
                    style={[
                        styles.featuresContainer,
                        {
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }],
                        },
                    ]}
                >
                    <View style={styles.featureRow}>
                        <Text style={styles.featureEmoji}>💬</Text>
                        <View style={styles.featureTextContainer}>
                            <Text style={styles.featureTitle}>Partner Messages</Text>
                            <Text style={styles.featureSubtitle}>Never miss a sweet message</Text>
                        </View>
                    </View>
                    <View style={styles.featureRow}>
                        <Text style={styles.featureEmoji}>🖌️</Text>
                        <View style={styles.featureTextContainer}>
                            <Text style={styles.featureTitle}>New Scribbles</Text>
                            <Text style={styles.featureSubtitle}>See their drawings right away</Text>
                        </View>
                    </View>
                    <View style={styles.featureRow}>
                        <Text style={styles.featureEmoji}>🧩</Text>
                        <View style={styles.featureTextContainer}>
                            <Text style={styles.featureTitle}>Game Invites</Text>
                            <Text style={styles.featureSubtitle}>Jump into fun challenges together</Text>
                        </View>
                    </View>
                </Animated.View>

                {/* Bottom actions */}
                <View style={styles.bottomSection}>
                    <TouchableOpacity
                        style={styles.allowButton}
                        onPress={handleAllowNotifications}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.allowButtonText}>Allow Notifications</Text>
                        <Text style={styles.allowButtonIcon}>🔔</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleSkip} activeOpacity={0.7}>
                        <Text style={styles.skipText}>Maybe Later →</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: spacing.xl,
        justifyContent: 'space-between',
    },
    heroSection: {
        alignItems: 'center',
        marginTop: spacing.xl * 2,
    },
    iconContainer: {
        width: 160,
        height: 160,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.xl,
    },
    pulsingRing: {
        position: 'absolute',
        width: 140,
        height: 140,
        borderRadius: 70,
        borderWidth: 2.5,
        borderColor: colors.primaryLight,
    },
    bellCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#FFF0F3',
        justifyContent: 'center',
        alignItems: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#C084FC',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.08,
                shadowRadius: 12,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    bellEmoji: {
        fontSize: 56,
    },
    floatingBadge: {
        position: 'absolute',
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 8,
        borderWidth: 1.5,
        borderColor: '#FAE8FF',
        ...Platform.select({
            ios: {
                shadowColor: '#C084FC',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.06,
                shadowRadius: 8,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    badgeEmoji: {
        fontSize: 20,
    },
    title: {
        fontSize: 30,
        fontWeight: '800',
        color: colors.text,
        textAlign: 'center',
        letterSpacing: -0.5,
        marginBottom: spacing.sm,
    },
    subtitle: {
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 23,
        paddingHorizontal: spacing.md,
    },
    featuresContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: borderRadius.xl,
        padding: spacing.xl,
        borderWidth: 1.5,
        borderColor: '#FAE8FF',
        gap: spacing.lg,
        ...Platform.select({
            ios: {
                shadowColor: '#C084FC',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.05,
                shadowRadius: 12,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    featureEmoji: {
        fontSize: 28,
        width: 44,
        height: 44,
        textAlign: 'center',
        lineHeight: 44,
        backgroundColor: '#FFF0F3',
        borderRadius: 12,
        overflow: 'hidden',
    },
    featureTextContainer: {
        flex: 1,
    },
    featureTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.text,
        letterSpacing: -0.2,
    },
    featureSubtitle: {
        fontSize: 13,
        color: colors.textSecondary,
        marginTop: 2,
    },
    bottomSection: {
        alignItems: 'center',
        gap: spacing.lg,
    },
    allowButton: {
        width: '100%',
        borderRadius: borderRadius.xl,
        backgroundColor: colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: spacing.xl,
        gap: spacing.sm,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    allowButtonText: {
        fontSize: 17,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: -0.2,
    },
    allowButtonIcon: {
        fontSize: 18,
    },
    skipText: {
        fontSize: 15,
        color: colors.textSecondary,
        fontWeight: '700',
        paddingVertical: spacing.sm,
    },
});

export default NotificationPermissionScreen;
