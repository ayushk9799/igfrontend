/* eslint-env jest */
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { StyleSheet, View } from 'react-native';
import Purchases from 'react-native-purchases';
import YearlyOfferBottomSheet from '../YearlyOfferBottomSheet';

const mockPresent = jest.fn();
const mockDismiss = jest.fn();
jest.mock('@gorhom/bottom-sheet', () => {
    const ReactModule = require('react');
    return {
        BottomSheetModal: ReactModule.forwardRef(({ children, containerComponent: Container = ReactModule.Fragment }, ref) => {
            const [mounted, setMounted] = ReactModule.useState(false);
            ReactModule.useImperativeHandle(ref, () => ({
                present: () => { mockPresent(); setMounted(true); },
                dismiss: () => { mockDismiss(); setMounted(false); },
            }), []);
            return mounted ? <Container>{children}</Container> : null;
        }),
        BottomSheetBackdrop: () => null,
        BottomSheetScrollView: ({ children }) => children,
    };
});
jest.mock('react-redux', () => ({
    useDispatch: () => jest.fn(),
    useSelector: selector => selector({ user: { id: 'user', isPremium: false } }),
}));
jest.mock('react-native-purchases', () => ({ getOfferings: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock('react-native-linear-gradient', () => ({ children }) => children);
jest.mock('lottie-react-native', () => () => null);
jest.mock('react-native-svg', () => ({ __esModule: true, default: () => null, Path: () => null }));
jest.mock('../../api/subscriptionApi', () => ({}));
jest.mock('../../store/slices/userSlice', () => ({}));
jest.mock('../../utils/authStorage', () => ({}));
jest.mock('../../utils/analytics', () => ({ trackEvent: jest.fn() }));
jest.mock('../../i18n/uiTranslation', () => ({
    translateUiText: text => text,
    translateUiTemplate: (text, values) => text.replace(/\{\{(\d+)\}\}/g, (_, index) => values[index]),
}));

let renderer;
const offerEnd = Date.now() + 12 * 60 * 60 * 1000;
const routeStyles = StyleSheet.create({ foreground: { zIndex: 2 } });
function TopicRoute({ premiumClosed, refresh = 0 }) {
    return (
        <>
            <View testID="topic-questions" style={routeStyles.foreground} accessibilityLabel={String(refresh)} />
            <YearlyOfferBottomSheet visible={premiumClosed} offerEndsAt={offerEnd} />
        </>
    );
}

beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    Purchases.getOfferings.mockResolvedValue({
        all: {
            yearly_offer: {
                annual: { identifier: 'annual', product: { priceString: '$20', price: 20, currencyCode: 'USD' } },
            },
            'basic-plan': {
                annual: { identifier: 'annual', product: { priceString: '$40', price: 40, currencyCode: 'USD' } },
            },
        },
    });
});
afterEach(() => {
    if (renderer) act(() => renderer.unmount());
    renderer = undefined;
    jest.useRealTimers();
});

test('closing premium presents above the Topic Questions foreground without changing routes', async () => {
    await act(async () => { renderer = ReactTestRenderer.create(<TopicRoute premiumClosed={false} />); });
    expect(mockPresent).not.toHaveBeenCalled();
    await act(async () => { renderer.update(<TopicRoute premiumClosed />); });
    await act(async () => { jest.advanceTimersByTime(20); });
    expect(mockPresent).toHaveBeenCalledTimes(1);
    const foreground = renderer.root.findByProps({ testID: 'topic-questions' });
    const foregroundOrder = StyleSheet.flatten(foreground.props.style).zIndex;
    const overlay = renderer.root.findAllByType(View).find(node => (
        StyleSheet.flatten(node.props.style)?.zIndex > foregroundOrder
    ));
    expect(overlay).toBeDefined();
    const layer = StyleSheet.flatten(overlay.props.style);
    expect(layer).toMatchObject({ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 });
    expect(layer.elevation).toBeGreaterThan(foregroundOrder);
    expect(overlay.props.collapsable).toBe(false);
});

test('topic updates do not trigger another presentation after the offer is hidden', async () => {
    await act(async () => { renderer = ReactTestRenderer.create(<TopicRoute premiumClosed />); });
    await act(async () => { jest.advanceTimersByTime(20); });
    expect(mockPresent).toHaveBeenCalledTimes(1);
    await act(async () => { renderer.update(<TopicRoute premiumClosed={false} />); });
    expect(mockDismiss).toHaveBeenCalledTimes(1);
    await act(async () => { renderer.update(<TopicRoute premiumClosed={false} refresh={1} />); });
    await act(async () => { jest.advanceTimersByTime(20); });
    expect(mockPresent).toHaveBeenCalledTimes(1);
});
