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
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { fontFamily, fontWeight } from '../constants/fonts';
import CouplePhotoCard from './CouplePhotoCard';
import { translateUiText } from '../i18n/uiTranslation';

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

const getElapsedSeconds = (startDate, now = Date.now()) => {
    if (!startDate) return 0;

    const startTime = new Date(startDate).getTime();
    if (Number.isNaN(startTime)) return 0;

    return Math.max(0, Math.floor((now - startTime) / 1000));
};

const getTogetherDuration = (startDate, now = Date.now()) => {
    const startTime = new Date(startDate).getTime();
    if (!startDate || Number.isNaN(startTime)) return null;

    const elapsed = getElapsedSeconds(startDate, now);
    const days = Math.floor(elapsed / 86400);
    const hours = Math.floor((elapsed % 86400) / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;
    const twoDigits = value => String(value).padStart(2, '0');

    return [
        { value: days, label: translateUiText("days") },
        { value: twoDigits(hours), label: translateUiText("hr") },
        { value: twoDigits(minutes), label: translateUiText("min") },
        { value: twoDigits(seconds), label: translateUiText("sec") },
    ];
};

export const DistanceShowcaseCard = ({ isLocationSetup = false }) => {
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
        outputRange: [0, 28],
    });
    const rightTranslate = animationProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -28],
    });
    const dashLeft = animationProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [25, 53],
    });
    const dashRight = animationProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [25, 53],
    });
    const heartScale = animationProgress.interpolate({
        inputRange: [0, 0.72, 1],
        outputRange: [1, 1.05, 1.18],
    });

    return (
        <LinearGradient
            colors={['#FFF7FA', '#FFE4EF', '#F2E8FF']}
            locations={[0, 0.58, 1]}
            start={{ x: 0.08, y: 0 }}
            end={{ x: 0.94, y: 1 }}
            style={[styles.widgetShowcaseCard, styles.distanceShowcaseCard]}
        >
            <View style={styles.distanceHeader}>
                <WidgetShowcaseHeader>{translateUiText("Our Distance")}</WidgetShowcaseHeader>
            </View>
            <View style={[styles.cardHeaderDivider, styles.distanceHeaderDivider]} />
            <View style={styles.distanceShowcaseCenterTrack}>
                <ShowcaseText style={styles.distanceShowcaseValue} numberOfLines={1}>
                    {isLocationSetup ? distanceText : translateUiText("See how close you are")}
                </ShowcaseText>
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
                {!isLocationSetup && (
                    <ShowcaseText style={styles.distanceSetupText}>{translateUiText("Tap to set up")}</ShowcaseText>
                )}
            </View>
        </LinearGradient>
    );
};

