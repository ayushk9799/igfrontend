import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import VoiceBubble from './VoiceBubble';
import { getUiLocale, translateUiTemplate, translateUiText } from '../../i18n/uiTranslation';

// Double check icon for read receipts
const DoubleCheck = ({ color = '#007AFF', size = 12 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
            d="M18 7L9.5 15.5L6 12"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <Path
            d="M22 7L13.5 15.5L12 14"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </Svg>
);

/**
 * ChatBubble - Message bubble with gradient background
 * Uses LinearGradient as absolute background to prevent content clipping
 */
const ChatBubble = ({
    message,
    isSent = false,
    showAvatar = true,
    senderName = '',
    senderAvatar = null,
    showTimestamp = true,
    isRead = false,
    questionCategory = null,
}) => {
    const formatTime = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleTimeString(getUiLocale(), {
            hour: 'numeric',
            minute: '2-digit',
        });
    };

    const answerPayload = message?.answerPayload || null;
    const answerType = message?.answerType || answerPayload?.answerType || null;

    // Get the message content. V2 answer chats store the real media URI in answerPayload.answer
    // while content is only the text preview ("Photo", "Voice message", etc.).
    let messageContent = answerType && answerPayload?.answer !== undefined && answerPayload?.answer !== null
        ? answerPayload.answer
        : (message?.content || message?.text || '');

    // For likelyto answers, transform "you"/"partner" to "Me" or "You" for display
    if (message?.messageType === 'answer' && answerType === 'text' && questionCategory === 'likelyto' && messageContent) {
        if (messageContent === 'you') {
            messageContent = 'Me';
        } else if (messageContent === 'partner') {
            messageContent = 'You';
        }
    }

    // Don't render if there's no content (but allow photo and voice which use content as URI)
    if (!messageContent && !['photo', 'voice'].includes(answerType)) {
        return null;
    }

    // Gradient colors from HTML reference
    const sentGradient = ['#E0C3FC', '#CBB4F6'];
    const receivedGradient = ['#F5C6C6', '#FDE3C8'];

    const bubbleStyle = isSent ? styles.sentBubble : styles.receivedBubble;
    const gradientColors = isSent ? sentGradient : receivedGradient;

    return (
        <View style={[styles.wrapper, isSent ? styles.wrapperSent : styles.wrapperReceived]}>
            {/* Bubble with gradient background */}
            <View style={[styles.bubbleOuter, bubbleStyle]}>
                {/* Gradient as absolute background */}
                <LinearGradient
                    colors={gradientColors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[StyleSheet.absoluteFill, bubbleStyle]}
                />
                {/* Content overlay */}
                <View style={[
                    styles.bubbleContent,
                    answerType === 'photo' && styles.bubbleContentPhoto
                ]}>
                    {message.messageType === 'answer' && (
                        <Text style={[
                            styles.answerLabel,
                            answerType === 'photo' && styles.answerLabelPhoto
                        ]}>
                            {isSent ? translateUiText("YOUR ANSWER") : translateUiTemplate("{{0}}'S ANSWER", [senderName.toUpperCase()])}
                        </Text>
                    )}
                    {answerType === 'voice' ? (
                        <>
                            <VoiceBubble audioUri={messageContent} isSent={isSent} />
                            <View style={styles.metaRow}>
                                <Text style={styles.metaText}>{formatTime(message.createdAt)}</Text>
                                {isSent && isRead && <DoubleCheck color="#007AFF" size={12} />}
                            </View>
                        </>
                    ) : answerType === 'photo' ? (
                        <>
                            <Image
                                source={{ uri: messageContent }}
                                style={styles.messageImage}
                                resizeMode="cover"
                            />
                            <View style={styles.metaRow}>
                                <Text style={styles.metaText}>{formatTime(message.createdAt)}</Text>
                                {isSent && isRead && <DoubleCheck color="#007AFF" size={12} />}
                            </View>
                        </>
                    ) : (
                        <View style={styles.textWithMeta}>
                            <Text style={styles.messageText}>
                                {messageContent}
                            </Text>
                            <View style={styles.metaContainer}>
                                <Text style={styles.metaText}>{formatTime(message.createdAt)}</Text>
                                {isSent && isRead && <DoubleCheck color="#007AFF" size={12} />}
                            </View>
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        marginVertical: 4,
        paddingHorizontal: 16,
    },
    wrapperSent: {
        alignItems: 'flex-end',
    },
    wrapperReceived: {
        alignItems: 'flex-start',
    },
    bubbleOuter: {
        maxWidth: '80%',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 0,
    },
    sentBubble: {
        borderRadius: 20,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 4,
    },
    receivedBubble: {
        borderRadius: 20,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderBottomLeftRadius: 4,
        borderBottomRightRadius: 20,
    },
    bubbleContent: {
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    messageText: {
        fontSize: 16,
        color: '#1F2937',
        lineHeight: 22,
    },
    answerLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: 'rgba(31, 41, 55, 0.6)',
        marginBottom: 4,
        letterSpacing: 0.5,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginTop: 4,
        gap: 4,
    },
    metaText: {
        fontSize: 10,
        color: 'rgba(31, 41, 55, 0.5)',
    },
    textWithMeta: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
    },
    metaContainer: {
        marginLeft: 'auto',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingLeft: 8,
        paddingBottom: 2,
    },
    messageImage: {
        width: 220,
        height: 220,
        borderRadius: 12,
    },
    bubbleContentPhoto: {
        paddingHorizontal: 8,
        paddingVertical: 8,
    },
    answerLabelPhoto: {
        marginLeft: 4,
    },
});

export default ChatBubble;
