import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
  AppState,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';

import GradientBackground from '../components/GradientBackground';
import { AnimatedCardStack } from '../components/cards';
import DailyChallengeDoneScreen from './DailyChallengeDoneScreen';
import { colors, spacing, borderRadius } from '../theme';
import { fontFamily } from '../constants/fonts';
import { API_BASE } from '../constants/Api';
import { submitAnswer, getCoupleTodayChallenge } from '../utils/answerApi';
import { useSelector } from 'react-redux';
import { selectUser } from '../store/slices/userSlice';
import { requestReviewForMoment, REVIEW_MOMENTS } from '../utils/inAppReview';
import { translateUiTemplate, translateUiText } from '../i18n/uiTranslation';

const { width, height } = Dimensions.get('window');
const CARD_HEIGHT = height * 0.7;

const mergeTodayRitualState = (streak, updates) => {
  if (!streak) return streak;

  const youComplete = updates.youComplete ?? streak.youComplete ?? false;
  const partnerComplete = updates.partnerComplete ?? streak.partnerComplete ?? false;
  const next = {
    ...streak,
    ...updates,
    youComplete,
    partnerComplete,
    heartState: youComplete && partnerComplete
      ? 'full'
      : youComplete || partnerComplete
        ? 'half'
        : 'empty',
  };

  if (!streak.week?.days) return next;

  return {
    ...next,
    week: {
      ...streak.week,
      days: streak.week.days.map(day => {
        if (!day.isToday) return day;
        return {
          ...day,
          youComplete,
          partnerComplete,
          state: youComplete && partnerComplete
            ? 'full'
            : youComplete || partnerComplete
              ? 'half'
              : 'today-empty',
        };
      }),
    },
  };
};

const restoreSavedAnswers = (todayData) => {
  const tasks = todayData?.challenge?.tasks || [];
  const savedAnswers = todayData?.answers?.answers || [];

  return tasks.map((task, index) => {
    const savedAnswer = savedAnswers[index];
    if (!savedAnswer?.value) return null;

    return {
      taskIndex: index,
      answer: savedAnswer.value,
      task,
      answeredAt: savedAnswer.answeredAt,
    };
  });
};

/* ===================== PROGRESS DOTS ===================== */
const ProgressDots = ({ current, total }) => (
  <View style={styles.progressDotsContainer}>
    {Array.from({ length: total }).map((_, idx) => (
      <View
        key={idx}
        style={[
          styles.progressDot,
          idx < current && styles.progressDotCompleted,
          idx === current && styles.progressDotActive,
        ]}
      />
    ))}
  </View>
);

/* ===================== MAIN SCREEN ===================== */

