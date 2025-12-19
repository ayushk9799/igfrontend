// Premium Button Component - Light & Elegant
// Clean, modern buttons with subtle animations
import React, { useRef } from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Animated,
    ActivityIndicator,
    Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors, borderRadius, spacing, shadows } from '../theme';

export const Button = ({
    title,
    onPress,
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading = false,
    fullWidth = false,
    leftIcon,
    rightIcon,
    style,
}) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.97,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            speed: 50,
            bounciness: 8,
        }).start();
    };

    const getSizeStyles = () => {
        switch (size) {
            case 'sm':
                return { paddingVertical: spacing.sm, paddingHorizontal: spacing.md };
            case 'lg':
                return { paddingVertical: spacing.md + 2, paddingHorizontal: spacing.xl };
            case 'xl':
                return { paddingVertical: spacing.lg, paddingHorizontal: spacing['2xl'] };
            default:
                return { paddingVertical: spacing.md, paddingHorizontal: spacing.lg };
        }
    };

    const getFontSize = () => {
        switch (size) {
            case 'sm': return 14;
            case 'lg': return 17;
            case 'xl': return 18;
            default: return 16;
        }
    };

    const renderContent = () => (
        <View style={styles.contentContainer}>
            {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
            {loading ? (
                <ActivityIndicator color={variant === 'ghost' ? colors.primary : '#FFFFFF'} />
            ) : (
                <Text style={[
                    styles.text,
                    { fontSize: getFontSize() },
                    variant === 'ghost' && styles.ghostText,
                    variant === 'outline' && styles.outlineText,
                    disabled && styles.disabledText,
                ]}>
                    {title}
                </Text>
            )}
            {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
        </View>
    );

    const sizeStyles = getSizeStyles();

    // Primary - Gradient button
    if (variant === 'primary' || variant === 'glow') {
        return (
            <Animated.View style={[
                { transform: [{ scale: scaleAnim }] },
                fullWidth && styles.fullWidth,
                style,
            ]}>
                <TouchableOpacity
                    onPress={onPress}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    disabled={disabled || loading}
                    activeOpacity={0.9}
                    style={[
                        styles.gradientButton,
                        sizeStyles,
                        fullWidth && styles.fullWidth,
                        disabled && styles.disabled,
                    ]}
                >
                    {/* Gradient as absolute background */}
                    <LinearGradient
                        colors={disabled
                            ? ['#CBD5E0', '#A0AEC0']
                            : ['#F97068', '#F4A261']
                        }
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFill}
                    />
                    {renderContent()}
                </TouchableOpacity>
            </Animated.View>
        );
    }

    // Secondary
    if (variant === 'secondary') {
        return (
            <Animated.View style={[
                { transform: [{ scale: scaleAnim }] },
                fullWidth && styles.fullWidth,
                style,
            ]}>
                <TouchableOpacity
                    onPress={onPress}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    disabled={disabled || loading}
                    activeOpacity={0.9}
                    style={[
                        styles.gradientButton,
                        sizeStyles,
                        fullWidth && styles.fullWidth,
                        disabled && styles.disabled,
                    ]}
                >
                    {/* Gradient as absolute background */}
                    <LinearGradient
                        colors={disabled
                            ? ['#CBD5E0', '#A0AEC0']
                            : ['#5BB5A6', '#81D4FA']
                        }
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFill}
                    />
                    {renderContent()}
                </TouchableOpacity>
            </Animated.View>
        );
    }

    // Ghost
    if (variant === 'ghost') {
        return (
            <Animated.View style={[
                { transform: [{ scale: scaleAnim }] },
                fullWidth && styles.fullWidth,
                style,
            ]}>
                <TouchableOpacity
                    style={[
                        styles.button,
                        sizeStyles,
                        styles.ghostButton,
                        fullWidth && styles.fullWidth,
                    ]}
                    onPress={onPress}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    disabled={disabled || loading}
                    activeOpacity={0.7}
                >
                    {renderContent()}
                </TouchableOpacity>
            </Animated.View>
        );
    }

    // Outline
    if (variant === 'outline') {
        return (
            <Animated.View style={[
                { transform: [{ scale: scaleAnim }] },
                fullWidth && styles.fullWidth,
                style,
            ]}>
                <TouchableOpacity
                    style={[
                        styles.button,
                        sizeStyles,
                        styles.outlineButton,
                        fullWidth && styles.fullWidth,
                    ]}
                    onPress={onPress}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    disabled={disabled || loading}
                    activeOpacity={0.7}
                >
                    {renderContent()}
                </TouchableOpacity>
            </Animated.View>
        );
    }

    // Default
    return (
        <Animated.View style={[
            { transform: [{ scale: scaleAnim }] },
            fullWidth && styles.fullWidth,
            style,
        ]}>
            <TouchableOpacity
                style={[
                    styles.button,
                    sizeStyles,
                    styles.defaultButton,
                    fullWidth && styles.fullWidth,
                ]}
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={disabled || loading}
                activeOpacity={0.8}
            >
                {renderContent()}
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    gradientButton: {
        borderRadius: borderRadius.xl,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        ...shadows.sm,
    },
    button: {
        borderRadius: borderRadius.xl,
        alignItems: 'center',
        justifyContent: 'center',
    },
    fullWidth: {
        width: '100%',
    },
    ghostButton: {
        backgroundColor: 'transparent',
    },
    outlineButton: {
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: colors.primary,
    },
    defaultButton: {
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    disabled: {
        opacity: 0.5,
    },
    contentContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
    ghostText: {
        color: colors.primary,
    },
    outlineText: {
        color: colors.primary,
    },
    disabledText: {
        color: colors.textMuted,
    },
    iconLeft: {
        marginRight: spacing.sm,
    },
    iconRight: {
        marginLeft: spacing.sm,
    },
});

export default Button;


