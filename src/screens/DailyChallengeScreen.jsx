import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  PanResponder,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import ReAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import GradientBackground from '../components/GradientBackground';
import Button from '../components/Button';
import { colors, spacing, borderRadius } from '../theme';
import { API_BASE } from '../constants/Api';

const { width, height } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.25;
const AVATAR_SIZE = 70;

/* ===================== CATEGORY CONFIG ===================== */

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
};

const defaultConfig = categoryConfig.deep;

/* ===================== LIKELY TO CARD ===================== */

const DraggableAvatar = ({ name, isYou, isSelected, onDrop, disabled, categoryColor }) => {
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
          Animated.spring(pan, { toValue: { x: 0, y: -80 }, friction: 6, useNativeDriver: false }),
          Animated.spring(scaleAnim, { toValue: 1.1, friction: 5, useNativeDriver: false }),
        ]).start();
      } else {
        Animated.parallel([
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, friction: 5, useNativeDriver: false }),
          Animated.spring(scaleAnim, { toValue: 1, friction: 5, useNativeDriver: false }),
        ]).start();
      }
    },
  }), [disabled, onDrop, pan, scaleAnim]);

  return (
    <Animated.View
      style={[
        styles.avatarWrapper,
        {
          transform: [{ translateX: pan.x }, { translateY: pan.y }, { scale: scaleAnim }],
          zIndex: isDragging ? 100 : 1,
        },
      ]}
      {...panResponder.panHandlers}
    >
      <View style={[
        styles.avatarOuter,
        isSelected && { borderColor: categoryColor, shadowColor: categoryColor, shadowOpacity: 0.4 },
        isDragging && styles.avatarDragging,
      ]}>
        <LinearGradient
          colors={isSelected ? [categoryColor, categoryColor + 'CC'] : [colors.surface, colors.backgroundAlt]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatarGradient}
        />
        <View style={styles.avatarInner}>
          <Text style={styles.avatarEmoji}>{isYou ? '🙋' : '💕'}</Text>
        </View>
      </View>
      <Text style={[styles.avatarName, isSelected && { color: categoryColor }]}>{name}</Text>
      {isSelected && (
        <View style={[styles.selectedIndicator, { backgroundColor: categoryColor }]}>
          <Text style={styles.selectedCheck}>✓</Text>
        </View>
      )}
    </Animated.View>
  );
};

const DropZone = ({ hasSelection, selectedName, categoryColor }) => (
  <View style={[styles.dropZone, hasSelection && { borderColor: categoryColor, borderStyle: 'solid' }]}>
    <LinearGradient
      colors={hasSelection ? [categoryColor + '20', categoryColor + '10'] : [colors.backgroundAlt + '80', colors.surface + '80']}
      style={styles.dropZoneGradient}
    />
    {hasSelection ? (
      <Text style={[styles.selectedText, { color: categoryColor }]}>
        {selectedName === 'you' ? '🙋 You!' : `💕 ${selectedName}!`}
      </Text>
    ) : (
      <View style={styles.emptyDropZone}>
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Path d="M12 19V5M5 12l7-7 7 7" stroke={categoryColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
        <Text style={[styles.dropHint, { color: categoryColor }]}>Drag here</Text>
      </View>
    )}
  </View>
);

const LikelyToCard = React.memo(({ task, index, totalCards, partnerName, userName, onSubmit }) => {
  const config = categoryConfig.likelyto;
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    setSelectedAnswer(null);
    setLocked(false);
  }, [task._id]);

  const handleDrop = (who) => {
    if (!locked) setSelectedAnswer(who === selectedAnswer ? null : who);
  };

  const handleSubmit = () => {
    if (!selectedAnswer) return;
    setLocked(true);
    onSubmit(selectedAnswer);
  };

  return (
    <LinearGradient colors={config.bgGradient} style={styles.fullCard}>
      <View style={styles.cardContent}>
        <View style={styles.topRow}>
          <View style={[styles.categoryBadge, { backgroundColor: config.color + '20' }]}>
            <Text>{config.emoji}</Text>
            <Text style={{ color: config.color, fontWeight: '600' }}>{config.label}</Text>
          </View>
          <Text style={styles.counterText}>{index + 1}/{totalCards}</Text>
        </View>

        {/* Question */}
        <View style={styles.questionSection}>
          <Text style={styles.questionText}>"{task.taskstatement}"</Text>
        </View>

        {/* Drop Zone */}
        <DropZone
          hasSelection={!!selectedAnswer}
          selectedName={selectedAnswer === 'you' ? 'you' : partnerName}
          categoryColor={config.color}
        />

        {/* Avatars */}
        <View style={styles.avatarsContainer}>
          <DraggableAvatar
            name={userName}
            isYou={true}
            isSelected={selectedAnswer === 'you'}
            onDrop={() => handleDrop('you')}
            disabled={locked}
            categoryColor={config.color}
          />
          <View style={styles.vsContainer}>
            <Text style={styles.vsText}>VS</Text>
          </View>
          <DraggableAvatar
            name={partnerName}
            isYou={false}
            isSelected={selectedAnswer === 'partner'}
            onDrop={() => handleDrop('partner')}
            disabled={locked}
            categoryColor={config.color}
          />
        </View>

        {/* Submit */}
        {!locked ? (
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: selectedAnswer ? config.color : colors.borderLight }]}
            onPress={handleSubmit}
            disabled={!selectedAnswer}
          >
            <Text style={{ color: selectedAnswer ? '#fff' : colors.textMuted, fontWeight: '700' }}>
              Lock In ✨
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.waitingText}>Waiting for {partnerName}...</Text>
        )}
      </View>
    </LinearGradient>
  );
});

