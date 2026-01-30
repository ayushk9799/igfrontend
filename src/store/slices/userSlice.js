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
            return {
                ...state,
                partnerId: action.payload.id,
                partnerUsername: action.payload.name,
                partnerAvatar: action.payload.avatar || null,
                connectionDate: action.payload.connectionDate,
                isOnboarded: true,
            };
        },
        setOnboarded: (state, action) => {
            state.isOnboarded = action.payload;
        },
        logout: () => initialState,
    },
});

export const { setUser, updateUser, setPartner, setOnboarded, logout } = userSlice.actions;

// Selectors
export const selectUser = (state) => state.user;
export const selectIsAuthenticated = (state) => state.user.isAuthenticated;
export const selectIsOnboarded = (state) => state.user.isOnboarded;
export const selectHasPartner = (state) => !!state.user.partnerId;
export const selectPartnerName = (state) => state.user.partnerUsername;
export const selectDaysTogether = (state) => {
    if (!state.user.connectionDate) return 0;
    return Math.floor((new Date() - new Date(state.user.connectionDate)) / (1000 * 60 * 60 * 24));
};

export default userSlice.reducer;
