import React, { useState, useCallback, memo } from 'react';
import {
    Image,
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    FlatList,
    Dimensions,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius } from '../theme';
import { emojis } from '../constants/Moods';
import GradientBackground from '../components/GradientBackground';
import { getPenguinMoodImage } from '../constants/PenguinMoods';

const { width } = Dimensions.get('window');

const GRID_COLUMNS = 3;
const GRID_GAP = 10;
const GRID_PADDING = 16;
const ITEM_SIZE = (width - GRID_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

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
            <Image source={mood.imageSource} style={styles.emojiImage} />
            <Text style={styles.emojiLabel}>{mood.label}</Text>
        </TouchableOpacity>
    );
});

const MoodListHeader = ({ onBack, partnerName, selectedMood, partnerMood }) => {
    const partnerMoodId = partnerMood?.id || 'relaxed';
    const penguinMoodImage = getPenguinMoodImage(partnerMoodId, selectedMood?.id);

    return (
        <>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <Text style={styles.backIcon}>×</Text>
                </TouchableOpacity>
                <View style={styles.headerText}>
                    <Text style={styles.title}>How are you feeling?</Text>
                    <Text style={styles.subtitle}>Let {partnerName} know your vibe ✨</Text>
                </View>
            </View>

            {selectedMood && (
                <View style={styles.selectedCard}>
                    <Image source={penguinMoodImage} style={styles.selectedImage} />
                    <Text style={styles.selectedLabel}>{selectedMood.label}</Text>
                </View>
            )}
        </>
    );
};

const ListFooter = () => <View style={styles.listFooter} />;

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

    return (
        <View style={styles.overlay}>
            <TouchableOpacity
                style={styles.backdropPressable}
                activeOpacity={1}
                onPress={onBack}
            />
            <View style={styles.sheetContainer}>
                <View style={styles.dragIndicator} />
                <FlatList
                    data={emojis}
                    renderItem={renderEmoji}
                    keyExtractor={keyExtractor}
                    numColumns={GRID_COLUMNS}
                    columnWrapperStyle={styles.gridRow}
                    extraData={selectedMood}
                    contentContainerStyle={[
                        styles.contentContainer,
                        {
                            paddingTop: spacing.md,
                            paddingBottom: insets.bottom + spacing.xl + 80,
                        },
                    ]}
                    ListHeaderComponent={(
                        <MoodListHeader
                            onBack={onBack}
                            partnerName={partnerName}
                            selectedMood={selectedMood}
                            partnerMood={partnerMood}
                        />
                    )}
                    ListFooterComponent={ListFooter}
                    showsVerticalScrollIndicator={false}
                    initialNumToRender={10}
                    maxToRenderPerBatch={10}
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
                            Share My Vibe
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(5, 14, 62, 0.45)',
        justifyContent: 'flex-end',
    },
    backdropPressable: {
        ...StyleSheet.absoluteFillObject,
    },
    sheetContainer: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        maxHeight: '88%',
        minHeight: '60%',
        paddingTop: 10,
        ...Platform.select({
            ios: {
                shadowColor: '#C084FC',
                shadowOffset: { width: 0, height: -10 },
                shadowOpacity: 0.12,
                shadowRadius: 20,
            },
            android: {
                elevation: 24,
            },
        }),
    },
    dragIndicator: {
        width: 44,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#E2E8F0',
        alignSelf: 'center',
        marginBottom: 8,
    },
    outerContainer: {
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: GRID_PADDING,
    },
    listFooter: {
        height: 80,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginBottom: spacing.md,
    },
    headerText: {
        flex: 1,
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#FAE8FF',
        ...Platform.select({
            ios: {
                shadowColor: '#C084FC',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 4,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    backIcon: {
        fontSize: 22,
        color: colors.text,
        fontWeight: '600',
    },
    title: {
        fontSize: 22,
        fontWeight: '800',
        color: colors.text,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 13,
        color: colors.textSecondary,
        marginTop: 1,
    },
    selectedCard: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.sm,
        marginBottom: spacing.sm,
        borderRadius: borderRadius.xl,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#FAE8FF',
        ...Platform.select({
            ios: {
                shadowColor: '#C084FC',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.05,
                shadowRadius: 12,
            },
            android: {
                elevation: 3,
            },
        }),
    },
    selectedImage: {
        width: 170,
        height: 115,
        resizeMode: 'contain',
    },
    selectedLabel: {
        fontSize: 18,
        fontWeight: '800',
        color: colors.text,
        marginTop: 2,
    },
    gridRow: {
        gap: GRID_GAP,
        marginBottom: GRID_GAP,
    },
    emojiItem: {
        width: ITEM_SIZE,
        height: ITEM_SIZE * 0.95,
        borderRadius: borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#FAE8FF',
        paddingVertical: 4,
        paddingHorizontal: 4,
        ...Platform.select({
            ios: {
                shadowColor: '#C084FC',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.05,
                shadowRadius: 6,
            },
            android: {
                elevation: 1.5,
            },
        }),
    },
    emojiItemSelected: {
        backgroundColor: '#FFEBF0',
        borderWidth: 2,
        borderColor: '#FF758F',
    },
    emojiImage: {
        width: ITEM_SIZE * 0.65,
        height: ITEM_SIZE * 0.65,
        resizeMode: 'contain',
    },
    emojiLabel: {
        color: colors.text,
        fontSize: 11,
        fontWeight: '700',
        marginTop: 2,
    },
    stickyButtonContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        borderTopWidth: 1,
        borderTopColor: '#FAE8FF',
    },
    shareButton: {
        backgroundColor: colors.primary,
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing['2xl'],
        borderRadius: borderRadius.xl,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    shareButtonDisabled: {
        backgroundColor: '#E2E8F0',
        shadowOpacity: 0,
        elevation: 0,
    },
    shareButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '700',
    },
    partnerCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: '#FAE8FF',
        marginBottom: spacing.xl,
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
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
        backgroundColor: '#FFF0F3',
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
