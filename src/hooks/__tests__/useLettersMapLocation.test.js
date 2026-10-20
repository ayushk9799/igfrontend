/* eslint-env jest */
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Alert, AppState, PermissionsAndroid, Platform } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import useLettersMapLocation from '../useLettersMapLocation';
import { getDistanceLocationPermissionStatus, requestDistanceForegroundLocation } from '../../utils/distanceWidgetSync';

jest.mock('@rnmapbox/maps', () => ({ locationManager: { addListener: jest.fn(), removeListener: jest.fn() } }));
jest.mock('../../utils/distanceWidgetSync', () => ({
    getDistanceLocationPermissionStatus: jest.fn(),
    requestDistanceForegroundLocation: jest.fn(),
    isLocationSettingsError: error => ['LOCATION_BLOCKED', 'LOCATION_DISABLED'].includes(error.code),
}));
jest.mock('../../i18n/uiTranslation', () => ({ translateUiText: text => text }));

let result;
let renderer;
let appStateListener;
const originalOS = Platform.OS;
const point = { latitude: 25.6, longitude: 85.1 };
const Harness = () => { result = useLettersMapLocation(); return null; };
const mount = async () => { await act(async () => { renderer = ReactTestRenderer.create(<Harness />); }); };
const emitLocation = async (coords = point, timestamp = Date.now()) => {
    const listener = Mapbox.locationManager.addListener.mock.calls.at(-1)[0];
    await act(async () => { listener({ coords, timestamp }); });
};

beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-20T12:00:00.000Z'));
    jest.clearAllMocks();
    Platform.OS = 'ios';
    getDistanceLocationPermissionStatus.mockResolvedValue({ foregroundGranted: false, servicesEnabled: true });
    requestDistanceForegroundLocation.mockResolvedValue({ ...point, timestamp: Date.now() });
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_, listener) => {
        appStateListener = listener;
        return { remove: jest.fn() };
    });
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
    jest.spyOn(PermissionsAndroid, 'requestMultiple').mockResolvedValue({
        [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]: PermissionsAndroid.RESULTS.DENIED,
        [PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION]: PermissionsAndroid.RESULTS.GRANTED,
    });
});
afterEach(() => {
    if (renderer) act(() => renderer.unmount());
    renderer = null;
    jest.restoreAllMocks();
    Platform.OS = originalOS;
    jest.useRealTimers();
});

test('existing foreground access displays location without requesting permission or moving the camera', async () => {
    getDistanceLocationPermissionStatus.mockResolvedValue({ foregroundGranted: true, servicesEnabled: true });
    await mount();
    await emitLocation();
    expect(result.locationEnabled).toBe(true);
    expect(result.deviceLocation).toEqual(point);
    expect(result.focusLocation).toBeNull();
    expect(requestDistanceForegroundLocation).not.toHaveBeenCalled();
    expect(PermissionsAndroid.requestMultiple).not.toHaveBeenCalled();
});

test('the iOS button obtains a foreground fix and issues a fresh recenter request each time', async () => {
    await mount();
    await act(async () => { await result.locateMe(); });
    expect(requestDistanceForegroundLocation).toHaveBeenCalledTimes(1);
    expect(result.focusLocation).toMatchObject({ ...point, requestId: 1 });
    expect(result.locating).toBe(false);
    await act(async () => { await result.locateMe(); });
    expect(result.focusLocation.requestId).toBe(2);
});

test('Android accepts approximate access, requests no background permission, and waits for a fresh fix', async () => {
    Platform.OS = 'android';
    await mount();
    await act(async () => { await result.locateMe(); });
    expect(PermissionsAndroid.requestMultiple).toHaveBeenCalledWith([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    ]);
    expect(result.locating).toBe(true);
    await emitLocation(point, Date.now() - 120000);
    expect(result.focusLocation).toBeNull();
    await emitLocation();
    expect(result.focusLocation).toMatchObject(point);
    expect(result.locating).toBe(false);
});

test('movement does not shift the fallback route pins, but recenter uses the latest fix', async () => {
    Platform.OS = 'android';
    getDistanceLocationPermissionStatus.mockResolvedValue({ foregroundGranted: true });
    PermissionsAndroid.check.mockResolvedValue(true);
    await mount();
    await emitLocation();
    const moved = { latitude: 25.7, longitude: 85.2 };
    await emitLocation(moved);
    expect(result.deviceLocation).toEqual(point);
    await act(async () => { await result.locateMe(); });
    expect(result.focusLocation).toMatchObject(moved);
});

test('blocked permission offers Settings without enabling the location marker', async () => {
    requestDistanceForegroundLocation.mockRejectedValue(Object.assign(new Error('Please enable location access in Settings.'), { code: 'LOCATION_BLOCKED' }));
    await mount();
    await act(async () => { await result.locateMe(); });
    expect(result.locationEnabled).toBe(false);
    expect(result.focusLocation).toBeNull();
    expect(Mapbox.locationManager.addListener).not.toHaveBeenCalled();
    expect(Alert.alert.mock.calls[0][2].map(action => action.text)).toContain('Open Settings');
});

test('a missing GPS fix times out and the button can be retried', async () => {
    Platform.OS = 'android';
    PermissionsAndroid.check.mockResolvedValue(true);
    await mount();
    await act(async () => { await result.locateMe(); });
    await act(async () => { jest.advanceTimersByTime(12000); });
    expect(result.locating).toBe(false);
    expect(result.focusLocation).toBeNull();
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    await act(async () => { await result.locateMe(); });
    await emitLocation();
    expect(result.focusLocation).toMatchObject(point);
});

test('returning after permission is revoked removes local coordinates and stops updates', async () => {
    getDistanceLocationPermissionStatus.mockResolvedValue({ foregroundGranted: true });
    await mount();
    await emitLocation();
    getDistanceLocationPermissionStatus.mockResolvedValue({ foregroundGranted: false });
    await act(async () => { appStateListener('active'); });
    expect(result.locationEnabled).toBe(false);
    expect(result.deviceLocation).toBeNull();
    expect(Mapbox.locationManager.removeListener).toHaveBeenCalled();
});

test('leaving the screen removes the listener and cancels a pending timeout', async () => {
    Platform.OS = 'android';
    await mount();
    await act(async () => { await result.locateMe(); });
    await act(async () => { renderer.unmount(); });
    renderer = null;
    expect(Mapbox.locationManager.removeListener).toHaveBeenCalled();
    await act(async () => { jest.advanceTimersByTime(12000); });
    expect(Alert.alert).not.toHaveBeenCalled();
});
