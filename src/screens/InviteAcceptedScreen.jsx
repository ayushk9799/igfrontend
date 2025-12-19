// Invite Accepted Screen - Light & Elegant
// Clean celebration with bigger image
import React, { useRef, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    Image,
    Animated,
    Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import GradientBackground from '../components/GradientBackground';
import Button from '../components/Button';
import AnimatedHeart from '../components/AnimatedHeart';
import { colors, spacing, borderRadius, shadows, timing } from '../theme';

const { width, height } = Dimensions.get('window');
import coupleHugImage from "../../assets/couplehug.png"

// Import couple hug image

// Floating Confetti
const Confetti = ({ delay, color }) => {
    const translateY = useRef(new Animated.Value(-30)).current;
    const translateX = useRef(new Animated.Value(0)).current;
    const rotate = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(0.8)).current;

    useEffect(() => {
        const startX = (Math.random() - 0.5) * width;

        Animated.loop(
            Animated.sequence([
                Animated.delay(delay),
                Animated.parallel([
                    Animated.timing(translateY, {
                        toValue: height + 50,
                        duration: 4000 + Math.random() * 2000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(translateX, {
                        toValue: startX + (Math.random() - 0.5) * 150,
                        duration: 4000 + Math.random() * 2000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(rotate, {
                        toValue: 4 + Math.random() * 4,
                        duration: 4000 + Math.random() * 2000,
                        useNativeDriver: true,
                    }),
                    Animated.sequence([
                        Animated.delay(3500),
                        Animated.timing(opacity, {
                            toValue: 0,
                            duration: 500,
                            useNativeDriver: true,
                        }),
                    ]),
                ]),
                // Reset
                Animated.parallel([
                    Animated.timing(translateY, { toValue: -30, duration: 0, useNativeDriver: true }),
                    Animated.timing(translateX, { toValue: 0, duration: 0, useNativeDriver: true }),
                    Animated.timing(rotate, { toValue: 0, duration: 0, useNativeDriver: true }),
                    Animated.timing(opacity, { toValue: 0.8, duration: 0, useNativeDriver: true }),
                ]),
            ])
        ).start();
    }, [delay, translateY, translateX, rotate, opacity]);

    const rotateInterpolate = rotate.interpolate({
        inputRange: [0, 8],
        outputRange: ['0deg', '360deg'],
    });

    return (
        <Animated.View
            style={[
                styles.confetti,
                {
                    left: width / 2,
                    backgroundColor: color,
                    opacity,
                    transform: [{ translateY }, { translateX }, { rotate: rotateInterpolate }],
                },
            ]}
        />
    );
};

export const InviteAcceptedScreen = ({
    partnerName = 'Your Love',
    yourName = 'You',
    onContinue = () => { },
}) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;
    const imageScale = useRef(new Animated.Value(0.5)).current;
    const celebrationScale = useRef(new Animated.Value(0)).current;
    const buttonSlide = useRef(new Animated.Value(80)).current;
    const insets = useSafeAreaInsets();

    useEffect(() => {
        Animated.sequence([
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 600,
                    useNativeDriver: true,
                }),
                Animated.spring(slideAnim, {
                    toValue: 0,
                    ...timing.springGentle,
                    useNativeDriver: true,
                }),
            ]),
            Animated.spring(celebrationScale, {
                toValue: 1,
                ...timing.springBouncy,
                useNativeDriver: true,
            }),
            Animated.spring(imageScale, {
                toValue: 1,
                tension: 40,
                friction: 7,
                useNativeDriver: true,
            }),
            Animated.spring(buttonSlide, {
                toValue: 0,
                ...timing.springBouncy,
                useNativeDriver: true,
            }),
        ]).start();
    }, [fadeAnim, slideAnim, imageScale, celebrationScale, buttonSlide]);

    const confettiColors = [
        colors.primary,
        colors.secondary,
        colors.accent,
        colors.auroraBlue,
        colors.auroraPink,
    ];

    return (
        <GradientBackground variant="warm" showOrbs>
            {/* Confetti */}
            {[...Array(15)].map((_, i) => (
                <Confetti
                    key={i}
                    delay={i * 250}
                    color={confettiColors[i % confettiColors.length]}
                />
            ))}

            <View style={[
                styles.container,
                { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl }
            ]}>
                {/* Celebration Header */}
                <Animated.View
                    style={[
                        styles.header,
                        {
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }],
                        }
                    ]}
                >
                    <Animated.View style={{ transform: [{ scale: celebrationScale }] }}>
                        <Text style={styles.celebration}>🎉</Text>
                    </Animated.View>
                    <Text style={styles.title}>You're Connected!</Text>
                    <Text style={styles.subtitle}>
                        {partnerName} accepted your invite
                    </Text>
                </Animated.View>

                {/* Couple Image - BIG */}
                <Animated.View
                    style={[
                        styles.imageContainer,
                        {
                            opacity: fadeAnim,
                            transform: [{ scale: imageScale }],
                        }
                    ]}
                >
                    <View style={styles.imageWrapper}>
                        <Image
                            source={coupleHugImage}
                            style={styles.coupleImage}
                            resizeMode="contain"
                        />
                    </View>
                </Animated.View>

                {/* Names Section */}
                <Animated.View
                    style={[
                        styles.namesSection,
                        {
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }],
                        }
                    ]}
                >
                    <View style={styles.nameTag}>
                        <Text style={styles.nameText}>{yourName}</Text>
                    </View>
                    <AnimatedHeart size={44} pulse />
                    <View style={styles.nameTag}>
                        <Text style={styles.nameText}>{partnerName}</Text>
                    </View>
                </Animated.View>

                {/* Message */}
                <Animated.View style={[styles.messageContainer, { opacity: fadeAnim }]}>
                    <Text style={styles.message}>
                        Your journey begins now! Share moments and grow closer together.
                    </Text>
                </Animated.View>

                {/* Continue Button */}
                <Animated.View
                    style={[
                        styles.buttonContainer,
                        { transform: [{ translateY: buttonSlide }] }
                    ]}
                >
                    <Button
                        title="Let's Go! 🚀"
                        onPress={onContinue}
                        variant="primary"
                        size="xl"
                        fullWidth
                    />
                </Animated.View>
            </View>
        </GradientBackground>
    );
};

const IMAGE_SIZE = Math.min(width * 0.85, 320);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: spacing.xl,
        justifyContent: 'space-between',
    },
    confetti: {
        position: 'absolute',
        width: 8,
        height: 8,
        borderRadius: 2,
        zIndex: 100,
    },
    header: {
        alignItems: 'center',
    },
    celebration: {
        fontSize: 56,
        marginBottom: spacing.sm,
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: colors.text,
        letterSpacing: -1,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 17,
        color: colors.textSecondary,
        marginTop: spacing.xs,
    },
    imageContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    imageWrapper: {
        width: IMAGE_SIZE,
        height: IMAGE_SIZE,
        borderRadius: IMAGE_SIZE / 2,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        borderColor: colors.borderLight,
        ...shadows.lg,
    },
    coupleImage: {
        width: IMAGE_SIZE - 20,
        height: IMAGE_SIZE - 20,
    },
    namesSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.lg,
    },
    nameTag: {
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.borderLight,
        ...shadows.sm,
    },
    nameText: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text,
    },
    messageContainer: {
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
    },
    message: {
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 26,
    },
    buttonContainer: {},
});

export default InviteAcceptedScreen;
