// API Fetch wrapper with authentication error handling
import { API_BASE } from '../constants/Api';

// Global auth error handler reference
let globalAuthErrorHandler = null;

// Set the global auth error handler (called from App.js or AppNavigator)
export const setAuthErrorHandler = (handler) => {
    globalAuthErrorHandler = handler;
};

// Trigger auth error from anywhere in the app (useful for socket auth errors)
export const triggerAuthError = (error) => {
    if (globalAuthErrorHandler) {
        globalAuthErrorHandler(error);
    } else {
        console.warn('🔒 [API] Auth error triggered but no handler set:', error);
    }
};

/**
 * Wrapper around fetch that handles authentication errors globally
 * When a 401 response is received, it will trigger navigation to login
 * 
 * @param {string} url - The URL to fetch (can be relative or absolute)
 * @param {object} options - Fetch options (method, headers, body, etc.)
 * @returns {Promise} - The fetch response
 */
export const apiFetch = async (url, options = {}) => {
    // If url doesn't start with http, prepend API_BASE
    const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;

    try {
        const response = await fetch(fullUrl, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        // Check for authentication errors (401 Unauthorized, 403 Forbidden)
        if (response.status === 401 || response.status === 403) {

            // Try to get more details from the response
            let errorMessage = 'Authentication failed';
            try {
                const errorData = await response.clone().json();
                errorMessage = errorData.error || errorData.message || errorMessage;
            } catch (e) {
                // Ignore parse errors
            }

            // Trigger global auth error handler
            if (globalAuthErrorHandler) {
                globalAuthErrorHandler({
                    status: response.status,
                    message: errorMessage,
                });
            }

            // Still throw so the caller knows the request failed
            throw new Error(`Authentication Error: ${errorMessage}`);
        }

        return response;
    } catch (error) {
        // Re-throw the error for the caller to handle
        throw error;
    }
};

/**
 * Helper for GET requests
 */
export const apiGet = async (url, options = {}) => {
    return apiFetch(url, { ...options, method: 'GET' });
};

/**
 * Helper for POST requests
 */
export const apiPost = async (url, body, options = {}) => {
    return apiFetch(url, {
        ...options,
        method: 'POST',
        body: typeof body === 'string' ? body : JSON.stringify(body),
    });
};

/**
 * Helper for PUT requests
 */
export const apiPut = async (url, body, options = {}) => {
    return apiFetch(url, {
        ...options,
        method: 'PUT',
        body: typeof body === 'string' ? body : JSON.stringify(body),
    });
};

/**
 * Helper for DELETE requests
 */
export const apiDelete = async (url, options = {}) => {
    return apiFetch(url, { ...options, method: 'DELETE' });
};

export default apiFetch;
