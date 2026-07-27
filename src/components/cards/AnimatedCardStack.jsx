import React, { useCallback, useLayoutEffect, useRef } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    Easing,
    Extrapolate,
    interpolate,
    runOnJS,
    useAnimatedReaction,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import TaskCard from './TaskCard';
import { fontFamily } from '../../constants/fonts';
import { translateUiText } from '../../i18n/uiTranslation';

const { width } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.25;
const SWIPE_VELOCITY_THRESHOLD = 500;
const HANDOFF_THRESHOLD = width * 1.05;

const COMPLETION_NONE = 0;
const COMPLETION_PROGRAMMATIC = 1;
const COMPLETION_SKIP = 2;
const COMPLETION_PREVIOUS = 3;

const SPRING_CONFIG = {
    damping: 15,
    stiffness: 150,
    mass: 0.5,
};
const CONFIRMATION_PULSE_UP_CONFIG = {
    duration: 80,
    easing: Easing.out(Easing.quad),
};
const CONFIRMATION_PULSE_DOWN_CONFIG = {
    duration: 90,
    easing: Easing.inOut(Easing.quad),
};
const REDUCED_MOTION_FADE_CONFIG = {
    duration: 160,
    easing: Easing.out(Easing.quad),
};
const ANSWER_FEEDBACK_HOLD_MS = 500;
const FREE_QUESTION_ORDER_LIMIT = 6;

/**
 * A persistent question layer. Its visual role is derived entirely from shared
 * values, so promotion from background to foreground is atomic on the UI thread.
 */
