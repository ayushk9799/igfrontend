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

setBackgroundMessageHandler(getMessaging(getApp()), async () => {
    // FCM displays visible notifications from the native payload. Routing is
    // handled when the user opens the notification in AppNavigator.
});

setLocalNotificationBackgroundHandler();

AppRegistry.registerComponent(appName, () => App);
