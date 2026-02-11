// Premium Screen - Full-page premium subscription UI with RevenueCat integration
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Pressable,
    Image,
    Platform,
    Alert,
    ToastAndroid,
    Animated,
    StyleSheet,
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import Purchases from 'react-native-purchases';
import { colors, spacing, borderRadius } from '../theme';
import { setCustomerInfo, setPremiumStatus } from '../store/slices/userSlice';
import { API_URL } from '../constants/Api';

// RevenueCat is configured once in AppNavigator.jsx on app startup.
// No need to configure again here — just use the SDK directly.

const HERO_HEIGHT = 320;
const HERO_GRADIENT_HEIGHT = 180;
const HERO_PLACEHOLDER_HEIGHT = HERO_HEIGHT - 10;

// Crown icon component
const CrownIcon = ({ size = 22, color = colors.primary }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <Path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm0 3h14v2H5v-2z" />
    </Svg>
);

// Check icon component
const CheckIcon = ({ size = 20, color = '#4CAF50' }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
            d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"
            fill={color}
        />
    </Svg>
);

// Minus icon component
const MinusIcon = ({ size = 20, color = '#B0B7BF' }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M19 13H5v-2h14v2z" fill={color} />
    </Svg>
);

// Back arrow icon
const ArrowLeftIcon = ({ size = 22, color = '#222222' }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
            d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"
            fill={color}
        />
    </Svg>
);

// Arrow right icon
const ArrowRightIcon = ({ size = 20, color = '#FFFFFF' }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
            d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z"
            fill={color}
        />
    </Svg>
);

// Circle outline icon
const CircleOutlineIcon = ({ size = 22, color = '#B0B7BF' }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"
            fill={color}
        />
    </Svg>
);

// Check circle icon
const CheckCircleIcon = ({ size = 22, color = colors.primary }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
    </Svg>
);

