// Premium Mood Screen - Share Your Vibes
// Simplified version - removed animations to prevent iOS Fabric crash
import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    ScrollView,
    Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import GradientBackground from '../components/GradientBackground';
import Card from '../components/Card';
import { colors, spacing, borderRadius } from '../theme';

const { width } = Dimensions.get('window');

const moods = [
    { id: 'happy', emoji: '😊', label: 'Happy', color: colors.moodHappy, gradient: ['#FFD60A40', '#FFD60A10'] },
    { id: 'love', emoji: '🥰', label: 'In Love', color: colors.moodLove, gradient: ['#FF2D7840', '#FF2D7810'] },
    { id: 'playful', emoji: '😜', label: 'Playful', color: colors.moodPlayful, gradient: ['#BF5AF240', '#BF5AF210'] },
    { id: 'calm', emoji: '😌', label: 'Calm', color: colors.moodCalm, gradient: ['#64D2FF40', '#64D2FF10'] },
    { id: 'excited', emoji: '🤩', label: 'Excited', color: colors.moodExcited, gradient: ['#FF375F40', '#FF375F10'] },
    { id: 'grateful', emoji: '🙏', label: 'Grateful', color: colors.moodGrateful, gradient: ['#30D15840', '#30D15810'] },
    { id: 'missing', emoji: '💭', label: 'Missing You', color: colors.moodMissing, gradient: ['#FF9F0A40', '#FF9F0A10'] },
    { id: 'tired', emoji: '😴', label: 'Tired', color: colors.moodTired, gradient: ['#8E8E9340', '#8E8E9310'] },
    { id: 'romantic', emoji: '💕', label: 'Romantic', color: colors.primary, gradient: ['#FF2D7840', '#7C3AED20'] },
];

// Mood Orb Component - Completely static to prevent iOS Fabric crash
// No Animated components at all
const MoodOrb = ({ mood, index, isSelected, onSelect }) => {
    // Always render all views - use opacity instead of conditional rendering
    // This prevents iOS Fabric "Attempt to recycle a mounted view" crash
    return (
        <View style={styles.moodItemWrapper}>
            {/* Selection glow - always rendered, opacity controlled */}
            <View
                style={[
                    styles.selectionGlow,
                    {
                        backgroundColor: mood.color,
                        opacity: isSelected ? 0.4 : 0,
                    },
                ]}
            />

            <TouchableOpacity
                onPress={() => onSelect(mood, index)}
                activeOpacity={0.85}
            >
                <LinearGradient
                    colors={isSelected ? mood.gradient : [colors.glass, colors.glass]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                        styles.moodItem,
                        {
                            borderColor: isSelected ? mood.color : 'transparent',
                            borderWidth: 2,
                        },
                    ]}
                >
                    {/* Inner glow - always rendered, opacity controlled */}
                    <View style={[
                        styles.innerGlow,
                        {
                            backgroundColor: mood.color,
                            opacity: isSelected ? 0.1 : 0,
                        }
                    ]} />

                    <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                    <Text style={[
                        styles.moodLabel,
                        { color: isSelected ? colors.text : colors.textSecondary, fontWeight: isSelected ? '700' : '600' }
                    ]}>
                        {mood.label}
                    </Text>
                </LinearGradient>
            </TouchableOpacity>
        </View>
    );
};

