// Premium Input Component with Focus Glow
import React, { useState, useRef } from 'react';
import {
    StyleSheet,
    TextInput as RNTextInput,
    View,
    Text,
    Animated,
} from 'react-native';
import { colors, borderRadius, spacing, timing } from '../theme';

export const Input = ({
    label = '',
    error = '',
    containerStyle = {},
    variant = 'default',
    leftIcon = null,
    rightIcon = null,
    ...props
}) => {
    const [isFocused, setIsFocused] = useState(false);
    const focusAnim = useRef(new Animated.Value(0)).current;
    const shakeAnim = useRef(new Animated.Value(0)).current;

    const handleFocus = () => {
        setIsFocused(true);
        Animated.spring(focusAnim, {
            toValue: 1,
            useNativeDriver: false,
            ...timing.springBouncy,
        }).start();
    };

    const handleBlur = () => {
        setIsFocused(false);
        Animated.timing(focusAnim, {
            toValue: 0,
            duration: timing.normal,
            useNativeDriver: false,
        }).start();
    };

    // Shake animation for error
    React.useEffect(() => {
        if (error) {
            Animated.sequence([
                Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
                Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
                Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
                Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
            ]).start();
        }
    }, [error, shakeAnim]);

    const borderColor = focusAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [
            error ? colors.error : colors.glassBorder,
            error ? colors.error : colors.primary,
        ],
    });

    const glowOpacity = focusAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.15],
    });

    const getInputBackground = () => {
        switch (variant) {
            case 'glass':
                return colors.glass;
            case 'frosted':
                return colors.frostedPink;
            default:
                return colors.surface;
        }
    };

    return (
        <Animated.View
            style={[
                styles.container,
                containerStyle,
                { transform: [{ translateX: shakeAnim }] },
            ]}
        >
            {label && (
                <Text style={[
                    styles.label,
                    isFocused && styles.labelFocused,
                ]}>
                    {label}
                </Text>
            )}

            <Animated.View
                style={[
                    styles.inputWrapper,
                    {
                        borderColor,
                        backgroundColor: getInputBackground(),
                    },
                ]}
            >
                {/* Focus glow effect */}
                <Animated.View
                    style={[
                        styles.focusGlow,
                        {
                            opacity: glowOpacity,
                            backgroundColor: error ? colors.errorGlow : colors.primaryGlow,
                        },
                    ]}
                />

                {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}

                <RNTextInput
                    style={[
                        styles.input,
                        leftIcon && styles.inputWithLeftIcon,
                        rightIcon && styles.inputWithRightIcon,
                    ]}
                    placeholderTextColor={colors.textMuted}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    selectionColor={colors.primary}
                    {...props}
                />

                {rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}
            </Animated.View>

            {error && (
                <Animated.Text style={styles.error}>
                    {error}
                </Animated.Text>
            )}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: spacing.lg,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: colors.textSecondary,
        marginBottom: spacing.sm,
        letterSpacing: 0.5,
    },
    labelFocused: {
        color: colors.primary,
    },
    inputWrapper: {
        borderRadius: borderRadius.lg,
        borderWidth: 1.5,
        flexDirection: 'row',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden',
    },
    focusGlow: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: colors.text,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md + 2,
        zIndex: 1,
    },
    inputWithLeftIcon: {
        paddingLeft: spacing.sm,
    },
    inputWithRightIcon: {
        paddingRight: spacing.sm,
    },
    leftIcon: {
        paddingLeft: spacing.md,
        zIndex: 1,
    },
    rightIcon: {
        paddingRight: spacing.md,
        zIndex: 1,
    },
    error: {
        fontSize: 12,
        color: colors.error,
        marginTop: spacing.xs,
        marginLeft: spacing.sm,
    },
});

export default Input;
