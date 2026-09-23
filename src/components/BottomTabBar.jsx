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
    Easing,
} from 'react-native';
import { BlurView } from 'expo-blur';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { fontFamily, fontWeight } from '../constants/fonts';
import { House, Gamepad2, MessageCircle, Notebook, Palette } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { translateUiTemplate, translateUiText } from '../i18n/uiTranslation';

const triggerTabHaptic = () => {
    if (Platform.OS === 'android') {
        ReactNativeHapticFeedback.trigger('soft', {
            enableVibrateFallback: false,
            ignoreAndroidSystemSettings: false,
        });
    } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
};

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

let cachedGlassAvailability = null;

const getGlassAvailability = () => {
    if (cachedGlassAvailability !== null) {
        return cachedGlassAvailability;
    }

    const liquidGlassModule = getLiquidGlassModule();
    const GlassView = liquidGlassModule?.GlassView;

    if (!GlassView) {
        cachedGlassAvailability = {
            GlassView: null,
            isApiAvailable: false,
            isLiquidGlassAvailable: false,
        };
        return cachedGlassAvailability;
    }

    const isApiAvailable = !!liquidGlassModule.isGlassEffectAPIAvailable?.();
    const isLiquidGlassAvailable = !!liquidGlassModule.isLiquidGlassAvailable?.();

    cachedGlassAvailability = {
        GlassView,
        isApiAvailable,
        isLiquidGlassAvailable,
    };

    return cachedGlassAvailability;
};

// Lucide icon mapping for each tab
const iconMap = {
    home: House,
    timeline: Notebook,
    canvas: Palette,
    games: Gamepad2,
    chats: MessageCircle,
};

const TABS = [
    { key: 'home', label: "Home", iconKey: 'home' },
    { key: 'memories', label: "Timeline", iconKey: 'timeline' },
    { key: 'canvas', label: "Canvas", iconKey: 'canvas' },
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

    const handlePress = () => {
        if (!isActive) {
            triggerTabHaptic();
        }
        onPress?.();
    };

    return (
        <TouchableOpacity
            style={styles.tabItem}
            onPress={handlePress}
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
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        maxFontSizeMultiplier={1.2}
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
    visible = true,
}) => {
    const insets = useSafeAreaInsets();
    const { reduceMotion, reduceTransparency } = useAccessibilityPreferences();
    const slideAnim = useRef(new Animated.Value(visible ? 1 : 0)).current;
    const isFirstRender = useRef(true);

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        if (reduceMotion) {
            slideAnim.setValue(visible ? 1 : 0);
            return;
        }

        if (visible) {
            Animated.spring(slideAnim, {
                toValue: 1,
                friction: 9,
                tension: 55,
                useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 220,
                easing: Easing.in(Easing.cubic),
                useNativeDriver: true,
            }).start();
        }
    }, [visible, reduceMotion, slideAnim]);

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
            : (insets.bottom > 0 ? Math.max(insets.bottom - 18, 12) : 12),
        left: Platform.OS === 'android' ? 14 : 18,
        right: Platform.OS === 'android' ? 14 : 18,
    };
    const scrimHeight = Platform.OS === 'android'
        ? Math.max(insets.bottom, 12) + 84
        : Math.max(insets.bottom, 16) + 72;

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

    const translateY = slideAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [160, 0],
    });

    return (
        <Animated.View
            style={[
                styles.dockRoot,
                {
                    transform: [{ translateY }],
                },
            ]}
            pointerEvents={visible ? 'box-none' : 'none'}
        >
            <LinearGradient
                pointerEvents="none"
                colors={['rgba(255, 248, 252, 0)', 'rgba(255, 248, 252, 0.22)', 'rgba(255, 248, 252, 0.85)']}
                locations={[0, 0.62, 1]}
                style={[
                    styles.bottomScrim,
                    { height: scrimHeight },
                ]}
            />
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
                                <BlurView
                                    intensity={Platform.OS === 'ios' ? 95 : 85}
                                    tint={Platform.OS === 'ios' ? 'systemChromeMaterialLight' : 'light'}
                                    experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : 'none'}
                                    blurReductionFactor={4}
                                    style={StyleSheet.absoluteFillObject}
                                />
                            )}
                            <LinearGradient
                                pointerEvents="none"
                                colors={['rgba(255, 255, 255, 0.38)', 'rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0)']}
                                locations={[0, 0.45, 1]}
                                style={styles.specularGlare}
                            />
                            {tabBarContent}
                        </>
                    )}
                </View>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    dockRoot: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 100,
        pointerEvents: 'box-none',
    },
    bottomScrim: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 99,
    },
    container: {
        position: 'absolute',
        borderRadius: 36,
        maxWidth: 440,
        alignSelf: 'center',
        zIndex: 100,
        ...Platform.select({
            ios: {
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.12,
                shadowRadius: 18,
            },
            android: {
                elevation: 4,
            },
        }),
    },
    liquidSheet: {
        borderRadius: 36,
        paddingVertical: 4,
        overflow: 'hidden',
        backgroundColor: Platform.select({
            ios: 'transparent',
            android: 'rgba(255,255,255,0.20)',
            default: 'transparent',
        }),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.65)',
        borderTopColor: 'rgba(255,255,255,0.90)',
        borderBottomColor: 'rgba(255,255,255,0.30)',
    },
    nativeLiquidSheet: {
        paddingVertical: 0,
        backgroundColor: 'transparent',
    },
    glassSurface: {
        borderRadius: 36,
        paddingVertical: 4,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.65)',
        borderTopColor: 'rgba(255,255,255,0.90)',
        borderBottomColor: 'rgba(255,255,255,0.30)',
    },
    specularGlare: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 26,
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
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
        minWidth: 46,
        minHeight: 48,
    },

    activeLiquid: {
        position: 'absolute',
        top: 3,
        bottom: 3,
        left: -4,
        right: -4,
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
                elevation: 0,
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
        fontSize: 10.5,
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
