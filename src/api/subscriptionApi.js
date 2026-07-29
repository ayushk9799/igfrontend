import { API_BASE } from '../constants/Api';
import { apiFetch } from '../utils/apiFetch';

export const PREMIUM_ENTITLEMENT_ID = 'premium';

export const getPremiumEntitlement = (customerInfo) => {
    const active = customerInfo?.entitlements?.active || {};
    // Keep the first-entitlement fallback during rollout so current customers
    // are not locked out before the dashboard identifier is configured.
    return active[PREMIUM_ENTITLEMENT_ID] || Object.values(active)[0] || null;
};

export const mapSubscriptionAccessToUser = (data) => {
    const access = data?.access;
    if (!access) return null;

    const own = access.ownSubscription;
    const partner = access.partnerSubscription;

    return {
        isPremium: access.hasPremiumAccess === true,
        premiumSource: access.premiumSource || null,
        premiumOwnerUserId: access.premiumOwnerUserId || null,
        subscriptionStatus: access.subscription?.status || null,
        subscriptionBillingIssueAt: access.subscription?.billingIssueAt || null,

        premiumExpiresAt: own?.expiresAt || null,
        premiumPlan: own?.productId || null,
        premiumWillRenew: own?.willRenew ?? null,
        premiumCancelledAt: own?.cancelledAt || null,

        partnerIsPremium: partner?.givesAccess === true,
        partnerPremiumExpiresAt: partner?.expiresAt || null,
        partnerPremiumPlan: partner?.productId || null,
        partnerPremiumWillRenew: partner?.willRenew ?? null,
        partnerPremiumCancelledAt: partner?.cancelledAt || null,
        partnerSubscriptionStatus: partner?.status || null,
        partnerSubscriptionBillingIssueAt: partner?.billingIssueAt || null,
    };
};

const parseResponse = async (response) => {
    const data = await response.json();
    // A 503 refresh response intentionally includes stale, safe access data.
    if (!response.ok && !data?.access) {
        throw new Error(data?.error || `Subscription request failed (${response.status})`);
    }
    return data;
};

export const refreshSubscription = async (userId) => {
    const response = await apiFetch(`${API_BASE}/api/subscriptions/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
    });
    return parseResponse(response);
};

export const getSubscriptionStatus = async (userId) => {
    const response = await apiFetch(`${API_BASE}/api/subscriptions/status/${encodeURIComponent(userId)}`);
    return parseResponse(response);
};
