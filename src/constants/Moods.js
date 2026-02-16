import { colors } from '../theme';

export const moods = [
    { id: 'happy', emoji: '😊', label: 'Happy', color: colors.moodHappy, gradient: ['#FFD60A40', '#FFD60A10'] },
    { id: 'love', emoji: '🥰', label: 'In Love', color: colors.moodLove, gradient: ['#FF2D7840', '#FF2D7810'] },
    { id: 'playful', emoji: '😜', label: 'Playful', color: colors.moodPlayful, gradient: ['#BF5AF240', '#BF5AF210'] },
    { id: 'calm', emoji: '😌', label: 'Calm', color: colors.moodCalm, gradient: ['#64D2FF40', '#64D2FF10'] },
    { id: 'excited', emoji: '🤩', label: 'Excited', color: colors.moodExcited, gradient: ['#FF375F40', '#FF375F10'] },
    { id: 'grateful', emoji: '🙏', label: 'Grateful', color: colors.moodGrateful, gradient: ['#30D15840', '#30D15810'] },
    { id: 'missing', emoji: '💭', label: 'Missing You', color: colors.moodMissing, gradient: ['#FF9F0A40', '#FF9F0A10'] },
    { id: 'tired', emoji: '😴', label: 'Tired', color: colors.moodTired, gradient: ['#8E8E9340', '#8E8E9310'] },
    { id: 'romantic', emoji: '💕', label: 'Romantic', color: colors.primary, gradient: ['#FF2D7840', '#7C3AED20'] },
];

export const getMoodById = (id) => moods.find(m => m.id === id);
export const getMoodByLabel = (label) => moods.find(m => m.label === label);
