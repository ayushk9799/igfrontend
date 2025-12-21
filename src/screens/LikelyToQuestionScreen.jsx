// Comparison Question Screen - "Who is more likely to..." UI
// Features draggable name chips with PanResponder for selecting answers
import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Animated,
    Dimensions,
    PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import GradientBackground from '../components/GradientBackground';
import Button from '../components/Button';
import Card from '../components/Card';
import { colors, spacing, borderRadius } from '../theme';

const { width, height } = Dimensions.get('window');

// Category config for comparison type
const categoryConfig = {
    color: '#FF6B9D',
    emoji: '⚖️',
    gradient: ['#FF6B9D', '#FF8FAB'],
    bgGradient: ['#FFF0F5', '#FFE4EC'],
};

// Avatar size for round avatars
const AVATAR_SIZE = 80;
const DROP_ZONE_Y = 280; // Approximate Y position of drop zone

// Draggable Avatar Component with PanResponder
const DraggableAvatar = ({ name, isYou, isSelected, onDrop, disabled }) => {
    const pan = useRef(new Animated.ValueXY()).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const [isDragging, setIsDragging] = useState(false);

    // Reset position when selection changes
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
            pan.setOffset({
                x: pan.x._value,
                y: pan.y._value,
            });
            pan.setValue({ x: 0, y: 0 });
            Animated.spring(scaleAnim, {
                toValue: 1.15,
                friction: 5,
                useNativeDriver: false, // Must match pan's useNativeDriver
            }).start();
        },
        onPanResponderMove: Animated.event(
            [null, { dx: pan.x, dy: pan.y }],
            { useNativeDriver: false }
        ),
        onPanResponderRelease: (_, gestureState) => {
            pan.flattenOffset();
            setIsDragging(false);

            // Check if dropped in the drop zone (moved up significantly)
            if (gestureState.dy < -80) {
                // Dropped in zone - trigger selection
                onDrop();
                // Animate to center/selected position
                Animated.parallel([
                    Animated.spring(pan, {
                        toValue: { x: 0, y: -120 },
                        friction: 6,
                        useNativeDriver: false,
                    }),
                    Animated.spring(scaleAnim, {
                        toValue: 1.1,
                        friction: 5,
                        useNativeDriver: false, // Must match pan's useNativeDriver
                    }),
                ]).start();
            } else {
                // Spring back to original position
                Animated.parallel([
                    Animated.spring(pan, {
                        toValue: { x: 0, y: 0 },
                        friction: 5,
                        useNativeDriver: false,
                    }),
                    Animated.spring(scaleAnim, {
                        toValue: 1,
                        friction: 5,
                        useNativeDriver: false, // Must match pan's useNativeDriver
                    }),
                ]).start();
            }
        },
    }), [disabled, onDrop, pan, scaleAnim]);

    return (
        <Animated.View
            style={[
                styles.avatarWrapper,
                {
                    transform: [
                        { translateX: pan.x },
                        { translateY: pan.y },
                        { scale: scaleAnim },
                    ],
                    zIndex: isDragging ? 100 : 1,
                },
            ]}
            {...panResponder.panHandlers}
        >
            <View style={[
                styles.avatarOuter,
                isSelected && styles.avatarOuterSelected,
                isDragging && styles.avatarDragging,
            ]}>
                <LinearGradient
                    colors={isSelected ? categoryConfig.gradient : [colors.surface, colors.backgroundAlt]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.avatarGradient}
                />
                <View style={styles.avatarInner}>
                    <Text style={styles.avatarEmoji}>{isYou ? '🙋' : '💕'}</Text>
                </View>
            </View>
            <Text style={[styles.avatarName, isSelected && styles.avatarNameSelected]}>
                {name}
            </Text>
            {isSelected && (
                <View style={styles.selectedIndicator}>
                    <Text style={styles.selectedCheck}>✓</Text>
                </View>
            )}
        </Animated.View>
    );
};

