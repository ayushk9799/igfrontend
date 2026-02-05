// Updated Navigator with premium theme and auth persistence
import React, { useState, useEffect, startTransition } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
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

import { TOPIC_CATEGORIES } from '../constants/Categories';
import InviteAcceptedScreen from '../screens/InviteAcceptedScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import JigsawCreateScreen from '../screens/JigsawCreateScreen';
import JigsawPuzzleScreen from '../screens/JigsawPuzzleScreen';
import TicTacToeScreen from '../screens/TicTacToeScreen';
import WordleScreen from '../screens/WordleScreen';
import AvatarSelectionScreen from '../screens/AvatarSelectionScreen';
import MainTabNavigator from './MainTabNavigator';
import { colors } from '../theme';
import { getUser, saveUser, updateUser as updateUserStorage, isAuthenticated, setOnboarded as setOnboardedStorage, clearAuth, getPartnerCode, hasSeenOnboarding, setSeenOnboarding } from '../utils/authStorage';
import { useSocketContext } from '../context/SocketContext';
import { getApp } from '@react-native-firebase/app';
import { registerFCMToken, setupForegroundMessageHandler, onNotificationOpenedApp, getInitialNotification, getMessaging, setupTokenRefreshListener } from '../utils/pushNotifications';
import { API_BASE } from '../constants/Api';
// Redux actions
import { setUser, updateUser, setPartner, setOnboarded, logout } from '../store/slices/userSlice';
import { setPendingPuzzle, setPendingTicTacToe, setActiveTicTacToe, setPendingWordle, setActiveWordle, setSelectedPuzzle, setSelectedTicTacToe, setSelectedWordle } from '../store/slices/gamesSlice';

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
            console.log('🎯 Received wordle:invite', data);
            fetchPendingWordle(userData.id);
        };

        const handleWordleUpdate = (data) => {
            console.log('🎯 Received wordle:update', data);
            fetchPendingWordle(userData.id);
        };

        socket.on('wordle:invite', handleWordleInvite);
        socket.on('wordle:update', handleWordleUpdate);

        return () => {
            socket.off('wordle:invite', handleWordleInvite);
            socket.off('wordle:update', handleWordleUpdate);
        };
    }, [socket, userData?.id]);

    // Setup Notification Listeners
    useEffect(() => {
        // 1. Initial Notification (App opened from quit state)
        getInitialNotification(getMessaging(getApp())).then(remoteMessage => {
            if (remoteMessage) {
                console.log('🔔 App opened from quit state via notification:', remoteMessage.notification);
                // Handle navigation here if needed, e.g. navigate('chat')
            }
        });

        // 2. Notification Opened App (App opened from background state)
        const unsubscribeOpenedApp = onNotificationOpenedApp(getMessaging(getApp()), remoteMessage => {
            console.log('🔔 App opened from background via notification:', remoteMessage.notification);
            // Handle navigation here if needed
        });

        // 3. Foreground Message Handler
        const unsubscribeForeground = setupForegroundMessageHandler((remoteMessage) => {
            console.log('🔔 Foreground notification received:', remoteMessage);
            Alert.alert(
                remoteMessage.notification?.title || 'New Notification',
                remoteMessage.notification?.body || 'You have a new message',
                [
                    { text: 'OK', onPress: () => console.log('OK Pressed') }
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

                console.log('Auth state:', { authenticated, storedUser });
                console.log(storedUser)

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
                        console.log('Partner status from server:', statusData);

                        if (statusData.success && statusData.isPaired) {
                            // Sync latest partner data from server
                            console.log('Syncing partner data from server');
                            const partnerData = {
                                partnerId: statusData.partner.id,
                                partnerUsername: statusData.partner.name,
                                partnerAvatar: statusData.partner.avatar || null,
                                connectionDate: statusData.connectionDate,
                            };
                            updateUserStorage(partnerData);
                            dispatch(updateUser({ ...partnerData, isOnboarded: true }));

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
                        console.log('Could not fetch partner status:', err.message);
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
            console.log('🧩 Fetching pending puzzles for user:', userId);
            const response = await fetch(`${API_BASE}/api/puzzle/pending/${userId}`);
            const data = await response.json();
            console.log('🧩 Puzzle API response:', data);
            if (data.success && data.data.length > 0) {
                dispatch(setPendingPuzzle(data.data[0])); // Show first pending puzzle
                console.log('🧩 Pending puzzle found:', data.data[0]);
            } else {
                dispatch(setPendingPuzzle(null));
                console.log('🧩 No pending puzzles');
            }
        } catch (err) {
            console.log('🧩 Error fetching puzzles:', err.message);
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
            console.log('🎮 Fetching pending TicTacToe for user:', userId);
            const response = await fetch(`${API_BASE}/api/tictactoe/pending/${userId}`);
            const data = await response.json();
            console.log('🎮 TicTacToe API response:', data);
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
                console.log('🎮 Active TicTacToe:', data.data[0]._id, '| My turn:', myTurnGame ? 'yes' : 'no');
            } else {
                dispatch(setActiveTicTacToe(null));
                dispatch(setPendingTicTacToe(null));
                console.log('🎮 No pending TicTacToe games');
            }
        } catch (err) {
            console.log('🎮 Error fetching TicTacToe:', err.message);
            dispatch(setActiveTicTacToe(null));
            dispatch(setPendingTicTacToe(null));
        }
    };

    // Fetch pending Wordle games for the user
    const fetchPendingWordle = async (userId) => {
        if (!userId) return;
        try {
            console.log('🎯 Fetching pending Wordle for user:', userId);
            const response = await fetch(`${API_BASE}/api/wordle/pending/${userId}`);
            const data = await response.json();
            console.log('🎯 Wordle API response:', data);
            if (data.success && data.data.length > 0) {
                // User is the guesser (partner) - show pending
                dispatch(setPendingWordle(data.data[0]));
                dispatch(setActiveWordle(null));
                console.log('🎯 Pending Wordle to guess:', data.data[0]._id);
            } else {
                // Check if user has an active game as creator
                const activeResponse = await fetch(`${API_BASE}/api/wordle/active/${userId}`);
                const activeData = await activeResponse.json();
                if (activeData.success && activeData.data && activeData.isCreator) {
                    dispatch(setActiveWordle(activeData.data));
                    dispatch(setPendingWordle(null));
                    console.log('🎯 Active Wordle (waiting for partner):', activeData.data._id);
                } else {
                    dispatch(setActiveWordle(null));
                    dispatch(setPendingWordle(null));
                    console.log('🎯 No pending Wordle games');
                }
            }
        } catch (err) {
            console.log('🎯 Error fetching Wordle:', err.message);
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
            console.log('userData', userData);
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
    const handlePartnerPaired = (partner) => {
        startTransition(() => {
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
            setCurrentScreen('home');
        });
    };

    // Handle skip partner pairing
    const handleSkipPartner = () => {
        startTransition(() => {
            dispatch(setOnboarded(true));
            setOnboardedStorage(true);
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

    // Handle onboarding completion
    const handleOnboardingComplete = () => {
        startTransition(() => {
            setSeenOnboarding(true);
            setCurrentScreen('login');
        });
    };

    const renderScreen = () => {
        console.log('currentScreen:', currentScreen);

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
                        onPaired={handlePartnerPaired}
                        onSkip={handleSkipPartner}
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
                                console.log("category", category);
                                setSelectedCategory(category);
                                navigate('questions');
                            } else {
                                console.log("category", "else");
                                navigate('dailyChallenge');
                            }
                        }}
                        onEditProfile={() => navigate('editProfile')}
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
                        onLogout={handleLogout}
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
                            console.log('Sending scribble:', paths);
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
                                console.log('LikelyTo answer:', answer);
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
                                console.log('NeverHaveIEver answer:', answer);
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
                            console.log('Submitted answer:', answer);
                            navigate('home');
                        }}
                        onBack={() => navigate('home')}
                    />
                );

            case 'editProfile':
                return (
                    <EditProfileScreen
                        userData={userData}
                        onSave={(updatedUser) => {
                            updateUserStorage(updatedUser);
                            dispatch(updateUser(updatedUser));
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
                        navigation={{ goBack: () => navigate('home') }}
                        route={{
                            params: {
                                gameId: selectedWordle?._id,
                                gameData: selectedWordle,
                                partnerId: userData.partnerId,
                                partnerName: userData.partnerUsername || 'Partner',
                            }
                        }}
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
