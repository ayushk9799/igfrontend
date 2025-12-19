// Premium Animated Heart with Glow Effects & Particle Burst
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View, InteractionManager } from 'react-native';
import { colors, timing } from '../theme';

export const AnimatedHeart = ({
    size = 80,
    color = colors.heart,
    pulse = true,
    glowColor = colors.heartGlow,
    showParticles = true,
}) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const glowAnim = useRef(new Animated.Value(0.4)).current;
    const rotateAnim = useRef(new Animated.Value(0)).current;
    const [isReady, setIsReady] = useState(false);

    // Particle animations (8 mini hearts orbiting)
    const particleAnims = useRef(
        Array(8).fill(0).map(() => ({
            opacity: new Animated.Value(0),
            scale: new Animated.Value(0.5),
            translateX: new Animated.Value(0),
            translateY: new Animated.Value(0),
        }))
    ).current;

    // Defer animations until after navigation
    useEffect(() => {
        const handle = InteractionManager.runAfterInteractions(() => {
            setIsReady(true);
        });
        return () => handle.cancel();
    }, []);

    useEffect(() => {
        if (!isReady || !pulse) return;

        // Main heartbeat animation
        const pulseAnimation = Animated.loop(
            Animated.sequence([
                Animated.parallel([
                    Animated.timing(scaleAnim, {
                        toValue: 1.15,
                        duration: 600,
                        useNativeDriver: true,
                    }),
                    Animated.timing(glowAnim, {
                        toValue: 0.9,
                        duration: 600,
                        useNativeDriver: true,
                    }),
                ]),
                Animated.parallel([
                    Animated.timing(scaleAnim, {
                        toValue: 0.95,
                        duration: 200,
                        useNativeDriver: true,
                    }),
                    Animated.timing(glowAnim, {
                        toValue: 0.5,
                        duration: 200,
                        useNativeDriver: true,
                    }),
                ]),
                Animated.parallel([
                    Animated.timing(scaleAnim, {
                        toValue: 1.1,
                        duration: 400,
                        useNativeDriver: true,
                    }),
                    Animated.timing(glowAnim, {
                        toValue: 0.7,
                        duration: 400,
                        useNativeDriver: true,
                    }),
                ]),
                Animated.parallel([
                    Animated.timing(scaleAnim, {
                        toValue: 1,
                        duration: 600,
                        useNativeDriver: true,
                    }),
                    Animated.timing(glowAnim, {
                        toValue: 0.4,
                        duration: 600,
                        useNativeDriver: true,
                    }),
                ]),
            ])
        );

        // Subtle rotation wobble
        const wobbleAnimation = Animated.loop(
            Animated.sequence([
                Animated.timing(rotateAnim, {
                    toValue: 0.03,
                    duration: 2000,
                    useNativeDriver: true,
                }),
                Animated.timing(rotateAnim, {
                    toValue: -0.03,
                    duration: 2000,
                    useNativeDriver: true,
                }),
            ])
        );

        pulseAnimation.start();
        wobbleAnimation.start();

        let burstInterval;

        // Particle burst animation
        if (showParticles) {
            const burstParticles = () => {
                particleAnims.forEach((particle, index) => {
                    const angle = (index / 8) * Math.PI * 2;
                    const distance = size * 0.8;

                    Animated.sequence([
                        Animated.delay(index * 50),
                        Animated.parallel([
                            Animated.timing(particle.opacity, {
                                toValue: 0.8,
                                duration: 300,
                                useNativeDriver: true,
                            }),
                            Animated.timing(particle.scale, {
                                toValue: 1,
                                duration: 300,
                                useNativeDriver: true,
                            }),
                            Animated.timing(particle.translateX, {
                                toValue: Math.cos(angle) * distance,
                                duration: 800,
                                useNativeDriver: true,
                            }),
                            Animated.timing(particle.translateY, {
                                toValue: Math.sin(angle) * distance,
                                duration: 800,
                                useNativeDriver: true,
                            }),
                        ]),
                        Animated.parallel([
                            Animated.timing(particle.opacity, {
                                toValue: 0,
                                duration: 400,
                                useNativeDriver: true,
                            }),
                            Animated.timing(particle.scale, {
                                toValue: 0.3,
                                duration: 400,
                                useNativeDriver: true,
                            }),
                        ]),
                        // Reset
                        Animated.parallel([
                            Animated.timing(particle.translateX, {
                                toValue: 0,
                                duration: 0,
                                useNativeDriver: true,
                            }),
                            Animated.timing(particle.translateY, {
                                toValue: 0,
                                duration: 0,
                                useNativeDriver: true,
                            }),
                        ]),
                    ]).start();
                });
            };

            // Burst every 3 seconds
            burstInterval = setInterval(burstParticles, 3000);
            burstParticles(); // Initial burst
        }

        return () => {
            pulseAnimation.stop();
            wobbleAnimation.stop();
            if (burstInterval) clearInterval(burstInterval);
        };
    }, [isReady, pulse, scaleAnim, glowAnim, rotateAnim, showParticles, particleAnims, size]);

    const rotateInterpolated = rotateAnim.interpolate({
        inputRange: [-0.03, 0.03],
        outputRange: ['-3deg', '3deg'],
    });

    return (
        <View style={styles.wrapper}>
            {/* Multi-layer Glow Effect */}
            <Animated.View
                style={[
                    styles.glow,
                    styles.glowOuter,
                    {
                        width: size * 2.2,
                        height: size * 2.2,
                        borderRadius: size * 1.1,
                        backgroundColor: glowColor,
                        opacity: Animated.multiply(glowAnim, 0.3),
                        transform: [{ scale: scaleAnim }],
                    },
                ]}
            />
            <Animated.View
                style={[
                    styles.glow,
                    {
                        width: size * 1.6,
                        height: size * 1.6,
                        borderRadius: size * 0.8,
                        backgroundColor: glowColor,
                        opacity: Animated.multiply(glowAnim, 0.5),
                        transform: [{ scale: scaleAnim }],
                    },
                ]}
            />

            {/* Particle Mini Hearts */}
            {showParticles && particleAnims.map((particle, index) => (
                <Animated.View
                    key={index}
                    style={[
                        styles.particle,
                        {
                            opacity: particle.opacity,
                            transform: [
                                { translateX: particle.translateX },
                                { translateY: particle.translateY },
                                { scale: particle.scale },
                            ],
                        },
                    ]}
                >
                    <View style={[styles.miniHeart, { backgroundColor: color }]}>
                        <View style={[styles.miniHeartPiece, styles.miniHeartLeft, { backgroundColor: color }]} />
                        <View style={[styles.miniHeartPiece, styles.miniHeartRight, { backgroundColor: color }]} />
                    </View>
                </Animated.View>
            ))}

            {/* Heart Container */}
            <Animated.View
                style={[
                    styles.container,
                    {
                        width: size,
                        height: size,
                        transform: [
                            { scale: scaleAnim },
                            { rotate: rotateInterpolated },
                        ],
                    },
                ]}
            >
                {/* Heart Shape with gradient-like layering */}
                <View style={styles.heartWrapper}>
                    {/* Shadow layer */}
                    <View
                        style={[
                            styles.heartPiece,
                            styles.heartLeft,
                            styles.heartShadow,
                            {
                                width: size * 0.54,
                                height: size * 0.82,
                                borderRadius: size * 0.54,
                            },
                        ]}
                    />
                    <View
                        style={[
                            styles.heartPiece,
                            styles.heartRight,
                            styles.heartShadow,
                            {
                                width: size * 0.54,
                                height: size * 0.82,
                                borderRadius: size * 0.54,
                            },
                        ]}
                    />
                    {/* Main color layer */}
                    <View
                        style={[
                            styles.heartPiece,
                            styles.heartLeft,
                            {
                                width: size * 0.52,
                                height: size * 0.8,
                                backgroundColor: color,
                                borderRadius: size * 0.52,
                            },
                        ]}
                    />
                    <View
                        style={[
                            styles.heartPiece,
                            styles.heartRight,
                            {
                                width: size * 0.52,
                                height: size * 0.8,
                                backgroundColor: color,
                                borderRadius: size * 0.52,
                            },
                        ]}
                    />
                    {/* Highlight layer */}
                    <View
                        style={[
                            styles.heartPiece,
                            styles.heartHighlight,
                            {
                                width: size * 0.2,
                                height: size * 0.2,
                                borderRadius: size * 0.1,
                            },
                        ]}
                    />
                </View>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    glow: {
        position: 'absolute',
    },
    glowOuter: {
        // Extra outer glow
    },
    particle: {
        position: 'absolute',
        zIndex: 5,
    },
    miniHeart: {
        width: 12,
        height: 12,
        position: 'relative',
    },
    miniHeartPiece: {
        position: 'absolute',
        width: 8,
        height: 10,
        borderRadius: 8,
    },
    miniHeartLeft: {
        transform: [{ rotate: '-45deg' }, { translateX: -2 }],
        top: 1,
        left: 0,
    },
    miniHeartRight: {
        transform: [{ rotate: '45deg' }, { translateX: 2 }],
        top: 1,
        right: 0,
    },
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    heartWrapper: {
        position: 'relative',
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    heartPiece: {
        position: 'absolute',
    },
    heartShadow: {
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        top: '10%',
    },
    heartLeft: {
        transform: [{ rotate: '-45deg' }, { translateX: -8 }],
        top: '8%',
    },
    heartRight: {
        transform: [{ rotate: '45deg' }, { translateX: 8 }],
        top: '8%',
    },
    heartHighlight: {
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        top: '15%',
        left: '25%',
    },
});

export default AnimatedHeart;
