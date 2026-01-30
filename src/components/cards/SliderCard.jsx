import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    useAnimatedGestureHandler,
    withSpring,
    interpolate,
    runOnJS,
} from 'react-native-reanimated';
import { PanGestureHandler } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

import { categoryConfig, defaultConfig } from './categoryConfig';
import { cardStyles } from './cardStyles';
import {
    colors, spacing

} from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLIDER_WIDTH = SCREEN_WIDTH - 80;
const KNOB_SIZE = 44;
const TRACK_HEIGHT = 12;

/**
 * SliderCard - Rate something on a scale with an animated slider
 * Supports min/max values, labels, and smooth haptic feedback
 */
const SliderCard = React.memo(({
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
    const config = categoryConfig[task.category] || categoryConfig.slider || defaultConfig;

    // Slider configuration from task
    const minValue = task.minValue || 1;
    const maxValue = task.maxValue || 10;
    const minLabel = task.minLabel || 'Not at all';
    const maxLabel = task.maxLabel || 'Absolutely';

    const [currentValue, setCurrentValue] = useState(
        isAnswered ? previousAnswer : Math.floor((minValue + maxValue) / 2)
    );
    const [locked, setLocked] = useState(isAnswered);
    const [hasInteracted, setHasInteracted] = useState(false);

    // Animated values
    const translateX = useSharedValue(
        isAnswered
            ? ((previousAnswer - minValue) / (maxValue - minValue)) * (SLIDER_WIDTH - KNOB_SIZE)
            : ((SLIDER_WIDTH - KNOB_SIZE) / 2)
    );

    // Reset when task changes
    useEffect(() => {
        const initialValue = isAnswered ? previousAnswer : Math.floor((minValue + maxValue) / 2);
        setCurrentValue(initialValue);
        setLocked(isAnswered);
        setHasInteracted(isAnswered);
        translateX.value = ((initialValue - minValue) / (maxValue - minValue)) * (SLIDER_WIDTH - KNOB_SIZE);
    }, [task._id, isAnswered, previousAnswer, minValue, maxValue]);

    // Haptic feedback
    const triggerHaptic = useCallback(() => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (e) { }
    }, []);

    // Update value from position
    const updateValueFromPosition = useCallback((x) => {
        const percentage = Math.max(0, Math.min(1, x / (SLIDER_WIDTH - KNOB_SIZE)));
        const newValue = Math.round(minValue + percentage * (maxValue - minValue));
        if (newValue !== currentValue) {
            setCurrentValue(newValue);
            triggerHaptic();
        }
    }, [minValue, maxValue, currentValue, triggerHaptic]);

    // Gesture handler
    const gestureHandler = useAnimatedGestureHandler({
        onStart: (_, ctx) => {
            ctx.startX = translateX.value;
        },
        onActive: (event, ctx) => {
            const newX = Math.max(0, Math.min(SLIDER_WIDTH - KNOB_SIZE, ctx.startX + event.translationX));
            translateX.value = newX;
            runOnJS(updateValueFromPosition)(newX);
            if (!hasInteracted) {
                runOnJS(setHasInteracted)(true);
            }
        },
        onEnd: () => {
            translateX.value = withSpring(translateX.value, { damping: 15, stiffness: 150 });
        },
    });

    // Animated styles
    const knobStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    const progressStyle = useAnimatedStyle(() => ({
        width: translateX.value + KNOB_SIZE / 2,
    }));

    // Handle submit
    const handleSubmit = () => {
        if (locked || isAnswered) return;

        console.log('🎯 [SliderCard] Submitting value:', currentValue);
        setLocked(true);

        try {
            const result = onAnswerSubmit?.(index, currentValue);
            if (result && typeof result.then === 'function') {
                result.then(() => onSubmit?.(currentValue)).catch(err => console.error('Submit error:', err));
            } else {
                onSubmit?.(currentValue);
            }
        } catch (err) {
            console.error('handleSubmit error:', err);
            onSubmit?.(currentValue);
        }
    };

    // Generate tick marks
    const ticks = [];
    for (let i = minValue; i <= maxValue; i++) {
        ticks.push(i);
    }

    return (
        <LinearGradient colors={config.bgGradient} style={styles.cardInner}>
            {/* Already Answered Overlay */}
            {isAnswered && (
                <View style={cardStyles.answeredOverlay}>
                    <View style={cardStyles.answeredBadge}>
                        <Text style={cardStyles.answeredEmoji}>✅</Text>
                        <Text style={cardStyles.answeredTitle}>Already Answered</Text>
                        <Text style={cardStyles.answeredText}>
                            You rated: {previousAnswer} / {maxValue}
                        </Text>
                        <Text style={cardStyles.answeredHint}>Swipe to continue →</Text>
                    </View>
                </View>
            )}

            <View style={[styles.cardContent, isAnswered && { opacity: 0.3 }]}>
                {/* Header */}
                <View style={styles.topRow}>
                    <View style={[styles.categoryBadge, { backgroundColor: config.color + '20' }]}>
                        <Text style={{ color: config.color, fontWeight: '600' }}>📊 Rate It</Text>
                    </View>
                    <Text style={styles.counterText}>{index + 1}/{totalCards}</Text>
                </View>

                {/* Question */}
                <View style={styles.questionSection}>
                    <Text style={styles.questionText}>"{task.taskstatement}"</Text>
                </View>

                {/* Value Display */}
                <View style={styles.valueDisplay}>
                    <Text style={[styles.valueText, { color: config.color }]}>{currentValue}</Text>
                    <Text style={styles.valueMax}>/ {maxValue}</Text>
                </View>

                {/* Slider */}
                <View style={styles.sliderContainer}>
                    {/* Track Background */}
                    <View style={styles.trackBackground}>
                        {/* Progress Fill */}
                        <Animated.View style={[styles.trackFill, progressStyle, { backgroundColor: config.color }]} />
                    </View>

                    {/* Tick Marks */}
                    <View style={styles.tickContainer}>
                        {ticks.map((tick) => {
                            const position = ((tick - minValue) / (maxValue - minValue)) * (SLIDER_WIDTH - KNOB_SIZE) + KNOB_SIZE / 2;
                            return (
                                <View
                                    key={tick}
                                    style={[
                                        styles.tick,
                                        { left: position - 1 },
                                        tick === currentValue && { backgroundColor: config.color, height: 16 }
                                    ]}
                                />
                            );
                        })}
                    </View>

                    {/* Draggable Knob */}
                    <PanGestureHandler onGestureEvent={gestureHandler} enabled={!locked && !isAnswered}>
                        <Animated.View style={[styles.knob, knobStyle, { borderColor: config.color }]}>
                            <LinearGradient
                                colors={[config.color, config.color + 'CC']}
                                style={styles.knobGradient}
                            />
                            <Text style={styles.knobValue}>{currentValue}</Text>
                        </Animated.View>
                    </PanGestureHandler>
                </View>

                {/* Labels */}
                <View style={styles.labelsRow}>
                    <Text style={styles.labelText}>{minLabel}</Text>
                    <Text style={styles.labelText}>{maxLabel}</Text>
                </View>

                {/* Submit Button */}
                <View style={styles.actionRow}>
                    <TouchableOpacity
                        onPress={onSkip}
                        style={styles.skipButton}
                        disabled={locked}
                    >
                        <Text style={styles.skipText}>Skip</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={handleSubmit}
                        disabled={locked || isAnswered || !hasInteracted}
                        style={[
                            styles.submitButton,
                            { backgroundColor: config.color },
                            (!hasInteracted || locked) && styles.submitButtonDisabled
                        ]}
                    >
                        <Text style={styles.submitText}>
                            {locked ? 'Submitted ✓' : 'Submit'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </LinearGradient>
    );
});

const styles = StyleSheet.create({
    cardInner: {
        flex: 1,
        borderRadius: 28,
        overflow: 'hidden',
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
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 16,
    },
    counterText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: 14,
    },
    questionSection: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: spacing.sm,
    },
    questionText: {
        fontSize: 22,
        fontWeight: '800',
        color: '#FFFFFF',
        fontStyle: 'italic',
        lineHeight: 30,
        textAlign: 'center',
    },
    valueDisplay: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'center',
        marginBottom: spacing.lg,
    },
    valueText: {
        fontSize: 56,
        fontWeight: '900',
    },
    valueMax: {
        fontSize: 24,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.6)',
        marginLeft: 4,
    },
    sliderContainer: {
        height: 60,
        marginHorizontal: spacing.md,
        justifyContent: 'center',
    },
    trackBackground: {
        position: 'absolute',
        left: KNOB_SIZE / 2,
        right: KNOB_SIZE / 2,
        height: TRACK_HEIGHT,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        borderRadius: TRACK_HEIGHT / 2,
        overflow: 'hidden',
    },
    trackFill: {
        height: '100%',
        borderRadius: TRACK_HEIGHT / 2,
    },
    tickContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 12,
        top: (60 - 12) / 2,
    },
    tick: {
        position: 'absolute',
        width: 2,
        height: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
        borderRadius: 1,
    },
    knob: {
        position: 'absolute',
        width: KNOB_SIZE,
        height: KNOB_SIZE,
        borderRadius: KNOB_SIZE / 2,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 8,
        overflow: 'hidden',
    },
    knobGradient: {
        ...StyleSheet.absoluteFillObject,
        opacity: 0.15,
    },
    knobValue: {
        fontSize: 16,
        fontWeight: '800',
        color: '#333',
    },
    labelsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        marginTop: spacing.sm,
        marginBottom: spacing.lg,
    },
    labelText: {
        fontSize: 13,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.7)',
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
    },
    skipButton: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
    },
    skipText: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 16,
        fontWeight: '500',
    },
    submitButton: {
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 25,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    submitButtonDisabled: {
        opacity: 0.5,
    },
    submitText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
});

export default SliderCard;
