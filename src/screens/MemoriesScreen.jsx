import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    BackHandler,
    FlatList,
    Image,
    Keyboard,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import LinearGradient from 'react-native-linear-gradient';
import {
    BottomSheetBackdrop,
    BottomSheetModal,
    BottomSheetView,
} from '@gorhom/bottom-sheet';
import {
    ArrowUpDown,
    CalendarDays,
    ChevronDown,
    ChevronLeft,
    Heart,
    ImagePlus,
    MoreVertical,
    Pencil,
    Plus,
    Trash2,
    X,
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { DatePicker as WheelDatePicker } from 'react-native-wheel-pick';
import { fontFamily, fontWeight } from '../constants/fonts';
import { colors } from '../theme';
import { storage } from '../utils/authStorage';
import { useSocket } from '../hooks/useSocket';
import {
    createMemory,
    deleteMemory,
    fetchMemories,
    requestMemoryImageUpload,
    updateMemory,
    uploadMemoryImage,
} from '../api/memoriesApi';
import {
    createMemoryImageFileName,
    getCapturedDateFromAsset,
    getDisplayAspectRatio,
    prepareMemoryImage,
} from '../utils/memoryImage';
import { getUiLocale, translateUiText } from '../i18n/uiTranslation';

const PAGE_LIMIT = 20;
const CACHE_LIMIT = 50;
const CAPTION_LIMIT = 500;
const TITLE_LIMIT = 80;

const TIMELINE_TYPES = {
    special_date: {
        label: "Special Date",
        modalTitle: 'Special date',
        saveLabel: 'Save date',
        placeholderTitle: 'Name this special date',
        placeholderCaption: 'What made this date special?',
    },
    memory: {
        label: "Memory",
        modalTitle: 'Memory',
        saveLabel: 'Save memory',
        placeholderTitle: 'Title this memory',
        placeholderCaption: 'What was memorable about that day?',
    },
};

const EMOJI_CATEGORIES = [
    {
        title: "Love & Romance",
        emojis: [
            { key: 'ring', glyph: '💍', label: "Ring" },
            { key: 'heart_lock', glyph: '💞', label: "Promise" },
            { key: 'kiss', glyph: '💋', label: "Kiss" },
            { key: 'heart', glyph: '❤️', label: "Heart" },
            { key: 'sparkles', glyph: '✨', label: "Sparkles" },
            { key: 'couple', glyph: '💑', label: "Couple" },
            { key: 'gift', glyph: '🎁', label: "Gift" },
            { key: 'letter', glyph: '💌', label: "Love Letter" },
            { key: 'heart_eyes', glyph: '😍', label: "Heart Eyes" },
        ]
    },
    {
        title: "Activities & Dates",
        emojis: [
            { key: 'coffee', glyph: '☕', label: "Coffee Date" },
            { key: 'wine', glyph: '🍷', label: "Wine Date" },
            { key: 'dinner', glyph: '🍽️', label: "Dinner" },
            { key: 'movie', glyph: '🎬', label: "Movie" },
            { key: 'popcorn', glyph: '🍿', label: "Popcorn" },
            { key: 'beer', glyph: '🍻', label: "Cheers" },
            { key: 'concert', glyph: '🎫', label: "Concert" },
            { key: 'game', glyph: '🎮', label: "Gaming" },
            { key: 'bowling', glyph: '🎳', label: "Bowling" },
            { key: 'karaoke', glyph: '🎤', label: "Karaoke" },
        ]
    },
    {
        title: "Places & Travel",
        emojis: [
            { key: 'trip', glyph: '✈️', label: "Flight" },
            { key: 'home', glyph: '🏡', label: "Home" },
            { key: 'hotel', glyph: '🏨', label: "Hotel" },
            { key: 'beach', glyph: '🏖️', label: "Beach" },
            { key: 'tent', glyph: '⛺', label: "Camping" },
            { key: 'car', glyph: '🚗', label: "Road Trip" },
            { key: 'train', glyph: '🚄', label: "Train" },
            { key: 'mountain', glyph: '🏔️', label: "Mountain" },
            { key: 'ferris_wheel', glyph: '🎡', label: "Theme Park" },
            { key: 'sunset', glyph: '🌇', label: "Sunset" },
        ]
    },
    {
        title: "Special Moments",
        emojis: [
            { key: 'calendar', glyph: '🗓️', label: "Special Day" },
            { key: 'balloon', glyph: '🎈', label: "Celebration" },
            { key: 'cake', glyph: '🎂', label: "Birthday" },
            { key: 'champagne', glyph: '🍾', label: "Celebration Drink" },
            { key: 'fireworks', glyph: '🎆', label: "Fireworks" },
            { key: 'camera', glyph: '📸', label: "Photo Session" },
            { key: 'star', glyph: '⭐', label: "Starry Night" },
            { key: 'rainbow', glyph: '🌈', label: "Rainbow" },
            { key: 'trophy', glyph: '🏆', label: "Achievement" },
            { key: 'graduation', glyph: '🎓', label: "Graduation" },
        ]
    }
];

const ALL_EMOJIS = EMOJI_CATEGORIES.reduce((acc, cat) => [...acc, ...cat.emojis], []);

const getSpecialDateIcon = (iconKey) => (
    ALL_EMOJIS.find((icon) => icon.key === iconKey) || ALL_EMOJIS[0]
);

const normalizeEntryType = (entryType) => {
    if (entryType === 'date') return 'special_date';
    if (entryType === 'photo' || entryType === 'moment') return 'memory';
    return entryType === 'special_date' ? 'special_date' : 'memory';
};

const formatDateParts = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return { month: 'MEM', day: '', line: '', time: '' };
    }

    return {
        month: date.toLocaleString(getUiLocale(), { month: 'short' }).toUpperCase(),
        day: String(date.getDate()).padStart(2, '0'),
        year: String(date.getFullYear()),
        line: date.toLocaleDateString(getUiLocale(), { month: 'long', day: 'numeric', year: 'numeric' }),
        time: date.toLocaleTimeString(getUiLocale(), { hour: 'numeric', minute: '2-digit' }),
    };
};

const cacheKeyForUser = (userId, order = 'asc') => `memories:${userId}:${order}`;

const readCachedMemories = (userId, order = 'asc') => {
    try {
        const specific = storage.getString(cacheKeyForUser(userId, order));
        if (specific) return JSON.parse(specific);
        const legacy = storage.getString(`memories:${userId}`);
        if (legacy) {
            const parsed = JSON.parse(legacy);
            return order === 'desc' ? [...parsed].reverse() : parsed;
        }
        return [];
    } catch {
        return [];
    }
};

const writeCachedMemories = (userId, memories, order = 'asc') => {
    try {
        storage.set(cacheKeyForUser(userId, order), JSON.stringify(memories.slice(0, CACHE_LIMIT)));
        if (order === 'asc') {
            storage.set(`memories:${userId}`, JSON.stringify(memories.slice(0, CACHE_LIMIT)));
        }
    } catch {
        // Cache is best-effort only.
    }
};

const mergeMemories = (current, incoming, order = 'asc') => {
    const byId = new Map();
    [...current, ...incoming].forEach((memory) => {
        if (memory?._id) byId.set(memory._id, memory);
    });

    return Array.from(byId.values()).sort((a, b) => {
        const aTime = new Date(a.capturedAt).getTime();
        const bTime = new Date(b.capturedAt).getTime();
        if (aTime !== bTime) {
            return order === 'asc' ? aTime - bTime : bTime - aTime;
        }
        const idComp = String(a._id).localeCompare(String(b._id));
        return order === 'asc' ? idComp : -idComp;
    });
};

const createImageUploadJob = (asset) => {
    const fileName = createMemoryImageFileName();
    const preparedImagePromise = prepareMemoryImage(asset, { fileName });
    const uploadTargetPromise = requestMemoryImageUpload({ fileName, mimeType: 'image/jpeg' });

    // Preparation and URL signing start as soon as a photo is chosen. Observe
    // early failures now; saveMemory will surface them if the user presses save.
    preparedImagePromise.catch(() => {});
    uploadTargetPromise.catch(() => {});

    return {
        sourceUri: asset.uri,
        preparedImagePromise,
        uploadTargetPromise,
    };
};

const MemoryImage = ({ uri, aspectRatio, onPress }) => {
    const [loaded, setLoaded] = useState(false);
    const [failed, setFailed] = useState(false);

    return (
        <TouchableOpacity
            activeOpacity={0.92}
            onPress={onPress}
            style={[styles.photoWrap, { aspectRatio }]}
            disabled={!onPress}
        >
            {!loaded && !failed && (
                <View style={styles.photoLoading}>
                    <ActivityIndicator color="#C96F81" />
                </View>
            )}
            {failed ? (
                <View style={styles.photoFailed}>
                    <Text style={styles.photoFailedText}>{translateUiText("Could not load photo")}</Text>
                </View>
            ) : (
                <Image
                    source={{ uri }}
                    style={styles.photo}
                    resizeMode="cover"
                    onLoadEnd={() => setLoaded(true)}
                    onError={() => setFailed(true)}
                />
            )}
        </TouchableOpacity>
    );
};

