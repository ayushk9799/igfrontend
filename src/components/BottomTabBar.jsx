// Premium Bottom Tab Bar Component
import React, { useEffect, useRef, useState } from 'react';
import {
    AccessibilityInfo,
    View,
    TouchableOpacity,
    Text,
    StyleSheet,
    Animated,
    Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { fontFamily, fontWeight } from '../constants/fonts';
import { House, Gamepad2, MessageCircle, Notebook } from 'lucide-react-native';
import { translateUiTemplate, translateUiText } from '../i18n/uiTranslation';

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

    const isApiAvailable = !!liquidGlassModule.isGlassEffectAPIAvailable?.();
    const isLiquidGlassAvailable = !!liquidGlassModule.isLiquidGlassAvailable?.();

    return {
        GlassView,
        isApiAvailable,
        isLiquidGlassAvailable,
    };
};

// Lucide icon mapping for each tab
const iconMap = {
    home: House,
    timeline: Notebook,
    games: Gamepad2,
    chats: MessageCircle,
};

const TABS = [
    { key: 'home', label: "Home", iconKey: 'home' },
    { key: 'memories', label: "Timeline", iconKey: 'timeline' },
    { key: 'games', label: "Games", iconKey: 'games' },
    { key: 'chats', label: "Chats", iconKey: 'chats' },
];

const useAccessibilityPreferences = () => {
    const [reduceMotion, setReduceMotion] = useState(false);
    const [reduceTransparency, setReduceTransparency] = useState(false);

    useEffect(() => {
        let isMounted = true;

        AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
            if (isMounted) setReduceMotion(enabled);
        });
        AccessibilityInfo.isReduceTransparencyEnabled().then((enabled) => {
            if (isMounted) setReduceTransparency(enabled);
        });

        const motionSubscription = AccessibilityInfo.addEventListener(
            'reduceMotionChanged',
            setReduceMotion
        );
        const transparencySubscription = AccessibilityInfo.addEventListener(
            'reduceTransparencyChanged',
            setReduceTransparency
        );

        return () => {
            isMounted = false;
            motionSubscription.remove();
            transparencySubscription.remove();
        };
    }, []);

    return { reduceMotion, reduceTransparency };
};

// Vector icon tab component
const TabIcon = ({ iconKey, color, size = 24, filled = false }) => {
    const IconComponent = iconMap[iconKey] || House;
    return <IconComponent color={color} size={size} strokeWidth={filled ? 2.5 : 1.75} />;
};

