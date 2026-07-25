import fiveLetterWords from '../data/fiveLetterWords.json';

const validFiveLetterWords = new Set(fiveLetterWords);

export const normalizeFiveLetterWord = (word) => (
    typeof word === 'string' ? word.trim().toLowerCase() : ''
);

export const isValidFiveLetterWord = (word) => {
    const normalizedWord = normalizeFiveLetterWord(word);
    return /^[a-z]{5}$/.test(normalizedWord)
        && validFiveLetterWords.has(normalizedWord);
};
