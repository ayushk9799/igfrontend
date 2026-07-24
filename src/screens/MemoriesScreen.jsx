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
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Heart, ImagePlus, Minus, Plus, X } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BlurView } from 'expo-blur';
import { fontFamily, fontWeight } from '../constants/fonts';
import { colors } from '../theme';
import { storage } from '../utils/authStorage';
import { createMemory, fetchMemories, uploadMemoryImage } from '../api/memoriesApi';
import { getCapturedDateFromAsset, getDisplayAspectRatio, prepareMemoryImage } from '../utils/memoryImage';

const PAGE_LIMIT = 20;
const CACHE_LIMIT = 50;
const CAPTION_LIMIT = 500;
const TITLE_LIMIT = 80;

const TIMELINE_TYPES = {
    special_date: {
        label: 'Special Date',
        modalTitle: 'Special date',
        saveLabel: 'Save date',
        placeholderTitle: 'First met',
        placeholderCaption: 'What made this date special?',
    },
    memory: {
        label: 'Memory',
        modalTitle: 'Memory',
        saveLabel: 'Save memory',
        placeholderTitle: 'Title this memory',
        placeholderCaption: 'What was memorable about that day?',
    },
};

const EMOJI_CATEGORIES = [
    {
        title: 'Love & Romance',
        emojis: [
            { key: 'ring', glyph: '💍', label: 'Ring' },
            { key: 'heart_lock', glyph: '💞', label: 'Promise' },
            { key: 'kiss', glyph: '💋', label: 'Kiss' },
            { key: 'heart', glyph: '❤️', label: 'Heart' },
            { key: 'sparkles', glyph: '✨', label: 'Sparkles' },
            { key: 'couple', glyph: '💑', label: 'Couple' },
            { key: 'gift', glyph: '🎁', label: 'Gift' },
            { key: 'letter', glyph: '💌', label: 'Love Letter' },
            { key: 'heart_eyes', glyph: '😍', label: 'Heart Eyes' },
        ]
    },
    {
        title: 'Activities & Dates',
        emojis: [
            { key: 'coffee', glyph: '☕', label: 'Coffee Date' },
            { key: 'wine', glyph: '🍷', label: 'Wine Date' },
            { key: 'dinner', glyph: '🍽️', label: 'Dinner' },
            { key: 'movie', glyph: '🎬', label: 'Movie' },
            { key: 'popcorn', glyph: '🍿', label: 'Popcorn' },
            { key: 'beer', glyph: '🍻', label: 'Cheers' },
            { key: 'concert', glyph: '🎫', label: 'Concert' },
            { key: 'game', glyph: '🎮', label: 'Gaming' },
            { key: 'bowling', glyph: '🎳', label: 'Bowling' },
            { key: 'karaoke', glyph: '🎤', label: 'Karaoke' },
        ]
    },
    {
        title: 'Places & Travel',
        emojis: [
            { key: 'trip', glyph: '✈️', label: 'Flight' },
            { key: 'home', glyph: '🏡', label: 'Home' },
            { key: 'hotel', glyph: '🏨', label: 'Hotel' },
            { key: 'beach', glyph: '🏖️', label: 'Beach' },
            { key: 'tent', glyph: '⛺', label: 'Camping' },
            { key: 'car', glyph: '🚗', label: 'Road Trip' },
            { key: 'train', glyph: '🚄', label: 'Train' },
            { key: 'mountain', glyph: '🏔️', label: 'Mountain' },
            { key: 'ferris_wheel', glyph: '🎡', label: 'Theme Park' },
            { key: 'sunset', glyph: '🌇', label: 'Sunset' },
        ]
    },
    {
        title: 'Special Moments',
        emojis: [
            { key: 'calendar', glyph: '🗓️', label: 'Special Day' },
            { key: 'balloon', glyph: '🎈', label: 'Celebration' },
            { key: 'cake', glyph: '🎂', label: 'Birthday' },
            { key: 'champagne', glyph: '🍾', label: 'Celebration Drink' },
            { key: 'fireworks', glyph: '🎆', label: 'Fireworks' },
            { key: 'camera', glyph: '📸', label: 'Photo Session' },
            { key: 'star', glyph: '⭐', label: 'Starry Night' },
            { key: 'rainbow', glyph: '🌈', label: 'Rainbow' },
            { key: 'trophy', glyph: '🏆', label: 'Achievement' },
            { key: 'graduation', glyph: '🎓', label: 'Graduation' },
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
        month: date.toLocaleString(undefined, { month: 'short' }).toUpperCase(),
        day: String(date.getDate()).padStart(2, '0'),
        year: String(date.getFullYear()),
        line: date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }),
        time: date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
    };
};

