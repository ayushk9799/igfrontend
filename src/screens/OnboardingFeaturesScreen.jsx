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
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Text as SvgText } from 'react-native-svg';
import { fontFamily, fontWeight } from '../constants/fonts';
import * as Haptics from 'expo-haptics';
import { translateUiText } from '../i18n/uiTranslation';
import useReducedMotion from '../hooks/useReducedMotion';

const { width, height } = Dimensions.get('window');

const FEATURES = [
    {
        id: 'mood',
        title: "Mood",
        copy: 'Share your vibe\nwith penguin moods',
        icon: '♥',
        iconColor: '#7855D9',
        image: require('../../assets/onbording/mood.png'),
    },
    {
        id: 'scribble',
        title: "Scribble",
        copy: 'Send cute scribbles\nand love notes.',
        icon: '✎',
        iconColor: '#F15F70',
        image: require('../../assets/onbording/scribble.png'),
    },
    {
        id: 'games',
        title: "Games",
        copy: 'Wordle, TicTacToe,\nJigsaw and more.',
        icon: '⌘',
        iconColor: '#FF844B',
        image: require('../../assets/onbording/games.png'),
    },
    {
        id: 'questions',
        title: "Questions",
        copy: 'Answer daily questions\nand go deeper.',
        icon: '?',
        iconColor: '#8060D7',
        image: require('../../assets/onbording/questions.png'),
    },
];

const OnboardingFeaturesScreen = ({ onComplete }) => {
    const insets = useSafeAreaInsets();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const featureAnims = useRef(FEATURES.map(() => new Animated.Value(0))).current;
    const reducedMotion = useReducedMotion();

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: reducedMotion ? 0 : 400,
                useNativeDriver: true,
            }),
            Animated.stagger(
                reducedMotion ? 0 : 90,
                featureAnims.map((anim) =>
                    Animated.timing(anim, {
                        toValue: 1,
                        duration: reducedMotion ? 0 : 360,
                        useNativeDriver: true,
                    })
                )
            ),
        ]).start();
    }, [fadeAnim, featureAnims, reducedMotion]);

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
                            <Text style={styles.titlePrimary}>{translateUiText("Share little")}</Text>
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
                                >{translateUiText("moments together.")}</SvgText>
                            </Svg>
                            <View style={styles.titleDivider}>
                                <View style={styles.dividerLine} />
                                <Text style={styles.dividerHeart}>♡</Text>
                                <View style={styles.dividerLine} />
                            </View>
                        </View>

                        <View style={styles.featuresContainer}>
                            <View style={styles.featuresGrid}>
                                {FEATURES.map((feature, index) => (
                                    <Animated.View
                                        key={feature.id}
                                        style={[
                                            styles.featureCard,
                                            {
                                                opacity: featureAnims[index],
                                                transform: [{
                                                    translateY: featureAnims[index].interpolate({
                                                        inputRange: [0, 1],
                                                        outputRange: [16, 0],
                                                    }),
                                                }],
                                            },
                                        ]}
                                    >
                                        <View
                                            style={[
                                                styles.featureIconContainer,
                                                { backgroundColor: feature.iconColor },
                                            ]}
                                        >
                                            <Text style={styles.featureIcon}>{feature.icon}</Text>
                                        </View>
                                        <View style={styles.featureImageWrapper}>
                                            <Image
                                                source={feature.image}
                                                style={styles.featureImage}
                                                resizeMode="contain"
                                            />
                                        </View>
                                        <Text style={styles.featureTitle}>{translateUiText(feature.title)}</Text>
                                        <Text style={styles.featureCopy}>{translateUiText(feature.copy)}</Text>
                                    </Animated.View>
                                ))}
                            </View>
                        </View>
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
        paddingHorizontal: 20,
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
        gap: 15,
    },
    dividerLine: {
        width: 62,
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
    featuresContainer: {
        flex: 1,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'flex-start',
        marginTop: height < 720 ? 6 : 10,
    },
    featuresGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: 16,
        width: '100%',
        maxWidth: 392,
    },
    featureCard: {
        width: (Math.min(width, 432) - 56) / 2,
        height: height < 760 ? 184 : 226,
        backgroundColor: 'rgba(255, 255, 255, 0.56)',
        borderRadius: 18,
        borderWidth: 1.2,
        borderColor: 'rgba(255, 255, 255, 0.92)',
        paddingHorizontal: 10,
        paddingTop: height < 760 ? 12 : 14,
        paddingBottom: height < 760 ? 4 : 6,
        alignItems: 'center',
        shadowColor: '#B580D9',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 2,
    },
    featureIconContainer: {
        position: 'absolute',
        top: 13,
        left: 13,
        width: 34,
        height: 34,
        borderRadius: 17,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 4,
        elevation: 3,
        zIndex: 2,
    },
    featureIcon: {
        color: '#FFFFFF',
        fontFamily: fontFamily.bold,
        fontSize: 18,
        fontWeight: fontWeight('700'),
        lineHeight: 22,
    },
    featureTitle: {
        marginTop: height < 760 ? 0 : 2,
        fontFamily: fontFamily.bold,
        fontSize: width < 380 ? 15 : 17,
        lineHeight: width < 380 ? 19 : 21,
        fontWeight: fontWeight('700'),
        color: '#070E33',
        textAlign: 'center',
    },
    featureImageWrapper: {
        width: '100%',
        height: height < 760 ? 94 : 122,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: height < 760 ? 14 : 20,
    },
    featureImage: {
        width: '112%',
        height: '112%',
    },
    featureCopy: {
        fontFamily: fontFamily.medium,
        fontSize: width < 380 ? 11 : 13,
        lineHeight: width < 380 ? 15 : 17,
        color: '#586071',
        textAlign: 'center',
        fontWeight: fontWeight('500'),
        marginTop: 4,
    },
    featuresFooter: {
        marginTop: height < 720 ? 12 : 20,
        color: '#202742',
        fontFamily: fontFamily.medium,
        fontSize: width < 380 ? 13 : 15,
        textAlign: 'center',
        fontWeight: fontWeight('600'),
    },
    copyHeart: {
        color: '#FF6B82',
    },
    footer: {
        paddingHorizontal: 26,
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
});

export default OnboardingFeaturesScreen;
