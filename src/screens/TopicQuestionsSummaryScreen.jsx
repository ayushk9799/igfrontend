import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';

import VoiceBubble from '../components/chat/VoiceBubble';
import { QuestionsV2Api } from '../api/questionsV2Api';
import { fontFamily } from '../constants/fonts';
import { translateUiText } from '../i18n/uiTranslation';
import { spacing } from '../theme';
import {
    mergeQuestionReportWithLocalAnswers,
    QuestionReportCache,
} from '../services/questionReportCache';

const FORMAT_THEME = {
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
        choiceIndex: { backgroundColor: '#FBE4EE' },
        choiceIndexText: { color: '#B82B61' },
        choiceLeft: { backgroundColor: '#FFF0F6', borderColor: '#F6CDDD' },
        choiceRight: { backgroundColor: '#F7ECF8', borderColor: '#E7D0EA' },
        choiceResultSame: { backgroundColor: '#F9E5EF' },
        choiceResultDifferent: { backgroundColor: '#F5EAF7' },
        choiceResultDifferentText: { color: '#7D285B' },
        footer: ['#D94278', '#9D285F'],
    },
    thisorthat: {
        accent: '#0B8F8B', secondary: '#DF4B7D', tint: '#E9FAF8', badge: 'This or That', icon: '♥',
        footer: ['#079A95', '#07827F'],
    },
};

const HOME_GRADIENT = {
    colors: ['#F8D9EC', '#FFF7FA', '#FFF4F7', '#F7D8F2'],
    locations: [0, 0.34, 0.72, 1],
    start: { x: 0.25, y: 0 },
    end: { x: 0.75, y: 1 },
};

const COMPARISON_FORMATS = new Set(['wouldyourather', 'thisorthat']);
const isPresent = value => value !== null && value !== undefined;
const isRemoteUri = value => typeof value === 'string' && /^https?:\/\//i.test(value);
const answerValue = value => (
    value && typeof value === 'object' && value.value !== undefined ? value.value : value
);
const avatarSource = value => (
    typeof value === 'string' && value.length > 0 ? { uri: value } : value
);
const initialFor = name => (name || '?').trim().charAt(0).toUpperCase();

function BackIcon({ color = '#2B1238', size = 24 }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Path d="M15 18l-6-6 6-6" stroke={color} strokeWidth={2.7} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
    );
}

function Avatar({ uri, name, size = 44, ringColor = '#FFFFFF' }) {
    const source = avatarSource(uri);
    return (
        <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, borderColor: ringColor }]}>
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

function Header({ title, format, theme, subtitle, onBack }) {
    return (
        <View style={styles.header}>
            <TouchableOpacity onPress={onBack} style={styles.headerBack} activeOpacity={0.75}>
                <BackIcon />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
                <Text style={styles.headerTitle}>{title}</Text>
                <View style={[styles.formatBadge, { backgroundColor: theme.tint, borderColor: `${theme.accent}2F` }]}>
                    <Text style={[styles.formatBadgeText, { color: theme.accent }]}>
                        {theme.icon}  {translateUiText(theme.badge)}
                    </Text>
                </View>
                {!!subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
            </View>
            <View style={styles.headerSpacer} />
        </View>
    );
}

function PromptCard({ index, prompt, theme }) {
    return (
        <View style={[styles.promptCard, { borderColor: `${theme.accent}55` }]}>
            <View style={styles.numberBadge}>
                <Text style={styles.numberText}>{index + 1}</Text>
            </View>
            <Text style={styles.promptText}>{prompt}</Text>
        </View>
    );
}

function ContinueLink({ label = 'Continue this chat', color, onPress }) {
    if (!onPress) return null;
    return (
        <TouchableOpacity onPress={onPress} style={styles.continueLink} activeOpacity={0.7}>
            <Text style={[styles.continueText, { color }]}>{translateUiText(label)}  →</Text>
        </TouchableOpacity>
    );
}

function Divider({ color }) {
    return (
        <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: `${color}20` }]} />
            <Text style={[styles.dividerHeart, { color: `${color}55` }]}>♡</Text>
            <View style={[styles.dividerLine, { backgroundColor: `${color}20` }]} />
        </View>
    );
}

