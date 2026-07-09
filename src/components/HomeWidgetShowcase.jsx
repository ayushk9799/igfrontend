import React, { useEffect, useMemo, useState } from 'react';
import {
    Animated,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { fontFamily, fontWeight } from '../constants/fonts';

const DISTANCE_STEPS = [
    'Our distance: 1,000 km',
    'Our distance: 700 km',
    'Our distance: 500 km',
    'Our distance: 300 km',
    'Our distance: 100 km',
    'Our distance: 50 km',
    "We're together!",
];

const cardShadow = Platform.select({
    ios: {
        shadowColor: '#D95C86',
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.28,
        shadowRadius: 24,
    },
    android: {
        elevation: 14,
    },
});

const ShowcaseText = ({ children, style, ...props }) => (
    <Text {...props} style={[styles.showcaseText, style]} maxFontSizeMultiplier={1.2}>
        {children}
    </Text>
);

const HeartIcon = ({ color = '#FF758F', size = 16, style }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={style}>
        <Path d="M12 21s-7.2-4.35-9.55-8.2C.54 9.66 1.32 5.83 4.6 4.53 7.1 3.54 9.53 4.5 12 7.15c2.47-2.65 4.9-3.61 7.4-2.62 3.28 1.3 4.06 5.13 2.15 8.27C19.2 16.65 12 21 12 21z" />
    </Svg>
);

const LockIcon = ({ color = '#FF758F', size = 11, style }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
        <Path
            d="M8 10V7a4 4 0 0 1 8 0v3"
            stroke={color}
            strokeWidth={3.0}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <Path
            d="M5 10h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z"
            stroke={color}
            strokeWidth={3.0}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <Path
            d="M12 14v3"
            stroke={color}
            strokeWidth={3.0}
            strokeLinecap="round"
        />
    </Svg>
);

const WidgetShowcaseHeader = ({ children }) => (
    <ShowcaseText style={styles.widgetShowcaseTitle} numberOfLines={1}>
        {children}
    </ShowcaseText>
);

const WidgetInitial = ({ label, style }) => (
    <View style={[styles.widgetInitial, style]}>
        <ShowcaseText style={styles.widgetInitialText}>{label}</ShowcaseText>
    </View>
);

const getElapsedSeconds = (startDate) => {
    if (!startDate) return 0;

    const startTime = new Date(startDate).getTime();
    if (Number.isNaN(startTime)) return 0;

    return Math.max(0, Math.floor((Date.now() - startTime) / 1000));
};

const DistanceShowcaseCard = () => {
    const animationProgress = useMemo(() => new Animated.Value(0), []);
    const [distanceText, setDistanceText] = useState(DISTANCE_STEPS[0]);

    useEffect(() => {
        const listenerId = animationProgress.addListener(({ value }) => {
            const index = Math.min(DISTANCE_STEPS.length - 1, Math.floor(value * DISTANCE_STEPS.length));
            setDistanceText(DISTANCE_STEPS[index]);
        });

        const startAnimation = () => {
            animationProgress.setValue(0);
            Animated.sequence([
                Animated.delay(2000),
                Animated.timing(animationProgress, {
                    toValue: 1,
                    duration: 3500,
                    useNativeDriver: false,
                }),
                Animated.delay(3000),
                Animated.timing(animationProgress, {
                    toValue: 0,
                    duration: 3000,
                    useNativeDriver: false,
                }),
            ]).start(({ finished }) => {
                if (finished) {
                    startAnimation();
                }
            });
        };

        startAnimation();

        return () => {
            animationProgress.stopAnimation();
            animationProgress.removeListener(listenerId);
        };
    }, [animationProgress]);

    const leftTranslate = animationProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 54.5],
    });
    const rightTranslate = animationProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -54.5],
    });
    const dashLeft = animationProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [30, 84.5],
    });
    const dashRight = animationProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [30, 84.5],
    });
    const heartScale = animationProgress.interpolate({
        inputRange: [0, 0.72, 1],
        outputRange: [1, 1.05, 1.18],
    });

    return (
        <View style={[styles.widgetShowcaseCard, styles.distanceShowcaseCard]}>
            <View style={styles.cardHeaderRow}>
                <WidgetShowcaseHeader>Our Distance</WidgetShowcaseHeader>
                <LockIcon size={11.5} color="#FF758F" style={styles.lockIcon} />
            </View>
            <View style={styles.cardHeaderDivider} />
            <View style={styles.distanceShowcaseCenterTrack}>
                <ShowcaseText style={styles.distanceShowcaseValue} numberOfLines={1}>{distanceText}</ShowcaseText>
                <View style={styles.distanceShowcaseTrack}>
                    <Animated.View style={[styles.distanceShowcaseDash, { left: dashLeft, right: dashRight }]} />
                    <Animated.View style={[styles.distanceShowcaseLeft, { transform: [{ translateX: leftTranslate }] }]}>
                        <WidgetInitial label="R" />
                    </Animated.View>
                    <Animated.View style={[styles.distanceHeartCluster, { transform: [{ translateY: -2 }, { scale: heartScale }] }]}>
                        <HeartIcon color="#e85ab6ff" size={24} />
                    </Animated.View>
                    <Animated.View style={[styles.distanceShowcaseRight, { transform: [{ translateX: rightTranslate }] }]}>
                        <WidgetInitial label="?" />
                    </Animated.View>
                </View>
            </View>
        </View>
    );
};

