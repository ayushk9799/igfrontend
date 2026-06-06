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
        'I have': { bg: 'rgba(255, 255, 255, 0.12)', border: 'rgba(255, 255, 255, 0.22)', textColor: '#FFFFFF', selectedBg: '#FFFFFF', selectedTextColor: '#D84315' },
        'Never': { bg: 'rgba(255, 255, 255, 0.12)', border: 'rgba(255, 255, 255, 0.22)', textColor: '#FFFFFF', selectedBg: '#FFFFFF', selectedTextColor: '#2E8B7A' },
    };
    const cfg = choiceConfig[choice] || { bg: 'rgba(255,255,255,0.12)', border: 'rgba(255,255,255,0.22)', textColor: '#FFFFFF', selectedBg: '#FFFFFF', selectedTextColor: '#333333' };

    return (
        <TouchableOpacity
            style={[
                styles.choiceButton,
                { backgroundColor: cfg.bg, borderColor: cfg.border },
                isSelected && { backgroundColor: cfg.selectedBg, borderColor: '#FFFFFF', borderWidth: 2.5 },
            ]}
            onPress={() => onPress(choice)}
            activeOpacity={0.8}
            disabled={disabled}
        >
            <Text style={[
                styles.choiceLabel,
                { color: isSelected ? cfg.selectedTextColor : cfg.textColor },
                isSelected && { fontWeight: '900' },
            ]}>{choice}</Text>
            {isSelected && (
                <View style={[styles.choiceCheckBadge, { backgroundColor: cfg.selectedTextColor }]}>
                    <Text style={[styles.choiceCheck, { color: '#FFFFFF' }]}>✓</Text>
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
    displayIndex,
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
            colors={['#FF8A65', '#D84315']}
            style={styles.cardContainer}
        >
            <View style={styles.cardContent}>
                {/* Top Header */}
                <View style={styles.topRow}>
                    <View style={styles.categoryBadge}>
                        <Text style={styles.badgeEmoji}>🔥</Text>
                        <Text style={styles.categoryText}>{config.label}</Text>
                    </View>
                    <Text style={styles.counterText}>{displayIndex || index + 1} / {totalCards}</Text>
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
                                <Path d="M5 12H19M19 12L13 6M19 12L13 18" stroke="rgba(255, 255, 255, 0.75)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
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
        borderColor: 'rgba(255, 255, 255, 0.15)',
        shadowColor: '#D84315',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.22,
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
        backgroundColor: 'rgba(255,255,255,0.12)',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 9,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.22)',
    },
    badgeEmoji: {
        fontSize: 14,
    },
    categoryText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 13,
        fontFamily: fontFamily.bold,
    },
    counterText: {
        color: 'rgba(255, 255, 255, 0.75)',
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
        fontSize: 20,
        fontWeight: '800',
        color: '#FFFFFF',
        lineHeight: 26,
        textAlign: 'center',
        fontFamily: fontFamily.extraBold,
    },
    heroImage: {
        alignSelf: 'center',
        width: '65%',
        height: 110,
        marginTop: spacing.xs,
        marginBottom: spacing.md,
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
        paddingVertical: spacing.md,
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
        color: 'rgba(255, 255, 255, 0.75)',
        fontSize: 16,
        fontWeight: '700',
        fontFamily: fontFamily.bold,
    },
});

export default NeverHaveIEverCard;
