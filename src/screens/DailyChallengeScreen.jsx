// Daily Challenge Screen - Tinder-Style Swipable Cards
// Category-specific interaction patterns directly on cards
import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Dimensions,
    ActivityIndicator,
    Animated,
    PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import GradientBackground from '../components/GradientBackground';
import { colors, spacing, borderRadius } from '../theme';
import { API_BASE } from '../constants/Api';

const { width, height } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.25;
const ROTATION_MULTIPLIER = 0.1;

// Category visual configurations
const categoryConfig = {
    likelyto: {
        emoji: '⚖️',
        color: '#FF6B9D',
        bgGradient: ['#FFF0F5', '#FFE4EC', '#FFD9E4'],
        label: 'Who is more likely...',
    },
    neverhaveiever: {
        emoji: '🤫',
        color: '#F4A261',
        bgGradient: ['#FFF8F0', '#FFF0E0', '#FFE8D0'],
        label: 'Never have I ever',
    },
    deep: {
        emoji: '💭',
        color: '#5BB5A6',
        bgGradient: ['#E8F8F5', '#D0F0EA', '#C0E8E0'],
        label: 'Deep question',
    },
    takephoto: {
        emoji: '📸',
        color: '#BF5AF2',
        bgGradient: ['#F8F0FF', '#EEE0FF', '#E4D0FF'],
        label: 'Take a photo',
    },
};
const defaultConfig = categoryConfig.deep;

// ========== LIKELY TO - Draggable Avatars ==========
const AVATAR_SIZE = 70;

const DraggableAvatar = ({ name, isYou, isSelected, onDrop, disabled, color }) => {
    const pan = useRef(new Animated.ValueXY()).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const [isDragging, setIsDragging] = useState(false);

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
            pan.setOffset({ x: pan.x._value, y: pan.y._value });
            pan.setValue({ x: 0, y: 0 });
            Animated.spring(scaleAnim, {
                toValue: 1.15,
                friction: 5,
                useNativeDriver: false,
            }).start();
        },
        onPanResponderMove: Animated.event(
            [null, { dx: pan.x, dy: pan.y }],
            { useNativeDriver: false }
        ),
        onPanResponderRelease: (_, gestureState) => {
            pan.flattenOffset();
            setIsDragging(false);
            if (gestureState.dy < -60) {
                onDrop();
                Animated.parallel([
                    Animated.spring(pan, {
                        toValue: { x: 0, y: -90 },
                        friction: 6,
                        useNativeDriver: false,
                    }),
                    Animated.spring(scaleAnim, {
                        toValue: 1.1,
                        friction: 5,
                        useNativeDriver: false,
                    }),
                ]).start();
            } else {
                Animated.parallel([
                    Animated.spring(pan, {
                        toValue: { x: 0, y: 0 },
                        friction: 5,
                        useNativeDriver: false,
                    }),
                    Animated.spring(scaleAnim, {
                        toValue: 1,
                        friction: 5,
                        useNativeDriver: false,
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
                isSelected && { borderColor: color, shadowColor: color },
                isDragging && styles.avatarDragging,
            ]}>
                <LinearGradient
                    colors={isSelected ? [color, color + 'CC'] : [colors.surface, colors.backgroundAlt]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.avatarGradient}
                />
                <View style={styles.avatarInner}>
                    <Text style={styles.avatarEmoji}>{isYou ? '🙋' : '💕'}</Text>
                </View>
            </View>
            <Text style={[styles.avatarName, isSelected && { color }]}>{name}</Text>
            {isSelected && (
                <View style={[styles.selectedIndicator, { backgroundColor: color }]}>
                    <Text style={styles.selectedCheck}>✓</Text>
                </View>
            )}
        </Animated.View>
    );
};

const DropZone = ({ hasSelection, selectedName, color }) => (
    <View style={[styles.dropZone, hasSelection && { borderColor: color, borderStyle: 'solid' }]}>
        <LinearGradient
            colors={hasSelection ? [color + '20', color + '10'] : ['rgba(0,0,0,0.03)', 'rgba(0,0,0,0.01)']}
            style={styles.dropZoneGradient}
        />
        {hasSelection ? (
            <Text style={[styles.selectedText, { color }]}>
                {selectedName === 'you' ? '🙋 You!' : `💕 ${selectedName}!`}
            </Text>
        ) : (
            <View style={styles.emptyDropZone}>
                <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                    <Path d="M12 19V5M5 12l7-7 7 7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={[styles.dropHint, { color }]}>Drag here</Text>
            </View>
        )}
    </View>
);

// ========== NEVER HAVE I EVER - Choice Cards ==========
const ChoiceCard = ({ choice, isSelected, onPress, color, disabled, gradient }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePress = () => {
        if (disabled) return;
        Animated.sequence([
            Animated.timing(scaleAnim, { toValue: 0.95, duration: 80, useNativeDriver: true }),
            Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 6, useNativeDriver: true }),
        ]).start();
        onPress();
    };

    return (
        <Animated.View style={[styles.choiceWrapper, { transform: [{ scale: scaleAnim }] }]}>
            <TouchableOpacity
                style={[styles.choiceCard, isSelected && styles.choiceCardSelected]}
                onPress={handlePress}
                activeOpacity={0.9}
                disabled={disabled}
            >
                <LinearGradient
                    colors={isSelected ? gradient : ['#FFFFFF', '#FAFAFA']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.choiceGradient}
                />
                <View style={[styles.decorativeCircle, { backgroundColor: (isSelected ? '#FFFFFF' : color) + '15' }]} />
                <Text style={[styles.choiceText, isSelected && styles.choiceTextSelected]}>{choice}</Text>
                {isSelected && (
                    <View style={styles.choiceSelectedBadge}>
                        <Text style={styles.choiceSelectedCheck}>✓</Text>
                    </View>
                )}
            </TouchableOpacity>
        </Animated.View>
    );
};

