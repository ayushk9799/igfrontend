// Premium Card Component - Light & Elegant
// Clean, minimal cards with subtle shadows
import React, { useRef, useEffect } from 'react';
import { StyleSheet, View, Animated } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { colors, borderRadius, spacing, shadows } from '../theme';

export const Card = ({
    children,
    variant = 'default',
    padding = 'md',
    style,
    animatedBorder = false,
    glowOnMount = false, // Kept for API compatibility but disabled to prevent iOS Fabric crash
}) => {
    // Animations removed to prevent iOS Fabric "Attempt to recycle a mounted view" crash

    const paddingValue = {
        none: 0,
        sm: spacing.sm,
        md: spacing.md,
        lg: spacing.lg,
        xl: spacing.xl,
    }[padding];

    const getVariantStyles = () => {
        switch (variant) {
            case 'glass':
                return {
                    backgroundColor: colors.glass,
                    borderWidth: 1,
                    borderColor: colors.border,
                };
            case 'solid':
                return {
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.borderLight,
                };
            case 'outline':
                return {
                    backgroundColor: 'transparent',
                    borderWidth: 1.5,
                    borderColor: colors.border,
                };
            case 'gradient':
                return {
                    overflow: 'hidden',
                };
            case 'elevated':
                return {
                    backgroundColor: colors.surface,
                    ...shadows.md,
                };
            default:
                return {
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.borderLight,
                };
        }
    };

    const cardContent = (
        <View style={[
            styles.card,
            getVariantStyles(),
            { padding: paddingValue },
            style,
        ]}>
            {children}
        </View>
    );

    if (variant === 'gradient' || animatedBorder) {
        return (
            <View style={[
                styles.gradientWrapper,
            ]}>
                <LinearGradient
                    colors={['#FFB5B0', '#8DD5C7']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gradientBorder}
                >
                    <View style={[
                        styles.gradientInner,
                        { padding: paddingValue },
                        style,
                    ]}>
                        {children}
                    </View>
                </LinearGradient>
            </View>
        );
    }

    // glowOnMount disabled - just render the card content directly
    return cardContent;
};

const styles = StyleSheet.create({
    card: {
        borderRadius: borderRadius.xl,
    },
    gradientWrapper: {
        borderRadius: borderRadius.xl,
        overflow: 'hidden',
    },
    gradientBorder: {
        padding: 2,
        borderRadius: borderRadius.xl,
    },
    gradientInner: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl - 2,
    },
});

export default Card;
