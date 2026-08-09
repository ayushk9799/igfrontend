import React, { useState, useCallback, useEffect, useMemo, useRef, memo } from 'react';
import {
    BottomSheetBackdrop,
    BottomSheetFlatList,
    BottomSheetFooter,
    BottomSheetModal,
} from '@gorhom/bottom-sheet';
import {
    BackHandler,
    Image,
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    Dimensions,
    Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius } from '../theme';
import { emojis } from '../constants/Moods';
import { formatRelativeTime, translateUiTemplate, translateUiText } from '../i18n/uiTranslation';

const { width, height } = Dimensions.get('window');

const GRID_COLUMNS = 3;
const GRID_GAP = 10;
const GRID_PADDING = 16;
const ITEM_SIZE = (width - GRID_PADDING * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

const formatTimeAgo = (dateValue) => {
    const updatedAt = new Date(dateValue).getTime();
    if (!dateValue || Number.isNaN(updatedAt)) {
        return translateUiText("a while ago");
    }

    const diffMs = Math.max(Date.now() - updatedAt, 0);
    const minute = 60 * 1000; 
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diffMs < minute) {
        return formatRelativeTime(0, 'minute');
    }

    if (diffMs < hour) {
        const minutes = Math.floor(diffMs / minute);
        return formatRelativeTime(-minutes, 'minute', { style: 'long' });
    }

    if (diffMs < day) {
        const hours = Math.floor(diffMs / hour);
        return formatRelativeTime(-hours, 'hour', { style: 'long' });
    }

    const days = Math.floor(diffMs / day);
    return formatRelativeTime(-days, 'day', { style: 'long' });
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
            <Text style={styles.emojiLabel}>{translateUiText(mood.label)}</Text>
        </TouchableOpacity>
    );
});

const MoodListHeader = ({ onBack, partnerName, isRefreshPrompt, moodUpdatedAt, selectedMood }) => {
    const timeAgo = formatTimeAgo(moodUpdatedAt);
    const title = isRefreshPrompt
        ? translateUiTemplate("Last mood updated {{0}}", [timeAgo])
        : translateUiText("How are you feeling?");
    const subtitle = isRefreshPrompt
        ? translateUiTemplate("Let {{0}} know how you feel now", [partnerName])
        : translateUiTemplate("Let {{0}} know your vibe ✨", [partnerName]);

    return (
        <View style={styles.header}>
            <View style={styles.headerText}>
                <View style={styles.headerTitleRow}>
                    <Text style={styles.title}>{title}</Text>
                    <View style={styles.headerMoodStatus}>
                        <View style={[
                            styles.moodStatusDot,
                            selectedMood && styles.moodStatusDotActive,
                        ]} />
                        <Text style={styles.headerMoodStatusText} numberOfLines={1}>
                            {selectedMood
                                ? translateUiText(selectedMood.label)
                                : translateUiText("Select a mood")}
                        </Text>
                    </View>
                </View>
                <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
            <View style={styles.headerRight}>
                <TouchableOpacity onPress={onBack} style={styles.closeButton}>
                    <Text style={styles.closeIcon}>×</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const ListFooter = () => <View style={styles.listFooter} />;

const MoodSheetBackground = memo(({ style }) => (
    <View pointerEvents="none" style={[style, styles.sheetBackground]}>
        {Platform.OS === 'ios' ? (
            <BlurView intensity={42} tint="light" style={StyleSheet.absoluteFillObject} />
        ) : (
            <View style={[StyleSheet.absoluteFillObject, styles.androidBackground]} />
        )}
        <View style={styles.liquidTint} />
        <View style={styles.liquidHighlight} />
    </View>
));

export const MoodScreen = ({
    visible = true,
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
    const bottomSheetRef = useRef(null);
    const hasPresentedRef = useRef(false);
    const snapPoints = useMemo(() => [Math.round(height * 0.58)], []);

    useEffect(() => {
        if (visible) {
            setSelectedMood(currentMood);
        }
    }, [currentMood, visible]);

    useEffect(() => {
        if (visible) {
            const animationFrame = requestAnimationFrame(() => {
                hasPresentedRef.current = true;
                bottomSheetRef.current?.present();
            });
            return () => cancelAnimationFrame(animationFrame);
        }

        if (hasPresentedRef.current) {
            bottomSheetRef.current?.dismiss();
        }
        return undefined;
    }, [visible]);

    const closeSheet = useCallback(() => {
        if (hasPresentedRef.current) {
            bottomSheetRef.current?.dismiss();
        }
    }, []);

    useEffect(() => {
        if (!visible) return undefined;

        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            closeSheet();
            return true;
        });
        return () => subscription.remove();
    }, [closeSheet, visible]);

    const handleSelectMood = useCallback((mood) => {
        setSelectedMood(mood);
        onMoodPreview(mood);
    }, [onMoodPreview]);

    const handleShare = useCallback(() => {
        if (!selectedMood) return;
        onMoodSelect(selectedMood);
        closeSheet();
    }, [closeSheet, selectedMood, onMoodSelect]);

    const renderEmoji = useCallback(({ item }) => (
        <EmojiItem
            mood={item}
            isSelected={selectedMood?.id === item.id}
            onSelect={handleSelectMood}
        />
    ), [selectedMood?.id, handleSelectMood]);

    const keyExtractor = useCallback((item) => item.id, []);

    const renderBackdrop = useCallback(backdropProps => (
        <BottomSheetBackdrop
            {...backdropProps}
            appearsOnIndex={0}
            disappearsOnIndex={-1}
            opacity={0.18}
            pressBehavior="close"
        />
    ), []);

    const renderFooter = useCallback(footerProps => (
        <BottomSheetFooter
            {...footerProps}
            style={[
                styles.stickyButtonContainer,
                { paddingBottom: insets.bottom + spacing.sm },
            ]}
        >
            <TouchableOpacity
                onPress={handleShare}
                disabled={!selectedMood}
                style={[
                    styles.shareButton,
                    !selectedMood && styles.shareButtonDisabled,
                ]}
                activeOpacity={0.8}
            >
                <Text style={styles.shareButtonText}>{translateUiText("Share My Vibe")}</Text>
            </TouchableOpacity>
        </BottomSheetFooter>
    ), [handleShare, insets.bottom, selectedMood]);

    return (
        <BottomSheetModal
            ref={bottomSheetRef}
            snapPoints={snapPoints}
            enableDynamicSizing={false}
            enablePanDownToClose
            backdropComponent={renderBackdrop}
            footerComponent={renderFooter}
            backgroundComponent={MoodSheetBackground}
            handleIndicatorStyle={styles.dragIndicator}
            handleStyle={styles.handle}
            style={styles.sheetShadow}
            onDismiss={() => {
                hasPresentedRef.current = false;
                if (visible) onBack?.();
            }}
        >
                <BottomSheetFlatList
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
                            paddingBottom: insets.bottom + spacing.xl + 76,
                        },
                    ]}
                    ListHeaderComponent={(
                        <MoodListHeader
                            onBack={closeSheet}
                            partnerName={partnerName}
                            isRefreshPrompt={isRefreshPrompt}
                            moodUpdatedAt={moodUpdatedAt}
                            selectedMood={selectedMood}
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
        </BottomSheetModal>
    );
};

