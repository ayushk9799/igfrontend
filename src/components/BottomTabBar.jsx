// Premium Bottom Tab Bar Component
import React, { useRef, useEffect } from 'react';
import {
    View,
    TouchableOpacity,
    Text,
    StyleSheet,
    Animated,
    Platform,
    Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import LinearGradient from 'react-native-linear-gradient';
import { colors, spacing, borderRadius } from '../theme';
import { fontFamily, fontWeight } from '../constants/fonts';

const { width } = Dimensions.get('window');

// Tab icons as SVG components with filled/outlined states

// Home icon - house with door
const HomeIcon = ({ color, size = 24, filled = false }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
            d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={filled ? color : 'none'}
        />
        {!filled && (
            <Path
                d="M9 22V12h6v10"
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        )}
        {filled && (
            <Path
                d="M9 22V12h6v10"
                stroke={colors.surface}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill={colors.surface}
            />
        )}
    </Svg>
);

// Pencil icon for Canvas - cleaner than palette
const PencilIcon = ({ color, size = 24, filled = false }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
            d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={filled ? color : 'none'}
        />
    </Svg>
);

// Spark/Flame icon for Today - represents daily streak/challenge
const SparkIcon = ({ color, size = 24, filled = false }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
            d="M12 2L9 9l-7 1 5 5-1 7 6-3 6 3-1-7 5-5-7-1-3-7z"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={filled ? color : 'none'}
        />
    </Svg>
);

// Chat/Message icon for Chats
const ChatIcon = ({ color, size = 24, filled = false }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
            d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={filled ? color : 'none'}
        />
    </Svg>
);

const GameIcon = ({ color, size = 24, filled = false }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
            d="M21 11.5c0-4.14-3.36-7.5-7.5-7.5H10.5C6.36 4 3 7.36 3 11.5V13c0 2.21 1.79 4 4 4h.5c.83 0 1.5.67 1.5 1.5v.5c0 1.1.9 2 2 2h2c1.1 0 2-.9 2-2v-.5c0-.83.67-1.5 1.5-1.5H17c2.21 0 4-1.79 4-4v-1.5z"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={filled ? color : 'none'}
        />
        <Path d="M7 11h2M8 10v2" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M15.5 11h.01M16.5 10h.01M15.5 12h.01" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);



const TabItem = ({ icon: Icon, label, isActive, onPress, badge = 0 }) => {
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
                    <Icon
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
        { key: 'home', label: 'Home', icon: HomeIcon },
        { key: 'canvas', label: 'Canvas', icon: PencilIcon },
        { key: 'dailyChallenge', label: 'Today', icon: SparkIcon },
        { key: 'games', label: 'Games', icon: GameIcon },
        { key: 'chats', label: 'Chats', icon: ChatIcon, badge: chatBadge },
    ];

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom > 0 ? insets.bottom : 8 }]}>
            <View style={styles.tabBar}>
                {tabs.map((tab) => (
                    <TabItem
                        key={tab.key}
                        icon={tab.icon}
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
