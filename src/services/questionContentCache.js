import { getContentLanguage } from '../i18n/uiTranslation';
import { storage } from '../utils/authStorage';

// Version 2 invalidates responses that mixed static question content with
// stale mutable answer/progress state from the previous cache behavior.
const CACHE_SCHEMA_VERSION = 2;
const CACHE_PREFIX = `questions-v2-cache:${CACHE_SCHEMA_VERSION}`;

const normalizePart = (value, fallback = 'anonymous') => (
    encodeURIComponent(String(value || fallback))
);

const readJson = (key) => {
    try {
        const value = storage.getString(key);
        return value ? JSON.parse(value) : null;
    } catch (error) {
        console.warn('[QuestionContentCache] Ignoring invalid cache entry', {
            key,
            message: error?.message || error,
        });
        storage.delete(key);
        return null;
    }
};

const writeJson = (key, value) => {
    try {
        storage.set(key, JSON.stringify({
            schemaVersion: CACHE_SCHEMA_VERSION,
            cachedAt: Date.now(),
            value,
        }));
    } catch (error) {
        console.warn('[QuestionContentCache] Failed to save cache entry', {
            key,
            message: error?.message || error,
        });
    }
};

const readValue = (key) => {
    const entry = readJson(key);
    return entry?.schemaVersion === CACHE_SCHEMA_VERSION ? entry.value : null;
};

const languagePart = () => normalizePart(getContentLanguage(), 'en');

const manifestKey = () => `${CACHE_PREFIX}:manifest:${languagePart()}`;

const setsKey = ({ topicId, userId }) => (
    `${CACHE_PREFIX}:sets:${languagePart()}:${normalizePart(userId)}:${normalizePart(topicId)}`
);

const questionsKey = ({ topicId, setId, userId, cursor = 0, limit = 10 }) => (
    `${CACHE_PREFIX}:questions:${languagePart()}:${normalizePart(userId)}:${normalizePart(topicId)}:${normalizePart(setId)}:${normalizePart(cursor, '0')}:${normalizePart(limit, '10')}`
);

export const QuestionContentCache = {
    getManifest: () => readValue(manifestKey()),

    setManifest: (manifest) => {
        if (manifest?.contentRevision) writeJson(manifestKey(), manifest);
    },

    getSets: ({ topicId, userId }) => readValue(setsKey({ topicId, userId })),

    setSets: ({ topicId, userId, response }) => {
        if (response?.success && Array.isArray(response.data?.sets)) {
            const key = setsKey({ topicId, userId });
            const cachedResponse = readValue(key);
            const completedProgressBySetId = new Map(
                (cachedResponse?.data?.sets || [])
                    .filter((set) => set.progress?.completedAt)
                    .map((set) => [String(set.setId), set.progress])
            );
            const nextSets = response.data.sets.map((set) => {
                const completedProgress = completedProgressBySetId.get(String(set.setId));
                if (!completedProgress || set.progress?.completedAt) return set;
                return {
                    ...set,
                    progress: {
                        ...(set.progress || {}),
                        ...completedProgress,
                        percentComplete: 100,
                    },
                };
            });

            writeJson(key, {
                ...response,
                data: { ...response.data, sets: nextSets },
            });
        }
    },

    markSetCompleted: ({ topicId, setId, userId, completedAt = new Date().toISOString() }) => {
        const key = setsKey({ topicId, userId });
        const response = readValue(key);
        if (!response?.success || !Array.isArray(response.data?.sets)) return;

        const nextSets = response.data.sets.map((set) => (
            String(set.setId) === String(setId)
                ? {
                    ...set,
                    progress: {
                        ...(set.progress || {}),
                        completedAt,
                        percentComplete: 100,
                    },
                }
                : set
        ));

        writeJson(key, {
            ...response,
            data: {
                ...response.data,
                sets: nextSets,
            },
        });
    },

    getQuestions: ({ topicId, setId, userId, cursor = 0, limit = 10 }) => (
        readValue(questionsKey({ topicId, setId, userId, cursor, limit }))
    ),

    setQuestions: ({ topicId, setId, userId, cursor = 0, limit = 10, response }) => {
        if (response?.success && Array.isArray(response.data?.questions)) {
            writeJson(
                questionsKey({ topicId, setId, userId, cursor, limit }),
                response,
            );
        }
    },
};

export default QuestionContentCache;
