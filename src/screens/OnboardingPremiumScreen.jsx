// Onboarding Premium Screen - onboarding copy of the premium subscription UI
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    AccessibilityInfo,
    View,
    Text,
    TouchableOpacity,
    Pressable,
    Image,
    Animated,
    StyleSheet,
    Linking,
    ActivityIndicator,
    Alert,
    StatusBar,
    ScrollView,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import Purchases from 'react-native-purchases';
import { colors } from '../theme';
import { fontFamily, fontWeight } from '../constants/fonts';
import { setCustomerInfo, setPremiumStatus } from '../store/slices/userSlice';
import { getPremiumEntitlement, mapSubscriptionAccessToUser, refreshSubscription } from '../api/subscriptionApi';
import { updateUser as updateUserStorage } from '../utils/authStorage';
import { getUiLocale, translateUiTemplate, translateUiText } from '../i18n/uiTranslation';
import {
    calculateSavingsPercent,
    getFreeTrialPeriod,
    normalizeTrialPeriod,
    resolveOfferingPackages,
} from '../utils/premiumOffering';

const ONBOARDING_OFFERING_IDS = ['onboarding', 'onbording'];

// Close (cross) icon
const CloseIcon = () => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path
            d="M18 6L6 18M6 6l12 12"
            stroke="#2E1E3C"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </Svg>
);



// Check / Minus Icons
const PinkCheck = () => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="12" r="10" fill={colors.primary} />
        <Path d="M8 12.5l2.5 2.5 5-5" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);



// Radio checkmark components
const RadioCircleOutline = () => (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="12" r="10" stroke="#C5C9D6" strokeWidth={2.2} />
    </Svg>
);

const RadioCircleChecked = () => (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="12" r="12" fill={colors.primary} />
        <Path d="M8 12.5l2.5 2.5 5-5" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);

// SVG Heart Icon
const HeartIcon = ({ size = 20, color = colors.primary }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <Path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </Svg>
);

// Animated Floating Heart
const FloatingHeart = ({
    delay = 0,
    startX = 0,
    size = 16,
    color = colors.primary,
    zIndex = 1,
    reduceMotion = false,
}) => {
    const animation = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (reduceMotion) {
            animation.setValue(0);
            return undefined;
        }

        let mounted = true;
        let activeAnimation;
        const startAnimation = () => {
            if (!mounted) return;
            animation.setValue(0);
            activeAnimation = Animated.timing(animation, {
                toValue: 1,
                duration: 4000,
                delay: delay,
                useNativeDriver: true,
            });
            activeAnimation.start(({ finished }) => {
                if (finished && mounted) startAnimation();
            });
        };

        startAnimation();
        return () => {
            mounted = false;
            activeAnimation?.stop();
        };
    }, [animation, delay, reduceMotion]);

    // Rising Y animation
    const translateY = animation.interpolate({
        inputRange: [0, 1],
        outputRange: [50, -110],
    });

    // Swaying X animation
    const translateX = animation.interpolate({
        inputRange: [0, 0.25, 0.5, 0.75, 1],
        outputRange: [startX, startX + 12, startX - 12, startX + 8, startX],
    });

    // Growing/shrinking scale
    const scale = animation.interpolate({
        inputRange: [0, 0.2, 0.8, 1],
        outputRange: [0.3, 1, 1, 0.3],
    });

    // Fading opacity
    const opacity = animation.interpolate({
        inputRange: [0, 0.2, 0.8, 1],
        outputRange: [0, 0.8, 0.8, 0],
    });

    return (
        <Animated.View
            accessible={false}
            importantForAccessibility="no-hide-descendants"
            pointerEvents="none"
            style={[
                styles.floatingHeart,
                {
                    transform: [{ translateY }, { translateX }, { scale }],
                    opacity,
                    zIndex,
                },
            ]}
        >
            <HeartIcon size={size} color={color} />
        </Animated.View>
    );
};

