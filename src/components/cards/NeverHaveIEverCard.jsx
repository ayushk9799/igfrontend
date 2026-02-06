import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { categoryConfig } from './categoryConfig';
import { cardStyles as styles } from './cardStyles';

/**
 * Choice button for Never Have I Ever card
 */
const ChoiceButton = ({ choice, isSelected, onPress, disabled }) => {
    const choiceConfig = {
        'I have': { gradient: ['#FF6B9D', '#FF8FAB'], bg: ['#FFF0F5', '#FFE4EC'] },
        'Never': { gradient: ['#5BB5A6', '#8DD5C7'], bg: ['#E8F8F5', '#D0F0EA'] },
    };
    const cfg = choiceConfig[choice] || { gradient: ['#6B7280', '#9CA3AF'], bg: ['#F3F4F6', '#E5E7EB'] };

    return (
        <TouchableOpacity
            style={[styles.choiceCard, isSelected && styles.choiceCardSelected]}
            onPress={() => onPress(choice)}
            activeOpacity={0.9}
            disabled={disabled}
        >
            <LinearGradient
                colors={isSelected ? cfg.gradient : cfg.bg}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.choiceGradient}
            />
            <Text style={[styles.choiceText, isSelected && styles.choiceTextSelected]}>{choice}</Text>
            {isSelected && (
                <View style={styles.choiceSelectedBadge}>
                    <Text style={styles.selectedCheck}>✓</Text>
                </View>
            )}
        </TouchableOpacity>
    );
};

/**
 * NeverHaveIEverCard - "Never have I ever..." card with choice buttons
 */
const NeverHaveIEverCard = React.memo(({
    task,
    index,
    totalCards,
    partnerName,
    userName,
    userAvatar,
    partnerAvatar,
    onSubmit,
    onSkip,
    isLastCard,
    onAnswerSubmit,
    isAnswered = false,
    previousAnswer = null,
    autoAdvanceOnSubmit = true
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
        if (choice === selectedAnswer) {
            setSelectedAnswer(null);
            return;
        }
        console.log('🎯 [NeverHaveIEverCard] Choice selected, submitting:', choice);
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
        <LinearGradient colors={config.bgGradient} style={styles.cardInner}>
            <View style={styles.cardContent}>
                <View style={styles.topRow}>
                    <View style={[styles.categoryBadge, { backgroundColor: config.color + '20' }]}>
                        <Text style={styles.categoryText}>{config.label}</Text>
                    </View>
                </View>

                <View style={styles.questionSection}>
                    {locked && <Text style={styles.submittedText}>Submitted ✓</Text>}
                    <Text style={styles.questionText}>{task.taskstatement}</Text>
                </View>

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

                {!isLastCard && (
                    <View style={[styles.cardButtonsRow, locked && { opacity: 0 }]}>
                        <TouchableOpacity onPress={onSkip} style={styles.skipButtonInCard} disabled={locked}>
                            <Text style={styles.skipTextInCard}>Skip →</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </LinearGradient>
    );
});

export default NeverHaveIEverCard;
