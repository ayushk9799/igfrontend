import { colors, spacing, borderRadius } from '../../theme';

/**
 * Category configuration for different card types
 */
export const categoryConfig = {
    likelyto: {
        emoji: '⚖️',
        color: '#FF6B9D',
        bgGradient: ['#FFE8F0', '#FFD0E0', '#FFBAD0', '#FFA5C5'],
        label: 'Who is more likely...',
    },
    neverhaveiever: {
        emoji: '🤫',
        color: '#F4A261',
        bgGradient: ['#FFF4E8', '#FFE8D0', '#FFDBB8', '#FFCEA0'],
        label: 'Never have I ever',
    },
    deep: {
        emoji: '💭',
        color: '#5BB5A6',
        bgGradient: ['#E0F8F4', '#C8F0EA', '#B0E8E0', '#98E0D6'],
        label: 'Deep question',
    },
    takephoto: {
        emoji: '📸',
        color: '#9B59B6',
        bgGradient: ['#F5E6FA', '#EAD0F5', '#DFBAF0', '#D4A4EB'],
        label: 'Capture a moment',
    },
};

export const defaultConfig = categoryConfig.deep;
