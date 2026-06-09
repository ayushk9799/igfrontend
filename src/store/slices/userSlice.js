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
    premiumSource: null,           // 'self' | 'partner' | null
    timezone: null,
    platform: 'unknown',
    // Partner premium fields (for couple premium)
    partnerIsPremium: false,
    partnerPremiumPlan: null,
    partnerPremiumExpiresAt: null,
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
            const partnerPremium = !!(partnerExpiresAt && new Date(partnerExpiresAt) > new Date());
            const userPremium = !!(state.premiumExpiresAt && new Date(state.premiumExpiresAt) > new Date());
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
            state.isPremium = action.payload?.activeSubscriptions?.length > 0;
            state.customerInfo = action.payload || null;
        },
        setPremiumStatus: (state, action) => {
            state.isPremium = action.payload.isPremium;
            state.premiumExpiresAt = action.payload.premiumExpiresAt;
            state.premiumPlan = action.payload.premiumPlan;
            state.premiumSource = action.payload.premiumSource || 'self';
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
    return isDateActive(state.user.premiumExpiresAt) || isDateActive(state.user.partnerPremiumExpiresAt);
}
export const selectDaysTogether = (state) => {
    const startDate = state.user.relationshipStartDate || state.user.pendingRelationshipStartDate || state.user.connectionDate;
    if (!startDate) return 0;
    return Math.floor((new Date() - new Date(startDate)) / (1000 * 60 * 60 * 24));
};

export default userSlice.reducer;
