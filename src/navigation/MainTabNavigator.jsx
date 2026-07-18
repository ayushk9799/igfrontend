// Main Tab Navigator - Home with Bottom Tabs
// Now uses Redux for global state instead of prop drilling
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, BackHandler, Modal, Animated, Dimensions, PanResponder } from 'react-native';
import { useSelector } from 'react-redux';
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
import MoodScreen from '../screens/MoodScreen';
import WidgetsLibraryScreen from '../screens/WidgetsLibraryScreen';
import CouplePhotoCaptureScreen from '../screens/CouplePhotoCaptureScreen';
import { getEmojiById, getEmojiByLabel, emojis } from '../constants/Moods';
import BottomTabBar from '../components/BottomTabBar';
import { colors } from '../theme';
import { useSocketContext } from '../context/SocketContext';
import { selectUser, selectHasPartner, selectPartnerName, selectDaysTogether, selectIsPremium } from '../store/slices/userSlice';
import { selectGames } from '../store/slices/gamesSlice';
import { selectDuelBadgeCount } from '../store/slices/notificationsSlice';
import { TOPIC_CATEGORIES } from '../constants/Categories';
import { API_BASE } from '../constants/Api';
import { getCoupleTodayChallenge } from '../utils/answerApi';
import { useCall } from '../calling/CallContext';
import { CALL_STATE } from '../calling/callConstants';
import { sendCurrentCouplePhoto } from '../api/couplePhotoApi';

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
    canAutoOpenMoodPrompt = true,
}) => {
    const [currentTab, setCurrentTab] = useState(initialTab || 'home');
    const [selectedTopic, setSelectedTopic] = useState(null); // Track selected topic for TopicQuestionsScreen
    const [chatBadge, setChatBadge] = useState(0); // Unread chat count for badge
    const [todayChallenge, setTodayChallenge] = useState(null);
    const [isAccountVisible, setIsAccountVisible] = useState(false);
    const [isPremiumOpenInAccount, setIsPremiumOpenInAccount] = useState(false);
    const [isNotificationVisible, setIsNotificationVisible] = useState(false);
    const [isMoodVisible, setIsMoodVisible] = useState(false);
    const [isMoodRefreshPrompt, setIsMoodRefreshPrompt] = useState(false);
    const [moodRefreshNow, setMoodRefreshNow] = useState(Date.now());
    const [moodPreview, setMoodPreview] = useState(null);
    const [isScribbleLiveFullscreen, setIsScribbleLiveFullscreen] = useState(false);
    const [tabBarRenderKey, setTabBarRenderKey] = useState(0);
    const [openScribbleLiveMode, setOpenScribbleLiveMode] = useState(false);
    const [openDistanceSetup, setOpenDistanceSetup] = useState(false);
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
    const hasPremiumAccess = isPremium || userData?.isPremium === true;
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
            if (isAccountVisible) {
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
    }, [handleBottomTabChange, currentTab, isAccountVisible]);

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
                        onWidgetsPress={() => setCurrentTab('widgetsLibrary')}
                        onVideoCallPress={handleCallPress}
                        partnerOnline={partnerOnline}
                        partnerName={partnerName || userData?.partnerUsername || 'Your partner'}
                        onPartnerPhotoPress={() => setCurrentTab('partnerPhotoCapture')}
                        isLocationSetup={userData?.locationSharingEnabled === true}
                        onDistanceSetupPress={() => {
                            setOpenDistanceSetup(userData?.locationSharingEnabled !== true);
                            setCurrentTab('widgetsLibrary');
                        }}
                    />
                );
            case 'partnerPhotoCapture':
                return (
                    <CouplePhotoCaptureScreen
                        partnerName={partnerName || userData?.partnerUsername || 'Your partner'}
                        onSendPhoto={handleSendCouplePhoto}
                        onBack={() => setCurrentTab('home')}
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
                        onWidgetsPress={() => {
                            setIsAccountVisible(false);
                            setIsPremiumOpenInAccount(false);
                            setCurrentTab('widgetsLibrary');
                        }}
                        onEditRelationshipDate={() => {
                            setIsAccountVisible(false);
                            onEditRelationshipDate?.();
                        }}
                        onBack={() => {
                            setIsAccountVisible(false);
                            setIsPremiumOpenInAccount(false);
                        }}
                    />

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
                animationType={callState === CALL_STATE.INCOMING ? 'none' : 'slide'}
                transparent={true}
                statusBarTranslucent={true}
                onRequestClose={closeMoodPicker}
            >
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
