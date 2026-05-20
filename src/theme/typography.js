// Love App Theme - Premium Typography
// Enhanced with letter spacing and font scale

import { fontFamily } from '../constants/fonts';

export const fontSizes = {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
    '6xl': 60,
    '7xl': 72,
};

export const fontWeights = {
    light: '300',
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
    black: '900',
};

export const lineHeights = {
    tight: 1.1,
    snug: 1.25,
    normal: 1.5,
    relaxed: 1.75,
    loose: 2,
};

export const letterSpacing = {
    tighter: -1.5,
    tight: -0.5,
    normal: 0,
    wide: 0.5,
    wider: 1,
    widest: 2,
};

export const typography = {
    // Display - Hero text
    display: {
        fontFamily: fontFamily.extraBold,
        fontSize: fontSizes['6xl'],
        fontWeight: fontWeights.black,
        lineHeight: fontSizes['6xl'] * lineHeights.tight,
        letterSpacing: letterSpacing.tight,
    },

    // Headings
    h1: {
        fontFamily: fontFamily.extraBold,
        fontSize: fontSizes['4xl'],
        fontWeight: fontWeights.extrabold,
        lineHeight: fontSizes['4xl'] * lineHeights.tight,
        letterSpacing: letterSpacing.tight,
    },
    h2: {
        fontFamily: fontFamily.bold,
        fontSize: fontSizes['3xl'],
        fontWeight: fontWeights.bold,
        lineHeight: fontSizes['3xl'] * lineHeights.snug,
        letterSpacing: letterSpacing.tight,
    },
    h3: {
        fontFamily: fontFamily.bold,
        fontSize: fontSizes['2xl'],
        fontWeight: fontWeights.semibold,
        lineHeight: fontSizes['2xl'] * lineHeights.snug,
    },
    h4: {
        fontFamily: fontFamily.bold,
        fontSize: fontSizes.xl,
        fontWeight: fontWeights.semibold,
        lineHeight: fontSizes.xl * lineHeights.snug,
    },
    h5: {
        fontFamily: fontFamily.bold,
        fontSize: fontSizes.lg,
        fontWeight: fontWeights.semibold,
        lineHeight: fontSizes.lg * lineHeights.normal,
    },

    // Body text
    bodyLarge: {
        fontFamily: fontFamily.regular,
        fontSize: fontSizes.lg,
        fontWeight: fontWeights.regular,
        lineHeight: fontSizes.lg * lineHeights.relaxed,
    },
    body: {
        fontFamily: fontFamily.regular,
        fontSize: fontSizes.md,
        fontWeight: fontWeights.regular,
        lineHeight: fontSizes.md * lineHeights.relaxed,
    },
    bodySmall: {
        fontFamily: fontFamily.regular,
        fontSize: fontSizes.sm,
        fontWeight: fontWeights.regular,
        lineHeight: fontSizes.sm * lineHeights.normal,
    },

    // Labels
    label: {
        fontFamily: fontFamily.bold,
        fontSize: fontSizes.sm,
        fontWeight: fontWeights.semibold,
        lineHeight: fontSizes.sm * lineHeights.normal,
        letterSpacing: letterSpacing.wide,
    },
    labelSmall: {
        fontFamily: fontFamily.bold,
        fontSize: fontSizes.xs,
        fontWeight: fontWeights.semibold,
        lineHeight: fontSizes.xs * lineHeights.normal,
        letterSpacing: letterSpacing.wider,
        textTransform: 'uppercase',
    },

    // Caption
    caption: {
        fontFamily: fontFamily.regular,
        fontSize: fontSizes.xs,
        fontWeight: fontWeights.regular,
        lineHeight: fontSizes.xs * lineHeights.normal,
    },

    // Special - Accent text
    accent: {
        fontFamily: fontFamily.medium,
        fontSize: fontSizes.lg,
        fontWeight: fontWeights.medium,
        fontStyle: 'italic',
        lineHeight: fontSizes.lg * lineHeights.relaxed,
    },

    // Quote style
    quote: {
        fontFamily: fontFamily.medium,
        fontSize: fontSizes.xl,
        fontWeight: fontWeights.medium,
        fontStyle: 'italic',
        lineHeight: fontSizes.xl * lineHeights.relaxed,
        letterSpacing: letterSpacing.wide,
    },

    // Badge / Tag text
    badge: {
        fontFamily: fontFamily.extraBold,
        fontSize: 10,
        fontWeight: fontWeights.extrabold,
        letterSpacing: letterSpacing.widest,
        textTransform: 'uppercase',
    },

    // Button text scales
    buttonXl: {
        fontFamily: fontFamily.bold,
        fontSize: fontSizes.lg,
        fontWeight: fontWeights.bold,
        letterSpacing: letterSpacing.wide,
    },
    buttonLg: {
        fontFamily: fontFamily.bold,
        fontSize: fontSizes.md,
        fontWeight: fontWeights.bold,
        letterSpacing: letterSpacing.wide,
    },
    buttonMd: {
        fontFamily: fontFamily.bold,
        fontSize: fontSizes.sm,
        fontWeight: fontWeights.semibold,
        letterSpacing: letterSpacing.wide,
    },
    buttonSm: {
        fontFamily: fontFamily.bold,
        fontSize: fontSizes.xs,
        fontWeight: fontWeights.semibold,
        letterSpacing: letterSpacing.wide,
    },
};

export default typography;
