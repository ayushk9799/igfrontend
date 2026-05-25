import { Platform } from 'react-native';

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
    };
};
