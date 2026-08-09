import { API_BASE } from '../constants/Api';
import { apiFetch } from '../utils/apiFetch';

const QUESTIONS_V2_BASE = `${API_BASE}/api/v2/questions`;
const QUESTION_CHATS_V2_BASE = `${API_BASE}/api/v2/question-chats`;

const parseJson = async (response) => {
    const data = await response.json();
    if (!response.ok) {
        return {
            success: false,
            message: data?.message || 'Request failed',
            error: data?.error,
        };
    }
    return data;
};

const buildQuery = (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            query.set(key, String(value));
        }
    });
    const queryString = query.toString();
    return queryString ? `?${queryString}` : '';
};

export const QuestionsV2Api = {
    getContentManifest: async (revision) => {
        try {
            const query = buildQuery({ revision });
            const response = await apiFetch(`${QUESTIONS_V2_BASE}/content-manifest${query}`);
            return parseJson(response);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    getTopics: async (userId) => {
        try {
            const query = buildQuery({ userId });
            const response = await apiFetch(`${QUESTIONS_V2_BASE}/topics${query}`);
            return parseJson(response);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    getSets: async (topicId, userId) => {
        try {
            const query = buildQuery({ userId });
            const response = await apiFetch(`${QUESTIONS_V2_BASE}/topic/${topicId}/sets${query}`);
            return parseJson(response);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    getSetQuestions: async ({ topicId, setId, userId, cursor = 0, limit = 10 }) => {
        try {
            const query = buildQuery({ userId, cursor, limit });
            const response = await apiFetch(`${QUESTIONS_V2_BASE}/topic/${topicId}/sets/${setId}${query}`);
            return parseJson(response);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    saveProgress: async ({ userId, topicId, setId, questionId, action, cursor }) => {
        try {
            const response = await apiFetch(`${QUESTIONS_V2_BASE}/progress`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, topicId, setId, questionId, action, cursor }),
            });
            return parseJson(response);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    submitAnswer: async ({
        userId,
        topicId,
        setId,
        questionId,
        answer,
        answerType = 'text',
        cursor,
        answerSessionId,
    }) => {
        try {
            const response = await apiFetch(`${QUESTIONS_V2_BASE}/answer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    topicId,
                    setId,
                    questionId,
                    answer,
                    answerType,
                    cursor,
                    ...(answerSessionId ? { answerSessionId } : {}),
                }),
            });
            return parseJson(response);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    getSetReport: async ({ topicId, setId, userId }) => {
        try {
            const query = buildQuery({ userId });
            const response = await apiFetch(`${QUESTIONS_V2_BASE}/topic/${topicId}/sets/${setId}/report${query}`);
            return parseJson(response);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
};

export const QuestionChatsV2Api = {
    getChats: async (userId) => {
        try {
            const query = buildQuery({ userId });
            const response = await apiFetch(`${QUESTION_CHATS_V2_BASE}${query}`);
            return parseJson(response);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    getChat: async ({ chatId, userId, limit = 50 }) => {
        try {
            const query = buildQuery({ userId, limit });
            const response = await apiFetch(`${QUESTION_CHATS_V2_BASE}/${chatId}${query}`);
            return parseJson(response);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    getChatByQuestion: async ({ userId, topicId, setId, questionId }) => {
        try {
            const query = buildQuery({ userId, topicId, setId, questionId });
            const response = await apiFetch(`${QUESTION_CHATS_V2_BASE}/by-question${query}`);
            return parseJson(response);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    sendMessage: async ({ chatId, senderId, content, messageType = 'text' }) => {
        try {
            const response = await apiFetch(`${QUESTION_CHATS_V2_BASE}/${chatId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ senderId, content, messageType }),
            });
            return parseJson(response);
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
};

export default QuestionsV2Api;
