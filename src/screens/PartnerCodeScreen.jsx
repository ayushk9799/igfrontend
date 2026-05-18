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
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import LinearGradient from 'react-native-linear-gradient';
import GradientBackground from '../components/GradientBackground';
import Button from '../components/Button';
import { colors, spacing, borderRadius, shadows } from '../theme';
import { API_BASE } from '../constants/Api';
import { updateUser } from '../utils/authStorage';
import penguinImage from '../../assets/splashscreen.png';

const { width, height } = Dimensions.get('window');
const IMAGE_SIZE = Math.min(width * 0.45, 180);

// Floating butterfly animation
const FloatingButterfly = ({ delay = 0, startX, startY }) => {
    const translateX = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(0)).current;
    const rotate = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.delay(delay),
                Animated.parallel([
                    Animated.timing(opacity, { toValue: 0.6, duration: 500, useNativeDriver: true }),
                    Animated.timing(translateX, { toValue: 30, duration: 3000, useNativeDriver: true }),
                    Animated.timing(translateY, { toValue: -20, duration: 3000, useNativeDriver: true }),
                    Animated.timing(rotate, { toValue: 1, duration: 3000, useNativeDriver: true }),
                ]),
                Animated.parallel([
                    Animated.timing(translateX, { toValue: 0, duration: 3000, useNativeDriver: true }),
                    Animated.timing(translateY, { toValue: 0, duration: 3000, useNativeDriver: true }),
                    Animated.timing(rotate, { toValue: 0, duration: 3000, useNativeDriver: true }),
                ]),
                Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
                Animated.delay(2000),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, [delay, translateX, translateY, rotate, opacity]);

    const rotateInterpolate = rotate.interpolate({
        inputRange: [0, 1],
        outputRange: ['-15deg', '15deg'],
    });

    return (
        <Animated.Text
            style={[
                styles.butterfly,
                {
                    left: startX,
                    top: startY,
                    opacity,
                    transform: [{ translateX }, { translateY }, { rotate: rotateInterpolate }],
                },
            ]}
        >
            🦋
        </Animated.Text>
    );
};

