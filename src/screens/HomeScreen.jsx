import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    Image,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
    StatusBar,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { TOPIC_CATEGORIES } from '../constants/Categories';
import { getPenguinMoodImage } from '../constants/PenguinMoods';
import LottieView from 'lottie-react-native';
import { colors } from '../theme';
import { fontFamily, fontWeight } from '../constants/fonts';
import HomeWidgetShowcase from '../components/HomeWidgetShowcase';

const MOOD_STALE_MS = 12 * 60 * 60 * 1000;
const SCRIBBLE_PREVIEW_PADDING = 26;
const SCRIBBLE_PREVIEW_MIN_SIZE = 132;

const getScribblePreviewBox = (paths = []) => {
    const points = [];

    paths.forEach((path) => {
        const matches = path?.d?.matchAll(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi);
        const values = matches ? Array.from(matches, match => Number(match[0])) : [];

        for (let index = 0; index < values.length - 1; index += 2) {
            const x = values[index];
            const y = values[index + 1];

            if (Number.isFinite(x) && Number.isFinite(y)) {
                points.push({ x, y });
            }
        }
    });

    if (points.length === 0) {
        return '0 0 320 220';
    }

    const minX = Math.min(...points.map(point => point.x));
    const maxX = Math.max(...points.map(point => point.x));
    const minY = Math.min(...points.map(point => point.y));
    const maxY = Math.max(...points.map(point => point.y));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const size = Math.max(
        maxX - minX + SCRIBBLE_PREVIEW_PADDING * 2,
        maxY - minY + SCRIBBLE_PREVIEW_PADDING * 2,
        SCRIBBLE_PREVIEW_MIN_SIZE
    );

    return `${centerX - size / 2} ${centerY - size / 2} ${size} ${size}`;
};

const isMoodStale = (mood, now) => {
    if (!mood?.updatedAt) {
        return true;
    }

    const updatedAt = new Date(mood.updatedAt).getTime();
    return Number.isNaN(updatedAt) || now - updatedAt > MOOD_STALE_MS;
};

const getTimeUntilLabel = (targetDate, now) => {
    if (!targetDate) {
        return null;
    }

    const targetTime = new Date(targetDate).getTime();
    if (Number.isNaN(targetTime)) {
        return null;
    }

    const diffMs = targetTime - now;
    if (diffMs <= 0) {
        return 'ending soon';
    }

    const totalMinutes = Math.ceil(diffMs / (60 * 1000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours <= 0) {
        return `${minutes}m left`;
    }

    if (minutes === 0) {
        return `${hours}h left`;
    }

    return `${hours}h ${minutes}m left`;
};

const getHeartSymbol = (heartState) => {
    if (heartState === 'full') return '♥';
    if (heartState === 'half') return '◐';
    return '♡';
};

const HomeText = ({ children, style, ...props }) => (
    <Text {...props} style={[{ fontFamily: fontFamily.regular }, style]} maxFontSizeMultiplier={1.2}>
        {children}
    </Text>
);

const CONNECTION_TOPICS = Object.values(TOPIC_CATEGORIES);

const IconSvg = ({ type, color = '#7867F6', size = 26 }) => {
    const stroke = color;

    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            {type === 'bell' && (
                <Path d="M18 8A6 6 0 006 8C6 15 3 17 3 17H21S18 15 18 8M13.7 21A2 2 0 0110.3 21" stroke={stroke} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
            )}
            {type === 'settings' && (
                <>
                    <Circle cx="12" cy="12" r="3" stroke={stroke} strokeWidth={1.8} />
                    <Path d="M19 12A7 7 0 0018.9 10.8L21 9.1L19 5.7L16.5 6.7A7 7 0 0014.5 5.5L14.1 3H10L9.5 5.5A7 7 0 007.5 6.7L5 5.7L3 9.1L5.1 10.8A7 7 0 005.1 13.2L3 14.9L5 18.3L7.5 17.3A7 7 0 009.5 18.5L10 21H14L14.5 18.5A7 7 0 0016.5 17.3L19 18.3L21 14.9L18.9 13.2A7 7 0 0019 12Z" stroke={stroke} strokeWidth={1.4} strokeLinejoin="round" />
                </>
            )}
            {type === 'video' && (
                <>
                    <Path d="M4.5 7.5A2.5 2.5 0 017 5H14A2.5 2.5 0 0116.5 7.5V16.5A2.5 2.5 0 0114 19H7A2.5 2.5 0 014.5 16.5V7.5Z" stroke={stroke} strokeWidth={1.8} strokeLinejoin="round" />
                    <Path d="M16.5 10L21 7.8V16.2L16.5 14V10Z" stroke={stroke} strokeWidth={1.8} strokeLinejoin="round" />
                </>
            )}
        </Svg>
    );
};

