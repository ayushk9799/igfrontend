// Premium Bottom Sheet - Quick premium prompt modal using @gorhom/bottom-sheet
import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Pressable,
    Image,
    Platform,
    Alert,
    ToastAndroid,
    ScrollView,
    Linking,
    BackHandler,
} from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import { useDispatch, useSelector } from 'react-redux';
import Svg, { Path } from 'react-native-svg';
import Purchases from 'react-native-purchases';
import { colors } from '../theme';
import { setCustomerInfo, setPremiumStatus } from '../store/slices/userSlice';
import { API_URL } from '../constants/Api';

// Check circle icon
const CheckCircleFilledIcon = ({ size = 18, color = colors.primary }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
    </Svg>
);

// Crown icon
const CrownIcon = ({ size = 22, color = colors.primary }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <Path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm0 3h14v2H5v-2z" />
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

// Check circle selected icon
const CheckCircleIcon = ({ size = 22, color = colors.primary }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <Path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
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

const PremiumBottomSheet = forwardRef(function PremiumBottomSheet({ points = [] }, ref) {
    const dispatch = useDispatch();
    const user = useSelector(state => state.user);
    const sheetRef = useRef(null);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [offerings, setOfferings] = useState(null);
    const [entitlements, setEntitlements] = useState(null);
    const [loading, setLoading] = useState(false);
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    const snapPoints = useMemo(() => ['65%'], []);

    // Handle Android back button when sheet is open
    useEffect(() => {
        if (!isSheetOpen) return;

        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            sheetRef.current?.dismiss();
            return true;
        });

        return () => backHandler.remove();
    }, [isSheetOpen]);

    const backdrop = useCallback((props) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.4} />
    ), []);

    useImperativeHandle(ref, () => ({
        present: async () => {
            try {
                await getOfferingsAndEntitlements();
            } finally {
                sheetRef.current?.present();
            }
        },
        dismiss: () => sheetRef.current?.dismiss(),
    }), []);

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

            dispatch(setPremiumStatus({
                isPremium: hasActive,
                premiumExpiresAt: hasActive ? premiumExpiresAt : null,
                premiumPlan: hasActive ? premiumPlan : null,
            }));
        } catch (e) {
            console.error('Error syncing premium:', e);
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
            }
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
                if (o.current.sixMonth) {
                    setSelectedPlan('sixMonth');
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
            setOfferings(null);
            setSelectedPlan(null);
        } finally {
            setLoading(false);
        }
    };

    const sixMonthPackage = offerings?.current?.sixMonth || null;
    const monthlyPackage = offerings?.current?.monthly || null;
    const selectedPackage = selectedPlan === 'monthly' ? monthlyPackage : selectedPlan === 'sixMonth' ? sixMonthPackage : null;
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

    const getSixMonthStrikethroughPrice = () => {
        if (!sixMonthPackage?.product?.price || !sixMonthPackage?.product?.currencyCode) return null;
        const sixMonthPrice = sixMonthPackage.product.price;
        const originalPrice = sixMonthPrice * 1.5;
        return formatCurrencyPrice(originalPrice, sixMonthPackage.product.currencyCode, true);
    };

    return (
        <BottomSheetModal
            ref={sheetRef}
            snapPoints={snapPoints}
            backdropComponent={backdrop}
            enablePanDownToClose={true}
            onChange={(index) => {
                setIsSheetOpen(index >= 0);
                if (index >= 0) {
                    getOfferingsAndEntitlements().catch(() => { });
                }
            }}
        >
            <BottomSheetView style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
                    {/* Header */}
                    <View style={{
                        width: '100%',
                        height: 120,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colors.primaryLight,
                    }}>
                        <Text style={{ fontSize: 60 }}>👑</Text>
                        <View style={{
                            position: 'absolute',
                            bottom: 12,
                            width: '100%',
                            alignItems: 'center',
                            paddingHorizontal: 16,
                        }}>
                            <View style={{
                                backgroundColor: 'rgba(255,255,255,0.95)',
                                paddingVertical: 10,
                                paddingHorizontal: 16,
                                borderRadius: 16,
                                shadowColor: '#000',
                                shadowOpacity: 0.08,
                                shadowRadius: 12,
                                shadowOffset: { width: 0, height: 4 },
                                elevation: 2,
                                alignItems: 'center',
                            }}>
                                <Text style={{ fontSize: 20, fontWeight: '800', color: colors.primary }}>
                                    Subscribe Premium
                                </Text>
                                <Text style={{ fontSize: 14, fontWeight: '500', color: '#4A4A4A', marginTop: 4, textAlign: 'center' }}>
                                    Get unlimited access to all features
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Custom Points Section */}
                    {points && points.length > 0 && (
                        <View style={{ paddingHorizontal: 20, marginTop: 6 }}>
                            {points.map((point, index) => (
                                <View key={index} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 1 }}>
                                    <CheckCircleFilledIcon size={18} color={colors.primary} />
                                    <Text style={{ marginLeft: 8, fontSize: 14, fontWeight: '600', color: '#4A4A4A', flex: 1 }}>
                                        {point}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}

                    <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
                        {/* Premium Status */}
                        {isPremium && (
                            <View style={{
                                backgroundColor: '#FFFFFF',
                                borderRadius: 16,
                                borderWidth: 1,
                                borderColor: '#EDEDED',
                                padding: 16,
                            }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                    <CrownIcon size={22} color={colors.primary} />
                                    <Text style={{ marginLeft: 8, fontSize: 18, fontWeight: '900', color: '#1E1E1E' }}>
                                        You're Premium
                                    </Text>
                                </View>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <View>
                                        <Text style={{ color: '#6C6C6C', fontSize: 12, fontWeight: '700' }}>Plan</Text>
                                        <Text style={{ color: '#1E1E1E', fontSize: 14, fontWeight: '800', marginTop: 2 }}>
                                            {planLabelFromId(premiumPlan)}
                                        </Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={{ color: '#6C6C6C', fontSize: 12, fontWeight: '700' }}>Renews/Expires</Text>
                                        <Text style={{ color: '#1E1E1E', fontSize: 14, fontWeight: '800', marginTop: 2 }}>
                                            {formatDate(premiumExpiresAt)}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        )}
                    </View>

                    {/* Plan cards */}
                    {!isPremium && (
                        <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
                            {/* Monthly */}
                            <Pressable
                                onPress={() => monthlyPackage && setSelectedPlan('monthly')}
                                style={{
                                    backgroundColor: '#FFFFFF',
                                    borderRadius: 16,
                                    borderWidth: 2,
                                    borderColor: selectedPlan === 'monthly' ? colors.primary : '#EDEDED',
                                    padding: 14,
                                    marginBottom: 12,
                                    opacity: monthlyPackage ? 1 : 0.5,
                                }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    {selectedPlan === 'monthly' ? (
                                        <CheckCircleIcon size={22} color={colors.primary} />
                                    ) : (
                                        <CircleOutlineIcon size={22} color="#B0B7BF" />
                                    )}
                                    <View style={{ marginLeft: 10, flex: 1 }}>
                                        <Text style={{ fontSize: 18, fontWeight: '900', color: '#1E1E1E' }}>Monthly Plan</Text>
                                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#65727E', marginTop: 2 }}>
                                            Short term plan. Auto-renewal subscription
                                        </Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={{ fontSize: 18, fontWeight: '900', color: '#1E1E1E' }}>
                                            {monthlyPackage?.product?.priceString || ''}
                                        </Text>
                                        {getMonthlyStrikethroughPrice() && (
                                            <Text style={{ fontSize: 12, color: '#9AA3AB', textDecorationLine: 'line-through' }}>
                                                {getMonthlyStrikethroughPrice()}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            </Pressable>

                            {/* 6 Month */}
                            <Pressable
                                onPress={() => sixMonthPackage && setSelectedPlan('sixMonth')}
                                style={{
                                    backgroundColor: '#FFFFFF',
                                    borderRadius: 16,
                                    borderWidth: 2,
                                    borderColor: selectedPlan === 'sixMonth' ? colors.primary : '#EDEDED',
                                    padding: 14,
                                    opacity: sixMonthPackage ? 1 : 0.5,
                                }}
                            >
                                {sixMonthPackage && (
                                    <View style={{ position: 'absolute', top: -10, right: 14 }}>
                                        <View style={{
                                            backgroundColor: '#4CAF50',
                                            borderRadius: 12,
                                            paddingHorizontal: 10,
                                            paddingVertical: 4,
                                        }}>
                                            <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 10 }}>BEST VALUE</Text>
                                        </View>
                                    </View>
                                )}
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    {selectedPlan === 'sixMonth' ? (
                                        <CheckCircleIcon size={22} color={colors.primary} />
                                    ) : (
                                        <CircleOutlineIcon size={22} color="#B0B7BF" />
                                    )}
                                    <View style={{ marginLeft: 10, flex: 1, paddingRight: 10 }}>
                                        <Text style={{ fontSize: 18, fontWeight: '900', color: '#1E1E1E' }}>6 Month Plan</Text>
                                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#65727E', marginTop: 2 }}>
                                            Value for money. Auto-renewal subscription
                                        </Text>
                                        {sixMonthPackage?.product?.pricePerMonthString && (
                                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#4CAF50', marginTop: 2 }}>
                                                Only {sixMonthPackage.product.pricePerMonthString}/month
                                            </Text>
                                        )}
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={{ fontSize: 18, fontWeight: '900', color: '#1E1E1E' }}>
                                            {sixMonthPackage?.product?.priceString || ''}
                                        </Text>
                                        {getSixMonthStrikethroughPrice() && (
                                            <Text style={{ fontSize: 12, color: '#9AA3AB', textDecorationLine: 'line-through' }}>
                                                {getSixMonthStrikethroughPrice()}
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            </Pressable>

                            {!monthlyPackage && !sixMonthPackage && (
                                <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                                    <Text style={{ color: '#6C6C6C' }}>No packages available</Text>
                                </View>
                            )}
                        </View>
                    )}

                    {/* Subscribe Button */}
                    {!isPremium && (
                        <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
                            <TouchableOpacity
                                activeOpacity={0.9}
                                onPress={() => selectedPackage && handlePurchase(selectedPackage)}
                                style={{
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
                                    opacity: selectedPackage ? 1 : 0.6,
                                }}
                                disabled={!selectedPackage || loading}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 16, marginRight: 6 }}>
                                        {loading ? 'Processing...' : 'Subscribe Now'}
                                    </Text>
                                    <ArrowRightIcon size={20} color="#FFFFFF" />
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Cancel anytime */}
                    <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
                        <Text style={{ textAlign: 'center', color: '#4A5564', fontWeight: '700' }}>Cancel anytime</Text>
                    </View>

                    {/* Terms */}
                    <View style={{ paddingHorizontal: 16, marginTop: 10 }}>
                        <Text style={{ textAlign: 'center', color: '#6B7280', fontSize: 12 }}>
                            By continuing, you agree to our{' '}
                            <Text
                                style={{ color: colors.primary, fontWeight: '800', textDecorationLine: 'underline' }}
                                onPress={() => Linking.openURL('https://yourapp.com/terms')}
                            >
                                terms of use
                            </Text>{' '}
                            &{' '}
                            <Text
                                style={{ color: colors.primary, fontWeight: '800', textDecorationLine: 'underline' }}
                                onPress={() => Linking.openURL('https://yourapp.com/privacy')}
                            >
                                privacy policy
                            </Text>
                            .
                        </Text>
                    </View>
                </ScrollView>
            </BottomSheetView>
        </BottomSheetModal>
    );
});

export default PremiumBottomSheet;
