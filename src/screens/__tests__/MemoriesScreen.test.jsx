/* eslint-env jest */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert, Animated, DeviceEventEmitter, Platform, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import * as ImagePicker from 'expo-image-picker';
import MemoriesScreen from '../MemoriesScreen';
import { createMemory, fetchMemories } from '../../api/memoriesApi';

jest.mock('react-native-safe-area-context', () => ({
    useSafeAreaInsets: () => ({ top: 24, bottom: 20 }),
}));
jest.mock('react-native-linear-gradient', () => {
    const { View } = require('react-native');
    return ({ children, ...props }) => <View {...props}>{children}</View>;
});
jest.mock('react-native-keyboard-controller', () => {
    const { ScrollView, View } = require('react-native');
    return {
        KeyboardAwareScrollView: ({ children, ...props }) => <ScrollView {...props}>{children}</ScrollView>,
        KeyboardStickyView: ({ children, ...props }) => <View {...props}>{children}</View>,
    };
});
jest.mock('lucide-react-native', () => Object.fromEntries([
    'ArrowUpDown', 'CalendarDays', 'ChevronDown', 'ChevronLeft', 'Heart',
    'ImagePlus', 'MoreVertical', 'Pencil', 'Plus', 'Trash2', 'X',
].map(name => [name, () => null])));
jest.mock('@react-native-community/datetimepicker', () => () => null);
jest.mock('react-native-wheel-pick', () => ({ DatePicker: () => null }));
jest.mock('expo-image-picker', () => ({
    requestMediaLibraryPermissionsAsync: jest.fn(),
    launchImageLibraryAsync: jest.fn(),
}));
jest.mock('expo-haptics', () => ({
    impactAsync: jest.fn(() => Promise.resolve()),
    ImpactFeedbackStyle: { Light: 'light' },
}));
jest.mock('../../hooks/useSocket', () => ({ useSocket: () => null }));
jest.mock('../../utils/authStorage', () => ({ storage: { getString: jest.fn(), set: jest.fn() } }));
jest.mock('../../i18n/uiTranslation', () => ({ translateUiText: value => value, getUiLocale: () => 'en-US' }));
jest.mock('../../api/memoriesApi', () => ({
    fetchMemories: jest.fn(),
    createMemory: jest.fn(),
    updateMemory: jest.fn(),
    deleteMemory: jest.fn(),
    requestMemoryImageUpload: jest.fn(() => Promise.resolve({})),
    uploadMemoryImage: jest.fn(() => Promise.resolve({ imageUrl: 'https://example.com/photo.jpg', fileKey: 'photo' })),
}));
jest.mock('../../utils/memoryImage', () => ({
    createMemoryImageFileName: () => 'photo.jpg',
    getCapturedDateFromAsset: () => ({ capturedAt: new Date('2024-02-01T12:00:00Z'), capturedAtSource: 'exif' }),
    getDisplayAspectRatio: () => 1,
    prepareMemoryImage: () => Promise.resolve({ fileName: 'photo.jpg', mimeType: 'image/jpeg', width: 100, height: 100 }),
}));

let renderer;
const initialPlatform = Platform.OS;
const findButton = label => renderer.root.findAllByType(TouchableOpacity)
    .find(button => button.props.accessibilityLabel === label);
const findInput = label => renderer.root.findAllByType(TextInput)
    .find(input => input.props.accessibilityLabel === label);

beforeEach(() => {
    jest.useFakeTimers();
    const animation = { start: jest.fn(), stop: jest.fn(), reset: jest.fn() };
    ['spring', 'timing', 'loop'].forEach(method => jest.spyOn(Animated, method).mockReturnValue(animation));
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    fetchMemories.mockResolvedValue({ memories: [], hasMore: false });
    createMemory.mockImplementation(async data => ({ _id: 'new-memory', ...data }));
    ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///photo.jpg', width: 100, height: 100 }] });
});

