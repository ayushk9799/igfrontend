import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';

import { categoryConfig } from './categoryConfig';
import { spacing } from '../../theme';
import { fontFamily } from '../../constants/fonts';

const FORMAT_FALLBACKS = {
    wouldyourather: ['Option A', 'Option B'],
    thisorthat: ['This', 'That'],
};

const ChoiceQuestionCard = React.memo(({
    task,
    index,
    displayIndex,
    totalCards,
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
    const config = categoryConfig[task.category] || categoryConfig.deep;
    const options = task.options?.length > 0 ? task.options : FORMAT_FALLBACKS[task.category] || ['Yes', 'No'];
    const [selectedAnswer, setSelectedAnswer] = useState(isAnswered ? previousAnswer : null);
    const [locked, setLocked] = useState(isAnswered);
    const lastTaskIdRef = useRef(task._id);

    useEffect(() => {
        if (lastTaskIdRef.current !== task._id) {
            lastTaskIdRef.current = task._id;
            setSelectedAnswer(isAnswered ? previousAnswer : null);
            setLocked(isAnswered);
        }
    }, [task._id, isAnswered, previousAnswer]);

    const handleSelect = (choice) => {
        if (locked || isAnswered) return;
        if (isLocked) {
            onNavigateToPremium?.();
            return;
        }
        if (!hasPartner) {
            onLinkPartner?.();
            return;
        }

        setSelectedAnswer(choice);
        setLocked(true);
        onAnswerSubmit?.(task.originalIndex ?? index, choice, 'choice');
        if (autoAdvanceOnSubmit && onSubmit) {
            setTimeout(() => onSubmit(choice), 600);
        }
    };

    return (
        <LinearGradient colors={['#FF758F', '#C2185B']} style={styles.cardContainer}>
            <View style={styles.cardContent}>
                <View style={styles.topRow}>
                    <View style={styles.categoryBadge}>
                        <Text style={styles.badgeEmoji}>{config.emoji || '💬'}</Text>
                        <Text style={styles.categoryText}>{config.label}</Text>
                    </View>
                    <Text style={styles.counterText}>{displayIndex || index + 1} / {totalCards}</Text>
                </View>

                <View style={styles.questionSection}>
                    {locked && <Text style={styles.submittedText}>Submitted ✓</Text>}
                    <Text style={styles.questionText}>{task.taskstatement}</Text>
                </View>

                <View style={styles.choicesColumn}>
                    {options.map((choice) => (
                        <TouchableOpacity
                            key={choice}
                            style={[
                                styles.choiceButton,
                                selectedAnswer === choice && styles.choiceSelected,
                            ]}
                            onPress={() => handleSelect(choice)}
                            disabled={locked || isAnswered}
                            activeOpacity={0.85}
                        >
                            <Text style={[
                                styles.choiceLabel,
                                selectedAnswer === choice && styles.choiceLabelSelected,
                            ]}>
                                {choice}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {!isLastCard && (
                    <View style={[styles.skipRow, locked && styles.hidden]}>
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
        shadowColor: '#C2185B',
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
        fontSize: 16,
    },
    categoryText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '800',
        fontFamily: fontFamily.bold,
    },
    counterText: {
        fontSize: 14,
        fontWeight: '800',
        color: 'rgba(255, 255, 255, 0.75)',
        fontFamily: fontFamily.bold,
    },
    questionSection: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: spacing.sm,
    },
    submittedText: {
        fontSize: 14,
        color: '#10B981',
        textAlign: 'center',
        marginBottom: spacing.sm,
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
    choicesColumn: {
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    choiceButton: {
        minHeight: 52,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.22)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
    },
    choiceSelected: {
        backgroundColor: '#FFFFFF',
        borderColor: '#FFFFFF',
        borderWidth: 2.5,
    },
    choiceLabel: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '800',
        textAlign: 'center',
        fontFamily: fontFamily.bold,
    },
    choiceLabelSelected: {
        color: '#C2185B',
    },
    skipRow: {
        alignItems: 'center',
    },
    hidden: {
        opacity: 0,
    },
    skipButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 18,
    },
    skipText: {
        fontSize: 15,
        color: 'rgba(255, 255, 255, 0.75)',
        fontWeight: '800',
        fontFamily: fontFamily.bold,
    },
});

export default ChoiceQuestionCard;