const HeartDoodle = ({ color = '#FF8CAD', size = 28, style }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
        <Path
            d="M12 20.2C8.2 16.7 4.5 13.6 4.5 9.7C4.5 7.6 6 6 8 6C9.3 6 10.6 6.8 11.3 8C12 6.8 13.3 6 14.7 6C16.8 6 18.4 7.6 18.4 9.7C18.4 13.6 15.8 15.4 12 20.2Z"
            stroke={color}
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </Svg>
);

const ArrowCircle = ({ color = '#7762E8' }) => (
    <View style={[styles.cardArrowButton, { backgroundColor: color }]}>
        <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
            <Path
                d="M5 12H18M13 7L18 12L13 17"
                stroke="#FFFFFF"
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </Svg>
    </View>
);

const HomeScreen = ({
    hasPartner = false,
    yourMood = null,
    partnerMood = null,
    partnerScribble = null,
    todayChallenge = null,
    relationshipStartDate = null,
    daysTogether = 0,
    onMoodPress,
    onScribblePress,
    onScribbleLivePress,
    onQuestionPress,
    onFindPartner,
    onSettingsPress,
    onRefreshPuzzle,
    duelBadgeCount = 0,
    onNotificationPress,
    onWidgetsPress,
    onVideoCallPress,
    partnerOnline = false,
}) => {
    const { width } = useWindowDimensions();
    const penguinJiggleAnim = useRef(new Animated.Value(0)).current;
    const badgeWiggleAnim = useRef(new Animated.Value(0)).current;
    const badgePulseAnim = useRef(new Animated.Value(1)).current;
    const playedNudgeKeyRef = useRef(null);
    const onRefreshPuzzleRef = useRef(onRefreshPuzzle);
    const [now, setNow] = useState(Date.now());

    const penguinMoodImage = getPenguinMoodImage(partnerMood?.id, yourMood?.id);
    const scribblePreviewBox = useMemo(
        () => getScribblePreviewBox(partnerScribble?.paths),
        [partnerScribble?.paths]
    );
    const isYourMoodStale = hasPartner && isMoodStale(yourMood, now);
    const isChallengeComplete = todayChallenge?.progress?.isComplete || false;
    const completedCount = todayChallenge?.progress?.completedCount || 0;
    const ritualStreak = todayChallenge?.streak || null;
    const heartState = ritualStreak?.heartState || 'empty';
    const ritualTimeLeft = getTimeUntilLabel(todayChallenge?.closesAt, now);
    const ritualStreakText = ritualStreak?.currentStreak > 0
        ? `${ritualStreak.currentStreak} day streak`
        : 'Start the streak';

    const showNudge = hasPartner && isYourMoodStale;
    const nudgeKey = yourMood?.updatedAt || 'missing-mood';

    let currentTask = null;
    if (todayChallenge?.challenge?.tasks) {
        const tasks = todayChallenge.challenge.tasks;
        const savedAnswers = todayChallenge.answers?.answers || [];
        const firstUnansweredIndex = tasks.findIndex((_, idx) => !savedAnswers[idx]?.value);
        const targetIndex = firstUnansweredIndex !== -1 ? firstUnansweredIndex : completedCount;
        if (targetIndex >= 0 && targetIndex < tasks.length) {
            currentTask = tasks[targetIndex];
        }
    }

    useEffect(() => {
        onRefreshPuzzleRef.current = onRefreshPuzzle;
    }, [onRefreshPuzzle]);

    useEffect(() => {
        onRefreshPuzzleRef.current?.();
    }, []);

    useEffect(() => {
        const timer = setInterval(() => {
            setNow(Date.now());
        }, 60 * 1000);

        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!showNudge) {
            penguinJiggleAnim.setValue(0);
            badgeWiggleAnim.setValue(0);
            badgePulseAnim.setValue(1);
            return undefined;
        }

        if (playedNudgeKeyRef.current === nudgeKey) {
            return undefined;
        }

        let animation;
        const timer = setTimeout(() => {
            penguinJiggleAnim.setValue(0);
            badgeWiggleAnim.setValue(0);
            badgePulseAnim.setValue(1);

            animation = Animated.loop(
                Animated.sequence([
                    Animated.parallel([
                        // Heartbeat pulse for the badge
                        Animated.sequence([
                            Animated.timing(badgePulseAnim, { toValue: 1.12, duration: 250, useNativeDriver: true }),
                            Animated.timing(badgePulseAnim, { toValue: 0.95, duration: 200, useNativeDriver: true }),
                            Animated.timing(badgePulseAnim, { toValue: 1.05, duration: 200, useNativeDriver: true }),
                            Animated.timing(badgePulseAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
                        ]),
                        // Playful wiggle for the badge: tilts left and right
                        Animated.sequence([
                            Animated.timing(badgeWiggleAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
                            Animated.timing(badgeWiggleAnim, { toValue: -1, duration: 140, useNativeDriver: true }),
                            Animated.timing(badgeWiggleAnim, { toValue: 0.8, duration: 120, useNativeDriver: true }),
                            Animated.timing(badgeWiggleAnim, { toValue: -0.8, duration: 120, useNativeDriver: true }),
                            Animated.timing(badgeWiggleAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
                        ]),
                        // Playful jiggle for the penguin: tilts opposite direction, slightly offset
                        Animated.sequence([
                            Animated.delay(100),
                            Animated.timing(penguinJiggleAnim, { toValue: -1, duration: 120, useNativeDriver: true }),
                            Animated.timing(penguinJiggleAnim, { toValue: 1, duration: 140, useNativeDriver: true }),
                            Animated.timing(penguinJiggleAnim, { toValue: -0.7, duration: 120, useNativeDriver: true }),
                            Animated.timing(penguinJiggleAnim, { toValue: 0.7, duration: 120, useNativeDriver: true }),
                            Animated.timing(penguinJiggleAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
                        ])
                    ]),
                    Animated.delay(2000) // Sleep/pause between wiggles
                ]),
                { iterations: 2 }
            );

            animation.start(({ finished }) => {
                if (finished) {
                    playedNudgeKeyRef.current = nudgeKey;
                }
            });
        }, 800);

        return () => {
            clearTimeout(timer);
            if (animation) {
                animation.stop();
            }
        };
    }, [showNudge, nudgeKey, penguinJiggleAnim, badgeWiggleAnim, badgePulseAnim]);

    const penguinRotation = penguinJiggleAnim.interpolate({
        inputRange: [-1, 1],
        outputRange: ['-4deg', '4deg'],
    });

    const penguinTranslateX = penguinJiggleAnim.interpolate({
        inputRange: [-1, 1],
        outputRange: [-4, 4],
    });

    const badgeRotation = badgeWiggleAnim.interpolate({
        inputRange: [-1, 1],
        outputRange: ['-5deg', '5deg'],
    });

    const fullWidthImageStyle = { width };

    return (
        <LinearGradient
            colors={['#F8D9EC', '#FFF7FA', '#FFF4F7', '#F7D8F2']}
            locations={[0, 0.34, 0.72, 1]}
            start={{ x: 0.25, y: 0 }}
            end={{ x: 0.75, y: 1 }}
            style={styles.screenGradient}
        >
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <SafeAreaView style={styles.container} edges={['top']}>
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.header}>
                        <View style={styles.brandContainer}>
                            <Image
                                source={require('../../assets/images/penguin-text-logo.png')}
                                style={styles.brandLogo}
                                resizeMode="contain"
                            />
                        </View>

                        <View style={styles.headerActions}>
                            {hasPartner && (
                                <TouchableOpacity
                                    style={[styles.headerButton, !partnerOnline && styles.offlineHeaderButton]}
                                    onPress={onVideoCallPress}
                                    activeOpacity={0.82}
                                    accessibilityLabel="Start video call"
                                >
                                    <IconSvg type="video" color={partnerOnline ? '#D84F86' : '#A99CA9'} size={22} />
                                    <View style={[styles.presenceDot, partnerOnline ? styles.onlineDot : styles.offlineDot]} />
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity style={styles.headerButton} onPress={onNotificationPress} activeOpacity={0.82}>
                                <IconSvg type="bell" color={colors.text} size={22} />
                                {duelBadgeCount > 0 && (
                                    <View style={styles.badge}>
                                        <Text style={styles.badgeText}>{duelBadgeCount > 9 ? '9+' : duelBadgeCount}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.headerButton} onPress={onSettingsPress} activeOpacity={0.82}>
                                <IconSvg type="settings" color={colors.text} size={22} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={styles.hero}
                        onPress={hasPartner ? onMoodPress : onFindPartner}
                        activeOpacity={0.92}
                    >
                        <View style={styles.heroSparkleOne} />
                        <View style={styles.heroSparkleTwo} />
                        <Animated.View style={[
                            styles.heroImageWrap,
                            fullWidthImageStyle,
                            showNudge && {
                                transform: [
                                    { rotate: penguinRotation },
                                    { translateX: penguinTranslateX },
                                ]
                            }
                        ]}>
                            <Image
                                source={hasPartner ? penguinMoodImage : require('../../assets/penguinmoods/nopartner.png')}
                                style={[styles.heroImage, fullWidthImageStyle]}
                            />
                        </Animated.View>
                        {showNudge && (
                            <Animated.View style={[
                                styles.moodNudgeBadge,
                                {
                                    transform: [
                                        { scale: badgePulseAnim },
                                        { rotate: badgeRotation }
                                    ]
                                }
                            ]}>
                                <HomeText style={styles.moodNudgeText}>
                                    {yourMood?.updatedAt ? 'Mood is old. Tap to refresh 💛' : 'How are you feeling? Tap here 💛'}
                                </HomeText>
                            </Animated.View>
                        )}
                    </TouchableOpacity>

                    <View style={styles.twoColumn}>
                        <TouchableOpacity onPress={onScribblePress} activeOpacity={0.9} style={styles.featureCardPressable}>
                            <LinearGradient
                                colors={['#EFE4FF', '#FAF3FF', '#F3E6FF']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={[styles.featureMiniCard, styles.canvasCard]}
                            >
                                <View style={styles.featureCardHeader}>
                                    <View style={styles.cardTitleRow}>
                                        <HomeText style={[styles.smallCardTitle, styles.scribbleCardTitle]}>Canvas board</HomeText>
                                        <HeartDoodle style={styles.cardTitleHeart} color="#FF8BB8" size={18} />
                                    </View>
                                </View>

                                <View style={styles.scribblePaper}>
                                  
                                    {partnerScribble?.paths?.length > 0 ? (
                                        <Svg
                                            width="100%"
                                            height="100%"
                                            viewBox={scribblePreviewBox}
                                            preserveAspectRatio="xMidYMid meet"
                                            style={styles.partnerScribblePreview}
                                        >
                                            {partnerScribble.paths.slice(0, 200).map((path, index) => (
                                                <Path
                                                    key={`${path.d}-${index}`}
                                                    d={path.d}
                                                    stroke={path.color}
                                                    strokeWidth={path.strokeWidth || 4}
                                                    fill="none"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                            ))}
                                        </Svg>
                                    ) : (
                                        <>
                                            <LottieView
                                                source={require('../../assets/canvas.lottie')}
                                                autoPlay
                                                loop
                                                style={styles.scribbleLottie}
                                            />
                                        </>
                                    )}
                                  
                                </View>
                                <ArrowCircle color="#7962E6" />

                            </LinearGradient>
                        </TouchableOpacity>

                        {isChallengeComplete ? (
                            <TouchableOpacity onPress={() => onQuestionPress?.()} activeOpacity={0.9} style={styles.featureCardPressable}>
                                <LinearGradient
                                    colors={['#FFEFEF', '#FFF7F4', '#FFE1E3']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={[styles.featureMiniCard, styles.streakCard, styles.completedStreakCard]}
                                >
                                    <View style={styles.featureCardHeader}>
                                        <View style={styles.cardTitleRowBetween}>
                                            <View style={styles.cardTitleRow}>
                                                <HomeText style={[styles.smallCardTitle, styles.ritualCardTitle]}>Daily Ritual</HomeText>
                                                <HomeText style={styles.ritualHeartStatus}>{getHeartSymbol(heartState)}</HomeText>
                                            </View>
                                            <HomeText style={styles.ritualStreakBadge}>{ritualStreakText}</HomeText>
                                        </View>
                                    </View>
                                    <View style={[styles.ritualPaper, styles.completedRitualPaper]}>
                                        <View style={styles.paperTape} />
                                        <HomeText style={styles.ritualQuestion} numberOfLines={3}>
                                            {heartState === 'full'
                                                ? `Both done today. ${ritualTimeLeft || 'Next ritual soon'}`
                                                : `You finished. Waiting for partner. ${ritualTimeLeft || ''}`}
                                        </HomeText>
                                    </View>
                                    <ArrowCircle color="#FF4568" />
                                </LinearGradient>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity onPress={() => onQuestionPress?.()} activeOpacity={0.9} style={styles.featureCardPressable}>
                                <LinearGradient
                                    colors={['#FFEFEF', '#FFF7F4', '#FFE1E3']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={[styles.featureMiniCard, styles.streakCard]}
                                >
                                    <View style={styles.featureCardHeader}>
                                        <View style={styles.cardTitleRowBetween}>
                                            <View style={styles.cardTitleRow}>
                                                <HomeText style={[styles.smallCardTitle, styles.ritualCardTitle]}>Daily Ritual</HomeText>
                                                <HomeText style={styles.ritualHeartStatus}>{getHeartSymbol(heartState)}</HomeText>
                                            </View>
                                            <HomeText style={styles.ritualStreakBadge}>{ritualStreakText}</HomeText>
                                        </View>
                                    </View>
                                    <View style={styles.ritualPaper}>
                                        <View style={styles.paperTape} />
                                        {ritualStreak?.partnerComplete ? (
                                            <View style={styles.challengePromptContainer}>
                                                <HomeText style={styles.ritualQuestion} numberOfLines={3}>
                                                    Partner finished. Your turn to make it full heart.
                                                </HomeText>
                                            </View>
                                        ) : currentTask ? (
                                            <View style={styles.challengePromptContainer}>
                                                <HomeText style={styles.ritualQuestion} numberOfLines={3}>
                                                    {currentTask.taskstatement}
                                                </HomeText>
                                            </View>
                                        ) : (
                                            <View style={styles.challengePromptContainer}>
                                                <HomeText style={styles.ritualQuestion} numberOfLines={3}>
                                                    Tap to answer today's questions 
                                                </HomeText>
                                            </View>
                                        )}
                                        <HeartDoodle style={styles.ritualPaperHeartOne} color="#FF9BB5" size={16} />
                                        <HeartDoodle style={styles.ritualPaperHeartTwo} color="#FF9BB5" size={13} />
                                    </View>
                                    <ArrowCircle color="#FF4568" />
                                </LinearGradient>
                            </TouchableOpacity>
                        )}
                    </View>

                    <TouchableOpacity onPress={onScribbleLivePress || onScribblePress} activeOpacity={0.9} style={styles.liveDrawPressable}>
                        <View style={styles.liveDrawCard}>
                            <LinearGradient
                                colors={['#1B1237', '#4B2E83', '#EC7AB7']}
                                locations={[0, 0.56, 1]}
                                start={{ x: 0.05, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.liveDrawGradient}
                                pointerEvents="none"
                            />
                            <View style={styles.liveDrawStars}>
                                <View style={[styles.liveDrawStar, styles.liveDrawStarOne]} />
                                <View style={[styles.liveDrawStar, styles.liveDrawStarTwo]} />
                                <View style={[styles.liveDrawStar, styles.liveDrawStarThree]} />
                            </View>
                            <View style={styles.liveDrawIcon}>
                                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                                    <Path
                                        d="M6.5 21A3.5 3.5 0 1 0 3 17.5a2.62 2.62 0 0 1-.708 1.792A1 1 0 0 0 3 21z"
                                        stroke="#FFFFFF"
                                        strokeWidth={2}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                    <Path
                                        d="M9.969 17.031 21.378 5.624a1 1 0 0 0-3.002-3.002L6.967 14.031"
                                        stroke="#FFFFFF"
                                        strokeWidth={2}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </Svg>
                            </View>
                            <View style={styles.liveDrawCopy}>
                                <HomeText style={styles.liveDrawTitle}>Draw Live</HomeText>
                                <HomeText style={styles.liveDrawSubtitle}>
                                    Open the shared live canvas
                                </HomeText>
                            </View>
                            <View style={styles.liveDrawArrow}>
                                <Svg width={19} height={19} viewBox="0 0 24 24" fill="none">
                                    <Path
                                        d="M5 12H18M13 7L18 12L13 17"
                                        stroke="#FFFFFF"
                                        strokeWidth={2.4}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </Svg>
                            </View>
                        </View>
                    </TouchableOpacity>

                    <View style={styles.widgetsSectionHeader}>
                        <HomeText style={styles.sectionTitle}>Widgets</HomeText>
                    </View>
                    <HomeWidgetShowcase
                        onPress={onWidgetsPress}
                        relationshipStartDate={relationshipStartDate}
                        daysTogether={daysTogether}
                    />

                    <View style={styles.sectionHeader}>
                        <HomeText style={styles.sectionTitle}>Deepen your connection</HomeText>
                    </View>
                    <View style={styles.topicGrid}>
                        {CONNECTION_TOPICS.map((topic) => (
                            <TouchableOpacity
                                key={topic.id}
                                style={styles.topicPressable}
                                onPress={() => onQuestionPress?.(TOPIC_CATEGORIES[topic.id])}
                                activeOpacity={0.88}
                            >
                                <LinearGradient
                                    colors={topic.gradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.topicCard}
                                >
                                    {topic.image ? (
                                        <Image source={topic.image} style={styles.topicImage} />
                                    ) : (
                                        <View style={styles.topicEmojiBadge}>
                                            <HomeText style={styles.topicEmoji}>{topic.emoji}</HomeText>
                                        </View>
                                    )}
                                    <View style={styles.topicCopy}>
                                        <HomeText style={[styles.topicTitle, { color: topic.textColor }]} numberOfLines={1}>{topic.title}</HomeText>
                                        <HomeText style={[styles.topicSubtitle, { color: topic.textColor }]} numberOfLines={2}>{topic.subtitle}</HomeText>
                                    </View>
                                </LinearGradient>
                            </TouchableOpacity>
                        ))}
                    </View>

                </ScrollView>
            </SafeAreaView>
        </LinearGradient>
    );
};

const cardShadow = Platform.select({
    ios: {
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 18,
    },
    android: {
        elevation: 5,
    },
});

const styles = StyleSheet.create({
    screenGradient: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 112,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 8,
        marginBottom: 18,
        zIndex: 10,
    },
    brandContainer: {
        flexDirection: 'column',
        alignItems: 'flex-start',

    },
    brandLogo: {
        width: 135,
        height: 40,
        marginLeft: -12,
    },
    headerActions: {
        flexDirection: 'row',
        gap: 8,
    },
    headerButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.86)',
        borderWidth: 1,
        borderColor: '#F7DDEA',
        ...cardShadow,
    },
    offlineHeaderButton: {
        opacity: 0.78,
    },
    presenceDot: {
        position: 'absolute',
        right: 3,
        bottom: 3,
        width: 9,
        height: 9,
        borderRadius: 5,
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
    },
    onlineDot: {
        backgroundColor: '#42B883',
    },
    offlineDot: {
        backgroundColor: '#B8ADB7',
    },
    badge: {
        position: 'absolute',
        top: -3,
        right: -2,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FF758F',
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
    },
    badgeText: {
        color: '#FFFFFF',
        fontSize: 9,
        fontWeight: fontWeight('900'),
        fontFamily: fontFamily.extraBold,
    },
    hero: {
        height: 220,
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginTop: 0,
        marginBottom: -2,
        marginHorizontal: -20,
        overflow: 'visible',
    },
    heroImage: {
        height: 260,
        resizeMode: 'contain',
        opacity: 0.96,
    },
    heroImageWrap: {
        height: 260,
        backgroundColor: 'transparent',
    },
    moodNudgeBadge: {
        position: 'absolute',
        bottom: 12,
        alignSelf: 'center',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.10,
                shadowRadius: 6,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    moodNudgeText: {
        color: '#3C375A',
        fontSize: 12,
        fontWeight: fontWeight('700'),
        fontFamily: fontFamily.bold,
    },
    heroSparkleOne: {
        position: 'absolute',
        top: 28,
        right: 68,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#FFFFFF',
    },
    heroSparkleTwo: {
        position: 'absolute',
        top: 70,
        left: 56,
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#FFB7C8',
    },
    twoColumn: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
        marginHorizontal: -20,
        paddingHorizontal: 20,
    },
    featureCardPressable: {
        flex: 1,
    },
    featureMiniCard: {
        height: 190,
        borderRadius: 18,
        overflow: 'hidden',
        padding: 0,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.88)',
        ...cardShadow,
    },
    canvasCard: {
        shadowColor: '#B899F0',
    },
    liveDrawPressable: {
        marginTop: 12,
    },
    liveDrawCard: {
        height: 70,
        borderRadius: 22,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.72)',
        paddingHorizontal: 13,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1B1237',
        ...cardShadow,
    },
    liveDrawGradient: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 22,
    },
    liveDrawStars: {
        ...StyleSheet.absoluteFillObject,
    },
    liveDrawStar: {
        position: 'absolute',
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#FFFFFF',
        opacity: 0.72,
    },
    liveDrawStarOne: {
        top: 14,
        right: 82,
    },
    liveDrawStarTwo: {
        top: 44,
        right: 132,
        width: 3,
        height: 3,
        borderRadius: 1.5,
        opacity: 0.56,
    },
    liveDrawStarThree: {
        bottom: 14,
        right: 38,
        width: 4,
        height: 4,
        borderRadius: 2,
        opacity: 0.64,
    },
    liveDrawIcon: {
        width: 34,
        height: 34,
        borderRadius: 13,
        backgroundColor: 'rgba(255,255,255,0.18)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.32)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 11,
    },
    liveDrawCopy: {
        flex: 1,
        paddingRight: 12,
        justifyContent: 'center',
        minWidth: 0,
    },
    liveDrawTitle: {
        color: '#FFFFFF',
        fontSize: 15,
        lineHeight: 19,
        fontWeight: fontWeight('900'),
        fontFamily: fontFamily.extraBold,
    },
    liveDrawSubtitle: {
        color: 'rgba(255,255,255,0.78)',
        fontSize: 11,
        lineHeight: 13,
        fontWeight: fontWeight('700'),
        fontFamily: fontFamily.bold,
        marginTop: 2,
    },
    liveDrawArrow: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,122,183,0.94)',
    },
    featureCardHeader: {
        zIndex: 2,
        paddingTop: 10,
        paddingHorizontal: 16,
    },
    smallCardTitle: {
        color: '#171B44',
        fontSize: 13,
        lineHeight: 16,
        fontWeight: fontWeight('900'),
        fontFamily: fontFamily.extraBold,
    },
    scribbleCardTitle: {
        color: '#15134F',
        fontWeight: fontWeight('900'),
        fontFamily: fontFamily.extraBold,
    },
    ritualCardTitle: {
        color: '#A71F1F',
        fontWeight: fontWeight('900'),
        fontFamily: fontFamily.extraBold,
    },
    smallCardSub: {
        color: '#766F9B',
        fontSize: 11,
        lineHeight: 15,
        fontWeight: fontWeight('700'),
        marginTop: 2,
        fontFamily: fontFamily.bold,
    },
    ritualCardSub: {
        color: '#8C2F2F',
    },
    cardTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    cardTitleRowBetween: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    cardTitleHeart: {
        marginTop: -1,
    },
    ritualHeartStatus: {
        color: '#FF4568',
        fontSize: 17,
        lineHeight: 18,
        fontWeight: fontWeight('900'),
        fontFamily: fontFamily.bold,
    },
    ritualStreakBadge: {
        color: '#A71F1F',
        fontSize: 10,
        lineHeight: 13,
        fontWeight: fontWeight('900'),
        fontFamily: fontFamily.extraBold,
        maxWidth: 76,
        textAlign: 'right',
    },
    scribblePaper: {
        position: 'absolute',
        left: 15,
        right: 15,
        bottom: 16,
        height: 136,
        overflow: 'hidden',
        borderRadius: 11,
        backgroundColor: '#FFFDF9',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.95)',
        transform: [{ rotate: '-3deg' }],
        ...Platform.select({
            ios: {
                shadowColor: '#7A5FC8',
                shadowOffset: { width: 0, height: 7 },
                shadowOpacity: 0.16,
                shadowRadius: 12,
            },
            android: {
                elevation: 5,
            },
        }),
    },
    streakCard: {
        flex: 1,
        shadowColor: '#F5A2A2',
    },
    completedStreakCard: {
        borderColor: 'rgba(255,255,255,0.9)',
    },
    completedCardTitle: {
        color: '#0A5C43',
    },
    completedCardSub: {
        color: '#138A68',
    },
    scribbleLottie: {
        position: 'absolute',
        right: -12,
        bottom: -20,
        width: 166,
        height: 166,
        transform: [{ rotate: '3deg' }],
    },
    partnerScribblePreview: {
        transform: [{ scale: 0.98 }],
    },
    scribblePaperText: {
        position: 'absolute',
        left: 26,
        top: 18,
        color: '#1F2034',
        fontSize: 16,
        lineHeight: 21,
        fontWeight: fontWeight('800'),
        fontFamily: fontFamily.bold,
        transform: [{ rotate: '2deg' }],
        zIndex: 2,
    },
    scribbleDoodles: {
        position: 'absolute',
        left: 9,
        top: 9,
        width: 86,
        height: 56,
        opacity: 0.78,
        zIndex: 1,
    },
    scribblePencil: {
        position: 'absolute',
        right: -6,
        bottom: 2,
        width: 45,
        height: 62,
        zIndex: 4,
        transform: [{ rotate: '18deg' }],
    },
    cardArrowButton: {
        position: 'absolute',
        left: 14,
        bottom: 16,
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 8,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 5 },
                shadowOpacity: 0.16,
                shadowRadius: 8,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    challengeContent: {
        flex: 1,
        paddingHorizontal: 16,
        paddingBottom: 16,
        justifyContent: 'space-between',
    },
    challengePromptContainer: {
        flex: 1,
        justifyContent: 'center',
        marginTop: 0,
    },
    challengeCategory: {
        color: '#FF6F8F',
        fontSize: 11,
        fontWeight: fontWeight('800'),
        fontFamily: fontFamily.extraBold,
        textTransform: 'uppercase',
        marginBottom: 4,
    },
    challengeQuestion: {
        color: '#3C375A',
        fontSize: 13,
        lineHeight: 17,
        fontWeight: fontWeight('700'),
        fontFamily: fontFamily.bold,
    },
    ritualPaper: {
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 16,
        height: 136,
        borderRadius: 11,
        backgroundColor: '#FFFDF9',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.96)',
        paddingHorizontal: 14,
        paddingTop: 18,
        paddingBottom: 12,
        alignItems: 'center',
        justifyContent: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#CF7777',
                shadowOffset: { width: 0, height: 7 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
            },
            android: {
                elevation: 5,
            },
        }),
    },
    completedRitualPaper: {
        paddingHorizontal: 12,
    },
    ritualQuestion: {
        color: '#222133',
        fontSize: 15,
        lineHeight: 21,
        fontWeight: fontWeight('800'),
        fontFamily: fontFamily.bold,
        textAlign: 'center',
        transform: [{ translateY: -16 }],
    },
    paperTape: {
        position: 'absolute',
        top: -9,
        alignSelf: 'center',
        width: 38,
        height: 15,
        borderRadius: 2,
        backgroundColor: 'rgba(244, 188, 181, 0.78)',
    },
    ritualPaperHeartOne: {
        position: 'absolute',
        right: 20,
        bottom: 10,
    },
    ritualPaperHeartTwo: {
        position: 'absolute',
        right: 8,
        bottom: 19,
    },
    challengeContentCompleted: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    completedSubText: {
        color: '#138A68',
        fontSize: 12,
        lineHeight: 16,
        fontWeight: fontWeight('600'),
        fontFamily: fontFamily.bold,
        flex: 1,
        paddingRight: 8,
    },
    completedBadge: {
        width: 50,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    completedImage: {
        width: 44,
        height: 52,
        resizeMode: 'contain',
        transform: [{ rotate: '5deg' }],
    },
    sectionHeader: {
        marginTop: 12,
        marginBottom: 6,
    },
    widgetsSectionHeader: {
        marginTop: 12,
        marginBottom: 6,
    },
    sectionTitle: {
        color: '#171B44',
        fontSize: 18,
        fontWeight: fontWeight('900'),
        fontFamily: fontFamily.extraBold,
    },
    sectionSub: {
        color: '#766F9B',
        fontSize: 13,
        fontWeight: fontWeight('700'),
        marginTop: 3,
        fontFamily: fontFamily.bold,
    },
    topicGrid: {
        gap: 12,
    },
    topicPressable: {
        width: '100%',
    },
    topicCard: {
        height: 92,
        borderRadius: 16,
        paddingHorizontal: 0,
        paddingVertical: 0,
        flexDirection: 'row',
        alignItems: 'center',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.78)',
        ...cardShadow,
    },
    topicImage: {
        width: 72,
        height: 72,
        resizeMode: 'contain',
        marginLeft: 8,
        marginRight: 12,
    },
    topicEmojiBadge: {
        width: 58,
        height: 58,
        borderRadius: 29,
        marginLeft: 16,
        marginRight: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.45)',
    },
    topicEmoji: {
        fontSize: 28,
        lineHeight: 34,
    },
    topicTitle: {
        fontSize: 16,
        lineHeight: 20,
        fontWeight: fontWeight('900'),
        letterSpacing: 0,
        fontFamily: fontFamily.extraBold,
    },
    topicCopy: {
        flexShrink: 1,
        flexGrow: 1,
        minWidth: 0,
        paddingRight: 18,
    },
    topicSubtitle: {
        fontSize: 12,
        lineHeight: 16,
        fontWeight: fontWeight('700'),
        marginTop: 4,
        opacity: 0.85,
        fontFamily: fontFamily.bold,
    },
});

export default HomeScreen;
