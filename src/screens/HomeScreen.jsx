import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '../theme';
import GradientBackground from '../components/GradientBackground';
import Svg, { Circle, Ellipse } from 'react-native-svg';

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
                        <TouchableOpacity style={styles.settingsButton}>
                            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                                <Circle cx="12" cy="12" r="3" stroke={colors.text} strokeWidth={2} fill="none" />
                                <Circle cx="12" cy="4" r="1.5" fill={colors.text} />
                                <Circle cx="12" cy="20" r="1.5" fill={colors.text} />
                                <Circle cx="4" cy="12" r="1.5" fill={colors.text} />
                                <Circle cx="20" cy="12" r="1.5" fill={colors.text} />
                                <Circle cx="7" cy="7" r="1.5" fill={colors.text} />
                                <Circle cx="17" cy="17" r="1.5" fill={colors.text} />
                                <Circle cx="17" cy="7" r="1.5" fill={colors.text} />
                                <Circle cx="7" cy="17" r="1.5" fill={colors.text} />
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
                            {/* Blob Container */}
                            <View style={styles.blobContainer}>
                                {/* Your Blob (Left - Sage Green) */}
                                <Svg
                                    width="180"
                                    height="180"
                                    viewBox="0 0 180 180"
                                    style={styles.yourBlob}
                                >
                                    <Ellipse
                                        cx="90"
                                        cy="90"
                                        rx="75"
                                        ry="80"
                                        fill="#8AB7A7"
                                        opacity={0.7}
                                    />
                                </Svg>

                                {/* Partner Blob (Right - Yellow) */}
                                <Svg
                                    width="180"
                                    height="180"
                                    viewBox="0 0 180 180"
                                    style={styles.partnerBlob}
                                >
                                    <Ellipse
                                        cx="90"
                                        cy="90"
                                        rx="75"
                                        ry="80"
                                        fill="#E5C368"
                                        opacity={0.7}
                                    />
                                </Svg>

                                {/* Your Avatar */}
                                <View style={[styles.avatar, styles.yourAvatar]}>
                                    <Text style={styles.avatarEmoji}>{yourMood?.emoji || '😊'}</Text>
                                </View>

                                {/* Partner Avatar */}
                                <View style={[styles.avatar, styles.partnerAvatar]}>
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
                                {' (Sage Green blob).'}
                                {'\n'}
                                {partnerName} is feeling{' '}
                                <Text style={styles.moodName}>
                                    {partnerMood?.label || 'Happy'}
                                </Text>
                                {' (Yellow blob).'}
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
                            {/* Question Icon */}
                            {/* <View style={styles.questionIcon}>
                                <Svg width={56} height={56} viewBox="0 0 56 56">
                                    <Circle cx="28" cy="28" r="28" fill="#B8DAEF" opacity={0.3} />
                                    <Circle cx="20" cy="24" r="12" fill={colors.secondary} opacity={0.2} />
                                    <Circle cx="36" cy="24" r="12" fill={colors.secondary} opacity={0.2} />
                                </Svg>
                            </View> */}

                            <Text style={styles.cardTitle}>Today's Question</Text>
                            <Text style={styles.questionText}>
                                What's one small thing I did this week that made you feel loved?
                            </Text>

                            {hasPartner && (
                                <View style={styles.answerBadge}>
                                    <View style={styles.answerDot} />
                                    <Text style={styles.answerText}>
                                        {partnerName} has answered!{'\n'}Tap to reveal
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        {/* Our Canvas Card */}
                        <TouchableOpacity
                            style={[styles.card, styles.canvasCard]}
                            onPress={onScribblePress}
                            activeOpacity={0.9}
                        >
                            {/* Pencil Icon */}
                            {/* <View style={styles.pencilIcon}>
                                <Svg width={56} height={56} viewBox="0 0 56 56">
                                    <Circle cx="40" cy="16" r="12" fill={colors.accent} opacity={0.3} />
                                    <Circle cx="30" cy="26" r="8" fill={colors.accent} opacity={0.5} />
                                </Svg>
                            </View> */}

                            <Text style={styles.cardTitle}>Our Canvas</Text>
                            <Text style={styles.canvasText}>
                                Leave a doodle, a love note, or a mess.
                            </Text>

                            {partnerScribble && (
                                <View style={styles.newDrawingBadge}>
                                    <Text style={styles.newDrawingText}>✏️ New Drawing!</Text>
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
        marginBottom: 20,
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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
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
        marginBottom: 28,
    },
    greeting: {
        fontSize: 28,
        fontWeight: '700',
        color: colors.text,
        textAlign: 'center',
        lineHeight: 38,
    },
    names: {
        fontSize: 28,
        fontWeight: '900',
        color: colors.text,
    },
    moodSection: {
        alignItems: 'center',
        marginBottom: 32,
    },
    blobContainer: {
        width: '100%',
        height: 220,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
        position: 'relative',
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
        backgroundColor: '#8AB7A7',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: colors.surface,
        position: 'absolute',
    },
    yourAvatar: {
        left: '5%',
        bottom: 24,
        backgroundColor: '#8AB7A7',
    },
    partnerAvatar: {
        right: '5%',
        top: 24,
        backgroundColor: '#E5C368',
    },
    avatarEmoji: {
        fontSize: 24,
    },
    blobLabel: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.surface,
        position: 'absolute',
    },
    yourLabel: {
        left: '28%',
        top: '48%',
    },
    partnerLabel: {
        right: '24%',
        top: '48%',
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
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 8,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.04)',
    },
    questionCard: {
        backgroundColor: '#E8F4F8', // Light blue
    },
    canvasCard: {
        backgroundColor: '#FFF9F0', // Light cream
    },
    questionIcon: {
        marginBottom: 10,
    },
    pencilIcon: {
        marginBottom: 10,
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
        backgroundColor: 'rgba(91, 181, 166, 0.12)',
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 10,
        gap: 6,
    },
    answerDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.secondary,
    },
    answerText: {
        fontSize: 11,
        color: colors.secondary,
        fontWeight: '600',
        flex: 1,
    },
    newDrawingBadge: {
        alignSelf: 'flex-end',
        backgroundColor: 'white',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
    },
    newDrawingText: {
        fontSize: 11,
        color: colors.accent,
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
