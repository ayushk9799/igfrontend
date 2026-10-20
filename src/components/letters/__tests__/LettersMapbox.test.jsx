/* eslint-env jest */
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { View } from 'react-native';
import LettersMapbox from '../LettersMapbox';

const mockSetCamera = jest.fn();
const mockFitBounds = jest.fn();
jest.mock('@rnmapbox/maps', () => {
    const ReactModule = require('react');
    const { View: NativeView } = require('react-native');
    const Container = ({ children, ...props }) => ReactModule.createElement(NativeView, props, children);
    return {
        setAccessToken: jest.fn(),
        MapView: ({ children, ...props }) => ReactModule.createElement(NativeView, { ...props, testID: 'native-letter-map' }, children),
        Camera: ReactModule.forwardRef((props, ref) => {
            ReactModule.useImperativeHandle(ref, () => ({ setCamera: mockSetCamera, fitBounds: mockFitBounds }));
            return null;
        }),
        LocationPuck: () => ReactModule.createElement(NativeView, { testID: 'native-location-puck' }),
        StyleImport: () => null,
        Atmosphere: () => null,
        ShapeSource: Container,
        MarkerView: Container,
        LineLayer: () => null,
    };
});
jest.mock('../BirdArt', () => () => null);
jest.mock('../../../constants/maps', () => ({ MAPBOX_ACCESS_TOKEN: '', LETTERS_MAP_ATMOSPHERE: {}, LETTERS_DARK_MAP_ATMOSPHERE: {} }));
jest.mock('../../../utils/authStorage', () => ({ storage: {} }));
jest.mock('../../../i18n/uiTranslation', () => ({
    translateUiText: text => text,
    translateUiTemplate: (text, values) => text.replace(/\{\{(\d+)\}\}/g, (_, index) => values[index]),
}));

const props = { you: { latitude: 25.6, longitude: 85.1 }, partner: { latitude: 26, longitude: 85.3 }, partnerName: 'Ayush', nowMs: Date.now() };
let renderer;
const nativeMap = () => renderer.root.findAllByProps({ testID: 'native-letter-map' }).find(node => node.type === View);
beforeEach(() => jest.clearAllMocks());
afterEach(() => { if (renderer) act(() => renderer.unmount()); renderer = null; });

test('the native location indicator appears only when access is enabled', async () => {
    await act(async () => { renderer = ReactTestRenderer.create(<LettersMapbox {...props} />); });
    expect(renderer.root.findAllByProps({ testID: 'native-location-puck' })).toHaveLength(0);
    await act(async () => { renderer.update(<LettersMapbox {...props} showUserLocation />); });
    expect(renderer.root.findAllByProps({ testID: 'native-location-puck' }).filter(node => node.type === View)).toHaveLength(1);
});

test('recenter targets the device fix and switching theme preserves that view', async () => {
    await act(async () => { renderer = ReactTestRenderer.create(<LettersMapbox {...props} />); });
    await act(async () => { nativeMap().props.onDidFinishLoadingMap(); });
    const focus = { latitude: 25.63, longitude: 85.14, requestId: 1 };
    await act(async () => { renderer.update(<LettersMapbox {...props} showUserLocation focusLocation={focus} />); });
    expect(mockSetCamera).toHaveBeenLastCalledWith(expect.objectContaining({ centerCoordinate: [85.14, 25.63], zoomLevel: 14 }));
    mockSetCamera.mockClear();
    mockFitBounds.mockClear();
    await act(async () => { renderer.update(<LettersMapbox {...props} showUserLocation focusLocation={focus} isDark />); });
    expect(mockSetCamera).not.toHaveBeenCalled();
    expect(mockFitBounds).not.toHaveBeenCalled();
});

test('a fix obtained before map load is focused after load without drawing an unpaired route', async () => {
    const focus = { latitude: 25.63, longitude: 85.14, requestId: 1 };
    await act(async () => { renderer = ReactTestRenderer.create(<LettersMapbox {...props} focusLocation={focus} showPartner={false} />); });
    expect(mockSetCamera).not.toHaveBeenCalled();
    await act(async () => { nativeMap().props.onDidFinishLoadingMap(); });
    expect(mockSetCamera).toHaveBeenLastCalledWith(expect.objectContaining({ centerCoordinate: [85.14, 25.63] }));
    const routes = renderer.root.findAllByProps({ id: 'letters-routes' }).find(node => node.type === View);
    expect(routes.props.shape.features).toEqual([]);
});
