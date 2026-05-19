import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Dimensions,
    Image,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop, Text as SvgText } from 'react-native-svg';
import { fontFamily, fontWeight } from '../constants/fonts';

const { width, height } = Dimensions.get('window');

const FloatingHeart = ({ style, size = 26, delay = 0 }) => {
    const float = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(0.75)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.delay(delay),
                Animated.parallel([
                    Animated.timing(float, {
                        toValue: -10,
                        duration: 1400,
                        useNativeDriver: true,
                    }),
                    Animated.timing(opacity, {
                        toValue: 0.35,
                        duration: 1400,
                        useNativeDriver: true,
                    }),
                ]),
                Animated.parallel([
                    Animated.timing(float, {
                        toValue: 0,
                        duration: 1400,
                        useNativeDriver: true,
                    }),
                    Animated.timing(opacity, {
                        toValue: 0.75,
                        duration: 1400,
                        useNativeDriver: true,
                    }),
                ]),
            ]),
        );

        animation.start();
        return () => animation.stop();
    }, [delay, float, opacity]);

    return (
        <Animated.Text
            style={[
                styles.floatingHeart,
                style,
                {
                    fontSize: size,
                    opacity,
                    transform: [{ translateY: float }],
                },
            ]}
        >
            💗
        </Animated.Text>
    );
};

const Onboarding3Screen = ({ onComplete }) => {
    const insets = useSafeAreaInsets();
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
        }).start();
    }, [fadeAnim]);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <LinearGradient
                colors={['#F8D9EC', '#FFF7FA', '#FFF4F7', '#F7D8F2']}
                locations={[0, 0.34, 0.72, 1]}
                start={{ x: 0.25, y: 0 }}
                end={{ x: 0.75, y: 1 }}
                style={styles.page}
            >
                <View style={[styles.card, { paddingTop: insets.top + 4, paddingBottom: insets.bottom + 16 }]}>
                    <View style={styles.header}>
                        <Image
                            source={require('../../assets/images/penguin-text-logo.png')}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                    </View>

                    <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
                        <View style={styles.titleBlock}>
                            <Text style={styles.titlePrimary}>Build rituals,</Text>
                            <Svg height={width < 380 ? 32 : 36} width={width - 40} style={styles.gradientTitle}>
                                <Defs>
                                    <SvgGradient id="titleGrad" x1="0" y1="0" x2="1" y2="0">
                                        <Stop offset="0" stopColor="#F45F83" />
                                        <Stop offset="0.55" stopColor="#9B6BD4" />
                                        <Stop offset="1" stopColor="#6C63D9" />
                                    </SvgGradient>
                                </Defs>
                                <SvgText
                                    fill="url(#titleGrad)"
                                    fontFamily={fontFamily.extraBold}
                                    fontSize={width < 380 ? 27 : 31}
                                    fontWeight={fontWeight('900')}
                                    stroke="url(#titleGrad)"
                                    strokeWidth={1.2}
                                    textAnchor="middle"
                                    x={(width - 40) / 2}
                                    y={width < 380 ? 27 : 31}
                                >
                                    one moment at a time.
                                </SvgText>
                            </Svg>
                            <View style={styles.titleDivider}>
                                <View style={styles.dividerLine} />
                                <Text style={styles.dividerHeart}>♡</Text>
                                <View style={styles.dividerLine} />
                            </View>
                        </View>

                        <View style={styles.mascotStage}>
                            <Svg width="100%" height="100%" viewBox="0 0 330 330" style={StyleSheet.absoluteFill}>
                                <Circle cx="165" cy="165" r="153" fill="rgba(243, 214, 238, 0.45)" stroke="rgba(255,255,255,0.85)" strokeWidth="2" />
                                <Circle cx="165" cy="165" r="120" fill="rgba(248, 225, 244, 0.3)" />
                            </Svg>
                            <View style={styles.sparkleOne} />
                            <View style={styles.sparkleTwo} />
                            <View style={styles.sparkleThree} />
                            
                            <FloatingHeart style={styles.heartOne} size={28} />
                            <FloatingHeart style={styles.heartTwo} size={24} delay={350} />
                            <FloatingHeart style={styles.heartThree} size={22} delay={700} />

                            <Image
                                source={require('../../assets/penguinmoods/flirtatious_relaxed.png')}
                                style={styles.mascot}
                                resizeMode="contain"
                            />
                        </View>

                        <View style={styles.badgeRow}>
                            <View style={styles.moodBadge}>
                                <Text style={styles.badgeIcon}>💌</Text>
                                <Text style={[styles.badgeText, { color: '#F45F83' }]}>You: Playful</Text>
                            </View>
                            <View style={styles.moodBadge}>
                                <Text style={styles.badgeIcon}>💜</Text>
                                <Text style={[styles.badgeText, { color: '#7B55D9' }]}>Partner: Calm</Text>
                            </View>
                        </View>

                        <Text style={styles.copyText}>
                            Play, answer, draw, and keep your bond warm from anywhere. <Text style={styles.copyHeart}>♥</Text>
                        </Text>
                    </Animated.View>

                    <View style={styles.footer}>
                        <TouchableOpacity activeOpacity={0.86} onPress={onComplete} style={styles.nextButtonShadow}>
                            <LinearGradient
                                colors={['#FF6B82', '#F45170']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.nextButton}
                            >
                                <Text style={styles.nextText}>Start</Text>
                                <Text style={styles.nextArrow}>→</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <View style={styles.progressRow}>
                            <View style={styles.progressSegment} />
                            <View style={styles.progressSegment} />
                            <View style={[styles.progressSegment, styles.progressSegmentActive]} />
                        </View>
                    </View>
                </View>
            </LinearGradient>
        </View>
    );
};

