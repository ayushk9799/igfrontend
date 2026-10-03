import { useCallback, useEffect, useState } from 'react';
import { storage } from '../utils/authStorage';
import { trackEvent } from '../utils/analytics';

const OFFER_WINDOW_MS = 12 * 60 * 60 * 1000;
const OFFER_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const LAST_PRESENTED_KEY = 'yearly_offer_last_presented_v2';
const WINDOW_END_KEY = 'yearly_offer_window_end_v2';
const offerKey = (prefix, userId) => `${prefix}:${userId}`;

export default function useYearlyOffer(userId, hasPremiumAccess) {
    const [requested, setRequested] = useState(false);
    const [endsAt, setEndsAt] = useState(null);

    useEffect(() => {
        setRequested(false);
        if (!userId) {
            setEndsAt(null);
            return;
        }
        const key = offerKey(WINDOW_END_KEY, userId);
        if (hasPremiumAccess) {
            storage.delete(key);
            setEndsAt(null);
            return;
        }
        const storedEnd = storage.getNumber(key) || 0;
        setEndsAt(storedEnd > Date.now() ? storedEnd : null);
    }, [hasPremiumAccess, userId]);

    const activate = useCallback(() => {
        if (!userId || hasPremiumAccess) return;
        const now = Date.now();
        const key = offerKey(WINDOW_END_KEY, userId);
        const storedEnd = storage.getNumber(key) || 0;
        if (storedEnd > now) {
            setEndsAt(storedEnd);
            return;
        }
        const lastPresented = storage.getNumber(offerKey(LAST_PRESENTED_KEY, userId)) || 0;
        if (now - lastPresented < OFFER_COOLDOWN_MS) return;
        const windowEnd = now + OFFER_WINDOW_MS;
        storage.set(key, windowEnd);
        setEndsAt(windowEnd);
    }, [hasPremiumAccess, userId]);

    const request = useCallback(() => {
        if (!userId || hasPremiumAccess) return;
        const storedEnd = storage.getNumber(offerKey(WINDOW_END_KEY, userId)) || 0;
        if (storedEnd <= Date.now()) return;
        setRequested(true);
    }, [hasPremiumAccess, userId]);

    const close = useCallback(() => {
        setRequested(false);
    }, []);

    const presented = useCallback(() => {
        if (!userId || hasPremiumAccess) return;
        const now = Date.now();
        const storedEnd = storage.getNumber(offerKey(WINDOW_END_KEY, userId)) || 0;
        if (storedEnd <= now) return;
        const lastPresented = storage.getNumber(offerKey(LAST_PRESENTED_KEY, userId)) || 0;
        if (lastPresented >= storedEnd - OFFER_WINDOW_MS) return;
        storage.set(offerKey(LAST_PRESENTED_KEY, userId), now);
    }, [hasPremiumAccess, userId]);

    const complete = useCallback(() => {
        setRequested(false);
        setEndsAt(null);
        if (userId) storage.delete(offerKey(WINDOW_END_KEY, userId));
    }, [userId]);

    const expire = useCallback(() => {
        trackEvent('yearly_offer_expired', { source: 'card_timer' });
        complete();
    }, [complete]);

    return { requested: requested && !hasPremiumAccess && !!userId, endsAt, activate, request, close, presented, complete, expire };
}
