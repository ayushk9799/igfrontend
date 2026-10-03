import React, { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { ChevronRight, Lock, Maximize2, MessageCircle, Sparkles } from 'lucide-react-native';

import VoiceBubble from '../chat/VoiceBubble';
import { fontFamily } from '../../constants/fonts';
import { translateUiText } from '../../i18n/uiTranslation';
import { layoutRatingMarkers } from '../../utils/sliderSummaryLayout';

export const ANSWER_FORMAT_THEME = {
    deep: {
        accent: '#D32764', secondary: '#6B527A', tint: '#FFF0F5', badge: 'Deep Talk', icon: '♥',
    },
    likelyto: {
        accent: '#C92C68', secondary: '#8F204D', tint: '#FFF0F6', badge: 'Likely To', icon: '♡',
    },
    voicerecord: {
        accent: '#6D3CA1', secondary: '#D53470', tint: '#F4ECFF', badge: 'Voice Notes', icon: '▥',
    },
    takephoto: {
        accent: '#C9255A', secondary: '#C9255A', tint: '#FFF0F4', badge: 'Photo Set', icon: '▣',
    },
    slider: {
        accent: '#39104E', secondary: '#D93C70', tint: '#F3EAF7', badge: 'Slider', icon: '♥',
    },
    wouldyourather: {
        accent: '#C92C68', secondary: '#7D285B', tint: '#FFF0F6', badge: 'Would You Rather', icon: '♡',
        footer: ['#D94278', '#9D285F'],
    },
    thisorthat: {
        accent: '#0B8F8B', secondary: '#DF4B7D', tint: '#E9FAF8', badge: 'This or That', icon: '♥',
        footer: ['#079A95', '#07827F'],
    },
};

export const SUMMARY_GRADIENT = {
    colors: ['#F8D9EC', '#FFF7FA', '#FFF4F7', '#F7D8F2'],
    locations: [0, 0.34, 0.72, 1],
    start: { x: 0.25, y: 0 },
    end: { x: 0.75, y: 1 },
};

const COMPARISON_FORMATS = new Set(['wouldyourather', 'thisorthat']);
const RATING_MARKER_SIZE = 36;
const SHARED_RATING_MARKER_WIDTH = 72;
const RATING_MARKER_GAP = 8;
const RATING_TRACK_TOP = 54;
const isPresent = value => value !== null && value !== undefined;
const isRemoteUri = value => typeof value === 'string' && /^https?:\/\//i.test(value);
const answerValue = value => (
    value && typeof value === 'object' && value.value !== undefined ? value.value : value
);
const avatarSource = value => (
    typeof value === 'string' && value.length > 0 ? { uri: value } : value
);
const initialFor = name => (name || '?').trim().charAt(0).toUpperCase();

const normalizeOption = option => (
    option && typeof option === 'object'
        ? { value: option.value, label: option.label ?? option.value }
        : { value: option, label: option }
);

const displayAnswer = (answer, item, format) => {
    const value = answerValue(answer);
    if (format === 'likelyto') {
        if (value === 'you') return translateUiText('ME');
        if (value === 'partner') return translateUiText('You');
    }
    if (!isPresent(value) || !COMPARISON_FORMATS.has(format)) return value;
    const options = item.optionItems?.length ? item.optionItems : (item.options || []);
    const selectedOption = options.map(normalizeOption).find(option => String(option.value) === String(value));
    return translateUiText(String(selectedOption?.label ?? value));
};

export function Avatar({ uri, name, size = 44 }) {
    const source = avatarSource(uri);
    return (
        <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
            {source ? (
                <Image source={source} style={styles.avatarImage} resizeMode="cover" />
            ) : (
                <LinearGradient colors={['#F3C6D8', '#DCC9F4']} style={styles.avatarFallback}>
                    <Text style={[styles.avatarInitial, { fontSize: size * 0.4 }]}>{initialFor(name)}</Text>
                </LinearGradient>
            )}
        </View>
    );
}


function QuestionCardHeader({ index, prompt, theme }) {
    return (
        <View style={styles.cardHeader}>
            <Text style={styles.cardPromptText}>
                <Text style={{ color: theme.accent }}>Q{index + 1}. </Text>
                {prompt}
            </Text>
        </View>
    );
}

function ContinueLink({ label = 'Discuss in chat', color = '#D32764', onPress, inline = false }) {
    if (!onPress) return null;
    const isMemory = label === 'Open this memory';
    const IconComponent = isMemory ? Sparkles : MessageCircle;
    return (
        <TouchableOpacity
            onPress={onPress}
            style={[styles.continueLinkBtn, inline && styles.continueLinkInline]}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={translateUiText(label)}
        >
            <View style={styles.continueLinkContent}>
                <IconComponent size={14} color={color} strokeWidth={2.2} />
                <Text style={[styles.continueLinkText, { color }]}>
                    {translateUiText(label)}
                </Text>
                <ChevronRight size={13} color={color} strokeWidth={2.4} />
            </View>
        </TouchableOpacity>
    );
}

const hasConversationAnswer = (value, format) => {
    const resolved = answerValue(value);
    if (format === 'takephoto') return isRemoteUri(resolved);
    return isPresent(resolved) && String(resolved).trim().length > 0;
};

function AnswerMessage({ answer, hasAnswer, isUser = false, name, avatar, format, theme, onAnswer, locked = false, pendingLabel, onOpenPhoto }) {
    const isMedia = format === 'voicerecord' || format === 'takephoto';
    const answerLabel = format === 'voicerecord'
        ? 'Tap to record'
        : format === 'takephoto'
            ? 'Tap to take photo'
            : format === 'slider' ? 'Tap to rate' : 'Tap to answer';
    const displayName = name || translateUiText(isUser ? 'You' : 'Partner');
    const avatarView = (
        <View style={styles.answerAvatar} accessible accessibilityRole="image" accessibilityLabel={displayName}>
            <Avatar uri={avatar} name={displayName} size={32} />
        </View>
    );
    const bubbleStyle = [
        styles.answerBubble,
        isUser ? styles.answerBubbleUser : styles.answerBubblePartner,
        isMedia && hasAnswer && styles.answerBubbleMedia,
        format === 'takephoto' && hasAnswer && styles.answerBubblePhoto,
    ];

    let content;
    if (locked || !hasAnswer) {
        content = (
            <View style={styles.pendingContent}>
                {locked && <Lock size={14} color="#7A6484" />}
                <Text style={[styles.pendingText, isUser && styles.pendingTextUser]}>
                    {translateUiText(pendingLabel || (isUser ? answerLabel : 'Waiting for partner response...'))}
                </Text>
            </View>
        );
    } else if (format === 'voicerecord') {
        content = <VoiceBubble audioUri={answer} isSent={isUser} accentColor={isUser ? theme.secondary : theme.accent} />;
    } else if (format === 'takephoto') {
        const photo = (
            <View style={styles.photoFrame}>
                <Image source={{ uri: answer }} style={styles.photoImage} resizeMode="cover" />
                {onOpenPhoto && <View style={styles.photoZoomBadge}><Maximize2 size={12} color="#FFFFFF" /></View>}
            </View>
        );
        content = onOpenPhoto ? (
            <TouchableOpacity
                style={styles.photoButton}
                onPress={() => onOpenPhoto(answer, isUser)}
                accessibilityRole="button"
                accessibilityLabel={translateUiText('Open this memory')}
                activeOpacity={0.88}
            >
                {photo}
            </TouchableOpacity>
        ) : photo;
    } else {
        content = <Text style={styles.answerBodyText}>{String(answer)}</Text>;
    }

    return (
        <View style={[
            styles.answerMessage,
            isUser ? styles.answerMessageUser : styles.answerMessagePartner,
        ]}>
            {!isUser && avatarView}
            {!hasAnswer && isUser ? (
                <TouchableOpacity
                    onPress={onAnswer}
                    disabled={!onAnswer}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel={translateUiText(answerLabel)}
                    style={[bubbleStyle, styles.answerBubblePendingUser]}
                >
                    <Text style={styles.answerActionIcon}>＋</Text>
                    {content}
                </TouchableOpacity>
            ) : (
                <View style={[bubbleStyle, !hasAnswer && styles.answerBubblePending]}>
                    {content}
                </View>
            )}
            {isUser && avatarView}
        </View>
    );
}

export function ConversationRow({
    item, index, theme, userName, partnerName, userAvatar, partnerAvatar, onPress, onAnswer, format = 'deep',
    partnerLocked = false, partnerPendingLabel, onOpenPhoto, continueLabel,
}) {
    const userAnswer = displayAnswer(item.userAnswer, item, format);
    const partnerAnswer = partnerLocked ? null : displayAnswer(item.partnerAnswer, item, format);
    const userFormat = item.userType === 'voice' ? 'voicerecord' : item.userType === 'photo' ? 'takephoto' : format;
    const partnerFormat = item.partnerType === 'voice' ? 'voicerecord' : item.partnerType === 'photo' ? 'takephoto' : format;
    const hasUserAnswer = hasConversationAnswer(item.userAnswer, userFormat);
    const hasPartnerAnswer = !partnerLocked && hasConversationAnswer(item.partnerAnswer, partnerFormat);

    return (
        <View style={styles.conversationSection}>
            <QuestionCardHeader index={index} prompt={item.prompt} theme={theme} />

            <View style={styles.answerMessages}>
                <AnswerMessage
                    answer={partnerAnswer}
                    hasAnswer={hasPartnerAnswer}
                    name={partnerName}
                    avatar={partnerAvatar}
                    format={partnerFormat}
                    theme={theme}
                    locked={partnerLocked}
                    pendingLabel={partnerPendingLabel}
                    onOpenPhoto={onOpenPhoto}
                />
                <AnswerMessage
                    answer={userAnswer}
                    hasAnswer={hasUserAnswer}
                    isUser
                    name={userName}
                    avatar={userAvatar}
                    format={userFormat}
                    theme={theme}
                    onAnswer={onAnswer}
                    onOpenPhoto={onOpenPhoto}
                />
            </View>

            {(hasUserAnswer || hasPartnerAnswer || item.chatId) && (
                <ContinueLink
                    label={continueLabel || (format === 'takephoto' ? 'Open this memory' : 'Discuss in chat')}
                    onPress={onPress}
                    inline
                />
            )}
        </View>
    );
}

const sliderPercent = (value, min, max) => {
    const resolvedValue = answerValue(value);
    if (!isPresent(resolvedValue) || (typeof resolvedValue === 'string' && !resolvedValue.trim())) {
        return null;
    }
    const numeric = Number(resolvedValue);
    if (!Number.isFinite(numeric)) return null;
    const range = Math.max(1, max - min);
    const percent = Math.max(0, Math.min(100, ((numeric - min) / range) * 100));
    return { numeric, percent };
};

function RatingAvatar({ value, avatar, label }) {
    return (
        <View
            style={styles.ratingAvatar}
            accessible
            accessibilityLabel={`${label}: ${value}`}
        >
            <Avatar uri={avatar} name={label} size={28} />
        </View>
    );
}

function SliderMarkers({ userPosition, partnerPosition, width, userAvatar, partnerAvatar, userName, partnerName }) {
    if (width <= 0) return null;
    const isShared = userPosition && partnerPosition && userPosition.numeric === partnerPosition.numeric;
    const markers = isShared
        ? [{ key: 'shared', percent: userPosition.percent, width: SHARED_RATING_MARKER_WIDTH }]
        : [
            userPosition && { key: 'user', percent: userPosition.percent, width: RATING_MARKER_SIZE },
            partnerPosition && { key: 'partner', percent: partnerPosition.percent, width: RATING_MARKER_SIZE },
        ].filter(Boolean);
    const placements = layoutRatingMarkers(markers, width, RATING_MARKER_GAP, SHARED_RATING_MARKER_WIDTH / 2);
    const pointerY = RATING_TRACK_TOP - 9;
    const userBadge = userPosition && (
        <RatingAvatar value={userPosition.numeric} avatar={userAvatar} label={userName || translateUiText('You')} />
    );
    const partnerBadge = partnerPosition && (
        <RatingAvatar value={partnerPosition.numeric} avatar={partnerAvatar} label={partnerName || translateUiText('Partner')} />
    );

    return (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
            <Svg width={width} height={RATING_TRACK_TOP} style={styles.markerConnectors}>
                {placements.map(marker => (
                    <Path
                        key={marker.key}
                        d={`M ${marker.left + marker.width / 2 - 6} ${RATING_MARKER_SIZE + 1} L ${marker.left + marker.width / 2 + 6} ${RATING_MARKER_SIZE + 1} L ${marker.anchor} ${pointerY} Z`}
                        fill={marker.key === 'shared' ? '#85529F' : marker.key === 'user' ? '#2866C8' : '#E94778'}
                    />
                ))}
            </Svg>
            {placements.map(marker => (
                <View
                    key={marker.key}
                    testID={`rating-marker-${marker.key}`}
                    style={[
                        styles.sliderMarkerGroup,
                        marker.key === 'shared'
                            ? styles.sliderMarkerShared
                            : marker.key === 'user'
                                ? styles.sliderMarkerUser
                                : styles.sliderMarkerPartner,
                        {
                            left: marker.left,
                            width: marker.width,
                        },
                    ]}
                >
                    {marker.key !== 'partner' && userBadge}
                    {marker.key !== 'user' && partnerBadge}
                </View>
            ))}
        </View>
    );
}

export function SliderRow({ item, index, theme, userName, partnerName, userAvatar, partnerAvatar, onPress, onAnswer, partnerLocked = false, partnerPendingLabel }) {
    const [plotWidth, setPlotWidth] = useState(0);
    const min = Number.isFinite(Number(item.minValue)) ? Number(item.minValue) : 1;
    const max = Number.isFinite(Number(item.maxValue)) ? Number(item.maxValue) : 10;
    const rawUserValue = answerValue(item.userAnswer);
    const rawPartnerValue = partnerLocked ? null : answerValue(item.partnerAnswer);
    const hasUserAnswer = isPresent(rawUserValue)
        && !(typeof rawUserValue === 'string' && !rawUserValue.trim());
    const hasPartnerAnswer = isPresent(rawPartnerValue)
        && !(typeof rawPartnerValue === 'string' && !rawPartnerValue.trim());
    const userVal = hasUserAnswer ? Number(rawUserValue) : null;
    const partnerVal = hasPartnerAnswer ? Number(rawPartnerValue) : null;
    const both = hasUserAnswer
        && hasPartnerAnswer
        && Number.isFinite(userVal)
        && Number.isFinite(partnerVal);
    const distance = both ? Math.abs(userVal - partnerVal) : null;
    const ticks = Array.from({ length: Math.min(10, Math.max(2, max - min + 1)) }, (_, i) => min + i);
    return (
        <TouchableOpacity style={styles.conversationSection} onPress={onPress} activeOpacity={onPress ? 0.88 : 1}>
            <QuestionCardHeader index={index} prompt={item.prompt} theme={theme} />
            <View
                style={styles.sliderPlot}
                onLayout={event => setPlotWidth(event.nativeEvent.layout.width)}
                testID={`slider-plot-${item.questionId || index}`}
            >
                <View style={styles.sliderTrack} />
                <View style={styles.tickDots}>
                    {ticks.map(tick => {
                        const isUserSelection = Number.isFinite(userVal) && userVal === tick;
                        const isPartnerSelection = Number.isFinite(partnerVal) && partnerVal === tick;
                        return (
                            <View
                                key={tick}
                                style={[
                                    styles.tickDot,
                                    isUserSelection && !isPartnerSelection && styles.userTickDot,
                                    isPartnerSelection && !isUserSelection && styles.partnerTickDot,
                                    isUserSelection && isPartnerSelection && styles.sharedTickDot,
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.tickNumber,
                                        (isUserSelection || isPartnerSelection) && styles.selectedTickNumber,
                                    ]}
                                >
                                    {tick}
                                </Text>
                            </View>
                        );
                    })}
                </View>
                <SliderMarkers
                    userPosition={sliderPercent(item.userAnswer, min, max)}
                    partnerPosition={partnerLocked ? null : sliderPercent(item.partnerAnswer, min, max)}
                    width={plotWidth}
                    userAvatar={userAvatar}
                    partnerAvatar={partnerAvatar}
                    userName={userName}
                    partnerName={partnerName}
                />
            </View>
            <View style={styles.sliderEnds}>
                <Text style={styles.sliderEndText}>{item.minLabel || translateUiText('Not yet')}</Text>
                <Text style={styles.sliderEndText}>{item.maxLabel || translateUiText('Completely')}</Text>
            </View>
            {(partnerLocked || (!hasUserAnswer && onAnswer)) && (
                <View style={styles.sliderPendingAnswers}>
                    {partnerLocked && (
                        <AnswerMessage
                            hasAnswer={false}
                            name={partnerName}
                            avatar={partnerAvatar}
                            format="slider"
                            theme={theme}
                            locked
                            pendingLabel={partnerPendingLabel}
                        />
                    )}
                    {!hasUserAnswer && onAnswer && (
                        <AnswerMessage hasAnswer={false} isUser name={userName} avatar={userAvatar} format="slider" theme={theme} onAnswer={onAnswer} />
                    )}
                </View>
            )}
            {both && (
                <View style={styles.syncPill}>
                    <Text style={styles.syncPillText}>
                        {distance === 0 ? `💜  ${translateUiText('Exact Match · Same spot')}` : distance === 1 ? `✨  ${translateUiText('Almost Synced · 1 apart')}` : `↔  ${distance} ${translateUiText('apart')}`}
                    </Text>
                </View>
            )}
            <ContinueLink onPress={onPress} inline />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    avatar: { overflow: 'hidden', backgroundColor: '#F5E7EF' },
    avatarImage: { width: '100%', height: '100%' },
    avatarFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    avatarInitial: { color: '#452452', fontFamily: fontFamily.extraBold },

    cardHeader: {
        marginBottom: 14,
    },
    cardPromptText: {
        color: '#24102C',
        fontFamily: fontFamily.extraBold,
        fontSize: 17,
        lineHeight: 23,
        letterSpacing: -0.2,
    },

    /* Answers arranged as a conversation beneath each shared question. */
    conversationSection: {
        paddingHorizontal: 2,
        paddingTop: 8,
        paddingBottom: 20,
        marginBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(122, 49, 93, 0.12)',
    },
    answerMessages: {
        gap: 16,
        marginTop: 2,
    },
    answerMessage: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
        minWidth: 0,
    },
    answerMessageUser: {
        justifyContent: 'flex-end',
        paddingLeft: 40,
    },
    answerMessagePartner: {
        paddingRight: 40,
    },
    answerAvatar: {
        width: 32,
        height: 32,
        flexShrink: 0,
    },
    answerBubble: {
        maxWidth: '82%',
        flexShrink: 1,
        minWidth: 0,
        borderRadius: 18,
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    answerBubbleMedia: {
        width: '82%',
    },
    answerBubblePhoto: {
        paddingVertical: 0,
        paddingHorizontal: 0,
        borderWidth: 0,
        overflow: 'hidden',
    },
    answerBubblePartner: {
        backgroundColor: '#E8DCF3',
        borderWidth: 1,
        borderColor: '#D4BFE5',
        borderBottomLeftRadius: 4,
    },
    answerBubbleUser: {
        backgroundColor: '#F0B8CE',
        borderWidth: 1,
        borderColor: '#DB88A8',
        borderBottomRightRadius: 4,
    },
    answerBodyText: {
        color: '#281330',
        fontFamily: fontFamily.bold,
        fontSize: 15,
        lineHeight: 22,
    },
    answerBubblePending: {
        backgroundColor: '#EEE3F6',
        borderStyle: 'dashed',
    },
    answerBubblePendingUser: {
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: '#C9638D',
        backgroundColor: '#F7D3E1',
    },
    answerActionIcon: {
        color: '#B52F62',
        fontFamily: fontFamily.bold,
        fontSize: 18,
    },
    pendingText: {
        color: '#7A6484',
        fontFamily: fontFamily.medium,
        fontSize: 13,
        lineHeight: 19,
        flexShrink: 1,
    },
    pendingContent: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
    sliderPendingAnswers: { gap: 16, marginTop: 16 },
    pendingTextUser: {
        color: '#B52F62',
        fontFamily: fontFamily.bold,
    },

    /* Action Links */
    continueLinkBtn: {
        alignSelf: 'center',
        paddingVertical: 8,
        paddingHorizontal: 14,
        marginTop: 12,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: 'rgba(240, 205, 220, 0.75)',
        shadowColor: '#3A1530',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },
    continueLinkInline: {
        alignSelf: 'flex-end',
        minHeight: 44,
        justifyContent: 'center',
        paddingHorizontal: 4,
        marginTop: 8,
        backgroundColor: 'transparent',
        borderWidth: 0,
        shadowOpacity: 0,
        elevation: 0,
    },
    continueLinkContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    continueLinkText: {
        fontFamily: fontFamily.bold,
        fontSize: 13,
        letterSpacing: -0.1,
    },

    /* Photo Sets */
    photoFrame: {
        width: '100%',
        aspectRatio: 4 / 3,
        overflow: 'hidden',
        backgroundColor: '#F2E8EC',
    },
    photoImage: {
        width: '100%',
        height: '100%',
    },
    photoButton: { width: '100%' },
    photoZoomBadge: {
        position: 'absolute', bottom: 8, right: 8, width: 24, height: 24, borderRadius: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.55)', alignItems: 'center', justifyContent: 'center',
    },

    sliderPlot: { height: RATING_TRACK_TOP + 16, marginHorizontal: 24, marginTop: 12 },
    sliderTrack: { position: 'absolute', left: 0, right: 0, top: RATING_TRACK_TOP, height: 3, borderRadius: 2, backgroundColor: '#D5D4DF' },
    tickDots: { position: 'absolute', left: -9, right: -9, top: RATING_TRACK_TOP - 8, flexDirection: 'row', justifyContent: 'space-between' },
    tickDot: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#F8F6FA',
        borderWidth: 1,
        borderColor: '#BEB7C8',
        alignItems: 'center',
        justifyContent: 'center',
    },
    userTickDot: { backgroundColor: '#2866C8', borderColor: '#2866C8' },
    partnerTickDot: { backgroundColor: '#E94778', borderColor: '#E94778' },
    sharedTickDot: { backgroundColor: '#85529F', borderColor: '#85529F' },
    tickNumber: { color: '#60556B', fontFamily: fontFamily.extraBold, fontSize: 9, textAlign: 'center' },
    selectedTickNumber: { color: '#FFFFFF' },
    markerConnectors: { position: 'absolute', top: 0, left: 0 },
    sliderMarkerGroup: {
        position: 'absolute',
        top: 2,
        height: RATING_MARKER_SIZE,
        borderRadius: RATING_MARKER_SIZE / 2,
        borderWidth: 3,
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    sliderMarkerUser: { borderColor: '#2866C8' },
    sliderMarkerPartner: { borderColor: '#E94778' },
    sliderMarkerShared: { borderColor: '#85529F' },
    ratingAvatar: { width: 28, height: 28 },
    sliderEnds: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
    sliderEndText: { color: '#201729', fontFamily: fontFamily.medium, fontSize: 12, maxWidth: '40%' },
    syncPill: {
        alignSelf: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        paddingVertical: 7,
        paddingHorizontal: 18,
        marginTop: 12,
        borderWidth: 1,
        borderColor: '#EEDCE8',
    },
    syncPillText: { color: '#4A245E', fontFamily: fontFamily.bold, fontSize: 13 },

});
