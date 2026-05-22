import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';

import { categoryConfig } from './categoryConfig';
import { cardStyles } from './cardStyles';
import { spacing } from '../../theme';
import { fontFamily } from '../../constants/fonts';


/**
 * ChoiceButton - Clean, soft-colored choice button for Never Have I Ever
 */
const ChoiceButton = ({ choice, isSelected, onPress, disabled }) => {
    const choiceConfig = {
        'I have': { bg: '#FFF0EC', border: '#FFDDD3', textColor: '#E86B4A', selectedBg: '#FFDDD3' },
        'Never': { bg: '#E8F8F5', border: '#C8EDE6', textColor: '#2E8B7A', selectedBg: '#C8EDE6' },
    };
    const cfg = choiceConfig[choice] || { bg: '#F3F4F6', border: '#E5E7EB', textColor: '#6B7280', selectedBg: '#E5E7EB' };

    return (
        <TouchableOpacity
            style={[
                styles.choiceButton,
                { backgroundColor: cfg.bg, borderColor: cfg.border },
                isSelected && { backgroundColor: cfg.selectedBg, borderColor: cfg.textColor, borderWidth: 2.5 },
            ]}
            onPress={() => onPress(choice)}
            activeOpacity={0.8}
            disabled={disabled}
        >
            <Text style={[
                styles.choiceLabel,
                { color: cfg.textColor },
                isSelected && { fontWeight: '900' },
            ]}>{choice}</Text>
            {isSelected && (
                <View style={[styles.choiceCheckBadge, { backgroundColor: cfg.textColor }]}>
                    <Text style={styles.choiceCheck}>✓</Text>
                </View>
            )}
        </TouchableOpacity>
    );
};

/**
 * NeverHaveIEverCard - "Never have I ever..." card with clean choice buttons
 * Redesigned with light peach/orange theme, hero image, and soft choice buttons
 */
