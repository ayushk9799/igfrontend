import React, { useCallback, useEffect } from 'react';
import { StyleSheet, Dimensions, View, Platform, Text, TouchableOpacity } from 'react-native';
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
import { fontFamily } from '../../constants/fonts';

const { width } = Dimensions.get('window');

// Thresholds for swipe detection
const SWIPE_THRESHOLD = width * 0.25;
const SWIPE_VELOCITY_THRESHOLD = 500;

// Spring config for natural feel
const SPRING_CONFIG = {
    damping: 15,
    stiffness: 150,
    mass: 0.5,
};

const QUICK_TRANSITION_CONFIG = {
    duration: 180,
};

/**
 * AnimatedCardStack - Manages card transitions with smooth Reanimated animations
 * Uses Double Buffering (Slot A / Slot B) to prevent Android flicker on reset
 */
const AnimatedCardStack = ({
    tasks,
    currentIndex,
    partnerName,
    userName,
    userAvatar,
    partnerAvatar,
    userId,
    partnerId,
    hasPartner = false,
    onLinkPartner,
    onIndexChange,
    onComplete,
    onAnswerSubmit,
    challengeId,
    userAnswers = [],
    autoAdvanceOnSubmit = true,
    isPremium = false,
    onNavigateToPremium = () => { },
    totalCardsOverride,
    displayIndexOffset = 0,
    cardHeight,
}) => {
    // Current active slot (0 or 1)
    const activeSlotIndex = currentIndex % 2;

    // Shared values for Slot 0
    const val0 = {
        x: useSharedValue(0),
        y: useSharedValue(0),
        rot: useSharedValue(0),
    };

    // Shared values for Slot 1
    const val1 = {
        x: useSharedValue(0),
        y: useSharedValue(0),
        rot: useSharedValue(0),
    };

    const isGestureActive = useSharedValue(false);
    const isTransitioning = useSharedValue(false);

    // Navigation helpers
    const canGoNext = currentIndex < tasks.length - 1;
    const canGoPrev = currentIndex > 0;

    // Premium restriction: lock questions with order >= 6 (first 5 orders are free)
    // Check current card's order field from database
    const FREE_QUESTION_ORDER_LIMIT = 6; // Questions with order >= 6 are premium
    const currentTask = tasks[currentIndex];
    const isCurrentCardLocked = !isPremium && currentTask?.order >= FREE_QUESTION_ORDER_LIMIT;
    const currentAnswerIndex = currentTask?.originalIndex ?? currentIndex;
    const currentCardAnswered = !!(userAnswers[currentAnswerIndex]?.answer);
    const showSkipButton = !!currentTask && canGoNext && !currentCardAnswered;

    // Reset the INACTIVE slot when index changes
    useEffect(() => {
        // When index changes, the NEW active slot (passed in props) is already at 0,0 (visually).
        // The OLD active slot (now inactive) needs to be reset to 0,0 so it's ready for *next* time.

        isTransitioning.value = false;

        if (activeSlotIndex === 0) {
            // Logic: We just switched TO Slot 0. Slot 1 was swiped away or previous.
            // Reset Slot 1 so it can be the "Next" card behind Slot 0.
            val1.x.value = 0;
            val1.y.value = 0;
            val1.rot.value = 0;
        } else {
            // Logic: We just switched TO Slot 1. Slot 0 was swiped away.
            // Reset Slot 0.
            val0.x.value = 0;
            val0.y.value = 0;
            val0.rot.value = 0;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentIndex]); // Only run on index change

    const triggerHaptic = useCallback(() => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (e) {
            // Ignore
        }
    }, []);

    const goToNextCard = useCallback(() => {
        if (canGoNext) {
            onIndexChange(currentIndex + 1);
        }
    }, [canGoNext, currentIndex, onIndexChange]);

    const goToPrevCard = useCallback(() => {
        if (canGoPrev) {
            onIndexChange(currentIndex - 1);
        }
    }, [canGoPrev, currentIndex, onIndexChange]);

    // Programmatic transition (Skip/Submit)
    const triggerTransition = useCallback(() => {
        if (isTransitioning.value) return;

        if (!canGoNext) {
            isTransitioning.value = true;
            const activeX = activeSlotIndex === 0 ? val0.x : val1.x;
            const activeY = activeSlotIndex === 0 ? val0.y : val1.y;
            const activeRot = activeSlotIndex === 0 ? val0.rot : val1.rot;

            activeRot.value = withTiming(-12, QUICK_TRANSITION_CONFIG);
            activeY.value = withTiming(0, QUICK_TRANSITION_CONFIG);
            activeX.value = withTiming(-width * 1.3, QUICK_TRANSITION_CONFIG, (finished) => {
                if (finished && onComplete) {
                    runOnJS(onComplete)();
                }
            });
            return;
        }

        isTransitioning.value = true;
        const activeX = activeSlotIndex === 0 ? val0.x : val1.x;
        const activeY = activeSlotIndex === 0 ? val0.y : val1.y;
        const activeRot = activeSlotIndex === 0 ? val0.rot : val1.rot;

        // Add rotation to match swipe feel
        activeRot.value = withTiming(-12, QUICK_TRANSITION_CONFIG);
        activeY.value = withTiming(0, QUICK_TRANSITION_CONFIG);

        activeX.value = withTiming(-width * 1.3, QUICK_TRANSITION_CONFIG, (finished) => {
            if (finished) {
                runOnJS(goToNextCard)();
            }
        });
    }, [canGoNext, activeSlotIndex, goToNextCard, isTransitioning, onComplete, val0.x, val1.x, val0.y, val1.y, val0.rot, val1.rot]);

    const panGesture = Gesture.Pan()
        .onStart(() => {
            isGestureActive.value = true;
        })
        .onUpdate((event) => {
            if (isTransitioning.value) return;

            // Drive the ACTIVE slot
            const activeX = activeSlotIndex === 0 ? val0.x : val1.x;
            const activeY = activeSlotIndex === 0 ? val0.y : val1.y;
            const activeRot = activeSlotIndex === 0 ? val0.rot : val1.rot;

            activeX.value = event.translationX;
            activeY.value = event.translationY * 0.3;
            activeRot.value = interpolate(
                event.translationX,
                [-width / 2, 0, width / 2],
                [-10, 0, 10],
                Extrapolate.CLAMP
            );
        })
        .onEnd((event) => {
            isGestureActive.value = false;
            if (isTransitioning.value) return;

            const shouldSwipeLeft =
                (event.translationX < -SWIPE_THRESHOLD || event.velocityX < -SWIPE_VELOCITY_THRESHOLD) && !isCurrentCardLocked;
            const shouldSwipeRight =
                (event.translationX > SWIPE_THRESHOLD || event.velocityX > SWIPE_VELOCITY_THRESHOLD) && canGoPrev;

            const activeX = activeSlotIndex === 0 ? val0.x : val1.x;
            const activeY = activeSlotIndex === 0 ? val0.y : val1.y;
            const activeRot = activeSlotIndex === 0 ? val0.rot : val1.rot;

            if (shouldSwipeLeft) {
                isTransitioning.value = true;
                runOnJS(triggerHaptic)();
                activeX.value = withSpring(-width * 1.3, { ...SPRING_CONFIG, velocity: event.velocityX }, (finished) => {
                    if (finished) {
                        if (canGoNext) {
                            runOnJS(goToNextCard)();
                        } else if (onComplete) {
                            runOnJS(onComplete)();
                        }
                    }
                });
                activeY.value = withSpring(event.translationY + event.velocityY * 0.1, { ...SPRING_CONFIG, velocity: event.velocityY });
                activeRot.value = withSpring(-15, { ...SPRING_CONFIG, velocity: event.velocityX * 0.05 });
            } else if (shouldSwipeRight) {
                isTransitioning.value = true;
                runOnJS(triggerHaptic)();
                activeX.value = withSpring(width * 1.3, { ...SPRING_CONFIG, velocity: event.velocityX }, (finished) => {
                    if (finished) runOnJS(goToPrevCard)();
                });
                activeY.value = withSpring(event.translationY + event.velocityY * 0.1, { ...SPRING_CONFIG, velocity: event.velocityY });
                activeRot.value = withSpring(15, { ...SPRING_CONFIG, velocity: event.velocityX * 0.05 });
            } else {
                activeX.value = withSpring(0, SPRING_CONFIG);
                activeY.value = withSpring(0, SPRING_CONFIG);
                activeRot.value = withSpring(0, SPRING_CONFIG);
            }
        });

    // Helper to separate rendering logic
    const renderSlot = (slotIndex) => {
        // Determine if this slot is the Active Request (front) or the Next/Prev (back)
        const isActive = slotIndex === activeSlotIndex;

        // Calculate which task index sits in this slot
        // If this slot is Active, it holds 'currentIndex'
        // If this slot is Inactive, it holds 'currentIndex + 1' (Next Card)
        // Note: For 'Prev' card history, we typically don't render it in the stack until we swipe back, 
        // effectively 'currentIndex - 1' becomes Active. 
        // So the "Inactive" slot is always the "Next" card in the waiting line.
        const taskIndex = isActive ? currentIndex : currentIndex + 1;
        const task = tasks[taskIndex];

        // Animated Styles
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const slotStyle = useAnimatedStyle(() => {
            const myVals = slotIndex === 0 ? val0 : val1;
            const otherVals = slotIndex === 0 ? val1 : val0; // The active card if I am inactive

            if (isActive) {
                // I am the Front Card -> use my own values directly
                return {
                    transform: [
                        { translateX: myVals.x.value },
                        { translateY: myVals.y.value },
                        { rotate: `${myVals.rot.value}deg` },
                    ],
                    zIndex: 2, // Highlight: Front
                    opacity: 1,
                };
            } else {
                // I am the Back Card (Next) -> animate purely based on the OTHER (Active) card's movement
                // We create a "Peek" effect.
                const activeCardX = otherVals.x.value;

                // Keep cards exactly the same size with no scale or translation changes
                const scale = 1;
                const translateY = 0;

                const opacity = interpolate(
                    Math.abs(activeCardX),
                    [0, SWIPE_THRESHOLD],
                    [0.5, 1],
                    Extrapolate.CLAMP
                );

                return {
                    transform: [{ scale }, { translateY }],
                    zIndex: 1, // Behind
                    opacity,
                };
            }
        });

        if (!task) return null; // End of stack

        const getCardProps = (t, i) => {
            // Use originalIndex if available (from filtered unansweredTasks), fallback to i
            const answerIndex = t.originalIndex ?? i;
            // Card is locked if user is not premium and question order >= 6
            const cardIsLocked = !isPremium && t?.order >= FREE_QUESTION_ORDER_LIMIT;
            return {
                task: t,
                index: i,
                displayIndex: displayIndexOffset + (t.originalIndex ?? i) + 1,
                totalCards: totalCardsOverride ?? tasks.length,
                partnerName,
                userName,
                userAvatar,
                partnerAvatar,
                userId,
                partnerId,
                hasPartner,
                onLinkPartner,
                onSubmit: cardIsLocked ? onNavigateToPremium : triggerTransition,
                onSkip: cardIsLocked ? onNavigateToPremium : triggerTransition,
                isLastCard: i >= tasks.length - 1,
                onAnswerSubmit,
                isAnswered: !!(userAnswers[answerIndex]?.answer),
                previousAnswer: userAnswers[answerIndex]?.answer,
                autoAdvanceOnSubmit,
                isLocked: cardIsLocked,
                onNavigateToPremium,
            };
        };

        return (
            <Animated.View
                key={`slot-${slotIndex}`}
                style={[styles.fullCard, slotStyle]}
                needsOffscreenAlphaCompositing={Platform.OS === 'android'}
            >
                <TaskCard {...getCardProps(task, taskIndex)} />
            </Animated.View>
        );
    };

    // Hints need to check the ACTIVE card's position
    const leftHintStyle = useAnimatedStyle(() => {
        const activeX = activeSlotIndex === 0 ? val0.x.value : val1.x.value;
        return {
            opacity: interpolate(activeX, [0, SWIPE_THRESHOLD], [0, 1], Extrapolate.CLAMP),
        };
    });

    const rightHintStyle = useAnimatedStyle(() => {
        const activeX = activeSlotIndex === 0 ? val0.x.value : val1.x.value;
        return {
            opacity: interpolate(activeX, [0, -SWIPE_THRESHOLD], [0, 1], Extrapolate.CLAMP),
        };
    });

    return (
        <View style={styles.container}>
            <GestureDetector gesture={panGesture}>
                <View style={[styles.cardWrapper, cardHeight ? [styles.fixedCardWrapper, { height: cardHeight }] : null]}>
                    {/* Render Both Slots */}
                    {renderSlot(0)}
                    {renderSlot(1)}
                </View>
            </GestureDetector>

            <TouchableOpacity
                style={[styles.skipButton, !showSkipButton && { opacity: 0 }]}
                disabled={!showSkipButton}
                onPress={isCurrentCardLocked ? onNavigateToPremium : triggerTransition}
                activeOpacity={0.82}
            >
                <Text style={styles.skipText}>{'Swipe to skip ->'}</Text>
            </TouchableOpacity>
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
    cardWrapper: {
        width: width - 32,
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        // Important: this wrapper shouldn't clip if we want swipe out to be visible
        // but often we want the stack contained.
    },
    fixedCardWrapper: {
        flex: 0,
    },
    fullCard: {
        width: '100%', // defined by wrapper
        height: '100%',
        borderRadius: 28,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        overflow: 'hidden',
        backgroundColor: 'transparent', // Prevent transparency flicker
    },
    skipButton: {
        marginTop: 22,
        marginBottom: 2,
        paddingHorizontal: 14,
        paddingVertical: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    skipText: {
        color: 'rgba(46, 30, 60, 0.58)',
        fontSize: 16,
        fontWeight: '800',
        fontFamily: fontFamily.bold,
    },
    swipeHint: {
        position: 'absolute',
        top: '50%',
        marginTop: -20,
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
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
