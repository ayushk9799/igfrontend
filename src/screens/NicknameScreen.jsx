// Nickname Entry Screen - Pixel-Perfect Matching Login Theme
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    Image,
    Keyboard,
    LayoutAnimation,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    UIManager,
    View,
} from 'react-native';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { colors } from '../theme';
import { fontFamily, fontWeight } from '../constants/fonts';

const { width, height } = Dimensions.get('window');
const isCompactHeight = height < 760;
const navy = '#050E3E';

// Sparkle star component
const Sparkle = ({ x, y, size = 8, delay = 0 }) => {
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.delay(delay),
                Animated.timing(opacity, {
                    toValue: 0.8,
                    duration: 1200,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 0.12,
                    duration: 1200,
                    useNativeDriver: true,
                }),
                Animated.delay(800),
            ]),
        );

        animation.start();
        return () => animation.stop();
    }, [delay, opacity]);

    return (
        <Animated.View style={[styles.sparkle, { left: x, top: y, opacity }]}>
            <Svg width={size} height={size} viewBox="0 0 24 24">
                <Path
                    d="M12 0L14.59 8.41L24 12L14.59 15.59L12 24L9.41 15.59L0 12L9.41 8.41L12 0Z"
                    fill="rgba(255,255,255,0.9)"
                />
            </Svg>
        </Animated.View>
    );
};

// 3D Glassy Heart component for high fidelity matching of the screenshot
const BackgroundHeart3D = ({ x, y, size = 30, rotation = 0, opacity = 0.85 }) => (
    // Position, opacity, and rotation are instance-specific decorative values.
    // eslint-disable-next-line react-native/no-inline-styles
    <View style={{
        position: 'absolute',
        left: x,
        top: y,
        opacity: opacity,
        transform: [{ rotate: `${rotation}deg` }]
    }}>
        <Svg width={size} height={size} viewBox="0 0 24 24">
            <Defs>
                <SvgLinearGradient id={`heart3d-${size}-${x}`} x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0%" stopColor="#FFA6C9" />
                    <Stop offset="50%" stopColor="#FF6B99" />
                    <Stop offset="100%" stopColor="#E03A6C" />
                </SvgLinearGradient>
            </Defs>
            <Path
                fill={`url(#heart3d-${size}-${x})`}
                d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
            />
        </Svg>
    </View>
);

// Penguin wordmark from the brand asset
const BrandLogo = () => (
    <View style={styles.brandContainer}>
        <Image
            source={require('../../assets/images/penguin-text-logo.png')}
            style={styles.brandLogo}
            resizeMode="contain"
        />
    </View>
);

// 4-point sparkle star for footer
const MiniSparkle = () => (
    <Svg width={11} height={11} viewBox="0 0 24 24">
        <Path
            d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z"
            fill="#FFA6C9"
        />
    </Svg>
);

// Radiating pink sparkles flanking "What should we call you?"
const TitleSparkleLeft = () => (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" style={styles.titleSparkleLeft}>
        <Path
            d="M16 8L8 4"
            stroke="#FF8FAB"
            strokeWidth={3}
            strokeLinecap="round"
        />
        <Path
            d="M18 13H8"
            stroke="#FF8FAB"
            strokeWidth={3}
            strokeLinecap="round"
        />
        <Path
            d="M16 18L8 20"
            stroke="#FF8FAB"
            strokeWidth={3}
            strokeLinecap="round"
        />
    </Svg>
);

const TitleSparkleRight = () => (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" style={styles.titleSparkleRight}>
        <Path
            d="M8 8L16 4"
            stroke="#FF8FAB"
            strokeWidth={3}
            strokeLinecap="round"
        />
        <Path
            d="M6 13H16"
            stroke="#FF8FAB"
            strokeWidth={3}
            strokeLinecap="round"
        />
        <Path
            d="M8 18L16 20"
            stroke="#FF8FAB"
            strokeWidth={3}
            strokeLinecap="round"
        />
    </Svg>
);

