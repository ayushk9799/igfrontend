// Main Tab Navigator - Home with Bottom Tabs
// Now uses Redux for global state instead of prop drilling
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, BackHandler, Modal, Animated, Dimensions, PanResponder, AppState, Linking, Platform } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import HomeScreen from '../screens/HomeScreen';
import AccountScreen from '../screens/AccountScreen';
import EditAccountScreen from '../screens/EditAccountScreen';
import ScribbleScreen from '../screens/ScribbleScreen';
import GamesScreen from '../screens/GamesScreen';
import DailyChallengeScreen from '../screens/DailyChallengeScreen';
import MemoriesScreen from '../screens/MemoriesScreen';
import TopicQuestionsV2Screen from '../screens/TopicQuestionsV2Screen';
import ChatListScreen from '../screens/ChatListScreen';
import NotificationCenterScreen from '../screens/NotificationCenterScreen';
import OnboardingPremiumScreen from '../screens/OnboardingPremiumScreen';
import FreeScreen from '../screens/FreeScreen';
import MoodScreen from '../screens/MoodScreen';
import WidgetsLibraryScreen from '../screens/WidgetsLibraryScreen';
import CouplePhotoCaptureScreen from '../screens/CouplePhotoCaptureScreen';
import WidgetSetupBottomSheet from '../components/WidgetSetupBottomSheet';
import WidgetInstructionsBottomSheet from '../components/WidgetInstructionsBottomSheet';
import YearlyOfferBottomSheet from '../components/YearlyOfferBottomSheet';
import { getEmojiById, getEmojiByLabel, emojis } from '../constants/Moods';
import BottomTabBar from '../components/BottomTabBar';
import { colors } from '../theme';
import { useSocketContext } from '../context/SocketContext';
import { selectUser, selectHasPartner, selectPartnerName, selectDaysTogether, selectIsPremium, updateUser } from '../store/slices/userSlice';
import { selectGames } from '../store/slices/gamesSlice';
import { selectDuelBadgeCount } from '../store/slices/notificationsSlice';
import { TOPIC_CATEGORIES } from '../constants/Categories';
import { API_BASE } from '../constants/Api';
import { getCoupleTodayChallenge } from '../utils/answerApi';
import { useCall } from '../calling/CallContext';
import { CALL_STATE } from '../calling/callConstants';
import { sendCurrentCouplePhoto } from '../api/couplePhotoApi';
import {
    disableDistanceLocationSharing,
    getDistanceLocationPermissionStatus,
    isLocationSettingsError,
    refreshDistanceWidgetSnapshot,
    requestDistanceBackgroundLocationPermission,
    requestDistanceForegroundLocation,
    syncDistanceWidgetLocation,
} from '../utils/distanceWidgetSync';
import { reportWidgetIntent, sendPartnerLocationReminder, syncNativeWidgetStatus } from '../api/widgetStatusApi';
import * as ImagePicker from 'expo-image-picker';
import { storage } from '../utils/authStorage';
import { QuestionsV2Api } from '../api/questionsV2Api';

const MOOD_STALE_MS = 12 * 60 * 60 * 1000;
const YEARLY_OFFER_DISMISS_DELAY_MS = 5 * 1000;
const YEARLY_OFFER_WINDOW_MS = 60 * 60 * 1000;
const YEARLY_OFFER_COOLDOWN_MS = 48 * 60 * 60 * 1000;
const YEARLY_OFFER_LAST_PRESENTED_KEY = 'yearly_offer_last_presented_v2';
const YEARLY_OFFER_WINDOW_END_KEY = 'yearly_offer_window_end_v2';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ACCOUNT_EDGE_SWIPE_WIDTH = SCREEN_WIDTH * 0.2;

const getYearlyOfferKey = (prefix, userId) => `${prefix}:${userId || 'device'}`;

const isMoodPastRefreshWindow = (mood, now) => {
    if (!mood?.updatedAt) {
        return false;
    }

    const updatedAt = new Date(mood.updatedAt).getTime();
    return !Number.isNaN(updatedAt) && now - updatedAt > MOOD_STALE_MS;
};

