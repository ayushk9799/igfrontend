import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Image,
    Keyboard,
    KeyboardAvoidingView,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
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
        placeholderTitle: 'First met',
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

const cacheKeyForUser = (userId) => `memories:${userId}`;

const readCachedMemories = (userId) => {
    try {
        const raw = storage.getString(cacheKeyForUser(userId));
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
};

const writeCachedMemories = (userId, memories) => {
    try {
        storage.set(cacheKeyForUser(userId), JSON.stringify(memories.slice(0, CACHE_LIMIT)));
    } catch {
        // Cache is best-effort only.
    }
};

const mergeMemories = (current, incoming) => {
    const byId = new Map();
    [...current, ...incoming].forEach((memory) => {
        if (memory?._id) byId.set(memory._id, memory);
    });

    return Array.from(byId.values()).sort((a, b) => {
        const aTime = new Date(a.capturedAt).getTime();
        const bTime = new Date(b.capturedAt).getTime();
        if (aTime !== bTime) return aTime - bTime;
        return String(a._id).localeCompare(String(b._id));
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

const MemoryCard = ({ item, onOptionsPress, onImagePress }) => {
    const parts = formatDateParts(item.capturedAt);
    const aspectRatio = getDisplayAspectRatio(item.width, item.height);
    const entryType = normalizeEntryType(item.entryType);
    const hasImage = Boolean(item.imageUrl);
    const isSpecialDate = entryType === 'special_date';
    const specialIcon = getSpecialDateIcon(item.iconKey);

    return (
        <View style={styles.memoryRow}>
            <View style={styles.dateRail}>
                <Text style={styles.monthText}>{parts.month}</Text>
                <Text style={styles.dayText}>{parts.day}</Text>
                <Text style={styles.yearText}>{parts.year}</Text>
                <View style={styles.railDot} />
                <View style={styles.railLine} />
            </View>
            <View style={styles.memoryContent}>
                {hasImage ? (
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
                                    {!!item.caption && <Text style={styles.specialDateCardCaption}>{item.caption}</Text>}
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
                                {!!item.caption && <Text style={styles.momentCaption}>{item.caption}</Text>}
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
                {(hasImage && (item.title || item.caption)) && (
                    <View style={styles.captionRow}>
                        <View style={styles.captionCopy}>
                            <View style={styles.captionTitleLayout}>
                                {isSpecialDate && (
                                    <Text style={styles.specialDatePhotoEmoji}>{specialIcon.glyph}</Text>
                                )}
                                {!!item.title && <Text style={styles.photoTitleText}>{item.title}</Text>}
                            </View>
                            {!!item.caption && <Text style={styles.captionText}>{item.caption}</Text>}
                        </View>
                    </View>
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
    if (!visible || !memory) return null;

    const parts = formatDateParts(memory.capturedAt);
    const isSpecialDate = normalizeEntryType(memory.entryType) === 'special_date';

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.optionsModalRoot}>
                <Pressable style={styles.optionsModalBackdrop} onPress={onClose} />
                <View style={[styles.optionsSheet, { paddingBottom: insets.bottom + 16 }]}>
                    <View style={styles.optionsSheetHandle} />
                    <View style={styles.optionsSheetHeader}>
                        <Text style={styles.optionsSheetTitle} numberOfLines={1}>
                            {memory.title || (isSpecialDate ? translateUiText("Special Date") : translateUiText("Memory"))}
                        </Text>
                        <Text style={styles.optionsSheetSubtitle}>{parts.line}</Text>
                    </View>

                    <TouchableOpacity
                        style={styles.optionsActionRow}
                        onPress={() => {
                            onClose();
                            onEdit(memory);
                        }}
                        activeOpacity={0.7}
                    >
                        <View style={styles.optionsActionIconWrap}>
                            <Pencil color="#302832" size={18} strokeWidth={2.2} />
                        </View>
                        <Text style={styles.optionsActionText}>{translateUiText("Edit")}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.optionsActionRow, styles.optionsDeleteRow]}
                        onPress={() => {
                            onClose();
                            onDelete(memory);
                        }}
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
                        onPress={onClose}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.optionsCancelText}>{translateUiText("Cancel")}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
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

const AddActionButton = ({ icon, label, style, onPress }) => (
    <Animated.View style={[styles.addActionWrap, style]}>
        <TouchableOpacity style={styles.addActionButton} onPress={onPress} activeOpacity={0.9}>
            {icon}
        </TouchableOpacity>
        <Text style={styles.addActionLabel} numberOfLines={1}>{label}</Text>
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

    return (
        <>
            {isOpen && (
                <Pressable style={styles.fabBackdropTouchable} onPress={onToggle}>
                    <Animated.View style={[styles.fabBackdrop, { opacity: backdropOpacity }]} />
                </Pressable>
            )}
            <View pointerEvents="box-none" style={[styles.fabLayer, { bottom: bottomInset + 94 }]}>
                <AddActionButton
                    label={translateUiText("Memory")}
                    icon={<Heart color="#FFFFFF" size={17} strokeWidth={2.2} />}
                    style={actionStyle(-112, -4, 0)}
                    onPress={() => onSelect('memory')}
                />
                <AddActionButton
                    label={translateUiText("Special Date")}
                    icon={<CalendarDays color="#FFFFFF" size={17} strokeWidth={2.2} />}
                    style={actionStyle(-36, -116, 1)}
                    onPress={() => onSelect('special_date')}
                />
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                    <TouchableOpacity style={styles.mainFab} onPress={onToggle} activeOpacity={0.9}>
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
    const selectedDate = value || new Date();

    const onDateChange = (event, date) => {
        if (Platform.OS === 'android') {
            onClose();
            if (event.type === 'set' && date) {
                onChange(date);
            }
        } else {
            if (date) {
                onChange(date);
            }
        }
    };

    if (Platform.OS === 'android') {
        return (
            <DateTimePicker
                value={selectedDate}
                mode="date"
                display="default"
                onChange={onDateChange}
            />
        );
    }

    return (
        <View style={styles.calendarOverlay}>
            <Pressable style={styles.calendarBackdrop} onPress={onClose} />
            <View style={styles.calendarPanel}>
                <View style={styles.calendarHandle} />
                <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display="spinner"
                    onChange={onDateChange}
                    textColor="#302832"
                />
                <TouchableOpacity style={styles.calendarDoneButton} onPress={onClose} activeOpacity={0.9}>
                    <Text style={styles.calendarDoneText}>{translateUiText("Done")}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const AddMemoryModal = ({
    visible,
    isEditing = false,
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
    const dateParts = formatDateParts(capturedAt);
    const normalizedType = normalizeEntryType(entryType);
    const typeConfig = TIMELINE_TYPES[normalizedType] || TIMELINE_TYPES.memory;
    const isSpecialDate = normalizedType === 'special_date';

    const modalTitle = isEditing
        ? (isSpecialDate ? translateUiText("Edit special date") : translateUiText("Edit memory"))
        : typeConfig.modalTitle;

    const saveLabel = isEditing
        ? translateUiText("Save changes")
        : typeConfig.saveLabel;

    const openDatePicker = () => {
        Keyboard.dismiss();
        setShowPicker(true);
    };

    return (
        <Modal visible={visible} transparent={false} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
            <LinearGradient
                colors={['#F8D9EC', '#FFF7FA', '#FFF4F7', '#F7D8F2']}
                locations={[0, 0.34, 0.72, 1]}
                start={{ x: 0.25, y: 0 }}
                end={{ x: 0.75, y: 1 }}
                style={styles.pageRoot}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.keyboardAvoiding}
                >
                    <View style={[styles.pageHeader, { paddingTop: insets.top + 10 }]}>
                        <TouchableOpacity style={styles.pageHeaderBack} onPress={onClose} disabled={isSaving}>
                            <ChevronLeft color="#302832" size={24} strokeWidth={2} />
                        </TouchableOpacity>
                        <Text style={styles.pageHeaderTitle}>{modalTitle}</Text>
                        <View style={styles.pageHeaderSpacer} />
                    </View>

                    <ScrollView
                        style={styles.pageScroll}
                        contentContainerStyle={[styles.pageScrollContent, { paddingBottom: insets.bottom + 24 }]}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                    {draft?.uri && (
                        <View style={styles.previewButton}>
                            <Image source={{ uri: draft.uri }} style={styles.previewImage} resizeMode="cover" />
                            {!isSaving && (
                                <TouchableOpacity
                                    style={styles.removePhotoBadge}
                                    onPress={onRemovePhoto}
                                    activeOpacity={0.8}
                                >
                                    <X color="#FFFFFF" size={16} strokeWidth={2.5} />
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    <View style={styles.titlePhotoRow}>
                        <TouchableOpacity
                            style={styles.inlineEmojiButton}
                            onPress={() => {
                                Keyboard.dismiss();
                                setShowIconPicker((current) => !current);
                            }}
                            activeOpacity={0.86}
                            disabled={isSaving}
                        >
                            <Text style={styles.inlineEmojiGlyph}>{getSpecialDateIcon(iconKey).glyph}</Text>
                            <View style={styles.inlineEmojiChevronBadge}>
                                <ChevronDown color="#B56F7E" size={12} strokeWidth={2.5} />
                            </View>
                        </TouchableOpacity>

                        <TextInput
                            style={[styles.titleInput, styles.titleInputInRow]}
                            value={title}
                            onChangeText={(value) => setTitle(value.slice(0, TITLE_LIMIT))}
                            placeholder={typeConfig.placeholderTitle}
                            placeholderTextColor="#B09AA4"
                            maxLength={TITLE_LIMIT}
                            editable={!isSaving}
                        />

                        {!draft?.uri && (
                            <TouchableOpacity
                                style={styles.photoIconButton}
                                onPress={onPickPhoto}
                                activeOpacity={0.88}
                                disabled={isSaving}
                            >
                                <ImagePlus color="#C96F81" size={22} strokeWidth={1.9} />
                            </TouchableOpacity>
                        )}
                    </View>

                    <TouchableOpacity
                        style={styles.dateChip}
                        onPress={openDatePicker}
                        disabled={isSaving}
                        activeOpacity={0.86}
                    >
                        <Text style={styles.dateChipText}>{dateParts.line}</Text>
                    </TouchableOpacity>

                    <TextInput
                        style={styles.captionInput}
                        value={caption}
                        onChangeText={(value) => setCaption(value.slice(0, CAPTION_LIMIT))}
                        placeholder={typeConfig.placeholderCaption}
                        placeholderTextColor="#B09AA4"
                        multiline
                        maxLength={CAPTION_LIMIT}
                        editable={!isSaving}
                    />

                    <TouchableOpacity
                        style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                        onPress={onSave}
                        disabled={isSaving}
                        activeOpacity={0.9}
                    >
                        {isSaving ? (
                            <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                            <Text style={styles.saveButtonText}>{saveLabel}</Text>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
            </LinearGradient>
            {showPicker && (
                <TimelineDatePicker
                    value={capturedAt}
                    onChange={setCapturedAt}
                    onClose={() => setShowPicker(false)}
                />
            )}

            <Modal
                visible={showIconPicker}
                transparent
                animationType="slide"
                onRequestClose={() => setShowIconPicker(false)}
            >
                <View style={styles.emojiModalRoot}>
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
            </Modal>
        </Modal>
    );
};

const MemoriesScreen = ({ userId, hasPartner, onLinkPartner }) => {
    const insets = useSafeAreaInsets();
    const socket = useSocket();
    const fabProgress = useRef(new Animated.Value(0)).current;
    const loadedUserRef = useRef(null);
    const imageUploadJobRef = useRef(null);
    const saveInFlightRef = useRef(false);

    const [memories, setMemories] = useState(() => userId && hasPartner ? readCachedMemories(userId) : []);
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

    const loadMemories = useCallback(async ({ refresh = false } = {}) => {
        if (!userId || !hasPartner || isLoading) return;

        if (!refresh && !hasMore) return;

        if (refresh) setIsRefreshing(true);
        else setIsLoading(true);

        try {
            const result = await fetchMemories({
                userId,
                cursor: refresh ? null : cursor,
                limit: PAGE_LIMIT,
            });
            const incoming = result.memories || [];

            setMemories((prev) => {
                const next = refresh ? incoming : mergeMemories(prev, incoming);
                writeCachedMemories(userId, next);
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
    }, [cursor, hasMore, hasPartner, isLoading, userId]);

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
        setMemories(readCachedMemories(userId));
        setCursor(null);
        setHasMore(true);
        loadMemories({ refresh: true });
    }, [hasPartner, loadMemories, userId]);

    // Real-time Socket.io synchronization with partner
    useEffect(() => {
        if (!socket || !hasPartner || !userId) return;

        const onMemoryCreated = (newMemory) => {
            if (!newMemory?._id) return;
            setMemories((prev) => {
                if (prev.some((m) => m._id === newMemory._id)) return prev;
                const next = mergeMemories([newMemory], prev);
                writeCachedMemories(userId, next);
                return next;
            });
        };

        const onMemoryUpdated = (updated) => {
            if (!updated?._id) return;
            setMemories((prev) => {
                const next = prev.map((m) => (m._id === updated._id ? { ...m, ...updated } : m));
                writeCachedMemories(userId, next);
                return next;
            });
        };

        const onMemoryDeleted = ({ memoryId }) => {
            if (!memoryId) return;
            setMemories((prev) => {
                const next = prev.filter((m) => m._id !== memoryId);
                writeCachedMemories(userId, next);
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
    }, [hasPartner, socket, userId]);

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
    }, []);

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
                                writeCachedMemories(userId, next);
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
            setCapturedAtState(captured.capturedAt);
            setCapturedAtSource(captured.capturedAtSource);
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
    }, []);

    const saveMemory = useCallback(async () => {
        if (!userId || saveInFlightRef.current) return;

        const safeTitle = title.trim();
        const safeCaption = caption.trim();
        const normalizedType = normalizeEntryType(entryType);

        if (!safeTitle) {
            Alert.alert(translateUiText("Add a title"), normalizedType === 'special_date'
                ? translateUiText("Name this special date first.")
                : translateUiText("Give this memory a title first."));
            return;
        }

        if (!safeCaption) {
            Alert.alert(translateUiText("Add a note"), normalizedType === 'special_date'
                ? translateUiText("Add what made this date special.")
                : translateUiText("Add what was memorable about that day."));
            return;
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
                    writeCachedMemories(userId, next);
                    return next;
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
                    const next = mergeMemories([saved], prev);
                    writeCachedMemories(userId, next);
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
    }, [caption, capturedAt, capturedAtSource, draft, editingMemory, entryType, iconKey, resetDraft, title, userId]);

    const displayedMemories = useMemo(() => {
        if (sortOrder === 'asc') return memories;
        return [...memories].reverse();
    }, [memories, sortOrder]);

    const androidStatusBarHeight = StatusBar.currentHeight || 0;
    const topPadding = Platform.OS === 'android'
        ? Math.max(insets.top, androidStatusBarHeight) + 14
        : Math.max(insets.top + 4, 16);
    const fadeOverlayHeight = Platform.OS === 'android'
        ? Math.max(insets.top, androidStatusBarHeight) + 40
        : Math.max(insets.top + 28, 64);
    const contentPadding = useMemo(() => ({
        paddingTop: topPadding,
        paddingBottom: insets.bottom + 94,
    }), [insets.bottom, topPadding]);

    return (
        <LinearGradient
            colors={['#F8D9EC', '#FFF7FA', '#FFF4F7', '#F7D8F2']}
            locations={[0, 0.34, 0.72, 1]}
            start={{ x: 0.25, y: 0 }}
            end={{ x: 0.75, y: 1 }}
            style={styles.screen}
        >
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <LinearGradient
                colors={['#F8D9EC', 'rgba(248, 217, 236, 0.88)', 'rgba(248, 217, 236, 0.45)', 'rgba(248, 217, 236, 0)']}
                locations={[0, 0.4, 0.72, 1]}
                style={[styles.topFadeGradient, { height: fadeOverlayHeight }]}
                pointerEvents="none"
            />

            <Animated.FlatList
                data={displayedMemories}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => (
                    <MemoryCard
                        item={item}
                        onOptionsPress={(target) => setOptionsMemory(target)}
                        onImagePress={(photoData) => setLightboxImage(photoData)}
                    />
                )}
                contentContainerStyle={[styles.listContent, contentPadding, memories.length === 0 && styles.emptyListContent]}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={(
                    <View style={styles.header}>
                        <View style={styles.headerRow}>
                            <Text style={styles.title}>{translateUiText("Our Timeline")}</Text>
                            {memories.length > 1 && (
                                <TouchableOpacity
                                    style={styles.sortToggle}
                                    onPress={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
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
                )}
                onEndReachedThreshold={0.45}
                onEndReached={() => loadMemories()}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={() => loadMemories({ refresh: true })}
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
                onClose={() => setOptionsMemory(null)}
                onEdit={handleStartEdit}
                onDelete={handleDeleteMemory}
            />

            <PhotoLightboxModal
                visible={Boolean(lightboxImage)}
                data={lightboxImage}
                onClose={() => setLightboxImage(null)}
            />

            <TimelineFab
                isOpen={isActionMenuOpen}
                progress={fabProgress}
                onToggle={toggleActionMenu}
                onSelect={openAdd}
                bottomInset={insets.bottom}
                pulse={memories.length === 0}
            />
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
        paddingLeft: 12,
        paddingRight: 4,
        paddingBottom: 10,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingRight: 6,
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
    photoWrap: {
        width: '100%',
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: '#F3E7E2',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.88)',
        ...cardShadow,
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
        minHeight: 230,
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
    captionRow: {
        marginTop: 12,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    captionCopy: {
        flex: 1,
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
    },
    keyboardAvoiding: {
        flex: 1,
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
        fontSize: 20,
        textAlign: 'center',
    },
    pageScroll: {
        flex: 1,
    },
    pageScrollContent: {
        paddingHorizontal: 18,
        paddingTop: 16,
    },
    previewButton: {
        height: 270,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: '#F0E3DD',
        borderWidth: 1,
        borderColor: '#FFFFFF',
        position: 'relative',
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
    emojiModalRoot: {
        flex: 1,
        justifyContent: 'flex-end',
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
    titlePhotoRow: {
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
    photoIconButton: {
        width: 54,
        height: 54,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F1DED8',
    },
    titleInput: {
        height: 54,
        borderRadius: 18,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 15,
        borderWidth: 1,
        borderColor: '#F1DED8',
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        color: '#302832',
        fontSize: 16,
    },
    titleInputInRow: {
        flex: 1,
        height: 54,
        marginTop: 0,
    },
    dateChip: {
        marginTop: 12,
        borderRadius: 18,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: '#F1DED8',
    },
    dateChipText: {
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        color: '#332B35',
        fontSize: 15,
    },
    captionInput: {
        marginTop: 12,
        minHeight: 96,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
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
    saveButton: {
        marginTop: 14,
        height: 52,
        borderRadius: 26,
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
        marginHorizontal: 12,
        marginBottom: 12,
        borderRadius: 30,
        backgroundColor: '#FFF9F5',
        borderWidth: 1,
        borderColor: '#F1DED8',
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 14,
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
    optionsModalRoot: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    optionsModalBackdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(42, 31, 38, 0.45)',
    },
    optionsSheet: {
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        backgroundColor: '#FFF9F5',
        paddingHorizontal: 20,
        paddingTop: 10,
        borderWidth: 1,
        borderColor: '#F1DED8',
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
        position: 'absolute',
        right: 22,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 25,
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
