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

const { width } = Dimensions.get('window');

const GRID_COLUMNS = 3;
const GRID_GAP = 10;
const GRID_PADDING = 16;
const ITEM_SIZE = (width - GRID_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

const formatTimeAgo = (dateValue) => {
    const updatedAt = new Date(dateValue).getTime();
    if (!dateValue || Number.isNaN(updatedAt)) {
        return 'a while';
    }

    const diffMs = Math.max(Date.now() - updatedAt, 0);
    const minute = 60 * 1000; 
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diffMs < minute) {
        return 'just now';
    }

    if (diffMs < hour) {
        const minutes = Math.floor(diffMs / minute);
        return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
    }

    if (diffMs < day) {
        const hours = Math.floor(diffMs / hour);
        return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    }

    const days = Math.floor(diffMs / day);
    return `${days} ${days === 1 ? 'day' : 'days'}`;
};

const getLastUpdatedText = (dateValue) => {
    if (!dateValue) {
        return 'Mood not updated yet';
    }

    const timeAgo = formatTimeAgo(dateValue);
    return timeAgo === 'just now'
        ? 'just now'
        : `${timeAgo} ago`;
};

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

const MoodListHeader = ({ onBack, partnerName, isRefreshPrompt, moodUpdatedAt }) => {
    const timeAgo = formatTimeAgo(moodUpdatedAt);
    const title = isRefreshPrompt
        ? `Last mood updated ${timeAgo}${timeAgo === 'just now' ? '' : ' ago'}`
        : 'How are you feeling?';
    const subtitle = isRefreshPrompt
        ? `Let ${partnerName} know how you feel now`
        : `Let ${partnerName} know your vibe ✨`;

    return (
        <View style={styles.header}>
            <TouchableOpacity onPress={onBack} style={styles.backButton}>
                <Text style={styles.backIcon}>×</Text>
            </TouchableOpacity>
            <View style={styles.headerText}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
            <View style={styles.updatedBadge}>
                <Text style={styles.updatedBadgeText}>{getLastUpdatedText(moodUpdatedAt)}</Text>
            </View>
        </View>
    );
};

const ListFooter = () => <View style={styles.listFooter} />;

export const MoodScreen = ({
    currentMood = null,
    partnerName = 'Your Love',
    onMoodSelect = () => { },
    onMoodPreview = () => { },
    onBack = () => { },
    isRefreshPrompt = false,
    moodUpdatedAt = null,
}) => {
    const [selectedMood, setSelectedMood] = useState(currentMood);
    const insets = useSafeAreaInsets();

    const handleSelectMood = useCallback((mood) => {
        setSelectedMood(mood);
        onMoodPreview(mood);
    }, [onMoodPreview]);

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
                            isRefreshPrompt={isRefreshPrompt}
                            moodUpdatedAt={moodUpdatedAt}
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
        backgroundColor: 'rgba(5, 14, 62, 0.18)',
        justifyContent: 'flex-end',
    },
    backdropPressable: {
        ...StyleSheet.absoluteFillObject,
    },
    sheetContainer: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 26,
        borderTopRightRadius: 26,
        maxHeight: '58%',
        minHeight: '46%',
        paddingTop: 8,
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
        marginBottom: 4,
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
        gap: spacing.sm,
        marginBottom: spacing.sm,
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
        fontSize: 20,
        fontWeight: '800',
        color: colors.text,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 13,
        color: colors.textSecondary,
        marginTop: 1,
    },
    updatedBadge: {
        flexShrink: 0,
        maxWidth: 116,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 14,
        backgroundColor: '#FFF0F5',
        borderWidth: 1,
        borderColor: '#FAD6E3',
    },
    updatedBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#B44768',
        textAlign: 'center',
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
