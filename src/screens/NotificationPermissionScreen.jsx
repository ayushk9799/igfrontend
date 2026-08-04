// Notification Permission Screen - Ask user to enable notifications
import React, { useRef, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Animated,
    Dimensions,
    Image,
    StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { fontFamily, fontWeight } from '../constants/fonts';
import * as Haptics from 'expo-haptics';

import { requestNotificationPermission, registerFCMToken } from '../utils/pushNotifications';
import { translateUiText } from '../i18n/uiTranslation';

const { width, height } = Dimensions.get('window');
const isCompactHeight = height < 760;
const navy = '#050E3E';

// --- SVG Components ---
const TitleBurst = () => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path d="M6 16L9 14" stroke="#FF8FAB" strokeWidth={2.5} strokeLinecap="round" />
        <Path d="M4 8L8 10" stroke="#FF8FAB" strokeWidth={2.5} strokeLinecap="round" />
        <Path d="M12 4L13 8" stroke="#FF8FAB" strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
);

const ButtonBurst = () => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path d="M18 8L15 10" stroke="#FF5E97" strokeWidth={2.5} strokeLinecap="round" />
        <Path d="M20 16L16 14" stroke="#FF5E97" strokeWidth={2.5} strokeLinecap="round" />
        <Path d="M12 20L11 16" stroke="#FF5E97" strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
);

const TinyHeart = ({ color = "#FF8FAB" }) => (
    <Svg width={18} height={16} viewBox="0 0 14 12" fill="none">
        <Path d="M7 12L6.0125 11.0825C2.4 7.755 0 5.5425 0 2.8425C0 0.81 1.575 -0.75 3.5 -0.75C4.585 -0.75 5.6175 -0.255 6.265 0.4425C6.545 0.705 6.7825 1.0125 7 1.3425C7.2175 1.0125 7.455 0.705 7.735 0.4425C8.3825 -0.255 9.415 -0.75 10.5 -0.75C12.425 -0.75 14 0.81 14 2.8425C14 5.5425 11.6 7.755 7.9875 11.09L7 12Z" fill={color} />
    </Svg>
);



const BellIcon = () => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path d="M12 22C13.1 22 14 21.1 14 20H10C10 21.1 10.9 22 12 22ZM18 16V11C18 7.93 16.36 5.36 13.5 4.68V4C13.5 3.17 12.83 2.5 12 2.5C11.17 2.5 10.5 3.17 10.5 4V4.68C7.63 5.36 6 7.92 6 11V16L4 18V19H20V18L18 16Z" fill="#FFFFFF" />
    </Svg>
);

const phoneWidth = isCompactHeight ? width * 0.74 : width * 0.82;
const phoneHeight = phoneWidth * (1844 / 853);

