// Premium Login Screen with Google & Apple Auth
import React, { useState, useRef, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    Animated,
    Dimensions,
    ScrollView,
    ActivityIndicator,
    Alert,
    NativeModules,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signUpWithGoogle, signUpWithApple } from 'react-native-credentials-manager';
import Svg, { Path } from 'react-native-svg';
import GradientBackground from '../components/GradientBackground';
import AnimatedHeart from '../components/AnimatedHeart';
import { colors, spacing, borderRadius, timing } from '../theme';
import { API_BASE } from '../constants/Api';

const { height } = Dimensions.get('window');

// Native module for iOS Google Sign-In
const { GoogleSignInModule } = NativeModules;

// Google Client ID for Android
const GOOGLE_CLIENT_ID_ANDROID = '971652730552-1g49usqdnhu2dc1rh5lh6p9i7cocov9m.apps.googleusercontent.com';

// Animated Social Button with hover effect
const SocialButton = ({ icon, label, onPress, loading, delay = 0, variant = 'default' }) => {
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const pressAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.sequence([
            Animated.delay(delay),
            Animated.spring(scaleAnim, {
                toValue: 1,
                ...timing.springBouncy,
                useNativeDriver: true,
            }),
        ]).start();
    }, [scaleAnim, delay]);

    const handlePressIn = () => {
        Animated.spring(pressAnim, {
            toValue: 0.95,
            ...timing.springSnappy,
            useNativeDriver: true,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(pressAnim, {
            toValue: 1,
            ...timing.springBouncy,
            useNativeDriver: true,
        }).start();
    };

    const isApple = variant === 'apple';

    return (
        <Animated.View
            style={{
                transform: [
                    { scale: Animated.multiply(scaleAnim, pressAnim) },
                ],
                width: '100%',
            }}
        >
            <TouchableOpacity
                style={[
                    styles.socialButton,
                    isApple && styles.appleButton,
                ]}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={onPress}
                activeOpacity={0.9}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator color={isApple ? '#FFFFFF' : colors.text} />
                ) : (
                    <View style={styles.socialButtonContent}>
                        <View style={styles.socialIconContainer}>
                            {icon}
                        </View>
                        <Text style={[
                            styles.socialButtonText,
                            isApple && styles.appleButtonText,
                        ]}>
                            {label}
                        </Text>
                    </View>
                )}
            </TouchableOpacity>
        </Animated.View>
    );
};

// Google Icon SVG
const GoogleIcon = () => (
    <Svg width="20" height="20" viewBox="0 0 48 48">
        <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
);

// Apple Icon SVG
const AppleIcon = () => (
    <Svg width="20" height="20" viewBox="0 0 24 24">
        <Path
            fill="#FFFFFF"
            d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
        />
    </Svg>
);

