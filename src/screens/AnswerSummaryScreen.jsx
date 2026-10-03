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
    Lock,
    Bell,
    Sparkles,
    MessageCircle,
    Check,
    X,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';

import { ChatInput } from '../components/chat';
import {
    ANSWER_FORMAT_THEME, SUMMARY_GRADIENT, Avatar, ConversationRow, SliderRow,
} from '../components/questions/QuestionAnswerSummary';
import { colors, spacing } from '../theme';
import { fontFamily } from '../constants/fonts';
import { getCoupleAnswers } from '../utils/answerApi';
import { API_BASE } from '../constants/Api';
import { apiFetch } from '../utils/apiFetch';
import { translateUiText, translateUiTemplate, getUiLocale } from '../i18n/uiTranslation';
import { formatDisplayDate, isToday } from '../utils/dateUtils';

const hasAnswer = value => value !== null && value !== undefined && String(value).trim().length > 0;

export default function AnswerSummaryScreen({
    date,
    userId,
    partnerName = 'Partner',
    userName = 'You',
    userAvatar = null,
    partnerAvatar = null,
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

    const summaryChatId = data.chat?._id;

    useEffect(() => {
        if (loading || !summaryChatId || !userId) return;

        const markChatRead = async () => {
            try {
                const response = await apiFetch(`${API_BASE}/api/chat/${summaryChatId}/read`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId }),
                });
                const result = await response.json();
                if (!result.success) {
                    throw new Error(result.message || 'Failed to mark ritual chat as read');
                }
            } catch (error) {
                console.warn('Failed to mark ritual chat as read:', error);
            }
        };

        markChatRead();
    }, [loading, summaryChatId, userId]);

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
        const text = (typeof customText === 'string' ? customText : '').trim();
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

    const userComplete = !!(data.user?.isComplete || (userAnswers.length > 0 && userAnswers.filter(a => hasAnswer(a?.value)).length >= (tasks.length || 5)));
    const partnerComplete = !!(data.partner?.isComplete || (partnerAnswers.length > 0 && partnerAnswers.filter(a => hasAnswer(a?.value)).length >= (tasks.length || 5)));
    const bothComplete = !!data.bothComplete || (userComplete && partnerComplete);

    const comparisons = tasks.map((task, index) => {
        const uAns = userAnswers[index];
        const pAns = partnerAnswers[index];

        const userVal = uAns?.value ?? null;
        const partnerVal = pAns?.value ?? null;

        let isMatch = false;
        let matchLabel = 'Match!';

        if (hasAnswer(userVal) && hasAnswer(partnerVal) && bothComplete) {
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
            } else if (task.category === 'likelyto') {
                const userChoice = String(userVal).trim().toLowerCase();
                const partnerChoice = String(partnerVal).trim().toLowerCase();
                // Choices are relative to the answerer: opposite words pick the same person.
                isMatch = ['you', 'partner'].includes(userChoice)
                    && ['you', 'partner'].includes(partnerChoice)
                    && userChoice !== partnerChoice;
            } else if (task.category === 'neverhaveiever') {
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

    const effectiveUserName = data.user?.userId?.name || userName;
    const effectiveUserAvatar = data.user?.userId?.avatar || userAvatar;
    const effectivePartnerAvatar = data.partner?.userId?.avatar || partnerAvatar;
    const openPhoto = (uri, isUser) => setPreviewImage({
        uri,
        title: isUser ? translateUiText('Your Photo') : translateUiTemplate("{{0}}'s Photo", [partnerName]),
    });
    const inputBottomPadding = keyboardVisible ? 8 : Math.max(bottomInset, 10);

    return (
        <LinearGradient {...SUMMARY_GRADIENT} style={styles.container}>
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
                style={styles.container}
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
                        style={styles.container}
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
                                            {translateUiText("You and your partner unlocked all answers!")}
                                        </Text>
                                    </>
                                ) : !userComplete ? (
                                    <>
                                        <View style={styles.statusHeader}>
                                            <View style={styles.statusIconWrapAction}>
                                                <Sparkles size={16} color="#E11D48" />
                                            </View>
                                            <Text style={[styles.statusTitle, styles.statusTitleAction]}>
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
                                            <Text style={[styles.statusTitle, styles.statusTitlePending]}>
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

                        {comparisons.map((item, idx) => {
                            const Row = item.category === 'slider' ? SliderRow : ConversationRow;
                            const theme = ANSWER_FORMAT_THEME[item.category] || ANSWER_FORMAT_THEME.deep;
                            const summaryItem = {
                                ...item.task,
                                questionId: item.task?._id || `ritual-${idx}`,
                                prompt: item.task?.taskstatement || item.task?.prompt,
                                userAnswer: item.userVal,
                                partnerAnswer: bothComplete ? item.partnerVal : null,
                                userType: item.userType,
                                partnerType: item.partnerType,
                                chatId: data.chat?._id,
                                minLabel: item.task?.minLabel || translateUiText('Not at all'),
                                maxLabel: item.task?.maxLabel || translateUiText('Absolutely'),
                            };
                            return (
                                <Row
                                    key={`comp_${idx}`}
                                    item={summaryItem}
                                    index={idx}
                                    format={item.category}
                                    theme={theme}
                                    userName={effectiveUserName}
                                    partnerName={partnerName}
                                    userAvatar={effectiveUserAvatar}
                                    partnerAvatar={effectivePartnerAvatar}
                                    partnerLocked={!bothComplete}
                                    partnerPendingLabel={bothComplete ? undefined : partnerComplete ? 'Answer to reveal' : 'Waiting for partner response...'}
                                    onAnswer={onStartDailyChallenge}
                                    onOpenPhoto={openPhoto}
                                />
                            );
                        })}

                        {/* Discussion Section */}
                        <View style={styles.discussionSection}>
                            <View style={styles.discussionInner}>
                                <View style={styles.discussionHeader}>
                                    <MessageCircle size={18} color="#D32764" />
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
                                                    {!isMe && <Avatar uri={msg.senderId?.avatar || effectivePartnerAvatar} name={partnerName} size={32} />}
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
                                                    {isMe && <Avatar uri={effectiveUserAvatar} name={effectiveUserName} size={32} />}
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
                            { paddingBottom: inputBottomPadding },
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
        </LinearGradient>
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
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerInfo: {
        flex: 1,
        marginLeft: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
        fontFamily: fontFamily.extraBold,
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
        paddingHorizontal: 18,
        paddingTop: spacing.md,
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
    statusTitleAction: { color: '#E11D48' },
    statusTitlePending: { color: '#BE185D' },
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
        marginTop: spacing.sm,
        paddingHorizontal: 2,
        paddingBottom: 20,
    },
    discussionInner: { paddingVertical: spacing.md },
    discussionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: spacing.sm,
    },
    discussionTitle: {
        fontSize: 17,
        fontFamily: fontFamily.extraBold,
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
        alignItems: 'flex-end',
        gap: 8,
        marginBottom: 8,
    },
    commentRowMe: {
        justifyContent: 'flex-end',
        paddingLeft: 40,
    },
    commentRowPartner: {
        justifyContent: 'flex-start',
        paddingRight: 40,
    },
    commentBubble: {
        maxWidth: '82%',
        flexShrink: 1,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 18,
        borderWidth: 1,
    },
    commentBubbleMe: {
        backgroundColor: '#F0B8CE',
        borderColor: '#DB88A8',
        borderBottomRightRadius: 4,
    },
    commentBubblePartner: {
        backgroundColor: '#E8DCF3',
        borderColor: '#D4BFE5',
        borderBottomLeftRadius: 4,
    },
    commentText: {
        fontFamily: fontFamily.bold,
        fontSize: 15,
        lineHeight: 22,
    },
    commentTextMe: {
        color: '#281330',
    },
    commentTextPartner: {
        color: '#281330',
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
        color: '#776582',
    },
    commentTimePartner: {
        color: '#776582',
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
