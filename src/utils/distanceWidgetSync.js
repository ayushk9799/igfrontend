import { NativeModules, Platform } from 'react-native';
import { API_BASE } from '../constants/Api';
import { getUser, updateUser as updateStoredUser } from './authStorage';

const getUserId = (user) => user?._id || user?.id || null;

export const saveDistanceWidgetData = async (distanceData) => {
    if (Platform.OS !== 'ios') {
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

export const syncDistanceWidgetLocation = async ({
    user,
    enableSharing = false,
} = {}) => {
    if (Platform.OS !== 'ios') {
        return { skipped: true, reason: 'ios_only' };
    }

    const activeUser = user || getUser();
    const userId = getUserId(activeUser);
    if (!userId) {
        return { skipped: true, reason: 'missing_user' };
    }

    if (!enableSharing && activeUser?.locationSharingEnabled !== true) {
        return { skipped: true, reason: 'sharing_disabled' };
    }

    const { ScribbleWidgetBridge } = NativeModules;
    if (!ScribbleWidgetBridge?.requestCurrentLocation) {
        throw new Error('Distance widget location bridge is not available. Rebuild the iOS app.');
    }

    const location = await ScribbleWidgetBridge.requestCurrentLocation();
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
    const locationJson = await locationResponse.json();
    if (!locationResponse.ok || !locationJson.success) {
        throw new Error(locationJson.error || 'Failed to update location.');
    }

    if (locationJson.user) {
        updateStoredUser(locationJson.user);
    }

    const distanceResponse = await fetch(`${API_BASE}/api/user/distance/${userId}`);
    const distanceJson = await distanceResponse.json();
    if (!distanceResponse.ok || !distanceJson.success) {
        throw new Error(distanceJson.error || 'Failed to fetch partner distance.');
    }

    await saveDistanceWidgetData(distanceJson.data);

    return {
        user: locationJson.user || null,
        distance: distanceJson.data,
    };
};
