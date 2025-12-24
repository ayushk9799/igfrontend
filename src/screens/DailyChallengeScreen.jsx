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
  Image,
  Platform,
  PermissionsAndroid,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import ExpoImageCropTool from 'expo-image-crop-tool';
import { Camera } from 'react-native-camera-kit';

import GradientBackground from '../components/GradientBackground';
import { colors, spacing, borderRadius } from '../theme';
import { API_BASE } from '../constants/Api';

const { width, height } = Dimensions.get('window');
const AVATAR_SIZE = 70;

/* ===================== CATEGORY CONFIG ===================== */

const categoryConfig = {
  likelyto: {
    emoji: '⚖️',
    color: '#FF6B9D',
    bgGradient: ['#FFE8F0', '#FFD0E0', '#FFBAD0', '#FFA5C5'],
    label: 'Who is more likely...',
  },
  neverhaveiever: {
    emoji: '🤫',
    color: '#F4A261',
    bgGradient: ['#FFF4E8', '#FFE8D0', '#FFDBB8', '#FFCEA0'],
    label: 'Never have I ever',
  },
  deep: {
    emoji: '💭',
    color: '#5BB5A6',
    bgGradient: ['#E0F8F4', '#C8F0EA', '#B0E8E0', '#98E0D6'],
    label: 'Deep question',
  },
  takephoto: {
    emoji: '📸',
    color: '#9B59B6',
    bgGradient: ['#F5E6FA', '#EAD0F5', '#DFBAF0', '#D4A4EB'],
    label: 'Capture a moment',
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

const LikelyToCard = React.memo(({ task, index, totalCards, partnerName, userName, onSubmit, onSkip, isLastCard }) => {
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
    <LinearGradient colors={config.bgGradient} style={styles.cardInner}>
      <View style={styles.cardContent}>
        <View style={styles.topRow}>
          <View style={[styles.categoryBadge, { backgroundColor: config.color + '20' }]}>
            <Text>{config.emoji}</Text>
            <Text style={{ color: config.color, fontWeight: '600' }}>{config.label}</Text>
          </View>
          <Text style={styles.counterText}>{index + 1}/{totalCards}</Text>
        </View>

        <View style={styles.questionSection}>
          <Text style={styles.questionText}>"{task.taskstatement}"</Text>
        </View>

        <DropZone
          hasSelection={!!selectedAnswer}
          selectedName={selectedAnswer === 'you' ? 'you' : partnerName}
          categoryColor={config.color}
        />

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

        {locked ? (
          <Text style={styles.waitingText}>Waiting for {partnerName}...</Text>
        ) : (
          <View style={styles.cardButtonsRow}>
            {!isLastCard && (
              <TouchableOpacity onPress={onSkip} style={styles.skipButtonInCard}>
                <Text style={styles.skipTextInCard}>Skip →</Text>
              </TouchableOpacity>
            )}
          </View>
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

const NeverHaveIEverCard = React.memo(({ task, index, totalCards, partnerName, userName, onSubmit, onSkip, isLastCard }) => {
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
    <LinearGradient colors={config.bgGradient} style={styles.cardInner}>
      <View style={styles.cardContent}>
        <View style={styles.topRow}>
          <View style={[styles.categoryBadge, { backgroundColor: config.color + '20' }]}>
            <Text>{config.emoji}</Text>
            <Text style={{ color: config.color, fontWeight: '600' }}>{config.label}</Text>
          </View>
          <Text style={styles.counterText}>{index + 1}/{totalCards}</Text>
        </View>

        <View style={styles.questionSection}>
          <Text style={[styles.prefixText, { color: config.color }]}>Never have I ever...</Text>
          <Text style={styles.questionText}>"{task.taskstatement}"</Text>
        </View>

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

        {locked ? (
          <Text style={styles.waitingText}>Waiting for {partnerName}...</Text>
        ) : (
          <View style={styles.cardButtonsRow}>
            {!isLastCard && (
              <TouchableOpacity onPress={onSkip} style={styles.skipButtonInCard}>
                <Text style={styles.skipTextInCard}>Skip →</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </LinearGradient>
  );
});

/* ===================== DEEP/DEFAULT CARD ===================== */

const DeepCard = React.memo(({ task, index, totalCards, partnerName, userName, onSubmit, onSkip, isLastCard }) => {
  const config = categoryConfig[task.category] || defaultConfig;

  return (
    <LinearGradient colors={config.bgGradient} style={styles.cardInner}>
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

        {!isLastCard && (
          <TouchableOpacity onPress={onSkip} style={styles.skipButtonInCard}>
            <Text style={styles.skipTextInCard}>Skip →</Text>
          </TouchableOpacity>
        )}
      </View>
    </LinearGradient>
  );
});

/* ===================== TAKE PHOTO CARD ===================== */

const TakePhotoCard = React.memo(({ task, index, totalCards, partnerName, userName, onSubmit, onSkip, isLastCard }) => {
  const config = categoryConfig.takephoto;
  const cameraRef = useRef(null);
  const isProcessingRef = useRef(false);
  const [hasPermission, setHasPermission] = useState(Platform.OS === 'ios');
  const [previewUri, setPreviewUri] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setPreviewUri(null);
    setShowCamera(false);
  }, [task._id]);

  const requestCameraPermission = async () => {
    try {
      if (Platform.OS === 'android') {
        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA
        );
        const granted = result === PermissionsAndroid.RESULTS.GRANTED;
        setHasPermission(granted);
        if (!granted) {
          Alert.alert('Permission required', 'Please allow Camera access to take a photo.');
          return false;
        }
        return true;
      }
      return true;
    } catch (e) {
      setHasPermission(false);
      return false;
    }
  };

  const handleOpenCamera = async () => {
    const granted = await requestCameraPermission();
    if (granted) {
      setShowCamera(true);
    }
  };

  const handleCapture = async () => {
    try {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      const data = await cameraRef.current?.capture();
      const source = data?.uri || (data?.path ? `file://${data.path}` : null);
      if (!source) {
        throw new Error('No image captured');
      }

      const cropResult = await ExpoImageCropTool.openCropperAsync({
        imageUri: source,
        shape: 'rectangle',
        format: 'jpeg',
        compressImageQuality: 0.9,
      });

      const out = typeof cropResult === 'string' ? cropResult : cropResult?.uri || cropResult?.path;
      if (!out) throw new Error('Cropping cancelled');
      const finalUri = out.startsWith('file://') ? out : `file://${out}`;

      setPreviewUri(finalUri);
      setShowCamera(false);
    } catch (e) {
      // ignore
    } finally {
      isProcessingRef.current = false;
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission required', 'Please allow gallery access to select a photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
      });

      if (result.cancelled || result.canceled) return;
      const asset = result.assets ? result.assets[0] : result;
      const sourceUri = asset?.uri;
      if (!sourceUri) return;

      const cropResult = await ExpoImageCropTool.openCropperAsync({
        imageUri: sourceUri,
        shape: 'rectangle',
        format: 'jpeg',
        compressImageQuality: 0.9,
      });

      const out = typeof cropResult === 'string' ? cropResult : cropResult?.uri || cropResult?.path;
      if (!out) return;
      const finalUri = out.startsWith('file://') ? out : `file://${out}`;

      setPreviewUri(finalUri);
    } catch (e) {
      // ignore
    }
  };

  const handleRetake = () => {
    setPreviewUri(null);
  };

  const handleUsePhoto = () => {
    if (!previewUri || isSubmitting) return;
    setIsSubmitting(true);
    onSubmit(previewUri);
  };

  // Camera View
  if (showCamera && !previewUri) {
    return (
      <View style={styles.cameraContainer}>
        <Camera
          ref={cameraRef}
          style={styles.camera}
          cameraType={'back'}
          flashMode={'auto'}
          focusMode={'on'}
          zoomMode={'on'}
        />
        <View style={styles.cameraOverlay}>
          <TouchableOpacity onPress={() => setShowCamera(false)} style={styles.cameraBackBtn}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M15 18l-6-6 6-6" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
        </View>
        <View style={styles.cameraBottomBar}>
          <TouchableOpacity onPress={handlePickFromGallery} style={styles.galleryBtn}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleCapture} style={styles.captureBtn}>
            <View style={styles.captureBtnInner} />
          </TouchableOpacity>
          <View style={{ width: 56 }} />
        </View>
      </View>
    );
  }

  return (
    <LinearGradient colors={config.bgGradient} style={styles.cardInner}>
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

        {previewUri ? (
          <>
            <View style={styles.photoPreviewContainer}>
              <Image source={{ uri: previewUri }} style={styles.photoPreview} resizeMode="cover" />
            </View>
            <View style={styles.photoActionsRow}>
              <TouchableOpacity onPress={handleRetake} style={[styles.photoActionBtn, { backgroundColor: colors.borderLight }]}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleUsePhoto}
                style={[styles.photoActionBtn, { backgroundColor: config.color }]}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Use Photo ✨</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <View style={styles.photoOptionsRow}>
              <TouchableOpacity onPress={handleOpenCamera} style={[styles.photoOptionBtn, { borderColor: config.color }]}>
                <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                  <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z" stroke={config.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M12 17a4 4 0 100-8 4 4 0 000 8z" stroke={config.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={[styles.photoOptionText, { color: config.color }]}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handlePickFromGallery} style={[styles.photoOptionBtn, { borderColor: config.color }]}>
                <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                  <Path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" stroke={config.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={[styles.photoOptionText, { color: config.color }]}>Gallery</Text>
              </TouchableOpacity>
            </View>

            {!isLastCard && (
              <TouchableOpacity onPress={onSkip} style={styles.skipButtonInCard}>
                <Text style={styles.skipTextInCard}>Skip →</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </LinearGradient>
  );
});

/* ===================== TASK CARD ROUTER ===================== */

const TaskCard = React.memo(({ task, index, totalCards, partnerName, userName, onSubmit, onSkip, isLastCard }) => {
  if (!task) return null;

  if (task.category === 'likelyto') {
    return (
      <LikelyToCard
        task={task}
        index={index}
        totalCards={totalCards}
        partnerName={partnerName}
        userName={userName}
        onSubmit={onSubmit}
        onSkip={onSkip}
        isLastCard={isLastCard}
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
        onSkip={onSkip}
        isLastCard={isLastCard}
      />
    );
  }

  if (task.category === 'takephoto') {
    return (
      <TakePhotoCard
        task={task}
        index={index}
        totalCards={totalCards}
        partnerName={partnerName}
        userName={userName}
        onSubmit={onSubmit}
        onSkip={onSkip}
        isLastCard={isLastCard}
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
      onSkip={onSkip}
      isLastCard={isLastCard}
    />
  );
});

/* ===================== CARD WRAPPER (No swipe gesture) ===================== */

const CardWrapper = ({ task, index, totalCards, partnerName, userName, onNext, isTop, isLastCard }) => {
  const opacity = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;

  const triggerExit = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: -width,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onNext();
    });
  }, [translateX, opacity, onNext]);

  return (
    <Animated.View
      style={[
        styles.fullCard,
        !isTop && styles.behindCard,
        isTop && { opacity, transform: [{ translateX }] },
      ]}
    >
      <TaskCard
        task={task}
        index={index}
        totalCards={totalCards}
        partnerName={partnerName}
        userName={userName}
        onSubmit={triggerExit}
        onSkip={triggerExit}
        isLastCard={isLastCard}
      />
    </Animated.View>
  );
};

/* ===================== MAIN SCREEN ===================== */

export default function DailyChallengeScreen({
  partnerName = 'Your Love',
  userName = 'You',
  onBack = () => { },
}) {
  const insets = useSafeAreaInsets();
  const [challenge, setChallenge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

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
  const isLastCard = currentIndex >= tasks.length - 1;

  const handleNext = useCallback(() => {
    setCurrentIndex(prev => Math.min(prev + 1, tasks.length - 1));
  }, [tasks.length]);

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

  // Get current and next tasks
  const currentTask = tasks[currentIndex];
  const nextTask = tasks[currentIndex + 1];

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
          <Text style={styles.headerSubtitle}>{currentIndex + 1} of {tasks.length} questions</Text>
        </View>
      </View>

      {/* Cards Stack */}
      <View style={styles.cardsContainer}>
        {/* NEXT CARD (Behind) */}
        {nextTask && (
          <View key={`next-${nextTask._id}`} style={[styles.fullCard, styles.behindCard]}>
            <TaskCard
              task={nextTask}
              index={currentIndex + 1}
              totalCards={tasks.length}
              partnerName={partnerName}
              userName={userName}
              onSubmit={() => { }}
              onSkip={() => { }}
              isLastCard={currentIndex + 1 >= tasks.length - 1}
            />
          </View>
        )}

        {/* CURRENT CARD */}
        <CardWrapper
          key={`current-${currentTask._id}`}
          task={currentTask}
          index={currentIndex}
          totalCards={tasks.length}
          partnerName={partnerName}
          userName={userName}
          onNext={handleNext}
          isTop={true}
          isLastCard={isLastCard}
        />
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

  cardsContainer: { flex: 1, justifyContent: 'flex-start', alignItems: 'center', paddingTop: 20 },

  fullCard: {
    width: width - 32,
    height: 640,
    borderRadius: 28,
    position: 'absolute',
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
  },

  cardInner: {
    flex: 1,
    borderRadius: 28,
    overflow: 'hidden',
  },

  behindCard: {
    transform: [{ scale: 0.94 }, { translateY: -20 }],
    opacity: 0.5,
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

  // Skip button inside card
  cardButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  skipButtonInCard: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignSelf: 'center',
    marginTop: spacing.sm,
  },
  skipTextInCard: {
    fontSize: 16,
    fontWeight: '600',
    color: "white",
  },

  // TakePhoto card styles
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
    borderRadius: 28,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  cameraBackBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  galleryBtn: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  captureBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  captureBtnInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#fff',
  },
  photoOptionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  photoOptionBtn: {
    flex: 1,
    paddingVertical: spacing.xl,
    borderRadius: 20,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  photoOptionText: {
    fontSize: 16,
    fontWeight: '700',
  },
  photoPreviewContainer: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  photoActionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  photoActionBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
