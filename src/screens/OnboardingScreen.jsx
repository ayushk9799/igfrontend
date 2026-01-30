// Onboarding Screen - Premium immersive flow based on user designs
import React, { useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    Animated,
    Image,
    ImageBackground,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, spacing, borderRadius } from '../theme';

const { width, height } = Dimensions.get('window');

// Onboarding slide configuration - matching the user's HTML designs
const SLIDES = [
    {
        id: 'connection',
        type: 'fullscreen-image',
        title: 'Stay Connected,\nAlways',
        subtitle: 'Strengthen your bond with intimate tools designed for the two of you.',
        ctaText: 'Join Your Partner',
        secondaryCta: 'Create New Space',
        gradient: ['rgba(0,0,0,0.2)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.6)'],
    },
    {
        id: 'mood',
        type: 'gradient-bubbles',
        title: 'Share Your Mood',
        subtitle: 'Show them how you really feel. A quick tap lets your partner know you\'re thinking of them.',
        ctaText: 'Continue',
        gradient: ['#F4A261', '#FFF9F5'],
        moods: [
            { emoji: '✨', label: 'Joyful', top: '20%', left: '15%' },
            { emoji: '❤️', label: 'Loved', top: '45%', right: '10%' },
            { emoji: '😌', label: 'Calm', bottom: '30%', left: '20%' },
            { emoji: '🌟', label: null, bottom: '45%', right: '30%' },
        ],
    },
    {
        id: 'games',
        type: 'mesh-gradient',
        title: 'Play Together',
        subtitle: 'Challenge your partner in the Play Zone',
        ctaText: 'Play Now',
        meshColors: ['#ff8c82', '#e04a4a', '#ff6b6b', '#d44747'],
    },
    {
        id: 'topics',
        type: 'card-stack',
        title: 'Unlock New Depths',
        subtitle: 'Flick through curated topics to spark deeper connection.',
        ctaText: 'Start Connecting',
        gradient: ['#FFF9F5', '#FFF9F5'],
        cards: [
            { label: 'Travel', color: '#0A84FF', icon: '✈️' },
            { label: 'Wealth', color: '#30D158', icon: '💰' },
            { label: 'Future', color: '#BF5AF2', icon: '✨' },
            { label: 'Intimacy', color: '#FF2D55', icon: '🔥', featured: true, sublabel: 'Hot & Spicy' },
        ],
    },
];

// Glass Card Component
const GlassCard = ({ children, style }) => (
    <View style={[styles.glassCard, style]}>
        {children}
    </View>
);

// Mood Bubble Component
const MoodBubble = ({ emoji, label, style }) => (
    <View style={[styles.moodBubble, style]}>
        <Text style={styles.moodEmoji}>{emoji}</Text>
        {label && <Text style={styles.moodLabel}>{label}</Text>}
    </View>
);

// Topic Card Component
const TopicCard = ({ label, sublabel, color, icon, featured, style, zIndex }) => (
    <View style={[styles.topicCard, { backgroundColor: color, zIndex }, style]}>
        <View style={styles.topicIconContainer}>
            <Text style={styles.topicIcon}>{icon}</Text>
        </View>
        <Text style={[styles.topicLabel, featured && styles.topicLabelFeatured]}>{label}</Text>
        {sublabel && (
            <View style={styles.topicSublabelBadge}>
                <Text style={styles.topicSublabel}>{sublabel}</Text>
            </View>
        )}
    </View>
);

