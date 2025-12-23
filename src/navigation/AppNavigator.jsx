// Updated Navigator with premium theme and auth persistence
import React, { useState, useEffect, startTransition } from 'react';
import { View, StyleSheet } from 'react-native';
import WelcomeScreen from '../screens/WelcomeScreen';
import LoginScreen from '../screens/LoginScreen';
import PartnerCodeScreen from '../screens/PartnerCodeScreen';
import HomeScreen from '../screens/HomeScreen';
import MoodScreen from '../screens/MoodScreen';
import ScribbleScreen from '../screens/ScribbleScreen';
import QuestionsScreen from '../screens/QuestionsScreen';
import LikelyToQuestionScreen from '../screens/LikelyToQuestionScreen';
import NeverHaveIEverScreen from '../screens/NeverHaveIEverScreen';
import QuestionCategoriesScreen from '../screens/QuestionCategoriesScreen';
import InviteAcceptedScreen from '../screens/InviteAcceptedScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import MainTabNavigator from './MainTabNavigator';
import { colors } from '../theme';
import { getUser, saveUser, updateUser, isAuthenticated, isOnboarded, setOnboarded, clearAuth, isPaired, getPartnerCode } from '../utils/authStorage';
import { useSocketContext } from '../context/SocketContext';
import { registerFCMToken } from '../utils/pushNotifications';