const TabItem = ({
    iconKey,
    label,
    isActive,
    onPress,
    badge = 0,
    attentionDot = false,
    reduceMotion = false,
    useLiquidGlass = false,
}) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const activeGlowAnim = useRef(new Animated.Value(isActive ? 1 : 0)).current;
    const attentionBlinkAnim = useRef(new Animated.Value(1)).current;
    const pressAnimationRef = useRef(null);

    useEffect(() => {
        if (reduceMotion) {
            scaleAnim.setValue(isActive ? 1.1 : 1);
            activeGlowAnim.setValue(isActive ? 1 : 0);
            return () => pressAnimationRef.current?.stop();
        }

        const activeAnimation = Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: isActive ? 1.1 : 1,
                useNativeDriver: true,
                friction: 5,
            }),
            Animated.timing(activeGlowAnim, {
                toValue: isActive ? 1 : 0,
                duration: 180,
                useNativeDriver: true,
            }),
        ]);

        activeAnimation.start();

        return () => {
            activeAnimation.stop();
            pressAnimationRef.current?.stop();
        };
    }, [activeGlowAnim, isActive, reduceMotion, scaleAnim]);

    useEffect(() => {
        attentionBlinkAnim.stopAnimation();

        if (!attentionDot || reduceMotion) {
            attentionBlinkAnim.setValue(1);
            return undefined;
        }

        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(attentionBlinkAnim, {
                    toValue: 0.2,
                    duration: 600,
                    useNativeDriver: true,
                }),
                Animated.timing(attentionBlinkAnim, {
                    toValue: 1,
                    duration: 600,
                    useNativeDriver: true,
                }),
            ])
        );

        animation.start();
        return () => animation.stop();
    }, [attentionBlinkAnim, attentionDot, reduceMotion]);

    const handlePressIn = () => {
        if (reduceMotion) {
            scaleAnim.setValue(0.9);
            return;
        }

        pressAnimationRef.current?.stop();
        pressAnimationRef.current = Animated.spring(scaleAnim, {
            toValue: 0.9,
            useNativeDriver: true,
            friction: 5,
        });
        pressAnimationRef.current.start();
    };

    const handlePressOut = () => {
        if (reduceMotion) {
            scaleAnim.setValue(isActive ? 1.1 : 1);
            return;
        }

        pressAnimationRef.current?.stop();
        pressAnimationRef.current = Animated.spring(scaleAnim, {
            toValue: isActive ? 1.1 : 1,
            useNativeDriver: true,
            friction: 5,
        });
        pressAnimationRef.current.start();
    };

    const badgeLabel = badge > 0
        ? badge === 1
            ? translateUiTemplate(", {{0}} unread message", [badge])
            : translateUiTemplate(", {{0}} unread messages", [badge])
        : '';

    return (
        <TouchableOpacity
            style={styles.tabItem}
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={0.9}
            accessibilityRole="tab"
            accessibilityLabel={`${translateUiText(label)}${badgeLabel}`}
            accessibilityHint={attentionDot ? translateUiText("Game action required") : undefined}
            accessibilityState={{ selected: isActive }}
        >
            <Animated.View
                style={[
                    styles.tabContent,
                    {
                        transform: [
                            { scale: scaleAnim },
                        ],
                    },
                ]}
            >
                <Animated.View
                    pointerEvents="none"
                    style={[
                        styles.activeLiquid,
                        useLiquidGlass && styles.activeLiquidGlass,
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
                        {attentionDot && badge === 0 && (
                            <Animated.View
                                style={[
                                    styles.attentionDot,
                                    { opacity: attentionBlinkAnim },
                                ]}
                            />
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

/**
 * @param {{
 *   currentTab: string,
 *   onTabChange: (tab: 'home' | 'memories' | 'games' | 'chats') => void,
 *   chatBadge?: number,
 *   gamesNeedAttention?: boolean,
 * }} props
 */
export const BottomTabBar = ({
    currentTab,
    onTabChange,
    chatBadge = 0,
    gamesNeedAttention = false,
}) => {
    const insets = useSafeAreaInsets();
    const { reduceMotion, reduceTransparency } = useAccessibilityPreferences();
    const {
        GlassView,
        isApiAvailable,
        isLiquidGlassAvailable,
    } = getGlassAvailability();
    const shouldUseLiquidGlass = isApiAvailable
        && isLiquidGlassAvailable
        && !reduceTransparency;
    const floatingOffsetStyle = {
        bottom: Platform.OS === 'android'
            ? Math.max(insets.bottom, 12)
            : Math.max(insets.bottom - 18, 2),
        left: Platform.OS === 'android' ? 18 : 24,
        right: Platform.OS === 'android' ? 18 : 24,
    };

    const tabBarContent = (
        <View style={styles.tabBar} accessibilityRole="tablist">
            {TABS.map((tab) => (
                <TabItem
                    key={tab.key}
                    iconKey={tab.iconKey}
                    label={translateUiText(tab.label)}
                    isActive={currentTab === tab.key}
                    onPress={() => onTabChange(tab.key)}
                    badge={tab.key === 'chats' ? chatBadge : 0}
                    attentionDot={tab.key === 'games' && gamesNeedAttention}
                    reduceMotion={reduceMotion}
                    useLiquidGlass={shouldUseLiquidGlass}
                />
            ))}
        </View>
    );

    return (
        <View
            style={[
                styles.container,
                floatingOffsetStyle,
            ]}
        >
            <View
                style={[
                    styles.liquidSheet,
                    shouldUseLiquidGlass && styles.nativeLiquidSheet,
                ]}
            >
                {shouldUseLiquidGlass ? (
                    <GlassView
                        glassEffectStyle="regular"
                        colorScheme="light"
                        isInteractive={true}
                        borderRadius={36}
                        style={styles.glassSurface}
                    >
                        {tabBarContent}
                    </GlassView>
                ) : (
                    <>
                        {reduceTransparency ? (
                            <View style={styles.opaqueSurface} />
                        ) : (
                            <BlurView intensity={42} tint="light" style={StyleSheet.absoluteFillObject} />
                        )}
                        {!reduceTransparency && <View style={styles.liquidTint} />}
                        {tabBarContent}
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
        zIndex: 100,
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
    nativeLiquidSheet: {
        paddingVertical: 0,
        backgroundColor: 'transparent',
    },
    glassSurface: {
        borderRadius: 36,
        paddingVertical: 4,
        overflow: 'hidden',
    },
    liquidTint: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.34)',
    },
    opaqueSurface: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#FFF8FC',
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
    activeLiquidGlass: {
        top: 4,
        bottom: 4,
        backgroundColor: 'rgba(255,255,255,0.24)',
        borderColor: 'rgba(255,255,255,0.44)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
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
    attentionDot: {
        position: 'absolute',
        top: -4,
        right: -7,
        width: 9,
        height: 9,
        borderRadius: 5,
        backgroundColor: colors.error,
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
    },
});

export default BottomTabBar;
