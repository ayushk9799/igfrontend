// Introduce Yourself Screen - Sign Up Flow
// Premium onboarding first step
import React, { useState, useRef, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    Image,
    TouchableOpacity,
    Animated,
    Dimensions,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    InteractionManager,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import GradientBackground from '../components/GradientBackground';
import Button from '../components/Button';
import Input from '../components/Input';
import { colors, spacing, borderRadius, timing } from '../theme';
import boyImage from '../../assets/boy.png';
import girlImage from '../../assets/girl.png';
const { width, height } = Dimensions.get('window');

// Import gender images

export const IntroduceYourselfScreen = ({
    initialData = {},
    onNext = () => { },
    onBack = () => { },
}) => {
    const [name, setName] = useState(initialData.name || '');
    const [age, setAge] = useState(initialData.age || '');
    const [gender, setGender] = useState(initialData.gender || ''); // 'male' or 'female'

    // Start with visible content - no blocking entry animation
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const formFade = useRef(new Animated.Value(1)).current;
    const insets = useSafeAreaInsets();

    const handleNext = () => {
        if (name.trim() && age.trim() && gender) {
            onNext({ name: name.trim(), age: age.trim(), gender });
        }
    };

    const isFormValid = name.trim() && age.trim() && gender;

    return (
        <GradientBackground variant="midnight">
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    contentContainerStyle={[
                        styles.scrollContent,
                        { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl }
                    ]}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onBack} style={styles.backButton}>
                            <Text style={styles.backIcon}>←</Text>
                        </TouchableOpacity>
                        <View style={styles.progressContainer}>
                            <View style={[styles.progressDot, styles.progressDotActive]} />
                            <View style={styles.progressDot} />
                            <View style={styles.progressDot} />
                        </View>
                    </View>



                    <Animated.View style={[styles.form, { opacity: formFade }]}>
                        <Input
                            label="Your Name"
                            placeholder="What should we call you?"
                            value={name}
                            onChangeText={setName}
                            variant="glass"
                            leftIcon={<Text style={styles.inputIcon}>👤</Text>}
                        />

                        <Input
                            label="Your Age"
                            placeholder="How young are you?"
                            value={age}
                            onChangeText={(text) => setAge(text.replace(/[^0-9]/g, ''))}
                            keyboardType="numeric"
                            maxLength={2}
                            variant="glass"
                            leftIcon={<Text style={styles.inputIcon}>🎂</Text>}
                        />

                        {/* Gender Selection */}
                        <View style={styles.genderSection}>
                            <Text style={styles.genderLabel}>I am a...</Text>
                            <View style={styles.genderButtons}>
                                <TouchableOpacity
                                    style={[
                                        styles.genderButton,
                                        gender === 'male' && styles.genderButtonActive,
                                    ]}
                                    onPress={() => setGender('male')}
                                    activeOpacity={0.8}
                                >
                                    <LinearGradient
                                        colors={gender === 'male'
                                            ? [colors.auroraBlue + '40', colors.auroraBlue + '20']
                                            : [colors.glass, colors.glass]
                                        }
                                        style={styles.genderGradient}
                                    >
                                        <Image source={boyImage} style={styles.genderImage} resizeMode="contain" />
                                        <Text style={[
                                            styles.genderText,
                                            gender === 'male' && styles.genderTextActive
                                        ]}>Boy</Text>
                                        {gender === 'male' && (
                                            <View style={styles.genderCheck}>
                                                <Text style={styles.checkIcon}>✓</Text>
                                            </View>
                                        )}
                                    </LinearGradient>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.genderButton,
                                        gender === 'female' && styles.genderButtonActive,
                                    ]}
                                    onPress={() => setGender('female')}
                                    activeOpacity={0.8}
                                >
                                    <LinearGradient
                                        colors={gender === 'female'
                                            ? [colors.primary + '40', colors.primary + '20']
                                            : [colors.glass, colors.glass]
                                        }
                                        style={styles.genderGradient}
                                    >
                                        <Image source={girlImage} style={styles.genderImage} resizeMode="contain" />
                                        <Text style={[
                                            styles.genderText,
                                            gender === 'female' && styles.genderTextActive
                                        ]}>Girl</Text>
                                        {gender === 'female' && (
                                            <View style={[styles.genderCheck, { backgroundColor: colors.primary }]}>
                                                <Text style={styles.checkIcon}>✓</Text>
                                            </View>
                                        )}
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Animated.View>

                    {/* Next Button */}
                    <View style={styles.buttonContainer}>
                        <Button
                            title="Continue 💫"
                            onPress={handleNext}
                            variant="glow"
                            size="xl"
                            fullWidth
                            disabled={!isFormValid}
                        />
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: spacing.xl,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.xl,
    },
    backButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.glass,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.glassBorder,
    },
    backIcon: {
        fontSize: 22,
        color: colors.text,
    },
    progressContainer: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    progressDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.glassBorder,
    },
    progressDotActive: {
        width: 24,
        backgroundColor: colors.primary,
    },
    heroSection: {
        alignItems: 'center',
        marginBottom: spacing['2xl'],
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: colors.text,
        marginTop: spacing.lg,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 16,
        color: colors.textSecondary,
        marginTop: spacing.sm,
    },
    form: {
        flex: 1,
    },
    inputIcon: {
        fontSize: 18,
    },
    genderSection: {
        marginTop: spacing.md,
    },
    genderLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: spacing.md,
        marginLeft: spacing.sm,
        letterSpacing: 0.5,
    },
    genderButtons: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    genderButton: {
        flex: 1,
        borderRadius: borderRadius.xl,
        overflow: 'hidden',
    },
    genderButtonActive: {
        // Border handled by gradient
    },
    genderGradient: {
        padding: spacing.xl,
        alignItems: 'center',
        borderRadius: borderRadius.xl,
        borderWidth: 1.5,
        borderColor: colors.glassBorder,
        position: 'relative',
    },
    genderEmoji: {
        fontSize: 48,
        marginBottom: spacing.md,
    },
    genderImage: {
        width: 96,
        height: 200,
        marginBottom: spacing.md,
    },
    genderText: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.textSecondary,
    },
    genderTextActive: {
        color: colors.text,
    },
    genderCheck: {
        position: 'absolute',
        top: spacing.md,
        right: spacing.md,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: colors.auroraBlue,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkIcon: {
        fontSize: 14,
        color: colors.text,
        fontWeight: '700',
    },
    buttonContainer: {
        marginTop: spacing.xl,
    },
});

export default IntroduceYourselfScreen;
