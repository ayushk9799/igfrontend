// Updated Navigator with premium theme and auth persistence
import React, { useState, useEffect, startTransition, useCallback, useMemo, useRef } from 'react';
import { Animated, Easing, View, Text, TouchableOpacity, StyleSheet, Alert, Platform, BackHandler, Modal, AppState, NativeModules, Linking } from 'react-native';
import SpInAppUpdates, { IAUUpdateKind, IAUInstallStatus } from 'sp-react-native-in-app-updates';
import BootSplash from 'react-native-bootsplash';
import DeviceInfo from 'react-native-device-info';
import { BlurView } from 'expo-blur';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import LoginScreen from '../screens/LoginScreen';
import NicknameScreen from '../screens/NicknameScreen';
import RelationshipStartDateScreen from '../screens/RelationshipStartDateScreen';
import PartnerCodeScreen from '../screens/PartnerCodeScreen';
import HomeScreen from '../screens/HomeScreen';
import MoodScreen from '../screens/MoodScreen';
import ScribbleScreen from '../screens/ScribbleScreen';
import QuestionsScreen from '../screens/QuestionsScreen';
import LikelyToQuestionScreen from '../screens/LikelyToQuestionScreen';
import NeverHaveIEverScreen from '../screens/NeverHaveIEverScreen';
import TopicQuestionsV2Screen from '../screens/TopicQuestionsV2Screen';
import ChatScreen from '../screens/ChatScreen';
import LiveChatScreen from '../screens/LiveChatScreen';
import AnimatedSplashScreen from '../screens/AnimatedSplashScreen';
import AnimatedOnboardingScreen from '../screens/AnimatedOnboardingScreen';
import OnboardingFeaturesScreen from '../screens/OnboardingFeaturesScreen';
import JournalOnboardingScreen from '../screens/JournalOnboardingScreen';
import QuestionsOnboardingScreen from '../screens/QuestionsOnboardingScreen';
import LiveCallOnboardingScreen from '../screens/LiveCallOnboardingScreen';
import LiveChatOnboardingScreen from '../screens/LiveChatOnboardingScreen';
import WidgetOnboardingScreen from '../screens/WidgetOnboardingScreen';
import NotificationPermissionScreen from '../screens/NotificationPermissionScreen';

import { TOPIC_CATEGORIES } from '../constants/Categories';

import JigsawCreateScreen from '../screens/JigsawCreateScreen';
import JigsawPuzzleScreen from '../screens/JigsawPuzzleScreen';
import TicTacToeScreen from '../screens/TicTacToeScreen';
import WordleScreen from '../screens/WordleScreen';
import AvatarSelectionScreen from '../screens/AvatarSelectionScreen';
import OnboardingPremiumScreen from '../screens/OnboardingPremiumScreen';
import FreeScreen from '../screens/FreeScreen';
import PartnerPremiumPurchaseModal from '../components/PartnerPremiumPurchaseModal';
import PartnerConnectedModal from '../components/PartnerConnectedModal';
import PremiumLimitBottomSheet from '../components/PremiumLimitBottomSheet';
import MainTabNavigator from './MainTabNavigator';
import { colors } from '../theme';
import { getEmojiById, getEmojiByLabel, emojis } from '../constants/Moods';
import { clearLiveChatActive, getAuthToken, getUser, saveUser, setAuthToken, updateUser as updateUserStorage, isAuthenticated, isOnboarded as isOnboardedStorage, setOnboarded as setOnboardedStorage, clearAuth, getPartnerCode, hasSeenOnboarding, setSeenOnboarding, hasSeenOnboardingPremium, setSeenOnboardingPremium, shouldResumeLiveChat } from '../utils/authStorage';
import { useSocketContext } from '../context/SocketContext';
import { getApp } from '@react-native-firebase/app';
import { registerFCMToken, setupForegroundMessageHandler, onNotificationOpenedApp, getInitialNotification, getMessaging, setupTokenRefreshListener, checkNotificationPermission } from '../utils/pushNotifications';
import { cancelPartnerInviteReminders, clearPendingLocalNotificationRoute, getInitialLocalNotification, getPendingLocalNotificationRoute, onLocalNotificationPress, schedulePartnerInviteReminders, showLocalNotification } from '../utils/localNotifications';
import { API_BASE } from '../constants/Api';
import { QuestionChatsV2Api } from '../api/questionsV2Api';
import { apiFetch, setAuthErrorHandler } from '../utils/apiFetch';
import { getDeviceInfo } from '../utils/deviceInfo';
import { disableDistanceLocationSharing, getDistanceLocationPermissionStatus, refreshDistanceWidgetSnapshot, saveLockedDistanceWidgetData, syncDistanceWidgetLocation } from '../utils/distanceWidgetSync';
import { configureNativeWidgetTracking, syncNativeWidgetStatus } from '../api/widgetStatusApi';
import { getPremiumEntitlement, getSubscriptionStatus, mapSubscriptionAccessToUser, refreshSubscription } from '../api/subscriptionApi';
import { requestReviewForMoment, REVIEW_MOMENTS } from '../utils/inAppReview';
import { updateOnboardingProfile, updateOnboardingStep } from '../api/onboardingApi';
import { getRequiredOnboardingScreen, needsRelationshipStartDate } from '../utils/onboardingFlow';
import useReducedMotion from '../hooks/useReducedMotion';
// Redux actions
import { setUser, updateUser, setPartner, setOnboarded, setCustomerInfo, setPremiumStatus, logout } from '../store/slices/userSlice';
import { clearGames, setPendingPuzzles, setPendingPuzzle, setPendingTicTacToe, setActiveTicTacToe, setPendingWordle, setActiveWordle, setSelectedPuzzle, setSelectedTicTacToe, setSelectedWordle } from '../store/slices/gamesSlice';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { getContentLanguage, translateUiTemplate, translateUiText } from '../i18n/uiTranslation';
import { prefetchPuzzleTexture } from '../utils/puzzleTextureCache';

const UPDATE_CHECK_TIMEOUT_MS = 8000;
const INTRO_ONBOARDING_SCREENS = [
    'onboarding',
    'onboardingFeatures',
    'journalOnboarding',
    'questionsOnboarding',
    'liveCallOnboarding',
    'liveChatOnboarding',
    'widgetOnboarding',
];

const fetchWithTimeout = async (url, options = {}, timeoutMs = UPDATE_CHECK_TIMEOUT_MS) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timeoutId);
    }
};

const isPremiumDateActive = (date) => {
    if (!date) return false;
    const expiresAt = new Date(date).getTime();
    return !Number.isNaN(expiresAt) && expiresAt > Date.now();
};

const hasActiveCouplePremium = (user) => (
    user?.isPremium === true
    || user?.partnerIsPremium === true
    || isPremiumDateActive(user?.premiumExpiresAt)
    || isPremiumDateActive(user?.partnerPremiumExpiresAt)
);

const hasActiveOwnPremium = (user) => {
    const userId = user?.id || user?._id;
    const canonicalOwnerMatches = user?.premiumOwnerUserId
        && String(user.premiumOwnerUserId) === String(userId);
    const canonicalStatusActive = ['active', 'cancelled', 'billing_issue', 'paused']
        .includes(user?.subscriptionStatus);

    return isPremiumDateActive(user?.premiumExpiresAt)
        || (user?.premiumSource === 'self' && user?.isPremium === true)
        || (canonicalOwnerMatches && canonicalStatusActive);
};

