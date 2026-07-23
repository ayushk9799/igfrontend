// Main Tab Navigator - Home with Bottom Tabs
// Now uses Redux for global state instead of prop drilling
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, BackHandler, Modal, Animated, Dimensions, PanResponder, Alert, AppState, Linking } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import HomeScreen from '../screens/HomeScreen';
import AccountScreen from '../screens/AccountScreen';
import ScribbleScreen from '../screens/ScribbleScreen';
import GamesScreen from '../screens/GamesScreen';
import DailyChallengeScreen from '../screens/DailyChallengeScreen';
import MemoriesScreen from '../screens/MemoriesScreen';
import TopicQuestionsV2Screen from '../screens/TopicQuestionsV2Screen';
import ChatListScreen from '../screens/ChatListScreen';
import NotificationCenterScreen from '../screens/NotificationCenterScreen';
import PremiumScreen from '../screens/PremiumScreen';
import OnboardingPremiumScreen from '../screens/OnboardingPremiumScreen';
import FreeScreen from '../screens/FreeScreen';
import MoodScreen from '../screens/MoodScreen';
import WidgetsLibraryScreen from '../screens/WidgetsLibraryScreen';
import CouplePhotoCaptureScreen from '../screens/CouplePhotoCaptureScreen';
import WidgetSetupBottomSheet from '../components/WidgetSetupBottomSheet';
import JournalOnboardingScreen from '../screens/JournalOnboardingScreen';
import QuestionsOnboardingScreen from '../screens/QuestionsOnboardingScreen';
import WidgetOnboardingScreen from '../screens/WidgetOnboardingScreen';
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
import { disableDistanceLocationSharing, getDistanceLocationPermissionStatus, isLocationSettingsError, refreshDistanceWidgetSnapshot, syncDistanceWidgetLocation } from '../utils/distanceWidgetSync';
import { reportWidgetIntent, sendPartnerLocationReminder, syncNativeWidgetStatus } from '../api/widgetStatusApi';
import * as ImagePicker from 'expo-image-picker';

