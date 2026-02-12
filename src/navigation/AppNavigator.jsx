// Updated Navigator with premium theme and auth persistence
import React, { useState, useEffect, startTransition, useCallback, useMemo } from 'react';
import { View, StyleSheet, Alert, Platform } from 'react-native';
import SpInAppUpdates, { IAUUpdateKind, IAUInstallStatus } from 'sp-react-native-in-app-updates';
import { useSelector, useDispatch } from 'react-redux';
import LoginScreen from '../screens/LoginScreen';
import NicknameScreen from '../screens/NicknameScreen';
import PartnerCodeScreen from '../screens/PartnerCodeScreen';
import HomeScreen from '../screens/HomeScreen';
import MoodScreen from '../screens/MoodScreen';
import ScribbleScreen from '../screens/ScribbleScreen';
import QuestionsScreen from '../screens/QuestionsScreen';
import LikelyToQuestionScreen from '../screens/LikelyToQuestionScreen';
import NeverHaveIEverScreen from '../screens/NeverHaveIEverScreen';
import TopicQuestionsScreen from '../screens/TopicQuestionsScreen';
import ChatScreen from '../screens/ChatScreen';
import AnimatedOnboardingScreen from '../screens/AnimatedOnboardingScreen';
import NotificationPermissionScreen from '../screens/NotificationPermissionScreen';

import { TOPIC_CATEGORIES } from '../constants/Categories';
import InviteAcceptedScreen from '../screens/InviteAcceptedScreen';
import JigsawCreateScreen from '../screens/JigsawCreateScreen';
import JigsawPuzzleScreen from '../screens/JigsawPuzzleScreen';
import TicTacToeScreen from '../screens/TicTacToeScreen';
import WordleScreen from '../screens/WordleScreen';
import AvatarSelectionScreen from '../screens/AvatarSelectionScreen';
import PremiumScreen from '../screens/PremiumScreen';
import MainTabNavigator from './MainTabNavigator';
import { colors } from '../theme';
import { getUser, saveUser, updateUser as updateUserStorage, isAuthenticated, setOnboarded as setOnboardedStorage, clearAuth, getPartnerCode, hasSeenOnboarding, setSeenOnboarding } from '../utils/authStorage';
import { useSocketContext } from '../context/SocketContext';
import { getApp } from '@react-native-firebase/app';
import { registerFCMToken, setupForegroundMessageHandler, onNotificationOpenedApp, getInitialNotification, getMessaging, setupTokenRefreshListener, checkNotificationPermission } from '../utils/pushNotifications';
import { API_BASE } from '../constants/Api';
import { setAuthErrorHandler } from '../utils/apiFetch';
// Redux actions
import { setUser, updateUser, setPartner, setOnboarded, setCustomerInfo, setPremiumStatus, logout } from '../store/slices/userSlice';
import { setPendingPuzzle, setPendingTicTacToe, setActiveTicTacToe, setPendingWordle, setActiveWordle, setSelectedPuzzle, setSelectedTicTacToe, setSelectedWordle } from '../store/slices/gamesSlice';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

