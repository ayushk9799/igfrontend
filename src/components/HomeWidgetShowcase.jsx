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

const SHOWCASE_TIME_SECONDS = (1954 * 86400) + (11 * 3600) + (44 * 60) + 12;
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
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 18,
    },
    android: {
        elevation: 5,
    },
});

const ShowcaseText = ({ children, style, ...props }) => (
    <Text {...props} style={[styles.showcaseText, style]} maxFontSizeMultiplier={1.2}>
        {children}
    </Text>
);

const HeartDoodle = ({ color = '#FFFFFF', size = 20, style }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style}>
        <Path
            d="M12 20.2C8.2 16.7 4.5 13.6 4.5 9.7C4.5 7.6 6 6 8 6C9.3 6 10.6 6.8 11.3 8C12 6.8 13.3 6 14.7 6C16.8 6 18.4 7.6 18.4 9.7C18.4 13.6 15.8 15.4 12 20.2Z"
            stroke={color}
            strokeWidth={1.7}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </Svg>
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
                    <Animated.View style={[styles.distanceHeartCluster, { transform: [{ scale: heartScale }] }]}>
                        <HeartDoodle color="#FF758F" size={20} />
                        <HeartDoodle color="rgba(255,117,143,0.6)" size={15} style={styles.distanceHeartSmall} />
                    </Animated.View>
                    <Animated.View style={[styles.distanceShowcaseRight, { transform: [{ translateX: rightTranslate }] }]}>
                        <WidgetInitial label="?" />
                    </Animated.View>
                </View>
            </View>
        </View>
    );
};

const TimeTogetherShowcaseCard = () => {
    const [elapsed, setElapsed] = useState(SHOWCASE_TIME_SECONDS);

    useEffect(() => {
        const interval = setInterval(() => {
            setElapsed(previous => previous + 1);
        }, 1000);

        return () => clearInterval(interval);
    }, []);

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

const DaysTogetherShowcaseCard = () => (
    <View style={[styles.widgetShowcaseCard, styles.daysShowcaseCard]}>
        <WidgetShowcaseHeader>Days Together</WidgetShowcaseHeader>
        <View style={styles.cardHeaderDivider} />
        <View style={styles.daysShowcaseCenter}>
            <View style={styles.daysShowcaseCircle}>
                <HeartIcon size={16} color="#FFFFFF" />
                <ShowcaseText style={styles.daysShowcaseValue}>1954</ShowcaseText>
                <ShowcaseText style={styles.daysShowcaseLabel}>days</ShowcaseText>
            </View>
        </View>
    </View>
);

const HomeWidgetShowcase = ({ onPress }) => (
    <View style={styles.widgetShowcaseSection}>
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.widgetShowcaseScroll}
        >
            <TouchableOpacity activeOpacity={0.92} onPress={onPress}>
                <DistanceShowcaseCard />
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.92} onPress={onPress}>
                <TimeTogetherShowcaseCard />
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.92} onPress={onPress}>
                <DaysTogetherShowcaseCard />
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
        gap: 10,
    },
    widgetShowcaseCard: {
        width: 184,
        height: 100,
        borderRadius: 18,
        paddingHorizontal: 14,
        paddingVertical: 8,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,117,143,0.16)',
        ...cardShadow,
    },
    distanceShowcaseCard: {
        width: 236,
        backgroundColor: '#FFF0F3',
        shadowColor: '#FFB5D0',
    },
    timeShowcaseCard: {
        backgroundColor: '#FFF0F3',
        shadowColor: '#FFB5D0',
    },
    daysShowcaseCard: {
        width: 130,
        backgroundColor: '#FFF0F3',
        shadowColor: '#FFB5D0',
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
        top: 19,
        borderTopWidth: 2,
        borderColor: 'rgba(255,117,143,0.4)',
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
        width: 31,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    distanceHeartSmall: {
        position: 'absolute',
        right: 2,
        top: 2,
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
