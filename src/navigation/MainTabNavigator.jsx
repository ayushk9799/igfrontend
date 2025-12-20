// Main Tab Navigator - Home with Bottom Tabs
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import HomeScreen from '../screens/HomeScreen';
import AccountScreen from '../screens/AccountScreen';
import QuestionsScreen from '../screens/QuestionsScreen';
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
                        onScribblePress={onScribblePress}
                        onQuestionPress={() => setCurrentTab('questions')}
                        onFindPartner={onFindPartner}
                    />
                );
            case 'questions':
                return (
                    <QuestionsScreen
                        currentQuestion={currentQuestion}
                        yourAnswer={yourAnswer}
                        partnerAnswer={partnerAnswer}
                        partnerName={partnerName}
                        isLocked={!yourAnswer}
                        onSubmitAnswer={onSubmitAnswer}
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