/* ===================== NEVER HAVE I EVER CARD ===================== */

const ChoiceButton = ({ choice, isSelected, onPress, disabled }) => {
  const choiceConfig = {
    'I have': { gradient: ['#FF6B9D', '#FF8FAB'], bg: ['#FFF0F5', '#FFE4EC'] },
    'Never': { gradient: ['#5BB5A6', '#8DD5C7'], bg: ['#E8F8F5', '#D0F0EA'] },
  };
  const cfg = choiceConfig[choice] || { gradient: ['#6B7280', '#9CA3AF'], bg: ['#F3F4F6', '#E5E7EB'] };

  return (
    <TouchableOpacity
      style={[styles.choiceCard, isSelected && styles.choiceCardSelected]}
      onPress={() => onPress(choice)}
      activeOpacity={0.9}
      disabled={disabled}
    >
      <LinearGradient
        colors={isSelected ? cfg.gradient : cfg.bg}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.choiceGradient}
      />
      <Text style={[styles.choiceText, isSelected && styles.choiceTextSelected]}>{choice}</Text>
      {isSelected && (
        <View style={styles.choiceSelectedBadge}>
          <Text style={styles.selectedCheck}>✓</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const NeverHaveIEverCard = React.memo(({ task, index, totalCards, partnerName, userName, onSubmit }) => {
  const config = categoryConfig.neverhaveiever;
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [locked, setLocked] = useState(false);

  const options = task.options?.length > 0 ? task.options : ['I have', 'Never'];

  useEffect(() => {
    setSelectedAnswer(null);
    setLocked(false);
  }, [task._id]);

  const handleChoiceSelect = (choice) => {
    if (!locked) setSelectedAnswer(choice === selectedAnswer ? null : choice);
  };

  const handleSubmit = () => {
    if (!selectedAnswer) return;
    setLocked(true);
    onSubmit(selectedAnswer);
  };

  return (
    <LinearGradient colors={config.bgGradient} style={styles.fullCard}>
      <View style={styles.cardContent}>
        <View style={styles.topRow}>
          <View style={[styles.categoryBadge, { backgroundColor: config.color + '20' }]}>
            <Text>{config.emoji}</Text>
            <Text style={{ color: config.color, fontWeight: '600' }}>{config.label}</Text>
          </View>
          <Text style={styles.counterText}>{index + 1}/{totalCards}</Text>
        </View>

        {/* Question */}
        <View style={styles.questionSection}>
          <Text style={[styles.prefixText, { color: config.color }]}>Never have I ever...</Text>
          <Text style={styles.questionText}>"{task.taskstatement}"</Text>
        </View>

        {/* Choice Buttons */}
        <View style={styles.choicesRow}>
          {options.map((choice) => (
            <ChoiceButton
              key={choice}
              choice={choice}
              isSelected={selectedAnswer === choice}
              onPress={handleChoiceSelect}
              disabled={locked}
            />
          ))}
        </View>

        {/* Submit */}
        {!locked ? (
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: selectedAnswer ? config.color : colors.borderLight }]}
            onPress={handleSubmit}
            disabled={!selectedAnswer}
          >
            <Text style={{ color: selectedAnswer ? '#fff' : colors.textMuted, fontWeight: '700' }}>
              Confess! 🤫
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.waitingText}>Waiting for {partnerName}...</Text>
        )}
      </View>
    </LinearGradient>
  );
});