const TimeTogetherShowcaseCard = ({ relationshipStartDate }) => {
    const [elapsed, setElapsed] = useState(() => getElapsedSeconds(relationshipStartDate));

    useEffect(() => {
        setElapsed(getElapsedSeconds(relationshipStartDate));

        const interval = setInterval(() => {
            setElapsed(getElapsedSeconds(relationshipStartDate));
        }, 1000);

        return () => clearInterval(interval);
    }, [relationshipStartDate]);

    const values = useMemo(() => ({
        days: Math.floor(elapsed / 86400),
        hr: Math.floor((elapsed % 86400) / 3600),
        min: Math.floor((elapsed % 3600) / 60),
        sec: elapsed % 60,
    }), [elapsed]);

    return (
        <View style={[styles.widgetShowcaseCard, styles.timeShowcaseCard]}>
            <WidgetShowcaseHeader>Time Together</WidgetShowcaseHeader>
            <View style={styles.cardHeaderDivider} />
            <View style={styles.timeShowcaseGrid}>
                <View style={styles.timeShowcaseBlock}>
                    <ShowcaseText style={styles.timeShowcaseValue} numberOfLines={1}>{values.days}</ShowcaseText>
                    <ShowcaseText style={styles.timeShowcaseLabel}>days</ShowcaseText>
                </View>
                <View style={styles.timeShowcaseBlock}>
                    <ShowcaseText style={styles.timeShowcaseValue}>{String(values.hr).padStart(2, '0')}</ShowcaseText>
                    <ShowcaseText style={styles.timeShowcaseLabel}>hr</ShowcaseText>
                </View>
                <View style={styles.timeShowcaseBlock}>
                    <ShowcaseText style={styles.timeShowcaseValue}>{String(values.min).padStart(2, '0')}</ShowcaseText>
                    <ShowcaseText style={styles.timeShowcaseLabel}>min</ShowcaseText>
                </View>
                <View style={styles.timeShowcaseBlock}>
                    <ShowcaseText style={styles.timeShowcaseValue}>{String(values.sec).padStart(2, '0')}</ShowcaseText>
                    <ShowcaseText style={styles.timeShowcaseLabel}>sec</ShowcaseText>
                </View>
            </View>
        </View>
    );
};

const DaysTogetherShowcaseCard = ({ daysTogether = 0 }) => (
    <View style={[styles.widgetShowcaseCard, styles.daysShowcaseCard]}>
        <WidgetShowcaseHeader>Days Together</WidgetShowcaseHeader>
        <View style={styles.cardHeaderDivider} />
        <View style={styles.daysShowcaseCenter}>
            <View style={styles.daysShowcaseCircle}>
                <HeartIcon size={16} color="#FFFFFF" />
                <ShowcaseText style={styles.daysShowcaseValue}>{daysTogether}</ShowcaseText>
                <ShowcaseText style={styles.daysShowcaseLabel}>days</ShowcaseText>
            </View>
        </View>
    </View>
);

const HomeWidgetShowcase = ({ onPress, relationshipStartDate, daysTogether = 0 }) => (
    <View style={styles.widgetShowcaseSection}>
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.widgetShowcaseScroll}
        >
            <TouchableOpacity activeOpacity={0.92} onPress={onPress} style={styles.widgetShowcasePressable}>
                <View style={[styles.widgetShowcaseCardShell, styles.distanceShowcaseShadow]}>
                    <DistanceShowcaseCard />
                </View>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.92} onPress={onPress} style={styles.widgetShowcasePressable}>
                <View style={[styles.widgetShowcaseCardShell, styles.timeShowcaseShadow]}>
                    <TimeTogetherShowcaseCard relationshipStartDate={relationshipStartDate} />
                </View>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.92} onPress={onPress} style={styles.widgetShowcasePressable}>
                <View style={[styles.widgetShowcaseCardShell, styles.daysShowcaseShadow]}>
                    <DaysTogetherShowcaseCard daysTogether={daysTogether} />
                </View>
            </TouchableOpacity>
        </ScrollView>
    </View>
);

