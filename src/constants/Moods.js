
import { translateUiText } from '../i18n/uiTranslation';export const emojis = [
    { id: 'relaxed', label: "Relaxed", emoji: 'relaxed', imageSource: require('../../assets/moodsemoji/relaxed.png') },
    { id: 'stressed', label: "Stressed", emoji: 'stressed', imageSource: require('../../assets/moodsemoji/stressed.png') },
    { id: 'excited', label: "Excited", emoji: 'excited', imageSource: require('../../assets/moodsemoji/excited.png') },
    { id: 'sad', label: "Sad", emoji: 'sad', imageSource: require('../../assets/moodsemoji/sad.png') },
    { id: 'sleepy', label: "Sleepy", emoji: 'sleepy', imageSource: require('../../assets/moodsemoji/sleepy.png') },
    { id: 'angry', label: "Angry", emoji: 'angry', imageSource: require('../../assets/moodsemoji/angry.png') },
    { id: 'bored', label: "Bored", emoji: 'bored', imageSource: require('../../assets/moodsemoji/bored.png') },
    { id: 'tired', label: "Tired", emoji: 'tired', imageSource: require('../../assets/moodsemoji/tired.png') },
    { id: 'cuddly', label: "Cuddly", emoji: 'cuddly', imageSource: require('../../assets/moodsemoji/cuddly.png') },
    { id: 'flirtatious', label: "Flirtatious", emoji: 'flirtatious', imageSource: require('../../assets/moodsemoji/flirtatious.png') },
];

export const getEmojiById = (id) => emojis.find(e => e.id === id);
export const getEmojiByLabel = (label) => emojis.find(e => e.label === label);
