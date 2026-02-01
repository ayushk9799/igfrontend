import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Animated,
    Platform,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, spacing } from '../../theme';

// Plus icon
const PlusIcon = ({ size = 24, color = '#8E8E93' }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
            d="M12 5V19M5 12H19"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
        />
    </Svg>
);

// Microphone icon
const MicIcon = ({ size = 24, color = '#8E8E93' }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
            d="M12 1C10.34 1 9 2.34 9 4V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V4C15 2.34 13.66 1 12 1Z"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <Path
            d="M19 10V12C19 15.866 15.866 19 12 19C8.13401 19 5 15.866 5 12V10"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <Path
            d="M12 19V23M8 23H16"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </Svg>
);

// Send arrow icon - pointing up
const SendIcon = ({ size = 18, color = '#FFFFFF' }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
            d="M12 19V5M5 12L12 5L19 12"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </Svg>
);

/**
 * ChatInput - Message input component matching the design screenshot
 * Floating pill style with glass morphism effect
 */
const ChatInput = ({
    onSend,
    onTyping,
    placeholder = 'Message...',
    maxLength = 2000,
    disabled = false,
    partnerName = 'Partner',
}) => {
    const [message, setMessage] = useState('');
    const [inputHeight, setInputHeight] = useState(44);
    const sendButtonScale = useRef(new Animated.Value(1)).current;
    const typingTimeout = useRef(null);

    const canSend = message.trim().length > 0 && !disabled;

    useEffect(() => {
        return () => {
            if (typingTimeout.current) {
                clearTimeout(typingTimeout.current);
            }
        };
    }, []);

    const handleChangeText = (text) => {
        setMessage(text);

        if (onTyping) {
            onTyping(true);

            if (typingTimeout.current) {
                clearTimeout(typingTimeout.current);
            }

            typingTimeout.current = setTimeout(() => {
                onTyping(false);
            }, 2000);
        }
    };

    const handleSend = () => {
        if (!canSend) return;

        const trimmedMessage = message.trim();
        if (trimmedMessage) {
            Animated.sequence([
                Animated.timing(sendButtonScale, {
                    toValue: 0.85,
                    duration: 50,
                    useNativeDriver: true,
                }),
                Animated.timing(sendButtonScale, {
                    toValue: 1,
                    duration: 100,
                    useNativeDriver: true,
                }),
            ]).start();

            onSend(trimmedMessage);
            setMessage('');
            setInputHeight(44);

            if (onTyping) {
                onTyping(false);
                if (typingTimeout.current) {
                    clearTimeout(typingTimeout.current);
                }
            }
        }
    };

    const handleContentSizeChange = (event) => {
        const height = event.nativeEvent.contentSize.height;
        const newHeight = Math.min(Math.max(44, height + 16), 120);
        setInputHeight(newHeight);
    };

    return (
        <View style={styles.wrapper}>
            <View style={styles.container}>
                {/* Plus button */}
                <TouchableOpacity style={styles.plusButton} activeOpacity={0.6}>
                    <PlusIcon size={22} color="#6B7280" />
                </TouchableOpacity>

                {/* Microphone button */}
               

                {/* Input field */}
                <View style={styles.inputContainer}>
                    <TextInput
                        style={[styles.input, { height: Math.max(40, inputHeight - 8) }]}
                        value={message}
                        onChangeText={handleChangeText}
                        placeholder={`Message ${partnerName}...`}
                        placeholderTextColor="#9CA3AF"
                        multiline
                        maxLength={maxLength}
                        onContentSizeChange={handleContentSizeChange}
                        editable={!disabled}
                        returnKeyType="default"
                        blurOnSubmit={false}
                    />
                </View>

                {/* Send button */}
                <Animated.View style={[
                    styles.sendButtonWrapper,
                    { transform: [{ scale: sendButtonScale }] }
                ]}>
                    <TouchableOpacity
                        style={[
                            styles.sendButton,
                            canSend ? styles.sendButtonActive : styles.sendButtonDisabled
                        ]}
                        onPress={handleSend}
                        disabled={!canSend}
                        activeOpacity={0.8}
                    >
                        <SendIcon size={18} color={canSend ? '#FFFFFF' : '#9CA3AF'} />
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: 'transparent',
    },
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: 50,
        paddingHorizontal: 8,
        paddingVertical: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 15,
        elevation: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.5)',
    },
    plusButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    micButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 4,
    },
    inputContainer: {
        flex: 1,
        marginHorizontal: 8,
    },
    input: {
        fontSize: 16,
        color: '#374151',
        paddingVertical: Platform.OS === 'ios' ? 10 : 6,
        lineHeight: 20,
    },
    sendButtonWrapper: {
        marginLeft: 4,
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonActive: {
        backgroundColor: '#9B8AFB',
    },
    sendButtonDisabled: {
        backgroundColor: '#D1D5DB',
    },
});

export default ChatInput;