// ========== MAIN TASK CARD ==========
const TaskCard = ({ task, index, totalCards, partnerName, userName, onComplete, onAutoSwipe, translateX, isTop }) => {
    // HOOKS MUST BE CALLED UNCONDITIONALLY
    const config = task ? (categoryConfig[task.category] || defaultConfig) : defaultConfig;
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [isSubmitted, setIsSubmitted] = useState(false);

    // Early return AFTER hooks
    if (!task) return null;

    const handleSelect = (answer) => {
        if (!isSubmitted) setSelectedAnswer(answer === selectedAnswer ? null : answer);
    };

    const handleSubmit = () => {
        if (selectedAnswer && !isSubmitted) {
            setIsSubmitted(true);
            onComplete?.(task, selectedAnswer);
            // Auto-swipe to next after 1 second
            if (index < totalCards - 1) {
                setTimeout(() => {
                    onAutoSwipe?.();
                }, 1000);
            }
        }
    };

    // Render category-specific UI
    const renderInteraction = () => {
        switch (task.category) {
            case 'likelyto':
                return (
                    <View style={styles.likelyToContainer}>
                        <DropZone
                            hasSelection={!!selectedAnswer}
                            selectedName={selectedAnswer === 'you' ? 'you' : partnerName}
                            color={config.color}
                        />
                        <View style={styles.avatarsRow}>
                            <DraggableAvatar
                                name={userName}
                                isYou={true}
                                isSelected={selectedAnswer === 'you'}
                                onDrop={() => handleSelect('you')}
                                disabled={isSubmitted}
                                color={config.color}
                            />
                            <View style={styles.vsContainer}>
                                <Text style={styles.vsText}>VS</Text>
                            </View>
                            <DraggableAvatar
                                name={partnerName}
                                isYou={false}
                                isSelected={selectedAnswer === 'partner'}
                                onDrop={() => handleSelect('partner')}
                                disabled={isSubmitted}
                                color={config.color}
                            />
                        </View>
                    </View>
                );

            case 'neverhaveiever':
                const neverChoices = [
                    { label: 'I have', gradient: ['#FF6B9D', '#FF8FAB'] },
                    { label: 'Never', gradient: ['#5BB5A6', '#8DD5C7'] },
                ];
                return (
                    <View style={styles.neverContainer}>
                        <Text style={styles.answerLabel}>Your confession:</Text>
                        <View style={styles.choicesRow}>
                            {neverChoices.map((choice) => (
                                <ChoiceCard
                                    key={choice.label}
                                    choice={choice.label}
                                    isSelected={selectedAnswer === choice.label}
                                    onPress={() => handleSelect(choice.label)}
                                    color={choice.gradient[0]}
                                    gradient={choice.gradient}
                                    disabled={isSubmitted}
                                />
                            ))}
                        </View>
                    </View>
                );

            default:
                const defaultChoices = task.options?.length > 0 ? task.options : ['Yes', 'No'];
                return (
                    <View style={styles.defaultContainer}>
                        <Text style={styles.answerLabel}>Your answer:</Text>
                        <View style={styles.choicesRow}>
                            {defaultChoices.map((choice) => (
                                <ChoiceCard
                                    key={choice}
                                    choice={choice}
                                    isSelected={selectedAnswer === choice}
                                    onPress={() => handleSelect(choice)}
                                    color={config.color}
                                    gradient={[config.color, config.color + 'CC']}
                                    disabled={isSubmitted}
                                />
                            ))}
                        </View>
                    </View>
                );
        }
    };

    // Calculate rotation based on translateX for Tinder effect
    const rotate = translateX.interpolate({
        inputRange: [-width, 0, width],
        outputRange: ['-15deg', '0deg', '15deg'],
        extrapolate: 'clamp',
    });

    return (
        <Animated.View
            style={[
                styles.fullCard,
                isTop && {
                    transform: [
                        { translateX },
                        { rotate },
                    ],
                },
            ]}
        >
            <LinearGradient colors={config.bgGradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.cardGradient} />

            {/* Decorative circles */}
            <View style={[styles.decorativeCircleLarge, { backgroundColor: config.color + '12' }]} />
            <View style={[styles.decorativeCircleSmall, { backgroundColor: config.color + '08' }]} />

            <View style={styles.cardContent}>
                {/* Top Badge */}
                <View style={styles.topRow}>
                    <View style={[styles.categoryBadge, { backgroundColor: config.color + '20' }]}>
                        <Text style={styles.categoryEmoji}>{config.emoji}</Text>
                        <Text style={[styles.categoryLabel, { color: config.color }]}>{config.label}</Text>
                    </View>
                    <Text style={styles.cardCounter}>{index + 1}/{totalCards}</Text>
                </View>

                {/* Question */}
                <View style={styles.questionSection}>
                    <Text style={styles.questionText}>{task.taskstatement}</Text>
                </View>

                {/* Category-specific interaction */}
                {!isSubmitted ? (
                    <>
                        {renderInteraction()}
                        <TouchableOpacity
                            style={[styles.submitBtn, { backgroundColor: selectedAnswer ? config.color : colors.borderLight }]}
                            onPress={handleSubmit}
                            disabled={!selectedAnswer}
                        >
                            <Text style={[styles.submitBtnText, { color: selectedAnswer ? '#FFF' : colors.textMuted }]}>
                                {selectedAnswer ? 'Lock In ✨' : 'Select to continue'}
                            </Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <View style={styles.submittedBox}>
                        <View style={[styles.submittedBadge, { backgroundColor: config.color + '20' }]}>
                            <Text style={styles.submittedIcon}>✓</Text>
                            <Text style={[styles.submittedText, { color: config.color }]}>Locked!</Text>
                        </View>
                        <Text style={styles.waitingText}>Waiting for {partnerName}...</Text>
                    </View>
                )}

                {/* Swipe hint */}
                {totalCards > 1 && (
                    <Text style={styles.swipeHint}>← Swipe to see more →</Text>
                )}
            </View>
        </Animated.View>
    );
};

