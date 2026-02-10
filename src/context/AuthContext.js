// Auth Context - Provides global auth error handling
import React, { createContext, useContext, useCallback, useState } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children, onAuthError }) => {
    const [authErrorOccurred, setAuthErrorOccurred] = useState(false);

    // This function will be called when a 401/authentication error occurs
    const handleAuthError = useCallback((error) => {

        // Prevent multiple redirects
        if (authErrorOccurred) {
            return;
        }

        setAuthErrorOccurred(true);

        // Call the parent's auth error handler (triggers navigation to login)
        if (onAuthError) {
            onAuthError(error);
        }

        // Reset the flag after a short delay to allow future errors to be handled
        setTimeout(() => setAuthErrorOccurred(false), 3000);
    }, [authErrorOccurred, onAuthError]);

    // Reset auth error state (call this after successful login)
    const resetAuthError = useCallback(() => {
        setAuthErrorOccurred(false);
    }, []);

    const value = {
        handleAuthError,
        resetAuthError,
        authErrorOccurred,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuthContext = () => {
    const context = useContext(AuthContext);
    if (!context) {
        // Return a no-op handler if context is not available
        return {
            handleAuthError: () => console.warn('AuthContext not available'),
            resetAuthError: () => { },
            authErrorOccurred: false,
        };
    }
    return context;
};

export default AuthContext;
