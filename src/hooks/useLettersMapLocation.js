import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Linking, PermissionsAndroid, Platform } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { getDistanceLocationPermissionStatus, isLocationSettingsError, requestDistanceForegroundLocation } from '../utils/distanceWidgetSync';
import { translateUiText } from '../i18n/uiTranslation';

const LOCATION_TIMEOUT_MS = 12000;
const MAX_LOCATION_AGE_MS = 60000;

const readLocation = (location) => {
    const coords = location?.coords || location;
    const latitude = coords?.latitude;
    const longitude = coords?.longitude;
    const timestamp = location?.timestamp == null ? Date.now()
        : typeof location.timestamp === 'number' ? location.timestamp : Date.parse(location.timestamp);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
        || Math.abs(latitude) > 90 || Math.abs(longitude) > 180
        || !Number.isFinite(timestamp) || Date.now() - timestamp > MAX_LOCATION_AGE_MS) return null;
    return { latitude, longitude, timestamp };
};

const showLocationError = (error) => {
    const actions = [{ text: translateUiText('Cancel'), style: 'cancel' }];
    if (isLocationSettingsError(error)) {
        actions.push({ text: translateUiText('Open Settings'), onPress: () => Linking.openSettings().catch(() => {}) });
    }
    Alert.alert(translateUiText('Location unavailable'), translateUiText(error.message || 'Could not get your current location. Please try again.'), actions);
};

// Coordinates stay in memory on this screen. This hook never syncs location
// to the server or enables the separate partner-sharing/background setting.
const useLettersMapLocation = () => {
    const [locationEnabled, setLocationEnabled] = useState(false);
    const [deviceLocation, setDeviceLocation] = useState(null);
    const [focusLocation, setFocusLocation] = useState(null);
    const [locating, setLocating] = useState(false);
    const mountedRef = useRef(false);
    const latestRef = useRef(null);
    const busyRef = useRef(false);
    const focusPendingRef = useRef(false);
    const timeoutRef = useRef(null);
    const permissionCheckRef = useRef(0);
    const focusRequestRef = useRef(0);

    const acceptLocation = useCallback((value) => {
        if (!mountedRef.current) return;
        const location = readLocation(value);
        if (!location) return;
        latestRef.current = location;
        // Keep fallback route pins stable while the live puck follows movement.
        setDeviceLocation((current) => current || { latitude: location.latitude, longitude: location.longitude });
        if (focusPendingRef.current) {
            focusPendingRef.current = false;
            busyRef.current = false;
            clearTimeout(timeoutRef.current);
            setLocating(false);
            setFocusLocation({ ...location, requestId: ++focusRequestRef.current });
        }
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        const checkPermission = async () => {
            if (busyRef.current) return;
            const check = ++permissionCheckRef.current;
            try {
                const status = await getDistanceLocationPermissionStatus();
                if (!mountedRef.current || check !== permissionCheckRef.current) return;
                const allowed = status?.foregroundGranted === true && status?.servicesEnabled !== false;
                setLocationEnabled(allowed);
                if (!allowed) {
                    latestRef.current = null;
                    setDeviceLocation(null);
                    setFocusLocation(null);
                }
            } catch {
                // A manual request can retry when the OS status is unavailable.
            }
        };
        checkPermission();
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') checkPermission();
        });
        return () => {
            mountedRef.current = false;
            clearTimeout(timeoutRef.current);
            subscription.remove();
        };
    }, []);

    useEffect(() => {
        if (!locationEnabled) return undefined;
        Mapbox.locationManager.addListener(acceptLocation);
        return () => Mapbox.locationManager.removeListener(acceptLocation);
    }, [locationEnabled, acceptLocation]);

    const locateMe = useCallback(async () => {
        if (busyRef.current) return;
        busyRef.current = true;
        permissionCheckRef.current += 1;
        setLocating(true);
        try {
            let location;
            if (Platform.OS === 'android') {
                const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
                const coarse = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
                const [hasFine, hasCoarse] = await Promise.all([PermissionsAndroid.check(fine), PermissionsAndroid.check(coarse)]);
                if (!hasFine && !hasCoarse) {
                    const result = await PermissionsAndroid.requestMultiple([fine, coarse]);
                    if (result[fine] !== PermissionsAndroid.RESULTS.GRANTED && result[coarse] !== PermissionsAndroid.RESULTS.GRANTED) {
                        const blocked = result[fine] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN || result[coarse] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;
                        throw Object.assign(new Error(blocked ? 'Please enable location access in Settings.' : 'Location permission was denied.'), { code: blocked ? 'LOCATION_BLOCKED' : 'LOCATION_DENIED' });
                    }
                }
            } else {
                location = await requestDistanceForegroundLocation();
            }
            if (!mountedRef.current) return;
            setLocationEnabled(true);
            focusPendingRef.current = true;
            acceptLocation(location || latestRef.current);
            if (!focusPendingRef.current) return;
            timeoutRef.current = setTimeout(() => {
                if (!mountedRef.current || !focusPendingRef.current) return;
                focusPendingRef.current = false;
                busyRef.current = false;
                setLocating(false);
                showLocationError(new Error('Could not get your current location. Please try again.'));
            }, LOCATION_TIMEOUT_MS);
        } catch (error) {
            if (!mountedRef.current) return;
            focusPendingRef.current = false;
            busyRef.current = false;
            setLocating(false);
            if (isLocationSettingsError(error) || error.code === 'LOCATION_DENIED') {
                setLocationEnabled(false);
                latestRef.current = null;
                setDeviceLocation(null);
                setFocusLocation(null);
            }
            showLocationError(error);
        }
    }, [acceptLocation]);

    return { locationEnabled, deviceLocation, focusLocation, locating, locateMe };
};

export default useLettersMapLocation;