const getMoodUpdateMetadata = () => {
    let timezone = null;

    try {
        timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (error) {
        timezone = null;
    }

    return {
        timezone,
        timezoneOffsetMinutes: new Date().getTimezoneOffset(),
    };
};

const saveTogetherWidgetStartDate = async (relationshipStartDate) => {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;

    const { ScribbleWidgetBridge } = NativeModules;
    if (!ScribbleWidgetBridge) {
        console.warn('Time Together widget bridge is not available. Rebuild the iOS app.');
        return;
    }

    if (!relationshipStartDate) {
        if (!ScribbleWidgetBridge.clearTogetherStartDate) {
            console.warn('Time Together widget clear method is missing. Rebuild the iOS app.');
            return;
        }
        await ScribbleWidgetBridge.clearTogetherStartDate();
        return;
    }

    const startDate = new Date(relationshipStartDate);
    if (Number.isNaN(startDate.getTime())) return;

    if (!ScribbleWidgetBridge.saveTogetherStartDate) {
        console.warn('Time Together widget native method is missing. Rebuild the iOS app.');
        return;
    }

    await ScribbleWidgetBridge.saveTogetherStartDate(startDate.toISOString());
};

const getTogetherWidgetStartDate = (user) => (
    user?.relationshipStartDate ||
    user?.pendingRelationshipStartDate ||
    user?.connectionDate ||
    null
);

const DISTANCE_WIDGET_SYNC_INTERVAL_MS = 5 * 60 * 1000;

export const AppNavigator = () => {
    const dispatch = useDispatch();
    const insets = useSafeAreaInsets();
    const reducedMotion = useReducedMotion();
    const onboardingProgress = useRef(
        new Animated.Value(1 / INTRO_ONBOARDING_SCREENS.length)
    ).current;

    // Redux state
    const userData = useSelector(state => state.user);
    const games = useSelector(state => state.games);
    const { pendingPuzzle, selectedPuzzle, pendingTicTacToe, activeTicTacToe, selectedTicTacToe, pendingWordle, activeWordle, selectedWordle } = games;
    const togetherWidgetStartDate = getTogetherWidgetStartDate(userData);

    // Local state (navigation & UI only)
    const [currentScreen, setCurrentScreen] = useState(null); // null = loading
    const [hasPlayedSplashAnimation, setHasPlayedSplashAnimation] = useState(false);
    const [isGamePremiumVisible, setIsGamePremiumVisible] = useState(false);
    const [gamePremiumStep, setGamePremiumStep] = useState('free');
    const gamePremiumDismissRef = useRef(null);
    const [premiumLimitFeature, setPremiumLimitFeature] = useState(null);
    const [yourMood, setYourMood] = useState(null);
    const [pendingInvite, setPendingInvite] = useState(null); // Track pending invite
    const [selectedCategory, setSelectedCategory] = useState(null); // Track selected question category
    const [selectedChat, setSelectedChat] = useState(null); // Track selected chat for ChatScreen
    const [selectedQuestionV2Chat, setSelectedQuestionV2Chat] = useState(null);
    const [homeInitialTab, setHomeInitialTab] = useState(null); // Track which tab to open in MainTabNavigator
    const [lastHomeTab, setLastHomeTab] = useState('home'); // Remember active tab before opening full-screen routes
    const [versionGate, setVersionGate] = useState({ status: 'checking', policy: null });
    const [partnerPremiumAlertVisible, setPartnerPremiumAlertVisible] = useState(false);
    const [partnerConnectedAlert, setPartnerConnectedAlert] = useState(null);
    const [shouldRestoreAccount, setShouldRestoreAccount] = useState(false);
    const [yearlyOfferRequestId, setYearlyOfferRequestId] = useState(0);
    const [partnerCodeOverlayVisible, setPartnerCodeOverlayVisible] = useState(false);
    const [partnerCodeOverlayStep, setPartnerCodeOverlayStep] = useState('partnerCode');
    const accountReturnPendingRef = useRef(false);
    const [activeJigsawPuzzle, setActiveJigsawPuzzle] = useState(null);

    useEffect(() => {
        const screenIndex = INTRO_ONBOARDING_SCREENS.indexOf(currentScreen);
        if (screenIndex < 0) return undefined;

        const animation = Animated.timing(onboardingProgress, {
            toValue: (screenIndex + 1) / INTRO_ONBOARDING_SCREENS.length,
            duration: reducedMotion ? 0 : 380,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
        });
        animation.start();
        return () => animation.stop();
    }, [currentScreen, onboardingProgress, reducedMotion]);

    // Socket context for real-time sync
    const { socket, connect, disconnect, partnerMood, partnerOnline, userMood, partnerScribble } = useSocketContext();

    const persistOnboardingStep = async (step, userId = userData?.id) => {
        if (!userId) return userData?.onboarding || null;
        const data = await updateOnboardingStep(userId, step);
        const onboarding = data.onboarding || null;
        if (onboarding) {
            updateUserStorage({ onboarding });
            dispatch(updateUser({ onboarding }));
        }
        return onboarding;
    };


    const closeGamePremium = useCallback(() => {
        const shouldQueueYearlyOffer = gamePremiumStep === 'premium';
        setIsGamePremiumVisible(false);
        setGamePremiumStep('free');
        const onDismiss = gamePremiumDismissRef.current;
        gamePremiumDismissRef.current = null;
        onDismiss?.();
        if (shouldQueueYearlyOffer) {
            setYearlyOfferRequestId(previous => previous + 1);
        }
    }, [gamePremiumStep]);

    const showPremiumLimitSheet = useCallback((feature) => {
        setPremiumLimitFeature(feature);
    }, []);

    const closePremiumLimitSheet = useCallback(() => {
        setPremiumLimitFeature(null);
    }, []);

    const handlePremiumLimitUpgrade = useCallback(() => {
        setPremiumLimitFeature(null);
        gamePremiumDismissRef.current = null;
        setGamePremiumStep('free');
        setIsGamePremiumVisible(true);
    }, []);

    useEffect(() => {
        if (!socket || !userData?.id) return;
        const handlePuzzleUpdate = () => {
            fetchPendingPuzzle(userData.id);
        };
        socket.on('puzzle:updated', handlePuzzleUpdate);
        return () => {
            socket.off('puzzle:updated', handlePuzzleUpdate);
        };
        // Fetch helper is declared later in this large navigator; socket/user
        // identity are the actual subscription lifecycle dependencies.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [socket, userData?.id]);

    useEffect(() => {
        if (
            currentScreen === 'wordle'
            || currentScreen === 'ticTacToe'
            || currentScreen === 'liveChat'
            || currentScreen === 'home'
        ) return;

        gamePremiumDismissRef.current = null;
        setPremiumLimitFeature(null);
        if (isGamePremiumVisible) {
            setIsGamePremiumVisible(false);
            setGamePremiumStep('free');
        }
    }, [currentScreen, isGamePremiumVisible]);


    // In-app update instance (debug flag mirrors __DEV__)
    const inAppUpdates = useMemo(() => new SpInAppUpdates(__DEV__), []);
    const forceUpdateAlertVisibleRef = React.useRef(false);

    const checkVersionGate = useCallback(async () => {
        if (!['ios', 'android'].includes(Platform.OS)) {
            setVersionGate({ status: 'ok', policy: null });
            return { status: 'ok', policy: null };
        }

        try {
            const currentBuild = Number.parseInt(DeviceInfo.getBuildNumber(), 10) || 0;
            const currentVersion = DeviceInfo.getVersion();
            const query = [
                ['platform', Platform.OS],
                ['currentBuild', String(currentBuild)],
                ['currentVersion', currentVersion],
            ]
                .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
                .join('&');
            const response = await fetchWithTimeout(`${API_BASE}/api/app-config/version?${query}`);
            const data = await response.json();

            if (!response.ok || !data?.success) {
                throw new Error(data?.error || 'Version config request failed');
            }

            const nextGate = data.updateRequired
                ? { status: 'required', policy: data }
                : { status: 'ok', policy: data };

            setVersionGate(nextGate);
            return nextGate;
        } catch (error) {
            console.warn('Failed to check app version policy', error?.message || error);
            const nextGate = { status: 'ok', policy: null };
            setVersionGate(nextGate);
            return nextGate;
        }
    }, []);

    const openUpdateStore = useCallback(async () => {
        const policy = versionGate.policy;
        const primaryUrl = policy?.storeUrl;
        const fallbackUrl = policy?.webStoreUrl;

        try {
            if (Platform.OS === 'android') {
                try {
                    await inAppUpdates.startUpdate({ updateType: IAUUpdateKind.IMMEDIATE });
                    return;
                } catch (error) {
                    console.warn('Immediate Android update failed, opening store instead', error?.message || error);
                }
            }

            if (primaryUrl) {
                await Linking.openURL(primaryUrl);
                return;
            }

            if (fallbackUrl) {
                await Linking.openURL(fallbackUrl);
                return;
            }

            Alert.alert(translateUiText("Store link missing"), translateUiText("Please set the store URL in the backend update config."));
        } catch (error) {
            if (fallbackUrl && fallbackUrl !== primaryUrl) {
                try {
                    await Linking.openURL(fallbackUrl);
                    return;
                } catch { }
            }
            Alert.alert(translateUiText("Could not open store"), translateUiText("Please open the app store and update Penguin Couple."));
        }
    }, [inAppUpdates, versionGate.policy]);

    const retryVersionGate = useCallback(async () => {
        await checkVersionGate();
    }, [checkVersionGate]);

    const showForceUpdateAlert = useCallback(() => {
        if (forceUpdateAlertVisibleRef.current || versionGate.status !== 'required') return;

        forceUpdateAlertVisibleRef.current = true;
        Alert.alert(
            translateUiText(versionGate.policy?.title || "Penguin Couple has a new update"),
            translateUiText(versionGate.policy?.message || "Please update it to continue."),
            [
                {
                    text: translateUiText("Update now"),
                    onPress: () => {
                        forceUpdateAlertVisibleRef.current = false;
                        openUpdateStore();
                    },
                },
                {
                    text: translateUiText("I updated, check again"),
                    onPress: () => {
                        forceUpdateAlertVisibleRef.current = false;
                        retryVersionGate();
                    },
                },
            ],
            {
                cancelable: false,
                onDismiss: () => {
                    forceUpdateAlertVisibleRef.current = false;
                },
            },
        );
    }, [openUpdateStore, retryVersionGate, versionGate.policy, versionGate.status]);

    const pendingNotificationRef = React.useRef(null); // Store notification that launched the app from quit state
    const recentLocalNotificationKeysRef = React.useRef(new Map());
    const currentScreenRef = React.useRef(currentScreen);
    const purchasesConfiguredRef = React.useRef(false);
    const hasHiddenBootSplashRef = React.useRef(false);
    const userDataRef = React.useRef(userData);
    const distanceSyncInFlightRef = React.useRef(false);
    const distanceRevocationSyncInFlightRef = React.useRef(false);
    const lastDistanceSyncAtRef = React.useRef(0);
    const partnerCompletionRouteRef = React.useRef(false);

    useEffect(() => {
        userDataRef.current = userData;
    }, [userData]);

    useEffect(() => {
        currentScreenRef.current = currentScreen;
    }, [currentScreen]);

    const auditDistanceLocationPermission = useCallback(async () => {
        if (!['ios', 'android'].includes(Platform.OS) || distanceRevocationSyncInFlightRef.current) return;

        const activeUser = {
            ...(userDataRef.current || {}),
            ...(getUser() || {}),
        };
        if (!activeUser?._id && !activeUser?.id) return;

        try {
            const permission = await getDistanceLocationPermissionStatus();
            if (!['denied', 'restricted'].includes(permission?.status)) return;

            distanceRevocationSyncInFlightRef.current = true;
            const result = await disableDistanceLocationSharing(activeUser);
            if (result?.user) {
                dispatch(updateUser(result.user));
                userDataRef.current = {
                    ...userDataRef.current,
                    ...result.user,
                    locationSharingEnabled: false,
                };
            }
        } catch (error) {
            console.warn('Distance permission revocation sync failed:', error?.message || error);
        } finally {
            distanceRevocationSyncInFlightRef.current = false;
        }
    }, [dispatch]);

    useEffect(() => {
        if (currentScreen === 'partnerCode') {
            partnerCompletionRouteRef.current = false;
        }
    }, [currentScreen]);

    useEffect(() => {
        if (!userData?.isAuthenticated && partnerCodeOverlayVisible) {
            setPartnerCodeOverlayVisible(false);
            setPartnerCodeOverlayStep('partnerCode');
        }
    }, [partnerCodeOverlayVisible, userData?.isAuthenticated]);

    const syncDistanceWidgetSilently = useCallback(async ({ force = false } = {}) => {
        if (!['ios', 'android'].includes(Platform.OS)) return;

        const storedUser = getUser();
        const activeUser = {
            ...(userDataRef.current || {}),
            ...(storedUser || {}),
        };
        const userId = activeUser?._id || activeUser?.id;

        if (!userId) return;
        if (Platform.OS === 'ios' && activeUser.locationSharingEnabled !== true) return;
        if (distanceSyncInFlightRef.current) return;

        const now = Date.now();
        if (!force && now - lastDistanceSyncAtRef.current < DISTANCE_WIDGET_SYNC_INTERVAL_MS) {
            return;
        }

        try {
            distanceSyncInFlightRef.current = true;
            const result = await syncDistanceWidgetLocation({ user: activeUser });
            lastDistanceSyncAtRef.current = Date.now();

            if (result?.user) {
                dispatch(updateUser(result.user));
            }
        } catch (error) {
            console.warn('Distance widget auto sync failed:', error?.message || error);
        } finally {
            distanceSyncInFlightRef.current = false;
        }
    }, [dispatch]);

    const syncNativeWidgetsSilently = useCallback(async () => {
        if (!['ios', 'android'].includes(Platform.OS)) return;

        const activeUser = {
            ...(userDataRef.current || {}),
            ...(getUser() || {}),
        };
        const userId = activeUser?._id || activeUser?.id;
        if (!userId) return;

        await configureNativeWidgetTracking(activeUser);
        await syncNativeWidgetStatus(activeUser);
    }, []);
    const initPurchases = React.useCallback(async () => {
        try {
            if (purchasesConfiguredRef.current) return;

            Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
            const apiKey = Platform.OS === 'ios'
                ? 'appl_XNiOeilxYHFbHHJIzrroDvhxQDA'
                : 'goog_MgqwBDTfVyuiMCQtLAKlcxcbhZG';

            await Purchases.configure({ apiKey });
            purchasesConfiguredRef.current = true;
        } catch (e) {
            purchasesConfiguredRef.current = false;
            const errorInfo = e?.message || e?.underlyingErrorMessage || String(e);
            const errorCode = e?.code;
            console.error(`❌ RevenueCat SDK configuration failed (Code: ${errorCode}):`, errorInfo);
        }
    }, []);

    const identifyPurchasesUser = React.useCallback(async (appUserId) => {
        try {
            // Ensure SDK is configured first
            await initPurchases();

            if (!appUserId) {
                if (purchasesConfiguredRef.current) {
                    try { await Purchases.logOut(); } catch { }
                }
                return;
            }

            if (purchasesConfiguredRef.current) {
                await Purchases.logIn(String(appUserId));
            }
        } catch (e) {
        }
    }, [initPurchases]);

    const syncDeviceInfo = React.useCallback(async (userId) => {
        if (!userId) return null;

        try {
            const deviceInfo = getDeviceInfo();
            const response = await apiFetch(`${API_BASE}/api/user/device-info`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    preferredLanguage: getContentLanguage(),
                    ...deviceInfo,
                }),
            });

            const data = await response.json();
            if (!response.ok || !data.success || !data.user) {
                return null;
            }

            const userUpdates = {
                timezone: data.user.timezone,
                platform: data.user.platform,
                relationshipStartDate: data.user.relationshipStartDate || null,
                pendingRelationshipStartDate: data.user.pendingRelationshipStartDate || null,
                shouldAskRelationshipStartDate: data.user.shouldAskRelationshipStartDate || false,
            };

            updateUserStorage(userUpdates);
            dispatch(updateUser(userUpdates));
            saveTogetherWidgetStartDate(getTogetherWidgetStartDate({ ...getUser(), ...userUpdates })).catch(() => { });

            return data.user;
        } catch (error) {
            return null;
        }
    }, [dispatch]);

    // Sync premium status from RevenueCat on app startup
    const syncPremiumFromRevenueCat = React.useCallback(async (userId) => {
        if (!userId) return;

        let customerInfo = null;
        try {
            await initPurchases();
            if (purchasesConfiguredRef.current) {
                customerInfo = await Purchases.getCustomerInfo();
                dispatch(setCustomerInfo(customerInfo));
            }
        } catch (e) {
            // Server state below remains available if the device SDK is offline.
        }

        try {
            let response;
            try {
                response = await refreshSubscription(userId);
            } catch (refreshError) {
                response = await getSubscriptionStatus(userId);
            }

            const premiumData = mapSubscriptionAccessToUser(response);
            if (!premiumData) return;

            const localEntitlement = getPremiumEntitlement(customerInfo);
            if (!premiumData.isPremium && localEntitlement) {
                premiumData.isPremium = true;
                premiumData.premiumSource = 'self';
                premiumData.premiumExpiresAt = localEntitlement.expirationDate || null;
                premiumData.premiumPlan = localEntitlement.productIdentifier || null;
                premiumData.premiumWillRenew = localEntitlement.willRenew ?? null;
                premiumData.premiumCancelledAt = localEntitlement.unsubscribeDetectedAt || null;
            }

            updateUserStorage(premiumData);
            dispatch(updateUser(premiumData));
            dispatch(setPremiumStatus(premiumData));

            if (!premiumData.isPremium) {
                saveLockedDistanceWidgetData(getUser() || {}).catch(() => { });
            }
        } catch (serverError) {
            // Preserve current/legacy access on all verification failures. The
            // purchaser may still receive immediate local access after checkout.
            const entitlement = getPremiumEntitlement(customerInfo);
            if (entitlement) {
                const optimistic = {
                    isPremium: true,
                    premiumExpiresAt: entitlement.expirationDate || null,
                    premiumPlan: entitlement.productIdentifier || null,
                    premiumWillRenew: entitlement.willRenew ?? null,
                    premiumCancelledAt: entitlement.unsubscribeDetectedAt || null,
                    premiumSource: 'self',
                };
                updateUserStorage(optimistic);
                dispatch(setPremiumStatus(optimistic));
            }
        }
    }, [initPurchases, dispatch]);

    useEffect(() => {
        initPurchases();
    }, [initPurchases]);

    useEffect(() => {
        if (!userData?.isAuthenticated) return;

        saveTogetherWidgetStartDate(togetherWidgetStartDate).catch((error) => {
            console.warn('Failed to update Time Together widget:', error?.message || error);
        });
    }, [
        userData?.isAuthenticated,
        togetherWidgetStartDate,
    ]);

    useEffect(() => {
        const userId = userData?.id || userData?._id;
        if (!userData?.isAuthenticated || !userId) return;

        syncNativeWidgetsSilently();
        auditDistanceLocationPermission();
        syncDistanceWidgetSilently({ force: true });

        const interval = setInterval(() => {
            if (AppState.currentState === 'active') {
                syncNativeWidgetsSilently();
                auditDistanceLocationPermission();
                syncDistanceWidgetSilently();
            }
        }, DISTANCE_WIDGET_SYNC_INTERVAL_MS);

        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active') {
                syncNativeWidgetsSilently();
                auditDistanceLocationPermission();
                syncDistanceWidgetSilently({ force: true });
            }
        });

        return () => {
            clearInterval(interval);
            subscription?.remove();
        };
    }, [
        userData?.id,
        userData?._id,
        userData?.isAuthenticated,
        auditDistanceLocationPermission,
        syncDistanceWidgetSilently,
        syncNativeWidgetsSilently,
    ]);

    useEffect(() => {
        if ((currentScreen === null && versionGate.status !== 'required') || hasHiddenBootSplashRef.current) return;

        hasHiddenBootSplashRef.current = true;
        BootSplash.hide({ fade: true }).catch(() => { });
    }, [currentScreen, versionGate.status]);

    // ── Backend-driven app version gate ──
    useEffect(() => {
        checkVersionGate();
    }, [checkVersionGate]);

    useEffect(() => {
        if (versionGate.status === 'required') {
            showForceUpdateAlert();
        }
    }, [showForceUpdateAlert, versionGate.status]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'active' && versionGate.status === 'required') {
                forceUpdateAlertVisibleRef.current = false;
                checkVersionGate();
            }
        });

        return () => subscription?.remove();
    }, [checkVersionGate, versionGate.status]);

    // ── Optional store update prompt (runs once on launch, skipped in dev) ──
    useEffect(() => {
        if (__DEV__) return;
        if (versionGate.status !== 'ok') return;

        let statusListener;
        const checkForUpdates = async () => {
            try {
                const result = await inAppUpdates.checkNeedsUpdate();
                if (!result?.shouldUpdate) return;

                if (Platform.OS === 'android') {
                    statusListener = (event) => {
                        if (event.status === IAUInstallStatus.DOWNLOADED) {
                            Alert.alert(
                                translateUiText("Update ready"),
                                translateUiText("A newer version has finished downloading. Restart to install now?"),
                                [
                                    { text: translateUiText("Later"), style: 'cancel' },
                                    { text: translateUiText("Restart"), onPress: () => inAppUpdates.installUpdate() },
                                ],
                            );
                        }
                    };
                    inAppUpdates.addStatusUpdateListener(statusListener);
                    await inAppUpdates.startUpdate({ updateType: IAUUpdateKind.IMMEDIATE });
                } else {
                    await inAppUpdates.startUpdate({
                        title: translateUiText("Update available"),
                        message: translateUiText("A new version is ready on the App Store."),
                        buttonUpgradeText: 'Update',
                        buttonCancelText: 'Later',
                    });
                }
            } catch (error) {
                console.warn('Failed to run in-app update check', error);
            }
        };

        checkForUpdates();

        return () => {
            if (statusListener) {
                inAppUpdates.removeStatusUpdateListener(statusListener);
            }
        };
    }, [inAppUpdates, versionGate.status]);

    // Identify RevenueCat user after login (using email, same as gtdfront)
    // Then sync premium status from RevenueCat
    useEffect(() => {
        if (!userData?.email) return;
        const identifyAndSync = async () => {
            await identifyPurchasesUser(userData.email);
            // After identifying, sync premium status from RevenueCat
            if (userData?.id) {
                await syncPremiumFromRevenueCat(userData.id);
            }
        };
        identifyAndSync();
    }, [userData?.email, userData?.id, identifyPurchasesUser, syncPremiumFromRevenueCat]);

    // Refresh couple premium whenever the app returns to the foreground, so a
    // partner purchase is reflected without requiring another login.
    useEffect(() => {
        const userId = userData?.id || userData?._id;
        if (!userData?.isAuthenticated || !userId) return;

        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active') {
                syncPremiumFromRevenueCat(userId);
            }
        });

        return () => subscription?.remove();
    }, [
        userData?.id,
        userData?._id,
        userData?.isAuthenticated,
        syncPremiumFromRevenueCat,
    ]);

    // Webhooks notify both members of the couple. Refresh from the backend so
    // an already-open partner app receives purchase/cancellation changes.
    useEffect(() => {
        const userId = userData?.id || userData?._id;
        if (!socket || !userId) return;

        const handleSubscriptionUpdated = async (event = {}) => {
            try {
                const response = await getSubscriptionStatus(userId);
                const premiumData = mapSubscriptionAccessToUser(response);
                if (!premiumData) return;
                updateUserStorage(premiumData);
                dispatch(updateUser(premiumData));
                dispatch(setPremiumStatus(premiumData));

                const isPartnerPurchase = event.reason === 'revenuecat_webhook'
                    && ['INITIAL_PURCHASE', 'NON_RENEWING_PURCHASE'].includes(event.eventType)
                    && event.ownerUserId
                    && String(event.ownerUserId) !== String(userId)
                    && premiumData.isPremium;

                if (isPartnerPurchase) {
                    setPartnerPremiumAlertVisible(true);
                }
            } catch (error) {
                // Keep the last known access and retry on the next foreground.
            }
        };

        socket.on('subscription:updated', handleSubscriptionUpdated);
        return () => socket.off('subscription:updated', handleSubscriptionUpdated);
    }, [socket, userData?.id, userData?._id, dispatch]);

    // Sync local yourMood state with socket userMood when it loads
    useEffect(() => {
        if (userMood) {
            setYourMood({
                id: userMood.id,
                emoji: userMood.emoji,
                label: userMood.label,
                updatedAt: userMood.updatedAt,
                timezone: userMood.timezone,
                timezoneOffsetMinutes: userMood.timezoneOffsetMinutes,
            });
        } else {
            setYourMood(null);
        }
    }, [userMood]);

    // Listen for Wordle socket events for real-time updates
    useEffect(() => {
        const userId = userData?.id || userData?._id;
        if (!socket || !userId) return;

        const handleWordleInvite = (data) => {
            fetchPendingWordle(userId);
        };

        const handleWordleUpdate = (data) => {
            fetchPendingWordle(userId);
        };

        socket.on('wordle:invite', handleWordleInvite);
        socket.on('wordle:update', handleWordleUpdate);

        return () => {
            socket.off('wordle:invite', handleWordleInvite);
            socket.off('wordle:update', handleWordleUpdate);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [socket, userData?.id, userData?._id]);

    // Listen for TicTacToe socket events for real-time updates
    useEffect(() => {
        if (!socket || !userData?.id) return;

        const handleTicTacToeUpdate = () => {
            fetchPendingTicTacToe(userData.id);
        };

        socket.on('tictactoe:invited', handleTicTacToeUpdate);
        socket.on('tictactoe:update', handleTicTacToeUpdate);
        socket.on('tictactoe:moveReceived', handleTicTacToeUpdate);
        socket.on('tictactoe:newGame', handleTicTacToeUpdate);
        socket.on('tictactoe:gameComplete', handleTicTacToeUpdate);

        return () => {
            socket.off('tictactoe:invited', handleTicTacToeUpdate);
            socket.off('tictactoe:update', handleTicTacToeUpdate);
            socket.off('tictactoe:moveReceived', handleTicTacToeUpdate);
            socket.off('tictactoe:newGame', handleTicTacToeUpdate);
            socket.off('tictactoe:gameComplete', handleTicTacToeUpdate);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [socket, userData?.id]);

    // Listen for partner:paired socket event (when someone pairs with us in real-time)
    useEffect(() => {
        if (!socket || !userData?.id) return;

        const handlePartnerPaired = async (data) => {
            try {
                // Fetch full partner status from server
                const response = await apiFetch(`${API_BASE}/api/partner/status/${userData.id}`);
                const statusData = await response.json();

                if (statusData.success && statusData.isPaired) {
                    const partnerData = {
                        partnerId: statusData.partner.id,
                        partnerUsername: statusData.partner.name,
                        partnerNickname: statusData.partner.nickname || statusData.partner.name || null,
                        partnerAvatar: statusData.partner.avatar || null,
                        connectionDate: statusData.connectionDate,
                        relationshipStartDate: statusData.relationshipStartDate,
                        pendingRelationshipStartDate: statusData.pendingRelationshipStartDate || null,
                        shouldAskRelationshipStartDate: statusData.shouldAskRelationshipStartDate || false,
                        partnerIsPremium: statusData.partner.isPremium || false,
                        partnerPremiumPlan: statusData.partner.premiumPlan || null,
                        partnerPremiumExpiresAt: statusData.partner.premiumExpiresAt || null,
                        partnerPremiumWillRenew: statusData.partner.premiumWillRenew ?? null,
                        partnerPremiumCancelledAt: statusData.partner.premiumCancelledAt || null,
                        partnerSubscriptionStatus: statusData.partner.subscriptionStatus || null,
                        partnerSubscriptionBillingIssueAt: statusData.partner.subscriptionBillingIssueAt || null,
                    };
                    const isDateActive = (d) => d && new Date(d) > new Date();
                    // Pairing must never downgrade the purchaser. Local RevenueCat
                    // access may already be active while the webhook/API sync is pending.
                    const userPremium = hasActiveOwnPremium(userData);
                    const partnerPremium = statusData.partner.isPremium === true
                        || isDateActive(statusData.partner.premiumExpiresAt);
                    const effectivePremium = userPremium || partnerPremium;
                    const premiumSource = userPremium ? (userData.premiumSource || 'self') : (partnerPremium ? 'partner' : null);
                    const shouldShowPremiumStep = !isOnboardedStorage()
                        && userData?.isOnboarded !== true
                        && !hasSeenOnboardingPremium(userData.id);

                    updateUserStorage({ ...partnerData, isPremium: effectivePremium, premiumSource });
                    dispatch(updateUser({ ...partnerData, isPremium: effectivePremium, premiumSource, isOnboarded: true }));
                    dispatch(setPartner({
                        id: statusData.partner.id,
                        name: statusData.partner.name,
                        nickname: statusData.partner.nickname || statusData.partner.name || null,
                        avatar: statusData.partner.avatar || null,
                        connectionDate: statusData.connectionDate,
                        relationshipStartDate: statusData.relationshipStartDate,
                        shouldAskRelationshipStartDate: statusData.shouldAskRelationshipStartDate || false,
                        isPremium: partnerPremium,
                        premiumPlan: statusData.partner.premiumPlan || null,
                        premiumExpiresAt: statusData.partner.premiumExpiresAt || null,
                    }));
                    cancelPartnerInviteReminders().catch(() => { });
                    setPartnerConnectedAlert({
                        name: data?.partnerName || statusData.partner.name,
                        avatar: data?.partnerAvatar || statusData.partner.avatar || null,
                    });

                    // Continue onboarding after a short delay so PartnerCodeScreen can show the connected text.
                    if (currentScreen === 'partnerCode') {
                        setTimeout(async () => {
                            if (partnerCompletionRouteRef.current) return;
                            partnerCompletionRouteRef.current = true;
                            await persistOnboardingStep('partner');

                            const nextUser = {
                                ...userData,
                                ...partnerData,
                                isPremium: effectivePremium,
                            };

                            if (effectivePremium || !shouldShowPremiumStep) {
                                if (needsRelationshipStartDate(nextUser)) {
                                    setCurrentScreen('relationshipStartDate');
                                } else {
                                    const hasPermission = await checkNotificationPermission();
                                    if (hasPermission) await persistOnboardingStep('completed');
                                    setCurrentScreen(hasPermission ? 'home' : 'notificationPermission');
                                }
                            } else {
                                await showOnboardingPremiumOnce();
                            }
                        }, 2500);
                    }
                }
            } catch (err) {
                console.error('Error handling partner:paired event:', err);
            }
        };

        socket.on('partner:paired', handlePartnerPaired);

        return () => {
            socket.off('partner:paired', handlePartnerPaired);
        };
        // userData/currentScreen refresh the handler closures, while adding
        // navigation helpers would resubscribe on every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [socket, userData, currentScreen, dispatch]);

    useEffect(() => {
        if (!socket) return;

        const handleRelationshipStartDateUpdated = (data) => {
            const relationshipStartDate = data?.relationshipStartDate;
            if (!relationshipStartDate) return;

            const updates = {
                relationshipStartDate,
                pendingRelationshipStartDate: null,
                shouldAskRelationshipStartDate: false,
            };

            updateUserStorage(updates);
            dispatch(updateUser(updates));
        };

        socket.on('couple:relationshipStartDateUpdated', handleRelationshipStartDateUpdated);

        return () => {
            socket.off('couple:relationshipStartDateUpdated', handleRelationshipStartDateUpdated);
        };
    }, [socket, dispatch]);

    // Navigate to the correct screen based on push notification data
    const handleNotificationNavigation = async (remoteMessage) => {
        const data = remoteMessage?.data;
        if (!data?.type) return;

        const storedUser = getUser();
        const currentUserId = storedUser?.id || userData?.id;

        const openHomeTab = (tab = 'home') => {
            setHomeInitialTab(tab);
            setCurrentScreen('home');
        };

        const fetchJson = async (url) => {
            const response = await apiFetch(url);
            return response.json();
        };

        try {
            if (data.route === 'dailyChallenge' || data.tab === 'dailyChallenge') {
                openHomeTab('dailyChallenge');
                return;
            }

            if (data.route === 'memories' || data.tab === 'memories') {
                openHomeTab('memories');
                return;
            }

            switch (data.type) {
                case 'chat': {
                    if (!data.chatId) return;
                    const json = await fetchJson(`${API_BASE}/api/chat/${data.chatId}`);
                    if (json.success) {
                        setSelectedChat(json.data.chat || json.data);
                        setCurrentScreen('chat');
                    }
                    break;
                }

                case 'questionChatV2': {
                    if (!data.chatId || !currentUserId) return;
                    const json = await fetchJson(`${API_BASE}/api/v2/question-chats/${data.chatId}?userId=${currentUserId}`);
                    if (json.success) {
                        setSelectedQuestionV2Chat(json.data.chat || json.data);
                        setCurrentScreen('questionChatV2');
                    }
                    break;
                }

                case 'puzzle': {
                    let puzzle = null;

                    if (data.puzzleId) {
                        const json = await fetchJson(`${API_BASE}/api/puzzle/${data.puzzleId}`);
                        puzzle = json.success ? json.data : null;
                    } else if (currentUserId) {
                        const json = await fetchJson(`${API_BASE}/api/puzzle/pending/${currentUserId}`);
                        puzzle = json.success && json.data?.length > 0 ? json.data[0] : null;
                    }

                    if (puzzle) {
                        prefetchPuzzleTexture(
                            puzzle._id || puzzle.id,
                            puzzle.imageUrl
                        );
                        dispatch(setSelectedPuzzle(puzzle));
                        setCurrentScreen('jigsawPuzzle');
                    } else {
                        openHomeTab('games');
                    }
                    break;
                }

                case 'tictactoe': {
                    let game = null;

                    if (data.gameId) {
                        const json = await fetchJson(`${API_BASE}/api/tictactoe/${data.gameId}`);
                        game = json.success ? json.data : null;
                    } else if (currentUserId) {
                        const json = await fetchJson(`${API_BASE}/api/tictactoe/active/${currentUserId}`);
                        game = json.success ? json.data : null;
                    }

                    if (game) {
                        dispatch(setSelectedTicTacToe(game));
                        setCurrentScreen('ticTacToe');
                    } else {
                        openHomeTab('games');
                    }
                    break;
                }

                case 'wordle': {
                    let game = null;

                    if (data.gameId) {
                        const userQuery = currentUserId ? `?userId=${currentUserId}` : '';
                        const json = await fetchJson(`${API_BASE}/api/wordle/${data.gameId}${userQuery}`);
                        game = json.success ? json.data : null;
                    } else if (currentUserId) {
                        const json = await fetchJson(`${API_BASE}/api/wordle/active/${currentUserId}`);
                        game = json.success ? json.data : null;
                    }

                    if (game) {
                        dispatch(setSelectedWordle(game));
                        setCurrentScreen('wordle');
                    } else {
                        openHomeTab('games');
                    }
                    break;
                }

                case 'daily_challenge':
                case 'daily_challenge_reminder':
                    openHomeTab('dailyChallenge');
                    break;

                case 'scribble':
                    openHomeTab('canvas');
                    break;

                case 'memory':
                    openHomeTab('memories');
                    break;

                case 'live_chat':
                    setCurrentScreen('liveChat');
                    break;

                case 'mood_update':
                case 'couple_photo':
                case 'partner_paired':
                case 'nudge':
                    openHomeTab('home');
                    break;

                case 'partner_invite_reminder':
                    openPartnerCode();
                    break;

                default:
                    break;
            }
        } catch (err) {
            console.error('❌ Failed to navigate from notification:', err);
        }
    };

    const getNotificationKey = useCallback((data = {}) => {
        const targetId = data.messageId
            || data.chatId
            || data.gameId
            || data.puzzleId
            || data.challengeId
            || data.memoryId
            || data.sessionId
            || '';
        return `${data.type || 'unknown'}:${targetId}`;
        // Notification listeners are intentionally installed once and route
        // through the current global handlers.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const showRoutedLocalNotification = useCallback(async ({ title, body, data }) => {
        if (AppState.currentState !== 'active' || !data?.type) return;

        const key = getNotificationKey(data);
        const now = Date.now();
        const recent = recentLocalNotificationKeysRef.current.get(key);
        if (recent && now - recent < 5000) return;

        recentLocalNotificationKeysRef.current.set(key, now);

        try {
            await showLocalNotification({ title, body, data });
        } catch (err) {
            console.warn('Failed to show local notification:', err?.message || err);
        }
    }, [getNotificationKey]);

    // Setup Notification Listeners
    useEffect(() => {
        // 1. Initial Notification (App opened from quit state)
        //    Store it in ref — we process it after auth check completes
        getInitialNotification(getMessaging(getApp())).then(remoteMessage => {
            if (remoteMessage) {
                pendingNotificationRef.current = remoteMessage;
            }
        });

        getInitialLocalNotification().then(remoteMessage => {
            if (remoteMessage) {
                pendingNotificationRef.current = remoteMessage;
            }
        });

        // 2. Notification Opened App (App opened from background state)
        //    App is already initialized, navigate immediately
        const unsubscribeOpenedApp = onNotificationOpenedApp(getMessaging(getApp()), remoteMessage => {
            handleNotificationNavigation(remoteMessage);
        });

        const unsubscribeLocalOpenedApp = onLocalNotificationPress(handleNotificationNavigation);

        // 3. Foreground Message Handler — mirror FCM as a local notification
        const unsubscribeForeground = setupForegroundMessageHandler((remoteMessage) => {
            if (remoteMessage?.data?.type === 'distance_widget_refresh') {
                refreshDistanceWidgetSnapshot().catch(() => { });
                return;
            }

            if (remoteMessage?.data?.type === 'scribble_update') return;
            if (
                remoteMessage?.data?.type === 'live_chat'
                && currentScreenRef.current === 'liveChat'
            ) return;
            if (
                remoteMessage?.data?.type === 'tictactoe'
                && currentScreenRef.current === 'ticTacToe'
            ) return;
            if (
                remoteMessage?.data?.type === 'wordle'
                && currentScreenRef.current === 'wordle'
            ) return;

            const title = remoteMessage?.notification?.title || 'New notification';
            const body = remoteMessage?.notification?.body || 'Open this update?';
            showRoutedLocalNotification({ title, body, data: remoteMessage?.data });
        });

        // 4. Token Refresh Listener - handles token rotation by Firebase
        const unsubscribeTokenRefresh = setupTokenRefreshListener();

        return () => {
            unsubscribeOpenedApp();
            unsubscribeLocalOpenedApp();
            if (unsubscribeForeground) unsubscribeForeground();
            if (unsubscribeTokenRefresh) unsubscribeTokenRefresh();
        };
        // App-state listener is intentionally installed once.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const handlePendingLocalNotificationRoute = () => {
            const pending = getPendingLocalNotificationRoute();
            if (pending) {
                clearPendingLocalNotificationRoute();
                handleNotificationNavigation(pending);
            }
        };

        handlePendingLocalNotificationRoute();

        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active') {
                handlePendingLocalNotificationRoute();
            }
        });

        return () => subscription?.remove();
        // App-state listener is intentionally installed once.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const syncPartnerInviteReminders = async () => {
            if (!userData?.id) return;

            if (userData.partnerId) {
                await cancelPartnerInviteReminders();
                return;
            }

            const hasPermission = await checkNotificationPermission();
            if (!hasPermission) return;

            await schedulePartnerInviteReminders({
                userId: userData.id,
                partnerCode: userData.partnerCode || getPartnerCode(),
            });
        };

        syncPartnerInviteReminders().catch((err) => {
            console.warn('Failed to sync partner invite reminders:', err?.message || err);
        });
    }, [currentScreen, userData?.id, userData?.partnerId, userData?.partnerCode]);

    // Show local notifications for realtime socket events while both users are online.
    useEffect(() => {
        const userId = userData?.id || userData?._id;
        if (!socket || !userId) return;

        const sameId = (a, b) => a && b && String(a) === String(b);
        const selectedChatId = selectedChat?._id;
        const partnerName = userData?.partnerUsername || 'Your partner';

        const handleChatNotification = (data = {}) => {
            if (!data.chatId) return;
            if (currentScreen === 'chat' && sameId(selectedChatId, data.chatId)) return;

            const title = data.isAnswer && data.questionText
                ? data.questionText
                : data.senderName || partnerName;
            const body = data.isAnswer
                ? translateUiTemplate("{{0}}: {{1}}", [
                    data.senderName || partnerName,
                    data.preview || translateUiText("Answered a question"),
                ])
                : data.preview || translateUiText("Sent you a message");

            showRoutedLocalNotification({
                title,
                body,
                data: {
                    type: 'chat',
                    chatId: data.chatId,
                },
            });
        };

        const handleQuestionChatV2Notification = (data = {}) => {
            if (!data.chatId) return;
            if (currentScreen === 'questionChatV2' && sameId(selectedQuestionV2Chat?._id, data.chatId)) return;

            showRoutedLocalNotification({
                title: data.questionText || translateUiText("Question chat"),
                body: translateUiTemplate("{{0}}: {{1}}", [
                    data.senderName || partnerName,
                    data.preview || translateUiText("Answered a question"),
                ]),
                data: {
                    type: 'questionChatV2',
                    chatId: data.chatId,
                },
            });
        };

        const handleLiveChatNotification = (data = {}) => {
            if (!data.sessionId || currentScreen === 'liveChat') return;

            showRoutedLocalNotification({
                title: translateUiText("Video Chat message"),
                body: data.preview || translateUiText("Sent you a Video Chat message"),
                data: {
                    type: 'live_chat',
                    sessionId: data.sessionId,
                    messageId: data.messageId || '',
                    senderId: data.senderId || '',
                },
            });
        };

        const handleScribbleReceived = (data = {}) => {
            showRoutedLocalNotification({
                title: translateUiText("New Scribble"),
                body: translateUiTemplate("{{0}} sent you a doodle", [
                    data.fromUserName || partnerName,
                ]),
                data: {
                    type: 'scribble',
                },
            });
        };

        const handleMoodChanged = (data = {}) => {
            if (data.userId && String(data.userId) === String(userId)) return;

            const moodLabel = data.mood?.label
                ? String(data.mood.label).trim().toLowerCase()
                : 'in a new mood';
            showRoutedLocalNotification({
                title: translateUiText("Mood Update"),
                body: translateUiTemplate("{{0}} is {{1}}", [
                    data.userName || partnerName,
                    translateUiText(moodLabel),
                ]),
                data: {
                    type: 'mood_update',
                },
            });
        };

        const handleTicTacToeUpdate = (data = {}) => {
            if (!data.gameId) return;
            if (currentScreenRef.current === 'ticTacToe') return;

            showRoutedLocalNotification({
                title: translateUiText("Tic Tac Toe"),
                body: data.gameComplete
                    ? translateUiText("Your game was updated")
                    : translateUiText("Your partner made a move"),
                data: {
                    type: 'tictactoe',
                    gameId: data.gameId,
                },
            });
        };

        const handleTicTacToeInvite = (data = {}) => {
            if (!data.gameId) return;
            if (currentScreenRef.current === 'ticTacToe') return;

            showRoutedLocalNotification({
                title: translateUiText("Tic Tac Toe Challenge"),
                body: translateUiTemplate("{{0}} challenged you to play", [
                    data.fromName || partnerName,
                ]),
                data: {
                    type: 'tictactoe',
                    gameId: data.gameId,
                },
            });
        };

        const handleWordleUpdate = (data = {}) => {
            if (!data.gameId) return;
            if (currentScreenRef.current === 'wordle') return;

            showRoutedLocalNotification({
                title: translateUiText("Wordle Update"),
                body: data.gameComplete
                    ? translateUiText("Your Wordle game finished")
                    : translateUiText("Your Wordle game was updated"),
                data: {
                    type: 'wordle',
                    gameId: data.gameId,
                },
            });
        };

        const handleWordleInvite = (data = {}) => {
            if (!data.gameId) return;
            if (currentScreenRef.current === 'wordle') return;

            showRoutedLocalNotification({
                title: translateUiText("Wordle Challenge"),
                body: translateUiTemplate("{{0}} set a word for you", [
                    data.creatorName || partnerName,
                ]),
                data: {
                    type: 'wordle',
                    gameId: data.gameId,
                },
            });
        };

        const handleNudgeReceived = (data = {}) => {
            showRoutedLocalNotification({
                title: translateUiText("Partner Nudge"),
                body: translateUiTemplate("{{0}} nudged you", [
                    data.fromName || partnerName,
                ]),
                data: {
                    type: 'nudge',
                },
            });
        };

        socket.on('chat:notification', handleChatNotification);
        socket.on('questionChatV2:notification', handleQuestionChatV2Notification);
        socket.on('liveChat:notification', handleLiveChatNotification);
        socket.on('scribble:received', handleScribbleReceived);
        socket.on('mood:changed', handleMoodChanged);
        socket.on('tictactoe:invited', handleTicTacToeInvite);
        socket.on('tictactoe:update', handleTicTacToeUpdate);
        socket.on('tictactoe:moveReceived', handleTicTacToeUpdate);
        socket.on('tictactoe:newGame', handleTicTacToeUpdate);
        socket.on('wordle:invite', handleWordleInvite);
        socket.on('wordle:update', handleWordleUpdate);
        socket.on('wordle:newGame', handleWordleInvite);
        socket.on('nudge:received', handleNudgeReceived);

        return () => {
            socket.off('chat:notification', handleChatNotification);
            socket.off('questionChatV2:notification', handleQuestionChatV2Notification);
            socket.off('liveChat:notification', handleLiveChatNotification);
            socket.off('scribble:received', handleScribbleReceived);
            socket.off('mood:changed', handleMoodChanged);
            socket.off('tictactoe:invited', handleTicTacToeInvite);
            socket.off('tictactoe:update', handleTicTacToeUpdate);
            socket.off('tictactoe:moveReceived', handleTicTacToeUpdate);
            socket.off('tictactoe:newGame', handleTicTacToeUpdate);
            socket.off('wordle:invite', handleWordleInvite);
            socket.off('wordle:update', handleWordleUpdate);
            socket.off('wordle:newGame', handleWordleInvite);
            socket.off('nudge:received', handleNudgeReceived);
        };
    }, [
        socket,
        userData?.id,
        userData?._id,
        userData?.partnerUsername,
        currentScreen,
        selectedChat?._id,
        selectedQuestionV2Chat?._id,
        selectedWordle?._id,
        selectedWordle?.gameId,
        showRoutedLocalNotification,
    ]);

    // Check auth state on mount
    useEffect(() => {
        const checkAuthState = async () => {
            try {
                const authenticated = isAuthenticated();
                const storedUser = getUser();


                if (authenticated && storedUser && getAuthToken()) {
                    // User is authenticated - dispatch to Redux
                    dispatch(setUser(storedUser));

                    syncDeviceInfo(storedUser.id);

                    // Connect to socket for real-time sync
                    connect();

                    // Register FCM token for push notifications
                    registerFCMToken();

                    // IMPORTANT: Fetch latest partner status from server
                    // This handles the case where another user paired with us
                    try {
                        const response = await apiFetch(`${API_BASE}/api/partner/status/${storedUser.id}`);
                        const statusData = await response.json();

                        if (statusData.success && statusData.isPaired) {
                            // Sync latest partner data from server
                            const partnerData = {
                                partnerId: statusData.partner.id,
                                partnerUsername: statusData.partner.name,
                                partnerNickname: statusData.partner.nickname || statusData.partner.name || null,
                                partnerAvatar: statusData.partner.avatar || null,
                                connectionDate: statusData.connectionDate,
                                relationshipStartDate: statusData.relationshipStartDate,
                                pendingRelationshipStartDate: statusData.pendingRelationshipStartDate || null,
                                shouldAskRelationshipStartDate: statusData.shouldAskRelationshipStartDate || false,
                                partnerIsPremium: statusData.partner.isPremium || false,
                                partnerPremiumPlan: statusData.partner.premiumPlan || null,
                                partnerPremiumExpiresAt: statusData.partner.premiumExpiresAt || null,
                                partnerPremiumWillRenew: statusData.partner.premiumWillRenew ?? null,
                                partnerPremiumCancelledAt: statusData.partner.premiumCancelledAt || null,
                                partnerSubscriptionStatus: statusData.partner.subscriptionStatus || null,
                                partnerSubscriptionBillingIssueAt: statusData.partner.subscriptionBillingIssueAt || null,
                            };
                            // Compute couple premium
                            const isDateActive = (d) => d && new Date(d) > new Date();
                            const userPremium = hasActiveOwnPremium(storedUser);
                            const partnerPremium = statusData.partner.isPremium === true
                                || isDateActive(statusData.partner.premiumExpiresAt);
                            const effectivePremium = userPremium || partnerPremium;
                            const premiumSource = userPremium ? (storedUser.premiumSource || 'self') : (partnerPremium ? 'partner' : null);
                            updateUserStorage({ ...partnerData, isPremium: effectivePremium, premiumSource });
                            dispatch(updateUser({ ...partnerData, isPremium: effectivePremium, premiumSource, isOnboarded: true }));
                            cancelPartnerInviteReminders().catch(() => { });

                            if (!storedUser.partnerId) {
                                // We were just paired by someone else!
                                setPartnerConnectedAlert({
                                    name: statusData.partner.name,
                                    avatar: statusData.partner.avatar || null,
                                });
                                setOnboardedStorage(true);
                                await persistOnboardingStep('partner', storedUser.id);
                                await persistOnboardingStep('completed', storedUser.id);
                                setCurrentScreen('home');
                                fetchPendingPuzzle(storedUser.id);
                                fetchPendingTicTacToe(storedUser.id);
                                fetchPendingWordle(storedUser.id);
                                return;
                            }
                        } else if (statusData.success && !statusData.isPaired && storedUser.partnerId) {
                            // Partner was deleted or unpaired — clear stale local data
                            const clearedData = {
                                partnerId: null,
                                partnerUsername: null,
                                partnerNickname: null,
                                partnerAvatar: null,
                                connectionDate: null,
                                relationshipStartDate: null,
                                pendingRelationshipStartDate: storedUser.pendingRelationshipStartDate || null,
                                shouldAskRelationshipStartDate: false,
                                partnerIsPremium: false,
                                partnerPremiumPlan: null,
                                partnerPremiumExpiresAt: null,
                                partnerPremiumWillRenew: null,
                                partnerPremiumCancelledAt: null,
                                partnerSubscriptionStatus: null,
                                partnerSubscriptionBillingIssueAt: null,
                            };
                            // If premium was from partner, revoke it
                            if (storedUser.premiumSource === 'partner') {
                                clearedData.isPremium = false;
                                clearedData.premiumSource = null;
                            }
                            updateUserStorage(clearedData);
                            dispatch(updateUser(clearedData));
                            setCurrentScreen('partnerCode');
                            return;
                        }
                    } catch (err) {
                        // Continue with local data if server check fails
                    }

                    const requiredScreen = getRequiredOnboardingScreen(storedUser);
                    if (requiredScreen !== 'home') {
                        setCurrentScreen(requiredScreen);
                    } else if (storedUser.partnerId) {
                        if (needsRelationshipStartDate(storedUser)) {
                            setCurrentScreen('relationshipStartDate');
                            return;
                        }

                        // Has nickname and is paired - go to home
                        dispatch(setOnboarded(true));
                        setOnboardedStorage(true);

                        // Check if a push notification launched the app from quit state
                        if (pendingNotificationRef.current) {
                            const pending = pendingNotificationRef.current;
                            pendingNotificationRef.current = null;
                            // Navigate to notification target instead of home
                            handleNotificationNavigation(pending);
                        } else if (shouldResumeLiveChat(storedUser.id || storedUser._id)) {
                            setCurrentScreen('liveChat');
                        } else {
                            setCurrentScreen('home');
                        }

                        // Fetch pending puzzles and TicTacToe games
                        fetchPendingPuzzle(storedUser.id);
                        fetchPendingTicTacToe(storedUser.id);
                        fetchPendingWordle(storedUser.id);
                    } else {
                        clearLiveChatActive();
                        dispatch(setOnboarded(true));
                        setOnboardedStorage(true);
                        setCurrentScreen('home');
                    }
                } else {
                    if (authenticated || storedUser) clearAuth();
                    setCurrentScreen(hasSeenOnboarding() ? 'login' : 'onboarding');
                }
            } catch (error) {
                console.error('Error checking auth state:', error);
                setCurrentScreen('login');
            }
        };

        checkAuthState();
        // Authentication bootstrap must not rerun when navigation callbacks
        // are recreated by subsequent state updates.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [connect, dispatch, syncDeviceInfo]);

    // Fetch pending puzzles for the user
    const fetchPendingPuzzle = async (userId) => {
        if (!userId) return;
        try {
            const response = await fetch(`${API_BASE}/api/puzzle/pending/${userId}`);
            const data = await response.json();
            if (data.success && data.data.length > 0) {
                const nextPuzzle = data.data.find((puzzle) => {
                    const partnerId = puzzle.partnerId?._id || puzzle.partnerId;
                    return partnerId && String(partnerId) === String(userId);
                }) || data.data[0];
                dispatch(setPendingPuzzles(data.data));
                dispatch(setPendingPuzzle(nextPuzzle)); // Show first pending puzzle
                prefetchPuzzleTexture(
                    nextPuzzle._id || nextPuzzle.id,
                    nextPuzzle.imageUrl
                );
            } else {
                dispatch(setPendingPuzzles([]));
                dispatch(setPendingPuzzle(null));
            }
        } catch (err) {
            dispatch(setPendingPuzzles([]));
            dispatch(setPendingPuzzle(null));
        }
    };

    // Use startTransition for non-blocking navigation
    const navigate = (screen) => {
        if (screen === 'premium') {
            setGamePremiumStep('free');
            setIsGamePremiumVisible(true);
            return;
        }

        if (currentScreen === 'liveChat' && screen !== 'liveChat') {
            clearLiveChatActive();
        }

        startTransition(() => {
            setCurrentScreen(screen);

            // Refresh pending puzzles, TicTacToe, and Wordle when navigating to home
            if (screen === 'home' && userData?.id) {
                fetchPendingPuzzle(userData.id);
                fetchPendingTicTacToe(userData.id);
                fetchPendingWordle(userData.id);
            }

            // Reset homeInitialTab after navigating away from home
            if (screen !== 'home') {
                setHomeInitialTab(null);
            }
        });
    };

    const navigateHomeTab = (tab = lastHomeTab || 'home') => {
        setHomeInitialTab(tab);
        navigate('home');
    };

    const openPartnerCode = () => {
        partnerCompletionRouteRef.current = false;
        setPartnerCodeOverlayStep('partnerCode');
        setPartnerCodeOverlayVisible(true);
    };

    const closePartnerCodeOverlay = () => {
        setPartnerCodeOverlayVisible(false);
        setPartnerCodeOverlayStep('partnerCode');
    };

    const navigateFromAccount = (screen) => {
        accountReturnPendingRef.current = true;
        navigate(screen);
    };

    const returnToAccount = () => {
        accountReturnPendingRef.current = false;
        setShouldRestoreAccount(true);
        navigate('home');
    };

    const openQuestionV2Chat = async (item = {}) => {
        let chat = item.chatId ? {
            _id: item.chatId,
            topicId: item.topicId,
            setId: item.setId,
            questionId: item.questionId,
            format: item.format,
            prompt: item.prompt,
        } : null;

        if (!chat && userData?.id && item.topicId && item.setId && item.questionId) {
            const response = await QuestionChatsV2Api.getChatByQuestion({
                userId: userData.id,
                topicId: item.topicId,
                setId: item.setId,
                questionId: item.questionId,
            });

            if (response.success) {
                chat = response.data?.chat || null;
            }

            if (!chat) {
                const chatsResponse = await QuestionChatsV2Api.getChats(userData.id);
                if (chatsResponse.success) {
                    chat = (chatsResponse.data?.chats || []).find((candidate) => (
                        String(candidate.topicId) === String(item.topicId)
                        && String(candidate.setId) === String(item.setId)
                        && String(candidate.questionId) === String(item.questionId)
                    )) || null;
                }
            }
        }

        if (!chat?._id) {
            console.warn('[questionChatV2] Could not resolve chat for summary item', {
                chatId: item.chatId,
                topicId: item.topicId,
                setId: item.setId,
                questionId: item.questionId,
            });
            return;
        }

        setSelectedQuestionV2Chat(chat);
        setHomeInitialTab(null);
        setCurrentScreen('questionChatV2');
    };

    // Fetch pending TicTacToe games for the user
    const fetchPendingTicTacToe = async (userId) => {
        if (!userId) return;
        try {
            const response = await fetch(`${API_BASE}/api/tictactoe/pending/${userId}`);
            const data = await response.json();
            if (data.success && data.data.length > 0) {
                // Store any active game (for showing "Partner's turn" when applicable)
                dispatch(setActiveTicTacToe(data.data[0]));

                // Find a game where it's my turn
                const myTurnGame = data.data.find(game => {
                    const isCreator = game.creatorId?._id === userId || game.creatorId === userId;
                    return (isCreator && game.currentTurn === 'creator') || (!isCreator && game.currentTurn === 'partner');
                });
                // Only show "Your turn" when it's actually your turn
                dispatch(setPendingTicTacToe(myTurnGame || null));
            } else {
                dispatch(setActiveTicTacToe(null));
                dispatch(setPendingTicTacToe(null));
            }
        } catch (err) {
            dispatch(setActiveTicTacToe(null));
            dispatch(setPendingTicTacToe(null));
        }
    };

    // Fetch pending Wordle games for the user
    const fetchPendingWordle = async (userId) => {
        if (!userId) return;
        try {
            const response = await fetch(`${API_BASE}/api/wordle/pending/${userId}`);
            const data = await response.json();
            if (data.success && data.data.length > 0) {
                // User is the guesser (partner) - show pending
                dispatch(setPendingWordle(data.data[0]));
                dispatch(setActiveWordle(null));
            } else {
                // Check if user has an active game as creator
                const activeResponse = await fetch(`${API_BASE}/api/wordle/active/${userId}`);
                const activeData = await activeResponse.json();
                if (activeData.success && activeData.data && activeData.isCreator) {
                    dispatch(setActiveWordle(activeData.data));
                    dispatch(setPendingWordle(null));
                } else {
                    dispatch(setActiveWordle(null));
                    dispatch(setPendingWordle(null));
                }
            }
        } catch (err) {
            dispatch(setActiveWordle(null));
            dispatch(setPendingWordle(null));
        }
    };

    // Socket events keep game demand current while connected. Reconcile all
    // three game types on login and whenever the app returns to the foreground
    // in case an event arrived while the app was suspended or disconnected.
    useEffect(() => {
        const userId = userData?.id || userData?._id;
        if (!userData?.isAuthenticated || !userId) return undefined;

        const refreshPendingGames = () => {
            Promise.allSettled([
                fetchPendingPuzzle(userId),
                fetchPendingTicTacToe(userId),
                fetchPendingWordle(userId),
            ]);
        };

        refreshPendingGames();
        const subscription = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'active') {
                refreshPendingGames();
            }
        });

        return () => subscription?.remove();
        // Fetch helpers are scoped to this navigator; identity controls when
        // reconciliation should be installed and rerun.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userData?.id, userData?._id, userData?.isAuthenticated]);

    // Handle login - save user and navigate based on pairing status
    const handleLogin = (user, token) => {
        startTransition(() => {
            setAuthToken(token);
            saveUser(user);
            dispatch(setUser(user));
            connect();
            registerFCMToken();
            syncDeviceInfo(user.id);

            const requiredScreen = getRequiredOnboardingScreen(user);
            if (requiredScreen !== 'home') {
                setCurrentScreen(requiredScreen);
            } else if (user.partnerId) {
                if (needsRelationshipStartDate(user)) {
                    setCurrentScreen('relationshipStartDate');
                    return;
                }

                dispatch(setOnboarded(true));
                setOnboardedStorage(true);
                setCurrentScreen('home');
            } else {
                dispatch(setOnboarded(true));
                setOnboardedStorage(true);
                setCurrentScreen('home');
            }
        });
    };

    // Handle nickname completion
    const handleNicknameComplete = async (nickname) => {
        try {
            const data = await updateOnboardingProfile(userData.id, { nickname });
            const updates = {
                nickname: data.user.nickname,
                onboarding: data.user.onboarding,
            };
            updateUserStorage(updates);
            dispatch(updateUser(updates));
            setCurrentScreen('avatarSelection');
        } catch (error) {
            Alert.alert(
                translateUiText('Could not save nickname'),
                translateUiText(error.message || 'Please try again.'),
            );
            throw error;
        }
    };

    // Handle relationship start date completion
    const handleRelationshipStartDateComplete = async (relationshipStartDate) => {
        if (relationshipStartDate) {
            try {
                const data = await updateOnboardingProfile(userData.id, { relationshipStartDate });
                const savedRelationshipStartDate = data?.user?.relationshipStartDate;
                if (data?.success && savedRelationshipStartDate) {
                    const pendingRelationshipStartDate = data?.user?.pendingRelationshipStartDate || null;
                    updateUserStorage({ relationshipStartDate: savedRelationshipStartDate, pendingRelationshipStartDate, shouldAskRelationshipStartDate: false });
                    dispatch(updateUser({ relationshipStartDate: savedRelationshipStartDate, pendingRelationshipStartDate, shouldAskRelationshipStartDate: false }));
                    saveTogetherWidgetStartDate(savedRelationshipStartDate).catch((error) => {
                        console.warn('Failed to save submitted relationship date to widget:', error?.message || error);
                    });
                }
            } catch (err) {
                console.error('Failed to save relationship start date to server:', err);
                Alert.alert(
                    translateUiText('Could not save relationship date'),
                    translateUiText(err.message || 'Please try again.'),
                );
                return;
            }
        }

        if (partnerCodeOverlayVisible && partnerCodeOverlayStep === 'relationshipStartDate') {
            closePartnerCodeOverlay();
            return;
        }

        if (accountReturnPendingRef.current) {
            returnToAccount();
            return;
        }

        if (userData.partnerId) {
            await persistOnboardingStep('completed');
            dispatch(setOnboarded(true));
            setOnboardedStorage(true);
            setCurrentScreen('home');
        } else {
            setCurrentScreen('partnerCode');
        }
    };

    // Handle avatar completion
    const handleAvatarComplete = async () => {
        if (accountReturnPendingRef.current) {
            returnToAccount();
            return;
        }

        try {
            const onboarding = await persistOnboardingStep('avatar');
            const hasPermission = await checkNotificationPermission();
            if (!hasPermission) {
                setCurrentScreen('notificationPermission');
                return;
            }

            const notificationOnboarding = await persistOnboardingStep('notifications');
            const nextUser = {
                ...userData,
                onboarding: notificationOnboarding || onboarding || userData.onboarding,
            };
            setCurrentScreen(getRequiredOnboardingScreen(nextUser));
        } catch (error) {
            Alert.alert(translateUiText('Could not save progress'), translateUiText('Please try again.'));
        }
    };

    const continueAfterPartnerStep = async (nextUser = userData) => {
        if (needsRelationshipStartDate(nextUser)) {
            setCurrentScreen('relationshipStartDate');
            return;
        }

        if (accountReturnPendingRef.current) {
            returnToAccount();
            return;
        }

        await persistOnboardingStep('completed');
        dispatch(setOnboarded(true));
        setOnboardedStorage(true);
        setCurrentScreen('home');
    };

    const shouldShowOnboardingPremium = () => (
        !isOnboardedStorage()
        && userData?.isOnboarded !== true
        && !userData?.onboarding?.premiumOfferShownAt
        && !hasSeenOnboardingPremium(userData?.id)
    );

    const showOnboardingPremiumOnce = async () => {
        setCurrentScreen('freeScreen');
    };

    const handleOnboardingOfferShown = async () => {
        try {
            await persistOnboardingStep('premium');
            setSeenOnboardingPremium(userData?.id, true);
        } catch (error) {
            console.warn('Failed to persist premium impression:', error?.message || error);
        }
    };


    // Handle successful pairing
    const handlePartnerPaired = async (partner) => {
        if (partnerCompletionRouteRef.current) return;

        const shouldShowPremiumStep = shouldShowOnboardingPremium();
        let resolvedPartner = partner;

        // Refresh the couple status so premium purchased by the code owner is
        // known before deciding whether the second user should see the offer.
        try {
            const response = await apiFetch(`${API_BASE}/api/partner/status/${userData.id}`);
            const statusData = await response.json();
            if (statusData?.success && statusData?.isPaired && statusData?.partner) {
                resolvedPartner = {
                    ...partner,
                    ...statusData.partner,
                    connectionDate: statusData.connectionDate,
                    relationshipStartDate: statusData.relationshipStartDate,
                    pendingRelationshipStartDate: statusData.pendingRelationshipStartDate || null,
                    shouldAskRelationshipStartDate: statusData.shouldAskRelationshipStartDate || false,
                };
            }
        } catch (error) {
            console.warn('Failed to refresh premium status after pairing:', error?.message || error);
        }

        if (partnerCompletionRouteRef.current) return;
        partnerCompletionRouteRef.current = true;
        let onboarding = userData.onboarding;
        try {
            onboarding = await persistOnboardingStep('partner');
        } catch (error) {
            // Pairing itself is already committed transactionally by the backend.
            // Keep the successful connection usable and refresh progress on login.
            console.warn('Failed to refresh paired onboarding progress:', error?.message || error);
        }

        const partnerPremiumExpiresAt = resolvedPartner.premiumExpiresAt || null;
        const partnerIsPremium = resolvedPartner.isPremium === true
            || isPremiumDateActive(partnerPremiumExpiresAt);

        // Update stored user with partner info
        const partnerData = {
            partnerId: resolvedPartner.id,
            partnerUsername: resolvedPartner.name,
            partnerNickname: resolvedPartner.nickname || resolvedPartner.name || null,
            partnerAvatar: resolvedPartner.avatar || null,
            connectionDate: resolvedPartner.connectionDate,
            relationshipStartDate: resolvedPartner.relationshipStartDate,
            pendingRelationshipStartDate: resolvedPartner.pendingRelationshipStartDate || null,
            shouldAskRelationshipStartDate: resolvedPartner.shouldAskRelationshipStartDate || false,
            partnerIsPremium,
            partnerPremiumPlan: resolvedPartner.premiumPlan || null,
            partnerPremiumExpiresAt,
            partnerPremiumWillRenew: resolvedPartner.premiumWillRenew ?? null,
            partnerPremiumCancelledAt: resolvedPartner.premiumCancelledAt || null,
            partnerSubscriptionStatus: resolvedPartner.subscriptionStatus || null,
            partnerSubscriptionBillingIssueAt: resolvedPartner.subscriptionBillingIssueAt || null,
        };
        const nextUser = { ...userData, ...partnerData, onboarding: onboarding || userData.onboarding };
        const coupleIsPremium = hasActiveCouplePremium(nextUser);

        updateUserStorage({
            ...partnerData,
            isPremium: coupleIsPremium,
            premiumSource: userData.premiumSource
                || (partnerIsPremium ? 'partner' : null),
        });
        dispatch(setPartner(resolvedPartner));
        cancelPartnerInviteReminders().catch(() => { });

        if (partnerCodeOverlayVisible) {
            if (needsRelationshipStartDate(nextUser)) {
                setPartnerCodeOverlayStep('relationshipStartDate');
            } else {
                closePartnerCodeOverlay();
            }
            return;
        }

        if (coupleIsPremium) {
            await continueAfterPartnerStep({ ...nextUser, isPremium: true });
            return;
        }

        if (shouldShowPremiumStep) {
            await showOnboardingPremiumOnce();
        } else {
            await continueAfterPartnerStep(nextUser);
        }
    };

    // Handle skip partner pairing
    const handleSkipPartner = async () => {
        if (partnerCompletionRouteRef.current) return;
        partnerCompletionRouteRef.current = true;

        const shouldShowPremiumStep = shouldShowOnboardingPremium();
        let onboarding;
        try {
            onboarding = await persistOnboardingStep('partner');
        } catch {
            partnerCompletionRouteRef.current = false;
            Alert.alert(translateUiText('Could not save progress'), translateUiText('Please try again.'));
            return;
        }
        const nextUser = { ...userData, onboarding: onboarding || userData.onboarding };

        if (shouldShowPremiumStep) {
            await showOnboardingPremiumOnce();
        } else {
            await continueAfterPartnerStep(nextUser);
        }
    };

    // Continue to the next required step after the onboarding premium offer.
    const handleOnboardingPremiumComplete = async () => {
        await continueAfterPartnerStep(userData);
    };

    // Handle notification permission completion (allow or skip)
    const handleNotificationComplete = async () => {
        try {
            const onboarding = await persistOnboardingStep('notifications');
            const nextUser = { ...userData, onboarding: onboarding || userData.onboarding };
            const requiredScreen = getRequiredOnboardingScreen(nextUser);
            if (requiredScreen === 'home') {
                await continueAfterPartnerStep(nextUser);
            } else {
                setCurrentScreen(requiredScreen);
            }
        } catch {
            Alert.alert(translateUiText('Could not save progress'), translateUiText('Please try again.'));
        }
    };

    const handleMoodSelect = (mood) => {
        const metadata = getMoodUpdateMetadata();
        const updatedAt = new Date().toISOString();

        // Update local mood state immediately
        setYourMood({
            id: mood.id,
            emoji: mood.emoji,
            label: mood.label,
            updatedAt,
            ...metadata,
        });

        // Send mood to backend via WebSocket (fire and forget - don't wait for response)
        if (socket) {
            socket.emit('mood:update', {
                id: mood.id,
                emoji: mood.emoji,
                label: mood.label,
                ...metadata,
            });
        }

        requestReviewForMoment(REVIEW_MOMENTS.MOOD_UPDATED);

        // Navigate back to home screen
        navigate('home');
    };


    // Handle explore app from waiting screen (pending invite)
    const handleExploreApp = (data) => {
        startTransition(() => {
            dispatch(updateUser(data));
            setPendingInvite({
                partnerUsername: data.partnerUsername,
                sentAt: new Date().toISOString(),
            });
            dispatch(setOnboarded(true));
            setOnboardedStorage(true);
            setCurrentScreen('home');
        });
    };



    // Handle logout - clear auth and go to login
    const handleLogout = () => {
        cancelPartnerInviteReminders().catch(() => { });
        startTransition(() => {
            disconnect(); // Explicitly disconnect socket
            clearAuth();
            dispatch(logout());
            dispatch(clearGames());
            setPendingInvite(null);
            setCurrentScreen('login');
        });
    };

    // Handle account deletion - call API, clear storage, go to login
    const handleDeleteAccount = async () => {
        try {
            const userId = userData?.id;
            if (!userId) {
                return;
            }

            const response = await apiFetch(`${API_BASE}/api/user/delete-account`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
            });

            const data = await response.json();

            if (data.success) {
                cancelPartnerInviteReminders().catch(() => { });
                // Clear all local storage and navigate to login
                startTransition(() => {
                    disconnect(); // Explicitly disconnect socket
                    clearAuth();
                    dispatch(logout());
                    dispatch(clearGames());
                    setPendingInvite(null);
                    setCurrentScreen('login');
                });
            } else {
                Alert.alert(
                    translateUiText("Error"),
                    translateUiText(data.error || "Failed to delete account"),
                );
            }
        } catch (error) {
            console.error('🗑️ [DELETE] Error deleting account:', error);
            Alert.alert(translateUiText("Error"), translateUiText("Failed to delete account. Please try again."));
        }
    };

    // Handle authentication errors globally (401/403 responses)
    const handleAuthError = useCallback((error) => {
        cancelPartnerInviteReminders().catch(() => { });
        // Directly navigate to login without showing alert
        startTransition(() => {
            disconnect(); // Explicitly disconnect socket
            clearAuth();
            dispatch(logout());
            dispatch(clearGames());
            setPendingInvite(null);
            setCurrentScreen('login');
        });
    }, [dispatch, disconnect]);

    // Set up the global auth error handler
    useEffect(() => {
        setAuthErrorHandler(handleAuthError);
        return () => setAuthErrorHandler(null);
    }, [handleAuthError]);

    // Handle Android back button/gesture - prevent app from closing on sub-screens
    useEffect(() => {
        const backAction = () => {
            if (isGamePremiumVisible) {
                closeGamePremium();
                return true;
            }

            if (accountReturnPendingRef.current && currentScreen !== 'home') {
                returnToAccount();
                return true;
            }

            if (currentScreen === 'account') {
                navigate('home');
                return true;
            }

            const homeSubScreens = [
                'mood', 'scribble', 'questions', 'jigsawCreate',
                'jigsawPuzzle', 'ticTacToe', 'wordle', 'chat', 'liveChat', 'questionChatV2',
                'dailyChallenge', 'questionCategories',
            ];

            if (currentScreen === 'chat' || currentScreen === 'liveChat') {
                if (currentScreen === 'liveChat') clearLiveChatActive();
                setHomeInitialTab('chats');
                navigate('home');
                return true;
            }

            if (currentScreen === 'questionChatV2') {
                navigate(selectedCategory?.id ? 'questions' : 'home');
                return true;
            }

            if (['jigsawCreate', 'jigsawPuzzle', 'ticTacToe', 'wordle'].includes(currentScreen)) {
                navigateHomeTab('games');
                return true;
            }

            if (homeSubScreens.includes(currentScreen)) {
                navigateHomeTab();
                return true; // Prevent default (app exit)
            }

            // On home or onboarding screens, let OS handle normally
            return false;
        };

        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [closeGamePremium, currentScreen, isGamePremiumVisible]);

    // Handle onboarding completion
    const handleOnboardingComplete = () => {
        startTransition(() => {
            setSeenOnboarding(true);
            setCurrentScreen('login');
        });
    };

    const onboardingScreenIndex = INTRO_ONBOARDING_SCREENS.indexOf(currentScreen);
    const canGoBackInOnboarding = onboardingScreenIndex > 0;
    const handleOnboardingBack = () => {
        if (canGoBackInOnboarding) {
            navigate(INTRO_ONBOARDING_SCREENS[onboardingScreenIndex - 1]);
        }
    };

    const handleSplashAnimationFinish = useCallback(() => {
        setHasPlayedSplashAnimation(true);
    }, []);

    const renderScreen = () => {
        // Loading state while checking auth
        if (currentScreen === null) {
            return (
                <View style={styles.loadingContainer} />
            );
        }

        switch (currentScreen) {
            case 'onboarding':
                return (
                    <AnimatedOnboardingScreen
                        onComplete={() => navigate('onboardingFeatures')}
                    />
                );

            case 'onboardingFeatures':
                return (
                    <OnboardingFeaturesScreen
                        onComplete={() => navigate('journalOnboarding')}
                    />
                );

            case 'journalOnboarding':
                return (
                    <JournalOnboardingScreen
                        onComplete={() => navigate('questionsOnboarding')}
                    />
                );

            case 'questionsOnboarding':
                return (
                    <QuestionsOnboardingScreen
                        onComplete={() => navigate('liveCallOnboarding')}
                    />
                );

            case 'liveCallOnboarding':
                return (
                    <LiveCallOnboardingScreen
                        onComplete={() => navigate('liveChatOnboarding')}
                    />
                );

            case 'liveChatOnboarding':
                return (
                    <LiveChatOnboardingScreen
                        onComplete={() => navigate('widgetOnboarding')}
                    />
                );

            case 'widgetOnboarding':
                return (
                    <WidgetOnboardingScreen
                        onComplete={handleOnboardingComplete}
                    />
                );

            case 'login':
                return (
                    <LoginScreen
                        onLogin={handleLogin}
                        onBack={() => navigate('onboarding')}
                        onSignUp={() => navigate('login')}
                    />
                );

            case 'nickname':
                return (
                    <NicknameScreen
                        onComplete={handleNicknameComplete}
                        onBack={() => navigate('login')}
                    />
                );

            case 'relationshipStartDate':
                return (
                    <RelationshipStartDateScreen
                        initialDate={userData?.relationshipStartDate || userData?.connectionDate}
                        onComplete={handleRelationshipStartDateComplete}
                        onBack={() => {
                            if (accountReturnPendingRef.current) {
                                returnToAccount();
                                return;
                            }

                            if (userData?.relationshipStartDate) {
                                navigate('home');
                            } else {
                                navigate('partnerCode');
                            }
                        }}
                    />
                );

            case 'avatarSelection':
                return (
                    <AvatarSelectionScreen
                        onComplete={handleAvatarComplete}
                        onBack={accountReturnPendingRef.current
                            ? returnToAccount
                            : undefined}
                    />
                );

            case 'partnerCode':
                return (
                    <PartnerCodeScreen
                        partnerCode={userData.partnerCode || getPartnerCode() || 'XXXXXX'}
                        userId={userData.id}
                        partnerId={userData.partnerId}
                        partnerUsername={userData.partnerUsername}
                        onPaired={handlePartnerPaired}
                        onSkip={handleSkipPartner}
                    />
                );

            case 'onboardingPremium':
                return (
                    <OnboardingPremiumScreen
                        onBack={handleOnboardingPremiumComplete}
                    />
                );

            case 'freeScreen':
                return (
                    <FreeScreen
                        onContinue={() => setCurrentScreen('onboardingPremium')}
                        onShown={handleOnboardingOfferShown}
                    />
                );

            case 'notificationPermission':
                return (
                    <NotificationPermissionScreen
                        onComplete={handleNotificationComplete}
                    />
                );



            case 'home':
                return (
                    <MainTabNavigator
                        yourMood={yourMood}
                        pendingInvite={pendingInvite}
                        initialTab={homeInitialTab}
                        onMoodSelect={handleMoodSelect}
                        onQuestionPress={(category) => {
                            if (!userData?.partnerId) {
                                openPartnerCode();
                                return;
                            }
                            if (category) {
                                // Handle chat navigation from ChatListScreen
                                if (category.type === 'chat' && category.chat) {
                                    setSelectedChat(category.chat);
                                    navigate('chat');
                                    return;
                                }
                                setSelectedCategory(category);
                                navigate('questions');
                            } else {
                                navigate('dailyChallenge');
                            }
                        }}
                        onLiveChatPress={() => {
                            if (!userData?.partnerId) {
                                openPartnerCode();
                                return;
                            }
                            navigate('liveChat');
                        }}
                        onRequestDrawPremium={() => showPremiumLimitSheet('drawTogether')}
                        onOpenDrawFreeScreen={handlePremiumLimitUpgrade}
                        onAvatarPress={() => navigate('avatarSelection')}
                        onFindPartner={openPartnerCode}
                        onNavigateFromAccount={navigateFromAccount}
                        onJigsawCreate={() => navigate('jigsawCreate')}
                        onJigsawPlay={(puzzleData) => {
                            setActiveJigsawPuzzle(puzzleData);
                            dispatch(setSelectedPuzzle(puzzleData));
                            navigate('jigsawPuzzle');
                        }}
                        onRefreshPuzzle={() => fetchPendingPuzzle(userData?.id)}
                        onTicTacToePress={(gameData) => {
                            dispatch(setSelectedTicTacToe(gameData));
                            navigate('ticTacToe');
                        }}
                        onWordlePress={(gameData) => {
                            dispatch(setSelectedWordle(gameData));
                            navigate('wordle');
                        }}
                        onPremiumPress={() => navigate('premium')}
                        onLogout={handleLogout}
                        onDeleteAccount={handleDeleteAccount}
                        onTabChange={setLastHomeTab}
                        canAutoOpenMoodPrompt={hasPlayedSplashAnimation}
                        openAccountOnMount={shouldRestoreAccount}
                        onAccountRestoreHandled={() => setShouldRestoreAccount(false)}
                        yearlyOfferRequestId={yearlyOfferRequestId}
                        onYearlyOfferRequestHandled={() => setYearlyOfferRequestId(0)}
                    />
                );

            case 'mood':
                return (
                    <MoodScreen
                        currentMood={getEmojiById(yourMood?.id) || getEmojiByLabel(yourMood?.label) || emojis[0]}
                        partnerMood={partnerMood ? (getEmojiById(partnerMood.id) || getEmojiByLabel(partnerMood.label)) : null}
                        partnerName={userData.partnerUsername || 'Your Love'}
                        onMoodSelect={handleMoodSelect}
                        moodUpdatedAt={yourMood?.updatedAt}
                        onBack={() => navigate('home')}
                    />
                );

            case 'scribble':
                return (
                    <ScribbleScreen
                        onSend={(paths) => {
                            navigate('home');
                        }}
                        onBack={() => navigate('home')}
                        hasPartner={!!userData?.partnerId}
                        onLinkPartner={openPartnerCode}
                        userName={userData?.nickname || userData?.name || 'You'}
                        partnerName={userData?.partnerUsername || 'Your Love'}
                        userId={userData?._id || userData?.id}
                        hasPremiumAccess={hasActiveCouplePremium(userData)}
                        onRequestPremium={() => showPremiumLimitSheet('drawTogether')}
                        onOpenFreeScreen={handlePremiumLimitUpgrade}
                        initialPaths={partnerScribble?.paths}
                        initialCanvasWidth={partnerScribble?.canvasWidth}
                        initialCanvasHeight={partnerScribble?.canvasHeight}
                    />
                );



            case 'questions':
                // Determine back destination based on source
                const backDestination = selectedCategory?.task ? 'dailyChallenge' : 'questionCategories';

                // Route likelyto questions to dedicated screen
                if (selectedCategory?.id === 'likelyto') {
                    return (
                        <LikelyToQuestionScreen
                            currentQuestion={{
                                id: selectedCategory?.task?._id || '1',
                                text: selectedCategory?.task?.taskstatement || "Who is more likely to forget an anniversary?",
                                number: 1,
                                total: 12,
                            }}
                            partnerName={userData.partnerUsername || 'Your Love'}
                            userName={userData.name || 'You'}
                            userAvatar={userData.avatar}
                            partnerAvatar={userData.partnerAvatar}
                            onSubmitAnswer={(answer) => {
                                navigate(backDestination);
                            }}
                            onBack={() => navigate(backDestination)}
                        />
                    );
                }

                // Route neverhaveiever to Never Have I Ever screen
                if (selectedCategory?.id === 'neverhaveiever') {
                    return (
                        <NeverHaveIEverScreen
                            currentQuestion={{
                                id: selectedCategory?.task?._id || '1',
                                statement: selectedCategory?.task?.taskstatement || "stalked my ex on social media",
                                number: 1,
                                total: 18,
                                spiceLevel: 'mild',
                                options: selectedCategory?.task?.options?.length > 0
                                    ? selectedCategory.task.options
                                    : ['I have', 'Never'],
                            }}
                            partnerName={userData.partnerUsername || 'Your Love'}
                            onSubmitAnswer={(answer) => {
                                navigate(backDestination);
                            }}
                            onBack={() => navigate(backDestination)}
                        />
                    );
                }

                // For V2 topic-based categories, use TopicQuestionsV2Screen
                const topicConfig = TOPIC_CATEGORIES[selectedCategory?.id];
                if (topicConfig) {
                    return (
                        <TopicQuestionsV2Screen
                            topic={selectedCategory.id}
                            topicTitle={topicConfig.title}
                            topicEmoji={topicConfig.emoji}
                            partnerName={userData.partnerUsername || 'Your Love'}
                            userName={userData.name || 'You'}
                            userAvatar={userData.avatar}
                            partnerAvatar={userData.partnerAvatar}
                            userId={userData.id}
                            partnerId={userData.partnerId}
                            hasPartner={!!userData.partnerId}
                            onLinkPartner={openPartnerCode}
                            onNavigateToPremium={() => navigate('premium')}
                            onOpenQuestionChat={(item) => {
                                openQuestionV2Chat({
                                    ...item,
                                    topicId: item.topicId || selectedCategory.id,
                                });
                            }}
                            onBack={() => navigate('home')}
                        />
                    );
                }

                // Fallback for unknown categories
                return (
                    <QuestionsScreen
                        currentQuestion={{
                            id: selectedCategory?.task?._id || '1',
                            text: selectedCategory?.task?.taskstatement || "What's something you appreciate about us?",
                            category: selectedCategory?.id || 'deep',
                        }}
                        partnerName={userData.partnerUsername || null}
                        isLocked={true}
                        onSubmitAnswer={(answer) => {
                            navigate('home');
                        }}
                        onBack={() => navigate('home')}
                    />
                );


            case 'jigsawCreate':
                return (
                    <JigsawCreateScreen
                        navigation={{ goBack: () => navigateHomeTab('games') }}
                        route={{
                            params: {
                                partnerId: userData.partnerId,
                                partnerName: userData.partnerUsername || 'Partner',
                            }
                        }}
                        onLinkPartner={openPartnerCode}
                    />
                );

            case 'jigsawPuzzle': {
                const puzzleToPass = activeJigsawPuzzle || selectedPuzzle || pendingPuzzle;
                return (
                    <JigsawPuzzleScreen
                        navigation={{
                            goBack: () => {
                                setActiveJigsawPuzzle(null);
                                navigateHomeTab('games');
                            }
                        }}
                        route={{
                            params: {
                                puzzleId: puzzleToPass?._id || puzzleToPass?.id,
                                puzzleData: puzzleToPass,
                            }
                        }}
                    />
                );
            }

            case 'ticTacToe':
                return (
                    <TicTacToeScreen
                        navigation={{ goBack: () => navigateHomeTab('games'), navigate }}
                        route={{
                            params: {
                                gameId: selectedTicTacToe?._id,
                                gameData: selectedTicTacToe,
                                partnerId: userData.partnerId,
                                partnerName: userData.partnerUsername || 'Partner',
                            }
                        }}
                        onLinkPartner={openPartnerCode}
                        hasPremiumAccess={hasActiveCouplePremium(userData)}
                        onRequestPremium={() => showPremiumLimitSheet('ticTacToe')}
                    />
                );

            case 'wordle':
                return (
                    <WordleScreen
                        navigation={{ goBack: () => navigateHomeTab('games'), navigate }}
                        route={{
                            params: {
                                gameId: selectedWordle?._id,
                                gameData: selectedWordle,
                                partnerId: userData.partnerId,
                                partnerName: userData.partnerUsername || 'Partner',
                            }
                        }}
                        onLinkPartner={openPartnerCode}
                        hasPremiumAccess={hasActiveCouplePremium(userData)}
                        onRequestPremium={() => showPremiumLimitSheet('wordle')}
                    />
                );

            case 'chat':
                return (
                    <ChatScreen
                        chatId={selectedChat?._id}
                        chat={selectedChat}
                        userId={userData?.id}
                        userName={userData?.name || 'You'}
                        partnerName={userData?.partnerUsername || 'Partner'}
                        onBack={() => {
                            setHomeInitialTab('chats');
                            navigate('home');
                        }}
                    />
                );

            case 'liveChat':
                return (
                    <LiveChatScreen
                        userId={userData?.id || userData?._id}
                        partnerId={userData?.partnerId}
                        partnerName={userData?.partnerUsername || 'Partner'}
                        partnerAvatar={userData?.partnerAvatarThumbnail || userData?.partnerAvatar}
                        hasPremiumAccess={hasActiveCouplePremium(userData)}
                        onRequestPremium={() => showPremiumLimitSheet('liveChat')}
                        onOpenFreeScreen={handlePremiumLimitUpgrade}
                        onBack={() => {
                            clearLiveChatActive();
                            setHomeInitialTab('chats');
                            navigate('home');
                        }}
                    />
                );

            case 'questionChatV2':
                if (!selectedQuestionV2Chat?._id) {
                    return null;
                }

                return (
                    <ChatScreen
                        chatId={selectedQuestionV2Chat?._id}
                        chat={selectedQuestionV2Chat}
                        chatMode="questionV2"
                        userId={userData?.id}
                        userName={userData?.name || 'You'}
                        partnerName={userData?.partnerUsername || 'Partner'}
                        onBack={() => {
                            navigate(selectedCategory?.id ? 'questions' : 'home');
                        }}
                    />
                );



            default:
                return null;
        }
    };

    return (
        <View style={styles.container}>
            {renderScreen()}
            {onboardingScreenIndex >= 2 && (
                <View
                    style={[styles.onboardingControls, { top: insets.top + 6 }]}
                    pointerEvents="box-none"
                >
                    <TouchableOpacity
                        onPress={handleOnboardingBack}
                        disabled={!canGoBackInOnboarding}
                        accessibilityRole="button"
                        accessibilityLabel={translateUiText('Back')}
                        accessibilityState={{ disabled: !canGoBackInOnboarding }}
                        style={[
                            styles.onboardingBackButton,
                            !canGoBackInOnboarding && styles.onboardingBackButtonDisabled,
                        ]}
                    >
                        <ChevronLeft color="#2E1E3C" size={22} strokeWidth={2.5} />
                    </TouchableOpacity>

                    <View
                        style={styles.onboardingProgressTrack}
                        accessibilityRole="progressbar"
                        accessibilityValue={{
                            min: 1,
                            max: INTRO_ONBOARDING_SCREENS.length,
                            now: onboardingScreenIndex + 1,
                        }}
                    >
                        <Animated.View
                            style={[
                                styles.onboardingProgressFill,
                                {
                                    width: onboardingProgress.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: ['0%', '100%'],
                                    }),
                                },
                            ]}
                        />
                    </View>

                    <TouchableOpacity
                        onPress={handleOnboardingComplete}
                        accessibilityRole="button"
                        accessibilityLabel={translateUiText('Skip introduction')}
                        style={styles.onboardingSkipButton}
                    >
                        <Text style={styles.onboardingSkipText}>{translateUiText('Skip')}</Text>
                    </TouchableOpacity>
                </View>
            )}
            {versionGate.status === 'required' && (
                <BlurView
                    intensity={28}
                    tint="light"
                    style={styles.updateBlurOverlay}
                    pointerEvents="auto"
                />
            )}
            {currentScreen !== null && versionGate.status !== 'required' && !hasPlayedSplashAnimation && (
                <AnimatedSplashScreen
                    style={styles.splashOverlay}
                    onFinish={handleSplashAnimationFinish}
                />
            )}
            <Modal
                visible={partnerCodeOverlayVisible}
                animationType="slide"
                transparent={false}
                statusBarTranslucent={true}
                presentationStyle="fullScreen"
                onRequestClose={closePartnerCodeOverlay}
            >
                {partnerCodeOverlayVisible && partnerCodeOverlayStep === 'partnerCode' && (
                    <PartnerCodeScreen
                        partnerCode={userData.partnerCode || getPartnerCode() || 'XXXXXX'}
                        userId={userData.id}
                        partnerId={userData.partnerId}
                        partnerUsername={userData.partnerUsername}
                        onPaired={handlePartnerPaired}
                        onSkip={closePartnerCodeOverlay}
                        onClose={closePartnerCodeOverlay}
                    />
                )}
                {partnerCodeOverlayVisible && partnerCodeOverlayStep === 'relationshipStartDate' && (
                    <RelationshipStartDateScreen
                        initialDate={userData?.relationshipStartDate || userData?.connectionDate}
                        onComplete={handleRelationshipStartDateComplete}
                        onBack={closePartnerCodeOverlay}
                    />
                )}
            </Modal>
            <Modal
                visible={isGamePremiumVisible}
                animationType="slide"
                transparent={false}
                statusBarTranslucent={true}
                onRequestClose={closeGamePremium}
            >
                {gamePremiumStep === 'free' ? (
                    <FreeScreen
                        onContinue={() => setGamePremiumStep('premium')}
                        onClose={closeGamePremium}
                    />
                ) : (
                    <OnboardingPremiumScreen
                        onBack={closeGamePremium}
                    />
                )}
            </Modal>
            <PremiumLimitBottomSheet
                visible={Boolean(premiumLimitFeature)}
                feature={premiumLimitFeature || 'liveChat'}
                onClose={closePremiumLimitSheet}
                onUpgrade={handlePremiumLimitUpgrade}
            />
            <PartnerPremiumPurchaseModal
                visible={partnerPremiumAlertVisible}
                partnerName={userData.partnerUsername}
                onClose={() => setPartnerPremiumAlertVisible(false)}
            />
            <PartnerConnectedModal
                visible={!!partnerConnectedAlert}
                userName={userData.nickname || userData.name}
                userAvatar={userData.avatarThumbnail || userData.avatar}
                partnerName={partnerConnectedAlert?.name}
                partnerAvatar={partnerConnectedAlert?.avatar}
                onClose={() => setPartnerConnectedAlert(null)}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    onboardingControls: {
        position: 'absolute',
        left: 16,
        right: 16,
        zIndex: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    onboardingBackButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.9)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    onboardingBackButtonDisabled: {
        opacity: 0.35,
    },
    onboardingProgressTrack: {
        flex: 1,
        height: 7,
        borderRadius: 4,
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.72)',
    },
    onboardingProgressFill: {
        height: '100%',
        borderRadius: 4,
        backgroundColor: '#F95B72',
    },
    onboardingSkipButton: {
        minWidth: 44,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    onboardingSkipText: {
        color: '#2E1E3C',
        fontSize: 14,
        fontWeight: '700',
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#F8DDF4',
    },
    updateBlurOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(147, 197, 253, 0.24)',
        zIndex: 8,
        elevation: 8,
    },
    splashOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1000,
        elevation: 1000,
    },
});

export default AppNavigator;
