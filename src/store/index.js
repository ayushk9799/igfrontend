// Redux Store Configuration
import { configureStore } from '@reduxjs/toolkit';
import userReducer from './slices/userSlice';
import gamesReducer from './slices/gamesSlice';

export const store = configureStore({
    reducer: {
        user: userReducer,
        games: gamesReducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: {
                // Ignore paths that may have non-serializable data (dates, etc.)
                ignoredPaths: ['user.connectionDate'],
            },
        }),
});

export default store;
