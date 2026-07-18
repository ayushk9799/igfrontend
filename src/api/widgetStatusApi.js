import { NativeModules, Platform } from 'react-native';
import { API_BASE } from '../constants/Api';
import { getUser } from '../utils/authStorage';

const WIDGET_TYPES = ['scribble', 'togetherDays', 'togetherCountdown', 'distance', 'couplePhoto'];

const getUserId = (user) => user?._id || user?.id || null;

const safeRequest = async (path, options = {}) => {
    try {
        const response = await fetch(`${API_BASE}${path}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(options.headers || {}),
            },
        });
        const data = await response.json();
        return response.ok && data?.success ? data : null;
    } catch {
        return null;
    }
};

export const reportWidgetStatus = async ({
    user,
    userId = getUserId(user || getUser()),
    platform = Platform.OS,
    source = 'app',
    widgets,
} = {}) => {
    if (!userId || !widgets || typeof widgets !== 'object') {
        return null;
    }

    return safeRequest('/api/user/widgets/status', {
        method: 'PUT',
        body: JSON.stringify({
            userId,
            platform,
            source,
            widgets,
        }),
    });
};

export const reportWidgetIntent = async (widgetType, user = getUser()) => {
    if (!WIDGET_TYPES.includes(widgetType)) {
        return null;
    }

    return reportWidgetStatus({
        user,
        source: 'app',
        widgets: {
            [widgetType]: { intentEnabled: true },
        },
    });
};

export const configureNativeWidgetTracking = async (user = getUser()) => {
    if (!['ios', 'android'].includes(Platform.OS)) {
        return;
    }

    const userId = getUserId(user);
    const { ScribbleWidgetBridge } = NativeModules;
    if (!userId || !ScribbleWidgetBridge?.setWidgetTrackingContext) {
        return;
    }

    try {
        await ScribbleWidgetBridge.setWidgetTrackingContext(String(userId), API_BASE);
    } catch {
        // Widget metrics should never block the app.
    }
};

export const syncNativeWidgetStatus = async (user = getUser()) => {
    if (!['ios', 'android'].includes(Platform.OS)) {
        return null;
    }

    const userId = getUserId(user);
    const { ScribbleWidgetBridge } = NativeModules;
    if (!userId || !ScribbleWidgetBridge?.getWidgetConfigurations) {
        return null;
    }

    try {
        await configureNativeWidgetTracking(user);
        const widgets = await ScribbleWidgetBridge.getWidgetConfigurations();
        if (!widgets || typeof widgets !== 'object') {
            return null;
        }

        return reportWidgetStatus({
            userId,
            platform: Platform.OS,
            source: 'native',
            widgets,
        });
    } catch {
        return null;
    }
};

export const fetchWidgetStats = async () => safeRequest('/api/user/widgets/stats');