/* ===================== DEEP/DEFAULT CARD ===================== */

const DeepCard = React.memo(({ task, index, totalCards, partnerName, userName, onSubmit }) => {
  const config = categoryConfig[task.category] || defaultConfig;
  const [answer, setAnswer] = useState(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    setAnswer(null);
    setLocked(false);
  }, [task._id]);

  const handleSubmit = () => {
    if (!answer) return;
    setLocked(true);
    onSubmit(answer);
  };

  return (
    <LinearGradient colors={config.bgGradient} style={styles.fullCard}>
      <View style={styles.cardContent}>
        <View style={styles.topRow}>
          <View style={[styles.categoryBadge, { backgroundColor: config.color + '20' }]}>
            <Text>{config.emoji}</Text>
            <Text style={{ color: config.color, fontWeight: '600' }}>{config.label}</Text>
          </View>
          <Text style={styles.counterText}>{index + 1}/{totalCards}</Text>
        </View>

        <View style={styles.questionSection}>
          <Text style={styles.questionText}>{task.taskstatement}</Text>
        </View>

        {!locked ? (
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: answer ? config.color : colors.borderLight }]}
            onPress={handleSubmit}
            disabled={!answer}
          >
            <Text style={{ color: answer ? '#fff' : colors.textMuted, fontWeight: '700' }}>
              Lock In ✨
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.waitingText}>Waiting for {partnerName}...</Text>
        )}
      </View>
    </LinearGradient>
  );
});

/* ===================== TASK CARD ROUTER ===================== */

const TaskCard = React.memo(({ task, index, totalCards, partnerName, userName, onSubmit }) => {
  if (task.category === 'likelyto') {
    return (
      <LikelyToCard
        task={task}
        index={index}
        totalCards={totalCards}
        partnerName={partnerName}
        userName={userName}
        onSubmit={onSubmit}
      />
    );
  }

  if (task.category === 'neverhaveiever') {
    return (
      <NeverHaveIEverCard
        task={task}
        index={index}
        totalCards={totalCards}
        partnerName={partnerName}
        userName={userName}
        onSubmit={onSubmit}
      />
    );
  }

  return (
    <DeepCard
      task={task}
      index={index}
      totalCards={totalCards}
      partnerName={partnerName}
      userName={userName}
      onSubmit={onSubmit}
    />
  );
});

/* ===================== MAIN SCREEN ===================== */

