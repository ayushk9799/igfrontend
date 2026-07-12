import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { API_BASE } from '../constants/Api';
import { getUser, updateUser as updateStoredUser } from './authStorage';
import { reportWidgetIntent, syncNativeWidgetStatus } from '../api/widgetStatusApi';

const getUserId = (user) => user?._id || user?.id || null;

const getInitial = (...values) => {
    const value = values.find((item) => typeof item === 'string' && item.trim().length > 0);
    return value?.trim()?.charAt(0)?.toUpperCase() || '?';
};

const getDistanceWidgetIdentity = (user = {}) => ({
    userInitial: getInitial(user.nickname, user.name, user.email),
    partnerInitial: getInitial(user.partnerNickname, user.partnerUsername, user.partnerName),
    userName: user.nickname || user.name || '',
    partnerName: user.partnerNickname || user.partnerUsername || user.partnerName || '',
});

const isDateActive = (dateStr) => !!(dateStr && new Date(dateStr) > new Date());

const hasDistanceWidgetPremium = (user = {}) => (
    user?.isPremium === true
    || isDateActive(user?.premiumExpiresAt)
    || isDateActive(user?.partnerPremiumExpiresAt)
);

const createLocationPermissionError = (code, message) => {
    const error = new Error(message);
    error.code = code;
    error.isLocationPermissionError = true;
    return error;
};

const normalizeLocationPermissionError = (error) => {
    const code = error?.code || error?.nativeStackIOS?.[0]?.code;

    if (code === 'LOCATION_DISABLED') {
        return createLocationPermissionError(
            'LOCATION_DISABLED',
            'Location services are turned off. Please enable Location Services in Settings.'
        );
    }

    if (code === 'LOCATION_BLOCKED' || code === 'LOCATION_DENIED') {
        return createLocationPermissionError(
            'LOCATION_BLOCKED',
            'Location permission is blocked. Please enable location access in Settings.'
        );
    }

    if (code === 'LOCATION_ALWAYS_REQUIRED') {
        return createLocationPermissionError(
            'LOCATION_ALWAYS_REQUIRED',
            'Background updates need location permission set to Always in Settings.'
        );
    }

    return error;
};

export const isLocationSettingsError = (error) => (
    error?.code === 'LOCATION_BLOCKED'
    || error?.code === 'LOCATION_DISABLED'
    || error?.code === 'LOCATION_ALWAYS_REQUIRED'
);

const ensureAndroidLocationPermission = async () => {
    const finePermission = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
    const coarsePermission = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;

    const hasFine = await PermissionsAndroid.check(finePermission);
    const hasCoarse = await PermissionsAndroid.check(coarsePermission);
    if (hasFine || hasCoarse) {
        return true;
    }

    const result = await PermissionsAndroid.request(finePermission, {
        title: 'Location Permission',
        message: 'Location access is needed to show the distance between you and your partner.',
        buttonPositive: 'Allow',
        buttonNegative: 'Not Now',
    });

    if (result === PermissionsAndroid.RESULTS.GRANTED) {
        return true;
    }

    if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        throw createLocationPermissionError(
            'LOCATION_BLOCKED',
            'Location permission is blocked. Please enable location access in Settings.'
        );
    }

    throw createLocationPermissionError(
        'LOCATION_DENIED',
        'Location permission was denied. Please allow it to enable the Distance widget.'
    );
};

const ensureAndroidBackgroundLocationPermission = async () => {
    if (Platform.OS !== 'android' || Number(Platform.Version) < 29) {
        return true;
    }

    const backgroundPermission = PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION;
    const hasBackground = await PermissionsAndroid.check(backgroundPermission);
    if (hasBackground) {
        return true;
    }

    if (Number(Platform.Version) >= 30) {
        throw createLocationPermissionError(
            'LOCATION_ALWAYS_REQUIRED',
            'Background distance updates need Location set to Allow all the time in Settings.'
        );
    }

    const result = await PermissionsAndroid.request(backgroundPermission, {
        title: 'Background Location Permission',
        message: 'Allow location all the time so the Distance widget can update when the app is closed.',
        buttonPositive: 'Allow',
        buttonNegative: 'Not Now',
    });

    if (result === PermissionsAndroid.RESULTS.GRANTED) {
        return true;
    }

    throw createLocationPermissionError(
        'LOCATION_ALWAYS_REQUIRED',
        'Background distance updates need Location set to Allow all the time in Settings.'
    );
};

const ensureLocationPermission = async () => {
    if (Platform.OS === 'android') {
        return ensureAndroidLocationPermission();
    }

    return true;
};

const readJsonResponse = async (response, fallbackMessage) => {
    const text = await response.text();
    try {
        return text ? JSON.parse(text) : {};
    } catch {
        throw new Error(`${fallbackMessage} (${response.status})`);
    }
};

export const saveDistanceWidgetData = async (distanceData) => {
    if (!['ios', 'android'].includes(Platform.OS)) {
        return;
    }

    const { ScribbleWidgetBridge } = NativeModules;
    if (!ScribbleWidgetBridge?.saveDistanceWidgetData) {
        throw new Error('Distance widget bridge is not available. Rebuild the iOS app.');
    }

    await ScribbleWidgetBridge.saveDistanceWidgetData({
        ...distanceData,
        updatedAt: new Date().toISOString(),
    });
};

