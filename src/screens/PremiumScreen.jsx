// Premium Screen - Full-page premium subscription UI with RevenueCat integration
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Pressable,
    Image,
    Platform,
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
import { API_URL } from '../constants/Api';

// Close (cross) icon
const CloseIcon = () => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path
            d="M18 6L6 18M6 6l12 12"
            stroke="#050E3E"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </Svg>
);



// Check / Minus Icons
const PinkCheck = () => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="12" r="10" fill="#FF4B80" />
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
        <Circle cx="12" cy="12" r="12" fill="#FF4B80" />
        <Path d="M8 12.5l2.5 2.5 5-5" stroke="#FFFFFF" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);

export default function PremiumScreen({ onBack }) {
    const dispatch = useDispatch();
    const user = useSelector(state => state.user);
    const [selectedPlan, setSelectedPlan] = useState('annual'); // Default to Yearly/Annual plan
    const [offerings, setOfferings] = useState(null);
    const [entitlements, setEntitlements] = useState(null);
    const [loading, setLoading] = useState(false);
    const [purchasing, setPurchasing] = useState(false);
    const insets = useSafeAreaInsets();

    const features = useMemo(
        () => [
            { label: 'Unlimited Questions' },
            { label: 'Daily Challenges' },
            { label: 'All Games' },
            { label: 'Premium Topics' },
        ],
        [],
    );

    useEffect(() => {
        const init = async () => {
            await getOfferingsAndEntitlements();
        };
        init();
    }, []);

    const syncServerPremium = async (customerInfo) => {
        try {
            const active = customerInfo?.entitlements?.active || {};
            const activeList = Object.values(active || {});
            const hasActive = activeList.length > 0;
            let premiumExpiresAt = null;
            let premiumPlan = null;

            if (hasActive) {
                const maxDate = activeList.reduce((acc, e) => {
                    const d = e?.expirationDate ? new Date(e.expirationDate) : null;
                    if (!d) return acc;
                    if (!acc) return d;
                    return d > acc ? d : acc;
                }, null);
                premiumExpiresAt = maxDate ? maxDate.toISOString() : null;
                premiumPlan = activeList[0]?.productIdentifier || selectedPlan || null;
            }

            const uid = user?.id;
            if (!uid) return;

            // Update backend
            await fetch(`${API_URL}/api/user/premium`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: uid,
                    isPremium: hasActive,
                    premiumExpiresAt: hasActive ? premiumExpiresAt : null,
                    premiumPlan: hasActive ? premiumPlan : null,
                }),
            });

            // Update Redux state
            dispatch(setPremiumStatus({
                isPremium: hasActive,
                premiumExpiresAt: hasActive ? premiumExpiresAt : null,
                premiumPlan: hasActive ? premiumPlan : null,
            }));
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
            const activeList = Object.values(active);
            if (activeList.length > 0) {
                const maxDate = activeList.reduce((acc, e) => {
                    const d = e?.expirationDate ? new Date(e.expirationDate) : null;
                    if (!d) return acc;
                    if (!acc) return d;
                    return d > acc ? d : acc;
                }, null);
                dispatch(setPremiumStatus({
                    isPremium: true,
                    premiumExpiresAt: maxDate ? maxDate.toISOString() : null,
                    premiumPlan: activeList[0]?.productIdentifier || selectedPlan || null,
                    premiumSource: 'self',
                }));
                setEntitlements(active);
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
            setLoading(true);
            const customerInfo = await Purchases.restorePurchases();
            dispatch(setCustomerInfo(customerInfo));
            await checkEntitlements();
        } catch (e) {
            console.error('Error restoring purchases:', e);
        } finally {
            setLoading(false);
        }
    };

    const getOfferingsAndEntitlements = async () => {
        try {
            setLoading(true);
            const o = await Purchases.getOfferings();

            if (o?.current && Array.isArray(o.current.availablePackages) && o.current.availablePackages.length > 0) {
                setOfferings(o);
                if (o.current.annual) {
                    setSelectedPlan('annual');
                } else if (o.current.monthly) {
                    setSelectedPlan('monthly');
                } else {
                    setSelectedPlan('annual');
                }
            } else {
                setOfferings(null);
            }
            await checkEntitlements();
        } catch (e) {
            console.error('Error fetching offerings:', e);
            setOfferings(null);
        } finally {
            setLoading(false);
        }
    };

    const annualPackage = offerings?.current?.annual || null;
    const monthlyPackage = offerings?.current?.monthly || null;
    const selectedPackage = selectedPlan === 'monthly' ? monthlyPackage : selectedPlan === 'annual' ? annualPackage : null;
    const isPremium = !!(user?.isPremium || (entitlements && Object.keys(entitlements || {}).length > 0));
    const premiumPlan = user?.premiumPlan || null;
    const premiumExpiresAt = user?.premiumExpiresAt || null;

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

    const getMonthlyStrikethroughPrice = () => {
        if (!monthlyPackage?.product?.price || !monthlyPackage?.product?.currencyCode) return null;
        const monthlyPrice = monthlyPackage.product.price;
        const originalPrice = monthlyPrice * 1.5;
        return formatCurrencyPrice(originalPrice, monthlyPackage.product.currencyCode, true);
    };

    const getAnnualStrikethroughPrice = () => {
        if (!annualPackage?.product?.price || !annualPackage?.product?.currencyCode) return null;
        const annualPrice = annualPackage.product.price;
        const originalPrice = annualPrice * 1.5;
        return formatCurrencyPrice(originalPrice, annualPackage.product.currencyCode, true);
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

            {/* Frosted circular back button */}
            <TouchableOpacity
                onPress={onBack}
                style={[styles.backButton, { top: insets.top > 0 ? insets.top + 6 : 16 }]}
                activeOpacity={0.8}
            >
                <CloseIcon />
            </TouchableOpacity>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={[
                    styles.scrollContent,
                    {
                        paddingTop: insets.top > 0 ? insets.top + 20 : 34,
                        paddingBottom: insets.bottom > 0 ? insets.bottom + 20 : 30,
                    },
                ]}
                showsVerticalScrollIndicator={false}
            >
                {/* Center Mascot Image */}
                <Image
                    source={require('../../assets/images/premium-muscot.png')}
                    style={styles.mascotImage}
                    resizeMode="contain"
                />

                {/* Heading details */}
                <View style={styles.headerTextContainer}>
                    <Text style={styles.headingTitle}>
                        Subscribe <Text style={styles.premiumText}>Premium</Text>
                    </Text>
                    <Text style={styles.headingSubtitle}>
                        Get unlimited access to all features
                    </Text>
                </View>

                {/* Premium Active Status (Redundant unless purchased) */}
                {isPremium && (
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
                                    <Text style={styles.premiumStatusLabel}>Renews/Expires</Text>
                                    <Text style={styles.premiumStatusValue}>
                                        {formatDate(premiumExpiresAt)}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>
                )}

                {/* Premium Benefits Grid */}
                <View style={styles.benefitsContainer}>
                    <View style={styles.benefitsGrid}>
                        {features.map((f) => {
                            return (
                                <View key={f.label} style={styles.benefitsItem}>
                                    <PinkCheck />
                                    <Text style={styles.benefitsText}>{f.label}</Text>
                                </View>
                            );
                        })}
                    </View>
                </View>

                {/* Plan Selection Cards */}
                {!isPremium && (
                    <View style={styles.planCardsContainer}>
                        {/* Monthly Plan Option */}
                        <Pressable
                            onPress={() => monthlyPackage && setSelectedPlan('monthly')}
                            style={[
                                styles.planCard,
                                selectedPlan === 'monthly' && styles.planCardSelected,
                                !monthlyPackage && styles.planCardDisabled,
                            ]}
                        >
                            <View style={styles.planRadioCol}>
                                {selectedPlan === 'monthly' ? (
                                    <RadioCircleChecked />
                                ) : (
                                    <RadioCircleOutline />
                                )}
                            </View>
                            <View style={styles.planDetailsCol}>
                                <Text style={styles.planTitleText}>Monthly Plan</Text>
                                <Text style={styles.planSubtitleText}>Short term plan</Text>
                                <Text style={styles.planMetaText}>Auto-renewal subscription</Text>
                            </View>
                            <View style={styles.planPricingCol}>
                                <Text style={styles.planPriceText}>
                                    {monthlyPackage?.product?.priceString || '$5.00'}
                                </Text>
                                <Text style={styles.planStrikethroughText}>
                                    {getMonthlyStrikethroughPrice() || 'US$7.99'}
                                </Text>
                            </View>
                        </Pressable>

                        {/* Yearly Plan Option */}
                        <Pressable
                            onPress={() => annualPackage && setSelectedPlan('annual')}
                            style={[
                                styles.planCard,
                                selectedPlan === 'annual' && styles.planCardSelected,
                                !annualPackage && styles.planCardDisabled,
                                { marginBottom: 0 },
                            ]}
                        >
                            <View style={styles.bestValueBadge}>
                                <Text style={styles.bestValueText}>BEST VALUE</Text>
                            </View>

                            <View style={styles.planRadioCol}>
                                {selectedPlan === 'annual' ? (
                                    <RadioCircleChecked />
                                ) : (
                                    <RadioCircleOutline />
                                )}
                            </View>
                            <View style={styles.planDetailsCol}>
                                <Text style={styles.planTitleText}>Yearly Plan</Text>
                                <Text style={styles.planSubtitleText}>Value for money</Text>
                                <Text style={styles.planMetaText}>Auto-renewal subscription</Text>
                                <Text style={styles.planSavingsText}>
                                    {annualPackage?.product?.pricePerMonthString ? `Only ${annualPackage.product.pricePerMonthString}/month` : 'Only $2.08/month'}
                                </Text>
                            </View>
                            <View style={styles.planPricingCol}>
                                <Text style={styles.planPriceText}>
                                    {annualPackage?.product?.priceString || '$25.00'}
                                </Text>
                                <Text style={styles.planStrikethroughText}>
                                    {getAnnualStrikethroughPrice() || 'US$37.99'}
                                </Text>
                            </View>
                        </Pressable>

                        {!monthlyPackage && !annualPackage && (
                            <View style={styles.noPackagesContainer}>
                                <Text style={styles.noPackagesText}>No packages available</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* CTA Action Button */}
                {!isPremium && (
                    <TouchableOpacity
                        activeOpacity={0.88}
                        onPress={() => selectedPackage && handlePurchase(selectedPackage)}
                        style={[
                            styles.subscribeButtonWrapper,
                            (!selectedPackage || loading) && styles.subscribeButtonDisabled,
                        ]}
                        disabled={!selectedPackage || loading}
                    >
                        <LinearGradient
                            colors={['#FF758F', '#FF7EB3']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.subscribeButton}
                        >
                            <Text style={styles.subscribeButtonText}>
                                {loading ? 'Processing...' : 'Subscribe Now'}
                            </Text>
                            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                                <Path
                                    d="M5 12h14M12 5l7 7-7 7"
                                    stroke="#FFFFFF"
                                    strokeWidth={2.5}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </Svg>
                        </LinearGradient>
                    </TouchableOpacity>
                )}

                {/* Couples Banner */}
                {!isPremium && (
                    <View style={styles.couplesBannerContainer}>
                        <View style={styles.couplesBanner}>
                            <Text style={styles.couplesText}>
                                💕 One subscription covers both you & your partner — only one of you needs to pay!
                            </Text>
                        </View>
                    </View>
                )}

                {/* Cancel & Restore Footer Links */}
                <View style={styles.cancelRestoreRow}>
                    <Text style={styles.cancelText}>Cancel anytime</Text>
                    <Text style={styles.cancelDot}>·</Text>
                    <TouchableOpacity
                        onPress={handleRestore}
                        disabled={loading}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.cancelText}>
                            {loading ? 'Restoring...' : 'Restore Purchase'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Terms of Use */}
                <View style={styles.termsContainer}>
                    <Text style={styles.termsText}>
                        By continuing, you agree to our{' '}
                        <Text
                            style={styles.termsLink}
                            onPress={() => Linking.openURL('https://yourapp.com/terms')}
                        >
                            terms of use
                        </Text>{' '}
                        &{' '}
                        <Text
                            style={styles.termsLink}
                            onPress={() => Linking.openURL('https://yourapp.com/privacy')}
                        >
                            privacy policy
                        </Text>
                        .
                    </Text>
                </View>
            </ScrollView>

            {/* Purchasing overlay loader */}
            {purchasing && (
                <View style={styles.processingOverlay}>
                    <View style={styles.processingCard}>
                        <ActivityIndicator size="large" color="#FF4B80" />
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
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
    },
    backButton: {
        position: 'absolute',
        left: 16,
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#FFB5D0',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 3,
        zIndex: 10,
    },
    mascotImage: {
        width: 260,
        height: 236,
        alignSelf: 'center',
        marginTop: -30,
    },
    headerTextContainer: {
        alignItems: 'center',
        marginTop: 12,
        marginBottom: 20,
    },
    headingTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#050E3E',
        letterSpacing: -0.4,
    },
    premiumText: {
        color: '#FF4B80',
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
    },
    headingSubtitle: {
        color: '#687498',
        fontSize: 14,
        fontWeight: '500',
        marginTop: 5,
    },
    // Benefits Grid
    benefitsContainer: {
        marginBottom: 20,
        paddingHorizontal: 8,
    },
    benefitsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: 14,
    },
    benefitsItem: {
        width: '47%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    benefitsText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#050E3E',
        flexShrink: 1,
    },
    dashText: {
        color: '#C5C9D6',
        fontSize: 16,
        fontWeight: '700',
    },
    // Plan Cards
    planCardsContainer: {
        marginBottom: 12,
    },
    planCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderWidth: 2,
        borderColor: 'transparent',
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#FFB5D0',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 2,
    },
    planCardSelected: {
        borderColor: '#FF4B80',
    },
    planCardDisabled: {
        opacity: 0.5,
    },
    bestValueBadge: {
        position: 'absolute',
        top: -11,
        right: 20,
        backgroundColor: '#FF4B80',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
        zIndex: 2,
    },
    bestValueText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.2,
    },
    planRadioCol: {
        marginRight: 12,
    },
    planDetailsCol: {
        flex: 1.1,
    },
    planTitleText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#050E3E',
    },
    planSubtitleText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#7380A1',
        marginTop: 2,
    },
    planMetaText: {
        fontSize: 11,
        fontWeight: '500',
        color: '#7380A1',
        marginTop: 1,
    },
    planSavingsText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#10B981',
        marginTop: 4,
    },
    planPricingCol: {
        alignItems: 'flex-end',
    },
    planPriceText: {
        fontSize: 17,
        fontWeight: '800',
        color: '#050E3E',
    },
    planStrikethroughText: {
        fontSize: 11,
        color: '#A0A6B5',
        textDecorationLine: 'line-through',
        marginTop: 2,
    },
    noPackagesContainer: {
        paddingVertical: 24,
        alignItems: 'center',
    },
    noPackagesText: {
        color: '#7380A1',
    },
    // Couples Banner
    couplesBannerContainer: {
        marginBottom: 8,
        paddingHorizontal: 4,
    },
    couplesBanner: {
        backgroundColor: 'rgba(255, 235, 240, 0.5)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 117, 151, 0.12)',
        padding: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    couplesText: {
        color: '#FF6F8F',
        fontSize: 11,
        fontWeight: '500',
        lineHeight: 16.5,
        textAlign: 'center',
    },
    // CTA Action Button
    subscribeButtonWrapper: {
        marginHorizontal: 4,
        marginBottom: 16,
        shadowColor: '#FF6F8F',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
        elevation: 4,
    },
    subscribeButtonDisabled: {
        opacity: 0.6,
    },
    subscribeButton: {
        height: 54,
        borderRadius: 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    subscribeButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '900',
    },
    // Footer Links
    cancelRestoreRow: {
        marginTop: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cancelText: {
        color: '#7380A1',
        fontSize: 13,
        fontWeight: '700',
    },
    cancelDot: {
        color: '#7380A1',
        fontSize: 13,
        fontWeight: '700',
        marginHorizontal: 8,
    },
    // Terms of Use
    termsContainer: {
        marginTop: 12,
        marginBottom: 20,
    },
    termsText: {
        textAlign: 'center',
        color: '#A0A6B5',
        fontSize: 11,
        lineHeight: 15,
    },
    termsLink: {
        color: '#FF4B80',
        fontWeight: '800',
        textDecorationLine: 'underline',
    },
    // Premium Active Status
    premiumStatusContainer: {
        marginBottom: 16,
    },
    premiumStatusCard: {
        backgroundColor: '#FFFFFF',
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
        color: '#050E3E',
    },
    premiumStatusDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    premiumStatusLabel: {
        color: '#7380A1',
        fontSize: 11,
        fontWeight: '700',
    },
    premiumStatusValue: {
        color: '#050E3E',
        fontSize: 13,
        fontWeight: '800',
        marginTop: 2,
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
        backgroundColor: '#FFFFFF',
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
        color: '#050E3E',
        fontSize: 16,
        fontWeight: '900',
        marginTop: 16,
    },
    processingSubtext: {
        color: '#7380A1',
        fontSize: 13,
        marginTop: 6,
        textAlign: 'center',
    },
});
