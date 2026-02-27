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
        <View style={{ flex: 1, backgroundColor: '#000000' }}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
                    {/* App Name - Top Left */}
                    <View style={styles.brandContainer}>
                        <Text style={styles.brandName}>penguin.</Text>
                    </View>

                    {/* Spacer to push content down */}
                    <View style={styles.spacer} />

                    {/* Nickname Section - Lower on screen */}
                    <View
                        style={styles.nicknameSection}
                    >
                        <Text style={styles.title}>choose a nickname</Text>
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
                                placeholderTextColor="rgba(255,255,255,0.35)"
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
        </View>
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
        color: '#FFFFFF',
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
        color: '#FFFFFF',
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.6)',
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
        color: '#FFFFFF',
        padding: 0,
        letterSpacing: -0.5,
    },
    charCount: {
        fontSize: 13,
        fontWeight: '500',
        color: 'rgba(255,255,255,0.35)',
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
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    continueButtonDisabled: {
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
    },
    continueButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000000',
    },
    continueButtonTextDisabled: {
        color: 'rgba(0, 0, 0, 0.4)',
    },
    footer: {
        alignItems: 'center',
        paddingBottom: spacing.lg,
    },
    skipText: {
        fontSize: 15,
        color: '#FFFFFF',
        fontWeight: '700',
        marginBottom: spacing.xl,
    },
    hintContainer: {
        alignItems: 'center',
    },
    hintText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
    },
});

export default NicknameScreen;
