import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CouplePhotoCard from '../components/CouplePhotoCard';
import { fontFamily, fontWeight } from '../constants/fonts';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const IS_COMPACT = SCREEN_HEIGHT < 760;
const REAL_WIDGET_SIZE = 160;
const DISTANCE_WIDGET_WIDTH = Math.min(356, SCREEN_WIDTH - 18);
const DISTANCE_WIDGET_HEIGHT = 250;

const slides = [
    {
        key: 'distance',
        label: 'Our Distance',
        caption: 'Distance widget on Lock Screen',
    },
    {
        key: 'together',
        label: 'Together For',
        caption: 'Together widget on Lock Screen',
    },
    {
        key: 'canvas',
        label: 'Shared Canvas',
        caption: 'Shared Canvas widget on Home Screen',
    },
    {
        key: 'photo',
        label: 'Partner Photo',
        caption: 'Partner Photo widget on Home Screen',
    },
];

const placeholderHeart = 'M80 116 C58 100 32 79 32 52 C32 30 49 18 66 18 C77 18 87 24 94 35 C101 24 111 18 122 18 C139 18 156 30 156 52 C156 79 130 100 108 116 L94 127 Z';

const DotConnector = ({ progress }) => (
    <Animated.View style={[
        styles.distanceDots,
        {
            width: progress.interpolate({ inputRange: [0, 1], outputRange: [46, 10] }),
            opacity: progress.interpolate({ inputRange: [0, 0.82, 1], outputRange: [1, 0.92, 0.35] }),
        },
    ]}>
        {Array.from({ length: 7 }, (_, index) => <View key={index} style={styles.distanceDot} />)}
    </Animated.View>
);

const WhiteHeart = ({ size, opacity = 1 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="#FFFFFF" opacity={opacity}>
        <Path d="M12 21s-7.2-4.35-9.55-8.2C.54 9.66 1.32 5.83 4.6 4.53 7.1 3.54 9.53 4.5 12 7.15c2.47-2.65 4.9-3.61 7.4-2.62 3.28 1.3 4.06 5.13 2.15 8.27C19.2 16.65 12 21 12 21z" />
    </Svg>
);

const LockStatusIcons = () => (
    <Svg width={61} height={14} viewBox="0 0 61 14" fill="none">
        <Rect x="0" y="9" width="3" height="4" rx="1" fill="#FFFFFF" />
        <Rect x="5" y="6" width="3" height="7" rx="1" fill="#FFFFFF" />
        <Rect x="10" y="3" width="3" height="10" rx="1" fill="#FFFFFF" />
        <Rect x="15" y="0" width="3" height="13" rx="1" fill="#FFFFFF" />
        <Path d="M24 4.8c4.3-3.5 10.5-3.5 14.8 0M27 8c2.6-2.1 6.2-2.1 8.8 0M30.3 11.1c.7-.6 1.7-.6 2.4 0" stroke="#FFFFFF" strokeWidth={1.7} strokeLinecap="round" />
        <Rect x="43" y="2" width="15" height="10" rx="2.3" stroke="#FFFFFF" strokeWidth={1.4} />
        <Rect x="45" y="4" width="11" height="6" rx="1" fill="#FFFFFF" />
        <Rect x="59" y="5" width="2" height="4" rx="1" fill="#FFFFFF" />
    </Svg>
);

const LockScreenSurface = ({ children }) => (
    <LinearGradient
        colors={['#451730', '#982A62', '#E05B8D', '#6D3B88']}
        locations={[0, 0.4, 0.72, 1]}
        start={{ x: 0.05, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={styles.distanceWidget}
    >
        <View style={styles.wallpaperGlowOne} />
        <View style={styles.wallpaperGlowTwo} />
        <View style={styles.wallpaperShade} />
        <View style={styles.lockStatusRow}>
            <Text style={styles.lockStatusTime}>9:41</Text>
            <LockStatusIcons />
        </View>
        <Text style={styles.lockDate}>Monday, June 2</Text>
        <Text style={styles.lockTime}>9:41</Text>
        {children}
    </LinearGradient>
);

const DistanceWidget = () => {
    const progress = useMemo(() => new Animated.Value(0), []);
    const [status, setStatus] = useState('1,240 km apart');

    useEffect(() => {
        const listener = progress.addListener(({ value }) => {
            if (value > 0.92) setStatus("We're together!");
            else if (value > 0.72) setStatus('42 km apart');
            else if (value > 0.48) setStatus('286 km apart');
            else if (value > 0.24) setStatus('720 km apart');
            else setStatus('1,240 km apart');
        });
        const animation = Animated.loop(Animated.sequence([
            Animated.delay(900),
            Animated.timing(progress, { toValue: 1, duration: 4800, useNativeDriver: false }),
            Animated.delay(800),
            Animated.timing(progress, { toValue: 0, duration: 2200, useNativeDriver: false }),
            Animated.delay(500),
        ]));
        animation.start();
        return () => {
            animation.stop();
            progress.removeListener(listener);
        };
    }, [progress]);

    const leftMove = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 7] });
    const rightMove = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -7] });
    const heartScale = progress.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1.08, 1.28] });

    return (
        <LockScreenSurface>
            <View style={styles.distanceAccessory}>
                <Text numberOfLines={1} style={styles.distanceTitle}>{status}</Text>
                <View style={styles.distanceTrack}>
                    <Animated.View style={[styles.distanceInitial, { transform: [{ translateX: leftMove }] }]}>
                        <Text style={styles.distanceInitialText}>B</Text>
                    </Animated.View>
                    <DotConnector progress={progress} />
                    <Animated.View style={[styles.distanceHearts, { transform: [{ scale: heartScale }] }]}>
                        <View style={styles.distanceHeartBack}><WhiteHeart size={17} opacity={0.92} /></View>
                        <View style={styles.distanceHeartFront}><WhiteHeart size={21} /></View>
                    </Animated.View>
                    <DotConnector progress={progress} />
                    <Animated.View style={[styles.distanceInitial, { transform: [{ translateX: rightMove }] }]}>
                        <Text style={styles.distanceInitialText}>H</Text>
                    </Animated.View>
                </View>
            </View>
        </LockScreenSurface>
    );
};

