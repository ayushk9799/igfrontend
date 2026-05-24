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

const MOOD_STALE_MS = 12 * 60 * 60 * 1000;
const SCRIBBLE_PREVIEW_PADDING = 28;
const SCRIBBLE_PREVIEW_MIN_SIZE = 140;

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

const HomeText = ({ children, style, ...props }) => (
    <Text {...props} style={[{ fontFamily: fontFamily.regular }, style]} maxFontSizeMultiplier={1.2}>
        {children}
    </Text>
);

const CONNECTION_TOPICS = [
    {
        id: 'future',
        title: 'Future',
        subtitle: 'Dream, plan\nand imagine',
        image: require('../../assets/home/future-crystal.png'),
        gradient: ['#D9B6FF', '#C79BFF'],
        textColor: '#7341C8',
    },
    {
        id: 'money',
        title: 'Money',
        subtitle: 'Build security\ntogether',
        image: require('../../assets/home/money-bag.png'),
        gradient: ['#B6EBCF', '#D7F4DE'],
        textColor: '#087D61',
    },
    {
        id: 'hotspicy',
        title: 'Hot & Spicy',
        subtitle: 'Add spark and\nexcitement',
        image: require('../../assets/home/hot-fire.png'),
        gradient: ['#FFA8B7', '#FFC3CD'],
        textColor: '#B63567',
    },
    {
        id: 'political',
        title: 'Political',
        subtitle: 'Share views\nrespectfully',
        image: require('../../assets/home/political-ballot.png'),
        gradient: ['#90C8FF', '#AED6FF'],
        textColor: '#1C6EBB',
    },
    {
        id: 'fitness',
        title: 'Lifestyle',
        subtitle: 'Habits, health\nand routines',
        image: require('../../assets/home/lifestyle-arm.png'),
        gradient: ['#7ADCE1', '#B5EEF0'],
        textColor: '#13788D',
    },
    {
        id: 'travel',
        title: 'Travel',
        subtitle: 'Explore places\ntogether',
        image: require('../../assets/home/travel-plane.png'),
        gradient: ['#FFC35C', '#FFD780'],
        textColor: '#A45B13',
    },
];

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
        </Svg>
    );
};

