import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '../theme';
import GradientBackground from '../components/GradientBackground';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { SplashLeft, SplashRight } from '../components/SplashSvg';

const HomeScreen = ({
    partnerName = 'Partner',
    daysTogether = 0,
    hasPartner = false,
    yourMood = null,
    partnerMood = null,
    partnerOnline = false,
    partnerScribble = null,
    pendingInvite = null,
    onMoodPress,
    onScribblePress,
    onQuestionPress,
    onFindPartner,
    onSettingsPress,
}) => {
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

    // Mood colors from MoodScreen - consistent mapping
    const moodColorMap = {
        'Happy': colors.moodHappy,
        'In Love': colors.moodLove,
        'Playful': colors.moodPlayful,
        'Calm': colors.moodCalm,
        'Excited': colors.moodExcited,
        'Grateful': colors.moodGrateful,
        'Missing You': colors.moodMissing,
        'Tired': colors.moodTired,
        'Romantic': colors.primary,
    };

    // Get blob colors based on actual mood
    const yourMoodColor = yourMood?.label ? (moodColorMap[yourMood.label] || '#8AB7A7') : '#8AB7A7';
    const partnerMoodColor = partnerMood?.label ? (moodColorMap[partnerMood.label] || '#E5C368') : '#E5C368';

    return (
        <GradientBackground variant="warm">
            <SafeAreaView style={styles.container} edges={['top']}>
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        {/* Logo - Two interlocking circles */}
                        <View style={styles.logo}>
                            <Svg width={40} height={40} viewBox="0 0 40 40">
                                <Circle cx="15" cy="20" r="12" fill={colors.primary} opacity={0.8} />
                                <Circle cx="25" cy="20" r="12" fill={colors.secondary} opacity={0.8} />
                            </Svg>
                        </View>

                        {/* Connection Badge */}
                        {hasPartner && daysTogether > 0 && (
                            <View style={styles.connectionBadge}>
                                <Text style={styles.connectionText}>
                                    Connected: {daysTogether} days 🔥
                                </Text>
                            </View>
                        )}

                        {/* Settings Icon */}
                        <TouchableOpacity style={styles.settingsButton} onPress={onSettingsPress}>
                            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                                <Path
                                    d="M12 15a3 3 0 100-6 3 3 0 000 6z"
                                    stroke={colors.text}
                                    strokeWidth={2}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                                <Path
                                    d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"
                                    stroke={colors.text}
                                    strokeWidth={2}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </Svg>
                        </TouchableOpacity>
                    </View>

                    {/* Greeting */}
                    <View style={styles.greetingSection}>
                        <Text style={styles.greeting}>
                            {getGreeting()},{'\n'}
                            <Text style={styles.names}>
                                {hasPartner ? `${getUserName()} & ${partnerName}.` : `${getUserName()}.`}
                            </Text>
                        </Text>
                    </View>

                    {/* Mood Blobs Section */}
                    {hasPartner && (
                        <View style={styles.moodSection}>
                            {/* Blob Container - Paint Splatter */}
                            <View style={styles.blobContainer}>
                                {/* Left Splash - Your Mood */}
                                <View style={styles.splashLeft}>
                                    <SplashLeft
                                        color={yourMoodColor}
                                        width={220}
                                        height={240}
                                        opacity={0.75}
                                    />
                                </View>

                                {/* Right Splash - Partner Mood */}
                                <View style={styles.splashRight}>
                                    <SplashRight
                                        color={partnerMoodColor}
                                        width={220}
                                        height={240}
                                        opacity={0.75}
                                    />
                                </View>

                                {/* Center Merge Effect */}


                                {/* Your Avatar */}
                                <View style={[styles.avatar, styles.yourAvatar, { backgroundColor: "white", borderColor: yourMoodColor }]}>
                                    <Text style={styles.avatarEmoji}>{yourMood?.emoji || '😊'}</Text>
                                </View>

                                {/* Partner Avatar */}
                                <View style={[styles.avatar, styles.partnerAvatar, { backgroundColor: "white", borderColor: partnerMoodColor }]}>
                                    <Text style={styles.avatarEmoji}>{partnerMood?.emoji || '😊'}</Text>
                                </View>

                                {/* Blob Labels */}
                                <Text style={[styles.blobLabel, styles.yourLabel]}>You</Text>
                                <Text style={[styles.blobLabel, styles.partnerLabel]}>
                                    {partnerName}
                                </Text>
                            </View>


                            {/* Mood Description */}
                            <Text style={styles.moodDescription}>
                                You are feeling{' '}
                                <Text style={styles.moodName}>
                                    {yourMood?.label || 'Happy'}
                                </Text>
                                .
                                {'\n'}
                                {partnerName} is feeling{' '}
                                <Text style={styles.moodName}>
                                    {partnerMood?.label || 'Happy'}
                                </Text>
                                .
                            </Text>

                            {/* Update Mood Button */}
                            <TouchableOpacity
                                style={styles.updateMoodButton}
                                onPress={onMoodPress}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.updateMoodText}>Update my Mood</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Action Cards */}
                    <View style={styles.cardsContainer}>
                        {/* Today's Question Card */}
                        <TouchableOpacity
                            style={[styles.card, styles.questionCard]}
                            onPress={onQuestionPress}
                            activeOpacity={0.9}
                        >
                            {/* Elegant Gradient Background */}
                            <LinearGradient
                                colors={['#FFFFFF', '#F0F9F7', '#E8F4F1']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.cardGradient}
                            />

                            {/* Calendar Icon - Exotic Design */}
                            <View style={styles.iconContainer}>
                                <Svg width={48} height={48} viewBox="0 0 48 48" fill="none">
                                    {/* Background circle */}
                                    <Circle cx="24" cy="24" r="22" fill="#E8F4F8" opacity="0.6" />
                                    {/* Calendar body */}
                                    <Rect x="14" y="16" width="20" height="20" rx="3" stroke="#5BB5A6" strokeWidth="2.5" fill="#FFFFFF" />
                                    {/* Top tabs */}
                                    <Path d="M20 14v4M28 14v4" stroke="#5BB5A6" strokeWidth="2.5" strokeLinecap="round" />
                                    {/* Header line */}
                                    <Path d="M14 22h20" stroke="#5BB5A6" strokeWidth="2" />
                                    {/* Decorative dots */}
                                    <Circle cx="19" cy="26" r="1.5" fill="#5BB5A6" />
                                    <Circle cx="24" cy="26" r="1.5" fill="#5BB5A6" />
                                    <Circle cx="29" cy="26" r="1.5" fill="#5BB5A6" />
                                    <Circle cx="19" cy="30" r="1.5" fill="#5BB5A6" opacity="0.5" />
                                    <Circle cx="24" cy="30" r="1.5" fill="#5BB5A6" opacity="0.5" />
                                    {/* Heart highlight */}
                                    <Path d="M29 29c0 1.5-1.5 3-2.5 3.5-1-0.5-2.5-2-2.5-3.5 0-1 0.7-1.5 1.5-1.5 0.4 0 0.8 0.2 1 0.5 0.2-0.3 0.6-0.5 1-0.5 0.8 0 1.5 0.5 1.5 1.5z" fill="#FF6B9D" opacity="0.8" />
                                </Svg>
                            </View>

                            <Text style={styles.cardTitle}>Today's Question</Text>
                            <Text style={styles.questionText}>
                                What's one small thing I did this week that made you feel loved?
                            </Text>

                            {hasPartner ? (
                                <View style={styles.answerBadge}>
                                    <View style={styles.answerDot} />
                                    <Text style={styles.answerText}>
                                        {partnerName} answered!
                                    </Text>
                                </View>
                            ) : (
                                <View style={styles.actionBadge}>
                                    <Text style={styles.actionBadgeText}>Answer Now</Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        {/* Our Canvas Card */}
                        <TouchableOpacity
                            style={[styles.card, styles.canvasCard]}
                            onPress={onScribblePress}
                            activeOpacity={0.9}
                        >
                            {/* Warm Canvas Gradient */}
                            <LinearGradient
                                colors={['#FDF8F3', '#F8EDE3', '#F3E4D7']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.cardGradient}
                            />

                            {/* Pencil Icon */}
                            <View style={styles.canvasIconContainer}>
                                <Image
                                    source={require('../../assets/pencilicon.png')}
                                    style={styles.pencilIcon}
                                    resizeMode="contain"
                                />
                            </View>

                            <Text style={styles.cardTitle}>Our Canvas</Text>
                            <Text style={styles.canvasText}>
                                Leave a doodle, a love note, or a mess.
                            </Text>

                            {partnerScribble ? (
                                <View style={styles.newDrawingBadge}>
                                    <Text style={styles.newDrawingText}>✏️ New Drawing!</Text>
                                </View>
                            ) : (
                                <View style={styles.drawNowBadge}>
                                    <Text style={styles.drawNowText}>✏️ Draw Now</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* No Partner State */}
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
        </GradientBackground>
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
    logo: {
        width: 40,
        height: 40,
    },
    connectionBadge: {
        backgroundColor: colors.surface,
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
        color: colors.text,
    },
    settingsButton: {
        padding: 8,
    },
    greetingSection: {
        marginBottom: 0,
    },
    greeting: {
        fontSize: 32,
        fontWeight: '300',
        color: colors.text,
        textAlign: 'center',
        lineHeight: 44,
        letterSpacing: 0.3,
    },
    names: {
        fontSize: 36,
        fontWeight: '700',
        color: colors.text,
        letterSpacing: -0.5,
        fontFamily: 'System',
    },
    moodSection: {
        alignItems: 'center',

        borderRadius: 20,
        marginBottom: 32,
    },
    blobContainer: {
        width: '100%',
        height: 260,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
        position: 'relative',
        overflow: 'visible',
    },
    splashLeft: {
        position: 'absolute',
        left: -30,
        top: -5,
    },
    splashRight: {
        position: 'absolute',
        right: -30,
        top: -5,
    },
    centerMerge: {
        position: 'absolute',
        left: '50%',
        top: '50%',
        marginLeft: -40,
        marginTop: -40,
    },
    combinedBlobs: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
    },
    yourBlob: {
        position: 'absolute',
        left: '5%',
        top: 20,
    },
    partnerBlob: {
        position: 'absolute',
        right: '5%',
        top: 20,
    },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: colors.surface,
        position: 'absolute',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 5,
    },
    yourAvatar: {
        left: 45,
        top: 105,
        backgroundColor: '#8AB7A7',
    },
    partnerAvatar: {
        right: 45,
        top: 105,
    },
    avatarEmoji: {
        fontSize: 24,
    },
    blobLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.text,
        position: 'absolute',
        opacity: 0.9,
    },
    yourLabel: {
        left: 50,
        top: 165,
    },
    partnerLabel: {
        right: 46,
        top: 165,
    },
    moodDescription: {
        fontSize: 15,
        color: colors.text,
        textAlign: 'center',
        marginBottom: 16,
        paddingHorizontal: 24,
        lineHeight: 22,
    },
    moodName: {
        fontWeight: '700',
        color: colors.text,
    },
    updateMoodButton: {
        backgroundColor: '#000000',
        paddingHorizontal: 32,
        paddingVertical: 12,
        borderRadius: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 3,
    },
    updateMoodText: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.surface,
    },
    cardsContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    card: {
        flex: 1,
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 8,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.04)',
    },
    questionCard: {
        backgroundColor: 'transparent',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(91, 181, 166, 0.15)',
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
        backgroundColor: 'transparent',
        overflow: 'hidden',
        position: 'relative',
        borderWidth: 1,
        borderColor: 'rgba(229, 168, 95, 0.2)',
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
        color: colors.text,
        marginBottom: 6,
    },
    questionText: {
        fontSize: 13,
        color: colors.textSecondary,
        marginBottom: 10,
        lineHeight: 18,
    },
    canvasText: {
        fontSize: 13,
        color: colors.textSecondary,
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
        color: colors.text,
        marginBottom: 12,
    },
    noPartnerText: {
        fontSize: 16,
        color: colors.textSecondary,
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
});

export default HomeScreen;
