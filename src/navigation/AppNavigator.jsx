// Updated Navigator with premium theme and auth persistence
import React, { useState, useEffect, startTransition, useCallback, useMemo } from 'react';
import { View, StyleSheet, Alert, Platform, BackHandler, Modal, AppState, NativeModules, Linking } from 'react-native';
import SpInAppUpdates, { IAUUpdateKind, IAUInstallStatus } from 'sp-react-native-in-app-updates';
import BootSplash from 'react-native-bootsplash';
import DeviceInfo from 'react-native-device-info';
import { BlurView } from 'expo-blur';
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
import AnimatedSplashScreen from '../screens/AnimatedSplashScreen';
import AnimatedOnboardingScreen from '../screens/AnimatedOnboardingScreen';
import OnboardingFeaturesScreen from '../screens/OnboardingFeaturesScreen';
import Onboarding3Screen from '../screens/Onboarding3Screen';
import NotificationPermissionScreen from '../screens/NotificationPermissionScreen';

import { TOPIC_CATEGORIES } from '../constants/Categories';

import JigsawCreateScreen from '../screens/JigsawCreateScreen';
import JigsawPuzzleScreen from '../screens/JigsawPuzzleScreen';
import TicTacToeScreen from '../screens/TicTacToeScreen';
import WordleScreen from '../screens/WordleScreen';
import AvatarSelectionScreen from '../screens/AvatarSelectionScreen';
import PremiumScreen from '../screens/PremiumScreen';
import MainTabNavigator from './MainTabNavigator';
import { colors } from '../theme';
import { getEmojiById, getEmojiByLabel, emojis } from '../constants/Moods';
import { getUser, saveUser, updateUser as updateUserStorage, isAuthenticated, setOnboarded as setOnboardedStorage, clearAuth, getPartnerCode, hasSeenOnboarding, setSeenOnboarding } from '../utils/authStorage';
import { useSocketContext } from '../context/SocketContext';
import { getApp } from '@react-native-firebase/app';
import { registerFCMToken, setupForegroundMessageHandler, onNotificationOpenedApp, getInitialNotification, getMessaging, setupTokenRefreshListener, checkNotificationPermission } from '../utils/pushNotifications';
import { clearPendingLocalNotificationRoute, getInitialLocalNotification, getPendingLocalNotificationRoute, onLocalNotificationPress, showLocalNotification } from '../utils/localNotifications';
import { API_BASE } from '../constants/Api';
import { QuestionChatsV2Api } from '../api/questionsV2Api';
import { setAuthErrorHandler } from '../utils/apiFetch';
import { getDeviceInfo } from '../utils/deviceInfo';
import { refreshDistanceWidgetSnapshot, saveLockedDistanceWidgetData, syncDistanceWidgetLocation } from '../utils/distanceWidgetSync';
import { configureNativeWidgetTracking, syncNativeWidgetStatus } from '../api/widgetStatusApi';
import { requestReviewForMoment, REVIEW_MOMENTS } from '../utils/inAppReview';
// Redux actions
import { setUser, updateUser, setPartner, setOnboarded, setCustomerInfo, setPremiumStatus, logout } from '../store/slices/userSlice';
import { setPendingPuzzle, setPendingTicTacToe, setActiveTicTacToe, setPendingWordle, setActiveWordle, setSelectedPuzzle, setSelectedTicTacToe, setSelectedWordle } from '../store/slices/gamesSlice';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

