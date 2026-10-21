import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, Image, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
    Easing,
    cancelAnimation,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withTiming,
} from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';
import { captureRef, releaseCapture } from 'react-native-view-shot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LetterPaper, { getLetterPaper, getLetterTextSize } from './LetterPaper';
import { WaxSealArt, WaxSealImprint } from './LetterSealArt';
import { fontFamily } from '../../constants/fonts';
import useReducedMotion from '../../hooks/useReducedMotion';
import { translateUiText } from '../../i18n/uiTranslation';

// Bundled transparent textures keep the rotating stamp independent of SVG redraws.
const STAMP_IMAGE = require('../../../assets/letters/seal-stamp.png');
const STAMP_SHADOW_IMAGE = require('../../../assets/letters/seal-stamp-shadow.png');

const phase = (value, start, end) => {
    'worklet';
    const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
    return t * t * (3 - 2 * t);
};

// A short, read-only sheet keeps even very long letters within the animation stage.
const PaperPreview = ({ body, paperId, sizeId, width, height, blank = false }) => {
    const paper = getLetterPaper(paperId);
    const size = getLetterTextSize(sizeId);
    const lineHeight = Math.round(size.lineHeight * 0.72);
    return (
        <LetterPaper paperId={paperId} lineHeight={lineHeight} style={{ width, height }}>
            {blank ? null : (
                <Text
                    numberOfLines={Math.max(1, Math.floor((height - 64) / lineHeight))}
                    style={{ fontFamily: fontFamily.handwriting, fontSize: size.fontSize * 0.72, lineHeight, color: paper.ink }}
                >
                    {body}
                </Text>
            )}
        </LetterPaper>
    );
};

const PaperSlice = ({ index, uri, body, paperId, sizeId, width, height, blank = false }) => (
    <View style={[styles.slice, { width, height: height / 3 }]}>
        <View style={{ position: 'absolute', top: -index * height / 3 }}>
            {uri && !blank ? (
                <Image source={{ uri }} style={{ width, height }} resizeMode="stretch" />
            ) : (
                <PaperPreview {...{ body, paperId, sizeId, width, height, blank }} />
            )}
        </View>
    </View>
);

const FoldPanel = ({ edge, progress, paperProps }) => {
    const third = paperProps.height / 3;
    const isTop = edge === 'top';
    const animatedStyle = useAnimatedStyle(() => {
        const fold = phase(progress.value, isTop ? 0.12 : 0.34, isTop ? 0.32 : 0.54);
        const pivot = isTop ? third / 2 : -third / 2;
        return {
            transform: [
                { perspective: 900 },
                { translateY: pivot },
                { rotateX: `${(isTop ? -180 : 180) * fold}deg` },
                { translateY: -pivot },
            ],
        };
    });
    return (
        <Animated.View style={[styles.fold, { top: isTop ? 0 : third * 2, width: paperProps.width, height: third, zIndex: isTop ? 2 : 3 }, animatedStyle]}>
            <View style={[styles.face, styles.frontFace]}>
                <PaperSlice {...paperProps} index={isTop ? 0 : 2} />
            </View>
            <View style={[styles.face, styles.backFace]}>
                <PaperSlice {...paperProps} index={isTop ? 0 : 2} blank />
                <View style={[styles.crease, { backgroundColor: getLetterPaper(paperProps.paperId).edge }, isTop ? { top: 0 } : { bottom: 0 }]} />
            </View>
        </Animated.View>
    );
};

