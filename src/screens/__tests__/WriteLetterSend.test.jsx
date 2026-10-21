/* eslint-env jest */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert, TextInput, TouchableOpacity } from 'react-native';
import WriteLetterScreen from '../WriteLetterScreen';
import BirdPickerSheet from '../../components/letters/BirdPickerSheet';
import LetterSendAnimation from '../../components/letters/LetterSendAnimation';
import { sendLetter } from '../../api/lettersApi';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('lucide-react-native', () => ({ Send: () => null, X: () => null }));
jest.mock('react-native-svg', () => ({
    __esModule: true,
    default: ({ children }) => children,
    Circle: () => null, Defs: ({ children }) => children, Path: () => null,
    RadialGradient: ({ children }) => children, Rect: () => null, Stop: () => null,
}));
jest.mock('../../components/letters/BirdPickerSheet', () => () => null);
jest.mock('../../components/letters/LetterStyleControls', () => () => null);
jest.mock('../../components/letters/LetterSendAnimation', () => () => null);
jest.mock('../../api/lettersApi', () => ({ sendLetter: jest.fn() }));
jest.mock('../../utils/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('../../utils/authStorage', () => ({ storage: { getString: () => undefined, set: jest.fn() } }));
jest.mock('../../i18n/uiTranslation', () => ({
    translateUiText: text => text,
    translateUiTemplate: (template, values) => template.replace(/\{\{(\d+)\}\}/g, (_, index) => values[index]),
}));

let renderer;
let onSent;
let resolveSend;
let rejectSend;
const picker = () => renderer.root.findByType(BirdPickerSheet);
const animation = () => renderer.root.findByType(LetterSendAnimation);
const pressSend = () => renderer.root.findAllByType(TouchableOpacity)
    .find(button => button.props.accessibilityLabel === 'Send').props.onPress();
const prepareAndOpenPicker = async () => {
    await ReactTestRenderer.act(() => pressSend());
    await ReactTestRenderer.act(() => animation().props.onComplete());
};

beforeEach(async () => {
    onSent = jest.fn();
    sendLetter.mockReset().mockImplementation(() => new Promise((resolve, reject) => {
        resolveSend = resolve;
        rejectSend = reject;
    }));
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await ReactTestRenderer.act(() => {
        renderer = ReactTestRenderer.create(<WriteLetterScreen partnerName="Alex" onSent={onSent} />);
    });
    await ReactTestRenderer.act(() => {
        renderer.root.findByType(TextInput).props.onChangeText('  Thinking of you.  ');
    });
});

afterEach(async () => {
    await ReactTestRenderer.act(() => renderer.unmount());
    jest.restoreAllMocks();
});

test('header Send plays the complete animation before opening carrier selection, without sending', async () => {
    await ReactTestRenderer.act(() => { pressSend(); pressSend(); });
    expect(picker().props.mode).toBeNull();
    expect(renderer.root.findAllByType(LetterSendAnimation)).toHaveLength(1);
    expect(renderer.root.findByType(TextInput).props.editable).toBe(false);
    expect(sendLetter).not.toHaveBeenCalled();
    expect(onSent).not.toHaveBeenCalled();
    const envelope = animation();
    const complete = animation().props.onComplete;
    await ReactTestRenderer.act(() => { complete(); complete(); });
    expect(picker().props.mode).toBe('birds');
    expect(sendLetter).not.toHaveBeenCalled();
    expect(animation()).toBe(envelope);
    expect(animation().props.choosingBird).toBe(true);
    expect(renderer.root.findByType(TextInput).props.editable).toBe(false);
    await ReactTestRenderer.act(() => picker().props.onHeightChange(420));
    expect(animation().props.pickerHeight).toBe(420);
});

test('carrier confirmation sends once and does not replay the animation', async () => {
    await prepareAndOpenPicker();
    const send = picker().props.onSend;
    await ReactTestRenderer.act(() => { send('pigeon'); send('pigeon'); });
    expect(sendLetter).toHaveBeenCalledTimes(1);
    expect(sendLetter).toHaveBeenCalledWith({ body: 'Thinking of you.', bird: 'pigeon' });
    expect(picker().props.mode).toBe('birds');
    expect(picker().props.sending).toBe(true);
    expect(animation().props.choosingBird).toBe(true);
    expect(renderer.root.findByType(TextInput).props.editable).toBe(false);
    expect(onSent).not.toHaveBeenCalled();
    await ReactTestRenderer.act(() => picker().props.onClose());
    expect(picker().props.mode).toBe('birds');
    expect(animation().props.choosingBird).toBe(true);

    const letter = { _id: 'letter-1' };
    await ReactTestRenderer.act(() => resolveSend({ letter }));
    expect(picker().props.mode).toBeNull();
    expect(onSent).toHaveBeenCalledTimes(1);
    expect(onSent).toHaveBeenCalledWith(letter);
    expect(renderer.root.findAllByType(LetterSendAnimation)).toHaveLength(0);
});

test('restores the same draft after a failed send and allows a retry', async () => {
    await prepareAndOpenPicker();
    await ReactTestRenderer.act(() => picker().props.onSend('pigeon'));
    await ReactTestRenderer.act(() => rejectSend(new Error('Please reconnect.')));
    expect(animation().props.choosingBird).toBe(true);
    expect(renderer.root.findByType(TextInput).props.value).toBe('  Thinking of you.  ');
    expect(renderer.root.findByType(TextInput).props.editable).toBe(false);
    expect(Alert.alert).toHaveBeenCalledWith('Letter not sent', 'Please reconnect.');
    expect(onSent).not.toHaveBeenCalled();
    expect(picker().props.mode).toBe('birds');
    expect(picker().props.sending).toBe(false);
    await ReactTestRenderer.act(() => picker().props.onSend('pigeon'));
    expect(sendLetter).toHaveBeenCalledTimes(2);
    expect(animation().props.choosingBird).toBe(true);
});

test('premium restriction preserves the draft and free-carrier fallback sends without replaying', async () => {
    await prepareAndOpenPicker();
    await ReactTestRenderer.act(() => picker().props.onSend('falcon'));
    expect(picker().props.mode).toBe('premium');
    expect(sendLetter).not.toHaveBeenCalled();
    await ReactTestRenderer.act(() => picker().props.onUseFreeBird());
    await ReactTestRenderer.act(() => rejectSend(Object.assign(new Error('Upgrade'), { code: 'premium_required' })));
    expect(picker().props.mode).toBe('premium');
    expect(animation().props.choosingBird).toBe(true);
    expect(Alert.alert).not.toHaveBeenCalled();
    await ReactTestRenderer.act(() => picker().props.onUseFreeBird());
    expect(animation().props.choosingBird).toBe(true);
    expect(picker().props.mode).toBe('birds');
    expect(sendLetter).toHaveBeenLastCalledWith({ body: 'Thinking of you.', bird: 'pigeon' });
});

test('a request resolving after the editor unmounts does not navigate', async () => {
    await prepareAndOpenPicker();
    await ReactTestRenderer.act(() => picker().props.onSend('pigeon'));
    await ReactTestRenderer.act(() => renderer.unmount());
    await ReactTestRenderer.act(() => resolveSend({ letter: { _id: 'letter-1' } }));
    expect(onSent).not.toHaveBeenCalled();
});

test('closing the carrier picker keeps the draft and another Send tap prepares it again', async () => {
    await prepareAndOpenPicker();
    await ReactTestRenderer.act(() => picker().props.onClose());
    expect(picker().props.mode).toBeNull();
    expect(renderer.root.findAllByType(LetterSendAnimation)).toHaveLength(0);
    expect(renderer.root.findByType(TextInput).props.editable).toBe(true);
    expect(renderer.root.findByType(TextInput).props.value).toBe('  Thinking of you.  ');
    expect(sendLetter).not.toHaveBeenCalled();
    await ReactTestRenderer.act(() => pressSend());
    expect(renderer.root.findAllByType(LetterSendAnimation)).toHaveLength(1);
    expect(picker().props.mode).toBeNull();
});

test('blank letters cannot start the animation', async () => {
    await ReactTestRenderer.act(() => renderer.root.findByType(TextInput).props.onChangeText('  '));
    await ReactTestRenderer.act(() => pressSend());
    expect(renderer.root.findAllByType(LetterSendAnimation)).toHaveLength(0);
    expect(picker().props.mode).toBeNull();
    expect(sendLetter).not.toHaveBeenCalled();
});

test('leaving for premium restores the editable letter behind the upgrade flow', async () => {
    await prepareAndOpenPicker();
    await ReactTestRenderer.act(() => picker().props.onSend('falcon'));
    await ReactTestRenderer.act(() => picker().props.onUpgrade());
    expect(picker().props.mode).toBeNull();
    expect(renderer.root.findAllByType(LetterSendAnimation)).toHaveLength(0);
    expect(renderer.root.findByType(TextInput).props.editable).toBe(true);
    expect(sendLetter).not.toHaveBeenCalled();
});