export default function PremiumScreen({ onBack }) {
    const dispatch = useDispatch();
    const user = useSelector(state => state.user);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [offerings, setOfferings] = useState(null);
    const [entitlements, setEntitlements] = useState(null);
    const [loading, setLoading] = useState(false);

    const scrollY = useRef(new Animated.Value(0)).current;

    const heroOpacity = useMemo(
        () =>
            scrollY.interpolate({
                inputRange: [0, HERO_HEIGHT * 0.6, HERO_HEIGHT],
                outputRange: [1, 0.5, 0],
                extrapolate: 'clamp',
            }),
        [scrollY],
    );

    const heroTranslateY = useMemo(
        () =>
            scrollY.interpolate({
                inputRange: [0, HERO_HEIGHT],
                outputRange: [0, -40],
                extrapolate: 'clamp',
            }),
        [scrollY],
    );

    const onScroll = useMemo(
        () =>
            Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
                useNativeDriver: true,
            }),
        [scrollY],
    );

    const features = useMemo(
        () => [
            { label: 'Unlimited Questions', free: false, pro: true },
            { label: 'Daily Challenges', free: true, pro: true },
            { label: 'All Games', free: false, pro: true },
            { label: 'Premium Topics', free: false, pro: true },
            { label: 'No Ads', free: false, pro: true },
        ],
        [],
    );

    useEffect(() => {
        getOfferingsAndEntitlements();
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
            const { customerInfo } = await Purchases.purchasePackage(pkg);
            dispatch(setCustomerInfo(customerInfo));
            await checkEntitlements();
        } catch (e) {
            if (e?.userCancelled) {
                if (Platform.OS === 'android') {
                    ToastAndroid.show('Purchase cancelled', ToastAndroid.SHORT);
                } else {
                    Alert.alert('Purchase cancelled');
                }
            } else {
                console.error('Purchase error:', e);
            }
        } finally {
            setLoading(false);
        }
    };

    const getOfferingsAndEntitlements = async () => {
        try {
            setLoading(true);
            const o = await Purchases.getOfferings();
            console.log('offerings', o);

            if (o?.current && Array.isArray(o.current.availablePackages) && o.current.availablePackages.length > 0) {
                setOfferings(o);
                if (o.current.annual) {
                    setSelectedPlan('annual');
                } else if (o.current.monthly) {
                    setSelectedPlan('monthly');
                } else {
                    setSelectedPlan(null);
                }
            } else {
                setOfferings(null);
                setSelectedPlan(null);
            }
            await checkEntitlements();
        } catch (e) {
            console.error('Error fetching offerings:', e);
            setOfferings(null);
            setSelectedPlan(null);
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
        <SafeAreaView style={styles.container}>
            <View style={{ flex: 1 }}>
                {/* Hero Image with Parallax */}
                <Animated.View
                    pointerEvents="none"
                    style={[
                        styles.heroContainer,
                        {
                            opacity: heroOpacity,
                            transform: [{ translateY: heroTranslateY }],
                        },
                    ]}
                >
                    <LinearGradient
                        colors={[colors.primaryLight, colors.secondaryLight]}
                        style={styles.heroGradient}
                    >
                        <Text style={styles.heroEmoji}>👑</Text>
                    </LinearGradient>
                    <LinearGradient
                        colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.4)']}
                        style={StyleSheet.absoluteFillObject}
                    />
                    <LinearGradient
                        colors={['rgba(255,255,255,0)', '#FFFFFF']}
                        style={styles.heroFade}
                    />
                    <View style={styles.heroBadgeContainer}>
                        <View style={styles.heroBadge}>
                            <Text style={styles.heroBadgeTitle}>Subscribe Premium</Text>
                            <Text style={styles.heroBadgeSubtitle}>
                                Get unlimited access to all features
                            </Text>
                        </View>
                    </View>
                </Animated.View>

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={onBack}
                        style={styles.backButton}
                    >
                        <ArrowLeftIcon size={22} color="#222222" />
                    </TouchableOpacity>
                </View>

                {/* Scrollable Content */}
                <Animated.ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    scrollEventThrottle={16}
                    onScroll={onScroll}
                >
                    <View style={{ height: HERO_PLACEHOLDER_HEIGHT }} />
                    <View style={styles.contentCard}>
                        {/* Premium Status Badge */}
                        {isPremium && (
                            <View style={styles.premiumStatusContainer}>
                                <View style={styles.premiumStatusCard}>
                                    <View style={styles.premiumStatusHeader}>
                                        <CrownIcon size={22} color={colors.primary} />
                                        <Text style={styles.premiumStatusTitle}>
                                            You're Premium
                                        </Text>
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

                        {/* Feature Comparison Table */}
                        <View style={styles.featureTableContainer}>
                            <View style={styles.featureTable}>
                                <View style={styles.featureTableHeader}>
                                    <View style={{ flex: 1 }} />
                                    <View style={styles.featureTableHeaderCell}>
                                        <Text style={styles.featureTableHeaderText}>FREE</Text>
                                    </View>
                                    <View style={styles.featureTableHeaderCell}>
                                        <View style={styles.proBadge}>
                                            <Text style={styles.proBadgeText}>PRO</Text>
                                        </View>
                                    </View>
                                </View>
                                {features.map((f, idx) => (
                                    <View
                                        key={f.label}
                                        style={[
                                            styles.featureRow,
                                            idx === 0 && { borderTopWidth: 0 },
                                        ]}
                                    >
                                        <View style={styles.featureLabelContainer}>
                                            <Text style={styles.featureLabel}>{f.label}</Text>
                                        </View>
                                        <View style={styles.featureCheckContainer}>
                                            {f.free ? (
                                                <CheckIcon size={20} color="#4CAF50" />
                                            ) : (
                                                <MinusIcon size={20} color="#B0B7BF" />
                                            )}
                                        </View>
                                        <View style={styles.featureCheckContainer}>
                                            {f.pro ? (
                                                <CheckIcon size={20} color="#00C4B3" />
                                            ) : (
                                                <MinusIcon size={20} color="#B0B7BF" />
                                            )}
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </View>

                        {/* Plan Cards */}
                        {!isPremium && (
                            <View style={styles.planCardsContainer}>
                                {/* Monthly Plan */}
                                <Pressable
                                    onPress={() => monthlyPackage && setSelectedPlan('monthly')}
                                    style={[
                                        styles.planCard,
                                        selectedPlan === 'monthly' && styles.planCardSelected,
                                        !monthlyPackage && styles.planCardDisabled,
                                    ]}
                                >
                                    <View style={styles.planCardContent}>
                                        {selectedPlan === 'monthly' ? (
                                            <CheckCircleIcon size={22} color={colors.primary} />
                                        ) : (
                                            <CircleOutlineIcon size={22} color="#B0B7BF" />
                                        )}
                                        <View style={styles.planCardInfo}>
                                            <Text style={styles.planCardTitle}>Monthly Plan</Text>
                                            <Text style={styles.planCardDescription}>
                                                Short term plan. Auto-renewal subscription
                                            </Text>
                                        </View>
                                        <View style={styles.planCardPricing}>
                                            <Text style={styles.planCardPrice}>
                                                {monthlyPackage?.product?.priceString || ''}
                                            </Text>
                                            {getMonthlyStrikethroughPrice() && (
                                                <Text style={styles.planCardStrikethrough}>
                                                    {getMonthlyStrikethroughPrice()}
                                                </Text>
                                            )}
                                        </View>
                                    </View>
                                </Pressable>

                                {/* Yearly Plan */}
                                <Pressable
                                    onPress={() => annualPackage && setSelectedPlan('annual')}
                                    style={[
                                        styles.planCard,
                                        selectedPlan === 'annual' && styles.planCardSelected,
                                        !annualPackage && styles.planCardDisabled,
                                    ]}
                                >
                                    {annualPackage && (
                                        <View style={styles.bestValueBadge}>
                                            <Text style={styles.bestValueText}>BEST VALUE</Text>
                                        </View>
                                    )}
                                    <View style={styles.planCardContent}>
                                        {selectedPlan === 'annual' ? (
                                            <CheckCircleIcon size={22} color={colors.primary} />
                                        ) : (
                                            <CircleOutlineIcon size={22} color="#B0B7BF" />
                                        )}
                                        <View style={[styles.planCardInfo, { paddingRight: 10 }]}>
                                            <Text style={styles.planCardTitle}>Yearly Plan</Text>
                                            <Text style={styles.planCardDescription}>
                                                Value for money. Auto-renewal subscription
                                            </Text>
                                            {annualPackage?.product?.pricePerMonthString && (
                                                <Text style={styles.planCardMonthly}>
                                                    Only {annualPackage.product.pricePerMonthString}/month
                                                </Text>
                                            )}
                                        </View>
                                        <View style={styles.planCardPricing}>
                                            <Text style={styles.planCardPrice}>
                                                {annualPackage?.product?.priceString || ''}
                                            </Text>
                                            {getAnnualStrikethroughPrice() && (
                                                <Text style={styles.planCardStrikethrough}>
                                                    {getAnnualStrikethroughPrice()}
                                                </Text>
                                            )}
                                        </View>
                                    </View>
                                </Pressable>

                                {!monthlyPackage && !annualPackage && (
                                    <View style={styles.noPackagesContainer}>
                                        <Text style={styles.noPackagesText}>No packages available</Text>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* Subscribe Button */}
                        {!isPremium && (
                            <View style={styles.subscribeContainer}>
                                <TouchableOpacity
                                    activeOpacity={0.9}
                                    onPress={() => selectedPackage && handlePurchase(selectedPackage)}
                                    style={[
                                        styles.subscribeButton,
                                        !selectedPackage && styles.subscribeButtonDisabled,
                                    ]}
                                    disabled={!selectedPackage || loading}
                                >
                                    <View style={styles.subscribeButtonContent}>
                                        <Text style={styles.subscribeButtonText}>
                                            {loading ? 'Processing...' : 'Subscribe Now'}
                                        </Text>
                                        <ArrowRightIcon size={20} color="#FFFFFF" />
                                    </View>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Cancel Anytime */}
                        <View style={styles.cancelContainer}>
                            <Text style={styles.cancelText}>Cancel anytime</Text>
                        </View>

                        {/* Terms */}
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
                    </View>
                </Animated.ScrollView>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    heroContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: HERO_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
    },
    heroGradient: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroEmoji: {
        fontSize: 80,
    },
    heroFade: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: HERO_GRADIENT_HEIGHT,
    },
    heroBadgeContainer: {
        position: 'absolute',
        bottom: 75,
        width: '100%',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    heroBadge: {
        backgroundColor: 'rgba(255,255,255,0.95)',
        paddingVertical: 7,
        paddingHorizontal: 20,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
        alignItems: 'center',
    },
    heroBadgeTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: colors.primary,
    },
    heroBadgeSubtitle: {
        fontSize: 12,
        fontWeight: '500',
        color: '#4A4A4A',
        marginTop: 4,
        textAlign: 'center',
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        zIndex: 3,
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E8E8E8',
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
        marginRight: 6,
    },
    scrollView: {
        flex: 1,
        zIndex: 2,
        backgroundColor: 'transparent',
    },
    scrollContent: {
        paddingBottom: 28,
    },
    contentCard: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        marginTop: -62,
        paddingTop: 4,
        paddingBottom: 24,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: -2 },
    },
    premiumStatusContainer: {
        paddingHorizontal: 16,
        marginTop: 4,
    },
    premiumStatusCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#EDEDED',
        padding: 16,
    },
    premiumStatusHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    premiumStatusTitle: {
        marginLeft: 8,
        fontSize: 18,
        fontWeight: '900',
        color: '#1E1E1E',
    },
    premiumStatusDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    premiumStatusLabel: {
        color: '#6C6C6C',
        fontSize: 12,
        fontWeight: '700',
    },
    premiumStatusValue: {
        color: '#1E1E1E',
        fontSize: 14,
        fontWeight: '800',
        marginTop: 2,
    },
    featureTableContainer: {
        paddingHorizontal: 16,
        marginTop: 0,
    },
    featureTable: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#EDEDED',
        overflow: 'hidden',
    },
    featureTableHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 14,
        backgroundColor: '#FAFAFA',
        borderBottomWidth: 1,
        borderBottomColor: '#F2F2F2',
    },
    featureTableHeaderCell: {
        width: 56,
        alignItems: 'center',
        justifyContent: 'center',
    },
    featureTableHeaderText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#6C6C6C',
    },
    proBadge: {
        backgroundColor: colors.primary,
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    proBadgeText: {
        fontSize: 12,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 14,
        backgroundColor: 'transparent',
        borderTopWidth: 1,
        borderTopColor: '#F2F2F2',
    },
    featureLabelContainer: {
        flex: 1,
        paddingRight: 10,
    },
    featureLabel: {
        color: '#24323D',
        fontSize: 14,
        fontWeight: '700',
    },
    featureCheckContainer: {
        width: 56,
        alignItems: 'center',
        justifyContent: 'center',
    },
    planCardsContainer: {
        paddingHorizontal: 12,
        marginTop: 10,
    },
    planCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#EDEDED',
        padding: 14,
        marginBottom: 12,
    },
    planCardSelected: {
        borderColor: colors.primary,
    },
    planCardDisabled: {
        opacity: 0.5,
    },
    planCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    planCardInfo: {
        marginLeft: 10,
        flex: 1,
    },
    planCardTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#1E1E1E',
    },
    planCardDescription: {
        fontSize: 11,
        fontWeight: '600',
        color: '#65727E',
        marginTop: 2,
    },
    planCardMonthly: {
        fontSize: 11,
        fontWeight: '700',
        color: '#4CAF50',
        marginTop: 2,
    },
    planCardPricing: {
        alignItems: 'flex-end',
    },
    planCardPrice: {
        fontSize: 18,
        fontWeight: '900',
        color: '#1E1E1E',
    },
    planCardStrikethrough: {
        fontSize: 12,
        color: '#9AA3AB',
        textDecorationLine: 'line-through',
    },
    bestValueBadge: {
        position: 'absolute',
        top: -10,
        right: 14,
        backgroundColor: '#4CAF50',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    bestValueText: {
        color: '#FFFFFF',
        fontWeight: '900',
        fontSize: 10,
    },
    noPackagesContainer: {
        paddingVertical: 24,
        alignItems: 'center',
    },
    noPackagesText: {
        color: '#6C6C6C',
    },
    subscribeContainer: {
        paddingHorizontal: 16,
        marginTop: 12,
    },
    subscribeButton: {
        backgroundColor: colors.primary,
        borderRadius: 16,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors.primary,
        shadowOpacity: 0.2,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
        elevation: 3,
    },
    subscribeButtonDisabled: {
        opacity: 0.6,
    },
    subscribeButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    subscribeButtonText: {
        color: '#FFFFFF',
        fontWeight: '900',
        fontSize: 16,
        marginRight: 6,
    },
    cancelContainer: {
        paddingHorizontal: 16,
        marginTop: 12,
    },
    cancelText: {
        textAlign: 'center',
        color: '#4A5564',
        fontWeight: '700',
    },
    termsContainer: {
        paddingHorizontal: 16,
        marginTop: 10,
    },
    termsText: {
        textAlign: 'center',
        color: '#6B7280',
        fontSize: 12,
    },
    termsLink: {
        color: colors.primary,
        fontWeight: '800',
        textDecorationLine: 'underline',
    },
});
