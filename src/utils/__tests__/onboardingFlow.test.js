import {
    getRequiredOnboardingScreen,
    needsRelationshipStartDate,
} from '../onboardingFlow';

const completeProgress = {
    avatarDecisionAt: '2026-01-01T00:00:00.000Z',
    notificationPromptedAt: '2026-01-01T00:00:00.000Z',
    partnerStepCompletedAt: '2026-01-01T00:00:00.000Z',
};

describe('onboarding flow', () => {
    test('resumes at each incomplete profile decision', () => {
        expect(getRequiredOnboardingScreen({})).toBe('nickname');
        expect(getRequiredOnboardingScreen({ nickname: 'Love', onboarding: {} })).toBe('avatarSelection');
        expect(getRequiredOnboardingScreen({
            nickname: 'Love',
            onboarding: { avatarDecisionAt: completeProgress.avatarDecisionAt },
        })).toBe('notificationPermission');
    });

    test('requires pairing until the user pairs or explicitly skips', () => {
        expect(getRequiredOnboardingScreen({
            nickname: 'Love',
            onboarding: {
                avatarDecisionAt: completeProgress.avatarDecisionAt,
                notificationPromptedAt: completeProgress.notificationPromptedAt,
            },
        })).toBe('partnerCode');
        expect(getRequiredOnboardingScreen({
            nickname: 'Love',
            onboarding: completeProgress,
        })).toBe('home');
    });

    test('routes only the prompted partner to relationship date', () => {
        const user = {
            nickname: 'Love',
            partnerId: 'partner-id',
            onboarding: completeProgress,
            shouldAskRelationshipStartDate: true,
        };
        expect(needsRelationshipStartDate(user)).toBe(true);
        expect(getRequiredOnboardingScreen(user)).toBe('relationshipStartDate');
        expect(getRequiredOnboardingScreen({
            ...user,
            relationshipStartDate: '2020-01-01T00:00:00.000Z',
        })).toBe('home');
    });
});

