// Auth Storage - Persistent authentication state using MMKV
import { MMKV } from 'react-native-mmkv';

// Initialize MMKV storage
export const storage = new MMKV();

// Storage keys
const KEYS = {
    USER: 'auth_user',
    IS_AUTHENTICATED: 'auth_is_authenticated',
    AUTH_TOKEN: 'auth_session_token',
    IS_ONBOARDED: 'auth_is_onboarded',
    HAS_SEEN_ONBOARDING: 'has_seen_onboarding', // First-launch intro screens
    HAS_SEEN_ONBOARDING_PREMIUM: 'has_seen_onboarding_premium',
    ACTIVE_LIVE_CHAT_USER: 'active_live_chat_user',
};

const getOnboardingPremiumKey = (userId) => (
    userId
        ? `${KEYS.HAS_SEEN_ONBOARDING_PREMIUM}:${userId}`
        : KEYS.HAS_SEEN_ONBOARDING_PREMIUM
);

/**
 * Get current user from storage
 * @returns {object|null} User object or null
 */
export const getUser = () => {
    try {
        const userStr = storage.getString(KEYS.USER);
        return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
        console.error('Error getting user from storage:', error);
        return null;
    }
};

export const markLiveChatActive = (userId) => {
    if (!userId) return;
    storage.set(KEYS.ACTIVE_LIVE_CHAT_USER, String(userId));
};

export const clearLiveChatActive = () => {
    storage.delete(KEYS.ACTIVE_LIVE_CHAT_USER);
};

export const shouldResumeLiveChat = (userId) => (
    Boolean(userId)
    && storage.getString(KEYS.ACTIVE_LIVE_CHAT_USER) === String(userId)
);

/**
 * Save user to storage and mark as authenticated
 * @param {object} user - User object with id, name, email, etc.
 */
export const saveUser = (user) => {
    try {
        storage.set(KEYS.USER, JSON.stringify(user));
        storage.set(KEYS.IS_AUTHENTICATED, true);
    } catch (error) {
        console.error('Error saving user to storage:', error);
    }
};

export const getAuthToken = () => storage.getString(KEYS.AUTH_TOKEN) || null;

export const setAuthToken = (token) => {
    if (token) {
        storage.set(KEYS.AUTH_TOKEN, token);
    } else {
        storage.delete(KEYS.AUTH_TOKEN);
    }
};

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
export const isAuthenticated = () => {
    try {
        return storage.getBoolean(KEYS.IS_AUTHENTICATED) === true;
    } catch (error) {
        return false;
    }
};

/**
 * Check if user has completed onboarding
 * @returns {boolean}
 */
export const isOnboarded = () => {
    try {
        return storage.getBoolean(KEYS.IS_ONBOARDED) === true;
    } catch (error) {
        return false;
    }
};

/**
 * Mark user as onboarded (completed profile setup)
 */
export const setOnboarded = (value = true) => {
    try {
        storage.set(KEYS.IS_ONBOARDED, value);
    } catch (error) {
        console.error('Error setting onboarded status:', error);
    }
};

/**
 * Update user data in storage
 * @param {object} updates - Partial user object to merge
 */
export const updateUser = (updates) => {
    try {
        const currentUser = getUser();
        if (currentUser) {
            const updatedUser = { ...currentUser, ...updates };
            storage.set(KEYS.USER, JSON.stringify(updatedUser));
            return updatedUser;
        }
        return null;
    } catch (error) {
        console.error('Error updating user:', error);
        return null;
    }
};

/**
 * Clear all auth data (logout)
 */
export const clearAuth = () => {
    try {
        clearLiveChatActive();
        storage.delete(KEYS.USER);
        storage.delete(KEYS.IS_AUTHENTICATED);
        storage.delete(KEYS.AUTH_TOKEN);
        storage.delete(KEYS.IS_ONBOARDED);
    } catch (error) {
        console.error('Error clearing auth:', error);
    }
};

/**
 * Check if user is paired with a partner
 * @returns {boolean}
 */
export const isPaired = () => {
    const user = getUser();
    return user?.partnerId != null;
};

/**
 * Get partner code from stored user
 * @returns {string|null}
 */
export const getPartnerCode = () => {
    const user = getUser();
    return user?.partnerCode || null;
};

/**
 * Check if user has seen the intro onboarding screens (first launch)
 * @returns {boolean}
 */
export const hasSeenOnboarding = () => {
    try {
        return storage.getBoolean(KEYS.HAS_SEEN_ONBOARDING) === true;
    } catch (error) {
        return false;
    }
};

/**
 * Mark that user has seen the intro onboarding screens
 * @param {boolean} value
 */
export const setSeenOnboarding = (value = true) => {
    try {
        storage.set(KEYS.HAS_SEEN_ONBOARDING, value);
    } catch (error) {
        console.error('Error setting seen onboarding status:', error);
    }
};

/**
 * Check whether this user has already been shown the one-time onboarding
 * premium offer.
 */
export const hasSeenOnboardingPremium = (userId) => {
    try {
        return storage.getBoolean(getOnboardingPremiumKey(userId)) === true;
    } catch (error) {
        return false;
    }
};

/** Mark the one-time onboarding premium offer as shown for this user. */
export const setSeenOnboardingPremium = (userId, value = true) => {
    try {
        storage.set(getOnboardingPremiumKey(userId), value);
    } catch (error) {
        console.error('Error setting onboarding premium status:', error);
    }
};

export default {
    storage,
    getUser,
    markLiveChatActive,
    clearLiveChatActive,
    shouldResumeLiveChat,
    saveUser,
    getAuthToken,
    setAuthToken,
    isAuthenticated,
    isOnboarded,
    setOnboarded,
    updateUser,
    clearAuth,
    isPaired,
    getPartnerCode,
    hasSeenOnboarding,
    setSeenOnboarding,
    hasSeenOnboardingPremium,
    setSeenOnboardingPremium,
};