const UPDATE_CHECK_TIMEOUT_MS = 8000;

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

    // Redux state
    const userData = useSelector(state => state.user);
    const games = useSelector(state => state.games);
    const { pendingPuzzle, selectedPuzzle, pendingTicTacToe, activeTicTacToe, selectedTicTacToe, pendingWordle, activeWordle, selectedWordle } = games;
    const togetherWidgetStartDate = getTogetherWidgetStartDate(userData);

    // Local state (navigation & UI only)
    const [currentScreen, setCurrentScreen] = useState(null); // null = loading
    const [hasPlayedSplashAnimation, setHasPlayedSplashAnimation] = useState(false);
    const [isPremiumVisible, setIsPremiumVisible] = useState(false);
    const [yourMood, setYourMood] = useState(null);
    const [pendingInvite, setPendingInvite] = useState(null); // Track pending invite
    const [selectedCategory, setSelectedCategory] = useState(null); // Track selected question category
    const [selectedChat, setSelectedChat] = useState(null); // Track selected chat for ChatScreen
    const [selectedQuestionV2Chat, setSelectedQuestionV2Chat] = useState(null);
    const [homeInitialTab, setHomeInitialTab] = useState(null); // Track which tab to open in MainTabNavigator
    const [lastHomeTab, setLastHomeTab] = useState('home'); // Remember active tab before opening full-screen routes
    const [versionGate, setVersionGate] = useState({ status: 'checking', policy: null });

    // Socket context for real-time sync
    const { socket, connect, disconnect, partnerMood, partnerOnline, userMood, partnerScribble } = useSocketContext();

    const needsRelationshipStartDate = (user) => !!user?.partnerId
        && !user?.relationshipStartDate
        && user?.shouldAskRelationshipStartDate === true;

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

            Alert.alert('Store link missing', 'Please set the store URL in the backend update config.');
        } catch (error) {
            if (fallbackUrl && fallbackUrl !== primaryUrl) {
                try {
                    await Linking.openURL(fallbackUrl);
                    return;
                } catch { }
            }
            Alert.alert('Could not open store', 'Please open the app store and update Penguin.');
        }
    }, [inAppUpdates, versionGate.policy]);

    const retryVersionGate = useCallback(async () => {
        await checkVersionGate();
    }, [checkVersionGate]);

    const showForceUpdateAlert = useCallback(() => {
        if (forceUpdateAlertVisibleRef.current || versionGate.status !== 'required') return;

        forceUpdateAlertVisibleRef.current = true;
        Alert.alert(
            versionGate.policy?.title || 'Penguin has a new update',
            versionGate.policy?.message || 'Please update it to continue.',
            [
                {
                    text: 'Update now',
                    onPress: () => {
                        forceUpdateAlertVisibleRef.current = false;
                        openUpdateStore();
                    },
                },
                {
                    text: 'I updated, check again',
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
    const purchasesConfiguredRef = React.useRef(false);
    const hasHiddenBootSplashRef = React.useRef(false);
    const userDataRef = React.useRef(userData);
    const distanceSyncInFlightRef = React.useRef(false);
    const lastDistanceSyncAtRef = React.useRef(0);

    useEffect(() => {
        userDataRef.current = userData;
    }, [userData]);

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
            const response = await fetch(`${API_BASE}/api/user/device-info`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
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
            saveTogetherWidgetStartDate(getTogetherWidgetStartDate({ ...getUser(), ...userUpdates })).catch(() => {});

            return data.user;
        } catch (error) {
            return null;
        }
    }, [dispatch]);

    // Sync premium status from RevenueCat on app startup
    const syncPremiumFromRevenueCat = React.useCallback(async (userId) => {
        try {
            await initPurchases();
            if (!purchasesConfiguredRef.current) return;
            const customerInfo = await Purchases.getCustomerInfo();
            dispatch(setCustomerInfo(customerInfo));

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
                premiumPlan = activeList[0]?.productIdentifier || null;
            }

            if (!userId) return;

            // Update backend with the user's own RevenueCat status
            await fetch(`${API_BASE}/api/user/premium`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    isPremium: hasActive,
                    premiumExpiresAt: hasActive ? premiumExpiresAt : null,
                    premiumPlan: hasActive ? premiumPlan : null,
                }),
            });

            // Compute effective couple premium: user's own OR partner's
            const storedUser = getUser();
            const isDateActive = (d) => d && new Date(d) > new Date();
            const partnerPremium = isDateActive(storedUser?.partnerPremiumExpiresAt);
            const effectivePremium = hasActive || partnerPremium;
            const premiumSource = hasActive ? 'self' : (partnerPremium ? 'partner' : null);

            // Update local storage (preserve couple premium)
            updateUserStorage({
                isPremium: effectivePremium,
                premiumExpiresAt: hasActive ? premiumExpiresAt : null,
                premiumPlan: hasActive ? premiumPlan : null,
                premiumSource,
            });

            // Update Redux state (preserve couple premium)
            dispatch(setPremiumStatus({
                isPremium: effectivePremium,
                premiumExpiresAt: hasActive ? premiumExpiresAt : null,
                premiumPlan: hasActive ? premiumPlan : null,
                premiumSource,
            }));

            if (!effectivePremium) {
                saveLockedDistanceWidgetData(storedUser || {}).catch(() => {});
            }

        } catch (e) {
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
        syncDistanceWidgetSilently({ force: true });

        const interval = setInterval(() => {
            if (AppState.currentState === 'active') {
                syncNativeWidgetsSilently();
                syncDistanceWidgetSilently();
            }
        }, DISTANCE_WIDGET_SYNC_INTERVAL_MS);

        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active') {
                syncNativeWidgetsSilently();
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
        syncDistanceWidgetSilently,
        syncNativeWidgetsSilently,
    ]);

    useEffect(() => {
        if ((currentScreen === null && versionGate.status !== 'required') || hasHiddenBootSplashRef.current) return;

        hasHiddenBootSplashRef.current = true;
        BootSplash.hide({ fade: true }).catch(() => {});
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
                                'Update ready',
                                'A newer version has finished downloading. Restart to install now?',
                                [
                                    { text: 'Later', style: 'cancel' },
                                    { text: 'Restart', onPress: () => inAppUpdates.installUpdate() },
                                ],
                            );
                        }
                    };
                    inAppUpdates.addStatusUpdateListener(statusListener);
                    await inAppUpdates.startUpdate({ updateType: IAUUpdateKind.IMMEDIATE });
                } else {
                    await inAppUpdates.startUpdate({
                        title: 'Update available',
                        message: 'A new version is ready on the App Store.',
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
    }, [socket, userData?.id]);

    // Listen for partner:paired socket event (when someone pairs with us in real-time)
    useEffect(() => {
        if (!socket || !userData?.id) return;

        const handlePartnerPaired = async (data) => {
            try {
                // Fetch full partner status from server
                const response = await fetch(`${API_BASE}/api/partner/status/${userData.id}`);
                const statusData = await response.json();

                if (statusData.success && statusData.isPaired) {
                    const partnerData = {
                        partnerId: statusData.partner.id,
                        partnerUsername: statusData.partner.name,
                        partnerAvatar: statusData.partner.avatar || null,
                        connectionDate: statusData.connectionDate,
                        relationshipStartDate: statusData.relationshipStartDate,
                        pendingRelationshipStartDate: statusData.pendingRelationshipStartDate || null,
                        shouldAskRelationshipStartDate: statusData.shouldAskRelationshipStartDate || false,
                        partnerIsPremium: statusData.partner.isPremium || false,
                        partnerPremiumPlan: statusData.partner.premiumPlan || null,
                        partnerPremiumExpiresAt: statusData.partner.premiumExpiresAt || null,
                    };
                    const isDateActive = (d) => d && new Date(d) > new Date();
                    const userPremium = isDateActive(userData.premiumExpiresAt);
                    const partnerPremium = isDateActive(statusData.partner.premiumExpiresAt);
                    const effectivePremium = userPremium || partnerPremium;
                    const premiumSource = userPremium ? (userData.premiumSource || 'self') : (partnerPremium ? 'partner' : null);

                    updateUserStorage({ ...partnerData, isPremium: effectivePremium, premiumSource });
                    dispatch(updateUser({ ...partnerData, isPremium: effectivePremium, premiumSource, isOnboarded: true }));
                    dispatch(setPartner({
                        id: statusData.partner.id,
                        name: statusData.partner.name,
                        avatar: statusData.partner.avatar || null,
                        connectionDate: statusData.connectionDate,
                        relationshipStartDate: statusData.relationshipStartDate,
                        shouldAskRelationshipStartDate: statusData.shouldAskRelationshipStartDate || false,
                    }));
                    setOnboardedStorage(true);
                    requestReviewForMoment(REVIEW_MOMENTS.PARTNER_PAIRED);

                    // Auto-navigate to home after a short delay so PartnerCodeScreen can show the connected text
                    if (currentScreen === 'partnerCode') {
                        setTimeout(() => {
                            setCurrentScreen('home');
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
    }, [socket, userData?.id, userData?.isPremium, currentScreen, dispatch]);

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
            const response = await fetch(url);
            return response.json();
        };

        try {
            if (data.route === 'dailyChallenge' || data.tab === 'dailyChallenge') {
                openHomeTab('dailyChallenge');
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

                case 'mood_update':
                case 'partner_paired':
                case 'nudge':
                    openHomeTab('home');
                    break;

                default:
                    break;
            }
        } catch (err) {
            console.error('❌ Failed to navigate from notification:', err);
        }
    };

    const getNotificationKey = useCallback((data = {}) => {
        const targetId = data.chatId || data.gameId || data.puzzleId || data.challengeId || '';
        return `${data.type || 'unknown'}:${targetId}`;
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
                refreshDistanceWidgetSnapshot().catch(() => {});
                return;
            }

            if (remoteMessage?.data?.type === 'scribble_update') return;

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
    }, []);

    // Show local notifications for realtime socket events while both users are online.
    useEffect(() => {
        const userId = userData?.id || userData?._id;
        if (!socket || !userId) return;

        const sameId = (a, b) => a && b && String(a) === String(b);
        const selectedChatId = selectedChat?._id;
        const selectedTicTacToeId = selectedTicTacToe?._id || selectedTicTacToe?.gameId;
        const selectedWordleId = selectedWordle?._id || selectedWordle?.gameId;
        const partnerName = userData?.partnerUsername || 'Your partner';

        const handleChatNotification = (data = {}) => {
            if (!data.chatId) return;
            if (currentScreen === 'chat' && sameId(selectedChatId, data.chatId)) return;

            const title = data.isAnswer && data.questionText
                ? data.questionText
                : data.senderName || partnerName;
            const body = data.isAnswer
                ? `${data.senderName || partnerName}: ${data.preview || 'Answered a question'}`
                : data.preview || 'Sent you a message';

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
                title: data.questionText || 'Question chat',
                body: `${data.senderName || partnerName}: ${data.preview || 'Answered a question'}`,
                data: {
                    type: 'questionChatV2',
                    chatId: data.chatId,
                },
            });
        };

        const handleScribbleReceived = (data = {}) => {
            showRoutedLocalNotification({
                title: 'New Scribble',
                body: `${data.fromUserName || partnerName} sent you a doodle`,
                data: {
                    type: 'scribble',
                },
            });
        };

        const handleMoodChanged = (data = {}) => {
            const moodLabel = data.mood?.label
                ? String(data.mood.label).trim().toLowerCase()
                : 'in a new mood';
            showRoutedLocalNotification({
                title: 'Mood Update',
                body: `${data.userName || partnerName} is ${moodLabel}`,
                data: {
                    type: 'mood_update',
                },
            });
        };

        const handleTicTacToeUpdate = (data = {}) => {
            if (!data.gameId) return;
            if (currentScreen === 'ticTacToe' && sameId(selectedTicTacToeId, data.gameId)) return;

            showRoutedLocalNotification({
                title: 'Tic Tac Toe',
                body: data.gameComplete ? 'Your game was updated' : 'Your partner made a move',
                data: {
                    type: 'tictactoe',
                    gameId: data.gameId,
                },
            });
        };

        const handleTicTacToeInvite = (data = {}) => {
            if (!data.gameId) return;

            showRoutedLocalNotification({
                title: 'Tic Tac Toe Challenge',
                body: `${data.fromName || partnerName} challenged you to play`,
                data: {
                    type: 'tictactoe',
                    gameId: data.gameId,
                },
            });
        };

        const handleWordleUpdate = (data = {}) => {
            if (!data.gameId) return;
            if (currentScreen === 'wordle' && sameId(selectedWordleId, data.gameId)) return;

            showRoutedLocalNotification({
                title: 'Wordle Update',
                body: data.gameComplete ? 'Your Wordle game finished' : 'Your Wordle game was updated',
                data: {
                    type: 'wordle',
                    gameId: data.gameId,
                },
            });
        };

        const handleWordleInvite = (data = {}) => {
            if (!data.gameId) return;

            showRoutedLocalNotification({
                title: 'Wordle Challenge',
                body: `${data.creatorName || partnerName} set a word for you`,
                data: {
                    type: 'wordle',
                    gameId: data.gameId,
                },
            });
        };

        const handleNudgeReceived = (data = {}) => {
            showRoutedLocalNotification({
                title: 'Partner Nudge',
                body: `${data.fromName || partnerName} nudged you`,
                data: {
                    type: 'nudge',
                },
            });
        };

        socket.on('chat:notification', handleChatNotification);
        socket.on('questionChatV2:notification', handleQuestionChatV2Notification);
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
        selectedTicTacToe?._id,
        selectedTicTacToe?.gameId,
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


                if (authenticated && storedUser) {
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
                        const response = await fetch(`${API_BASE}/api/partner/status/${storedUser.id}`);
                        const statusData = await response.json();

                        if (statusData.success && statusData.isPaired) {
                            // Sync latest partner data from server
                            const partnerData = {
                                partnerId: statusData.partner.id,
                                partnerUsername: statusData.partner.name,
                                partnerAvatar: statusData.partner.avatar || null,
                                connectionDate: statusData.connectionDate,
                                relationshipStartDate: statusData.relationshipStartDate,
                                pendingRelationshipStartDate: statusData.pendingRelationshipStartDate || null,
                                shouldAskRelationshipStartDate: statusData.shouldAskRelationshipStartDate || false,
                                partnerIsPremium: statusData.partner.isPremium || false,
                                partnerPremiumPlan: statusData.partner.premiumPlan || null,
                                partnerPremiumExpiresAt: statusData.partner.premiumExpiresAt || null,
                            };
                            // Compute couple premium
                            const isDateActive = (d) => d && new Date(d) > new Date();
                            const userPremium = isDateActive(storedUser.premiumExpiresAt);
                            const partnerPremium = isDateActive(statusData.partner.premiumExpiresAt);
                            const effectivePremium = userPremium || partnerPremium;
                            const premiumSource = userPremium ? (storedUser.premiumSource || 'self') : (partnerPremium ? 'partner' : null);
                            updateUserStorage({ ...partnerData, isPremium: effectivePremium, premiumSource });
                            dispatch(updateUser({ ...partnerData, isPremium: effectivePremium, premiumSource, isOnboarded: true }));

                            if (!storedUser.partnerId) {
                                // We were just paired by someone else!
                                setOnboardedStorage(true);
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
                                partnerAvatar: null,
                                connectionDate: null,
                                relationshipStartDate: null,
                                pendingRelationshipStartDate: storedUser.pendingRelationshipStartDate || null,
                                shouldAskRelationshipStartDate: false,
                                partnerIsPremium: false,
                                partnerPremiumPlan: null,
                                partnerPremiumExpiresAt: null,
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

                    // FIRST check if user has a nickname - required before anything else
                    if (!storedUser.nickname) {
                        // No nickname yet - show nickname screen first
                        setCurrentScreen('nickname');
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
                        } else {
                            setCurrentScreen('home');
                        }

                        // Fetch pending puzzles and TicTacToe games
                        fetchPendingPuzzle(storedUser.id);
                        fetchPendingTicTacToe(storedUser.id);
                        fetchPendingWordle(storedUser.id);
                    } else {
                        // Has nickname but not paired - show partner code screen
                        setCurrentScreen('partnerCode');
                    }
                } else {
                    // Not authenticated - check if first launch
                    // TODO: Remove this override after testing
                    // if (!hasSeenOnboarding()) {
                    setCurrentScreen('onboarding'); // Force show for testing
                    // } else {
                    //     setCurrentScreen('welcome');
                    // }
                }
            } catch (error) {
                console.error('Error checking auth state:', error);
                setCurrentScreen('login');
            }
        };

        checkAuthState();
    }, [connect, dispatch, syncDeviceInfo]);

    // Fetch pending puzzles for the user
    const fetchPendingPuzzle = async (userId) => {
        if (!userId) return;
        try {
            const response = await fetch(`${API_BASE}/api/puzzle/pending/${userId}`);
            const data = await response.json();
            if (data.success && data.data.length > 0) {
                dispatch(setPendingPuzzle(data.data[0])); // Show first pending puzzle
            } else {
                dispatch(setPendingPuzzle(null));
            }
        } catch (err) {
            dispatch(setPendingPuzzle(null));
        }
    };

    // Use startTransition for non-blocking navigation
    const navigate = (screen) => {
        if (screen === 'premium') {
            setIsPremiumVisible(true);
            return;
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

    // Handle login - save user and navigate based on pairing status
    const handleLogin = (user) => {
        startTransition(() => {
            // Save user to MMKV storage
            saveUser(user);

            // Dispatch to Redux
            dispatch(setUser(user));

            // Connect to socket for real-time sync
            connect();

            // Register FCM token for push notifications (critical for reinstalls!)
            registerFCMToken();

            syncDeviceInfo(user.id);

            // FIRST check if user has a nickname - required before anything else
            if (!user.nickname) {
                // No nickname yet - show nickname screen first
                setCurrentScreen('nickname');
            } else if (user.partnerId) {
                if (needsRelationshipStartDate(user)) {
                    setCurrentScreen('relationshipStartDate');
                    return;
                }

                // Has nickname and is paired - go to home
                dispatch(setOnboarded(true));
                setOnboardedStorage(true);
                setCurrentScreen('home');
            } else {
                // Has nickname but not paired - show partner code screen
                setCurrentScreen('partnerCode');
            }
        });
    };

    // Handle nickname completion
    const handleNicknameComplete = async (nickname) => {
        if (nickname) {
            // Update local storage and Redux immediately
            updateUserStorage({ nickname });
            dispatch(updateUser({ nickname }));

            // Save nickname to backend via profile update
            try {
                await fetch(`${API_BASE}/api/user/profile`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: userData.id, nickname }),
                });
            } catch (err) {
                console.error('Failed to save nickname to server:', err);
            }
        }

        startTransition(() => {
            // After nickname, continue profile setup before pairing.
            setCurrentScreen('avatarSelection');
        });
    };

    // Handle relationship start date completion
    const handleRelationshipStartDateComplete = async (relationshipStartDate) => {
        if (relationshipStartDate) {
            updateUserStorage({ relationshipStartDate, shouldAskRelationshipStartDate: false });
            dispatch(updateUser({ relationshipStartDate, shouldAskRelationshipStartDate: false }));
            saveTogetherWidgetStartDate(relationshipStartDate).catch((error) => {
                console.warn('Failed to save submitted relationship date to widget:', error?.message || error);
            });

            try {
                const response = await fetch(`${API_BASE}/api/user/profile`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: userData.id, relationshipStartDate }),
                });
                const data = await response.json();
                const savedRelationshipStartDate = data?.user?.relationshipStartDate;
                if (data?.success && savedRelationshipStartDate) {
                    const pendingRelationshipStartDate = data?.user?.pendingRelationshipStartDate || null;
                    updateUserStorage({ relationshipStartDate: savedRelationshipStartDate, pendingRelationshipStartDate, shouldAskRelationshipStartDate: false });
                    dispatch(updateUser({ relationshipStartDate: savedRelationshipStartDate, pendingRelationshipStartDate, shouldAskRelationshipStartDate: false }));
                }
            } catch (err) {
                console.error('Failed to save relationship start date to server:', err);
            }
        }

        startTransition(() => {
            if (userData.partnerId) {
                dispatch(setOnboarded(true));
                setOnboardedStorage(true);
                checkNotificationPermission().then((hasPermission) => {
                    setCurrentScreen(hasPermission ? 'home' : 'notificationPermission');
                });
            } else {
                setCurrentScreen('partnerCode');
            }
        });
    };

    // Handle avatar completion
    const handleAvatarComplete = async () => {
        // After avatar, go to notification permission (or skip if already granted)
        const hasPermission = await checkNotificationPermission();
        startTransition(() => {
            if (hasPermission) {
                // Permission already granted, skip to pairing/home
                if (userData.partnerId) {
                    dispatch(setOnboarded(true));
                    setOnboardedStorage(true);
                    setCurrentScreen('home');
                } else {
                    setCurrentScreen('partnerCode');
                }
            } else {
                setCurrentScreen('notificationPermission');
            }
        });
    };


    // Handle successful pairing
    const handlePartnerPaired = async (partner) => {
        // Update stored user with partner info
        const partnerData = {
            partnerId: partner.id,
            partnerUsername: partner.name,
            partnerAvatar: partner.avatar || null,
            connectionDate: partner.connectionDate,
            relationshipStartDate: partner.relationshipStartDate,
            pendingRelationshipStartDate: partner.pendingRelationshipStartDate || null,
            shouldAskRelationshipStartDate: partner.shouldAskRelationshipStartDate || false,
        };
        updateUserStorage(partnerData);
        dispatch(setPartner(partner));
        setOnboardedStorage(true);
        requestReviewForMoment(REVIEW_MOMENTS.PARTNER_PAIRED);

        // Check if notification permission is already granted
        const hasPermission = await checkNotificationPermission();
        startTransition(() => {
            if (needsRelationshipStartDate({ ...userData, ...partnerData })) {
                setCurrentScreen('relationshipStartDate');
                return;
            }

            if (hasPermission) {
                setCurrentScreen('home');
            } else {
                setCurrentScreen('notificationPermission');
            }
        });
    };

    // Handle skip partner pairing
    const handleSkipPartner = () => {
        dispatch(setOnboarded(true));
        setOnboardedStorage(true);

        // Go directly to home - don't re-check notification permission
        // since the user already passed through the notification screen
        startTransition(() => {
            setCurrentScreen('home');
        });
    };

    // Handle notification permission completion (allow or skip)
    const handleNotificationComplete = () => {
        startTransition(() => {
            // After notification permission, check pairing status
            if (userData.partnerId) {
                dispatch(setOnboarded(true));
                setOnboardedStorage(true);
                setCurrentScreen('home');
            } else {
                setCurrentScreen('partnerCode');
            }
        });
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
        startTransition(() => {
            disconnect(); // Explicitly disconnect socket
            clearAuth();
            dispatch(logout());
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

            const response = await fetch(`${API_BASE}/api/user/delete-account`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
            });

            const data = await response.json();

            if (data.success) {
                // Clear all local storage and navigate to login
                startTransition(() => {
                    disconnect(); // Explicitly disconnect socket
                    clearAuth();
                    dispatch(logout());
                    setPendingInvite(null);
                    setCurrentScreen('login');
                });
            } else {
                Alert.alert('Error', data.error || 'Failed to delete account');
            }
        } catch (error) {
            console.error('🗑️ [DELETE] Error deleting account:', error);
            Alert.alert('Error', 'Failed to delete account. Please try again.');
        }
    };

    // Handle authentication errors globally (401/403 responses)
    const handleAuthError = useCallback((error) => {
        // Directly navigate to login without showing alert
        startTransition(() => {
            disconnect(); // Explicitly disconnect socket
            clearAuth();
            dispatch(logout());
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
            if (isPremiumVisible) {
                setIsPremiumVisible(false);
                return true;
            }

            const homeSubScreens = [
                'mood', 'scribble', 'questions', 'jigsawCreate',
                'jigsawPuzzle', 'ticTacToe', 'wordle', 'chat', 'questionChatV2',
                'premium', 'dailyChallenge', 'questionCategories',
            ];

            if (currentScreen === 'chat') {
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
    }, [currentScreen, isPremiumVisible]);

    // Handle onboarding completion
    const handleOnboardingComplete = () => {
        startTransition(() => {
            setSeenOnboarding(true);
            setCurrentScreen('login');
        });
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
                        onComplete={() => navigate('onboarding3')}
                    />
                );

            case 'onboarding3':
                return (
                    <Onboarding3Screen
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
                        onBack={() => navigate('nickname')}
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
                                navigate('partnerCode');
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
                        onAvatarPress={() => navigate('avatarSelection')}
                        onFindPartner={() => navigate('partnerCode')}
                        onEditRelationshipDate={() => navigate('relationshipStartDate')}
                        onJigsawCreate={() => navigate('jigsawCreate')}
                        onJigsawPlay={(puzzleData) => {
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
                        onLinkPartner={() => navigate('partnerCode')}
                        userName={userData?.name || 'You'}
                        partnerName={userData?.partnerUsername || 'Your Love'}
                        initialPaths={partnerScribble?.paths}
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
                            onLinkPartner={() => navigate('partnerCode')}
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
                        onLinkPartner={() => navigate('partnerCode')}
                    />
                );

            case 'jigsawPuzzle':
                return (
                    <JigsawPuzzleScreen
                        navigation={{ goBack: () => navigateHomeTab('games') }}
                        route={{
                            params: {
                                puzzleId: selectedPuzzle?._id,
                                puzzleData: selectedPuzzle,
                            }
                        }}
                    />
                );

            case 'ticTacToe':
                return (
                    <TicTacToeScreen
                        navigation={{ goBack: () => navigateHomeTab('games') }}
                        route={{
                            params: {
                                gameId: selectedTicTacToe?._id,
                                gameData: selectedTicTacToe,
                                partnerId: userData.partnerId,
                                partnerName: userData.partnerUsername || 'Partner',
                            }
                        }}
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
                        onLinkPartner={() => navigate('partnerCode')}
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
                visible={isPremiumVisible}
                animationType="slide"
                transparent={false}
                statusBarTranslucent={true}
                onRequestClose={() => setIsPremiumVisible(false)}
            >
                <PremiumScreen
                    onBack={() => setIsPremiumVisible(false)}
                />
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
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
        zIndex: 10,
        elevation: 10,
    },
});

export default AppNavigator;
