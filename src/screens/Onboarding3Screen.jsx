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
import Svg, {
    Defs,
    LinearGradient as SvgGradient,
    Path,
    Stop,
    Text as SvgText,
} from 'react-native-svg';
import { fontFamily, fontWeight } from '../constants/fonts';

const { width, height } = Dimensions.get('window');

const isCompact = height < 740;
const phoneWidth = Math.min(width - 48, isCompact ? height * 0.28 : height * 0.345, 342);
const phoneStageWidth = phoneWidth * 1.1;
const phoneHeight = phoneWidth * (843 / 562) * 1.24;
const widgetWidth = phoneWidth * 1.19;
const actionWidth = Math.min(width - 38, widgetWidth);

const Onboarding3Screen = ({ onComplete }) => {
    const insets = useSafeAreaInsets();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const phoneAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }),
            Animated.timing(phoneAnim, {
                toValue: 1,
                duration: 460,
                useNativeDriver: true,
            }),
        ]).start();
    }, [fadeAnim, phoneAnim]);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <LinearGradient
                colors={['#F9DCE8', '#FFF8FB', '#FFF6FA', '#F9D7F1']}
                locations={[0, 0.28, 0.74, 1]}
                start={{ x: 0.12, y: 0 }}
                end={{ x: 0.86, y: 1 }}
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
                            <Text style={styles.titlePrimary}>Stay close</Text>
                            <Svg height={width < 380 ? 44 : 50} width={width - 40} style={styles.gradientTitle}>
                                <Defs>
                                    <SvgGradient id="titleGrad3" x1="0" y1="0" x2="1" y2="0">
                                        <Stop offset="0" stopColor="#FF435F" />
                                        <Stop offset="0.52" stopColor="#D34AA2" />
                                        <Stop offset="1" stopColor="#6756D8" />
                                    </SvgGradient>
                                </Defs>
                                <SvgText
                                    fill="url(#titleGrad3)"
                                    fontFamily={fontFamily.extraBold}
                                    fontSize={width < 380 ? 25 : 29}
                                    fontWeight={fontWeight('700')}
                                    stroke="url(#titleGrad3)"
                                    strokeWidth={0.15}
                                    textAnchor="middle"
                                    x={(width - 40) / 2}
                                    y={width < 380 ? 31 : 36}
                                >
                                    from your home screen.
                                </SvgText>
                            </Svg>
                            <View style={styles.titleDivider}>
                                <View style={styles.dividerLine} />
                                <Text style={styles.dividerHeart}>♡</Text>
                                <View style={styles.dividerLine} />
                            </View>
                        </View>

                        <Animated.View
                            style={[
                                styles.phoneStage,
                                {
                                    transform: [{
                                        scale: phoneAnim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [0.96, 1],
                                        }),
                                    }],
                                },
                            ]}
                        >
                            <View style={styles.phoneMask}>
                                <Image
                                    source={require('../../assets/onbording/onboardin3-iphone.png')}
                                    style={styles.phoneImage}
                                    resizeMode="contain"
                                />
                            </View>
                            <View style={styles.widgetCardBorder}>
                                <LinearGradient
                                    colors={['rgba(255,255,255,0.8)', 'rgba(255,244,250,0.9)']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.widgetCard}
                                >
                                    <Image
                                        source={require('../../assets/onbording/onboarding3-mood.png')}
                                        style={styles.widgetMoodImage}
                                        resizeMode="contain"
                                    />
                                    <View style={styles.widgetCopy}>
                                        <Text style={styles.widgetTitle}>Rajiv & Love</Text>
                                        <View style={styles.widgetMiniDivider}>
                                            <View style={styles.widgetDividerLine} />
                                            <Text style={styles.widgetDividerHeart}>♥</Text>
                                            <View style={styles.widgetDividerLine} />
                                        </View>
                                        <View style={styles.widgetPill}>
                                            <Text style={styles.widgetPillText}>💗 You: Cuddly 💗</Text>
                                        </View>
                                        <View style={[styles.widgetPill, styles.widgetPillPartner]}>
                                            <Text style={[styles.widgetPillText, styles.widgetPillTextPartner]}>🌸 Partner: Relaxed 🌸</Text>
                                        </View>
                                    </View>
                                    <View style={styles.widgetMessageWrap}>
                                        <View style={styles.widgetBubble}>
                                            <Text style={styles.widgetBubbleHeart}>♥</Text>
                                        </View>
                                        <View style={styles.widgetMessageTextWrap}>
                                            <Text style={styles.widgetMessage}>Thinking of you today 💕</Text>
                                            <Text style={styles.widgetTime}>Updated just now</Text>
                                        </View>
                                    </View>
                                </LinearGradient>
                            </View>
                        </Animated.View>
                    </Animated.View>

                    <View style={styles.footer}>
                        <View style={styles.noteCard}>
                            <LinearGradient
                                pointerEvents="none"
                                colors={[
                                    'rgba(255,255,255,0.86)',
                                    'rgba(255,246,250,0.58)',
                                    'rgba(255,255,255,0.76)',
                                ]}
                                locations={[0, 0.5, 1]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.noteCardGlass}
                            />
                            <LinearGradient
                                colors={['#FF8DA2', '#FF657F']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.noteIcon}
                            >
                                <Text style={styles.sparkleText}>✧</Text>
                            </LinearGradient>
                            <Text style={styles.noteText}>
                                See your partner's mood, latest note{'\n'}
                                and <Text style={styles.noteAccent}>stay connected</Text> - instantly.
                            </Text>
                            <Text style={styles.noteHeart}>♡</Text>
                        </View>

                        <TouchableOpacity activeOpacity={0.86} onPress={onComplete} style={styles.nextButtonShadow}>
                            <LinearGradient
                                colors={['#FF5F78', '#FF3F5C']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.nextButton}
                            >
                                <Text style={styles.nextText}>Get Started</Text>
                                <Svg width={23} height={16} viewBox="0 0 25 18" style={styles.nextArrow}>
                                    <Path
                                        d="M1 9h21M15 1l8 8-8 8"
                                        fill="none"
                                        stroke="#FFFFFF"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2.6}
                                    />
                                </Svg>
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F6D4EA',
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
    content: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    titleBlock: {
        alignItems: 'center',
        marginTop: height < 720 ? 0 : 2,
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
    phoneStage: {
        width: phoneStageWidth,
        height: phoneHeight,
        // marginTop: height < 720 ? 4 : 8,
        marginTop : -5,
        alignItems: 'center',
        justifyContent: 'center',
        // backgroundColor : 'black',
        // padding : 10
    },
    phoneMask: {
        width: '100%',
        height: '100%',
        borderRadius: phoneWidth * 0.12,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        // backgroundColor : 'red'
    },
    phoneImage: {
        // width: '116%',
        height: '100%',
        padding: 10,
        resizeMode : "cover"
    },
    widgetCardBorder: {
        position: 'absolute',
        top: phoneHeight * 0.22,
        left: (phoneStageWidth - widgetWidth) / 2,
        width: widgetWidth,
        height: phoneHeight * 0.32,
        borderRadius: phoneWidth * 0.065,
        borderWidth: 1,
        borderColor: '#FF8DA1',
        backgroundColor: 'rgba(255,255,255,0.86)',
        overflow: 'hidden',
        shadowColor: '#B580D9',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 16,
        elevation: 6,
    },
    widgetCard: {
        flex: 1,
        borderRadius: phoneWidth * 0.062,
        overflow: 'hidden',
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingLeft: phoneWidth * 0.02,
        paddingRight: phoneWidth * 0.028,
        paddingTop: phoneHeight * 0.012,
        paddingBottom: phoneHeight * 0.01,
    },
    widgetMoodImage: {
        width: phoneWidth * 0.6,
        height: phoneHeight * 0.28,
        marginLeft: -phoneWidth * 0.025,
        marginTop: -phoneHeight * 0.034,
    },
    widgetCopy: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-start',
        marginLeft: -phoneWidth * 0.04,
        marginTop: phoneHeight * 0.005,
    },
    widgetTitle: {
        marginTop: phoneHeight * 0.022,
        color: '#071036',
        fontFamily: fontFamily.extraBold,
        fontSize: phoneWidth * 0.072,
        lineHeight: phoneWidth * 0.082,
        fontWeight: fontWeight('800'),
        textAlign: 'center',
    },
    widgetMiniDivider: {
        marginTop: phoneHeight * 0.006,
        marginBottom: phoneHeight * 0.012,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    widgetDividerLine: {
        width: phoneWidth * 0.095,
        height: 1.3,
        backgroundColor: 'rgba(255, 104, 139, 0.45)',
    },
    widgetDividerHeart: {
        color: '#FF506B',
        fontSize: phoneWidth * 0.029,
        lineHeight: phoneWidth * 0.032,
    },
    widgetPill: {
        minWidth: phoneWidth * 0.46,
        height: phoneHeight * 0.046,
        borderRadius: phoneHeight * 0.023,
        backgroundColor: 'rgba(255,255,255,0.9)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 11,
        marginBottom: phoneHeight * 0.009,
        borderWidth: 0.8,
        borderColor: 'rgba(255,152,178,0.28)',
    },
    widgetPillPartner: {
        backgroundColor: 'rgba(247,239,255,0.92)',
        borderColor: 'rgba(133,91,216,0.18)',
    },
    widgetPillText: {
        color: '#FF3358',
        fontFamily: fontFamily.bold,
        fontSize: phoneWidth * 0.035,
        lineHeight: phoneWidth * 0.04,
        fontWeight: fontWeight('700'),
    },
    widgetPillTextPartner: {
        color: '#6751B5',
    },
    widgetMessageWrap: {
        position: 'absolute',
        left: phoneWidth * 0.12,
        right: phoneWidth * 0.08,
        bottom: phoneHeight * 0.032,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    widgetBubble: {
        width: phoneWidth * 0.095,
        height: phoneWidth * 0.075,
        borderRadius: phoneWidth * 0.024,
        backgroundColor: 'rgba(255,255,255,0.92)',
        borderWidth: 0.8,
        borderColor: 'rgba(255,152,178,0.25)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    widgetBubbleHeart: {
        color: '#FF506B',
        fontFamily: fontFamily.extraBold,
        fontSize: phoneWidth * 0.041,
        lineHeight: phoneWidth * 0.046,
        fontWeight: fontWeight('800'),
    },
    widgetMessageTextWrap: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    widgetMessage: {
        color: '#071036',
        fontFamily: fontFamily.bold,
        fontSize: phoneWidth * 0.04,
        lineHeight: phoneWidth * 0.047,
        fontWeight: fontWeight('700'),
        textAlign: 'center',
    },
    widgetTime: {
        marginTop: phoneHeight * 0.002,
        color: '#7C8192',
        fontFamily: fontFamily.medium,
        fontSize: phoneWidth * 0.033,
        lineHeight: phoneWidth * 0.038,
        fontWeight: fontWeight('500'),
    },
    noteCard: {
        width: actionWidth,
        marginBottom: 10,
        minHeight: height < 720 ? 52 : 58,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.24)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.95)',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: height < 720 ? 8 : 10,
        shadowColor: '#B580D9',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 3,
        zIndex: 2,
        overflow: 'hidden',
    },
    noteCardGlass: {
        ...StyleSheet.absoluteFillObject,
    },
    noteIcon: {
        width: height < 720 ? 38 : 42,
        height: height < 720 ? 38 : 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    sparkleText: {
        color: '#FFFFFF',
        fontFamily: fontFamily.extraBold,
        fontSize: height < 720 ? 23 : 26,
        lineHeight: height < 720 ? 25 : 28,
        fontWeight: fontWeight('800'),
    },
    noteText: {
        flex: 1,
        color: '#071036',
        fontFamily: fontFamily.bold,
        fontSize: width < 380 ? 12 : 14,
        lineHeight: width < 380 ? 17 : 20,
        fontWeight: fontWeight('700'),
        letterSpacing: 0,
    },
    noteAccent: {
        color: '#E84275',
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
    },
    noteHeart: {
        marginLeft: 9,
        color: '#FF7895',
        fontFamily: fontFamily.regular,
        fontSize: height < 720 ? 26 : 30,
        lineHeight: height < 720 ? 28 : 32,
    },
    footer: {
        paddingHorizontal: 38,
        alignItems: 'center',
        paddingTop: 6,
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