const NicknameScreen = ({ onComplete }) => {
    const [nickname, setNickname] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const insets = useSafeAreaInsets();

    const contentOpacity = useRef(new Animated.Value(0)).current;
    const contentTranslateY = useRef(new Animated.Value(24)).current;
    const keyboardCardTranslateY = useRef(new Animated.Value(0)).current;
    const keyboardMascotScale = useRef(new Animated.Value(1)).current;
    const keyboardMascotTranslateY = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const showSubscription = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            () => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setKeyboardVisible(true);
                Animated.parallel([
                    Animated.spring(keyboardCardTranslateY, {
                        toValue: isCompactHeight ? -104 : -128,
                        tension: 80,
                        friction: 14,
                        useNativeDriver: true,
                    }),
                    Animated.spring(keyboardMascotScale, {
                        toValue: isCompactHeight ? 0.68 : 0.72,
                        tension: 90,
                        friction: 15,
                        useNativeDriver: true,
                    }),
                    Animated.spring(keyboardMascotTranslateY, {
                        toValue: isCompactHeight ? -54 : -72,
                        tension: 90,
                        friction: 15,
                        useNativeDriver: true,
                    }),
                ]).start();
            }
        );
        const hideSubscription = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setKeyboardVisible(false);
                Animated.parallel([
                    Animated.spring(keyboardCardTranslateY, {
                        toValue: 0,
                        tension: 80,
                        friction: 14,
                        useNativeDriver: true,
                    }),
                    Animated.spring(keyboardMascotScale, {
                        toValue: 1,
                        tension: 90,
                        friction: 15,
                        useNativeDriver: true,
                    }),
                    Animated.spring(keyboardMascotTranslateY, {
                        toValue: 0,
                        tension: 90,
                        friction: 15,
                        useNativeDriver: true,
                    }),
                ]).start();
            }
        );

        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, [keyboardCardTranslateY, keyboardMascotScale, keyboardMascotTranslateY]);

    const cleanedNickname = nickname.trim();
    const isValid = cleanedNickname.length > 0;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(contentOpacity, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
            }),
            Animated.spring(contentTranslateY, {
                toValue: 0,
                tension: 70,
                friction: 12,
                useNativeDriver: true,
            }),
        ]).start();
    }, [contentOpacity, contentTranslateY]);

    const handleContinue = async () => {
        if (!isValid || isSubmitting) {
            return;
        }

        setIsSubmitting(true);
        try {
            await onComplete?.(cleanedNickname);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <View style={styles.root}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <LinearGradient
                colors={['#F8D9EC', '#FFF7FA', '#FFF4F7', '#F7D8F2']}
                locations={[0, 0.34, 0.72, 1]}
                start={{ x: 0.25, y: 0 }}
                end={{ x: 0.75, y: 1 }}
                style={styles.gradient}
            >
                {/* Background stars and hearts */}
                <Sparkle x={width * 0.08} y={height * 0.06} size={7} delay={0} />
                <Sparkle x={width * 0.78} y={height * 0.07} size={8} delay={600} />
                <Sparkle x={width * 0.9} y={height * 0.17} size={11} delay={1000} />
                <Sparkle x={width * 0.12} y={height * 0.45} size={7} delay={1400} />
                <Sparkle x={width * 0.85} y={height * 0.32} size={8} delay={400} />

                {/* 3D Inflated Hearts positioned like the reference */}
                <BackgroundHeart3D x={width * 0.11} y={height * 0.24} size={54} rotation={-16} opacity={0.85} />
                <BackgroundHeart3D x={width * 0.78} y={height * 0.31} size={42} rotation={14} opacity={0.72} />
                
                {/* Secondary softer hearts */}
                <BackgroundHeart3D x={width * 0.13} y={height * 0.34} size={22} rotation={12} opacity={0.45} />
                <BackgroundHeart3D x={width * 0.84} y={height * 0.2} size={24} rotation={-10} opacity={0.38} />

                {/* Header */}
                <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
                    <BrandLogo />
                </View>

                {/* Mascot sits behind the white card rim */}
                <Animated.View
                    style={[
                        styles.mascotAbsoluteContainer,
                        {
                            top: insets.top + (isCompactHeight ? 8 : 10),
                            opacity: contentOpacity,
                            transform: [
                                { translateY: contentTranslateY },
                                { translateY: keyboardMascotTranslateY },
                                { scale: keyboardMascotScale },
                            ],
                        }
                    ]}
                    pointerEvents="none"
                >
                    <View style={styles.pinkCircle} />
                    <Image
                        source={require('../../assets/images/nickname-mascot-transparent.png')}
                        style={styles.mascotImage}
                        resizeMode="contain"
                    />
                </Animated.View>

                {/* Main card moves over the mascot when the keyboard opens */}
                <View style={styles.keyboardView}>
                    <Animated.View
                        style={[
                            styles.card,
                            {
                                opacity: contentOpacity,
                                transform: [
                                    { translateY: contentTranslateY },
                                    { translateY: keyboardCardTranslateY },
                                ],
                            },
                        ]}
                    >
                        {/* Keeps title below the curved card rim in normal and keyboard states */}
                        <View style={keyboardVisible ? styles.keyboardTitleSpacer : styles.mascotPlaceholder} />

                        {/* Title Section */}
                        <View style={[styles.titleContainer, keyboardVisible && styles.titleContainerKeyboard]}>
                            <View style={styles.titleRow}>
                                <TitleSparkleLeft />
                                <Text style={[styles.title, keyboardVisible && styles.titleKeyboard]}>
                                    What should we call you?
                                </Text>
                                <TitleSparkleRight />
                            </View>
                            <Text style={[styles.subtitle, keyboardVisible && styles.subtitleKeyboard]}>
                                {"Choose a sweet nickname your\npartner will see."}
                            </Text>
                        </View>

                        {/* Input Section */}
                        <View style={[styles.inputWrapper, keyboardVisible && styles.inputWrapperKeyboard]}>
                            <View
                                style={[
                                    styles.inputContainer,
                                    isFocused && styles.inputContainerFocused,
                                ]}
                            >
                                <View style={styles.inputHeartBadge}>
                                    <Svg width={22} height={22} viewBox="0 0 24 24">
                                        <Path
                                            fill="#FF5E97"
                                            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                                        />
                                    </Svg>
                                </View>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Honey, Babe, Love..."
                                    placeholderTextColor="#A7AFC8"
                                    value={nickname}
                                    onChangeText={setNickname}
                                    onFocus={() => setIsFocused(true)}
                                    onBlur={() => setIsFocused(false)}
                                    autoCapitalize="words"
                                    autoCorrect={false}
                                    maxLength={20}
                                    returnKeyType="done"
                                    onSubmitEditing={handleContinue}
                                    accessibilityLabel="Nickname"
                                />
                                <Text style={styles.charCount}>{nickname.length}/20</Text>
                            </View>
                        </View>

                        {/* Continue Button Section - Always bright and gorgeous pink gradient */}
                        <TouchableOpacity
                            style={styles.continueButtonWrapper}
                            onPress={handleContinue}
                            activeOpacity={0.85}
                            disabled={!isValid || isSubmitting}
                            accessibilityRole="button"
                            accessibilityLabel="Continue"
                            accessibilityState={{ disabled: !isValid || isSubmitting, busy: isSubmitting }}
                        >
                            <LinearGradient
                                colors={['#FF5E97', '#FFA1C9']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={[
                                    styles.continueButtonGradient,
                                    !isValid && styles.continueButtonDisabled,
                                ]}
                            >
                                {isSubmitting ? (
                                    <ActivityIndicator color="#FFFFFF" />
                                ) : (
                                    <View style={styles.continueButtonContent}>
                                        <Text style={styles.continueButtonText}>Continue</Text>
                                    </View>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>

                        {/* Sparkle Footer */}
                        {!keyboardVisible && (
                            <View style={styles.footerSparkleRow}>
                                <MiniSparkle />
                                <Text style={styles.footerSparkleText}>Make it cute. Make it yours.</Text>
                                <MiniSparkle />
                            </View>
                        )}

                        {/* Bottom Cloud Shapes for high depth */}
                        <View style={styles.cloudsContainer}>
                            <View style={[styles.cloud, styles.cloudOne]} />
                            <View style={[styles.cloud, styles.cloudTwo]} />
                            <View style={[styles.cloud, styles.cloudThree]} />
                            <View style={[styles.cloud, styles.cloudFour]} />
                        </View>
                    </Animated.View>
                </View>

            </LinearGradient>
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    gradient: {
        flex: 1,
    },
    sparkle: {
        position: 'absolute',
    },
    keyboardView: {
        flex: 1,
        justifyContent: 'flex-end',
        zIndex: 4,
        elevation: 4,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingHorizontal: 20,
        zIndex: 10,
    },
    brandContainer: {
        alignSelf: 'flex-start',
    },
    brandLogo: {
        width: isCompactHeight ? 107 : 123,
        height: isCompactHeight ? 34 : 39,
    },
    card: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: width * 0.72,
        borderTopRightRadius: width * 0.72,
        width: width * 1.28,
        alignSelf: 'center',
        paddingHorizontal: width * 0.17,
        paddingTop: isCompactHeight ? 18 : 20,
        marginTop: isCompactHeight ? 248 : 292,
        overflow: 'hidden',
        shadowColor: '#FFB5D0',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        zIndex: 5,
        elevation: 5,
    },
    mascotPlaceholder: {
        height: isCompactHeight ? 36 : 46,
        width: '100%',
    },
    keyboardTitleSpacer: {
        height: isCompactHeight ? 30 : 36,
        width: '100%',
    },
    mascotAbsoluteContainer: {
        position: 'absolute',
        alignSelf: 'center',
        alignItems: 'center',
        justifyContent: 'center',
        width: isCompactHeight ? 284 : 342,
        height: isCompactHeight ? 356 : 428,
        zIndex: 2,
    },
    pinkCircle: {
        width: isCompactHeight ? 228 : 276,
        height: isCompactHeight ? 228 : 276,
        borderRadius: isCompactHeight ? 114 : 138,
        backgroundColor: '#FFE0EE',
        opacity: 0.62,
        position: 'absolute',
        top: isCompactHeight ? 112 : 136,
        zIndex: 0,
    },
    mascotImage: {
        width: isCompactHeight ? 292 : 352,
        height: isCompactHeight ? 366 : 442,
        zIndex: 1,
    },
    titleContainer: {
        alignItems: 'center',
        marginBottom: isCompactHeight ? 12 : 16,
    },
    titleContainerKeyboard: {
        marginBottom: isCompactHeight ? 8 : 10,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    titleSparkleLeft: {
        marginRight: 8,
        marginTop: -2,
    },
    titleSparkleRight: {
        marginLeft: 8,
        marginTop: -2,
    },
    title: {
        fontFamily: fontFamily.extraBold,
        fontSize: isCompactHeight ? 18 : 22,
        fontWeight: fontWeight('900'),
        color: navy,
        textAlign: 'center',
        letterSpacing: -0.5,
        lineHeight: isCompactHeight ? 22 : 26,
    },
    titleKeyboard: {
        fontSize: isCompactHeight ? 16 : 19,
        lineHeight: isCompactHeight ? 20 : 23,
    },
    subtitle: {
        fontFamily: fontFamily.bold,
        fontSize: isCompactHeight ? 14 : 16,
        color: '#7380A1',
        textAlign: 'center',
        marginTop: isCompactHeight ? 8 : 10,
        fontWeight: fontWeight('600'),
        lineHeight: isCompactHeight ? 21 : 23,
    },
    subtitleKeyboard: {
        fontSize: isCompactHeight ? 12 : 14,
        lineHeight: isCompactHeight ? 18 : 20,
        marginTop: isCompactHeight ? 5 : 6,
    },
    heartRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: isCompactHeight ? 10 : 14,
        marginBottom: isCompactHeight ? 12 : 16,
    },
    heartDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#FFB5D0',
    },
    inputWrapper: {
        marginBottom: isCompactHeight ? 14 : 18,
        width: width - 76,
        alignSelf: 'center',
    },
    inputWrapperKeyboard: {
        marginBottom: isCompactHeight ? 10 : 12,
    },
    inputContainer: {
        height: isCompactHeight ? 50 : 54,
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: isCompactHeight ? 3 : 4,
        paddingRight: isCompactHeight ? 12 : 13,
        borderRadius: 27,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.6,
        borderColor: '#FFC2DC',
        shadowColor: '#FFB5D0',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.16,
        shadowRadius: 18,
        elevation: 4,
    },
    inputContainerFocused: {
        borderColor: '#FFE3EC',
        shadowColor: '#FF9FAF',
        shadowOpacity: 0.28,
        shadowRadius: 14,
    },
    inputHeartBadge: {
        width: isCompactHeight ? 40 : 44,
        height: isCompactHeight ? 40 : 44,
        borderRadius: 22,
        backgroundColor: '#FFEAF2',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: isCompactHeight ? 12 : 14,
    },
    input: {
        flex: 1,
        fontFamily: fontFamily.extraBold,
        fontSize: isCompactHeight ? 16 : 18,
        fontWeight: fontWeight('800'),
        color: navy,
        letterSpacing: -0.5,
        padding: 0,
    },
    charCount: {
        fontFamily: fontFamily.extraBold,
        fontSize: isCompactHeight ? 15 : 16,
        fontWeight: fontWeight('800'),
        color: '#9BA5C4',
        paddingRight: 8,
    },
    continueButtonWrapper: {
        width: width - 76,
        height: isCompactHeight ? 44 : 48,
        borderRadius: 24,
        overflow: 'hidden',
        alignSelf: 'center',
        shadowColor: '#FF5E97',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 5,
        marginTop: 2,
    },
    continueButtonGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    continueButtonDisabled: {
        opacity: 0.45,
    },
    continueButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    continueButtonText: {
        fontFamily: fontFamily.extraBold,
        fontSize: isCompactHeight ? 16 : 18,
        fontWeight: fontWeight('800'),
        color: '#FFFFFF',
    },
    footerSparkleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        marginTop: isCompactHeight ? 20 : 26,
        marginBottom: 10,
    },
    footerSparkleText: {
        fontFamily: fontFamily.bold,
        fontSize: isCompactHeight ? 13 : 15,
        fontWeight: fontWeight('600'),
        color: '#B9A9C5',
    },
    cloudsContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 90,
        zIndex: -1,
        flexDirection: 'row',
        pointerEvents: 'none',
    },
    cloud: {
        position: 'absolute',
        backgroundColor: 'rgba(255, 255, 255, 0.75)',
    },
    cloudOne: {
        width: 180,
        height: 180,
        borderRadius: 90,
        bottom: -100,
        left: -50,
    },
    cloudTwo: {
        width: 240,
        height: 240,
        borderRadius: 120,
        bottom: -130,
        left: 50,
    },
    cloudThree: {
        width: 200,
        height: 200,
        borderRadius: 100,
        bottom: -110,
        right: 30,
    },
    cloudFour: {
        width: 160,
        height: 160,
        borderRadius: 80,
        bottom: -85,
        right: -50,
    },
});

export default NicknameScreen;