export const AppNavigator = () => {
    const dispatch = useDispatch();

    // Redux state
    const userData = useSelector(state => state.user);
    const games = useSelector(state => state.games);
    const { pendingPuzzle, selectedPuzzle, pendingTicTacToe, activeTicTacToe, selectedTicTacToe, pendingWordle, activeWordle, selectedWordle } = games;

    // Local state (navigation & UI only)
    const [currentScreen, setCurrentScreen] = useState(null); // null = loading
    const [yourMood, setYourMood] = useState({ emoji: '😊', label: 'Happy' });
    const [pendingInvite, setPendingInvite] = useState(null); // Track pending invite
    const [selectedCategory, setSelectedCategory] = useState(null); // Track selected question category
    const [selectedChat, setSelectedChat] = useState(null); // Track selected chat for ChatScreen

    // Socket context for real-time sync
    const { socket, connect, disconnect, partnerMood, partnerOnline, userMood, partnerScribble } = useSocketContext();

    // In-app update instance (debug flag mirrors __DEV__)
    const inAppUpdates = useMemo(() => new SpInAppUpdates(__DEV__), []);

    const purchasesConfiguredRef = React.useRef(false);
    const initPurchases = React.useCallback(async () => {
        try {
            if (purchasesConfiguredRef.current) return;

            Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
            const apiKey = Platform.OS === 'ios'
                ? 'appl_XNiOeilxYHFbHHJIzrroDvhxQDA'
                : 'goog_MgqwBDTfVyuiMCQtLAKlcxcbhZG';

            await Purchases.configure({ apiKey });

            // Verify SDK is actually working by fetching customer info
            await Purchases.getCustomerInfo();
            purchasesConfiguredRef.current = true;
        } catch (e) {
            purchasesConfiguredRef.current = false;
            const errorInfo = e?.message || e?.underlyingErrorMessage || String(e);
            const errorCode = e?.code;
            console.error(`❌ RevenueCat SDK configuration failed (Code: ${errorCode}):`, errorInfo);

            // Only alert if it's a critical non-network error
            if (__DEV__ || (errorCode !== 0 && errorCode !== 1)) {
                Alert.alert(
                    'Subscription Service Error',
                    `Failed to initialize the subscription service. Error Code: ${errorCode}\n\n${errorInfo}`,
                    [{ text: 'OK' }]
                );
            }
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
                const result = await Purchases.logIn(String(appUserId));
            }
        } catch (e) {
        }
    }, [initPurchases]);

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

            // Update backend
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

            // Update local storage
            updateUserStorage({
                isPremium: hasActive,
                premiumExpiresAt: hasActive ? premiumExpiresAt : null,
                premiumPlan: hasActive ? premiumPlan : null,
            });

            // Update Redux state
            dispatch(setPremiumStatus({
                isPremium: hasActive,
                premiumExpiresAt: hasActive ? premiumExpiresAt : null,
                premiumPlan: hasActive ? premiumPlan : null,
            }));

        } catch (e) {
        }
    }, [initPurchases, dispatch]);

    useEffect(() => {
        initPurchases();
    }, []);

    // ── In-app update check (runs once on launch, skipped in dev) ──
    useEffect(() => {
        if (__DEV__) return;

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
    }, [inAppUpdates]);

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
            setYourMood({ emoji: userMood.emoji, label: userMood.label });
        }
    }, [userMood]);

    // Listen for Wordle socket events for real-time updates
    useEffect(() => {
        if (!socket || !userData?.id) return;

        const handleWordleInvite = (data) => {
            fetchPendingWordle(userData.id);
        };

        const handleWordleUpdate = (data) => {
            fetchPendingWordle(userData.id);
        };

        socket.on('wordle:invite', handleWordleInvite);
        socket.on('wordle:update', handleWordleUpdate);

        return () => {
            socket.off('wordle:invite', handleWordleInvite);
            socket.off('wordle:update', handleWordleUpdate);
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
                        partnerIsPremium: statusData.partner.isPremium || false,
                        partnerPremiumPlan: statusData.partner.premiumPlan || null,
                        partnerPremiumExpiresAt: statusData.partner.premiumExpiresAt || null,
                    };
                    const userPremium = userData.isPremium;
                    const partnerPremium = statusData.partner.isPremium || false;
                    const effectivePremium = userPremium || partnerPremium;
                    const premiumSource = userPremium ? (userData.premiumSource || 'self') : (partnerPremium ? 'partner' : null);

                    updateUserStorage({ ...partnerData, isPremium: effectivePremium, premiumSource });
                    dispatch(updateUser({ ...partnerData, isPremium: effectivePremium, premiumSource, isOnboarded: true }));
                    dispatch(setPartner({
                        id: statusData.partner.id,
                        name: statusData.partner.name,
                        avatar: statusData.partner.avatar || null,
                        connectionDate: statusData.connectionDate,
                    }));
                    setOnboardedStorage(true);

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

    // Setup Notification Listeners
    useEffect(() => {
        // 1. Initial Notification (App opened from quit state)
        getInitialNotification(getMessaging(getApp())).then(remoteMessage => {
            if (remoteMessage) {
                // Handle navigation here if needed, e.g. navigate('chat')
            }
        });

        // 2. Notification Opened App (App opened from background state)
        const unsubscribeOpenedApp = onNotificationOpenedApp(getMessaging(getApp()), remoteMessage => {
            // Handle navigation here if needed
        });

        // 3. Foreground Message Handler
        const unsubscribeForeground = setupForegroundMessageHandler((remoteMessage) => {
            Alert.alert(
                remoteMessage.notification?.title || 'New Notification',
                remoteMessage.notification?.body || 'You have a new message',
                [
                    { text: 'OK', onPress: () => { } }
                ]
            );
        });

        // 4. Token Refresh Listener - handles token rotation by Firebase
        const unsubscribeTokenRefresh = setupTokenRefreshListener();

        return () => {
            unsubscribeOpenedApp();
            if (unsubscribeForeground) unsubscribeForeground();
            if (unsubscribeTokenRefresh) unsubscribeTokenRefresh();
        };
    }, []);

    // Check auth state on mount
    useEffect(() => {
        const checkAuthState = async () => {
            try {
                const authenticated = isAuthenticated();
                const storedUser = getUser();


                if (authenticated && storedUser) {
                    // User is authenticated - dispatch to Redux
                    dispatch(setUser(storedUser));

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
                                partnerIsPremium: statusData.partner.isPremium || false,
                                partnerPremiumPlan: statusData.partner.premiumPlan || null,
                                partnerPremiumExpiresAt: statusData.partner.premiumExpiresAt || null,
                            };
                            // Compute couple premium
                            const userPremium = storedUser.isPremium;
                            const partnerPremium = statusData.partner.isPremium || false;
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
                        }
                    } catch (err) {
                        // Continue with local data if server check fails
                    }

                    // FIRST check if user has a nickname - required before anything else
                    if (!storedUser.nickname) {
                        // No nickname yet - show nickname screen first
                        setCurrentScreen('nickname');
                    } else if (storedUser.partnerId) {
                        // Has nickname and is paired - go to home
                        dispatch(setOnboarded(true));
                        setOnboardedStorage(true);
                        setCurrentScreen('home');

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
    }, [connect, dispatch]);

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
        startTransition(() => {
            setCurrentScreen(screen);

            // Refresh pending puzzles, TicTacToe, and Wordle when navigating to home
            if (screen === 'home' && userData?.id) {
                fetchPendingPuzzle(userData.id);
                fetchPendingTicTacToe(userData.id);
                fetchPendingWordle(userData.id);
            }
        });
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

            // FIRST check if user has a nickname - required before anything else
            if (!user.nickname) {
                // No nickname yet - show nickname screen first
                setCurrentScreen('nickname');
            } else if (user.partnerId) {
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
            // Check if already paired
            if (userData.partnerId) {
                // Already paired - go to home
                dispatch(setOnboarded(true));
                setOnboardedStorage(true);
                setCurrentScreen('home');
            } else {
                // Not paired - navigate to partner code screen
                setCurrentScreen('partnerCode');
            }
        });
    };

    // Handle avatar completion
    const handleAvatarComplete = () => {
        startTransition(() => {
            // Check if already paired
            if (userData.partnerId) {
                // Already paired - go to home
                dispatch(setOnboarded(true));
                setOnboardedStorage(true);
                setCurrentScreen('home');
            } else {
                // Not paired - navigate to partner code screen
                setCurrentScreen('partnerCode');
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
        };
        updateUserStorage(partnerData);
        dispatch(setPartner(partner));
        setOnboardedStorage(true);

        // Check if notification permission is already granted
        const hasPermission = await checkNotificationPermission();
        startTransition(() => {
            if (hasPermission) {
                setCurrentScreen('home');
            } else {
                setCurrentScreen('notificationPermission');
            }
        });
    };

    // Handle skip partner pairing
    const handleSkipPartner = async () => {
        dispatch(setOnboarded(true));
        setOnboardedStorage(true);

        // Check if notification permission is already granted
        const hasPermission = await checkNotificationPermission();
        startTransition(() => {
            if (hasPermission) {
                setCurrentScreen('home');
            } else {
                setCurrentScreen('notificationPermission');
            }
        });
    };

    // Handle notification permission completion (allow or skip)
    const handleNotificationComplete = () => {
        startTransition(() => {
            setCurrentScreen('home');
        });
    };

    const handleMoodSelect = (mood) => {
        // Update local mood state immediately
        setYourMood({ emoji: mood.emoji, label: mood.label });

        // Send mood to backend via WebSocket (fire and forget - don't wait for response)
        if (socket) {
            socket.emit('mood:update', { emoji: mood.emoji, label: mood.label });
        }

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

    // Handle when partner accepts the invite
    const handleInviteAccepted = () => {
        startTransition(() => {
            setPendingInvite(null); // Clear pending invite
            dispatch(setOnboarded(true));
            setOnboardedStorage(true);
            setCurrentScreen('home');
        });
    };

    // Handle logout - clear auth and go to login
    const handleLogout = () => {
        startTransition(() => {
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
            clearAuth();
            dispatch(logout());
            setPendingInvite(null);
            setCurrentScreen('login');
        });
    }, [dispatch]);

    // Set up the global auth error handler
    useEffect(() => {
        setAuthErrorHandler(handleAuthError);
        return () => setAuthErrorHandler(null);
    }, [handleAuthError]);

    // Handle onboarding completion
    const handleOnboardingComplete = () => {
        startTransition(() => {
            setSeenOnboarding(true);
            setCurrentScreen('login');
        });
    };

    const renderScreen = () => {

        // Loading state while checking auth
        if (currentScreen === null) {
            return (
                <View style={styles.loadingContainer}>
                    <View style={styles.loadingDot} />
                </View>
            );
        }

        switch (currentScreen) {
            case 'onboarding':
                return (
                    <AnimatedOnboardingScreen
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

            case 'avatarSelection':
                return (
                    <AvatarSelectionScreen
                        onComplete={handleAvatarComplete}
                        onBack={() => navigate('home')}
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

            case 'inviteAccepted':
                return (
                    <InviteAcceptedScreen
                        yourName={userData.name || 'You'}
                        partnerName="Emma"
                        onContinue={handleInviteAccepted}
                    />
                );

            case 'home':
                return (
                    <MainTabNavigator
                        yourMood={yourMood}
                        pendingInvite={pendingInvite}
                        onMoodPress={() => navigate('mood')}
                        onQuestionPress={(category) => {
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
                    />
                );

            case 'mood':
                return (
                    <MoodScreen
                        currentMood={{ id: 'happy', ...yourMood, color: colors.moodHappy, gradient: ['#FFD60A40', '#FFD60A10'] }}
                        partnerMood={{ id: 'love', ...partnerMood, color: colors.moodLove, gradient: ['#FF2D7840', '#FF2D7810'] }}
                        partnerName={userData.partnerUsername || null}
                        onMoodSelect={handleMoodSelect}
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

                // For topic-based categories (future, money, hotspicy, etc.), use TopicQuestionsScreen
                const topicConfig = TOPIC_CATEGORIES[selectedCategory?.id];
                if (topicConfig) {
                    return (
                        <TopicQuestionsScreen
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
                        navigation={{ goBack: () => navigate('home') }}
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
                        navigation={{ goBack: () => navigate('home') }}
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
                        navigation={{ goBack: () => navigate('home') }}
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
                        navigation={{ goBack: () => navigate('home'), navigate }}
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
                        onBack={() => navigate('home')}
                    />
                );

            case 'premium':
                return (
                    <PremiumScreen
                        onBack={() => navigate('home')}
                    />
                );

            default:
                return null;
        }
    };

    return <View style={styles.container}>{renderScreen()}</View>;
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
    loadingDot: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.primary,
        opacity: 0.6,
    },
});

export default AppNavigator;
