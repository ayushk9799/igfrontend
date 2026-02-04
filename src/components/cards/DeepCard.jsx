import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, Keyboard, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';

import { categoryConfig, defaultConfig } from './categoryConfig';
import { cardStyles } from './cardStyles';
import { spacing } from '../../theme';

/**
 * DeepCard - High-impact text-based card for deep questions and sharing
 */
const DeepCard = React.memo(({ task, index, totalCards, onAnswerSubmit, onSubmit, onSkip, isAnswered = false, previousAnswer = null }) => {
    const [answer, setAnswer] = useState(previousAnswer || '');
    const config = categoryConfig[task.category] || defaultConfig;
    const lastTaskIdRef = useRef(task._id);

    // Reset answer only when task ID actually changes (not during swipe gestures)
    useEffect(() => {
        if (lastTaskIdRef.current !== task._id) {
            lastTaskIdRef.current = task._id;
            setAnswer(isAnswered ? previousAnswer || '' : '');
        }
    }, [task._id, isAnswered, previousAnswer]);

    const handleSubmit = () => {
        if (answer.trim()) {
            console.log('🎯 [DeepCard] Submitting answer:', answer.trim());
            onAnswerSubmit(index, answer.trim());
            Keyboard.dismiss();
            // Trigger card transition after submission
            if (onSubmit) {
                onSubmit(answer.trim());
            }
        }
    };

    return (
        <LinearGradient
            colors={config.bgGradient}
            style={styles.cardContainer}
        >
            {/* Already Answered Overlay */}
            {isAnswered && (
                <View style={cardStyles.answeredOverlay}>
                    <View style={cardStyles.answeredBadge}>
                        <Text style={cardStyles.answeredEmoji}>✅</Text>
                        <Text style={cardStyles.answeredTitle}>Already Answered</Text>
                        <Text style={cardStyles.answeredText}>
                            Your response: "{previousAnswer}"
                        </Text>
                        <Text style={cardStyles.answeredHint}>Swipe to continue →</Text>
                    </View>
                </View>
            )}

            <KeyboardAvoidingView
                style={styles.keyboardAvoid}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 120 : 0}
            >
                <View style={[styles.cardContent, isAnswered && { opacity: 0.3 }]}>
                    {/* Top Header */}
                    <View style={styles.topRow}>
                        <View style={styles.categoryBadge}>
                            <Text style={styles.categoryText}>
                                {config.label}
                            </Text>
                        </View>
                    </View>

                    {/* Question Area */}
                    <View style={styles.questionSection}>
                        <Text style={styles.questionText}>
                            {task.taskstatement}
                        </Text>
                    </View>

                    {/* Response Area with Submit Button inside */}
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.textInput}
                            placeholder="Type your response..."
                            placeholderTextColor="rgba(0, 0, 0, 0.4)"
                            multiline
                            value={answer}
                            onChangeText={setAnswer}
                            blurOnSubmit={false}
                            textAlignVertical="top"
                        />
                        {/* Submit Button inside input */}
                        <TouchableOpacity
                            style={[
                                styles.submitButton,
                                !answer.trim() && styles.submitButtonDisabled
                            ]}
                            onPress={handleSubmit}
                            activeOpacity={0.8}
                            disabled={!answer.trim()}
                        >
                            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                                <Path d="M5 12L10 17L20 7" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                            </Svg>
                            <Text style={styles.submitButtonText}>Submit</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Skip link */}
                    <TouchableOpacity onPress={onSkip} activeOpacity={0.7} style={styles.skipContainer}>
                        <Text style={styles.skipText}>Skip </Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
});

const styles = StyleSheet.create({
    cardContainer: {
        flex: 1,
        borderRadius: 28,
        overflow: 'hidden',
    },
    keyboardAvoid: {
        flex: 1,
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
        marginBottom: spacing.lg,
    },
    categoryBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
    },
    categoryText: {
        color: '#FFFFFF',
        fontWeight: '600',
        fontSize: 14,
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
        marginBottom: spacing.md,
    },
    questionText: {
        fontSize: 24,
        fontWeight: '800',
        color: '#FFFFFF',
        fontStyle: 'italic',
        lineHeight: 32,
    },
    inputContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: spacing.md,
        paddingBottom: 60,
        height: 160,
        marginBottom: spacing.sm,
        borderWidth: 0,
        position: 'relative',
    },
    textInput: {
        color: '#333333',
        fontSize: 16,
        fontWeight: '500',
        flex: 1,
        textAlignVertical: 'top',
    },
    submitButton: {
        position: 'absolute',
        bottom: 12,
        right: 12,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#4CAF50',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 20,
        gap: 6,
    },
    submitButtonDisabled: {
        backgroundColor: 'rgba(76, 175, 80, 0.4)',
    },
    submitButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
    },
    skipContainer: {
        alignItems: 'center',
        paddingVertical: spacing.sm,
    },
    skipText: {
        fontSize: 14,
        fontWeight: '500',
        color: 'rgba(255, 255, 255, 0.6)',
    },
});

export default DeepCard;
