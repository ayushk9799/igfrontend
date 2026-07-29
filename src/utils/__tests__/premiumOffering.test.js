import {
    calculateSavingsPercent,
    getFreeTrialPeriod,
    normalizeTrialPeriod,
    resolveOfferingPackages,
} from '../premiumOffering';

describe('premium offering helpers', () => {
    test('resolves predefined packages from available packages', () => {
        const annual = { identifier: '$rc_annual', packageType: 'ANNUAL' };
        const monthly = { identifier: '$rc_monthly', packageType: 'MONTHLY' };
        const custom = { identifier: 'lifetime', packageType: 'CUSTOM' };

        expect(resolveOfferingPackages({
            availablePackages: [custom, monthly, annual],
        })).toEqual({
            annual,
            monthly,
            fallback: custom,
            availablePackages: [custom, monthly, annual],
        });
    });

    test('keeps a custom package as a usable fallback', () => {
        const custom = { identifier: 'couple_special', packageType: 'CUSTOM' };
        expect(resolveOfferingPackages({ availablePackages: [custom] }).fallback).toBe(custom);
    });

    test('does not mistake multi-month packages for monthly packages', () => {
        const threeMonth = { identifier: '$rc_three_month', packageType: 'THREE_MONTH' };
        const resolved = resolveOfferingPackages({ availablePackages: [threeMonth] });
        expect(resolved.monthly).toBeNull();
        expect(resolved.fallback).toBe(threeMonth);
    });

    test('reads free-trial periods for each store representation', () => {
        expect(getFreeTrialPeriod({
            product: { introPrice: { price: 0, period: 'P7D' } },
        }, 'ios')).toBe('P7D');
        expect(getFreeTrialPeriod({
            product: {
                defaultOption: {
                    freePhase: { billingPeriod: { value: 1, unit: 'MONTH', iso8601: 'P1M' } },
                },
            },
        }, 'android')).toEqual({ value: 1, unit: 'MONTH', iso8601: 'P1M' });
    });

    test('normalizes trial periods', () => {
        expect(normalizeTrialPeriod('P7D')).toEqual({ value: 7, unit: 'day' });
        expect(normalizeTrialPeriod({ value: 2, unit: 'WEEK' })).toEqual({ value: 2, unit: 'week' });
        expect(normalizeTrialPeriod({ value: 1, unit: 'UNKNOWN', iso8601: 'P1M' }))
            .toEqual({ value: 1, unit: 'month' });
        expect(normalizeTrialPeriod('invalid')).toBeNull();
    });

    test('only reports meaningful positive savings', () => {
        expect(calculateSavingsPercent(10, 90)).toBe(25);
        expect(calculateSavingsPercent(10, 120)).toBeNull();
        expect(calculateSavingsPercent(0, 90)).toBeNull();
    });
});