const styles = StyleSheet.create({
    showcaseText: {
        fontFamily: fontFamily.regular,
    },
    widgetShowcaseSection: {
        marginTop: 0,
        marginHorizontal: -20,
    },
    widgetShowcaseScroll: {
        paddingHorizontal: 20,
        paddingTop: 5,
        paddingBottom: 18,
        gap: 10,
    },
    widgetShowcasePressable: {
        borderRadius: 18,
    },
    widgetShowcaseCardShell: {
        borderRadius: 18,
        backgroundColor: '#FFF0F3',
        ...cardShadow,
    },
    widgetShowcaseCard: {
        width: 184,
        height: 100,
        borderRadius: 18,
        paddingHorizontal: 14,
        paddingVertical: 8,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#FFFFFF',
    },
    distanceShowcaseCard: {
        width: 236,
        backgroundColor: '#FFF0F3',
    },
    timeShowcaseCard: {
        backgroundColor: '#FFF0F3',
    },
    daysShowcaseCard: {
        width: 130,
        backgroundColor: '#FFF0F3',
    },
    distanceShowcaseShadow: {
        shadowColor: '#FF9FBE',
    },
    timeShowcaseShadow: {
        shadowColor: '#FF9FBE',
    },
    daysShowcaseShadow: {
        shadowColor: '#FF9FBE',
    },
    widgetShowcaseTitle: {
        color: '#FF758F',
        fontSize: 11,
        lineHeight: 14,
        fontWeight: fontWeight('900'),
        fontFamily: fontFamily.extraBold,
    },
    cardHeaderDivider: {
        height: 1,
        backgroundColor: 'rgba(255, 117, 143, 0.22)',
        marginHorizontal: -14,
        marginTop: 4,
        marginBottom: 2,
    },
    widgetInitial: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFE5EC',
        borderWidth: 1,
        borderColor: 'rgba(255,117,143,0.35)',
    },
    widgetInitialText: {
        color: '#FF758F',
        fontSize: 14,
        fontWeight: fontWeight('900'),
        fontFamily: fontFamily.extraBold,
    },
    distanceShowcaseCenterTrack: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        marginTop: 0,
    },
    distanceShowcaseValue: {
        color: '#2E1E3C',
        fontSize: 11.5,
        lineHeight: 15,
        fontWeight: fontWeight('900'),
        fontFamily: fontFamily.extraBold,
        textAlign: 'center',
        marginBottom: 2,
    },
    distanceShowcaseTrack: {
        width: '100%',
        height: 34,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    distanceShowcaseDash: {
        position: 'absolute',
        top: 18,
        borderTopWidth: 4,
        borderColor: '#FF5A9A',
        borderRadius: 4,
    },
    distanceShowcaseLeft: {
        position: 'absolute',
        left: 0,
        top: 3,
    },
    distanceShowcaseRight: {
        position: 'absolute',
        right: 0,
        top: 3,
    },
    distanceHeartCluster: {
        width: 28,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    timeShowcaseGrid: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 0,
    },
    timeShowcaseBlock: {
        minWidth: 34,
        alignItems: 'center',
    },
    timeShowcaseValue: {
        color: '#2E1E3C',
        fontSize: 15,
        lineHeight: 18,
        fontWeight: fontWeight('900'),
        fontFamily: fontFamily.extraBold,
        letterSpacing: 0,
    },
    timeShowcaseLabel: {
        color: '#766F9B',
        fontSize: 9,
        fontWeight: fontWeight('800'),
        fontFamily: fontFamily.bold,
        marginTop: 2,
    },
    daysShowcaseCenter: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 2,
    },
    daysShowcaseCircle: {
        marginTop: 0,
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: 'rgba(46,30,60,0.38)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.24)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    daysShowcaseValue: {
        marginTop: 1,
        color: '#FFFFFF',
        fontSize: 13,
        lineHeight: 15,
        fontWeight: fontWeight('900'),
        fontFamily: fontFamily.extraBold,
        letterSpacing: 0,
    },
    daysShowcaseLabel: {
        color: 'rgba(255,255,255,0.86)',
        fontSize: 8,
        lineHeight: 10,
        fontWeight: fontWeight('800'),
        fontFamily: fontFamily.bold,
        marginTop: 0,
    },
    cardHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    lockIcon: {
        marginTop: -0.5,
    },
});

export default HomeWidgetShowcase;
