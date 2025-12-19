// Love App Theme - Premium Typography
// Enhanced with letter spacing and font scale

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
        fontSize: fontSizes['6xl'],
        fontWeight: fontWeights.black,
        lineHeight: fontSizes['6xl'] * lineHeights.tight,
        letterSpacing: letterSpacing.tight,
    },

    // Headings
    h1: {
        fontSize: fontSizes['4xl'],
        fontWeight: fontWeights.extrabold,
        lineHeight: fontSizes['4xl'] * lineHeights.tight,
        letterSpacing: letterSpacing.tight,
    },
    h2: {
        fontSize: fontSizes['3xl'],
        fontWeight: fontWeights.bold,
        lineHeight: fontSizes['3xl'] * lineHeights.snug,
        letterSpacing: letterSpacing.tight,
    },
    h3: {
        fontSize: fontSizes['2xl'],
        fontWeight: fontWeights.semibold,
        lineHeight: fontSizes['2xl'] * lineHeights.snug,
    },
    h4: {
        fontSize: fontSizes.xl,
        fontWeight: fontWeights.semibold,
        lineHeight: fontSizes.xl * lineHeights.snug,
    },
    h5: {
        fontSize: fontSizes.lg,
        fontWeight: fontWeights.semibold,
        lineHeight: fontSizes.lg * lineHeights.normal,
    },

    // Body text
    bodyLarge: {
        fontSize: fontSizes.lg,
        fontWeight: fontWeights.regular,
        lineHeight: fontSizes.lg * lineHeights.relaxed,
    },
    body: {
        fontSize: fontSizes.md,
        fontWeight: fontWeights.regular,
        lineHeight: fontSizes.md * lineHeights.relaxed,
    },
    bodySmall: {
        fontSize: fontSizes.sm,
        fontWeight: fontWeights.regular,
        lineHeight: fontSizes.sm * lineHeights.normal,
    },

    // Labels
    label: {
        fontSize: fontSizes.sm,
        fontWeight: fontWeights.semibold,
        lineHeight: fontSizes.sm * lineHeights.normal,
        letterSpacing: letterSpacing.wide,
    },
    labelSmall: {
        fontSize: fontSizes.xs,
        fontWeight: fontWeights.semibold,
        lineHeight: fontSizes.xs * lineHeights.normal,
        letterSpacing: letterSpacing.wider,
        textTransform: 'uppercase',
    },

    // Caption
    caption: {
        fontSize: fontSizes.xs,
        fontWeight: fontWeights.regular,
        lineHeight: fontSizes.xs * lineHeights.normal,
    },

    // Special - Accent text
    accent: {
        fontSize: fontSizes.lg,
        fontWeight: fontWeights.medium,
        fontStyle: 'italic',
        lineHeight: fontSizes.lg * lineHeights.relaxed,
    },

    // Quote style
    quote: {
        fontSize: fontSizes.xl,
        fontWeight: fontWeights.medium,
        fontStyle: 'italic',
        lineHeight: fontSizes.xl * lineHeights.relaxed,
        letterSpacing: letterSpacing.wide,
    },

    // Badge / Tag text
    badge: {
        fontSize: 10,
        fontWeight: fontWeights.extrabold,
        letterSpacing: letterSpacing.widest,
        textTransform: 'uppercase',
    },

    // Button text scales
    buttonXl: {
        fontSize: fontSizes.lg,
        fontWeight: fontWeights.bold,
        letterSpacing: letterSpacing.wide,
    },
    buttonLg: {
        fontSize: fontSizes.md,
        fontWeight: fontWeights.bold,
        letterSpacing: letterSpacing.wide,
    },
    buttonMd: {
        fontSize: fontSizes.sm,
        fontWeight: fontWeights.semibold,
        letterSpacing: letterSpacing.wide,
    },
    buttonSm: {
        fontSize: fontSizes.xs,
        fontWeight: fontWeights.semibold,
        letterSpacing: letterSpacing.wide,
    },
};

export default typography;