// ========== MAIN SCREEN ==========
export const DailyChallengeScreen = ({
    partnerName = 'Your Love',
    userName = 'You',
    onBack = () => { },
}) => {
    const insets = useSafeAreaInsets();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const translateX = useRef(new Animated.Value(0)).current;

    const [challenge, setChallenge] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(0);

    const currentIndexRef = useRef(currentIndex);
    const tasksRef = useRef([]);

    useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);
    useEffect(() => { tasksRef.current = challenge?.tasks || []; }, [challenge]);

    const panResponder = useMemo(() => PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 15 && Math.abs(g.dy) < 80,
        onPanResponderMove: (_, g) => translateX.setValue(g.dx * 0.9),
        onPanResponderRelease: (_, g) => {
            const tasks = tasksRef.current;
            const idx = currentIndexRef.current;
            if (g.dx < -SWIPE_THRESHOLD && idx < tasks.length - 1) {
                Animated.spring(translateX, { toValue: -width * 1.2, tension: 40, friction: 8, useNativeDriver: true }).start(() => {
                    setCurrentIndex(prev => prev + 1);
                    translateX.setValue(0);
                });
            } else if (g.dx > SWIPE_THRESHOLD && idx > 0) {
                Animated.spring(translateX, { toValue: width * 1.2, tension: 40, friction: 8, useNativeDriver: true }).start(() => {
                    setCurrentIndex(prev => prev - 1);
                    translateX.setValue(0);
                });
            } else {
                Animated.spring(translateX, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }).start();
            }
        },
    }), [translateX]);

    useEffect(() => { fetchTodaysChallenge(); }, []);
    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }, [fadeAnim]);

    const fetchTodaysChallenge = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await fetch(`${API_BASE}/api/daily-challenge/today`);
            const result = await response.json();
            if (result.success && result.data) setChallenge(result.data);
            else { setError(result.message || 'No challenge'); setChallenge(null); }
        } catch (err) {
            setError(err.message);
            setChallenge(null);
        } finally {
            setIsLoading(false);
        }
    };

    const handleComplete = useCallback((task, answer) => {
        console.log('Completed:', task._id, answer);
    }, []);

    const handleAutoSwipe = useCallback(() => {
        const tasks = tasksRef.current;
        const idx = currentIndexRef.current;
        if (idx < tasks.length - 1) {
            Animated.spring(translateX, {
                toValue: -width * 1.2,
                tension: 40,
                friction: 8,
                useNativeDriver: true
            }).start(() => {
                setCurrentIndex(prev => prev + 1);
                translateX.setValue(0);
            });
        }
    }, [translateX]);

    const tasks = challenge?.tasks || [];
    const currentTask = tasks[currentIndex];
    const config = currentTask ? (categoryConfig[currentTask.category] || defaultConfig) : defaultConfig;

    if (isLoading) {
        return (
            <GradientBackground variant="warm">
                <View style={[styles.container, styles.centerContent, { paddingTop: insets.top }]}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>Loading...</Text>
                </View>
            </GradientBackground>
        );
    }

    if (!challenge || error || tasks.length === 0) {
        return (
            <GradientBackground variant="warm">
                <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
                    <TouchableOpacity onPress={onBack} style={[styles.backBtn, { marginLeft: spacing.lg }]}>
                        <Svg width={24} height={24} viewBox="0 0 24 24"><Path d="M15 18l-6-6 6-6" stroke={colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
                    </TouchableOpacity>
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyEmoji}>📭</Text>
                        <Text style={styles.emptyTitle}>No Challenge Today</Text>
                        <Text style={styles.emptyMsg}>{error || 'Check back tomorrow!'}</Text>
                        <TouchableOpacity style={styles.retryBtn} onPress={fetchTodaysChallenge}>
                            <Text style={styles.retryText}>Try Again</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </GradientBackground>
        );
    }

    return (
        <View style={styles.container}>
            <LinearGradient colors={config.bgGradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />

            {/* Header */}
            <Animated.View style={[styles.header, { paddingTop: insets.top + spacing.sm, opacity: fadeAnim }]}>
                <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                    <Svg width={24} height={24} viewBox="0 0 24 24"><Path d="M15 18l-6-6 6-6" stroke={colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
                </TouchableOpacity>
                <View style={styles.headerContent}>
                    <Text style={styles.headerTitle}>{challenge.title || "Today's Challenge"}</Text>
                </View>
                <View style={{ width: 44 }} />
            </Animated.View>

            {/* Card Stack */}
            <View style={[styles.cardStack, { paddingBottom: insets.bottom + 30 }]} {...panResponder.panHandlers}>
                {/* Background card (next) */}
                {currentIndex < tasks.length - 1 && (
                    <View style={[styles.fullCard, styles.behindCard]}>
                        <LinearGradient
                            colors={(categoryConfig[tasks[currentIndex + 1]?.category] || defaultConfig).bgGradient}
                            style={styles.cardGradient}
                        />
                    </View>
                )}
                {/* Top card - key forces remount on task change */}
                {currentTask && (
                    <TaskCard
                        key={`task-${currentIndex}-${currentTask._id || currentIndex}`}
                        task={currentTask}
                        index={currentIndex}
                        totalCards={tasks.length}
                        partnerName={partnerName}
                        userName={userName}
                        onComplete={handleComplete}
                        onAutoSwipe={handleAutoSwipe}
                        translateX={translateX}
                        isTop={true}
                    />
                )}
            </View>

            {/* Pagination */}
            {tasks.length > 1 && (
                <View style={[styles.pagination, { bottom: insets.bottom + 15 }]}>
                    {tasks.map((_, i) => (
                        <View key={i} style={[styles.dot, i === currentIndex && styles.dotActive, i === currentIndex && { backgroundColor: config.color }]} />
                    ))}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    centerContent: { justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: spacing.md, fontSize: 16, color: colors.textSecondary },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl },
    emptyEmoji: { fontSize: 64, marginBottom: spacing.lg },
    emptyTitle: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
    emptyMsg: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl },
    retryBtn: { backgroundColor: colors.primary, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: borderRadius.lg },
    retryText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
    backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.95)', justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
    headerContent: { flex: 1, alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    cardStack: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 70 },
    fullCard: {
        width: width - 32,
        height: height * 0.75,
        borderRadius: 28,
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 15,
        position: 'absolute',
        borderWidth: 2,
        borderColor: 'rgba(0,0,0,0.08)'
    },
    behindCard: { transform: [{ scale: 0.94 }, { translateY: -15 }], opacity: 0.7 },
    cardGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    decorativeCircleLarge: { position: 'absolute', width: 350, height: 350, borderRadius: 175, right: -100, top: -80 },
    decorativeCircleSmall: { position: 'absolute', width: 220, height: 220, borderRadius: 110, left: -70, bottom: -50 },
    cardContent: { flex: 1, padding: spacing.lg, paddingTop: spacing.md },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
    categoryBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, gap: 6 },
    categoryEmoji: { fontSize: 16 },
    categoryLabel: { fontSize: 12, fontWeight: '700' },
    cardCounter: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    questionSection: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.sm, marginVertical: spacing.md },
    questionText: { fontSize: 24, fontWeight: '700', color: colors.text, textAlign: 'center', lineHeight: 34, letterSpacing: -0.3 },
    // LikelyTo styles
    likelyToContainer: { alignItems: 'center' },
    dropZone: { width: width - 80, height: 80, borderRadius: 20, borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(0,0,0,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md, overflow: 'hidden' },
    dropZoneGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    emptyDropZone: { alignItems: 'center' },
    dropHint: { fontSize: 14, fontWeight: '700', marginTop: 4 },
    selectedText: { fontSize: 20, fontWeight: '800' },
    avatarsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm },
    avatarWrapper: { alignItems: 'center' },
    avatarOuter: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, overflow: 'hidden', borderWidth: 3, borderColor: colors.borderLight, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 5 },
    avatarDragging: { shadowOpacity: 0.25, shadowRadius: 16 },
    avatarGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    avatarInner: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    avatarEmoji: { fontSize: 32 },
    avatarName: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 6 },
    selectedIndicator: { position: 'absolute', top: -2, right: -2, width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },
    selectedCheck: { fontSize: 12, fontWeight: '700', color: '#FFF' },
    vsContainer: { width: 40, alignItems: 'center', marginHorizontal: spacing.md },
    vsText: { fontSize: 14, fontWeight: '800', color: colors.textMuted },
    // NeverHaveIEver / Default styles
    neverContainer: { alignItems: 'center' },
    defaultContainer: { alignItems: 'center' },
    answerLabel: { fontSize: 14, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.md },
    choicesRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
    choiceWrapper: { flex: 1 },
    choiceCard: { borderRadius: 18, paddingVertical: 20, borderWidth: 2, borderColor: colors.borderLight, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    choiceCardSelected: { borderColor: 'transparent', shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 6 },
    choiceGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    decorativeCircle: { position: 'absolute', width: 60, height: 60, borderRadius: 30, right: -15, bottom: -15 },
    choiceText: { fontSize: 16, fontWeight: '700', color: colors.text },
    choiceTextSelected: { color: '#FFF' },
    choiceSelectedBadge: { position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.35)', justifyContent: 'center', alignItems: 'center' },
    choiceSelectedCheck: { fontSize: 12, fontWeight: '700', color: '#FFF' },
    submitBtn: { paddingVertical: 14, borderRadius: 24, alignItems: 'center', marginTop: spacing.sm },
    submitBtnText: { fontSize: 15, fontWeight: '700' },
    submittedBox: { alignItems: 'center', paddingVertical: spacing.md },
    submittedBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 18, gap: 6, marginBottom: spacing.sm },
    submittedIcon: { fontSize: 14 },
    submittedText: { fontSize: 14, fontWeight: '700' },
    waitingText: { fontSize: 13, color: colors.textSecondary },
    swipeHint: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: spacing.md },
    pagination: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.12)' },
    dotActive: { width: 22, borderRadius: 4 },
});

export default DailyChallengeScreen;
