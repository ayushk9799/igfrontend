import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';

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
    const messageContent = message?.content || message?.text || '';

    // Don't render if there's no content
    if (!messageContent && message?.answerType !== 'photo') {
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
                <View style={styles.bubbleContent}>
                    {message.messageType === 'answer' && (
                        <Text style={styles.answerLabel}>
                            {isSent ? 'YOUR ANSWER' : `${senderName.toUpperCase()}'S ANSWER`}
                        </Text>
                    )}
                    {message.answerType === 'photo' ? (
                        <Image
                            source={{ uri: messageContent }}
                            style={styles.messageImage}
                            resizeMode="cover"
                        />
                    ) : (
                        <Text style={styles.messageText}>{messageContent}</Text>
                    )}
                </View>
            </View>

            {/* Timestamp and read receipt */}
            <View style={[styles.metaRow, isSent ? styles.metaRowSent : styles.metaRowReceived]}>
                {isSent ? (
                    <View style={styles.readReceiptContainer}>
                        <Text style={styles.metaText}>
                            {isRead ? 'Read now!' : formatTime(message.createdAt)}
                        </Text>
                        {isRead && <DoubleCheck color="#007AFF" size={12} />}
                    </View>
                ) : (
                    <Text style={styles.metaText}>{formatTime(message.createdAt)}</Text>
                )}
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
        marginTop: 4,
        paddingHorizontal: 4,
    },
    metaRowSent: {
        justifyContent: 'flex-end',
    },
    metaRowReceived: {
        justifyContent: 'flex-start',
    },
    readReceiptContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        fontSize: 10,
        color: '#6B7280',
    },
    messageImage: {
        width: 200,
        height: 200,
        borderRadius: 12,
    },
});

export default ChatBubble;

