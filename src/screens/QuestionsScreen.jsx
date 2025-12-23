// Premium Questions Screen - Daily Connection
// Enhanced with typewriter effect and animated reveals
import React, { useState, useRef, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    ScrollView,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import GradientBackground from '../components/GradientBackground';
import Card from '../components/Card';
import Button from '../components/Button';
import { colors, spacing, borderRadius, timing } from '../theme';

const categoryConfig = {
    // Legacy categories
    memories: { color: '#FF6B9D', emoji: '📸', gradient: ['#FF6B9D30', '#FF6B9D10'] },
    dreams: { color: '#BF5AF2', emoji: '✨', gradient: ['#BF5AF230', '#BF5AF210'] },
    gratitude: { color: '#30D158', emoji: '🙏', gradient: ['#30D15830', '#30D15810'] },
    fun: { color: '#FFD60A', emoji: '🎉', gradient: ['#FFD60A30', '#FFD60A10'] },
    deep: { color: '#FF2D78', emoji: '💭', gradient: ['#FF2D7830', '#7C3AED20'] },
    // New category types
    comparison: { color: '#FF6B9D', emoji: '⚖️', gradient: ['#FF6B9D30', '#FF6B9D10'] },
    knowledge: { color: '#5BB5A6', emoji: '🧠', gradient: ['#5BB5A630', '#5BB5A610'] },
    agreement: { color: '#BF5AF2', emoji: '🎯', gradient: ['#BF5AF230', '#BF5AF210'] },
    neverhaveiever: { color: '#F4A261', emoji: '🤫', gradient: ['#F4A26130', '#F4A26110'] },
};

// Typewriter Text Component
const TypewriterText = ({ text, style, delay = 30 }) => {
    const [displayedText, setDisplayedText] = useState('');
    const [showCursor, setShowCursor] = useState(true);

    useEffect(() => {
        let index = 0;
        const timer = setInterval(() => {
            if (index < text.length) {
                setDisplayedText(text.slice(0, index + 1));
                index++;
            } else {
                clearInterval(timer);
                setTimeout(() => setShowCursor(false), 500);
            }
        }, delay);

        return () => clearInterval(timer);
    }, [text, delay]);

    return (
        <Text style={style}>
            {displayedText}
            {showCursor && <Text style={styles.cursor}>|</Text>}
        </Text>
    );
};

// Animated Card Flip for revealing partner's answer
const FlipCard = ({ children, flipped, frontContent }) => {
    const flipAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.spring(flipAnim, {
            toValue: flipped ? 1 : 0,
            ...timing.springBouncy,
            useNativeDriver: true,
        }).start();
    }, [flipped, flipAnim]);

    const frontInterpolate = flipAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: ['0deg', '90deg', '180deg'],
    });

    const backInterpolate = flipAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: ['180deg', '90deg', '0deg'],
    });

    const frontOpacity = flipAnim.interpolate({
        inputRange: [0, 0.5],
        outputRange: [1, 0],
        extrapolate: 'clamp',
    });

    const backOpacity = flipAnim.interpolate({
        inputRange: [0.5, 1],
        outputRange: [0, 1],
        extrapolate: 'clamp',
    });

    return (
        <View>
            <Animated.View
                style={[
                    styles.flipCardSide,
                    {
                        opacity: frontOpacity,
                        transform: [{ perspective: 1000 }, { rotateY: frontInterpolate }],
                    },
                ]}
            >
                {frontContent}
            </Animated.View>
            <Animated.View
                style={[
                    styles.flipCardSide,
                    styles.flipCardBack,
                    {
                        opacity: backOpacity,
                        transform: [{ perspective: 1000 }, { rotateY: backInterpolate }],
                    },
                ]}
            >
                {children}
            </Animated.View>
        </View>
    );
};

