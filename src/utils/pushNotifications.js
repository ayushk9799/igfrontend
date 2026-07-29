/**
 * Push Notification Service
 * Handles FCM token registration and push notification setup
 * Using modular Firebase API (same pattern as gtdfront)
 */
import { Platform, PermissionsAndroid } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import {
    getMessaging,
    getToken,
    requestPermission,
    hasPermission,
    onTokenRefresh,
    onMessage,
    registerDeviceForRemoteMessages,
    AuthorizationStatus,
    onNotificationOpenedApp,
    getInitialNotification,
} from '@react-native-firebase/messaging';
import { getUser } from './authStorage';
import { API_BASE } from '../constants/Api';
import { getDeviceInfo } from './deviceInfo';
import { getContentLanguage } from '../i18n/uiTranslation';
import { apiFetch } from './apiFetch';

/**
 * Check if notification permission is already granted (silent - no dialog)
 */
export const checkNotificationPermission = async () => {
    try {
        if (Platform.OS === 'ios') {
            // Use hasPermission for a silent check — does NOT trigger the system dialog
            const status = await hasPermission(getMessaging(getApp()));
            const enabled =
                status === AuthorizationStatus.AUTHORIZED ||
                status === AuthorizationStatus.PROVISIONAL;
            return enabled;
        }

        // Android 13+ - silently CHECK without triggering system dialog
        if (Platform.OS === 'android' && Platform.Version >= 33) {
            const granted = await PermissionsAndroid.check(
                PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
            );
            return granted;
        }

        // Android < 13 doesn't need explicit permission
        return true;
    } catch (error) {
        return false;
    }
};

/**
 * Request notification permissions (shows system dialog if not yet granted)
 */
export const requestNotificationPermission = async () => {
    try {
        if (Platform.OS === 'ios') {
            const status = await requestPermission(getMessaging(getApp()));
            const enabled =
                status === AuthorizationStatus.AUTHORIZED ||
                status === AuthorizationStatus.PROVISIONAL;
            return enabled;
        }

        // Android 13+ requires runtime permission
        if (Platform.OS === 'android' && Platform.Version >= 33) {
            const result = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
            );
            const enabled = result === PermissionsAndroid.RESULTS.GRANTED;
            return enabled;
        }

        // Android < 13 doesn't need explicit permission
        return true;
    } catch (error) {
        return false;
    }
};

/**
 * Get FCM token and register with backend
 */
export const registerFCMToken = async () => {

    try {
        // Only needed on Android - iOS auto-registers for remote messages
        // UPDATE: iOS also needs this for full APNs integration with Firebase
        try {
            if (!getMessaging().isDeviceRegisteredForRemoteMessages) {
                await registerDeviceForRemoteMessages(getMessaging(getApp()));
            }
        } catch (e) {
            console.warn('⚠️ Failed to register device for remote messages:', e.message);
        }

        // Check permission silently (don't trigger system dialog)
        const hasPermission = await checkNotificationPermission();
        if (!hasPermission) {
            return null;
        }

        // Get FCM token using modular API
        const token = await getToken(getMessaging(getApp()));

        if (!token) {
            console.error('❌ Failed to get FCM token');
            return null;
        }

        // Get current user
        const user = getUser();
        if (!user?.id) {
            return token;
        }

        // Register token with backend
        const deviceInfo = getDeviceInfo();
        const response = await apiFetch(`${API_BASE}/api/user/fcm-token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: user.id,
                fcmToken: token,
                preferredLanguage: getContentLanguage(),
                ...deviceInfo,
            }),
        });

        if (response.ok) {
        } else {
            console.error('❌ Failed to register FCM token:', response.status);
        }

        return token;

    } catch (error) {
        console.error('❌ FCM registration error:', error.message);
        return null;
    }
};

/**
 * Listen for token refresh and update backend
 */
export const setupTokenRefreshListener = () => {
    try {
        return onTokenRefresh(getMessaging(getApp()), async (token) => {
            await registerFCMToken();
        });
    } catch (error) {
        return null;
    }
};

/**
 * Handle foreground messages
 */
export const setupForegroundMessageHandler = (onMessageReceived) => {
    try {
        return onMessage(getMessaging(getApp()), async (remoteMessage) => {
            if (onMessageReceived) {
                onMessageReceived(remoteMessage);
            }
        });
    } catch (error) {
        return null;
    }
};

export {
    onMessage,
    onNotificationOpenedApp,
    getInitialNotification,
    getMessaging
};

export default {
    checkNotificationPermission,
    requestNotificationPermission,
    registerFCMToken,
    setupTokenRefreshListener,
    setupForegroundMessageHandler,
    onNotificationOpenedApp,
    getInitialNotification
};