export const LoginScreen = ({
    onLogin = () => { },
    onBack = () => { },
    onSignUp = () => { },
}) => {
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [isAppleLoading, setIsAppleLoading] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(40)).current;
    const insets = useSafeAreaInsets();

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }),
            Animated.spring(slideAnim, {
                toValue: 0,
                ...timing.springGentle,
                useNativeDriver: true,
            }),
        ]).start();
    }, [fadeAnim, slideAnim]);

    const handleGoogleSignIn = async () => {
        try {
            setIsGoogleLoading(true);

            let idToken;

            if (Platform.OS === 'ios') {
                // Native iOS Google Sign-In
                const result = await GoogleSignInModule.signIn();
                console.log('iOS Google Sign-In result:', result);
                idToken = result.idToken;
            } else {
                // Android - use credentials manager
                const googleCredential = await signUpWithGoogle({
                    serverClientId: GOOGLE_CLIENT_ID_ANDROID,
                    autoSelectEnabled: false,
                });
                console.log('Android Google credential:', googleCredential);
                idToken = googleCredential?.idToken;
            }

            if (!idToken) {
                throw new Error('No ID token received from Google');
            }
            console.log("udbcuids");

            // Send token to backend for verification
            const response = await fetch(`${API_BASE}/api/login/google/loginSignUp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    token: idToken,
                    platform: Platform.OS,
                })
            });
            console.log("Response status:", response.status);
            console.log("Response ok:", response.ok);

            const text = await response.text();
            console.log("Raw response:", text);

            if (!text) {
                throw new Error('Empty response from server');
            }

            const data = JSON.parse(text);
            console.log(data)

            if (data.success && data.user) {
                console.log(data.user)
                onLogin(data.user);
            } else {
                throw new Error(data.error || 'Login failed');
            }
        } catch (error) {
            console.error('Google sign-in failed:', error);
            Alert.alert('Sign In Failed', error.message || 'Please try again');
        } finally {
            setIsGoogleLoading(false);
        }
    };

    const handleAppleSignIn = async () => {
        try {
            setIsAppleLoading(true);

            // Get Apple credential using credentials manager
            const appleCredential = await signUpWithApple({
                requestedScopes: ['fullName', 'email'],
            });

            if (!appleCredential?.idToken) {
                throw new Error('No ID token received from Apple');
            }

            // Send token to backend for verification
            const response = await fetch(`${API_BASE}/api/login/apple/loginSignUp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    idToken: appleCredential.idToken,
                    displayName: appleCredential.displayName,
                    email: appleCredential.email,
                }),
            });

            const data = await response.json();

            if (data.success && data.user) {
                onLogin(data.user);
            } else {
                throw new Error(data.error || 'Login failed');
            }
        } catch (error) {
            console.error('Apple sign-in failed:', error);
            Alert.alert('Sign In Failed', error.message || 'Please try again');
        } finally {
            setIsAppleLoading(false);
        }
    };

    return (
        <GradientBackground variant="warm">
            <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
                {/* App Name - Top Left */}
                <Animated.View style={[styles.brandContainer, { opacity: fadeAnim }]}>
                    <Text style={styles.brandName}>penguin.</Text>
                </Animated.View>

                {/* Spacer to push content down */}
                <View style={styles.spacer} />

                {/* Sign Up Section - Lower on screen */}
                <Animated.View
                    style={[
                        styles.signUpSection,
                        {
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }],
                        }
                    ]}
                >
                    <Text style={styles.title}>Sign up</Text>
                    <Text style={styles.subtitle}>Select an option to get started</Text>
                </Animated.View>

                {/* Social Login Buttons */}
                <Animated.View style={[styles.socialButtons, { opacity: fadeAnim }]}>
                    {/* Google Sign-In - First */}
                    <SocialButton
                        icon={<GoogleIcon />}
                        label="Continue with Google"
                        onPress={handleGoogleSignIn}
                        loading={isGoogleLoading}
                        delay={200}
                    />

                    {/* Apple Sign-In - iOS only */}
                    {Platform.OS === 'ios' && (
                        <SocialButton
                            icon={<AppleIcon />}
                            label="Continue with Apple"
                            onPress={handleAppleSignIn}
                            loading={isAppleLoading}
                            delay={300}
                            variant="apple"
                        />
                    )}
                </Animated.View>

                {/* Footer */}
                <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
                    <View style={styles.signInRow}>
                        <Text style={styles.footerText}>Already have an account? </Text>
                        <TouchableOpacity>
                            <Text style={styles.signInLink}>Sign in</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.termsContainer}>
                        <Text style={styles.termsText}>
                            By signing up for Penguin, you agree to our
                        </Text>
                        <View style={styles.termsLinks}>
                            <TouchableOpacity>
                                <Text style={styles.termsLink}>Terms of Service</Text>
                            </TouchableOpacity>
                            <Text style={styles.termsText}> and </Text>
                            <TouchableOpacity>
                                <Text style={styles.termsLink}>Privacy Policy</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Animated.View>
            </View>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: spacing.xl,
    },
    brandContainer: {
        alignSelf: 'flex-start',
    },
    brandName: {
        fontSize: 28,
        fontWeight: '600',
        color: colors.text,
        letterSpacing: -0.5,
    },
    spacer: {
        flex: 1,
    },
    signUpSection: {
        alignSelf: 'flex-start',
        marginBottom: spacing.xl,
    },
    title: {
        fontSize: 34,
        fontWeight: '800',
        color: colors.text,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 16,
        color: colors.textSecondary,
        marginTop: spacing.xs,
    },
    socialButtons: {
        gap: spacing.md,
        marginBottom: spacing.xl,
    },
    socialButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: borderRadius.xl,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.borderLight,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
    },
    appleButton: {
        backgroundColor: '#000000',
        borderColor: '#000000',
    },
    socialButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    socialIconContainer: {
        width: 40,
        alignItems: 'flex-start',
    },
    socialButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
    },
    appleButtonText: {
        color: '#FFFFFF',
    },
    footer: {
        alignItems: 'center',
        paddingBottom: spacing.lg,
    },
    signInRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: spacing.xl,
    },
    footerText: {
        fontSize: 15,
        color: colors.textSecondary,
    },
    signInLink: {
        fontSize: 15,
        color: colors.text,
        fontWeight: '700',
    },
    termsContainer: {
        alignItems: 'center',
    },
    termsText: {
        fontSize: 12,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    termsLinks: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 2,
    },
    termsLink: {
        fontSize: 12,
        color: colors.text,
        fontWeight: '600',
    },
});

export default LoginScreen;
