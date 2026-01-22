import { API_BASE } from '../constants/Api';

/**
 * Submit an answer for a task
 * 
 * @param {string} userId - The user's ID
 * @param {string} challengeId - The daily challenge ID
 * @param {number} taskIndex - The task index (0-based, matches tasks array)
 * @param {string} answer - The answer value
 */
export const submitAnswer = async (userId, challengeId, taskIndex, answer) => {
    console.log('📤 [SUBMIT] Starting answer submission...');
    console.log('📤 [SUBMIT] Params:', { userId, challengeId, taskIndex, answer });

    try {
        const url = `${API_BASE}/api/answers/submit`;
        const body = { userId, challengeId, taskIndex, answer };

        console.log('📤 [SUBMIT] URL:', url);
        console.log('📤 [SUBMIT] Body:', JSON.stringify(body));

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        console.log('📤 [SUBMIT] Response status:', response.status);

        const data = await response.json();
        console.log('📤 [SUBMIT] Response data:', JSON.stringify(data));

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
    console.log('📥 [GET_USER_ANSWERS] Fetching user answers...');
    console.log('📥 [GET_USER_ANSWERS] Params:', { challengeId, userId });

    try {
        const url = `${API_BASE}/api/answers/${challengeId}?userId=${userId}`;
        console.log('📥 [GET_USER_ANSWERS] URL:', url);

        const response = await fetch(url);
        console.log('📥 [GET_USER_ANSWERS] Response status:', response.status);

        const data = await response.json();
        console.log('📥 [GET_USER_ANSWERS] Response data:', JSON.stringify(data, null, 2));

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
        const response = await fetch(
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
        const response = await fetch(`${API_BASE}/api/answers/activity/date/${date}`);
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
    console.log('💑 [GET_COUPLE_ANSWERS] Fetching couple answers...');
    console.log('💑 [GET_COUPLE_ANSWERS] Params:', { date, userId });

    try {
        const url = `${API_BASE}/api/answers/couple/${date}?userId=${userId}`;
        console.log('💑 [GET_COUPLE_ANSWERS] URL:', url);

        const response = await fetch(url);
        console.log('💑 [GET_COUPLE_ANSWERS] Response status:', response.status);

        const data = await response.json();
        console.log('💑 [GET_COUPLE_ANSWERS] Response data:', JSON.stringify(data, null, 2));

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
    console.log('🚀 [GET_CHALLENGE_WITH_ANSWERS] Fetching combined data...');
    console.log('🚀 [GET_CHALLENGE_WITH_ANSWERS] Params:', { date, userId });

    try {
        const url = `${API_BASE}/api/daily-challenge/date/${date}/with-answers?userId=${userId}`;
        console.log('🚀 [GET_CHALLENGE_WITH_ANSWERS] URL:', url);

        const response = await fetch(url);
        console.log('🚀 [GET_CHALLENGE_WITH_ANSWERS] Response status:', response.status);

        const data = await response.json();
        console.log('🚀 [GET_CHALLENGE_WITH_ANSWERS] Response data:', JSON.stringify(data, null, 2));

        return data;
    } catch (error) {
        console.error('❌ [GET_CHALLENGE_WITH_ANSWERS] Error:', error);
        return { success: false, error: error.message };
    }
};
