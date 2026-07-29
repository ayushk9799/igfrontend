import { apiFetch } from '../utils/apiFetch';

const parseJsonResponse = async (response) => {
    const data = await response.json();
    if (!response.ok || !data?.success) {
        throw new Error(data?.error || `Onboarding request failed (${response.status})`);
    }
    return data;
};

export const updateOnboardingStep = async (userId, step) => {
    const response = await apiFetch('/api/user/onboarding', {
        method: 'PUT',
        body: JSON.stringify({ userId, step }),
    });
    return parseJsonResponse(response);
};

export const updateOnboardingProfile = async (userId, updates) => {
    const response = await apiFetch('/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({ userId, ...updates }),
    });
    return parseJsonResponse(response);
};

