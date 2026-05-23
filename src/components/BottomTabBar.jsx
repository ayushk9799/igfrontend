// Premium Bottom Tab Bar Component
import React, { useRef, useEffect } from 'react';
import {
    View,
    TouchableOpacity,
    Text,
    StyleSheet,
    Animated,
    Image,
    Platform,
    Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius } from '../theme';
import { fontFamily, fontWeight } from '../constants/fonts';

const { width } = Dimensions.get('window');

// Tab icon images - filled and unfilled variants
const tabIcons = {
    home: {
        default: require('../../assets/bottomtab/house.png'),
        filled: require('../../assets/bottomtab/house_filled.png'),
    },
    canvas: {
        default: require('../../assets/bottomtab/canvas.png'),
        filled: require('../../assets/bottomtab/canvas_filled.png'),
    },
    today: {
        default: require('../../assets/bottomtab/today.png'),
        filled: require('../../assets/bottomtab/today_filled.png'),
    },
    games: {
        default: require('../../assets/bottomtab/game.png'),
        filled: require('../../assets/bottomtab/game_filled.png'),
    },
    chats: {
        default: require('../../assets/bottomtab/chat.png'),
        filled: require('../../assets/bottomtab/chat_filled.png'),
    },
};

// Image-based tab icon component
const TabIcon = ({ iconKey, color, size = 24, filled = false }) => (
    <Image
        source={filled ? tabIcons[iconKey].filled : tabIcons[iconKey].default}
        style={{
            width: size,
            height: size,
            tintColor: color,
        }}
        resizeMode="contain"
    />
);



const TabItem = ({ iconKey, label, isActive, onPress, badge = 0 }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const translateY = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: isActive ? 1.1 : 1,
                useNativeDriver: true,
                friction: 5,
            }),
            Animated.spring(translateY, {
                toValue: isActive ? -2 : 0,
                useNativeDriver: true,
                friction: 5,
            }),
        ]).start();
    }, [isActive]);

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.9,
            useNativeDriver: true,
            friction: 5,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: isActive ? 1.1 : 1,
            useNativeDriver: true,
            friction: 5,
        }).start();
    };

    return (
        <TouchableOpacity
            style={styles.tabItem}
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={0.9}
        >
            <Animated.View
                style={[
                    styles.tabContent,
                    {
                        transform: [
                            { scale: scaleAnim },
                            { translateY },
                        ],
                    },
                ]}
            >
                <View style={styles.iconWrapper}>
                    <TabIcon
                        iconKey={iconKey}
                        color={isActive ? colors.primary : colors.textMuted}
                        size={24}
                        filled={isActive}
                    />
                    {badge > 0 && (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>
                                {badge > 99 ? '99+' : badge}
                            </Text>
                        </View>
                    )}
                </View>
                <Text
                    style={[
                        styles.tabLabel,
                        isActive && styles.tabLabelActive,
                    ]}
                >
                    {label}
                </Text>
            </Animated.View>
        </TouchableOpacity>
    );
};

export const BottomTabBar = ({ currentTab, onTabChange, chatBadge = 0 }) => {
    const insets = useSafeAreaInsets();

    const tabs = [
        { key: 'home', label: 'Home', iconKey: 'home' },
        { key: 'canvas', label: 'Canvas', iconKey: 'canvas' },
        { key: 'dailyChallenge', label: 'Today', iconKey: 'today' },
        { key: 'games', label: 'Games', iconKey: 'games' },
        { key: 'chats', label: 'Chats', iconKey: 'chats', badge: chatBadge },
    ];

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom > 0 ? insets.bottom : 8 }]}>
            <View style={styles.tabBar}>
                {tabs.map((tab) => (
                    <TabItem
                        key={tab.key}
                        iconKey={tab.iconKey}
                        label={tab.label}
                        isActive={currentTab === tab.key}
                        onPress={() => onTabChange(tab.key)}
                        badge={tab.badge || 0}
                    />
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderColor: '#F3E8FF',
        paddingVertical: 6,
        ...Platform.select({
            ios: {
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.05,
                shadowRadius: 10,
            },
            android: {
                elevation: 10,
            },
        }),
    },
    tabBar: {
        flexDirection: 'row',
        paddingTop: spacing.xs,
        paddingHorizontal: spacing.md,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: spacing.xs,
    },
    tabContent: {
        alignItems: 'center',
        position: 'relative',
    },
    activeIndicator: {
        position: 'absolute',
        top: -8,
        width: 24,
        height: 3,
        borderRadius: 2,
        overflow: 'hidden',
    },
    tabLabel: {
        fontFamily: fontFamily.medium,
        fontSize: 11,
        fontWeight: fontWeight('600'),
        color: colors.textMuted,
        marginTop: 4,
    },
    tabLabelActive: {
        fontFamily: fontFamily.bold,
        color: colors.primary,
        fontWeight: fontWeight('700'),
    },
    iconWrapper: {
        position: 'relative',
    },
    badge: {
        position: 'absolute',
        top: -6,
        right: -10,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: colors.error,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    badgeText: {
        fontFamily: fontFamily.bold,
        fontSize: 10,
        fontWeight: fontWeight('700'),
        color: '#FFFFFF',
    },
});

export default BottomTabBar;
