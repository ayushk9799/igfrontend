// Main Tab Navigator - Home with Bottom Tabs
// Now uses Redux for global state instead of prop drilling
import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, BackHandler, Modal } from 'react-native';
import { useSelector } from 'react-redux';
import HomeScreen from '../screens/HomeScreen';
import AccountScreen from '../screens/AccountScreen';
import ScribbleScreen from '../screens/ScribbleScreen';
import DailyChallengeScreen from '../screens/DailyChallengeScreen';
import TopicQuestionsScreen from '../screens/TopicQuestionsScreen';
import ChatListScreen from '../screens/ChatListScreen';
import NotificationCenterScreen from '../screens/NotificationCenterScreen';
import PremiumScreen from '../screens/PremiumScreen';
import BottomTabBar from '../components/BottomTabBar';
import { colors } from '../theme';
import { useSocketContext } from '../context/SocketContext';
import { selectUser, selectHasPartner, selectPartnerName, selectDaysTogether, selectIsPremium } from '../store/slices/userSlice';
import { selectGames } from '../store/slices/gamesSlice';
import { selectDuelBadgeCount } from '../store/slices/notificationsSlice';
import { TOPIC_CATEGORIES } from '../constants/Categories';
import { API_BASE } from '../constants/Api';

export const MainTabNavigator = ({
    // Only keep essential callbacks that navigate outside this component
    yourMood,
    pendingInvite,
    initialTab,
    onMoodPress,
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
}) => {
    const [currentTab, setCurrentTab] = useState(initialTab || 'home');
    const [selectedTopic, setSelectedTopic] = useState(null); // Track selected topic for TopicQuestionsScreen
    const [selectedChat, setSelectedChat] = useState(null); // Track selected chat for ChatScreen
    const [chatBadge, setChatBadge] = useState(0); // Unread chat count for badge
    const [isAccountVisible, setIsAccountVisible] = useState(false);
    const [isPremiumOpenInAccount, setIsPremiumOpenInAccount] = useState(false);
    const [isNotificationVisible, setIsNotificationVisible] = useState(false);

    // Redux state
    const userData = useSelector(selectUser);
    const hasPartner = useSelector(selectHasPartner);
    const partnerName = useSelector(selectPartnerName);
    const daysTogether = useSelector(selectDaysTogether);
    const isPremium = useSelector(selectIsPremium);

    const effectivePremiumSource = userData?.premiumSource ||
        (userData?.premiumExpiresAt && new Date(userData.premiumExpiresAt) > new Date() ? 'self' :
            (userData?.partnerPremiumExpiresAt && new Date(userData.partnerPremiumExpiresAt) > new Date() ? 'partner' : null));
    const effectivePremiumExpiresAt = effectivePremiumSource === 'partner'
        ? userData?.partnerPremiumExpiresAt
        : userData?.premiumExpiresAt;
    const effectivePremiumPlan = effectivePremiumSource === 'partner'
        ? userData?.partnerPremiumPlan
        : userData?.premiumPlan;
    const games = useSelector(selectGames);
    const { pendingPuzzle, pendingTicTacToe, activeTicTacToe, pendingWordle, activeWordle } = games;

    // Duel notification badge count
    const duelBadgeCount = useSelector(selectDuelBadgeCount);

    // Socket context for real-time data
    const { socket, partnerMood, partnerOnline, partnerScribble } = useSocketContext();

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

    // Listen for new chat messages to update badge
    useEffect(() => {
        if (!socket) return;

        const handleChatNotification = () => {
            // Increment badge when notification received (unless on chats tab)
            if (currentTab !== 'chats') {
                setChatBadge(prev => prev + 1);
            }
        };

        socket.on('chat:notification', handleChatNotification);

        return () => {
            socket.off('chat:notification', handleChatNotification);
        };
    }, [socket, currentTab]);

    // Clear badge when entering chats tab
    useEffect(() => {
        if (currentTab === 'chats') {
            setChatBadge(0);
        }
    }, [currentTab]);

    // Handle Android back button/gesture - navigate to home tab from sub-tabs
    useEffect(() => {
        const backAction = () => {
            if (currentTab !== 'home') {
                setCurrentTab('home');
                return true; // Prevent default (app exit)
            }
            return false; // Let AppNavigator or OS handle it
        };

        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, [currentTab]);

    const renderScreen = () => {
        switch (currentTab) {
            case 'home':
                return (
                    <HomeScreen
                        partnerName={partnerName}
                        daysTogether={daysTogether}
                        hasPartner={hasPartner}
                        yourMood={yourMood}
                        partnerMood={partnerMood}
                        partnerOnline={partnerOnline}
                        partnerScribble={partnerScribble}
                        pendingInvite={pendingInvite}
                        onMoodPress={onMoodPress}
                        onScribblePress={() => setCurrentTab('canvas')}
                        onQuestionPress={(category) => {
                            if (category) {
                                // Check if it's a topic-based category (future, money, hotspicy, etc.)
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
                        onJigsawCreate={onJigsawCreate}
                        onJigsawPlay={onJigsawPlay}
                        pendingPuzzle={pendingPuzzle}
                        onRefreshPuzzle={onRefreshPuzzle}
                        pendingTicTacToe={pendingTicTacToe}
                        activeTicTacToe={activeTicTacToe}
                        onTicTacToePress={onTicTacToePress}
                        pendingWordle={pendingWordle}
                        activeWordle={activeWordle}
                        onWordlePress={onWordlePress}
                        duelBadgeCount={duelBadgeCount}
                        onNotificationPress={() => setIsNotificationVisible(true)}
                    />
                );
            case 'canvas':
                return (
                    <ScribbleScreen
                        onBack={() => setCurrentTab('home')}
                        hasPartner={hasPartner}
                        onLinkPartner={onFindPartner}
                    />
                );
            case 'dailyChallenge':
                return (
                    <DailyChallengeScreen
                        partnerName={partnerName}
                        userName={userData?.name || 'You'}
                        userAvatar={userData?.avatar || null}
                        partnerAvatar={userData?.partnerAvatar || null}
                        userId={userData?._id || userData?.id}
                        hasPartner={hasPartner}
                        onLinkPartner={onFindPartner}
                        onBack={() => setCurrentTab('home')}
                    />
                );
            case 'topicQuestions':
                const topicConfig = TOPIC_CATEGORIES[selectedTopic];
                if (!topicConfig) {
                    setCurrentTab('home');
                    return null;
                }
                return (
                    <TopicQuestionsScreen
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
            <BottomTabBar
                currentTab={currentTab}
                onTabChange={setCurrentTab}
                chatBadge={chatBadge}
            />

            <Modal
                visible={isAccountVisible}
                animationType="slide"
                transparent={false}
                statusBarTranslucent={true}
                onRequestClose={() => {
                    setIsAccountVisible(false);
                    setIsPremiumOpenInAccount(false);
                }}
            >
                <AccountScreen
                    userData={userData}
                    partnerName={partnerName}
                    hasPartner={hasPartner}
                    isPremium={isPremium}
                    premiumPlan={effectivePremiumPlan}
                    premiumExpiresAt={effectivePremiumExpiresAt}
                    premiumSource={effectivePremiumSource}
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
                    onBack={() => {
                        setIsAccountVisible(false);
                        setIsPremiumOpenInAccount(false);
                    }}
                />

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