// Drop Zone Component
const DropZone = ({ hasSelection, selectedName }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (!hasSelection) {
            const pulse = Animated.loop(
                Animated.sequence([
                    Animated.timing(scaleAnim, {
                        toValue: 1.03,
                        duration: 1200,
                        useNativeDriver: true,
                    }),
                    Animated.timing(scaleAnim, {
                        toValue: 1,
                        duration: 1200,
                        useNativeDriver: true,
                    }),
                ])
            );
            pulse.start();
            return () => pulse.stop();
        } else {
            // Reset scale when selected
            Animated.spring(scaleAnim, {
                toValue: 1,
                useNativeDriver: true,
            }).start();
        }
    }, [hasSelection, scaleAnim]);

    return (
        <Animated.View
            style={[
                styles.dropZone,
                hasSelection && styles.dropZoneActive,
                {
                    transform: [{ scale: scaleAnim }],
                },
            ]}
        >
            <LinearGradient
                colors={hasSelection ? categoryConfig.bgGradient : [colors.backgroundAlt + '80', colors.surface + '80']}
                style={styles.dropZoneGradient}
            />
            {hasSelection ? (
                <View style={styles.selectedDisplay}>
                    <Text style={styles.selectedText}>
                        {selectedName === 'you' ? '🙋 You!' : `💕 ${selectedName}!`}
                    </Text>
                </View>
            ) : (
                <View style={styles.emptyDropZone}>
                    <Svg width={32} height={32} viewBox="0 0 24 24" fill="none" style={{ marginBottom: 8 }}>
                        <Path
                            d="M12 19V5M5 12l7-7 7 7"
                            stroke={categoryConfig.color}
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </Svg>
                    <Text style={styles.dropHint}>Drag here</Text>
                    <Text style={styles.dropSubhint}>or tap to select</Text>
                </View>
            )}
        </Animated.View>
    );
};