const HomeScreen = ({
    hasPartner = false,
    yourMood = null,
    partnerMood = null,
    partnerScribble = null,
    todayChallenge = null,
    onMoodPress,
    onScribblePress,
    onQuestionPress,
    onFindPartner,
    onSettingsPress,
    onRefreshPuzzle,
    duelBadgeCount = 0,
    onNotificationPress,
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
    const totalTasks = todayChallenge?.progress?.totalTasks || 0;

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

    const topicCardWidth = (width - 52) / 2;
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
                                colors={['#F4E8FF', '#FFF9FF']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.canvasCard}
                            >
                                <View style={styles.featureCardHeader}>
                                    <HomeText style={styles.smallCardTitle}>Scribble board</HomeText>
                                    <HomeText style={styles.smallCardSub}>Draw your thoughts</HomeText>
                                </View>

                                <View style={styles.scribblePaper}>
                                    {partnerScribble?.paths?.length > 0 ? (
                                        <Svg
                                            width="100%"
                                            height="100%"
                                            viewBox={scribblePreviewBox}
                                            preserveAspectRatio="xMidYMid meet"
                                        >
                                            {partnerScribble.paths.slice(0, 40).map((path, index) => (
                                                <Path
                                                    key={`${path.d}-${index}`}
                                                    d={path.d}
                                                    stroke={path.color}
                                                    strokeWidth={path.strokeWidth}
                                                    fill="none"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                            ))}
                                        </Svg>
                                    ) : (
                                        <LottieView
                                            source={require('../../assets/canvas.lottie')}
                                            autoPlay
                                            loop={false}
                                            style={styles.scribbleLottie}
                                        />
                                    )}
                                </View>

                            </LinearGradient>
                        </TouchableOpacity>

                        {isChallengeComplete ? (
                            <TouchableOpacity onPress={() => onQuestionPress?.()} activeOpacity={0.9} style={styles.featureCardPressable}>
                                <LinearGradient
                                    colors={['#E3F9F0', '#F2FCF8']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={[styles.streakCard, styles.completedStreakCard]}
                                >
                                    <View style={styles.featureCardHeader}>
                                        <HomeText style={[styles.smallCardTitle, styles.completedCardTitle]}>Challenge Done! ✨</HomeText>
                                        <HomeText style={[styles.smallCardSub, styles.completedCardSub]}>You're all caught up</HomeText>
                                    </View>
                                    <View style={styles.challengeContentCompleted}>
                                        <HomeText style={styles.completedSubText}>
                                            Great job! Come back tomorrow for new prompts.
                                        </HomeText>
                                        <View style={styles.completedBadge}>
                                            <Image source={require('../../assets/home/together-heart-plant.png')} style={styles.completedImage} />
                                        </View>
                                    </View>
                                </LinearGradient>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity onPress={() => onQuestionPress?.()} activeOpacity={0.9} style={styles.featureCardPressable}>
                                <LinearGradient
                                    colors={['#FFF0F2', '#FFE5EA']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.streakCard}
                                >
                                    <View style={styles.featureCardHeader}>
                                        <HomeText style={styles.smallCardTitle}>Daily Ritual</HomeText>
                                        <HomeText style={styles.smallCardSub}>
                                            {todayChallenge ? `Task ${Math.min(completedCount + 1, totalTasks || 1)} of ${totalTasks || 3}` : 'Daily Prompts'}
                                        </HomeText>
                                    </View>
                                    <View style={styles.challengeContent}>
                                        {currentTask ? (
                                            <View style={styles.challengePromptContainer}>
                                                <HomeText style={styles.challengeCategory}>
                                                    {currentTask.category === 'likelyto' && 'Most likely to... 👑'}
                                                    {currentTask.category === 'neverhaveiever' && 'Never have I ever... 🙈'}
                                                    {currentTask.category === 'deep' && 'Deep question... 💭'}
                                                    {currentTask.category === 'takephoto' && 'Photo challenge... 📸'}
                                                    {!['likelyto', 'neverhaveiever', 'deep', 'takephoto'].includes(currentTask.category) && 'Daily prompt... 📝'}
                                                </HomeText>
                                                <HomeText style={styles.challengeQuestion} numberOfLines={3}>
                                                    {currentTask.taskstatement}
                                                </HomeText>
                                            </View>
                                        ) : (
                                            <View style={styles.challengePromptContainer}>
                                                <HomeText style={styles.challengeQuestion} numberOfLines={3}>
                                                    Tap to answer today's questions and build your bond!
                                                </HomeText>
                                            </View>
                                        )}
                                    </View>
                                </LinearGradient>
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={styles.sectionHeader}>
                        <HomeText style={styles.sectionTitle}>Deepen your connection</HomeText>
                        <HomeText style={styles.sectionSub}>Explore topics that bring you closer</HomeText>
                    </View>
                    <View style={styles.topicGrid}>
                        {CONNECTION_TOPICS.map((topic) => (
                            <TouchableOpacity
                                key={topic.id}
                                style={{ width: topicCardWidth }}
                                onPress={() => onQuestionPress?.(TOPIC_CATEGORIES[topic.id])}
                                activeOpacity={0.88}
                            >
                                <LinearGradient
                                    colors={topic.gradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.topicCard}
                                >
                                    <Image source={topic.image} style={styles.topicImage} />
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
        gap: 12,
        marginTop: 18,
        marginHorizontal: -20,
        paddingHorizontal: 20,
    },
    featureCardPressable: {
        flex: 1,
    },
    canvasCard: {
        height: 190,
        borderRadius: 18,
        overflow: 'hidden',
        padding: 0,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.88)',
        ...cardShadow,
    },
    featureCardHeader: {
        minHeight: 42,
        zIndex: 2,
        paddingTop: 16,
        paddingHorizontal: 16,
    },
    smallCardTitle: {
        color: '#171B44',
        fontSize: 14,
        lineHeight: 18,
        fontWeight: fontWeight('900'),
        fontFamily: fontFamily.extraBold,
    },
    smallCardSub: {
        color: '#766F9B',
        fontSize: 11,
        lineHeight: 15,
        fontWeight: fontWeight('700'),
        marginTop: 4,
        fontFamily: fontFamily.bold,
    },
    scribblePaper: {
        flex: 1,
        width: '100%',
        overflow: 'hidden',
        borderBottomLeftRadius: 18,
        borderBottomRightRadius: 18,
    },
    streakCard: {
        flex: 1,
        height: 190,
        borderRadius: 18,
        padding: 0,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.9)',
        overflow: 'hidden',
        ...cardShadow,
    },
    completedStreakCard: {
        borderColor: '#D0F2E4',
    },
    completedCardTitle: {
        color: '#0A5C43',
    },
    completedCardSub: {
        color: '#138A68',
    },
    scribbleLottie: {
        width: '100%',
        height: '100%',
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
        marginTop: 4,
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
        marginTop: 24,
        marginBottom: 14,
    },
    sectionTitle: {
        color: '#171B44',
        fontSize: 20,
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
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: 12,
    },
    topicCard: {
        height: 86,
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
        width: 56,
        height: 62,
        resizeMode: 'contain',
        marginLeft: -4,
        marginRight: 7,
    },
    topicTitle: {
        fontSize: 14,
        lineHeight: 17,
        fontWeight: fontWeight('900'),
        letterSpacing: 0,
        fontFamily: fontFamily.extraBold,
    },
    topicCopy: {
        flexShrink: 1,
        flexGrow: 1,
        minWidth: 0,
        paddingRight: 12,
    },
    topicSubtitle: {
        fontSize: 11,
        lineHeight: 15,
        fontWeight: fontWeight('700'),
        marginTop: 4,
        opacity: 0.85,
        fontFamily: fontFamily.bold,
    },
});

export default HomeScreen;
