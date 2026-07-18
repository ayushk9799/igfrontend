import { NativeModules } from 'react-native';

const { ScribbleWidgetBridge } = NativeModules;

const savePhoto = async (method, photo, metadata) => {
    if (!photo?.imageUrl || !ScribbleWidgetBridge?.[method]) return false;
    try {
        await ScribbleWidgetBridge[method](photo.imageUrl, {
            ...metadata,
            timestamp: photo.updatedAt || new Date().toISOString(),
            revision: Number(photo.revision) || Date.now(),
        });
        return true;
    } catch (error) {
        console.warn('Failed to sync couple photo widget:', error?.message || error);
        return false;
    }
};

const clearPhoto = async (method) => {
    if (!ScribbleWidgetBridge?.[method]) return false;
    try {
        await ScribbleWidgetBridge[method]();
        return true;
    } catch (error) {
        console.warn('Failed to clear couple photo widget:', error?.message || error);
        return false;
    }
};

export const syncCouplePhotoWidget = async ({ partnerPhoto, myPhoto }, senderName = 'Your partner') => {
    const results = await Promise.all([
        partnerPhoto?.imageUrl
            ? savePhoto('savePartnerPhoto', partnerPhoto, { senderName })
            : clearPhoto('clearPartnerPhoto'),
        myPhoto?.imageUrl
            ? savePhoto('saveMyPhoto', myPhoto, {})
            : clearPhoto('clearMyPhoto'),
    ]);
    return results.some(Boolean);
};

export const clearCouplePhotoWidget = async () => {
    if (!ScribbleWidgetBridge?.clearPartnerPhoto) return false;
    try {
        await Promise.all([
            ScribbleWidgetBridge.clearPartnerPhoto(),
            ScribbleWidgetBridge.clearMyPhoto?.(),
        ]);
        return true;
    } catch (error) {
        console.warn('Failed to clear partner photo widget:', error?.message || error);
        return false;
    }
};