const MemoryCard = ({ item, isLast = false, onOptionsPress, onImagePress }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const parts = formatDateParts(item.capturedAt);
    const aspectRatio = getDisplayAspectRatio(item.width, item.height);
    const entryType = normalizeEntryType(item.entryType);
    const hasImage = Boolean(item.imageUrl);
    const isSpecialDate = entryType === 'special_date';
    const specialIcon = getSpecialDateIcon(item.iconKey);

    const captionText = item.caption || '';
    const hasLongCaption = captionText.length > 95 || (captionText.match(/\n/g) || []).length >= 2;

    return (
        <View style={styles.memoryRow}>
            <View style={styles.dateRail}>
                <Text style={styles.monthText}>{parts.month}</Text>
                <Text style={styles.dayText}>{parts.day}</Text>
                <Text style={styles.yearText}>{parts.year}</Text>
                <View style={styles.railDot} />
                {!isLast && <View style={styles.railLine} />}
            </View>
            <View style={styles.memoryContent}>
                {hasImage ? (
                    <View style={styles.photoCardWrapper}>
                        <View style={styles.photoContainer}>
                            <MemoryImage
                                uri={item.imageUrl}
                                aspectRatio={aspectRatio}
                                onPress={() => onImagePress?.({
                                    uri: item.imageUrl,
                                    title: item.title,
                                    dateLine: parts.line,
                                })}
                            />
                            <TouchableOpacity
                                style={styles.cardOptionsBadge}
                                onPress={() => onOptionsPress?.(item)}
                                activeOpacity={0.8}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <MoreVertical color="#FFFFFF" size={17} strokeWidth={2.2} />
                            </TouchableOpacity>
                        </View>
                        {(item.title || item.caption) ? (
                            <View style={styles.photoCardContent}>
                                <View style={styles.captionTitleLayout}>
                                    {isSpecialDate && (
                                        <Text style={styles.specialDatePhotoEmoji}>{specialIcon.glyph}</Text>
                                    )}
                                    {!!item.title && <Text style={styles.photoTitleText}>{item.title}</Text>}
                                </View>
                                {!!item.caption && (
                                    <View>
                                        <Text
                                            style={styles.captionText}
                                            numberOfLines={isExpanded ? undefined : 3}
                                        >
                                            {item.caption}
                                        </Text>
                                        {hasLongCaption && (
                                            <TouchableOpacity
                                                style={styles.moreButton}
                                                onPress={() => setIsExpanded((prev) => !prev)}
                                                activeOpacity={0.7}
                                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                            >
                                                <Text style={styles.moreButtonText}>
                                                    {isExpanded ? translateUiText('less') : translateUiText('...more')}
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                )}
                            </View>
                        ) : null}
                    </View>
                ) : (
                    isSpecialDate ? (
                        <View style={styles.specialDateCardWrapper}>
                            <LinearGradient
                                colors={['#FF829C', '#E55875']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.specialDateCardGradient}
                            />
                            <View style={styles.specialDateCardContent}>
                                <Text style={styles.specialDateCardEmoji}>{specialIcon.glyph}</Text>
                                <View style={styles.specialDateCardCopy}>
                                    {!!item.title && <Text style={styles.specialDateCardTitle}>{item.title}</Text>}
                                    {!!item.caption && (
                                        <View>
                                            <Text
                                                style={styles.specialDateCardCaption}
                                                numberOfLines={isExpanded ? undefined : 3}
                                            >
                                                {item.caption}
                                            </Text>
                                            {hasLongCaption && (
                                                <TouchableOpacity
                                                    style={styles.moreButton}
                                                    onPress={() => setIsExpanded((prev) => !prev)}
                                                    activeOpacity={0.7}
                                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                >
                                                    <Text style={styles.moreButtonTextInverted}>
                                                        {isExpanded ? translateUiText('less') : translateUiText('...more')}
                                                    </Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    )}
                                </View>
                                <TouchableOpacity
                                    style={styles.cardOptionsButtonTextCard}
                                    onPress={() => onOptionsPress?.(item)}
                                    activeOpacity={0.8}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <MoreVertical color="#FFFFFF" size={18} strokeWidth={2.2} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.momentCard}>
                            <View style={styles.momentIcon}>
                                <Heart color="#FF758F" size={22} strokeWidth={2} />
                            </View>
                            <View style={styles.momentCopy}>
                                {!!item.title && <Text style={styles.momentTitle}>{item.title}</Text>}
                                {!!item.caption && (
                                    <View>
                                        <Text
                                            style={styles.momentCaption}
                                            numberOfLines={isExpanded ? undefined : 3}
                                        >
                                            {item.caption}
                                        </Text>
                                        {hasLongCaption && (
                                            <TouchableOpacity
                                                style={styles.moreButton}
                                                onPress={() => setIsExpanded((prev) => !prev)}
                                                activeOpacity={0.7}
                                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                            >
                                                <Text style={styles.moreButtonText}>
                                                    {isExpanded ? translateUiText('less') : translateUiText('...more')}
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                )}
                            </View>
                            <TouchableOpacity
                                style={styles.cardOptionsButtonTextCard}
                                onPress={() => onOptionsPress?.(item)}
                                activeOpacity={0.8}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <MoreVertical color="#8E7982" size={18} strokeWidth={2.2} />
                            </TouchableOpacity>
                        </View>
                    )
                )}
            </View>
        </View>
    );
};

const PhotoLightboxModal = ({ visible, data, onClose }) => {
    const insets = useSafeAreaInsets();
    if (!visible || !data?.uri) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={onClose}
        >
            <View style={styles.lightboxRoot}>
                <Pressable style={styles.lightboxBackdrop} onPress={onClose} />
                <View style={[styles.lightboxHeader, { paddingTop: insets.top + 10 }]}>
                    <View style={styles.lightboxHeaderCopy}>
                        {!!data.title && (
                            <Text style={styles.lightboxTitle} numberOfLines={1}>
                                {data.title}
                            </Text>
                        )}
                        {!!data.dateLine && (
                            <Text style={styles.lightboxDate}>
                                {data.dateLine}
                            </Text>
                        )}
                    </View>
                    <TouchableOpacity
                        style={styles.lightboxCloseBtn}
                        onPress={onClose}
                        activeOpacity={0.8}
                    >
                        <X color="#FFFFFF" size={22} strokeWidth={2.5} />
                    </TouchableOpacity>
                </View>
                <View style={styles.lightboxImageWrap} pointerEvents="box-none">
                    <Image
                        source={{ uri: data.uri }}
                        style={styles.lightboxImage}
                        resizeMode="contain"
                    />
                </View>
            </View>
        </Modal>
    );
};

const MemoryOptionsModal = ({ visible, memory, onClose, onEdit, onDelete }) => {
    const insets = useSafeAreaInsets();
    const bottomSheetRef = useRef(null);
    const hasPresentedRef = useRef(false);
    const [activeMemory, setActiveMemory] = useState(memory);

    useEffect(() => {
        if (memory) {
            setActiveMemory(memory);
        }
    }, [memory]);

    const dismissSheet = useCallback(() => {
        if (hasPresentedRef.current) {
            bottomSheetRef.current?.dismiss();
        }
    }, []);

    useEffect(() => {
        if (visible && memory) {
            const frame = requestAnimationFrame(() => {
                hasPresentedRef.current = true;
                bottomSheetRef.current?.present();
            });
            return () => cancelAnimationFrame(frame);
        } else if (hasPresentedRef.current) {
            dismissSheet();
        }
        return undefined;
    }, [dismissSheet, memory, visible]);

    const renderBackdrop = useCallback(backdropProps => (
        <BottomSheetBackdrop
            {...backdropProps}
            appearsOnIndex={0}
            disappearsOnIndex={-1}
            opacity={0.45}
            pressBehavior="close"
        />
    ), []);

    const parts = formatDateParts(activeMemory?.capturedAt);
    const isSpecialDate = normalizeEntryType(activeMemory?.entryType) === 'special_date';

    const handleEdit = useCallback(() => {
        const targetMemory = activeMemory || memory;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        dismissSheet();
        if (targetMemory) {
            onEdit?.(targetMemory);
        }
    }, [activeMemory, dismissSheet, memory, onEdit]);

    const handleDelete = useCallback(() => {
        const targetMemory = activeMemory || memory;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        dismissSheet();
        if (targetMemory) {
            onDelete?.(targetMemory);
        }
    }, [activeMemory, dismissSheet, memory, onDelete]);

    return (
        <BottomSheetModal
            ref={bottomSheetRef}
            enableDynamicSizing
            enablePanDownToClose
            backdropComponent={renderBackdrop}
            backgroundStyle={styles.optionsSheetBackground}
            handleComponent={null}
            onDismiss={() => {
                hasPresentedRef.current = false;
                if (visible) {
                    onClose?.();
                }
            }}
        >
            <BottomSheetView
                style={[
                    styles.optionsSheet,
                    { paddingBottom: Math.max(insets.bottom, 16) + 12 },
                ]}
            >
                <View style={styles.optionsSheetHandle} />
                <View style={styles.optionsSheetHeader}>
                    <Text style={styles.optionsSheetTitle} numberOfLines={1}>
                        {activeMemory?.title || (isSpecialDate ? translateUiText("Special Date") : translateUiText("Memory"))}
                    </Text>
                    <Text style={styles.optionsSheetSubtitle}>{parts.line}</Text>
                </View>

                <TouchableOpacity
                    style={styles.optionsActionRow}
                    onPress={handleEdit}
                    activeOpacity={0.7}
                >
                    <View style={styles.optionsActionIconWrap}>
                        <Pencil color="#302832" size={18} strokeWidth={2.2} />
                    </View>
                    <Text style={styles.optionsActionText}>{translateUiText("Edit")}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.optionsActionRow, styles.optionsDeleteRow]}
                    onPress={handleDelete}
                    activeOpacity={0.7}
                >
                    <View style={[styles.optionsActionIconWrap, styles.optionsDeleteIconWrap]}>
                        <Trash2 color="#E55875" size={18} strokeWidth={2.2} />
                    </View>
                    <Text style={[styles.optionsActionText, styles.optionsDeleteText]}>
                        {translateUiText("Delete")}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.optionsCancelButton}
                    onPress={dismissSheet}
                    activeOpacity={0.8}
                >
                    <Text style={styles.optionsCancelText}>{translateUiText("Cancel")}</Text>
                </TouchableOpacity>
            </BottomSheetView>
        </BottomSheetModal>
    );
};

const EmptyState = ({ hasPartner, onAddPartner }) => {
    const spreadAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.spring(spreadAnim, {
            toValue: 1,
            friction: 6,
            tension: 40,
            useNativeDriver: true,
        }).start();
    }, [spreadAnim]);

    const card1Style = {
        zIndex: 1,
        transform: [
            { rotate: spreadAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-12deg'] }) },
            { translateX: spreadAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -50] }) },
            { translateY: spreadAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) },
        ],
    };

    const card2Style = {
        zIndex: 2,
        transform: [
            { rotate: spreadAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '10deg'] }) },
            { translateX: spreadAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 50] }) },
            { translateY: spreadAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) },
        ],
    };

    const card3Style = {
        zIndex: 3,
        transform: [
            { rotate: spreadAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-2deg'] }) },
            { translateX: spreadAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0] }) },
            { translateY: spreadAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 30] }) },
        ],
    };

    return (
        <View style={styles.emptyState}>
            <View style={styles.emptyStackContainer}>
                <Animated.Image source={require('../../assets/images/1_timeline.png')} style={[styles.emptyStackImage, card1Style]} />
                <Animated.Image source={require('../../assets/images/4_timeline.png')} style={[styles.emptyStackImage, card2Style]} />
                <Animated.Image source={require('../../assets/images/2_timeline.png')} style={[styles.emptyStackImage, card3Style]} />
            </View>
            <Text style={styles.emptyTitle}>{translateUiText("Your timeline is empty")}</Text>
            <Text style={styles.emptyText}>{translateUiText("Add when you met, first kisses, special dates, and the photos that belong to them.")}</Text>
            {!hasPartner && (
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={translateUiText("Add Partner")}
                    activeOpacity={0.88}
                    onPress={onAddPartner}
                    style={styles.emptyButton}
                >
                    <LinearGradient
                        colors={['#FF5E97', '#FFA1C9']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.emptyButtonGradient}
                    >
                        <Text style={styles.emptyButtonText}>{translateUiText("Add Partner")}</Text>
                    </LinearGradient>
                </TouchableOpacity>
            )}
        </View>
    );
};

