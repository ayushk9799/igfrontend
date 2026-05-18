// Premium Login Screen with Google & Apple Auth
import React, { useState, useRef, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Platform,
    Dimensions,
    ActivityIndicator,
    Alert,
    NativeModules,
    Linking,
    Image,
    Animated,
    StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signUpWithGoogle, signUpWithApple } from 'react-native-credentials-manager';
import Svg, { Path } from 'react-native-svg';
import LinearGradient from 'react-native-linear-gradient';
import { spacing } from '../theme';
import { API_BASE } from '../constants/Api';

const { width, height } = Dimensions.get('window');
const isCompactHeight = height < 760;
const navy = '#050E3E';

// Native module for iOS Google Sign-In
const { GoogleSignInModule } = NativeModules;

// Google Client ID for Android
const GOOGLE_CLIENT_ID_ANDROID = '971652730552-1g49usqdnhu2dc1rh5lh6p9i7cocov9m.apps.googleusercontent.com';

// Sparkle star component
const Sparkle = ({ x, y, size = 8, delay = 0 }) => {
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animate = Animated.loop(
            Animated.sequence([
                Animated.delay(delay),
                Animated.timing(opacity, {
                    toValue: 0.8,
                    duration: 1200,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 0.1,
                    duration: 1200,
                    useNativeDriver: true,
                }),
                Animated.delay(800),
            ]),
        );
        animate.start();
        return () => animate.stop();
    }, [opacity, delay]);

    return (
        <Animated.View style={{ position: 'absolute', left: x, top: y, opacity }}>
            <Svg width={size} height={size} viewBox="0 0 24 24">
                <Path
                    d="M12 0L14.59 8.41L24 12L14.59 15.59L12 24L9.41 15.59L0 12L9.41 8.41L12 0Z"
                    fill="rgba(255,255,255,0.9)"
                />
            </Svg>
        </Animated.View>
    );
};

// Floating heart
const FloatingHeart = ({ x, y, size = 16, delay = 0 }) => {
    const translateY = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animate = () => {
            translateY.setValue(0);
            opacity.setValue(0);
            Animated.sequence([
                Animated.delay(delay),
                Animated.parallel([
                    Animated.timing(translateY, {
                        toValue: -60,
                        duration: 3500,
                        useNativeDriver: true,
                    }),
                    Animated.sequence([
                        Animated.timing(opacity, {
                            toValue: 0.7,
                            duration: 600,
                            useNativeDriver: true,
                        }),
                        Animated.timing(opacity, {
                            toValue: 0.7,
                            duration: 1800,
                            useNativeDriver: true,
                        }),
                        Animated.timing(opacity, {
                            toValue: 0,
                            duration: 1100,
                            useNativeDriver: true,
                        }),
                    ]),
                ]),
            ]).start(() => animate());
        };
        animate();
        return () => {
            translateY.stopAnimation();
            opacity.stopAnimation();
        };
    }, [delay, translateY, opacity]);

    return (
        <Animated.View style={{ position: 'absolute', left: x, top: y, opacity, transform: [{ translateY }] }}>
            <Svg width={size} height={size} viewBox="0 0 24 24">
                <Path
                    fill="#FF8FAB"
                    d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                />
            </Svg>
        </Animated.View>
    );
};