export default function DailyChallengeScreen({
  partnerName = 'Your Love',
  userName = 'You',
  onBack = () => { },
}) {
  const insets = useSafeAreaInsets();
  const [challenge, setChallenge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);

  const translateX = useSharedValue(0);

  useEffect(() => {
    fetchToday();
  }, []);

  const fetchToday = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/daily-challenge/today`);
      const json = await res.json();
      setChallenge(json.data);
    } catch {
      setChallenge(null);
    } finally {
      setLoading(false);
    }
  };

  const tasks = challenge?.tasks || [];
  const currentTask = tasks[index];
  const nextTask = tasks[index + 1];

  const goNext = useCallback(() => {
    setIndex(i => Math.min(i + 1, tasks.length - 1));
  }, [tasks.length]);

  const triggerAutoSwipe = useCallback(() => {
    if (index < tasks.length - 1) {
      translateX.value = withTiming(-width, { duration: 220 }, () => {
        runOnJS(goNext)();
        translateX.value = 0;
      });
    }
  }, [index, tasks.length, translateX, goNext]);

  /* ===================== GESTURE ===================== */

  const gesture = Gesture.Pan()
    .onUpdate(e => {
      translateX.value = e.translationX;
    })
    .onEnd(e => {
      if (e.translationX < -SWIPE_THRESHOLD && index < tasks.length - 1) {
        translateX.value = withTiming(-width, { duration: 220 }, () => {
          runOnJS(goNext)();
          translateX.value = 0;
        });
      } else {
        translateX.value = withTiming(0, { duration: 200 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-width, 0, width],
      [-12, 0, 12]
    );
    return {
      transform: [
        { translateX: translateX.value },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  if (loading) {
    return (
      <GradientBackground variant="warm">
        <View style={[styles.center, { paddingTop: insets.top }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </GradientBackground>
    );
  }

  if (!challenge || tasks.length === 0) {
    return (
      <GradientBackground variant="warm">
        <View style={[styles.center, { paddingTop: insets.top }]}>
          <Text style={styles.emptyText}>No Challenge Today</Text>
          <TouchableOpacity style={styles.backBtn} onPress={onBack}>
            <Text style={styles.backBtnText}>← Back Home</Text>
          </TouchableOpacity>
        </View>
      </GradientBackground>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <TouchableOpacity onPress={onBack} style={styles.headerBackBtn}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Today's Challenge</Text>
          <Text style={styles.headerSubtitle}>Swipe through your questions</Text>
        </View>
      </View>

      {/* Cards Stack */}
      <View style={styles.cardsContainer}>
        {/* NEXT CARD (STATIC BEHIND) */}
        {nextTask && (
          <View style={[styles.fullCard, styles.behindCard]}>
            <TaskCard
              task={nextTask}
              index={index + 1}
              totalCards={tasks.length}
              partnerName={partnerName}
              userName={userName}
              onSubmit={() => { }}
            />
          </View>
        )}

        {/* CURRENT CARD */}
        <GestureDetector gesture={gesture}>
          <ReAnimated.View
            key={currentTask._id}
            style={[styles.fullCard, animatedStyle]}
          >
            <TaskCard
              task={currentTask}
              index={index}
              totalCards={tasks.length}
              partnerName={partnerName}
              userName={userName}
              onSubmit={() => triggerAutoSwipe()}
            />
          </ReAnimated.View>
        </GestureDetector>
      </View>
    </GestureHandlerRootView>
  );
}

/* ===================== STYLES ===================== */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 18, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.lg },
  backBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.surface, borderRadius: borderRadius.lg },
  backBtnText: { fontSize: 16, fontWeight: '600', color: colors.primary },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  headerContent: { marginLeft: spacing.md, flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  headerSubtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },

  cardsContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  fullCard: {
    width: width - 32,
    height: height * 0.72,
    borderRadius: 28,
    position: 'absolute',
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },

  behindCard: {
    transform: [{ scale: 0.94 }, { translateY: -16 }],
    opacity: 0.6,
  },

  cardContent: { flex: 1, padding: spacing.lg },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  categoryBadge: { flexDirection: 'row', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12 },
  counterText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },

  questionSection: { flex: 1, justifyContent: 'center', paddingVertical: spacing.lg },
  prefixText: { fontSize: 16, fontWeight: '600', marginBottom: spacing.xs, textAlign: 'center' },
  questionText: { fontSize: 22, fontWeight: '700', textAlign: 'center', lineHeight: 32, color: colors.text },

  submitBtn: {
    padding: 16,
    borderRadius: 22,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  waitingText: { textAlign: 'center', color: colors.textSecondary, marginTop: spacing.md, fontSize: 15 },

  // Likely To styles
  dropZone: {
    height: 70,
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.borderLight,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  dropZoneGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  emptyDropZone: { alignItems: 'center', gap: 4 },
  dropHint: { fontSize: 14, fontWeight: '700' },
  selectedText: { fontSize: 20, fontWeight: '800' },

  avatarsContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md },
  avatarWrapper: { alignItems: 'center' },
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
  avatarDragging: { shadowOpacity: 0.3, shadowRadius: 20 },
  avatarGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  avatarInner: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  avatarEmoji: { fontSize: 30 },
  avatarName: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: spacing.xs },
  selectedIndicator: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  selectedCheck: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  vsContainer: { width: 40, alignItems: 'center', marginHorizontal: spacing.sm },
  vsText: { fontSize: 14, fontWeight: '800', color: colors.textMuted },

  // Never Have I Ever styles
  choicesRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  choiceCard: {
    flex: 1,
    borderRadius: 20,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.borderLight,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 80,
  },
  choiceCardSelected: { borderColor: 'transparent' },
  choiceGradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  choiceText: { fontSize: 16, fontWeight: '700', color: colors.text },
  choiceTextSelected: { color: '#FFFFFF' },
  choiceSelectedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