// Pulsing circle around image
const PulsingCircle = ({ size }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const opacityAnim = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.parallel([
                    Animated.timing(scaleAnim, { toValue: 1.15, duration: 1500, useNativeDriver: true }),
                    Animated.timing(opacityAnim, { toValue: 0.1, duration: 1500, useNativeDriver: true }),
                ]),
                Animated.parallel([
                    Animated.timing(scaleAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
                    Animated.timing(opacityAnim, { toValue: 0.3, duration: 1500, useNativeDriver: true }),
                ]),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, [scaleAnim, opacityAnim]);

    return (
        <Animated.View
            style={[
                styles.pulsingCircle,
                {
                    width: size + 40,
                    height: size + 40,
                    borderRadius: (size + 40) / 2,
                    opacity: opacityAnim,
                    transform: [{ scale: scaleAnim }],
                },
            ]}
        />
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
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const connectedScale = useRef(new Animated.Value(0)).current;
    const insets = useSafeAreaInsets();

    // Check if user is already paired on mount or when partnerId changes
    useEffect(() => {
        if (partnerId) {
            setIsAlreadyPaired(true);
            // Animate the connected screen
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
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true
            }).start();
        }
    }, [fadeAnim, isAlreadyPaired]);

    // If already paired, show connected text instead of pairing UI
    if (isAlreadyPaired) {
        return (
            <GradientBackground variant="light" showOrbs={true} showParticles={true}>
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
            </GradientBackground>
        );
    }

    const handleCopyCode = () => {
        Clipboard.setString(partnerCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handlePair = async () => {
        if (enteredCode.length !== 6) {
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
                    partnerCode: enteredCode.toUpperCase(),
                }),
            });

            const data = await response.json();

            if (data.success) {
                setPairingStatus('Paired! 💕');
                // Save partner info to storage
                updateUser({
                    partnerId: data.partner.id,
                    partnerUsername: data.partner.name,
                    partnerAvatar: data.partner.avatar || null,
                    connectionDate: data.partner.connectionDate,
                });

                // Small delay for satisfying UX
                await new Promise(resolve => setTimeout(resolve, 500));

                Alert.alert('Connected! 💕', `You're now paired with ${data.partner.name}!`, [
                    { text: 'Continue', onPress: () => onPaired(data.partner) },
                ]);
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
        <GradientBackground variant="light" showOrbs={true} showParticles={true}>
            <KeyboardAwareScrollView
                style={styles.scrollView}
                contentContainerStyle={[
                    styles.scrollContent,
                    {
                        paddingTop: insets.top + spacing.lg,
                        paddingBottom: insets.bottom + spacing.xl + 20
                    }
                ]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bottomOffset={100}
            >
                {/* Floating butterflies */}
                <FloatingButterfly delay={0} startX={width * 0.1} startY={height * 0.15} />
                <FloatingButterfly delay={2000} startX={width * 0.75} startY={height * 0.2} />
                <FloatingButterfly delay={4000} startX={width * 0.6} startY={height * 0.08} />

                {/* Hero Section with Girl Image */}
                <Animated.View
                    style={[
                        styles.heroSection,
                        { opacity: fadeAnim },
                    ]}
                >
                    <View style={styles.imageContainer}>
                        <PulsingCircle size={IMAGE_SIZE} />
                        <View style={styles.imageWrapper}>
                            <Image source={penguinImage} style={styles.girlImage} resizeMode="contain" />
                        </View>
                    </View>

                    <Text style={styles.title}>connect with your Love </Text>
                    <Text style={styles.subtitle}>Share your code or enter theirs to pair</Text>
                </Animated.View>

                {/* Your Code Section */}
                <Animated.View
                    style={[
                        styles.codeSection,
                        { opacity: fadeAnim }
                    ]}
                >
                    <View style={styles.yourCodeCard}>
                        <Text style={styles.cardLabel}>Share this Code</Text>
                        <View style={styles.codeRow}>
                            <Text style={styles.codeText}>{partnerCode}</Text>
                            <TouchableOpacity
                                style={[styles.copyButton, copied && styles.copyButtonCopied]}
                                onPress={handleCopyCode}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.copyIcon}>{copied ? '✓' : '📋'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Divider */}
                    <View style={styles.divider}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>OR</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    {/* Enter Partner Code Section */}
                    <View style={styles.enterCodeCard}>
                        <Text style={styles.cardLabel}>Enter Partner's Code</Text>
                        <TextInput
                            style={[styles.codeInput, isPairing && styles.codeInputDisabled]}
                            value={enteredCode}
                            onChangeText={(text) => setEnteredCode(text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                            placeholder="ABC123"
                            placeholderTextColor="rgba(255,255,255,0.35)"
                            maxLength={6}
                            autoCapitalize="characters"
                            autoCorrect={false}
                            editable={!isPairing}
                        />

                        {/* Loading State */}
                        {isPairing && (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="small" color="#FFFFFF" />
                                <Text style={styles.loadingText}>{pairingStatus}</Text>
                            </View>
                        )}

                        <Button
                            title={isPairing ? 'Connecting...' : 'Connect 💫'}
                            onPress={handlePair}
                            variant="primary"
                            size="lg"
                            fullWidth
                            disabled={enteredCode.length !== 6 || isPairing}
                        />
                    </View>
                </Animated.View>

                {/* Skip Button */}
                <Animated.View style={[styles.skipContainer, { opacity: fadeAnim }]}>
                    <TouchableOpacity onPress={onSkip} activeOpacity={0.7}>
                        <Text style={styles.skipText}>I'll do this later →</Text>
                    </TouchableOpacity>
                </Animated.View>
            </KeyboardAwareScrollView>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: spacing.xl,
    },
    butterfly: {
        position: 'absolute',
        fontSize: 24,
        zIndex: 10,
    },
    heroSection: {
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    imageContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.lg,
    },
    pulsingCircle: {
        position: 'absolute',
        backgroundColor: colors.primarySoft,
    },
    imageWrapper: {
        width: IMAGE_SIZE,
        height: IMAGE_SIZE,
        borderRadius: IMAGE_SIZE / 2,
        backgroundColor: '#FFF0F3',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FAE8FF',
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: '#C084FC',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.08,
                shadowRadius: 12,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    girlImage: {
        width: IMAGE_SIZE * 0.9,
        height: IMAGE_SIZE * 1.2,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: colors.text,
        textAlign: 'center',
        letterSpacing: -0.5,
        marginBottom: spacing.sm,
    },
    subtitle: {
        fontSize: 15,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    codeSection: {
        flex: 1,
        justifyContent: 'center',
    },
    yourCodeCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: borderRadius.xl,
        padding: spacing.xl,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#FAE8FF',
        ...Platform.select({
            ios: {
                shadowColor: '#C084FC',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.05,
                shadowRadius: 12,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    cardLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: colors.textSecondary,
        marginBottom: spacing.md,
        letterSpacing: 0.5,
    },
    codeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        position: 'relative',
    },
    codeText: {
        fontSize: 24,
        fontWeight: '800',
        color: colors.primary,
        letterSpacing: 4,
    },
    copyButton: {
        position: 'absolute',
        right: 0,
        width: 40,
        height: 40,
        backgroundColor: '#FFF0F3',
        borderRadius: borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
    },
    copyButtonCopied: {
        backgroundColor: '#FFE1E6',
    },
    copyIcon: {
        fontSize: 18,
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: spacing.lg,
    },
    dividerLine: {
        flex: 1,
        height: 1.5,
        backgroundColor: '#FAE8FF',
    },
    dividerText: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.textSecondary,
        paddingHorizontal: spacing.lg,
    },
    enterCodeCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: borderRadius.xl,
        padding: spacing.xl,
        borderWidth: 1.5,
        borderColor: '#FAE8FF',
        ...Platform.select({
            ios: {
                shadowColor: '#C084FC',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.05,
                shadowRadius: 12,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    codeInput: {
        backgroundColor: '#FFF6F6',
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        fontSize: 24,
        fontWeight: '800',
        color: colors.text,
        textAlign: 'center',
        letterSpacing: 8,
        marginBottom: spacing.lg,
        borderWidth: 1.5,
        borderColor: '#FAE8FF',
    },
    codeInputDisabled: {
        opacity: 0.6,
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
        gap: spacing.sm,
    },
    loadingText: {
        fontSize: 14,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    skipContainer: {
        alignItems: 'center',
        paddingVertical: spacing.lg,
    },
    skipText: {
        fontSize: 15,
        color: colors.primary,
        fontWeight: '700',
    },
    connectedContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
    },
    connectedContent: {
        alignItems: 'center',
    },
    connectedEmoji: {
        fontSize: 64,
        marginBottom: spacing.lg,
    },
    connectedTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: colors.text,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    connectedSubtitle: {
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: 'center',
        fontWeight: '600',
    },
});

export default PartnerCodeScreen;
