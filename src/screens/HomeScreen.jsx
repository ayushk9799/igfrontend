import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Image,
    Animated,
    Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import LottieView from 'lottie-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '../theme';
import GradientBackground from '../components/GradientBackground';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { API_BASE } from '../constants/Api';
import { TOPIC_CATEGORIES } from '../constants/Categories';
import { getEmojiById } from '../constants/Moods';

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
    // Daily Challenge props - NEW
    todayChallenge = null,
    challengeProgress = { completedCount: 0, totalTasks: 0, isComplete: false },
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
    // Topic-based categories - only questions come from backend
    const categories = Object.values(TOPIC_CATEGORIES);

    // Refresh puzzles on mount
    useEffect(() => {
        if (onRefreshPuzzle) {
            onRefreshPuzzle();
        }
    }, []);

    // Blinking dot animation for Tic Tac Toe "Your turn" indicator
    const blinkAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (pendingTicTacToe || pendingWordle) {
            // Create blinking animation for the dot
            const blinkAnimation = Animated.loop(
                Animated.sequence([
                    Animated.timing(blinkAnim, {
                        toValue: 0.2,
                        duration: 600,
                        useNativeDriver: true,
                    }),
                    Animated.timing(blinkAnim, {
                        toValue: 1,
                        duration: 600,
                        useNativeDriver: true,
                    }),
                ])
            );
            blinkAnimation.start();

            return () => blinkAnimation.stop();
        } else {
            blinkAnim.setValue(1);
        }
    }, [pendingTicTacToe, pendingWordle, blinkAnim]);
    // Get current time of day
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    };

    const getUserName = () => {
        // Extract first name from full name
        const userName = yourMood?.userName || 'You';
        return userName.split(' ')[0];
    };

    // Get Lottie sources for animated emoji rendering
    const yourLottie = yourMood?.id ? getEmojiById(yourMood.id)?.lottieSource : null;
    const partnerLottie = partnerMood?.id ? getEmojiById(partnerMood.id)?.lottieSource : null;

    return (
        <View style={{ flex: 1, backgroundColor: '#000000' }}>
            <SafeAreaView style={styles.container} edges={['top']}>
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        {/* Logo - Two interlocking circles */}
                        <View style={styles.brandContainer}>
                            <Text style={styles.brandName}>penguin.</Text>
                        </View>



                        <View style={styles.headerRight}>
                            {/* Bell / Notification Icon */}
                            <TouchableOpacity style={styles.settingsButton} onPress={onNotificationPress}>
                                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                                    <Path
                                        d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"
                                        stroke="#FFFFFF"
                                        strokeWidth={2}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </Svg>
                                {duelBadgeCount > 0 && (
                                    <View style={styles.bellBadge}>
                                        <Text style={styles.bellBadgeText}>{duelBadgeCount > 9 ? '9+' : duelBadgeCount}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>

                            {/* Settings Icon */}
                            <TouchableOpacity style={styles.settingsButton} onPress={onSettingsPress}>
                                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                                    <Path
                                        d="M12 15a3 3 0 100-6 3 3 0 000 6z"
                                        stroke="#FFFFFF"
                                        strokeWidth={2}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                    <Path
                                        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"
                                        stroke="#FFFFFF"
                                        strokeWidth={2}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </Svg>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Names Section - Removed names, keeping Link Partner if needed */}

                    {/* Mood Blobs Section */}
                    <View style={styles.moodSection}>
                        {/* Mood Card */}
                        <View style={styles.moodCard}>
                            {/* Partner's large emoji in the center */}
                            <View style={styles.partnerEmojiContainer}>
                                {partnerLottie ? (
                                    <LottieView
                                        source={partnerLottie}
                                        autoPlay
                                        loop
                                        style={{ width: 140, height: 140 }}
                                    />
                                ) : (
                                    <Text style={styles.partnerEmojiLarge}>{partnerMood?.emoji || '😊'}</Text>
                                )}
                            </View>

                            {/* Your emoji badge on the boundary of partner's circle */}
                            <View style={styles.yourEmojiBadge}>
                                {yourLottie ? (
                                    <LottieView
                                        source={yourLottie}
                                        autoPlay
                                        loop
                                        style={{ width: 44, height: 44 }}
                                    />
                                ) : (
                                    <Text style={styles.yourEmojiSmall}>{yourMood?.emoji || '😊'}</Text>
                                )}
                            </View>
                        </View>


                        {/* Conditional Button based on hasPartner */}
                        {hasPartner ? (
                            <TouchableOpacity
                                style={styles.updateMoodButton}
                                onPress={onMoodPress}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.updateMoodText}>Update my Mood</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={[styles.updateMoodButton, { backgroundColor: '#000000', overflow: 'hidden' }]}
                                onPress={onFindPartner}
                                activeOpacity={0.8}
                            >
                                {/* Background Stars */}
                                <View style={StyleSheet.absoluteFill}>
                                    <Svg height="100%" width="100%">
                                        {/* Background Glows - subtle and offset */}
                                        <Circle cx="35%" cy="45%" r="22" fill="white" opacity="0.04" />
                                        <Circle cx="80%" cy="20%" r="18" fill="white" opacity="0.03" />
                                        <Circle cx="10%" cy="80%" r="15" fill="white" opacity="0.02" />

                                        {/* Little dot stars (varied distant background) */}
                                        <Circle cx="12%" cy="25%" r="0.5" fill="white" opacity="0.6" />
                                        <Circle cx="92%" cy="15%" r="0.7" fill="white" opacity="0.4" />
                                        <Circle cx="45%" cy="12%" r="0.4" fill="white" opacity="0.7" />
                                        <Circle cx="28%" cy="78%" r="0.6" fill="white" opacity="0.5" />
                                        <Circle cx="65%" cy="82%" r="0.5" fill="white" opacity="0.3" />
                                        <Circle cx="88%" cy="65%" r="0.7" fill="white" opacity="0.6" />
                                        <Circle cx="5%" cy="55%" r="0.4" fill="white" opacity="0.5" />
                                        <Circle cx="55%" cy="60%" r="0.6" fill="white" opacity="0.4" />
                                        <Circle cx="35%" cy="30%" r="0.5" fill="white" opacity="0.6" />
                                        <Circle cx="75%" cy="35%" r="0.4" fill="white" opacity="0.5" />

                                        {/* 5-pointed stars (randomized positions and sizes) */}
                                        <Path
                                            d="M3.5 0L4.3 2.1L6.6 2.1L4.8 3.5L5.4 5.6L3.5 4.3L1.6 5.6L2.3 3.5L0.4 2.1L2.7 2.1L3.5 0Z"
                                            fill="white"
                                            transform="translate(42, 12) scale(1.1)"
                                            opacity="0.9"
                                        />
                                        <Path
                                            d="M3.5 0L4.3 2.1L6.6 2.1L4.8 3.5L5.4 5.6L3.5 4.3L1.6 5.6L2.3 3.5L0.4 2.1L2.7 2.1L3.5 0Z"
                                            fill="white"
                                            transform="translate(265, 32) scale(0.7)"
                                            opacity="0.6"
                                        />
                                        <Path
                                            d="M3.5 0L4.3 2.1L6.6 2.1L4.8 3.5L5.4 5.6L3.5 4.3L1.6 5.6L2.3 3.5L0.4 2.1L2.7 2.1L3.5 0Z"
                                            fill="white"
                                            transform="translate(135, 18) scale(0.9)"
                                            opacity="0.8"
                                        />
                                        <Path
                                            d="M3.5 0L4.3 2.1L6.6 2.1L4.8 3.5L5.4 5.6L3.5 4.3L1.6 5.6L2.3 3.5L0.4 2.1L2.7 2.1L3.5 0Z"
                                            fill="white"
                                            transform="translate(205, 40) scale(0.6)"
                                            opacity="0.5"
                                        />

                                        {/* Sparkles (spread out more) */}
                                        <Path
                                            d="M4 0V8M0 4H8"
                                            stroke="white"
                                            strokeWidth="0.5"
                                            transform="translate(195, 8)"
                                            opacity="0.5"
                                        />
                                        <Path
                                            d="M3 0V6M0 3H6"
                                            stroke="white"
                                            strokeWidth="0.4"
                                            transform="translate(22, 38)"
                                            opacity="0.4"
                                        />
                                        <Path
                                            d="M3 0V6M0 3H6"
                                            stroke="white"
                                            strokeWidth="0.4"
                                            transform="translate(315, 25)"
                                            opacity="0.5"
                                        />
                                        <Path
                                            d="M2 0V4M0 2H4"
                                            stroke="white"
                                            strokeWidth="0.3"
                                            transform="translate(110, 45)"
                                            opacity="0.4"
                                        />
                                    </Svg>
                                </View>
                                <Text style={[styles.updateMoodText, { color: '#FFFFFF' }]}>Link Partner </Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Action Cards */}
                    <View style={styles.cardsContainer}>
                        {/* Today's Question Card - Premium Design */}
                        <TouchableOpacity
                            style={[styles.card, styles.questionCard]}
                            onPress={() => onQuestionPress?.()}
                            activeOpacity={0.9}
                        >
                            {/* Rich Gradient Background */}
                            <LinearGradient
                                colors={['#4A2C6A', '#6B3FA0', '#8B5FBF']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.cardGradient}
                            />

                            {/* Decorative floating circles */}
                            <View style={styles.questionDecorCircle1} />
                            <View style={styles.questionDecorCircle2} />
                            <View style={styles.questionDecorCircle3} />

                            {/* Content Container */}
                            <View style={styles.questionCardContent}>
                                {/* Top Row: Label + Icon */}
                                <View style={styles.questionTopRow}>
                                    <Text style={styles.questionLabel}>DAILY</Text>
                                    <View style={styles.questionIconBadge}>
                                        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                                            <Path
                                                d="M12 2L14.4 8.2L21 9L16 13.5L17.5 20L12 16.8L6.5 20L8 13.5L3 9L9.6 8.2L12 2Z"
                                                fill="#FFFFFF"
                                            />
                                        </Svg>
                                    </View>
                                </View>

                                {/* Main Title */}
                                <Text style={styles.questionCardTitle}>Today's Question</Text>

                                {/* Question Preview */}
                                <Text style={styles.questionPreviewText} numberOfLines={2}>
                                    {todayChallenge?.tasks?.[0]?.taskstatement || "What's one small thing I did this week that made you feel loved?"}
                                </Text>

                                {/* Bottom Arrow Indicator */}
                                <View style={styles.questionArrowContainer}>
                                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                                        <Path
                                            d="M5 12h14M12 5l7 7-7 7"
                                            stroke="#FFFFFF"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    </Svg>
                                </View>
                            </View>
                        </TouchableOpacity>

                        {/* Our Canvas Card */}
                        <TouchableOpacity
                            style={[styles.card, styles.canvasCard]}
                            onPress={onScribblePress}
                            activeOpacity={0.9}
                        >
                            {partnerScribble && partnerScribble.paths && partnerScribble.paths.length > 0 ? (
                                <View style={styles.canvasPreviewContainer}>
                                    <Svg
                                        width="100%"
                                        height="100%"
                                        viewBox="0 0 320 320"
                                        preserveAspectRatio="xMidYMid meet"
                                    >
                                        {partnerScribble.paths.map((path, index) => (
                                            <Path
                                                key={index}
                                                d={path.d}
                                                stroke={path.color}
                                                strokeWidth={path.strokeWidth}
                                                fill="none"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        ))}
                                    </Svg>
                                </View>
                            ) : (
                                <View style={styles.canvasLottieContainer}>
                                    <LottieView
                                        source={require('../../assets/canvas2.lottie')}
                                        autoPlay
                                        loop={false}
                                        style={styles.canvasLottie}
                                    />
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Duels Section - Games like Jigsaw, Tic Tac Toe, Wordle */}
                    <View style={styles.arcadeSection}>
                        <View style={styles.arcadeHeader}>
                            <Text style={styles.arcadeSectionTitle}>Duels</Text>

                        </View>

                        {/* Horizontal Scrollable Games */}
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.arcadeScrollContent}
                        >
                            {/* Jigsaw Puzzle Card */}
                            <TouchableOpacity
                                style={[styles.arcadeCard, styles.arcadeCardOrange]}
                                onPress={pendingPuzzle ? () => onJigsawPlay?.(pendingPuzzle) : onJigsawCreate}
                                activeOpacity={0.9}
                            >
                                {/* Game Icon */}
                                <View style={styles.arcadeIconContainer}>
                                    <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                                        <Path
                                            d="M20 11V7a2 2 0 00-2-2h-3.5a2.5 2.5 0 110-5 2.5 2.5 0 110 5H11a2 2 0 00-2 2v3.5a2.5 2.5 0 11-5 0 2.5 2.5 0 115 0V14a2 2 0 002 2h3.5a2.5 2.5 0 110 5 2.5 2.5 0 110-5H18a2 2 0 002-2v-3z"
                                            fill="#FFFFFF"
                                        />
                                    </Svg>
                                </View>

                                {/* Game Info */}
                                <Text style={styles.arcadeGameLabel}>jigsaw puzzle</Text>
                                <Text style={styles.arcadeGameTitle}>
                                    {pendingPuzzle ? 'Puzzle waiting!' : 'Create \n & share.'}
                                </Text>
                            </TouchableOpacity>

                            {/* Tic Tac Toe Card - Teal */}
                            <TouchableOpacity
                                style={[
                                    styles.arcadeCard,
                                    styles.arcadeCardTeal,
                                ]}
                                onPress={() => onTicTacToePress?.(pendingTicTacToe || activeTicTacToe)}
                                activeOpacity={0.9}
                            >
                                {/* Blinking "Your Turn" Indicator Dot */}
                                {!!pendingTicTacToe && (
                                    <Animated.View
                                        style={[
                                            styles.blinkingDot,
                                            { opacity: blinkAnim },
                                        ]}
                                    />
                                )}

                                {/* Game Icon - Tic Tac Toe grid */}
                                <View style={styles.arcadeIconContainer}>
                                    <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                                        {/* Grid lines */}
                                        <Path
                                            d="M8 4v16M16 4v16M4 8h16M4 16h16"
                                            stroke="#FFFFFF"
                                            strokeWidth={2}
                                            strokeLinecap="round"
                                        />
                                    </Svg>
                                </View>

                                {/* Game Info */}
                                <Text style={styles.arcadeGameLabel}>tic tac toe</Text>
                                <Text style={styles.arcadeGameTitle}>
                                    {pendingTicTacToe ? 'Your \n turn!' : activeTicTacToe ? `${partnerName}'s \n turn` : 'Challenge partner.'}
                                </Text>
                            </TouchableOpacity>

                            {/* Wordle Card - Green */}
                            <TouchableOpacity
                                style={[
                                    styles.arcadeCard,
                                    styles.arcadeCardGreen,
                                ]}
                                onPress={() => onWordlePress?.(pendingWordle || activeWordle)}
                                activeOpacity={0.9}
                            >
                                {/* Blinking indicator for pending */}
                                {!!pendingWordle && (
                                    <Animated.View
                                        style={[
                                            styles.blinkingDot,
                                            { opacity: blinkAnim },
                                        ]}
                                    />
                                )}

                                <View style={styles.arcadeIconContainer}>
                                    <Text style={styles.wordleIconText}>W</Text>
                                </View>

                                {/* Game Info */}
                                <Text style={styles.arcadeGameLabel}>wordle</Text>
                                <Text style={styles.arcadeGameTitle}>
                                    {pendingWordle ? 'Guess the word!' : activeWordle ? `${partnerName}'s \n turn` : 'Set a word.'}
                                </Text>
                            </TouchableOpacity>


                        </ScrollView>
                    </View>

                    {/* Topic Question Sections - Each topic has its own arcade-style section */}
                    {categories.map((cat) => (
                        <View key={cat._id || cat.id} style={styles.arcadeSection}>
                            {/* Topic Header */}
                            <View style={styles.arcadeHeader}>
                                <View style={styles.topicTitleRow}>
                                    <Text style={styles.arcadeSectionTitle}>{cat.title}</Text>
                                </View>

                            </View>

                            {/* Horizontal Scrollable Cards - matching Duels style */}
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.arcadeScrollContent}
                            >
                                {/* Main Topic Card */}
                                <TouchableOpacity
                                    style={[styles.topicQuestionCard, { backgroundColor: cat.color || colors.primary }]}
                                    onPress={() => onQuestionPress?.(cat)}
                                    activeOpacity={0.9}
                                >
                                    {/* Topic Icon */}
                                    <View style={styles.arcadeIconContainer}>
                                        {cat.id === 'future' && (
                                            <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                                                <Circle cx="12" cy="12" r="6" fill="#FFFFFF" opacity={0.9} />
                                                <Circle cx="12" cy="12" r="9" stroke="#FFFFFF" strokeWidth={2} opacity={0.5} />
                                                <Path d="M12 6v1M12 17v1M6 12h1M17 12h1" stroke="#FFFFFF" strokeWidth={1.5} strokeLinecap="round" />
                                                <Circle cx="10" cy="10" r="1.5" fill="#FFFFFF" opacity={0.6} />
                                            </Svg>
                                        )}
                                        {cat.id === 'money' && (
                                            <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                                                <Circle cx="12" cy="12" r="10" stroke="#FFFFFF" strokeWidth={2} />
                                                <Path d="M12 6v12M9 9c0-1.1.9-2 2-2h2c1.1 0 2 .9 2 2s-.9 2-2 2h-2c-1.1 0-2 .9-2 2s.9 2 2 2h2c1.1 0 2-.9 2-2" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" />
                                            </Svg>
                                        )}
                                        {cat.id === 'hotspicy' && (
                                            <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                                                <Path
                                                    d="M12 2c.3 3.5-1.5 5.5-3 7.5-1.5 2-2 4-2 5.5 0 3.5 2.5 6 6 6s6-2.5 6-6c0-4-3.5-7-4-10.5-.5 2.5-1 3.5-3 2.5z"
                                                    fill="#FFFFFF"
                                                />
                                                <Path
                                                    d="M12 22c-2 0-3.5-1.5-3.5-3.5 0-2 1.5-3 2.5-4 .5.5 1 1 1 2 .5-1.5 1-2.5 1-4 1 1.5 2.5 3 2.5 5.5 0 2-1.5 4-3.5 4z"
                                                    fill="#FFFFFF"
                                                    opacity={0.6}
                                                />
                                            </Svg>
                                        )}
                                        {cat.id === 'political' && (
                                            <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                                                <Path d="M19 5l-7 4V5l-7 4v6l7 4v-4l7 4V5z" fill="#FFFFFF" />
                                                <Rect x="3" y="9" width="3" height="6" rx="1" fill="#FFFFFF" opacity={0.8} />
                                            </Svg>
                                        )}
                                        {cat.id === 'fitness' && (
                                            <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                                                <Path d="M6 12h12" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" />
                                                <Rect x="2" y="8" width="4" height="8" rx="1" fill="#FFFFFF" />
                                                <Rect x="18" y="8" width="4" height="8" rx="1" fill="#FFFFFF" />
                                                <Rect x="4" y="6" width="2" height="12" rx="1" fill="#FFFFFF" opacity={0.7} />
                                                <Rect x="18" y="6" width="2" height="12" rx="1" fill="#FFFFFF" opacity={0.7} />
                                            </Svg>
                                        )}
                                        {cat.id === 'travel' && (
                                            <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                                                <Path
                                                    d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"
                                                    fill="#FFFFFF"
                                                />
                                            </Svg>
                                        )}
                                        {cat.id === 'family' && (
                                            <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                                                <Path
                                                    d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                                                    fill="#FFFFFF"
                                                />
                                                <Circle cx="12" cy="10" r="2" fill="#FFFFFF" opacity={0.5} />
                                            </Svg>
                                        )}
                                        {/* Fallback icon */}
                                        {!['future', 'money', 'hotspicy', 'political', 'fitness', 'travel', 'family'].includes(cat.id) && (
                                            <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                                                <Path
                                                    d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
                                                    fill="#FFFFFF"
                                                />
                                            </Svg>
                                        )}
                                    </View>

                                    {/* Chilli image on right side for Hot & Spicy */}
                                    {cat.id === 'hotspicy' && (
                                        <Image
                                            source={require('../../assets/chilli.png')}
                                            style={styles.chilliImage}
                                        />
                                    )}

                                    {/* Coins image on right side for Money */}
                                    {cat.id === 'money' && (
                                        <Image
                                            source={require('../../assets/coins.png')}
                                            style={styles.coinsImage}
                                        />
                                    )}

                                    {/* Couple cutout image on right side for Future */}
                                    {cat.id === 'future' && (
                                        <Image
                                            source={require('../../assets/couplecutout.png')}
                                            style={styles.coupleCutoutImage}
                                        />
                                    )}

                                    {/* Arrow SVG on right side for Political */}
                                    {cat.id === 'political' && (
                                        <View style={styles.politicalArrowContainer}>
                                            <Svg width={120} height={120} viewBox="0 0 103.25286 104.92257" fill="none">
                                                <Path
                                                    d="M36.77 103.92l32.981-0.57435c-5.6142-39.509-1.4266-53.362 17.893-71.811l11.512 8.8387 3.1033-33.811-35.053 7.6966 7.8013 7.5953c-14.271 13.939-19.147 25.178-21.823 35.657-5.0418-15.582-15.332-26.701-25.578-34.315l9.1498-8.9947-32.569-8.4334 0.12983 4.9019 0.87533 33.05 11.094-10.56c27.286 25.007 20.854 36.016 20.485 70.76z"
                                                    fill="rgba(255, 255, 255, 0.25)"
                                                />
                                            </Svg>
                                        </View>
                                    )}

                                    {/* Couple running image on right side for Fitness */}
                                    {cat.id === 'fitness' && (
                                        <Image
                                            source={require('../../assets/couplerunning.png')}
                                            style={styles.fitnessImage}
                                        />
                                    )}

                                    {/* Travel image on right side for Travel */}
                                    {cat.id === 'travel' && (
                                        <Image
                                            source={require('../../assets/travel.png')}
                                            style={styles.travelImage}
                                        />
                                    )}

                                    {/* Family image on right side for Family */}
                                    {cat.id === 'family' && (
                                        <Image
                                            source={require('../../assets/couplekids5.png')}
                                            style={styles.familyImage}
                                        />
                                    )}

                                    {/* Card Info */}
                                    <Text style={styles.arcadeGameTitle} numberOfLines={2}>
                                        {cat.subtitle || cat.title}
                                    </Text>
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    ))}
                    {!hasPartner && (
                        <View style={styles.noPartnerContainer}>
                            <Text style={styles.noPartnerTitle}>Find Your Partner</Text>
                            <Text style={styles.noPartnerText}>
                                Connect with someone special and start your journey together.
                            </Text>
                            <TouchableOpacity
                                style={styles.findPartnerButton}
                                onPress={onFindPartner}
                            >
                                <Text style={styles.findPartnerText}>Get Started</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </ScrollView>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 100, // Space for bottom tab bar
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 8,
        marginBottom: 8,
    },
    brandContainer: {
        justifyContent: 'center',
    },
    brandName: {
        fontSize: 28,
        fontWeight: '600',
        color: '#FFFFFF',
        letterSpacing: -0.5,
    },
    connectionBadge: {
        backgroundColor: '#1A1A1A',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        shadowColor: '#FF6B9D',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 5,
    },
    connectionText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    settingsButton: {
        padding: 8,
        position: 'relative',
    },
    bellBadge: {
        position: 'absolute',
        top: 4,
        right: 4,
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#FF3B30',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 3,
    },
    bellBadgeText: {
        fontSize: 9,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    moodSection: {
        alignItems: 'center',

        borderRadius: 20,
        marginBottom: 32,
    },
    // Mood Card Styles
    moodCard: {
        width: '100%',
        backgroundColor: 'transparent',
        padding: 0,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        minHeight: 140,
    },
    partnerEmojiContainer: {
        width: 180,
        height: 180,
        borderRadius: 90,
        backgroundColor: '#1A1A1A',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: 'rgba(255, 255, 255, 0.08)',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 20,
        elevation: 6,
    },
    partnerEmojiLarge: {
        fontSize: 130,
    },
    partnerNameLabel: {
        fontSize: 18,
        fontWeight: '600',
        color: '#FFFFFF',
        marginTop: 12,
        opacity: 0.9,
    },
    yourEmojiBadge: {
        position: 'absolute',
        // Position on the bottom-right edge of partner's circle (180x180, radius 90)
        // Offset to place center of emoji badge on the circle's edge
        bottom: 5,
        right: 35,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#1A1A1A',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: 'rgba(255, 255, 255, 0.06)',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 10,
        elevation: 5,
    },
    yourEmojiSmall: {
        fontSize: 36,
    },
    moodDescription: {
        fontSize: 15,
        color: 'rgba(255, 255, 255, 0.8)',
        textAlign: 'center',
        marginBottom: 16,
        paddingHorizontal: 24,
        lineHeight: 22,
    },
    moodName: {
        fontWeight: '700',
        color: '#FFFFFF',
    },
    updateMoodButton: {
        backgroundColor: '#1A1A1A',
        paddingHorizontal: 32,
        paddingVertical: 12,
        borderRadius: 24,
        marginTop: 20,
        shadowColor: '#FFF',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 3,
    },
    updateMoodText: {
        fontSize: 16,
        fontWeight: '700',
        color: 'white',
    },
    cardsContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
        alignItems: 'stretch',
    },
    card: {
        width: (Dimensions.get('window').width - 40 - 12) / 2, // 40 = horizontal padding (20*2), 12 = gap
        backgroundColor: '#1A1A1A',
        borderRadius: 20,
        padding: 14,
        shadowColor: 'rgba(255, 255, 255, 0.05)',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 12,
        elevation: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    questionCard: {
        backgroundColor: '#4A2C6A',
        overflow: 'hidden',
        borderWidth: 0,
        minHeight: 200,
        position: 'relative',
    },
    questionDecorCircle1: {
        position: 'absolute',
        top: -20,
        right: -20,
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    questionDecorCircle2: {
        position: 'absolute',
        bottom: 30,
        left: -30,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    questionDecorCircle3: {
        position: 'absolute',
        top: 60,
        right: 40,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
    },
    questionCardContent: {
        flex: 1,
        zIndex: 1,
        justifyContent: 'space-between',
    },
    questionTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    questionLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: 'rgba(255, 255, 255, 0.7)',
        letterSpacing: 1.5,
    },
    questionIconBadge: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    questionCardTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 8,
    },
    questionPreviewText: {
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.85)',
        lineHeight: 18,
        flex: 1,
    },
    questionArrowContainer: {
        alignSelf: 'flex-end',
        marginTop: 12,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 20,
    },
    canvasCard: {
        backgroundColor: '#1A1A1A',
        overflow: 'hidden',
        position: 'relative',
        padding: 0,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        minHeight: 200,
    },
    canvasIconContainer: {
        alignSelf: 'center',
        marginBottom: 8,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#FFF5E6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    pencilIcon: {
        width: 100,
        height: 100,
    },
    paperTexture: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    paperCrease: {
        position: 'absolute',
        width: 60,
        height: 1.5,
        backgroundColor: 'rgba(139, 119, 101, 0.08)',
        shadowColor: 'rgba(139, 119, 101, 0.15)',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 1,
        shadowRadius: 2,
    },
    iconContainer: {
        alignSelf: 'center',
        marginBottom: 8,
    },
    cardTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: 6,
    },
    questionText: {
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.6)',
        marginBottom: 10,
        lineHeight: 18,
    },
    canvasText: {
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.6)',
        marginBottom: 10,
        lineHeight: 18,
    },
    answerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'center',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        gap: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 2,
    },
    answerDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.secondary,
    },
    answerText: {
        fontSize: 11,
        color: "black",
        fontWeight: '600',
    },
    canvasPreviewContainer: {
        flex: 1,
        width: '100%',
        backgroundColor: '#1A1A1A',
        overflow: 'hidden',
    },
    canvasLottieContainer: {
        flex: 1,
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#1A1A1A',
    },
    canvasLottie: {
        width: '100%',
        height: '100%',
    },
    newDrawingBadge: {
        alignSelf: 'center',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 16,
        shadowColor: '#E5A85F',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 3,
    },
    newDrawingText: {
        fontSize: 12,
        color: '#D4894A',
        fontWeight: '700',
    },
    drawNowBadge: {
        alignSelf: 'center',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 16,
        shadowColor: '#E5A85F',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 3,
    },
    drawNowText: {
        fontSize: 12,
        color: '#D4894A',
        fontWeight: '700',
    },
    actionBadge: {
        alignSelf: 'center',
        backgroundColor: '#5BB5A6',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 16,
        shadowColor: '#5BB5A6',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 3,
    },
    actionBadgeText: {
        fontSize: 12,
        color: '#FFFFFF',
        fontWeight: '700',
    },
    noPartnerContainer: {
        alignItems: 'center',
        paddingVertical: 40,
        paddingHorizontal: 20,
    },
    noPartnerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#FFFFFF',
        marginBottom: 12,
    },
    noPartnerText: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.7)',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 24,
    },
    findPartnerButton: {
        backgroundColor: colors.primary,
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 24,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 4,
    },
    findPartnerText: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.surface,
    },
    // Challenge progress styles
    progressBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'center',
        backgroundColor: '#FFF3CD',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        gap: 6,
    },
    progressText: {
        fontSize: 11,
        color: '#856404',
        fontWeight: '600',
    },
    completeBadge: {
        backgroundColor: '#D4EDDA',
        borderWidth: 0,
    },
    completeText: {
        fontSize: 12,
        color: '#155724',
        fontWeight: '700',
    },
    // Topic Section Styles (for individual topic headers and cards)
    topicSection: {
        marginBottom: 20,
    },
    topicHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    topicTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    topicEmoji: {
        fontSize: 22,
    },
    topicSectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    topicPlayButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    topicPlayText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    topicPlayArrow: {
        fontSize: 16,
        color: '#FFFFFF',
        marginLeft: 4,
        fontWeight: '600',
    },
    topicCard: {
        width: '100%',
        borderRadius: 20,
        padding: 20,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 6,
    },
    topicIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    topicCardInfo: {
        flex: 1,
    },
    topicCardSubtitle: {
        fontSize: 14,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.85)',
        marginBottom: 4,
    },
    topicCardDescription: {
        fontSize: 13,
        color: 'rgba(255, 255, 255, 0.7)',
        lineHeight: 18,
        marginBottom: 8,
    },
    topicCardCount: {
        fontSize: 12,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.9)',
    },
    // Arcade Section Styles
    arcadeSection: {
        marginBottom: 24,
        marginHorizontal: -20, // Extend beyond container padding for full-width scroll
    },
    arcadeHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 12,
    },
    arcadeSectionTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    allGamesButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    allGamesText: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.6)',
        fontWeight: '500',
    },
    allGamesArrow: {
        fontSize: 18,
        color: 'rgba(255, 255, 255, 0.6)',
        marginLeft: 2,
        fontWeight: '600',
    },
    arcadeScrollContent: {
        paddingHorizontal: 20,
        gap: 12,
    },
    arcadeCard: {
        width: 160,
        height: 180,
        borderRadius: 20,
        padding: 14,
        justifyContent: 'space-between',
    },
    topicQuestionCard: {
        width: Dimensions.get('window').width - 40,
        height: 180,
        borderRadius: 20,
        padding: 14,
        justifyContent: 'space-between',
    },
    chilliImage: {
        position: 'absolute',
        right: 0,
        bottom: -20,
        width: 180,
        height: 180,
        resizeMode: 'contain',
        opacity: 0.9,
    },
    coinsImage: {
        position: 'absolute',
        right: 0,
        bottom: -20,
        width: 180,
        height: 180,
        resizeMode: 'contain',
        opacity: 0.9,
    },
    coupleCutoutImage: {
        position: 'absolute',
        right: -15,
        bottom: -10,
        width: 180,
        height: 180,
        resizeMode: 'contain',
        opacity: 0.9,
    },
    fitnessImage: {
        position: 'absolute',
        right: 0,
        bottom: -20,
        width: 180,
        height: 180,
        resizeMode: 'contain',
        opacity: 0.9,
    },
    travelImage: {
        position: 'absolute',
        right: 0,
        bottom: -20,
        width: 180,
        height: 180,
        resizeMode: 'contain',
        opacity: 0.9,
    },
    familyImage: {
        position: 'absolute',
        right: 0,
        bottom: -20,
        width: 180,
        height: 180,
        resizeMode: 'contain',
        opacity: 0.9,
    },
    politicalArrowContainer: {
        position: 'absolute',
        right: 10,
        bottom: 19,
        width: 120,
        height: 120,
        opacity: 0.9,
    },
    blinkingDot: {
        position: 'absolute',
        top: 10,
        right: 10,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 4,
        elevation: 3,
    },
    arcadeCardOrange: {
        backgroundColor: '#D4714A', // Muted coral-orange
    },
    arcadeCardTeal: {
        backgroundColor: '#3A9B8C', // Muted teal
    },
    arcadeCardPurple: {
        backgroundColor: '#7B68A6', // Muted purple
    },
    arcadeCardGreen: {
        backgroundColor: '#6AAA64', // Wordle green
    },
    wordleIconText: {
        fontSize: 28,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 2,
    },
    arcadeCardYourTurn: {
        borderWidth: 2,
        borderColor: '#FFFFFF',
        shadowColor: '#3A9B8C',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 12,
        elevation: 8,
    },
    arcadeBadgeRow: {
        flexDirection: 'row',
        gap: 6,
    },
    arcadeBadgeNew: {
        backgroundColor: '#47A642',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
    },
    arcadeBadgeNewText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    arcadeBadgeWaiting: {
        backgroundColor: 'rgba(255, 193, 7, 0.9)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
    },
    arcadeBadgeWaitingText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    arcadeBadgePending: {
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
    },
    arcadeBadgePendingText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    arcadeBadgeLocked: {
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 10,
    },
    arcadeBadgeLockedText: {
        fontSize: 11,
    },
    arcadeBadgeSoon: {
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
    },
    arcadeBadgeSoonText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    arcadeIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    arcadeGameLabel: {
        fontSize: 12,
        fontWeight: '500',
        color: 'white',
        marginBottom: 2,
    },
    arcadeGameTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
        lineHeight: 20,
    },
});

export default HomeScreen;