export const TimeTogetherShowcaseCard = ({ relationshipStartDate, daysTogether = 0 }) => {
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    const elapsedDays = Math.floor(getElapsedSeconds(relationshipStartDate, now) / 86400);
    const durationParts = getTogetherDuration(relationshipStartDate, now);

    return (
        <View style={[styles.widgetShowcaseCard, styles.timeShowcaseCard]}>
            <View style={styles.togetherComposition}>
                <View style={styles.togetherDurationPlate}>
                    <View style={styles.togetherDurationHeading}>
                        <ShowcaseText style={styles.togetherDurationEyebrow}>{translateUiText("together for")}</ShowcaseText>
                        <HeartIcon size={17} color="#FFFFFF" />
                    </View>
                    {durationParts ? (
                        <View style={styles.togetherDurationColumns}>
                            {durationParts.map(part => (
                                <View key={part.label} style={styles.togetherDurationColumn}>
                                    <ShowcaseText style={styles.togetherDurationValue}>{part.value}</ShowcaseText>
                                    <ShowcaseText style={styles.togetherDaysLabel}>{translateUiText(part.label)}</ShowcaseText>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <ShowcaseText style={styles.togetherDurationValue}>{translateUiText("Start your story")}</ShowcaseText>
                    )}
                </View>
                <View style={styles.togetherDaysOrb}>
                    <ShowcaseText style={styles.togetherDaysValue}>{daysTogether || elapsedDays}</ShowcaseText>
                    <View style={styles.togetherDaysLabelRow}>
                        <ShowcaseText style={styles.togetherDaysLabel}>{translateUiText("days")}</ShowcaseText>
                        <HeartIcon size={10} color="#FFFFFF" />
                    </View>
                </View>
            </View>
        </View>
    );
};

const HomeWidgetShowcase = ({
    onPress,
    relationshipStartDate,
    daysTogether = 0,
    hasPartner = false,
    partnerName,
    partnerPhoto,
    myPhoto,
    onFindPartner,
    onOpenPhotoCapture,
    isLocationSetup = false,
    onDistancePress,
}) => (
    <View style={styles.widgetShowcaseSection}>
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.widgetShowcaseScroll}
        >
            <CouplePhotoCard
                hasPartner={hasPartner}
                partnerName={partnerName}
                partnerPhoto={partnerPhoto}
                myPhoto={myPhoto}
                onFindPartner={onFindPartner}
                onOpenCapture={onOpenPhotoCapture}
                showCameraBadge={false}
                showCopy={false}
            />
            <TouchableOpacity
                activeOpacity={0.92}
                onPress={onDistancePress || onPress}
                style={[styles.widgetShowcasePressable, styles.distanceShowcaseShadow]}
                accessibilityRole="button"
                accessibilityLabel={isLocationSetup ? translateUiText("Open distance widgets") : translateUiText("Set up location for Our Distance")}
            >
                <DistanceShowcaseCard isLocationSetup={isLocationSetup} />
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.92} onPress={onPress} style={styles.widgetShowcasePressable}>
                <View style={[styles.widgetShowcaseCardShell, styles.timeShowcaseShadow]}>
                    <TimeTogetherShowcaseCard relationshipStartDate={relationshipStartDate} daysTogether={daysTogether} />
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
        borderRadius: 24,
    },
    widgetShowcaseCardShell: {
        borderRadius: 24,
        backgroundColor: '#FFF0F3',
        ...cardShadow,
    },
    widgetShowcaseCard: {
        width: 160,
        height: 160,
        borderRadius: 24,
        paddingHorizontal: 14,
        paddingVertical: 11,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#FFFFFF',
    },
    distanceShowcaseCard: {
        backgroundColor: '#FFF0F3',
        paddingHorizontal: 0,
        paddingVertical: 0,
    },
    distanceHeader: {
        height: 37,
        justifyContent: 'center',
        paddingHorizontal: 14,
    },
    distanceHeaderDivider: {
        marginHorizontal: 0,
        marginTop: 0,
        marginBottom: 0,
    },
    timeShowcaseCard: {
        paddingHorizontal: 8,
        paddingVertical: 8,
        backgroundColor: '#FAD8E6',
    },
    distanceShowcaseShadow: {
        ...cardShadow,
        shadowColor: '#FF9FBE',
    },
    timeShowcaseShadow: {
        shadowColor: '#FF9FBE',
    },
    widgetShowcaseTitle: {
        color: '#FF758F',
        fontSize: 12,
        lineHeight: 15,
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
        paddingHorizontal: 12,
        paddingBottom: 8,
        zIndex: 1,
    },
    distanceShowcaseValue: {
        color: '#2E1E3C',
        fontSize: 13,
        lineHeight: 17,
        fontWeight: fontWeight('900'),
        fontFamily: fontFamily.extraBold,
        textAlign: 'center',
        marginBottom: 7,
    },
    distanceShowcaseTrack: {
        width: '100%',
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    distanceShowcaseDash: {
        position: 'absolute',
        top: 21,
        borderTopWidth: 3,
        borderColor: 'rgba(217, 78, 134, 0.48)',
        borderStyle: 'dashed',
        borderRadius: 4,
    },
    distanceShowcaseLeft: {
        position: 'absolute',
        left: 0,
        top: 5,
    },
    distanceShowcaseRight: {
        position: 'absolute',
        right: 0,
        top: 5,
    },
    distanceHeartCluster: {
        width: 28,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    distanceSetupText: {
        color: '#D94E86',
        fontSize: 10,
        lineHeight: 13,
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('800'),
    },
    togetherComposition: {
        flex: 1,
        position: 'relative',
    },
    togetherDaysOrb: {
        position: 'absolute',
        left: 4,
        top: 1,
        width: 72,
        height: 72,
        borderRadius: 36,
        zIndex: 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#E98DAF',
        borderWidth: 4,
        borderColor: '#FFFFFF',
        shadowColor: '#B54E78',
        shadowOpacity: 0.22,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 4 },
    },
    togetherDaysValue: {
        color: '#FFFFFF',
        fontSize: 20,
        lineHeight: 22,
        fontWeight: fontWeight('900'),
        fontFamily: fontFamily.extraBold,
    },
    togetherDaysLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    togetherDaysLabel: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 10,
        lineHeight: 12,
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
    },
    togetherDurationPlate: {
        position: 'absolute',
        left: 12,
        right: 0,
        bottom: 4,
        minHeight: 72,
        borderRadius: 20,
        justifyContent: 'center',
        paddingLeft: 18,
        paddingRight: 9,
        paddingTop: 9,
        backgroundColor: '#F1A9C3',
        borderWidth: 4,
        borderColor: '#FFFFFF',
        transform: [{ rotate: '-1.5deg' }],
    },
    togetherDurationHeading: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        transform: [{ translateY: -5 }],
    },
    togetherDurationEyebrow: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 13,
        lineHeight: 16,
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
    },
    togetherDurationColumns: {
        flexDirection: 'row',
    },
    togetherDurationColumn: {
        flex: 1,
        alignItems: 'center',
    },
    togetherDurationValue: {
        color: '#FFFFFF',
        fontSize: 11,
        lineHeight: 14,
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('900'),
        marginTop: 3,
    },
});

export default HomeWidgetShowcase;
