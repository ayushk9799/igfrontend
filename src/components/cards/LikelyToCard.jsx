import React, { useState, useEffect } from 'react';
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
    onSubmit,
    onSkip,
    isLastCard,
    onAnswerSubmit,
    isAnswered = false,
    previousAnswer = null
}) => {
    const config = categoryConfig.likelyto;
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [locked, setLocked] = useState(isAnswered);

    useEffect(() => {
        setSelectedAnswer(isAnswered ? previousAnswer : null);
        setLocked(isAnswered);
    }, [task._id, isAnswered, previousAnswer]);

    const handleSelect = (who) => {
        if (locked || isAnswered) return;

        console.log('🎯 [LikelyToCard] Selection:', who);
        setSelectedAnswer(who);
        setLocked(true);

        try {
            const result = onAnswerSubmit?.(index, who);
            if (result && typeof result.then === 'function') {
                result.then(() => onSubmit(who)).catch(err => console.error('Submit error:', err));
            } else {
                onSubmit(who);
            }
        } catch (err) {
            console.error('handleSelect error:', err);
            onSubmit(who);
        }
    };

    return (
        <LinearGradient colors={config.bgGradient} style={styles.cardInner}>
            {/* Already Answered Overlay */}
            {isAnswered && (
                <View style={styles.answeredOverlay}>
                    <View style={styles.answeredBadge}>
                        <Text style={styles.answeredEmoji}>✅</Text>
                        <Text style={styles.answeredTitle}>Already Answered</Text>
                        <Text style={styles.answeredText}>
                            You chose: {previousAnswer === 'you' ? userName : partnerName}
                        </Text>
                        <Text style={styles.answeredHint}>Swipe to continue →</Text>
                    </View>
                </View>
            )}

            <View style={[styles.cardContent, isAnswered && { opacity: 0.3 }]}>
                <View style={styles.topRow}>
                    <View style={[styles.categoryBadge, { backgroundColor: config.color + '20' }]}>
                        <Text style={{ color: config.color, fontWeight: '600' }}>{config.label}</Text>
                    </View>
                    <Text style={[styles.counterText, { color: "white" }]}>{index + 1}/{totalCards}</Text>
                </View>

                <View style={styles.questionSection}>
                    <Text style={styles.questionText}>"{task.taskstatement}"</Text>
                </View>

                {/* Bottom Bar - Avatar Left, Skip Center, Avatar Right */}
                <View style={likelyStyles.bottomBar}>
                    {/* User Avatar - Left */}
                    <SelectableAvatar
                        name={userName}
                        isYou={true}
                        isSelected={selectedAnswer === 'you'}
                        onSelect={() => handleSelect('you')}
                        disabled={locked || isAnswered}
                        categoryColor={config.color}
                        avatarUrl={userAvatar}
                    />

                    {/* Skip - Center */}
                    <TouchableOpacity onPress={onSkip} style={likelyStyles.skipButton} disabled={locked}>
                        <Text style={likelyStyles.skipText}>Skip</Text>
                    </TouchableOpacity>

                    {/* Partner Avatar - Right */}
                    <SelectableAvatar
                        name={partnerName}
                        isYou={false}
                        isSelected={selectedAnswer === 'partner'}
                        onSelect={() => handleSelect('partner')}
                        disabled={locked || isAnswered}
                        categoryColor={config.color}
                        avatarUrl={partnerAvatar}
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
