// Animated Journey Path Onboarding - S-curve with all features visible
import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    Animated,
    Easing,
    Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path, Circle, Rect, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { colors, spacing, borderRadius } from '../theme';

const { width, height } = Dimensions.get('window');

// Features to animate through
const FEATURES = [
    {
        id: 'mood',
        title: 'Share Your Mood',
        subtitle: 'Let them know how you feel',
        assetType: 'emoji',
        emoji: '😊',
        secondaryEmojis: ['❤️', '😴', '🥰', '✨'],
        gradient: ['#F4A261', '#FFF9F5'],
        iconBg: 'rgba(249, 110, 103, 0.15)',
        nodeColor: '#F4A261',
    },
    {
        id: 'scribble',
        title: 'Send Scribbles',
        subtitle: 'Draw love notes for each other',
        assetType: 'image',
        image: require('../../assets/pencilicon.png'),
        secondaryEmojis: ['💕', '🎨', '✨', '💌'],
        gradient: ['#FDF8F3', '#F8EDE3'],
        iconBg: 'rgba(244, 162, 97, 0.15)',
        nodeColor: '#C4A77D',
    },
    {
        id: 'games',
        title: 'Play Together',
        subtitle: 'Challenge your partner in fun duels',
        assetType: 'svg',
        gradient: ['#E55B5B', '#d44747'],
        iconBg: 'rgba(255, 107, 107, 0.2)',
        nodeColor: '#E55B5B',
    },
    {
        id: 'topics',
        title: 'Know Each Other',
        subtitle: 'Discover what you never knew',
        assetType: 'images',
        topicImages: [
            { source: require('../../assets/chilli.png'), position: { top: -15, left: -20 } },
            { source: require('../../assets/coins.png'), position: { top: -10, right: -25 } },
            { source: require('../../assets/travel.png'), position: { bottom: -10, left: -15 } },
            { source: require('../../assets/dreamsfuture.png'), position: { bottom: -5, right: -20 } },
        ],
        gradient: ['#FFF9F5', '#FFE4E4'],
        iconBg: 'rgba(255, 45, 85, 0.15)',
        nodeColor: '#FF6B9D',
    },
];

const ANIMATION_DURATION = 3000;
const NODE_SIZE = 70;
const ACTIVE_NODE_SIZE = 100;