const styles = StyleSheet.create({
    sheetBackground: {
        backgroundColor: Platform.select({
            ios: 'rgba(255, 255, 255, 0.18)',
            android: 'rgba(255, 255, 255, 0.74)',
            default: 'rgba(255, 255, 255, 0.74)',
        }),
        borderTopLeftRadius: 26,
        borderTopRightRadius: 26,
        overflow: 'hidden',
    },
    androidBackground: {
        backgroundColor: 'rgba(255, 255, 255, 0.94)',
    },
    sheetShadow: {
        ...Platform.select({
            ios: {
                shadowColor: '#C084FC',
                shadowOffset: { width: 0, height: -10 },
                shadowOpacity: 0.12,
                shadowRadius: 20,
            },
            android: {
                elevation: 0,
            },
        }),
    },
    handle: {
        paddingTop: 8,
        paddingBottom: 4,
    },
    liquidTint: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255, 255, 255, 0.34)',
    },
    liquidHighlight: {
        position: 'absolute',
        top: 0,
        left: 20,
        right: 20,
        height: 1.5,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
    },
    dragIndicator: {
        width: 44,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#E2E8F0',
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
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    headerRight: {
        alignItems: 'flex-end',
        gap: 6,
    },
    headerMoodStatus: {
        maxWidth: 116,
        minHeight: 26,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        borderRadius: 13,
        backgroundColor: '#FFF0F5',
        borderWidth: 1,
        borderColor: '#FAD6E3',
    },
    headerMoodStatusText: {
        flexShrink: 1,
        color: '#B44768',
        fontSize: 11,
        fontWeight: '700',
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(250, 232, 255, 0.7)',
        ...Platform.select({
            ios: {
                shadowColor: '#C084FC',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 4,
            },
            android: {
                elevation: 0,
            },
        }),
    },
    closeIcon: {
        fontSize: 22,
        color: colors.text,
        fontWeight: '600',
    },
    title: {
        flexShrink: 1,
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
        backgroundColor: 'rgba(255, 255, 255, 0.72)',
        borderWidth: 1,
        borderColor: 'rgba(250, 232, 255, 0.6)',
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
                elevation: 0,
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
        paddingHorizontal: spacing.md,
        paddingTop: spacing.md,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: 'rgba(250, 232, 255, 0.8)',
    },
    shareButton: {
        backgroundColor: colors.primary,
        minHeight: 40,
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing['2xl'],
        borderRadius: borderRadius.xl,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 0,
    },
    shareButtonDisabled: {
        backgroundColor: '#E2E8F0',
        shadowOpacity: 0,
        elevation: 0,
    },
    shareButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
    },
    moodStatusDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: '#CBD5E1',
    },
    moodStatusDotActive: {
        backgroundColor: '#34C759',
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
        elevation: 0,
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
