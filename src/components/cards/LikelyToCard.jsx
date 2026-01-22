import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, Animated, PanResponder, TouchableOpacity } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';

import { categoryConfig } from './categoryConfig';
import { cardStyles as styles } from './cardStyles';
import { colors } from '../../theme';

/**
 * Draggable avatar for the "Most Likely To" card
 */
const DraggableAvatar = ({ name, isYou, isSelected, onDrop, disabled, categoryColor }) => {
    const pan = useRef(new Animated.ValueXY()).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const [isDragging, setIsDragging] = useState(false);

    useEffect(() => {
        if (!isSelected) {
            Animated.spring(pan, {
                toValue: { x: 0, y: 0 },
                friction: 5,
                useNativeDriver: false,
            }).start();
        }
    }, [isSelected, pan]);

    const panResponder = useMemo(() => PanResponder.create({
        onStartShouldSetPanResponder: () => !disabled,
        onMoveShouldSetPanResponder: () => !disabled,
        onPanResponderGrant: () => {
            setIsDragging(true);
            pan.setOffset({ x: pan.x._value, y: pan.y._value });
            pan.setValue({ x: 0, y: 0 });
            Animated.spring(scaleAnim, {
                toValue: 1.15,
                friction: 5,
                useNativeDriver: false,
            }).start();
        },
        onPanResponderMove: Animated.event(
            [null, { dx: pan.x, dy: pan.y }],
            { useNativeDriver: false }
        ),
        onPanResponderRelease: (_, gestureState) => {
            pan.flattenOffset();
            setIsDragging(false);

            if (gestureState.dy < -60) {
                onDrop();
                Animated.parallel([
                    Animated.spring(pan, { toValue: { x: 0, y: -80 }, friction: 6, useNativeDriver: false }),
                    Animated.spring(scaleAnim, { toValue: 1.1, friction: 5, useNativeDriver: false }),
                ]).start();
            } else {
                Animated.parallel([
                    Animated.spring(pan, { toValue: { x: 0, y: 0 }, friction: 5, useNativeDriver: false }),
                    Animated.spring(scaleAnim, { toValue: 1, friction: 5, useNativeDriver: false }),
                ]).start();
            }
        },
    }), [disabled, onDrop, pan, scaleAnim]);

    return (
        <Animated.View
            style={[
                styles.avatarWrapper,
                {
                    transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale: scaleAnim }],
                    zIndex: isDragging ? 100 : 1,
                },
            ]}
            {...panResponder.panHandlers}
        >
            <View style={[
                styles.avatarOuter,
                isSelected && { borderColor: categoryColor, shadowColor: categoryColor, shadowOpacity: 0.4 },
                isDragging && styles.avatarDragging,
            ]}>
                <LinearGradient
                    colors={isSelected ? [categoryColor, categoryColor + 'CC'] : [colors.surface, colors.backgroundAlt]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.avatarGradient}
                />
                <View style={styles.avatarInner}>
                    <Text style={styles.avatarEmoji}>{isYou ? '🙋' : '💕'}</Text>
                </View>
            </View>
            <Text style={[styles.avatarName, isSelected && { color: categoryColor }]}>{name}</Text>
            {isSelected && (
                <View style={[styles.selectedIndicator, { backgroundColor: categoryColor }]}>
                    <Text style={styles.selectedCheck}>✓</Text>
                </View>
            )}
        </Animated.View>
    );
};

/**
 * Drop zone for dragging avatars
 */
const DropZone = ({ hasSelection, selectedName, categoryColor }) => (
    <View style={[styles.dropZone, hasSelection && { borderColor: categoryColor, borderStyle: 'solid' }]}>
        <LinearGradient
            colors={hasSelection ? [categoryColor + '20', categoryColor + '10'] : [colors.backgroundAlt + '80', colors.surface + '80']}
            style={styles.dropZoneGradient}
        />
        {hasSelection ? (
            <Text style={[styles.selectedText, { color: categoryColor }]}>
                {selectedName === 'you' ? '🙋 You!' : `💕 ${selectedName}!`}
            </Text>
        ) : (
            <View style={styles.emptyDropZone}>
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                    <Path d="M12 19V5M5 12l7-7 7 7" stroke={categoryColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={[styles.dropHint, { color: categoryColor }]}>Drag here</Text>
            </View>
        )}
    </View>
);

/**
 * LikelyToCard - "Who is more likely to..." card with draggable avatars
 */
const LikelyToCard = React.memo(({
    task,
    index,
    totalCards,
    partnerName,
    userName,
    onSubmit,
    onSkip,
    isLastCard,
    onAnswerSubmit,
    isAnswered = false,
    previousAnswer = null
}) => {
    const config = categoryConfig.likelyto;
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [locked, setLocked] = useState(isAnswered); // Lock if already answered

    useEffect(() => {
        setSelectedAnswer(isAnswered ? previousAnswer : null);
        setLocked(isAnswered);
    }, [task._id, isAnswered, previousAnswer]);

    const handleDrop = (who) => {
        if (locked || isAnswered) return; // Block if already answered
        if (who === selectedAnswer) {
            setSelectedAnswer(null);
            return;
        }
        console.log('🎯 [LikelyToCard] Drop detected, submitting:', who);
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
            console.error('handleDrop error:', err);
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
                        <Text>{config.emoji}</Text>
                        <Text style={{ color: config.color, fontWeight: '600' }}>{config.label}</Text>
                    </View>
                    <Text style={styles.counterText}>{index + 1}/{totalCards}</Text>
                </View>

                <View style={styles.questionSection}>
                    <Text style={styles.questionText}>"{task.taskstatement}"</Text>
                </View>

                <DropZone
                    hasSelection={!!selectedAnswer}
                    selectedName={selectedAnswer === 'you' ? 'you' : partnerName}
                    categoryColor={config.color}
                />

                <View style={styles.avatarsContainer}>
                    <DraggableAvatar
                        name={userName}
                        isYou={true}
                        isSelected={selectedAnswer === 'you'}
                        onDrop={() => handleDrop('you')}
                        disabled={locked || isAnswered}
                        categoryColor={config.color}
                    />
                    <View style={styles.vsContainer}>
                        <Text style={styles.vsText}>VS</Text>
                    </View>
                    <DraggableAvatar
                        name={partnerName}
                        isYou={false}
                        isSelected={selectedAnswer === 'partner'}
                        onDrop={() => handleDrop('partner')}
                        disabled={locked || isAnswered}
                        categoryColor={config.color}
                    />
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

export default LikelyToCard;
