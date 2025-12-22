// Never Have I Ever Question Screen - Confession style UI
// Features two-choice selection (I have / Never) with animated cards
import React, { useState, useRef, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Animated,
    Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import GradientBackground from '../components/GradientBackground';
import Button from '../components/Button';
import Card from '../components/Card';
import { colors, spacing, borderRadius } from '../theme';

const { width, height } = Dimensions.get('window');

// Category config for confessions type (orange theme)
const categoryConfig = {
    color: '#F4A261',
    emoji: '🤫',
    gradient: ['#F4A261', '#FFD093'],
    bgGradient: ['#FFF8F0', '#FFF0E0'],
};

// Spice level configurations
const spiceLevelConfig = {
    mild: { emoji: '🌶️', label: 'Mild', color: '#4CAF50' },
    medium: { emoji: '🌶️🌶️', label: 'Medium', color: '#FF9800' },
    spicy: { emoji: '🌶️🌶️🌶️', label: 'Spicy', color: '#F44336' },
    extra_spicy: { emoji: '🔥', label: 'Extra Spicy', color: '#D32F2F' },
};

// Answer Choice Card Component
const ChoiceCard = ({ choice, isSelected, onPress, disabled, index }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    // Choice specific config
    const choiceConfig = {
        'I have': {
            emoji: '😏',
            gradient: ['#FF6B9D', '#FF8FAB'],
            bgGradient: ['#FFF0F5', '#FFE4EC'],
        },
        'Never': {
            emoji: '😇',
            gradient: ['#5BB5A6', '#8DD5C7'],
            bgGradient: ['#E8F8F5', '#D0F0EA'],
        },
    };

    const config = choiceConfig[choice] || {
        emoji: '❓',
        gradient: ['#6B7280', '#9CA3AF'],
        bgGradient: ['#F3F4F6', '#E5E7EB'],
    };

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                delay: index * 150,
                useNativeDriver: true,
            }),
            Animated.spring(slideAnim, {
                toValue: 0,
                tension: 50,
                friction: 8,
                delay: index * 150,
                useNativeDriver: true,
            }),
        ]).start();
    }, [fadeAnim, slideAnim, index]);

    const handlePress = () => {
        if (disabled) return;

        Animated.sequence([
            Animated.timing(scaleAnim, {
                toValue: 0.95,
                duration: 100,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                tension: 50,
                friction: 6,
                useNativeDriver: true,
            }),
        ]).start();

        onPress(choice);
    };

    return (
        <Animated.View
            style={[
                styles.choiceWrapper,
                {
                    opacity: fadeAnim,
                    transform: [
                        { translateY: slideAnim },
                        { scale: scaleAnim },
                    ],
                },
            ]}
        >
            <TouchableOpacity
                style={[
                    styles.choiceCard,
                    isSelected && styles.choiceCardSelected,
                ]}
                onPress={handlePress}
                activeOpacity={0.9}
                disabled={disabled}
            >
                {/* Background Gradient */}
                <LinearGradient
                    colors={isSelected ? config.gradient : config.bgGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.choiceGradient}
                />

                {/* Decorative Circle */}
                <View style={[
                    styles.decorativeCircle,
                    { backgroundColor: (isSelected ? '#FFFFFF' : config.gradient[0]) + '20' }
                ]} />

                {/* Content */}
                <View style={styles.choiceContent}>
                    <View style={[
                        styles.emojiContainer,
                        { backgroundColor: isSelected ? 'rgba(255,255,255,0.3)' : config.gradient[0] + '20' }
                    ]}>
                        <Text style={styles.choiceEmoji}>{config.emoji}</Text>
                    </View>
                    <Text style={[
                        styles.choiceText,
                        isSelected && styles.choiceTextSelected,
                    ]}>
                        {choice}
                    </Text>
                </View>

                {/* Selected Indicator */}
                {isSelected && (
                    <View style={styles.selectedBadge}>
                        <Text style={styles.selectedCheck}>✓</Text>
                    </View>
                )}
            </TouchableOpacity>
        </Animated.View>
    );
};

