// Topic-Based Categories Configuration
// Each topic contains mixed question types (Never Have I Ever, Would You Rather, etc.)

export const TOPIC_CATEGORIES = {
    future: {
        id: 'future',
        title: 'Future',
        subtitle: 'Dreams\n& Plans',
        emoji: '🔮',
        color: '#8c2b2b',
        gradient: ['#4a0e0e', '#A78BFA'],
        bgGradient: ['#EDE9FE', '#DDD6FE'],
        description: 'Questions about your future together',
        questionCount: 0, // Will be fetched from backend
    },
    money: {
        id: 'money',
        title: 'Money',
        subtitle: 'Finances\n& Spending',
        emoji: '💰',
        color: '#1B4332',
        gradient: ['#1B4332', '#34D399'],
        bgGradient: ['#E6FFFA', '#D1FAE5'],
        description: 'Financial questions and preferences',
        questionCount: 0,
    },
    hotspicy: {
        id: 'hotspicy',
        title: 'Hot & Spicy',
        subtitle: 'Spicy\n& Intimate',
        emoji: '🔥',
        color: '#801112',
        gradient: ['#EF4444', '#F87171'],
        bgGradient: ['#FEF2F2', '#FEE2E2'],
        description: 'Intimate and spicy questions',
        isAdult: true,
        questionCount: 0,
    },
    political: {
        id: 'political',
        title: 'Political',
        subtitle: 'Views\n& Opinions',
        emoji: '🗳️',
        color: '#1e3a5f',
        gradient: ['#1e3a5f', '#60A5FA'],
        bgGradient: ['#EFF6FF', '#DBEAFE'],
        description: 'Political views and debates',
        questionCount: 0,
    },
    fitness: {
        id: 'fitness',
        title: 'Fitness',
        subtitle: 'Health\n& Wellness',
        emoji: '💪',
        color: '#0d5c46',
        gradient: ['#0d5c46', '#34D399'],
        bgGradient: ['#ECFDF5', '#D1FAE5'],
        description: 'Health and fitness questions',
        questionCount: 0,
    },
    travel: {
        id: 'travel',
        title: 'Travel',
        subtitle: 'Adventures\n& Places',
        emoji: '✈️',
        color: '#0c4a6e',
        gradient: ['#0c4a6e', '#38BDF8'],
        bgGradient: ['#F0F9FF', '#E0F2FE'],
        description: 'Travel dreams and adventures',
        questionCount: 0,
    },
    family: {
        id: 'family',
        title: 'Family',
        subtitle: 'Kids\n& Future',
        emoji: '👨‍👩‍👧‍👦',
        color: '#831843',
        gradient: ['#831843', '#F472B6'],
        bgGradient: ['#FDF2F8', '#FCE7F3'],
        description: 'Family and future plans',
        questionCount: 0,
    },
};

// Question types that can exist within any topic
export const QUESTION_TYPES = {
    likelyto: { id: 'likelyto', title: 'Who is more likely...', emoji: '⚖️' },
    neverhaveiever: { id: 'neverhaveiever', title: 'Never have I ever...', emoji: '🤫' },
    wouldyourather: { id: 'wouldyourather', title: 'Would you rather...', emoji: '🤔' },
    knowledge: { id: 'knowledge', title: 'How well do you know me...', emoji: '🧠' },
    agreement: { id: 'agreement', title: 'Can we match answers...', emoji: '🎯' },
    preference: { id: 'preference', title: 'This or that...', emoji: '💜' },
    scale: { id: 'scale', title: 'Rate yourself...', emoji: '📊' },
    scenario: { id: 'scenario', title: 'What if...', emoji: '🎭' },
    finishsentence: { id: 'finishsentence', title: 'Finish the sentence...', emoji: '✏️' },
    opinion: { id: 'opinion', title: 'Hot takes...', emoji: '🔥' },
};

// Keep old config for backwards compatibility (can be removed later)
export const DEFAULT_CATEGORY_CONFIG = TOPIC_CATEGORIES;