afterEach(async () => {
    if (renderer) await ReactTestRenderer.act(() => renderer.unmount());
    renderer = null;
    DeviceEventEmitter.emit('keyboardDidHide', {});
    Platform.OS = initialPlatform;
    jest.restoreAllMocks();
    jest.clearAllMocks();
    jest.useRealTimers();
});

const openForm = async type => {
    await ReactTestRenderer.act(async () => {
        renderer = ReactTestRenderer.create(<MemoriesScreen userId="user-1" hasPartner />);
    });
    await ReactTestRenderer.act(() => findButton('Add memory or special date').props.onPress());
    await ReactTestRenderer.act(() => findButton(type).props.onPress());
};

test.each([
    ['ios', 'Memory'], ['ios', 'Special Date'],
    ['android', 'Memory'], ['android', 'Special Date'],
])('%s %s focus does not schedule jumps to the end or add keyboard-height padding', async (platform, type) => {
    Platform.OS = platform;
    await openForm(type);
    const scroll = renderer.root.findByType(KeyboardAwareScrollView);
    const footer = renderer.root.findByType(KeyboardStickyView);
    await ReactTestRenderer.act(() => footer.props.onLayout({ nativeEvent: { layout: { height: 84 } } }));
    const timerSpy = jest.spyOn(global, 'setTimeout');
    timerSpy.mockClear();
    const paddingBefore = StyleSheet.flatten(scroll.props.contentContainerStyle).paddingBottom;

    await ReactTestRenderer.act(() => {
        findInput('Title').props.onFocus?.({});
        findInput('Note').props.onFocus?.({});
        DeviceEventEmitter.emit(platform === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', {
            duration: 250, endCoordinates: { height: 300, screenY: 500, screenX: 0, width: 390 },
        });
    });

    expect(timerSpy).not.toHaveBeenCalledWith(expect.any(Function), expect.any(Number));
    expect(StyleSheet.flatten(scroll.props.contentContainerStyle).paddingBottom).toBe(paddingBefore);
    expect(scroll.props.bottomOffset).toBeGreaterThan(84);
    expect(scroll.findAllByProps({ accessibilityLabel: type === 'Memory' ? 'Save memory' : 'Save date' })).toHaveLength(0);
    expect(footer.findAllByType(TouchableOpacity)).toHaveLength(1);
});

test('a note-only memory can be saved and long notes stay in the outer scroll view', async () => {
    await openForm('Memory');
    const note = 'A favorite moment. '.repeat(25);
    await ReactTestRenderer.act(() => findInput('Note').props.onChangeText(note));
    expect(findInput('Note').props.scrollEnabled).toBe(false);
    await ReactTestRenderer.act(async () => findButton('Save memory').props.onPress());
    expect(createMemory).toHaveBeenCalledWith(expect.objectContaining({ entryType: 'memory', title: '', caption: note.trim() }));
});

test('special dates require a title and keep the chosen date when a photo is added', async () => {
    await openForm('Special Date');
    await ReactTestRenderer.act(async () => findButton('Save date').props.onPress());
    expect(Alert.alert).toHaveBeenCalledWith('Add a title', 'Name this special date first.');
    expect(createMemory).not.toHaveBeenCalled();

    await ReactTestRenderer.act(() => findInput('Title').props.onChangeText('Our anniversary'));
    const modal = renderer.root.find(node => node.type?.name === 'AddMemoryModal');
    const chosenDate = new Date('2023-06-15T12:00:00Z');
    await ReactTestRenderer.act(() => modal.props.setCapturedAt(chosenDate));
    await ReactTestRenderer.act(async () => findButton('Add photo').props.onPress());
    expect(modal.props.capturedAt.toISOString()).toBe(chosenDate.toISOString());
    await ReactTestRenderer.act(async () => findButton('Save date').props.onPress());
    expect(createMemory).toHaveBeenCalledWith(expect.objectContaining({
        entryType: 'special_date', title: 'Our anniversary', capturedAt: chosenDate.toISOString(), capturedAtSource: 'manual',
    }));
});
