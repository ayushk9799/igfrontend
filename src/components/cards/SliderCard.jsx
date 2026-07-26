import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

import { categoryConfig, defaultConfig } from './categoryConfig';
import { cardStyles } from './cardStyles';
import {
    spacing
} from '../../theme';
import { fontFamily } from '../../constants/fonts';
import { translateUiText } from '../../i18n/uiTranslation';


const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 32;
const CARD_BORDER_WIDTH = 6;
const CARD_CONTENT_HORIZONTAL_PADDING = spacing.lg * 2;
const SLIDER_WIDTH = Math.max(220, CARD_WIDTH - CARD_BORDER_WIDTH * 2 - CARD_CONTENT_HORIZONTAL_PADDING - spacing.lg * 2);
const KNOB_SIZE = 44;
const TRACK_HEIGHT = 12;

/**
 * SliderCard - Rate something on a scale with an animated slider
 * Supports min/max values, labels, and smooth haptic feedback
 */
const SliderCard = React.memo(({
    task,
    index,
    displayIndex,
    totalCards,
    partnerName,
    userName,
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
    const lastTaskIdRef = useRef(task._id);

    // Animated values
    const translateX = useSharedValue(
        isAnswered
            ? ((previousAnswer - minValue) / (maxValue - minValue)) * (SLIDER_WIDTH - KNOB_SIZE)
            : ((SLIDER_WIDTH - KNOB_SIZE) / 2)
    );
    const gestureStartX = useSharedValue(0);

    // Reset only when task ID actually changes
    useEffect(() => {
        if (lastTaskIdRef.current !== task._id) {
            lastTaskIdRef.current = task._id;
            const initialValue = isAnswered ? previousAnswer : Math.floor((minValue + maxValue) / 2);
            setCurrentValue(initialValue);
            setLocked(isAnswered);
            setHasInteracted(isAnswered);
            translateX.value = ((initialValue - minValue) / (maxValue - minValue)) * (SLIDER_WIDTH - KNOB_SIZE);
        }
    }, [task._id, isAnswered, previousAnswer, minValue, maxValue, translateX]);

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
    const panGesture = useMemo(() => (
        Gesture.Pan()
            .enabled(!locked && !isAnswered)
            .onBegin(() => {
                gestureStartX.value = translateX.value;
            })
            .onUpdate((event) => {
                const newX = Math.max(0, Math.min(SLIDER_WIDTH - KNOB_SIZE, gestureStartX.value + event.translationX));
                translateX.value = newX;
                runOnJS(updateValueFromPosition)(newX);
                if (!hasInteracted) {
                    runOnJS(setHasInteracted)(true);
                }
            })
            .onEnd(() => {
                translateX.value = withSpring(translateX.value, { damping: 15, stiffness: 150 });
            })
    ), [gestureStartX, hasInteracted, isAnswered, locked, translateX, updateValueFromPosition]);

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

        setLocked(true);

        try {
            onAnswerSubmit?.(task.originalIndex ?? index, currentValue);
            // Only auto-advance if the parent screen doesn't filter answered tasks
            if (autoAdvanceOnSubmit && onSubmit) {
                onSubmit(currentValue);
            }
        } catch (err) {
            console.error('handleSubmit error:', err);
        }
    };

    // Generate tick marks
    const ticks = [];
    for (let i = minValue; i <= maxValue; i++) {
        ticks.push(i);
    }

    return (
        <LinearGradient colors={['#24CE6D', '#1FB75E']} style={styles.cardInner}>
            {/* Already Answered Overlay */}
            {isAnswered && (
                <View style={cardStyles.answeredOverlay}>
                    <View style={cardStyles.answeredBadge}>
                        <Text style={cardStyles.answeredEmoji}>✅</Text>
                        <Text style={cardStyles.answeredTitle}>{translateUiText("Already Answered")}</Text>
                        <Text style={cardStyles.answeredText}>{translateUiText("You rated:")}{previousAnswer} / {maxValue}
                        </Text>
                    </View>
                </View>
            )}

            <View style={[styles.cardContent, isAnswered && { opacity: 0.3 }]}>
                {/* Header */}
                <View style={styles.topRow}>
                    <View style={styles.categoryBadge}>
                        <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                            <Path d="M12 2L14.95 8.02L21.6 8.98L16.8 13.66L17.93 20.28L12 17.16L6.07 20.28L7.2 13.66L2.4 8.98L9.05 8.02L12 2Z" fill="#16B98F" />
                        </Svg>
                        <Text style={styles.categoryText}>{translateUiText("Rate It")}</Text>
                    </View>
                </View>

                {/* Question */}
                <View style={styles.questionSection}>
                    <Text style={styles.questionText}>"{task.taskstatement}"</Text>
                </View>



                {/* Value Display */}
                <View style={styles.valueDisplay}>
                    <View style={styles.valuePill}>
                        <Text style={styles.valueText}>{currentValue}</Text>
                        <Text style={styles.valueMax}>/ {maxValue}</Text>
                    </View>
                </View>

                {/* Slider */}
                <View style={styles.sliderContainer}>
                    <View style={styles.sliderGlass} />
                    {/* Track Background */}
                    <View style={styles.trackBackground}>
                        {/* Progress Fill */}
                        <Animated.View style={[styles.trackFill, progressStyle]}>
                            <LinearGradient
                                colors={['#18C79A', '#63E1C0']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.trackFillGradient}
                            />
                        </Animated.View>
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
                    <GestureDetector gesture={panGesture}>
                        <Animated.View style={[styles.knob, knobStyle, { borderColor: config.color }]}>
                            <LinearGradient
                                colors={['#FFFFFF', '#FFF1F7']}
                                style={styles.knobGradient}
                            />
                            <Text style={styles.knobValue}>{currentValue}</Text>
                        </Animated.View>
                    </GestureDetector>
                </View>

                {/* Labels */}
                <View style={styles.labelsRow}>
                    <Text style={styles.labelText}>{minLabel}</Text>
                    <Text style={styles.labelText}>{maxLabel}</Text>
                </View>

                {/* Submit Button */}
                <View style={styles.actionRow}>
                    <TouchableOpacity
                        onPress={handleSubmit}
                        disabled={locked || isAnswered || !hasInteracted}
                        style={[
                            styles.submitButton,
                            (!hasInteracted || locked) && styles.submitButtonDisabled
                        ]}
                    >
                        <Text style={styles.submitText}>{translateUiText("✓ Submit")}</Text>
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
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingVertical: 9,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.22)',
        backgroundColor: 'rgba(255,255,255,0.12)',
    },
    categoryText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 14,
        fontFamily: fontFamily.bold,
    },
    counterText: {
        color: 'rgba(255, 255, 255, 0.75)',
        fontWeight: '800',
        fontSize: 16,
        fontFamily: fontFamily.bold,
    },
    questionSection: {
        flex: 0,
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
        marginTop: spacing.sm,
        marginBottom: spacing.xs,
    },
    questionText: {
        fontSize: 24,
        fontWeight: '800',
        color: '#FFFFFF',
        lineHeight: 30,
        textAlign: 'center',
        fontFamily: fontFamily.extraBold,
    },

    valueDisplay: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'center',
        marginTop: 'auto',
        marginBottom: spacing.md,
    },
    valuePill: {
        minWidth: 132,
        paddingHorizontal: 22,
        paddingVertical: 9,
        borderRadius: 36,
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.22)',
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 14,
        elevation: 8,
    },
    valueText: {
        fontSize: 48,
        fontWeight: '900',
        color: '#FFFFFF',
        fontFamily: fontFamily.extraBold,
    },
    valueMax: {
        fontSize: 18,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.75)',
        marginLeft: 4,
        fontFamily: fontFamily.bold,
    },
    sliderContainer: {
        width: SLIDER_WIDTH,
        alignSelf: 'center',
        height: 62,
        justifyContent: 'center',
    },
    sliderGlass: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.14)',
    },
    trackBackground: {
        position: 'absolute',
        left: KNOB_SIZE / 2,
        right: KNOB_SIZE / 2,
        height: TRACK_HEIGHT,
        backgroundColor: 'rgba(255, 255, 255, 0.16)',
        borderRadius: TRACK_HEIGHT / 2,
        overflow: 'hidden',
    },
    trackFill: {
        height: '100%',
        borderRadius: TRACK_HEIGHT / 2,
        overflow: 'hidden',
    },
    trackFillGradient: {
        flex: 1,
    },
    tickContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 12,
        top: (62 - 12) / 2,
    },
    tick: {
        position: 'absolute',
        width: 2,
        height: 8,
        backgroundColor: '#C9D6D4',
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
        borderColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 10,
        overflow: 'hidden',
    },
    knobGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    knobValue: {
        fontSize: 16,
        fontWeight: '800',
        color: '#333',
        fontFamily: fontFamily.extraBold,
    },
    labelsRow: {
        width: SLIDER_WIDTH,
        alignSelf: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 2,
        marginBottom: spacing.md,
    },
    labelText: {
        fontSize: 13,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.75)',
        fontFamily: fontFamily.bold,
    },
    actionRow: {
        width: SLIDER_WIDTH,
        alignSelf: 'center',
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 0,
    },
    submitButton: {
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 25,
        borderWidth: 1,
        borderColor: '#FFFFFF',
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    submitButtonDisabled: {
        backgroundColor: 'rgba(255, 255, 255, 0.45)',
        borderColor: 'transparent',
    },
    submitText: {
        color: '#0D7C5F',
        fontSize: 16,
        fontWeight: '800',
        fontFamily: fontFamily.bold,
    },
});

export default SliderCard;