const OnboardingScreen = ({ onComplete }) => {
    const insets = useSafeAreaInsets();
    const scrollX = useRef(new Animated.Value(0)).current;
    const flatListRef = useRef(null);
    const [currentIndex, setCurrentIndex] = useState(0);

    const handleScroll = Animated.event(
        [{ nativeEvent: { contentOffset: { x: scrollX } } }],
        { useNativeDriver: false }
    );

    const handleMomentumScrollEnd = (event) => {
        const index = Math.round(event.nativeEvent.contentOffset.x / width);
        setCurrentIndex(index);
    };

    const handleNext = () => {
        if (currentIndex < SLIDES.length - 1) {
            flatListRef.current?.scrollToIndex({
                index: currentIndex + 1,
                animated: true,
            });
        } else {
            onComplete?.();
        }
    };

    const handleSkip = () => {
        onComplete?.();
    };

    // Render Screen 1: Full-screen image with glass card
    const renderConnectionSlide = (item, index) => (
        <View style={styles.slide}>
            <ImageBackground
                source={{ uri: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=800&q=80' }}
                style={styles.fullscreenImage}
                resizeMode="cover"
            >
                <LinearGradient
                    colors={['rgba(0,0,0,0.2)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.7)']}
                    style={styles.imageOverlay}
                />

                {/* Skip Button */}
                <TouchableOpacity
                    style={[styles.skipButtonGlass, { top: insets.top + 16 }]}
                    onPress={handleSkip}
                >
                    <Text style={styles.skipTextWhite}>Skip</Text>
                </TouchableOpacity>

                {/* Bottom Glass Card */}
                <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + 16 }]}>
                    <GlassCard style={styles.connectionCard}>
                        {/* Progress Dots */}
                        <View style={styles.dotsContainerInCard}>
                            {SLIDES.map((_, i) => (
                                <View
                                    key={i}
                                    style={[
                                        styles.dotWhite,
                                        i === currentIndex && styles.dotActiveWhite
                                    ]}
                                />
                            ))}
                        </View>

                        <Text style={styles.titleWhite}>{item.title}</Text>
                        <Text style={styles.subtitleWhite}>{item.subtitle}</Text>

                        {/* CTAs */}
                        <TouchableOpacity style={styles.ctaButtonWhite} onPress={handleNext}>
                            <Text style={styles.ctaTextBlack}>{item.ctaText}</Text>
                            <Text style={styles.arrowIcon}>→</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.ctaButtonOutline} onPress={handleNext}>
                            <Text style={styles.ctaTextWhite}>{item.secondaryCta}</Text>
                        </TouchableOpacity>

                        {/* Social Proof */}
                        <View style={styles.socialProof}>
                            <View style={styles.avatarStack}>
                                <View style={[styles.stackedAvatar, { backgroundColor: '#FF6B6B' }]} />
                                <View style={[styles.stackedAvatar, { backgroundColor: '#5BB5A6', marginLeft: -8 }]} />
                            </View>
                            <Text style={styles.socialProofText}>10,000+ COUPLES ONLINE</Text>
                        </View>
                    </GlassCard>
                </View>
            </ImageBackground>
        </View>
    );

    // Render Screen 2: Mood sharing with gradient and bubbles
    const renderMoodSlide = (item, index) => (
        <View style={styles.slide}>
            <LinearGradient
                colors={item.gradient}
                style={styles.slideGradient}
            />

            {/* Header */}
            <View style={[styles.headerRow, { paddingTop: insets.top + 8 }]}>
                <TouchableOpacity style={styles.backButton}>
                    <Text style={styles.backArrow}>‹</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSkip}>
                    <Text style={styles.skipTextDark}>Skip</Text>
                </TouchableOpacity>
            </View>

            {/* Progress Dots */}
            <View style={styles.dotsContainerCenter}>
                {SLIDES.map((_, i) => (
                    <View
                        key={i}
                        style={[
                            styles.dotDark,
                            i === currentIndex && styles.dotActivePrimary
                        ]}
                    />
                ))}
            </View>

            {/* Mood Bubbles Illustration */}
            <View style={styles.moodIllustrationContainer}>
                {item.moods.map((mood, i) => (
                    <MoodBubble
                        key={i}
                        emoji={mood.emoji}
                        label={mood.label}
                        style={{
                            position: 'absolute',
                            top: mood.top,
                            left: mood.left,
                            right: mood.right,
                            bottom: mood.bottom,
                        }}
                    />
                ))}
                {/* Pulsing circle */}
                <View style={styles.pulsingCircle} />
            </View>

            {/* Text Content */}
            <View style={styles.textContainerBottom}>
                <Text style={styles.titleDark}>{item.title}</Text>
                <Text style={styles.subtitleDark}>{item.subtitle}</Text>
            </View>

            {/* CTA */}
            <View style={[styles.ctaContainer, { paddingBottom: insets.bottom + 24 }]}>
                <TouchableOpacity style={styles.ctaButtonPrimary} onPress={handleNext}>
                    <Text style={styles.ctaTextWhiteBold}>{item.ctaText}</Text>
                    <Text style={styles.arrowIconWhite}>→</Text>
                </TouchableOpacity>
                <View style={styles.privacyNote}>
                    <Text style={styles.lockIcon}>🔒</Text>
                    <Text style={styles.privacyText}>Your data is private and encrypted</Text>
                </View>
            </View>
        </View>
    );

    // Render Screen 3: Games with mesh gradient
    const renderGamesSlide = (item, index) => (
        <View style={styles.slide}>
            <LinearGradient
                colors={['#E55B5B', '#d44747']}
                style={styles.slideGradient}
            />

            {/* Skip */}
            <View style={[styles.headerRowEnd, { paddingTop: insets.top + 8 }]}>
                <TouchableOpacity onPress={handleSkip}>
                    <Text style={styles.skipTextWhite}>Skip</Text>
                </TouchableOpacity>
            </View>

            {/* Progress Dots */}
            <View style={styles.dotsContainerCenter}>
                {SLIDES.map((_, i) => (
                    <View
                        key={i}
                        style={[
                            styles.dotWhiteSmall,
                            i === currentIndex && styles.dotActiveWhiteLarge
                        ]}
                    />
                ))}
            </View>

            {/* Isometric Game Board Illustration */}
            <View style={styles.gameIllustrationContainer}>
                <View style={styles.isometricBoard}>
                    {/* Grid lines */}
                    <View style={styles.gridContainer}>
                        {[...Array(16)].map((_, i) => (
                            <View key={i} style={styles.gridCell} />
                        ))}
                    </View>
                    {/* Floating hearts */}
                    <View style={[styles.floatingHeart, { top: '25%', left: '25%' }]}>
                        <Text style={styles.heartIcon}>❤️</Text>
                    </View>
                    <View style={[styles.floatingHeart, { bottom: '25%', right: '25%' }]}>
                        <Text style={styles.heartIconOrange}>🧡</Text>
                    </View>
                    <View style={[styles.puzzlePiece, { top: '50%', left: '33%' }]}>
                        <Text style={styles.puzzleIcon}>🧩</Text>
                    </View>
                </View>
            </View>

            {/* Text Content */}
            <View style={styles.textContainerCenterWhite}>
                <Text style={styles.titleWhiteLarge}>{item.title}</Text>
                <Text style={styles.subtitleWhiteLight}>{item.subtitle}</Text>
            </View>

            {/* Arcade CTA */}
            <View style={[styles.ctaContainer, { paddingBottom: insets.bottom + 24 }]}>
                <TouchableOpacity style={styles.arcadeButton} onPress={handleNext}>
                    <Text style={styles.arcadeButtonText}>{item.ctaText}</Text>
                    <Text style={styles.gamepadIcon}>🎮</Text>
                </TouchableOpacity>
                <Text style={styles.stepIndicator}>Step 3 of 4</Text>
            </View>
        </View>
    );

    // Render Screen 4: Topic cards stack
    const renderTopicsSlide = (item, index) => (
        <View style={styles.slide}>
            <View style={[styles.slideBackground, { backgroundColor: '#FFF9F5' }]} />

            {/* Header */}
            <View style={[styles.headerRow, { paddingTop: insets.top + 8 }]}>
                <TouchableOpacity style={styles.backButtonLight}>
                    <Text style={styles.backArrowDark}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.logoText}>LoveNest</Text>
                <TouchableOpacity onPress={handleSkip}>
                    <Text style={styles.skipTextPrimary}>Skip</Text>
                </TouchableOpacity>
            </View>

            {/* Title */}
            <View style={styles.topicsTitleContainer}>
                <Text style={styles.topicsTitleLarge}>
                    Unlock <Text style={styles.topicsTitleAccent}>New</Text> Depths
                </Text>
                <Text style={styles.topicsSubtitle}>{item.subtitle}</Text>
            </View>

            {/* Stacked Cards */}
            <View style={styles.cardStackContainer}>
                {item.cards.map((card, i) => {
                    const isTop = i === item.cards.length - 1;
                    const offset = (item.cards.length - 1 - i) * 12;
                    const scale = 1 - (item.cards.length - 1 - i) * 0.05;
                    const opacity = isTop ? 1 : 0.4 + (i * 0.2);

                    return (
                        <TopicCard
                            key={i}
                            label={card.label}
                            sublabel={card.sublabel}
                            color={card.color}
                            icon={card.icon}
                            featured={card.featured}
                            zIndex={i}
                            style={{
                                position: 'absolute',
                                transform: [
                                    { translateY: -offset },
                                    { scale },
                                    isTop ? { rotate: '-2deg' } : { rotate: '0deg' }
                                ],
                                opacity,
                            }}
                        />
                    );
                })}
            </View>

            {/* Progress Meter */}
            <View style={styles.meterContainer}>
                <View style={styles.meterHeader}>
                    <Text style={styles.meterLabel}>DISCOVERY METER</Text>
                    <Text style={styles.meterValue}>65%</Text>
                </View>
                <View style={styles.meterTrack}>
                    <View style={styles.meterFill} />
                </View>
                <Text style={styles.meterHint}>Swipe cards to unlock more topics</Text>
            </View>

            {/* CTA */}
            <View style={[styles.ctaContainer, { paddingBottom: insets.bottom + 24 }]}>
                <TouchableOpacity style={styles.ctaButtonDark} onPress={handleNext}>
                    <Text style={styles.ctaTextWhiteBold}>{item.ctaText}</Text>
                    <Text style={styles.rocketIcon}>🚀</Text>
                </TouchableOpacity>

                {/* Final dots */}
                <View style={styles.dotsContainerFinal}>
                    {SLIDES.map((_, i) => (
                        <View
                            key={i}
                            style={[
                                styles.dotPrimarySmall,
                                i === currentIndex && styles.dotPrimaryActive
                            ]}
                        />
                    ))}
                </View>
            </View>
        </View>
    );

    const renderSlide = ({ item, index }) => {
        switch (item.type) {
            case 'fullscreen-image':
                return renderConnectionSlide(item, index);
            case 'gradient-bubbles':
                return renderMoodSlide(item, index);
            case 'mesh-gradient':
                return renderGamesSlide(item, index);
            case 'card-stack':
                return renderTopicsSlide(item, index);
            default:
                return null;
        }
    };

    return (
        <View style={styles.container}>
            <Animated.FlatList
                ref={flatListRef}
                data={SLIDES}
                renderItem={renderSlide}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={handleScroll}
                onMomentumScrollEnd={handleMomentumScrollEnd}
                scrollEventThrottle={16}
                bounces={false}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    slide: {
        width,
        height,
    },
    slideGradient: {
        ...StyleSheet.absoluteFillObject,
    },
    slideBackground: {
        ...StyleSheet.absoluteFillObject,
    },
    fullscreenImage: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    imageOverlay: {
        ...StyleSheet.absoluteFillObject,
    },

    // Glass Card
    glassCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        borderRadius: 24,
        padding: 32,
        paddingTop: 40,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.25)',
    },
    connectionCard: {
        alignItems: 'center',
    },

    // Skip Button Styles
    skipButtonGlass: {
        position: 'absolute',
        right: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    skipTextWhite: {
        color: 'rgba(255, 255, 255, 0.9)',
        fontSize: 14,
        fontWeight: '600',
    },
    skipTextDark: {
        color: '#1c0e0d',
        fontSize: 16,
        fontWeight: '700',
    },
    skipTextPrimary: {
        color: colors.primary,
        fontSize: 16,
        fontWeight: '700',
    },

    // Header
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 16,
    },
    headerRowEnd: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        paddingHorizontal: 24,
        paddingVertical: 16,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    backButtonLight: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    backArrow: {
        fontSize: 28,
        color: '#1c0e0d',
        marginTop: -2,
    },
    backArrowDark: {
        fontSize: 28,
        color: '#1c0e0d',
        marginTop: -2,
    },
    logoText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1c0e0d',
    },

    // Progress Dots
    dotsContainerInCard: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 32,
        gap: 8,
    },
    dotsContainerCenter: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 16,
        gap: 8,
    },
    dotsContainerFinal: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 16,
        gap: 6,
    },
    dotWhite: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
    },
    dotActiveWhite: {
        width: 24,
        height: 6,
        backgroundColor: '#FFFFFF',
    },
    dotDark: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
    },
    dotActivePrimary: {
        width: 32,
        height: 8,
        backgroundColor: colors.primary,
    },
    dotWhiteSmall: {
        width: 24,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    dotActiveWhiteLarge: {
        width: 48,
        height: 6,
        backgroundColor: '#FFFFFF',
    },
    dotPrimarySmall: {
        width: 8,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(249, 110, 103, 0.2)',
    },
    dotPrimaryActive: {
        width: 32,
        height: 4,
        backgroundColor: colors.primary,
    },

    // Bottom Container
    bottomContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 20,
    },

    // Titles
    titleWhite: {
        fontSize: 32,
        fontWeight: '700',
        color: '#FFFFFF',
        textAlign: 'center',
        lineHeight: 40,
        marginBottom: 16,
    },
    titleWhiteLarge: {
        fontSize: 32,
        fontWeight: '800',
        color: '#FFFFFF',
        textAlign: 'center',
        marginBottom: 8,
    },
    titleDark: {
        fontSize: 32,
        fontWeight: '800',
        color: '#1c0e0d',
        textAlign: 'center',
        marginBottom: 12,
    },
    subtitleWhite: {
        fontSize: 17,
        color: 'rgba(255, 255, 255, 0.8)',
        textAlign: 'center',
        lineHeight: 26,
        marginBottom: 40,
        paddingHorizontal: 8,
    },
    subtitleWhiteLight: {
        fontSize: 18,
        color: 'rgba(255, 255, 255, 0.8)',
        textAlign: 'center',
    },
    subtitleDark: {
        fontSize: 18,
        color: 'rgba(28, 14, 13, 0.8)',
        textAlign: 'center',
        lineHeight: 26,
        paddingHorizontal: 16,
    },

    // CTA Buttons
    ctaButtonWhite: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        paddingVertical: 20,
        borderRadius: 32,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
    },
    ctaTextBlack: {
        fontSize: 18,
        fontWeight: '700',
        color: '#000000',
    },
    ctaButtonOutline: {
        width: '100%',
        backgroundColor: 'transparent',
        paddingVertical: 18,
        borderRadius: 32,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    ctaTextWhite: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    ctaButtonPrimary: {
        width: '100%',
        backgroundColor: colors.primary,
        paddingVertical: 20,
        borderRadius: 32,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
    },
    ctaButtonDark: {
        width: '100%',
        backgroundColor: '#1c0e0d',
        paddingVertical: 20,
        borderRadius: 32,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 8,
    },
    ctaTextWhiteBold: {
        fontSize: 18,
        fontWeight: '800',
        color: '#FFFFFF',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    arcadeButton: {
        width: '80%',
        backgroundColor: '#ff6b6b',
        paddingVertical: 18,
        borderRadius: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
        shadowColor: '#b91c1c',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 1,
        shadowRadius: 0,
        elevation: 8,
    },
    arcadeButtonText: {
        fontSize: 20,
        fontWeight: '900',
        color: '#FFFFFF',
        textTransform: 'uppercase',
        letterSpacing: 2,
    },
    arrowIcon: {
        fontSize: 20,
        fontWeight: '700',
        color: '#000000',
    },
    arrowIconWhite: {
        fontSize: 20,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    gamepadIcon: {
        fontSize: 24,
    },
    rocketIcon: {
        fontSize: 20,
    },
    lockIcon: {
        fontSize: 12,
    },

    // Social Proof
    socialProof: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    avatarStack: {
        flexDirection: 'row',
    },
    stackedAvatar: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.4)',
    },
    socialProofText: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.6)',
        fontWeight: '500',
        letterSpacing: 2,
    },

    // Mood Bubbles
    moodIllustrationContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 24,
    },
    moodBubble: {
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
        borderRadius: 32,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    moodEmoji: {
        fontSize: 24,
    },
    moodLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1c0e0d',
    },
    pulsingCircle: {
        width: 200,
        height: 200,
        borderRadius: 100,
        borderWidth: 2,
        borderColor: 'rgba(249, 110, 103, 0.2)',
        borderStyle: 'dashed',
    },

    // Text Containers
    textContainerBottom: {
        paddingHorizontal: 32,
        paddingBottom: 32,
        alignItems: 'center',
    },
    textContainerCenterWhite: {
        alignItems: 'center',
        paddingHorizontal: 24,
        marginTop: 16,
    },

    // CTA Container
    ctaContainer: {
        paddingHorizontal: 24,
        alignItems: 'center',
    },
    privacyNote: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 24,
        opacity: 0.5,
    },
    privacyText: {
        fontSize: 12,
        color: '#1c0e0d',
    },
    stepIndicator: {
        marginTop: 24,
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.5)',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 3,
    },

    // Game Board
    gameIllustrationContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    isometricBoard: {
        width: 256,
        height: 256,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 4,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 16,
        transform: [{ rotateX: '60deg' }, { rotateZ: '-45deg' }],
    },
    gridContainer: {
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    gridCell: {
        width: '25%',
        height: '25%',
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    floatingHeart: {
        position: 'absolute',
    },
    heartIcon: {
        fontSize: 40,
    },
    heartIconOrange: {
        fontSize: 50,
    },
    puzzlePiece: {
        position: 'absolute',
    },
    puzzleIcon: {
        fontSize: 30,
        opacity: 0.8,
    },

    // Topics
    topicsTitleContainer: {
        paddingHorizontal: 32,
        paddingTop: 16,
    },
    topicsTitleLarge: {
        fontSize: 36,
        fontWeight: '800',
        color: '#1c0e0d',
        letterSpacing: -1,
    },
    topicsTitleAccent: {
        color: colors.primary,
        fontStyle: 'italic',
    },
    topicsSubtitle: {
        fontSize: 18,
        color: '#4a3b3a',
        marginTop: 12,
        lineHeight: 24,
    },

    // Card Stack
    cardStackContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    topicCard: {
        width: '100%',
        aspectRatio: 0.8,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10,
    },
    topicIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    topicIcon: {
        fontSize: 48,
    },
    topicLabel: {
        fontSize: 28,
        fontWeight: '800',
        color: '#FFFFFF',
        textTransform: 'uppercase',
        letterSpacing: 4,
    },
    topicLabelFeatured: {
        fontStyle: 'italic',
    },
    topicSublabelBadge: {
        marginTop: 16,
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 16,
    },
    topicSublabel: {
        fontSize: 12,
        fontWeight: '700',
        color: 'rgba(255, 255, 255, 0.8)',
        textTransform: 'uppercase',
        letterSpacing: 2,
    },

    // Meter
    meterContainer: {
        paddingHorizontal: 32,
        paddingBottom: 24,
    },
    meterHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: 12,
    },
    meterLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#1c0e0d',
        textTransform: 'uppercase',
        letterSpacing: 2,
    },
    meterValue: {
        fontSize: 18,
        fontWeight: '900',
        color: colors.primary,
    },
    meterTrack: {
        height: 16,
        backgroundColor: '#E5E5E5',
        borderRadius: 8,
        overflow: 'hidden',
        padding: 4,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.5)',
    },
    meterFill: {
        width: '65%',
        height: '100%',
        borderRadius: 4,
        backgroundColor: colors.primary,
    },
    meterHint: {
        textAlign: 'center',
        marginTop: 12,
        fontSize: 11,
        color: 'rgba(74, 59, 58, 0.6)',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
});

export default OnboardingScreen;
