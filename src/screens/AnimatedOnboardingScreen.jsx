import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Dimensions,
    Image,
    Platform,
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

import * as Haptics from 'expo-haptics';
import { translateUiTemplate, translateUiText } from '../i18n/uiTranslation';
import useReducedMotion from '../hooks/useReducedMotion';

const { width, height } = Dimensions.get('window');

const AnimatedOnboardingScreen = ({ onComplete }) => {
    const insets = useSafeAreaInsets();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const floatAnim = useRef(new Animated.Value(0)).current;
    const reducedMotion = useReducedMotion();

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: reducedMotion ? 0 : 400,
            useNativeDriver: true,
        }).start();

        const floatLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(floatAnim, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: true,
                }),
                Animated.timing(floatAnim, {
                    toValue: 0,
                    duration: 1500,
                    useNativeDriver: true,
                }),
            ])
        );

        if (!reducedMotion) floatLoop.start();

        return () => floatLoop.stop();
    }, [fadeAnim, floatAnim, reducedMotion]);

    const handleNext = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onComplete?.();
    };

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
                <View
                    style={[
                        styles.card,
                        {
                            paddingTop: insets.top + 4,
                            paddingBottom: insets.bottom + 16
                                + (Platform.OS === 'android' ? 12 : 0),
                        },
                    ]}
                >
                    <View style={styles.header}>
                        <Image
                            source={require('../../assets/images/penguin-text-logo.png')}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                    </View>

                    <Animated.View
                        style={[
                            styles.content,
                            {
                                opacity: fadeAnim,
                                transform: [{
                                    translateY: fadeAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [12, 0],
                                    }),
                                }],
                            },
                        ]}
                    >
                        <View style={styles.titleBlock}>
                            <Text style={styles.titlePrimary}>{translateUiText("Stay close,")}</Text>
                            <Svg height={width < 380 ? 42 : 50} width={width - 40} style={styles.gradientTitle}>
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
                                    fontSize={width < 380 ? 30 : 35}
                                    fontWeight={fontWeight('700')}
                                    stroke="url(#titleGrad)"
                                    strokeWidth={0.15}
                                    textAnchor="middle"
                                    x={(width - 40) / 2}
                                    y={width < 380 ? 32 : 38}
                                >{translateUiText("even on busy days.")}</SvgText>
                            </Svg>
                            <View style={styles.titleDivider}>
                                <View style={styles.dividerLine} />
                                <Text style={styles.dividerHeart}>♡</Text>
                                <View style={styles.dividerLine} />
                            </View>
                        </View>

                        <Animated.View
                            style={[
                                styles.mascotStage,
                                {
                                    transform: [{
                                        translateY: floatAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [0, -8],
                                        }),
                                    }],
                                },
                            ]}
                        >
                            <Svg width="100%" height="100%" viewBox="0 0 330 330" style={StyleSheet.absoluteFill}>
                                <Circle cx="165" cy="165" r="153" fill="rgba(243, 214, 238, 0.45)" stroke="rgba(255,255,255,0.85)" strokeWidth="2" />
                                <Circle cx="165" cy="165" r="120" fill="rgba(248, 225, 244, 0.3)" />
                            </Svg>
                            <View style={styles.sparkleOne} />
                            <View style={styles.sparkleTwo} />
                            <View style={styles.sparkleThree} />
                            <View style={styles.sparkleFour} />

                            <View style={styles.mascotClip}>
                                <Image
                                    source={require('../../assets/onbording/onbording1-muscot.png')}
                                    style={styles.mascot}
                                    resizeMode="contain"
                                />
                            </View>
                        </Animated.View>

                        <View style={styles.badgeRow}>
                            <View style={styles.moodBadge}>
                                <Text style={styles.badgeIcon}>💗</Text>
                                <Text style={[styles.badgeText, styles.badgeTextYou]}>{translateUiText("You: Cuddly")}</Text>
                            </View>
                            <View style={styles.moodBadge}>
                                <Text style={styles.badgeIcon}>🌸</Text>
                                <Text style={[styles.badgeText, styles.badgeTextPartner]}>{translateUiText("Partner: Relaxed")}</Text>
                            </View>
                        </View>

                        <Text style={styles.copyText}>{translateUiTemplate("Share how you feel and understand{{0}}each other better, every day.", ['\n'])}<Text style={styles.copyHeart}>💜</Text>
                        </Text>
                    </Animated.View>

                    <View style={styles.footer}>
                        <TouchableOpacity activeOpacity={0.86} onPress={handleNext} style={styles.nextButtonShadow}>
                            <LinearGradient
                                colors={['#FF6B82', '#F45170']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.nextButton}
                            >
                                <Text style={styles.nextText}>{translateUiText("Next")}</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                    </View>
                </View>
            </LinearGradient>
        </View>
    );
};

const mascotSize = Math.min(width - 24, height * 0.43);

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
        backgroundColor: 'transparent',
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
        marginTop: -8,
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
        marginTop: 6,
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
        fontSize: 16,
        lineHeight: 18,
    },
    mascotStage: {
        width: mascotSize,
        height: mascotSize,
        borderRadius: mascotSize / 2,
        marginTop: height < 720 ? 4 : 6,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    mascotClip: {
        width: '92.5%',
        aspectRatio: 1,
        borderRadius: 999,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    mascot: {
        width: '100%',
        height: '100%',
    },
    sparkleOne: {
        position: 'absolute',
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#FFFFFF',
        right: 42,
        top: 28,
        opacity: 0.85,
    },
    sparkleTwo: {
        position: 'absolute',
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: '#FFFFFF',
        right: 24,
        top: 110,
        opacity: 0.7,
    },
    sparkleThree: {
        position: 'absolute',
        width: 5,
        height: 5,
        borderRadius: 3,
        backgroundColor: '#FFFFFF',
        left: 38,
        bottom: 72,
        opacity: 0.9,
    },
    sparkleFour: {
        position: 'absolute',
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#FFFFFF',
        right: 60,
        bottom: 52,
        opacity: 0.65,
    },
    badgeRow: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        marginTop: height < 720 ? 0 : 4,
    },
    moodBadge: {
        flex: 1,
        maxWidth: 172,
        minHeight: 48,
        borderRadius: 26,
        backgroundColor: 'rgba(255,255,255,0.72)',
        borderWidth: 1.4,
        borderColor: 'rgba(255,255,255,0.95)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        shadowColor: '#B580D9',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 3,
    },
    badgeIcon: {
        fontFamily: fontFamily.regular,
        fontSize: 20,
        marginRight: 6,
    },
    badgeText: {
        fontFamily: fontFamily.bold,
        fontSize: width < 380 ? 13 : 15,
        lineHeight: 18,
        fontWeight: fontWeight('700'),
    },
    badgeTextYou: {
        color: '#F45F83',
    },
    badgeTextPartner: {
        color: '#7B55D9',
    },
    copyText: {
        maxWidth: 340,
        marginTop: height < 720 ? 12 : 18,
        color: '#202742',
        fontFamily: fontFamily.medium,
        fontSize: width < 380 ? 13 : 15,
        lineHeight: width < 380 ? 20 : 22,
        textAlign: 'center',
        fontWeight: fontWeight('500'),
        letterSpacing: 0,
    },
    copyHeart: {
        color: '#7B55D9',
    },
    footer: {
        paddingHorizontal: 26,
        alignItems: 'center',
        paddingTop: 8,
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
});

export default AnimatedOnboardingScreen;
