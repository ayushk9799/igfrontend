import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { categoryConfig } from './categoryConfig';
import { spacing } from '../../theme';
import { fontFamily } from '../../constants/fonts';


/**
 * LikelyToCard - "Who is more likely to..." card with selectable choice buttons
 * Redesigned with light pinkish theme, and clean choice buttons
 */
const LikelyToCard = React.memo(({
    task,
    index,
    displayIndex,
    totalCards,
    partnerName,
    userName,
    userAvatar,
    partnerAvatar,
    userId,
    partnerId,
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
    const config = categoryConfig.likelyto;
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

    const handleSelect = async (who) => {
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

        setSelectedAnswer(who);
        setLocked(true);

        try {
            const submitted = await onAnswerSubmit?.(task.originalIndex ?? index, who);
            if (submitted === false) {
                setSelectedAnswer(null);
                setLocked(false);
                return;
            }

            // Only auto-advance if the parent screen doesn't filter answered tasks
            if (autoAdvanceOnSubmit && onSubmit) {
                onSubmit(who);
            }
        } catch (err) {
            console.error('handleSelect error:', err);
            setSelectedAnswer(null);
            setLocked(false);
        }
    };

    return (
        <LinearGradient
            colors={['#FF6480', '#C2185B']}
            style={styles.cardContainer}
        >
            <View style={styles.cardContent}>
                {/* Top Header */}
                <View style={styles.topRow}>
                    <View style={styles.categoryBadge}>
                        <Text style={styles.badgeEmoji}>❤️</Text>
                        <Text style={styles.categoryText}>{config.label}</Text>
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
                    {/* Partner - "You" button (from partner's POV) */}
                    <TouchableOpacity
                        style={[
                            styles.choiceButton,
                            styles.choicePartner,
                            selectedAnswer === 'partner' && styles.choiceSelected,
                        ]}
                        onPress={() => handleSelect('partner')}
                        disabled={locked || isAnswered}
                        activeOpacity={0.8}
                    >
                        <Text style={[
                            styles.choiceLabel,
                            selectedAnswer === 'partner' ? { color: '#C2185B' } : { color: '#FFFFFF' }
                        ]}>You</Text>
                       
                    </TouchableOpacity>

                    {/* User - "ME" button */}
                    <TouchableOpacity
                        style={[
                            styles.choiceButton,
                            styles.choiceMe,
                            selectedAnswer === 'you' && styles.choiceSelected,
                        ]}
                        onPress={() => handleSelect('you')}
                        disabled={locked || isAnswered}
                        activeOpacity={0.8}
                    >
                        <Text style={[
                            styles.choiceLabel,
                            selectedAnswer === 'you' ? { color: '#6D28D9' } : { color: '#FFFFFF' }
                        ]}>ME</Text>
                       
                    </TouchableOpacity>
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
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 3,
    },
    choicePartner: {
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        borderColor: 'rgba(255, 255, 255, 0.22)',
    },
    choiceMe: {
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        borderColor: 'rgba(255, 255, 255, 0.22)',
    },
    choiceSelected: {
        borderWidth: 2.5,
        borderColor: '#FFFFFF',
        backgroundColor: '#FFFFFF',
        shadowOpacity: 0.18,
        shadowRadius: 14,
        shadowColor: '#FFFFFF',
    },
    choiceLabel: {
        fontSize: 22,
        fontWeight: '800',
        fontFamily: fontFamily.extraBold,
        marginBottom: 4,
    },
    choiceLabelPartner: {
        color: '#FF8FA3',
    },
    choiceLabelMe: {
        color: '#C084FC',
    },
    choiceLabelSelected: {
        color: '#FFFFFF',
    },
    choiceSublabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    choiceSublabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#E8758A',
        fontFamily: fontFamily.medium,
    },
});

export default LikelyToCard;
