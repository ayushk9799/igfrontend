// Premium Gradient Background - Light & Elegant
// Clean, airy backgrounds with subtle effects
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Animated, Dimensions, InteractionManager } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import colors from '../theme/colors';

const { width, height } = Dimensions.get('window');

// Floating Circle - Subtle pastel orbs (deferred animation)
const FloatingCircle = ({ size = 200, color, delay = 0, startX = 0, startY = 0 }) => {
    const translateX = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(0.15)).current;
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        // Defer heavy animations until after navigation completes
        const handle = InteractionManager.runAfterInteractions(() => {
            setIsReady(true);
        });
        return () => handle.cancel();
    }, []);

    useEffect(() => {
        if (!isReady) return;

        const animation = Animated.loop(
            Animated.sequence([
                Animated.delay(delay),
                Animated.parallel([
                    Animated.timing(translateX, {
                        toValue: 40,
                        duration: 8000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(translateY, {
                        toValue: -30,
                        duration: 8000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(opacity, {
                        toValue: 0.25,
                        duration: 8000,
                        useNativeDriver: true,
                    }),
                ]),
                Animated.parallel([
                    Animated.timing(translateX, {
                        toValue: 0,
                        duration: 8000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(translateY, {
                        toValue: 0,
                        duration: 8000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(opacity, {
                        toValue: 0.15,
                        duration: 8000,
                        useNativeDriver: true,
                    }),
                ]),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, [isReady, translateX, translateY, opacity, delay]);

    return (
        <Animated.View
            style={[
                styles.floatingCircle,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: color,
                    left: startX,
                    top: startY,
                    opacity,
                    transform: [{ translateX }, { translateY }],
                },
            ]}
        />
    );
};

// Subtle Sparkle - Light version (deferred animation)
const Sparkle = ({ delay = 0, x, y }) => {
    const opacity = useRef(new Animated.Value(0)).current;
    const scale = useRef(new Animated.Value(0.5)).current;
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        const handle = InteractionManager.runAfterInteractions(() => {
            setIsReady(true);
        });
        return () => handle.cancel();
    }, []);

    useEffect(() => {
        if (!isReady) return;

        const animation = Animated.loop(
            Animated.sequence([
                Animated.delay(delay),
                Animated.parallel([
                    Animated.timing(opacity, {
                        toValue: 0.6,
                        duration: 1500,
                        useNativeDriver: true,
                    }),
                    Animated.spring(scale, {
                        toValue: 1,
                        useNativeDriver: true,
                    }),
                ]),
                Animated.parallel([
                    Animated.timing(opacity, {
                        toValue: 0,
                        duration: 1500,
                        useNativeDriver: true,
                    }),
                    Animated.timing(scale, {
                        toValue: 0.5,
                        duration: 1500,
                        useNativeDriver: true,
                    }),
                ]),
                Animated.delay(3000),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, [isReady, opacity, scale, delay]);

    return (
        <Animated.View
            style={[
                styles.sparkle,
                {
                    left: x,
                    top: y,
                    opacity,
                    transform: [{ scale }],
                },
            ]}
        />
    );
};

const gradientPresets = {
    // Light and clean
    light: {
        colors: [colors.background, colors.backgroundAlt],
        orbs: [
            { color: colors.primarySoft, size: 300, x: -100, y: -50 },
            { color: colors.secondarySoft, size: 250, x: width - 80, y: height * 0.4 },
        ],
    },
    // Warm coral tones
    warm: {
        colors: ['#FFF5F5', '#FED7D7', '#FEEBC8'],
        orbs: [
            { color: 'rgba(249, 112, 104, 0.15)', size: 320, x: -100, y: -80 },
            { color: 'rgba(244, 162, 97, 0.12)', size: 280, x: width - 100, y: height * 0.5 },
        ],
    },
    // Cool teal tones
    cool: {
        colors: ['#E6FFFA', '#B2F5EA', '#E6FFFA'],
        orbs: [
            { color: 'rgba(91, 181, 166, 0.15)', size: 300, x: -80, y: 100 },
            { color: 'rgba(129, 212, 250, 0.12)', size: 260, x: width - 60, y: height * 0.3 },
        ],
    },
    // Soft neutral
    neutral: {
        colors: [colors.background, '#F7FAFC', colors.backgroundAlt],
        orbs: [
            { color: 'rgba(160, 174, 192, 0.08)', size: 280, x: -60, y: 50 },
            { color: 'rgba(203, 213, 224, 0.1)', size: 240, x: width - 80, y: height * 0.6 },
        ],
    },
    // Sunrise - warm and inviting
    sunrise: {
        colors: ['#FFF5F5', '#FFFAF0', '#FEFCBF'],
        orbs: [
            { color: 'rgba(249, 112, 104, 0.12)', size: 350, x: -120, y: -100 },
            { color: 'rgba(244, 162, 97, 0.1)', size: 300, x: width - 50, y: height * 0.4 },
        ],
    },
    // For compatibility - map old names to new light versions
    midnight: {
        colors: [colors.background, colors.backgroundAlt, '#F7FAFC'],
        orbs: [
            { color: 'rgba(249, 112, 104, 0.1)', size: 300, x: -80, y: -50 },
            { color: 'rgba(91, 181, 166, 0.08)', size: 280, x: width - 60, y: height * 0.5 },
        ],
    },
    romantic: {
        colors: ['#FFF5F5', '#FED7E2', '#FFF5F5'],
        orbs: [
            { color: 'rgba(255, 143, 171, 0.15)', size: 320, x: -100, y: -60 },
            { color: 'rgba(249, 112, 104, 0.1)', size: 280, x: width - 80, y: height * 0.4 },
        ],
    },
    cosmic: {
        colors: ['#E6FFFA', '#EBF8FF', '#E9D8FD'],
        orbs: [
            { color: 'rgba(129, 212, 250, 0.12)', size: 300, x: -60, y: -40 },
            { color: 'rgba(206, 147, 216, 0.1)', size: 260, x: width - 70, y: height * 0.5 },
        ],
    },
    aurora: {
        colors: ['#E6FFFA', '#C6F6D5', '#E6FFFA'],
        orbs: [
            { color: 'rgba(165, 214, 167, 0.15)', size: 320, x: -80, y: 0 },
            { color: 'rgba(129, 212, 250, 0.1)', size: 280, x: width - 100, y: height * 0.35 },
        ],
    },
};

export const GradientBackground = ({
    children,
    variant = 'light',
    showOrbs = true,
    showParticles = false,
    showHearts = false,
    style,
}) => {
    const preset = gradientPresets[variant] || gradientPresets.light;

    return (
        <View style={[styles.container, style]}>
            <LinearGradient
                colors={preset.colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.3, y: 1 }}
                style={styles.gradient}
            >
                {/* Floating Orbs - Subtle */}
                {showOrbs && preset.orbs.map((orb, index) => (
                    <FloatingCircle
                        key={index}
                        size={orb.size}
                        color={orb.color}
                        startX={orb.x}
                        startY={orb.y}
                        delay={index * 1000}
                    />
                ))}

                {/* Subtle Sparkles */}
                {showParticles && [...Array(6)].map((_, i) => (
                    <Sparkle
                        key={i}
                        delay={i * 800}
                        x={Math.random() * width}
                        y={100 + Math.random() * (height - 200)}
                    />
                ))}

                {children}
            </LinearGradient>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    gradient: {
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
    },
    floatingCircle: {
        position: 'absolute',
    },
    sparkle: {
        position: 'absolute',
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.primary,
    },
});

export default GradientBackground;