const MOOD_STALE_MS = 12 * 60 * 60 * 1000;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
    onEditProfile,
    onAvatarPress,
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
    onEditRelationshipDate,
    onLiveChatPress,
    canAutoOpenMoodPrompt = true,
}) => {
    const [currentTab, setCurrentTab] = useState(initialTab || 'home');
    const [selectedTopic, setSelectedTopic] = useState(null); // Track selected topic for TopicQuestionsScreen
    const [chatBadge, setChatBadge] = useState(0); // Unread chat count for badge
    const [todayChallenge, setTodayChallenge] = useState(null);
    const [isAccountVisible, setIsAccountVisible] = useState(false);
    const [accountPreview, setAccountPreview] = useState(null);
    const [isPremiumOpenInAccount, setIsPremiumOpenInAccount] = useState(false);
    const [isHomePremiumVisible, setIsHomePremiumVisible] = useState(false);
    const [homePremiumStep, setHomePremiumStep] = useState('free');
    const [isNotificationVisible, setIsNotificationVisible] = useState(false);
    const [isMoodVisible, setIsMoodVisible] = useState(false);
    const [isMoodRefreshPrompt, setIsMoodRefreshPrompt] = useState(false);
    const [moodRefreshNow, setMoodRefreshNow] = useState(Date.now());
    const [moodPreview, setMoodPreview] = useState(null);
    const [isScribbleLiveFullscreen, setIsScribbleLiveFullscreen] = useState(false);
    const [tabBarRenderKey, setTabBarRenderKey] = useState(0);
    const [openScribbleLiveMode, setOpenScribbleLiveMode] = useState(false);
    const [openDistanceSetup, setOpenDistanceSetup] = useState(false);
    const [widgetSheet, setWidgetSheet] = useState(null);
    const [locationSyncing, setLocationSyncing] = useState(false);
    const [locationMessage, setLocationMessage] = useState('');
    const [distanceReason, setDistanceReason] = useState(null);
    const [locationPermissionStatus, setLocationPermissionStatus] = useState(null);
    const [photoCaptureSource, setPhotoCaptureSource] = useState('camera');
    const [cameraPermissionMessage, setCameraPermissionMessage] = useState('');
    const locationSettingsPendingRef = useRef(false);
    const cameraSettingsPendingRef = useRef(false);
    const locationRevocationSyncRef = useRef(false);
    const lastAutoOpenedMoodRef = React.useRef(null);
    const currentTabRef = useRef(currentTab);

    const [isAccountMounted, setIsAccountMounted] = useState(false);
    const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;

    useEffect(() => {
        if (isAccountVisible) {
            setIsAccountMounted(true);
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 220,
                useNativeDriver: true,
            }).start();
        } else {
            setAccountPreview(null);
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
            onStartShouldSetPanResponder: (evt, gestureState) => {
                return isAccountVisible && gestureState.x0 < 60;
            },
            onMoveShouldSetPanResponder: (evt, gestureState) => {
                return isAccountVisible && gestureState.x0 < 60 && gestureState.dx > 10;
            },
            onPanResponderGrant: () => {},
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
                        setIsPremiumOpenInAccount(false);
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
    const games = useSelector(selectGames);
    const { pendingPuzzle, pendingTicTacToe, activeTicTacToe, pendingWordle, activeWordle } = games;

    // Duel notification badge count
    const duelBadgeCount = useSelector(selectDuelBadgeCount);

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
            .catch(() => {});
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
        if (!hasPremiumAccess) {
            setWidgetSheet(null);
            onPremiumPress?.();
            return;
        }
        if (locationSyncing) return;

        setLocationSyncing(true);
        setLocationMessage('');
        reportWidgetIntent('distance', userData).catch(() => {});
        syncNativeWidgetStatus(userData).catch(() => {});
        try {
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

    useEffect(() => {
        const subscription = AppState.addEventListener('change', nextState => {
            if (nextState === 'active' && widgetSheet === 'distance') {
                refreshLocationPermissionStatus();
                setTimeout(refreshLocationPermissionStatus, 350);
                setTimeout(refreshLocationPermissionStatus, 1000);
                if (locationSettingsPendingRef.current) {
                    locationSettingsPendingRef.current = false;
                    setTimeout(handleEnableDistance, 450);
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

    const showWidgetInstructions = useCallback(() => {
        Alert.alert(
            'Add to your home screen',
            'Touch and hold your home screen, tap Add Widget, find Penguin, then choose this widget.'
        );
    }, []);

    const handleOpenLocationSettings = useCallback(() => {
        locationSettingsPendingRef.current = widgetSheet === 'distance';
        cameraSettingsPendingRef.current = widgetSheet === 'cameraPermission';
        Linking.openSettings();
    }, [widgetSheet]);

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
    }, [callActive, canAutoOpenMoodPrompt, currentTab, hasPartner, isMoodVisible, moodRefreshNow, yourMood]);

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
        setIsPremiumOpenInAccount(false);
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
                .catch(() => {});
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
                if (accountPreview) {
                    setAccountPreview(null);
                    return true;
                }
                setIsAccountVisible(false);
                setIsPremiumOpenInAccount(false);
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
    }, [accountPreview, handleBottomTabChange, currentTab, isAccountVisible]);

    const renderScreen = () => {
        switch (currentTab) {
            case 'home':
                return (
                    <HomeScreen
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
                            if (!hasPartner) {
                                onFindPartner?.();
                                return;
                            }
                            if (category) {
                                // Check if it's a V2 topic-based category
                                const topicConfig = TOPIC_CATEGORIES[category.id || category];
                                if (topicConfig) {
                                    // Handle topic categories within MainTabNavigator
                                    setSelectedTopic(category.id || category);
                                    setCurrentTab('topicQuestions');
                                } else {
                                    // For other categories (likelyto, neverhaveiever), use AppNavigator
                                    onQuestionPress(category);
                                }
                            } else {
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
                    />
                );
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
                        onBack={() => handleBottomTabChange('home')}
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
                        onLiveChatPress={onLiveChatPress}
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
            {renderScreen()}
            {!isScribbleLiveFullscreen && !['topicQuestions', 'widgetsLibrary', 'dailyChallenge', 'partnerPhotoCapture'].includes(currentTab) && (
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
                        {
                            transform: [{ translateX: slideAnim }],
                            zIndex: 9999,
                            backgroundColor: colors.background || '#FFFFFF',
                        },
                    ]}
                    {...panResponder.panHandlers}
                >
                    {accountPreview === 'journal' ? (
                        <JournalOnboardingScreen
                            onComplete={() => setAccountPreview(null)}
                        />
                    ) : accountPreview === 'questions' ? (
                        <QuestionsOnboardingScreen
                            onComplete={() => setAccountPreview(null)}
                        />
                    ) : accountPreview === 'widgets' ? (
                        <WidgetOnboardingScreen
                            onComplete={() => setAccountPreview(null)}
                            relationshipStartDate={
                                userData?.relationshipStartDate
                                || userData?.pendingRelationshipStartDate
                                || userData?.connectionDate
                            }
                            partnerPhoto={partnerCurrentPhoto}
                            myPhoto={myCurrentPhoto}
                            partnerName={partnerName}
                            hasPartner={hasPartner}
                            daysTogether={daysTogether}
                            partnerScribble={partnerScribble}
                        />
                    ) : (
                    <AccountScreen
                        userData={userData}
                        partnerName={partnerName}
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
                            setIsPremiumOpenInAccount(false);
                            onLogout();
                        }}
                        onDeleteAccount={() => {
                            setIsAccountVisible(false);
                            setIsPremiumOpenInAccount(false);
                            onDeleteAccount();
                        }}
                        onEditProfile={onEditProfile}
                        onAvatarPress={onAvatarPress}
                        onFindPartner={onFindPartner}
                        onNavigateToPremium={() => setIsPremiumOpenInAccount(true)}
                        onWidgetsPress={() => {
                            setIsAccountVisible(false);
                            setIsPremiumOpenInAccount(false);
                            setCurrentTab('widgetsLibrary');
                        }}
                        onJournalOnboardingPress={() => setAccountPreview('journal')}
                        onQuestionsOnboardingPress={() => setAccountPreview('questions')}
                        onWidgetOnboardingPress={() => setAccountPreview('widgets')}
                        onEditRelationshipDate={() => {
                            setIsAccountVisible(false);
                            onEditRelationshipDate?.();
                        }}
                        onBack={() => {
                            setIsAccountVisible(false);
                            setIsPremiumOpenInAccount(false);
                        }}
                    />
                    )}

                </Animated.View>
            )}

            <Modal
                visible={isPremiumOpenInAccount}
                animationType="slide"
                transparent={false}
                statusBarTranslucent={true}
                onRequestClose={() => setIsPremiumOpenInAccount(false)}
            >
                <PremiumScreen
                    onBack={() => setIsPremiumOpenInAccount(false)}
                />
            </Modal>

            <Modal
                visible={isHomePremiumVisible}
                animationType="slide"
                transparent={false}
                statusBarTranslucent={true}
                onRequestClose={() => {
                    setIsHomePremiumVisible(false);
                    setHomePremiumStep('free');
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

            <Modal
                visible={isMoodVisible && callState !== CALL_STATE.INCOMING}
                animationType="none"
                transparent={true}
                presentationStyle="overFullScreen"
                statusBarTranslucent={true}
                onRequestClose={closeMoodPicker}
            >
                {isMoodVisible && callState !== CALL_STATE.INCOMING && (
                    <MoodScreen
                        currentMood={getEmojiById(yourMood?.id) || getEmojiByLabel(yourMood?.label) || emojis[0]}
                        partnerMood={partnerMood ? (getEmojiById(partnerMood.id) || getEmojiByLabel(partnerMood.label)) : null}
                        partnerName={userData?.partnerUsername || partnerName || 'Your Love'}
                        onMoodSelect={(mood) => {
                            setMoodPreview(null);
                            setIsMoodRefreshPrompt(false);
                            onMoodSelect?.(mood);
                            setIsMoodVisible(false);
                        }}
                        onMoodPreview={setMoodPreview}
                        onBack={closeMoodPicker}
                        isRefreshPrompt={isMoodRefreshPrompt}
                        moodUpdatedAt={yourMood?.updatedAt}
                    />
                )}
            </Modal>

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
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
});

export default MainTabNavigator;