export const saveLockedDistanceWidgetData = async (user = {}) => {
    const identity = getDistanceWidgetIdentity(user);

    await saveDistanceWidgetData({
        locked: true,
        isPremium: false,
        userInitial: identity.userInitial,
        partnerInitial: identity.partnerInitial,
        userName: identity.userName,
        partnerName: identity.partnerName,
    });
};

export const refreshDistanceWidgetSnapshot = async (user = getUser()) => {
    if (!['ios', 'android'].includes(Platform.OS)) {
        return { skipped: true, reason: 'unsupported_platform' };
    }

    const activeUser = user || getUser();
    const userId = getUserId(activeUser);
    const identity = getDistanceWidgetIdentity(activeUser);

    if (!userId) {
        return { skipped: true, reason: 'missing_user' };
    }

    if (!hasDistanceWidgetPremium(activeUser)) {
        await saveLockedDistanceWidgetData(activeUser);
        return { skipped: true, reason: 'premium_required' };
    }

    const distanceResponse = await fetch(`${API_BASE}/api/user/distance/${userId}`);
    const distanceJson = await readJsonResponse(distanceResponse, 'Failed to fetch partner distance.');
    if (!distanceResponse.ok || !distanceJson.success) {
        throw new Error(distanceJson.error || 'Failed to fetch partner distance.');
    }

    await saveDistanceWidgetData({
        ...distanceJson.data,
        locked: false,
        isPremium: true,
        userInitial: distanceJson.data?.userInitial || identity.userInitial,
        partnerInitial: distanceJson.data?.partnerInitial || identity.partnerInitial,
    });
    syncNativeWidgetStatus(activeUser).catch(() => {});

    return {
        distance: distanceJson.data,
    };
};

export const startDistanceBackgroundUpdates = async (user = getUser()) => {
    if (!['ios', 'android'].includes(Platform.OS)) {
        return;
    }

    const activeUser = user || getUser();
    if (activeUser?.locationSharingEnabled !== true) {
        return;
    }

    const { ScribbleWidgetBridge } = NativeModules;
    if (!ScribbleWidgetBridge?.startDistanceBackgroundUpdates) {
        return false;
    }

    try {
        return await ScribbleWidgetBridge.startDistanceBackgroundUpdates();
    } catch (error) {
        throw normalizeLocationPermissionError(error);
    }
};

export const stopDistanceBackgroundUpdates = async () => {
    const { ScribbleWidgetBridge } = NativeModules;
    if (!ScribbleWidgetBridge?.stopDistanceBackgroundUpdates) {
        return;
    }

    try {
        await ScribbleWidgetBridge.stopDistanceBackgroundUpdates();
    } catch {
        // No-op.
    }
};

export const syncDistanceWidgetLocation = async ({
    user,
    enableSharing = false,
    enableBackgroundUpdates = false,
} = {}) => {
    if (!['ios', 'android'].includes(Platform.OS)) {
        return { skipped: true, reason: 'unsupported_platform' };
    }

    const activeUser = user || getUser();
    const userId = getUserId(activeUser);

    if (!userId) {
        return { skipped: true, reason: 'missing_user' };
    }

    if (!hasDistanceWidgetPremium(activeUser)) {
        await saveLockedDistanceWidgetData(activeUser);
        return { skipped: true, reason: 'premium_required' };
    }

    if (!enableSharing && activeUser?.locationSharingEnabled !== true) {
        return { skipped: true, reason: 'sharing_disabled' };
    }

    const { ScribbleWidgetBridge } = NativeModules;
    if (!ScribbleWidgetBridge?.requestCurrentLocation) {
        throw new Error('Distance widget location bridge is not available. Rebuild the app.');
    }

    await ensureLocationPermission();

    let location;
    try {
        location = await ScribbleWidgetBridge.requestCurrentLocation();
    } catch (error) {
        throw normalizeLocationPermissionError(error);
    }
    const locationResponse = await fetch(`${API_BASE}/api/user/location`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId,
            latitude: location.latitude,
            longitude: location.longitude,
            sharingEnabled: true,
        }),
    });
    const locationJson = await readJsonResponse(locationResponse, 'Failed to update location.');
    if (!locationResponse.ok || !locationJson.success) {
        throw new Error(locationJson.error || 'Failed to update location.');
    }

    const locationUpdates = locationJson.user ? {
        locationSharingEnabled: locationJson.user.locationSharingEnabled,
        locationUpdatedAt: locationJson.user.locationUpdatedAt,
    } : null;

    if (locationUpdates) {
        updateStoredUser(locationUpdates);
    }

    const updatedUser = {
        ...activeUser,
        ...(locationUpdates || {}),
    };

    const snapshot = await refreshDistanceWidgetSnapshot(updatedUser);
    reportWidgetIntent('distance', updatedUser).catch(() => {});
    let backgroundUpdatesStarted = false;
    let backgroundUpdatesError = null;
    if (enableBackgroundUpdates) {
        try {
            if (Platform.OS === 'android') {
                await ensureAndroidBackgroundLocationPermission();
            }
            backgroundUpdatesStarted = await startDistanceBackgroundUpdates(updatedUser);
        } catch (error) {
            backgroundUpdatesError = normalizeLocationPermissionError(error);
        }
    }

    return {
        user: locationUpdates,
        distance: snapshot.distance,
        backgroundUpdatesStarted,
        backgroundUpdatesError,
    };
};
