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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import GradientBackground from '../components/GradientBackground';
import { colors, spacing, borderRadius } from '../theme';

const NicknameScreen = ({ onComplete, onBack }) => {
    const [nickname, setNickname] = useState('');
    const [isFocused, setIsFocused] = useState(false);

    const insets = useSafeAreaInsets();



    const handleContinue = () => {
        if (nickname.trim().length > 0) {
            onComplete?.(nickname.trim());
        }
    };

    const isValid = nickname.trim().length > 0;

    return (
        <GradientBackground variant="light" showOrbs={true} showParticles={true}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
                    {/* App Name - Top Left */}
                    <View style={styles.brandContainer}>
                        <Text style={styles.brandName}>🐧 Penguin</Text>
                    </View>

                    {/* Spacer to push content down */}
                    <View style={styles.spacer} />

                    {/* Nickname Section - Lower on screen */}
                    <View
                        style={styles.nicknameSection}
                    >
                        <Text style={styles.title}>Choose a nickname</Text>
                        <Text style={styles.subtitle}>What should your partner call you?</Text>
                    </View>

                    {/* Input Field */}
                    <View
                        style={styles.inputWrapper}
                    >
                        <View style={[
                            styles.inputContainer,
                            isFocused && styles.inputContainerFocused,
                        ]}>
                            <View style={styles.inputIconContainer} />
                            <TextInput
                                style={styles.input}
                                placeholder="e.g., Honey, Babe, Love..."
                                placeholderTextColor={colors.textLight}
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
                    </View>

                    {/* Continue Button */}
                    <View style={styles.buttonContainer}>
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
                    </View>

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
        fontWeight: '800',
        color: colors.primary,
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
        fontWeight: '800',
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
        paddingVertical: 14,
        paddingHorizontal: spacing.lg,
        backgroundColor: '#FFFFFF',
        borderRadius: borderRadius.xl,
        borderWidth: 1.5,
        borderColor: '#FAE8FF',
        ...Platform.select({
            ios: {
                shadowColor: '#C084FC',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    inputContainerFocused: {
        borderColor: colors.primary,
    },
    inputIconContainer: {
        width: 10,
    },
    inputIcon: {
        fontSize: 20,
    },
    input: {
        flex: 1,
        fontSize: 20,
        fontWeight: '700',
        color: colors.text,
        padding: 0,
        letterSpacing: -0.5,
    },
    charCount: {
        fontSize: 13,
        fontWeight: '500',
        color: colors.textSecondary,
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
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    continueButtonDisabled: {
        backgroundColor: '#E2E8F0',
        shadowOpacity: 0,
        elevation: 0,
    },
    continueButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    continueButtonTextDisabled: {
        color: '#A0AEC0',
    },
    footer: {
        alignItems: 'center',
        paddingBottom: spacing.lg,
    },
    skipText: {
        fontSize: 15,
        color: colors.primary,
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