const NeverHaveIEverCard = React.memo(({
    task,
    index,
    totalCards,
    partnerName,
    userName,
    userAvatar,
    partnerAvatar,
    hasPartner = false,
    onLinkPartner,
    onSubmit,
    onSkip,
    isLastCard,
    onAnswerSubmit,
    isAnswered = false,
    previousAnswer = null,
    autoAdvanceOnSubmit = true,
    isLocked = false,
    onNavigateToPremium = () => { },
}) => {
    const config = categoryConfig.neverhaveiever;
    const [selectedAnswer, setSelectedAnswer] = useState(isAnswered ? previousAnswer : null);
    const [locked, setLocked] = useState(isAnswered);
    const lastTaskIdRef = useRef(task._id);

    const options = task.options?.length > 0 ? task.options : ['I have', 'Never'];

    useEffect(() => {
        if (lastTaskIdRef.current !== task._id) {
            lastTaskIdRef.current = task._id;
            setSelectedAnswer(isAnswered ? previousAnswer : null);
            setLocked(isAnswered);
        }
    }, [task._id, isAnswered, previousAnswer]);

    const handleChoiceSelect = (choice) => {
        if (locked || isAnswered) return;

        // Block if locked (premium restriction)
        if (isLocked) {
            onNavigateToPremium?.();
            return;
        }

        // Block submission if no partner linked
        if (!hasPartner) {
            onLinkPartner?.();
            return;
        }

        if (choice === selectedAnswer) {
            setSelectedAnswer(null);
            return;
        }
        setSelectedAnswer(choice);
        setLocked(true);

        try {
            onAnswerSubmit?.(task.originalIndex ?? index, choice);
            // Only auto-advance if the parent screen doesn't filter answered tasks
            if (autoAdvanceOnSubmit && onSubmit) {
                // Delay swipe to show "Submitted" text first
                setTimeout(() => onSubmit(choice), 600);
            }
        } catch (err) {
            console.error('handleChoiceSelect error:', err);
        }
    };

    return (
        <LinearGradient
            colors={['#FFF3EC', '#FFF9F5']}
            style={styles.cardContainer}
        >
            <View style={styles.cardContent}>
                {/* Top Header */}
                <View style={styles.topRow}>
                    <View style={styles.categoryBadge}>
                        <Text style={styles.badgeEmoji}>🔥</Text>
                        <Text style={styles.categoryText}>{config.label}</Text>
                    </View>
                    <Text style={styles.counterText}>{index + 1} / {totalCards}</Text>
                </View>

                {/* Question Area */}
                <View style={styles.questionSection}>
                    {locked && <Text style={styles.submittedText}>Submitted ✓</Text>}
                    <Text style={styles.questionText}>
                        {task.taskstatement}
                    </Text>
                </View>

                {/* Hero Image */}
                <Image
                    source={require('../../../assets/daily-cards/never.png')}
                    style={styles.heroImage}
                    resizeMode="contain"
                />

                {/* Choice Buttons */}
                <View style={styles.choicesRow}>
                    {options.map((choice) => (
                        <ChoiceButton
                            key={choice}
                            choice={choice}
                            isSelected={selectedAnswer === choice}
                            onPress={handleChoiceSelect}
                            disabled={locked || isAnswered}
                        />
                    ))}
                </View>

                {/* Skip Button */}
                {!isLastCard && (
                    <View style={[styles.skipRow, locked && { opacity: 0 }]}>
                        <TouchableOpacity
                            onPress={isLocked ? onNavigateToPremium : onSkip}
                            style={styles.skipButton}
                            disabled={locked}
                        >
                            <Text style={styles.skipText}>Skip</Text>
                            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                                <Path d="M5 12H19M19 12L13 6M19 12L13 18" stroke="#E86B4A" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                            </Svg>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </LinearGradient>
    );
});

const styles = StyleSheet.create({
    cardContainer: {
        flex: 1,
        borderRadius: 28,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#FFDCC8',
        shadowColor: '#FF8C5A',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.15,
        shadowRadius: 22,
        elevation: 10,
        marginRight: 10,
    },
    cardContent: {
        flex: 1,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.md,
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    categoryBadge: {
        backgroundColor: 'rgba(255,255,255,0.85)',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 9,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#FFE4D4',
    },
    badgeEmoji: {
        fontSize: 14,
    },
    categoryText: {
        color: '#E86B4A',
        fontWeight: '800',
        fontSize: 13,
        fontFamily: fontFamily.bold,
    },
    counterText: {
        color: '#17204D',
        fontWeight: '800',
        fontSize: 16,
        fontFamily: fontFamily.bold,
    },
    questionSection: {
        justifyContent: 'center',
        paddingHorizontal: spacing.md,
        marginTop: spacing.sm,
        marginBottom: spacing.sm,
    },
    submittedText: {
        textAlign: 'center',
        fontSize: 14,
        fontWeight: '700',
        color: '#E86B4A',
        letterSpacing: 1,
        textTransform: 'uppercase',
        paddingVertical: spacing.xs,
        fontFamily: fontFamily.bold,
    },
    questionText: {
        fontSize: 24,
        fontWeight: '800',
        color: '#E86B4A',
        lineHeight: 32,
        textAlign: 'center',
        fontFamily: fontFamily.extraBold,
    },
    heroImage: {
        alignSelf: 'center',
        width: '65%',
        height: 150,
        marginTop: spacing.xs,
        marginBottom: spacing.lg,
    },
    choicesRow: {
        flexDirection: 'row',
        gap: spacing.md,
        paddingHorizontal: spacing.xs,
        marginBottom: spacing.md,
        marginTop: 'auto',
    },
    choiceButton: {
        flex: 1,
        borderRadius: 20,
        paddingVertical: spacing.xl,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
        elevation: 3,
        position: 'relative',
    },
    choiceLabel: {
        fontSize: 20,
        fontWeight: '800',
        fontFamily: fontFamily.extraBold,
    },
    choiceCheckBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    choiceCheck: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FFFFFF',
        fontFamily: fontFamily.bold,
    },
    skipRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: spacing.xs,
    },
    skipButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        paddingHorizontal: 16,
    },
    skipText: {
        color: '#E86B4A',
        fontSize: 16,
        fontWeight: '700',
        fontFamily: fontFamily.bold,
    },
});

export default NeverHaveIEverCard;
