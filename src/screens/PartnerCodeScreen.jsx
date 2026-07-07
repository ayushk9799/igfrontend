// Partner Code Screen - Premium Pairing Flow
// Share your code or enter partner's code to connect
import React, { useState, useRef, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    Image,
    TouchableOpacity,
    Animated,
    Dimensions,
    TextInput,
    Alert,
    Clipboard,
    ActivityIndicator,
    StatusBar,
    Keyboard,
    Share,
    Platform,
    ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { API_BASE } from '../constants/Api';
import { updateUser } from '../utils/authStorage';
import { fontFamily, fontWeight } from '../constants/fonts';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');
const isCompactHeight = height < 760;
const navy = '#050E3E';

// --- SVG Icons ---
const TinyHeart = ({ color = "#FF8FAB" }) => (
    <Svg width={18} height={16} viewBox="0 0 14 12" fill="none">
        <Path d="M7 12L6.0125 11.0825C2.4 7.755 0 5.5425 0 2.8425C0 0.81 1.575 -0.75 3.5 -0.75C4.585 -0.75 5.6175 -0.255 6.265 0.4425C6.545 0.705 6.7825 1.0125 7 1.3425C7.2175 1.0125 7.455 0.705 7.735 0.4425C8.3825 -0.255 9.415 -0.75 10.5 -0.75C12.425 -0.75 14 0.81 14 2.8425C14 5.5425 11.6 7.755 7.9875 11.09L7 12Z" fill={color} />
    </Svg>
);

const TitleBurst = () => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path d="M6 16L9 14" stroke="#FF8FAB" strokeWidth={2.5} strokeLinecap="round" />
        <Path d="M4 8L8 10" stroke="#FF8FAB" strokeWidth={2.5} strokeLinecap="round" />
        <Path d="M12 4L13 8" stroke="#FF8FAB" strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
);

const CopyIcon = () => (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d="M16 1H4C2.9 1 2 1.9 2 3V17H4V3H16V1ZM19 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H19C20.1 23 21 22.1 21 21V7C21 5.9 20.1 5 19 5ZM19 21H8V7H19V21Z" fill="#FF5E97" />
    </Svg>
);

const CheckIcon = () => (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d="M9 16.17L4.83 12L3.41 13.41L9 19L21 7L19.59 5.59L9 16.17Z" fill="#FF5E97" />
    </Svg>
);

const Sparkle = ({ x, y, size = 8, delay = 0 }) => {
    const opacity = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        const animate = Animated.loop(
            Animated.sequence([
                Animated.delay(delay),
                Animated.timing(opacity, { toValue: 0.7, duration: 1200, useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 0.1, duration: 1200, useNativeDriver: true }),
                Animated.delay(800),
            ]),
        );
        animate.start();
        return () => animate.stop();
    }, [opacity, delay]);
    return (
        <Animated.View style={{ position: 'absolute', left: x, top: y, opacity, zIndex: 1 }}>
            <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
                <Path d="M8 0C8 4.418 4.418 8 0 8C4.418 8 8 11.582 8 16C8 11.582 11.582 8 16 8C11.582 8 8 4.418 8 0Z" fill="#FFB5D0" />
            </Svg>
        </Animated.View>
    );
};

const FloatingHeart = ({ x, delay = 0, size = 18, color = '#FF8FAB' }) => {
    const translateY = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        const anim = Animated.loop(
            Animated.sequence([
                Animated.delay(delay),
                Animated.parallel([
                    Animated.timing(translateY, { toValue: -height * 0.5, duration: 3500, useNativeDriver: true }),
                    Animated.sequence([
                        Animated.timing(opacity, { toValue: 0.9, duration: 400, useNativeDriver: true }),
                        Animated.delay(2000),
                        Animated.timing(opacity, { toValue: 0, duration: 1100, useNativeDriver: true }),
                    ]),
                    Animated.timing(scaleAnim, { toValue: 1, duration: 3500, useNativeDriver: true }),
                ]),
                Animated.parallel([
                    Animated.timing(translateY, { toValue: 0, duration: 0, useNativeDriver: true }),
                    Animated.timing(opacity, { toValue: 0, duration: 0, useNativeDriver: true }),
                    Animated.timing(scaleAnim, { toValue: 0.3, duration: 0, useNativeDriver: true }),
                ]),
            ])
        );
        anim.start();
        return () => anim.stop();
    }, [delay, translateY, opacity, scaleAnim]);

    return (
        <Animated.View style={{
            position: 'absolute',
            left: x,
            bottom: height * 0.25,
            opacity,
            transform: [{ translateY }, { scale: scaleAnim }],
            zIndex: 5,
        }}>
            <Svg width={size} height={size * 0.86} viewBox="0 0 14 12" fill="none">
                <Path d="M7 12L6.0125 11.0825C2.4 7.755 0 5.5425 0 2.8425C0 0.81 1.575 -0.75 3.5 -0.75C4.585 -0.75 5.6175 -0.255 6.265 0.4425C6.545 0.705 6.7825 1.0125 7 1.3425C7.2175 1.0125 7.455 0.705 7.735 0.4425C8.3825 -0.255 9.415 -0.75 10.5 -0.75C12.425 -0.75 14 0.81 14 2.8425C14 5.5425 11.6 7.755 7.9875 11.09L7 12Z" fill={color} />
            </Svg>
        </Animated.View>
    );
};

