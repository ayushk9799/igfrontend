import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Dimensions,
    Image,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { fontFamily, fontWeight } from '../constants/fonts';

const { width } = Dimensions.get('window');
const CARD_HEIGHT = Math.max(136, Math.min(146, width * 0.38));

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
    const blinkAnim = useRef(new Animated.Value(1)).current;

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

    const games = [
        {
            key: 'puzzle',
            title: pendingPuzzle ? 'Puzzle waiting' : 'Create puzzle',
            subtitle: 'A tiny photo challenge for two.',
            buttonLabel: pendingPuzzle ? 'Continue' : "Let's play",
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
            title: pendingTicTacToe ? 'Your turn' : activeTicTacToe ? `${partnerName}'s turn` : 'Tic tac toe',
            subtitle: 'Play a quick little duel.',
            buttonLabel: pendingTicTacToe || activeTicTacToe ? 'Resume' : 'Start game',
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
            title: pendingWordle ? 'Guess the word' : activeWordle ? `${partnerName}'s turn` : 'Wordle',
            subtitle: 'Set a secret word.',
            buttonLabel: pendingWordle || activeWordle ? 'Resume' : 'Play now',
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
            <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 104 }]}
                >
                    <View style={styles.hero}>
                        <View style={styles.heroCopy}>
                            <Text style={styles.headerTitle}>Play Games</Text>
                            <Text style={styles.headerSubtitle}>Challenge your partner to a friendly duel!</Text>
                        </View>
                        <TouchableOpacity
                            style={[styles.callPill, !partnerOnline && !callActive && styles.callPillOffline]}
                            onPress={onVideoCallPress}
                            activeOpacity={0.82}
                        >
                            <Text style={styles.callPillIcon}>▣</Text>
                            <Text style={styles.callPillText}>{callActive ? 'In call' : 'Call'}</Text>
                        </TouchableOpacity>
                        <Sparkle style={styles.heroSparkleOne} color="#FF9833" />
                        <Sparkle style={styles.heroSparkleTwo} color="#7C61F8" />
                    </View>

                    <View style={styles.listContainer}>
                        {games.map((game) => (
                        <TouchableOpacity
                            key={game.key}
                            style={[styles.gameCard, game.cardStyle]}
                            onPress={game.onPress}
                            activeOpacity={0.9}
                        >
                            <Sparkle style={styles.cardSparkleOne} />
                            <Sparkle style={styles.cardSparkleTwo} color="#FFE6C7" />
                            <View style={styles.cardCopy}>
                                <View style={styles.headerRow}>
                                    <View style={[styles.iconChip, { backgroundColor: `${game.accent}24` }]}>
                                        <GameIcon type={game.icon} color={game.accent} size={18} />
                                    </View>
                                    {game.active && (
                                        <Animated.View style={[styles.activeBadge, { backgroundColor: game.accent, opacity: blinkAnim }]}>
                                            <Text style={styles.activeText}>YOUR TURN</Text>
                                        </Animated.View>
                                    )}
                                </View>
                                <Text style={styles.gameTitle}>{game.title}</Text>
                                <Text style={styles.gameSubtitle}>{game.subtitle}</Text>
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
                            <Image source={game.image} style={[styles.gameImage, game.imageStyle]} resizeMode="contain" />
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
    },
    heroCopy: {
        width: '72%',
        zIndex: 2,
    },
    callPill: {
        position: 'absolute',
        right: 0,
        top: 8,
        zIndex: 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 13,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#D84F86',
    },
    callPillOffline: {
        backgroundColor: '#B9AAB7',
    },
    callPillIcon: {
        color: '#FFFFFF',
        fontSize: 14,
    },
    callPillText: {
        color: '#FFFFFF',
        fontFamily: fontFamily.extraBold,
        fontSize: 13,
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
    heroImage: {
        position: 'absolute',
        right: -58,
        bottom: -10,
        width: width * 0.8,
        height: 210,
        opacity: 0.98,
    },
    heroSparkleOne: {
        right: width * 0.28,
        top: 14,
    },
    heroSparkleTwo: {
        right: 12,
        bottom: 4,
    },
    listContainer: {
        gap: 16,
    },
    gameCard: {
        width: '100%',
        height: CARD_HEIGHT,
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
        height: '100%',
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
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        marginLeft: 8,
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
    footerBanner: {
        minHeight: 86,
        borderRadius: 24,
        backgroundColor: '#F7E4FF',
        marginTop: 12,
        paddingHorizontal: 26,
        flexDirection: 'row',
        alignItems: 'center',
        overflow: 'hidden',
    },
    giftBox: {
        width: 58,
        height: 58,
        marginRight: 18,
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    giftLid: {
        width: 48,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#D083FF',
    },
    giftBody: {
        width: 44,
        height: 38,
        borderRadius: 8,
        backgroundColor: '#9A66EE',
    },
    giftRibbonVertical: {
        position: 'absolute',
        bottom: 0,
        width: 10,
        height: 48,
        backgroundColor: '#FF7BB4',
    },
    giftRibbonHorizontal: {
        position: 'absolute',
        bottom: 20,
        width: 48,
        height: 8,
        backgroundColor: '#FF7BB4',
    },
    footerCopy: {
        flex: 1,
    },
    footerTitle: {
        color: '#6F56D9',
        fontFamily: fontFamily.extraBold,
        fontSize: 19,
        fontWeight: fontWeight('800'),
    },
    footerText: {
        color: '#8C78BE',
        fontFamily: fontFamily.bold,
        fontSize: 16,
        fontWeight: fontWeight('600'),
        marginTop: 4,
    },
    footerHeart: {
        width: 42,
        height: 38,
        transform: [{ rotate: '-45deg' }],
    },
    footerHeartLeft: {
        position: 'absolute',
        left: 0,
        top: 8,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#FF6D9C',
    },
    footerHeartRight: {
        position: 'absolute',
        right: 0,
        top: 8,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#FF6D9C',
    },
    footerHeartBottom: {
        position: 'absolute',
        left: 9,
        top: 14,
        width: 24,
        height: 24,
        borderRadius: 5,
        backgroundColor: '#FF6D9C',
    },
});

export default GamesScreen;
