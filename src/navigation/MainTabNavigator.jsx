// Main Tab Navigator - Home with Bottom Tabs
import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import HomeScreen from '../screens/HomeScreen';
import ConversationsScreen from '../screens/ConversationsScreen';
import AccountScreen from '../screens/AccountScreen';
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
                        onQuestionPress={onQuestionPress}
                        onFindPartner={onFindPartner}
                    />
                );
            case 'chat':
                return (
                    <ConversationsScreen
                        partnerName={partnerName}
                        hasPartner={hasPartner}
                        onChatPress={(chat) => {
                            console.log('Opening chat:', chat);
                        }}
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