export const MoodScreen = ({
    currentMood = null,
    partnerMood = null,
    partnerName = 'Your Love',
    onMoodSelect = () => { },
    onBack = () => { },
}) => {
    const [selectedMood, setSelectedMood] = useState(currentMood);
    const [isNavigating, setIsNavigating] = useState(false);
    const insets = useSafeAreaInsets();

    const handleSelectMood = (mood, index) => {
        if (isNavigating) return;
        setSelectedMood(mood);
    };

    const handleShare = () => {
        if (!selectedMood || isNavigating) return;
        //setIsNavigating(true);
        onMoodSelect(selectedMood);

        // Simple timeout to allow React to settle before navigation

    };

    return (
        <GradientBackground variant="midnight" showOrbs={false} showHearts={false}>
            <ScrollView
                style={styles.container}
                contentContainerStyle={[
                    styles.contentContainer,
                    {
                        paddingTop: insets.top + spacing.lg,
                        paddingBottom: insets.bottom + spacing.xl
                    }
                ]}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                        <Text style={styles.backIcon}>←</Text>
                    </TouchableOpacity>
                    <View>
                        <Text style={styles.title}>How are you feeling?</Text>
                        <Text style={styles.subtitle}>Let {partnerName} know your vibe ✨</Text>
                    </View>
                </View>

                {/* Selected Mood Preview */}
                {selectedMood && (
                    <View>
                        <View style={styles.selectedCard}>
                            <LinearGradient
                                colors={selectedMood.gradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={StyleSheet.absoluteFill}
                            />
                            {/* Decorative particles */}
                            <View style={styles.particleContainer}>
                                {[...Array(6)].map((_, i) => (
                                    <View
                                        key={i}
                                        style={[
                                            styles.decorParticle,
                                            {
                                                left: `${15 + i * 15}%`,
                                                top: `${20 + (i % 3) * 25}%`,
                                                backgroundColor: selectedMood.color,
                                                opacity: 0.3 + (i % 3) * 0.1,
                                                width: 4 + (i % 3) * 2,
                                                height: 4 + (i % 3) * 2,
                                            }
                                        ]}
                                    />
                                ))}
                            </View>

                            <Text style={styles.selectedEmoji}>{selectedMood.emoji}</Text>
                            <Text style={styles.selectedLabel}>{selectedMood.label}</Text>
                            <View style={[styles.selectedGlow, { backgroundColor: selectedMood.color }]} />
                        </View>
                    </View>
                )}

                {/* Mood Grid */}
                <Text style={styles.gridTitle}>Choose your mood</Text>
                <View style={styles.moodGrid}>
                    {moods.map((mood, index) => (
                        <MoodOrb
                            key={mood.id}
                            mood={mood}
                            index={index}
                            isSelected={selectedMood?.id === mood.id}
                            onSelect={handleSelectMood}
                        />
                    ))}
                </View>

                {/* Share Button - Using plain TouchableOpacity to avoid Fabric crash */}
                <View style={styles.buttonContainer}>
                    <TouchableOpacity
                        onPress={handleShare}
                        disabled={!selectedMood || isNavigating}
                        style={[
                            styles.shareButton,
                            (!selectedMood || isNavigating) && styles.shareButtonDisabled
                        ]}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.shareButtonText}>
                            {isNavigating ? 'Sharing...' : 'Share My Vibe 💫'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Partner's Mood */}
                {partnerMood && (
                    <Card variant="glass" padding="lg" style={styles.partnerCard} glowOnMount>
                        <View style={styles.partnerHeader}>
                            <Text style={styles.partnerTitle}>{partnerName} is feeling</Text>
                            <Text style={styles.partnerTime}>2h ago</Text>
                        </View>
                        <View style={styles.partnerContent}>
                            <View style={[styles.partnerEmojiContainer, { backgroundColor: partnerMood.color + '20' }]}>
                                <Text style={styles.partnerEmoji}>{partnerMood.emoji}</Text>
                            </View>
                            <View>
                                <Text style={styles.partnerLabel}>{partnerMood.label}</Text>
                                <Text style={styles.partnerHint}>Tap to send a reaction</Text>
                            </View>
                        </View>
                    </Card>
                )}
            </ScrollView>
        </GradientBackground>
    );
};

const GRID_GAP = spacing.md;
const ITEM_WIDTH = (width - spacing.xl * 2 - GRID_GAP * 2) / 3;

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: spacing.xl,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.lg,
        marginBottom: spacing['2xl'],
    },
    backButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.glass,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.glassBorder,
    },
    backIcon: {
        fontSize: 22,
        color: colors.text,
    },
    title: {
        fontSize: 26,
        fontWeight: '800',
        color: colors.text,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: 4,
    },
    selectedCard: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
        borderRadius: borderRadius['2xl'],
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: colors.glassBorderLight,
        overflow: 'hidden',
        position: 'relative',
    },
    particleContainer: {
        ...StyleSheet.absoluteFillObject,
    },
    decorParticle: {
        position: 'absolute',
        borderRadius: 10,
    },
    selectedEmoji: {
        fontSize: 80,
        marginBottom: spacing.sm,
    },
    selectedLabel: {
        fontSize: 26,
        fontWeight: '800',
        color: colors.text,
        letterSpacing: -0.5,
    },
    selectedGlow: {
        position: 'absolute',
        width: 250,
        height: 250,
        borderRadius: 125,
        opacity: 0.12,
        bottom: -125,
    },
    gridTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.textSecondary,
        marginBottom: spacing.md,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    moodGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: spacing.lg,
    },
    moodItemWrapper: {
        width: ITEM_WIDTH,
        marginBottom: GRID_GAP,
        position: 'relative',
    },
    selectionGlow: {
        position: 'absolute',
        top: -8,
        left: -8,
        right: -8,
        bottom: -8,
        borderRadius: borderRadius.xl + 8,
    },
    moodItem: {
        aspectRatio: 1,
        borderRadius: borderRadius.xl,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.glassBorder,
        overflow: 'hidden',
        position: 'relative',
    },
    innerGlow: {
        position: 'absolute',
        width: '120%',
        height: '120%',
        borderRadius: 100,
        opacity: 0.1,
    },
    moodEmoji: {
        fontSize: 36,
        marginBottom: spacing.xs,
    },
    moodLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: colors.textSecondary,
        textAlign: 'center',
    },
    buttonContainer: {
        marginBottom: spacing.xl,
    },
    shareButton: {
        backgroundColor: colors.primary,
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing['2xl'],
        borderRadius: borderRadius.xl,
        alignItems: 'center',
        justifyContent: 'center',
    },
    shareButtonDisabled: {
        opacity: 0.5,
    },
    shareButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '600',
    },
    partnerCard: {
        marginBottom: spacing.xl,
    },
    partnerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    partnerTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    partnerTime: {
        fontSize: 12,
        color: colors.textMuted,
    },
    partnerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.lg,
    },
    partnerEmojiContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    partnerEmoji: {
        fontSize: 36,
    },
    partnerLabel: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.text,
    },
    partnerHint: {
        fontSize: 12,
        color: colors.textMuted,
        marginTop: 2,
    },
});

export default MoodScreen;