const mascotSize = Math.min(width - 28, height * 0.46);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5C9EC',
    },
    page: {
        flex: 1,
    },
    card: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.48)',
        overflow: 'hidden',
    },
    header: {
        minHeight: 40,
        paddingHorizontal: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    logo: {
        width: 114,
        height: 34,
        marginLeft: -14,
    },
    skipText: {
        color: '#8A62D9',
        fontFamily: fontFamily.medium,
        fontSize: 14,
        fontWeight: fontWeight('500'),
    },
    content: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    titleBlock: {
        alignItems: 'center',
        marginTop: height < 720 ? 2 : 8,
    },
    titlePrimary: {
        color: '#070E33',
        fontFamily: fontFamily.extraBold,
        fontSize: width < 380 ? 28 : 32,
        lineHeight: width < 380 ? 32 : 36,
        fontWeight: fontWeight('800'),
        textAlign: 'center',
        letterSpacing: 0,
    },
    gradientTitle: {
        marginTop: -2,
    },
    titleAccent: {
        color: '#F45F83',
        fontFamily: fontFamily.extraBold,
        fontSize: width < 380 ? 30 : 33,
        lineHeight: width < 380 ? 36 : 39,
        fontWeight: fontWeight('800'),
        textAlign: 'center',
        letterSpacing: 0,
    },
    titleDivider: {
        marginTop: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    dividerLine: {
        width: 58,
        height: 2,
        borderRadius: 1,
        backgroundColor: 'rgba(255, 143, 171, 0.34)',
    },
    dividerHeart: {
        color: '#FF6B82',
        fontFamily: fontFamily.regular,
        fontSize: 22,
        lineHeight: 24,
    },
    mascotStage: {
        width: mascotSize,
        height: mascotSize,
        marginTop: height < 720 ? 8 : 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    mascot: {
        width: '108%',
        height: '78%',
        marginTop: height < 720 ? 14 : 26,
    },
    floatingHeart: {
        position: 'absolute',
        fontFamily: fontFamily.regular,
        textShadowColor: 'rgba(244, 95, 131, 0.25)',
        textShadowOffset: { width: 0, height: 4 },
        textShadowRadius: 8,
        zIndex: 3,
    },
    heartOne: {
        left: 64,
        top: 74,
    },
    heartTwo: {
        left: 28,
        top: 124,
    },
    heartThree: {
        left: 6,
        top: 192,
    },
    sparkleOne: {
        position: 'absolute',
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#FFFFFF',
        left: 86,
        top: 36,
        opacity: 0.82,
    },
    sparkleTwo: {
        position: 'absolute',
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: '#FFFFFF',
        right: 50,
        top: 102,
        opacity: 0.75,
    },
    sparkleThree: {
        position: 'absolute',
        width: 5,
        height: 5,
        borderRadius: 3,
        backgroundColor: '#FFFFFF',
        left: 26,
        bottom: 88,
        opacity: 0.9,
    },
    badgeRow: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
        marginTop: height < 720 ? -2 : 4,
    },
    moodBadge: {
        flex: 1,
        maxWidth: 228,
        minHeight: 54,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.72)',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.95)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 12,
        shadowColor: '#B580D9',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 14,
        elevation: 3,
    },
    badgeIcon: {
        fontFamily: fontFamily.regular,
        fontSize: 21,
        marginRight: 7,
    },
    badgeText: {
        fontFamily: fontFamily.bold,
        fontSize: width < 380 ? 13 : 15,
        lineHeight: 20,
        fontWeight: fontWeight('700'),
    },
    copyText: {
        maxWidth: 350,
        marginTop: height < 720 ? 16 : 22,
        color: '#202742',
        fontFamily: fontFamily.medium,
        fontSize: width < 380 ? 14 : 16,
        lineHeight: width < 380 ? 21 : 24,
        textAlign: 'center',
        fontWeight: fontWeight('500'),
        letterSpacing: -0.1,
    },
    copyHeart: {
        color: '#FF6B82',
    },
    footer: {
        paddingHorizontal: 38,
        alignItems: 'center',
    },
    nextButtonShadow: {
        width: '100%',
        borderRadius: 24,
        shadowColor: '#F45170',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.22,
        shadowRadius: 12,
        elevation: 4,
    },
    nextButton: {
        height: 48,
        borderRadius: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    nextText: {
        color: '#FFFFFF',
        fontFamily: fontFamily.extraBold,
        fontSize: 18,
        fontWeight: fontWeight('800'),
        letterSpacing: 0,
    },
    nextArrow: {
        position: 'absolute',
        right: 18,
        color: '#FFFFFF',
        fontFamily: fontFamily.regular,
        fontSize: 24,
        lineHeight: 26,
        fontWeight: fontWeight('300'),
    },
    progressRow: {
        marginTop: 24,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
    },
    progressSegment: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#E5DDF2',
    },
    progressSegmentActive: {
        backgroundColor: '#F95B72',
    },
});

export default Onboarding3Screen;
