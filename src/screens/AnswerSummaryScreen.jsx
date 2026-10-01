import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Image,
    Platform,
    Modal,
    StatusBar,
    Keyboard,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {
    ChevronLeft,
    Send,
    Lock,
    Bell,
    Heart,
    Sparkles,
    MessageCircle,
    Check,
    X,
    Maximize2,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';

import GradientBackground from '../components/GradientBackground';
import { ChatInput, VoiceBubble } from '../components/chat';
import { colors, spacing, borderRadius } from '../theme';
import { fontFamily } from '../constants/fonts';
import { getCoupleAnswers } from '../utils/answerApi';
import { API_BASE } from '../constants/Api';
import { apiFetch } from '../utils/apiFetch';
import { translateUiText, translateUiTemplate, getUiLocale } from '../i18n/uiTranslation';
import { formatDisplayDate, isToday } from '../utils/dateUtils';

const categoryConfig = {
    likelyto: { emoji: '⚖️', color: '#E11D48', gradient: ['#FF758F', '#FDA4AF'], label: 'Most Likely To' },
    neverhaveiever: { emoji: '🤫', color: '#EA580C', gradient: ['#FB923C', '#FDBA74'], label: 'Never Have I Ever' },
    deep: { emoji: '💭', color: '#7C3AED', gradient: ['#A855F7', '#C084FC'], label: 'Deep Talk' },
    slider: { emoji: '📏', color: '#2563EB', gradient: ['#3B82F6', '#93C5FD'], label: 'Slider' },
    voicerecord: { emoji: '🎙️', color: '#059669', gradient: ['#10B981', '#6EE7B7'], label: 'Voice Notes' },
    takephoto: { emoji: '📸', color: '#DB2777', gradient: ['#F43F5E', '#FB7185'], label: 'Photo Moment' },
};

export default function AnswerSummaryScreen({
    date,
    userId,
    partnerName = 'Partner',
    challengeTitle,
    onBack = () => { },
    onOpenFullChat,
    onStartDailyChallenge,
}) {
    const insets = useSafeAreaInsets();
    const bottomInset = Math.max(insets.bottom, 12);
    const effectiveDate = date || new Date().toISOString().split('T')[0];
    const [data, setData] = useState({
        challenge: null,
        user: null,
        partner: null,
        bothComplete: false,
        chat: null,
    });
    const [loading, setLoading] = useState(true);
    const [reminding, setReminding] = useState(false);
    const [reminderSent, setReminderSent] = useState(false);
    const [commentText, setCommentText] = useState('');
    const [sendingComment, setSendingComment] = useState(false);
    const [chatMessages, setChatMessages] = useState([]);
    const [previewImage, setPreviewImage] = useState(null);
    const scrollRef = useRef(null);

    const fetchAnswers = useCallback(async () => {
        try {
            setLoading(true);
            const result = await getCoupleAnswers(effectiveDate, userId);
            if (result.success && result.data) {
                setData(result.data);
                if (result.data.chat?.messages) {
                    // Extract non-answer comments for discussion
                    const comments = result.data.chat.messages.filter(m => m.messageType !== 'answer');
                    setChatMessages(comments);
                }
            }
        } catch (error) {
            console.error('Failed to fetch couple answers:', error);
        } finally {
            setLoading(false);
        }
    }, [effectiveDate, userId]);

    useEffect(() => {
        fetchAnswers();
    }, [fetchAnswers]);

    const hasInitialScrolledRef = useRef(false);

    const formatMessageTime = useCallback((dateString) => {
        if (!dateString) return '';
        try {
            const d = new Date(dateString);
            if (isNaN(d.getTime())) return '';
            return d.toLocaleTimeString(getUiLocale(), {
                hour: 'numeric',
                minute: '2-digit',
            });
        } catch (e) {
            return '';
        }
    }, []);

    // Auto-scroll to bottom so latest chat is visible when chats exist
    useEffect(() => {
        if (!loading && chatMessages.length > 0) {
            const timer = setTimeout(() => {
                scrollRef.current?.scrollToEnd({ animated: hasInitialScrolledRef.current });
                hasInitialScrolledRef.current = true;
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [loading, chatMessages.length]);

    const [keyboardVisible, setKeyboardVisible] = useState(false);

    // Keep bottom visible when keyboard opens & track keyboard state
    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showSub = Keyboard.addListener(showEvent, () => {
            setKeyboardVisible(true);
            if (chatMessages.length > 0) {
                setTimeout(() => {
                    scrollRef.current?.scrollToEnd({ animated: true });
                }, 100);
            }
        });
        const hideSub = Keyboard.addListener(hideEvent, () => {
            setKeyboardVisible(false);
        });

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, [chatMessages.length]);

    const handleRemindPartner = async () => {
        if (reminding || reminderSent) return;
        try {
            setReminding(true);
            try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (e) { }

            const res = await apiFetch(`${API_BASE}/api/daily-challenge/remind`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
            });
            const json = await res.json();
            if (json.success) {
                setReminderSent(true);
            }
        } catch (error) {
            console.error('Failed to send reminder:', error);
        } finally {
            setReminding(false);
        }
    };

    const handleSendComment = async (customText) => {
        const text = (typeof customText === 'string' ? customText : commentText).trim();
        if (!text || sendingComment) return;
        setSendingComment(true);

        const optimisticMessage = {
            _id: `temp_${Date.now()}`,
            senderId: userId,
            content: text,
            messageType: 'text',
            createdAt: new Date().toISOString(),
        };
        setChatMessages(prev => [...prev, optimisticMessage]);

        try {
            try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) { }

            let chatId = data.chat?._id;
            if (!chatId) {
                // Create or initialize unified chat thread if not yet created
                const res = await apiFetch(`${API_BASE}/api/chat/answer`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId,
                        questionSource: 'dailychallenge',
                        challengeId: data.challenge?._id,
                        challengeTitle: data.challenge?.title || 'Daily Ritual',
                        answer: text,
                        answerType: 'text',
                    }),
                });
                const resData = await res.json();
                if (resData?.data?._id) {
                    setData(prev => ({ ...prev, chat: resData.data }));
                }
            } else {
                await apiFetch(`${API_BASE}/api/chat/${chatId}/message`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId,
                        content: text,
                        messageType: 'text',
                    }),
                });
            }
            setTimeout(() => {
                scrollRef.current?.scrollToEnd({ animated: true });
            }, 100);
        } catch (error) {
            console.error('Failed to send comment:', error);
        } finally {
            setSendingComment(false);
        }
    };

    // Calculate match pairs & completion status
    const tasks = data.challenge?.tasks || [];
    const userAnswers = data.user?.answers || [];
    const partnerAnswers = data.partner?.answers || [];

    const userComplete = !!(data.user?.isComplete || (userAnswers.length > 0 && userAnswers.filter(a => a?.value).length >= (tasks.length || 5)));
    const partnerComplete = !!(data.partner?.isComplete || (partnerAnswers.length > 0 && partnerAnswers.filter(a => a?.value).length >= (tasks.length || 5)));
    const bothComplete = !!data.bothComplete || (userComplete && partnerComplete);

    const comparisons = tasks.map((task, index) => {
        const uAns = userAnswers[index];
        const pAns = partnerAnswers[index];

        const userVal = uAns?.value || null;
        const partnerVal = pAns?.value || null;

        let isMatch = false;
        let matchLabel = 'Match!';

        if (userVal && partnerVal && bothComplete) {
            if (task.category === 'slider') {
                const uNum = Number(userVal);
                const pNum = Number(partnerVal);
                if (!isNaN(uNum) && !isNaN(pNum)) {
                    if (uNum === pNum) {
                        isMatch = true;
                        matchLabel = 'Exact Match!';
                    } else if (Math.abs(uNum - pNum) <= 1) {
                        isMatch = true;
                        matchLabel = 'Super Close!';
                    }
                }
            } else if (task.category === 'likelyto' || task.category === 'neverhaveiever') {
                if (String(userVal).trim().toLowerCase() === String(partnerVal).trim().toLowerCase()) {
                    isMatch = true;
                }
            } else if (task.category === 'deep') {
                if (String(userVal).trim().toLowerCase() === String(partnerVal).trim().toLowerCase() && userVal.length > 0) {
                    isMatch = true;
                }
            }
        }

        return {
            index,
            task,
            userVal,
            userType: uAns?.answerType || 'text',
            partnerVal,
            partnerType: pAns?.answerType || 'text',
            category: task.category,
            isMatch,
            matchLabel,
        };
    });

    const totalMatches = comparisons.filter(c => c.isMatch).length;
    const titleText = translateUiText('Daily Ritual');

    const formattedSubtitle = (() => {
        try {
            const formatted = formatDisplayDate(effectiveDate);
            if (isToday(effectiveDate)) {
                return `${translateUiText('Today')} • ${formatted}`;
            }
            return formatted;
        } catch (e) {
            return effectiveDate;
        }
    })();

    const renderAnswerBubble = (value, type, category, isUser = true) => {
        if (!value) {
            return (
                <View style={styles.emptyBubble}>
                    <Text style={styles.emptyBubbleText}>—</Text>
                </View>
            );
        }

        if (category === 'voicerecord' || type === 'voice') {
            return (
                <View style={[styles.voiceWrapper, isUser ? styles.voiceWrapperUser : styles.voiceWrapperPartner]}>
                    <VoiceBubble
                        audioUri={value}
                        isSent={isUser}
                        compact={true}
                        accentColor={isUser ? '#BE185D' : '#6D28D9'}
                        style={styles.voiceBubbleInner}
                    />
                </View>
            );
        }

        if (category === 'takephoto' || type === 'photo') {
            const authorTitle = isUser
                ? translateUiText('Your Photo')
                : translateUiTemplate("{{0}}'s Photo", [partnerName]);
            return (
                <TouchableOpacity
                    activeOpacity={0.88}
                    onPress={() => setPreviewImage({ uri: value, title: authorTitle })}
                    style={styles.photoAnswerContainer}
                >
                    <Image source={{ uri: value }} style={styles.photoAnswer} resizeMode="cover" />
                    <View style={styles.photoZoomBadge}>
                        <Maximize2 size={11} color="#FFFFFF" />
                    </View>
                </TouchableOpacity>
            );
        }

        // Likely To formatting
        let displayVal = value;
        if (category === 'likelyto') {
            if (value.toLowerCase() === 'you') displayVal = isUser ? 'You' : partnerName;
            else if (value.toLowerCase() === 'partner') displayVal = isUser ? partnerName : 'You';
        }

        return (
            <View style={[styles.textBubble, isUser ? styles.userBubble : styles.partnerBubble]}>
                <Text style={[styles.bubbleText, isUser ? styles.userBubbleText : styles.partnerBubbleText]}>
                    {displayVal}
                </Text>
            </View>
        );
    };

    return (
        <GradientBackground variant="light" showOrbs={false}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.7}>
                    <ChevronLeft size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle} numberOfLines={1}>{titleText}</Text>
                    <Text style={styles.headerSubtitle}>{formattedSubtitle}</Text>
                </View>
                {data.chat && onOpenFullChat && (
                    <TouchableOpacity
                        onPress={() => onOpenFullChat(data.chat)}
                        style={styles.chatIconBtn}
                        activeOpacity={0.7}
                    >
                        <MessageCircle size={20} color={colors.primary} />
                    </TouchableOpacity>
                )}
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={0}
            >

                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.loadingText}>{translateUiText('Loading answers...')}</Text>
                    </View>
                ) : (
                    <ScrollView
                        ref={scrollRef}
                        style={{ flex: 1 }}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        onContentSizeChange={() => {
                            if (!hasInitialScrolledRef.current && chatMessages.length > 0) {
                                hasInitialScrolledRef.current = true;
                                scrollRef.current?.scrollToEnd({ animated: false });
                            }
                        }}
                    >
                        {/* Status Hero Card */}
                        <View style={styles.statusHero}>
                            <LinearGradient
                                colors={bothComplete ? ['#FF758F', '#C084FC'] : !userComplete ? ['#FF758F', '#FDA4AF'] : ['#F43F5E', '#FB7185']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.cardAccentStripe}
                            />
                            <View style={styles.cardInner}>
                                {bothComplete ? (
                                    <>
                                        <View style={styles.statusHeader}>
                                            <View style={styles.statusIconWrap}>
                                                <Sparkles size={18} color="#D62F68" />
                                            </View>
                                            <Text style={styles.statusTitle}>
                                                {totalMatches > 0
                                                    ? `${totalMatches} of ${comparisons.length} ${translateUiText('Matches!')} 💕`
                                                    : translateUiText('Both Completed Today!')}
                                            </Text>
                                        </View>
                                        <Text style={styles.statusSubtext}>
                                            {translateUiText("You and your partner unlocked all answers! Tap cards to compare.")}
                                        </Text>
                                    </>
                                ) : !userComplete ? (
                                    <>
                                        <View style={styles.statusHeader}>
                                            <View style={styles.statusIconWrapAction}>
                                                <Sparkles size={16} color="#E11D48" />
                                            </View>
                                            <Text style={[styles.statusTitle, { color: '#E11D48' }]}>
                                                {partnerComplete
                                                    ? translateUiTemplate("{{0}} has answered today! 💕", [partnerName])
                                                    : translateUiText("Today's Ritual is Ready! 🌟")}
                                            </Text>
                                        </View>
                                        <Text style={styles.statusSubtext}>
                                            {partnerComplete
                                                ? translateUiTemplate("Complete today's 5 questions to unlock {{0}}'s answers and see your matches.", [partnerName])
                                                : translateUiTemplate("Answer today's 5 questions to compare notes with {{0}}.", [partnerName])}
                                        </Text>
                                        {onStartDailyChallenge && (
                                            <TouchableOpacity
                                                style={styles.answerNowButton}
                                                onPress={onStartDailyChallenge}
                                                activeOpacity={0.8}
                                            >
                                                <Text style={styles.answerNowButtonText}>
                                                    {translateUiText("Answer Today's Questions ➔")}
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <View style={styles.statusHeader}>
                                            <View style={styles.statusIconWrapPending}>
                                                <Lock size={16} color="#BE185D" />
                                            </View>
                                            <Text style={[styles.statusTitle, { color: '#BE185D' }]}>
                                                {translateUiTemplate("Waiting for {{0}} to answer", [partnerName])}
                                            </Text>
                                        </View>
                                        <Text style={styles.statusSubtext}>
                                            {translateUiText("Your partner's answers remain hidden until both of you complete today's ritual.")}
                                        </Text>
                                        <TouchableOpacity
                                            style={[styles.remindButton, reminderSent && styles.remindButtonSent]}
                                            onPress={handleRemindPartner}
                                            disabled={reminding || reminderSent}
                                            activeOpacity={0.8}
                                        >
                                            {reminderSent ? (
                                                <>
                                                    <Check size={16} color="#FFFFFF" />
                                                    <Text style={styles.remindButtonText}>{translateUiText('Reminder Sent!')}</Text>
                                                </>
                                            ) : (
                                                <>
                                                    <Bell size={16} color="#FFFFFF" />
                                                    <Text style={styles.remindButtonText}>
                                                        {reminding ? translateUiText('Sending...') : translateUiTemplate('Remind {{0}}', [partnerName])}
                                                    </Text>
                                                </>
                                            )}
                                        </TouchableOpacity>
                                    </>
                                )}
                            </View>
                        </View>

                        {/* Questions & Comparison Cards */}
                        {comparisons.map((item, idx) => {
                            const config = categoryConfig[item.category] || categoryConfig.deep;

                            return (
                                <View key={`comp_${idx}`} style={styles.cardContainer}>
                                    <LinearGradient
                                        colors={config.gradient || [config.color, config.color]}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.cardAccentStripe}
                                    />
                                    <View style={styles.cardInner}>
                                        {/* Category header */}
                                        <View style={styles.cardCategoryRow}>
                                            <View style={[styles.badge, { backgroundColor: config.color + '15' }]}>
                                                <Text style={styles.badgeEmoji}>{config.emoji}</Text>
                                                <Text style={[styles.badgeText, { color: config.color }]}>
                                                    {translateUiText(config.label)}
                                                </Text>
                                            </View>

                                            {item.isMatch && (
                                                <View style={styles.matchBadge}>
                                                    <Sparkles size={12} color="#FFFFFF" />
                                                    <Text style={styles.matchText}>{item.matchLabel}</Text>
                                                </View>
                                            )}
                                        </View>

                                        {/* Question statement */}
                                        <Text style={styles.statementText}>{item.task?.taskstatement}</Text>

                                        {/* Side by side answers on ONE line */}
                                        <View style={styles.comparisonGrid}>
                                            {/* User answer column */}
                                            <View style={styles.answerColumn}>
                                                <Text style={styles.columnLabel}>{translateUiText('You')}</Text>
                                                {renderAnswerBubble(item.userVal, item.userType, item.category, true)}
                                            </View>

                                            <View style={styles.vsSeparator}>
                                                <Text style={styles.vsText}>VS</Text>
                                            </View>

                                            {/* Partner answer column */}
                                            <View style={styles.answerColumn}>
                                                <Text style={styles.columnLabel}>{translateUiText('Partner')}</Text>
                                                {bothComplete ? (
                                                    renderAnswerBubble(item.partnerVal, item.partnerType, item.category, false)
                                                ) : (
                                                    <View style={styles.lockedBubble}>
                                                        <Lock size={15} color="#94A3B8" />
                                                        <Text style={styles.lockedText}>
                                                            {!userComplete ? translateUiText('Answer to reveal') : translateUiText('Hidden')}
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            );
                        })}

                        {/* Discussion Section */}
                        <View style={styles.discussionSection}>
                            <LinearGradient
                                colors={['#C084FC', '#FF758F']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.cardAccentStripe}
                            />
                            <View style={styles.cardInner}>
                                <View style={styles.discussionHeader}>
                                    <MessageCircle size={18} color={colors.primary} />
                                    <Text style={styles.discussionTitle}>{translateUiText('Ritual Discussion')}</Text>
                                </View>

                                {chatMessages.length === 0 ? (
                                    <Text style={styles.noCommentsText}>
                                        {translateUiText('No comments yet. Share your thoughts on today’s ritual below!')}
                                    </Text>
                                ) : (
                                    <View style={styles.commentsList}>
                                        {chatMessages.map((msg, i) => {
                                            const isMe = String(msg.senderId?._id || msg.senderId) === String(userId);
                                            return (
                                                <View
                                                    key={msg._id || `msg_${i}`}
                                                    style={[styles.commentRow, isMe ? styles.commentRowMe : styles.commentRowPartner]}
                                                >
                                                    <View style={[styles.commentBubble, isMe ? styles.commentBubbleMe : styles.commentBubblePartner]}>
                                                        <Text style={[styles.commentText, isMe ? styles.commentTextMe : styles.commentTextPartner]}>
                                                            {msg.content}
                                                        </Text>
                                                        {!!msg.createdAt && (
                                                            <View style={styles.commentMeta}>
                                                                <Text style={[styles.commentTime, isMe ? styles.commentTimeMe : styles.commentTimePartner]}>
                                                                    {formatMessageTime(msg.createdAt)}
                                                                </Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                </View>
                                            );
                                        })}
                                    </View>
                                )}
                            </View>
                        </View>
                    </ScrollView>
                )}

                {/* Full-width Frosted Glass Bottom Bar behind Chat Input */}
                {!loading && (
                    <View
                        style={[
                            styles.bottomBarContainer,
                            { paddingBottom: keyboardVisible ? 8 : Math.max(bottomInset, 10) },
                        ]}
                    >
                        {/* Frosted Glass Background Layer */}
                        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
                            <BlurView
                                intensity={90}
                                tint="light"
                                experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : 'none'}
                                style={StyleSheet.absoluteFillObject}
                            />
                            <View style={styles.bottomBarOverlay} />
                        </View>

                        <ChatInput
                            onSend={handleSendComment}
                            partnerName={partnerName}
                            wrapperStyle={styles.chatInputWrapperOverride}
                        />
                    </View>
                )}
            </KeyboardAvoidingView>

            {/* Fullscreen Photo Viewer Modal */}
            <Modal
                visible={!!previewImage}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setPreviewImage(null)}
                statusBarTranslucent
            >
                <View style={styles.fullImageModalContainer}>
                    <StatusBar barStyle="light-content" backgroundColor="#000000" />
                    {/* Top bar with caption & close button */}
                    <View style={[styles.modalTopBar, { paddingTop: Math.max(insets.top, 24) }]}>
                        <Text style={styles.modalPhotoTitle} numberOfLines={1}>
                            {previewImage?.title || translateUiText('Photo Moment')}
                        </Text>
                        <TouchableOpacity
                            style={styles.modalCloseBtn}
                            onPress={() => setPreviewImage(null)}
                            activeOpacity={0.7}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        >
                            <X size={20} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>

                    {/* Image viewer */}
                    <TouchableOpacity
                        style={styles.modalImageWrapper}
                        activeOpacity={1}
                        onPress={() => setPreviewImage(null)}
                    >
                        {previewImage?.uri && (
                            <Image
                                source={{ uri: previewImage.uri }}
                                style={styles.fullScreenImage}
                                resizeMode="contain"
                            />
                        )}
                    </TouchableOpacity>
                </View>
            </Modal>
        </GradientBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    loadingText: {
        marginTop: spacing.md,
        fontSize: 14,
        color: colors.textSecondary,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: 8,
        backgroundColor: 'transparent',
    },
    backButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#FAE8FF',
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
    },
    headerInfo: {
        flex: 1,
        marginLeft: spacing.md,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
        fontFamily: fontFamily.semiBold,
    },
    headerSubtitle: {
        fontSize: 12,
        color: colors.textSecondary,
        marginTop: 1,
    },
    chatIconBtn: {
        width: 42,
        height: 42,
        borderRadius: 21,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#FAE8FF',
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 2,
    },
    scrollContent: {
        padding: spacing.md,
        paddingBottom: spacing.xl * 2,
    },
    statusHero: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: '#F1E6F3',
        overflow: 'hidden',
        shadowColor: '#BE185D',
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
    },
    cardAccentStripe: {
        height: 4,
        width: '100%',
    },
    cardInner: {
        padding: spacing.md,
    },
    statusIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FFF0F5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    statusIconWrapPending: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FFF0F5',
        justifyContent: 'center',
        alignItems: 'center',
    },
    statusIconWrapAction: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FFE4E6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    statusHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 6,
    },
    statusTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#D62F68',
        fontFamily: fontFamily.bold,
    },
    statusSubtext: {
        fontSize: 13,
        color: colors.textSecondary,
        lineHeight: 18,
    },
    remindButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#E11D48',
        paddingVertical: 9,
        paddingHorizontal: 16,
        borderRadius: 20,
        marginTop: spacing.md,
        alignSelf: 'flex-start',
    },
    remindButtonSent: {
        backgroundColor: '#10B981',
    },
    remindButtonText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    answerNowButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: colors.primary,
        paddingVertical: 9,
        paddingHorizontal: 18,
        borderRadius: 20,
        marginTop: spacing.md,
        alignSelf: 'flex-start',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 2,
    },
    answerNowButtonText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    cardContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: '#F1E6F3',
        overflow: 'hidden',
        shadowColor: '#BE185D',
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
    },
    cardCategoryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.xs,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 12,
        gap: 4,
    },
    badgeEmoji: {
        fontSize: 12,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '700',
    },
    matchBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#10B981',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
    },
    matchText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    statementText: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.text,
        marginVertical: spacing.sm,
        lineHeight: 21,
    },
    comparisonGrid: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: spacing.xs,
        paddingTop: spacing.xs,
        borderTopWidth: 1,
        borderTopColor: '#F8EEF8',
    },
    answerColumn: {
        flex: 1,
        alignItems: 'center',
    },
    columnLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: colors.textSecondary,
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    vsSeparator: {
        paddingHorizontal: 8,
        paddingTop: 24,
    },
    vsText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#CBD5E1',
    },
    textBubble: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: borderRadius.md,
        width: '100%',
        alignItems: 'center',
    },
    userBubble: {
        backgroundColor: '#FFF0F5',
        borderWidth: 1,
        borderColor: '#FBCFE8',
    },
    partnerBubble: {
        backgroundColor: '#F3E8FF',
        borderWidth: 1,
        borderColor: '#E9D5FF',
    },
    bubbleText: {
        fontSize: 13,
        fontWeight: '600',
        textAlign: 'center',
    },
    userBubbleText: {
        color: '#BE185D',
    },
    partnerBubbleText: {
        color: '#6D28D9',
    },
    emptyBubble: {
        padding: 8,
    },
    emptyBubbleText: {
        color: colors.textMuted,
    },
    lockedBubble: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: borderRadius.md,
        paddingVertical: 8,
        paddingHorizontal: 12,
        width: '100%',
    },
    lockedText: {
        fontSize: 12,
        color: '#94A3B8',
        fontWeight: '500',
        fontStyle: 'italic',
    },
    voiceWrapper: {
        width: '100%',
        borderRadius: borderRadius.md,
        paddingHorizontal: 8,
        paddingVertical: 6,
        alignItems: 'stretch',
        justifyContent: 'center',
    },
    voiceWrapperUser: {
        backgroundColor: '#FFF0F5',
        borderWidth: 1,
        borderColor: '#FBCFE8',
    },
    voiceWrapperPartner: {
        backgroundColor: '#F3E8FF',
        borderWidth: 1,
        borderColor: '#E9D5FF',
    },
    voiceBubbleInner: {
        width: '100%',
        minWidth: 0,
    },
    photoAnswerContainer: {
        width: 100,
        height: 100,
        borderRadius: borderRadius.md,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#000000',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    photoAnswer: {
        width: '100%',
        height: '100%',
    },
    photoZoomBadge: {
        position: 'absolute',
        bottom: 6,
        right: 6,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullImageModalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.96)',
        justifyContent: 'space-between',
    },
    modalTopBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 16,
        zIndex: 10,
    },
    modalPhotoTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    modalCloseBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalImageWrapper: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingBottom: 40,
    },
    fullScreenImage: {
        width: '100%',
        height: '100%',
    },
    discussionSection: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        marginTop: spacing.sm,
        borderWidth: 1,
        borderColor: '#F1E6F3',
        overflow: 'hidden',
        shadowColor: '#BE185D',
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
    },
    discussionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: spacing.sm,
    },
    discussionTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: colors.text,
    },
    noCommentsText: {
        fontSize: 13,
        color: colors.textMuted,
        fontStyle: 'italic',
        paddingVertical: spacing.sm,
    },
    commentsList: {
        marginTop: 6,
        gap: 8,
    },
    commentRow: {
        flexDirection: 'row',
        marginBottom: 4,
    },
    commentRowMe: {
        justifyContent: 'flex-end',
    },
    commentRowPartner: {
        justifyContent: 'flex-start',
    },
    commentBubble: {
        maxWidth: '80%',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 16,
    },
    commentBubbleMe: {
        backgroundColor: colors.primary,
        borderBottomRightRadius: 4,
    },
    commentBubblePartner: {
        backgroundColor: '#F1F5F9',
        borderBottomLeftRadius: 4,
    },
    commentText: {
        fontSize: 14,
        lineHeight: 19,
    },
    commentTextMe: {
        color: '#FFFFFF',
    },
    commentTextPartner: {
        color: colors.text,
    },
    commentMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginTop: 3,
    },
    commentTime: {
        fontSize: 10,
        fontWeight: '500',
    },
    commentTimeMe: {
        color: 'rgba(255, 255, 255, 0.72)',
    },
    commentTimePartner: {
        color: '#94A3B8',
    },
    bottomBarContainer: {
        width: '100%',
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: 'rgba(235, 222, 240, 0.8)',
        backgroundColor: Platform.OS === 'android' ? '#FFFFFF' : 'transparent',
        shadowColor: '#1B1237',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 4,
    },
    bottomBarOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: Platform.OS === 'android' ? 'rgba(255, 255, 255, 0.96)' : 'rgba(255, 255, 255, 0.86)',
    },
    chatInputWrapperOverride: {
        paddingHorizontal: 16,
        paddingVertical: 0,
        marginBottom: 0,
    },
});
