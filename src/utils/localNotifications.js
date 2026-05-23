import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import { storage } from './authStorage';

const CHANNEL_ID = 'partner-updates';
const PENDING_LOCAL_NOTIFICATION_KEY = 'pending_local_notification_route';

let channelReady = false;

const stringifyData = (data = {}) => Object.fromEntries(
    Object.entries(data)
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key, value]) => [key, String(value)])
);

export const ensureLocalNotificationSetup = async () => {
    await notifee.requestPermission();

    if (!channelReady) {
        await notifee.createChannel({
            id: CHANNEL_ID,
            name: 'Partner updates',
            importance: AndroidImportance.HIGH,
            sound: 'default',
            vibration: true,
        });
        channelReady = true;
    }
};

export const showLocalNotification = async ({ title, body, data }) => {
    await ensureLocalNotificationSetup();

    return notifee.displayNotification({
        title,
        body,
        data: stringifyData(data),
        android: {
            channelId: CHANNEL_ID,
            pressAction: {
                id: 'default',
            },
            importance: AndroidImportance.HIGH,
        },
        ios: {
            sound: 'default',
            foregroundPresentationOptions: {
                alert: true,
                badge: true,
                sound: true,
            },
        },
    });
};

export const onLocalNotificationPress = (handler) => notifee.onForegroundEvent(({ type, detail }) => {
    if (type === EventType.PRESS && detail.notification?.data) {
        handler({ data: detail.notification.data });
    }
});

export const getInitialLocalNotification = async () => {
    const initial = await notifee.getInitialNotification();
    const data = initial?.notification?.data;
    return data ? { data } : null;
};

export const getPendingLocalNotificationRoute = () => {
    try {
        const value = storage.getString(PENDING_LOCAL_NOTIFICATION_KEY);
        return value ? JSON.parse(value) : null;
    } catch {
        return null;
    }
};

export const clearPendingLocalNotificationRoute = () => {
    storage.delete(PENDING_LOCAL_NOTIFICATION_KEY);
};

export const setLocalNotificationBackgroundHandler = () => {
    notifee.onBackgroundEvent(async ({ type, detail }) => {
        if (type === EventType.PRESS && detail.notification?.data) {
            storage.set(
                PENDING_LOCAL_NOTIFICATION_KEY,
                JSON.stringify({ data: detail.notification.data })
            );
        }
    });
};

export default {
    ensureLocalNotificationSetup,
    showLocalNotification,
    onLocalNotificationPress,
    getInitialLocalNotification,
    getPendingLocalNotificationRoute,
    clearPendingLocalNotificationRoute,
    setLocalNotificationBackgroundHandler,
};