export const QuestionsScreen = ({
    currentQuestion = {
        id: '1',
        text: "What's something you've never told me that you appreciate about us?",
        category: 'deep'
    },
    yourAnswer = '',
    partnerAnswer = '',
    partnerName = 'Your Love',
    isLocked = true,
    onSubmitAnswer = () => { },
    onBack = () => { },
}) => {
    const [answer, setAnswer] = useState(yourAnswer || '');
    const [showPartnerAnswer, setShowPartnerAnswer] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const submitPulse = useRef(new Animated.Value(1)).current;
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

    // Pulse animation for submit button when ready
    useEffect(() => {
        if (answer.trim() && !yourAnswer) {
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(submitPulse, {
                        toValue: 1.02,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                    Animated.timing(submitPulse, {
                        toValue: 1,
                        duration: 1000,
                        useNativeDriver: true,
                    }),
                ])
            );
            pulse.start();
            return () => pulse.stop();
        }
    }, [answer, yourAnswer, submitPulse]);

    const handleSubmit = () => {
        if (answer.trim()) {
            onSubmitAnswer(answer);
        }
    };

    const canViewPartnerAnswer = !isLocked && !!yourAnswer;
    const config = categoryConfig[currentQuestion.category];

    return (
        <GradientBackground variant="warm">
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    contentContainerStyle={[
                        styles.contentContainer,
                        { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing['2xl'] }
                    ]}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onBack} style={styles.backButton}>
                            <Text style={styles.backIcon}>←</Text>
                        </TouchableOpacity>
                        <View style={styles.headerContent}>
                            <Text style={styles.title}>Daily Question</Text>
                            <Text style={styles.subtitle}>Connect deeper together 💫</Text>
                        </View>
                    </View>

                    {/* Question & Answer Card - Merged */}
                    <Animated.View
                        style={[
                            styles.questionCardWrapper,
                            {
                                opacity: fadeAnim,
                                transform: [{ translateY: slideAnim }],
                            },
                        ]}
                    >
                        <View style={styles.questionCard}>
                            {/* Category Badge */}
                            <View style={styles.questionHeader}>
                                <View style={[styles.categoryBadge, { backgroundColor: config.color + '20' }]}>
                                    <Text style={styles.categoryEmoji}>{config.emoji}</Text>
                                    <Text style={[styles.categoryText, { color: config.color }]}>
                                        {currentQuestion.category}
                                    </Text>
                                </View>
                                <View style={styles.questionNumberBadge}>
                                    <Text style={styles.questionNumber}>#42</Text>
                                </View>
                            </View>

                            {/* Question Text */}
                            <Text style={styles.questionText}>
                                "{currentQuestion.text}"
                            </Text>

                            {/* Divider */}
                            <View style={styles.divider} />

                            {/* Answer Section */}
                            {yourAnswer ? (
                                <View style={styles.answeredSection}>
                                    <View style={styles.answerHeader}>
                                        <Text style={styles.answerLabel}>Your Answer</Text>
                                        <View style={styles.answeredBadgeContainer}>
                                            <Text style={styles.answeredBadge}>✓ Submitted</Text>
                                        </View>
                                    </View>
                                    <Text style={styles.yourAnswerText}>{yourAnswer}</Text>
                                    <Text style={styles.answerTime}>Answered today, 9:00 AM</Text>
                                </View>
                            ) : (
                                <View style={styles.inputSection}>
                                    <TextInput
                                        style={styles.answerInput}
                                        placeholder="Share your thoughts..."
                                        placeholderTextColor={colors.textMuted}
                                        value={answer}
                                        onChangeText={setAnswer}
                                        multiline
                                        numberOfLines={4}
                                        textAlignVertical="top"
                                    />
                                    <Animated.View style={{ transform: [{ scale: submitPulse }] }}>
                                        <Button
                                            title="Submit Answer ✨"
                                            onPress={handleSubmit}
                                            variant="primary"
                                            size="lg"
                                            fullWidth
                                            disabled={!answer.trim()}
                                        />
                                    </Animated.View>
                                </View>
                            )}
                        </View>
                    </Animated.View>

                    {/* Partner's Answer Section */}
                    <View style={styles.answerSection}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>{partnerName}'s Answer</Text>
                        </View>

                        {canViewPartnerAnswer ? (
                            <TouchableOpacity
                                onPress={() => setShowPartnerAnswer(true)}
                                activeOpacity={0.9}
                                disabled={showPartnerAnswer}
                            >
                                <FlipCard
                                    flipped={showPartnerAnswer}
                                    frontContent={
                                        <LinearGradient
                                            colors={[colors.secondary + '30', colors.secondary + '10']}
                                            style={styles.revealCard}
                                        >
                                            <View style={styles.revealContent}>
                                                <Text style={styles.revealEmoji}>💝</Text>
                                                <View>
                                                    <Text style={styles.revealTitle}>Ready to see!</Text>
                                                    <Text style={styles.revealText}>Tap to reveal their answer</Text>
                                                </View>
                                            </View>
                                            <View style={styles.revealArrow}>
                                                <Text style={styles.arrowText}>→</Text>
                                            </View>
                                        </LinearGradient>
                                    }
                                >
                                    <Card variant="glass" padding="lg" style={styles.partnerAnswerCard}>
                                        <Text style={styles.partnerAnswerText}>
                                            {partnerAnswer || "They haven't answered yet"}
                                        </Text>
                                        {partnerAnswer && (
                                            <Text style={styles.answerTime}>Answered today, 10:30 AM</Text>
                                        )}
                                    </Card>
                                </FlipCard>
                            </TouchableOpacity>
                        ) : (
                            <Card variant="glass" padding="lg">
                                <View style={styles.lockedContent}>
                                    <View style={styles.lockIcon}>
                                        <Text style={styles.lockEmoji}>🔒</Text>
                                    </View>
                                    <Text style={styles.lockTitle}>Answer to Unlock</Text>
                                    <Text style={styles.lockText}>
                                        Share your thoughts first to see their response
                                    </Text>
                                </View>
                            </Card>
                        )}
                    </View>

                    {/* History */}
                    <View style={styles.historySection}>
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Past Questions</Text>
                            <TouchableOpacity>
                                <Text style={styles.viewAllLink}>View all →</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.historyList}>
                            <Card variant="glass" padding="md" style={styles.historyItem}>
                                <View style={styles.historyItemContent}>
                                    <View style={styles.historyEmoji}>
                                        <Text style={{ fontSize: 20 }}>📸</Text>
                                    </View>
                                    <View style={styles.historyText}>
                                        <Text style={styles.historyQuestion} numberOfLines={1}>
                                            "What's your favorite memory of us?"
                                        </Text>
                                        <Text style={styles.historyDate}>Yesterday</Text>
                                    </View>
                                    <View style={styles.historyStatus}>
                                        <Text style={styles.historyStatusText}>✓✓</Text>
                                    </View>
                                </View>
                            </Card>
                        </View>
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
    contentContainer: {
        paddingHorizontal: spacing.xl,
        paddingTop: spacing['3xl'],
        paddingBottom: spacing['4xl'],
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing['2xl'],
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
    backIcon: {
        fontSize: 22,
        color: colors.text,
    },
    headerContent: {
        marginLeft: spacing.md,
    },
    title: {
        fontSize: 26,
        fontWeight: '800',
        color: colors.text,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: 4,
    },
    questionCardWrapper: {
        marginBottom: spacing['2xl'],
    },
    questionCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius['2xl'],
        padding: spacing.xl,
        borderWidth: 1,
        borderColor: colors.borderLight,
        overflow: 'hidden',
        position: 'relative',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
    },
    questionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    categoryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        gap: spacing.xs,
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
    questionNumberBadge: {
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.borderLight,
    },
    questionNumber: {
        fontSize: 12,
        color: colors.textMuted,
        fontWeight: '700',
    },
    questionText: {
        fontSize: 20,
        fontWeight: '600',
        color: colors.text,
        lineHeight: 30,
        fontStyle: 'italic',
    },
    divider: {
        height: 1,
        backgroundColor: colors.borderLight,
        marginVertical: spacing.lg,
    },
    answerLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: spacing.md,
    },
    inputSection: {
        marginTop: spacing.xs,
    },
    answeredSection: {
        marginTop: spacing.xs,
    },
    answerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    cursor: {
        color: colors.primary,
        fontWeight: '100',
    },
    questionGlow: {
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: 100,
        opacity: 0.08,
        bottom: -100,
        right: -50,
    },
    answerSection: {
        marginBottom: spacing['2xl'],
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text,
    },
    answeredBadgeContainer: {
        backgroundColor: colors.successSoft,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.md,
    },
    answeredBadge: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.success,
    },
    inputWrapper: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.borderLight,
        marginBottom: spacing.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    answerInput: {
        backgroundColor: colors.backgroundAlt,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        color: colors.text,
        fontSize: 16,
        minHeight: 150,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.borderLight,
    },
    submitButton: {
        marginTop: spacing.sm,
    },
    yourAnswerText: {
        fontSize: 16,
        color: colors.text,
        lineHeight: 24,
    },
    answerTime: {
        fontSize: 12,
        color: colors.textMuted,
        marginTop: spacing.md,
    },
    flipCardSide: {
        backfaceVisibility: 'hidden',
    },
    flipCardBack: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
    },
    partnerAnswerCard: {
        borderLeftWidth: 3,
        borderLeftColor: colors.secondary,
    },
    partnerAnswerText: {
        fontSize: 16,
        color: colors.text,
        lineHeight: 24,
    },
    revealCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.lg,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.secondary + '30',
    },
    revealContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    revealEmoji: {
        fontSize: 36,
    },
    revealTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text,
    },
    revealText: {
        fontSize: 13,
        color: colors.textSecondary,
        marginTop: 2,
    },
    revealArrow: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.secondary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    arrowText: {
        fontSize: 20,
        color: colors.text,
        fontWeight: '700',
    },
    lockedContent: {
        alignItems: 'center',
        paddingVertical: spacing.xl,
    },
    lockIcon: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: colors.borderLight,
    },
    lockEmoji: {
        fontSize: 32,
    },
    lockTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: colors.text,
        marginBottom: spacing.xs,
    },
    lockText: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    historySection: {
        marginTop: spacing.lg,
    },
    viewAllLink: {
        fontSize: 14,
        color: colors.primary,
        fontWeight: '600',
    },
    historyList: {
        gap: spacing.sm,
    },
    historyItem: {},
    historyItemContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    historyEmoji: {
        width: 44,
        height: 44,
        borderRadius: borderRadius.md,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.borderLight,
    },
    historyText: {
        flex: 1,
    },
    historyQuestion: {
        fontSize: 14,
        color: colors.text,
        fontWeight: '500',
    },
    historyDate: {
        fontSize: 12,
        color: colors.textMuted,
        marginTop: 2,
    },
    historyStatus: {
        width: 36,
        alignItems: 'center',
    },
    historyStatusText: {
        fontSize: 12,
        color: colors.success,
        fontWeight: '700',
    },
});

export default QuestionsScreen;
