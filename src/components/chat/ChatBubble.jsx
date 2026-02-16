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
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    // Get the message content
    let messageContent = message?.content || message?.text || '';

    // For likelyto answers, transform "you"/"partner" to "Me" or "You" for display
    if (message?.messageType === 'answer' && questionCategory === 'likelyto' && messageContent) {
        if (messageContent === 'you') {
            messageContent = 'Me';
        } else if (messageContent === 'partner') {
            messageContent = 'You';
        }
    }

    // Don't render if there's no content (but allow photo and voice which use content as URI)
    if (!messageContent && !['photo', 'voice'].includes(message?.answerType)) {
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
                    message.answerType === 'photo' && styles.bubbleContentPhoto
                ]}>
                    {message.messageType === 'answer' && (
                        <Text style={[
                            styles.answerLabel,
                            message.answerType === 'photo' && styles.answerLabelPhoto
                        ]}>
                            {isSent ? 'YOUR ANSWER' : `${senderName.toUpperCase()}'S ANSWER`}
                        </Text>
                    )}
                    {message.answerType === 'voice' ? (
                        <>
                            <VoiceBubble audioUri={messageContent} isSent={isSent} />
                            <View style={styles.metaRow}>
                                <Text style={styles.metaText}>{formatTime(message.createdAt)}</Text>
                                {isSent && isRead && <DoubleCheck color="#007AFF" size={12} />}
                            </View>
                        </>
                    ) : message.answerType === 'photo' ? (
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
                                {/* Invisible spacer to reserve space for time+tick */}
                                <Text style={styles.metaSpacer}>
                                    {'  ' + formatTime(message.createdAt) + (isSent && isRead ? ' ✓✓' : '  ')}
                                </Text>
                            </Text>
                            {/* Absolutely positioned time + tick */}
                            <View style={styles.metaAbsolute}>
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
        elevation: 2,
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
        position: 'relative',
    },
    metaSpacer: {
        fontSize: 10,
        color: 'transparent',
    },
    metaAbsolute: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
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

