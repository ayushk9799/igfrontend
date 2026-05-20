import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Dimensions,
    Image,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    StatusBar,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { TOPIC_CATEGORIES } from '../constants/Categories';
import { getPenguinMoodImage } from '../constants/PenguinMoods';
import LottieView from 'lottie-react-native';
import { colors } from '../theme';
import { fontFamily, fontWeight } from '../constants/fonts';

const { width } = Dimensions.get('window');

const HomeText = ({ children, style, ...props }) => (
    <Text {...props} style={[{ fontFamily: fontFamily.regular }, style]} allowFontScaling={false}>
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
        arrowColor: '#8A58DD',
    },
    {
        id: 'money',
        title: 'Money',
        subtitle: 'Build security\ntogether',
        image: require('../../assets/home/money-bag.png'),
        gradient: ['#B6EBCF', '#D7F4DE'],
        textColor: '#087D61',
        arrowColor: '#13956D',
    },
    {
        id: 'hotspicy',
        title: 'Hot & Spicy',
        subtitle: 'Add spark and\nexcitement',
        image: require('../../assets/home/hot-fire.png'),
        gradient: ['#FFA8B7', '#FFC3CD'],
        textColor: '#B63567',
        arrowColor: '#D94B69',
    },
    {
        id: 'political',
        title: 'Political',
        subtitle: 'Share views\nrespectfully',
        image: require('../../assets/home/political-ballot.png'),
        gradient: ['#90C8FF', '#AED6FF'],
        textColor: '#1C6EBB',
        arrowColor: '#357FD1',
    },
    {
        id: 'fitness',
        title: 'Lifestyle',
        subtitle: 'Habits, health\nand routines',
        image: require('../../assets/home/lifestyle-arm.png'),
        gradient: ['#7ADCE1', '#B5EEF0'],
        textColor: '#13788D',
        arrowColor: '#1897A8',
    },
    {
        id: 'travel',
        title: 'Travel',
        subtitle: 'Explore places\ntogether',
        image: require('../../assets/home/travel-plane.png'),
        gradient: ['#FFC35C', '#FFD780'],
        textColor: '#A45B13',
        arrowColor: '#D78319',
    },
];

const IconSvg = ({ type, color = '#7867F6', size = 26 }) => {
    const stroke = color;
    const fill = type === 'heart' ? color : 'none';

    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            {type === 'mood' && (
                <>
                    <Circle cx="12" cy="12" r="9" fill={color} opacity={0.16} />
                    <Circle cx="9" cy="10" r="1.4" fill={stroke} />
                    <Circle cx="15" cy="10" r="1.4" fill={stroke} />
                    <Path d="M8 14.2C9.2 16 10.5 16.7 12 16.7C13.5 16.7 14.8 16 16 14.2" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" />
                </>
            )}
            {type === 'game' && (
                <>
                    <Rect x="4" y="8" width="16" height="10" rx="5" fill={color} opacity={0.16} />
                    <Path d="M8 13H12M10 11V15M16 12.5H16.01M18 14.5H18.01" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" />
                </>
            )}
            {type === 'scribble' && (
                <Path d="M16.5 3.8L20.2 7.5L8.4 19.3L3.8 20.2L4.7 15.6L16.5 3.8Z" fill={color} opacity={0.74} />
            )}
            {type === 'heart' && (
                <Path d="M12 20.2L10.8 19.1C6.4 15.1 3.5 12.5 3.5 9.2C3.5 6.6 5.5 4.6 8.1 4.6C9.6 4.6 11 5.3 12 6.4C13 5.3 14.4 4.6 15.9 4.6C18.5 4.6 20.5 6.6 20.5 9.2C20.5 12.5 17.6 15.1 13.2 19.1L12 20.2Z" fill={fill} />
            )}
            {type === 'bell' && (
                <Path d="M18 8A6 6 0 006 8C6 15 3 17 3 17H21S18 15 18 8M13.7 21A2 2 0 0110.3 21" stroke={stroke} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" />
            )}
            {type === 'settings' && (
                <>
                    <Circle cx="12" cy="12" r="3" stroke={stroke} strokeWidth={1.8} />
                    <Path d="M19 12A7 7 0 0018.9 10.8L21 9.1L19 5.7L16.5 6.7A7 7 0 0014.5 5.5L14.1 3H10L9.5 5.5A7 7 0 007.5 6.7L5 5.7L3 9.1L5.1 10.8A7 7 0 005.1 13.2L3 14.9L5 18.3L7.5 17.3A7 7 0 009.5 18.5L10 21H14L14.5 18.5A7 7 0 0016.5 17.3L19 18.3L21 14.9L18.9 13.2A7 7 0 0019 12Z" stroke={stroke} strokeWidth={1.4} strokeLinejoin="round" />
                </>
            )}
            {type === 'calendar' && (
                <>
                    <Rect x="4" y="5" width="16" height="15" rx="3" stroke={stroke} strokeWidth={1.8} />
                    <Path d="M8 3V7M16 3V7M4 10H20" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" />
                </>
            )}
            {type === 'arrow' && (
                <Path d="M5 12H18M13 7L18 12L13 17" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            )}
        </Svg>
    );
};