const isSameDate = (a, b) => (
    a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
);

const getCalendarDays = (visibleMonth) => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];

    for (let index = 0; index < startOffset; index += 1) {
        cells.push(null);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
        cells.push(new Date(year, month, day));
    }

    while (cells.length % 7 !== 0) {
        cells.push(null);
    }

    return cells;
};

const shiftTime = (date, unit, amount) => {
    const next = new Date(date || new Date());
    if (unit === 'hour') {
        next.setHours(next.getHours() + amount);
    } else {
        next.setMinutes(next.getMinutes() + amount);
    }
    next.setSeconds(0, 0);
    return next;
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

const UploadProgress = ({ phase }) => {
    if (!phase) return null;

    return (
        <View style={styles.progressPill}>
            <ActivityIndicator color="#FFFFFF" size="small" />
            <Text style={styles.progressText}>{phase}</Text>
        </View>
    );
};

const MemoryImage = ({ uri, aspectRatio }) => {
    const [loaded, setLoaded] = useState(false);
    const [failed, setFailed] = useState(false);

    return (
        <View style={[styles.photoWrap, { aspectRatio }]}>
            {!loaded && !failed && (
                <View style={styles.photoLoading}>
                    <ActivityIndicator color="#C96F81" />
                </View>
            )}
            {failed ? (
                <View style={styles.photoFailed}>
                    <Text style={styles.photoFailedText}>Could not load photo</Text>
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
        </View>
    );
};

const MemoryCard = ({ item }) => {
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
                    <MemoryImage uri={item.imageUrl} aspectRatio={aspectRatio} />
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
                            </View>
                        </View>
                    ) : (
                        <View style={styles.momentCard}>
                            <View style={styles.momentIcon}>
                                <Heart color="#FF758F" size={22} strokeWidth={2} />
                            </View>
                            <Text style={styles.momentKicker}>MEMORY</Text>
                            {!!item.title && <Text style={styles.momentTitle}>{item.title}</Text>}
                            {!!item.caption && <Text style={styles.momentCaption}>{item.caption}</Text>}
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

const EmptyState = ({ onAdd }) => {
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
            <Text style={styles.emptyTitle}>Your timeline is empty</Text>
            <Text style={styles.emptyText}>Add when you met, first kisses, special dates, and the photos that belong to them.</Text>
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
                    label="Memory"
                    icon={<Heart color="#FFFFFF" size={17} strokeWidth={2.2} />}
                    style={actionStyle(-112, -4, 0)}
                    onPress={() => onSelect('memory')}
                />
                <AddActionButton
                    label="Special Date"
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
                    <Text style={styles.calendarDoneText}>Done</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const AddMemoryModal = ({
    visible,
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
    phase,
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
                    style={{ flex: 1 }}
                >
                    <View style={[styles.pageHeader, { paddingTop: insets.top + 10 }]}>
                        <TouchableOpacity style={styles.pageHeaderBack} onPress={onClose} disabled={!!phase}>
                            <ChevronLeft color="#302832" size={24} strokeWidth={2} />
                        </TouchableOpacity>
                        <Text style={styles.pageHeaderTitle}>{typeConfig.modalTitle}</Text>
                        <View style={{ width: 44 }} />
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
                            {!phase && (
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

                    {isSpecialDate && !draft?.uri ? (
                        <View style={styles.momentPreviewCard}>
                            <TouchableOpacity
                                style={styles.momentPreviewIconButton}
                                onPress={() => {
                                    Keyboard.dismiss();
                                    setShowIconPicker((current) => !current);
                                }}
                                activeOpacity={0.86}
                                disabled={!!phase}
                            >
                                <View style={styles.momentPreviewIcon}>
                                    <Text style={styles.momentPreviewGlyph}>{getSpecialDateIcon(iconKey).glyph}</Text>
                                </View>
                                <View style={styles.iconChevronBadge}>
                                    <ChevronDown color="#B56F7E" size={14} strokeWidth={2.5} />
                                </View>
                            </TouchableOpacity>
                            <View style={styles.momentPreviewCopy}>
                                <Text style={styles.momentPreviewKicker}>{typeConfig.modalTitle}</Text>
                                <TextInput
                                    style={styles.momentPreviewInput}
                                    value={title}
                                    onChangeText={(value) => setTitle(value.slice(0, TITLE_LIMIT))}
                                    placeholder={typeConfig.placeholderTitle}
                                    placeholderTextColor="#B09AA4"
                                    maxLength={TITLE_LIMIT}
                                    editable={!phase}
                                />
                            </View>
                        </View>
                    ) : (
                        <>
                            <View style={styles.titlePhotoRow}>
                                {!draft?.uri && (
                                    <TouchableOpacity style={styles.photoIconButton} onPress={onPickPhoto} activeOpacity={0.88} disabled={!!phase}>
                                        <ImagePlus color="#C96F81" size={22} strokeWidth={1.9} />
                                    </TouchableOpacity>
                                )}
                                <TextInput
                                    style={[styles.titleInput, styles.titleInputInRow]}
                                    value={title}
                                    onChangeText={(value) => setTitle(value.slice(0, TITLE_LIMIT))}
                                    placeholder={typeConfig.placeholderTitle}
                                    placeholderTextColor="#B09AA4"
                                    maxLength={TITLE_LIMIT}
                                    editable={!phase}
                                />
                            </View>
                        </>
                    )}

                    <TouchableOpacity
                        style={styles.dateChip}
                        onPress={openDatePicker}
                        disabled={!!phase}
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
                        editable={!phase}
                    />

                    <TouchableOpacity
                        style={[styles.saveButton, !!phase && styles.saveButtonDisabled]}
                        onPress={onSave}
                        disabled={!!phase}
                        activeOpacity={0.9}
                    >
                        <Text style={styles.saveButtonText}>{typeConfig.saveLabel}</Text>
                    </TouchableOpacity>
                    <UploadProgress phase={phase} />
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
                            <Text style={styles.emojiSheetTitle}>Choose an icon</Text>
                            <TouchableOpacity style={styles.emojiSheetClose} onPress={() => setShowIconPicker(false)}>
                                <X color="#352B35" size={20} strokeWidth={2} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.emojiScroll} showsVerticalScrollIndicator={false}>
                            {EMOJI_CATEGORIES.map((category) => (
                                <View key={category.title} style={styles.emojiCategoryBlock}>
                                    <Text style={styles.emojiCategoryTitle}>{category.title}</Text>
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
    const scrollY = useRef(new Animated.Value(0)).current;
    const fabProgress = useRef(new Animated.Value(0)).current;
    const loadedUserRef = useRef(null);

    const [memories, setMemories] = useState(() => userId ? readCachedMemories(userId) : []);
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
    const [phase, setPhase] = useState('');

    const headerOpacity = scrollY.interpolate({
        inputRange: [0, 40],
        outputRange: [0, 1],
        extrapolate: 'clamp',
    });

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
        if (!userId || isLoading) return;

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
            Alert.alert('Memories unavailable', error.message || 'Could not load memories.');
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, [cursor, hasMore, isLoading, userId]);

    useEffect(() => {
        if (!userId || loadedUserRef.current === userId) return;

        loadedUserRef.current = userId;
        setMemories(readCachedMemories(userId));
        setCursor(null);
        setHasMore(true);
        loadMemories({ refresh: true });
    }, [loadMemories, userId]);

    const resetDraft = useCallback(() => {
        setDraft(null);
        setIconKey('ring');
        setTitle('');
        setCaption('');
        setCapturedAtState(new Date());
        setCapturedAtSource('upload_time');
        setPhase('');
    }, []);

    const openAdd = useCallback((type = 'memory') => {
        if (!hasPartner) {
            Alert.alert('Link partner first', 'Your timeline is shared with your partner.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Link partner', onPress: onLinkPartner },
            ]);
            return;
        }

        resetDraft();
        setEntryType(type);
        setIsActionMenuOpen(false);
        setModalVisible(true);
    }, [hasPartner, onLinkPartner, resetDraft]);

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
                Alert.alert('Photo access needed', 'Allow photo library access to add a memory.');
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
            setCapturedAtState(captured.capturedAt);
            setCapturedAtSource(captured.capturedAtSource);
            setDraft({
                asset,
                uri: asset.uri,
                width: asset.width,
                height: asset.height,
            });
        } catch (error) {
            Alert.alert('Could not open photos', error.message || 'Please try again.');
        }
    }, []);

    const saveMemory = useCallback(async () => {
        if (!userId || phase) return;

        const safeTitle = title.trim();
        const safeCaption = caption.trim();
        const normalizedType = normalizeEntryType(entryType);

        if (!safeTitle) {
            Alert.alert('Add a title', normalizedType === 'special_date'
                ? 'Name this special date first.'
                : 'Give this memory a title first.');
            return;
        }

        if (!safeCaption) {
            Alert.alert('Add a note', normalizedType === 'special_date'
                ? 'Add what made this date special.'
                : 'Add what was memorable about that day.');
            return;
        }

        try {
            let preparedImage = null;
            let uploaded = {};

            if (draft?.asset) {
                setPhase('Preparing photo');
                preparedImage = await prepareMemoryImage(draft.asset);

                setPhase('Uploading photo');
                uploaded = await uploadMemoryImage(preparedImage);
            }

            setPhase('Saving timeline');
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
            setModalVisible(false);
            resetDraft();
        } catch (error) {
            Alert.alert('Memory not saved', error.message || 'Please try again.');
        } finally {
            setPhase('');
        }
    }, [caption, capturedAt, capturedAtSource, draft, entryType, iconKey, phase, resetDraft, title, userId]);

    const contentPadding = useMemo(() => ({
        paddingTop: insets.top + 76,
        paddingBottom: insets.bottom + 94,
    }), [insets.bottom, insets.top]);

    return (
        <LinearGradient
            colors={['#F8D9EC', '#FFF7FA', '#FFF4F7', '#F7D8F2']}
            locations={[0, 0.34, 0.72, 1]}
            start={{ x: 0.25, y: 0 }}
            end={{ x: 0.75, y: 1 }}
            style={styles.screen}
        >
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <Animated.View style={[styles.headerBlur, { opacity: headerOpacity, height: insets.top + 66 }]}>
                <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFill} />
            </Animated.View>
            <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
                <View style={styles.headerCopy}>
                    <Text style={styles.title}>Our Timeline</Text>
                </View>
            </View>

            <Animated.FlatList
                data={memories}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => <MemoryCard item={item} />}
                contentContainerStyle={[styles.listContent, contentPadding, memories.length === 0 && styles.emptyListContent]}
                showsVerticalScrollIndicator={false}
                onEndReachedThreshold={0.45}
                onEndReached={() => loadMemories()}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={() => loadMemories({ refresh: true })}
                        tintColor="#FF758F"
                    />
                }
                ListEmptyComponent={!isLoading ? <EmptyState onAdd={() => openAdd('memory')} /> : null}
                ListFooterComponent={isLoading && memories.length > 0 ? (
                    <View style={styles.footerLoader}>
                        <ActivityIndicator color="#C96F81" />
                    </View>
                ) : null}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: false }
                )}
                scrollEventThrottle={16}
                removeClippedSubviews={Platform.OS === 'android'}
            />

            {isLoading && memories.length === 0 && (
                <View style={styles.initialLoader}>
                    <ActivityIndicator color="#C96F81" />
                </View>
            )}

            <AddMemoryModal
                visible={modalVisible}
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
                phase={phase}
                onClose={() => {
                    if (!phase) {
                        setModalVisible(false);
                        resetDraft();
                    }
                }}
                onPickPhoto={pickPhoto}
                onSave={saveMemory}
                onRemovePhoto={() => setDraft(null)}
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
        elevation: 5,
    },
});