// Spice Level Badge Component
const SpiceBadge = ({ level }) => {
    const config = spiceLevelConfig[level] || spiceLevelConfig.mild;

    return (
        <View style={[styles.spiceBadge, { backgroundColor: config.color + '15' }]}>
            <Text style={styles.spiceEmoji}>{config.emoji}</Text>
            <Text style={[styles.spiceLabel, { color: config.color }]}>{config.label}</Text>
        </View>
    );
};

export const NeverHaveIEverScreen = ({
    currentQuestion = {
        id: '1',
        statement: "gone skinny dipping",
        number: 1,
        total: 18,
        spiceLevel: 'mild',
        options: ['I have', 'Never'],
    },
    partnerName = 'Your Love',
    onSubmitAnswer = () => { },
    onBack = () => { },
}) => {
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const insets = useSafeAreaInsets();

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
            }),
            Animated.spring(slideAnim, {
                toValue: 0,
                tension: 50,
                friction: 10,
                useNativeDriver: true,
            }),
        ]).start();
    }, [fadeAnim, slideAnim]);

    // Pulse animation for the question card
    useEffect(() => {
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.02,
                    duration: 2000,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 2000,
                    useNativeDriver: true,
                }),
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, [pulseAnim]);

    const handleChoiceSelect = (choice) => {
        if (!hasSubmitted) {
            setSelectedAnswer(choice === selectedAnswer ? null : choice);
        }
    };

    const handleSubmit = () => {
        if (selectedAnswer) {
            setHasSubmitted(true);
            onSubmitAnswer(selectedAnswer);
        }
    };

    const options = currentQuestion.options || ['I have', 'Never'];

    return (
        <GradientBackground variant="warm">
            <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
                {/* Header */}
                <Animated.View
                    style={[
                        styles.header,
                        {
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }],
                        },
                    ]}
                >
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                            <Path
                                d="M15 18l-6-6 6-6"
                                stroke={colors.text}
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </Svg>
                    </TouchableOpacity>
                    <View style={styles.headerContent}>
                        <View style={styles.headerRow}>
                            <Text style={styles.headerTitle}>Never Have I Ever</Text>
                            <View style={styles.progressBadge}>
                                <Text style={styles.progressText}>
                                    #{currentQuestion.number}/{currentQuestion.total}
                                </Text>
                            </View>
                        </View>
                        <Text style={styles.headerSubtitle}>Confess your secrets!</Text>
                    </View>
                </Animated.View>

                {/* Question Card */}
                <Animated.View
                    style={[
                        styles.questionCard,
                        {
                            opacity: fadeAnim,
                            transform: [
                                { translateY: slideAnim },
                                { scale: pulseAnim },
                            ],
                        },
                    ]}
                >
                    <LinearGradient
                        colors={categoryConfig.bgGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.questionGradient}
                    />

                  
                    {/* Question Text */}
                    <View style={styles.questionTextContainer}>
                        <Text style={styles.prefixText}>Never have I ever...</Text>
                        <Text style={styles.questionText}>"{currentQuestion.statement}"</Text>
                    </View>

                    {/* Spice Level */}
                </Animated.View>

                {/* Choice Cards */}
                <View style={styles.choicesContainer}>
                    <Text style={styles.choicesTitle}>Your confession:</Text>
                    <View style={styles.choicesRow}>
                        {options.map((choice, index) => (
                            <ChoiceCard
                                key={choice}
                                choice={choice}
                                isSelected={selectedAnswer === choice}
                                onPress={handleChoiceSelect}
                                disabled={hasSubmitted}
                                index={index}
                            />
                        ))}
                    </View>
                </View>

                {/* Submit Button */}
                {!hasSubmitted && (
                    <Animated.View
                        style={[
                            styles.submitContainer,
                            { opacity: fadeAnim },
                        ]}
                    >
                        <Button
                            title={selectedAnswer ? "Confess! 🤫" : "Select your answer"}
                            onPress={handleSubmit}
                            variant="primary"
                            size="lg"
                            fullWidth
                            disabled={!selectedAnswer}
                        />
                    </Animated.View>
                )}

                {/* After Submission */}
                {hasSubmitted && (
                    <View style={styles.submittedSection}>
                        <View style={styles.submittedBadge}>
                            <Text style={styles.submittedIcon}>✓</Text>
                            <Text style={styles.submittedText}>Confession Locked!</Text>
                        </View>

                        <View style={styles.partnerSection}>
                            <Text style={styles.partnerSectionTitle}>{partnerName}'s Confession</Text>
                            <Card variant="glass" padding="lg">
                                <View style={styles.lockedContent}>
                                    <View style={styles.lockIcon}>
                                        <Text style={styles.lockEmoji}>🔒</Text>
                                    </View>
                                    <Text style={styles.lockTitle}>Waiting...</Text>
                                    <Text style={styles.lockText}>
                                        You'll see their confession once they respond
                                    </Text>
                                </View>
                            </Card>
                        </View>
                    </View>
                )}

                {/* Tip */}
                <View style={styles.tipContainer}>
                    <Text style={styles.tipText}>
                        💡 Be honest! That's what makes it fun!
                    </Text>
                </View>
            </View>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: spacing.xl,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    backButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.borderLight,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    headerContent: {
        marginLeft: spacing.md,
        flex: 1,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: colors.text,
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: 4,
    },
    progressBadge: {
        backgroundColor: categoryConfig.color + '20',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.md,
    },
    progressText: {
        fontSize: 12,
        fontWeight: '700',
        color: categoryConfig.color,
    },
    questionCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius['2xl'],
        padding: spacing.xl,
        marginBottom: spacing.xl,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.borderLight,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
        elevation: 8,
    },
    questionGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    categoryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        marginBottom: spacing.lg,
        gap: spacing.xs,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    categoryEmoji: {
        fontSize: 14,
    },
    categoryText: {
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    questionTextContainer: {
        marginBottom: spacing.lg,
        alignItems: 'center',
    },
    prefixText: {
        fontSize: 16,
        fontWeight: '600',
        color: categoryConfig.color,
        marginBottom: spacing.xs,
    },
    questionText: {
        fontSize: 22,
        fontWeight: '700',
        color: colors.text,
        textAlign: 'center',
        lineHeight: 32,
        fontStyle: 'italic',
    },
    spiceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.md,
        gap: spacing.xs,
    },
    spiceEmoji: {
        fontSize: 12,
    },
    spiceLabel: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    choicesContainer: {
        marginBottom: spacing.xl,
    },
    choicesTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text,
        marginBottom: spacing.md,
    },
    choicesRow: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    choiceWrapper: {
        flex: 1,
    },
    choiceCard: {
        borderRadius: borderRadius['2xl'],
        padding: spacing.lg,
        borderWidth: 2,
        borderColor: colors.borderLight,
        overflow: 'hidden',
        position: 'relative',
        minHeight: 120,
    },
    choiceCardSelected: {
        borderColor: 'transparent',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 8,
    },
    choiceGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: borderRadius['2xl'],
    },
    decorativeCircle: {
        position: 'absolute',
        width: 80,
        height: 80,
        borderRadius: 40,
        right: -20,
        bottom: -20,
    },
    choiceContent: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    emojiContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    choiceEmoji: {
        fontSize: 28,
    },
    choiceText: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text,
        textAlign: 'center',
    },
    choiceTextSelected: {
        color: '#FFFFFF',
    },
    selectedBadge: {
        position: 'absolute',
        top: spacing.sm,
        right: spacing.sm,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    selectedCheck: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    submitContainer: {
        marginBottom: spacing.lg,
    },
    submittedSection: {
        marginBottom: spacing.lg,
    },
    submittedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.successSoft,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: borderRadius.xl,
        marginBottom: spacing.lg,
        gap: spacing.sm,
    },
    submittedIcon: {
        fontSize: 16,
        color: colors.success,
    },
    submittedText: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.success,
    },
    partnerSection: {
        marginTop: spacing.sm,
    },
    partnerSectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text,
        marginBottom: spacing.md,
    },
    lockedContent: {
        alignItems: 'center',
        paddingVertical: spacing.md,
    },
    lockIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.backgroundAlt,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    lockEmoji: {
        fontSize: 24,
    },
    lockTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.text,
        marginBottom: spacing.xs,
    },
    lockText: {
        fontSize: 13,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    tipContainer: {
        alignItems: 'center',
        paddingVertical: spacing.sm,
    },
    tipText: {
        fontSize: 13,
        color: colors.textMuted,
        textAlign: 'center',
    },
});

export default NeverHaveIEverScreen;
