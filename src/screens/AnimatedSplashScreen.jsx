import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Dimensions,
    Easing,
    StyleSheet,
    View,
} from 'react-native';

const splashLogo = require('../../assets/images/login-penguine.png');
const { width } = Dimensions.get('window');
const LOGO_WIDTH = Math.min(210, width * 0.56);
const LOGO_HEIGHT = LOGO_WIDTH * 1.5;

const FloatingHeart = ({ delay, left, top, size, color }) => {
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(16)).current;
    const scale = useRef(new Animated.Value(0.7)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.delay(delay),
                Animated.parallel([
                    Animated.timing(opacity, {
                        toValue: 0.75,
                        duration: 420,
                        useNativeDriver: true,
                    }),
                    Animated.timing(translateY, {
                        toValue: -18,
                        duration: 1600,
                        easing: Easing.out(Easing.quad),
                        useNativeDriver: true,
                    }),
                    Animated.timing(scale, {
                        toValue: 1,
                        duration: 1600,
                        easing: Easing.out(Easing.quad),
                        useNativeDriver: true,
                    }),
                ]),
                Animated.timing(opacity, {
                    toValue: 0,
                    duration: 520,
                    useNativeDriver: true,
                }),
                Animated.parallel([
                    Animated.timing(translateY, {
                        toValue: 16,
                        duration: 0,
                        useNativeDriver: true,
                    }),
                    Animated.timing(scale, {
                        toValue: 0.7,
                        duration: 0,
                        useNativeDriver: true,
                    }),
                ]),
                Animated.delay(500),
            ]),
        );

        animation.start();
        return () => animation.stop();
    }, [delay, opacity, scale, translateY]);

    return (
        <Animated.Text
            style={[
                styles.heart,
                {
                    left,
                    top,
                    color,
                    fontSize: size,
                    opacity,
                    transform: [{ translateY }, { scale }],
                },
            ]}
        >
            {'\u2665'}
        </Animated.Text>
    );
};

const AnimatedSplashScreen = ({ onFinish, style }) => {
    const logoScale = useRef(new Animated.Value(0.92)).current;
    const logoTranslateY = useRef(new Animated.Value(10)).current;
    const logoOpacity = useRef(new Animated.Value(0)).current;
    const glowScale = useRef(new Animated.Value(0.75)).current;
    const glowOpacity = useRef(new Animated.Value(0)).current;
    const exitOpacity = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const glowPulse = Animated.loop(
            Animated.sequence([
                Animated.parallel([
                    Animated.timing(glowScale, {
                        toValue: 1,
                        duration: 720,
                        easing: Easing.out(Easing.quad),
                        useNativeDriver: true,
                    }),
                    Animated.timing(glowOpacity, {
                        toValue: 0.55,
                        duration: 720,
                        easing: Easing.out(Easing.quad),
                        useNativeDriver: true,
                    }),
                ]),
                Animated.parallel([
                    Animated.timing(glowScale, {
                        toValue: 0.84,
                        duration: 720,
                        easing: Easing.inOut(Easing.quad),
                        useNativeDriver: true,
                    }),
                    Animated.timing(glowOpacity, {
                        toValue: 0.26,
                        duration: 720,
                        easing: Easing.inOut(Easing.quad),
                        useNativeDriver: true,
                    }),
                ]),
            ]),
        );

        glowPulse.start();

        const entrance = Animated.sequence([
            Animated.parallel([
                Animated.timing(logoOpacity, {
                    toValue: 1,
                    duration: 240,
                    useNativeDriver: true,
                }),
                Animated.spring(logoScale, {
                    toValue: 1,
                    friction: 6,
                    tension: 70,
                    useNativeDriver: true,
                }),
                Animated.spring(logoTranslateY, {
                    toValue: 0,
                    friction: 7,
                    tension: 70,
                    useNativeDriver: true,
                }),
            ]),
            Animated.parallel([
                Animated.timing(logoScale, {
                    toValue: 1.035,
                    duration: 480,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(logoTranslateY, {
                    toValue: -4,
                    duration: 480,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
            ]),
            Animated.parallel([
                Animated.timing(logoScale, {
                    toValue: 1,
                    duration: 430,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(logoTranslateY, {
                    toValue: 0,
                    duration: 430,
                    easing: Easing.inOut(Easing.quad),
                    useNativeDriver: true,
                }),
            ]),
            Animated.delay(180),
            Animated.timing(exitOpacity, {
                toValue: 0,
                duration: 240,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
            }),
        ]);

        entrance.start(({ finished }) => {
            glowPulse.stop();
            if (finished) {
                onFinish?.();
            }
        });

        return () => {
            glowPulse.stop();
            entrance.stop();
        };
    }, [exitOpacity, glowOpacity, glowScale, logoOpacity, logoScale, logoTranslateY, onFinish]);

    return (
        <Animated.View style={[styles.container, style, { opacity: exitOpacity }]}>
            <FloatingHeart delay={160} left="18%" top="29%" size={16} color="#FF8DB7" />
            <FloatingHeart delay={440} left="75%" top="33%" size={18} color="#FF6FA8" />
            <FloatingHeart delay={720} left="24%" top="61%" size={14} color="#FFFFFF" />
            <FloatingHeart delay={960} left="70%" top="64%" size={15} color="#FFFFFF" />

            <View style={styles.logoWrap}>
                <Animated.View
                    style={[
                        styles.glow,
                        {
                            opacity: glowOpacity,
                            transform: [{ scale: glowScale }],
                        },
                    ]}
                />
                <Animated.Image
                    source={splashLogo}
                    resizeMode="contain"
                    style={[
                        styles.logo,
                        {
                            opacity: logoOpacity,
                            transform: [
                                { translateY: logoTranslateY },
                                { scale: logoScale },
                            ],
                        },
                    ]}
                />
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F8DDF4',
    },
    logoWrap: {
        width: LOGO_WIDTH + 44,
        height: LOGO_HEIGHT + 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logo: {
        width: LOGO_WIDTH,
        height: LOGO_HEIGHT,
    },
    glow: {
        position: 'absolute',
        width: LOGO_WIDTH * 1.1,
        height: LOGO_WIDTH * 1.1,
        borderRadius: LOGO_WIDTH,
        backgroundColor: '#FFFFFF',
        shadowColor: '#FF6FA8',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.28,
        shadowRadius: 30,
        elevation: 4,
    },
    heart: {
        position: 'absolute',
        fontWeight: '700',
    },
});

export default AnimatedSplashScreen;
