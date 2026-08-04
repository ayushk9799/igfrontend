import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    BottomSheetBackdrop,
    BottomSheetModal,
    BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import {
    ActivityIndicator,
    Alert,
    BackHandler,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';
import LottieView from 'lottie-react-native';
import Purchases from 'react-native-purchases';
import LinearGradient from 'react-native-linear-gradient';
import { useDispatch, useSelector } from 'react-redux';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getPremiumEntitlement, mapSubscriptionAccessToUser, refreshSubscription } from '../api/subscriptionApi';
import { fontFamily, fontWeight } from '../constants/fonts';
import { setCustomerInfo, setPremiumStatus } from '../store/slices/userSlice';
import { colors } from '../theme';
import { updateUser as updateUserStorage } from '../utils/authStorage';
import { translateUiTemplate, translateUiText } from '../i18n/uiTranslation';

const YEARLY_OFFERING_ID = 'yearly_offer';
const REGULAR_OFFERING_ID = 'onbording';

const CloseIcon = () => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path
            d="M18 6L6 18M6 6l12 12"
            stroke={colors.primary}
            strokeWidth={2.4}
            strokeLinecap="round"
        />
    </Svg>
);

const isYearlyPackage = pkg => {
    const searchableValue = [
        pkg?.identifier,
        pkg?.packageType,
        pkg?.product?.identifier,
        pkg?.product?.subscriptionPeriod,
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    return searchableValue.includes('annual')
        || searchableValue.includes('year')
        || searchableValue.includes('p1y');
};

const getYearlyPackage = offering => {
    if (offering?.annual) return offering.annual;

    const packages = offering?.availablePackages || [];
    return packages.find(isYearlyPackage)
        || (packages.length === 1 ? packages[0] : null);
};

const formatOfferCountdown = remainingMs => {
    const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export default function YearlyOfferBottomSheet({
    visible,
    onClose,
    onPresented,
    onPurchased,
    offerEndsAt,
    onOfferExpire,
}) {
    const dispatch = useDispatch();
    const user = useSelector(state => state.user);
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const [yearlyPackage, setYearlyPackage] = useState(null);
    const [regularYearlyPackage, setRegularYearlyPackage] = useState(null);
    const [purchasing, setPurchasing] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);
    const [countdownNow, setCountdownNow] = useState(Date.now());
    const bottomSheetRef = useRef(null);
    const hasPresentedRef = useRef(false);
    const loadingOfferingRef = useRef(false);
    const presentedRef = useRef(false);

    const sheetMaxHeight = Math.min(height * 0.66, 590);
    const price = yearlyPackage?.product?.priceString || '';
    const regularPrice = regularYearlyPackage?.product?.priceString || '';
    const discountPercentage = useMemo(() => {
        const offerAmount = Number(yearlyPackage?.product?.price);
        const regularAmount = Number(regularYearlyPackage?.product?.price);
        const offerCurrency = yearlyPackage?.product?.currencyCode;
        const regularCurrency = regularYearlyPackage?.product?.currencyCode;

        if (
            !Number.isFinite(offerAmount)
            || !Number.isFinite(regularAmount)
            || regularAmount <= 0
            || offerAmount >= regularAmount
            || (offerCurrency && regularCurrency && offerCurrency !== regularCurrency)
        ) {
            return null;
        }

        return Math.round(((regularAmount - offerAmount) / regularAmount) * 100);
    }, [regularYearlyPackage, yearlyPackage]);
    const discountLabel = discountPercentage
        ? translateUiTemplate("Save {{0}}%", [discountPercentage])
        : translateUiText("Yearly offer");
    const offerReady = visible && !!yearlyPackage && !loadFailed;
    const remainingOfferMs = offerEndsAt
        ? Math.max(0, offerEndsAt - countdownNow)
        : 0;

    useEffect(() => {
        if (!visible || yearlyPackage || loadingOfferingRef.current || loadFailed) return;

        let cancelled = false;
        const loadOffering = async () => {
            loadingOfferingRef.current = true;
            try {
                const offerings = await Purchases.getOfferings();
                const offer = offerings?.all?.[YEARLY_OFFERING_ID] || null;
                const regularOffering = offerings?.all?.[REGULAR_OFFERING_ID] || null;
                const pkg = getYearlyPackage(offer);
                const regularPkg = getYearlyPackage(regularOffering);

                if (!cancelled) {
                    if (offer && pkg) {
                        setYearlyPackage(pkg);
                        setRegularYearlyPackage(regularPkg);
                        if (!regularPkg) {
                            console.warn(`RevenueCat offering "${REGULAR_OFFERING_ID}" has no yearly package for discount comparison.`);
                        }
                    } else {
                        console.warn(`RevenueCat offering "${YEARLY_OFFERING_ID}" has no yearly package.`);
                        setLoadFailed(true);
                    }
                }
            } catch (error) {
                if (!cancelled) {
                    console.error(`Unable to load RevenueCat offering "${YEARLY_OFFERING_ID}":`, error);
                    setLoadFailed(true);
                }
            } finally {
                loadingOfferingRef.current = false;
            }
        };

        loadOffering();
        return () => {
            cancelled = true;
        };
    }, [loadFailed, visible, yearlyPackage]);

    useEffect(() => {
        if (!visible) {
            presentedRef.current = false;
            if (hasPresentedRef.current) {
                bottomSheetRef.current?.dismiss();
            }
            return;
        }

        const animationFrame = requestAnimationFrame(() => {
            hasPresentedRef.current = true;
            bottomSheetRef.current?.present();
        });
        return () => cancelAnimationFrame(animationFrame);
    }, [visible]);

    useEffect(() => {
        if (offerReady && !presentedRef.current) {
            presentedRef.current = true;
            onPresented?.();
        }
    }, [offerReady, onPresented]);

    useEffect(() => {
        if (!visible || !offerEndsAt) return undefined;

        const updateCountdown = () => {
            const now = Date.now();
            setCountdownNow(now);
            if (now >= offerEndsAt) {
                onOfferExpire?.();
            }
        };

        updateCountdown();
        const timer = setInterval(updateCountdown, 1000);
        return () => clearInterval(timer);
    }, [offerEndsAt, onOfferExpire, visible]);

    const syncPremium = async customerInfo => {
        const userId = user?._id || user?.id;
        if (!userId) return;

        try {
            const response = await refreshSubscription(userId);
            const premiumData = mapSubscriptionAccessToUser(response);
            if (premiumData) {
                updateUserStorage(premiumData);
                dispatch(setPremiumStatus(premiumData));
            }
        } catch (error) {
            console.error('Yearly offer subscription sync failed:', error);
        }
    };

    const applyCustomerInfo = customerInfo => {
        dispatch(setCustomerInfo(customerInfo));
        const entitlement = getPremiumEntitlement(customerInfo);
        if (!entitlement) return false;

        const premiumData = {
            isPremium: true,
            premiumExpiresAt: entitlement.expirationDate || null,
            premiumPlan: entitlement.productIdentifier || yearlyPackage?.product?.identifier || 'annual',
            premiumWillRenew: entitlement.willRenew ?? null,
            premiumCancelledAt: entitlement.unsubscribeDetectedAt || null,
            premiumSource: 'self',
        };
        updateUserStorage(premiumData);
        dispatch(setPremiumStatus(premiumData));
        return true;
    };

    const handlePurchase = async () => {
        if (!yearlyPackage || purchasing) return;

        setPurchasing(true);
        try {
            const { customerInfo } = await Purchases.purchasePackage(yearlyPackage);
            const unlocked = applyCustomerInfo(customerInfo);
            syncPremium(customerInfo);

            if (unlocked) {
                onPurchased?.();
            }
        } catch (error) {
            if (!error?.userCancelled) {
                console.error('Yearly offer purchase failed:', error);
                Alert.alert(
                    translateUiText("Purchase unavailable"),
                    translateUiText(error?.message || "Please try again in a moment."),
                );
            }
        } finally {
            setPurchasing(false);
        }
    };

    const accessibilityPriceLabel = useMemo(
        () => price ? `${price} per year` : 'Yearly price unavailable',
        [price],
    );

    const retryOffering = () => {
        setLoadFailed(false);
        setYearlyPackage(null);
        setRegularYearlyPackage(null);
    };

    const closeSheet = () => {
        if (hasPresentedRef.current) {
            bottomSheetRef.current?.dismiss();
        }
    };

    useEffect(() => {
        if (!visible) return undefined;

        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            closeSheet();
            return true;
        });
        return () => subscription.remove();
    }, [visible]);

    const renderBackdrop = backdropProps => (
        <BottomSheetBackdrop
            {...backdropProps}
            appearsOnIndex={0}
            disappearsOnIndex={-1}
            opacity={0.48}
            pressBehavior="close"
            accessibilityLabel={translateUiText("Close yearly offer")}
        />
    );

    return (
        <BottomSheetModal
            ref={bottomSheetRef}
            enableDynamicSizing
            enablePanDownToClose
            maxDynamicContentSize={sheetMaxHeight}
            backdropComponent={renderBackdrop}
            backgroundStyle={styles.sheetBackground}
            handleComponent={null}
            onDismiss={() => {
                hasPresentedRef.current = false;
                if (visible) onClose?.();
            }}
        >
            <LinearGradient
                pointerEvents="none"
                colors={['#F1F7FF', '#FFFFFF', '#FFF7FA']}
                locations={[0, 0.55, 1]}
                style={styles.sheetGradient}
            />
            <View style={styles.handle} />
            {discountPercentage && regularPrice ? (
                <View style={[styles.discountBadge, styles.topDiscountBadge]}>
                    <Text style={styles.discountText} numberOfLines={1}>
                        {discountLabel}
                    </Text>
                </View>
            ) : null}
            <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={translateUiText("Close yearly offer")}
                activeOpacity={0.8}
                onPress={closeSheet}
                style={styles.closeButton}
            >
                <CloseIcon />
            </TouchableOpacity>

            <BottomSheetScrollView
                bounces={false}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                    styles.content,
                    { paddingBottom: Math.max(insets.bottom, 14) + 16 },
                ]}
            >
                        <View style={styles.animationWrap}>
                            <View style={styles.blueGlow} />
                            <LottieView
                                source={require('../../assets/box-offer.lottie')}
                                autoPlay
                                loop
                                resizeMode="contain"
                                style={styles.lottie}
                            />
                            <View style={[styles.sparkle, styles.sparkleLeft]} />
                            <View style={[styles.sparkle, styles.sparkleRight]} />
                        </View>

                        <View style={styles.giftPill}>
                            <Text style={styles.giftPillText}>{translateUiText("A GIFT FOR YOU TWO")}</Text>
                        </View>

                        <Text style={styles.title}>{translateUiText("Yearly Premium Offer")}</Text>

                        {loadFailed ? (
                            <View style={styles.offerStatusCard}>
                                <Text style={styles.offerStatusTitle}>{translateUiText("Offer unavailable")}</Text>
                                <Text style={styles.offerStatusText}>{translateUiText("Check that RevenueCat has an offering named yearly_offer with a yearly package.")}</Text>
                                <TouchableOpacity
                                    accessibilityRole="button"
                                    activeOpacity={0.8}
                                    onPress={retryOffering}
                                    style={styles.retryButton}
                                >
                                    <Text style={styles.retryButtonText}>{translateUiText("Try again")}</Text>
                                </TouchableOpacity>
                            </View>
                        ) : yearlyPackage ? (
                            <View
                                accessible
                                accessibilityLabel={translateUiTemplate("Yearly offer, {{0}}, {{1}}", [accessibilityPriceLabel, discountLabel])}
                                style={styles.pricingSection}
                            >
                                <View style={styles.priceRow}>
                                    {discountPercentage && regularPrice ? (
                                        <Text
                                            adjustsFontSizeToFit
                                            minimumFontScale={0.82}
                                            numberOfLines={1}
                                            style={styles.regularPrice}
                                        >
                                            {regularPrice}
                                        </Text>
                                    ) : null}
                                    <Text
                                        adjustsFontSizeToFit
                                        minimumFontScale={0.82}
                                        numberOfLines={1}
                                        style={styles.price}
                                    >
                                        {price}
                                    </Text>
                                    <Text numberOfLines={1} style={styles.pricePeriod}>{translateUiText("/ year")}</Text>
                                </View>
                            </View>
                        ) : (
                            <View style={styles.offerStatusCard}>
                                <ActivityIndicator size="small" color={colors.primary} />
                                <Text style={styles.loadingOfferText}>{translateUiText("Loading your yearly offer…")}</Text>
                            </View>
                        )}

                        <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={translateUiTemplate("Claim yearly offer for {{0}}", [accessibilityPriceLabel])}
                            activeOpacity={0.88}
                            disabled={purchasing || !yearlyPackage || loadFailed}
                            onPress={handlePurchase}
                            style={[
                                styles.cta,
                                (purchasing || !yearlyPackage || loadFailed) && styles.disabled,
                            ]}
                        >
                            {purchasing ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.ctaText}>{yearlyPackage ? translateUiText("Get offer") : translateUiText("Loading…")}</Text>
                            )}
                        </TouchableOpacity>

                        {offerEndsAt && remainingOfferMs > 0 ? (
                            <View style={styles.countdownRow}>
                                <Text style={styles.countdownLabel}>{translateUiText("Offer ends in")}</Text>
                                <Text style={styles.countdownValue}>
                                    {formatOfferCountdown(remainingOfferMs)}
                                </Text>
                            </View>
                        ) : null}
            </BottomSheetScrollView>
        </BottomSheetModal>
    );
}

