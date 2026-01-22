import React, { useEffect, useRef, useCallback } from 'react';
import { Animated, StyleSheet, Dimensions } from 'react-native';

import TaskCard from './TaskCard';

const { width, height } = Dimensions.get('window');

/**
 * AnimatedCardStack - Manages card transitions with smooth animations
 */
const AnimatedCardStack = ({
    tasks,
    currentIndex,
    partnerName,
    userName,
    onIndexChange,
    onAnswerSubmit,
    challengeId,
    userAnswers = [] // Track which tasks are already answered
}) => {
    // Animation values - persistent refs that get reset on index change
    const frontCardTranslateX = useRef(new Animated.Value(0)).current;
    const frontCardOpacity = useRef(new Animated.Value(1)).current;
    const backCardScale = useRef(new Animated.Value(0.94)).current;
    const backCardTranslateY = useRef(new Animated.Value(-20)).current;
    const backCardOpacity = useRef(new Animated.Value(0.5)).current;

    // Reset animations instantly when index changes (driven by state)
    useEffect(() => {
        // Stop any running animations
        frontCardTranslateX.stopAnimation();
        frontCardOpacity.stopAnimation();
        backCardScale.stopAnimation();
        backCardTranslateY.stopAnimation();
        backCardOpacity.stopAnimation();

        // Reset to initial positions
        frontCardTranslateX.setValue(0);
        frontCardOpacity.setValue(1);
        backCardScale.setValue(0.94);
        backCardTranslateY.setValue(-20);
        backCardOpacity.setValue(0.5);
    }, [currentIndex]);

    const triggerTransition = useCallback(() => {
        // Guard: don't go past the last card
        if (currentIndex >= tasks.length - 1) return;

        // OPTIMISTIC: Update state IMMEDIATELY (header updates instantly)
        onIndexChange(currentIndex + 1);

        // Animation runs INDEPENDENTLY as visual polish
        // (state already changed, so this is just for show)
        Animated.parallel([
            // Front card exits to the left
            Animated.timing(frontCardTranslateX, {
                toValue: -width,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.timing(frontCardOpacity, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }),
            // Back card animates into position (fixed timing, not spring)
            Animated.timing(backCardScale, {
                toValue: 1,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.timing(backCardTranslateY, {
                toValue: 0,
                duration: 250,
                useNativeDriver: true,
            }),
            Animated.timing(backCardOpacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start();
        // Note: No callback needed - state already updated!
    }, [currentIndex, tasks.length, frontCardTranslateX, frontCardOpacity, backCardScale, backCardTranslateY, backCardOpacity, onIndexChange]);

    const currentTask = tasks[currentIndex];
    const nextTask = tasks[currentIndex + 1];
    const isLastCard = currentIndex >= tasks.length - 1;

    if (!currentTask) return null;

    return (
        <>
            {/* NEXT CARD (Behind) - Animated entrance */}
            {nextTask && (
                <Animated.View
                    style={[
                        styles.fullCard,
                        {
                            opacity: backCardOpacity,
                            transform: [
                                { scale: backCardScale },
                                { translateY: backCardTranslateY },
                            ],
                        },
                    ]}
                >
                    <TaskCard
                        task={nextTask}
                        index={currentIndex + 1}
                        totalCards={tasks.length}
                        partnerName={partnerName}
                        userName={userName}
                        onSubmit={() => { }}
                        onSkip={() => { }}
                        isLastCard={currentIndex + 1 >= tasks.length - 1}
                        onAnswerSubmit={onAnswerSubmit}
                        isAnswered={!!(userAnswers[currentIndex + 1]?.answer)}
                        previousAnswer={userAnswers[currentIndex + 1]?.answer}
                    />
                </Animated.View>
            )}

            {/* CURRENT CARD (Front) - Animated exit */}
            <Animated.View
                style={[
                    styles.fullCard,
                    {
                        opacity: frontCardOpacity,
                        transform: [{ translateX: frontCardTranslateX }],
                    },
                ]}
            >
                <TaskCard
                    task={currentTask}
                    index={currentIndex}
                    totalCards={tasks.length}
                    partnerName={partnerName}
                    userName={userName}
                    onSubmit={triggerTransition}
                    onSkip={triggerTransition}
                    isLastCard={isLastCard}
                    onAnswerSubmit={onAnswerSubmit}
                    isAnswered={!!(userAnswers[currentIndex]?.answer)}
                    previousAnswer={userAnswers[currentIndex]?.answer}
                />
            </Animated.View>
        </>
    );
};

const styles = StyleSheet.create({
    fullCard: {
        width: width - 32,
        height: height * 0.7,
        borderRadius: 28,
        position: 'absolute',
        overflow: 'hidden',
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
    },
});

export default AnimatedCardStack;
