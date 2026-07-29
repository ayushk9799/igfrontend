import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    Image,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { fontFamily, fontWeight } from '../constants/fonts';
import { getUser, storage } from '../utils/authStorage';
import { translateUiTemplate, translateUiText } from '../i18n/uiTranslation';
import { prefetchPuzzleTexture } from '../utils/puzzleTextureCache';

const VIDEO_CALL_GUIDANCE_KEY = 'games_video_call_guidance_v1';

const gameAssets = {
    puzzle: require('../../assets/images/games/puzzle.png'),
    tictactoe: require('../../assets/images/games/tictactoe.png'),
    wordle: require('../../assets/images/games/wordle.png'),
};

const ArrowIcon = ({ color, size = 12 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
            d="M5 12H19M19 12L12 5M19 12L12 19"
            stroke={color}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </Svg>
);

const VideoCallIcon = ({ color = '#FFFFFF', size = 18 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Rect
            x="3.5"
            y="6.5"
            width="11.5"
            height="11"
            rx="3"
            stroke={color}
            strokeWidth={2}
        />
        <Path
            d="M15 10.2L19.1 7.8C19.7 7.45 20.5 7.88 20.5 8.58V15.42C20.5 16.12 19.7 16.55 19.1 16.2L15 13.8V10.2Z"
            fill={color}
        />
    </Svg>
);

const GameIcon = ({ type, color, size = 28 }) => (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
        {type === 'puzzle' && (
            <Path
                d="M11.2 5.3H6.6C5.7 5.3 5 6 5 6.9v4.2h1.1c1.2 0 2.2 1 2.2 2.2s-1 2.2-2.2 2.2H5v5.6c0 .9.7 1.6 1.6 1.6h5.6v-1.1c0-1.2 1-2.2 2.2-2.2s2.2 1 2.2 2.2v1.1h4.8c.9 0 1.6-.7 1.6-1.6v-4.8h-1.1c-1.2 0-2.2-1-2.2-2.2s1-2.2 2.2-2.2H23v-5c0-.9-.7-1.6-1.6-1.6h-5.2v1.2c0 1.2-1 2.2-2.2 2.2s-2.2-1-2.2-2.2V5.3Z"
                fill={color}
            />
        )}
        {type === 'gamepad' && (
            <>
                <Rect x="4.2" y="9" width="19.6" height="12" rx="5.6" fill={color} />
                <Path d="M9.2 15H13M11.1 13.1V16.9" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
                <Circle cx="17.9" cy="14.1" r="1.15" fill="#FFFFFF" />
                <Circle cx="20.4" cy="16.4" r="1.15" fill="#FFFFFF" />
            </>
        )}
        {type === 'letter' && (
            <>
                <Rect x="5.4" y="5.4" width="17.2" height="17.2" rx="3.8" fill={color} />
                <Path
                    d="M10.3 19L13.4 9H15L18.1 19H16.3L15.7 16.8H12.7L12.1 19H10.3ZM13.1 15.2H15.3L14.2 11.3L13.1 15.2Z"
                    fill="#FFFFFF"
                />
            </>
        )}
    </Svg>
);

const Sparkle = ({ style, color = '#FFD58D' }) => (
    <View style={[styles.sparkle, style]}>
        <View style={[styles.sparkleLine, { backgroundColor: color }]} />
        <View style={[styles.sparkleLineCross, { backgroundColor: color }]} />
    </View>
);

const GamesScreen = ({
    partnerName = 'Partner',
    pendingPuzzle,
    activeTicTacToe,
    pendingTicTacToe,
    activeWordle,
    pendingWordle,
    onJigsawCreate,
    onJigsawPlay,
    onTicTacToePress,
    onWordlePress,
    onRefreshPuzzle,
    onVideoCallPress,
    callActive = false,
    partnerOnline = false,
}) => {
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const blinkAnim = useRef(new Animated.Value(1)).current;
    const refreshPuzzleRef = useRef(onRefreshPuzzle);
    const refreshedExpiredPuzzleRef = useRef(null);
    const cardMinHeight = Math.max(152, Math.min(168, width * 0.42));
    const [showVideoCallGuide, setShowVideoCallGuide] = useState(false);
    const [puzzleNow, setPuzzleNow] = useState(Date.now());
    const videoCallGuideStorageKey = useMemo(() => {
        const currentUser = getUser();
        const currentUserId = currentUser?.id || currentUser?._id || 'device';
        return `${VIDEO_CALL_GUIDANCE_KEY}:${currentUserId}`;
    }, []);

    useEffect(() => {
        refreshPuzzleRef.current = onRefreshPuzzle;
    }, [onRefreshPuzzle]);

    useEffect(() => {
        refreshPuzzleRef.current?.();
    }, []);

    useEffect(() => {
        if (pendingPuzzle?.status !== 'in_progress' || !pendingPuzzle?.expiresAt) {
            return undefined;
        }
        const update = () => setPuzzleNow(Date.now());
        update();
        const timer = setInterval(update, 1000);
        return () => clearInterval(timer);
    }, [pendingPuzzle?.expiresAt, pendingPuzzle?.status]);

    const puzzleSecondsRemaining = pendingPuzzle?.expiresAt
        ? Math.max(0, Math.ceil((new Date(pendingPuzzle.expiresAt).getTime() - puzzleNow) / 1000))
        : null;
    const puzzleTimeLabel = puzzleSecondsRemaining === null
        ? null
        : `${String(Math.floor(puzzleSecondsRemaining / 60)).padStart(2, '0')}:${String(puzzleSecondsRemaining % 60).padStart(2, '0')}`;

    useEffect(() => {
        if (
            pendingPuzzle?.status === 'in_progress'
            && puzzleSecondsRemaining === 0
            && refreshedExpiredPuzzleRef.current !== pendingPuzzle._id
        ) {
            refreshedExpiredPuzzleRef.current = pendingPuzzle._id;
            refreshPuzzleRef.current?.();
        }
    }, [pendingPuzzle?._id, pendingPuzzle?.status, puzzleSecondsRemaining]);

    useEffect(() => {
        if (
            callActive
            || !onVideoCallPress
            || storage.getBoolean(videoCallGuideStorageKey) === true
        ) {
            return undefined;
        }

        const timer = setTimeout(() => {
            storage.set(videoCallGuideStorageKey, true);
            setShowVideoCallGuide(true);
        }, 650);

        return () => clearTimeout(timer);
    }, [callActive, onVideoCallPress, videoCallGuideStorageKey]);

    const dismissVideoCallGuide = useCallback(() => {
        setShowVideoCallGuide(false);
        storage.set(videoCallGuideStorageKey, true);
    }, [videoCallGuideStorageKey]);

    const handleVideoCallPress = useCallback(() => {
        dismissVideoCallGuide();
        onVideoCallPress?.();
    }, [dismissVideoCallGuide, onVideoCallPress]);

    useEffect(() => {
        if (pendingPuzzle?.imageUrl) {
            prefetchPuzzleTexture(
                pendingPuzzle._id || pendingPuzzle.id,
                pendingPuzzle.imageUrl
            );
        }
    }, [pendingPuzzle?._id, pendingPuzzle?.id, pendingPuzzle?.imageUrl]);

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

    const currentUser = getUser();
    const currentUserId = currentUser?.id || currentUser?._id;
    const isPuzzleCreator = pendingPuzzle?.creatorId
        ? (pendingPuzzle.creatorId._id || pendingPuzzle.creatorId) === currentUserId
        : false;

    const games = [
        {
            key: 'puzzle',
            title: pendingPuzzle?.status === 'in_progress'
                ? (isPuzzleCreator ? translateUiTemplate("{{0}} is solving!", [partnerName]) : translateUiText("Puzzle in progress"))
                : pendingPuzzle
                    ? (isPuzzleCreator ? translateUiText("Puzzle sent 🧩") : translateUiText("Puzzle waiting"))
                    : translateUiText("Create puzzle"),
            subtitle: pendingPuzzle?.status === 'in_progress'
                ? (puzzleTimeLabel
                    ? (isPuzzleCreator
                        ? translateUiTemplate("⏱ {{0}} remaining · Watch live", [puzzleTimeLabel])
                        : translateUiTemplate("⏱ {{0}} remaining", [puzzleTimeLabel]))
                    : (isPuzzleCreator
                        ? translateUiText("Watch live 👀")
                        : translateUiText("Continue")))
                : pendingPuzzle
                    ? (isPuzzleCreator
                        ? translateUiTemplate("Waiting for {{0}} to start.", [partnerName])
                        : translateUiText("Your 5-minute timer starts after the preview."))
                    : translateUiText("A tiny photo challenge for two."),
            buttonLabel: pendingPuzzle?.status === 'in_progress'
                ? (isPuzzleCreator ? translateUiText("Watch live 👀") : translateUiText("Continue"))
                : pendingPuzzle
                    ? (isPuzzleCreator ? translateUiText("View") : translateUiText("Start"))
                    : translateUiText("Let's play"),
            gradient: ['#FFA852', '#FF6D26'],
            accent: '#FF9833',
            icon: 'puzzle',
            image: gameAssets.puzzle,
            cardStyle: styles.puzzleCard,
            imageStyle: styles.puzzleImage,
            onPress: pendingPuzzle ? () => onJigsawPlay?.(pendingPuzzle) : onJigsawCreate,
        },
        {
            key: 'tictactoe',
            title: pendingTicTacToe
                ? translateUiText("Your turn")
                : activeTicTacToe
                    ? translateUiTemplate("{{0}}'s turn", [partnerName])
                    : translateUiText("Tic tac toe"),
            subtitle: translateUiText("Play a quick little duel."),
            buttonLabel: pendingTicTacToe || activeTicTacToe ? translateUiText("Resume") : translateUiText("Start game"),
            gradient: ['#9A85FF', '#5C3AF5'],
            accent: '#7C61F8',
            icon: 'gamepad',
            image: gameAssets.tictactoe,
            cardStyle: styles.ticCard,
            imageStyle: styles.ticImage,
            active: !!pendingTicTacToe,
            onPress: () => onTicTacToePress?.(pendingTicTacToe || activeTicTacToe),
        },
        {
            key: 'wordle',
            title: pendingWordle
                ? translateUiText("Guess the word")
                : activeWordle
                    ? translateUiTemplate("{{0}}'s turn", [partnerName])
                    : translateUiText("Wordle"),
            subtitle: translateUiText("Set a secret word."),
            buttonLabel: pendingWordle || activeWordle ? translateUiText("Resume") : translateUiText("Play now"),
            gradient: ['#5CE5D2', '#32A292'],
            accent: '#48BFAE',
            icon: 'letter',
            image: gameAssets.wordle,
            cardStyle: styles.wordleCard,
            imageStyle: styles.wordleImage,
            active: !!pendingWordle,
            onPress: () => onWordlePress?.(pendingWordle || activeWordle),
        },
    ];

    return (
        <LinearGradient
            colors={['#F8D9EC', '#FFF7FA', '#FFF4F7', '#F7D8F2']}
            locations={[0, 0.34, 0.72, 1]}
            start={{ x: 0.25, y: 0 }}
            end={{ x: 0.75, y: 1 }}
            style={styles.gradient}
        >
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <View style={[styles.container, { paddingTop: insets.top + 4 }]}>
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 104 }]}
                >
                    <View style={styles.hero}>
                        <View style={styles.heroCopy}>
                            <Text style={styles.headerTitle}>{translateUiText("Play Games")}</Text>
                            <Text style={styles.headerSubtitle}>{translateUiText("Challenge your partner to a friendly duel!")}</Text>
                        </View>
                        <View style={styles.videoCallGuideAnchor}>
                            {showVideoCallGuide && (
                                <View style={styles.videoCallGuideRing} pointerEvents="none" />
                            )}
                            <TouchableOpacity
                                style={[
                                    styles.callCard,
                                    callActive && styles.callCardActive,
                                    !onVideoCallPress && styles.callCardDisabled,
                                ]}
                                onPress={handleVideoCallPress}
                                activeOpacity={0.82}
                                accessibilityRole="button"
                                accessibilityLabel={callActive ? translateUiText("Return to active call") : translateUiTemplate("Call {{0}}", [partnerName])}
                                accessibilityHint={!callActive && !partnerOnline ? translateUiTemplate("{{0}} is currently offline", [partnerName]) : undefined}
                                accessibilityState={{ disabled: !onVideoCallPress }}
                                disabled={!onVideoCallPress}
                            >
                                <LinearGradient
                                    colors={callActive ? ['#A982FF', '#7655ED'] : ['#F27CAC', '#D84F86']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.callIconBubble}
                                >
                                    <VideoCallIcon />
                                </LinearGradient>
                                <View style={styles.callCopy}>
                                    <Text style={styles.callTitle}>{callActive ? translateUiText("In call") : translateUiText("Call")}</Text>
                                    <View style={styles.callStatusRow}>
                                        <View
                                            style={[
                                                styles.callStatusDot,
                                                partnerOnline && styles.callStatusDotOnline,
                                                callActive && styles.callStatusDotActive,
                                            ]}
                                        />
                                        <Text
                                            style={[
                                                styles.callStatusText,
                                                callActive && styles.callStatusTextActive,
                                            ]}
                                        >
                                            {callActive ? translateUiText("Active") : partnerOnline ? translateUiText("Online") : translateUiText("Offline")}
                                        </Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                            {showVideoCallGuide && (
                                <View style={styles.videoCallGuide} accessibilityRole="alert">
                                    <View style={styles.videoCallGuideArrow} />
                                    <Text style={styles.videoCallGuideTitle}>{translateUiText("Play together on a call")}</Text>
                                    <Text style={styles.videoCallGuideText}>
                                        {translateUiTemplate("Start a call with {{0}} and keep talking while you play.", [partnerName])}
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.videoCallGuideButton}
                                        onPress={dismissVideoCallGuide}
                                        activeOpacity={0.8}
                                        accessibilityRole="button"
                                        accessibilityLabel={translateUiText("Dismiss video call guidance")}
                                    >
                                        <Text style={styles.videoCallGuideButtonText}>{translateUiText("Got it")}</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                        <Sparkle style={styles.heroSparkleOne} color="#FF9833" />
                        <Sparkle style={styles.heroSparkleTwo} color="#7C61F8" />
                    </View>

                    <View style={styles.listContainer}>
                        {games.map((game) => (
                        <TouchableOpacity
                            key={game.key}
                            style={[styles.gameCard, { minHeight: cardMinHeight }, game.cardStyle]}
                            onPress={game.onPress}
                            activeOpacity={0.9}
                            accessibilityRole="button"
                            accessibilityLabel={`${game.title}. ${game.subtitle}. ${game.buttonLabel}`}
                        >
                            <Sparkle style={styles.cardSparkleOne} />
                            <Sparkle style={styles.cardSparkleTwo} color="#FFE6C7" />
                            {game.active && (
                                <Animated.View
                                    style={[
                                        styles.activeBadge,
                                        { backgroundColor: game.accent, opacity: blinkAnim },
                                    ]}
                                >
                                    <Text style={styles.activeText}>{translateUiText("YOUR TURN")}</Text>
                                </Animated.View>
                            )}
                            <View style={styles.cardCopy}>
                                <View style={styles.headerRow}>
                                    <View style={[styles.iconChip, { backgroundColor: `${game.accent}24` }]}>
                                        <GameIcon type={game.icon} color={game.accent} size={18} />
                                    </View>
                                </View>
                                <Text style={styles.gameTitle} numberOfLines={2}>{game.title}</Text>
                                <Text style={styles.gameSubtitle} numberOfLines={2}>{game.subtitle}</Text>
                                <LinearGradient
                                    colors={game.gradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.cta}
                                >
                                    <Text style={styles.ctaText}>{game.buttonLabel}</Text>
                                    <View style={styles.ctaArrow}>
                                        <ArrowIcon color={game.accent} size={10} />
                                    </View>
                                </LinearGradient>
                            </View>
                            <Image
                                source={game.image}
                                style={[styles.gameImage, game.imageStyle]}
                                resizeMode="contain"
                                accessible={false}
                            />
                        </TouchableOpacity>
                        ))}
                    </View>

                  
                </ScrollView>
            </View>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    gradient: {
        flex: 1,
    },
    container: {
        flex: 1,
        paddingHorizontal: 18,
    },
    scrollContent: {
        paddingTop: 4,
    },
    hero: {
        paddingTop: 8,
        paddingBottom: 4,
        marginBottom: 14,
        zIndex: 20,
    },
    heroCopy: {
        width: '72%',
        zIndex: 2,
    },
    videoCallGuideAnchor: {
        position: 'absolute',
        right: 0,
        top: 8,
        width: 112,
        height: 48,
        zIndex: 30,
    },
    videoCallGuideRing: {
        position: 'absolute',
        top: -5,
        left: -5,
        width: 122,
        height: 58,
        borderRadius: 29,
        borderWidth: 3,
        borderColor: 'rgba(216,79,134,0.38)',
        backgroundColor: 'rgba(255,255,255,0.42)',
    },
    callCard: {
        width: 112,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minWidth: 108,
        minHeight: 48,
        paddingLeft: 5,
        paddingRight: 11,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderWidth: 1.5,
        borderColor: '#F4CCDD',
        shadowColor: '#B84C7D',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 4,
    },
    callCardActive: {
        borderColor: '#D8CAFF',
        backgroundColor: '#FBF9FF',
    },
    callCardDisabled: {
        opacity: 0.5,
    },
    callIconBubble: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#D84F86',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.22,
        shadowRadius: 7,
        elevation: 3,
    },
    callCopy: {
        justifyContent: 'center',
        minWidth: 42,
    },
    callTitle: {
        color: '#34244D',
        fontFamily: fontFamily.extraBold,
        fontSize: 13,
        lineHeight: 15,
    },
    callStatusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    callStatusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#B5A9B4',
    },
    callStatusDotOnline: {
        backgroundColor: '#45BE82',
    },
    callStatusDotActive: {
        backgroundColor: '#8062EE',
    },
    callStatusText: {
        color: '#9A8E9A',
        fontFamily: fontFamily.bold,
        fontSize: 9,
        lineHeight: 11,
    },
    callStatusTextActive: {
        color: '#8062EE',
    },
    videoCallGuide: {
        position: 'absolute',
        top: 62,
        right: 0,
        width: 240,
        paddingHorizontal: 16,
        paddingTop: 15,
        paddingBottom: 13,
        borderRadius: 18,
        backgroundColor: '#4B2947',
        shadowColor: '#321B33',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.22,
        shadowRadius: 16,
        elevation: 16,
    },
    videoCallGuideArrow: {
        position: 'absolute',
        top: -7,
        right: 48,
        width: 14,
        height: 14,
        backgroundColor: '#4B2947',
        transform: [{ rotate: '45deg' }],
    },
    videoCallGuideTitle: {
        color: '#FFFFFF',
        fontFamily: fontFamily.bold,
        fontSize: 15,
        marginBottom: 4,
    },
    videoCallGuideText: {
        color: '#F3E7F0',
        fontFamily: fontFamily.medium,
        fontSize: 12.5,
        lineHeight: 18,
    },
    videoCallGuideButton: {
        alignSelf: 'flex-end',
        marginTop: 10,
        paddingHorizontal: 13,
        paddingVertical: 7,
        borderRadius: 12,
        backgroundColor: '#F7D8E8',
    },
    videoCallGuideButtonText: {
        color: '#8D315F',
        fontFamily: fontFamily.bold,
        fontSize: 12,
    },
    headerTitle: {
        fontFamily: fontFamily.extraBold,
        fontSize: 32,
        fontWeight: fontWeight('800'),
        color: '#202B5E',
        letterSpacing: -0.5,
        marginBottom: 6,
    },
    headerSubtitle: {
        fontFamily: fontFamily.medium,
        fontSize: 16,
        lineHeight: 22,
        color: '#7F7AA5',
        fontWeight: fontWeight('500'),
    },
    heroSparkleOne: {
        right: '28%',
        top: 14,
    },
    heroSparkleTwo: {
        right: 12,
        bottom: 4,
    },
    listContainer: {
        gap: 16,
        zIndex: 1,
    },
    gameCard: {
        width: '100%',
        borderRadius: 20,
        borderWidth: 3,
        borderColor: 'rgba(255,255,255,0.8)',
        paddingHorizontal: 16,
        paddingVertical: 12,
        overflow: 'hidden',
        shadowColor: '#E4BCD7',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 3,
    },
    puzzleCard: {
        backgroundColor: '#FFF2E8',
    },
    ticCard: {
        backgroundColor: '#F6E9FF',
    },
    wordleCard: {
        backgroundColor: '#E7FBF7',
    },
    cardCopy: {
        width: '52%',
        justifyContent: 'center',
        zIndex: 2,
    },
    iconChip: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    activeBadge: {
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    activeText: {
        color: '#FFFFFF',
        fontFamily: fontFamily.extraBold,
        fontSize: 9,
        fontWeight: fontWeight('900'),
        letterSpacing: 0.5,
    },
    gameImage: {
        position: 'absolute',
        right: 0,
        bottom: 0,
        width: '45%',
        height: '90%',
    },
    puzzleImage: {
        right: -8,
        bottom: -6,
        width: '48%',
        height: '92%',
    },
    ticImage: {
        right: -8,
        bottom: -6,
        width: '46%',
        height: '92%',
    },
    wordleImage: {
        right: -10,
        bottom: -8,
        width: '48%',
        height: '94%',
    },
    gameTitle: {
        color: '#202B5E',
        fontFamily: fontFamily.extraBold,
        fontSize: 18,
        fontWeight: fontWeight('800'),
        letterSpacing: -0.2,
        marginTop: 4,
    },
    gameSubtitle: {
        color: '#7E7D91',
        fontFamily: fontFamily.medium,
        fontSize: 13,
        fontWeight: fontWeight('500'),
        lineHeight: 16,
        marginTop: 3,
    },
    cta: {
        alignSelf: 'flex-start',
        height: 36,
        borderRadius: 18,
        paddingLeft: 16,
        paddingRight: 6,
        marginTop: 10,
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    ctaText: {
        color: '#FFFFFF',
        fontFamily: fontFamily.extraBold,
        fontSize: 12,
        fontWeight: fontWeight('800'),
    },
    ctaArrow: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.7)',
    },
    sparkle: {
        position: 'absolute',
        width: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 3,
    },
    sparkleLine: {
        position: 'absolute',
        width: 5,
        height: 18,
        borderRadius: 4,
        transform: [{ rotate: '45deg' }],
    },
    sparkleLineCross: {
        position: 'absolute',
        width: 5,
        height: 18,
        borderRadius: 4,
        transform: [{ rotate: '-45deg' }],
    },
    cardSparkleOne: {
        right: '48%',
        top: 14,
    },
    cardSparkleTwo: {
        right: 12,
        top: 10,
        transform: [{ scale: 0.6 }],
    },
});

export default GamesScreen;