const CardLayer = React.memo(({
    task,
    taskIndex,
    cardProps,
    interactive,
    reduceMotion,
    visualIndex,
    transitionFromIndex,
    transitionDirection,
    isTransitioning,
    completionMode,
    x,
    y,
    rotation,
    activeScale,
    activeOpacity,
}) => {
    const animatedStyle = useAnimatedStyle(() => {
        const relativeIndex = taskIndex - visualIndex.value;
        const isOutgoing =
            isTransitioning.value
            && taskIndex === transitionFromIndex.value;

        if (isOutgoing) {
            return {
                transform: [
                    { translateX: x.value },
                    { translateY: y.value },
                    { rotate: `${rotation.value}deg` },
                    { scale: activeScale.value },
                ],
                zIndex: 3,
                opacity: activeOpacity.value,
            };
        }

        if (relativeIndex === 0) {
            return {
                transform: [
                    { translateX: 0 },
                    { translateY: 0 },
                    { rotate: '0deg' },
                    { scale: 1 },
                ],
                zIndex: 2,
                opacity: 1,
            };
        }

        const isAdjacent = Math.abs(relativeIndex) === 1;
        if (!isAdjacent) {
            return {
                transform: [{ scale: 0.96 }, { translateY: 14 }],
                zIndex: 0,
                opacity: 0,
            };
        }

        const dragDirection = x.value < 0 ? 1 : x.value > 0 ? -1 : 0;
        const effectiveDirection =
            transitionDirection.value !== 0
                ? transitionDirection.value
                : dragDirection;
        const isRevealTarget = relativeIndex === effectiveDirection;

        if (!isRevealTarget) {
            return {
                transform: [{ scale: 0.96 }, { translateY: 14 }],
                zIndex: 0,
                opacity: 0,
            };
        }

        if (
            reduceMotion
            && isTransitioning.value
            && completionMode.value === COMPLETION_PROGRAMMATIC
        ) {
            const revealProgress = 1 - activeOpacity.value;
            return {
                transform: [{ scale: 1 }, { translateY: 0 }],
                zIndex: 1,
                opacity: revealProgress,
            };
        }

        const directionalTravel =
            relativeIndex === 1
                ? Math.max(-x.value, 0)
                : Math.max(x.value, 0);
        const revealProgress = interpolate(
            directionalTravel,
            [0, width * 0.85],
            [0, 1],
            Extrapolate.CLAMP
        );

        return {
            transform: [
                { scale: interpolate(revealProgress, [0, 1], [0.96, 1]) },
                { translateY: interpolate(revealProgress, [0, 1], [14, 0]) },
            ],
            zIndex: 1,
            opacity: 1,
        };
    }, [reduceMotion, taskIndex]);

    return (
        <Animated.View
            style={[styles.fullCard, animatedStyle]}
            pointerEvents={interactive ? 'auto' : 'none'}
        >
            <TaskCard {...cardProps} task={task} index={taskIndex} />
        </Animated.View>
    );
});

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
    onAnswerTransitionComplete,
    onSkipQuestion,
    userAnswers = [],
    autoAdvanceOnSubmit = true,
    showAlreadyAnsweredOverlay = true,
    isPremium = false,
    onNavigateToPremium = () => { },
    totalCardsOverride,
    displayIndexOffset = 0,
    cardHeight,
}) => {
    const reduceMotion = useReducedMotion();

    const x = useSharedValue(0);
    const y = useSharedValue(0);
    const rotation = useSharedValue(0);
    const activeScale = useSharedValue(1);
    const activeOpacity = useSharedValue(1);
    const visualIndex = useSharedValue(currentIndex);
    const transitionFromIndex = useSharedValue(currentIndex);
    const transitionDirection = useSharedValue(0);
    const isTransitioning = useSharedValue(false);
    const completionMode = useSharedValue(COMPLETION_NONE);

    const pendingAnsweredTaskIndexRef = useRef(null);
    const isAnswerSubmissionPendingRef = useRef(false);

    const canGoNext = currentIndex < tasks.length - 1;
    const canGoPrev = currentIndex > 0;
    const currentTask = tasks[currentIndex];
    const currentAnswerIndex = currentTask?.originalIndex ?? currentIndex;
    const currentCardAnswered = !!userAnswers[currentAnswerIndex]?.answer;
    const isCurrentCardLocked =
        !isPremium && currentTask?.order >= FREE_QUESTION_ORDER_LIMIT;
    const showSkipButton = !!currentTask && canGoNext && !currentCardAnswered;

    useLayoutEffect(() => {
        // visualIndex is normally promoted on the UI thread before this render.
        // Reasserting it here also handles external index changes and new sets.
        visualIndex.value = currentIndex;
        transitionFromIndex.value = currentIndex;
        transitionDirection.value = 0;
        completionMode.value = COMPLETION_NONE;
        isTransitioning.value = false;
        x.value = 0;
        y.value = 0;
        rotation.value = 0;
        activeScale.value = 1;
        activeOpacity.value = 1;
    }, [
        activeOpacity,
        activeScale,
        completionMode,
        currentIndex,
        isTransitioning,
        rotation,
        transitionDirection,
        transitionFromIndex,
        visualIndex,
        x,
        y,
    ]);

    const triggerHaptic = useCallback(() => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch (error) {
            // Haptics are optional.
        }
    }, []);

    const goToNextCard = useCallback(() => {
        if (canGoNext) onIndexChange(currentIndex + 1);
    }, [canGoNext, currentIndex, onIndexChange]);

    const goToPrevCard = useCallback(() => {
        if (canGoPrev) onIndexChange(currentIndex - 1);
    }, [canGoPrev, currentIndex, onIndexChange]);

    const finishSkip = useCallback(() => {
        const task = tasks[currentIndex];
        if (task && onSkipQuestion) {
            onSkipQuestion(task.originalIndex ?? currentIndex);
        }
        if (canGoNext) {
            goToNextCard();
        } else {
            onComplete?.();
        }
    }, [canGoNext, currentIndex, goToNextCard, onComplete, onSkipQuestion, tasks]);

    const finishProgrammaticTransition = useCallback(() => {
        const answeredTaskIndex = pendingAnsweredTaskIndexRef.current;
        pendingAnsweredTaskIndexRef.current = null;
        isAnswerSubmissionPendingRef.current = false;

        if (answeredTaskIndex !== null && onAnswerTransitionComplete) {
            onAnswerTransitionComplete(answeredTaskIndex);
            if (canGoNext) {
                goToNextCard();
            } else {
                onComplete?.();
            }
            return;
        }

        finishSkip();
    }, [canGoNext, finishSkip, goToNextCard, onAnswerTransitionComplete, onComplete]);

    const triggerTransition = useCallback((delayMs = 0, showConfirmationPulse = false) => {
        if (isTransitioning.value) return;

        const direction = canGoNext ? 1 : 0;
        transitionFromIndex.value = currentIndex;
        transitionDirection.value = direction;
        completionMode.value = COMPLETION_PROGRAMMATIC;
        isTransitioning.value = true;

        if (reduceMotion) {
            activeOpacity.value = withDelay(
                delayMs,
                withTiming(0, REDUCED_MOTION_FADE_CONFIG)
            );
            return;
        }

        activeScale.value = showConfirmationPulse
            ? withSequence(
                withTiming(1.025, CONFIRMATION_PULSE_UP_CONFIG),
                withTiming(1, CONFIRMATION_PULSE_DOWN_CONFIG)
            )
            : 1;
        activeOpacity.value = 1;
        y.value = withDelay(delayMs, withSpring(-28, {
            ...SPRING_CONFIG,
            velocity: -120,
        }));
        rotation.value = withDelay(delayMs, withSpring(-15, {
            ...SPRING_CONFIG,
            velocity: -35,
        }));
        x.value = withDelay(delayMs, withSpring(-width * 1.3, {
            ...SPRING_CONFIG,
            velocity: -900,
        }));
    }, [
        activeOpacity,
        activeScale,
        canGoNext,
        completionMode,
        currentIndex,
        isTransitioning,
        reduceMotion,
        rotation,
        transitionDirection,
        transitionFromIndex,
        x,
        y,
    ]);

    useAnimatedReaction(
        () => ({
            mode: completionMode.value,
            direction: transitionDirection.value,
            crossedBoundary: Math.abs(x.value) >= HANDOFF_THRESHOLD,
            fadedOut: activeOpacity.value <= 0.01,
        }),
        (state) => {
            if (state.mode === COMPLETION_NONE) return;
            const usesReducedMotionFade =
                reduceMotion && state.mode === COMPLETION_PROGRAMMATIC;
            if (usesReducedMotionFade ? !state.fadedOut : !state.crossedBoundary) return;

            // Promote the already-visible layer before React updates currentIndex.
            // This is the atomic handoff that prevents a background-style frame.
            completionMode.value = COMPLETION_NONE;
            if (state.direction !== 0) {
                visualIndex.value += state.direction;
                isTransitioning.value = false;
            } else {
                // Keep the final outgoing card offscreen until the completion
                // screen replaces the stack.
                activeOpacity.value = 0;
            }

            if (state.mode === COMPLETION_PROGRAMMATIC) {
                runOnJS(finishProgrammaticTransition)();
            } else if (state.mode === COMPLETION_SKIP) {
                runOnJS(finishSkip)();
            } else if (state.mode === COMPLETION_PREVIOUS) {
                runOnJS(goToPrevCard)();
            }
        },
        [
            finishProgrammaticTransition,
            finishSkip,
            goToPrevCard,
            reduceMotion,
        ]
    );

    const submitAnswerWithTransition = useCallback(async (...args) => {
        if (onAnswerTransitionComplete && isAnswerSubmissionPendingRef.current) {
            return false;
        }
        if (onAnswerTransitionComplete) {
            isAnswerSubmissionPendingRef.current = true;
        }

        let submitted;
        try {
            submitted = await onAnswerSubmit?.(...args);
        } catch (error) {
            isAnswerSubmissionPendingRef.current = false;
            throw error;
        }

        if (submitted === false) {
            isAnswerSubmissionPendingRef.current = false;
            return false;
        }

        if (onAnswerTransitionComplete) {
            pendingAnsweredTaskIndexRef.current = args[0];
            triggerHaptic();
            triggerTransition(ANSWER_FEEDBACK_HOLD_MS, true);
        }
        return submitted;
    }, [onAnswerSubmit, onAnswerTransitionComplete, triggerHaptic, triggerTransition]);

    const triggerSkipTransition = useCallback(() => {
        pendingAnsweredTaskIndexRef.current = null;
        triggerTransition();
    }, [triggerTransition]);

    const panGesture = Gesture.Pan()
        .onUpdate((event) => {
            if (isTransitioning.value) return;

            transitionFromIndex.value = visualIndex.value;
            transitionDirection.value =
                event.translationX < 0 ? 1 : event.translationX > 0 ? -1 : 0;
            x.value = event.translationX;
            y.value = event.translationY * 0.3;
            rotation.value = interpolate(
                event.translationX,
                [-width / 2, 0, width / 2],
                [-10, 0, 10],
                Extrapolate.CLAMP
            );
        })
        .onEnd((event) => {
            if (isTransitioning.value) return;

            const shouldSwipeLeft =
                (
                    event.translationX < -SWIPE_THRESHOLD
                    || event.velocityX < -SWIPE_VELOCITY_THRESHOLD
                )
                && !isCurrentCardLocked;
            const shouldSwipeRight =
                (
                    event.translationX > SWIPE_THRESHOLD
                    || event.velocityX > SWIPE_VELOCITY_THRESHOLD
                )
                && canGoPrev;

            if (shouldSwipeLeft) {
                const direction = canGoNext ? 1 : 0;
                transitionDirection.value = direction;
                completionMode.value = COMPLETION_SKIP;
                isTransitioning.value = true;
                runOnJS(triggerHaptic)();
                x.value = withSpring(-width * 1.3, {
                    ...SPRING_CONFIG,
                    velocity: event.velocityX,
                });
                y.value = withSpring(
                    event.translationY + event.velocityY * 0.1,
                    { ...SPRING_CONFIG, velocity: event.velocityY }
                );
                rotation.value = withSpring(-15, {
                    ...SPRING_CONFIG,
                    velocity: event.velocityX * 0.05,
                });
            } else if (shouldSwipeRight) {
                transitionDirection.value = -1;
                completionMode.value = COMPLETION_PREVIOUS;
                isTransitioning.value = true;
                runOnJS(triggerHaptic)();
                x.value = withSpring(width * 1.3, {
                    ...SPRING_CONFIG,
                    velocity: event.velocityX,
                });
                y.value = withSpring(
                    event.translationY + event.velocityY * 0.1,
                    { ...SPRING_CONFIG, velocity: event.velocityY }
                );
                rotation.value = withSpring(15, {
                    ...SPRING_CONFIG,
                    velocity: event.velocityX * 0.05,
                });
            } else {
                transitionDirection.value = 0;
                x.value = withSpring(0, SPRING_CONFIG);
                y.value = withSpring(0, SPRING_CONFIG);
                rotation.value = withSpring(0, SPRING_CONFIG);
            }
        });

    const getCardProps = useCallback((task, taskIndex) => {
        const answerIndex = task.originalIndex ?? taskIndex;
        const cardIsLocked =
            !isPremium && task.order >= FREE_QUESTION_ORDER_LIMIT;

        return {
            displayIndex: displayIndexOffset + answerIndex + 1,
            totalCards: totalCardsOverride ?? tasks.length,
            partnerName,
            userName,
            userAvatar,
            partnerAvatar,
            userId,
            partnerId,
            hasPartner,
            onLinkPartner,
            onSubmit: cardIsLocked ? onNavigateToPremium : triggerSkipTransition,
            onSkip: cardIsLocked ? onNavigateToPremium : triggerSkipTransition,
            isLastCard: taskIndex >= tasks.length - 1,
            onAnswerSubmit: submitAnswerWithTransition,
            isAnswered: !!userAnswers[answerIndex]?.answer,
            previousAnswer: userAnswers[answerIndex]?.answer,
            autoAdvanceOnSubmit,
            showAlreadyAnsweredOverlay,
            isLocked: cardIsLocked,
            onNavigateToPremium,
        };
    }, [
        autoAdvanceOnSubmit,
        displayIndexOffset,
        hasPartner,
        isPremium,
        onLinkPartner,
        onNavigateToPremium,
        partnerAvatar,
        partnerId,
        partnerName,
        showAlreadyAnsweredOverlay,
        submitAnswerWithTransition,
        tasks.length,
        totalCardsOverride,
        triggerSkipTransition,
        userAnswers,
        userAvatar,
        userId,
        userName,
    ]);

    const layerIndexes = [currentIndex - 1, currentIndex, currentIndex + 1]
        .filter((index) => index >= 0 && index < tasks.length);

    return (
        <View style={styles.container}>
            <GestureDetector gesture={panGesture}>
                <View
                    style={[
                        styles.cardWrapper,
                        cardHeight
                            ? [styles.fixedCardWrapper, { height: cardHeight }]
                            : null,
                    ]}
                >
                    {layerIndexes.map((taskIndex) => {
                        const task = tasks[taskIndex];
                        return (
                            <CardLayer
                                key={task._id || task.questionId || taskIndex}
                                task={task}
                                taskIndex={taskIndex}
                                cardProps={getCardProps(task, taskIndex)}
                                interactive={taskIndex === currentIndex}
                                reduceMotion={reduceMotion}
                                visualIndex={visualIndex}
                                transitionFromIndex={transitionFromIndex}
                                transitionDirection={transitionDirection}
                                isTransitioning={isTransitioning}
                                completionMode={completionMode}
                                x={x}
                                y={y}
                                rotation={rotation}
                                activeScale={activeScale}
                                activeOpacity={activeOpacity}
                            />
                        );
                    })}
                </View>
            </GestureDetector>

            <TouchableOpacity
                style={[
                    styles.skipButton,
                    !showSkipButton && styles.hiddenSkipButton,
                ]}
                disabled={!showSkipButton}
                onPress={
                    isCurrentCardLocked
                        ? onNavigateToPremium
                        : triggerSkipTransition
                }
                activeOpacity={0.82}
            >
                <Text style={styles.skipText}>{translateUiText("Swipe to skip ->")}</Text>
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
    },
    fixedCardWrapper: {
        flex: 0,
    },
    fullCard: {
        width: '100%',
        height: '100%',
        borderRadius: 28,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        overflow: 'hidden',
        backgroundColor: 'transparent',
    },
    skipButton: {
        marginTop: 22,
        marginBottom: 2,
        paddingHorizontal: 14,
        paddingVertical: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    hiddenSkipButton: {
        opacity: 0,
    },
    skipText: {
        color: 'rgba(46, 30, 60, 0.58)',
        fontSize: 16,
        fontWeight: '800',
        fontFamily: fontFamily.bold,
    },
});

export default AnimatedCardStack;
