import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { categoryConfig } from './categoryConfig';
import { spacing } from '../../theme';
import { fontFamily } from '../../constants/fonts';
import { translateUiText } from '../../i18n/uiTranslation';


/**
 * ChoiceButton - Clean, soft-colored choice button for Never Have I Ever
 */
const ChoiceButton = ({ choice, isSelected, onPress, disabled }) => {
    const value = choice && typeof choice === 'object' ? choice.value : choice;
    const label = choice && typeof choice === 'object' ? (choice.label ?? choice.value) : choice;
    const choiceConfig = {
        'I have': { bg: 'rgba(255, 255, 255, 0.12)', border: 'rgba(255, 255, 255, 0.22)', textColor: '#FFFFFF', selectedBg: '#FFFFFF', selectedTextColor: '#D84315' },
        'Never': { bg: 'rgba(255, 255, 255, 0.12)', border: 'rgba(255, 255, 255, 0.22)', textColor: '#FFFFFF', selectedBg: '#FFFFFF', selectedTextColor: '#2E8B7A' },
    };
    const cfg = choiceConfig[value] || { bg: 'rgba(255,255,255,0.12)', border: 'rgba(255,255,255,0.22)', textColor: '#FFFFFF', selectedBg: '#FFFFFF', selectedTextColor: '#333333' };

    return (
        <TouchableOpacity
            style={[
                styles.choiceButton,
                { backgroundColor: cfg.bg, borderColor: cfg.border },
                isSelected && { backgroundColor: cfg.selectedBg, borderColor: '#FFFFFF', borderWidth: 2.5 },
            ]}
            onPress={() => onPress(value)}
            activeOpacity={0.8}
            disabled={disabled}
        >
            <Text style={[
                styles.choiceLabel,
                { color: isSelected ? cfg.selectedTextColor : cfg.textColor },
                isSelected && { fontWeight: '900' },
            ]}>{translateUiText(label)}</Text>
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

    const options = task.optionItems?.length > 0
        ? task.optionItems
        : (task.options?.length > 0 ? task.options : ['I have', 'Never']);

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
                onSubmit(choice);
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
                        <Text style={styles.categoryText}>{translateUiText(config.label)}</Text>
                    </View>
                </View>

                {/* Question Area */}
                <View style={styles.questionSection}>
                    <Text style={styles.questionText}>
                        {task.taskstatement}
                    </Text>
                </View>



                {/* Choice Buttons */}
                <View style={styles.choicesRow}>
                    {options.map((choice) => {
                        const value = choice && typeof choice === 'object' ? choice.value : choice;
                        return (
                        <ChoiceButton
                            key={String(value)}
                            choice={choice}
                            isSelected={selectedAnswer === value}
                            onPress={handleChoiceSelect}
                            disabled={locked || isAnswered}
                        />
                        );
                    })}
                </View>

            </View>
        </LinearGradient>
    );
});

const styles = StyleSheet.create({
    cardContainer: {
        flex: 1,
        borderRadius: 28,
        overflow: 'hidden',
        borderWidth: 6,
        borderColor: 'rgba(255, 255, 255, 0.20)',
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
    questionText: {
        fontSize: 24,
        fontWeight: '800',
        color: '#FFFFFF',
        lineHeight: 30,
        textAlign: 'center',
        fontFamily: fontFamily.extraBold,
    },

    choicesRow: {
        width: '90%',
        alignSelf: 'center',
        flexDirection: 'row',
        gap: spacing.md,
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
});

export default NeverHaveIEverCard;
