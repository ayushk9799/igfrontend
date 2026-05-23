import React, { useState, useEffect, useRef } from 'react';
import { Image, View, Text, TouchableOpacity, TextInput, Keyboard, KeyboardAvoidingView, Platform, StyleSheet, Animated, Dimensions } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';

import { categoryConfig, defaultConfig } from './categoryConfig';
import { cardStyles } from './cardStyles';
import { spacing } from '../../theme';
import { fontFamily } from '../../constants/fonts';


/**
 * DeepCard - High-impact text-based card for deep questions and sharing
 */
const DeepCard = React.memo(({ task, index, totalCards, hasPartner = false, onLinkPartner, onAnswerSubmit, onSubmit, isAnswered = false, previousAnswer = null, autoAdvanceOnSubmit = true, isLocked = false, onNavigateToPremium = () => { } }) => {
    const [answer, setAnswer] = useState(previousAnswer || '');
    const config = categoryConfig[task.category] || defaultConfig;
    const lastTaskIdRef = useRef(task._id);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const imageOpacity = useRef(new Animated.Value(1)).current;
    const imageHeight = useRef(new Animated.Value(150)).current;
    const scrollViewRef = useRef(null);

    // Reset answer only when task ID actually changes (not during swipe gestures)
    useEffect(() => {
        if (lastTaskIdRef.current !== task._id) {
            lastTaskIdRef.current = task._id;
            setAnswer(isAnswered ? previousAnswer || '' : '');
        }
    }, [task._id, isAnswered, previousAnswer]);

    // Keyboard listeners to collapse image when keyboard opens
    useEffect(() => {
        const showSub = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            () => {
                setKeyboardVisible(true);
                Animated.parallel([
                    Animated.timing(imageOpacity, {
                        toValue: 0,
                        duration: 200,
                        useNativeDriver: false,
                    }),
                    Animated.timing(imageHeight, {
                        toValue: 0,
                        duration: 200,
                        useNativeDriver: false,
                    }),
                ]).start();
            }
        );
        const hideSub = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
            () => {
                setKeyboardVisible(false);
                Animated.parallel([
                    Animated.timing(imageOpacity, {
                        toValue: 1,
                        duration: 250,
                        useNativeDriver: false,
                    }),
                    Animated.timing(imageHeight, {
                        toValue: 150,
                        duration: 250,
                        useNativeDriver: false,
                    }),
                ]).start();
            }
        );
        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    // Track if this card was just submitted
    const [justSubmitted, setJustSubmitted] = useState(false);

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
            setJustSubmitted(true);
            // Only auto-advance if the parent screen doesn't filter answered tasks
            if (autoAdvanceOnSubmit && onSubmit) {
                // Delay swipe to show "Submitted" text first
                setTimeout(() => onSubmit(answer.trim()), 600);
            }
        }
    };

    return (
        <LinearGradient
            colors={['#F8EDFF', '#FFF8FF']}
            style={styles.cardContainer}
        >
            <KeyboardAvoidingView
                style={styles.keyboardAvoid}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 140 : 0}
            >
                <View style={styles.cardContent}>
                    {/* Top Header */}
                    <View style={styles.topRow}>
                        <View style={styles.categoryBadge}>
                            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                                <Path d="M21 12C21 16.42 16.97 20 12 20C10.9 20 9.85 19.82 8.88 19.5L4 21L5.62 16.82C4.6 15.48 4 13.82 4 12C4 7.58 8.03 4 13 4C17.97 4 21 7.58 21 12Z" fill="#8B5CF6" />
                            </Svg>
                            <Text style={styles.categoryText}>{config.label}</Text>
                        </View>
                        <Text style={styles.counterText}>{index + 1} / {totalCards}</Text>
                    </View>

                    {/* Question Area */}
                    <View style={styles.questionSection}>
                        {(isAnswered || justSubmitted) && <Text style={cardStyles.submittedText}>Submitted ✓</Text>}
                        <Text style={styles.questionText}>
                            {task.taskstatement}
                        </Text>
                    </View>

                    {/* Image collapses when keyboard is open */}
                    <Animated.View style={{ height: imageHeight, opacity: imageOpacity, overflow: 'hidden' }}>
                        <Image
                            source={require('../../../assets/daily-cards/deeptalk.png')}
                            style={styles.heroImage}
                            resizeMode="contain"
                        />
                    </Animated.View>

                    {/* Response Area - fills all remaining space */}
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.textInput}
                            placeholder="Type your response..."
                            placeholderTextColor="rgba(0, 0, 0, 0.4)"
                            multiline
                            value={answer}
                            onChangeText={setAnswer}
                            maxLength={250}
                            blurOnSubmit={false}
                            textAlignVertical="top"
                        />
                        <View style={styles.inputFooter}>
                            <Text style={styles.charCount}>{answer.length}/250</Text>
                            {/* Submit Button */}
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
                    </View>

                    {!keyboardVisible && (
                        <View style={styles.swipeHint}>
                            <Text style={styles.swipeText}>Swipe to see next</Text>
                            <View style={styles.swipeDot}>
                                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                                    <Path d="M9 18L15 12L9 6" stroke="#9B6BE8" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                                </Svg>
                            </View>
                        </View>
                    )}
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
        borderWidth: 1,
        borderColor: '#DEC8FF',
        shadowColor: '#B794F4',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.20,
        shadowRadius: 22,
        elevation: 10,
        marginRight: 10,
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
        backgroundColor: 'rgba(255,255,255,0.82)',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingVertical: 9,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#EFE1FF',
    },
    categoryText: {
        color: '#8B5CF6',
        fontWeight: '800',
        fontSize: 14,
        fontFamily: fontFamily.bold,
    },
    counterText: {
        color: '#17204D',
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
        color: '#14245A',
        lineHeight: 32,
        textAlign: 'center',
        fontFamily: fontFamily.extraBold,
    },
    heroImage: {
        alignSelf: 'center',
        width: '88%',
        height: '100%',
    },
    inputContainer: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: spacing.md,
        paddingBottom: spacing.md,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: '#F0E3FF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.16,
        shadowRadius: 18,
        elevation: 8,
    },
    textInput: {
        color: '#17204D',
        fontSize: 16,
        fontWeight: '500',
        flex: 1,
        textAlignVertical: 'top',
        fontFamily: fontFamily.medium,
    },
    inputFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: spacing.sm,
    },
    charCount: {
        color: '#A69BB8',
        fontSize: 13,
        fontWeight: '700',
        fontFamily: fontFamily.bold,
    },
    submitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#A970E8',
        paddingVertical: 11,
        paddingHorizontal: 18,
        borderRadius: 22,
        gap: 6,
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.24,
        shadowRadius: 12,
        elevation: 7,
    },
    submitButtonDisabled: {
        backgroundColor: 'rgba(169, 112, 232, 0.42)',
    },
    submitButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '700',
        fontFamily: fontFamily.bold,
    },
    swipeHint: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingTop: spacing.xs,
    },
    swipeText: {
        color: '#9B90A6',
        fontSize: 12,
        fontWeight: '700',
        fontFamily: fontFamily.medium,
    },
    swipeDot: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#EFE2FF',
    },
});

export default DeepCard;