export default function OnboardingPremiumScreen({ onBack }) {
    const dispatch = useDispatch();
    const user = useSelector(state => state.user);
    useTranslation();
    const [selectedPlan, setSelectedPlan] = useState('annual'); // Default to Yearly/Annual plan
    const [offering, setOffering] = useState(null);
    const [entitlements, setEntitlements] = useState(null);
    const [plansLoading, setPlansLoading] = useState(false);
    const [purchasing, setPurchasing] = useState(false);
    const [purchaseSucceeded, setPurchaseSucceeded] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [annualTrialPeriod, setAnnualTrialPeriod] = useState(null);
    const [purchasePending, setPurchasePending] = useState(false);
    const [reduceMotion, setReduceMotion] = useState(false);
    const insets = useSafeAreaInsets();
    const screenEntrance = useRef(new Animated.Value(0)).current;
    const successScale = useRef(new Animated.Value(0.7)).current;
    const successAnimationRef = useRef(null);
    const mountedRef = useRef(true);
    const insetStyles = useMemo(() => StyleSheet.create({
        topAction: {
            top: insets.top > 0 ? insets.top + 6 : 16,
        },
        scrollContent: {
            paddingTop: insets.top > 0 ? insets.top + 8 : 16,
        },
        bottomContent: {
            paddingBottom: insets.bottom > 0 ? insets.bottom + 8 : 16,
        },
    }), [insets.bottom, insets.top]);

    const features = [
        { label: translateUiText("One premium covers both of you") },
        { label: translateUiText("2000+ couple questions") },
        { label: translateUiText("Unlimited Games") },
        { label: translateUiText("Unlimited Memories") },
        { label: translateUiText("Live drawing") },
        { label: translateUiText("Widgets") },
    ];

    useEffect(() => {
        mountedRef.current = true;
        AccessibilityInfo.isReduceMotionEnabled()
            .then(enabled => {
                if (mountedRef.current) setReduceMotion(enabled);
            })
            .catch(() => {});
        const subscription = AccessibilityInfo.addEventListener(
            'reduceMotionChanged',
            setReduceMotion,
        );

        return () => {
            mountedRef.current = false;
            successAnimationRef.current?.stop();
            subscription.remove();
        };
    }, []);

    useEffect(() => {
        if (reduceMotion) {
            screenEntrance.setValue(1);
            return undefined;
        }

        const entranceAnimation = Animated.timing(screenEntrance, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
        });
        entranceAnimation.start();
        return () => entranceAnimation.stop();
    }, [reduceMotion, screenEntrance]);

    useEffect(() => {
        const init = async () => {
            await getOfferingsAndEntitlements();
        };
        init();
        // This screen intentionally performs a one-time purchase initialization.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const syncServerPremium = async (customerInfo) => {
        try {
            const uid = user?.id;
            if (!uid) return;
            const response = await refreshSubscription(uid);
            const premiumData = mapSubscriptionAccessToUser(response);
            if (premiumData && (premiumData.isPremium || !getPremiumEntitlement(customerInfo))) {
                updateUserStorage(premiumData);
                dispatch(setPremiumStatus(premiumData));
            }
        } catch (e) {
            console.error('Error syncing premium status:', e);
        }
    };

    const checkEntitlements = async (knownCustomerInfo = null) => {
        try {
            const customerInfo = knownCustomerInfo || await Purchases.getCustomerInfo();
            dispatch(setCustomerInfo(customerInfo));
            if (mountedRef.current) {
                setEntitlements(customerInfo?.entitlements?.active || {});
            }
            await syncServerPremium(customerInfo);
            return customerInfo;
        } catch (e) {
            console.error('Error checking entitlements:', e);
            return null;
        }
    };

    const handlePurchase = async (pkg) => {
        try {
            setPurchasing(true);
            setPurchasePending(false);

            const purchaseResult = await Purchases.purchasePackage(pkg);
            let customerInfo = purchaseResult?.customerInfo;
            let premiumEntitlement = getPremiumEntitlement(customerInfo);

            // A store transaction can settle before the entitlement snapshot refreshes.
            if (!premiumEntitlement) {
                customerInfo = await Purchases.getCustomerInfo();
                premiumEntitlement = getPremiumEntitlement(customerInfo);
            }

            dispatch(setCustomerInfo(customerInfo));

            // ── Optimistic update: show premium card instantly ──
            const active = customerInfo?.entitlements?.active || {};
            if (premiumEntitlement) {
                const optimisticPremium = {
                    isPremium: true,
                    premiumExpiresAt: premiumEntitlement.expirationDate || null,
                    premiumPlan: premiumEntitlement.productIdentifier || selectedPlan || null,
                    premiumWillRenew: premiumEntitlement.willRenew ?? null,
                    premiumCancelledAt: premiumEntitlement.unsubscribeDetectedAt || null,
                    premiumSource: 'self',
                };
                updateUserStorage(optimisticPremium);
                dispatch(setPremiumStatus(optimisticPremium));
                if (mountedRef.current) {
                    setEntitlements(active);
                    setPurchaseSucceeded(true);
                    setPurchasePending(false);
                    successScale.setValue(reduceMotion ? 1 : 0.7);
                    if (!reduceMotion) {
                        successAnimationRef.current = Animated.spring(successScale, {
                            toValue: 1,
                            friction: 5,
                            tension: 90,
                            useNativeDriver: true,
                        });
                        successAnimationRef.current.start();
                    }
                }
            } else if (mountedRef.current) {
                setPurchasePending(true);
                Alert.alert(
                    translateUiText('Purchase verification pending'),
                    translateUiText('Your store purchase completed, but premium is still being verified. Please restore purchases to check again.'),
                );
            }

            // Sync with backend in the background
            syncServerPremium(customerInfo).catch(err =>
                console.error('Background premium sync failed:', err),
            );
        } catch (e) {
            if (e?.userCancelled) {
                // User cancelled — do nothing
            } else {
                const errorCode = e?.code;
                const errorMessage = e?.message || e?.underlyingErrorMessage || String(e);
                console.error(`❌ Purchase error (Code: ${errorCode}):`, errorMessage);
                if (mountedRef.current) {
                    Alert.alert(
                        translateUiText('Purchase failed'),
                        translateUiText('Your purchase was not completed. Please try again.'),
                    );
                }
            }
        } finally {
            if (mountedRef.current) {
                setPurchasing(false);
            }
        }
    };

    const handleRestore = async () => {
        try {
            setRestoring(true);
            const customerInfo = await Purchases.restorePurchases();
            await checkEntitlements(customerInfo);
            const restoredEntitlement = getPremiumEntitlement(customerInfo);
            if (mountedRef.current) {
                const verificationStillPending = purchasePending && !restoredEntitlement;
                setPurchasePending(verificationStillPending);
                Alert.alert(
                    restoredEntitlement
                        ? translateUiText('Purchases restored')
                        : verificationStillPending
                            ? translateUiText('Purchase verification pending')
                            : translateUiText('No purchases found'),
                    restoredEntitlement
                        ? translateUiText('Your premium access has been restored.')
                        : verificationStillPending
                            ? translateUiText('Your store purchase completed, but premium is still being verified. Please restore purchases to check again.')
                            : translateUiText('We could not find a previous premium purchase for this store account.'),
                );
            }
        } catch (e) {
            console.error('Error restoring purchases:', e);
            if (mountedRef.current) {
                Alert.alert(
                    translateUiText('Restore failed'),
                    translateUiText('We could not restore purchases right now. Please try again.'),
                );
            }
        } finally {
            if (mountedRef.current) setRestoring(false);
        }
    };

    const updateAnnualTrialEligibility = async (annualPackage) => {
        const freeTrialPeriod = getFreeTrialPeriod(annualPackage, Platform.OS);
        let trialIsEligible = false;

        if (freeTrialPeriod && Platform.OS === 'android') {
            // Google only returns subscription options available to this customer.
            trialIsEligible = true;
        } else if (freeTrialPeriod && Platform.OS === 'ios') {
            try {
                const productId = annualPackage?.product?.identifier;
                if (productId) {
                    const eligibility = await Purchases.checkTrialOrIntroductoryPriceEligibility([productId]);
                    trialIsEligible = eligibility?.[productId]?.status
                        === Purchases.INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE;
                }
            } catch {
                // RevenueCat recommends hiding intro messaging when eligibility is unknown.
                trialIsEligible = false;
            }
        }

        if (mountedRef.current) {
            setAnnualTrialPeriod(trialIsEligible ? freeTrialPeriod : null);
        }
    };

    const getOfferingsAndEntitlements = async () => {
        let resolvedPackages = null;

        try {
            setPlansLoading(true);
            setLoadError(false);
            const allOfferings = await Purchases.getOfferings();
            if (!mountedRef.current) return;
            const onboardingOffering = ONBOARDING_OFFERING_IDS
                .map(id => allOfferings?.all?.[id])
                .find(Boolean) || null;
            resolvedPackages = resolveOfferingPackages(onboardingOffering);

            if (onboardingOffering && resolvedPackages.availablePackages.length > 0) {
                setOffering(onboardingOffering);
                if (resolvedPackages.annual) {
                    setSelectedPlan('annual');
                } else if (resolvedPackages.monthly) {
                    setSelectedPlan('monthly');
                } else {
                    setSelectedPlan('fallback');
                }
            } else {
                setOffering(null);
                setAnnualTrialPeriod(null);
            }
        } catch (e) {
            console.error(`Error fetching RevenueCat offerings "${ONBOARDING_OFFERING_IDS.join(', ')}":`, e);
            if (mountedRef.current) {
                setOffering(null);
                setAnnualTrialPeriod(null);
                setLoadError(true);
            }
        } finally {
            if (mountedRef.current) setPlansLoading(false);
        }

        if (mountedRef.current) {
            // Plans are now visible and interactive. Entitlement, backend, and
            // trial checks continue independently without blocking checkout.
            Promise.allSettled([
                checkEntitlements(),
                updateAnnualTrialEligibility(resolvedPackages?.annual || null),
            ]);
        }
    };

    const {
        annual: annualPackage,
        monthly: monthlyPackage,
        fallback: fallbackPackage,
    } = resolveOfferingPackages(offering);
    const selectedPackage = selectedPlan === 'monthly'
        ? monthlyPackage
        : selectedPlan === 'annual'
            ? annualPackage
            : fallbackPackage;
    const annualHasFreeTrial = !!annualTrialPeriod;
    const isPremium = !!(user?.isPremium || getPremiumEntitlement({ entitlements: { active: entitlements || {} } }));
    const premiumFromPartner = user?.premiumSource === 'partner';
    const premiumPlan = premiumFromPartner
        ? (user?.partnerPremiumPlan || user?.premiumPlan)
        : user?.premiumPlan;
    const premiumExpiresAt = premiumFromPartner
        ? (user?.partnerPremiumExpiresAt || user?.premiumExpiresAt)
        : user?.premiumExpiresAt;
    const premiumWillRenew = premiumFromPartner
        ? (user?.partnerPremiumWillRenew ?? user?.premiumWillRenew)
        : user?.premiumWillRenew;
    const premiumIsCancelled = isPremium && premiumWillRenew === false && !!premiumExpiresAt;

    const planLabelFromId = (id) => {
        try {
            if (!id) return translateUiText("Active subscription");
            const lower = String(id).toLowerCase();
            if (lower.includes('week')) return translateUiText("Weekly Plan");
            if (lower.includes('month')) return translateUiText("Monthly Plan");
            if (lower.includes('year') || lower.includes('annual')) return translateUiText("Annual Plan");
            if (lower.includes('life')) return translateUiText("Lifetime");
            return translateUiText("Active subscription");
        } catch {
            return translateUiText("Active subscription");
        }
    };

    const formatDate = (iso) => {
        try {
            if (!iso) return translateUiText("Active");
            const d = new Date(iso);
            return d.toLocaleDateString(getUiLocale(), { year: 'numeric', month: 'short', day: 'numeric' });
        } catch {
            return translateUiText("Active");
        }
    };

    const formatCurrencyPrice = (price, currencyCode) => {
        try {
            if (!price || !currencyCode) return '';
            return new Intl.NumberFormat(getUiLocale(), {
                style: 'currency',
                currency: currencyCode,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }).format(price);
        } catch {
            return `${currencyCode} ${price.toFixed(2)}`;
        }
    };

    const formattedMonthlyPrice = monthlyPackage?.product?.priceString || '';

    const annualPrice = annualPackage?.product?.price || 0;
    const annualCurrency = annualPackage?.product?.currencyCode || null;
    const annualMonthlyEquivalent = annualPrice / 12;
    const formattedAnnualMonthlyEquivalent = annualPackage?.product?.pricePerMonthString
        || formatCurrencyPrice(annualMonthlyEquivalent, annualCurrency);
    const formattedAnnualPrice = annualPackage?.product?.priceString || '';

    const savingsPercent = calculateSavingsPercent(
        monthlyPackage?.product?.price,
        annualPackage?.product?.price,
    );

    const formatTrialPeriod = (period) => {
        const normalized = normalizeTrialPeriod(period);
        if (!normalized) return '';
        const key = normalized.value === 1
            ? `{{0}} ${normalized.unit}`
            : `{{0}} ${normalized.unit}s`;
        return translateUiTemplate(key, [normalized.value]);
    };

    const openLegalLink = async (url) => {
        try {
            await Linking.openURL(url);
        } catch {
            Alert.alert(
                translateUiText('Could not open link'),
                translateUiText('Please check your internet connection and try again.'),
            );
        }
    };

    return (
        <View style={styles.root}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <LinearGradient
                colors={['#F8D9EC', '#FFF7FA', '#FFF4F7', '#F7D8F2']}
                locations={[0, 0.34, 0.72, 1]}
                start={{ x: 0.25, y: 0 }}
                end={{ x: 0.75, y: 1 }}
                style={StyleSheet.absoluteFill}
            />

            <Animated.View
                style={[
                    styles.screenContent,
                    {
                        opacity: screenEntrance,
                        transform: [{
                            translateY: screenEntrance.interpolate({
                                inputRange: [0, 1],
                                outputRange: [12, 0],
                            }),
                        }],
                    },
                ]}
            >
            {/* Back button (Left) */}
            <TouchableOpacity
                onPress={onBack}
                disabled={purchasing || restoring}
                accessibilityRole="button"
                accessibilityLabel={translateUiText("Close premium offer")}
                accessibilityState={{ disabled: purchasing || restoring }}
                style={[
                    styles.backButton,
                    insetStyles.topAction,
                    (purchasing || restoring) && styles.actionDisabled,
                ]}
                activeOpacity={0.8}
            >
                <CloseIcon />
            </TouchableOpacity>

            {/* Restore button (Right) */}
            <TouchableOpacity
                onPress={handleRestore}
                disabled={plansLoading || restoring || purchasing}
                accessibilityRole="button"
                accessibilityLabel={translateUiText("Restore purchases")}
                accessibilityState={{ disabled: plansLoading || restoring || purchasing, busy: restoring }}
                style={[
                    styles.restoreButton,
                    insetStyles.topAction,
                    (plansLoading || restoring || purchasing) && styles.actionDisabled,
                ]}
                activeOpacity={0.8}
            >
                <Text style={styles.restoreButtonText}>
                    {restoring ? translateUiText("Restoring...") : translateUiText("Restore")}
                </Text>
            </TouchableOpacity>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[
                    styles.scrollContent,
                    insetStyles.scrollContent,
                ]}
                showsVerticalScrollIndicator={false}
            >
                {/* Mascot Image & Floating Hearts */}
                <View style={styles.mascotContainer}>
                    <FloatingHeart reduceMotion={reduceMotion} delay={0} startX={-45} size={14} color={colors.primary} zIndex={1} />
                    <FloatingHeart reduceMotion={reduceMotion} delay={1000} startX={50} size={18} color={colors.primaryLight} zIndex={3} />
                    <FloatingHeart reduceMotion={reduceMotion} delay={2000} startX={-15} size={16} color={colors.heart} zIndex={1} />
                    <FloatingHeart reduceMotion={reduceMotion} delay={3000} startX={35} size={14} color={colors.primary} zIndex={3} />
                    <FloatingHeart reduceMotion={reduceMotion} delay={1500} startX={-65} size={20} color={colors.primaryLight} zIndex={1} />
                    <FloatingHeart reduceMotion={reduceMotion} delay={2500} startX={70} size={15} color={colors.heart} zIndex={3} />

                    <Image
                        source={require('../../assets/images/premium-muscot.png')}
                        style={styles.mascotImage}
                        resizeMode="contain"
                        accessible={false}
                    />
                </View>

                <View style={styles.premiumContentSection}>
                    <LinearGradient
                        pointerEvents="none"
                        colors={['rgba(255, 247, 250, 0)', '#FFF7FA']}
                        style={styles.premiumContentFade}
                    />
                    {/* Heading */}
                    <View style={styles.headerTextContainer}>
                        <Text style={styles.headingTitle}>
                            {isPremium ? (
                                <>{translateUiText("You're")}{' '}<Text style={styles.premiumText}>{translateUiText("Premium!")}</Text></>
                            ) : (
                                <>{translateUiText("Go")}{' '}<Text style={styles.premiumText}>{translateUiText("Premium")}</Text></>
                            )}
                        </Text>
                        <Text style={styles.headingSubtitle}>
                            {isPremium
                                ? translateUiText("Your partner is included")
                                : translateUiText("Your partner doesn't pay anything")}
                        </Text>
                    </View>

                    {/* Premium Active Status */}
                    {purchaseSucceeded ? (
                        <View style={styles.purchaseSuccessContainer}>
                            <Animated.View
                                style={[
                                    styles.purchaseSuccessIcon,
                                    { transform: [{ scale: successScale }] },
                                ]}
                            >
                                <Svg width={34} height={34} viewBox="0 0 24 24" fill="none">
                                    <Path
                                        d="m5 12 4.2 4.2L19 6.5"
                                        stroke="#FFFFFF"
                                        strokeWidth={2.8}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </Svg>
                            </Animated.View>
                            <Text style={styles.purchaseSuccessText}>{translateUiText("Premium is now active for both of you")}</Text>
                        </View>
                    ) : isPremium && (
                        <View style={styles.premiumStatusContainer}>
                            <View style={styles.premiumStatusCard}>
                                <View style={styles.premiumStatusHeader}>
                                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="#FFB500">
                                        <Path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm0 3h14v2H5v-2z" />
                                    </Svg>
                                    <Text style={styles.premiumStatusTitle}>{translateUiText("You're Premium")}</Text>
                                </View>
                                <View style={styles.premiumStatusDetails}>
                                    <View style={styles.premiumStatusColumn}>
                                        <Text style={styles.premiumStatusLabel}>{translateUiText("Plan")}</Text>
                                        <Text style={styles.premiumStatusValue}>
                                            {planLabelFromId(premiumPlan)}
                                        </Text>
                                    </View>
                                    <View style={styles.premiumStatusRight}>
                                        <Text style={styles.premiumStatusLabel}>
                                            {premiumIsCancelled ? translateUiText("Access until") : translateUiText("Renews/Expires")}
                                        </Text>
                                        <Text style={styles.premiumStatusValue}>
                                            {formatDate(premiumExpiresAt)}
                                        </Text>
                                    </View>
                                </View>
                                {premiumIsCancelled && (
                                    <View style={styles.premiumCancellationNotice}>
                                        <Text style={styles.premiumCancellationText}>{translateUiTemplate("Premium cancelled — access continues until {{0}}", [formatDate(premiumExpiresAt)])}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    )}

                    {/* Premium Benefits List */}
                    {!purchaseSucceeded && !isPremium && (
                        <View style={styles.benefitsContainer}>
                            {features.map((f) => {
                                return (
                                    <View key={f.label} style={styles.benefitsItem}>
                                        <PinkCheck />
                                        <Text style={styles.benefitsText}>{f.label}</Text>
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </View>
            </ScrollView>

            <View
                style={[
                    styles.bottomContent,
                    insetStyles.bottomContent,
                ]}
            >
                <LinearGradient
                    pointerEvents="none"
                    colors={[
                        'rgba(255, 247, 250, 0)',
                        'rgba(255, 247, 250, 0.35)',
                        '#FFF7FA',
                    ]}
                    locations={[0, 0.82, 1]}
                    style={styles.bottomContentFade}
                />

                {/* Plan Selection Cards */}
                {!isPremium && !purchasePending && (monthlyPackage || annualPackage || fallbackPackage) && (
                    <View style={styles.planCardsContainer}>
                        {/* Yearly Plan Option */}
                        {annualPackage && (
                            <Pressable
                                onPress={() => setSelectedPlan('annual')}
                                accessibilityRole="radio"
                                accessibilityLabel={translateUiText("Yearly plan")}
                                accessibilityState={{ checked: selectedPlan === 'annual' }}
                                style={[
                                    styles.planCard,
                                    selectedPlan === 'annual' && styles.planCardSelected,
                                ]}
                            >
                                <View style={styles.planDetailsCol}>
                                    <Text style={styles.planTitleText}>{translateUiText("Yearly")}</Text>
                                    <Text style={styles.planPriceText}>
                                        {translateUiTemplate("{{0}} / month", [formattedAnnualMonthlyEquivalent])}<Text style={styles.planSubText}> {translateUiText("per couple")}</Text>
                                    </Text>
                                    <Text style={styles.planTrialText}>
                                        {annualHasFreeTrial
                                            ? translateUiTemplate(
                                                "{{0}} free trial, then {{1}} / year",
                                                [formatTrialPeriod(annualTrialPeriod), formattedAnnualPrice],
                                            )
                                            : translateUiTemplate("{{0}} / year", [formattedAnnualPrice])}
                                    </Text>
                                </View>
                                <View style={styles.planRadioCol}>
                                    {selectedPlan === 'annual' ? <RadioCircleChecked /> : <RadioCircleOutline />}
                                </View>

                                {savingsPercent !== null && (
                                    <View style={styles.saveBadge}>
                                        <Text style={styles.saveBadgeText}>{translateUiTemplate("SAVE {{0}}%", [savingsPercent])}</Text>
                                    </View>
                                )}
                            </Pressable>
                        )}

                        {/* Monthly Plan Option */}
                        {monthlyPackage && (
                            <Pressable
                                onPress={() => setSelectedPlan('monthly')}
                                accessibilityRole="radio"
                                accessibilityLabel={translateUiText("Monthly plan")}
                                accessibilityState={{ checked: selectedPlan === 'monthly' }}
                                style={[
                                    styles.planCard,
                                    selectedPlan === 'monthly' && styles.planCardSelected,
                                ]}
                            >
                                <View style={styles.planDetailsCol}>
                                    <Text style={styles.planTitleText}>{translateUiText("Monthly")}</Text>
                                    <Text style={styles.planPriceText}>
                                        {translateUiTemplate("{{0}} / month", [formattedMonthlyPrice])}<Text style={styles.planSubText}> {translateUiText("per couple")}</Text>
                                    </Text>
                                </View>
                                <View style={styles.planRadioCol}>
                                    {selectedPlan === 'monthly' ? <RadioCircleChecked /> : <RadioCircleOutline />}
                                </View>
                            </Pressable>
                        )}

                        {fallbackPackage && (
                            <Pressable
                                onPress={() => setSelectedPlan('fallback')}
                                accessibilityRole="radio"
                                accessibilityLabel={fallbackPackage.product?.title || translateUiText("Premium plan")}
                                accessibilityState={{ checked: selectedPlan === 'fallback' }}
                                style={[
                                    styles.planCard,
                                    selectedPlan === 'fallback' && styles.planCardSelected,
                                ]}
                            >
                                <View style={styles.planDetailsCol}>
                                    <Text style={styles.planTitleText}>
                                        {fallbackPackage.product?.title || translateUiText("Premium plan")}
                                    </Text>
                                    <Text style={styles.planPriceText}>
                                        {fallbackPackage.product?.priceString || ''}
                                    </Text>
                                </View>
                                <View style={styles.planRadioCol}>
                                    {selectedPlan === 'fallback' ? <RadioCircleChecked /> : <RadioCircleOutline />}
                                </View>
                            </Pressable>
                        )}
                    </View>
                )}

                {/* CTA Action Button */}
                {!isPremium && !purchasePending && selectedPackage && (
                    <View>
                        <TouchableOpacity
                            activeOpacity={0.88}
                            onPress={() => handlePurchase(selectedPackage)}
                            style={[
                                styles.subscribeButtonWrapper,
                                (plansLoading || purchasing) && styles.subscribeButtonDisabled,
                            ]}
                            disabled={plansLoading || purchasing}
                            accessibilityRole="button"
                            accessibilityLabel={translateUiText("Start premium purchase")}
                            accessibilityState={{ disabled: plansLoading || purchasing, busy: purchasing }}
                        >
                            <LinearGradient
                                colors={['#FF5E97', '#FFA1C9']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.subscribeButton}
                            >
                                <Text style={styles.subscribeButtonText}>
                                    {purchasing
                                        ? translateUiText("Processing...")
                                        : selectedPlan === 'annual' && annualHasFreeTrial
                                            ? translateUiText("Try free for 7 Days")
                                            : translateUiText("Start now")}
                                </Text>
                            </LinearGradient>
                        </TouchableOpacity>
                        <Text style={styles.paymentNoteText}>
                            {selectedPlan === 'annual' && annualHasFreeTrial
                                ? translateUiText("No payment due now")
                                : translateUiText("Cancel anytime, no commitment")}
                        </Text>
                    </View>
                )}

                {!isPremium && !purchasePending && !selectedPackage && !plansLoading && (
                    <View>
                        <TouchableOpacity
                            activeOpacity={0.88}
                            onPress={getOfferingsAndEntitlements}
                            style={styles.subscribeButtonWrapper}
                            accessibilityRole="button"
                        >
                            <LinearGradient
                                colors={['#FF5E97', '#FFA1C9']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.subscribeButton}
                            >
                                <Text style={styles.subscribeButtonText}>
                                    {translateUiText(loadError ? 'Retry loading plans' : 'Load plans')}
                                </Text>
                            </LinearGradient>
                        </TouchableOpacity>
                        {loadError && (
                            <Text style={styles.paymentNoteText}>
                                {translateUiText('Plans are temporarily unavailable.')}
                            </Text>
                        )}
                    </View>
                )}

                {!isPremium && plansLoading && !selectedPackage && (
                    <View
                        style={styles.loadingPlansContainer}
                        accessibilityRole="progressbar"
                        accessibilityLiveRegion="polite"
                    >
                        <ActivityIndicator color={colors.primary} />
                        <Text style={styles.loadingPlansText}>{translateUiText("Loading plans…")}</Text>
                    </View>
                )}

                {!isPremium && purchasePending && (
                    <View>
                        <TouchableOpacity
                            activeOpacity={0.88}
                            onPress={handleRestore}
                            disabled={restoring}
                            accessibilityRole="button"
                            accessibilityState={{ disabled: restoring, busy: restoring }}
                            style={[
                                styles.subscribeButtonWrapper,
                                restoring && styles.subscribeButtonDisabled,
                            ]}
                        >
                            <LinearGradient
                                colors={['#FF5E97', '#FFA1C9']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.subscribeButton}
                            >
                                <Text style={styles.subscribeButtonText}>
                                    {restoring
                                        ? translateUiText("Verifying purchase…")
                                        : translateUiText("Verify purchase")}
                                </Text>
                            </LinearGradient>
                        </TouchableOpacity>
                        <Text style={styles.paymentNoteText}>
                            {translateUiText("Your purchase is awaiting verification.")}
                        </Text>
                    </View>
                )}

                {isPremium && (
                    <TouchableOpacity
                        activeOpacity={0.88}
                        onPress={onBack}
                        style={styles.subscribeButtonWrapper}
                        accessibilityRole="button"
                        accessibilityLabel={translateUiText("Continue")}
                    >
                        <LinearGradient
                            colors={['#FF5E97', '#FFA1C9']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.subscribeButton}
                        >
                            <Text style={styles.subscribeButtonText}>{translateUiText("Continue")}</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                )}

                {/* Terms & Privacy links */}
                <View style={styles.termsContainer}>
                    <TouchableOpacity
                        onPress={() => openLegalLink('https://ayushk9799.github.io/penguin-legal/terms-of-service.html')}
                        accessibilityRole="link"
                        hitSlop={8}
                    >
                        <Text style={[styles.termsText, styles.termsLink]}>{translateUiText("Terms of Use")}</Text>
                    </TouchableOpacity>
                    <Text style={styles.termsSeparator}>•</Text>
                    <TouchableOpacity
                        onPress={() => openLegalLink('https://ayushk9799.github.io/penguin-legal/privacy-policy.html')}
                        accessibilityRole="link"
                        hitSlop={8}
                    >
                        <Text style={[styles.termsText, styles.termsLink]}>{translateUiText("Privacy Policy")}</Text>
                    </TouchableOpacity>
                </View>
            </View>
            </Animated.View>

            {/* Purchasing overlay loader */}
            {purchasing && (
                <View
                    style={styles.processingOverlay}
                    accessibilityViewIsModal
                    accessibilityLiveRegion="assertive"
                >
                    <View style={styles.processingCard}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.processingText}>{translateUiText("Processing purchase…")}</Text>
                        <Text style={styles.processingSubtext}>{translateUiText("Please wait while we activate your premium.")}</Text>
                    </View>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    screenContent: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 12,
    },
    bottomContent: {
        position: 'relative',
        zIndex: 5,
        paddingTop: 12,
        paddingHorizontal: 20,
        backgroundColor: '#FFF7FA',
    },
    bottomContentFade: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: -64,
        height: 64,
    },
    backButton: {
        position: 'absolute',
        left: 16,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderWidth: 1,
        borderColor: '#F7DDEA',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#FFB5D0',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 0,
        zIndex: 10,
    },
    restoreButton: {
        position: 'absolute',
        right: 16,
        minHeight: 44,
        paddingHorizontal: 8,
        justifyContent: 'center',
        zIndex: 10,
    },
    actionDisabled: {
        opacity: 0.5,
    },
    restoreButtonText: {
        color: colors.primary,
        fontSize: 13,
        fontWeight: '700',
    },
    mascotContainer: {
        alignSelf: 'center',
        position: 'relative',
        width: '100%',
        maxWidth: 350,
        height: 280,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: -12,
        zIndex: 2,
    },
    mascotImage: {
        width: '96%',
        maxWidth: 335,
        height: 276,
        zIndex: 2,
    },
    floatingHeart: {
        position: 'absolute',
        bottom: 30,
        alignSelf: 'center',
    },
    premiumContentSection: {
        position: 'relative',
        zIndex: 3,
        marginTop: -56,
        marginHorizontal: -20,
        paddingTop: 0,
        paddingHorizontal: 28,
        backgroundColor: '#FFF7FA',
    },
    premiumContentFade: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: -56,
        height: 56,
    },
    headerTextContainer: {
        alignItems: 'center',
        marginTop: 0,
        marginBottom: 16,
    },
    headingTitle: {
        fontSize: 28,
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        color: colors.text,
        textAlign: 'center',
    },
    premiumText: {
        color: colors.primary,
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
    },
    headingSubtitle: {
        color: colors.primary,
        fontSize: 14,
        fontWeight: '700',
        marginTop: -4,
        textAlign: 'center',
    },
    purchaseSuccessContainer: {
        alignItems: 'center',
        marginBottom: 22,
        paddingHorizontal: 20,
    },
    purchaseSuccessIcon: {
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
        shadowColor: '#FF5E97',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 14,
        elevation: 0,
    },
    purchaseSuccessText: {
        color: colors.textSecondary,
        fontSize: 15,
        fontWeight: '700',
        textAlign: 'center',
        marginTop: 12,
    },
    benefitsContainer: {
        marginBottom: 18,
        paddingHorizontal: 8,
        alignSelf: 'stretch',
    },
    benefitsItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 10,
    },
    benefitsText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
        flexShrink: 1,
    },
    planCardsContainer: {
        marginBottom: 8,
        alignSelf: 'stretch',
        gap: 10,
    },
    planCard: {
        backgroundColor: colors.card,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: colors.border,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#FFB5D0',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 0,
    },
    planCardSelected: {
        borderColor: colors.primary,
        backgroundColor: colors.card,
    },
    planCardDisabled: {
        opacity: 0.5,
    },
    planDetailsCol: {
        flex: 1,
    },
    planTitleText: {
        fontSize: 17,
        fontWeight: '800',
        color: colors.primary,
        marginBottom: 2,
    },
    planPriceText: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text,
        letterSpacing: 0.4,
    },
    planSubText: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.textSecondary,
    },
    planTrialText: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.textSecondary,
        marginTop: 2,
    },
    planRadioCol: {
        marginLeft: 12,
        justifyContent: 'center',
    },
    saveBadge: {
        position: 'absolute',
        top: -9,
        right: 16,
        backgroundColor: colors.primary,
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
        zIndex: 10,
    },
    saveBadgeText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 0.2,
    },
    noPackagesContainer: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    noPackagesText: {
        color: colors.textSecondary,
    },
    paymentNoteText: {
        color: colors.textSecondary,
        fontSize: 13,
        fontWeight: '600',
        textAlign: 'center',
        marginTop: -4,
        marginBottom: 8,
    },
    subscribeButtonWrapper: {
        marginBottom: 12,
        shadowColor: '#FF5E97',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 0,
    },
    subscribeButtonDisabled: {
        opacity: 0.6,
    },
    subscribeButton: {
        height: 50,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    subscribeButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '800',
    },
    termsContainer: {
        marginTop: 4,
        marginBottom: 10,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 10,
    },
    termsText: {
        color: colors.textSecondary,
        fontSize: 12,
        fontWeight: '500',
    },
    termsLink: {
        color: colors.textSecondary,
        textDecorationLine: 'underline',
    },
    termsSeparator: {
        color: colors.textSecondary,
        fontSize: 12,
    },
    loadingPlansContainer: {
        minHeight: 62,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 10,
    },
    loadingPlansText: {
        color: colors.textSecondary,
        fontSize: 13,
        fontWeight: '600',
    },
    // Premium Active Status
    premiumStatusContainer: {
        marginBottom: 16,
        alignSelf: 'stretch',
    },
    premiumStatusCard: {
        backgroundColor: colors.card,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: '#FFB500',
        padding: 16,
        shadowColor: '#FFB5D0',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 0,
    },
    premiumStatusHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
    },
    premiumStatusTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: colors.text,
    },
    premiumStatusDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    premiumStatusRight: {
        alignItems: 'flex-end',
        flexShrink: 1,
        flex: 1,
    },
    premiumStatusColumn: {
        flex: 1,
    },
    premiumStatusLabel: {
        color: colors.textSecondary,
        fontSize: 11,
        fontWeight: '700',
    },
    premiumStatusValue: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '800',
        marginTop: 2,
    },
    premiumCancellationNotice: {
        marginTop: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: '#FFF2E2',
    },
    premiumCancellationText: {
        color: '#9A5B13',
        fontSize: 12.5,
        lineHeight: 17,
        fontWeight: '700',
        textAlign: 'center',
    },
    // Loading overlay
    processingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255, 255, 255, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 100,
    },
    processingCard: {
        backgroundColor: colors.card,
        borderRadius: 24,
        paddingVertical: 28,
        paddingHorizontal: 36,
        alignItems: 'center',
        shadowColor: '#FFB5D0',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 18,
        elevation: 0,
    },
    processingText: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '900',
        marginTop: 16,
    },
    processingSubtext: {
        color: colors.textSecondary,
        fontSize: 13,
        marginTop: 6,
        textAlign: 'center',
    },
});