const styles = StyleSheet.create({
    screen: {
        flex: 1,
    },
    headerBlur: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 4,
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 5,
        paddingHorizontal: 18,
        paddingBottom: 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerCopy: {
        flex: 1,
    },
    title: {
        fontFamily: fontFamily.extraBold,
        fontSize: 32,
        fontWeight: fontWeight('800'),
        color: '#202B5E',
        letterSpacing: -0.5,
        marginBottom: 6,
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
        minHeight: 154,
        borderRadius: 24,
        padding: 18,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F2DED8',
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
        marginBottom: 12,
    },
    dateMomentIcon: {
        backgroundColor: '#EAF5EE',
    },
    momentGlyph: {
        fontSize: 24,
        lineHeight: 28,
    },
    momentKicker: {
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        color: '#C96F81',
        fontSize: 11,
        letterSpacing: 0,
        marginBottom: 5,
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
        elevation: 3,
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
        height: 48,
        borderRadius: 24,
        paddingHorizontal: 18,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: colors.primary,
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
    sheet: {
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        backgroundColor: '#FFF9F5',
        paddingHorizontal: 18,
        paddingTop: 10,
    },
    sheetHandle: {
        alignSelf: 'center',
        width: 42,
        height: 5,
        borderRadius: 3,
        backgroundColor: '#E7D2CC',
        marginBottom: 14,
    },
    sheetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    sheetTitle: {
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        color: '#302832',
        fontSize: 24,
    },
    sheetClose: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
    },
    iconPicker: {
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F1DED8',
        padding: 12,
        marginBottom: 12,
    },
    iconPickerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    iconPickerTitle: {
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        color: '#332B35',
        fontSize: 14,
    },
    iconPickerHint: {
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
        color: '#A58B95',
        fontSize: 11,
    },
    iconGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    iconOption: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFF8F4',
        borderWidth: 1,
        borderColor: '#F1DED8',
    },
    iconOptionActive: {
        backgroundColor: '#EAF5EE',
        borderColor: '#8DB5A5',
    },
    iconOptionGlyph: {
        fontSize: 21,
        lineHeight: 25,
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
    previewEmpty: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    previewEmptyText: {
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
        color: '#A37C89',
        fontSize: 15,
    },
    optionalPhotoButton: {
        height: 48,
        borderRadius: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F1DED8',
        marginBottom: 12,
    },
    optionalPhotoText: {
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
        color: '#C96F81',
        fontSize: 14,
    },
    titlePhotoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    photoIconButton: {
        width: 58,
        height: 58,
        borderRadius: 29,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F1DED8',
    },
    changePhotoButton: {
        alignSelf: 'flex-start',
        minHeight: 38,
        borderRadius: 19,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F1DED8',
        paddingHorizontal: 14,
        marginTop: 10,
        marginBottom: 12,
    },
    changePhotoText: {
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
        color: '#C96F81',
        fontSize: 13,
    },
    titleInput: {
        height: 52,
        borderRadius: 18,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 15,
        borderWidth: 1,
        borderColor: '#F1DED8',
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        color: '#302832',
        fontSize: 17,
        marginTop: 12,
    },
    titleInputInRow: {
        flex: 1,
        height: 58,
        marginTop: 0,
    },
    momentPreviewCard: {
        borderRadius: 20,
        padding: 18,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 18,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F1DED8',
    },
    momentPreviewIconButton: {
        width: 78,
        height: 78,
    },
    momentPreviewIcon: {
        width: 74,
        height: 74,
        alignItems: 'center',
        justifyContent: 'center',
    },
    momentPreviewGlyph: {
        fontSize: 48,
        lineHeight: 54,
    },
    iconChevronBadge: {
        position: 'absolute',
        right: -1,
        bottom: 1,
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F1DED8',
        shadowColor: '#C96F81',
        shadowOpacity: 0.12,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
    },
    momentPreviewCopy: {
        flex: 1,
    },
    momentPreviewKicker: {
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        color: '#C96F81',
        fontSize: 10,
        marginBottom: 2,
        textTransform: 'uppercase',
    },
    momentPreviewTitle: {
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        color: '#332B35',
        fontSize: 18,
    },
    momentPreviewInput: {
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        color: '#332B35',
        fontSize: 18,
        padding: 0,
        margin: 0,
        height: 32,
    },
    compactIconPicker: {
        marginTop: 10,
        borderRadius: 18,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F1DED8',
        padding: 10,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    dateChip: {
        marginTop: 12,
        borderRadius: 18,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 14,
        paddingVertical: 11,
        borderWidth: 1,
        borderColor: '#F1DED8',
    },
    dateChipSource: {
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
        color: '#8DB5A5',
        fontSize: 12,
        marginBottom: 2,
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
    progressPill: {
        position: 'absolute',
        left: 28,
        right: 28,
        bottom: 28,
        height: 46,
        borderRadius: 23,
        backgroundColor: 'rgba(45,35,42,0.86)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    progressText: {
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
        color: '#FFFFFF',
        fontSize: 14,
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
    calendarHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 18,
    },
    calendarNavButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F1DED8',
    },
    calendarTitleWrap: {
        alignItems: 'center',
    },
    calendarTitle: {
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        color: '#302832',
        fontSize: 24,
    },
    calendarTodayText: {
        marginTop: 2,
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
        color: '#C96F81',
        fontSize: 12,
    },
    weekRow: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    weekdayText: {
        flex: 1,
        textAlign: 'center',
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        color: '#A38E96',
        fontSize: 12,
    },
    calendarGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    calendarDayCell: {
        width: `${100 / 7}%`,
        aspectRatio: 1.05,
        alignItems: 'center',
        justifyContent: 'center',
    },
    calendarDayCircle: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
    },
    calendarDayCircleSelected: {
        backgroundColor: '#FFE0E8',
        borderWidth: 1,
        borderColor: '#FFB3C1',
    },
    calendarDayText: {
        fontFamily: fontFamily.medium,
        fontWeight: fontWeight('500'),
        color: '#332B35',
        fontSize: 20,
    },
    calendarTodayDayText: {
        color: '#C96F81',
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
    },
    calendarDayTextSelected: {
        color: '#C96F81',
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
    },
    timePanel: {
        marginTop: 14,
        borderRadius: 22,
        padding: 14,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F1DED8',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    timePanelLabel: {
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
        color: '#A38E96',
        fontSize: 12,
    },
    timePanelValue: {
        marginTop: 2,
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        color: '#302832',
        fontSize: 22,
    },
    timeControls: {
        flexDirection: 'row',
        gap: 8,
    },
    timeControlGroup: {
        alignItems: 'center',
        gap: 4,
    },
    timeStepButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFF8F4',
        borderWidth: 1,
        borderColor: '#F1DED8',
    },
    timeStepLabel: {
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
        color: '#8E7982',
        fontSize: 10,
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
