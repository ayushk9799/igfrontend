/**
 * @format
 */

import { AppRegistry } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import './src/constants/applyGlobalFonts';
import App from './App';
import { name as appName } from './app.json';
import { setLocalNotificationBackgroundHandler } from './src/utils/localNotifications';
import { refreshDistanceWidgetSnapshot } from './src/utils/distanceWidgetSync';
import { syncCouplePhotoWidget } from './src/utils/couplePhotoWidget';

setBackgroundMessageHandler(getMessaging(getApp()), async (remoteMessage) => {
    if (remoteMessage?.data?.type === 'distance_widget_refresh') {
        await refreshDistanceWidgetSnapshot();
        return;
    }

    if (remoteMessage?.data?.type === 'couple_photo') {
        await syncCouplePhotoWidget({
            imageUrl: remoteMessage.data.imageUrl,
            revision: Number(remoteMessage.data.revision) || Date.now(),
            updatedAt: remoteMessage.data.timestamp || new Date().toISOString(),
        }, remoteMessage.data.senderName || 'Your partner');
        return;
    }

    // FCM displays visible notifications from the native payload. Routing is
    // handled when the user opens the notification in AppNavigator.
});

setLocalNotificationBackgroundHandler();

AppRegistry.registerComponent(appName, () => App);