const NotificationPermissionScreen = ({ onComplete }) => {
    const insets = useSafeAreaInsets();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(40)).current;

    // Animated values for the three popping notifications
    const notif1Scale = useRef(new Animated.Value(0)).current;
    const notif1Opacity = useRef(new Animated.Value(0)).current;
    const notif2Scale = useRef(new Animated.Value(0)).current;
    const notif2Opacity = useRef(new Animated.Value(0)).current;
    const notif3Scale = useRef(new Animated.Value(0)).current;
    const notif3Opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 600,
                useNativeDriver: true,
            }),
        ]).start();
    }, [fadeAnim, slideAnim]);

    // Animation for notifications popped simulation (runs once on mount)
    useEffect(() => {
        // Reset all
        notif1Scale.setValue(0);
        notif1Opacity.setValue(0);
        notif2Scale.setValue(0);
        notif2Opacity.setValue(0);
        notif3Scale.setValue(0);
        notif3Opacity.setValue(0);

        Animated.sequence([
            Animated.delay(220), // Briefly wait for the screen entrance

            // 1st notification pops
            Animated.parallel([
                Animated.spring(notif1Scale, {
                    toValue: 1,
                    friction: 8,
                    tension: 90,
                    useNativeDriver: true,
                }),
                Animated.timing(notif1Opacity, {
                    toValue: 1,
                    duration: 90,
                    useNativeDriver: true,
                })
            ]),
            Animated.delay(180),

            // 2nd notification pops
            Animated.parallel([
                Animated.spring(notif2Scale, {
                    toValue: 1,
                    friction: 8,
                    tension: 90,
                    useNativeDriver: true,
                }),
                Animated.timing(notif2Opacity, {
                    toValue: 1,
                    duration: 90,
                    useNativeDriver: true,
                })
            ]),
            Animated.delay(180),

            // 3rd notification pops
            Animated.parallel([
                Animated.spring(notif3Scale, {
                    toValue: 1,
                    friction: 8,
                    tension: 90,
                    useNativeDriver: true,
                }),
                Animated.timing(notif3Opacity, {
                    toValue: 1,
                    duration: 90,
                    useNativeDriver: true,
                })
            ])
        ]).start();

        return () => {
            notif1Scale.stopAnimation();
            notif1Opacity.stopAnimation();
            notif2Scale.stopAnimation();
            notif2Opacity.stopAnimation();
            notif3Scale.stopAnimation();
            notif3Opacity.stopAnimation();
        };
    }, [
        notif1Opacity,
        notif1Scale,
        notif2Opacity,
        notif2Scale,
        notif3Opacity,
        notif3Scale,
    ]);

    const handleAllowNotifications = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        const granted = await requestNotificationPermission();
        if (granted) {
            await registerFCMToken();
        }
        onComplete?.();
    };

    const handleSkip = () => {
        onComplete?.();
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
                <View style={[styles.container, { paddingTop: insets.top + 4, paddingBottom: insets.bottom + 10 }]}>

                    {/* Brand Logo */}
                    <View style={styles.brandContainer}>
                        <Image 
                            source={require('../../assets/images/penguin-text-logo.png')} 
                            style={styles.brandLogo} 
                            resizeMode="contain" 
                        />
                    </View>

                    {/* Hero Section */}
                    <Animated.View
                        style={[
                            styles.heroSection,
                            {
                                opacity: fadeAnim,
                                transform: [{ translateY: slideAnim }],
                            },
                        ]}
                    >
                        <View style={styles.titleRow}>
                            <View style={styles.titleBurstContainer}>
                                <TitleBurst />
                            </View>
                            <Text style={styles.title}>{translateUiText("Stay Connected")}</Text>
                            <View style={styles.titleHeartContainer}>
                                <TinyHeart color="#FF8FAB" />
                            </View>
                        </View>
                        <Text style={styles.subtitle}>{translateUiText("Get notified when your partner sends you love notes, scribbles, and game invites.")}</Text>
                    </Animated.View>

                    {/* Simulated Mobile Mockup with Notifications */}
                    <Animated.View
                        style={[
                            styles.phoneWrapper,
                            {
                                opacity: fadeAnim,
                                transform: [{ translateY: slideAnim }],
                            },
                        ]}
                    >
                        <Image
                            source={require('../../assets/images/mobile_notification.png')}
                            style={styles.phoneImage}
                            resizeMode="contain"
                        />
                        <View style={styles.notificationsOverlay}>
                            <View style={styles.lockScreenClock}>
                                <Text style={styles.lockScreenTime}>9:41</Text>
                                <Text style={styles.lockScreenDate}>{translateUiText("Sunday, July 19")}</Text>
                            </View>

                            {/* Notification 1 */}
                            <Animated.View style={[styles.notificationBubble, { opacity: notif1Opacity, transform: [{ scale: notif1Scale }] }]}>
                                <View style={[styles.notifIconBox, { backgroundColor: '#FFEAF2' }]}>
                                    <Text style={styles.notifEmoji}>💬</Text>
                                </View>
                                <View style={styles.notifTextContainer}>
                                    <View style={styles.notifTitleRow}>
                                        <Text style={styles.notifTitle}>{translateUiText("Partner Message")}</Text>
                                        <Text style={styles.notifTime}>{translateUiText("now")}</Text>
                                    </View>
                                    <Text style={styles.notifBody}>{translateUiText("Can't wait to see you today! 🥰")}</Text>
                                </View>
                            </Animated.View>

                            {/* Notification 2 */}
                            <Animated.View style={[styles.notificationBubble, { opacity: notif2Opacity, transform: [{ scale: notif2Scale }] }]}>
                                <View style={[styles.notifIconBox, { backgroundColor: '#F0EFFF' }]}>
                                    <Text style={styles.notifEmoji}>🖍️</Text>
                                </View>
                                <View style={styles.notifTextContainer}>
                                    <View style={styles.notifTitleRow}>
                                        <Text style={styles.notifTitle}>{translateUiText("New Scribble")}</Text>
                                        <Text style={styles.notifTime}>{translateUiText("now")}</Text>
                                    </View>
                                    <Text style={styles.notifBody}>{translateUiText("Alex sent you a cute drawing 🐾")}</Text>
                                </View>
                            </Animated.View>

                            {/* Notification 3 */}
                            <Animated.View style={[styles.notificationBubble, { opacity: notif3Opacity, transform: [{ scale: notif3Scale }] }]}>
                                <View style={[styles.notifIconBox, { backgroundColor: '#EAF4FF' }]}>
                                    <Text style={styles.notifEmoji}>🎮</Text>
                                </View>
                                <View style={styles.notifTextContainer}>
                                    <View style={styles.notifTitleRow}>
                                        <Text style={styles.notifTitle}>{translateUiText("Game Invite")}</Text>
                                        <Text style={styles.notifTime}>{translateUiText("now")}</Text>
                                    </View>
                                    <Text style={styles.notifBody}>{translateUiText("Let's play Tic-Tac-Toe! 🎮✨")}</Text>
                                </View>
                            </Animated.View>
                        </View>
                        <LinearGradient
                            pointerEvents="none"
                            colors={['rgba(255,244,247,0)', 'rgba(255,244,247,0.72)', '#FFF4F7']}
                            locations={[0, 0.52, 1]}
                            style={styles.phoneBottomFade}
                        />
                    </Animated.View>

                    <View style={styles.spacer} />

                    {/* Bottom Actions */}
                    <View style={[styles.bottomSection, { bottom: insets.bottom + 14 }]}>
                        <View style={styles.buttonContainer}>
                            <View style={styles.buttonBurstContainer}>
                                <ButtonBurst />
                            </View>
                            <TouchableOpacity
                                style={styles.allowButtonWrapper}
                                onPress={handleAllowNotifications}
                                activeOpacity={0.85}
                            >
                                <LinearGradient
                                    colors={['#FF5E97', '#FFA1C9']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.allowButtonGradient}
                                >
                                    <BellIcon />
                                    <Text style={styles.allowButtonText}>{translateUiText("Allow Notifications")}</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity onPress={handleSkip} activeOpacity={0.7} style={styles.skipButton}>
                            <Text style={styles.skipText}>{translateUiText("Maybe Later →")}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Bottom Clouds background decoration */}
                <View style={styles.cloudsContainer}>
                    <View style={[styles.cloud, styles.cloudOne]} />
                    <View style={[styles.cloud, styles.cloudTwo]} />
                    <View style={[styles.cloud, styles.cloudThree]} />
                    <View style={[styles.cloud, styles.cloudFour]} />
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
    container: {
        flex: 1,
        paddingHorizontal: 24,
        zIndex: 2,
    },
    brandContainer: {
        alignSelf: 'flex-start',
        marginTop: 0,
        marginLeft: 0,
    },
    brandLogo: {
        width: isCompactHeight ? 120 : 140,
        height: isCompactHeight ? 36 : 42,
        marginLeft: -14, // Pull logo left slightly for visual alignment
    },
    heroSection: {
        alignItems: 'center',
        marginTop: isCompactHeight ? 0 : 15,
        marginBottom: isCompactHeight ? 10 : 20,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        position: 'relative',
        marginBottom: 2,
    },
    titleBurstContainer: {
        position: 'absolute',
        left: -25,
        top: -8,
    },
    titleHeartContainer: {
        position: 'absolute',
        right: -25,
        top: -2,
    },
    title: {
        fontFamily: fontFamily.extraBold,
        fontSize: isCompactHeight ? 25 : 30,
        fontWeight: fontWeight('800'),
        color: navy,
        textAlign: 'center',
        letterSpacing: -0.4,
    },
    subtitle: {
        fontFamily: fontFamily.medium,
        fontSize: isCompactHeight ? 13 : 14,
        color: '#7380A1',
        textAlign: 'center',
        marginTop: isCompactHeight ? 2 : 4,
        lineHeight: 20,
        paddingHorizontal: 10,
        fontWeight: fontWeight('500'),
    },
    phoneWrapper: {
        width: phoneWidth,
        height: phoneHeight,
        alignSelf: 'center',
        marginTop: isCompactHeight ? 4 : 10,
        marginBottom: isCompactHeight ? -150 : -190,
        position: 'relative',
        zIndex: 1,
    },
    phoneImage: {
        width: '100%',
        height: '100%',
    },
    notificationsOverlay: {
        position: 'absolute',
        top: '15%', // Lift the clock and notifications slightly within the phone
        left: '8%',
        right: '8%',
        bottom: '10%',
        alignItems: 'center',
    },
    phoneBottomFade: {
        position: 'absolute',
        left: -4,
        right: -4,
        bottom: 0,
        height: '38%',
        zIndex: 4,
    },
    lockScreenClock: {
        alignItems: 'center',
        marginBottom: isCompactHeight ? 12 : 18,
    },
    lockScreenTime: {
        fontFamily: fontFamily.extraBold,
        fontSize: isCompactHeight ? 48 : 58,
        color: navy,
        fontWeight: fontWeight('800'),
        letterSpacing: -0.5,
    },
    lockScreenDate: {
        fontFamily: fontFamily.medium,
        fontSize: isCompactHeight ? 9 : 11,
        color: '#7380A1',
        fontWeight: fontWeight('600'),
        marginTop: -2,
    },
    notificationBubble: {
        width: '100%',
        backgroundColor: 'rgba(255, 255, 255, 0.94)',
        borderRadius: 14,
        paddingHorizontal: 10,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        // Premium drop shadow
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 0,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.5)',
    },
    notifIconBox: {
        width: 30,
        height: 30,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    notifEmoji: {
        fontSize: 16,
    },
    notifTextContainer: {
        flex: 1,
    },
    notifTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    notifTitle: {
        fontFamily: fontFamily.bold,
        fontSize: isCompactHeight ? 10 : 12,
        fontWeight: fontWeight('700'),
        color: navy,
    },
    notifTime: {
        fontFamily: fontFamily.medium,
        fontSize: isCompactHeight ? 8 : 10,
        color: '#9E9E9E',
    },
    notifBody: {
        fontFamily: fontFamily.medium,
        fontSize: isCompactHeight ? 9 : 11,
        color: '#555555',
        marginTop: 2,
        fontWeight: fontWeight('500'),
    },
    spacer: {
        height: isCompactHeight ? 16 : 26,
    },
    bottomSection: {
        position: 'absolute',
        left: 24,
        right: 24,
        alignItems: 'center',
        zIndex: 10,
    },
    buttonContainer: {
        width: '100%',
        position: 'relative',
    },
    buttonBurstContainer: {
        position: 'absolute',
        right: -10,
        top: -15,
        zIndex: 3,
    },
    allowButtonWrapper: {
        width: '100%',
        height: isCompactHeight ? 44 : 48,
        borderRadius: 24,
        overflow: 'hidden',
        shadowColor: '#FF5E97',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 0,
    },
    allowButtonGradient: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    allowButtonText: {
        fontFamily: fontFamily.extraBold,
        fontSize: isCompactHeight ? 14 : 15,
        fontWeight: fontWeight('800'),
        color: '#FFFFFF',
    },
    skipButton: {
        marginTop: isCompactHeight ? 10 : 14,
        paddingVertical: 8,
    },
    skipText: {
        fontFamily: fontFamily.bold,
        fontSize: 15,
        color: '#7380A1',
        fontWeight: fontWeight('600'),
    },
    cloudsContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 150,
        zIndex: 1,
        pointerEvents: 'none',
    },
    cloud: {
        position: 'absolute',
        backgroundColor: '#FFFFFF',
        borderRadius: 100,
        opacity: 0.6,
    },
    cloudOne: {
        width: 120,
        height: 120,
        bottom: -60,
        left: -40,
    },
    cloudTwo: {
        width: 180,
        height: 180,
        bottom: -90,
        left: 60,
        opacity: 0.8,
    },
    cloudThree: {
        width: 150,
        height: 150,
        bottom: -70,
        right: -30,
    },
    cloudFour: {
        width: 100,
        height: 100,
        bottom: -40,
        right: 80,
        opacity: 0.5,
    },
});

export default NotificationPermissionScreen;
