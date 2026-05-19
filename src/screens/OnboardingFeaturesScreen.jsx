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
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Text as SvgText } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

const FEATURES = [
    {
        id: 'mood',
        title: 'Mood',
        copy: 'Share your vibe\nwith penguin moods',
        icon: '♥',
        iconColor: '#7855D9',
        image: require('../../assets/onbording/mood.png'),
    },
    {
        id: 'scribble',
        title: 'Scribble',
        copy: 'Send cute scribbles\nand love notes.',
        icon: '✎',
        iconColor: '#F15F70',
        image: require('../../assets/onbording/scribble.png'),
    },
    {
        id: 'games',
        title: 'Games',
        copy: 'Wordle, TicTacToe,\nJigsaw and more.',
        icon: '⌘',
        iconColor: '#FF844B',
        image: require('../../assets/onbording/games.png'),
    },
    {
        id: 'questions',
        title: 'Questions',
        copy: 'Answer daily questions\nand go deeper.',
        icon: '?',
        iconColor: '#8060D7',
        image: require('../../assets/onbording/questions.png'),
    },
];

const OnboardingFeaturesScreen = ({ onComplete }) => {
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
                            <Text style={styles.titlePrimary}>Share little</Text>
                            <Svg height={width < 380 ? 39 : 43} width={width - 40}>
                                <Defs>
                                    <SvgGradient id="titleGrad" x1="0" y1="0" x2="1" y2="0">
                                        <Stop offset="0" stopColor="#F45F83" />
                                        <Stop offset="0.55" stopColor="#9B6BD4" />
                                        <Stop offset="1" stopColor="#6C63D9" />
                                    </SvgGradient>
                                </Defs>
                                <SvgText
                                    fill="url(#titleGrad)"
                                    fontSize={width < 380 ? 27 : 31}
                                    fontWeight="700"
                                    textAnchor="middle"
                                    x={(width - 40) / 2}
                                    y={width < 380 ? 32 : 36}
                                >
                                    moments together.
                                </SvgText>
                            </Svg>
                            <View style={styles.titleDivider}>
                                <View style={styles.dividerLine} />
                                <Text style={styles.dividerHeart}>♡</Text>
                                <View style={styles.dividerLine} />
                            </View>
                        </View>

                        <View style={styles.featuresContainer}>
                            <View style={styles.featuresGrid}>
                                {FEATURES.map((feature) => (
                                    <View key={feature.id} style={styles.featureCard}>
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
                                        <Text style={styles.featureTitle}>{feature.title}</Text>
                                        <Text style={styles.featureCopy}>{feature.copy}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    </Animated.View>

                    <View style={styles.footer}>
                        <TouchableOpacity activeOpacity={0.86} onPress={onComplete} style={styles.nextButtonShadow}>
                            <LinearGradient
                                colors={['#FF6B82', '#F45170']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.nextButton}
                            >
                                <Text style={styles.nextText}>Next</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <View style={styles.progressRow}>
                            <View style={styles.progressSegment} />
                            <View style={[styles.progressSegment, styles.progressSegmentActive]} />
                            <View style={styles.progressSegment} />
                        </View>
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
        fontSize: 14,
        fontWeight: '500',
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
        fontSize: width < 380 ? 28 : 32,
        lineHeight: width < 380 ? 35 : 39,
        fontWeight: '700',
        textAlign: 'center',
        letterSpacing: 0,
    },
    titleAccent: {
        color: '#F45F83',
        fontSize: width < 380 ? 30 : 33,
        lineHeight: width < 380 ? 36 : 39,
        fontWeight: '800',
        textAlign: 'center',
        letterSpacing: 0,
    },
    titleDivider: {
        marginTop: 8,
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
        fontSize: 22,
        lineHeight: 24,
    },
    featuresContainer: {
        flex: 1,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'flex-start',
        marginTop: height < 720 ? 12 : 20,
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
        height: height < 760 ? 174 : 208,
        backgroundColor: 'rgba(255, 255, 255, 0.56)',
        borderRadius: 18,
        borderWidth: 1.2,
        borderColor: 'rgba(255, 255, 255, 0.92)',
        paddingHorizontal: 10,
        paddingTop: 18,
        paddingBottom: 12,
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
        fontSize: 18,
        fontWeight: '700',
        lineHeight: 22,
    },
    featureTitle: {
        marginTop: height < 760 ? 0 : 2,
        fontSize: width < 380 ? 15 : 17,
        lineHeight: width < 380 ? 19 : 21,
        fontWeight: '700',
        color: '#070E33',
        textAlign: 'center',
    },
    featureImageWrapper: {
        width: '100%',
        height: height < 760 ? 102 : 132,
        justifyContent: 'center',
        alignItems: 'center',
    },
    featureImage: {
        width: '112%',
        height: '112%',
    },
    featureCopy: {
        fontSize: width < 380 ? 11 : 13,
        lineHeight: width < 380 ? 15 : 17,
        color: '#586071',
        textAlign: 'center',
        fontWeight: '500',
        marginTop: 4,
    },
    featuresFooter: {
        marginTop: height < 720 ? 12 : 20,
        color: '#202742',
        fontSize: width < 380 ? 13 : 15,
        textAlign: 'center',
        fontWeight: '600',
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
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: 0,
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

export default OnboardingFeaturesScreen;