export const ComparisonQuestionScreen = ({
    currentQuestion = {
        id: '1',
        text: "Who is more likely to forget an anniversary?",
        number: 1,
        total: 12,
    },
    partnerName = 'Your Love',
    userName = 'You',
    onSubmitAnswer = () => { },
    onBack = () => { },
}) => {
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;
    const insets = useSafeAreaInsets();

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
            }),
            Animated.spring(slideAnim, {
                toValue: 0,
                tension: 50,
                friction: 10,
                useNativeDriver: true,
            }),
        ]).start();
    }, [fadeAnim, slideAnim]);

    const handleDrop = (who) => {
        if (!hasSubmitted) {
            setSelectedAnswer(who === selectedAnswer ? null : who);
        }
    };

    const handleSubmit = () => {
        if (selectedAnswer) {
            setHasSubmitted(true);
            onSubmitAnswer(selectedAnswer);
        }
    };

    return (
        <GradientBackground variant="warm">
            <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
                {/* Header */}
                <Animated.View
                    style={[
                        styles.header,
                        {
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }],
                        },
                    ]}
                >
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                            <Path
                                d="M15 18l-6-6 6-6"
                                stroke={colors.text}
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </Svg>
                    </TouchableOpacity>
                    <View style={styles.headerContent}>
                        <View style={styles.headerRow}>
                            <Text style={styles.headerTitle}>Who's More Likely</Text>
                            <View style={styles.progressBadge}>
                                <Text style={styles.progressText}>
                                    #{currentQuestion.number}/{currentQuestion.total}
                                </Text>
                            </View>
                        </View>
                        <Text style={styles.headerSubtitle}>Drag your answer up!</Text>
                    </View>
                </Animated.View>

                {/* Question Card */}
                <Animated.View
                    style={[
                        styles.questionCard,
                        {
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }],
                        },
                    ]}
                >
                    <LinearGradient
                        colors={categoryConfig.bgGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.questionGradient}
                    />

                    <Text style={styles.questionText}>"{currentQuestion.text}"</Text>
                </Animated.View>

                {/* Drop Zone */}
                <View style={styles.dropZoneContainer}>
                    <DropZone
                        hasSelection={!!selectedAnswer}
                        selectedName={selectedAnswer === 'you' ? 'you' : partnerName}
                    />
                </View>

                {/* Draggable Avatars */}
                <View style={styles.avatarsContainer}>
                    <DraggableAvatar
                        name={userName}
                        isYou={true}
                        isSelected={selectedAnswer === 'you'}
                        onDrop={() => handleDrop('you')}
                        disabled={hasSubmitted}
                    />
                    <View style={styles.vsContainer}>
                        <Text style={styles.vsText}>VS</Text>
                    </View>
                    <DraggableAvatar
                        name={partnerName}
                        isYou={false}
                        isSelected={selectedAnswer === 'partner'}
                        onDrop={() => handleDrop('partner')}
                        disabled={hasSubmitted}
                    />
                </View>

                {/* Submit Button */}
                {!hasSubmitted && (
                    <Animated.View
                        style={[
                            styles.submitContainer,
                            { opacity: fadeAnim },
                        ]}
                    >
                        <Button
                            title={selectedAnswer ? "Lock In Answer ✨" : "Drag to select"}
                            onPress={handleSubmit}
                            variant="primary"
                            size="lg"
                            fullWidth
                            disabled={!selectedAnswer}
                        />
                    </Animated.View>
                )}

                {/* After Submission */}
                {hasSubmitted && (
                    <View style={styles.submittedSection}>
                        <View style={styles.submittedBadge}>
                            <Text style={styles.submittedIcon}>✓</Text>
                            <Text style={styles.submittedText}>Answer Locked!</Text>
                        </View>

                        <View style={styles.partnerSection}>
                            <Text style={styles.partnerSectionTitle}>{partnerName}'s Answer</Text>
                            <Card variant="glass" padding="lg">
                                <View style={styles.lockedContent}>
                                    <View style={styles.lockIcon}>
                                        <Text style={styles.lockEmoji}>🔒</Text>
                                    </View>
                                    <Text style={styles.lockTitle}>Waiting...</Text>
                                    <Text style={styles.lockText}>
                                        You'll see their answer once they respond
                                    </Text>
                                </View>
                            </Card>
                        </View>
                    </View>
                )}

                {/* Tip */}
                <View style={styles.tipContainer}>
                    <Text style={styles.tipText}>
                        💡 Drag your choice up to the drop zone!
                    </Text>
                </View>
            </View>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: spacing.xl,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    backButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.borderLight,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    headerContent: {
        marginLeft: spacing.md,
        flex: 1,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: colors.text,
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: 4,
    },
    progressBadge: {
        backgroundColor: categoryConfig.color + '20',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.md,
    },
    progressText: {
        fontSize: 12,
        fontWeight: '700',
        color: categoryConfig.color,
    },
    questionCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius['2xl'],
        padding: spacing.xl,
        marginBottom: spacing.lg,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.borderLight,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
    },
    questionGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    categoryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: colors.surface,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
        marginBottom: spacing.md,
        gap: spacing.xs,
    },
    categoryEmoji: {
        fontSize: 14,
    },
    categoryText: {
        fontSize: 11,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    questionText: {
        fontSize: 20,
        fontWeight: '600',
        color: colors.text,
        lineHeight: 30,
        fontStyle: 'italic',
        textAlign: 'center',
    },
    dropZoneContainer: {
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    dropZone: {
        width: width - spacing.xl * 4,
        height: 100,
        borderRadius: borderRadius['2xl'],
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: categoryConfig.color + '40',
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    dropZoneActive: {
        borderColor: categoryConfig.color,
        borderStyle: 'solid',
    },
    dropZoneGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: borderRadius['2xl'],
    },
    emptyDropZone: {
        alignItems: 'center',
    },
    dropHint: {
        fontSize: 16,
        fontWeight: '700',
        color: categoryConfig.color,
    },
    dropSubhint: {
        fontSize: 12,
        color: colors.textMuted,
        marginTop: 2,
    },
    selectedDisplay: {
        alignItems: 'center',
    },
    selectedText: {
        fontSize: 22,
        fontWeight: '800',
        color: categoryConfig.color,
    },
    avatarsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.xl,
        paddingVertical: spacing.md,
    },
    avatarWrapper: {
        alignItems: 'center',
    },
    avatarOuter: {
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        borderRadius: AVATAR_SIZE / 2,
        overflow: 'hidden',
        borderWidth: 3,
        borderColor: colors.borderLight,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 6,
    },
    avatarOuterSelected: {
        borderColor: categoryConfig.color,
        shadowColor: categoryConfig.color,
        shadowOpacity: 0.4,
    },
    avatarDragging: {
        shadowOpacity: 0.3,
        shadowRadius: 20,
    },
    avatarGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    avatarInner: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarEmoji: {
        fontSize: 36,
    },
    avatarName: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.text,
        marginTop: spacing.sm,
        textAlign: 'center',
    },
    avatarNameSelected: {
        color: categoryConfig.color,
    },
    selectedIndicator: {
        position: 'absolute',
        top: -4,
        right: -4,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: categoryConfig.color,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: colors.surface,
    },
    selectedCheck: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    vsContainer: {
        width: 50,
        alignItems: 'center',
        marginHorizontal: spacing.md,
    },
    vsText: {
        fontSize: 16,
        fontWeight: '800',
        color: colors.textMuted,
    },
    submitContainer: {
        marginBottom: spacing.lg,
    },
    submittedSection: {
        marginBottom: spacing.lg,
    },
    submittedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.successSoft,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: borderRadius.xl,
        marginBottom: spacing.lg,
        gap: spacing.sm,
    },
    submittedIcon: {
        fontSize: 16,
        color: colors.success,
    },
    submittedText: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.success,
    },
    partnerSection: {
        marginTop: spacing.sm,
    },
    partnerSectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text,
        marginBottom: spacing.md,
    },
    lockedContent: {
        alignItems: 'center',
        paddingVertical: spacing.md,
    },
    lockIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.backgroundAlt,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    lockEmoji: {
        fontSize: 24,
    },
    lockTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.text,
        marginBottom: spacing.xs,
    },
    lockText: {
        fontSize: 13,
        color: colors.textSecondary,
        textAlign: 'center',
    },
    tipContainer: {
        alignItems: 'center',
        paddingVertical: spacing.sm,
    },
    tipText: {
        fontSize: 13,
        color: colors.textMuted,
        textAlign: 'center',
    },
});

export default ComparisonQuestionScreen;