const TogetherWidget = ({ relationshipStartDate }) => {
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    const start = new Date(relationshipStartDate).getTime();
    const elapsed = Number.isFinite(start)
        ? Math.max(0, Math.floor((now - start) / 1000))
        : (1096 * 86400) + (21 * 3600) + (25 * 60) + 31;
    const parts = [
        { value: Math.floor(elapsed / 86400), label: 'days' },
        { value: String(Math.floor((elapsed % 86400) / 3600)).padStart(2, '0'), label: 'hr' },
        { value: String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0'), label: 'min' },
        { value: String(elapsed % 60).padStart(2, '0'), label: 'sec' },
    ];

    return (
        <LockScreenSurface>
            <View style={styles.togetherAccessory}>
                <View style={styles.togetherHeading}>
                    <Text style={styles.togetherHeadingText}>together for</Text>
                    <WhiteHeart size={12} />
                </View>
                <View style={styles.togetherValues}>
                    {parts.map(part => (
                        <View key={part.label} style={styles.togetherColumn}>
                            <Text numberOfLines={1} adjustsFontSizeToFit style={styles.togetherValue}>{part.value}</Text>
                            <Text style={styles.togetherLabel}>{part.label}</Text>
                        </View>
                    ))}
                </View>
            </View>
        </LockScreenSurface>
    );
};

const CanvasWidget = ({ scribble }) => {
    const paths = scribble?.paths || [];
    const canvasWidth = scribble?.canvasWidth || 350;
    const canvasHeight = scribble?.canvasHeight || 350;

    return (
        <View style={styles.canvasWidget}>
            <Svg width="100%" height="100%" viewBox={`0 0 ${canvasWidth} ${canvasHeight}`} preserveAspectRatio="xMidYMid meet">
                {paths.length > 0 ? paths.slice(0, 300).map((path, index) => (
                    <Path
                        key={`${path.d}-${index}`}
                        d={path.d}
                        stroke={path.color || '#2E1E3C'}
                        strokeWidth={path.strokeWidth || 4}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )) : (
                    <Path d={placeholderHeart} stroke="#FF7AA7" strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.6} />
                )}
            </Svg>
        </View>
    );
};

const RealWidget = ({
    type,
    relationshipStartDate,
    daysTogether,
    partnerPhoto,
    myPhoto,
    partnerName,
    hasPartner,
    partnerScribble,
}) => {
    if (type === 'distance') {
        return <DistanceWidget />;
    }

    if (type === 'together') {
        return <TogetherWidget relationshipStartDate={relationshipStartDate} />;
    }

    if (type === 'canvas') {
        return <CanvasWidget scribble={partnerScribble} />;
    }

    return (
        <CouplePhotoCard
            hasPartner={hasPartner}
            partnerName={partnerName}
            partnerPhoto={partnerPhoto}
            myPhoto={myPhoto}
        />
    );
};

