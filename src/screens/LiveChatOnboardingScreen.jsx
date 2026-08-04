import React, { useEffect, useMemo, useRef } from 'react';
import {
    Animated,
    Image,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import {
    ArrowUp,
    BatteryMedium,
    ChevronLeft,
    Delete,
    Mic,
    Send,
    Smile,
    Video,
    Wifi,
} from 'lucide-react-native';
import { fontFamily, fontWeight } from '../constants/fonts';
import { translateUiText } from '../i18n/uiTranslation';
import useReducedMotion from '../hooks/useReducedMotion';

const PHONE_WIDTH = 320;
const PHONE_HEIGHT = 650;

const KEYBOARD_ROWS = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

const SignalBars = () => (
    <View style={styles.signalBars}>
        {[5, 8, 11, 14].map(barHeight => (
            <View key={barHeight} style={[styles.signalBar, { height: barHeight }]} />
        ))}
    </View>
);

const PreviewStatusBar = () => (
    <View style={styles.previewStatusBar}>
        <Text style={styles.previewTime}>9:41</Text>
        <View style={styles.previewStatusIcons}>
            <SignalBars />
            <Wifi color="#17131D" size={16} strokeWidth={2.5} />
            <BatteryMedium color="#17131D" size={19} strokeWidth={2.4} />
        </View>
    </View>
);

const PreviewHeader = () => (
    <View style={styles.previewHeader}>
        <View style={styles.previewHeaderButton}>
            <ChevronLeft color="#1B1237" size={22} strokeWidth={2.5} />
        </View>
        <Text style={styles.previewHeaderTitle}>{translateUiText("Video Chat")}</Text>
        <View style={styles.previewCameraButton}>
            <Video color="#D84F86" size={20} strokeWidth={2.3} />
        </View>
    </View>
);

const LiveMessageCard = ({
    imageSource,
    name,
    message,
    dotColor,
    borderColor,
}) => (
    <View style={[styles.messageCard, { borderColor }]}>
        <View style={styles.videoTile}>
            <Image source={imageSource} resizeMode="cover" style={styles.videoImage} />
            <View style={[styles.liveDot, { backgroundColor: dotColor }]} />
        </View>
        <View style={styles.messageCopy}>
            <Text style={styles.personName}>{translateUiText(name)}</Text>
            <Text style={styles.messageText}>{translateUiText(message)}</Text>
        </View>
    </View>
);

const LetterKey = ({ label }) => (
    <View style={styles.letterKey}>
        <Text style={styles.letterKeyText}>{label}</Text>
    </View>
);

const MockKeyboard = () => (
    <View style={styles.keyboard}>
        <View style={styles.suggestions}>
            <Text style={styles.suggestionText}>I</Text>
            <View style={styles.suggestionDivider} />
            <Text style={styles.suggestionText}>The</Text>
            <View style={styles.suggestionDivider} />
            <Text style={styles.suggestionText}>I&apos;m</Text>
        </View>

        <View style={styles.keyboardRows}>
            <View style={styles.keyboardRow}>
                {KEYBOARD_ROWS[0].map(key => <LetterKey key={key} label={key} />)}
            </View>
            <View style={[styles.keyboardRow, styles.middleKeyboardRow]}>
                {KEYBOARD_ROWS[1].map(key => <LetterKey key={key} label={key} />)}
            </View>
            <View style={styles.keyboardRow}>
                <View style={[styles.utilityKey, styles.squareUtilityKey]}>
                    <ArrowUp color="#121212" size={17} strokeWidth={2.6} />
                </View>
                {KEYBOARD_ROWS[2].map(key => <LetterKey key={key} label={key} />)}
                <View style={[styles.utilityKey, styles.squareUtilityKey]}>
                    <Delete color="#121212" size={17} strokeWidth={2.2} />
                </View>
            </View>
            <View style={styles.bottomKeyboardRow}>
                <View style={[styles.utilityKey, styles.numberKey]}>
                    <Text style={styles.utilityKeyText}>123</Text>
                </View>
                <View style={[styles.letterKey, styles.spaceKey]}>
                    <Text style={styles.utilityKeyText}>space</Text>
                </View>
                <View style={[styles.utilityKey, styles.returnKey]}>
                    <Text style={styles.utilityKeyText}>return</Text>
                </View>
            </View>
        </View>

        <View style={styles.keyboardFooter}>
            <Smile color="#5E626A" size={21} strokeWidth={2} />
            <View style={styles.homeIndicator} />
            <Mic color="#5E626A" size={21} strokeWidth={2} />
        </View>
    </View>
);

const PhonePreview = ({ scale }) => (
    <View
        style={[
            styles.phoneSlot,
            {
                width: PHONE_WIDTH * scale,
                height: PHONE_HEIGHT * scale,
            },
        ]}
    >
        <View style={[styles.phone, { transform: [{ scale }] }]}>
            <PreviewStatusBar />
            <PreviewHeader />

            <LinearGradient
                colors={['#FBEAF2', '#FFF9FA', '#F5E9F8']}
                locations={[0, 0.52, 1]}
                style={styles.previewBody}
            >
                <View style={styles.cards}>
                    <LiveMessageCard
                        imageSource={require('../../assets/onbording/live-chat-raw-video-call.png')}
                        name="Alex"
                        message="Miss you already 💗"
                        dotColor="#42B883"
                        borderColor="#F1C9DA"
                    />
                    <LiveMessageCard
                        imageSource={require('../../assets/onbording/live-chat-raw-video-call-boy.png')}
                        name="You"
                        message="Same. Come home soon 🫶"
                        dotColor="#FF758F"
                        borderColor="#E5C9F1"
                    />
                </View>

                <View style={styles.composer}>
                    <Text style={styles.placeholder}>{translateUiText("Type a message…")}</Text>
                    <View style={styles.sendButton}>
                        <Send color="#FFFFFF" size={18} fill="#FFFFFF" strokeWidth={1.8} />
                    </View>
                </View>

                <MockKeyboard />
            </LinearGradient>
        </View>
    </View>
);

const LiveChatOnboardingScreen = ({ onComplete }) => {
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions();
    const titleEntrance = useRef(new Animated.Value(0)).current;
    const phoneEntrance = useRef(new Animated.Value(0)).current;
    const buttonEntrance = useRef(new Animated.Value(0)).current;
    const reducedMotion = useReducedMotion();

    const phoneScale = useMemo(() => {
        const horizontalScale = (width * 0.88) / PHONE_WIDTH;
        const reservedHeight = insets.top + insets.bottom + 194;
        const verticalScale = (height - reservedHeight) / PHONE_HEIGHT;
        return Math.max(0.66, Math.min(1, horizontalScale, verticalScale));
    }, [height, insets.bottom, insets.top, width]);

    useEffect(() => {
        if (reducedMotion) {
            titleEntrance.setValue(1);
            phoneEntrance.setValue(1);
            buttonEntrance.setValue(1);
            return;
        }

        Animated.stagger(110, [
            Animated.timing(titleEntrance, {
                toValue: 1,
                duration: 380,
                useNativeDriver: true,
            }),
            Animated.timing(phoneEntrance, {
                toValue: 1,
                duration: 380,
                useNativeDriver: true,
            }),
            Animated.timing(buttonEntrance, {
                toValue: 1,
                duration: 380,
                useNativeDriver: true,
            }),
        ]).start();
    }, [buttonEntrance, phoneEntrance, reducedMotion, titleEntrance]);

    const finish = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onComplete?.();
    };

    return (
        <LinearGradient
            colors={['#F8D9EC', '#FFF7FA', '#FFF4F7', '#F7D8F2']}
            locations={[0, 0.34, 0.72, 1]}
            start={{ x: 0.25, y: 0 }}
            end={{ x: 0.75, y: 1 }}
            style={styles.container}
        >
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <View
                style={[
                    styles.page,
                    {
                        paddingTop: insets.top + 52,
                    },
                ]}
            >
                <View style={styles.content}>
                    <Animated.View
                        style={[
                            styles.titleBlock,
                            {
                                opacity: titleEntrance,
                                transform: [{
                                    translateY: titleEntrance.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [18, 0],
                                    }),
                                }],
                            },
                        ]}
                    >
                        <Text style={styles.title}>{translateUiText("Talk face-to-face")}</Text>
                        <Text style={styles.titleSparkle}>✦</Text>
                        <Text style={styles.subtitle}>
                            {translateUiText("Share one live thought each, right in the moment.")}
                        </Text>
                    </Animated.View>

                    <Animated.View
                        style={{
                            opacity: phoneEntrance,
                            transform: [{
                                translateY: phoneEntrance.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [18, 0],
                                }),
                            }],
                        }}
                    >
                        <PhonePreview scale={phoneScale} />
                    </Animated.View>
                </View>

                <View
                    style={[
                        styles.footerArea,
                        {
                            paddingBottom: insets.bottom + 12
                                + (Platform.OS === 'android' ? 12 : 0),
                        },
                    ]}
                >
                    <LinearGradient
                        pointerEvents="none"
                        colors={['rgba(255,247,250,0)', '#FFF7FA']}
                        style={styles.footerSpread}
                    />
                    <Animated.View
                        style={[
                            styles.footer,
                            {
                                opacity: buttonEntrance,
                                transform: [{
                                    translateY: buttonEntrance.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [18, 0],
                                    }),
                                }],
                            },
                        ]}
                    >
                        <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={translateUiText("Keep going")}
                            activeOpacity={0.86}
                            onPress={finish}
                            style={styles.buttonShadow}
                        >
                            <LinearGradient
                                colors={['#FF5E97', '#FFA1C9']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.continueButton}
                            >
                                <Text style={styles.continueText}>
                                    {translateUiText("Keep going")}
                                </Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </View>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    page: {
        flex: 1,
        paddingHorizontal: 18,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        minHeight: 0,
        paddingTop: 32,
    },
    titleBlock: {
        width: '100%',
        alignItems: 'flex-start',
        position: 'relative',
    },
    title: {
        color: '#050E3E',
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        fontSize: 30,
        lineHeight: 35,
        letterSpacing: -0.4,
        textAlign: 'left',
    },
    subtitle: {
        maxWidth: 330,
        marginTop: 2,
        color: '#536185',
        fontFamily: fontFamily.medium,
        fontWeight: fontWeight('500'),
        fontSize: 14,
        lineHeight: 19,
        textAlign: 'left',
    },
    titleSparkle: {
        position: 'absolute',
        right: 10,
        top: 1,
        color: '#FF5E86',
        fontSize: 18,
    },
    phoneSlot: {
        marginTop: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    phone: {
        width: PHONE_WIDTH,
        height: PHONE_HEIGHT,
        overflow: 'hidden',
        borderRadius: 39,
        borderWidth: 6,
        borderColor: '#F59DBE',
        backgroundColor: '#FFF3F8',
        shadowColor: '#A94B74',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 18,
        elevation: 0,
    },
    previewStatusBar: {
        height: 32,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFF3F8',
    },
    previewTime: {
        color: '#17131D',
        fontFamily: fontFamily.bold,
        fontSize: 13,
    },
    previewStatusIcons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    signalBars: {
        height: 15,
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 2,
    },
    signalBar: {
        width: 3,
        borderRadius: 1,
        backgroundColor: '#17131D',
    },
    previewHeader: {
        height: 54,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFF3F8',
    },
    previewHeaderButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#FAE8FF',
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 0,
    },
    previewCameraButton: {
        width: 40,
        height: 40,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderWidth: 1,
        borderColor: '#F5CBDD',
        shadowColor: '#C25A86',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 0,
    },
    previewHeaderTitle: {
        color: '#1B1237',
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        fontSize: 22,
    },
    previewBody: {
        flex: 1,
        paddingTop: 10,
    },
    cards: {
        paddingHorizontal: 12,
        gap: 9,
    },
    messageCard: {
        height: 104,
        flexDirection: 'row',
        overflow: 'hidden',
        borderRadius: 18,
        borderWidth: 1.5,
        backgroundColor: 'rgba(255,255,255,0.94)',
        shadowColor: '#C15E89',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 0,
    },
    videoTile: {
        width: 102,
        height: '100%',
        position: 'relative',
        backgroundColor: '#F4DBE8',
    },
    videoImage: {
        width: '100%',
        height: '100%',
    },
    liveDot: {
        position: 'absolute',
        right: 7,
        bottom: 7,
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    messageCopy: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 14,
    },
    personName: {
        color: '#D84F86',
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
        fontSize: 13,
        marginBottom: 4,
    },
    messageText: {
        color: '#1B1237',
        fontFamily: fontFamily.medium,
        fontSize: 16,
        lineHeight: 21,
    },
    composer: {
        height: 45,
        marginTop: 8,
        marginHorizontal: 12,
        marginBottom: 5,
        paddingLeft: 14,
        paddingRight: 5,
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 23,
        borderWidth: 1.5,
        borderColor: '#F0B9D0',
        backgroundColor: 'rgba(255,255,255,0.94)',
    },
    placeholder: {
        flex: 1,
        color: '#A99CA9',
        fontFamily: fontFamily.medium,
        fontSize: 13,
    },
    sendButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#E7B9CC',
    },
    keyboard: {
        flex: 1,
        minHeight: 210,
        backgroundColor: '#D9DCE3',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#CDD0D7',
    },
    suggestions: {
        height: 32,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingHorizontal: 18,
    },
    suggestionText: {
        minWidth: 55,
        color: '#202124',
        fontFamily: fontFamily.medium,
        fontSize: 12,
        textAlign: 'center',
    },
    suggestionDivider: {
        width: StyleSheet.hairlineWidth,
        height: 19,
        backgroundColor: '#B9BDC5',
    },
    keyboardRows: {
        gap: 6,
        paddingHorizontal: 6,
    },
    keyboardRow: {
        height: 35,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 4,
    },
    middleKeyboardRow: {
        paddingHorizontal: 12,
    },
    letterKey: {
        flex: 1,
        minWidth: 0,
        height: 35,
        borderRadius: 5,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        shadowColor: '#5F6470',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.32,
        shadowRadius: 0.6,
        elevation: 0,
    },
    letterKeyText: {
        color: '#111111',
        fontFamily: fontFamily.medium,
        fontSize: 14,
    },
    utilityKey: {
        height: 35,
        borderRadius: 5,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#B9BEC8',
    },
    squareUtilityKey: {
        width: 37,
    },
    utilityKeyText: {
        color: '#1A1A1A',
        fontFamily: fontFamily.medium,
        fontSize: 12,
    },
    bottomKeyboardRow: {
        height: 37,
        flexDirection: 'row',
        gap: 5,
    },
    numberKey: {
        width: 71,
        height: 37,
    },
    spaceKey: {
        height: 37,
        flex: 1,
    },
    returnKey: {
        width: 72,
        height: 37,
    },
    keyboardFooter: {
        flex: 1,
        minHeight: 30,
        paddingHorizontal: 22,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    homeIndicator: {
        alignSelf: 'flex-end',
        width: 92,
        height: 4,
        marginBottom: 5,
        borderRadius: 2,
        backgroundColor: '#111111',
    },
    footerArea: {
        position: 'relative',
        zIndex: 3,
        marginHorizontal: -18,
        paddingHorizontal: 18,
        backgroundColor: '#FFF7FA',
    },
    footerSpread: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: -112,
        height: 112,
    },
    footer: {
        width: '100%',
        paddingHorizontal: 8,
        alignItems: 'center',
    },
    buttonShadow: {
        width: '100%',
        marginTop: 4,
        borderRadius: 24,
        shadowColor: '#FF5E97',
        shadowOpacity: 0.22,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 8 },
        elevation: 0,
    },
    continueButton: {
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    continueText: {
        color: '#FFFFFF',
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        fontSize: 18,
    },
});

export default LiveChatOnboardingScreen;
