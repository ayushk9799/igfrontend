import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, Keyboard, KeyboardAvoidingView, Platform, StyleSheet, TouchableWithoutFeedback } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';

import { categoryConfig, defaultConfig } from './categoryConfig';
import { spacing } from '../../theme';
import { fontFamily } from '../../constants/fonts';
import { translateUiText } from '../../i18n/uiTranslation';


/**
 * DeepCard - High-impact text-based card for deep questions and sharing
 */
const DeepCard = React.memo(({ task, index, displayIndex, totalCards, hasPartner = false, onLinkPartner, onAnswerSubmit, onSubmit, isAnswered = false, previousAnswer = null, autoAdvanceOnSubmit = true, isLocked = false, onNavigateToPremium = () => { } }) => {
    const [answer, setAnswer] = useState(previousAnswer || '');
    const [isFocused, setIsFocused] = useState(false);
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
        // Block if locked (premium restriction)
        if (isLocked) {
            onNavigateToPremium?.();
            return;
        }

        if (answer.trim()) {
            // Block submission if no partner linked
            if (!hasPartner) {
                onLinkPartner?.();
                return;
            }

            onAnswerSubmit(task.originalIndex ?? index, answer.trim());
            Keyboard.dismiss();
            // Only auto-advance if the parent screen doesn't filter answered tasks
            if (autoAdvanceOnSubmit && onSubmit) {
                onSubmit(answer.trim());
            }
        }
    };

    const getCharCountColor = () => {
        const len = answer.length;
        if (len > 240) return '#FF8A80'; // Critical red/orange
        if (len > 200) return '#FFE082'; // Warning yellow
        return 'rgba(255, 255, 255, 0.65)'; // Normal
    };

    return (
        <LinearGradient
            colors={['#C084FC', '#7C3AED']}
            style={styles.cardContainer}
        >
            <KeyboardAvoidingView
                style={styles.keyboardAvoid}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 140 : 0}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                    <View style={styles.cardContent}>
                    {/* Top Header */}
                    <View style={styles.topRow}>
                        <View style={styles.categoryBadge}>
                            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                                <Path d="M21 12C21 16.42 16.97 20 12 20C10.9 20 9.85 19.82 8.88 19.5L4 21L5.62 16.82C4.6 15.48 4 13.82 4 12C4 7.58 8.03 4 13 4C17.97 4 21 7.58 21 12Z" fill="#8B5CF6" />
                            </Svg>
                            <Text style={styles.categoryText}>{translateUiText(config.label)}</Text>
                        </View>
                    </View>

                    {/* Question Area */}
                    <View style={styles.questionSection}>
                        <Text style={styles.questionText}>
                            {task.taskstatement}
                        </Text>
                    </View>



                    {/* Response Area - fills all remaining space */}
                    <View style={[
                        styles.inputContainer,
                        isFocused && styles.inputContainerFocused
                    ]}>
                        <TextInput
                            style={styles.textInput}
                            placeholder={translateUiText("Type your response...")}
                            placeholderTextColor="rgba(255, 255, 255, 0.5)"
                            multiline
                            value={answer}
                            onChangeText={setAnswer}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                            maxLength={250}
                            blurOnSubmit={false}
                            textAlignVertical="top"
                            selectionColor="#FFFFFF"
                        />
                        <View style={styles.inputFooter}>
                            <Text style={[styles.charCount, { color: getCharCountColor() }]}>
                                {answer.length}/250
                            </Text>
                            {/* Submit Button */}
                            <TouchableOpacity
                                style={[
                                    styles.submitButton,
                                    answer.trim() ? styles.submitButtonActive : styles.submitButtonDisabled
                                ]}
                                onPress={handleSubmit}
                                activeOpacity={0.8}
                                disabled={!answer.trim()}
                            >
                                <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                                    <Path
                                        d="M5 12L10 17L20 7"
                                        stroke={answer.trim() ? "#8B5CF6" : "rgba(255, 255, 255, 0.4)"}
                                        strokeWidth="3.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </Svg>
                                <Text
                                    style={[
                                        styles.submitButtonText,
                                        answer.trim() ? { color: '#8B5CF6' } : styles.submitButtonTextDisabled
                                    ]}
                                >{translateUiText("Submit")}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    </View>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
});

const styles = StyleSheet.create({
    cardContainer: {
        flex: 1,
        borderRadius: 28,
        overflow: 'hidden',
        borderWidth: 6,
        borderColor: 'rgba(255, 255, 255, 0.20)',
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
        marginBottom: spacing.md,
    },
    categoryBadge: {
        backgroundColor: 'rgba(255,255,255,0.12)',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 9,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.22)',
    },
    badgeEmoji: {
        fontSize: 15,
    },
    categoryText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 14,
        fontFamily: fontFamily.bold,
    },
    counterText: {
        color: 'rgba(255,255,255,0.75)',
        fontWeight: '800',
        fontSize: 16,
        fontFamily: fontFamily.bold,
    },
    questionSection: {
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
        marginTop: spacing.sm,
        marginBottom: spacing.sm,
    },
    questionText: {
        fontSize: 24,
        fontWeight: '800',
        color: '#FFFFFF',
        lineHeight: 30,
        textAlign: 'center',
        fontFamily: fontFamily.extraBold,
    },

    inputContainer: {
        flex: 1,
        width: '100%',
        alignSelf: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.10)',
        borderRadius: 24,
        padding: spacing.md,
        paddingBottom: spacing.sm,
        marginBottom: spacing.xs,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.18)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 4,
    },
    inputContainerFocused: {
        backgroundColor: 'rgba(255, 255, 255, 0.16)',
        borderColor: 'rgba(255, 255, 255, 0.5)',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.22,
        shadowRadius: 20,
        elevation: 8,
    },
    textInput: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '500',
        flex: 1,
        textAlignVertical: 'top',
        fontFamily: fontFamily.medium,
    },
    inputFooter: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: spacing.sm,
    },
    charCount: {
        fontSize: 13,
        fontWeight: '700',
        fontFamily: fontFamily.bold,
    },
    submitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderRadius: 22,
        gap: 6,
    },
    submitButtonDisabled: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
    },
    submitButtonActive: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    submitButtonText: {
        fontSize: 14,
        fontWeight: '800',
        fontFamily: fontFamily.bold,
    },
    submitButtonTextDisabled: {
        color: 'rgba(255, 255, 255, 0.4)',
    },
});

export default DeepCard;