const FAB_SIZE = 42;
const FAB_RIGHT = 22;
const ACTION_WRAP_WIDTH = 108;
const ACTION_ANCHOR_RIGHT = FAB_RIGHT - (ACTION_WRAP_WIDTH - FAB_SIZE) / 2;

const AddActionButton = ({ icon, label, style, onPress, pointerEvents }) => (
    <Animated.View style={[styles.addActionWrap, style]} pointerEvents={pointerEvents}>
        <TouchableOpacity
            style={styles.addActionTouchable}
            onPress={onPress}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={label}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
            <View style={styles.addActionButton}>
                {icon}
            </View>
            <Text style={styles.addActionLabel} numberOfLines={1}>{label}</Text>
        </TouchableOpacity>
    </Animated.View>
);

const TimelineFab = ({ isOpen, progress, onToggle, onSelect, bottomInset, pulse }) => {
    const backdropOpacity = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
    });
    const plusRotation = progress.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '45deg'],
    });

    const pulseAnim = useRef(new Animated.Value(1)).current;
    const pulseLoop = useRef(null);

    useEffect(() => {
        if (pulse && !isOpen) {
            pulseAnim.setValue(1);
            pulseLoop.current = Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.15,
                        duration: 700,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                ])
            );
            pulseLoop.current.start();
        } else {
            if (pulseLoop.current) {
                pulseLoop.current.stop();
                pulseLoop.current = null;
            }
            Animated.spring(pulseAnim, {
                toValue: 1,
                useNativeDriver: true,
            }).start();
        }

        return () => {
            if (pulseLoop.current) {
                pulseLoop.current.stop();
            }
        };
    }, [pulse, isOpen, pulseAnim]);

    const actionStyle = (x, y, index) => ({
        opacity: progress,
        transform: [
            {
                translateX: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, x],
                }),
            },
            {
                translateY: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, y],
                }),
            },
            {
                scale: progress.interpolate({
                    inputRange: [0, 0.25 + index * 0.08, 1],
                    outputRange: [0.7, 0.7, 1],
                }),
            },
        ],
    });

    const actionBottom = bottomInset + 70;

    return (
        <>
            {isOpen && (
                <Pressable style={styles.fabBackdropTouchable} onPress={onToggle}>
                    <Animated.View style={[styles.fabBackdrop, { opacity: backdropOpacity }]} />
                </Pressable>
            )}
            <View pointerEvents="box-none" style={styles.fabLayer}>
                <AddActionButton
                    label={translateUiText("Memory")}
                    icon={<Heart color="#FFFFFF" size={17} strokeWidth={2.2} />}
                    style={[
                        {
                            bottom: actionBottom,
                            right: ACTION_ANCHOR_RIGHT,
                        },
                        actionStyle(-112, -4, 0),
                    ]}
                    pointerEvents={isOpen ? 'auto' : 'none'}
                    onPress={() => onSelect('memory')}
                />
                <AddActionButton
                    label={translateUiText("Special Date")}
                    icon={<CalendarDays color="#FFFFFF" size={17} strokeWidth={2.2} />}
                    style={[
                        {
                            bottom: actionBottom,
                            right: ACTION_ANCHOR_RIGHT,
                        },
                        actionStyle(-36, -116, 1),
                    ]}
                    pointerEvents={isOpen ? 'auto' : 'none'}
                    onPress={() => onSelect('special_date')}
                />
                <Animated.View
                    style={[
                        styles.mainFabWrap,
                        {
                            bottom: bottomInset + 94,
                            right: FAB_RIGHT,
                            transform: [{ scale: pulseAnim }],
                        },
                    ]}
                >
                    <TouchableOpacity
                        style={styles.mainFab}
                        onPress={onToggle}
                        activeOpacity={0.9}
                        accessibilityRole="button"
                        accessibilityLabel={isOpen ? translateUiText("Close add menu") : translateUiText("Add memory or special date")}
                    >
                        <Animated.View style={{ transform: [{ rotate: plusRotation }] }}>
                            <Plus color="#FFFFFF" size={20} strokeWidth={2.8} />
                        </Animated.View>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </>
    );
};

