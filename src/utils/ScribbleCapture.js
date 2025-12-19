// Scribble Capture Utility
// Captures scribble view as image and saves to App Group for widget access
import { captureRef } from 'react-native-view-shot';
import { NativeModules, Platform } from 'react-native';

const { ScribbleWidgetBridge } = NativeModules;

/**
 * Capture a scribble view as PNG and save to shared storage for widget
 * @param {React.RefObject} viewRef - Ref to the view containing the scribble SVG
 * @param {object} metadata - Additional data like sender name, timestamp
 * @returns {Promise<boolean>} - Success status
 */
export const captureAndSaveScribble = async (viewRef, metadata = {}) => {
    if (!viewRef?.current) {
        console.warn('⚠️ No view ref provided for capture');
        return false;
    }

    try {
        // Capture the view as a PNG
        const uri = await captureRef(viewRef, {
            format: 'png',
            quality: 1,
            result: 'tmpfile',
        });

        console.log('📸 Scribble captured:', uri);

        // Save to App Group (iOS) or shared storage (Android)
        if (Platform.OS === 'ios' && ScribbleWidgetBridge) {
            await ScribbleWidgetBridge.saveScribbleImage(uri, {
                senderName: metadata.fromUserName || 'Your Love',
                timestamp: metadata.timestamp || new Date().toISOString(),
            });
            console.log('✅ Scribble saved to App Group');

            // Trigger widget refresh
            await ScribbleWidgetBridge.refreshWidget();
            console.log('🔄 Widget refresh triggered');

            return true;
        } else {
            console.log('⚠️ Widget bridge not available');
            return false;
        }
    } catch (error) {
        console.error('❌ Scribble capture error:', error);
        return false;
    }
};

/**
 * Refresh the widget without capturing new image
 */
export const refreshScribbleWidget = async () => {
    if (Platform.OS === 'ios' && ScribbleWidgetBridge) {
        try {
            await ScribbleWidgetBridge.refreshWidget();
            return true;
        } catch (error) {
            console.error('❌ Widget refresh error:', error);
            return false;
        }
    }
    return false;
};

export default {
    captureAndSaveScribble,
    refreshScribbleWidget,
};
