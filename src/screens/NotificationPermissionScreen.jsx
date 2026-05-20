// Notification Permission Screen - Ask user to enable notifications
import React, { useRef, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Animated,
    Dimensions,
    Platform,
    Image,
    StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { fontFamily, fontWeight } from '../constants/fonts';

import { requestNotificationPermission, registerFCMToken } from '../utils/pushNotifications';

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

const ChevronRight = () => (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
        <Path d="M9 18L15 12L9 6" stroke="#FF8FAB" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);

const BellIcon = () => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path d="M12 22C13.1 22 14 21.1 14 20H10C10 21.1 10.9 22 12 22ZM18 16V11C18 7.93 16.36 5.36 13.5 4.68V4C13.5 3.17 12.83 2.5 12 2.5C11.17 2.5 10.5 3.17 10.5 4V4.68C7.63 5.36 6 7.92 6 11V16L4 18V19H20V18L18 16Z" fill="#FFFFFF" />
    </Svg>
);

const NotificationPermissionScreen = ({ onComplete }) => {
    const insets = useSafeAreaInsets();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(40)).current;

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

    const handleAllowNotifications = async () => {
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
                        <View style={styles.mascotContainer}>
                            <View style={styles.mascotBackgroundCircle} />
                            <Image 
                                source={require('../../assets/images/notification-muscot.png')} 
                                style={styles.mascotImage} 
                                resizeMode="contain" 
                            />
                        </View>

                        <View style={styles.titleRow}>
                            <View style={styles.titleBurstContainer}>
                                <TitleBurst />
                            </View>
                            <Text style={styles.title}>Stay Connected</Text>
                            <View style={styles.titleHeartContainer}>
                                <TinyHeart color="#FF8FAB" />
                            </View>
                        </View>
                        <Text style={styles.subtitle}>
                            Get notified when your partner sends you love notes, scribbles, and game invites.
                        </Text>
                    </Animated.View>

                    {/* Features Card */}
                    <Animated.View
                        style={[
                            styles.featuresCard,
                            {
                                opacity: fadeAnim,
                                transform: [{ translateY: slideAnim }],
                            },
                        ]}
                    >
                        {/* Feature 1 */}
                        <View style={styles.featureRow}>
                            <View style={[styles.featureIconBox, { backgroundColor: '#FFEAF2' }]}>
                                <Text style={styles.featureEmoji}>💬</Text>
                            </View>
                            <View style={styles.featureTextContainer}>
                                <Text style={styles.featureTitle}>Partner Messages</Text>
                                <Text style={styles.featureSubtitle}>Never miss a sweet message</Text>
                            </View>
                            <ChevronRight />
                        </View>
                        
                        <View style={styles.divider} />

                        {/* Feature 2 */}
                        <View style={styles.featureRow}>
                            <View style={[styles.featureIconBox, { backgroundColor: '#F0EFFF' }]}>
                                <Text style={styles.featureEmoji}>🖍️</Text>
                            </View>
                            <View style={styles.featureTextContainer}>
                                <Text style={styles.featureTitle}>New Scribbles</Text>
                                <Text style={styles.featureSubtitle}>See their drawings right away</Text>
                            </View>
                            <ChevronRight />
                        </View>

                        <View style={styles.divider} />

                        {/* Feature 3 */}
                        <View style={styles.featureRow}>
                            <View style={[styles.featureIconBox, { backgroundColor: '#EAF4FF' }]}>
                                <Text style={styles.featureEmoji}>🎮</Text>
                            </View>
                            <View style={styles.featureTextContainer}>
                                <Text style={styles.featureTitle}>Game Invites</Text>
                                <Text style={styles.featureSubtitle}>Jump into fun challenges together</Text>
                            </View>
                            <ChevronRight />
                        </View>
                    </Animated.View>

                    <View style={styles.spacer} />

                    {/* Bottom Actions */}
                    <View style={styles.bottomSection}>
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
                                    <Text style={styles.allowButtonText}>Allow Notifications</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity onPress={handleSkip} activeOpacity={0.7} style={styles.skipButton}>
                            <Text style={styles.skipText}>Maybe Later →</Text>
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
        marginTop: isCompactHeight ? 0 : 20,
        marginBottom: isCompactHeight ? 15 : 30,
    },
    mascotContainer: {
        width: isCompactHeight ? 240 : 280,
        height: isCompactHeight ? 240 : 280,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: -20,
        position: 'relative',
    },
    mascotBackgroundCircle: {
        position: 'absolute',
        width: isCompactHeight ? 190 : 230,
        height: isCompactHeight ? 190 : 230,
        borderRadius: isCompactHeight ? 95 : 115,
        backgroundColor: '#FFE4EC',
        opacity: 0.8,
    },
    mascotImage: {
        width: '100%',
        height: '100%',
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
    featuresCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        paddingHorizontal: isCompactHeight ? 16 : 24,
        paddingVertical: isCompactHeight ? 2 : 4,
        shadowColor: '#FFB5D0',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 6,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: isCompactHeight ? 6 : 8,
    },
    featureIconBox: {
        width: 38,
        height: 38,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    featureEmoji: {
        fontSize: 18,
    },
    featureTextContainer: {
        flex: 1,
    },
    featureTitle: {
        fontFamily: fontFamily.bold,
        fontSize: 14,
        fontWeight: fontWeight('700'),
        color: navy,
        letterSpacing: -0.3,
    },
    featureSubtitle: {
        fontFamily: fontFamily.medium,
        fontSize: 11,
        color: '#7380A1',
        marginTop: 1,
        fontWeight: fontWeight('500'),
    },
    divider: {
        height: 1,
        backgroundColor: '#FFEAF2',
        marginHorizontal: 10,
    },
    spacer: {
        height: isCompactHeight ? 16 : 26,
    },
    bottomSection: {
        alignItems: 'center',
        marginBottom: isCompactHeight ? 10 : 20,
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
        elevation: 5,
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
        marginTop: 20,
        paddingVertical: 10,
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
