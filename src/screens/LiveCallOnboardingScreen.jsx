import React, { useEffect, useRef } from 'react';
import {
    Animated,
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
import * as Haptics from 'expo-haptics';
import { fontFamily, fontWeight } from '../constants/fonts';
import { translateUiText } from '../i18n/uiTranslation';
import useReducedMotion from '../hooks/useReducedMotion';

const LiveCallOnboardingScreen = ({ onComplete }) => {
    const insets = useSafeAreaInsets();
    const titleEntrance = useRef(new Animated.Value(0)).current;
    const visualEntrance = useRef(new Animated.Value(0)).current;
    const buttonEntrance = useRef(new Animated.Value(0)).current;
    const reducedMotion = useReducedMotion();

    useEffect(() => {
        if (reducedMotion) {
            titleEntrance.setValue(1);
            visualEntrance.setValue(1);
            buttonEntrance.setValue(1);
            return;
        }

        Animated.stagger(110, [
            Animated.timing(titleEntrance, {
                toValue: 1,
                duration: 380,
                useNativeDriver: true,
            }),
            Animated.timing(visualEntrance, {
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
    }, [buttonEntrance, reducedMotion, titleEntrance, visualEntrance]);

    const finish = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onComplete?.();
    };

    return (
        <LinearGradient
            colors={['#F9DFEA', '#FFF8F7', '#F8E6F5']}
            locations={[0, 0.58, 1]}
            style={styles.container}
        >
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <View
                style={[
                    styles.page,
                    {
                        paddingTop: insets.top + 52,
                        paddingBottom: insets.bottom + 12
                            + (Platform.OS === 'android' ? 12 : 0),
                    },
                ]}
            >
                <View style={styles.content}>
                    <Animated.View
                        style={[
                            styles.header,
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
                        <Text style={styles.title}>
                            {translateUiText("Play closer together")}
                        </Text>
                        <Text style={styles.subtitle}>
                            {translateUiText("Enjoy games with live video, wherever you both are.")}
                        </Text>
                    </Animated.View>

                    <Animated.View
                        style={[
                            styles.callVisual,
                            {
                                opacity: visualEntrance,
                                transform: [{
                                    translateY: visualEntrance.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [18, 0],
                                    }),
                                }],
                            },
                        ]}
                    >
                        <Image
                            source={require('../../assets/onbording/live-call-visual.png')}
                            resizeMode="contain"
                            style={styles.callVisualImage}
                        />
                    </Animated.View>
                </View>

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
                            colors={['#FF6B82', '#F45170']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.continueButton}
                        >
                            <Text style={styles.continueText}>{translateUiText("Keep going")}</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                </Animated.View>
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
    header: {
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
    callVisual: {
        flex: 1,
        width: '100%',
        minHeight: 0,
        marginTop: 10,
        marginBottom: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    callVisualImage: {
        width: '100%',
        height: '100%',
    },
    footer: {
        width: '100%',
        paddingHorizontal: 8,
        alignItems: 'center',
    },
    buttonShadow: {
        width: '100%',
        marginTop: 6,
        borderRadius: 24,
        shadowColor: '#F45170',
        shadowOpacity: 0.22,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 8 },
        elevation: 4,
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

export default LiveCallOnboardingScreen;