// Social Button
const SocialButton = ({ icon, label, onPress, loading, disabled }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.97,
            useNativeDriver: true,
            tension: 300,
            friction: 10,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 300,
            friction: 10,
        }).start();
    };

    return (
        <Animated.View style={{ width: '100%', transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
                style={styles.socialButton}
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                activeOpacity={1}
                disabled={disabled || loading}
            >
                {loading ? (
                    <ActivityIndicator color="#2D3748" />
                ) : (
                    <View style={styles.socialButtonContent}>
                        <View style={styles.socialIconContainer}>
                            {icon}
                        </View>
                        <Text style={styles.socialButtonText}>{label}</Text>
                    </View>
                )}
            </TouchableOpacity>
        </Animated.View>
    );
};

// Google Icon SVG
const GoogleIcon = () => (
    <Svg width="22" height="22" viewBox="0 0 48 48">
        <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
);

// Apple Icon SVG (black for white button)
const AppleIcon = () => (
    <Svg width="22" height="22" viewBox="0 0 24 24">
        <Path
            fill="#000000"
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
    const insets = useSafeAreaInsets();
    const isAnyLoading = isGoogleLoading || isAppleLoading;

    // Entrance animations
    const imageScale = useRef(new Animated.Value(0.85)).current;
    const imageOpacity = useRef(new Animated.Value(0)).current;
    const contentOpacity = useRef(new Animated.Value(0)).current;
    const contentTranslateY = useRef(new Animated.Value(25)).current;

    useEffect(() => {
        Animated.sequence([
            Animated.parallel([
                Animated.spring(imageScale, {
                    toValue: 1,
                    useNativeDriver: true,
                    tension: 50,
                    friction: 7,
                }),
                Animated.timing(imageOpacity, {
                    toValue: 1,
                    duration: 500,
                    useNativeDriver: true,
                }),
            ]),
            Animated.parallel([
                Animated.timing(contentOpacity, {
                    toValue: 1,
                    duration: 350,
                    useNativeDriver: true,
                }),
                Animated.spring(contentTranslateY, {
                    toValue: 0,
                    useNativeDriver: true,
                    tension: 80,
                    friction: 12,
                }),
            ]),
        ]).start();
    }, [imageScale, imageOpacity, contentOpacity, contentTranslateY]);

    const handleGoogleSignIn = async () => {
        try {
            setIsGoogleLoading(true);

            let idToken;

            if (Platform.OS === 'ios') {
                // Native iOS Google Sign-In
                const result = await GoogleSignInModule.signIn();
                idToken = result.idToken;
            } else {
                // Android - use credentials manager
                const googleCredential = await signUpWithGoogle({
                    serverClientId: GOOGLE_CLIENT_ID_ANDROID,
                    autoSelectEnabled: false,
                });
                idToken = googleCredential?.idToken;
            }

            if (!idToken) {
                throw new Error('No ID token received from Google');
            }

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

            const text = await response.text();

            if (!text) {
                throw new Error('Empty response from server');
            }

            const data = JSON.parse(text);

            if (data.success && data.user) {
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
        <View style={styles.root}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <LinearGradient
                colors={['#F8D9EC', '#FFF7FA', '#FFF4F7', '#F7D8F2']}
                locations={[0, 0.34, 0.72, 1]}
                start={{ x: 0.25, y: 0 }}
                end={{ x: 0.75, y: 1 }}
                style={styles.gradient}
            >
                <Sparkle x={width * 0.1} y={height * 0.05} size={7} delay={0} />
                <Sparkle x={width * 0.74} y={height * 0.06} size={8} delay={600} />
                <Sparkle x={width * 0.92} y={height * 0.15} size={11} delay={1000} />
                <Sparkle x={width * 0.18} y={height * 0.42} size={7} delay={1400} />
                <Sparkle x={width * 0.8} y={height * 0.52} size={7} delay={400} />
                <Sparkle x={width * 0.12} y={height * 0.86} size={6} delay={900} />
                <FloatingHeart x={width * 0.77} y={height * 0.55} size={20} delay={600} />

                <View style={[styles.container, { paddingTop: insets.top + 4, paddingBottom: insets.bottom + 12 }]}>

                    {/* Brand Logo */}
                    <View style={styles.brandContainer}>
                        <Image 
                            source={require('../../assets/images/penguin-text-logo.png')} 
                            style={styles.brandLogo} 
                            resizeMode="contain" 
                        />
                    </View>

                    {/* Penguin Illustration - centered */}
                    <Animated.View
                        style={[
                            styles.illustrationSection,
                            {
                                opacity: imageOpacity,
                                transform: [{ scale: imageScale }],
                            },
                        ]}
                    >
                        <Image
                            source={require('../../assets/images/login-penguine.png')}
                            style={styles.penguinImage}
                            resizeMode="cover"
                        />
                    </Animated.View>

                    {/* Bottom Content */}
                    <Animated.View
                        style={[
                            styles.bottomSection,
                            {
                                opacity: contentOpacity,
                                transform: [{ translateY: contentTranslateY }],
                            },
                        ]}
                    >
                        {/* Welcome Text - centered */}
                        <View style={styles.welcomeSection}>
                            <Text style={styles.title}>Welcome back <Text style={styles.heartEmoji}>💕</Text></Text>
                            <Text style={styles.subtitle}>Sign in to keep growing together.</Text>
                        </View>

                        {/* Social Login Buttons */}
                        <View style={styles.socialButtons}>
                            <SocialButton
                                icon={<GoogleIcon />}
                                label="Continue with Google"
                                onPress={handleGoogleSignIn}
                                loading={isGoogleLoading}
                                disabled={isAnyLoading}
                            />

                            {Platform.OS === 'ios' && (
                                <SocialButton
                                    icon={<AppleIcon />}
                                    label="Continue with Apple"
                                    onPress={handleAppleSignIn}
                                    loading={isAppleLoading}
                                    disabled={isAnyLoading}
                                />
                            )}
                        </View>

                        {/* Footer */}
                        <View style={styles.footer}>


                            <View style={styles.termsContainer}>
                                <Text style={styles.termsText}>
                                    By signing up for Penguin, you agree to our
                                </Text>
                                <View style={styles.termsLinks}>
                                    <TouchableOpacity onPress={() => Linking.openURL('https://ayushk9799.github.io/penguin-legal/terms-of-service.html')}>
                                        <Text style={styles.termsLink}>Terms of Service</Text>
                                    </TouchableOpacity>
                                    <Text style={styles.termsText}> and </Text>
                                    <TouchableOpacity onPress={() => Linking.openURL('https://ayushk9799.github.io/penguin-legal/privacy-policy.html')}>
                                        <Text style={styles.termsLink}>Privacy Policy</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
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
    container: {
        flex: 1,
        paddingHorizontal: 34,
    },

    // Brand
    brandContainer: {
        alignSelf: 'flex-start',
        marginTop: 0,
        marginLeft: 0,
    },
    brandLogo: {
        width: isCompactHeight ? 120 : 140,
        height: isCompactHeight ? 36 : 42,
        marginLeft: -14, // Added negative margin to pull the logo left
    },

    // Illustration
    illustrationSection: {
        height: isCompactHeight ? height * 0.4 : height * 0.43,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: isCompactHeight ? -4 : 8,
        marginHorizontal: -34,
        overflow: 'hidden',
    },
    penguinImage: {
        width: width,
        height: isCompactHeight ? height * 0.46 : height * 0.5,
    },

    // Bottom section
    bottomSection: {
        flex: 1,
        justifyContent: 'flex-end',
        paddingBottom: isCompactHeight ? 2 : 10,
    },

    // Welcome text
    welcomeSection: {
        alignItems: 'center',
        marginBottom: isCompactHeight ? 18 : 30,
    },
    title: {
        fontSize: isCompactHeight ? 28 : 34,
        fontWeight: '800',
        color: navy,
        textAlign: 'center',
        letterSpacing: -0.4,
    },
    heartEmoji: {
        fontSize: isCompactHeight ? 17 : 20,
    },
    subtitle: {
        fontSize: isCompactHeight ? 13 : 14,
        color: '#687498',
        textAlign: 'center',
        marginTop: isCompactHeight ? 6 : 10,
        fontWeight: '500',
    },

    // Social Buttons
    socialButtons: {
        gap: isCompactHeight ? 14 : 18,
        marginBottom: isCompactHeight ? 24 : 36,
    },
    socialButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: isCompactHeight ? 44 : 48,
        paddingVertical: isCompactHeight ? 8 : 10,
        paddingHorizontal: 20,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.96)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.98)',
        shadowColor: '#B5A2C6',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 4,
    },
    socialButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    socialIconContainer: {
        width: 44,
        alignItems: 'center',
        marginRight: 18,
    },
    socialButtonText: {
        fontSize: isCompactHeight ? 14 : 15,
        fontWeight: '700',
        color: navy,
    },

    // Footer
    footer: {
        alignItems: 'center',
        gap: isCompactHeight ? 16 : 24,
        paddingBottom: isCompactHeight ? spacing.xs : spacing.sm,
    },
    termsContainer: {
        alignItems: 'center',
        paddingHorizontal: spacing.sm,
    },
    termsText: {
        fontSize: isCompactHeight ? 10 : 11,
        color: '#7A83A4',
        textAlign: 'center',
        fontWeight: '500',
        lineHeight: isCompactHeight ? 15 : 16,
    },
    termsLinks: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 2,
    },
    termsLink: {
        fontSize: isCompactHeight ? 10 : 11,
        color: '#FF6B99',
        fontWeight: '700',
        lineHeight: isCompactHeight ? 15 : 16,
    },
});

export default LoginScreen;