export default function DailyChallengeScreen({
  partnerName = 'Your Love',
  userName = 'You',
  userAvatar = null,
  partnerAvatar = null,
  userId,
  hasPartner = false,
  initialTodayChallenge = null,
  onLinkPartner = () => { },
  onBack = () => { },
  onCompareWithPartner = () => { }, // New callback for partner comparison
}) {
  const insets = useSafeAreaInsets();
  const userData = useSelector(selectUser);
  const [challenge, setChallenge] = useState(
    () => initialTodayChallenge?.challenge || null
  );
  const [loading, setLoading] = useState(() => !initialTodayChallenge);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState(
    () => restoreSavedAnswers(initialTodayChallenge)
  );
  const [isComplete, setIsComplete] = useState(
    () => Boolean(
      initialTodayChallenge?.answers?.isComplete
      || initialTodayChallenge?.progress?.isComplete
    )
  );
  const [hasReachedEndOfStack, setHasReachedEndOfStack] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [ritualStatus, setRitualStatus] = useState(
    () => initialTodayChallenge?.streak || null
  );
  const [partnerNickname, setPartnerNickname] = useState(null);
  const [initiallyAnsweredTaskIndexes, setInitiallyAnsweredTaskIndexes] = useState(
    () => restoreSavedAnswers(initialTodayChallenge)
      .map((answer, index) => (answer ? index : null))
      .filter(index => index !== null)
  );
  const pendingAnswersRef = useRef(new Map());

  useEffect(() => {
    if (!userId) return undefined;

    let isCancelled = false;

    const fetchPartnerNickname = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/chat/user/${userId}`);
        const json = await response.json();
        const nickname = json.data?.chats?.find(chat => chat?.partner?.nickname)?.partner?.nickname?.trim();

        if (!isCancelled && nickname) {
          setPartnerNickname(nickname);
        }
      } catch (error) {
        // Keep the non-generic partner name fallback when chat metadata is unavailable.
      }
    };

    fetchPartnerNickname();

    return () => {
      isCancelled = true;
    };
  }, [userId]);

  const displayPartnerName = partnerNickname
    || (partnerName?.trim().toLowerCase() === 'user' ? 'Partner' : partnerName)
    || 'Partner';

  const fetchToday = useCallback(async () => {
    try {
      if (!userId) {
        setLoading(false);
        return;
      }

      const json = await getCoupleTodayChallenge(userId);
      const challengeData = json.data?.challenge;

      setChallenge(challengeData || null);
      setRitualStatus(json.data?.streak || null);
      setCurrentIndex(0);
      setHasReachedEndOfStack(false);
      setUserAnswers([]);
      setInitiallyAnsweredTaskIndexes([]);
      pendingAnswersRef.current.clear();
      setIsComplete(false);

      if (json.success && challengeData?._id && json.data?.answers) {
          const savedAnswers = restoreSavedAnswers(json.data);
          setUserAnswers(savedAnswers);
          setInitiallyAnsweredTaskIndexes(
            savedAnswers
              .map((answer, index) => (answer ? index : null))
              .filter(index => index !== null)
          );

          setIsComplete(Boolean(
            json.data.answers.isComplete
            || json.data?.progress?.isComplete
          ));
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setChallenge(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchToday();
  }, [fetchToday]);

  useEffect(() => {
    let mounted = true;
    let previousState = AppState.currentState;

    const subscription = AppState.addEventListener('change', nextState => {
      const returningToForeground =
        (previousState === 'background' || previousState === 'inactive')
        && nextState === 'active';
      previousState = nextState;

      if (!returningToForeground || !userId) return;

      getCoupleTodayChallenge(userId)
        .then(json => {
          if (mounted && json.success) {
            setRitualStatus(json.data?.streak || null);
          }
        })
        .catch(() => {
          // Keep the last known week when foreground refresh is unavailable.
        });
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [userId]);

  useEffect(() => {
    if (!hasPartner && onLinkPartner) {
      onLinkPartner();
    }
  }, [hasPartner, onLinkPartner]);

  const tasks = useMemo(() => challenge?.tasks || [], [challenge?.tasks]);

  // Memoize answered count for performance - MUST be before early returns!
  const answeredCount = useMemo(() =>
    userAnswers.filter(a => a !== undefined && a !== null).length,
    [userAnswers]
  );

  // Keep the live deck stable. Tasks answered during this session stay mounted
  // until the stack advances; only answers restored at load are omitted.
  const challengeDeckTasks = useMemo(() => {
    const initiallyAnswered = new Set(initiallyAnsweredTaskIndexes);
    return tasks
      .map((task, originalIndex) => ({ ...task, originalIndex }))
      .filter(task => !initiallyAnswered.has(task.originalIndex));
  }, [initiallyAnsweredTaskIndexes, tasks]);

  const hasAnsweredAllTasks = tasks.length > 0 && answeredCount >= tasks.length;
  const hasMovedPastVisibleCards =
    tasks.length > 0
    && challengeDeckTasks.length > 0
    && currentIndex >= challengeDeckTasks.length;
  const shouldShowDoneScreen = isComplete || hasAnsweredAllTasks || hasReachedEndOfStack || hasMovedPastVisibleCards;

  useEffect(() => {
    if (shouldShowDoneScreen) {
      requestReviewForMoment(REVIEW_MOMENTS.DAILY_CHALLENGE_COMPLETED);
    }
  }, [shouldShowDoneScreen]);

  // Callback for AnimatedCardStack to update the index
  const handleIndexChange = useCallback((newIndex) => {
    setCurrentIndex(newIndex);
  }, []);

  const handleStackComplete = useCallback(() => {
    setHasReachedEndOfStack(true);
  }, []);

  // Callback to submit answer to backend
  const handleAnswerSubmit = useCallback((taskIndex, answer, answerType = 'text') => {
    const task = tasks[taskIndex];
    pendingAnswersRef.current.set(taskIndex, {
      taskIndex,
      answer,
      answerType,
      task,
      answeredAt: new Date().toISOString(),
    });

    // Submit to backend (store placeholder for progress tracking, actual answer goes to Chat)
    if (!userId || !challenge?._id) {
      console.warn('⚠️ [ANSWER] Cannot submit to server: missing userId');
    } else {
      // Store 'answered' placeholder in DailyAnswers for progress tracking only
      // Actual answer content is stored in Chat model below
      submitAnswer(userId, challenge._id, taskIndex, 'answered', answerType)
        .then(result => {
          if (result.success && result.data?.ritual) {
            setRitualStatus(previous => ({
              ...previous,
              ...result.data.ritual,
              week: result.data.ritual.week || previous?.week,
            }));
            setShowConfetti(true);
          }
        })
        .catch(() => {
          // The local transition should not wait for persistence.
        });
    }

    // Create/update chat thread for this question without blocking the card.
    if (task && userId && challenge?._id) {
      fetch(`${API_BASE}/api/chat/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          questionSource: 'dailychallenge',
          challengeId: challenge._id,
          taskIndex,
          questionText: task.taskstatement,
          questionCategory: task.category,
          answer: typeof answer === 'string' ? answer : JSON.stringify(answer),
          answerType,
        }),
      })
        .then(response => response.json())
        .catch(() => {
          // Don't block answer flow if chat creation fails.
        });
    }

    return true;
  }, [userId, challenge?._id, tasks]);

  const handleAnswerTransitionComplete = useCallback((taskIndex) => {
    const pendingAnswer = pendingAnswersRef.current.get(taskIndex);
    if (!pendingAnswer) return;

    pendingAnswersRef.current.delete(taskIndex);
    setRitualStatus(previous => mergeTodayRitualState(previous, {
      youComplete: true,
    }));
    setUserAnswers(prev => {
      const updated = [...prev];
      updated[taskIndex] = pendingAnswer;

      const answered = updated.filter(answer => answer != null).length;
      if (answered >= tasks.length) {
        setIsComplete(true);
        setShowConfetti(true);
      }

      return updated;
    });
  }, [tasks.length]);

  if (loading) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
        <GradientBackground variant="light" showOrbs={true}>
          <View style={[styles.center, { paddingTop: insets.top }]}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        </GradientBackground>
      </GestureHandlerRootView>
    );
  }

  if (!challenge || tasks.length === 0) {
    return (
      <GestureHandlerRootView style={styles.container}>
        <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
        <GradientBackground variant="light" showOrbs={true}>
          <View style={[styles.center, { paddingTop: insets.top, paddingHorizontal: spacing.lg }]}>
            <Text style={styles.emptyText}>{translateUiText("No Challenge Today")}</Text>
            <TouchableOpacity style={styles.backBtn} onPress={onBack}>
              <Text style={styles.backBtnText}>{translateUiText("← Back Home")}</Text>
            </TouchableOpacity>
          </View>
        </GradientBackground>
      </GestureHandlerRootView>
    );
  }

  // Show done screen when the user has gone through the visible stack.
  // Some cards may be skipped, so this is separate from all questions being answered.
  if (shouldShowDoneScreen) {
    return (
      <DailyChallengeDoneScreen
        userName={userName}
        partnerName={displayPartnerName}
        userAnswers={userAnswers}
        tasks={tasks}
        isComplete={isComplete}
        hasCompletedMyPart={isComplete || hasAnsweredAllTasks || answeredCount >= 1}
        showConfetti={showConfetti}
        streak={ritualStatus}
        onBack={onBack}
        onCompareWithPartner={onCompareWithPartner}
        onRemindPartner={async () => {
          try {
            const response = await fetch(`${API_BASE}/api/daily-challenge/remind`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId }),
            });
            const json = await response.json();

            if (json.success) {
              Alert.alert(
                translateUiText("Reminder Sent!"),
                translateUiTemplate("{{0}} will get a notification 💕", [partnerName]),
              );
            } else {
              Alert.alert(
                translateUiText("Reminder Not Sent"),
                json.message || translateUiText("Could not send reminder"),
              );
            }
          } catch (error) {
            Alert.alert(translateUiText("Error"), translateUiText("Could not send reminder. Try again later."));
          }
        }}
      />
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <GradientBackground variant="light" showOrbs={true}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1 }}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
              <TouchableOpacity onPress={onBack} style={styles.headerBackBtn}>
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                  <Path d="M15 18l-6-6 6-6" stroke={colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              </TouchableOpacity>
              <View style={styles.headerContent}>
                <Text style={styles.headerTitle}>{translateUiText("Today's Challenge")}</Text>
              </View>
              <View style={{ width: 48 }} />
            </View>

            {/* Stable card deck; answers are committed at the visual handoff. */}
            <View style={styles.cardsContainer}>
              <AnimatedCardStack
                tasks={challengeDeckTasks}
                currentIndex={currentIndex}
                partnerName={partnerName}
                userName={userName}
                userAvatar={userData.avatarThumbnail || userData.avatar || userAvatar}
                partnerAvatar={userData.partnerAvatarThumbnail || userData.partnerAvatar || partnerAvatar}
                userId={userId}
                partnerId={userData.partnerId}
                hasPartner={hasPartner}
                onLinkPartner={onLinkPartner}
                onIndexChange={handleIndexChange}
                onComplete={handleStackComplete}
                onAnswerSubmit={handleAnswerSubmit}
                onAnswerTransitionComplete={handleAnswerTransitionComplete}
                challengeId={challenge._id}
                userAnswers={userAnswers}
                autoAdvanceOnSubmit={false}
                totalCardsOverride={tasks.length}
                cardHeight={CARD_HEIGHT}
              />
            </View>
          </View>
        </TouchableWithoutFeedback>
      </GradientBackground>
    </GestureHandlerRootView>
  );
}

/* ===================== STYLES ===================== */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontFamily: fontFamily.bold, fontSize: 18, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.lg },
  backBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  backBtnText: { fontFamily: fontFamily.bold, fontSize: 16, fontWeight: '600', color: '#FFFFFF' },

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
    backgroundColor: 'rgba(255, 255, 255, 0.86)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: '#C084FC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  headerContent: { marginLeft: spacing.md, flex: 1 },
  headerTitle: { fontFamily: fontFamily.extraBold, fontSize: 22, fontWeight: '800', color: colors.text },
  headerSubtitle: { fontFamily: fontFamily.medium, fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  viewAnswersBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.86)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  viewAnswersBtnText: { fontFamily: fontFamily.bold, fontSize: 12, fontWeight: '600', color: colors.text },

  cardsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 28 : 24,
  },

  // Progress Dots
  progressDotsContainer: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    gap: 6,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.borderLight || 'rgba(192, 132, 252, 0.2)',
  },
  progressDotCompleted: {
    backgroundColor: colors.primary || '#FF758F',
  },
  progressDotActive: {
    backgroundColor: colors.primary || '#FF758F',
    width: 20,
  },
});