function Pending({ isUser }) {
    return (
        <View style={styles.pendingBubble}>
            <Text style={styles.pendingText}>
                {translateUiText(isUser ? 'Tap to answer ✍️' : 'Waiting...')}
            </Text>
        </View>
    );
}

function ConversationRow({ item, index, theme, userName, partnerName, userAvatar, partnerAvatar, onPress }) {
    const entries = [
        { name: partnerName, avatar: partnerAvatar, answer: item.partnerAnswer, isUser: false },
        { name: userName || translateUiText('You'), avatar: userAvatar, answer: item.userAnswer, isUser: true },
    ];

    return (
        <View style={styles.itemBlock}>
            <PromptCard index={index} prompt={item.prompt} theme={theme} />
            <View style={styles.conversation}>
                {entries.map(entry => (
                    <View key={`${item.questionId}-${entry.isUser}`} style={[styles.chatLine, entry.isUser && styles.chatLineUser]}>
                        {!entry.isUser && <Avatar uri={entry.avatar} name={entry.name} size={42} />}
                        <View style={[styles.chatContent, entry.isUser && styles.chatContentUser]}>
                            {isPresent(entry.answer) ? (
                                <View style={[
                                    styles.textBubble,
                                    entry.isUser ? styles.userTextBubble : styles.partnerTextBubble,
                                ]}>
                                    <Text style={styles.answerText}>{String(answerValue(entry.answer))}</Text>
                                </View>
                            ) : <Pending isUser={entry.isUser} />}
                        </View>
                        {entry.isUser && <Avatar uri={entry.avatar} name={entry.name} size={42} ringColor="#FFE3EC" />}
                    </View>
                ))}
            </View>
            <ContinueLink color={theme.accent} onPress={onPress} />
            <Divider color={theme.accent} />
        </View>
    );
}

function VoiceRow({ item, index, theme, userName, partnerName, userAvatar, partnerAvatar, onPress }) {
    const entries = [
        { name: partnerName, avatar: partnerAvatar, answer: item.partnerAnswer, isUser: false },
        { name: userName, avatar: userAvatar, answer: item.userAnswer, isUser: true },
    ];
    return (
        <View style={styles.itemBlock}>
            <PromptCard index={index} prompt={item.prompt} theme={theme} />
            <View style={styles.conversation}>
                {entries.map(entry => (
                    <View key={`${item.questionId}-${entry.isUser}`} style={[styles.chatLine, entry.isUser && styles.chatLineUser]}>
                        {!entry.isUser && <Avatar uri={entry.avatar} name={entry.name} size={42} />}
                        <View style={[styles.voiceContent, entry.isUser && styles.voiceContentUser]}>
                            {isPresent(entry.answer) ? (
                                <View style={[styles.voiceBubble, entry.isUser ? styles.userVoiceBubble : styles.partnerVoiceBubble]}>
                                    <VoiceBubble audioUri={answerValue(entry.answer)} isSent={!entry.isUser} />
                                </View>
                            ) : <Pending isUser={entry.isUser} />}
                        </View>
                        {entry.isUser && <Avatar uri={entry.avatar} name={entry.name} size={42} ringColor="#FFE3EC" />}
                    </View>
                ))}
            </View>
            <ContinueLink color={theme.secondary} onPress={onPress} />
            <Divider color={theme.secondary} />
        </View>
    );
}

function PhotoAnswer({ answer, name, avatar, isUser }) {
    return (
        <View style={[styles.photoAnswerRow, isUser && styles.photoAnswerRowUser]}>
            {!isUser && <Avatar uri={avatar} name={name} size={38} />}
            <View style={[styles.photoContent, isUser && styles.photoContentUser]}>
                {isRemoteUri(answerValue(answer)) ? (
                    <View style={styles.photoFrame}>
                        <Image source={{ uri: answerValue(answer) }} style={styles.photoImage} resizeMode="cover" />
                    </View>
                ) : <Pending isUser={isUser} />}
            </View>
            {isUser && <Avatar uri={avatar} name={name} size={38} ringColor="#FFE3EC" />}
        </View>
    );
}

