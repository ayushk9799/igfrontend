import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

export const getDeviceInfo = () => {
    let timezone = null;

    try {
        timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch (error) {
        timezone = null;
    }

    return {
        platform: Platform.OS,
        timezone,
        appVersion: DeviceInfo.getVersion(),
        appBuildNumber: Number.parseInt(DeviceInfo.getBuildNumber(), 10) || 0,
    };
};
