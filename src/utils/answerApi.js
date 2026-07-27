import { API_BASE } from '../constants/Api';
import { apiFetch } from './apiFetch';

/**
 * Submit an answer for a task
 * 
 * @param {string} userId - The user's ID
 * @param {string} challengeId - The daily challenge ID
 * @param {number} taskIndex - The task index (0-based, matches tasks array)
 * @param {string} answer - The answer value
 * @param {string} answerType - The answer type: 'text', 'photo', or 'video'
 */
export const submitAnswer = async (userId, challengeId, taskIndex, answer, answerType = 'text') => {

    try {
        const url = `${API_BASE}/api/answers/submit`;
        const body = { userId, challengeId, taskIndex, answer, answerType };


        const response = await apiFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });


        const data = await response.json();

        return data;
    } catch (error) {
        console.error('❌ [SUBMIT] Error:', error.message);
        return { success: false, error: error.message };
    }
};

/**
 * Get user's answers for a challenge
 */
export const getUserAnswers = async (challengeId, userId) => {

    try {
        const url = `${API_BASE}/api/answers/${challengeId}?userId=${userId}`;

        const response = await apiFetch(url);

        const data = await response.json();

        return data;
    } catch (error) {
        console.error('❌ [GET_USER_ANSWERS] Error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get partner's answers for a challenge
 */
export const getPartnerAnswers = async (challengeId, userId) => {
    try {
        const response = await apiFetch(
            `${API_BASE}/api/answers/${challengeId}/partner?userId=${userId}`
        );
        return await response.json();
    } catch (error) {
        console.error('Error fetching partner answers:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get activity feed for a specific date
 * @param {string} date - Date in YYYY-MM-DD format (user's local date)
 */
export const getActivityByDate = async (date) => {
    try {
        const response = await apiFetch(`${API_BASE}/api/answers/activity/date/${date}`);
        return await response.json();
    } catch (error) {
        console.error('Error fetching activity:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get both partners' answers for comparison
 */
export const getCoupleAnswers = async (date, userId) => {

    try {
        const url = `${API_BASE}/api/answers/couple/${date}?userId=${userId}`;

        const response = await apiFetch(url);

        const data = await response.json();

        return data;
    } catch (error) {
        console.error('❌ [GET_COUPLE_ANSWERS] Error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get challenge and user's answers in a single API call (performance optimization)
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} userId - User ID
 */
export const getChallengeWithAnswers = async (date, userId) => {

    try {
        const url = `${API_BASE}/api/daily-challenge/date/${date}/with-answers?userId=${userId}`;

        const response = await apiFetch(url);

        const data = await response.json();

        return data;
    } catch (error) {
        console.error('❌ [GET_CHALLENGE_WITH_ANSWERS] Error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Get the shared active daily ritual for the user's couple.
 */
export const getCoupleTodayChallenge = async (userId) => {
    try {
        const url = `${API_BASE}/api/daily-challenge/couple-today?userId=${userId}`;
        const response = await apiFetch(url);

        return await response.json();
    } catch (error) {
        console.error('❌ [GET_COUPLE_TODAY] Error:', error);
        return { success: false, error: error.message };
    }
};