// Prepares the envelope before the carrier picker opens; no request runs here.
const LetterSendAnimation = ({ body, paperId, sizeId, choosingBird = false, pickerHeight = 0, onComplete }) => {
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const reduceMotion = useReducedMotion();
    const previewRef = useRef(null);
    const completeRef = useRef(onComplete);
    completeRef.current = onComplete;
    const [laidOut, setLaidOut] = useState(false);
    const [uri, setUri] = useState(null);
    const [prepared, setPrepared] = useState(false);
    const [packed, setPacked] = useState(false);
    const [loadedTextures, setLoadedTextures] = useState(0);
    const stampReady = reduceMotion || loadedTextures === 3;
    const [overlayHeight, setOverlayHeight] = useState(windowHeight);
    const [contentY, setContentY] = useState(null);
    const [contentHeight, setContentHeight] = useState(0);
    const [stageY, setStageY] = useState(null);
    const progress = useSharedValue(0);
    const flapClose = useSharedValue(0);
    const stamp = useSharedValue(0);
    const lift = useSharedValue(0);
    const labelOpacity = useSharedValue(1);
    const envelopeFit = useSharedValue(1);

    // Freeze the stage's geometry for the animation (including rotation).
    const [paperWidth] = useState(() => Math.max(100, Math.min(280, windowWidth - 76, (windowHeight - insets.top - insets.bottom - 180) / 2.1)));
    const paperHeight = paperWidth * 1.44;
    const third = paperHeight / 3;
    const envelopeWidth = paperWidth + 32;
    const envelopeHeight = third * 1.48;
    const flapHeight = envelopeHeight * 0.74;
    const paperTop = 20;
    const envelopeTop = paperTop + third * 1.85;
    const stageHeight = envelopeTop + envelopeHeight + 22;
    const waxSize = Math.max(30, Math.min(64, envelopeWidth * 0.2));
    const waxCenterX = 8 + envelopeWidth / 2;
    const waxCenterY = envelopeTop + flapHeight * 0.93;
    const stampWidth = waxSize * 1.65;
    const stampHeight = waxSize * 2.45;
    const stampPivotY = stampHeight * (138 / 148 - 0.5);
    const shadowWidth = stampWidth * 1.15;
    const shadowHeight = waxSize * 0.48;
    // Start fully beyond the right edge, then line up directly over the wax.
    const stampTravelX = windowWidth / 2 + stampWidth;
    const paperProps = { body, paperId, sizeId, width: paperWidth, height: paperHeight, uri };

    useEffect(() => {
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
        return () => subscription.remove();
    }, []);

    useEffect(() => {
        if (!laidOut) return undefined;
        let disposed = false;
        let settled = false;
        let snapshotUri;
        // A capture failure must never prevent the carrier picker from opening.
        const fallback = setTimeout(() => {
            settled = true;
            if (!disposed) setPrepared(true);
        }, 900);
        const capture = setTimeout(async () => {
            try {
                const result = await captureRef(previewRef, { format: 'png', result: 'tmpfile' });
                if (disposed || settled) {
                    releaseCapture(result);
                    return;
                }
                snapshotUri = result;
                settled = true;
                clearTimeout(fallback);
                setUri(result);
            } catch {
                clearTimeout(fallback);
                if (!disposed) setPrepared(true);
            }
        }, 160);
        return () => {
            disposed = true;
            clearTimeout(capture);
            clearTimeout(fallback);
            if (snapshotUri) releaseCapture(snapshotUri);
        };
    }, [laidOut]);

    useEffect(() => {
        if (!prepared) return undefined;
        if (reduceMotion) {
            progress.value = 1;
            setPacked(true);
        } else {
            progress.value = withTiming(1, { duration: 2200, easing: Easing.linear }, (finished) => {
                if (finished) runOnJS(setPacked)(true);
            });
        }
        return () => cancelAnimation(progress);
    }, [prepared, reduceMotion, progress]);

    useEffect(() => {
        if (!packed || !stampReady) return undefined;
        const finish = () => completeRef.current?.();
        if (reduceMotion) {
            flapClose.value = 1;
            stamp.value = 1;
            const timer = setTimeout(finish, 200);
            return () => clearTimeout(timer);
        }
        flapClose.value = withTiming(1, { duration: 420, easing: Easing.inOut(Easing.cubic) }, (finished) => {
            if (finished) {
                // The wax and stamp only appear once the flap is fully closed.
                stamp.value = withTiming(1, { duration: 1750, easing: Easing.linear }, (stamped) => {
                    if (stamped) {
                        stamp.value = withDelay(250, withTiming(1, { duration: 0 }, (done) => {
                            if (done) runOnJS(finish)();
                        }));
                    }
                });
            }
        });
        return () => {
            cancelAnimation(flapClose);
            cancelAnimation(stamp);
        };
    }, [packed, stampReady, reduceMotion, flapClose, stamp]);

    useEffect(() => {
        // Keep the sealed envelope in the space above the sheet as it slides up.
        if (!choosingBird || !pickerHeight || contentY === null || stageY === null) return undefined;
        const currentCenter = contentY + stageY + envelopeTop + envelopeHeight / 2;
        const visibleTop = insets.top + 12;
        const visibleBottom = Math.max(visibleTop + 40, overlayHeight - pickerHeight - 16);
        const targetCenter = (visibleTop + visibleBottom) / 2;
        lift.value = withTiming(Math.min(0, targetCenter - currentCenter), { duration: reduceMotion ? 0 : 300 });
        envelopeFit.value = withTiming(Math.min(1, (visibleBottom - visibleTop) / envelopeHeight), { duration: reduceMotion ? 0 : 300 });
        labelOpacity.value = withTiming(0, { duration: reduceMotion ? 0 : 180 });
        return () => {
            cancelAnimation(lift);
            cancelAnimation(labelOpacity);
            cancelAnimation(envelopeFit);
        };
    }, [choosingBird, pickerHeight, contentY, stageY, envelopeTop, envelopeHeight, overlayHeight, insets.top, reduceMotion, lift, labelOpacity, envelopeFit]);

    const contentStyle = useAnimatedStyle(() => {
        const pivot = (stageY ?? 0) + envelopeTop + envelopeHeight / 2 - contentHeight / 2;
        return {
            transform: [
                { translateY: lift.value },
                { translateY: pivot },
                { scale: envelopeFit.value },
                { translateY: -pivot },
            ],
        };
    });
    const labelStyle = useAnimatedStyle(() => ({ opacity: labelOpacity.value }));

    const paperStyle = useAnimatedStyle(() => ({
        transform: [
            { translateY: (1 - phase(progress.value, 0, 0.12)) * 18 + phase(progress.value, 0.72, 0.98) * (envelopeTop + envelopeHeight * 0.23 + 6 - paperTop - third) },
            { scale: 0.96 + phase(progress.value, 0, 0.12) * 0.04 },
        ],
    }));
    const envelopeStyle = useAnimatedStyle(() => ({
        opacity: phase(progress.value, 0.54, 0.62),
        transform: [{ translateY: (1 - phase(progress.value, 0.54, 0.71)) * stageHeight }],
    }));
    // Two flat faces share the envelope's hinge. Foreshortening avoids nested
    // SVG backface/3D transforms disappearing when the whole envelope moves.
    const openFlapStyle = useAnimatedStyle(() => ({
        opacity: flapClose.value < 0.5 ? phase(progress.value, 0.54, 0.62) : 0,
        transform: [
            { translateY: (1 - phase(progress.value, 0.54, 0.71)) * stageHeight },
            { translateY: flapHeight / 2 },
            { scaleY: Math.max(0, Math.cos(Math.PI * flapClose.value)) },
            { translateY: -flapHeight / 2 },
        ],
    }));
    const closedFlapStyle = useAnimatedStyle(() => ({
        opacity: flapClose.value >= 0.5 ? phase(progress.value, 0.54, 0.62) : 0,
        transform: [
            { translateY: (1 - phase(progress.value, 0.54, 0.71)) * stageHeight },
            { translateY: -flapHeight / 2 },
            { scaleY: Math.max(0, -Math.cos(Math.PI * flapClose.value)) },
            { translateY: flapHeight / 2 },
        ],
    }));
    const waxStyle = useAnimatedStyle(() => {
        const drop = phase(stamp.value, 0, 0.18);
        const pressure = phase(stamp.value, 0.46, 0.54) - phase(stamp.value, 0.66, 0.78);
        return {
            opacity: phase(stamp.value, 0, 0.08),
            transform: [
                { translateY: -28 * (1 - drop) },
                { scaleX: 0.35 + 0.65 * drop + 0.08 * pressure },
                { scaleY: 0.35 + 0.65 * drop - 0.06 * pressure },
            ],
        };
    });
    const imprintStyle = useAnimatedStyle(() => ({ opacity: phase(stamp.value, 0.7, 0.84) }));
    const stampShadowStyle = useAnimatedStyle(() => {
        const enter = phase(stamp.value, 0.16, 0.38);
        const leave = phase(stamp.value, 0.66, 0.98);
        const nearPaper = phase(stamp.value, 0.3, 0.5) * (1 - phase(stamp.value, 0.66, 0.86));
        return {
            opacity: phase(stamp.value, 0.16, 0.3) * (1 - phase(stamp.value, 0.76, 0.96)) * (0.18 + 0.42 * nearPaper),
            transform: [
                { translateX: stampTravelX * (1 - enter + leave) + 8 * (1 - nearPaper) },
                { translateY: 10 * (1 - nearPaper) },
                { scaleX: 1.45 - 0.45 * nearPaper },
                { scaleY: 1.7 - 0.7 * nearPaper },
            ],
        };
    });
    const stampStyle = useAnimatedStyle(() => {
        const enter = phase(stamp.value, 0.16, 0.38);
        // Keep turning after the stamp is on screen so its rotation is visible.
        const straighten = phase(stamp.value, 0.28, 0.46);
        const leave = phase(stamp.value, 0.66, 0.98);
        const pressure = phase(stamp.value, 0.46, 0.54) - phase(stamp.value, 0.66, 0.78);
        return {
            // Enter and leave beyond the screen edge; never fade the stamp in flight.
            opacity: stamp.value >= 1 ? 0 : 1,
            transform: [
                { translateX: stampTravelX * (1 - enter + leave) },
                { translateY: -26 * (1 - enter) - 14 * (1 - straighten) + 3 * pressure - 42 * leave },
                { perspective: 900 },
                // Rotate around the die, keeping it aligned with the wax at contact.
                { translateY: stampPivotY },
                { rotateX: `${18 * (1 - straighten) - 16 * leave}deg` },
                { rotateY: `${-48 * (1 - straighten) + 42 * leave}deg` },
                { rotateZ: `${22 * (1 - straighten) + 20 * leave}deg` },
                { scale: 1 + 0.08 * (1 - enter + leave) },
                { translateY: -stampPivotY },
            ],
        };
    });

    return (
        <View style={styles.overlay} onLayout={event => setOverlayHeight(event.nativeEvent.layout.height)} accessibilityViewIsModal importantForAccessibility="yes" testID="letter-send-animation">
            <Animated.View
                testID="letter-send-content"
                style={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom }, contentStyle]}
                onLayout={event => {
                    setContentY(event.nativeEvent.layout.y);
                    setContentHeight(event.nativeEvent.layout.height);
                }}
            >
                <Animated.Text style={[styles.title, labelStyle]} accessibilityRole="header" accessibilityElementsHidden={choosingBird}>{translateUiText('Preparing your letter')}</Animated.Text>
                <View testID="letter-send-stage" style={{ width: envelopeWidth + 16, height: stageHeight }} onLayout={event => setStageY(event.nativeEvent.layout.y)} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                    {uri && !prepared ? (
                        <Image
                            source={{ uri }}
                            style={[StyleSheet.absoluteFillObject, { opacity: 0 }]}
                            onLoadEnd={() => setPrepared(true)}
                            onError={() => { setUri(null); setPrepared(true); }}
                        />
                    ) : null}
                    {/* Retire the 3D fold layers once the paper is inside the pocket. */}
                    {!packed ? <Animated.View testID="letter-folding-paper" style={[styles.paper, { left: 24, top: paperTop, width: paperWidth, height: paperHeight }, paperStyle]}>
                        {!prepared ? (
                            <View ref={previewRef} collapsable={false} onLayout={() => setLaidOut(true)}>
                                <PaperPreview {...paperProps} />
                            </View>
                        ) : (
                            <>
                                <View style={{ position: 'absolute', top: third }}><PaperSlice {...paperProps} index={1} /></View>
                                <FoldPanel edge="top" progress={progress} paperProps={paperProps} />
                                <FoldPanel edge="bottom" progress={progress} paperProps={paperProps} />
                            </>
                        )}
                    </Animated.View> : null}

                    <Animated.View testID="letter-envelope-back" style={[styles.envelopeBack, { left: 8, top: envelopeTop, width: envelopeWidth, height: envelopeHeight }, envelopeStyle]}>
                        <Svg width={envelopeWidth} height={envelopeHeight} viewBox="0 0 320 180" preserveAspectRatio="none">
                            <Rect x="1" y="1" width="318" height="178" rx="8" fill="#E8C6AB" stroke="#BC8E70" />
                            <Path d="M8 7 L160 116 L312 7" fill="#D7AA8C" />
                        </Svg>
                    </Animated.View>

                    <Animated.View style={[styles.envelopeFront, { left: 8, top: envelopeTop, width: envelopeWidth, height: envelopeHeight }, envelopeStyle]}>
                        <Svg width={envelopeWidth} height={envelopeHeight} viewBox="0 0 320 180" preserveAspectRatio="none">
                            <Path d="M1 4 L160 38 L319 4 L319 171 Q319 179 311 179 L9 179 Q1 179 1 171 Z" fill="#F6DEC5" stroke="#C99F7E" />
                            <Path d="M4 176 L119 91 Q160 68 201 91 L316 176" fill="#FBE7D2" stroke="#D6B294" />
                        </Svg>
                    </Animated.View>

                    <Animated.View
                        testID="letter-envelope-flap-open"
                        style={[styles.openFlap, { left: 8, top: envelopeTop - flapHeight, width: envelopeWidth, height: flapHeight }, openFlapStyle]}
                    >
                        <Svg width={envelopeWidth} height={flapHeight} viewBox="0 0 320 130" preserveAspectRatio="none">
                            <Path d="M1 129 L153 5 Q160 -1 167 5 L319 129 Z" fill="#E5C2A4" stroke="#C99F7E" />
                        </Svg>
                    </Animated.View>
                    <Animated.View
                        testID="letter-envelope-flap-closed"
                        style={[styles.closedFlap, { left: 8, top: envelopeTop, width: envelopeWidth, height: flapHeight }, closedFlapStyle]}
                    >
                        <Svg width={envelopeWidth} height={flapHeight} viewBox="0 0 320 130" preserveAspectRatio="none">
                            <Path d="M1 1 L153 125 Q160 131 167 125 L319 1 Z" fill="#F1D3B6" stroke="#C99F7E" strokeLinejoin="round" />
                        </Svg>
                    </Animated.View>
                    <Animated.View
                        testID="letter-wax-seal"
                        style={[styles.wax, { left: waxCenterX - waxSize / 2, top: waxCenterY - waxSize / 2, width: waxSize, height: waxSize }, waxStyle]}
                    >
                        <WaxSealArt size={waxSize} />
                        <Animated.View testID="letter-seal-imprint" style={[StyleSheet.absoluteFillObject, imprintStyle]}>
                            <WaxSealImprint size={waxSize} />
                        </Animated.View>
                    </Animated.View>
                    <Animated.Image
                        testID="letter-stamp-shadow"
                        pointerEvents="none"
                        source={STAMP_SHADOW_IMAGE}
                        resizeMode="stretch"
                        fadeDuration={0}
                        onLoadEnd={() => setLoadedTextures(value => value | 2)}
                        style={[styles.stampShadow, { left: waxCenterX - shadowWidth / 2, top: waxCenterY - shadowHeight / 2, width: shadowWidth, height: shadowHeight }, stampShadowStyle]}
                    />
                    <Animated.Image
                        testID="letter-seal-stamp"
                        pointerEvents="none"
                        source={STAMP_IMAGE}
                        resizeMode="stretch"
                        fadeDuration={0}
                        onLoadEnd={() => setLoadedTextures(value => value | 1)}
                        style={[styles.stamp, { left: waxCenterX - stampWidth / 2, top: waxCenterY - stampHeight * (138 / 148), width: stampWidth, height: stampHeight }, stampStyle]}
                    />
                </View>
                <Animated.Text style={[styles.caption, labelStyle]} accessibilityLiveRegion="polite" accessibilityElementsHidden={choosingBird}>
                    {translateUiText('A little care in every fold.')}
                </Animated.Text>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    overlay: { ...StyleSheet.absoluteFillObject, zIndex: 100, backgroundColor: '#FFF6F6', justifyContent: 'center' },
    content: { alignItems: 'center', gap: 18 },
    title: { fontFamily: fontFamily.extraBold, fontSize: 23, color: '#2E1E3C' },
    caption: { fontFamily: fontFamily.bold, fontSize: 14, color: '#7D6574', textAlign: 'center' },
    paper: { position: 'absolute', zIndex: 2 },
    slice: { overflow: 'hidden' },
    fold: { position: 'absolute' },
    face: { ...StyleSheet.absoluteFillObject, backfaceVisibility: 'hidden' },
    frontFace: { transform: [{ rotateX: '0deg' }] },
    backFace: { transform: [{ rotateX: '180deg' }] },
    crease: { position: 'absolute', left: 8, right: 8, height: 1, opacity: 0.5 },
    envelopeBack: { position: 'absolute', zIndex: 1 },
    envelopeFront: { position: 'absolute', zIndex: 3, shadowColor: '#754B35', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 12 },
    openFlap: { position: 'absolute', zIndex: 1 },
    closedFlap: { position: 'absolute', zIndex: 4 },
    wax: { position: 'absolute', zIndex: 5 },
    stampShadow: { position: 'absolute', zIndex: 6 },
    stamp: { position: 'absolute', zIndex: 7 },
});

export default LetterSendAnimation;