const styles = StyleSheet.create({
    sheetGradient: {
        ...StyleSheet.absoluteFillObject,
        overflow: 'hidden',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
    },
    sheetBackground: {
        overflow: 'hidden',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        backgroundColor: '#F8FBFF',
        shadowColor: '#2E1E3C',
        shadowOffset: { width: 0, height: -5 },
        shadowOpacity: 0.14,
        shadowRadius: 18,
        elevation: 0,
    },
    handle: {
        alignSelf: 'center',
        width: 48,
        height: 5,
        marginTop: 12,
        borderRadius: 3,
        backgroundColor: '#DED9DC',
    },
    closeButton: {
        position: 'absolute',
        top: 18,
        right: 18,
        zIndex: 2,
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 22,
        backgroundColor: '#FFF0F4',
    },
    content: {
        alignItems: 'center',
        paddingTop: 12,
        paddingHorizontal: 22,
        paddingBottom: 16,
    },
    animationWrap: {
        width: 210,
        height: 172,
        alignItems: 'center',
        justifyContent: 'center',
    },
    blueGlow: {
        position: 'absolute',
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: '#FFEBF2',
        shadowColor: '#FF758F',
        shadowOpacity: 0.22,
        shadowRadius: 18,
        elevation: 0,
    },
    lottie: {
        width: 210,
        height: 210,
    },
    sparkle: {
        position: 'absolute',
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: '#4A9CF0',
    },
    sparkleLeft: {
        left: 2,
        top: 42,
    },
    sparkleRight: {
        right: 3,
        bottom: 30,
        backgroundColor: colors.primary,
    },
    giftPill: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 15,
        backgroundColor: '#E9F3FF',
    },
    giftPillText: {
        color: '#2187DF',
        fontFamily: fontFamily.bold,
        fontSize: 10,
        letterSpacing: 1,
        ...fontWeight('700'),
    },
    title: {
        marginTop: 8,
        color: '#25162E',
        fontFamily: fontFamily.extraBold,
        fontSize: 21,
        lineHeight: 26,
        textAlign: 'center',
        ...fontWeight('800'),
    },
    pricingSection: {
        width: '100%',
        marginTop: 15,
        alignItems: 'center',
    },
    offerStatusCard: {
        width: '100%',
        minHeight: 76,
        marginTop: 15,
        paddingHorizontal: 18,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#F1DDE4',
        borderRadius: 18,
        backgroundColor: '#FFFFFF',
    },
    loadingOfferText: {
        marginTop: 9,
        color: '#756C7D',
        fontFamily: fontFamily.medium,
        fontSize: 14,
        ...fontWeight('500'),
    },
    offerStatusTitle: {
        color: '#25162E',
        fontFamily: fontFamily.bold,
        fontSize: 16,
        ...fontWeight('700'),
    },
    offerStatusText: {
        marginTop: 4,
        color: '#756C7D',
        fontFamily: fontFamily.regular,
        fontSize: 13,
        lineHeight: 18,
        textAlign: 'center',
    },
    retryButton: {
        minHeight: 36,
        marginTop: 9,
        paddingHorizontal: 18,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 18,
        backgroundColor: '#E9F3FF',
    },
    retryButtonText: {
        color: '#2187DF',
        fontFamily: fontFamily.bold,
        fontSize: 13,
        ...fontWeight('700'),
    },
    priceRow: {
        width: '100%',
        flexDirection: 'row',
        flexWrap: 'nowrap',
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    price: {
        flexShrink: 1,
        color: '#25162E',
        fontFamily: fontFamily.extraBold,
        fontSize: 30,
        lineHeight: 34,
        ...fontWeight('800'),
    },
    pricePeriod: {
        flexShrink: 0,
        marginLeft: 5,
        marginBottom: 6,
        color: '#756C7D',
        fontFamily: fontFamily.medium,
        fontSize: 13,
        ...fontWeight('500'),
    },
    regularPrice: {
        flexShrink: 1,
        maxWidth: '36%',
        marginRight: 12,
        marginBottom: 4,
        color: '#665A69',
        fontFamily: fontFamily.bold,
        fontSize: 15,
        lineHeight: 19,
        textDecorationLine: 'line-through',
        textDecorationColor: '#665A69',
        textDecorationStyle: 'solid',
        ...fontWeight('700'),
    },
    discountBadge: {
        maxWidth: 120,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#B9D9FA',
    },
    topDiscountBadge: {
        position: 'absolute',
        top: 19,
        left: 18,
        zIndex: 2,
    },
    discountText: {
        color: '#2187DF',
        fontFamily: fontFamily.bold,
        fontSize: 10,
        ...fontWeight('700'),
    },
    cta: {
        width: '100%',
        minHeight: 50,
        marginTop: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 17,
        backgroundColor: colors.primary,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 7 },
        shadowOpacity: 0.22,
        shadowRadius: 12,
        elevation: 0,
    },
    disabled: {
        opacity: 0.65,
    },
    ctaText: {
        color: '#FFFFFF',
        fontFamily: fontFamily.bold,
        fontSize: 16,
        ...fontWeight('700'),
    },
    countdownRow: {
        minHeight: 34,
        marginTop: 8,
        paddingHorizontal: 13,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 17,
        backgroundColor: '#EEF6FF',
    },
    countdownLabel: {
        marginRight: 7,
        color: '#6C6571',
        fontFamily: fontFamily.medium,
        fontSize: 12,
        ...fontWeight('500'),
    },
    countdownValue: {
        color: '#2F83D4',
        fontFamily: fontFamily.bold,
        fontSize: 13,
        letterSpacing: 0.4,
        ...fontWeight('700'),
    },
});
