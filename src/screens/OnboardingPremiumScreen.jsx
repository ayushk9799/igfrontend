// Onboarding Premium Screen - onboarding copy of the premium subscription UI
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Pressable,
    Image,
    Animated,
    StyleSheet,
    Linking,
    ActivityIndicator,
    StatusBar,
    ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import Purchases from 'react-native-purchases';
import { colors } from '../theme';
import { fontFamily, fontWeight } from '../constants/fonts';
import { setCustomerInfo, setPremiumStatus } from '../store/slices/userSlice';
import { getPremiumEntitlement, mapSubscriptionAccessToUser, refreshSubscription } from '../api/subscriptionApi';
import { updateUser as updateUserStorage } from '../utils/authStorage';

const ONBOARDING_OFFERING_ID = 'onbording';

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
const FloatingHeart = ({ delay = 0, startX = 0, size = 16, color = colors.primary, zIndex = 1 }) => {
    const animation = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const startAnimation = () => {
            animation.setValue(0);
            Animated.timing(animation, {
                toValue: 1,
                duration: 4000,
                delay: delay,
                useNativeDriver: true,
            }).start(() => {
                startAnimation();
            });
        };

        startAnimation();
    }, [animation, delay]);

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
    const [selectedPlan, setSelectedPlan] = useState('annual'); // Default to Yearly/Annual plan
    const [offering, setOffering] = useState(null);
    const [entitlements, setEntitlements] = useState(null);
    const [loading, setLoading] = useState(false);
    const [purchasing, setPurchasing] = useState(false);
    const [purchaseSucceeded, setPurchaseSucceeded] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const insets = useSafeAreaInsets();
    const screenEntrance = useRef(new Animated.Value(0)).current;
    const successScale = useRef(new Animated.Value(0.7)).current;

    const features = useMemo(
        () => [
            { label: 'One premium covers both of you' },
            { label: '2000+ couple questions' },
            { label: 'Unlimited Games' },
            { label: 'Unlimited Memories' },
            { label: 'Live drawing' },
            { label: 'Widgets' },
        ],
        [],
    );

    useEffect(() => {
        Animated.timing(screenEntrance, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
        }).start();
    }, [screenEntrance]);

    useEffect(() => {
        const init = async () => {
            await getOfferingsAndEntitlements();
        };
        init();
        // This screen intentionally mirrors PremiumScreen's one-time initialization.
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

    const checkEntitlements = async () => {
        try {
            const customerInfo = await Purchases.getCustomerInfo();
            dispatch(setCustomerInfo(customerInfo));
            setEntitlements(customerInfo.entitlements.active);
            await syncServerPremium(customerInfo);
        } catch (e) {
            console.error('Error checking entitlements:', e);
        }
    };

    const handlePurchase = async (pkg) => {
        try {
            setLoading(true);
            setPurchasing(true);

            const { customerInfo } = await Purchases.purchasePackage(pkg);
            dispatch(setCustomerInfo(customerInfo));

            // ── Optimistic update: show premium card instantly ──
            const active = customerInfo?.entitlements?.active || {};
            const premiumEntitlement = getPremiumEntitlement(customerInfo);
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
                setEntitlements(active);
                setPurchaseSucceeded(true);
                successScale.setValue(0.7);
                Animated.spring(successScale, {
                    toValue: 1,
                    friction: 5,
                    tension: 90,
                    useNativeDriver: true,
                }).start();
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
            }
        } finally {
            setLoading(false);
            setPurchasing(false);
        }
    };

    const handleRestore = async () => {
        try {
            setRestoring(true);
            const customerInfo = await Purchases.restorePurchases();
            dispatch(setCustomerInfo(customerInfo));
            await checkEntitlements();
        } catch (e) {
            console.error('Error restoring purchases:', e);
        } finally {
            setRestoring(false);
        }
    };

    const getOfferingsAndEntitlements = async () => {
        try {
            setLoading(true);
            const allOfferings = await Purchases.getOfferings();
            const onboardingOffering = allOfferings?.all?.[ONBOARDING_OFFERING_ID] || null;

            if (onboardingOffering && Array.isArray(onboardingOffering.availablePackages) && onboardingOffering.availablePackages.length > 0) {
                setOffering(onboardingOffering);
                if (onboardingOffering.annual) {
                    setSelectedPlan('annual');
                } else if (onboardingOffering.monthly) {
                    setSelectedPlan('monthly');
                } else {
                    setSelectedPlan('annual');
                }
            } else {
                setOffering(null);
            }
            await checkEntitlements();
        } catch (e) {
            console.error(`Error fetching RevenueCat offering "${ONBOARDING_OFFERING_ID}":`, e);
            setOffering(null);
        } finally {
            setLoading(false);
        }
    };

    const annualPackage = offering?.annual || null;
    const monthlyPackage = offering?.monthly || null;
    const selectedPackage = selectedPlan === 'monthly' ? monthlyPackage : selectedPlan === 'annual' ? annualPackage : null;
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
            if (!id) return 'Active subscription';
            const lower = String(id).toLowerCase();
            if (lower.includes('week')) return 'Weekly Plan';
            if (lower.includes('month')) return 'Monthly Plan';
            if (lower.includes('year') || lower.includes('annual')) return 'Annual Plan';
            if (lower.includes('life')) return 'Lifetime';
            return 'Active subscription';
        } catch {
            return 'Active subscription';
        }
    };

    const formatDate = (iso) => {
        try {
            if (!iso) return 'Active';
            const d = new Date(iso);
            return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
        } catch {
            return 'Active';
        }
    };

    const roundPriceForDisplay = (price) => {
        if (price < 100) {
            return Math.floor(price) + 0.99;
        } else {
            return Math.ceil(price);
        }
    };

    const formatCurrencyPrice = (price, currencyCode, shouldRound = false) => {
        try {
            if (!price || !currencyCode) return '';
            const finalPrice = shouldRound ? roundPriceForDisplay(price) : price;
            return new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency: currencyCode,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }).format(finalPrice);
        } catch {
            const finalPrice = shouldRound ? roundPriceForDisplay(price) : price;
            return `${currencyCode} ${finalPrice.toFixed(2)}`;
        }
    };

    const formattedMonthlyPrice = monthlyPackage?.product?.priceString || '';

    const annualPrice = annualPackage?.product?.price || 0;
    const annualCurrency = annualPackage?.product?.currencyCode || null;
    const annualMonthlyEquivalent = annualPrice / 12;
    const formattedAnnualMonthlyEquivalent = formatCurrencyPrice(annualMonthlyEquivalent, annualCurrency);
    const formattedAnnualPrice = annualPackage?.product?.priceString || '';

    const savingsPercent = monthlyPackage && annualPackage
        ? Math.round(((monthlyPackage.product.price * 12) - annualPackage.product.price) / (monthlyPackage.product.price * 12) * 100)
        : null;

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
                style={[styles.backButton, { top: insets.top > 0 ? insets.top + 6 : 16 }]}
                activeOpacity={0.8}
            >
                <CloseIcon />
            </TouchableOpacity>

            {/* Restore button (Right) */}
            <TouchableOpacity
                onPress={handleRestore}
                disabled={loading || restoring}
                style={[styles.restoreButton, { top: insets.top > 0 ? insets.top + 6 : 16 }]}
                activeOpacity={0.8}
            >
                <Text style={styles.restoreButtonText}>
                    {restoring ? 'Restoring...' : 'Restore'}
                </Text>
            </TouchableOpacity>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[
                    styles.scrollContent,
                    {
                        paddingTop: insets.top > 0 ? insets.top + 8 : 16,
                    },
                ]}
                showsVerticalScrollIndicator={false}
            >
                {/* Mascot Image & Floating Hearts */}
                <View style={styles.mascotContainer}>
                    <FloatingHeart delay={0} startX={-45} size={14} color={colors.primary} zIndex={1} />
                    <FloatingHeart delay={1000} startX={50} size={18} color={colors.primaryLight} zIndex={3} />
                    <FloatingHeart delay={2000} startX={-15} size={16} color={colors.heart} zIndex={1} />
                    <FloatingHeart delay={3000} startX={35} size={14} color={colors.primary} zIndex={3} />
                    <FloatingHeart delay={1500} startX={-65} size={20} color={colors.primaryLight} zIndex={1} />
                    <FloatingHeart delay={2500} startX={70} size={15} color={colors.heart} zIndex={3} />

                    <Image
                        source={require('../../assets/images/premium-muscot.png')}
                        style={styles.mascotImage}
                        resizeMode="contain"
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
                            {purchaseSucceeded ? (
                                <>You're <Text style={styles.premiumText}>Premium!</Text></>
                            ) : (
                                <>Go <Text style={styles.premiumText}>Premium</Text></>
                            )}
                        </Text>
                        <Text style={styles.headingSubtitle}>
                            {purchaseSucceeded
                                ? 'Your partner is included'
                                : 'Your partner doesn\'t pay anything'}
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
                            <Text style={styles.purchaseSuccessText}>
                                Premium is now active for both of you
                            </Text>
                        </View>
                    ) : isPremium && (
                        <View style={styles.premiumStatusContainer}>
                            <View style={styles.premiumStatusCard}>
                                <View style={styles.premiumStatusHeader}>
                                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="#FFB500">
                                        <Path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm0 3h14v2H5v-2z" />
                                    </Svg>
                                    <Text style={styles.premiumStatusTitle}>You're Premium</Text>
                                </View>
                                <View style={styles.premiumStatusDetails}>
                                    <View>
                                        <Text style={styles.premiumStatusLabel}>Plan</Text>
                                        <Text style={styles.premiumStatusValue}>
                                            {planLabelFromId(premiumPlan)}
                                        </Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={styles.premiumStatusLabel}>
                                            {premiumIsCancelled ? 'Access until' : 'Renews/Expires'}
                                        </Text>
                                        <Text style={styles.premiumStatusValue}>
                                            {formatDate(premiumExpiresAt)}
                                        </Text>
                                    </View>
                                </View>
                                {premiumIsCancelled && (
                                    <View style={styles.premiumCancellationNotice}>
                                        <Text style={styles.premiumCancellationText}>
                                            Premium cancelled — access continues until {formatDate(premiumExpiresAt)}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    )}

                    {/* Premium Benefits List */}
                    {!purchaseSucceeded && (
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
                    { paddingBottom: insets.bottom > 0 ? insets.bottom + 8 : 16 },
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
                {!isPremium && (monthlyPackage || annualPackage) && (
                    <View style={styles.planCardsContainer}>
                        {/* Yearly Plan Option */}
                        {annualPackage && (
                            <Pressable
                                onPress={() => setSelectedPlan('annual')}
                                style={[
                                    styles.planCard,
                                    selectedPlan === 'annual' && styles.planCardSelected,
                                ]}
                            >
                                <View style={styles.planDetailsCol}>
                                    <Text style={styles.planTitleText}>Yearly</Text>
                                    <Text style={styles.planPriceText}>
                                        {formattedAnnualMonthlyEquivalent} / month <Text style={styles.planSubText}>per couple</Text>
                                    </Text>
                                    <Text style={styles.planTrialText}>
                                        7 days free, then {formattedAnnualPrice} / year
                                    </Text>
                                </View>
                                <View style={styles.planRadioCol}>
                                    {selectedPlan === 'annual' && <RadioCircleChecked />}
                                </View>

                                {savingsPercent !== null && (
                                    <View style={styles.saveBadge}>
                                        <Text style={styles.saveBadgeText}>SAVE {savingsPercent}%</Text>
                                    </View>
                                )}
                            </Pressable>
                        )}

                        {/* Monthly Plan Option */}
                        {monthlyPackage && (
                            <Pressable
                                onPress={() => setSelectedPlan('monthly')}
                                style={[
                                    styles.planCard,
                                    selectedPlan === 'monthly' && styles.planCardSelected,
                                ]}
                            >
                                <View style={styles.planDetailsCol}>
                                    <Text style={styles.planTitleText}>Monthly</Text>
                                    <Text style={styles.planPriceText}>
                                        {formattedMonthlyPrice} / month <Text style={styles.planSubText}>per couple</Text>
                                    </Text>
                                </View>
                                <View style={styles.planRadioCol}>
                                    {selectedPlan === 'monthly' && <RadioCircleChecked />}
                                </View>
                            </Pressable>
                        )}
                    </View>
                )}

                {/* CTA Action Button */}
                {!isPremium && selectedPackage && (
                    <View>
                        <TouchableOpacity
                            activeOpacity={0.88}
                            onPress={() => handlePurchase(selectedPackage)}
                            style={[
                                styles.subscribeButtonWrapper,
                                (loading || purchasing) && styles.subscribeButtonDisabled,
                            ]}
                            disabled={loading || purchasing}
                        >
                            <LinearGradient
                                colors={['#FF5E97', '#FFA1C9']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.subscribeButton}
                            >
                                <Text style={styles.subscribeButtonText}>
                                    {purchasing
                                        ? 'Processing...'
                                        : selectedPlan === 'annual'
                                            ? 'Try free for 7 days'
                                            : 'Start now'}
                                </Text>
                            </LinearGradient>
                        </TouchableOpacity>
                        <Text style={styles.paymentNoteText}>
                            {selectedPlan === 'annual'
                                ? 'No payment due now'
                                : 'Cancel anytime, no commitment'}
                        </Text>
                    </View>
                )}

                {purchaseSucceeded && (
                    <TouchableOpacity
                        activeOpacity={0.88}
                        onPress={onBack}
                        style={styles.subscribeButtonWrapper}
                    >
                        <LinearGradient
                            colors={['#FF5E97', '#FFA1C9']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.subscribeButton}
                        >
                            <Text style={styles.subscribeButtonText}>Continue</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                )}

                {/* Terms & Privacy links */}
                <View style={styles.termsContainer}>
                    <Text style={styles.termsText}>
                        <Text
                            style={styles.termsLink}
                            onPress={() => Linking.openURL('https://ayushk9799.github.io/penguin-legal/terms-of-service.html')}
                        >
                            Terms of Use
                        </Text>
                        {' • '}
                        <Text
                            style={styles.termsLink}
                            onPress={() => Linking.openURL('https://ayushk9799.github.io/penguin-legal/privacy-policy.html')}
                        >
                            Privacy Policy
                        </Text>
                    </Text>
                </View>
            </View>
            </Animated.View>

            {/* Purchasing overlay loader */}
            {purchasing && (
                <View style={styles.processingOverlay}>
                    <View style={styles.processingCard}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={styles.processingText}>Processing purchase…</Text>
                        <Text style={styles.processingSubtext}>Please wait while we activate your premium.</Text>
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
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderWidth: 1,
        borderColor: '#F7DDEA',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#FFB5D0',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 3,
        zIndex: 10,
    },
    restoreButton: {
        position: 'absolute',
        right: 16,
        paddingHorizontal: 8,
        paddingVertical: 6,
        zIndex: 10,
    },
    restoreButtonText: {
        color: colors.primary,
        fontSize: 13,
        fontWeight: '700',
    },
    mascotContainer: {
        alignSelf: 'center',
        position: 'relative',
        width: 350,
        height: 280,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: -12,
        zIndex: 2,
    },
    mascotImage: {
        width: 335,
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
        elevation: 5,
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
        elevation: 1,
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
        elevation: 3,
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
    },
    termsText: {
        color: colors.textSecondary,
        fontSize: 12,
        fontWeight: '500',
    },
    termsLink: {
        color: colors.textSecondary,
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
        elevation: 2,
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
        elevation: 4,
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
