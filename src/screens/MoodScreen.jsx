// Premium Mood Screen - Share Your Vibes
// Optimised: static emoji grid with FlatList virtualisation, Lottie only for selected preview
import React, { useState, useCallback, memo } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    FlatList,
    Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LottieView from 'lottie-react-native';
import { colors, spacing, borderRadius } from '../theme';
import { emojis } from '../constants/Moods';

const { width } = Dimensions.get('window');

// Grid config: 10 emojis per row
const GRID_COLUMNS = 8;
const GRID_GAP = 0;
const GRID_PADDING = 4;
const ITEM_SIZE = (width - GRID_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

// Single Emoji Item — static text only for performance (no Lottie in grid)
const EmojiItem = memo(({ mood, isSelected, onSelect }) => {
    return (
        <TouchableOpacity
            onPress={() => onSelect(mood)}
            activeOpacity={0.7}
            style={[
                styles.emojiItem,
                isSelected && styles.emojiItemSelected,
            ]}
        >
            <Text style={styles.emojiText}>{mood.emoji}</Text>
        </TouchableOpacity>
    );
});

export const MoodScreen = ({
    currentMood = null,
    partnerMood = null,
    partnerName = 'Your Love',
    onMoodSelect = () => { },
    onBack = () => { },
}) => {
    const [selectedMood, setSelectedMood] = useState(currentMood);
    const insets = useSafeAreaInsets();

    const handleSelectMood = useCallback((mood) => {
        setSelectedMood(mood);
    }, []);

    const handleShare = useCallback(() => {
        if (!selectedMood) return;
        onMoodSelect(selectedMood);
    }, [selectedMood, onMoodSelect]);

    const renderEmoji = useCallback(({ item }) => (
        <EmojiItem
            mood={item}
            isSelected={selectedMood?.id === item.id}
            onSelect={handleSelectMood}
        />
    ), [selectedMood?.id, handleSelectMood]);

    const keyExtractor = useCallback((item) => item.id, []);

    // Header component (selected preview + title)
    const ListHeader = () => (
        <>
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

            {/* Selected Mood Preview — only Lottie instance on screen */}
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
        </>
    );

    // Footer spacer so content doesn't hide behind fixed button
    const ListFooter = () => <View style={{ height: 80 }} />;

    return (
        <View style={[styles.outerContainer, { backgroundColor: '#000000' }]}>
            <FlatList
                data={emojis}
                renderItem={renderEmoji}
                keyExtractor={keyExtractor}
                numColumns={GRID_COLUMNS}
                columnWrapperStyle={styles.gridRow}
                contentContainerStyle={[
                    styles.contentContainer,
                    {
                        paddingTop: insets.top + spacing.md,
                        paddingBottom: insets.bottom + spacing.xl,
                    },
                ]}
                ListHeaderComponent={ListHeader}
                ListFooterComponent={ListFooter}
                showsVerticalScrollIndicator={false}
                initialNumToRender={40}
                maxToRenderPerBatch={20}
                windowSize={5}
                removeClippedSubviews={true}
                getItemLayout={(data, index) => ({
                    length: ITEM_SIZE + GRID_GAP,
                    offset: (ITEM_SIZE + GRID_GAP) * Math.floor(index / GRID_COLUMNS),
                    index,
                })}
            />

            {/* Fixed Share Button — always visible */}
            <View style={[styles.stickyButtonContainer, { paddingBottom: insets.bottom + spacing.sm }]}>
                <TouchableOpacity
                    onPress={handleShare}
                    disabled={!selectedMood}
                    style={[
                        styles.shareButton,
                        !selectedMood && styles.shareButtonDisabled
                    ]}
                    activeOpacity={0.8}
                >
                    <Text style={styles.shareButtonText}>
                        Share My Vibe 💫
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    outerContainer: {
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
        backgroundColor: '#1A1A1A',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    backIcon: {
        fontSize: 22,
        color: '#FFFFFF',
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.6)',
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
        color: '#FFFFFF',
        marginTop: spacing.xs,
    },
    gridRow: {
        gap: GRID_GAP,
        marginBottom: 0,
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
    stickyButtonContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: spacing.md,
        paddingTop: spacing.sm,
        backgroundColor: '#000000',
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
        color: 'rgba(255,255,255,0.6)',
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
        color: '#FFFFFF',
    },
});

export default MoodScreen;