const AnimatedOnboardingScreen = ({ onComplete }) => {
    const insets = useSafeAreaInsets();
    const [currentIndex, setCurrentIndex] = useState(0);

    // Animation values for path drawing
    const pathProgress = useRef(new Animated.Value(0)).current;

    // Animation values for each node
    const nodeAnims = useRef(
        FEATURES.map(() => ({
            scale: new Animated.Value(0.8),
            opacity: new Animated.Value(0.4),
            glow: new Animated.Value(0),
        }))
    ).current;

    // Secondary element animations for active node
    const secondaryAnims = useRef(
        [0, 1, 2, 3].map(() => ({
            scale: new Animated.Value(0),
            opacity: new Animated.Value(0),
            translateY: new Animated.Value(20),
        }))
    ).current;

    // Progress bar animation
    const progressAnim = useRef(new Animated.Value(0)).current;

    // Text animations
    const textFade = useRef(new Animated.Value(1)).current;
    const textSlide = useRef(new Animated.Value(0)).current;

    const currentFeature = FEATURES[currentIndex];

    // Auto-advance through features
    useEffect(() => {
        // Animate current node to active state
        const animateNodes = () => {
            nodeAnims.forEach((anim, index) => {
                if (index === currentIndex) {
                    // Active node - scale up and full opacity
                    Animated.parallel([
                        Animated.spring(anim.scale, {
                            toValue: 1,
                            friction: 8,
                            tension: 40,
                            useNativeDriver: true,
                        }),
                        Animated.timing(anim.opacity, {
                            toValue: 1,
                            duration: 400,
                            useNativeDriver: true,
                        }),
                        Animated.timing(anim.glow, {
                            toValue: 1,
                            duration: 600,
                            useNativeDriver: false,
                        }),
                    ]).start();
                } else if (index < currentIndex) {
                    // Completed nodes - smaller but visible
                    Animated.parallel([
                        Animated.timing(anim.scale, {
                            toValue: 0.85,
                            duration: 300,
                            useNativeDriver: true,
                        }),
                        Animated.timing(anim.opacity, {
                            toValue: 0.9,
                            duration: 300,
                            useNativeDriver: true,
                        }),
                        Animated.timing(anim.glow, {
                            toValue: 0,
                            duration: 300,
                            useNativeDriver: false,
                        }),
                    ]).start();
                } else {
                    // Upcoming nodes - dimmed
                    Animated.parallel([
                        Animated.timing(anim.scale, {
                            toValue: 0.7,
                            duration: 300,
                            useNativeDriver: true,
                        }),
                        Animated.timing(anim.opacity, {
                            toValue: 0.35,
                            duration: 300,
                            useNativeDriver: true,
                        }),
                    ]).start();
                }
            });
        };

        // Animate path progress
        const animatePath = () => {
            Animated.timing(pathProgress, {
                toValue: (currentIndex + 1) / FEATURES.length,
                duration: 600,
                easing: Easing.bezier(0.25, 0.1, 0.25, 1),
                useNativeDriver: false,
            }).start();
        };

        // Animate secondary elements for active node
        const animateSecondary = () => {
            // Reset all
            secondaryAnims.forEach(anim => {
                anim.scale.setValue(0);
                anim.opacity.setValue(0);
                anim.translateY.setValue(20);
            });

            // Stagger animate in
            secondaryAnims.forEach((anim, index) => {
                Animated.sequence([
                    Animated.delay(300 + index * 100),
                    Animated.parallel([
                        Animated.spring(anim.scale, {
                            toValue: 1,
                            friction: 8,
                            tension: 40,
                            useNativeDriver: true,
                        }),
                        Animated.timing(anim.opacity, {
                            toValue: 1,
                            duration: 300,
                            useNativeDriver: true,
                        }),
                        Animated.spring(anim.translateY, {
                            toValue: 0,
                            friction: 8,
                            tension: 40,
                            useNativeDriver: true,
                        }),
                    ]),
                ]).start();
            });
        };

        // Animate text
        const animateText = () => {
            textFade.setValue(0);
            textSlide.setValue(20);
            Animated.parallel([
                Animated.timing(textFade, {
                    toValue: 1,
                    duration: 400,
                    useNativeDriver: true,
                }),
                Animated.timing(textSlide, {
                    toValue: 0,
                    duration: 400,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                }),
            ]).start();
        };

        // Progress bar
        progressAnim.setValue(0);
        Animated.timing(progressAnim, {
            toValue: 1,
            duration: ANIMATION_DURATION,
            easing: Easing.linear,
            useNativeDriver: false,
        }).start();

        animateNodes();
        animatePath();
        animateSecondary();
        animateText();

        // Auto-advance timer
        const timer = setTimeout(() => {
            if (currentIndex < FEATURES.length - 1) {
                // Fade out secondary before advancing
                secondaryAnims.forEach(anim => {
                    Animated.timing(anim.opacity, {
                        toValue: 0,
                        duration: 200,
                        useNativeDriver: true,
                    }).start();
                });

                setTimeout(() => {
                    setCurrentIndex(currentIndex + 1);
                }, 200);
            }
        }, ANIMATION_DURATION);

        return () => clearTimeout(timer);
    }, [currentIndex]);

    const handleGetStarted = () => {
        onComplete?.();
    };

    const handleSkip = () => {
        onComplete?.();
    };

    // Node positions for S-curve layout
    const getNodePosition = (index) => {
        // Vertically stretched S-curve
        const verticalSpacing = (height - 280) / (FEATURES.length + 1); // More vertical stretch
        const topOffset = 50 + insets.top;

        // Account for active node size + floating elements so nothing gets cut off
        const edgePadding = ACTIVE_NODE_SIZE / 2 + 35; // Half of active node + space for floating elements

        return {
            top: topOffset + (index + 1) * verticalSpacing - NODE_SIZE / 2,
            left: index % 2 === 0 ? edgePadding - NODE_SIZE / 2 : width - edgePadding - NODE_SIZE / 2,
        };
    };

    // Render a single feature node
    const renderNode = (feature, index) => {
        const isActive = index === currentIndex;
        const isCompleted = index < currentIndex;
        const position = getNodePosition(index);
        const anim = nodeAnims[index];
        const nodeSize = isActive ? ACTIVE_NODE_SIZE : NODE_SIZE;

        return (
            <Animated.View
                key={feature.id}
                style={[
                    styles.nodeContainer,
                    {
                        position: 'absolute',
                        top: position.top - (isActive ? (ACTIVE_NODE_SIZE - NODE_SIZE) / 2 : 0),
                        left: position.left - (isActive ? (ACTIVE_NODE_SIZE - NODE_SIZE) / 2 : 0),
                        width: nodeSize,
                        height: nodeSize,
                        opacity: anim.opacity,
                        transform: [{ scale: anim.scale }],
                    },
                ]}
            >
                {/* Glow effect for active */}
                {isActive && (
                    <Animated.View
                        style={[
                            styles.nodeGlow,
                            {
                                backgroundColor: feature.nodeColor,
                                opacity: anim.glow.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0, 0.3],
                                }),
                            },
                        ]}
                    />
                )}

                {/* Node circle */}
                <View
                    style={[
                        styles.nodeCircle,
                        {
                            backgroundColor: feature.iconBg,
                            borderColor: feature.nodeColor,
                            borderWidth: isActive ? 3 : 2,
                            width: nodeSize,
                            height: nodeSize,
                            borderRadius: nodeSize / 2,
                        },
                    ]}
                >
                    {/* Asset rendering based on type */}
                    {feature.assetType === 'emoji' && (
                        <Text style={[styles.nodeEmoji, { fontSize: isActive ? 50 : 35 }]}>
                            {feature.emoji}
                        </Text>
                    )}
                    {feature.assetType === 'image' && feature.image && (
                        <Image
                            source={feature.image}
                            style={[styles.nodeImage, { width: isActive ? 60 : 40, height: isActive ? 60 : 40 }]}
                            resizeMode="contain"
                        />
                    )}
                    {feature.assetType === 'svg' && (
                        <View style={[styles.gamesNodeContainer, { flexDirection: 'column', gap: isActive ? 4 : 2 }]}>
                            {/* Top row - Wordle W */}
                            <View style={[styles.gameIconWrapper, { backgroundColor: '#6AAA64', width: isActive ? 28 : 20, height: isActive ? 28 : 20, borderRadius: isActive ? 6 : 4 }]}>
                                <Text style={{ color: '#FFFFFF', fontSize: isActive ? 16 : 11, fontWeight: '800' }}>W</Text>
                            </View>
                            {/* Bottom row - Jigsaw & Tic Tac Toe */}
                            <View style={{ flexDirection: 'row', gap: isActive ? 4 : 2 }}>
                                {/* Jigsaw Puzzle */}
                                <View style={[styles.gameIconWrapper, { backgroundColor: '#FF8A65', width: isActive ? 28 : 20, height: isActive ? 28 : 20, borderRadius: isActive ? 6 : 4 }]}>
                                    <Svg width={isActive ? 16 : 11} height={isActive ? 16 : 11} viewBox="0 0 24 24" fill="none">
                                        <Path
                                            d="M20 11V7a2 2 0 00-2-2h-3.5a2.5 2.5 0 110-5 2.5 2.5 0 110 5H11a2 2 0 00-2 2v3.5a2.5 2.5 0 11-5 0 2.5 2.5 0 115 0V14a2 2 0 002 2h3.5a2.5 2.5 0 110 5 2.5 2.5 0 110-5H18a2 2 0 002-2v-3z"
                                            fill="#FFFFFF"
                                        />
                                    </Svg>
                                </View>
                                {/* Tic Tac Toe */}
                                <View style={[styles.gameIconWrapper, { backgroundColor: '#26A69A', width: isActive ? 28 : 20, height: isActive ? 28 : 20, borderRadius: isActive ? 6 : 4 }]}>
                                    <Svg width={isActive ? 16 : 11} height={isActive ? 16 : 11} viewBox="0 0 24 24" fill="none">
                                        <Path
                                            d="M8 4v16M16 4v16M4 8h16M4 16h16"
                                            stroke="#FFFFFF"
                                            strokeWidth={2.5}
                                            strokeLinecap="round"
                                        />
                                    </Svg>
                                </View>
                            </View>
                        </View>
                    )}
                    {feature.assetType === 'images' && (
                        <Text style={[styles.nodeEmoji, { fontSize: isActive ? 50 : 35 }]}>🔥</Text>
                    )}

                    {/* Completed checkmark */}
                    {isCompleted && (
                        <View style={styles.checkmarkBadge}>
                            <Text style={styles.checkmark}>✓</Text>
                        </View>
                    )}
                </View>

                {/* Secondary floating elements for active node */}
                {isActive && feature.secondaryEmojis && feature.secondaryEmojis.map((emoji, i) => {
                    const positions = [
                        { top: -12, left: -15 },
                        { top: -8, right: -18 },
                        { bottom: -10, left: -12 },
                        { bottom: -5, right: -15 },
                    ];
                    return (
                        <Animated.View
                            key={i}
                            style={[
                                styles.floatingEmoji,
                                positions[i],
                                {
                                    opacity: secondaryAnims[i].opacity,
                                    transform: [
                                        { scale: secondaryAnims[i].scale },
                                        { translateY: secondaryAnims[i].translateY },
                                    ],
                                },
                            ]}
                        >
                            <Text style={styles.floatingEmojiText}>{emoji}</Text>
                        </Animated.View>
                    );
                })}

                {/* Topic images for active topics node */}
                {isActive && feature.topicImages && feature.topicImages.map((item, i) => (
                    <Animated.View
                        key={i}
                        style={[
                            styles.floatingImage,
                            item.position,
                            {
                                opacity: secondaryAnims[i]?.opacity || 0,
                                transform: [
                                    { scale: secondaryAnims[i]?.scale || 0 },
                                    { translateY: secondaryAnims[i]?.translateY || 0 },
                                ],
                            },
                        ]}
                    >
                        <Image source={item.source} style={styles.topicImage} resizeMode="contain" />
                    </Animated.View>
                ))}

                {/* Label on opposite side of node (in the valley) - shows for active and completed nodes */}
                {(isActive || isCompleted) && (
                    <View
                        style={[
                            styles.nodeLabelContainer,
                            {
                                // Position on the opposite side of the node
                                left: index % 2 === 0 ? NODE_SIZE + 15 : undefined,
                                right: index % 2 === 0 ? undefined : NODE_SIZE + 15,
                            },
                        ]}
                    >
                        <Text
                            style={[
                                styles.nodeLabel,
                                { textAlign: index % 2 === 0 ? 'left' : 'right' },
                            ]}
                        >
                            {feature.title}
                        </Text>
                        <Text
                            style={[
                                styles.nodeSublabel,
                                { textAlign: index % 2 === 0 ? 'left' : 'right' },
                            ]}
                        >
                            {feature.subtitle}
                        </Text>
                    </View>
                )}
            </Animated.View>
        );
    };

    // S-curve path SVG
    const renderPath = () => {
        const points = FEATURES.map((_, i) => getNodePosition(i));

        // Create S-curve path connecting nodes
        let pathD = `M ${points[0].left + NODE_SIZE / 2} ${points[0].top + NODE_SIZE / 2}`;

        for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const prevX = prev.left + NODE_SIZE / 2;
            const prevY = prev.top + NODE_SIZE / 2;
            const currX = curr.left + NODE_SIZE / 2;
            const currY = curr.top + NODE_SIZE / 2;

            // Bezier curve control points for smooth S
            const midY = (prevY + currY) / 2;
            pathD += ` C ${prevX} ${midY}, ${currX} ${midY}, ${currX} ${currY}`;
        }

        return (
            <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
                {/* Background path (gray) */}
                <Path
                    d={pathD}
                    stroke="rgba(0,0,0,0.1)"
                    strokeWidth={3}
                    fill="none"
                    strokeLinecap="round"
                />
                {/* Animated progress path */}
                <AnimatedPath
                    d={pathD}
                    stroke={currentFeature.nodeColor}
                    strokeWidth={3}
                    fill="none"
                    strokeLinecap="round"
                    pathProgress={pathProgress}
                />
            </Svg>
        );
    };

    // Animated path component
    const AnimatedPath = ({ d, stroke, strokeWidth, fill, strokeLinecap, pathProgress }) => {
        const [pathLength, setPathLength] = useState(0);
        const pathRef = useRef(null);

        const animatedDashOffset = pathProgress.interpolate({
            inputRange: [0, 1],
            outputRange: [pathLength, 0],
        });

        return (
            <Path
                ref={pathRef}
                d={d}
                stroke={stroke}
                strokeWidth={strokeWidth}
                fill={fill}
                strokeLinecap={strokeLinecap}
                strokeDasharray={pathLength}
                strokeDashoffset={pathLength * (1 - (currentIndex + 1) / FEATURES.length)}
                onLayout={() => {
                    if (pathRef.current) {
                        // Approximate path length
                        setPathLength(height);
                    }
                }}
            />
        );
    };

    const progressWidth = progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#FFF9F5', '#FFE4E4']}
                style={styles.gradient}
            />

            {/* Skip Button */}
            <TouchableOpacity
                style={[styles.skipButton, { top: insets.top + 16 }]}
                onPress={handleSkip}
            >
                <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>

            {/* S-Curve Path */}
            {renderPath()}

            {/* Feature Nodes */}
            {FEATURES.map((feature, index) => renderNode(feature, index))}


            {/* Bottom Section */}
            <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 24 }]}>
                {/* Progress Dots */}
                <View style={styles.dotsContainer}>
                    {FEATURES.map((feature, index) => (
                        <View key={index} style={styles.dotWrapper}>
                            <View
                                style={[
                                    styles.dot,
                                    { backgroundColor: index <= currentIndex ? feature.nodeColor : 'rgba(0,0,0,0.1)' },
                                ]}
                            />
                            {index === currentIndex && (
                                <Animated.View
                                    style={[
                                        styles.dotProgress,
                                        { width: progressWidth, backgroundColor: feature.nodeColor },
                                    ]}
                                />
                            )}
                        </View>
                    ))}
                </View>

                {/* Get Started Button */}
                <TouchableOpacity
                    style={styles.ctaButton}
                    onPress={handleGetStarted}
                    activeOpacity={0.9}
                >
                    <Text style={styles.ctaText}>Get Started</Text>
                    <Text style={styles.arrowIcon}>→</Text>
                </TouchableOpacity>

                {/* Social Proof */}
                <View style={styles.socialProof}>
                    <View style={styles.avatarStack}>
                        <View style={[styles.avatar, { backgroundColor: '#FF6B9D' }]} />
                        <View style={[styles.avatar, { backgroundColor: '#5BB5A6', marginLeft: -8 }]} />
                        <View style={[styles.avatar, { backgroundColor: '#F4A261', marginLeft: -8 }]} />
                    </View>
                    <Text style={styles.socialText}>Join 10,000+ couples</Text>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    gradient: {
        ...StyleSheet.absoluteFillObject,
    },
    skipButton: {
        position: 'absolute',
        right: 24,
        zIndex: 100,
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    skipText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    // Node styles
    nodeContainer: {
        zIndex: 10,
        alignItems: 'center',
    },
    nodeGlow: {
        position: 'absolute',
        width: '150%',
        height: '150%',
        borderRadius: 100,
        top: '-25%',
        left: '-25%',
    },
    nodeCircle: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 6,
    },
    nodeEmoji: {
        // fontSize set dynamically
    },
    nodeImage: {
        // dimensions set dynamically
    },
    gamesNodeContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    gameIconWrapper: {
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 3,
    },
    checkmarkBadge: {
        position: 'absolute',
        bottom: -5,
        right: -5,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#22C55E',
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkmark: {
        color: 'white',
        fontSize: 14,
        fontWeight: '700',
    },
    nodeLabelContainer: {
        position: 'absolute',
        top: '50%',
        marginTop: -25, // Center vertically with the node
        width: 140,
    },
    nodeLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text,
        letterSpacing: -0.3,
    },
    nodeSublabel: {
        fontSize: 12,
        fontWeight: '500',
        color: colors.textSecondary,
        marginTop: 2,
    },
    floatingEmoji: {
        position: 'absolute',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 16,
        padding: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    floatingEmojiText: {
        fontSize: 18,
    },
    floatingImage: {
        position: 'absolute',
        width: 40,
        height: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 20,
        padding: 4,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    topicImage: {
        width: 28,
        height: 28,
    },
    // Text styles
    textContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: colors.text,
        textAlign: 'center',
        marginBottom: 8,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
    },
    // Bottom section
    bottomSection: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 24,
        alignItems: 'center',
    },
    dotsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 16,
        gap: 8,
    },
    dotWrapper: {
        width: 48,
        height: 4,
        borderRadius: 2,
        overflow: 'hidden',
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
    },
    dot: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 2,
    },
    dotProgress: {
        position: 'absolute',
        height: '100%',
        borderRadius: 2,
    },
    ctaButton: {
        width: '100%',
        backgroundColor: colors.primary,
        paddingVertical: 18,
        borderRadius: 32,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
        marginBottom: 20,
    },
    ctaText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    arrowIcon: {
        fontSize: 20,
        color: '#FFFFFF',
    },
    socialProof: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    avatarStack: {
        flexDirection: 'row',
    },
    avatar: {
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: 'white',
    },
    socialText: {
        fontSize: 14,
        color: colors.textSecondary,
        fontWeight: '500',
    },
});

export default AnimatedOnboardingScreen;