export const MainTabNavigator = ({
    // Only keep essential callbacks that navigate outside this component
    yourMood,
    initialTab,
    onMoodSelect,
    onQuestionPress,
    onFindPartner,
    onJigsawCreate,
    onJigsawPlay,
    onRefreshPuzzle,
    onTicTacToePress,
    onWordlePress,
    onPremiumPress,
    onLogout,
    onDeleteAccount,
    onTabChange,
    onNavigateFromAccount,
    onLiveChatPress,
    onRequestDrawPremium,
    onOpenDrawFreeScreen,
    canAutoOpenMoodPrompt = true,
    openAccountOnMount = false,
    onAccountRestoreHandled,
    yearlyOfferRequestId = 0,
    onYearlyOfferRequestHandled,
}) => {
    const [currentTab, setCurrentTab] = useState(initialTab || 'home');
    const [selectedTopic, setSelectedTopic] = useState(null); // Track selected topic for TopicQuestionsScreen
    const [chatBadge, setChatBadge] = useState(0); // Unread chat count for badge
    const [todayChallenge, setTodayChallenge] = useState(null);
    const [topicProgressById, setTopicProgressById] = useState({});
    const [isAccountVisible, setIsAccountVisible] = useState(openAccountOnMount);
    const [isEditAccountVisible, setIsEditAccountVisible] = useState(false);
    const [shouldReturnToAccountFromTab, setShouldReturnToAccountFromTab] = useState(false);
    const [isHomePremiumVisible, setIsHomePremiumVisible] = useState(false);
    const [homePremiumStep, setHomePremiumStep] = useState('free');
    const [isNotificationVisible, setIsNotificationVisible] = useState(false);
    const [isMoodVisible, setIsMoodVisible] = useState(false);
    const [isMoodRefreshPrompt, setIsMoodRefreshPrompt] = useState(false);
    const [moodRefreshNow, setMoodRefreshNow] = useState(Date.now());
    const [moodPreview, setMoodPreview] = useState(null);
    const [isScribbleLiveFullscreen, setIsScribbleLiveFullscreen] = useState(false);
    const [tabBarRenderKey] = useState(0);
    const [openScribbleLiveMode, setOpenScribbleLiveMode] = useState(false);
    const [openDistanceSetup, setOpenDistanceSetup] = useState(false);
    const [widgetSheet, setWidgetSheet] = useState(null);
    const [isWidgetInstructionsVisible, setIsWidgetInstructionsVisible] = useState(false);
    const [widgetInstructionsType, setWidgetInstructionsType] = useState(
        Platform.OS === 'android' ? 'home' : 'lock'
    );
    const [locationSyncing, setLocationSyncing] = useState(false);
    const [locationMessage, setLocationMessage] = useState('');
    const [distanceReason, setDistanceReason] = useState(null);
    const [locationPermissionStatus, setLocationPermissionStatus] = useState(null);
    const [photoCaptureSource, setPhotoCaptureSource] = useState('camera');
    const [cameraPermissionMessage, setCameraPermissionMessage] = useState('');
    const [isYearlyOfferDue, setIsYearlyOfferDue] = useState(false);
    const [yearlyOfferWindowEndsAt, setYearlyOfferWindowEndsAt] = useState(null);
    const locationSettingsPendingRef = useRef(false);
    const cameraSettingsPendingRef = useRef(false);
    const locationRevocationSyncRef = useRef(false);
    const distancePremiumDelayRef = useRef(null);
    const yearlyOfferDelayRef = useRef(null);
    const lastAutoOpenedMoodRef = React.useRef(null);
    const currentTabRef = useRef(currentTab);

    const [isAccountMounted, setIsAccountMounted] = useState(openAccountOnMount);
    const isAccountVisibleRef = useRef(isAccountVisible);
    const slideAnim = useRef(
        new Animated.Value(openAccountOnMount ? 0 : SCREEN_WIDTH)
    ).current;

    useEffect(() => {
        isAccountVisibleRef.current = isAccountVisible;
        if (!isAccountVisible) {
            setIsEditAccountVisible(false);
        }
    }, [isAccountVisible]);

    useEffect(() => {
        if (openAccountOnMount) {
            onAccountRestoreHandled?.();
        }
    }, [openAccountOnMount, onAccountRestoreHandled]);

    useEffect(() => {
        if (isAccountVisible) {
            setIsAccountMounted(true);
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 220,
                useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: SCREEN_WIDTH,
                duration: 200,
                useNativeDriver: true,
            }).start(() => {
                setIsAccountMounted(false);
            });
        }
    }, [isAccountVisible, slideAnim]);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (evt, gestureState) => {
                const startX = gestureState.moveX - gestureState.dx;
                const isHorizontalRightSwipe = gestureState.dx > 10
                    && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.2;

                return isAccountVisibleRef.current
                    && startX >= 0
                    && startX <= ACCOUNT_EDGE_SWIPE_WIDTH
                    && isHorizontalRightSwipe;
            },
            onPanResponderGrant: () => { },
            onPanResponderMove: (evt, gestureState) => {
                if (gestureState.dx > 0) {
                    slideAnim.setValue(gestureState.dx);
                }
            },
            onPanResponderRelease: (evt, gestureState) => {
                if (gestureState.dx > SCREEN_WIDTH / 3 || gestureState.vx > 0.4) {
                    Animated.timing(slideAnim, {
                        toValue: SCREEN_WIDTH,
                        duration: 180,
                        useNativeDriver: true,
                    }).start(() => {
                        setIsAccountVisible(false);
                        setIsAccountMounted(false);
                    });
                } else {
                    Animated.spring(slideAnim, {
                        toValue: 0,
                        tension: 80,
                        friction: 10,
                        useNativeDriver: true,
                    }).start();
                }
            },
        })
    ).current;

    useEffect(() => {
        if (initialTab) {
            setCurrentTab(initialTab);
        }
    }, [initialTab]);

    useEffect(() => {
        onTabChange?.(currentTab);
        currentTabRef.current = currentTab;
    }, [currentTab, onTabChange]);

    useEffect(() => {
        if (currentTab !== 'canvas') {
            setIsScribbleLiveFullscreen(false);
            setOpenScribbleLiveMode(false);
        }
    }, [currentTab]);

    const handleBottomTabChange = useCallback((tab) => {
        if (tab === 'canvas') {
            setOpenScribbleLiveMode(false);
        }
        setCurrentTab(tab);
    }, []);

    // Redux state
    const dispatch = useDispatch();
    const userData = useSelector(selectUser);
    const hasPartner = useSelector(selectHasPartner);
    const partnerName = useSelector(selectPartnerName);
    const daysTogether = useSelector(selectDaysTogether);
    const isPremium = useSelector(selectIsPremium);

    const effectivePremiumSource = userData?.premiumSource ||
        (userData?.premiumExpiresAt && new Date(userData.premiumExpiresAt) > new Date() ? 'self' :
            (userData?.partnerPremiumExpiresAt && new Date(userData.partnerPremiumExpiresAt) > new Date() ? 'partner' : null));
    const effectivePremiumExpiresAt = effectivePremiumSource === 'partner'
        ? (userData?.partnerPremiumExpiresAt || userData?.premiumExpiresAt)
        : userData?.premiumExpiresAt;
    const effectivePremiumPlan = effectivePremiumSource === 'partner'
        ? (userData?.partnerPremiumPlan || userData?.premiumPlan)
        : userData?.premiumPlan;
    const effectivePremiumWillRenew = effectivePremiumSource === 'partner'
        ? (userData?.partnerPremiumWillRenew ?? userData?.premiumWillRenew)
        : userData?.premiumWillRenew;
    const effectiveSubscriptionStatus = effectivePremiumSource === 'partner'
        ? (userData?.partnerSubscriptionStatus || userData?.subscriptionStatus)
        : userData?.subscriptionStatus;
    const hasPremiumAccess = isPremium
        || userData?.isPremium === true
        || userData?.partnerIsPremium === true;
    const yearlyOfferUserId = userData?._id || userData?.id;
    const games = useSelector(selectGames);
    const { pendingPuzzle, pendingTicTacToe, activeTicTacToe, pendingWordle, activeWordle } = games;

    // Duel notification badge count
    const duelBadgeCount = useSelector(selectDuelBadgeCount);

    const refreshTopicProgress = useCallback(async () => {
        const userId = userData?._id || userData?.id;
        if (!userId) {
            setTopicProgressById({});
            return;
        }

        const response = await QuestionsV2Api.getTopics(userId);
        if (!response.success) {
            console.warn('[MainTabNavigator] Failed to refresh topic progress', {
                message: response.message || response.error,
            });
            return;
        }

        const nextProgress = {};
        for (const topic of response.data?.topics || []) {
            nextProgress[topic.topicId] = topic.progress;
        }
        setTopicProgressById(nextProgress);
    }, [userData?._id, userData?.id]);

    useEffect(() => {
        if (currentTab === 'home') {
            refreshTopicProgress();
        }
    }, [currentTab, refreshTopicProgress]);

    // Socket context for real-time data
    const {
        socket,
        partnerMood,
        partnerScribble,
        partnerOnline,
        myCurrentPhoto,
        partnerCurrentPhoto,
        refreshCurrentPhotos,
    } = useSocketContext();
    const { startCall, callState, expandCall } = useCall();
    const callActive = callState !== CALL_STATE.IDLE;
    const handleCallPress = callActive ? expandCall : startCall;
    const handleLiveChatPress = useCallback(() => {
        if (!hasPartner) {
            onFindPartner?.();
            return;
        }
        onLiveChatPress?.();
    }, [hasPartner, onFindPartner, onLiveChatPress]);

    const handleSendCouplePhoto = useCallback(async (asset) => {
        const userId = userData?._id || userData?.id;
        if (!userId) throw new Error('Please sign in again');
        await sendCurrentCouplePhoto({ userId, asset });
        await refreshCurrentPhotos();
    }, [refreshCurrentPhotos, userData]);

    const refreshLocationPermissionStatus = useCallback(() => {
        getDistanceLocationPermissionStatus()
            .then(async status => {
                if (!status) return;
                setLocationPermissionStatus(status);
                if (status.foregroundGranted || status.backgroundGranted) {
                    setLocationMessage('');
                }
                if (
                    ['denied', 'restricted'].includes(status.status)
                    && userData?.locationSharingEnabled === true
                    && !locationRevocationSyncRef.current
                ) {
                    locationRevocationSyncRef.current = true;
                    try {
                        const result = await disableDistanceLocationSharing(userData);
                        if (result?.user) {
                            dispatch(updateUser(result.user));
                        }
                        setDistanceReason('sharing_disabled');
                    } finally {
                        locationRevocationSyncRef.current = false;
                    }
                }
            })
            .catch(() => { });
    }, [dispatch, userData]);

    const openWidgetSheet = useCallback((kind) => {
        setLocationMessage('');
        setCameraPermissionMessage('');
        if (kind === 'distance') {
            refreshLocationPermissionStatus();
            setDistanceReason(hasPartner ? 'checking' : 'missing_partner');
            if (hasPartner && hasPremiumAccess) {
                refreshDistanceWidgetSnapshot(userData)
                    .then(result => setDistanceReason(result?.distance?.reason || null))
                    .catch(() => setDistanceReason(null));
            }
        }
        setWidgetSheet(kind);
    }, [hasPartner, hasPremiumAccess, refreshLocationPermissionStatus, userData]);

    const handleEnableDistance = useCallback(async () => {
        if (locationSyncing) return;

        setLocationSyncing(true);
            setLocationMessage('');
        try {
            if (['ios', 'android'].includes(Platform.OS)) {
                let permission = await getDistanceLocationPermissionStatus();

                if (permission?.foregroundGranted !== true) {
                    await requestDistanceForegroundLocation({
                        onPermissionGranted: () => {
                            setLocationPermissionStatus({
                                status: 'whenInUse',
                                foregroundGranted: true,
                                backgroundGranted: false,
                                servicesEnabled: true,
                            });
                        },
                    });
                    permission = await getDistanceLocationPermissionStatus();
                    if (permission) {
                        setLocationPermissionStatus(permission);
                    }
                    if (permission?.backgroundGranted !== true) {
                        setLocationMessage(
                            Platform.OS === 'ios'
                                ? 'Location is enabled while using the app. Tap Enable Always Access to continue.'
                                : Number(Platform.Version) >= 30
                                    ? 'Location is enabled while using the app. Open Settings and choose Allow all the time.'
                                    : 'Location is enabled while using the app. Tap Allow all the time to continue.'
                        );
                        return;
                    }
                }

                if (permission?.backgroundGranted !== true) {
                    setLocationPermissionStatus(permission);
                    if (Platform.OS === 'android' && Number(Platform.Version) >= 30) {
                        setLocationMessage('In Location permissions, choose Allow all the time, then return to Penguin.');
                        locationSettingsPendingRef.current = true;
                        await Linking.openSettings();
                        return;
                    }

                    try {
                        await requestDistanceBackgroundLocationPermission();
                        const upgradedPermission = await getDistanceLocationPermissionStatus();
                        if (upgradedPermission) {
                            setLocationPermissionStatus(upgradedPermission);
                        }
                        if (upgradedPermission?.backgroundGranted !== true) {
                            setLocationMessage(
                                Platform.OS === 'ios'
                                    ? 'iOS did not grant Always access. Tap Open Settings to enable it manually.'
                                    : 'Android did not grant background location. Tap Open Settings and choose Allow all the time.'
                            );
                            return;
                        }
                    } catch (error) {
                        if (isLocationSettingsError(error)) {
                            setLocationMessage(
                                Platform.OS === 'ios'
                                    ? 'iOS did not show or grant the Always prompt. Tap Open Settings to enable it manually.'
                                    : 'On Android 11 and newer, choose Allow all the time from Settings.'
                            );
                            return;
                        }
                        throw error;
                    }
                }
            }

            // Location permission is independent of the subscription. Free
            // users must be allowed to grant it before the premium gate.
            if (!hasPremiumAccess) {
                setWidgetSheet(null);
                if (distancePremiumDelayRef.current) {
                    clearTimeout(distancePremiumDelayRef.current);
                }
                distancePremiumDelayRef.current = setTimeout(() => {
                    distancePremiumDelayRef.current = null;
                    onPremiumPress?.();
                }, 400);
                return;
            }

            reportWidgetIntent('distance', userData).catch(() => { });
            syncNativeWidgetStatus(userData).catch(() => { });
            const result = await syncDistanceWidgetLocation({
                user: userData,
                enableSharing: true,
                enableBackgroundUpdates: true,
                onForegroundPermissionGranted: () => {
                    setLocationPermissionStatus(previous => ({
                        ...(previous || {}),
                        status: previous?.backgroundGranted ? 'always' : 'whenInUse',
                        foregroundGranted: true,
                        backgroundGranted: previous?.backgroundGranted === true,
                        servicesEnabled: true,
                    }));
                },
            });
            if (result?.user) {
                dispatch(updateUser(result.user));
            }
            setDistanceReason(result?.distance?.reason || null);
            if (result?.backgroundUpdatesError) {
                setLocationMessage(result.backgroundUpdatesError.message || 'Allow background location in Settings so the widget can stay updated.');
            } else {
                setLocationPermissionStatus({
                    status: 'always',
                    foregroundGranted: true,
                    backgroundGranted: true,
                    servicesEnabled: true,
                });
            }
        } catch (error) {
            setLocationMessage(
                isLocationSettingsError(error)
                    ? (error?.message || 'Location access needs to be enabled in Settings.')
                    : (error?.message || 'Could not enable location. Please try again.')
            );
        } finally {
            refreshLocationPermissionStatus();
            setLocationSyncing(false);
        }
    }, [dispatch, hasPremiumAccess, locationSyncing, onPremiumPress, refreshLocationPermissionStatus, userData]);

    useEffect(() => () => {
        if (distancePremiumDelayRef.current) {
            clearTimeout(distancePremiumDelayRef.current);
        }
    }, []);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', nextState => {
            if (nextState === 'active' && widgetSheet === 'distance') {
                refreshLocationPermissionStatus();
                setTimeout(refreshLocationPermissionStatus, 350);
                setTimeout(refreshLocationPermissionStatus, 1000);
                if (locationSettingsPendingRef.current) {
                    locationSettingsPendingRef.current = false;
                    setTimeout(async () => {
                        try {
                            const status = await getDistanceLocationPermissionStatus();
                            if (status) {
                                setLocationPermissionStatus(status);
                            }
                            if (status?.backgroundGranted) {
                                setLocationMessage('');
                                handleEnableDistance();
                            } else {
                                setLocationMessage(
                                    Platform.OS === 'android'
                                        ? 'Background access is still needed. Open Settings and choose Allow all the time.'
                                        : 'Always access is still needed. Tap Enable Always Access to open Settings.'
                                );
                            }
                        } catch {
                            setLocationMessage('Could not refresh location access. Please try again.');
                        }
                    }, 450);
                }
            }
        });
        return () => subscription.remove();
    }, [handleEnableDistance, refreshLocationPermissionStatus, widgetSheet]);

    useEffect(() => {
        if (widgetSheet !== 'distance') return undefined;
        const permissionPoll = setInterval(refreshLocationPermissionStatus, 1200);
        return () => clearInterval(permissionPoll);
    }, [refreshLocationPermissionStatus, widgetSheet]);

    const openPhotoCapture = useCallback((source) => {
        setPhotoCaptureSource(source);
        setWidgetSheet(null);
        setCurrentTab('partnerPhotoCapture');
    }, []);

    const handleTakePhoto = useCallback(async () => {
        const permission = await ImagePicker.getCameraPermissionsAsync();
        if (permission.granted) {
            openPhotoCapture('camera');
            return;
        }
        setCameraPermissionMessage(permission.canAskAgain === false ? 'Camera access is blocked. Enable it in Settings.' : '');
        setWidgetSheet('cameraPermission');
    }, [openPhotoCapture]);

    const handleAllowCamera = useCallback(async () => {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (permission.granted) {
            openPhotoCapture('camera');
            return;
        }
        setCameraPermissionMessage(
            permission.canAskAgain === false
                ? 'Camera access is blocked. Enable it in Settings.'
                : ''
        );
    }, [openPhotoCapture]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', nextState => {
            if (nextState !== 'active' || widgetSheet !== 'cameraPermission' || !cameraSettingsPendingRef.current) return;

            cameraSettingsPendingRef.current = false;
            ImagePicker.getCameraPermissionsAsync()
                .then(permission => {
                    if (permission.granted) {
                        openPhotoCapture('camera');
                        return;
                    }
                    setCameraPermissionMessage(
                        permission.canAskAgain === false
                            ? 'Camera access is blocked. Enable it in Settings.'
                            : ''
                    );
                })
                .catch(() => setCameraPermissionMessage('Could not check camera access. Please try again.'));
        });

        return () => subscription.remove();
    }, [openPhotoCapture, widgetSheet]);

    const showWidgetInstructions = useCallback((tutorialType) => {
        setWidgetInstructionsType(
            Platform.OS === 'android' || tutorialType === 'home' ? 'home' : 'lock'
        );
        setIsWidgetInstructionsVisible(true);
    }, []);

    const handleOpenLocationSettings = useCallback(() => {
        locationSettingsPendingRef.current = widgetSheet === 'distance';
        cameraSettingsPendingRef.current = widgetSheet === 'cameraPermission';
        Linking.openSettings();
    }, [widgetSheet]);

    const closeYearlyOffer = useCallback(() => {
        setIsYearlyOfferDue(false);
        if (!yearlyOfferUserId || hasPremiumAccess) return;

        const windowKey = getYearlyOfferKey(YEARLY_OFFER_WINDOW_END_KEY, yearlyOfferUserId);
        const now = Date.now();
        const storedWindowEnd = storage.getNumber(windowKey) || 0;
        const windowEnd = storedWindowEnd > now
            ? storedWindowEnd
            : now + YEARLY_OFFER_WINDOW_MS;

        storage.set(windowKey, windowEnd);
        setYearlyOfferWindowEndsAt(windowEnd);
    }, [hasPremiumAccess, yearlyOfferUserId]);

    const completeYearlyOffer = useCallback(() => {
        setIsYearlyOfferDue(false);
        setYearlyOfferWindowEndsAt(null);
        if (yearlyOfferUserId) {
            storage.delete(
                getYearlyOfferKey(YEARLY_OFFER_WINDOW_END_KEY, yearlyOfferUserId),
            );
        }
    }, [yearlyOfferUserId]);

    const markYearlyOfferPresented = useCallback(() => {
        if (!yearlyOfferUserId) return;
        if (yearlyOfferWindowEndsAt && yearlyOfferWindowEndsAt > Date.now()) return;
        const now = Date.now();
        const windowEnd = now + YEARLY_OFFER_WINDOW_MS;
        storage.set(
            getYearlyOfferKey(YEARLY_OFFER_LAST_PRESENTED_KEY, yearlyOfferUserId),
            now,
        );
        storage.set(
            getYearlyOfferKey(YEARLY_OFFER_WINDOW_END_KEY, yearlyOfferUserId),
            windowEnd,
        );
        setYearlyOfferWindowEndsAt(windowEnd);
    }, [yearlyOfferUserId, yearlyOfferWindowEndsAt]);

    const scheduleYearlyOffer = useCallback(() => {
        if (!yearlyOfferUserId || hasPremiumAccess) return;

        const lastPresented = storage.getNumber(
            getYearlyOfferKey(YEARLY_OFFER_LAST_PRESENTED_KEY, yearlyOfferUserId),
        ) || 0;
        if (Date.now() - lastPresented < YEARLY_OFFER_COOLDOWN_MS) return;

        if (yearlyOfferDelayRef.current) {
            clearTimeout(yearlyOfferDelayRef.current);
        }
        setIsYearlyOfferDue(false);
        yearlyOfferDelayRef.current = setTimeout(() => {
            yearlyOfferDelayRef.current = null;
            setIsYearlyOfferDue(true);
        }, YEARLY_OFFER_DISMISS_DELAY_MS);
    }, [hasPremiumAccess, yearlyOfferUserId]);

    useEffect(() => () => {
        if (yearlyOfferDelayRef.current) {
            clearTimeout(yearlyOfferDelayRef.current);
        }
    }, []);

    useEffect(() => {
        if (!yearlyOfferUserId) {
            setYearlyOfferWindowEndsAt(null);
            return;
        }

        const windowKey = getYearlyOfferKey(YEARLY_OFFER_WINDOW_END_KEY, yearlyOfferUserId);
        if (hasPremiumAccess) {
            storage.delete(windowKey);
            setYearlyOfferWindowEndsAt(null);
            return;
        }

        const storedWindowEnd = storage.getNumber(
            windowKey,
        ) || 0;
        const now = Date.now();
        setYearlyOfferWindowEndsAt(storedWindowEnd > now ? storedWindowEnd : null);
    }, [hasPremiumAccess, yearlyOfferUserId]);

    const expireYearlyOfferWindow = useCallback(() => {
        setIsYearlyOfferDue(false);
        setYearlyOfferWindowEndsAt(null);
        if (yearlyOfferUserId) {
            storage.delete(
                getYearlyOfferKey(YEARLY_OFFER_WINDOW_END_KEY, yearlyOfferUserId),
            );
        }
    }, [yearlyOfferUserId]);

    useEffect(() => {
        if (!yearlyOfferRequestId) return;
        scheduleYearlyOffer();
        onYearlyOfferRequestHandled?.();
    }, [onYearlyOfferRequestHandled, scheduleYearlyOffer, yearlyOfferRequestId]);

    useEffect(() => {
        const timer = setInterval(() => {
            setMoodRefreshNow(Date.now());
        }, 60 * 1000);

        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (
            !canAutoOpenMoodPrompt ||
            callActive ||
            currentTab !== 'home' ||
            !hasPartner ||
            isMoodVisible ||
            isYearlyOfferDue ||
            !isMoodPastRefreshWindow(yourMood, moodRefreshNow)
        ) {
            return;
        }

        if (lastAutoOpenedMoodRef.current === yourMood.updatedAt) {
            return;
        }

        lastAutoOpenedMoodRef.current = yourMood.updatedAt;
        setIsMoodRefreshPrompt(true);
        setIsMoodVisible(true);
    }, [callActive, canAutoOpenMoodPrompt, currentTab, hasPartner, isMoodVisible, isYearlyOfferDue, moodRefreshNow, yourMood]);

    const openMoodPicker = useCallback(() => {
        setIsMoodRefreshPrompt(false);
        setIsMoodVisible(true);
    }, []);

    const closeMoodPicker = useCallback(() => {
        setMoodPreview(null);
        setIsMoodRefreshPrompt(false);
        setIsMoodVisible(false);
    }, []);

    useEffect(() => {
        if (callState !== CALL_STATE.INCOMING) return;

        // Native React Native modals cannot reliably stack on iOS. Release any
        // tab-level modal before the global incoming-call sheet is presented.
        closeMoodPicker();
        setIsNotificationVisible(false);
        setIsYearlyOfferDue(false);
    }, [callState, closeMoodPicker]);

    // Fetch unread chat count
    const fetchChatBadge = useCallback(async () => {
        const userId = userData?._id || userData?.id;
        if (!userId) return;

        try {
            const response = await fetch(`${API_BASE}/api/chat/unread/${userId}`);
            const json = await response.json();
            if (json.success) {
                setChatBadge(json.data.unreadCount || 0);
            }
        } catch (err) {
        }
    }, [userData]);

    // Fetch badge on mount and when tab changes to home
    useEffect(() => {
        fetchChatBadge();
    }, [fetchChatBadge]);

    // Fetch today's challenge with answers
    const fetchTodayChallenge = useCallback(async () => {
        const userId = userData?._id || userData?.id;
        if (!userId) return;

        try {
            const json = await getCoupleTodayChallenge(userId);
            if (json.success) {
                setTodayChallenge(json.data);
            }
        } catch (err) {
            console.error('Error fetching today\'s challenge:', err);
        }
    }, [userData]);

    // Fetch today's challenge when returning to home tab
    useEffect(() => {
        if (currentTab === 'home') {
            fetchTodayChallenge();
            refreshCurrentPhotos();
        }
    }, [fetchTodayChallenge, currentTab, refreshCurrentPhotos]);

    // Listen for new chat messages to update badge
    useEffect(() => {
        if (!socket) return;

        const handleChatNotification = () => {
            // Increment badge when notification received (unless on chats tab)
            if (currentTab !== 'chats') {
                setChatBadge(prev => prev + 1);
            }
        };

        const handleDistanceStatusUpdate = () => {
            refreshDistanceWidgetSnapshot(userData)
                .then(result => setDistanceReason(result?.distance?.reason || null))
                .catch(() => { });
        };

        socket.on('chat:notification', handleChatNotification);
        socket.on('distance_status_updated', handleDistanceStatusUpdate);

        return () => {
            socket.off('chat:notification', handleChatNotification);
            socket.off('distance_status_updated', handleDistanceStatusUpdate);
        };
    }, [socket, currentTab, userData]);

    // Clear badge when entering chats tab
    useEffect(() => {
        if (currentTab === 'chats') {
            setChatBadge(0);
        }
    }, [currentTab]);

    // Handle Android back button/gesture - navigate to home tab from sub-tabs
    useEffect(() => {
        const backAction = () => {
            if (isAccountVisible) {
                setIsAccountVisible(false);
                return true;
            }
            if (currentTab === 'widgetsLibrary' && shouldReturnToAccountFromTab) {
                setShouldReturnToAccountFromTab(false);
                handleBottomTabChange('home');
                setIsAccountVisible(true);
                return true;
            }
            if (currentTab !== 'home') {
                handleBottomTabChange('home');
                return true; // Prevent default (app exit)
            }
            return false; // Let AppNavigator or OS handle it
        };

        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, [handleBottomTabChange, currentTab, isAccountVisible, shouldReturnToAccountFromTab]);

    const renderScreen = () => {
        switch (currentTab) {
            case 'home':
                return null;
            case 'partnerPhotoCapture':
                return (
                    <CouplePhotoCaptureScreen
                        partnerName={partnerName || userData?.partnerUsername || 'Your partner'}
                        onSendPhoto={handleSendCouplePhoto}
                        onBack={() => setCurrentTab('home')}
                        initialSource={photoCaptureSource}
                    />
                );
            case 'memories':
                return (
                    <MemoriesScreen
                        userId={userData?._id || userData?.id}
                        hasPartner={hasPartner}
                        onLinkPartner={onFindPartner}
                        onBack={() => setCurrentTab('home')}
                    />
                );
            case 'widgetsLibrary':
                return (
                    <WidgetsLibraryScreen
                        userData={userData}
                        isPremium={hasPremiumAccess}
                        onNavigateToPremium={onPremiumPress}
                        onRequestDistanceSetup={() => openWidgetSheet('distance')}
                        onBack={() => {
                            handleBottomTabChange('home');
                            if (shouldReturnToAccountFromTab) {
                                setShouldReturnToAccountFromTab(false);
                                setIsAccountVisible(true);
                            }
                        }}
                        openDistanceSetup={openDistanceSetup}
                        onDistanceSetupHandled={() => setOpenDistanceSetup(false)}
                    />
                );
            case 'canvas':
                return (
                    <ScribbleScreen
                        onBack={() => {
                            setOpenScribbleLiveMode(false);
                            setCurrentTab('home');
                        }}
                        hasPartner={hasPartner}
                        onLinkPartner={onFindPartner}
                        onLiveModeChange={setIsScribbleLiveFullscreen}
                        userName={userData?.nickname || userData?.name || 'You'}
                        partnerName={partnerName || 'Your Love'}
                        userId={userData?._id || userData?.id}
                        hasPremiumAccess={hasPremiumAccess}
                        onRequestPremium={onRequestDrawPremium}
                        onOpenFreeScreen={onOpenDrawFreeScreen}
                        initialPaths={partnerScribble?.paths}
                        initialLiveMode={openScribbleLiveMode}
                        initialCanvasWidth={partnerScribble?.canvasWidth}
                        initialCanvasHeight={partnerScribble?.canvasHeight}
                    />
                );
            case 'dailyChallenge':
                return (
                    <DailyChallengeScreen
                        partnerName={partnerName}
                        userName={userData?.nickname || userData?.name || 'You'}
                        userAvatar={userData?.avatar || null}
                        partnerAvatar={userData?.partnerAvatar || null}
                        userId={userData?._id || userData?.id}
                        hasPartner={hasPartner}
                        initialTodayChallenge={todayChallenge}
                        onLinkPartner={onFindPartner}
                        onBack={() => setCurrentTab('home')}
                        onCompareWithPartner={() => setCurrentTab('chats')}
                    />
                );
            case 'games':
                return (
                    <GamesScreen
                        partnerName={partnerName}
                        pendingPuzzle={pendingPuzzle}
                        activeTicTacToe={activeTicTacToe}
                        pendingTicTacToe={pendingTicTacToe}
                        activeWordle={activeWordle}
                        pendingWordle={pendingWordle}
                        onJigsawCreate={onJigsawCreate}
                        onJigsawPlay={onJigsawPlay}
                        onTicTacToePress={onTicTacToePress}
                        onWordlePress={onWordlePress}
                        onRefreshPuzzle={onRefreshPuzzle}
                        onVideoCallPress={handleCallPress}
                        callActive={callActive}
                        partnerOnline={partnerOnline}
                    />
                );
            case 'topicQuestions':
                const topicConfig = TOPIC_CATEGORIES[selectedTopic];
                if (!topicConfig) {
                    setCurrentTab('home');
                    return null;
                }
                return (
                    <TopicQuestionsV2Screen
                        topic={selectedTopic}
                        topicTitle={topicConfig.title}
                        topicEmoji={topicConfig.emoji}
                        partnerName={partnerName || 'Your Love'}
                        userName={userData?.name || 'You'}
                        userAvatar={userData?.avatar}
                        partnerAvatar={userData?.partnerAvatar}
                        userId={userData?.id}
                        partnerId={userData?.partnerId}
                        hasPartner={hasPartner}
                        onLinkPartner={onFindPartner}
                        onNavigateToPremium={onPremiumPress}
                        onBack={() => setCurrentTab('home')}
                    />
                );
            case 'account':
                return null;
            case 'chats':
                return (
                    <ChatListScreen
                        userId={userData?._id || userData?.id}
                        partnerName={partnerName || 'Partner'}
                        partnerOnline={partnerOnline}
                        liveChatDisabled={callActive}
                        onLiveChatPress={handleLiveChatPress}
                        onSelectChat={(chat) => {
                            // Navigate to ChatScreen - handled by AppNavigator
                            // For now, we'll use a callback if available, or log
                            if (onQuestionPress) {
                                onQuestionPress({ type: 'chat', chat });
                            }
                        }}
                        onBack={() => setCurrentTab('home')}
                    />
                );
            case 'notificationCenter':
                return null;
            default:
                return null;
        }
    };

    return (
        <View style={styles.container}>
            <View style={[styles.screenContainer, currentTab !== 'home' && styles.hiddenScreen]}>
                <HomeScreen
                    topicProgress={topicProgressById}
                    hasPartner={hasPartner}
                    yourMood={moodPreview || yourMood}
                    partnerMood={partnerMood}
                    partnerScribble={partnerScribble}
                    partnerCurrentPhoto={partnerCurrentPhoto}
                    myCurrentPhoto={myCurrentPhoto}
                    todayChallenge={todayChallenge}
                    relationshipStartDate={
                        userData?.relationshipStartDate
                        || userData?.pendingRelationshipStartDate
                        || userData?.connectionDate
                    }
                    daysTogether={daysTogether}
                    onMoodPress={openMoodPicker}
                    onScribblePress={() => {
                        setOpenScribbleLiveMode(false);
                        setCurrentTab('canvas');
                    }}
                    onScribbleLivePress={() => {
                        if (!hasPartner) {
                            onFindPartner();
                            return;
                        }
                        setOpenScribbleLiveMode(true);
                        setCurrentTab('canvas');
                    }}
                    onQuestionPress={(category) => {
                        if (category) {
                            const topicConfig = TOPIC_CATEGORIES[category.id || category];
                            if (topicConfig) {
                                setSelectedTopic(category.id || category);
                                setCurrentTab('topicQuestions');
                                return;
                            } else {
                                if (!hasPartner) {
                                    onFindPartner?.();
                                    return;
                                }
                                onQuestionPress(category);
                            }
                        } else {
                            if (!hasPartner) {
                                onFindPartner?.();
                                return;
                            }
                            setCurrentTab('dailyChallenge');
                        }
                    }}
                    onFindPartner={onFindPartner}
                    onSettingsPress={() => setIsAccountVisible(true)}
                    onRefreshPuzzle={onRefreshPuzzle}
                    duelBadgeCount={duelBadgeCount}
                    onNotificationPress={() => setIsNotificationVisible(true)}
                    onWidgetsPress={() => openWidgetSheet('time')}
                    onVideoCallPress={handleCallPress}
                    partnerOnline={partnerOnline}
                    partnerName={partnerName || userData?.partnerUsername || 'Your partner'}
                    onPartnerPhotoPress={handleTakePhoto}
                    isLocationSetup={userData?.locationSharingEnabled === true}
                    onDistanceSetupPress={() => openWidgetSheet('distance')}
                    onPremiumPress={() => {
                        setHomePremiumStep('free');
                        setIsHomePremiumVisible(true);
                    }}
                    hasPremiumAccess={hasPremiumAccess}
                    yearlyOfferEndsAt={yearlyOfferWindowEndsAt}
                    onYearlyOfferPress={() => setIsYearlyOfferDue(true)}
                    onYearlyOfferExpire={expireYearlyOfferWindow}
                />
            </View>
            {renderScreen()}
            {!isMoodVisible && !widgetSheet && !isScribbleLiveFullscreen && !['topicQuestions', 'widgetsLibrary', 'dailyChallenge', 'partnerPhotoCapture'].includes(currentTab) && (
                <BottomTabBar
                    key={tabBarRenderKey}
                    currentTab={currentTab}
                    onTabChange={handleBottomTabChange}
                    chatBadge={chatBadge}
                />
            )}

            {isAccountMounted && (
                <Animated.View
                    style={[
                        StyleSheet.absoluteFillObject,
                        styles.accountOverlay,
                        {
                            transform: [{ translateX: slideAnim }],
                        },
                    ]}
                    {...panResponder.panHandlers}
                >
                    {isEditAccountVisible ? (
                        <EditAccountScreen
                            onBack={() => setIsEditAccountVisible(false)}
                            onSaved={() => setIsEditAccountVisible(false)}
                            onDeleteAccount={onDeleteAccount
                                ? () => {
                                    setIsEditAccountVisible(false);
                                    setIsAccountVisible(false);
                                    onDeleteAccount();
                                }
                                : undefined}
                        />
                    ) : (
                        <AccountScreen
                            userData={userData}
                            partnerName={partnerName}
                            partnerNickname={userData?.partnerNickname}
                            hasPartner={hasPartner}
                            isPremium={hasPremiumAccess}
                            premiumPlan={effectivePremiumPlan}
                            premiumExpiresAt={effectivePremiumExpiresAt}
                            premiumWillRenew={effectivePremiumWillRenew}
                            premiumSource={effectivePremiumSource}
                            subscriptionStatus={effectiveSubscriptionStatus}
                            daysTogether={daysTogether}
                            onLogout={() => {
                                setIsAccountVisible(false);
                                onLogout();
                            }}
                            onEditProfile={() => setIsEditAccountVisible(true)}
                            onFindPartner={() => {
                                onFindPartner?.();
                            }}
                            onNavigateToPremium={() => {
                                setHomePremiumStep('free');
                                setIsHomePremiumVisible(true);
                            }}
                            onWidgetsPress={() => {
                                setIsAccountVisible(false);
                                setShouldReturnToAccountFromTab(true);
                                setCurrentTab('widgetsLibrary');
                            }}
                            onEditRelationshipDate={() => {
                                setIsAccountVisible(false);
                                onNavigateFromAccount?.('relationshipStartDate');
                            }}
                            onBack={() => {
                                setIsAccountVisible(false);
                            }}
                        />
                    )}
                </Animated.View>
            )}

            <Modal
                visible={isHomePremiumVisible}
                animationType="slide"
                transparent={false}
                statusBarTranslucent={true}
                onRequestClose={() => {
                    const shouldShowYearlyOffer = homePremiumStep === 'premium';
                    setIsHomePremiumVisible(false);
                    setHomePremiumStep('free');
                    if (shouldShowYearlyOffer) {
                        scheduleYearlyOffer();
                    }
                }}
            >
                {homePremiumStep === 'free' ? (
                    <FreeScreen
                        onContinue={() => setHomePremiumStep('premium')}
                    />
                ) : (
                    <OnboardingPremiumScreen
                        onBack={() => {
                            setIsHomePremiumVisible(false);
                            setHomePremiumStep('free');
                            scheduleYearlyOffer();
                        }}
                    />
                )}
            </Modal>

            <Modal
                visible={isNotificationVisible}
                animationType="slide"
                transparent={false}
                statusBarTranslucent={true}
                onRequestClose={() => setIsNotificationVisible(false)}
            >
                <NotificationCenterScreen
                    onBack={() => setIsNotificationVisible(false)}
                    onJigsawPlay={onJigsawPlay}
                    onTicTacToePress={onTicTacToePress}
                    onWordlePress={onWordlePress}
                />
            </Modal>

            <MoodScreen
                visible={isMoodVisible && callState !== CALL_STATE.INCOMING}
                currentMood={getEmojiById(yourMood?.id) || getEmojiByLabel(yourMood?.label) || emojis[0]}
                partnerMood={partnerMood ? (getEmojiById(partnerMood.id) || getEmojiByLabel(partnerMood.label)) : null}
                partnerName={userData?.partnerUsername || partnerName || 'Your Love'}
                onMoodSelect={(mood) => {
                    setMoodPreview(null);
                    setIsMoodRefreshPrompt(false);
                    onMoodSelect?.(mood);
                }}
                onMoodPreview={setMoodPreview}
                onBack={closeMoodPicker}
                isRefreshPrompt={isMoodRefreshPrompt}
                moodUpdatedAt={yourMood?.updatedAt}
            />

            <WidgetSetupBottomSheet
                visible={!!widgetSheet}
                kind={widgetSheet}
                onClose={() => setWidgetSheet(null)}
                isLocationLoading={locationSyncing}
                locationMessage={locationMessage}
                locationPermissionStatus={locationPermissionStatus}
                distanceReason={distanceReason}
                hasPartner={hasPartner}
                partnerName={partnerName || userData?.partnerUsername || 'your partner'}
                onEnableLocation={handleEnableDistance}
                onOpenSettings={handleOpenLocationSettings}
                onTakePhoto={handleTakePhoto}
                onChoosePhoto={() => openPhotoCapture('gallery')}
                onAllowCamera={handleAllowCamera}
                cameraMessage={cameraPermissionMessage}
                onHowToAdd={showWidgetInstructions}
                onConnectPartner={() => {
                    setWidgetSheet(null);
                    onFindPartner?.();
                }}
                onRemindPartner={async () => {
                    await sendPartnerLocationReminder(userData);
                }}
                partnerPhoto={partnerCurrentPhoto}
                myPhoto={myCurrentPhoto}
                daysTogether={daysTogether}
                relationshipStartDate={
                    userData?.relationshipStartDate ||
                    userData?.pendingRelationshipStartDate ||
                    userData?.connectionDate
                }
            />

            <WidgetInstructionsBottomSheet
                visible={isWidgetInstructionsVisible}
                tutorialType={widgetInstructionsType}
                onClose={() => setIsWidgetInstructionsVisible(false)}
            />

            <YearlyOfferBottomSheet
                visible={
                    isYearlyOfferDue
                    && currentTab === 'home'
                    && !hasPremiumAccess
                    && !callActive
                    && !isAccountMounted
                    && !isHomePremiumVisible
                    && !isNotificationVisible
                    && !isMoodVisible
                    && !widgetSheet
                }
                onClose={closeYearlyOffer}
                onPresented={markYearlyOfferPresented}
                onPurchased={completeYearlyOffer}
                offerEndsAt={yearlyOfferWindowEndsAt}
                onOfferExpire={expireYearlyOfferWindow}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    screenContainer: {
        flex: 1,
    },
    hiddenScreen: {
        display: 'none',
    },
    accountOverlay: {
        zIndex: 9999,
        backgroundColor: colors.background || '#FFFFFF',
    },
});

export default MainTabNavigator;
