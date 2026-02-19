// Premium Mood Screen - Share Your Vibes
// Updated: 96 animated Lottie emojis in a 10-column grid
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
import LottieView from 'lottie-react-native';
import GradientBackground from '../components/GradientBackground';
import { colors, spacing, borderRadius } from '../theme';
import { emojis } from '../constants/Moods';

const { width } = Dimensions.get('window');

// Grid config: 10 emojis per row
const GRID_COLUMNS = 10;
const GRID_GAP = 4;
const GRID_PADDING = spacing.lg;
const ITEM_SIZE = (width - GRID_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

// Single Emoji Item
const EmojiItem = ({ mood, isSelected, onSelect }) => {
    return (
        <TouchableOpacity
            onPress={() => onSelect(mood)}
            activeOpacity={0.7}
            style={[
                styles.emojiItem,
                isSelected && styles.emojiItemSelected,
            ]}
        >
            {mood.lottieSource ? (
                <LottieView
                    source={mood.lottieSource}
                    autoPlay
                    loop
                    style={{ width: ITEM_SIZE - 8, height: ITEM_SIZE - 8 }}
                />
            ) : (
                <Text style={styles.emojiText}>{mood.emoji}</Text>
            )}
        </TouchableOpacity>
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

    const handleSelectMood = (mood) => {
        if (isNavigating) return;
        setSelectedMood(mood);
    };

    const handleShare = () => {
        if (!selectedMood || isNavigating) return;
        onMoodSelect(selectedMood);
    };

    return (
        <GradientBackground variant="midnight" showOrbs={false} showHearts={false}>
            <ScrollView
                style={styles.container}
                contentContainerStyle={[
                    styles.contentContainer,
                    {
                        paddingTop: insets.top + spacing.md,
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
                    <View style={{ flex: 1 }}>
                        <Text style={styles.title}>How are you feeling?</Text>
                        <Text style={styles.subtitle}>Let {partnerName} know your vibe ✨</Text>
                    </View>
                </View>

                {/* Selected Mood Preview */}
                {selectedMood && (
                    <View style={styles.selectedCard}>
                        {selectedMood.lottieSource ? (
                            <LottieView
                                source={selectedMood.lottieSource}
                                autoPlay
                                loop
                                style={{ width: 80, height: 80 }}
                            />
                        ) : (
                            <Text style={styles.selectedEmoji}>{selectedMood.emoji}</Text>
                        )}
                        <Text style={styles.selectedLabel}>{selectedMood.label}</Text>
                    </View>
                )}

                {/* Emoji Grid - 10 per row */}
                <View style={styles.emojiGrid}>
                    {emojis.map((mood) => (
                        <EmojiItem
                            key={mood.id}
                            mood={mood}
                            isSelected={selectedMood?.id === mood.id}
                            onSelect={handleSelectMood}
                        />
                    ))}
                </View>

                {/* Share Button */}
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
                    <View style={styles.partnerCard}>
                        <Text style={styles.partnerTitle}>{partnerName} is feeling</Text>
                        <View style={styles.partnerContent}>
                            <View style={styles.partnerEmojiContainer}>
                                {partnerMood.lottieSource ? (
                                    <LottieView
                                        source={partnerMood.lottieSource}
                                        autoPlay
                                        loop
                                        style={{ width: 40, height: 40 }}
                                    />
                                ) : (
                                    <Text style={styles.partnerEmoji}>{partnerMood.emoji}</Text>
                                )}
                            </View>
                            <Text style={styles.partnerLabel}>{partnerMood.label}</Text>
                        </View>
                    </View>
                )}
            </ScrollView>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: GRID_PADDING,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginBottom: spacing.lg,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
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
        fontSize: 24,
        fontWeight: '800',
        color: colors.text,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 13,
        color: colors.textSecondary,
        marginTop: 2,
    },
    selectedCard: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.lg,
        marginBottom: spacing.md,
        borderRadius: borderRadius['2xl'],
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    selectedEmoji: {
        fontSize: 64,
        marginBottom: spacing.xs,
    },
    selectedLabel: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.text,
        marginTop: spacing.xs,
    },
    emojiGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: GRID_GAP,
        marginBottom: spacing.lg,
    },
    emojiItem: {
        width: ITEM_SIZE,
        height: ITEM_SIZE,
        borderRadius: ITEM_SIZE / 2,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    emojiItemSelected: {
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    emojiText: {
        fontSize: ITEM_SIZE * 0.6,
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
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        marginBottom: spacing.xl,
    },
    partnerTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: spacing.sm,
    },
    partnerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    partnerEmojiContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    partnerEmoji: {
        fontSize: 28,
    },
    partnerLabel: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
    },
});

export default MoodScreen;
