// User Slice - Manages user authentication and partner data
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    id: null,
    name: '',
    email: '',
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
            const partnerPremium = action.payload.isPremium || false;
            return {
                ...state,
                partnerId: action.payload.id,
                partnerUsername: action.payload.name,
                partnerAvatar: action.payload.avatar || null,
                connectionDate: action.payload.connectionDate,
                partnerIsPremium: partnerPremium,
                partnerPremiumPlan: action.payload.premiumPlan || null,
                partnerPremiumExpiresAt: action.payload.premiumExpiresAt || null,
                // Activate couple premium if partner is premium but user isn't
                isPremium: state.isPremium || partnerPremium,
                premiumSource: state.isPremium ? (state.premiumSource || 'self') : (partnerPremium ? 'partner' : state.premiumSource),
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
export const selectIsPremium = (state) => state.user.isPremium || state.user.partnerIsPremium;
export const selectDaysTogether = (state) => {
    if (!state.user.connectionDate) return 0;
    return Math.floor((new Date() - new Date(state.user.connectionDate)) / (1000 * 60 * 60 * 24));
};

export default userSlice.reducer;

