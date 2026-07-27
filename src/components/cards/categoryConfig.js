import { colors, spacing, borderRadius } from '../../theme';
import { translateUiText } from '../../i18n/uiTranslation';

/**
 * Category configuration for different card types
 */
export const categoryConfig = {
    likelyto: {
        emoji: '⚖️',
        color: '#FF1E6C',
        bgGradient: ['#FF1E6C', '#FF3D7F', '#FF6B9D'],
        label: "Who is more likely...",
    },
    neverhaveiever: {
        emoji: '🤫',
        color: '#FF4500',
        bgGradient: ['#FF4500', '#FF6B00', '#FF8C00'],
        label: "Never have I ever",
    },
    deep: {
        emoji: '💭',
        color: '#00897B',
        bgGradient: ['#00695C', '#00897B', '#26A69A'],
        label: "Deep Talk",
    },
    takephoto: {
        emoji: '📸',
        color: '#8E24AA',
        bgGradient: ['#6A1B9A', '#8E24AA', '#AB47BC'],
        label: "Capture a moment",
    },
    preference: {
        emoji: '💜',
        color: '#5E35B1',
        bgGradient: ['#4527A0', '#5E35B1', '#7E57C2'],
        label: "This or That",
    },
    scale: {
        emoji: '📊',
        color: '#E65100',
        bgGradient: ['#BF360C', '#E65100', '#F57C00'],
        label: "Rate it",
    },
    lovelanguage: {
        emoji: '❤️',
        color: '#C2185B',
        bgGradient: ['#880E4F', '#C2185B', '#E91E63'],
        label: "Love Language",
    },
    wouldyourather: {
        emoji: '🤔',
        color: '#AD1457',
        bgGradient: ['#880E4F', '#AD1457', '#D81B60'],
        label: "Would You Rather",
    },
    thisorthat: {
        emoji: '💜',
        color: '#5E35B1',
        bgGradient: ['#4527A0', '#5E35B1', '#7E57C2'],
        label: "This or That",
    },
    bucketlist: {
        emoji: '🌟',
        color: '#6200EA',
        bgGradient: ['#4A00E0', '#6200EA', '#7C4DFF'],
        label: "Bucket List",
    },
    finishsentence: {
        emoji: '✏️',
        color: '#0277BD',
        bgGradient: ['#01579B', '#0277BD', '#0288D1'],
        label: "Finish the thoughts",
    },
    gratitude: {
        emoji: '🙏',
        color: '#FF8F00',
        bgGradient: ['#E65100', '#FF8F00', '#FFA000'],
        label: "Gratitude",
    },
    memory: {
        emoji: '📸',
        color: '#6D4C41',
        bgGradient: ['#4E342E', '#6D4C41', '#8D6E63'],
        label: "Memory Lane",
    },
    scenario: {
        emoji: '🎭',
        color: '#00796B',
        bgGradient: ['#004D40', '#00796B', '#009688'],
        label: "What If...",
    },
    opinion: {
        emoji: '🔥',
        color: '#D32F2F',
        bgGradient: ['#B71C1C', '#D32F2F', '#E53935'],
        label: "Hot Takes",
    },
    vulnerability: {
        emoji: '💙',
        color: '#1565C0',
        bgGradient: ['#0D47A1', '#1565C0', '#1976D2'],
        label: "Open Your Heart",
    },
    roleplay: {
        emoji: '🎨',
        color: '#C2185B',
        bgGradient: ['#AD1457', '#C2185B', '#E91E63'],
        label: "Creative Prompt",
    },
    voicerecord: {
        emoji: '🎙️',
        color: '#E91E63',
        bgGradient: ['#C2185B', '#E91E63', '#F06292'],
        label: "Voice Message",
    },
};

export const defaultConfig = categoryConfig.deep;
