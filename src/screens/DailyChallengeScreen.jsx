import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';

import GradientBackground from '../components/GradientBackground';
import { AnimatedCardStack } from '../components/cards';
import DailyChallengeDoneScreen from './DailyChallengeDoneScreen';
import { colors, spacing, borderRadius } from '../theme';
import { API_BASE } from '../constants/Api';
import { submitAnswer, getUserAnswers } from '../utils/answerApi';
import { useSelector } from 'react-redux';
import { selectUser } from '../store/slices/userSlice';

const { width, height } = Dimensions.get('window');
const CARD_HEIGHT = height * 0.7;

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
  onBack = () => { },
  onCompareWithPartner = () => { }, // New callback for partner comparison
}) {
  const insets = useSafeAreaInsets();
  const userData = useSelector(selectUser);
  const [challenge, setChallenge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState([]); // Track local answers
  const [isComplete, setIsComplete] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    fetchToday();
  }, [userId]); // Re-fetch when userId becomes available

  const fetchToday = async () => {
    try {
      // Get user's local date in YYYY-MM-DD format (avoids timezone issues with server's "today")
      const now = new Date();
      const userLocalDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      console.log('📅 Fetching challenge for user\'s local date:', userLocalDate);

      const res = await fetch(`${API_BASE}/api/daily-challenge/date/${userLocalDate}`);
      const json = await res.json();
      setChallenge(json.data);

      // Also fetch user's saved answers if userId is available
      if (userId && json.data?._id) {
        const answersRes = await getUserAnswers(json.data._id, userId);
        if (answersRes.success && answersRes.data) {
          console.log('📥 Fetched saved answers from backend:', answersRes.data);

          // Convert backend format to local format
          const savedAnswers = answersRes.data.answers.map((ans, idx) => {
            if (!ans?.value) return null;
            return {
              taskIndex: idx,
              answer: ans.value,
              task: json.data.tasks[idx],
              answeredAt: ans.answeredAt
            };
          });
          setUserAnswers(savedAnswers);

          // Check if already complete
          if (answersRes.data.isComplete) {
            setIsComplete(true);
          }
        }
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setChallenge(null);
    } finally {
      setLoading(false);
    }
  };

  const tasks = challenge?.tasks || [];

  // Memoize answered count for performance - MUST be before early returns!
  const answeredCount = useMemo(() =>
    userAnswers.filter(a => a !== undefined && a !== null).length,
    [userAnswers]
  );

  // Create filtered list of unanswered tasks with original indices
  // Check if userAnswers[idx] exists and has a truthy answer value
  const unansweredTasks = useMemo(() => {
    return tasks
      .map((task, originalIndex) => ({ ...task, originalIndex }))
      .filter((_, idx) => {
        const hasAnswer = userAnswers[idx] && userAnswers[idx].answer;
        return !hasAnswer;
      });
  }, [tasks, userAnswers]);



  // Callback for AnimatedCardStack to update the index
  const handleIndexChange = useCallback((newIndex) => {
    setCurrentIndex(newIndex);
  }, []);

  // Callback to submit answer to backend
  const handleAnswerSubmit = useCallback(async (taskIndex, answer, answerType = 'text') => {
    console.log('🎯 [ANSWER] Submitting:', { taskIndex, answer, answerType });

    const task = tasks[taskIndex];

    // Delay local state update so user can see "Submitted" text before card is filtered out
    setTimeout(() => {
      setUserAnswers(prev => {
        const updated = [...prev];
        updated[taskIndex] = {
          taskIndex,
          answer,
          answerType,
          task,
          answeredAt: new Date().toISOString()
        };

        // Check if all tasks are answered
        const answered = updated.filter(a => a !== undefined && a !== null).length;
        if (answered >= tasks.length) {
          console.log('🎉 Challenge complete!');
          setIsComplete(true);
          setShowConfetti(true);
        }

        return updated;
      });
    }, 600); // 600ms delay to show "Submitted" text

    // Submit to backend (store placeholder for progress tracking, actual answer goes to Chat)
    if (!userId || !challenge?._id) {
      console.warn('⚠️ [ANSWER] Cannot submit to server: missing userId');
      return;
    }

    try {
      // Store 'answered' placeholder in DailyAnswers for progress tracking only
      // Actual answer content is stored in Chat model below
      const result = await submitAnswer(userId, challenge._id, taskIndex, 'answered', answerType);
      if (result.success) {
        console.log('✅ Progress tracked:', result.data);
      }
    } catch (error) {
      console.error('❌ Submit error:', error);
    }

    // Create/update chat thread for this question
    if (task) {
      try {
        const response = await fetch(`${API_BASE}/api/chat/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            questionSource: 'dailychallenge',
            challengeId: challenge._id,
            taskIndex,
            questionText: task.taskstatement,
            questionCategory: task.category, // 'likelyto', 'neverhaveiever', 'deep', etc.
            answer: typeof answer === 'string' ? answer : JSON.stringify(answer),
            answerType,
          }),
        });
        const json = await response.json();

        if (json.success) {
          console.log('💬 [CHAT] Thread created/updated:', json.data.chatId);
        } else {
          console.log('⚠️ [CHAT] Could not create thread:', json.message);
        }
      } catch (err) {
        console.log('⚠️ [CHAT] API error:', err.message);
        // Don't block answer flow if chat creation fails
      }
    }
  }, [userId, challenge?._id, tasks]);

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

  // Show completion screen ONLY when ALL tasks are complete
  // Also handle edge case where unansweredTasks is empty but isComplete hasn't updated yet
  if (isComplete || (tasks.length > 0 && unansweredTasks.length === 0)) {
    return (
      <DailyChallengeDoneScreen
        partnerName={partnerName}
        userAnswers={userAnswers}
        tasks={tasks}
        isComplete={isComplete}
        showConfetti={showConfetti}
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
              Alert.alert('Reminder Sent!', `${partnerName} will get a notification 💕`);
            } else {
              Alert.alert('Oops', json.message || 'Could not send reminder');
            }
          } catch (error) {
            console.log('❌ Remind error:', error.message);
            Alert.alert('Error', 'Could not send reminder. Try again later.');
          }
        }}
      />
    );
  }
  return (
    <GestureHandlerRootView style={styles.container}>
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
              <Text style={styles.headerTitle}>Today's Challenge</Text>
            </View>
            <View style={{ width: 48 }} />
          </View>

          {/* Cards Stack - Using AnimatedCardStack for smooth transitions */}
          {/* Only show unanswered tasks - already answered ones are filtered out */}
          <View style={[styles.cardsContainer, { paddingBottom: insets.bottom + 80 }]}>
            <AnimatedCardStack
              tasks={unansweredTasks}
              currentIndex={currentIndex}
              partnerName={partnerName}
              userName={userName}
              userAvatar={userData.avatarThumbnail || userData.avatar || userAvatar}
              partnerAvatar={userData.partnerAvatarThumbnail || userData.partnerAvatar || partnerAvatar}
              userId={userId}
              partnerId={userData.partnerId}
              onIndexChange={handleIndexChange}
              onAnswerSubmit={handleAnswerSubmit}
              challengeId={challenge._id}
              userAnswers={userAnswers}
              autoAdvanceOnSubmit={false}
            />
          </View>
        </View>
      </TouchableWithoutFeedback>
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
  viewAnswersBtn: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  viewAnswersBtnText: { fontSize: 12, fontWeight: '600', color: colors.primary },

  cardsContainer: { flex: 1, justifyContent: 'flex-start', alignItems: 'center', paddingTop: spacing.sm, paddingHorizontal: spacing.md },

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
    backgroundColor: colors.borderLight,
  },
  progressDotCompleted: {
    backgroundColor: colors.primary,
  },
  progressDotActive: {
    backgroundColor: colors.primary,
    width: 20,
  },
});

