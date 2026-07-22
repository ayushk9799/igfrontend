// User Slice - Manages user authentication and partner data
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    id: null,
    name: '',
    email: '',
    nickname: '',
    relationshipStartDate: null,
    pendingRelationshipStartDate: null,
    shouldAskRelationshipStartDate: false,
    avatar: null,
    avatarThumbnail: null,        // Base64 compressed thumbnail (~100x100)
    partnerId: null,
    partnerUsername: null,
    partnerAvatar: null,
    partnerAvatarThumbnail: null, // Base64 compressed thumbnail (~100x100)
    partnerCode: null,
    connectionDate: null,
    isAuthenticated: false,
    isOnboarded: false,
    // Premium subscription fields
    isPremium: false,
    customerInfo: null,
    premiumExpiresAt: null,
    premiumPlan: null,
    premiumWillRenew: null,
    premiumCancelledAt: null,
    premiumSource: null,           // 'self' | 'partner' | null
    premiumOwnerUserId: null,
    subscriptionStatus: null,
    subscriptionBillingIssueAt: null,
    timezone: null,
    platform: 'unknown',
    locationSharingEnabled: false,
    locationUpdatedAt: null,
    // Partner premium fields (for couple premium)
    partnerIsPremium: false,
    partnerPremiumPlan: null,
    partnerPremiumExpiresAt: null,
    partnerPremiumWillRenew: null,
    partnerPremiumCancelledAt: null,
    partnerSubscriptionStatus: null,
    partnerSubscriptionBillingIssueAt: null,
};

const userSlice = createSlice({
    name: 'user',
    initialState,
    reducers: {
        setUser: (state, action) => {
            return { ...state, ...action.payload, isAuthenticated: true };
        },
        updateUser: (state, action) => {
            return { ...state, ...action.payload };
        },
        setPartner: (state, action) => {
            const partnerExpiresAt = action.payload.premiumExpiresAt || null;
            const partnerPremium = action.payload.isPremium === true
                || !!(partnerExpiresAt && new Date(partnerExpiresAt) > new Date());
            const userPremium = (state.premiumSource === 'self' && state.isPremium === true)
                || !!(state.premiumExpiresAt && new Date(state.premiumExpiresAt) > new Date());
            return {
                ...state,
                partnerId: action.payload.id,
                partnerUsername: action.payload.name,
                partnerAvatar: action.payload.avatar || null,
                connectionDate: action.payload.connectionDate,
                relationshipStartDate: action.payload.relationshipStartDate || state.relationshipStartDate,
                pendingRelationshipStartDate: action.payload.pendingRelationshipStartDate || state.pendingRelationshipStartDate,
                shouldAskRelationshipStartDate: action.payload.shouldAskRelationshipStartDate || false,
                partnerIsPremium: partnerPremium,
                partnerPremiumPlan: action.payload.premiumPlan || null,
                partnerPremiumExpiresAt: partnerExpiresAt,
                partnerPremiumWillRenew: action.payload.premiumWillRenew ?? null,
                partnerPremiumCancelledAt: action.payload.premiumCancelledAt || null,
                partnerSubscriptionStatus: action.payload.subscriptionStatus || null,
                partnerSubscriptionBillingIssueAt: action.payload.subscriptionBillingIssueAt || null,
                // Activate couple premium if partner is premium but user isn't
                isPremium: userPremium || partnerPremium,
                premiumSource: userPremium ? (state.premiumSource || 'self') : (partnerPremium ? 'partner' : state.premiumSource),
                isOnboarded: true,
            };
        },
        setOnboarded: (state, action) => {
            state.isOnboarded = action.payload;
        },
        // Premium-related reducers
        setCustomerInfo: (state, action) => {
            state.customerInfo = action.payload || null;
        },
        setPremiumStatus: (state, action) => {
            state.isPremium = action.payload.isPremium;
            state.premiumExpiresAt = action.payload.premiumExpiresAt;
            state.premiumPlan = action.payload.premiumPlan;
            if (Object.prototype.hasOwnProperty.call(action.payload, 'premiumWillRenew')) {
                state.premiumWillRenew = action.payload.premiumWillRenew ?? null;
            }
            if (Object.prototype.hasOwnProperty.call(action.payload, 'premiumCancelledAt')) {
                state.premiumCancelledAt = action.payload.premiumCancelledAt || null;
            }
            state.premiumSource = action.payload.premiumSource ?? null;
            if (Object.prototype.hasOwnProperty.call(action.payload, 'premiumOwnerUserId')) {
                state.premiumOwnerUserId = action.payload.premiumOwnerUserId || null;
            }
            if (Object.prototype.hasOwnProperty.call(action.payload, 'subscriptionStatus')) {
                state.subscriptionStatus = action.payload.subscriptionStatus || null;
            }
            if (Object.prototype.hasOwnProperty.call(action.payload, 'subscriptionBillingIssueAt')) {
                state.subscriptionBillingIssueAt = action.payload.subscriptionBillingIssueAt || null;
            }
            if (Object.prototype.hasOwnProperty.call(action.payload, 'partnerIsPremium')) {
                state.partnerIsPremium = action.payload.partnerIsPremium === true;
                state.partnerPremiumExpiresAt = action.payload.partnerPremiumExpiresAt || null;
                state.partnerPremiumPlan = action.payload.partnerPremiumPlan || null;
                state.partnerPremiumWillRenew = action.payload.partnerPremiumWillRenew ?? null;
                state.partnerPremiumCancelledAt = action.payload.partnerPremiumCancelledAt || null;
                state.partnerSubscriptionStatus = action.payload.partnerSubscriptionStatus || null;
                state.partnerSubscriptionBillingIssueAt = action.payload.partnerSubscriptionBillingIssueAt || null;
            }
        },
        logout: () => initialState,
    },
});

export const { setUser, updateUser, setPartner, setOnboarded, setCustomerInfo, setPremiumStatus, logout } = userSlice.actions;

// Selectors
export const selectUser = (state) => state.user;
export const selectIsAuthenticated = (state) => state.user.isAuthenticated;
export const selectIsOnboarded = (state) => state.user.isOnboarded;
export const selectHasPartner = (state) => !!state.user.partnerId;
export const selectPartnerName = (state) => state.user.partnerUsername;
const isDateActive = (dateStr) => !!(dateStr && new Date(dateStr) > new Date());
export const selectIsPremium = (state) => {
    const activeStatuses = ['active', 'cancelled', 'billing_issue', 'paused'];
    const canonicalAccess = state.user.isPremium === true
        && activeStatuses.includes(state.user.subscriptionStatus);
    const partnerCanonicalAccess = state.user.partnerIsPremium === true
        && activeStatuses.includes(state.user.partnerSubscriptionStatus);
    return canonicalAccess
        || partnerCanonicalAccess
        || isDateActive(state.user.premiumExpiresAt)
        || isDateActive(state.user.partnerPremiumExpiresAt);
}
export const selectDaysTogether = (state) => {
    const startDate = state.user.relationshipStartDate || state.user.pendingRelationshipStartDate || state.user.connectionDate;
    if (!startDate) return 0;
    return Math.floor((new Date() - new Date(startDate)) / (1000 * 60 * 60 * 24));
};

export default userSlice.reducer;
