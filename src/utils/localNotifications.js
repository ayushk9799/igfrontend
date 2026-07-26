import notifee, { AndroidImportance, EventType, TriggerType } from '@notifee/react-native';
import { storage } from './authStorage';
import { translateUiText } from '../i18n/uiTranslation';

const CHANNEL_ID = 'partner-updates';
const PENDING_LOCAL_NOTIFICATION_KEY = 'pending_local_notification_route';
const PARTNER_INVITE_REMINDER_KEY = 'partner_invite_reminder_schedule';
const PARTNER_INVITE_REMINDER_IDS = [
    'partner_invite_reminder_day_1',
    'partner_invite_reminder_day_3',
    'partner_invite_reminder_day_7',
    'partner_invite_reminder_day_14',
];
const PARTNER_INVITE_REMINDERS = [
    {
        id: PARTNER_INVITE_REMINDER_IDS[0],
        delayMs: 12 * 60 * 60 * 1000,
        title: "Connect now!",
        body: 'Penguin Couple is no fun without a partner.',
    },
    {
        id: PARTNER_INVITE_REMINDER_IDS[1],
        delayMs: 36 * 60 * 60 * 1000,
        title: "Connect now!",
        body: 'Penguin Couple is no fun without a partner.',
    },
    {
        id: PARTNER_INVITE_REMINDER_IDS[2],
        daysFromNow: 3,
        title: "Connect now!",
        body: 'Penguin Couple is no fun without a partner.',
    },
    {
        id: PARTNER_INVITE_REMINDER_IDS[3],
        daysFromNow: 7,
        title: "Connect now!",
        body: 'Penguin Couple is no fun without a partner.',
    },
];
const DAY_MS = 24 * 60 * 60 * 1000;

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
            name: translateUiText("Partner updates"),
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

export const cancelPartnerInviteReminders = async () => {
    storage.delete(PARTNER_INVITE_REMINDER_KEY);
    await notifee.cancelTriggerNotifications(PARTNER_INVITE_REMINDER_IDS);
};

export const schedulePartnerInviteReminders = async ({ userId, partnerCode }) => {
    if (!userId) return false;

    const existingSchedule = (() => {
        try {
            const value = storage.getString(PARTNER_INVITE_REMINDER_KEY);
            return value ? JSON.parse(value) : null;
        } catch {
            return null;
        }
    })();
    const scheduledIds = await notifee.getTriggerNotificationIds();
    const hasAllReminders = PARTNER_INVITE_REMINDER_IDS.every((id) => scheduledIds.includes(id));

    if (existingSchedule?.userId === userId && hasAllReminders) {
        return true;
    }

    await cancelPartnerInviteReminders();
    await ensureLocalNotificationSetup();

    const now = Date.now();
    const data = {
        type: 'partner_invite_reminder',
        screen: 'partnerCode',
        partnerCode,
    };

    await Promise.all(PARTNER_INVITE_REMINDERS.map((reminder) => (
        notifee.createTriggerNotification(
            {
                id: reminder.id,
                title: translateUiText(reminder.title),
                body: translateUiText(reminder.body),
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
                },
            },
            {
                type: TriggerType.TIMESTAMP,
                timestamp: now + (reminder.delayMs || reminder.daysFromNow * DAY_MS),
            }
        )
    )));

    storage.set(PARTNER_INVITE_REMINDER_KEY, JSON.stringify({
        userId,
        partnerCode: partnerCode || null,
        scheduledAt: new Date(now).toISOString(),
        reminderIds: PARTNER_INVITE_REMINDER_IDS,
    }));

    return true;
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
    schedulePartnerInviteReminders,
    cancelPartnerInviteReminders,
    onLocalNotificationPress,
    getInitialLocalNotification,
    getPendingLocalNotificationRoute,
    clearPendingLocalNotificationRoute,
    setLocalNotificationBackgroundHandler,
};
