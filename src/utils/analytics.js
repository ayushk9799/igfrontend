/**
 * Analytics Service
 * Handles screen tracking, user actions, session timelines, and user identity
 * Using modular Firebase Analytics API matching existing Firebase setup
 */
import { getApp } from '@react-native-firebase/app';
import {
    getAnalytics,
    logEvent as firebaseLogEvent,
    logScreenView as firebaseLogScreenView,
    setUserId as firebaseSetUserId,
    setUserProperty as firebaseSetUserProperty,
    resetAnalyticsData as firebaseResetAnalyticsData,
} from '@react-native-firebase/analytics';

/**
 * Safely retrieve the Analytics instance
 */
let cachedAnalytics = null;
const getAnalyticsSafe = () => {
    if (cachedAnalytics) return cachedAnalytics;
    try {
        const app = getApp();
        if (app) {
            cachedAnalytics = getAnalytics(app);
            return cachedAnalytics;
        }
    } catch (e) {
        // App might not be initialized yet in early lifecycle
    }
    return null;
};

/**
 * Track a screen view transition
 * @param {string} screenName - Screen identifier (e.g. 'HomeScreen')
 * @param {string} [screenClass] - Optional class identifier, defaults to screenName
 */
export const trackScreen = async (screenName, screenClass = screenName) => {
    if (!screenName) return;
    try {
        const analytics = getAnalyticsSafe();
        if (analytics) {
            await firebaseLogScreenView(analytics, {
                screen_name: String(screenName),
                screen_class: String(screenClass),
            });
        }
    } catch (error) {
        console.warn(`[Analytics] Failed to track screen view: ${screenName}`, error?.message || error);
    }
};

/**
 * Track a custom event
 * @param {string} eventName - Name of the event (letters, numbers, underscores, max 40 chars)
 * @param {Object} [params] - Key-value parameters describing the event
 */
export const trackEvent = async (eventName, params = {}) => {
    if (!eventName) return;
    try {
        const analytics = getAnalyticsSafe();
        if (analytics) {
            // Clean undefined/null params for Firebase safety
            const cleanedParams = {};
            for (const [key, value] of Object.entries(params)) {
                if (value !== undefined && value !== null) {
                    cleanedParams[key] = typeof value === 'object' ? JSON.stringify(value) : value;
                }
            }
            await firebaseLogEvent(analytics, eventName, cleanedParams);
        }
    } catch (error) {
        console.warn(`[Analytics] Failed to track event: ${eventName}`, error?.message || error);
    }
};

/**
 * Identify a user across sessions
 * @param {string} userId - Unique identifier (e.g. MongoDB user._id)
 * @param {Object} [userProperties] - Additional persistent user attributes
 */
export const setAnalyticsUser = async (userId, userProperties = {}) => {
    try {
        const analytics = getAnalyticsSafe();
        if (analytics) {
            await firebaseSetUserId(analytics, userId ? String(userId) : null);

            for (const [name, val] of Object.entries(userProperties)) {
                if (val !== undefined && val !== null) {
                    await firebaseSetUserProperty(analytics, name, String(val));
                }
            }
        }
    } catch (error) {
        console.warn('[Analytics] Failed to set user identity:', error?.message || error);
    }
};

/**
 * Clear user data and reset device analytics identifier on logout
 */
export const clearAnalyticsUser = async () => {
    try {
        const analytics = getAnalyticsSafe();
        if (analytics) {
            await firebaseSetUserId(analytics, null);
            await firebaseResetAnalyticsData(analytics);
        }
    } catch (error) {
        console.warn('[Analytics] Failed to reset analytics data:', error?.message || error);
    }
};