export const AppNavigator = () => {
    const [currentScreen, setCurrentScreen] = useState(null); // null = loading
    const [yourMood, setYourMood] = useState({ emoji: '😊', label: 'Happy' });
    const [userData, setUserData] = useState({ name: '', age: '', gender: 'male' });
    const [pendingInvite, setPendingInvite] = useState(null); // Track pending invite
    const [selectedCategory, setSelectedCategory] = useState(null); // Track selected question category

    // Socket context for real-time sync
    const { socket, connect, disconnect, partnerMood, partnerOnline, userMood, partnerScribble } = useSocketContext();

    // Sync local yourMood state with socket userMood when it loads
    useEffect(() => {
        if (userMood) {
            setYourMood({ emoji: userMood.emoji, label: userMood.label });
        }
    }, [userMood]);

    // Check auth state on mount
    useEffect(() => {
        const checkAuthState = () => {
            try {
                const authenticated = isAuthenticated();
                const onboarded = isOnboarded();
                const storedUser = getUser();

                console.log('Auth state:', { authenticated, onboarded, storedUser });
                console.log(storedUser)

                if (authenticated && storedUser) {
                    // User is authenticated - check if paired
                    setUserData(prev => ({ ...prev, ...storedUser }));

                    // Connect to socket for real-time sync
                    connect();

                    // Register FCM token for push notifications
                    registerFCMToken();

                    if (storedUser.partnerId) {
                        // Already paired - go to home
                        setOnboarded(true);
                        setCurrentScreen('home');
                    } else {
                        // Not paired - show partner code screen
                        setCurrentScreen('partnerCode');
                    }
                } else {
                    // Not authenticated - show welcome
                    setCurrentScreen('welcome');
                }
            } catch (error) {
                console.error('Error checking auth state:', error);
                setCurrentScreen('welcome');
            }
        };

        checkAuthState();
    }, [connect]);

    // Use startTransition for non-blocking navigation
    const navigate = (screen) => {
        startTransition(() => {
            setCurrentScreen(screen);
        });
    };

    // Handle login - save user and navigate based on pairing status
    const handleLogin = (user) => {
        startTransition(() => {
            // Save user to MMKV storage
            saveUser(user);

            // Set initial data from login (name from Google/Apple)
            setUserData({
                ...userData,
                ...user
            });

            // Connect to socket for real-time sync
            connect();

            // Check if user is already paired
            if (user.partnerId) {
                setOnboarded(true);
                setCurrentScreen('home');
            } else {
                // Not paired - show partner code screen
                setCurrentScreen('partnerCode');
            }
        });
    };

    // Handle successful pairing
    const handlePartnerPaired = (partner) => {
        startTransition(() => {
            // Update stored user with partner info
            const updatedUser = updateUser({
                partnerId: partner.id,
                partnerUsername: partner.name,
                connectionDate: partner.connectionDate,
            });
            if (updatedUser) {
                setUserData(prev => ({ ...prev, ...updatedUser }));
            }
            setOnboarded(true);
            setCurrentScreen('home');
        });
    };

    // Handle skip partner pairing
    const handleSkipPartner = () => {
        startTransition(() => {
            setOnboarded(true);
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
            setUserData(prev => ({ ...prev, ...data }));
            setPendingInvite({
                partnerUsername: data.partnerUsername,
                sentAt: new Date().toISOString(),
            });
            setOnboarded(true); // Mark as onboarded
            setCurrentScreen('home');
        });
    };

    // Handle when partner accepts the invite
    const handleInviteAccepted = () => {
        startTransition(() => {
            setPendingInvite(null); // Clear pending invite
            setOnboarded(true); // Mark as onboarded
            setCurrentScreen('home');
        });
    };

    // Handle logout - clear auth and go to welcome
    const handleLogout = () => {
        startTransition(() => {
            clearAuth();
            setUserData({ name: '', age: '', gender: 'male' });
            setPendingInvite(null);
            setCurrentScreen('welcome');
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
            case 'welcome':
                return (
                    <WelcomeScreen
                        onGetStarted={() => navigate('login')}
                    />
                );

            case 'login':
                return (
                    <LoginScreen
                        onLogin={handleLogin}
                        onBack={() => navigate('welcome')}
                        onSignUp={() => navigate('login')}
                    />
                );

            case 'partnerCode':
                return (
                    <PartnerCodeScreen
                        partnerCode={userData.partnerCode || getPartnerCode() || 'XXXXXX'}
                        userId={userData.id}
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
                // Compute partner status from actual user data
                const hasPartner = !!userData.partnerId;
                const partnerDisplayName = userData.partnerUsername || null;
                const daysCount = userData.connectionDate
                    ? Math.floor((new Date() - new Date(userData.connectionDate)) / (1000 * 60 * 60 * 24))
                    : 0;

                return (
                    <MainTabNavigator
                        partnerName={partnerDisplayName}
                        daysTogether={daysCount}
                        hasPartner={hasPartner}
                        yourMood={yourMood}
                        partnerMood={partnerMood}
                        partnerOnline={partnerOnline}
                        partnerScribble={partnerScribble}
                        pendingInvite={pendingInvite}
                        onMoodPress={() => navigate('mood')}
                        onScribblePress={() => navigate('scribble')}
                        onQuestionPress={(category) => {
                            if (category) {
                                setSelectedCategory(category);
                                navigate('questions');
                            } else {
                                navigate('questionCategories');
                            }
                        }}
                        onEditProfile={() => navigate('editProfile')}
                        onFindPartner={() => navigate('partnerCode')}
                        userData={userData}
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
                    />
                );

            case 'questionCategories':
                // Calculate streak for question categories
                const qcDaysCount = userData.connectionDate
                    ? Math.floor((new Date() - new Date(userData.connectionDate)) / (1000 * 60 * 60 * 24))
                    : 0;
                return (
                    <QuestionCategoriesScreen
                        partnerName={userData.partnerUsername || 'Your Love'}
                        streak={qcDaysCount || 1}
                        onSelectCategory={(category) => {
                            setSelectedCategory(category);
                            navigate('questions');
                        }}
                        onBack={() => navigate('home')}
                    />
                );

            case 'questions':
                // Route likelyto questions to dedicated screen
                if (selectedCategory?.id === 'likelyto') {
                    return (
                        <LikelyToQuestionScreen
                            currentQuestion={{
                                id: '1',
                                text: "Who is more likely to forget an anniversary?",
                                number: 1,
                                total: 12,
                            }}
                            partnerName={userData.partnerUsername || 'Your Love'}
                            userName={userData.name || 'You'}
                            onSubmitAnswer={(answer) => {
                                console.log('LikelyTo answer:', answer);
                            }}
                            onBack={() => navigate('questionCategories')}
                        />
                    );
                }

                // Route neverhaveiever to Never Have I Ever screen
                if (selectedCategory?.id === 'neverhaveiever') {
                    return (
                        <NeverHaveIEverScreen
                            currentQuestion={{
                                id: '1',
                                statement: "stalked my ex on social media",
                                number: 1,
                                total: 18,
                                spiceLevel: 'mild',
                                options: ['I have', 'Never'],
                            }}
                            partnerName={userData.partnerUsername || 'Your Love'}
                            onSubmitAnswer={(answer) => {
                                console.log('NeverHaveIEver answer:', answer);
                            }}
                            onBack={() => navigate('questionCategories')}
                        />
                    );
                }
                return (
                    <QuestionsScreen
                        currentQuestion={{
                            id: '1',
                            text: selectedCategory?.id === 'knowledge'
                                ? "What's my biggest pet peeve?"
                                : selectedCategory?.id === 'agreement'
                                    ? "What's the perfect vacation destination?"
                                    : selectedCategory?.id === 'neverhaveiever'
                                        ? "Never have I ever... forgotten to reply to a message for days"
                                        : "What's something you've never told me that you appreciate about us?",
                            category: selectedCategory?.id || 'deep',
                        }}
                        partnerName={userData.partnerUsername || null}
                        isLocked={true}
                        onSubmitAnswer={(answer) => {
                            console.log('Submitted answer:', answer);
                        }}
                        onBack={() => navigate('questionCategories')}
                    />
                );

            case 'editProfile':
                return (
                    <EditProfileScreen
                        userData={userData}
                        onSave={(updatedUser) => {
                            setUserData(prev => ({ ...prev, ...updatedUser }));
                            navigate('home');
                        }}
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
