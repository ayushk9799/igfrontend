export const needsRelationshipStartDate = (user) => Boolean(
    user?.partnerId
    && !user?.relationshipStartDate
    && user?.shouldAskRelationshipStartDate === true
);

export const getRequiredOnboardingScreen = (user) => {
    if (!user?.nickname) return 'nickname';
    if (!user?.onboarding?.avatarDecisionAt) return 'avatarSelection';
    if (!user?.onboarding?.notificationPromptedAt) return 'notificationPermission';
    if (needsRelationshipStartDate(user)) return 'relationshipStartDate';
    if (!user?.partnerId && !user?.onboarding?.partnerStepCompletedAt) return 'partnerCode';
    return 'home';
};

