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
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { fontFamily, fontWeight } from '../constants/fonts';

const getLiquidGlassModule = () => {
    if (Platform.OS !== 'ios') return null;

    try {
        // Loading this lazily keeps older native builds on the blur fallback until rebuilt.
        const glassModule = require('expo-glass-effect');
        const isAvailable = glassModule.isGlassEffectAPIAvailable?.();

        return isAvailable ? glassModule : null;
    } catch {
        return null;
    }
};

const getGlassAvailability = () => {
    const liquidGlassModule = getLiquidGlassModule();
    const GlassView = liquidGlassModule?.GlassView;

    if (!GlassView) {
        return {
            GlassView: null,
            isApiAvailable: false,
            isLiquidGlassAvailable: false,
        };
    }

    return {
        GlassView,
        isApiAvailable: true,
        isLiquidGlassAvailable: !!liquidGlassModule.isLiquidGlassAvailable?.(),
    };
};

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
        style={[
            styles.tabIcon,
            {
                width: size,
                height: size,
                tintColor: color,
            },
            !filled && styles.tabIconInactive,
        ]}
        resizeMode="contain"
    />
);



const TabItem = ({ iconKey, label, isActive, onPress, badge = 0 }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const translateY = useRef(new Animated.Value(0)).current;
    const activeGlowAnim = useRef(new Animated.Value(isActive ? 1 : 0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: isActive ? 1.1 : 1,
                useNativeDriver: true,
                friction: 5,
            }),
            Animated.spring(translateY, {
                toValue: 0,
                useNativeDriver: true,
                friction: 5,
            }),
            Animated.timing(activeGlowAnim, {
                toValue: isActive ? 1 : 0,
                duration: 180,
                useNativeDriver: true,
            }),
        ]).start();
    }, [activeGlowAnim, isActive, scaleAnim, translateY]);

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
                <Animated.View
                    pointerEvents="none"
                    style={[
                        styles.activeLiquid,
                        {
                            opacity: activeGlowAnim,
                            transform: [
                                {
                                    scaleX: activeGlowAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0.72, 1],
                                    }),
                                },
                                {
                                    scaleY: activeGlowAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0.78, 1],
                                    }),
                                },
                            ],
                        },
                    ]}
                />
                <View style={styles.tabInner}>
                    <View style={styles.iconWrapper}>
                        <TabIcon
                            iconKey={iconKey}
                            color={isActive ? colors.primary : '#6B6478'}
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
                </View>
            </Animated.View>
        </TouchableOpacity>
    );
};

export const BottomTabBar = ({ currentTab, onTabChange, chatBadge = 0 }) => {
    const insets = useSafeAreaInsets();
    const {
        GlassView,
        isApiAvailable: shouldUseLiquidGlass,
        isLiquidGlassAvailable,
    } = getGlassAvailability();
    const floatingOffsetStyle = {
        bottom: Platform.OS === 'android'
            ? Math.max(insets.bottom, 12)
            : (insets.bottom > 0 ? insets.bottom - 18 : 2),
        left: Platform.OS === 'android' ? 18 : 24,
        right: Platform.OS === 'android' ? 18 : 24,
    };

   

    const tabs = [
        { key: 'home', label: 'Home', iconKey: 'home' },
        { key: 'canvas', label: 'Canvas', iconKey: 'canvas' },
        { key: 'dailyChallenge', label: 'Today', iconKey: 'today' },
        { key: 'games', label: 'Games', iconKey: 'games' },
        { key: 'chats', label: 'Chats', iconKey: 'chats', badge: chatBadge },
    ];

    return (
        <View
            style={[
                styles.container,
                floatingOffsetStyle,
            ]}
        >
            <View style={styles.liquidSheet}>
                {shouldUseLiquidGlass ? (
                    <GlassView
                        glassEffectStyle="clear"
                        tintColor="rgba(255,255,255,0.5)"
                        colorScheme="light"
                        isInteractive={true}
                        borderRadius={36}
                        style={styles.glassSurface}
                    >
                        <View style={styles.glassMilkTint} />
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
                    </GlassView>
                ) : (
                    <>
                        <BlurView intensity={42} tint="light" style={StyleSheet.absoluteFillObject} />
                        <View style={styles.liquidTint} />
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
                    </>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        borderRadius: 36,
        ...Platform.select({
            ios: {
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.08,
                shadowRadius: 18,
            },
            android: {
                elevation: 10,
            },
        }),
    },
    liquidSheet: {
        borderRadius: 36,
        paddingVertical: 4,
        overflow: 'hidden',
        backgroundColor: Platform.select({
            ios: 'rgba(255,255,255,0.08)',
            android: 'rgba(255,255,255,0.74)',
            default: 'rgba(255,255,255,0.74)',
        }),
    },
    glassSurface: {
        borderRadius: 36,
        paddingVertical: 4,
        overflow: 'hidden',
    },
    glassMilkTint: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.14)',
    },
    liquidTint: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.34)',
    },
    tabBar: {
        flexDirection: 'row',
        paddingHorizontal: 6,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 0,
    },
    tabContent: {
        alignItems: 'center',
        position: 'relative',
        justifyContent: 'center',
        minWidth: 54,
        minHeight: 48,
    },
    tabIcon: {
        opacity: 1,
    },
    tabIconInactive: {
        opacity: 0.78,
    },
    activeLiquid: {
        position: 'absolute',
        top: 3,
        bottom: 3,
        left: -6,
        right: -6,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.72)',
        borderWidth: 1,
        borderColor: 'rgba(120,103,246,0.18)',
        ...Platform.select({
            ios: {
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 10,
            },
            android: {
                elevation: 2,
            },
        }),
    },
    tabInner: {
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 48,
        zIndex: 1,
    },
    tabLabel: {
        fontFamily: fontFamily.medium,
        fontSize: 11,
        fontWeight: fontWeight('600'),
        color: '#6B6478',
        marginTop: 0,
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
