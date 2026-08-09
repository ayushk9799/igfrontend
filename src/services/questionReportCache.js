import { getContentLanguage } from '../i18n/uiTranslation';
import { storage } from '../utils/authStorage';

const CACHE_VERSION = 1;
const CACHE_PREFIX = `questions-v2-report:${CACHE_VERSION}`;
const MAX_REPORTS_PER_USER = 20;

const part = (value, fallback = 'anonymous') => encodeURIComponent(String(value || fallback));
const reportKey = ({ topicId, setId, userId }) => (
    `${CACHE_PREFIX}:${part(getContentLanguage(), 'en')}:${part(userId)}:${part(topicId)}:${part(setId)}`
);
const indexKey = (userId) => `${CACHE_PREFIX}:index:${part(getContentLanguage(), 'en')}:${part(userId)}`;

const readJson = (key) => {
    try {
        const raw = storage.getString(key);
        return raw ? JSON.parse(raw) : null;
    } catch {
        storage.delete(key);
        return null;
    }
};

const writeJson = (key, value) => {
    try {
        storage.set(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.warn('[QuestionReportCache] Failed to write report', error?.message || error);
        return false;
    }
};

const answerValue = (answer) => (
    answer && typeof answer === 'object' && answer.value !== undefined ? answer.value : answer
);

const compare = (format, userAnswer, partnerAnswer) => {
    if (userAnswer === null || userAnswer === undefined || partnerAnswer === null || partnerAnswer === undefined) {
        return { comparable: ['likelyto', 'neverhaveiever', 'wouldyourather', 'thisorthat', 'slider'].includes(format), match: null, similarityScore: null };
    }
    if (format === 'slider') {
        const left = Number(answerValue(userAnswer));
        const right = Number(answerValue(partnerAnswer));
        if (!Number.isFinite(left) || !Number.isFinite(right)) {
            return { comparable: true, match: null, similarityScore: null };
        }
        const distance = Math.abs(left - right);
        return { comparable: true, match: distance <= 1, similarityScore: Math.max(0, Math.round(100 - distance * 20)) };
    }
    if (['likelyto', 'neverhaveiever', 'wouldyourather', 'thisorthat'].includes(format)) {
        const left = String(answerValue(userAnswer)).trim().toLowerCase();
        const right = String(answerValue(partnerAnswer)).trim().toLowerCase();
        const match = left === right;
        return { comparable: true, match, similarityScore: match ? 100 : 0 };
    }
    return { comparable: false, match: null, similarityScore: null };
};

const summarize = (items, format) => {
    const comparedItems = items.map((item) => ({
        ...item,
        bothAnswered: item.userAnswer !== null && item.userAnswer !== undefined
            && item.partnerAnswer !== null && item.partnerAnswer !== undefined,
        ...compare(format, item.userAnswer, item.partnerAnswer),
    }));
    const both = comparedItems.filter((item) => item.bothAnswered);
    const comparable = both.filter((item) => item.comparable);
    const scored = comparable.filter((item) => Number.isFinite(item.similarityScore));

    return {
        items: comparedItems,
        summary: {
            totalQuestions: comparedItems.length,
            bothAnswered: both.length,
            comparable: comparable.length,
            matched: comparable.filter((item) => item.match === true).length,
            different: comparable.filter((item) => item.match === false).length,
            similarityPercent: scored.length
                ? Math.round(scored.reduce((sum, item) => sum + item.similarityScore, 0) / scored.length)
                : null,
        },
    };
};

const trimIndex = (userId, currentKey) => {
    const key = indexKey(userId);
    const previous = readJson(key);
    const entries = Array.isArray(previous) ? previous : [];
    const next = [
        { key: currentKey, usedAt: Date.now() },
        ...entries.filter((entry) => entry?.key && entry.key !== currentKey),
    ];

    next.slice(MAX_REPORTS_PER_USER).forEach((entry) => storage.delete(entry.key));
    writeJson(key, next.slice(0, MAX_REPORTS_PER_USER));
};

export const mergeQuestionReportWithLocalAnswers = (cachedReport, localReport) => {
    if (!cachedReport && localReport) {
        const localItems = (localReport.items || []).map((item) => ({
            ...item,
            hasLocalUserAnswer: undefined,
        }));
        return { ...localReport, ...summarize(localItems, localReport.format) };
    }
    if (!cachedReport) return null;
    if (!localReport) return cachedReport;

    const localItems = localReport.items || [];
    const localById = new Map(localItems.map((item) => [item.questionId, item]));
    const cachedIds = new Set((cachedReport.items || []).map((item) => item.questionId));
    const orderedItems = [
        ...(cachedReport.items || []),
        ...localItems.filter((item) => !cachedIds.has(item.questionId)),
    ];
    const mergedItems = orderedItems.map((sourceItem) => {
        const localItem = localById.get(sourceItem.questionId) || {};
        const cachedItem = cachedIds.has(sourceItem.questionId) ? sourceItem : {};
        return {
            ...cachedItem,
            ...localItem,
            userAnswer: localItem.hasLocalUserAnswer
                ? localItem.userAnswer
                : cachedItem.userAnswer ?? null,
            userAnsweredAt: localItem.hasLocalUserAnswer
                ? localItem.userAnsweredAt
                : cachedItem.userAnsweredAt ?? null,
            partnerAnswer: cachedItem.partnerAnswer ?? null,
            partnerAnsweredAt: cachedItem.partnerAnsweredAt ?? null,
            chatId: cachedItem.chatId ?? localItem.chatId ?? null,
            hasLocalUserAnswer: undefined,
        };
    });
    const calculated = summarize(mergedItems, localReport.format || cachedReport.format);

    return {
        ...cachedReport,
        ...localReport,
        ...calculated,
    };
};

export const QuestionReportCache = {
    get: ({ topicId, setId, userId }) => {
        const entry = readJson(reportKey({ topicId, setId, userId }));
        return entry?.version === CACHE_VERSION ? entry.report : null;
    },

    set: ({ topicId, setId, userId, report }) => {
        if (!report || !Array.isArray(report.items)) return;
        const key = reportKey({ topicId, setId, userId });
        if (writeJson(key, { version: CACHE_VERSION, cachedAt: Date.now(), report })) {
            trimIndex(userId, key);
        }
    },

    patchUserAnswer: ({ topicId, setId, userId, questionId, answer, answeredAt, chat }) => {
        const report = QuestionReportCache.get({ topicId, setId, userId });
        if (!report) return;
        const items = (report.items || []).map((item) => (
            item.questionId === questionId
                ? {
                    ...item,
                    userAnswer: answer,
                    userAnsweredAt: answeredAt || new Date().toISOString(),
                    chatId: chat?.chatId || item.chatId || null,
                }
                : item
        ));
        const calculated = summarize(items, report.format);
        QuestionReportCache.set({
            topicId,
            setId,
            userId,
            report: { ...report, ...calculated },
        });
    },
};

export default QuestionReportCache;
