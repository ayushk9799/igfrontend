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
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    '4xl': 40,
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

// Premium Shadow Presets with pink/purple tints
export const shadows = {
    none: {
        shadowColor: 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
    },
    xs: {
        shadowColor: '#FF2D78',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    sm: {
        shadowColor: '#FF2D78',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
    },
    md: {
        shadowColor: '#FF2D78',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 8,
    },
    lg: {
        shadowColor: '#FF2D78',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
        elevation: 12,
    },
    xl: {
        shadowColor: '#FF2D78',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.3,
        shadowRadius: 32,
        elevation: 16,
    },

    // Glow Effects
    glow: {
        shadowColor: '#FF2D78',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 30,
        elevation: 15,
    },
    glowIntense: {
        shadowColor: '#FF2D78',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.7,
        shadowRadius: 50,
        elevation: 25,
    },
    glowPurple: {
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 30,
        elevation: 15,
    },
    glowBlue: {
        shadowColor: '#00C2FF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 30,
        elevation: 15,
    },
    glowGold: {
        shadowColor: '#FFB800',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 30,
        elevation: 15,
    },

    // Depth Shadows (for 3D effect)
    depth: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.4,
        shadowRadius: 32,
        elevation: 20,
    },
    depthHeavy: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 24 },
        shadowOpacity: 0.6,
        shadowRadius: 48,
        elevation: 30,
    },

    // Card Shadows
    card: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.35,
        shadowRadius: 24,
        elevation: 14,
    },
    cardHover: {
        shadowColor: '#FF2D78',
        shadowOffset: { width: 0, height: 15 },
        shadowOpacity: 0.4,
        shadowRadius: 32,
        elevation: 18,
    },

    // Floating element shadows
    floating: {
        shadowColor: '#FF2D78',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.35,
        shadowRadius: 40,
        elevation: 22,
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

export default { spacing, borderRadius, shadows, screen, timing, parallax, zIndex, opacity };
