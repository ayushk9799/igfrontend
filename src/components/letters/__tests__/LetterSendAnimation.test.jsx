/* eslint-env jest */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Image, StyleSheet, Text, View } from 'react-native';
import { captureRef, releaseCapture } from 'react-native-view-shot';
import LetterSendAnimation from '../LetterSendAnimation';

let mockReducedMotion = false;
const mockAnimationCallbacks = [];
jest.mock('react-native-reanimated', () => ({
    ...require('react-native-reanimated/mock'),
    useSharedValue: initial => require('react').useRef({ value: initial }).current,
    withTiming: (value, config, callback) => {
        if (callback) mockAnimationCallbacks.push(callback);
        return value;
    },
}));
jest.mock('react-native-view-shot', () => ({ captureRef: jest.fn(), releaseCapture: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('../../../hooks/useReducedMotion', () => () => mockReducedMotion);
jest.mock('../../../i18n/uiTranslation', () => ({ translateUiText: text => text }));
jest.mock('react-native-svg', () => ({
    __esModule: true,
    default: ({ children }) => children,
    Circle: () => null, Ellipse: () => null, Defs: ({ children }) => children, Path: () => null,
    LinearGradient: ({ children }) => children,
    RadialGradient: ({ children }) => children, Rect: () => null, Stop: () => null,
}));

let renderer;
let onComplete;
const props = { body: 'A letter just for you.', paperId: 'blush', sizeId: 'medium' };
const mount = async ({ loadTextures = true } = {}) => {
    await ReactTestRenderer.act(() => {
        renderer = ReactTestRenderer.create(<LetterSendAnimation {...props} onComplete={onComplete} />);
    });
    await ReactTestRenderer.act(() => {
        renderer.root.findAllByType(View).find(view => view.props.collapsable === false).props.onLayout();
    });
    await ReactTestRenderer.act(async () => { jest.advanceTimersByTime(160); });
    const preload = renderer.root.findAllByType(Image).find(image => image.props.source?.uri && image.props.onLoadEnd);
    if (preload) await ReactTestRenderer.act(() => preload.props.onLoadEnd());
    if (loadTextures) {
        await ReactTestRenderer.act(() => {
            renderer.root.findByProps({ testID: 'letter-seal-stamp' }).props.onLoadEnd();
            renderer.root.findByProps({ testID: 'letter-stamp-shadow' }).props.onLoadEnd();
        });
    }
};
const finishStage = async () => {
    expect(mockAnimationCallbacks.length).toBeGreaterThan(0);
    await ReactTestRenderer.act(() => mockAnimationCallbacks.shift()(true));
};
const renderedStyle = testID => StyleSheet.flatten(renderer.root.findByProps({ testID }).props.style);

const expectFlapClosed = () => {
    const envelope = renderedStyle('letter-envelope-back');
    const open = renderedStyle('letter-envelope-flap-open');
    const closed = renderedStyle('letter-envelope-flap-closed');
    expect(open.opacity).toBe(0);
    expect(closed.opacity).toBe(1);
    expect(closed.left).toBe(envelope.left);
    expect(closed.top).toBe(envelope.top);
    expect(closed.width).toBe(envelope.width);
    expect(closed.zIndex).toBeGreaterThan(envelope.zIndex);
    expect(closed.transform.find(transform => transform.scaleY !== undefined).scaleY).toBe(1);
    // The closed SVG must face forward, including while its parent moves/scales.
    expect(closed.transform.some(transform => transform.rotateX !== undefined || transform.perspective !== undefined)).toBe(false);
};

beforeEach(() => {
    jest.useFakeTimers();
    mockReducedMotion = false;
    mockAnimationCallbacks.length = 0;
    onComplete = jest.fn();
    captureRef.mockReset().mockResolvedValue('file:///letter-preview.png');
    releaseCapture.mockClear();
});
afterEach(async () => {
    if (renderer) await ReactTestRenderer.act(() => renderer.unmount());
    renderer = null;
    jest.useRealTimers();
});

test('waits for folding, flap closure, stamping and the seal reveal before opening the carrier picker', async () => {
    await mount();
    expect(mockAnimationCallbacks).toHaveLength(1);
    expect(renderer.root.findAllByProps({ testID: 'letter-folding-paper' }).length).toBeGreaterThan(0);
    await finishStage();
    // Hidden, rotated paper faces must be retired before stamping starts.
    expect(renderer.root.findAllByProps({ testID: 'letter-folding-paper' })).toHaveLength(0);
    expect(mockAnimationCallbacks).toHaveLength(1);
    expect(onComplete).not.toHaveBeenCalled();
    await finishStage(); // Close the flap.
    expect(onComplete).not.toHaveBeenCalled();
    await finishStage(); // Press the wax and lift the stamp away.
    expect(onComplete).not.toHaveBeenCalled();
    await finishStage(); // Briefly hold the finished heart seal.
    expect(onComplete).toHaveBeenCalledTimes(1);
    await ReactTestRenderer.act(() => renderer.unmount());
    expect(releaseCapture).toHaveBeenCalledWith('file:///letter-preview.png');
});

test('capture failure falls back to rendered paper and still finishes', async () => {
    captureRef.mockRejectedValue(new Error('Snapshot unavailable'));
    await mount();
    expect(renderer.root.findAllByType(Image).filter(image => image.props.source?.uri)).toHaveLength(0);
    expect(renderer.root.findAllByType(Text).some(text => text.props.children === props.body)).toBe(true);
    await finishStage();
    await finishStage();
    await finishStage();
    await finishStage();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(releaseCapture).not.toHaveBeenCalled();
});

test('a capture finishing after dismissal releases its temporary image', async () => {
    let resolveCapture;
    captureRef.mockImplementation(() => new Promise(resolve => { resolveCapture = resolve; }));
    await mount();
    await ReactTestRenderer.act(() => renderer.unmount());
    await ReactTestRenderer.act(() => resolveCapture('file:///late-preview.png'));
    expect(releaseCapture).toHaveBeenCalledWith('file:///late-preview.png');
    expect(onComplete).not.toHaveBeenCalled();
});

test('waits for both textures to decode before closing the flap and stamping', async () => {
    await mount({ loadTextures: false });
    await finishStage();
    expect(mockAnimationCallbacks).toHaveLength(0);
    expect(onComplete).not.toHaveBeenCalled();
    await ReactTestRenderer.act(() => {
        renderer.root.findByProps({ testID: 'letter-seal-stamp' }).props.onLoadEnd();
    });
    expect(mockAnimationCallbacks).toHaveLength(0);
    await ReactTestRenderer.act(() => {
        renderer.root.findByProps({ testID: 'letter-stamp-shadow' }).props.onLoadEnd();
    });
    expect(mockAnimationCallbacks).toHaveLength(1);
    await finishStage();
    await finishStage();
    await finishStage();
    expect(onComplete).toHaveBeenCalledTimes(1);
});

test('reduced motion skips rotations and completes after briefly showing the closed envelope', async () => {
    mockReducedMotion = true;
    await mount({ loadTextures: false });
    expect(mockAnimationCallbacks).toHaveLength(0);
    expect(onComplete).not.toHaveBeenCalled();
    await ReactTestRenderer.act(() => renderer.update(<LetterSendAnimation {...props} onComplete={onComplete} />));
    expectFlapClosed();
    await ReactTestRenderer.act(() => jest.advanceTimersByTime(200));
    expect(onComplete).toHaveBeenCalledTimes(1);
    await ReactTestRenderer.act(() => {
        renderer.root.findByProps({ testID: 'letter-seal-stamp' }).props.onLoadEnd();
        renderer.root.findByProps({ testID: 'letter-stamp-shadow' }).props.onLoadEnd();
    });
    await ReactTestRenderer.act(() => jest.advanceTimersByTime(200));
    expect(onComplete).toHaveBeenCalledTimes(1);
});

test('the sealed envelope remains mounted and fits above the picker without recapturing or replaying', async () => {
    await mount();
    await finishStage();
    await finishStage();
    await finishStage();
    await finishStage();
    await ReactTestRenderer.act(() => {
        renderer.root.findByProps({ testID: 'letter-send-animation' }).props.onLayout({ nativeEvent: { layout: { height: 700 } } });
        renderer.root.findByProps({ testID: 'letter-send-content' }).props.onLayout({ nativeEvent: { layout: { y: 70, height: 560 } } });
        renderer.root.findByProps({ testID: 'letter-send-stage' }).props.onLayout({ nativeEvent: { layout: { y: 50 } } });
    });
    const choosingProps = { ...props, choosingBird: true, pickerHeight: 500, onComplete };
    await ReactTestRenderer.act(() => renderer.update(<LetterSendAnimation {...choosingProps} />));
    // Re-render to read styles after the mocked shared values reach their targets.
    await ReactTestRenderer.act(() => renderer.update(<LetterSendAnimation {...choosingProps} />));
    const content = StyleSheet.flatten(renderer.root.findByProps({ testID: 'letter-send-content' }).props.style);
    const envelope = StyleSheet.flatten(renderer.root.findByProps({ testID: 'letter-envelope-back' }).props.style);
    const scale = content.transform.find(transform => transform.scale !== undefined).scale;
    const center = 70 + 50 + envelope.top + envelope.height / 2 + content.transform[0].translateY;
    expect(center - envelope.height * scale / 2).toBeGreaterThanOrEqual(12 - 0.001);
    expect(center + envelope.height * scale / 2).toBeLessThanOrEqual(700 - 500 - 16 + 0.001);
    expect(captureRef).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(mockAnimationCallbacks).toHaveLength(0);
    expect(releaseCapture).not.toHaveBeenCalled();
    expect(StyleSheet.flatten(renderer.root.findByProps({ testID: 'letter-wax-seal' }).props.style).opacity).toBe(1);
    expect(StyleSheet.flatten(renderer.root.findByProps({ testID: 'letter-seal-imprint' }).props.style).opacity).toBe(1);
    expect(StyleSheet.flatten(renderer.root.findByProps({ testID: 'letter-seal-stamp' }).props.style).opacity).toBe(0);
    expect(renderedStyle('letter-stamp-shadow').opacity).toBe(0);
    expectFlapClosed();
});

test('the flap hinges at the envelope top and stays closed while the wax is stamped', async () => {
    await mount();
    await ReactTestRenderer.act(() => renderer.update(<LetterSendAnimation {...props} onComplete={onComplete} />));
    const envelope = renderedStyle('letter-envelope-back');
    const open = renderedStyle('letter-envelope-flap-open');
    expect(open.top + open.height).toBeCloseTo(envelope.top);
    expect(open.opacity).toBe(1);
    expect(renderedStyle('letter-envelope-flap-closed').opacity).toBe(0);
    await finishStage(); // Fold and insert the letter.
    await finishStage(); // Close the flap and start stamping.
    await ReactTestRenderer.act(() => renderer.update(<LetterSendAnimation {...props} onComplete={onComplete} />));
    expectFlapClosed();
    expect(onComplete).not.toHaveBeenCalled();
});

test('cancelling the flap closure never starts stamping or opens the picker', async () => {
    await mount();
    await finishStage();
    await ReactTestRenderer.act(() => mockAnimationCallbacks.shift()(false));
    expect(mockAnimationCallbacks).toHaveLength(0);
    expect(onComplete).not.toHaveBeenCalled();
});
