// Love App Theme - Premium Spacing, Shadows & Animation
import { Dimensions, Platform } from 'react-native';

const { width, height } = Dimensions.get('window');

export const screen = {
    width,
    height,
    isSmall: width < 375,
    isMedium: width >= 375 && width < 428,
    isLarge: width >= 428,
};

// Card dimensions - responsive to screen size
export const cardDimensions = {
    width: width - 32,
    height: height * 0.7,
    borderRadius: 28,
};

export const spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    '2xl': 32,
    '3xl': 40,
    '4xl': 48,
    '5xl': 64,
    '6xl': 80,
    '7xl': 96,
    '8xl': 128,
};

export const borderRadius = {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
    '2xl': 28,
    '3xl': 36,
    '4xl': 48,
    full: 9999,
};

// Animation Timing Constants - NEW
export const timing = {
    // Duration in ms
    instant: 100,
    fast: 200,
    normal: 300,
    slow: 500,
    slower: 800,
    slowest: 1200,

    // Spring configs for react-native-reanimated or Animated
    springBouncy: {
        tension: 200,
        friction: 8,
    },
    springSnappy: {
        tension: 300,
        friction: 12,
    },
    springGentle: {
        tension: 100,
        friction: 10,
    },
    springLoose: {
        tension: 50,
        friction: 6,
    },
};

// Parallax Depth Multipliers - NEW
export const parallax = {
    subtle: 0.05,
    light: 0.1,
    medium: 0.2,
    strong: 0.3,
    intense: 0.5,
};

// Premium Shadow Presets with light pink/purple lavender tints
export const shadows = {
    none: {
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
    },
    xs: {
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
    },
    sm: {
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.07,
        shadowRadius: 6,
        elevation: 2,
    },
    md: {
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.09,
        shadowRadius: 12,
        elevation: 4,
    },
    lg: {
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
        elevation: 8,
    },
    xl: {
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.15,
        shadowRadius: 28,
        elevation: 12,
    },

    // Glow Effects
    glow: {
        shadowColor: '#FF758F',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 8,
    },
    glowIntense: {
        shadowColor: '#FF758F',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 35,
        elevation: 15,
    },
    glowPurple: {
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 8,
    },
    glowBlue: {
        shadowColor: '#93C5FD',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 8,
    },
    glowGold: {
        shadowColor: '#FBBF24',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 8,
    },

    // Depth Shadows (for 3D effect)
    depth: {
        shadowColor: '#2E1E3C',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        elevation: 10,
    },
    depthHeavy: {
        shadowColor: '#2E1E3C',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.18,
        shadowRadius: 36,
        elevation: 18,
    },

    // Card Shadows
    card: {
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 6,
    },
    cardHover: {
        shadowColor: '#FF758F',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        elevation: 10,
    },

    // Floating element shadows
    floating: {
        shadowColor: '#FF758F',
        shadowOffset: { width: 0, height: 15 },
        shadowOpacity: 0.15,
        shadowRadius: 28,
        elevation: 14,
    },
};

// Z-index layers
export const zIndex = {
    base: 0,
    content: 1,
    overlay: 10,
    modal: 100,
    toast: 1000,
    tooltip: 10000,
};

// Opacity levels
export const opacity = {
    transparent: 0,
    faint: 0.1,
    muted: 0.3,
    medium: 0.5,
    high: 0.7,
    visible: 0.9,
    opaque: 1,
};

export default { spacing, borderRadius, shadows, screen, cardDimensions, timing, parallax, zIndex, opacity };