export const PartnerCodeScreen = ({
    partnerCode = 'XXXXXX',
    userId,
    partnerId = null, // Check if already paired
    partnerUsername = null,
    onPaired = () => { },
    onSkip = () => { },
}) => {
    const [enteredCode, setEnteredCode] = useState('');
    const [isPairing, setIsPairing] = useState(false);
    const [pairingStatus, setPairingStatus] = useState('');
    const [copied, setCopied] = useState(false);
    const [isAlreadyPaired, setIsAlreadyPaired] = useState(false);
    const [pairedPartner, setPairedPartner] = useState(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(40)).current;
    const connectedScale = useRef(new Animated.Value(0)).current;
    const pairedScale = useRef(new Animated.Value(0)).current;
    const shareCardAnim = useRef(new Animated.Value(1)).current;
    const insets = useSafeAreaInsets();

    // Check if user is already paired on mount or when partnerId changes
    useEffect(() => {
        if (partnerId) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            setIsAlreadyPaired(true);
            Animated.spring(connectedScale, {
                toValue: 1,
                friction: 5,
                tension: 80,
                useNativeDriver: true,
            }).start();
        }
    }, [partnerId, connectedScale]);

    useEffect(() => {
        if (!isAlreadyPaired) {
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
        }
    }, [fadeAnim, slideAnim, isAlreadyPaired]);

    const handleFocus = () => {
        Animated.timing(shareCardAnim, {
            toValue: 0,
            duration: 250,
            useNativeDriver: false,
        }).start();
    };

    const handleBlur = () => {
        Animated.timing(shareCardAnim, {
            toValue: 1,
            duration: 250,
            useNativeDriver: false,
        }).start();
    };

    const mascotScale = shareCardAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0.75, 1],
    });

    const contentTranslateY = shareCardAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-40, 0],
    });



    // If already paired (passive partner), show connected screen
    if (isAlreadyPaired) {
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
                    {/* Floating Hearts */}
                    <FloatingHeart x={width * 0.1} delay={0} size={20} color="#FF8FAB" />
                    <FloatingHeart x={width * 0.25} delay={400} size={14} color="#FF5E97" />
                    <FloatingHeart x={width * 0.45} delay={800} size={22} color="#FFB5D0" />
                    <FloatingHeart x={width * 0.65} delay={200} size={16} color="#FF8FAB" />
                    <FloatingHeart x={width * 0.8} delay={600} size={18} color="#FFA1C9" />
                    <FloatingHeart x={width * 0.15} delay={1000} size={12} color="#FF5E97" />
                    <FloatingHeart x={width * 0.55} delay={1400} size={24} color="#FFB5D0" />
                    <FloatingHeart x={width * 0.35} delay={1800} size={15} color="#FFA1C9" />

                    <View style={styles.connectedContainer}>
                        <Animated.View style={[styles.connectedContent, { transform: [{ scale: connectedScale }] }]}>
                            <Text style={styles.connectedEmoji}>💕</Text>
                            <Text style={styles.connectedTitle}>You're Connected!</Text>
                            {partnerUsername && (
                                <Text style={styles.connectedSubtitle}>
                                    {partnerUsername} just paired with you
                                </Text>
                            )}
                        </Animated.View>
                    </View>
                </LinearGradient>
            </View>
        );
    }

    // If just paired by initiator, show connected screen with floating hearts
    if (pairedPartner) {
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
                    {/* Floating Hearts */}
                    <FloatingHeart x={width * 0.1} delay={0} size={20} color="#FF8FAB" />
                    <FloatingHeart x={width * 0.25} delay={400} size={14} color="#FF5E97" />
                    <FloatingHeart x={width * 0.45} delay={800} size={22} color="#FFB5D0" />
                    <FloatingHeart x={width * 0.65} delay={200} size={16} color="#FF8FAB" />
                    <FloatingHeart x={width * 0.8} delay={600} size={18} color="#FFA1C9" />
                    <FloatingHeart x={width * 0.15} delay={1000} size={12} color="#FF5E97" />
                    <FloatingHeart x={width * 0.55} delay={1400} size={24} color="#FFB5D0" />
                    <FloatingHeart x={width * 0.35} delay={1800} size={15} color="#FFA1C9" />

                    <View style={styles.connectedContainer}>
                        <Animated.View style={[styles.connectedContent, { transform: [{ scale: pairedScale }] }]}>
                            <Text style={styles.connectedEmoji}>💕</Text>
                            <Text style={styles.connectedTitle}>You're Connected!</Text>
                            <Text style={styles.connectedSubtitle}>
                                You're now paired with {pairedPartner.name}
                            </Text>
                        </Animated.View>
                    </View>
                </LinearGradient>
            </View>
        );
    }

    const handleCopyCode = () => {
        Clipboard.setString(partnerCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleShareCode = async () => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            await Share.share({
                message: `Join me on Penguin Couple\n\nMy invitation code is ${partnerCode}\n\nhttps://penguincouples.com/`,
            });
        } catch (error) {
            console.error('Error sharing code:', error);
        }
    };

    const handlePair = async (codeToUse) => {
        const code = codeToUse || enteredCode;
        if (code.length !== 6) {
            Alert.alert('Invalid Code', 'Partner code must be 6 characters');
            return;
        }

        setIsPairing(true);
        setPairingStatus('Verifying code...');
        try {
            setPairingStatus('Connecting...');
            const response = await fetch(`${API_BASE}/api/partner/pair`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    partnerCode: code.toUpperCase(),
                }),
            });

            const data = await response.json();

            if (data.success) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                setPairingStatus('Paired! 💕');
                // Save partner info to storage
                updateUser({
                    partnerId: data.partner.id,
                    partnerUsername: data.partner.name,
                    partnerAvatar: data.partner.avatar || null,
                    connectionDate: data.partner.connectionDate,
                    relationshipStartDate: data.partner.relationshipStartDate,
                    shouldAskRelationshipStartDate: data.partner.shouldAskRelationshipStartDate || false,
                });

                // Show connected screen with floating hearts
                setPairedPartner(data.partner);
                Animated.spring(pairedScale, {
                    toValue: 1,
                    friction: 5,
                    tension: 80,
                    useNativeDriver: true,
                }).start();

                // Auto-navigate after showing the connected screen
                setTimeout(() => {
                    onPaired(data.partner);
                }, 3000);
            } else {
                Alert.alert('Pairing Failed', data.error || 'Could not connect with this code');
            }
        } catch (error) {
            console.error('Pairing error:', error);
            Alert.alert('Error', 'Network error. Please try again.');
        } finally {
            setIsPairing(false);
            setPairingStatus('');
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
                {/* Background sparkles */}
                <Sparkle x={width * 0.08} y={height * 0.06} size={7} delay={0} />
                <Sparkle x={width * 0.85} y={height * 0.1} size={9} delay={600} />
                <Sparkle x={width * 0.9} y={height * 0.35} size={7} delay={1200} />
                <Sparkle x={width * 0.05} y={height * 0.45} size={6} delay={800} />

                {/* Brand Logo - fixed at top */}
                <View style={[styles.brandContainer, { paddingTop: insets.top + 10 }]}>
                    <Image
                        source={require('../../assets/images/penguin-text-logo.png')}
                        style={styles.brandLogo}
                        resizeMode="contain"
                    />
                </View>

                <ScrollView
                    style={[styles.scrollView, { backgroundColor: 'transparent' }]}
                    contentContainerStyle={[
                        styles.scrollContent,
                        {
                            paddingTop: insets.top + (isCompactHeight ? 36 : 42),
                            paddingBottom: insets.bottom + 20,
                        }
                    ]}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <Animated.View style={{ transform: [{ translateY: contentTranslateY }] }}>
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
                        <Animated.View style={[styles.mascotContainer, { transform: [{ scale: mascotScale }] }]}>
                            <View style={styles.mascotBackgroundCircle} />
                            <Image
                                source={require('../../assets/images/connect-couple.png')}
                                style={styles.mascotImage}
                                resizeMode="contain"
                            />
                        </Animated.View>

                        <View style={styles.titleRow}>
                            <View style={styles.titleBurstLeft}>
                                <TitleBurst />
                            </View>
                            <Text style={styles.title}>Connect with your Love</Text>
                            <View style={styles.titleHeartRight}>
                                <TinyHeart color="#FF8FAB" />
                            </View>
                        </View>
                        <Text style={styles.subtitle}>Share your code or enter theirs to pair</Text>
                    </Animated.View>

                    {/* Share Code Card */}
                    <Animated.View
                        style={[
                            styles.codeSection,
                            {
                                opacity: fadeAnim,
                                transform: [{ translateY: slideAnim }],
                            },
                        ]}
                    >
                        {/* Smoothly Collapsible Container for Share Code Card & Divider */}
                        <Animated.View style={{
                            opacity: shareCardAnim,
                            maxHeight: shareCardAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, 260],
                            }),
                            transform: [{ scale: shareCardAnim }],
                            overflow: 'hidden',
                        }}>
                            {/* Share Code Card */}
                            <View style={styles.shareCodeCard}>
                                <View style={styles.codeRow}>
                                    <TouchableOpacity
                                        style={[styles.copyButton, copied && styles.copyButtonCopied]}
                                        onPress={handleCopyCode}
                                        activeOpacity={0.7}
                                    >
                                        {copied ? <CheckIcon /> : <CopyIcon />}
                                    </TouchableOpacity>
                                    <Text style={styles.codeText}>{partnerCode}</Text>
                                </View>

                                <TouchableOpacity
                                    style={styles.shareButton}
                                    onPress={handleShareCode}
                                    activeOpacity={0.85}
                                >
                                    <LinearGradient
                                        colors={['#FF5E97', '#FFA1C9']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.shareButtonGradient}
                                    >
                                        <Text style={styles.shareButtonText}>Share Code with Partner</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>

                            {/* OR Divider */}
                            <View style={styles.divider}>
                                <View style={styles.dividerLine} />
                                <Text style={styles.dividerText}>OR</Text>
                                <View style={styles.dividerLine} />
                            </View>
                        </Animated.View>

                        {/* Enter Partner Code Card */}
                        <View style={styles.enterCodeCard}>
                            <Text style={styles.cardLabel}>Enter your Partner Code</Text>
                            <TextInput
                                style={[styles.codeInput, isPairing && styles.codeInputDisabled]}
                                value={enteredCode}
                                onChangeText={(text) => {
                                    const formatted = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
                                    setEnteredCode(formatted);
                                    if (formatted.length === 6) {
                                        Keyboard.dismiss();
                                        handlePair(formatted);
                                    }
                                }}
                                onFocus={handleFocus}
                                onBlur={handleBlur}
                                placeholder="ABC123"
                                placeholderTextColor="#D1A3B8"
                                maxLength={6}
                                autoCapitalize="characters"
                                autoCorrect={false}
                                editable={!isPairing}
                            />

                            {/* Loading State */}
                            {isPairing && (
                                <View style={styles.loadingContainer}>
                                    <ActivityIndicator size="small" color="#FF5E97" />
                                    <Text style={styles.loadingText}>{pairingStatus}</Text>
                                </View>
                            )}
                        </View>
                    </Animated.View>

                    {/* Skip Button */}
                    <Animated.View style={[styles.skipContainer, { opacity: fadeAnim }]}>
                        <TouchableOpacity onPress={onSkip} activeOpacity={0.7}>
                            <Text style={styles.skipText}>I'll do this later →</Text>
                        </TouchableOpacity>
                    </Animated.View>
                    </Animated.View>
                </ScrollView>

                {/* Bottom Clouds */}
                <View style={styles.cloudsContainer}>
                    <View style={[styles.cloud, styles.cloudOne]} />
                    <View style={[styles.cloud, styles.cloudTwo]} />
                    <View style={[styles.cloud, styles.cloudThree]} />
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
    scrollView: {
        flex: 1,
        zIndex: 2,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 24,
    },
    brandContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 24,
        zIndex: 10,
    },
    brandLogo: {
        width: isCompactHeight ? 120 : 140,
        height: isCompactHeight ? 36 : 42,
        marginLeft: -14,
    },
    heroSection: {
        alignItems: 'center',
        marginBottom: isCompactHeight ? 10 : 20,
    },
    mascotContainer: {
        width: isCompactHeight ? 200 : 240,
        height: isCompactHeight ? 200 : 240,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: -15,
        position: 'relative',
    },
    mascotBackgroundCircle: {
        position: 'absolute',
        width: isCompactHeight ? 170 : 210,
        height: isCompactHeight ? 170 : 210,
        borderRadius: isCompactHeight ? 85 : 105,
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
    titleBurstLeft: {
        position: 'absolute',
        left: -25,
        top: -8,
    },
    titleHeartRight: {
        position: 'absolute',
        right: -25,
        top: -2,
    },
    title: {
        fontFamily: fontFamily.extraBold,
        fontSize: isCompactHeight ? 24 : 28,
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
        fontWeight: fontWeight('500'),
    },
    codeSection: {
        gap: 0,
    },
    shareCodeCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        paddingHorizontal: 24,
        paddingVertical: isCompactHeight ? 14 : 18,
        alignItems: 'center',
        shadowColor: '#FFB5D0',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 6,
    },
    cardLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#7380A1',
        marginBottom: 10,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        textAlign: 'center',
    },
    codeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        gap: 12,
    },
    codeText: {
        fontSize: 22,
        fontWeight: '800',
        color: '#FF5E97',
        letterSpacing: 6,
    },
    copyButton: {
        width: 38,
        height: 38,
        backgroundColor: '#FFF0F5',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    copyButtonCopied: {
        backgroundColor: '#FFE4EC',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: isCompactHeight ? 12 : 16,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#FFD1E3',
    },
    dividerText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#7380A1',
        paddingHorizontal: 16,
    },
    enterCodeCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        paddingHorizontal: 24,
        paddingVertical: isCompactHeight ? 14 : 18,
        shadowColor: '#FFB5D0',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 6,
    },
    codeInput: {
        backgroundColor: '#FFF5F8',
        borderRadius: 16,
        paddingVertical: isCompactHeight ? 12 : 14,
        paddingHorizontal: 16,
        fontSize: 20,
        fontWeight: '800',
        color: navy,
        textAlign: 'center',
        letterSpacing: 6,
        marginBottom: isCompactHeight ? 12 : 16,
        borderWidth: 1.5,
        borderColor: '#FFE4EC',
    },
    codeInputDisabled: {
        opacity: 0.6,
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
        gap: 8,
    },
    loadingText: {
        fontSize: 13,
        color: '#7380A1',
        fontWeight: '600',
    },
    connectButtonWrapper: {
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
    shareButton: {
        width: '75%',
        height: isCompactHeight ? 38 : 42,
        borderRadius: 21,
        overflow: 'hidden',
        marginTop: 16,
        shadowColor: '#FF5E97',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 4,
    },
    shareButtonGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    shareButtonText: {
        fontSize: isCompactHeight ? 12 : 13,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    connectButtonDisabled: {
        opacity: 0.5,
    },
    connectButtonGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    connectButtonText: {
        fontSize: isCompactHeight ? 14 : 15,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    skipContainer: {
        alignItems: 'center',
        marginTop: isCompactHeight ? 16 : 24,
        paddingVertical: 10,
    },
    skipText: {
        fontSize: 14,
        color: '#7380A1',
        fontWeight: '600',
    },
    connectedContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    connectedContent: {
        alignItems: 'center',
    },
    connectedEmoji: {
        fontSize: 64,
        marginBottom: 20,
    },
    connectedTitle: {
        fontSize: isCompactHeight ? 28 : 34,
        fontWeight: '800',
        color: navy,
        textAlign: 'center',
        marginBottom: 8,
    },
    connectedSubtitle: {
        fontSize: isCompactHeight ? 13 : 14,
        color: '#7380A1',
        textAlign: 'center',
        fontWeight: '600',
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
});

export default PartnerCodeScreen;