function PhotoRow({ item, index, theme, userName, partnerName, userAvatar, partnerAvatar, onPress }) {
    return (
        <View style={styles.itemBlock}>
            <PromptCard index={index} prompt={item.prompt} theme={theme} />
            <PhotoAnswer answer={item.partnerAnswer} name={partnerName} avatar={partnerAvatar} isUser={false} />
            <PhotoAnswer answer={item.userAnswer} name={userName} avatar={userAvatar} isUser />
            <ContinueLink label="Open this memory" color={theme.accent} onPress={onPress} />
            <Divider color={theme.accent} />
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

function SliderMarker({ value, min, max, color, avatar, label, placement = 'above' }) {
    const position = sliderPercent(value, min, max);
    if (!position) return null;
    const isBelow = placement === 'below';

    return (
        <View
            style={[
                styles.sliderMarker,
                isBelow && styles.sliderMarkerBelow,
                {
                    left: `${position.percent}%`,
                },
            ]}
        >
            <View style={styles.markerPin}>
                {isBelow && <View style={[styles.markerPointerUp, { borderBottomColor: color }]} />}
                <View style={[styles.markerRing, { borderColor: color }]}>
                    <Avatar uri={avatar} name={label} size={28} ringColor="#FFFFFF" />
                </View>
                {!isBelow && <View style={[styles.markerPointerDown, { borderTopColor: color }]} />}
            </View>
        </View>
    );
}

function SliderRow({ item, index, theme, userName, partnerName, userAvatar, partnerAvatar, onPress }) {
    const min = Number.isFinite(Number(item.minValue)) ? Number(item.minValue) : 1;
    const max = Number.isFinite(Number(item.maxValue)) ? Number(item.maxValue) : 10;
    const rawUserValue = answerValue(item.userAnswer);
    const rawPartnerValue = answerValue(item.partnerAnswer);
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
    const partnerLabel = String(partnerName || translateUiText('Partner')).trim().split(/\s+/)[0];
    const ticks = Array.from({ length: Math.min(10, Math.max(2, max - min + 1)) }, (_, i) => min + i);
    return (
        <TouchableOpacity style={styles.sliderCard} onPress={onPress} activeOpacity={onPress ? 0.84 : 1}>
            <View style={styles.sliderQuestionRow}>
                <View style={styles.sliderIndex}><Text style={styles.sliderIndexText}>{index + 1}</Text></View>
                <Text style={styles.sliderPrompt}>{item.prompt}</Text>
            </View>
            <View style={styles.sliderPlot}>
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
                <SliderMarker
                    value={item.userAnswer}
                    min={min}
                    max={max}
                    color="#2866C8"
                    avatar={userAvatar}
                    label={translateUiText('You')}
                    placement="above"
                />
                <SliderMarker
                    value={item.partnerAnswer}
                    min={min}
                    max={max}
                    color="#E94778"
                    avatar={partnerAvatar}
                    label={partnerLabel}
                    placement="below"
                />
            </View>
            <View style={styles.sliderEnds}>
                <Text style={styles.sliderEndText}>{item.minLabel || translateUiText('Not yet')}</Text>
                <Text style={styles.sliderEndText}>{item.maxLabel || translateUiText('Completely')}</Text>
            </View>
            {both && (
                <View style={styles.syncPill}>
                    <Text style={styles.syncPillText}>
                        {distance === 0 ? '💜  Same spot' : distance === 1 ? '💔  Very close · 1 apart' : `↔  ${distance} apart`}
                    </Text>
                </View>
            )}
        </TouchableOpacity>
    );
}

const normalizeOption = option => (
    option && typeof option === 'object'
        ? { value: option.value, label: option.label ?? option.value }
        : { value: option, label: option }
);

function ChoiceRow({ item, index, theme, userName, partnerName, userAvatar, partnerAvatar, onPress }) {
    const rawOptions = item.optionItems?.length ? item.optionItems : item.options;
    const options = (rawOptions?.length ? rawOptions : ['Option A', 'Option B']).slice(0, 2).map(normalizeOption);
    const userChoice = answerValue(item.userAnswer);
    const partnerChoice = answerValue(item.partnerAnswer);
    const same = isPresent(userChoice) && isPresent(partnerChoice) && String(userChoice) === String(partnerChoice);
    const selected = (choice, answer) => isPresent(answer) && String(choice.value) === String(answer);

    return (
        <TouchableOpacity style={styles.choiceCard} onPress={onPress} activeOpacity={onPress ? 0.84 : 1}>
            <View style={[styles.choiceHeading, { borderColor: `${theme.accent}55` }]}>
                <View style={styles.choiceIndex}>
                    <Text style={styles.choiceIndexText}>{index + 1}</Text>
                </View>
                <Text style={styles.choicePrompt}>{item.prompt}</Text>
            </View>
            <View style={styles.choiceColumns}>
                {options.map((choice, choiceIndex) => (
                    <View key={String(choice.value)} style={[
                        styles.choiceOption,
                        choiceIndex === 0
                            ? (theme.choiceLeft || styles.choiceOptionLeft)
                            : (theme.choiceRight || styles.choiceOptionRight),
                    ]}>
                        <Text style={[styles.choiceLabel, { color: choiceIndex === 0 ? theme.accent : theme.secondary }]}>
                            {translateUiText(String(choice.label))}
                        </Text>
                        <View style={styles.choiceAvatars}>
                            {selected(choice, partnerChoice) && (
                                <View style={styles.choicePerson}>
                                    <Avatar uri={partnerAvatar} name={partnerName} size={42} />
                                </View>
                            )}
                            {selected(choice, userChoice) && (
                                <View style={styles.choicePerson}>
                                    <Avatar uri={userAvatar} name={userName} size={42} />
                                </View>
                            )}
                        </View>
                    </View>
                ))}
            </View>
            {isPresent(userChoice) && isPresent(partnerChoice) && (
                <View style={[
                    styles.choiceResult,
                    same
                        ? (theme.choiceResultSame || styles.choiceResultSame)
                        : (theme.choiceResultDifferent || styles.choiceResultDifferent),
                ]}>
                    <Text style={[
                        styles.choiceResultText,
                        same ? { color: theme.accent } : (theme.choiceResultDifferentText || styles.choiceResultTextDifferent),
                    ]}>
                        {same ? `✓  ${translateUiText('Same pick')}` : `↝  ${translateUiText('Different picks')}`}
                    </Text>
                </View>
            )}
            {!same && <ContinueLink color={theme.accent} onPress={onPress} />}
        </TouchableOpacity>
    );
}

function SliderHero({ summary }) {
    const hasComparison = summary.bothAnswered > 0
        && Number.isFinite(summary.similarityPercent);
    return (
        <View style={styles.sliderHero}>
            <View style={styles.brokenHeart}>
                <Text style={styles.brokenHeartText}>{hasComparison ? '💞' : '💗'}</Text>
            </View>
            <View>
                <Text style={styles.similarityText}>
                    {hasComparison
                        ? `${summary.similarityPercent}% ${translateUiText('in sync')}`
                        : translateUiText('Waiting to compare')}
                </Text>
                <Text style={styles.similaritySub}>
                    {hasComparison
                        ? `${translateUiText('Across')} ${summary.bothAnswered} ${translateUiText('ratings')}`
                        : translateUiText('Both answers will appear here')}
                </Text>
            </View>
        </View>
    );
}

export default function TopicQuestionsSummaryScreen({
    topic,
    selectedSet,
    userId,
    userName = 'You',
    partnerName = 'Your Love',
    userAvatar = null,
    partnerAvatar = null,
    onBack,
    hasPartner = false,
    onLinkPartner = () => {},
    onAnswerQuestion,
    onOpenQuestionChat,
    optimisticReport = null,
    refreshVersion = 0,
}) {
    const insets = useSafeAreaInsets();
    const initialReportRef = useRef(undefined);
    if (initialReportRef.current === undefined) {
        const cachedReport = QuestionReportCache.get({
            topicId: topic,
            setId: selectedSet?.setId,
            userId,
        });
        initialReportRef.current = mergeQuestionReportWithLocalAnswers(
            cachedReport,
            optimisticReport,
        );
    }
    const reportRef = useRef(initialReportRef.current);
    const [report, setReport] = useState(initialReportRef.current);
    const [loading, setLoading] = useState(!initialReportRef.current);
    const [error, setError] = useState(null);
    const format = selectedSet?.format || 'deep';
    const theme = FORMAT_THEME[format] || FORMAT_THEME.deep;

    useEffect(() => {
        if (!initialReportRef.current) return;
        QuestionReportCache.set({
            topicId: topic,
            setId: selectedSet?.setId,
            userId,
            report: initialReportRef.current,
        });
    }, [selectedSet?.setId, topic, userId]);

    const fetchReport = useCallback(async () => {
        if (!hasPartner) {
            setLoading(false);
            onLinkPartner?.();
            return;
        }
        setLoading(!reportRef.current);
        setError(null);
        try {
            const response = await QuestionsV2Api.getSetReport({ topicId: topic, setId: selectedSet?.setId, userId });
            if (response.success) {
                reportRef.current = response.data;
                setReport(response.data);
                QuestionReportCache.set({
                    topicId: topic,
                    setId: selectedSet?.setId,
                    userId,
                    report: response.data,
                });
            }
            else if (response.message === 'User has no partner linked') onLinkPartner?.();
            else if (!reportRef.current) setError(response.message || response.error || 'Failed to load summary');
        } catch (err) {
            if (!reportRef.current) setError(err.message || 'Failed to load summary');
        } finally {
            setLoading(false);
        }
    }, [hasPartner, onLinkPartner, selectedSet?.setId, topic, userId]);

    useEffect(() => { fetchReport(); }, [fetchReport, refreshVersion]);

    useEffect(() => {
        if (!optimisticReport) return;
        const merged = mergeQuestionReportWithLocalAnswers(reportRef.current, optimisticReport);
        reportRef.current = merged;
        setReport(merged);
        setLoading(false);
    }, [optimisticReport]);

    const items = report?.items || [];
    const summary = report?.summary || { totalQuestions: items.length, bothAnswered: 0, matched: 0, similarityPercent: null };
    const subtitle = useMemo(() => {
        if (format === 'voicerecord') return `🔒  ${translateUiText('Only you two can hear these')}`;
        if (format === 'takephoto') return `${summary.bothAnswered || 0} ${translateUiText('moments shared')}`;
        if (COMPARISON_FORMATS.has(format)) return `☆  ${summary.matched || 0} ${translateUiText('shared favorites')}`;
        if (format === 'slider') return null;
        return `${summary.bothAnswered || 0} ${translateUiText('questions answered together')}`;
    }, [format, summary.bothAnswered, summary.matched]);

    if (loading) {
        return (
            <LinearGradient {...HOME_GRADIENT} style={styles.center}>
                <ActivityIndicator size="large" color={theme.accent} />
                <Text style={styles.loadingText}>{translateUiText('Loading your answers...')}</Text>
            </LinearGradient>
        );
    }

    if (error) {
        return (
            <LinearGradient {...HOME_GRADIENT} style={styles.center}>
                <Text style={styles.errorText}>{translateUiText(error)}</Text>
                <TouchableOpacity style={[styles.retryButton, { backgroundColor: theme.accent }]} onPress={fetchReport}>
                    <Text style={styles.footerText}>{translateUiText('Try Again')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onBack} style={styles.errorBack}><Text>{translateUiText('Back to Sets')}</Text></TouchableOpacity>
            </LinearGradient>
        );
    }

    const openItem = item => {
        const hasAnswer = isPresent(item.userAnswer) || isPresent(item.partnerAnswer) || item.chatId;
        if (hasAnswer) onOpenQuestionChat?.(item);
        else onAnswerQuestion?.(item);
    };

    const renderItem = (item, index) => {
        const rowKey = item.questionId || index;
        const common = {
            item,
            index,
            theme,
            userName,
            partnerName,
            userAvatar,
            partnerAvatar,
            onPress: () => openItem(item),
        };
        if (format === 'voicerecord') return <VoiceRow key={rowKey} {...common} />;
        if (format === 'takephoto') return <PhotoRow key={rowKey} {...common} />;
        if (format === 'slider') return <SliderRow key={rowKey} {...common} />;
        if (COMPARISON_FORMATS.has(format)) return <ChoiceRow key={rowKey} {...common} />;
        return <ConversationRow key={rowKey} {...common} />;
    };

    return (
        <LinearGradient {...HOME_GRADIENT} style={styles.screen}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 10 }]}
            >
                <Header title={selectedSet?.title || report?.title} format={format} theme={theme} subtitle={subtitle} onBack={onBack} />
                {format === 'slider' && <SliderHero summary={summary} />}
                {items.length ? items.map(renderItem) : (
                    <View style={styles.emptyCard}>
                        <Text style={styles.emptyEmoji}>♡</Text>
                        <Text style={styles.emptyText}>{translateUiText('No answers yet')}</Text>
                    </View>
                )}
            </ScrollView>
            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom - 8, 10) }]}>
                <TouchableOpacity onPress={onBack} activeOpacity={0.82}>
                    <LinearGradient
                        colors={['#FF5E97', '#FFA1C9']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.footerButton}
                    >
                        <BackIcon color="#FFFFFF" size={21} />
                        <Text style={styles.footerText}>{translateUiText('Back to Sets')}</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    loadingText: { marginTop: 14, color: '#75647F', fontFamily: fontFamily.medium, fontSize: 15 },
    errorText: { color: '#B42355', fontFamily: fontFamily.bold, fontSize: 16, textAlign: 'center', marginBottom: 18 },
    retryButton: { paddingHorizontal: 28, paddingVertical: 13, borderRadius: 24 },
    errorBack: { padding: 16 },
    scrollContent: { paddingHorizontal: 18, paddingBottom: 104 },
    header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 22 },
    headerBack: {
        width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.86)',
        alignItems: 'center', justifyContent: 'center', shadowColor: '#4A174D', shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.08, shadowRadius: 12, elevation: 2,
    },
    headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
    headerSpacer: { width: 48 },
    headerTitle: { color: '#2A1235', fontFamily: fontFamily.extraBold, fontSize: 22, textAlign: 'center', lineHeight: 27 },
    formatBadge: { marginTop: 8, borderRadius: 15, paddingVertical: 4, paddingHorizontal: 12, borderWidth: 1 },
    formatBadgeText: { fontFamily: fontFamily.bold, fontSize: 13 },
    headerSubtitle: { color: '#776582', fontFamily: fontFamily.medium, fontSize: 14, marginTop: 10, textAlign: 'center' },
    avatar: { overflow: 'hidden', borderWidth: 2, backgroundColor: '#F5E7EF' },
    avatarImage: { width: '100%', height: '100%' },
    avatarFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    avatarInitial: { color: '#452452', fontFamily: fontFamily.extraBold },
    itemBlock: { marginBottom: 2 },
    promptCard: {
        backgroundColor: '#8F204D', borderRadius: 22, borderWidth: 1, minHeight: 112,
        alignItems: 'flex-start', justifyContent: 'flex-start', paddingHorizontal: 17, paddingTop: 27, paddingBottom: 18,
    },
    numberBadge: {
        position: 'absolute', left: -8, top: -12, width: 34, height: 34, borderRadius: 17,
        borderWidth: 2, borderColor: '#8F204D', backgroundColor: '#FFFFFF',
        alignItems: 'center', justifyContent: 'center',
    },
    numberText: { color: '#8F204D', fontFamily: fontFamily.extraBold, fontSize: 15 },
    promptText: { color: '#FFFFFF', fontFamily: fontFamily.extraBold, fontSize: 19, lineHeight: 25, textAlign: 'left' },
    conversation: { marginTop: 22, gap: 16 },
    chatLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    chatLineUser: { justifyContent: 'flex-end' },
    chatContent: { maxWidth: '78%' },
    chatContentUser: { alignItems: 'flex-end' },
    voiceContent: { maxWidth: '80%', minWidth: '66%' },
    voiceContentUser: { alignItems: 'flex-end' },
    personLabel: { color: '#5E3E70', fontFamily: fontFamily.bold, fontSize: 14, marginBottom: 5 },
    personLabelUser: { textAlign: 'right' },
    textBubble: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, minHeight: 48, justifyContent: 'center' },
    partnerTextBubble: { backgroundColor: '#F1EDF4', borderTopLeftRadius: 5, borderWidth: 1, borderColor: '#E3DCE8' },
    userTextBubble: { backgroundColor: '#FFE7EF', borderTopRightRadius: 5, borderWidth: 1, borderColor: '#FFC5D6' },
    answerText: { color: '#25122F', fontFamily: fontFamily.regular, fontSize: 16, lineHeight: 22 },
    pendingBubble: { minWidth: 128, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: '#E7B7C7', padding: 12, backgroundColor: '#FFF9FB' },
    pendingText: { color: '#AD6A82', fontFamily: fontFamily.medium, fontSize: 13, textAlign: 'center' },
    continueLink: { alignSelf: 'center', paddingVertical: 16, paddingHorizontal: 10 },
    continueText: { fontFamily: fontFamily.bold, fontSize: 15 },
    dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 34 },
    dividerLine: { flex: 1, height: 1 },
    dividerHeart: { fontSize: 20, paddingHorizontal: 12 },
    voiceBubble: { width: '100%', borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1 },
    partnerVoiceBubble: { backgroundColor: '#EEE7FD', borderColor: '#D9CBFA' },
    userVoiceBubble: { backgroundColor: '#FFE8EF', borderColor: '#FFC4D5' },
    photoAnswerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 18 },
    photoAnswerRowUser: { justifyContent: 'flex-end' },
    photoContent: { width: '73%' },
    photoContentUser: { alignItems: 'flex-end' },
    photoFrame: { width: '100%', height: 170, borderRadius: 18, overflow: 'hidden', backgroundColor: '#F2E8EC', borderWidth: 3, borderColor: '#FFFFFF' },
    photoImage: { width: '100%', height: '100%' },
    sliderHero: {
        flexDirection: 'row', alignItems: 'center', gap: 18, backgroundColor: 'rgba(255,255,255,0.86)', borderRadius: 22,
        padding: 22, marginBottom: 16, shadowColor: '#444477', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 2,
    },
    brokenHeart: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#F9E4EF', alignItems: 'center', justifyContent: 'center' },
    brokenHeartText: { fontSize: 34 },
    similarityText: { color: '#2B103D', fontFamily: fontFamily.extraBold, fontSize: 27 },
    similaritySub: { color: '#6E5D79', fontFamily: fontFamily.medium, fontSize: 15, marginTop: 4 },
    sliderCard: {
        backgroundColor: 'rgba(255,255,255,0.90)', borderRadius: 24, padding: 18, marginBottom: 16, minHeight: 285,
        shadowColor: '#495073', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.07, shadowRadius: 14, elevation: 2,
    },
    sliderQuestionRow: {
        backgroundColor: '#8F204D', borderRadius: 18, paddingHorizontal: 14, paddingTop: 27, paddingBottom: 14,
        alignItems: 'flex-start',
    },
    sliderIndex: {
        position: 'absolute', left: -8, top: -12, width: 34, height: 34, borderRadius: 17,
        backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#8F204D', alignItems: 'center', justifyContent: 'center',
    },
    sliderIndexText: { color: '#8F204D', fontFamily: fontFamily.extraBold, fontSize: 15 },
    sliderPrompt: { color: '#FFFFFF', fontFamily: fontFamily.extraBold, fontSize: 18, lineHeight: 23 },
    sliderPlot: { height: 112, marginHorizontal: 24, marginTop: 12 },
    sliderTrack: { position: 'absolute', left: 0, right: 0, top: 54, height: 3, borderRadius: 2, backgroundColor: '#D5D4DF' },
    tickDots: { position: 'absolute', left: -5, right: -5, top: 46, flexDirection: 'row', justifyContent: 'space-between' },
    tickDot: {
        width: 18, height: 18, borderRadius: 9, backgroundColor: '#F8F6FA', borderWidth: 1,
        borderColor: '#BEB7C8', alignItems: 'center', justifyContent: 'center',
    },
    userTickDot: { backgroundColor: '#2866C8', borderColor: '#2866C8' },
    partnerTickDot: { backgroundColor: '#E94778', borderColor: '#E94778' },
    sharedTickDot: { backgroundColor: '#85529F', borderColor: '#85529F' },
    tickNumber: { color: '#60556B', fontFamily: fontFamily.extraBold, fontSize: 9, textAlign: 'center' },
    selectedTickNumber: { color: '#FFFFFF' },
    sliderMarker: { position: 'absolute', top: 2, width: 72, marginLeft: -36, alignItems: 'center', zIndex: 2 },
    sliderMarkerBelow: { top: 64 },
    markerPin: { alignItems: 'center' },
    markerRing: { width: 36, height: 36, borderRadius: 18, borderWidth: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
    markerPointerDown: {
        width: 0, height: 0, marginTop: -1,
        borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8,
        borderLeftColor: 'transparent', borderRightColor: 'transparent',
    },
    markerPointerUp: {
        width: 0, height: 0, marginBottom: -1,
        borderLeftWidth: 6, borderRightWidth: 6, borderBottomWidth: 8,
        borderLeftColor: 'transparent', borderRightColor: 'transparent',
    },
    sliderEnds: { flexDirection: 'row', justifyContent: 'space-between' },
    sliderEndText: { color: '#201729', fontFamily: fontFamily.medium, fontSize: 12, maxWidth: '40%' },
    syncPill: { alignSelf: 'center', backgroundColor: '#F3E9F7', borderRadius: 18, paddingVertical: 7, paddingHorizontal: 18, marginTop: 10 },
    syncPillText: { color: '#4A245E', fontFamily: fontFamily.bold, fontSize: 13 },
    choiceCard: {
        backgroundColor: 'rgba(255,255,255,0.91)', borderRadius: 24, padding: 14, marginBottom: 16,
        shadowColor: '#684A62', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.07, shadowRadius: 14, elevation: 2,
    },
    choiceHeading: {
        minHeight: 104, alignItems: 'flex-start', justifyContent: 'flex-start',
        paddingHorizontal: 14, paddingTop: 27, paddingBottom: 14,
        backgroundColor: '#8F204D', borderRadius: 18, borderWidth: 1,
    },
    choiceIndex: {
        position: 'absolute', left: -8, top: -12, width: 34, height: 34, borderRadius: 17,
        backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#8F204D', alignItems: 'center', justifyContent: 'center',
    },
    choiceIndexText: { color: '#8F204D', fontFamily: fontFamily.extraBold, fontSize: 15 },
    choicePrompt: { color: '#FFFFFF', fontFamily: fontFamily.extraBold, fontSize: 18, lineHeight: 23, textAlign: 'left' },
    choiceColumns: { flexDirection: 'row', gap: 8, marginTop: 18 },
    choiceOption: { flex: 1, borderRadius: 18, minHeight: 130, alignItems: 'center', padding: 12, borderWidth: 1 },
    choiceOptionLeft: { backgroundColor: '#EAF9F7', borderColor: '#CBECE8' },
    choiceOptionRight: { backgroundColor: '#FFF0F6', borderColor: '#F8CDDD' },
    choiceLabel: { fontFamily: fontFamily.extraBold, fontSize: 16, textAlign: 'center' },
    choiceAvatars: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 },
    choicePerson: { alignItems: 'center' },
    choicePersonName: { color: '#321B3B', fontFamily: fontFamily.bold, fontSize: 11, marginTop: 2, maxWidth: 60 },
    choiceResult: { alignSelf: 'center', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 7, marginTop: 12 },
    choiceResultSame: { backgroundColor: '#E5FAF5' },
    choiceResultDifferent: { backgroundColor: '#FFF0E8' },
    choiceResultText: { fontFamily: fontFamily.bold, fontSize: 13 },
    choiceResultTextDifferent: { color: '#9A4D34' },
    emptyCard: { backgroundColor: 'rgba(255,255,255,0.82)', padding: 34, borderRadius: 24, alignItems: 'center' },
    emptyEmoji: { color: '#D9678D', fontSize: 34 },
    emptyText: { color: '#725C7D', fontFamily: fontFamily.bold, fontSize: 16, marginTop: 8 },
    footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 18, paddingTop: 8, backgroundColor: 'transparent' },
    footerButton: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
    footerText: { color: '#FFFFFF', fontFamily: fontFamily.bold, fontSize: 17 },
});
