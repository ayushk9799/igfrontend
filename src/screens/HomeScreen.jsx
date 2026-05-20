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
import LottieView from 'lottie-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { TOPIC_CATEGORIES } from '../constants/Categories';
import { getPenguinMoodImage } from '../constants/PenguinMoods';
import { colors } from '../theme';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 92) / 4;

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
    const categories = Object.values(TOPIC_CATEGORIES).slice(0, 6);
    const partnerMoodLabel = partnerMood?.label || partnerMood?.mood || 'Waiting';
     const penguinMoodImage = getPenguinMoodImage(partnerMood?.id, yourMood?.id);
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
                        <TouchableOpacity style={styles.canvasCard} onPress={onScribblePress} activeOpacity={0.9}>
                            <Text style={styles.smallCardTitle}>Scribble board</Text>
                            {partnerScribble?.paths?.length > 0 ? (
                                <Svg width="100%" height={92} viewBox="0 0 320 180">
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
                                <LottieView source={require('../../assets/canvas2.lottie')} autoPlay loop={false} style={styles.canvasLottie} />
                            )}
                        </TouchableOpacity>

                        <View style={styles.streakCard}>
                            <Text style={styles.smallCardTitle}>Together</Text>
                            <Text style={styles.daysText}>{daysTogether || 1}</Text>
                            <Text style={styles.daysLabel}>{daysTogether === 1 ? 'day' : 'days'}</Text>
                            <Text style={styles.daysSub}>growing gently</Text>
                        </View>
                    </View>

                
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Deepen your connection</Text>
                    </View>
                    <View style={styles.topicGrid}>
                        {categories.map((cat) => (
                            <TouchableOpacity
                                key={cat._id || cat.id}
                                style={[styles.topicCard, { backgroundColor: cat.color || '#8B7CFF' }]}
                                onPress={() => onQuestionPress?.(cat)}
                                activeOpacity={0.88}
                            >
                                <Text style={styles.topicEmoji}>{cat.emoji || '♡'}</Text>
                                <Text style={styles.topicTitle} numberOfLines={1}>{cat.title}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {!hasPartner && (
                        <TouchableOpacity style={styles.linkPartnerCard} onPress={onFindPartner} activeOpacity={0.9}>
                            <Text style={styles.linkPartnerTitle}>Find your partner</Text>
                            <Text style={styles.linkPartnerText}>Connect with someone special and start your Penguin story.</Text>
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
        fontWeight: '900',
    },
    greetingBlock: {
        marginBottom: 14,
    },
    greeting: {
        fontSize: 25,
        fontWeight: '900',
        color: '#171B44',
    },
    greetingSub: {
        color: '#6F6998',
        fontSize: 14,
        fontWeight: '600',
        marginTop: 4,
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
        fontWeight: '800',
    },
    partnerMoodText: {
        color: '#FF6F8F',
        fontSize: 20,
        fontWeight: '900',
        marginTop: 5,
    },
    cardMeta: {
        color: '#817A9F',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 5,
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
        fontWeight: '900',
        marginBottom: 12,
    },
    quickGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8,
    },
    quickCard: {
        width: CARD_WIDTH,
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
        fontWeight: '800',
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
        fontWeight: '700',
    },
    quoteSub: {
        color: '#6F6998',
        fontSize: 13,
        fontWeight: '600',
        marginTop: 3,
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
        fontWeight: '900',
        marginTop: 4,
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
        fontWeight: '600',
        marginTop: 12,
    },
    twoColumn: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 14,
    },
    canvasCard: {
        flex: 1.35,
        height: 148,
        borderRadius: 20,
        overflow: 'hidden',
        padding: 14,
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderWidth: 1,
        borderColor: '#F8DDE8',
        ...cardShadow,
    },
    smallCardTitle: {
        color: '#171B44',
        fontSize: 14,
        fontWeight: '900',
        marginBottom: 6,
    },
    canvasLottie: {
        width: '100%',
        height: 96,
    },
    streakCard: {
        flex: 1,
        height: 148,
        borderRadius: 20,
        padding: 14,
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderWidth: 1,
        borderColor: '#F8DDE8',
        ...cardShadow,
    },
    daysText: {
        color: '#FF758F',
        fontSize: 38,
        fontWeight: '900',
        marginTop: 4,
    },
    daysLabel: {
        color: '#171B44',
        fontSize: 14,
        fontWeight: '900',
        marginTop: -3,
    },
    daysSub: {
        color: '#817A9F',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 8,
    },
    sectionHeader: {
        marginTop: 24,
        marginBottom: 12,
    },
    sectionTitle: {
        color: '#171B44',
        fontSize: 19,
        fontWeight: '900',
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
        fontWeight: '900',
    },
    gameSubtitle: {
        color: 'rgba(255,255,255,0.86)',
        fontSize: 12,
        fontWeight: '600',
        lineHeight: 17,
        marginTop: 6,
    },
    topicGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    topicCard: {
        width: (width - 50) / 2,
        minHeight: 76,
        borderRadius: 18,
        padding: 14,
        justifyContent: 'center',
        overflow: 'hidden',
    },
    topicEmoji: {
        fontSize: 20,
        marginBottom: 5,
    },
    topicTitle: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '900',
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
        fontWeight: '900',
        marginBottom: 7,
    },
    linkPartnerText: {
        color: '#6F6998',
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '600',
    },
});

export default HomeScreen;
