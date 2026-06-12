import { AppState, Platform } from 'react-native';
import * as StoreReview from 'expo-store-review';
import { storage } from './authStorage';

const REVIEW_STATE_KEY = 'in_app_review_state_v1';
const GLOBAL_COOLDOWN_MS = 1000 * 60 * 60 * 24 * 120;
const MOMENT_COOLDOWN_MS = 1000 * 60 * 60 * 24 * 14;
export const REVIEW_MOMENTS = {
    DAILY_CHALLENGE_COMPLETED: 'daily_challenge_completed',
    V2_SET_SUMMARY_SHOWN: 'v2_set_summary_shown',
    PARTNER_PAIRED: 'partner_paired',
    SCRIBBLE_SENT: 'scribble_sent',
    PUZZLE_SENT: 'puzzle_sent',
    MOOD_UPDATED: 'mood_updated',
    GAME_COMPLETED: 'game_completed',
};

const readReviewState = () => {
    try {
        const raw = storage.getString(REVIEW_STATE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (error) {
        return {};
    }
};

const writeReviewState = (state) => {
    try {
        storage.set(REVIEW_STATE_KEY, JSON.stringify(state));
    } catch (error) {
        // Review prompts are opportunistic; storage failures should never affect the app flow.
    }
};

const shouldAskForReview = (moment, now) => {
    if (!moment || !Object.values(REVIEW_MOMENTS).includes(moment)) return false;
    if (!['ios', 'android'].includes(Platform.OS)) return false;
    if (AppState.currentState !== 'active') return false;

    const state = readReviewState();
    const lastPromptedAt = Number(state.lastPromptedAt || 0);
    const lastMomentPromptedAt = Number(state.moments?.[moment]?.lastPromptedAt || 0);

    if (lastPromptedAt && now - lastPromptedAt < GLOBAL_COOLDOWN_MS) return false;
    if (lastMomentPromptedAt && now - lastMomentPromptedAt < MOMENT_COOLDOWN_MS) return false;

    return true;
};

export const requestReviewForMoment = async (moment) => {
    const now = Date.now();
    const state = readReviewState();
    const momentState = state.moments?.[moment] || {};

    writeReviewState({
        ...state,
        moments: {
            ...(state.moments || {}),
            [moment]: {
                ...momentState,
                count: Number(momentState.count || 0) + 1,
                lastSeenAt: now,
            },
        },
    });

    if (!shouldAskForReview(moment, now)) return false;

    try {
        const available = await StoreReview.isAvailableAsync();
        const hasAction = available || await StoreReview.hasAction();
        if (!hasAction) return false;

        const latestState = readReviewState();
        writeReviewState({
            ...latestState,
            lastPromptedAt: now,
            lastPromptedMoment: moment,
            moments: {
                ...(latestState.moments || {}),
                [moment]: {
                    ...(latestState.moments?.[moment] || {}),
                    lastPromptedAt: now,
                },
            },
        });

        setTimeout(async () => {
            try {
                await StoreReview.requestReview();
            } catch (error) {
                // Native review APIs can no-op or reject depending on store state; ignore quietly.
            }
        }, 900);

        return true;
    } catch (error) {
        return false;
    }
};
