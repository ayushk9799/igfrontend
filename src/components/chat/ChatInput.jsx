import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Animated,
    Platform,
    Keyboard,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, spacing } from '../../theme';
import { translateUiTemplate, translateUiText } from '../../i18n/uiTranslation';

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
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const inputRef = useRef(null);
    const sendButtonScale = useRef(new Animated.Value(1)).current;
    const typingTimeout = useRef(null);

    const canSend = message.trim().length > 0 && !disabled;

    // Track keyboard visibility
    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
        const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

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
            inputRef.current?.clear();
            setMessage('');

            if (onTyping) {
                onTyping(false);
                if (typingTimeout.current) {
                    clearTimeout(typingTimeout.current);
                }
            }
        }
    };

    return (
        <View style={[styles.wrapper, keyboardVisible && Platform.OS === 'ios' && styles.wrapperKeyboardActive]}>
            <View style={styles.container}>
                {/* Input field */}
                <View style={styles.inputContainer}>
                    <TextInput
                        ref={inputRef}
                        style={styles.input}
                        value={message}
                        onChangeText={handleChangeText}
                        placeholder={translateUiTemplate("Message {{0}}...", [partnerName])}
                        placeholderTextColor={colors.textMuted}
                        multiline
                        maxLength={maxLength}
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
                        <SendIcon size={18} color={canSend ? '#FFFFFF' : colors.textLight} />
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        paddingHorizontal: 16,
        paddingVertical: 0,
        backgroundColor: 'transparent',
        marginBottom: Platform.OS === 'android' ? 8 : 0,
    },
    wrapperKeyboardActive: {
        marginBottom: 0,
    },
    container: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        backgroundColor: '#FFFFFF',
        borderRadius: 26,
        paddingHorizontal: 12,
        paddingVertical: 6,
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 0,
        borderWidth: 1.5,
        borderColor: '#FAE8FF',
        minHeight: 52,
    },
    inputContainer: {
        flex: 1,
        marginHorizontal: 8,
        justifyContent: 'center',
        minHeight: 38,
    },
    input: {
        fontSize: 16,
        color: colors.text,
        minHeight: 38,
        maxHeight: 100,
        paddingTop: Platform.OS === 'ios' ? 8 : 6,
        paddingBottom: Platform.OS === 'ios' ? 8 : 6,
        paddingHorizontal: 0,
        lineHeight: 20,
        textAlignVertical: 'center',
    },
    sendButtonWrapper: {
        marginLeft: 4,
        marginBottom: 1,
    },
    sendButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonActive: {
        backgroundColor: colors.primary,
    },
    sendButtonDisabled: {
        backgroundColor: '#F7EEFA',
    },
});

export default ChatInput;