const WidgetOnboardingScreen = ({
    onComplete,
    relationshipStartDate,
    daysTogether = 0,
    partnerPhoto,
    myPhoto,
    partnerName,
    hasPartner = false,
    partnerScribble,
}) => {
    const insets = useSafeAreaInsets();
    const pagerRef = useRef(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const activeSlide = slides[activeIndex];

    const selectSlide = index => {
        setActiveIndex(index);
        pagerRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
    };

    const continueFlow = () => {
        if (activeIndex < slides.length - 1) {
            selectSlide(activeIndex + 1);
            return;
        }
        onComplete?.();
    };

    const widgetProps = {
        relationshipStartDate,
        daysTogether,
        partnerPhoto,
        myPhoto,
        partnerName,
        hasPartner,
        partnerScribble,
    };

    return (
        <LinearGradient
            colors={['#F8D9EC', '#FFF7FA', '#FFF4F7', '#F7D8F2']}
            locations={[0, 0.34, 0.72, 1]}
            start={{ x: 0.25, y: 0 }}
            end={{ x: 0.75, y: 1 }}
            style={styles.container}
        >
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <View style={[styles.page, { paddingTop: insets.top + 8 }]}> 
                <View style={styles.intro}>
                    <Text style={styles.headlineMuted}>Stay Updated,</Text>
                    <Text style={styles.headline}>With Widgets</Text>
                </View>

                <View style={styles.middleContent}>
                    <View style={styles.showcaseArea}>
                        <ScrollView
                            ref={pagerRef}
                            horizontal
                            pagingEnabled
                            scrollEnabled={false}
                            showsHorizontalScrollIndicator={false}
                            decelerationRate="fast"
                            onMomentumScrollEnd={event => {
                                setActiveIndex(Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH));
                            }}
                        >
                            {slides.map(slide => (
                                <View key={slide.key} style={styles.slide}>
                                    <RealWidget type={slide.key} {...widgetProps} />
                                </View>
                            ))}
                        </ScrollView>
                    </View>

                    <View style={styles.showcaseCopy}>
                        <Text style={styles.showcaseCaption}>{activeSlide.caption}</Text>
                    </View>
                </View>

                <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}> 
                    <View style={styles.pagination}>
                        {slides.map((slide, index) => <View key={slide.key} style={[styles.dot, index === activeIndex && styles.dotActive]} />)}
                    </View>
                    <TouchableOpacity onPress={continueFlow} activeOpacity={0.86} style={styles.buttonShadow}>
                        <View style={styles.continueButton}>
                            <Text style={styles.continueText}>{activeIndex === slides.length - 1 ? 'Get started' : 'Continue'}</Text>
                            <Text style={styles.continueArrow}>→</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            </View>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    page: { flex: 1 },
    intro: { alignItems: 'flex-start', paddingHorizontal: 24, paddingTop: 12 },
    headlineMuted: { color: '#A88D9D', fontFamily: fontFamily.medium, fontWeight: fontWeight('500'), fontSize: IS_COMPACT ? 27 : 31, lineHeight: IS_COMPACT ? 31 : 36, textAlign: 'left' },
    headline: { color: '#2E1E3C', fontFamily: fontFamily.extraBold, fontWeight: fontWeight('800'), fontSize: IS_COMPACT ? 29 : 34, lineHeight: IS_COMPACT ? 34 : 39, textAlign: 'left' },
    middleContent: { flex: 1, minHeight: IS_COMPACT ? 245 : 285, justifyContent: 'center' },
    showcaseArea: { height: IS_COMPACT ? 264 : 274, justifyContent: 'center' },
    slide: { width: SCREEN_WIDTH, alignItems: 'center', justifyContent: 'center' },
    canvasWidget: { width: REAL_WIDGET_SIZE, height: REAL_WIDGET_SIZE, borderRadius: 24, overflow: 'hidden', backgroundColor: '#FAFAFA' },
    distanceWidget: { width: DISTANCE_WIDGET_WIDTH, height: DISTANCE_WIDGET_HEIGHT, borderRadius: 31, overflow: 'hidden', borderWidth: 3, borderColor: '#D95C86', shadowColor: '#9E4E76', shadowOpacity: 0.28, shadowRadius: 17, shadowOffset: { width: 0, height: 10 }, elevation: 7 },
    wallpaperGlowOne: { position: 'absolute', width: 210, height: 210, borderRadius: 105, right: -72, top: -74, backgroundColor: 'rgba(255,183,213,0.22)' },
    wallpaperGlowTwo: { position: 'absolute', width: 190, height: 190, borderRadius: 95, left: -78, bottom: -94, backgroundColor: 'rgba(165,136,235,0.2)' },
    wallpaperShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(27,8,27,0.06)' },
    lockStatusRow: { position: 'absolute', top: 12, left: 21, right: 21, height: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    lockStatusTime: { color: '#FFFFFF', fontFamily: fontFamily.bold, fontWeight: fontWeight('700'), fontSize: 10 },
    lockDate: { position: 'absolute', top: 43, alignSelf: 'center', color: 'rgba(255,255,255,0.94)', fontFamily: fontFamily.medium, fontWeight: fontWeight('500'), fontSize: 13, lineHeight: 16, letterSpacing: 0.1 },
    lockTime: { position: 'absolute', top: 66, alignSelf: 'center', color: '#FFFFFF', fontFamily: fontFamily.medium, fontWeight: fontWeight('600'), fontSize: 61, lineHeight: 68, letterSpacing: -3, textShadowColor: 'rgba(22,13,27,0.12)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
    distanceAccessory: { position: 'absolute', left: 34, right: 34, bottom: 22, alignItems: 'center' },
    distanceTitle: { width: '100%', color: '#FFFFFF', fontFamily: fontFamily.bold, fontWeight: fontWeight('700'), fontSize: 13, lineHeight: 16, marginBottom: 6, textAlign: 'center' },
    distanceTrack: { height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    distanceInitial: { width: 31, height: 31, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1.2, borderColor: 'rgba(255,255,255,0.42)', alignItems: 'center', justifyContent: 'center' },
    distanceInitialText: { color: '#FFFFFF', fontFamily: fontFamily.extraBold, fontSize: 16 },
    distanceDots: { height: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', overflow: 'hidden' },
    distanceDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#FFFFFF' },
    distanceHearts: { width: 25, height: 26, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
    distanceHeartBack: { position: 'absolute', right: 0, top: 0, shadowColor: '#000000', shadowOpacity: 0.3, shadowRadius: 2.5, shadowOffset: { width: 0, height: 1.5 } },
    distanceHeartFront: { position: 'absolute', left: 0, bottom: 0, shadowColor: '#000000', shadowOpacity: 0.34, shadowRadius: 3, shadowOffset: { width: 0, height: 1.5 } },
    togetherAccessory: { position: 'absolute', left: 48, right: 48, bottom: 24, alignItems: 'center' },
    togetherHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 4 },
    togetherHeadingText: { color: '#FFFFFF', fontFamily: fontFamily.bold, fontWeight: fontWeight('700'), fontSize: 13, lineHeight: 16 },
    togetherValues: { width: '100%', flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
    togetherColumn: { flex: 1, minWidth: 0, alignItems: 'center' },
    togetherValue: { width: '100%', color: '#FFFFFF', fontFamily: fontFamily.extraBold, fontWeight: fontWeight('900'), fontSize: 20, lineHeight: 24, textAlign: 'center' },
    togetherLabel: { marginTop: 1, color: 'rgba(255,255,255,0.9)', fontFamily: fontFamily.bold, fontSize: 10, lineHeight: 12 },
    showcaseCopy: { alignItems: 'center', paddingHorizontal: 34, paddingTop: 9 },
    showcaseCaption: { color: '#8A7185', fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 17, textAlign: 'center' },
    footer: { minHeight: 92, paddingHorizontal: 24, paddingTop: 10, justifyContent: 'flex-end', alignItems: 'center' },
    pagination: { flexDirection: 'row', gap: 7, marginBottom: 12 },
    dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#E4C9D9' },
    dotActive: { width: 22, backgroundColor: '#FF5D91' },
    buttonShadow: { width: '100%', shadowColor: '#E83C78', shadowOpacity: 0.22, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 5 },
    continueButton: { height: 52, borderRadius: 18, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FF4F87' },
    continueText: { color: '#FFFFFF', fontFamily: fontFamily.bold, fontSize: 17 },
    continueArrow: { position: 'absolute', right: 22, color: '#FFFFFF', fontSize: 23 },
});

export default WidgetOnboardingScreen;
