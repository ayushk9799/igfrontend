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

const { width } = Dimensions.get('window');

// Tab icons as SVG components
const HomeIcon = ({ color, size = 24 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
            d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <Path
            d="M9 22V12h6v10"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </Svg>
);



const UserIcon = ({ color, size = 24 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
            d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <Path
            d="M12 11a4 4 0 100-8 4 4 0 000 8z"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </Svg>
);

const QuestionsIcon = ({ color, size = 24 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
            d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <Path
            d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <Path
            d="M12 17h.01"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </Svg>
);

const TabItem = ({ icon: Icon, label, isActive, onPress }) => {
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
                {isActive && (
                    <View style={styles.activeIndicator}>
                        <LinearGradient
                            colors={[colors.primary, colors.secondary]}
                            style={StyleSheet.absoluteFill}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        />
                    </View>
                )}
                <Icon
                    color={isActive ? colors.primary : colors.textMuted}
                    size={24}
                />
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

const CanvasIcon = ({ color, size = 24 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
            d="M12 19l7-7 3 3-7 7-3-3z"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <Path
            d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <Path
            d="M2 2l7.586 7.586"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <Path
            d="M11 11a2 2 0 100-4 2 2 0 000 4z"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </Svg>
);

// Staggered Cards Icon for Daily Challenge
const CardsIcon = ({ color, size = 24 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        {/* Back card */}
        <Path
            d="M6 4h10a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2z"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        {/* Front card (offset) */}
        <Path
            d="M10 8h8a2 2 0 012 2v8a2 2 0 01-2 2h-8a2 2 0 01-2-2v-8a2 2 0 012-2z"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={color + '20'}
        />
    </Svg>
);

export const BottomTabBar = ({ currentTab, onTabChange }) => {
    const insets = useSafeAreaInsets();

    const tabs = [
        { key: 'home', label: 'Home', icon: HomeIcon },
        { key: 'canvas', label: 'Canvas', icon: CanvasIcon },
        { key: 'dailyChallenge', label: 'Today', icon: CardsIcon },
        { key: 'questions', label: 'Questions', icon: QuestionsIcon },
    ];

    return (
        <View style={[styles.container, { paddingBottom: insets.bottom }]}>
            <View style={styles.tabBar}>
                {tabs.map((tab) => (
                    <TabItem
                        key={tab.key}
                        icon={tab.icon}
                        label={tab.label}
                        isActive={currentTab === tab.key}
                        onPress={() => onTabChange(tab.key)}
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
        backgroundColor: colors.surface,
        borderTopWidth: 1,
        borderTopColor: colors.borderLight,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -4 },
                shadowOpacity: 0.1,
                shadowRadius: 12,
            },
            android: {
                elevation: 8,
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
        fontSize: 11,
        fontWeight: '600',
        color: colors.textMuted,
        marginTop: 4,
    },
    tabLabelActive: {
        color: colors.primary,
        fontWeight: '700',
    },
});

export default BottomTabBar;