const HomeScreen = ({
    partnerName = 'Partner',
    daysTogether = 0,
    hasPartner = false,
    yourMood = null,
    partnerMood = null,
    partnerOnline = false,
    partnerScribble = null,
    pendingInvite = null,
    pendingPuzzle = null,
    pendingTicTacToe = null,
    activeTicTacToe = null,
    pendingWordle = null,
    activeWordle = null,
    todayChallenge = null,
    onMoodPress,
    onScribblePress,
    onQuestionPress,
    onFindPartner,
    onSettingsPress,
    onJigsawCreate,
    onJigsawPlay,
    onTicTacToePress,
    onWordlePress,
    onRefreshPuzzle,
    duelBadgeCount = 0,
    onNotificationPress,
}) => {
    const blinkAnim = useRef(new Animated.Value(1)).current;
    const penguinMoodImage = getPenguinMoodImage(partnerMood?.id, yourMood?.id);

    const isChallengeComplete = todayChallenge?.progress?.isComplete || false;
    const completedCount = todayChallenge?.progress?.completedCount || 0;
    const totalTasks = todayChallenge?.progress?.totalTasks || 0;

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
        onRefreshPuzzle?.();
    }, [onRefreshPuzzle]);

    useEffect(() => {
        if (!pendingTicTacToe && !pendingWordle) {
            blinkAnim.setValue(1);
            return undefined;
        }

        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(blinkAnim, { toValue: 0.25, duration: 600, useNativeDriver: true }),
                Animated.timing(blinkAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
            ])
        );

        animation.start();
        return () => animation.stop();
    }, [pendingTicTacToe, pendingWordle, blinkAnim]);

   

  

    return (
        <LinearGradient
            colors={['#F8D9EC', '#FFF7FA', '#FFF4F7', '#F7D8F2']}
            locations={[0, 0.34, 0.72, 1]}
            start={{ x: 0.25, y: 0 }}
            end={{ x: 0.75, y: 1 }}
            style={{ flex: 1 }}
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
                        onPress={onMoodPress}
                        activeOpacity={0.92}
                    >
                        <View style={styles.heroSparkleOne} />
                        <View style={styles.heroSparkleTwo} />
                        <View style={styles.heroImageWrap}>
                            <Image source={penguinMoodImage} style={styles.heroImage} />
                        </View>
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
                                        <Svg width="100%" height="100%" viewBox="0 0 320 180">
                                            {partnerScribble.paths.slice(0, 18).map((path, index) => (
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
                                    style={[styles.streakCard, { borderColor: '#D0F2E4' }]}
                                >
                                    <View style={styles.featureCardHeader}>
                                        <HomeText style={[styles.smallCardTitle, { color: '#0A5C43' }]}>Challenge Done! ✨</HomeText>
                                        <HomeText style={[styles.smallCardSub, { color: '#138A68' }]}>You're all caught up</HomeText>
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
                                    <Image source={topic.image} style={styles.topicImage} />
                                    <View style={styles.topicCopy}>
                                        <HomeText style={[styles.topicTitle, { color: topic.textColor }]} numberOfLines={1}>{topic.title}</HomeText>
                                        <HomeText style={[styles.topicSubtitle, { color: topic.textColor }]} numberOfLines={2}>{topic.subtitle}</HomeText>
                                    </View>
                                </LinearGradient>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {!hasPartner && (
                        <TouchableOpacity style={styles.linkPartnerCard} onPress={onFindPartner} activeOpacity={0.9}>
                            <HomeText style={styles.linkPartnerTitle}>Find your partner</HomeText>
                            <HomeText style={styles.linkPartnerText}>Connect with someone special and start your Penguin story.</HomeText>
                        </TouchableOpacity>
                    )}
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
    greetingBlock: {
        marginBottom: 14,
    },
    greeting: {
        fontSize: 25,
        fontWeight: fontWeight('900'),
        color: '#171B44',
        fontFamily: fontFamily.extraBold,
    },
    greetingSub: {
        color: '#6F6998',
        fontSize: 14,
        fontWeight: fontWeight('600'),
        marginTop: 4,
        fontFamily: fontFamily.bold,
    },
    partnerMoodCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 96,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderWidth: 1,
        borderColor: '#F8DDE8',
        paddingHorizontal: 16,
        paddingVertical: 12,
        ...cardShadow,
    },
    cardEyebrow: {
        color: '#272C57',
        fontSize: 12,
        fontWeight: fontWeight('800'),
        fontFamily: fontFamily.extraBold,
    },
    partnerMoodText: {
        color: '#FF6F8F',
        fontSize: 20,
        fontWeight: fontWeight('900'),
        marginTop: 5,
        fontFamily: fontFamily.extraBold,
    },
    cardMeta: {
        color: '#817A9F',
        fontSize: 12,
        fontWeight: fontWeight('600'),
        marginTop: 5,
        fontFamily: fontFamily.bold,
    },
    moodAvatar: {
        width: 80,
        height: 80,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    moodImage: {
        width: 92,
        height: 62,
        borderRadius: 12,
        resizeMode: 'cover',
    },
    hero: {
        height: 226,
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginTop: 4,
        marginBottom: -2,
    },
    heroImage: {
        width: width + 12,
        height: 226,
        resizeMode: 'cover',
        opacity: 0.96,
    },
    heroImageWrap: {
        width: width + 12,
        height: 226,
        borderRadius: 28,
        overflow: 'hidden',
        backgroundColor: 'transparent',
    },
    heroFadeTop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 36,
    },
    heroFadeBottom: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 46,
    },
    heroFadeLeft: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        width: 42,
    },
    heroFadeRight: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        right: 0,
        width: 42,
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
    quickPanel: {
        borderRadius: 22,
        padding: 14,
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderWidth: 1,
        borderColor: '#F8DDE8',
        ...cardShadow,
    },
    sectionPrompt: {
        color: '#272C57',
        fontSize: 14,
        fontWeight: fontWeight('900'),
        marginBottom: 12,
        fontFamily: fontFamily.extraBold,
    },
    quickGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8,
    },
    quickCard: {
        width: (width - 92) / 4,
        minHeight: 76,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F4E5F4',
    },
    quickIcon: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 7,
    },
    quickLabel: {
        color: '#272C57',
        fontSize: 11,
        fontWeight: fontWeight('800'),
        fontFamily: fontFamily.extraBold,
    },
    quoteCard: {
        marginTop: 14,
        borderRadius: 18,
        paddingVertical: 16,
        paddingHorizontal: 18,
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.82)',
        borderWidth: 1,
        borderColor: '#F8DDE8',
    },
    quoteText: {
        color: '#555078',
        fontSize: 15,
        fontWeight: fontWeight('700'),
        fontFamily: fontFamily.bold,
    },
    quoteSub: {
        color: '#6F6998',
        fontSize: 13,
        fontWeight: fontWeight('600'),
        marginTop: 3,
        fontFamily: fontFamily.bold,
    },
    todayCard: {
        marginTop: 18,
        borderRadius: 22,
        padding: 16,
        backgroundColor: 'rgba(255,255,255,0.92)',
        borderWidth: 1,
        borderColor: '#F8DDE8',
        ...cardShadow,
    },
    todayTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    todayTitle: {
        color: '#171B44',
        fontSize: 20,
        fontWeight: fontWeight('900'),
        marginTop: 4,
        fontFamily: fontFamily.extraBold,
    },
    calendarBubble: {
        width: 44,
        height: 44,
        borderRadius: 16,
        backgroundColor: '#F2EEFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    todayQuestion: {
        color: '#6F6998',
        fontSize: 14,
        lineHeight: 20,
        fontWeight: fontWeight('600'),
        marginTop: 12,
        fontFamily: fontFamily.bold,
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
    scribbleDoodles: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    pencilBubble: {
        position: 'absolute',
        right: 12,
        bottom: 12,
        width: 48,
        height: 48,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.38)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.58)',
    },
    pencilImage: {
        width: 34,
        height: 34,
        resizeMode: 'contain',
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
    scribbleLottie: {
        width: '100%',
        height: '100%',
    },
    togetherContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
    },
    togetherImage: {
        width: 78,
        height: 94,
        resizeMode: 'contain',
        marginRight: -10,
        marginBottom: -8,
    },
    daysText: {
        color: '#FF758F',
        fontSize: 40,
        fontWeight: fontWeight('900'),
        lineHeight: 44,
        fontFamily: fontFamily.extraBold,
    },
    daysLabel: {
        color: '#171B44',
        fontSize: 15,
        lineHeight: 19,
        fontWeight: fontWeight('900'),
        fontFamily: fontFamily.extraBold,
    },
    daysSub: {
        color: '#817A9F',
        fontSize: 11,
        lineHeight: 14,
        fontWeight: fontWeight('800'),
        marginTop: 8,
        fontFamily: fontFamily.extraBold,
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
    horizontalList: {
        gap: 12,
        paddingRight: 20,
    },
    gameCard: {
        width: 158,
        minHeight: 126,
        borderRadius: 20,
        padding: 15,
        justifyContent: 'flex-end',
        overflow: 'hidden',
    },
    liveDot: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#FFFFFF',
    },
    gameTitle: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: fontWeight('900'),
        fontFamily: fontFamily.extraBold,
    },
    gameSubtitle: {
        color: 'rgba(255,255,255,0.86)',
        fontSize: 12,
        fontWeight: fontWeight('600'),
        lineHeight: 17,
        marginTop: 6,
        fontFamily: fontFamily.bold,
    },
    topicGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: 12,
    },
    topicPressable: {
        width: (width - 52) / 2,
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
    topicArrow: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.48)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.62)',
        flexShrink: 0,
        marginLeft: 5,
    },
    linkPartnerCard: {
        marginTop: 18,
        borderRadius: 22,
        padding: 18,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F8DDE8',
        ...cardShadow,
    },
    linkPartnerTitle: {
        color: '#171B44',
        fontSize: 20,
        fontWeight: fontWeight('900'),
        marginBottom: 7,
        fontFamily: fontFamily.extraBold,
    },
    linkPartnerText: {
        color: '#6F6998',
        fontSize: 14,
        lineHeight: 20,
        fontWeight: fontWeight('600'),
        fontFamily: fontFamily.bold,
    },
});

export default HomeScreen;
