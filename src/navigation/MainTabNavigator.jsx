// Main Tab Navigator - Home with Bottom Tabs
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import HomeScreen from '../screens/HomeScreen';
import AccountScreen from '../screens/AccountScreen';
import QuestionCategoriesScreen from '../screens/QuestionCategoriesScreen';
import ScribbleScreen from '../screens/ScribbleScreen';
import DailyChallengeScreen from '../screens/DailyChallengeScreen';
import BottomTabBar from '../components/BottomTabBar';
import { colors } from '../theme';

export const MainTabNavigator = ({
    // Home screen props
    partnerName,
    daysTogether,
    hasPartner = false,
    yourMood,
    partnerMood,
    partnerOnline = false,
    partnerScribble = null,
    pendingInvite,
    onMoodPress,
    onScribblePress,
    onQuestionPress,
    onFindPartner,
    // Account props
    userData,
    onLogout,
    onEditProfile,
    // Questions props
    currentQuestion,
    yourAnswer,
    partnerAnswer,
    onSubmitAnswer,
    // Scribble props
    onScribbleSend,
}) => {
    const [currentTab, setCurrentTab] = useState('home');

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
                        onQuestionPress={() => setCurrentTab('dailyChallenge')}
                        onFindPartner={onFindPartner}
                        onSettingsPress={() => setCurrentTab('account')}
                    />
                );
            case 'canvas':
                return (
                    <ScribbleScreen
                        onSend={onScribbleSend}
                        onBack={() => setCurrentTab('home')}
                    />
                );
            case 'dailyChallenge':
                return (
                    <DailyChallengeScreen
                        partnerName={partnerName}
                        userName={userData?.name || 'You'}
                        onBack={() => setCurrentTab('home')}
                    />
                );
            case 'questions':
                return (
                    <QuestionCategoriesScreen
                        partnerName={partnerName}
                        streak={daysTogether || 1}
                        onSelectCategory={(category) => {
                            // Navigate to the full question flow via AppNavigator
                            if (onQuestionPress) {
                                onQuestionPress(category);
                            }
                        }}
                        onBack={() => setCurrentTab('home')}
                    />
                );
            case 'account':
                return (
                    <AccountScreen
                        userData={userData}
                        partnerName={partnerName}
                        hasPartner={hasPartner}
                        daysTogether={daysTogether}
                        onLogout={onLogout}
                        onEditProfile={onEditProfile}
                        onFindPartner={onFindPartner}
                        onBack={() => setCurrentTab('home')}
                    />
                );
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
