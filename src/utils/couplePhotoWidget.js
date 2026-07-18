import { NativeModules } from 'react-native';

const { ScribbleWidgetBridge } = NativeModules;

export const syncCouplePhotoWidget = async (photo, senderName = 'Your partner') => {
    if (!photo?.imageUrl || !ScribbleWidgetBridge?.savePartnerPhoto) return false;
    try {
        await ScribbleWidgetBridge.savePartnerPhoto(photo.imageUrl, {
            senderName,
            timestamp: photo.updatedAt || new Date().toISOString(),
            revision: Number(photo.revision) || Date.now(),
        });
        return true;
    } catch (error) {
        console.warn('Failed to sync partner photo widget:', error?.message || error);
        return false;
    }
};

export const clearCouplePhotoWidget = async () => {
    if (!ScribbleWidgetBridge?.clearPartnerPhoto) return false;
    try {
        await ScribbleWidgetBridge.clearPartnerPhoto();
        return true;
    } catch (error) {
        console.warn('Failed to clear partner photo widget:', error?.message || error);
        return false;
    }
};
