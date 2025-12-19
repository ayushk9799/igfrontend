// Auth Storage - Persistent authentication state using MMKV
import { MMKV } from 'react-native-mmkv';

// Initialize MMKV storage
export const storage = new MMKV();

// Storage keys
const KEYS = {
    USER: 'auth_user',
    IS_AUTHENTICATED: 'auth_is_authenticated',
    IS_ONBOARDED: 'auth_is_onboarded',
};

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
        storage.delete(KEYS.USER);
        storage.delete(KEYS.IS_AUTHENTICATED);
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

export default {
    storage,
    getUser,
    saveUser,
    isAuthenticated,
    isOnboarded,
    setOnboarded,
    updateUser,
    clearAuth,
    isPaired,
    getPartnerCode,
};
