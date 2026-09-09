const normalizePackageType = (pkg) => String(pkg?.packageType || '').toUpperCase();

const packageMatches = (pkg, type, identifiers) => {
    const packageType = normalizePackageType(pkg);
    const identifier = String(pkg?.identifier || '').toLowerCase();
    if (packageType === type) return true;
    if (packageType && !['CUSTOM', 'UNKNOWN'].includes(packageType)) return false;
    return identifiers.some(value => (
        identifier === value
        || identifier === `$rc_${value}`
        || identifier.endsWith(`_${value}`)
        || identifier.endsWith(`-${value}`)
    ));
};

export const resolveOfferingPackages = (offering) => {
    const availablePackages = Array.isArray(offering?.availablePackages)
        ? offering.availablePackages
        : [];
    const annual = offering?.annual
        || availablePackages.find(pkg => packageMatches(pkg, 'ANNUAL', ['annual', 'yearly', 'year']))
        || null;
    const monthly = offering?.monthly
        || availablePackages.find(pkg => packageMatches(pkg, 'MONTHLY', ['monthly', 'month']))
        || null;
    const weekly = offering?.weekly
        || availablePackages.find(pkg => packageMatches(pkg, 'WEEKLY', ['weekly', 'week']))
        || null;
    const selectedIdentifiers = new Set(
        [annual?.identifier, monthly?.identifier, weekly?.identifier].filter(Boolean),
    );
    const fallback = availablePackages.find(pkg => !selectedIdentifiers.has(pkg?.identifier)) || null;

    return { annual, monthly, weekly, fallback, availablePackages };
};

export const getFreeTrialPeriod = (pkg, platform) => {
    if (!pkg?.product) return null;

    if (platform === 'android') {
        return pkg.product.defaultOption?.freePhase?.billingPeriod || null;
    }

    const introPrice = pkg.product.introPrice;
    if (introPrice?.price === 0) {
        return introPrice.period || null;
    }

    return null;
};

export const normalizeTrialPeriod = (period) => {
    if (!period) return null;

    if (typeof period === 'object') {
        const value = Number(period.value);
        const unit = String(period.unit || '').toLowerCase();
        return Number.isFinite(value)
            && value > 0
            && ['day', 'week', 'month', 'year'].includes(unit)
            ? { value, unit }
            : normalizeTrialPeriod(period.iso8601);
    }

    const match = String(period).match(/^P(\d+)([DWMY])$/i);
    if (!match) return null;

    const units = {
        D: 'day',
        W: 'week',
        M: 'month',
        Y: 'year',
    };
    return {
        value: Number(match[1]),
        unit: units[match[2].toUpperCase()],
    };
};

export const calculateSavingsPercent = (basePrice, annualPrice, multiplier = 12) => {
    const base = Number(basePrice);
    const annual = Number(annualPrice);
    const periods = Number(multiplier) || 12;
    if (!Number.isFinite(base) || !Number.isFinite(annual) || base <= 0 || annual < 0) {
        return null;
    }

    const fullYearCost = base * periods;
    const savings = Math.round(((fullYearCost - annual) / fullYearCost) * 100);
    return savings > 0 && savings < 100 ? savings : null;
};