const TimelineDatePicker = ({ value, onChange, onClose }) => {
    const insets = useSafeAreaInsets();
    const selectedDate = value || new Date();

    const handleIosDateChange = (event, date) => {
        if (date) {
            onChange(date);
        }
    };

    const handleAndroidDateChange = (newDate) => {
        if (!newDate) return;
        const parsed = newDate instanceof Date ? newDate : new Date(newDate);
        if (!Number.isNaN(parsed.getTime())) {
            onChange(parsed);
        }
    };

    const handleDone = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onClose();
    };

    return (
        <View style={styles.calendarOverlay}>
            <Pressable style={styles.calendarBackdrop} onPress={onClose} />
            <View style={[styles.calendarPanel, { paddingBottom: Math.max(insets.bottom, 14) + 12 }]}>
                <View style={styles.calendarHandle} />
                {Platform.OS === 'ios' ? (
                    <DateTimePicker
                        value={selectedDate}
                        mode="date"
                        display="spinner"
                        onChange={handleIosDateChange}
                        textColor="#302832"
                    />
                ) : (
                    <View style={styles.androidWheelPickerWrap}>
                        <WheelDatePicker
                            date={selectedDate}
                            mode="date"
                            onDateChange={handleAndroidDateChange}
                            textColor="#A8949E"
                            selectTextColor="#302832"
                            textSize={20}
                            isCyclic={true}
                            order="D-M-Y"
                            minimumDate={new Date(1950, 0, 1)}
                            maximumDate={new Date(2050, 11, 31)}
                            isShowSelectBackground={false}
                            isShowSelectLine={false}
                            style={styles.wheelPicker}
                        />
                        <View style={styles.wheelPickerHighlighter} pointerEvents="none" />
                    </View>
                )}
                <TouchableOpacity style={styles.calendarDoneButton} onPress={handleDone} activeOpacity={0.9}>
                    <Text style={styles.calendarDoneText}>{translateUiText("Done")}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const AddMemoryModal = ({
    visible,
    isEditing = false,
    editingMemory = null,
    entryType,
    draft,
    iconKey,
    setIconKey,
    title,
    setTitle,
    caption,
    setCaption,
    capturedAt,
    setCapturedAt,
    capturedAtSource,
    isSaving,
    onClose,
    onPickPhoto,
    onSave,
    onRemovePhoto,
}) => {
    const insets = useSafeAreaInsets();
    const [showPicker, setShowPicker] = useState(false);
    const [showIconPicker, setShowIconPicker] = useState(false);
    const [saveFooterHeight, setSaveFooterHeight] = useState(0);
    const dateParts = formatDateParts(capturedAt);
    const normalizedType = normalizeEntryType(entryType);
    const typeConfig = TIMELINE_TYPES[normalizedType] || TIMELINE_TYPES.memory;
    const isSpecialDate = normalizedType === 'special_date';

    useEffect(() => {
        if (!visible) {
            setShowPicker(false);
            setShowIconPicker(false);
        }
    }, [visible]);

    const modalTitle = isEditing
        ? (isSpecialDate ? translateUiText("Edit special date") : translateUiText("Edit memory"))
        : translateUiText(typeConfig.modalTitle);

    const saveLabel = isEditing
        ? translateUiText("Save changes")
        : translateUiText(typeConfig.saveLabel);

    const openDatePicker = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        Keyboard.dismiss();
        setShowPicker(true);
    };

    const hasUnsavedChanges = useMemo(() => {
        if (isEditing && editingMemory) {
            const titleChanged = title.trim() !== (editingMemory.title || '').trim();
            const captionChanged = caption.trim() !== (editingMemory.caption || '').trim();
            const iconChanged = iconKey !== (editingMemory.iconKey || 'ring');
            const photoRemoved = !draft?.uri && Boolean(editingMemory.imageUrl);
            const photoAdded = Boolean(draft?.asset);
            const initialDate = editingMemory.capturedAt ? new Date(editingMemory.capturedAt).toDateString() : '';
            const currentDate = capturedAt ? new Date(capturedAt).toDateString() : '';
            const dateChanged = initialDate !== currentDate;
            return titleChanged || captionChanged || iconChanged || photoRemoved || photoAdded || dateChanged;
        }
        return Boolean(title.trim() || caption.trim() || draft?.uri);
    }, [caption, capturedAt, draft, editingMemory, iconKey, isEditing, title]);

    const handleRequestClose = useCallback(() => {
        if (isSaving) return;

        if (showIconPicker) {
            setShowIconPicker(false);
            return;
        }

        if (showPicker) {
            setShowPicker(false);
            return;
        }

        if (!hasUnsavedChanges) {
            onClose();
            return;
        }

        Alert.alert(
            translateUiText("Discard changes?"),
            translateUiText("Your unsaved changes will be lost."),
            [
                { text: translateUiText("Keep editing"), style: "cancel" },
                {
                    text: translateUiText("Discard"),
                    style: "destructive",
                    onPress: onClose,
                },
            ],
        );
    }, [hasUnsavedChanges, isSaving, onClose, showIconPicker, showPicker]);

    useEffect(() => {
        if (!visible) return;
        const backSubscription = BackHandler.addEventListener('hardwareBackPress', () => {
            handleRequestClose();
            return true;
        });
        return () => backSubscription.remove();
    }, [visible, handleRequestClose]);

    return (
        <Modal visible={visible} transparent={false} animationType="slide" statusBarTranslucent onRequestClose={handleRequestClose}>
            <View style={styles.pageRoot}>
                <LinearGradient
                    colors={['#F8D9EC', '#FFF7FA', '#FFF4F7', '#F7D8F2']}
                    locations={[0, 0.34, 0.72, 1]}
                    start={{ x: 0.25, y: 0 }}
                    end={{ x: 0.75, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />
                <View style={[styles.pageHeader, { paddingTop: insets.top + 10 }]}>
                    <TouchableOpacity
                        style={styles.pageHeaderBack}
                        onPress={handleRequestClose}
                        disabled={isSaving}
                        accessibilityRole="button"
                        accessibilityLabel={translateUiText("Back")}
                    >
                        <ChevronLeft color="#302832" size={24} strokeWidth={2} />
                    </TouchableOpacity>
                    <Text style={styles.pageHeaderTitle}>{modalTitle}</Text>
                    <View style={styles.pageHeaderSpacer} />
                </View>

                <KeyboardAwareScrollView
                    style={styles.pageScroll}
                    contentContainerStyle={[styles.pageScrollContent, { paddingBottom: saveFooterHeight + 24 }]}
                    bottomOffset={saveFooterHeight + 12}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.formIntro}>
                        <View style={styles.formIntroIcon}>
                            {isSpecialDate ? (
                                <CalendarDays color="#C96F81" size={26} strokeWidth={1.8} />
                            ) : (
                                <Heart color="#C96F81" size={26} strokeWidth={1.8} />
                            )}
                        </View>
                        <Text style={styles.formIntroTitle}>
                            {translateUiText(isSpecialDate ? "A day to remember" : "Keep this moment")}
                        </Text>
                        <Text style={styles.formIntroSubtitle}>
                            {translateUiText(isSpecialDate
                                ? "Celebrate the little milestones in your story."
                                : "The little things are part of your story, too.")}
                        </Text>
                    </View>

                    <View style={styles.formCard}>
                        <View style={styles.fieldHeader}>
                            <Text style={styles.fieldLabel}>{translateUiText("Title")}</Text>
                            <Text style={styles.fieldHint}>
                                {translateUiText(isSpecialDate ? "Required" : "Optional")}
                            </Text>
                        </View>
                        <View style={styles.titleRow}>
                            {isSpecialDate && (
                                <TouchableOpacity
                                    style={styles.inlineEmojiButton}
                                    onPress={() => {
                                        Keyboard.dismiss();
                                        setShowIconPicker(true);
                                    }}
                                    activeOpacity={0.86}
                                    disabled={isSaving}
                                    accessibilityRole="button"
                                    accessibilityLabel={translateUiText("Choose an icon")}
                                >
                                    <Text style={styles.inlineEmojiGlyph}>{getSpecialDateIcon(iconKey).glyph}</Text>
                                    <View style={styles.inlineEmojiChevronBadge}>
                                        <ChevronDown color="#B56F7E" size={12} strokeWidth={2.5} />
                                    </View>
                                </TouchableOpacity>
                            )}
                            <TextInput
                                style={[styles.titleInput, styles.titleInputFlex]}
                                value={title}
                                onChangeText={(value) => setTitle(value.slice(0, TITLE_LIMIT))}
                                placeholder={translateUiText(typeConfig.placeholderTitle)}
                                placeholderTextColor="#B09AA4"
                                accessibilityLabel={translateUiText("Title")}
                                maxLength={TITLE_LIMIT}
                                editable={!isSaving}
                            />
                        </View>
                        {title.length > 0 && (
                            <Text style={[styles.charCountText, title.length >= TITLE_LIMIT && styles.charCountLimitText]}>
                                {title.length}/{TITLE_LIMIT}
                            </Text>
                        )}

                        <View style={styles.fieldDivider} />
                        <Text style={styles.fieldLabel}>{translateUiText("Date")}</Text>
                        <TouchableOpacity
                            style={styles.dateChip}
                            onPress={openDatePicker}
                            disabled={isSaving}
                            activeOpacity={0.86}
                            accessibilityRole="button"
                            accessibilityLabel={`${translateUiText("Date")}: ${dateParts.line}`}
                            accessibilityHint={translateUiText("Choose a date")}
                        >
                            <View style={styles.dateChipIcon}>
                                <CalendarDays color="#C96F81" size={20} strokeWidth={1.8} />
                            </View>
                            <Text style={styles.dateChipText}>{dateParts.line}</Text>
                            <ChevronDown color="#B56F7E" size={18} strokeWidth={2} />
                        </TouchableOpacity>
                        {draft?.uri && capturedAtSource === 'exif' && (
                            <Text style={styles.dateSourceText}>{translateUiText("Date from your photo • tap to change")}</Text>
                        )}

                        <View style={styles.fieldDivider} />
                        <View style={styles.fieldHeader}>
                            <Text style={styles.fieldLabel}>{translateUiText("Note")}</Text>
                            <Text style={[styles.charCountText, caption.length >= CAPTION_LIMIT && styles.charCountLimitText]}>
                                {caption.length}/{CAPTION_LIMIT}
                            </Text>
                        </View>
                        <TextInput
                            style={styles.captionInput}
                            value={caption}
                            onChangeText={(value) => setCaption(value.slice(0, CAPTION_LIMIT))}
                            placeholder={translateUiText(typeConfig.placeholderCaption)}
                            placeholderTextColor="#B09AA4"
                            accessibilityLabel={translateUiText("Note")}
                            multiline
                            scrollEnabled={false}
                            maxLength={CAPTION_LIMIT}
                            editable={!isSaving}
                        />
                    </View>

                    <View style={styles.photoSection}>
                        <View style={styles.fieldHeader}>
                            <Text style={styles.fieldLabel}>{translateUiText("Photo")}</Text>
                            <Text style={styles.fieldHint}>{translateUiText("Optional")}</Text>
                        </View>
                        {draft?.uri ? (
                            <View style={styles.previewButton}>
                                <Image source={{ uri: draft.uri }} style={styles.previewImage} resizeMode="cover" />
                                <TouchableOpacity
                                    style={styles.changePhotoBadge}
                                    onPress={onPickPhoto}
                                    disabled={isSaving}
                                    activeOpacity={0.8}
                                    accessibilityRole="button"
                                    accessibilityLabel={translateUiText("Change photo")}
                                >
                                    <ImagePlus color="#FFFFFF" size={16} strokeWidth={2} />
                                    <Text style={styles.changePhotoText}>{translateUiText("Change photo")}</Text>
                                </TouchableOpacity>
                                {!isSaving && (
                                    <TouchableOpacity
                                        style={styles.removePhotoBadge}
                                        onPress={onRemovePhoto}
                                        activeOpacity={0.8}
                                        accessibilityRole="button"
                                        accessibilityLabel={translateUiText("Remove photo")}
                                    >
                                        <X color="#FFFFFF" size={16} strokeWidth={2.5} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={styles.photoDropzone}
                                onPress={onPickPhoto}
                                activeOpacity={0.85}
                                disabled={isSaving}
                                accessibilityRole="button"
                                accessibilityLabel={translateUiText("Add photo")}
                            >
                                <View style={styles.photoDropzoneIconWrap}>
                                    <ImagePlus color="#C96F81" size={24} strokeWidth={1.8} />
                                </View>
                                <View style={styles.photoDropzoneCopy}>
                                    <Text style={styles.photoDropzoneText}>{translateUiText("Add a photo to this day")}</Text>
                                    <Text style={styles.photoDropzoneSubtext}>{translateUiText("Choose from your gallery")}</Text>
                                </View>
                                <Plus color="#C96F81" size={20} strokeWidth={2} />
                            </TouchableOpacity>
                        )}
                    </View>
                </KeyboardAwareScrollView>

                <KeyboardStickyView
                    style={[styles.saveFooter, { paddingBottom: Math.max(insets.bottom, 16) }]}
                    offset={{ opened: insets.bottom }}
                    onLayout={(event) => setSaveFooterHeight(event.nativeEvent.layout.height)}
                >
                    <TouchableOpacity
                        style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                        onPress={onSave}
                        disabled={isSaving}
                        activeOpacity={0.9}
                        accessibilityRole="button"
                        accessibilityLabel={saveLabel}
                        accessibilityState={{ disabled: isSaving, busy: isSaving }}
                    >
                        {isSaving ? (
                            <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                            <Text style={styles.saveButtonText}>{saveLabel}</Text>
                        )}
                    </TouchableOpacity>
                </KeyboardStickyView>
            </View>
            {showPicker && (
                <TimelineDatePicker
                    value={capturedAt}
                    onChange={setCapturedAt}
                    onClose={() => setShowPicker(false)}
                />
            )}

            {showIconPicker && (
                <View style={styles.emojiOverlay}>
                    <Pressable style={styles.emojiModalBackdrop} onPress={() => setShowIconPicker(false)} />
                    <View style={[styles.emojiSheet, { paddingBottom: insets.bottom + 14 }]}>
                        <View style={styles.emojiSheetHandle} />
                        <View style={styles.emojiSheetHeader}>
                            <Text style={styles.emojiSheetTitle}>{translateUiText("Choose an icon")}</Text>
                            <TouchableOpacity style={styles.emojiSheetClose} onPress={() => setShowIconPicker(false)}>
                                <X color="#352B35" size={20} strokeWidth={2} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.emojiScroll} showsVerticalScrollIndicator={false}>
                            {EMOJI_CATEGORIES.map((category) => (
                                <View key={category.title} style={styles.emojiCategoryBlock}>
                                    <Text style={styles.emojiCategoryTitle}>{translateUiText(category.title)}</Text>
                                    <View style={styles.emojiCategoryGrid}>
                                        {category.emojis.map((icon) => {
                                            const active = icon.key === iconKey;
                                            return (
                                                <TouchableOpacity
                                                    key={icon.key}
                                                    style={[styles.emojiGridOption, active && styles.emojiGridOptionActive]}
                                                    onPress={() => {
                                                        setIconKey(icon.key);
                                                        setShowIconPicker(false);
                                                    }}
                                                    activeOpacity={0.75}
                                                >
                                                    <Text style={styles.emojiOptionGlyph}>{icon.glyph}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            )}
        </Modal>
    );
};

const MemoriesScreen = ({ userId, hasPartner, onLinkPartner, onOptionsOpenChange }) => {
    const insets = useSafeAreaInsets();
    const socket = useSocket();
    const fabProgress = useRef(new Animated.Value(0)).current;
    const loadedUserRef = useRef(null);
    const imageUploadJobRef = useRef(null);
    const saveInFlightRef = useRef(false);

    const [memories, setMemories] = useState(() => userId && hasPartner ? readCachedMemories(userId, 'asc') : []);
    const [cursor, setCursor] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
    const [entryType, setEntryType] = useState('memory');
    const [iconKey, setIconKey] = useState('ring');
    const [draft, setDraft] = useState(null);
    const [title, setTitle] = useState('');
    const [caption, setCaption] = useState('');
    const [capturedAt, setCapturedAtState] = useState(new Date());
    const [capturedAtSource, setCapturedAtSource] = useState('upload_time');
    const [isSaving, setIsSaving] = useState(false);
    const [editingMemory, setEditingMemory] = useState(null);
    const [optionsMemory, setOptionsMemory] = useState(null);
    const [lightboxImage, setLightboxImage] = useState(null);
    const [sortOrder, setSortOrder] = useState('asc'); // 'asc' = oldest first (scrapbook), 'desc' = newest first

    const handleSetOptionsMemory = useCallback((memory) => {
        setOptionsMemory(memory);
        onOptionsOpenChange?.(Boolean(memory));
    }, [onOptionsOpenChange]);

    useEffect(() => {
        return () => {
            onOptionsOpenChange?.(false);
        };
    }, [onOptionsOpenChange]);

    useEffect(() => {
        Animated.spring(fabProgress, {
            toValue: isActionMenuOpen ? 1 : 0,
            useNativeDriver: true,
            friction: 7,
            tension: 90,
        }).start();
    }, [fabProgress, isActionMenuOpen]);

    const setCapturedAt = useCallback((value) => {
        setCapturedAtState(value);
        setCapturedAtSource('manual');
    }, []);

    const loadMemories = useCallback(async ({ reset = false, isPullRefresh = false, targetSort = sortOrder } = {}) => {
        if (!userId || !hasPartner || isLoading || isRefreshing) return;

        if (!reset && !hasMore) return;

        if (isPullRefresh) {
            setIsRefreshing(true);
        } else if (reset) {
            if (memories.length === 0) setIsLoading(true);
        } else {
            setIsLoading(true);
        }

        try {
            const result = await fetchMemories({
                userId,
                cursor: reset ? null : cursor,
                limit: PAGE_LIMIT,
                sort: targetSort,
            });
            const incoming = result.memories || [];

            setMemories((prev) => {
                const next = reset ? incoming : mergeMemories(prev, incoming, targetSort);
                writeCachedMemories(userId, next, targetSort);
                return next;
            });
            setCursor(result.nextCursor || null);
            setHasMore(Boolean(result.hasMore));

            incoming.slice(0, 3).forEach((memory) => {
                if (memory?.imageUrl) Image.prefetch(memory.imageUrl).catch(() => {});
            });
        } catch (error) {
            Alert.alert(
                translateUiText("Memories unavailable"),
                translateUiText(error.message || "Could not load memories."),
            );
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [cursor, hasMore, hasPartner, isLoading, isRefreshing, memories.length, sortOrder, userId]);

    const handleToggleSortOrder = useCallback(() => {
        const nextOrder = sortOrder === 'asc' ? 'desc' : 'asc';
        setSortOrder(nextOrder);
        setCursor(null);
        setHasMore(true);
        const cached = readCachedMemories(userId, nextOrder);
        setMemories(cached);
        loadMemories({ reset: true, isPullRefresh: false, targetSort: nextOrder });
    }, [loadMemories, sortOrder, userId]);

    // Initial load and partner change effect
    useEffect(() => {
        if (!hasPartner) {
            loadedUserRef.current = null;
            setMemories([]);
            setCursor(null);
            setHasMore(true);
            setIsLoading(false);
            setIsRefreshing(false);
            return;
        }

        if (!userId || loadedUserRef.current === userId) return;

        loadedUserRef.current = userId;
        setMemories(readCachedMemories(userId, sortOrder));
        setCursor(null);
        setHasMore(true);
        loadMemories({ reset: true, isPullRefresh: false, targetSort: sortOrder });
    }, [hasPartner, loadMemories, sortOrder, userId]);

    // Real-time Socket.io synchronization with partner
    useEffect(() => {
        if (!socket || !hasPartner || !userId) return;

        const onMemoryCreated = (newMemory) => {
            if (!newMemory?._id) return;
            setMemories((prev) => {
                if (prev.some((m) => m._id === newMemory._id)) return prev;
                const next = mergeMemories([newMemory], prev, sortOrder);
                writeCachedMemories(userId, next, sortOrder);
                return next;
            });
        };

        const onMemoryUpdated = (updated) => {
            if (!updated?._id) return;
            setMemories((prev) => {
                const next = prev.map((m) => (m._id === updated._id ? { ...m, ...updated } : m));
                const sorted = mergeMemories(next, [], sortOrder);
                writeCachedMemories(userId, sorted, sortOrder);
                return sorted;
            });
        };

        const onMemoryDeleted = ({ memoryId }) => {
            if (!memoryId) return;
            setMemories((prev) => {
                const next = prev.filter((m) => m._id !== memoryId);
                writeCachedMemories(userId, next, sortOrder);
                return next;
            });
        };

        socket.on('memory:created', onMemoryCreated);
        socket.on('memory:updated', onMemoryUpdated);
        socket.on('memory:deleted', onMemoryDeleted);

        return () => {
            socket.off('memory:created', onMemoryCreated);
            socket.off('memory:updated', onMemoryUpdated);
            socket.off('memory:deleted', onMemoryDeleted);
        };
    }, [hasPartner, socket, sortOrder, userId]);

    const resetDraft = useCallback(() => {
        setEditingMemory(null);
        setDraft(null);
        setIconKey('ring');
        setTitle('');
        setCaption('');
        setCapturedAtState(new Date());
        setCapturedAtSource('upload_time');
        imageUploadJobRef.current = null;
        setIsSaving(false);
    }, []);

    const openAdd = useCallback((type = 'memory') => {
        if (!hasPartner) {
            onLinkPartner?.();
            return;
        }

        resetDraft();
        setEntryType(type);
        setIsActionMenuOpen(false);
        setModalVisible(true);
    }, [hasPartner, onLinkPartner, resetDraft]);

    const handleStartEdit = useCallback((memory) => {
        handleSetOptionsMemory(null);
        setEditingMemory(memory);
        setEntryType(memory.entryType || 'memory');
        setIconKey(memory.iconKey || 'ring');
        setTitle(memory.title || '');
        setCaption(memory.caption || '');
        setCapturedAtState(new Date(memory.capturedAt));
        setCapturedAtSource(memory.capturedAtSource || 'manual');
        if (memory.imageUrl) {
            setDraft({
                uri: memory.imageUrl,
                width: memory.width,
                height: memory.height,
                isExisting: true,
            });
        } else {
            setDraft(null);
        }
        setModalVisible(true);
    }, [handleSetOptionsMemory]);

    const handleDeleteMemory = useCallback((memory) => {
        if (!memory?._id || !userId) return;

        Alert.alert(
            translateUiText("Delete Timeline Entry"),
            translateUiText("Are you sure you want to remove this entry?"),
            [
                { text: translateUiText("Cancel"), style: "cancel" },
                {
                    text: translateUiText("Delete"),
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await deleteMemory({ userId, memoryId: memory._id });
                            setMemories((prev) => {
                                const next = prev.filter((m) => m._id !== memory._id);
                                writeCachedMemories(userId, next, sortOrder);
                                return next;
                            });
                        } catch (error) {
                            Alert.alert(
                                translateUiText("Could not delete"),
                                translateUiText(error.message || "Please try again."),
                            );
                        }
                    },
                },
            ],
        );
    }, [userId]);

    const toggleActionMenu = useCallback(() => {
        if (!hasPartner) {
            openAdd('memory');
            return;
        }

        setIsActionMenuOpen((prev) => !prev);
    }, [hasPartner, openAdd]);

    const pickPhoto = useCallback(async () => {
        try {
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
                Alert.alert(translateUiText("Photo access needed"), translateUiText("Allow photo library access to add a memory."));
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                quality: 1,
                exif: true,
                allowsMultipleSelection: false,
            });

            if (result.canceled) return;
            const asset = result.assets?.[0];
            if (!asset?.uri) return;

            const captured = getCapturedDateFromAsset(asset);
            imageUploadJobRef.current = createImageUploadJob(asset);
            if (!editingMemory && capturedAtSource !== 'manual') {
                setCapturedAtState(captured.capturedAt);
                setCapturedAtSource(captured.capturedAtSource);
            }
            setDraft({
                asset,
                uri: asset.uri,
                width: asset.width,
                height: asset.height,
            });
        } catch (error) {
            Alert.alert(
                translateUiText("Could not open photos"),
                translateUiText(error.message || "Please try again."),
            );
        }
    }, [capturedAtSource, editingMemory]);

    const saveMemory = useCallback(async () => {
        if (!userId || saveInFlightRef.current) return;

        const safeTitle = title.trim();
        const safeCaption = caption.trim();
        const normalizedType = normalizeEntryType(entryType);

        if (normalizedType === 'special_date') {
            if (!safeTitle) {
                Alert.alert(
                    translateUiText("Add a title"),
                    translateUiText("Name this special date first.")
                );
                return;
            }
        } else {
            if (!safeTitle && !safeCaption) {
                Alert.alert(
                    translateUiText("Add a title or note"),
                    translateUiText("Give this memory a title or note first.")
                );
                return;
            }
        }

        saveInFlightRef.current = true;
        try {
            setIsSaving(true);
            let preparedImage = null;
            let uploaded = {};

            if (draft?.asset) {
                const existingJob = imageUploadJobRef.current;
                const job = existingJob?.sourceUri === draft.asset.uri
                    ? existingJob
                    : createImageUploadJob(draft.asset);
                imageUploadJobRef.current = job;

                // Both promises have already been running in parallel. If URL
                // warming failed while offline, refresh only that cheap step.
                preparedImage = await job.preparedImagePromise;
                let uploadTarget;
                try {
                    uploadTarget = await job.uploadTargetPromise;
                } catch {
                    uploadTarget = await requestMemoryImageUpload({
                        fileName: preparedImage.fileName,
                        mimeType: preparedImage.mimeType,
                    });
                }
                uploaded = await uploadMemoryImage(preparedImage, uploadTarget);
            } else if (draft?.uri && draft?.isExisting) {
                uploaded = { imageUrl: draft.uri, fileKey: editingMemory?.fileKey };
            }

            if (editingMemory) {
                const updated = await updateMemory({
                    memoryId: editingMemory._id,
                    userId,
                    entryType: normalizedType,
                    iconKey,
                    title: safeTitle,
                    imageUrl: draft?.uri ? (uploaded.imageUrl || editingMemory.imageUrl) : null,
                    fileKey: draft?.uri ? (uploaded.fileKey || editingMemory.fileKey) : null,
                    width: draft?.uri ? (preparedImage?.width || editingMemory.width) : null,
                    height: draft?.uri ? (preparedImage?.height || editingMemory.height) : null,
                    capturedAt: capturedAt.toISOString(),
                    caption: safeCaption,
                });

                setMemories((prev) => {
                    const next = prev.map((m) => (m._id === updated._id ? { ...m, ...updated } : m));
                    const sorted = mergeMemories(next, [], sortOrder);
                    writeCachedMemories(userId, sorted, sortOrder);
                    return sorted;
                });
            } else {
                const saved = await createMemory({
                    userId,
                    entryType: normalizedType,
                    iconKey,
                    title: safeTitle,
                    imageUrl: uploaded.imageUrl,
                    fileKey: uploaded.fileKey,
                    width: preparedImage?.width,
                    height: preparedImage?.height,
                    capturedAt: capturedAt.toISOString(),
                    capturedAtSource,
                    caption: safeCaption,
                });

                setMemories((prev) => {
                    const next = mergeMemories([saved], prev, sortOrder);
                    writeCachedMemories(userId, next, sortOrder);
                    return next;
                });
            }

            setModalVisible(false);
            resetDraft();
        } catch (error) {
            Alert.alert(
                translateUiText("Memory not saved"),
                translateUiText(error.message || "Please try again."),
            );
        } finally {
            saveInFlightRef.current = false;
            setIsSaving(false);
        }
    }, [caption, capturedAt, capturedAtSource, draft, editingMemory, entryType, iconKey, resetDraft, sortOrder, title, userId]);

    const displayedMemories = memories;

    const androidStatusBarHeight = StatusBar.currentHeight || 0;
    const topPadding = Platform.OS === 'android'
        ? Math.max(insets.top, androidStatusBarHeight) + 12
        : Math.max(insets.top + 4, 16);
    const contentPadding = useMemo(() => ({
        paddingTop: 8,
        paddingBottom: insets.bottom + 94,
    }), [insets.bottom]);

    return (
        <LinearGradient
            colors={['#F8D9EC', '#FFF7FA', '#FFF4F7', '#F7D8F2']}
            locations={[0, 0.34, 0.72, 1]}
            start={{ x: 0.25, y: 0 }}
            end={{ x: 0.75, y: 1 }}
            style={styles.screen}
        >
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

            <View style={[styles.header, { paddingTop: topPadding }]}>
                <View style={styles.headerRow}>
                    <Text style={styles.title}>{translateUiText("Our Timeline")}</Text>
                    {memories.length > 1 && (
                        <TouchableOpacity
                            style={styles.sortToggle}
                            onPress={handleToggleSortOrder}
                            activeOpacity={0.75}
                        >
                            <ArrowUpDown color="#C96F81" size={13} strokeWidth={2.4} />
                            <Text style={styles.sortToggleText}>
                                {sortOrder === 'asc' ? translateUiText("Oldest First") : translateUiText("Newest First")}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <FlatList
                data={displayedMemories}
                keyExtractor={(item) => item._id}
                renderItem={({ item, index }) => (
                    <MemoryCard
                        item={item}
                        isLast={index === displayedMemories.length - 1}
                        onOptionsPress={(target) => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                            handleSetOptionsMemory(target);
                        }}
                        onImagePress={(photoData) => setLightboxImage(photoData)}
                    />
                )}
                contentContainerStyle={[styles.listContent, contentPadding, memories.length === 0 && styles.emptyListContent]}
                showsVerticalScrollIndicator={false}
                contentInsetAdjustmentBehavior="never"
                onEndReachedThreshold={0.45}
                onEndReached={() => loadMemories()}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={() => loadMemories({ reset: true, isPullRefresh: true })}
                        tintColor="#FF758F"
                    />
                }
                ListEmptyComponent={!isLoading ? (
                    <EmptyState
                        hasPartner={hasPartner}
                        onAddPartner={onLinkPartner}
                    />
                ) : null}
                ListFooterComponent={isLoading && memories.length > 0 ? (
                    <View style={styles.footerLoader}>
                        <ActivityIndicator color="#C96F81" />
                    </View>
                ) : null}
                removeClippedSubviews={Platform.OS === 'android'}
            />

            {isLoading && memories.length === 0 && (
                <View style={styles.initialLoader}>
                    <ActivityIndicator color="#C96F81" />
                </View>
            )}

            <AddMemoryModal
                visible={modalVisible}
                isEditing={Boolean(editingMemory)}
                editingMemory={editingMemory}
                entryType={entryType}
                draft={draft}
                iconKey={iconKey}
                setIconKey={setIconKey}
                title={title}
                setTitle={setTitle}
                caption={caption}
                setCaption={setCaption}
                capturedAt={capturedAt}
                setCapturedAt={setCapturedAt}
                capturedAtSource={capturedAtSource}
                isSaving={isSaving}
                onClose={() => {
                    if (!isSaving) {
                        setModalVisible(false);
                        resetDraft();
                    }
                }}
                onPickPhoto={pickPhoto}
                onSave={saveMemory}
                onRemovePhoto={() => {
                    imageUploadJobRef.current = null;
                    setDraft(null);
                }}
            />

            <MemoryOptionsModal
                visible={Boolean(optionsMemory)}
                memory={optionsMemory}
                onClose={() => handleSetOptionsMemory(null)}
                onEdit={handleStartEdit}
                onDelete={handleDeleteMemory}
            />

            <PhotoLightboxModal
                visible={Boolean(lightboxImage)}
                data={lightboxImage}
                onClose={() => setLightboxImage(null)}
            />

            {!optionsMemory && (
                <TimelineFab
                    isOpen={isActionMenuOpen}
                    progress={fabProgress}
                    onToggle={toggleActionMenu}
                    onSelect={openAdd}
                    bottomInset={insets.bottom}
                    pulse={memories.length === 0}
                />
            )}
        </LinearGradient>
    );
};

const cardShadow = Platform.select({
    ios: {
        shadowColor: '#B87184',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.1,
        shadowRadius: 18,
    },
    android: {
        elevation: 0,
    },
});

const styles = StyleSheet.create({
    screen: {
        flex: 1,
    },
    topFadeGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 4,
    },
    header: {
        paddingHorizontal: 16,
        paddingBottom: 6,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    title: {
        fontFamily: fontFamily.extraBold,
        fontSize: 32,
        fontWeight: fontWeight('800'),
        color: '#202B5E',
        letterSpacing: -0.5,
        marginBottom: 6,
    },
    sortToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F1DED8',
        ...cardShadow,
    },
    sortToggleText: {
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
        fontSize: 12,
        color: '#C96F81',
    },
    listContent: {
        paddingLeft: 6,
        paddingRight: 14,
    },
    emptyListContent: {
        flexGrow: 1,
    },
    memoryRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 28,
    },
    dateRail: {
        width: 48,
        alignItems: 'center',
        paddingTop: 5,
    },
    monthText: {
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        color: '#C96F81',
        fontSize: 12,
        letterSpacing: 0,
    },
    dayText: {
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        color: '#2E2630',
        fontSize: 25,
        lineHeight: 30,
    },
    yearText: {
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
        color: '#9B858D',
        fontSize: 11,
        lineHeight: 13,
    },
    railDot: {
        width: 9,
        height: 9,
        borderRadius: 4.5,
        backgroundColor: '#8DB5A5',
        marginTop: 8,
        marginBottom: 4,
    },
    railLine: {
        width: 1,
        flex: 1,
        minHeight: 16,
        backgroundColor: '#E9D8D3',
    },
    timeText: {
        marginTop: 8,
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
        color: '#9C858D',
        fontSize: 11,
        textAlign: 'center',
    },
    memoryContent: {
        flex: 1,
    },
    photoContainer: {
        position: 'relative',
        width: '100%',
    },
    cardOptionsBadge: {
        position: 'absolute',
        top: 10,
        right: 10,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(42, 31, 38, 0.55)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    cardOptionsButtonTextCard: {
        padding: 4,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'flex-start',
    },
    photoCardWrapper: {
        width: '100%',
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F2DED8',
        ...cardShadow,
    },
    photoWrap: {
        width: '100%',
        overflow: 'hidden',
        backgroundColor: '#F3E7E2',
    },
    photo: {
        width: '100%',
        height: '100%',
    },
    photoLoading: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F3E7E2',
        zIndex: 1,
    },
    photoFailed: {
        flex: 1,
        minHeight: 180,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F3E7E2',
    },
    photoFailedText: {
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
        color: '#9C7D86',
        fontSize: 13,
    },
    photoCardContent: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 14,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#F7EBE7',
    },
    photoTitleText: {
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        color: '#302832',
        fontSize: 17,
        marginBottom: 3,
    },
    captionText: {
        fontFamily: fontFamily.medium,
        fontWeight: fontWeight('500'),
        color: '#372D36',
        fontSize: 16,
        lineHeight: 22,
    },
    moreButton: {
        alignSelf: 'flex-start',
        marginTop: 4,
        paddingVertical: 2,
    },
    moreButtonText: {
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
        color: '#E05A75',
        fontSize: 13,
        lineHeight: 18,
    },
    moreButtonTextInverted: {
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
        color: '#FFFFFF',
        fontSize: 13,
        lineHeight: 18,
        opacity: 0.95,
        textDecorationLine: 'underline',
    },
    momentCard: {
        minHeight: 110,
        borderRadius: 24,
        padding: 18,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F2DED8',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        justifyContent: 'center',
        ...cardShadow,
    },
    dateMomentCard: {
        backgroundColor: '#F8FBF5',
        borderColor: '#DFECE2',
    },
    momentIcon: {
        width: 46,
        height: 46,
        borderRadius: 23,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFF0F4',
        flexShrink: 0,
    },
    momentCopy: {
        flex: 1,
    },
    dateMomentIcon: {
        backgroundColor: '#EAF5EE',
    },
    momentGlyph: {
        fontSize: 24,
        lineHeight: 28,
    },
    inlineKicker: {
        marginBottom: 4,
    },
    specialDateCardWrapper: {
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        backgroundColor: '#FF829C',
        shadowColor: '#E55875',
        shadowOpacity: 0.15,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 0,
        position: 'relative',
    },
    specialDateCardGradient: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 23,
    },
    specialDateCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: 18,
    },
    specialDateCardEmoji: {
        fontSize: 36,
        lineHeight: 42,
    },
    specialDateCardCopy: {
        flex: 1,
    },
    specialDateCardTitle: {
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
        color: '#FFFFFF',
        fontSize: 17,
        lineHeight: 22,
        marginBottom: 3,
    },
    specialDateCardCaption: {
        fontFamily: fontFamily.regular,
        color: '#FFE3E8',
        fontSize: 13,
        lineHeight: 18,
    },
    captionTitleLayout: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    specialDatePhotoEmoji: {
        fontSize: 20,
        lineHeight: 24,
    },
    momentTitle: {
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        color: '#302832',
        fontSize: 22,
        lineHeight: 27,
    },
    momentCaption: {
        marginTop: 8,
        fontFamily: fontFamily.medium,
        fontWeight: fontWeight('500'),
        color: '#6F5C65',
        fontSize: 15,
        lineHeight: 21,
    },
    footerLoader: {
        paddingVertical: 20,
    },
    initialLoader: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        paddingBottom: 80,
    },
    emptyStackContainer: {
        width: 260,
        height: 200,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 36,
        position: 'relative',
    },
    emptyStackImage: {
        position: 'absolute',
        width: 100,
        height: 133,
        borderRadius: 14,
        borderWidth: 3,
        borderColor: '#FFFFFF',
        shadowColor: '#2F2630',
        shadowOpacity: 0.15,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
    },

    emptyTitle: {
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        color: '#332B35',
        fontSize: 24,
        marginBottom: 8,
    },
    emptyText: {
        fontFamily: fontFamily.medium,
        fontWeight: fontWeight('500'),
        color: '#8D7781',
        fontSize: 15,
        lineHeight: 21,
        textAlign: 'center',
        marginBottom: 18,
    },
    emptyButton: {
        width: 190,
        height: 48,
        borderRadius: 24,
        overflow: 'hidden',
        shadowColor: '#FF5E97',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 0,
    },
    emptyButtonGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyButtonText: {
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
        color: '#FFFFFF',
        fontSize: 15,
    },
    modalRoot: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(42,31,38,0.36)',
    },
    pageRoot: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    pageHeaderSpacer: {
        width: 44,
    },
    pageHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(241, 222, 216, 0.6)',
        backgroundColor: 'transparent',
    },
    pageHeaderBack: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F1DED8',
    },
    pageHeaderTitle: {
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        color: '#302832',
        fontSize: 18,
        textAlign: 'center',
        flex: 1,
        marginHorizontal: 12,
    },
    pageScroll: {
        flex: 1,
        width: '100%',
    },
    pageScrollContent: {
        flexGrow: 1,
        paddingHorizontal: 18,
        paddingTop: 24,
    },
    formIntro: {
        alignItems: 'center',
        marginBottom: 24,
        paddingHorizontal: 16,
    },
    formIntroIcon: {
        width: 56,
        height: 56,
        borderRadius: 20,
        backgroundColor: '#FBE7ED',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    formIntroTitle: {
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        color: '#302832',
        fontSize: 26,
        lineHeight: 32,
        textAlign: 'center',
    },
    formIntroSubtitle: {
        fontFamily: fontFamily.regular,
        color: '#8D7781',
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
        marginTop: 8,
    },
    formCard: {
        borderRadius: 26,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F1DED8',
        padding: 18,
    },
    fieldHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    fieldLabel: {
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
        color: '#6F5C65',
        fontSize: 13,
    },
    fieldHint: {
        fontFamily: fontFamily.regular,
        color: '#AF98A2',
        fontSize: 12,
    },
    fieldDivider: {
        height: 1,
        backgroundColor: '#F6EAE7',
        marginVertical: 20,
    },
    photoSection: {
        marginTop: 22,
        gap: 10,
    },
    previewButton: {
        height: 210,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: '#F0E3DD',
        borderWidth: 1,
        borderColor: '#FFFFFF',
        position: 'relative',
    },
    changePhotoBadge: {
        position: 'absolute',
        bottom: 12,
        left: 12,
        borderRadius: 18,
        backgroundColor: 'rgba(42, 31, 38, 0.65)',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    changePhotoText: {
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
        color: '#FFFFFF',
        fontSize: 12,
    },
    removePhotoBadge: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(42, 31, 38, 0.6)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    emojiOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'flex-end',
        zIndex: 70,
    },
    emojiModalBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(42, 31, 38, 0.4)',
    },
    emojiSheet: {
        maxHeight: '65%',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        backgroundColor: '#FFF9F5',
        paddingHorizontal: 20,
        paddingTop: 10,
        borderWidth: 1,
        borderColor: '#F1DED8',
    },
    emojiSheetHandle: {
        alignSelf: 'center',
        width: 42,
        height: 5,
        borderRadius: 3,
        backgroundColor: '#E7D2CC',
        marginBottom: 14,
    },
    emojiSheetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    emojiSheetTitle: {
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        color: '#302832',
        fontSize: 20,
    },
    emojiSheetClose: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F1DED8',
    },
    emojiScroll: {
        marginBottom: 10,
    },
    emojiCategoryBlock: {
        marginBottom: 20,
    },
    emojiCategoryTitle: {
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
        color: '#8D7781',
        fontSize: 13,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 10,
    },
    emojiCategoryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    emojiGridOption: {
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emojiGridOptionActive: {
        transform: [{ scale: 1.28 }],
    },
    emojiOptionGlyph: {
        fontSize: 28,
        lineHeight: 32,
    },
    previewImage: {
        width: '100%',
        height: '100%',
    },
    photoDropzone: {
        minHeight: 100,
        borderRadius: 22,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#E8D4CE',
        borderStyle: 'dashed',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 18,
    },
    photoDropzoneIconWrap: {
        width: 46,
        height: 46,
        borderRadius: 16,
        backgroundColor: '#FFF0F4',
        alignItems: 'center',
        justifyContent: 'center',
    },
    photoDropzoneCopy: {
        flex: 1,
    },
    photoDropzoneText: {
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
        color: '#7D636D',
        fontSize: 14,
    },
    photoDropzoneSubtext: {
        fontFamily: fontFamily.medium,
        fontWeight: fontWeight('500'),
        color: '#AF98A2',
        fontSize: 12,
        marginTop: 2,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 12,
    },
    inlineEmojiButton: {
        width: 54,
        height: 54,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F1DED8',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    inlineEmojiGlyph: {
        fontSize: 26,
        lineHeight: 30,
    },
    inlineEmojiChevronBadge: {
        position: 'absolute',
        right: -2,
        bottom: -2,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F1DED8',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#C96F81',
        shadowOpacity: 0.12,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 0,
    },
    titleInput: {
        height: 54,
        borderRadius: 18,
        backgroundColor: '#FFF9FA',
        paddingHorizontal: 15,
        borderWidth: 1,
        borderColor: '#F1DED8',
        fontFamily: fontFamily.medium,
        fontWeight: fontWeight('500'),
        color: '#302832',
        fontSize: 16,
    },
    titleInputFlex: {
        flex: 1,
        height: 54,
        marginTop: 0,
    },
    dateChip: {
        marginTop: 12,
        borderRadius: 18,
        backgroundColor: '#FFF9FA',
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: '#F1DED8',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    dateChipIcon: {
        width: 34,
        height: 34,
        borderRadius: 12,
        backgroundColor: '#FBE7ED',
        alignItems: 'center',
        justifyContent: 'center',
    },
    dateChipText: {
        flex: 1,
        fontFamily: fontFamily.medium,
        fontWeight: fontWeight('500'),
        color: '#332B35',
        fontSize: 15,
    },
    dateSourceText: {
        fontFamily: fontFamily.regular,
        color: '#AF98A2',
        fontSize: 12,
        marginTop: 8,
    },
    captionInput: {
        marginTop: 12,
        minHeight: 120,
        borderRadius: 20,
        backgroundColor: '#FFF9FA',
        paddingHorizontal: 15,
        paddingVertical: 13,
        borderWidth: 1,
        borderColor: '#F1DED8',
        textAlignVertical: 'top',
        fontFamily: fontFamily.medium,
        fontWeight: fontWeight('500'),
        color: '#342D35',
        fontSize: 16,
        lineHeight: 22,
    },
    charCountText: {
        alignSelf: 'flex-end',
        fontFamily: fontFamily.medium,
        fontWeight: fontWeight('500'),
        fontSize: 12,
        color: '#AF98A2',
        marginTop: 4,
        marginRight: 6,
    },
    charCountLimitText: {
        color: '#E55875',
        fontWeight: fontWeight('700'),
    },
    saveFooter: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingTop: 12,
        paddingHorizontal: 20,
        backgroundColor: '#FFF7FA',
        borderTopWidth: 1,
        borderTopColor: '#F1DED8',
    },
    saveButton: {
        minHeight: 52,
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
    },
    saveButtonDisabled: {
        opacity: 0.45,
    },
    saveButtonText: {
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        color: '#FFFFFF',
        fontSize: 16,
    },
    calendarOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'flex-end',
        zIndex: 60,
    },
    calendarBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(42,31,38,0.24)',
    },
    calendarPanel: {
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        backgroundColor: '#FFF9F5',
        borderTopWidth: 1,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: '#F1DED8',
        paddingHorizontal: 20,
        paddingTop: 12,
        ...cardShadow,
    },
    calendarHandle: {
        alignSelf: 'center',
        width: 58,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#E5D0C9',
        marginBottom: 16,
    },
    androidWheelPickerWrap: {
        height: 190,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
    },
    wheelPicker: {
        width: '100%',
        height: 190,
        backgroundColor: 'transparent',
    },
    wheelPickerHighlighter: {
        position: 'absolute',
        left: 6,
        right: 6,
        height: 42,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: 'rgba(201, 111, 129, 0.28)',
        backgroundColor: 'rgba(201, 111, 129, 0.08)',
    },
    // Lightbox Modal Styles
    lightboxRoot: {
        flex: 1,
        backgroundColor: 'rgba(15, 12, 18, 0.96)',
    },
    lightboxBackdrop: {
        ...StyleSheet.absoluteFillObject,
    },
    lightboxHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 14,
        zIndex: 10,
    },
    lightboxHeaderCopy: {
        flex: 1,
        marginRight: 16,
    },
    lightboxTitle: {
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        fontSize: 18,
        color: '#FFFFFF',
    },
    lightboxDate: {
        fontFamily: fontFamily.medium,
        fontWeight: fontWeight('500'),
        fontSize: 13,
        color: '#D4B8C1',
        marginTop: 2,
    },
    lightboxCloseBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.16)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    lightboxImageWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
        paddingBottom: 30,
    },
    lightboxImage: {
        width: '100%',
        height: '100%',
    },

    // Options Modal Styles
    optionsSheetBackground: {
        backgroundColor: '#FFF9F5',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: 1,
        borderColor: '#F1DED8',
    },
    optionsSheet: {
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    optionsSheetHandle: {
        alignSelf: 'center',
        width: 40,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: '#E7D2CC',
        marginBottom: 16,
    },
    optionsSheetHeader: {
        marginBottom: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F2DED8',
    },
    optionsSheetTitle: {
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        fontSize: 18,
        color: '#302832',
    },
    optionsSheetSubtitle: {
        fontFamily: fontFamily.medium,
        fontWeight: fontWeight('500'),
        fontSize: 13,
        color: '#9C858D',
        marginTop: 3,
    },
    optionsActionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 14,
        borderRadius: 16,
        paddingHorizontal: 12,
    },
    optionsActionIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F3E7E2',
        alignItems: 'center',
        justifyContent: 'center',
    },
    optionsActionText: {
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
        fontSize: 16,
        color: '#302832',
    },
    optionsDeleteRow: {
        marginTop: 4,
    },
    optionsDeleteIconWrap: {
        backgroundColor: '#FFE8ED',
    },
    optionsDeleteText: {
        color: '#E55875',
    },
    optionsCancelButton: {
        marginTop: 14,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F1DED8',
        alignItems: 'center',
        justifyContent: 'center',
    },
    optionsCancelText: {
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
        fontSize: 15,
        color: '#6F5C65',
    },
    calendarDoneButton: {
        height: 50,
        borderRadius: 25,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
        marginTop: 12,
    },
    calendarDoneText: {
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
        color: '#FFFFFF',
        fontSize: 15,
    },
    fabBackdropTouchable: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 20,
    },
    fabBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(43,34,40,0.22)',
    },
    fabLayer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 25,
    },
    mainFabWrap: {
        position: 'absolute',
        width: 42,
        height: 42,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 26,
    },
    mainFab: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#2F2630',
        ...cardShadow,
    },
    addActionWrap: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
        width: 108,
        zIndex: 27,
    },
    addActionTouchable: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    addActionButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#302832',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.75)',
        ...cardShadow,
    },
    addActionLabel: {
        marginTop: 5,
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        color: '#302832',
        fontSize: 12,
        backgroundColor: 'rgba(255,255,255,0.9)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        overflow: 'hidden',
        textAlign: 'center',
    },
});

export default MemoriesScreen;
