// Nickname Entry Screen - Matching Login Screen Theme
import React, { useState, useRef, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GradientBackground from '../components/GradientBackground';
import { colors, spacing, borderRadius, timing } from '../theme';

const NicknameScreen = ({ onComplete, onBack }) => {
    const [nickname, setNickname] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(40)).current;
    const inputScale = useRef(new Animated.Value(0.95)).current;
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
            Animated.spring(inputScale, {
                toValue: 1,
                ...timing.springBouncy,
                useNativeDriver: true,
            }),
        ]).start();
    }, [fadeAnim, slideAnim, inputScale]);

    const handleContinue = () => {
        if (nickname.trim().length > 0) {
            onComplete?.(nickname.trim());
        }
    };

    const isValid = nickname.trim().length > 0;

    return (
        <GradientBackground variant="warm">
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
                    {/* App Name - Top Left */}
                    <Animated.View style={[styles.brandContainer, { opacity: fadeAnim }]}>
                        <Text style={styles.brandName}>penguin.</Text>
                    </Animated.View>

                    {/* Spacer to push content down */}
                    <View style={styles.spacer} />

                    {/* Nickname Section - Lower on screen */}
                    <Animated.View
                        style={[
                            styles.nicknameSection,
                            {
                                opacity: fadeAnim,
                                transform: [{ translateY: slideAnim }],
                            }
                        ]}
                    >
                        <Text style={styles.title}>choose a nickname</Text>
                        <Text style={styles.subtitle}>What should your partner call you?</Text>
                    </Animated.View>

                    {/* Input Field */}
                    <Animated.View
                        style={[
                            styles.inputWrapper,
                            { opacity: fadeAnim, transform: [{ scale: inputScale }] }
                        ]}
                    >
                        <View style={[
                            styles.inputContainer,
                            isFocused && styles.inputContainerFocused,
                        ]}>
                            <View style={styles.inputIconContainer} />
                            <TextInput
                                style={styles.input}
                                placeholder="e.g., Honey, Babe, Love..."
                                placeholderTextColor={colors.textMuted}
                                value={nickname}
                                onChangeText={setNickname}
                                onFocus={() => setIsFocused(true)}
                                onBlur={() => setIsFocused(false)}
                                autoCapitalize="words"
                                autoCorrect={false}
                                maxLength={20}
                                autoFocus
                            />
                        </View>

                        {/* Character count */}
                    </Animated.View>

                    {/* Continue Button */}
                    <Animated.View style={[styles.buttonContainer, { opacity: fadeAnim }]}>
                        <TouchableOpacity
                            style={[
                                styles.continueButton,
                                !isValid && styles.continueButtonDisabled,
                            ]}
                            onPress={handleContinue}
                            activeOpacity={0.9}
                            disabled={!isValid}
                        >
                            <Text style={[
                                styles.continueButtonText,
                                !isValid && styles.continueButtonTextDisabled,
                            ]}>
                                Continue →
                            </Text>
                        </TouchableOpacity>
                    </Animated.View>

                    {/* Footer */}

                </View>
            </KeyboardAvoidingView>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    keyboardView: {
        flex: 1,
    },
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
    nicknameSection: {
        alignSelf: 'flex-start',
        marginBottom: spacing.xl,
    },
    title: {
        fontSize: 34,
        fontWeight: '600',
        color: colors.text,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 16,
        color: colors.textSecondary,
        marginTop: spacing.xs,
    },
    inputWrapper: {
        marginBottom: spacing.xl,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 0,
        backgroundColor: 'transparent',
    },
    inputContainerFocused: {
        // No visible change on focus
    },
    inputIconContainer: {
        width: 40,
        alignItems: 'flex-start',
    },
    inputIcon: {
        fontSize: 20,
    },
    input: {
        flex: 1,
        fontSize: 24,
        fontWeight: '700',
        color: colors.text,
        padding: 0,
        letterSpacing: -0.5,
    },
    charCount: {
        fontSize: 13,
        fontWeight: '500',
        color: colors.textMuted,
        textAlign: 'right',
        marginTop: spacing.sm,
        marginRight: spacing.xs,
    },
    buttonContainer: {
        marginBottom: spacing.xl,
    },
    continueButton: {
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: borderRadius.xl,
        backgroundColor: '#000000',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 4,
    },
    continueButtonDisabled: {
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        shadowOpacity: 0.05,
    },
    continueButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    continueButtonTextDisabled: {
        color: 'rgba(255, 255, 255, 0.6)',
    },
    footer: {
        alignItems: 'center',
        paddingBottom: spacing.lg,
    },
    skipText: {
        fontSize: 15,
        color: colors.text,
        fontWeight: '700',
        marginBottom: spacing.xl,
    },
    hintContainer: {
        alignItems: 'center',
    },
    hintText: {
        fontSize: 12,
        color: colors.textSecondary,
        textAlign: 'center',
    },
});

export default NicknameScreen;
