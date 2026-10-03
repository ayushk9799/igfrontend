/* eslint-env jest */
import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import useYearlyOffer from '../useYearlyOffer';
import { storage } from '../../utils/authStorage';

const mockValues = new Map();
jest.mock('../../utils/authStorage', () => ({
    storage: {
        getNumber: jest.fn(key => mockValues.get(key)),
        set: jest.fn((key, value) => mockValues.set(key, value)),
        delete: jest.fn(key => mockValues.delete(key)),
    },
}));
jest.mock('../../utils/analytics', () => ({ trackEvent: jest.fn() }));

const HOUR = 60 * 60 * 1000;
const LAST = 'yearly_offer_last_presented_v2:user';
const END = 'yearly_offer_window_end_v2:user';
let offer;
let renderer;
function Harness({ userId = 'user', premium = false }) {
    offer = useYearlyOffer(userId, premium);
    return null;
}
const mount = props => act(() => {
    renderer = ReactTestRenderer.create(<Harness {...props} />);
});

beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-10-02T10:00:00Z'));
    jest.clearAllMocks();
    mockValues.clear();
});
afterEach(() => {
    if (renderer) act(() => renderer.unmount());
    renderer = undefined;
    jest.useRealTimers();
});

test('restores the banner countdown without automatically opening the sheet', () => {
    mockValues.set(END, Date.now() + HOUR);
    mount();
    expect(offer.endsAt).toBe(mockValues.get(END));
    expect(offer.requested).toBe(false);
});

test('a new user has no offer until they tap to open premium', () => {
    mount();
    act(() => offer.request());
    act(() => offer.presented());
    expect(offer.requested).toBe(false);
    expect(offer.endsAt).toBe(null);
    expect(storage.set).not.toHaveBeenCalled();
});

test('tapping premium starts the 12-hour countdown without showing the offer yet', () => {
    mount();
    act(() => offer.activate());
    expect(offer.endsAt).toBe(Date.now() + 12 * HOUR);
    expect(offer.requested).toBe(false);
    expect(mockValues.has(LAST)).toBe(false);
});

test('closing premium opens immediately and preserves the countdown started on tap', () => {
    mount();
    const premiumOpenedAt = Date.now();
    act(() => offer.activate());
    act(() => jest.setSystemTime(premiumOpenedAt + HOUR));
    act(() => offer.request());
    expect(offer.requested).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
    act(() => offer.presented());
    expect(offer.endsAt).toBe(premiumOpenedAt + 12 * HOUR);
    expect(mockValues.get(LAST)).toBe(Date.now());
});

test('tapping premium again during the active window does not restart the countdown', () => {
    mount();
    act(() => offer.activate());
    const originalEnd = offer.endsAt;
    act(() => jest.setSystemTime(Date.now() + HOUR));
    act(() => offer.activate());
    expect(offer.endsAt).toBe(originalEnd);
    expect(storage.set).toHaveBeenCalledTimes(1);
});

test('closing premium during an active countdown reopens without resetting either timestamp', () => {
    const presentedAt = Date.now() - HOUR;
    const endsAt = presentedAt + 12 * HOUR;
    mockValues.set(LAST, presentedAt);
    mockValues.set(END, endsAt);
    mount();
    act(() => offer.request());
    act(() => offer.presented());
    expect(offer.requested).toBe(true);
    expect(offer.endsAt).toBe(endsAt);
    expect(mockValues.get(LAST)).toBe(presentedAt);
    expect(storage.set).not.toHaveBeenCalled();
});

test('dismissing the offer stays closed across subsequent renders', () => {
    mount();
    act(() => offer.activate());
    act(() => offer.request());
    act(() => offer.presented());
    act(() => offer.close());
    act(() => renderer.update(<Harness />));
    expect(offer.requested).toBe(false);
    expect(offer.endsAt).toBe(Date.now() + 12 * HOUR);
});

test('expired offers remain blocked until 24 hours since presentation', () => {
    const lastPresented = Date.now() - 13 * HOUR;
    mockValues.set(LAST, lastPresented);
    mockValues.set(END, lastPresented + 12 * HOUR);
    mount();
    act(() => offer.activate());
    act(() => offer.request());
    expect(offer.requested).toBe(false);
    expect(offer.endsAt).toBe(null);
    act(() => jest.setSystemTime(lastPresented + 24 * HOUR));
    act(() => offer.activate());
    act(() => offer.request());
    expect(offer.requested).toBe(true);
});

test('premium access cancels the offer and clears the saved window', () => {
    mount();
    act(() => offer.activate());
    act(() => offer.request());
    act(() => offer.presented());
    act(() => renderer.update(<Harness premium />));
    act(() => offer.activate());
    act(() => offer.request());
    expect(offer.requested).toBe(false);
    expect(offer.endsAt).toBe(null);
    expect(mockValues.has(END)).toBe(false);
});

test('offers do not carry over between users', () => {
    mount();
    act(() => offer.activate());
    act(() => offer.request());
    act(() => offer.presented());
    act(() => renderer.update(<Harness userId="other-user" />));
    expect(offer.requested).toBe(false);
    expect(offer.endsAt).toBe(null);
    expect(mockValues.has(END)).toBe(true);
});

test('closing an unavailable offer does not create a countdown', () => {
    mount();
    act(() => offer.request());
    act(() => offer.close());
    expect(offer.endsAt).toBe(null);
    expect(mockValues.has(END)).toBe(false);
});

test('closing premium after the countdown expires does not show or restart the offer', () => {
    mount();
    act(() => offer.activate());
    const originalEnd = offer.endsAt;
    act(() => jest.setSystemTime(originalEnd));
    act(() => offer.request());
    act(() => offer.presented());
    expect(offer.requested).toBe(false);
    expect(mockValues.get(END)).toBe(originalEnd);
    expect(mockValues.has(LAST)).toBe(false);
});

test('tapping premium without an account ID does not start an offer', () => {
    mount({ userId: null });
    act(() => offer.activate());
    act(() => offer.request());
    expect(offer.requested).toBe(false);
    expect(offer.endsAt).toBe(null);
    expect(storage.set).not.toHaveBeenCalled();
});
