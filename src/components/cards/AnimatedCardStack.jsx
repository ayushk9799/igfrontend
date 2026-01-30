import React, { useCallback, useEffect } from 'react';
import { StyleSheet, Dimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    runOnJS,
    interpolate,
    Extrapolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import TaskCard from './TaskCard';

const { width } = Dimensions.get('window');

// Thresholds for swipe detection
const SWIPE_THRESHOLD = width * 0.25;
const SWIPE_VELOCITY_THRESHOLD = 500;

// Spring config for natural feel
const SPRING_CONFIG = {
    damping: 20,
    stiffness: 200,
    mass: 0.5,
};

/**
 * AnimatedCardStack - Manages card transitions with smooth Reanimated animations
 * Supports swipe gestures for navigation
 */
const AnimatedCardStack = ({
    tasks,
    currentIndex,
    partnerName,
    userName,
    userAvatar,
    partnerAvatar,
    onIndexChange,
    onAnswerSubmit,
    challengeId,
    userAnswers = [],
}) => {
    // Shared values for animations
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const cardRotation = useSharedValue(0);
    const isGestureActive = useSharedValue(false);
    const isTransitioning = useSharedValue(false);

    // Navigation helpers
    const canGoNext = currentIndex < tasks.length - 1;
    const canGoPrev = currentIndex > 0;

    // Reset animation values when currentIndex changes (AFTER React re-renders)
    // This is the key fix - values reset AFTER the new card is rendered
    useEffect(() => {
        translateX.value = 0;
        translateY.value = 0;
        cardRotation.value = 0;
        isTransitioning.value = false;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentIndex]); // Shared values are stable refs, only trigger on currentIndex change

    // Haptic feedback wrapper
    const triggerHaptic = useCallback(() => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (e) {
            // Haptics not available
        }
    }, []);

    // Navigate to next card - just update state, useEffect handles reset
    const goToNextCard = useCallback(() => {
        if (canGoNext) {
            onIndexChange(currentIndex + 1);
        }
    }, [canGoNext, currentIndex, onIndexChange]);

    // Navigate to previous card - just update state, useEffect handles reset
    const goToPrevCard = useCallback(() => {
        if (canGoPrev) {
            onIndexChange(currentIndex - 1);
        }
    }, [canGoPrev, currentIndex, onIndexChange]);

    // Handle programmatic transition (from answer submit)
    const triggerTransition = useCallback(() => {
        if (!canGoNext || isTransitioning.value) return;

        isTransitioning.value = true;

        // Animate card out to the left, then update state
        translateX.value = withTiming(-width * 1.2, { duration: 200 }, (finished) => {
            if (finished) {
                runOnJS(goToNextCard)();
            }
        });
    }, [canGoNext, goToNextCard, translateX, isTransitioning]);

    // Pan gesture for swiping
    const panGesture = Gesture.Pan()
        .onStart(() => {
            isGestureActive.value = true;
        })
        .onUpdate((event) => {
            if (isTransitioning.value) return; // Prevent updates during transition
            translateX.value = event.translationX;
            translateY.value = event.translationY * 0.3; // Dampened vertical movement
            cardRotation.value = interpolate(
                event.translationX,
                [-width / 2, 0, width / 2],
                [-10, 0, 10],
                Extrapolate.CLAMP
            );
        })
        .onEnd((event) => {
            isGestureActive.value = false;
            if (isTransitioning.value) return; // Prevent double transitions

            const shouldSwipeLeft =
                (event.translationX < -SWIPE_THRESHOLD || event.velocityX < -SWIPE_VELOCITY_THRESHOLD) && canGoNext;
            const shouldSwipeRight =
                (event.translationX > SWIPE_THRESHOLD || event.velocityX > SWIPE_VELOCITY_THRESHOLD) && canGoPrev;

            if (shouldSwipeLeft) {
                // Swipe left - go to next card
                isTransitioning.value = true;
                runOnJS(triggerHaptic)();
                translateX.value = withTiming(-width * 1.2, { duration: 200 }, (finished) => {
                    if (finished) {
                        runOnJS(goToNextCard)();
                    }
                });
            } else if (shouldSwipeRight) {
                // Swipe right - go to previous card
                isTransitioning.value = true;
                runOnJS(triggerHaptic)();
                translateX.value = withTiming(width * 1.2, { duration: 200 }, (finished) => {
                    if (finished) {
                        runOnJS(goToPrevCard)();
                    }
                });
            } else {
                // Spring back to center
                translateX.value = withSpring(0, SPRING_CONFIG);
                translateY.value = withSpring(0, SPRING_CONFIG);
                cardRotation.value = withSpring(0, SPRING_CONFIG);
            }
        });

    // Animated styles for current card
    const animatedCardStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { rotate: `${cardRotation.value}deg` },
        ],
    }));

    // Animated styles for next card (peek effect)
    const animatedNextCardStyle = useAnimatedStyle(() => ({
        transform: [
            {
                scale: interpolate(
                    Math.abs(translateX.value),
                    [0, SWIPE_THRESHOLD],
                    [0.94, 1],
                    Extrapolate.CLAMP
                ),
            },
            {
                translateY: interpolate(
                    Math.abs(translateX.value),
                    [0, SWIPE_THRESHOLD],
                    [-20, 0],
                    Extrapolate.CLAMP
                ),
            },
        ],
        opacity: interpolate(
            Math.abs(translateX.value),
            [0, SWIPE_THRESHOLD],
            [0.5, 1],
            Extrapolate.CLAMP
        ),
    }));

    // Animated styles for swipe hints (moved outside conditionals to avoid hook rules violation)
    const leftHintStyle = useAnimatedStyle(() => ({
        opacity: interpolate(
            translateX.value,
            [0, SWIPE_THRESHOLD],
            [0, 1],
            Extrapolate.CLAMP
        ),
    }));

    const rightHintStyle = useAnimatedStyle(() => ({
        opacity: interpolate(
            translateX.value,
            [0, -SWIPE_THRESHOLD],
            [0, 1],
            Extrapolate.CLAMP
        ),
    }));

    const currentTask = tasks[currentIndex];
    const nextTask = tasks[currentIndex + 1];

    if (!currentTask) return null;

    // Common props for cards
    const getCardProps = (task, idx) => ({
        task,
        index: idx,
        totalCards: tasks.length,
        partnerName,
        userName,
        userAvatar,
        partnerAvatar,
        onSubmit: triggerTransition,
        onSkip: triggerTransition,
        isLastCard: idx >= tasks.length - 1,
        onAnswerSubmit,
        isAnswered: !!(userAnswers[idx]?.answer),
        previousAnswer: userAnswers[idx]?.answer,
    });

    return (
        <View style={styles.container}>
            {/* NEXT CARD (Behind) - Animated peek effect */}
            {nextTask && (
                <Animated.View style={[styles.fullCard, styles.backCard, animatedNextCardStyle]}>
                    <TaskCard {...getCardProps(nextTask, currentIndex + 1)} />
                </Animated.View>
            )}

            {/* CURRENT CARD (Front) - Swipeable */}
            <GestureDetector gesture={panGesture}>
                <Animated.View style={[styles.fullCard, animatedCardStyle]}>
                    <TaskCard {...getCardProps(currentTask, currentIndex)} />
                </Animated.View>
            </GestureDetector>

            {/* Swipe hint indicators */}
            {canGoPrev && (
                <View style={[styles.swipeHint, styles.swipeHintLeft]}>
                    <Animated.View style={leftHintStyle}>
                        <View style={styles.swipeHintDot} />
                    </Animated.View>
                </View>
            )}
            {canGoNext && (
                <View style={[styles.swipeHint, styles.swipeHintRight]}>
                    <Animated.View style={rightHintStyle}>
                        <View style={styles.swipeHintDot} />
                    </Animated.View>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    fullCard: {
        width: width - 32,
        height: '100%',
        borderRadius: 28,
        position: 'absolute',
        top: 0,
        overflow: 'hidden',
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
    },
    backCard: {
        zIndex: 0,
    },
    swipeHint: {
        position: 'absolute',
        top: '50%',
        marginTop: -20,
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    swipeHintLeft: {
        left: 5,
    },
    swipeHintRight: {
        right: 5,
    },
    swipeHintDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.6)',
    },
});

export default AnimatedCardStack;
