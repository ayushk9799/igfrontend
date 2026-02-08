import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { categoryConfig } from './categoryConfig';
import { cardStyles as styles } from './cardStyles';
import { colors } from '../../theme';

/**
 * SelectableAvatar - Simple tap-to-select avatar with real image support
 */
const SelectableAvatar = ({ name, isYou, isSelected, onSelect, disabled, categoryColor, avatarUrl }) => {
    return (
        <TouchableOpacity
            style={styles.avatarWrapper}
            onPress={onSelect}
            disabled={disabled}
            activeOpacity={0.7}
        >
            <View style={[
                styles.avatarOuter,
                isSelected && { borderColor: categoryColor, shadowColor: categoryColor, shadowOpacity: 0.4 },
            ]}>
                <LinearGradient
                    colors={isSelected ? [categoryColor, categoryColor + 'CC'] : [colors.surface, colors.backgroundAlt]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.avatarGradient}
                />
                <View style={styles.avatarInner}>
                    {avatarUrl ? (
                        <Image
                            source={{ uri: avatarUrl }}
                            style={styles.avatarImage}
                            resizeMode="cover"
                        />
                    ) : (
                        <Text style={styles.avatarEmoji}>{isYou ? '🙋' : '💕'}</Text>
                    )}
                </View>
            </View>
            {isSelected && (
                <View style={[styles.selectedIndicator, { backgroundColor: categoryColor }]}>
                    <Text style={styles.selectedCheck}>✓</Text>
                </View>
            )}
        </TouchableOpacity>
    );
};

/**
 * LikelyToCard - "Who is more likely to..." card with selectable avatars
 */
const LikelyToCard = React.memo(({
    task,
    index,
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
    onSkip,
    isLastCard,
    onAnswerSubmit,
    isAnswered = false,
    previousAnswer = null,
    autoAdvanceOnSubmit = true
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

    const handleSelect = (who) => {
        if (locked || isAnswered) return;

        // Block submission if no partner linked
        if (!hasPartner) {
            onLinkPartner?.();
            return;
        }

        console.log('🎯 [LikelyToCard] Selection:', who);
        setSelectedAnswer(who);
        setLocked(true);

        try {
            onAnswerSubmit?.(task.originalIndex ?? index, who);
            // Only auto-advance if the parent screen doesn't filter answered tasks
            if (autoAdvanceOnSubmit && onSubmit) {
                // Delay swipe to show "Submitted" text first
                setTimeout(() => onSubmit(who), 600);
            }
        } catch (err) {
            console.error('handleSelect error:', err);
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
                    <Text style={styles.questionText}>"{task.taskstatement}"</Text>
                </View>

                {/* Bottom Bar - Avatar Left, Skip Center, Avatar Right */}
                <View style={likelyStyles.bottomBar}>
                    {/* Partner Avatar - Left */}
                    <SelectableAvatar
                        name={partnerName}
                        isYou={false}
                        isSelected={selectedAnswer === 'partner'}
                        onSelect={() => handleSelect('partner')}
                        disabled={locked || isAnswered}
                        categoryColor={config.color}
                        avatarUrl={partnerAvatar}
                    />

                    {/* Skip - Center */}
                    <TouchableOpacity onPress={onSkip} style={likelyStyles.skipButton} disabled={locked}>
                        <Text style={likelyStyles.skipText}>Skip</Text>
                    </TouchableOpacity>

                    {/* User Avatar - Right */}
                    <SelectableAvatar
                        name={userName}
                        isYou={true}
                        isSelected={selectedAnswer === 'you'}
                        onSelect={() => handleSelect('you')}
                        disabled={locked || isAnswered}
                        categoryColor={config.color}
                        avatarUrl={userAvatar}
                    />
                </View>
            </View>
        </LinearGradient>
    );
});

import { StyleSheet } from 'react-native';
import { spacing } from '../../theme';

const likelyStyles = StyleSheet.create({
    bottomBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        marginTop: 'auto',
    },
    skipButton: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
    },
    skipText: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 16,
        fontWeight: '500',
    },
});

export default LikelyToCard;
