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
    onTokenRefresh,
    onMessage,
    registerDeviceForRemoteMessages,
    AuthorizationStatus,
} from '@react-native-firebase/messaging';
import { getUser } from './authStorage';
import { API_BASE } from '../constants/Api';

/**
 * Request notification permissions
 */
export const requestNotificationPermission = async () => {
    try {
        if (Platform.OS === 'ios') {
            const status = await requestPermission(getMessaging(getApp()));
            const enabled =
                status === AuthorizationStatus.AUTHORIZED ||
                status === AuthorizationStatus.PROVISIONAL;
            console.log('📱 Notification permission:', enabled ? 'granted' : 'denied');
            return enabled;
        }

        // Android 13+ requires runtime permission
        if (Platform.OS === 'android' && Platform.Version >= 33) {
            const result = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
            );
            const enabled = result === PermissionsAndroid.RESULTS.GRANTED;
            console.log('📱 Notification permission:', enabled ? 'granted' : 'denied');
            return enabled;
        }

        // Android < 13 doesn't need explicit permission
        return true;
    } catch (error) {
        console.log('⚠️ Permission request failed:', error.message);
        return false;
    }
};

/**
 * Get FCM token and register with backend
 */
export const registerFCMToken = async () => {
    console.log('🔄 Starting FCM token registration...');

    try {
        // Only needed on Android - iOS auto-registers for remote messages
        if (Platform.OS === 'android') {
            try {
                console.log('📱 Registering device for remote messages...');
                await registerDeviceForRemoteMessages(getMessaging(getApp()));
                console.log('✅ Device registered for remote messages');
            } catch (e) {
                console.warn('⚠️ Failed to register device for remote messages:', e.message);
            }
        }

        // Request permission first
        const hasPermission = await requestNotificationPermission();
        if (!hasPermission) {
            console.log('⚠️ Notification permission not granted');
            return null;
        }

        // Get FCM token using modular API
        console.log('🔑 Getting FCM token...');
        const token = await getToken(getMessaging(getApp()));
        console.log('🔑 FCM Token obtained:', token?.slice(0, 30) + '...');

        if (!token) {
            console.error('❌ Failed to get FCM token');
            return null;
        }

        // Get current user
        const user = getUser();
        if (!user?.id) {
            console.log('⚠️ User not logged in, skipping FCM registration');
            return token;
        }

        // Register token with backend
        console.log('📤 Registering FCM token with backend for user:', user.id);
        const response = await fetch(`${API_BASE}/api/user/fcm-token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: user.id,
                fcmToken: token
            }),
        });
        console.log('response', response);

        if (response.ok) {
            console.log('✅ FCM token registered with backend successfully!');
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
            console.log('🔄 FCM Token refreshed');
            await registerFCMToken();
        });
    } catch (error) {
        console.log('⚠️ Token refresh listener failed:', error.message);
        return null;
    }
};

/**
 * Handle foreground messages
 */
export const setupForegroundMessageHandler = () => {
    try {
        return onMessage(getMessaging(getApp()), async (remoteMessage) => {
            console.log('📩 FCM Message received in foreground:', remoteMessage);
        });
    } catch (error) {
        console.log('⚠️ Foreground message handler failed:', error.message);
        return null;
    }
};

export default {
    requestNotificationPermission,
    registerFCMToken,
    setupTokenRefreshListener,
    setupForegroundMessageHandler,
};
