// Premium Scribble Screen - Drawing Canvas
// Enhanced with ink effects and dynamic brush visualization
import React, { useState, useRef, useEffect } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    PanResponder,
    Dimensions,
    Animated,
    Modal,
    Platform,
    ScrollView,
    Image,
    StatusBar,
} from 'react-native';
import penguinLogo from '../../assets/splashscreen.png';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle as SvgCircle } from 'react-native-svg';
import LinearGradient from 'react-native-linear-gradient';
import Button from '../components/Button';
import { colors, spacing, borderRadius, shadows, timing } from '../theme';
import { useSocketContext } from '../context/SocketContext';
import { requestReviewForMoment, REVIEW_MOMENTS } from '../utils/inAppReview';

const { width, height } = Dimensions.get('window');
const CANVAS_SIZE = width - 40;
const LIVE_CANVAS_WIDTH = width;
const LIVE_CANVAS_HEIGHT = height;

const LIVE_STARS = [
    { x: 0.12, y: 0.08, r: 1.8, o: 0.75 },
    { x: 0.28, y: 0.15, r: 1.2, o: 0.55 },
    { x: 0.48, y: 0.07, r: 2.1, o: 0.8 },
    { x: 0.72, y: 0.13, r: 1.5, o: 0.65 },
    { x: 0.9, y: 0.09, r: 2.4, o: 0.85 },
    { x: 0.18, y: 0.34, r: 1.4, o: 0.55 },
    { x: 0.38, y: 0.42, r: 2.2, o: 0.72 },
    { x: 0.64, y: 0.31, r: 1.2, o: 0.52 },
    { x: 0.84, y: 0.38, r: 1.8, o: 0.7 },
    { x: 0.1, y: 0.62, r: 2.1, o: 0.75 },
    { x: 0.31, y: 0.7, r: 1.3, o: 0.55 },
    { x: 0.58, y: 0.62, r: 2, o: 0.7 },
    { x: 0.77, y: 0.76, r: 1.4, o: 0.6 },
    { x: 0.92, y: 0.66, r: 2.2, o: 0.76 },
    { x: 0.22, y: 0.9, r: 1.7, o: 0.65 },
    { x: 0.51, y: 0.86, r: 1.1, o: 0.5 },
    { x: 0.86, y: 0.92, r: 1.6, o: 0.68 },
];

const LIVE_GRADIENTS = [
    { colors: ['#9EDCF6', '#61B8EE', '#2767D9', '#071144'], locations: [0, 0.34, 0.66, 1] },
    { colors: ['#F8D9EC', '#F089B7', '#8D4FBA', '#26145F'], locations: [0, 0.38, 0.72, 1] },
    { colors: ['#A7F3D0', '#34D399', '#0EA5E9', '#0F172A'], locations: [0, 0.34, 0.68, 1] },
    { colors: ['#FDE68A', '#FB923C', '#EF4444', '#451A03'], locations: [0, 0.36, 0.7, 1] },
    { colors: ['#E0E7FF', '#818CF8', '#312E81', '#020617'], locations: [0, 0.35, 0.66, 1] },
];

const noop = () => { };

const normalizePath = (path, prefix, index = 0) => {
    if (!path?.d) return null;
    return {
        ...path,
        id: path.id || `${prefix}-${index}-${path.d.length}`,
    };
};

const normalizePaths = (paths, prefix) => (
    Array.isArray(paths)
        ? paths.map((path, index) => normalizePath(path, prefix, index)).filter(Boolean)
        : []
);

const getPathsSignature = (paths = []) => (
    paths.map(path => `${path.id || ''}:${path.d || ''}:${path.color || ''}:${path.strokeWidth || ''}`).join('|')
);

const formatLiveTime = (date) => date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
}).replace(/\s?(AM|PM)$/i, '');

const formatLiveDate = (date) => date.toLocaleDateString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
});

const brushSizes = [
    { size: 4, name: 'S' },
    { size: 8, name: 'M' },
    { size: 14, name: 'L' },
    { size: 22, name: 'XL' },
];

// HSV to Hex color conversion
const hsvToHex = (h, s, v) => {
    h = ((h % 360) + 360) % 360;
    const c = v * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = v - c;
    let r, g, b;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    const toHex = (val) => {
        const hex = Math.round((val + m) * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
};

const SPECTRUM_COLORS = [
    '#FF0000', '#FFFF00', '#00FF00', '#00FFFF',
    '#0000FF', '#FF00FF', '#FF0000',
];

const pointsToSvgPath = (points) => {
    if (points.length === 0) return '';
    const p0 = points[0];
    if (points.length === 1) {
        return `M${p0.x.toFixed(1)},${p0.y.toFixed(1)} L${p0.x.toFixed(1)},${p0.y.toFixed(1)}`;
    }
    
    let d = `M${p0.x.toFixed(1)},${p0.y.toFixed(1)}`;
    
    if (points.length === 2) {
        const p1 = points[1];
        d += ` L${p1.x.toFixed(1)},${p1.y.toFixed(1)}`;
        return d;
    }
    
    // For 3 or more points, use quadratic Bezier curve to midpoints
    const p1 = points[1];
    const midX = (p0.x + p1.x) / 2;
    const midY = (p0.y + p1.y) / 2;
    d += ` L${midX.toFixed(1)},${midY.toFixed(1)}`;
    
    for (let i = 1; i < points.length - 1; i++) {
        const cp = points[i];
        const next = points[i + 1];
        const mx = (cp.x + next.x) / 2;
        const my = (cp.y + next.y) / 2;
        d += ` Q${cp.x.toFixed(1)},${cp.y.toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`;
    }
    
    const last = points[points.length - 1];
    d += ` L${last.x.toFixed(1)},${last.y.toFixed(1)}`;
    return d;
};



// Full Spectrum Color Picker Component
const SpectrumColorPicker = ({ selectedColor, onColorChange }) => {
    const [hue, setHue] = useState(0);
    const [shadePos, setShadePos] = useState(0.5);
    const [showShade, setShowShade] = useState(false);
    const [hueBarWidth, setHueBarWidth] = useState(0);
    const [shadeBarWidth, setShadeBarWidth] = useState(0);

    const hueBarWidthRef = useRef(0);
    const shadeBarWidthRef = useRef(0);
    const hueRef = useRef(0);
    const shadePosRef = useRef(0.5);
    const onChangeRef = useRef(onColorChange);

    // Animated values for smooth thumb movement (no re-renders during drag)
    const hueThumbX = useRef(new Animated.Value(0)).current;
    const shadeThumbX = useRef(new Animated.Value(0)).current;

    // Start values for dx-based delta dragging
    const hueStartRef = useRef(0);
    const shadeStartRef = useRef(0.5);

    useEffect(() => { onChangeRef.current = onColorChange; }, [onColorChange]);
    useEffect(() => { hueBarWidthRef.current = hueBarWidth; }, [hueBarWidth]);
    useEffect(() => { shadeBarWidthRef.current = shadeBarWidth; }, [shadeBarWidth]);

    // Sync animated thumb position when state changes (grant/release/layout)
    useEffect(() => {
        if (hueBarWidth > 0) {
            hueThumbX.setValue((hue / 360) * hueBarWidth);
        }
    }, [hue, hueBarWidth, hueThumbX]);

    useEffect(() => {
        if (shadeBarWidth > 0) {
            shadeThumbX.setValue(shadePos * shadeBarWidth);
        }
    }, [shadePos, shadeBarWidth, shadeThumbX]);

    const computeColor = (h, sp) => {
        let s, v;
        if (sp <= 0.5) {
            s = sp * 2;
            v = 1;
        } else {
            s = 1;
            v = 1 - (sp - 0.5) * 2;
        }
        return hsvToHex(h, s, Math.max(v, 0.01));
    };

    const huePan = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (e) => {
                const w = hueBarWidthRef.current;
                if (w <= 0) return;
                const x = Math.max(0, Math.min(e.nativeEvent.locationX, w));
                const newHue = (x / w) * 360;
                hueRef.current = newHue;
                hueStartRef.current = newHue;
                hueThumbX.setValue(x);
                setHue(newHue);
            },
            onPanResponderMove: (_, gestureState) => {
                const w = hueBarWidthRef.current;
                if (w <= 0) return;
                const deltaPct = gestureState.dx / w;
                const newHue = Math.max(0, Math.min(hueStartRef.current + deltaPct * 360, 360));
                hueRef.current = newHue;
                hueThumbX.setValue((newHue / 360) * w);
                setHue(newHue);
            },
            onPanResponderRelease: () => {
                setHue(hueRef.current);
                const color = computeColor(hueRef.current, shadePosRef.current);
                if (onChangeRef.current) onChangeRef.current(color);
            },
        })
    ).current;

    const shadePan = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (e) => {
                const w = shadeBarWidthRef.current;
                if (w <= 0) return;
                const x = Math.max(0, Math.min(e.nativeEvent.locationX, w));
                const newPos = x / w;
                shadePosRef.current = newPos;
                shadeStartRef.current = newPos;
                shadeThumbX.setValue(x);
                setShadePos(newPos);
            },
            onPanResponderMove: (_, gestureState) => {
                const w = shadeBarWidthRef.current;
                if (w <= 0) return;
                const deltaPct = gestureState.dx / w;
                const newPos = Math.max(0, Math.min(shadeStartRef.current + deltaPct, 1));
                shadePosRef.current = newPos;
                shadeThumbX.setValue(newPos * w);
                setShadePos(newPos);
            },
            onPanResponderRelease: () => {
                setShadePos(shadePosRef.current);
                const color = computeColor(hueRef.current, shadePosRef.current);
                if (onChangeRef.current) onChangeRef.current(color);
            },
        })
    ).current;

    const pureHueColor = hsvToHex(hue, 1, 1);
    const displayColor = computeColor(hue, shadePos);

    return (
        <View style={styles.spectrumContainer}>
            {/* Hue bar row with preview dot and filter button */}
            <View style={styles.spectrumMainRow}>
                {/* Color preview dot */}
                <View style={[
                    styles.spectrumPreviewDot,
                    { backgroundColor: displayColor },
                    {
                        shadowColor: displayColor,
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.4,
                        shadowRadius: 6,
                    },
                ]} />

                {/* Hue spectrum bar */}
                <View
                    style={styles.spectrumBarOuter}
                    onLayout={(e) => setHueBarWidth(e.nativeEvent.layout.width)}
                    {...huePan.panHandlers}
                >
                    <LinearGradient
                        colors={SPECTRUM_COLORS}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.spectrumBar}
                    />
                    <Animated.View 
                        style={[styles.spectrumThumb, { left: 0, transform: [{ translateX: hueThumbX }] }]}
                        pointerEvents="none"
                    >
                        <View style={[styles.spectrumThumbDot, { backgroundColor: pureHueColor }]} />
                    </Animated.View>
                </View>

                {/* Shade toggle button */}
                <TouchableOpacity
                    onPress={() => {
                        const next = !showShade;
                        setShowShade(next);
                        if (!next) {
                            // Reset to middle shade when closing
                            shadePosRef.current = 0.5;
                            setShadePos(0.5);
                            const color = computeColor(hueRef.current, 0.5);
                            if (onChangeRef.current) onChangeRef.current(color);
                        }
                    }}
                    activeOpacity={0.7}
                    style={[
                        styles.spectrumFilterBtn,
                        showShade && styles.spectrumFilterBtnActive,
                    ]}
                >
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                        <Path
                            d="M12 3v1m0 16v1m8.66-13.5l-.87.5M4.21 16.5l-.87.5M20.66 16.5l-.87-.5M4.21 7.5l-.87-.5M21 12h-1M4 12H3m13.5 0a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"
                            stroke={showShade ? '#FFFFFF' : colors.textSecondary}
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </Svg>
                </TouchableOpacity>
            </View>

            {/* Shade bar - only visible when filter button is active */}
            {showShade && (
                <View style={styles.spectrumShadeRow}>
                    <Text style={styles.spectrumShadeLabel}>Shade</Text>
                    <View
                        style={styles.spectrumBarOuter}
                        onLayout={(e) => setShadeBarWidth(e.nativeEvent.layout.width)}
                        {...shadePan.panHandlers}
                    >
                        <LinearGradient
                            colors={['#FFFFFF', pureHueColor, '#000000']}
                            locations={[0, 0.5, 1]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.spectrumBar}
                        />
                        <Animated.View 
                            style={[styles.spectrumThumb, { left: 0, transform: [{ translateX: shadeThumbX }] }]}
                            pointerEvents="none"
                        >
                            <View style={[styles.spectrumThumbDot, { backgroundColor: displayColor }]} />
                        </Animated.View>
                    </View>
                </View>
            )}
        </View>
    );
};

const BrushSlider = ({ min = 2, max = 30, value, onChange, selectedColor }) => {
    const [sliderWidth, setSliderWidth] = useState(0);
    const [localValue, setLocalValue] = useState(value);
    
    const sliderWidthRef = useRef(0);
    const valueRef = useRef(value);
    const onChangeRef = useRef(onChange);
    const minRef = useRef(min);
    const maxRef = useRef(max);

    // Keep internal values synchronized
    useEffect(() => {
        setLocalValue(value);
        valueRef.current = value;
    }, [value]);

    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    useEffect(() => {
        sliderWidthRef.current = sliderWidth;
    }, [sliderWidth]);

    useEffect(() => {
        minRef.current = min;
        maxRef.current = max;
    }, [min, max]);

    const percentage = ((localValue - min) / (max - min)) * 100;
    const startValue = useRef(value);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                startValue.current = valueRef.current;
            },
            onPanResponderMove: (evt, gestureState) => {
                const sWidth = sliderWidthRef.current;
                const minimum = minRef.current;
                const maximum = maxRef.current;

                if (sWidth <= 0) return;
                const deltaPct = gestureState.dx / sWidth;
                const deltaVal = deltaPct * (maximum - minimum);
                const newValue = Math.round(startValue.current + deltaVal);
                const clamped = Math.max(minimum, Math.min(newValue, maximum));
                
                // Update mutable ref immediately so it's always accurate
                valueRef.current = clamped;
                
                // Update local state ONLY for 60fps rendering of the slider itself
                setLocalValue(clamped);
            },
            onPanResponderRelease: () => {
                // Sync with parent when user finishes dragging (ultra-efficient!)
                if (onChangeRef.current) {
                    onChangeRef.current(valueRef.current);
                }
            }
        })
    ).current;

    return (
        <View 
            style={styles.sliderWrapper}
            onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
            {...panResponder.panHandlers}
        >
            <Text style={styles.sliderValueText}>{localValue}px</Text>
            
            <View style={styles.sliderTrackContainer}>
                <View style={styles.sliderTrackBg}>
                    <View 
                        style={[
                            styles.sliderTrackActive, 
                            { 
                                width: `${percentage}%`,
                                backgroundColor: selectedColor,
                            }
                        ]} 
                    />
                </View>
                <View 
                    style={[
                        styles.sliderThumb,
                        {
                            left: `${percentage}%`,
                            borderColor: selectedColor,
                        }
                    ]}
                >
                    <View 
                        style={[
                            styles.sliderThumbInner,
                            {
                                backgroundColor: selectedColor,
                            }
                        ]}
                    />
                </View>
            </View>
            
            <View style={styles.sliderPreviewContainer}>
                <View 
                    style={[
                        styles.sliderPreviewDot,
                        {
                            width: localValue,
                            height: localValue,
                            borderRadius: localValue / 2,
                            backgroundColor: selectedColor,
                        }
                    ]}
                />
            </View>
        </View>
    );
};

export const ScribbleScreen = ({
    onSend = () => { },
    onBack = () => { },
    hasPartner = false,
    onLinkPartner = () => { },
    onLiveModeChange = noop,
    userName = 'You',
    partnerName = 'Your Love',
    initialPaths = [],
    initialLiveMode = false,
}) => {
    const [paths, setPaths] = useState(() => normalizePaths(initialPaths, 'initial'));
    const [currentPath, setCurrentPath] = useState('');
    const [selectedColor, setSelectedColor] = useState('#FF0000');
    const [selectedSize, setSelectedSize] = useState(6);
    const [inkSplash, setInkSplash] = useState(null);
    const [sentScribble, setSentScribble] = useState(null); // Store sent scribble for preview
    const [showWidgetTutorial, setShowWidgetTutorial] = useState(false);
    const [tutorialStep, setTutorialStep] = useState(0);
    const [connectionError, setConnectionError] = useState(false);
    const [liveMode, setLiveMode] = useState(initialLiveMode);
    const [liveSaving, setLiveSaving] = useState(false);
    const [livePartnerAvailable, setLivePartnerAvailable] = useState(false);
    const [liveClock, setLiveClock] = useState(new Date());
    const [showLivePicker, setShowLivePicker] = useState(false);
    const [showLiveBrushPicker, setShowLiveBrushPicker] = useState(false);
    const [showLiveGradientPicker, setShowLiveGradientPicker] = useState(false);
    const [liveGradientIndex, setLiveGradientIndex] = useState(0);
    const insets = useSafeAreaInsets();
    const { socket, isConnected, partnerOnline } = useSocketContext();
    const canvasOpacity = useRef(new Animated.Value(0)).current;
    const modalOpacity = useRef(new Animated.Value(0)).current;
    const modalScale = useRef(new Animated.Value(0.85)).current;
    const canvasWidth = CANVAS_SIZE;
    const canvasHeight = CANVAS_SIZE;

    // Animate modal entrance
    useEffect(() => {
        if (showWidgetTutorial) {
            setTutorialStep(0); // Reset to first step when opening
            Animated.parallel([
                Animated.timing(modalOpacity, {
                    toValue: 1,
                    duration: 250,
                    useNativeDriver: true,
                }),
                Animated.spring(modalScale, {
                    toValue: 1,
                    ...timing.springBouncy,
                    useNativeDriver: true,
                }),
            ]).start();
        } else {
            modalOpacity.setValue(0);
            modalScale.setValue(0.85);
        }
    }, [showWidgetTutorial, modalOpacity, modalScale]);

    const handleTutorialScroll = (event) => {
        const contentOffset = event.nativeEvent.contentOffset.x;
        const layoutWidth = event.nativeEvent.layoutMeasurement.width;
        const pageIndex = Math.round(contentOffset / layoutWidth);
        if (pageIndex !== tutorialStep) {
            setTutorialStep(pageIndex);
        }
    };

    // Platform-specific widget instructions
    const widgetInstructions = Platform.select({
        ios: [
            { step: 1, icon: '👆', text: 'Long press on your home screen' },
            { step: 2, icon: '➕', text: 'Tap the + button (top-left corner)' },
            { step: 3, icon: '🔍', text: 'Search for "Penguin" or scroll to find it' },
            { step: 4, icon: '✨', text: 'Choose widget size and tap "Add Widget"' },
        ],
        android: [
            { step: 1, icon: '👆', text: 'Long press on your home screen' },
            { step: 2, icon: '📱', text: 'Tap "Widgets" from the menu' },
            { step: 3, icon: '🔍', text: 'Find "Penguin" in the widget list' },
            { step: 4, icon: '✨', text: 'Drag the widget to your home screen' },
        ],
    });

    // Use refs to avoid stale closures in PanResponder
    const currentPathRef = useRef('');
    const currentPointsRef = useRef([]);
    const selectedColorRef = useRef(selectedColor);
    const selectedSizeRef = useRef(selectedSize);
    const pathIdCounter = useRef(0);
    const liveModeRef = useRef(false);
    const liveAnnouncedRef = useRef(false);
    const livePartnerAvailableRef = useRef(false);
    const isConnectedRef = useRef(isConnected);
    const socketRef = useRef(socket);
    const pathsRef = useRef(paths);
    const initialPathsSignatureRef = useRef(getPathsSignature(paths));

    // Keep refs in sync with state
    React.useEffect(() => {
        selectedColorRef.current = selectedColor;
    }, [selectedColor]);

    React.useEffect(() => {
        selectedSizeRef.current = selectedSize;
    }, [selectedSize]);

    React.useEffect(() => {
        liveModeRef.current = liveMode;
        onLiveModeChange(liveMode);
        if (liveMode) {
            setSentScribble(null);
        } else {
            setShowLivePicker(false);
            setShowLiveBrushPicker(false);
            setShowLiveGradientPicker(false);
        }
    }, [liveMode, onLiveModeChange]);

    React.useEffect(() => {
        if (!socket || !isConnected) return undefined;

        if (liveMode && !liveAnnouncedRef.current) {
            socket.emit('scribble:liveStart');
            liveAnnouncedRef.current = true;
        }

        if (!liveMode && liveAnnouncedRef.current) {
            socket.emit('scribble:liveEnd');
            liveAnnouncedRef.current = false;
        }

        return undefined;
    }, [liveMode, socket, isConnected]);

    React.useEffect(() => {
        return () => {
            if (liveAnnouncedRef.current && socketRef.current && isConnectedRef.current) {
                socketRef.current.emit('scribble:liveEnd');
                liveAnnouncedRef.current = false;
            }
            onLiveModeChange(false);
        };
    }, [onLiveModeChange]);

    React.useEffect(() => {
        socketRef.current = socket;
    }, [socket]);

    React.useEffect(() => {
        pathsRef.current = paths;
    }, [paths]);

    React.useEffect(() => {
        isConnectedRef.current = isConnected;
    }, [isConnected]);

    React.useEffect(() => {
        const nextPaths = normalizePaths(initialPaths, 'shared');
        const nextSignature = getPathsSignature(nextPaths);

        if (nextSignature !== initialPathsSignatureRef.current) {
            initialPathsSignatureRef.current = nextSignature;
            pathsRef.current = nextPaths;
            setPaths(nextPaths);
            setCurrentPath('');
            currentPointsRef.current = [];
            setSentScribble(null);
        }
    }, [initialPaths]);

    React.useEffect(() => {
        const available = Boolean(partnerOnline && isConnected);
        setLivePartnerAvailable(available);
        livePartnerAvailableRef.current = available;
    }, [partnerOnline, isConnected]);

    React.useEffect(() => {
        Animated.timing(canvasOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
        }).start();
    }, [canvasOpacity]);

    React.useEffect(() => {
        if (!liveMode) return undefined;

        setLiveClock(new Date());
        const timer = setInterval(() => {
            setLiveClock(new Date());
        }, 30000);

        return () => clearInterval(timer);
    }, [liveMode]);

    React.useEffect(() => {
        if (!socket) return;

        const handleLiveStrokeReceived = (data = {}) => {
            if (!data.stroke?.d) return;
            const nextPath = normalizePath(data.stroke, `remote-${Date.now()}`, 0);
            if (nextPath) {
                setPaths(prev => {
                    const nextPaths = [...prev, nextPath];
                    pathsRef.current = nextPaths;
                    return nextPaths;
                });
            }
            setSentScribble(null);
        };

        const handleLiveCleared = () => {
            pathsRef.current = [];
            setPaths([]);
            setCurrentPath('');
            currentPointsRef.current = [];
            setSentScribble(null);
        };

        const handleLiveUndone = (data = {}) => {
            if (!data.strokeId) return;
            setPaths(prev => {
                const nextPaths = prev.filter(path => path.id !== data.strokeId);
                pathsRef.current = nextPaths;
                return nextPaths;
            });
        };

        const handleLiveStatus = (data = {}) => {
            const available = Boolean(data.partnerAvailable && isConnectedRef.current);
            setLivePartnerAvailable(available);
            livePartnerAvailableRef.current = available;
            if (!available) {
                setLiveSaving(false);
            }
        };

        const handleLiveSaved = () => {
            setLiveSaving(false);
        };

        socket.on('scribble:liveStrokeReceived', handleLiveStrokeReceived);
        socket.on('scribble:liveCleared', handleLiveCleared);
        socket.on('scribble:liveUndone', handleLiveUndone);
        socket.on('scribble:liveStatus', handleLiveStatus);
        socket.on('scribble:liveSaved', handleLiveSaved);

        return () => {
            socket.off('scribble:liveStrokeReceived', handleLiveStrokeReceived);
            socket.off('scribble:liveCleared', handleLiveCleared);
            socket.off('scribble:liveUndone', handleLiveUndone);
            socket.off('scribble:liveStatus', handleLiveStatus);
            socket.off('scribble:liveSaved', handleLiveSaved);
        };
    }, [socket]);

    const canSendLiveStroke = () => (
        liveModeRef.current &&
        livePartnerAvailableRef.current &&
        isConnectedRef.current &&
        socketRef.current?.connected
    );

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (evt) => {
                setShowLivePicker(false);
                setShowLiveBrushPicker(false);
                setShowLiveGradientPicker(false);
                const { locationX, locationY } = evt.nativeEvent;
                currentPointsRef.current = [{ x: locationX, y: locationY }];
                const newPath = pointsToSvgPath(currentPointsRef.current);
                currentPathRef.current = newPath;
                setCurrentPath(newPath);

                // Show ink splash effect
                setInkSplash({ x: locationX, y: locationY });
                setTimeout(() => setInkSplash(null), 300);
            },
            onPanResponderMove: (evt) => {
                const { locationX, locationY } = evt.nativeEvent;
                const points = currentPointsRef.current;
                const lastPoint = points[points.length - 1];
                if (lastPoint) {
                    const dx = locationX - lastPoint.x;
                    const dy = locationY - lastPoint.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    // Filter out tiny micro-movements to reduce rendering load and jitter
                    if (dist < 3) return;
                }

                points.push({ x: locationX, y: locationY });
                const updatedPath = pointsToSvgPath(points);
                currentPathRef.current = updatedPath;
                setCurrentPath(updatedPath);
            },
            onPanResponderRelease: () => {
                if (currentPathRef.current) {
                    const pathId = `live-${Date.now()}-${pathIdCounter.current++}`;
                    const newPath = {
                        id: pathId,
                        d: currentPathRef.current,
                        color: selectedColorRef.current,
                        strokeWidth: selectedSizeRef.current
                    };
                    const nextPaths = [...pathsRef.current, newPath];
                    pathsRef.current = nextPaths;
                    setPaths(nextPaths);
                    if (canSendLiveStroke()) {
                        setLiveSaving(true);
                        socketRef.current.emit('scribble:liveStrokeEnd', {
                            stroke: {
                                id: newPath.id,
                                d: newPath.d,
                                color: newPath.color,
                                strokeWidth: newPath.strokeWidth,
                            },
                            paths: nextPaths,
                        });
                    }
                    currentPathRef.current = '';
                    currentPointsRef.current = [];
                    setCurrentPath('');
                }
            },
        })
    ).current;

    const handleClear = () => {
        pathsRef.current = [];
        setPaths([]);
        setCurrentPath('');
        currentPointsRef.current = [];
        setSentScribble(null);
        if (canSendLiveStroke()) {
            socketRef.current.emit('scribble:liveClear');
        }
    };

    const handleUndo = () => {
        const previousPaths = pathsRef.current;
        const removedPath = previousPaths[previousPaths.length - 1];
        const nextPaths = previousPaths.slice(0, -1);
        pathsRef.current = nextPaths;
        setPaths(nextPaths);
        if (removedPath?.id && canSendLiveStroke()) {
            socketRef.current.emit('scribble:liveUndo', {
                strokeId: removedPath.id,
                paths: nextPaths,
            });
        }
    };

    const handleLiveToggle = () => {
        const nextLiveMode = !liveMode;
        liveModeRef.current = nextLiveMode;
        setLiveMode(nextLiveMode);
        setConnectionError(false);
    };

    const handleLiveBack = () => {
        liveModeRef.current = false;
        setLiveMode(false);
        setShowLivePicker(false);
        setShowLiveBrushPicker(false);
        setShowLiveGradientPicker(false);
    };

    const handleSend = () => {
        if (paths.length === 0) return;
     

        // Send via socket
        if (socket && isConnected) {
            const pathsToSend = paths.map(p => ({
                d: p.d,
                color: p.color,
                strokeWidth: p.strokeWidth,
            }));

            socket.emit('scribble:send', { paths: pathsToSend });

            setCurrentPath('');
            setSentScribble(null);
            requestReviewForMoment(REVIEW_MOMENTS.SCRIBBLE_SENT);

            // Call parent's onSend if provided
            onSend(pathsToSend);
        } else {
            setConnectionError(true);
            setTimeout(() => setConnectionError(false), 3000);
        }
    };

    const hasPendingScribbleChanges = paths.length > 0
        && getPathsSignature(paths) !== initialPathsSignatureRef.current;

    if (liveMode) {
        return (
            <LinearGradient
                colors={LIVE_GRADIENTS[liveGradientIndex].colors}
                locations={LIVE_GRADIENTS[liveGradientIndex].locations}
                start={{ x: 0.18, y: 0 }}
                end={{ x: 0.82, y: 1 }}
                style={styles.liveFullscreen}
            >
                <StatusBar hidden />
                <Svg
                    width={LIVE_CANVAS_WIDTH}
                    height={LIVE_CANVAS_HEIGHT}
                    style={styles.liveStarsLayer}
                    pointerEvents="none"
                >
                    {LIVE_STARS.map((star, index) => (
                        <React.Fragment key={`fullscreen-star-bg-${index}`}>
                            <SvgCircle
                                cx={star.x * LIVE_CANVAS_WIDTH}
                                cy={star.y * LIVE_CANVAS_HEIGHT}
                                r={star.r}
                                fill="#FFFFFF"
                                opacity={star.o}
                            />
                            {index % 3 === 0 && (
                                <Path
                                    d={`M${(star.x * LIVE_CANVAS_WIDTH - 5).toFixed(1)},${(star.y * LIVE_CANVAS_HEIGHT).toFixed(1)} L${(star.x * LIVE_CANVAS_WIDTH + 5).toFixed(1)},${(star.y * LIVE_CANVAS_HEIGHT).toFixed(1)} M${(star.x * LIVE_CANVAS_WIDTH).toFixed(1)},${(star.y * LIVE_CANVAS_HEIGHT - 5).toFixed(1)} L${(star.x * LIVE_CANVAS_WIDTH).toFixed(1)},${(star.y * LIVE_CANVAS_HEIGHT + 5).toFixed(1)}`}
                                    stroke="#FFFFFF"
                                    strokeWidth={1}
                                    strokeLinecap="round"
                                    opacity={star.o * 0.55}
                                />
                            )}
                        </React.Fragment>
                    ))}
                </Svg>
                <TouchableOpacity
                    style={styles.liveDismissLayer}
                    onPress={() => {
                        setShowLivePicker(false);
                        setShowLiveBrushPicker(false);
                        setShowLiveGradientPicker(false);
                    }}
                    activeOpacity={1}
                />
                <TouchableOpacity
                    style={[styles.liveBackButton, { top: insets.top + 12 }]}
                    onPress={handleLiveBack}
                    activeOpacity={0.86}
                >
                    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                        <Path
                            d="M15 18l-6-6 6-6"
                            stroke="#FFFFFF"
                            strokeWidth={2.5}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </Svg>
                </TouchableOpacity>
                <View style={[styles.liveLockHeader, { paddingTop: insets.top + 72 }]}>
                    <Text style={styles.liveLockDate}>{formatLiveDate(liveClock)}</Text>
                    <Text style={styles.liveLockTime}>{formatLiveTime(liveClock)}</Text>
                    <View style={styles.liveNamesBadge}>
                        <Text style={styles.liveNamesText} numberOfLines={1}>
                            {userName} + {partnerName}
                        </Text>
                    </View>
                </View>
                <View style={styles.livePaperStage}>
                    <View style={[styles.livePaperFrame, { width: CANVAS_SIZE + 3, height: CANVAS_SIZE + 3 }]}>
                        <View style={styles.livePaperClip}>
                            <View
                                style={[styles.canvas, styles.liveTransparentCanvas, { width: canvasWidth, height: canvasHeight }]}
                                {...panResponder.panHandlers}
                            >
                                <Svg width={canvasWidth} height={canvasHeight}>
                                    {paths.map((path, index) => (
                                        <Path
                                            key={path.id || `live-path-${index}`}
                                            d={path.d}
                                            stroke={path.color}
                                            strokeWidth={path.strokeWidth}
                                            fill="none"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    ))}
                                    {currentPath && (
                                        <Path
                                            d={currentPath}
                                            stroke={selectedColor}
                                            strokeWidth={selectedSize}
                                            fill="none"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />
                                    )}
                                    {inkSplash && (
                                        <>
                                            <SvgCircle
                                                key="live-splash-outer"
                                                cx={inkSplash.x}
                                                cy={inkSplash.y}
                                                r={selectedSize + 8}
                                                fill={selectedColor}
                                                opacity={0.3}
                                            />
                                            <SvgCircle
                                                key="live-splash-inner"
                                                cx={inkSplash.x}
                                                cy={inkSplash.y}
                                                r={selectedSize + 4}
                                                fill={selectedColor}
                                                opacity={0.5}
                                            />
                                        </>
                                    )}
                                </Svg>
                            </View>
                        </View>
                    </View>
                </View>
                {showLivePicker && (
                    <View style={[styles.livePickerPanel, { bottom: insets.bottom + 92 }]}>
                        <View style={styles.livePickerSection}>
                            <SpectrumColorPicker
                                selectedColor={selectedColor}
                                onColorChange={setSelectedColor}
                            />
                        </View>
                    </View>
                )}
                {showLiveBrushPicker && (
                    <View style={[styles.liveBrushPanel, { bottom: insets.bottom + 92 }]}>
                        <BrushSlider
                            min={2}
                            max={30}
                            value={selectedSize}
                            onChange={setSelectedSize}
                            selectedColor={selectedColor}
                        />
                    </View>
                )}
                {showLiveGradientPicker && (
                    <View style={[styles.liveGradientPanel, { bottom: insets.bottom + 92 }]}>
                        {LIVE_GRADIENTS.map((gradient, index) => (
                            <TouchableOpacity
                                key={gradient.colors.join('-')}
                                style={[
                                    styles.liveGradientOption,
                                    liveGradientIndex === index && styles.liveGradientOptionActive,
                                ]}
                                onPress={() => {
                                    setLiveGradientIndex(index);
                                    setShowLiveGradientPicker(false);
                                }}
                                activeOpacity={0.86}
                            >
                                <LinearGradient
                                    colors={gradient.colors}
                                    locations={gradient.locations}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.liveGradientSwatch}
                                />
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
                <View style={[styles.liveFloatingToolbar, { bottom: insets.bottom + 18 }]}>
                    <TouchableOpacity style={styles.liveToolButton} onPress={handleUndo}>
                        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                            <Path
                                d="M3 10h10a5 5 0 015 5v2M3 10l5-5M3 10l5 5"
                                stroke="#FFFFFF"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </Svg>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.liveSelectedColorButton,
                            showLivePicker && styles.liveSelectedColorButtonActive,
                        ]}
                        onPress={() => {
                            setShowLivePicker(prev => !prev);
                            setShowLiveBrushPicker(false);
                            setShowLiveGradientPicker(false);
                        }}
                        activeOpacity={0.86}
                    >
                        <View style={[styles.liveSelectedColorDot, { backgroundColor: selectedColor }]}>
                            <View
                                style={[
                                    styles.liveSelectedBrushDot,
                                    {
                                        width: Math.max(6, Math.min(selectedSize, 18)),
                                        height: Math.max(6, Math.min(selectedSize, 18)),
                                        borderRadius: Math.max(3, Math.min(selectedSize, 18) / 2),
                                    },
                                ]}
                            />
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.liveBrushButton,
                            showLiveBrushPicker && styles.liveBrushButtonActive,
                        ]}
                        onPress={() => {
                            setShowLiveBrushPicker(prev => !prev);
                            setShowLivePicker(false);
                            setShowLiveGradientPicker(false);
                        }}
                        activeOpacity={0.86}
                    >
                        <Svg width={21} height={21} viewBox="0 0 24 24" fill="none">
                            <Path
                                d="m11 10 3 3"
                                stroke="#FFFFFF"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                            <Path
                                d="M6.5 21A3.5 3.5 0 1 0 3 17.5a2.62 2.62 0 0 1-.708 1.792A1 1 0 0 0 3 21z"
                                stroke="#FFFFFF"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                            <Path
                                d="M9.969 17.031 21.378 5.624a1 1 0 0 0-3.002-3.002L6.967 14.031"
                                stroke="#FFFFFF"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </Svg>
                        <View
                            style={[
                                styles.liveBrushButtonDot,
                                {
                                    width: Math.max(5, Math.min(selectedSize, 13)),
                                    height: Math.max(5, Math.min(selectedSize, 13)),
                                    borderRadius: Math.max(2.5, Math.min(selectedSize, 13) / 2),
                                    backgroundColor: selectedColor,
                                },
                            ]}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.liveGradientButton,
                            showLiveGradientPicker && styles.liveGradientButtonActive,
                        ]}
                        onPress={() => {
                            setShowLiveGradientPicker(prev => !prev);
                            setShowLivePicker(false);
                            setShowLiveBrushPicker(false);
                        }}
                        activeOpacity={0.86}
                    >
                        <LinearGradient
                            colors={LIVE_GRADIENTS[liveGradientIndex].colors}
                            locations={LIVE_GRADIENTS[liveGradientIndex].locations}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.liveGradientButtonPreview}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.liveToolButton} onPress={handleClear}>
                        <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                            <Path
                                d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"
                                stroke="#FFFFFF"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </Svg>
                    </TouchableOpacity>
                </View>
            </LinearGradient>
        );
    }

    return (
        <LinearGradient
            colors={['#F8D9EC', '#FFF7FA', '#FFF4F7', '#F7D8F2']}
            locations={[0, 0.34, 0.72, 1]}
            start={{ x: 0.25, y: 0 }}
            end={{ x: 0.75, y: 1 }}
            style={{ flex: 1 }}
        >
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.lg }]}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerTopRow}>
                        <View style={styles.headerContent}>
                            <Text style={styles.title} numberOfLines={1}>Canvas</Text>
                        </View>
                        <View style={styles.headerSecondaryActions}>
                            {/* Widget Button */}
                            <TouchableOpacity style={styles.addHomeButton} onPress={() => setShowWidgetTutorial(true)} activeOpacity={0.85}>
                                <Text style={styles.addHomeButtonText}>+ Home Screen</Text>
                            </TouchableOpacity>
                            {hasPartner && (
                                <TouchableOpacity
                                    style={[
                                        styles.liveToggleButton,
                                        liveMode && styles.liveToggleButtonActive,
                                    ]}
                                    onPress={handleLiveToggle}
                                    activeOpacity={0.85}
                                >
                                    <Text style={[
                                        styles.liveToggleText,
                                        liveMode && styles.liveToggleTextActive,
                                    ]}>
                                        {liveMode ? 'Live On' : 'Live Off'}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>

                {/* Canvas */}
                <Animated.View
                    style={[
                        styles.canvasShadowContainer,
                        liveMode && styles.liveCanvasShadowContainer,
                        { opacity: canvasOpacity, width: canvasWidth + 3, height: canvasHeight + 3 },
                    ]}
                >
                    <View style={[styles.canvasClippedContainer, liveMode && styles.liveCanvasClippedContainer]}>
                        <LinearGradient
                            colors={liveMode ? ['#1B1237', '#4B2E83', '#EC7AB7'] : ['#FFFFFF', '#FFF9FB']}
                            locations={liveMode ? [0, 0.56, 1] : undefined}
                            start={liveMode ? { x: 0.15, y: 0 } : { x: 0, y: 0 }}
                            end={liveMode ? { x: 0.85, y: 1 } : { x: 1, y: 1 }}
                            style={styles.canvasGradient}
                        >
                        <View
                            style={[
                                styles.canvas,
                                liveMode && styles.liveCanvas,
                                { width: canvasWidth, height: canvasHeight },
                            ]}
                            {...panResponder.panHandlers}
                        >
                            <Svg width={canvasWidth} height={canvasHeight}>
                                {liveMode && LIVE_STARS.map((star, index) => (
                                    <React.Fragment key={`star-${index}`}>
                                        <SvgCircle
                                            cx={star.x * canvasWidth}
                                            cy={star.y * canvasHeight}
                                            r={star.r}
                                            fill="#FFFFFF"
                                            opacity={star.o}
                                        />
                                        {index % 3 === 0 && (
                                            <Path
                                                d={`M${(star.x * canvasWidth - 5).toFixed(1)},${(star.y * canvasHeight).toFixed(1)} L${(star.x * canvasWidth + 5).toFixed(1)},${(star.y * canvasHeight).toFixed(1)} M${(star.x * canvasWidth).toFixed(1)},${(star.y * canvasHeight - 5).toFixed(1)} L${(star.x * canvasWidth).toFixed(1)},${(star.y * canvasHeight + 5).toFixed(1)}`}
                                                stroke="#FFFFFF"
                                                strokeWidth={1}
                                                strokeLinecap="round"
                                                opacity={star.o * 0.55}
                                            />
                                        )}
                                    </React.Fragment>
                                ))}
                                {/* Draw completed paths */}
                                {paths.map((path, index) => (
                                    <Path
                                        key={path.id || `path-${index}`}
                                        d={path.d}
                                        stroke={path.color}
                                        strokeWidth={path.strokeWidth}
                                        fill="none"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                ))}
                                {/* Current drawing path */}
                                {currentPath && (
                                    <Path
                                        d={currentPath}
                                        stroke={selectedColor}
                                        strokeWidth={selectedSize}
                                        fill="none"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                )}
                                {/* Ink splash effect */}
                                {inkSplash && (
                                    <>
                                        <SvgCircle
                                            key="splash-outer"
                                            cx={inkSplash.x}
                                            cy={inkSplash.y}
                                            r={selectedSize + 8}
                                            fill={selectedColor}
                                            opacity={0.3}
                                        />
                                        <SvgCircle
                                            key="splash-inner"
                                            cx={inkSplash.x}
                                            cy={inkSplash.y}
                                            r={selectedSize + 4}
                                            fill={selectedColor}
                                            opacity={0.5}
                                        />
                                    </>
                                )}
                            </Svg>

                            {/* Empty State */}
                            {paths.length === 0 && !currentPath && !sentScribble && (
                                <View style={styles.emptyState}>
                                    <Text style={styles.emptyEmoji}>💕</Text>
                                    <Text style={[styles.emptyText, liveMode && styles.liveEmptyText]}>Draw with your finger</Text>
                                    <Text style={[styles.emptyHint, liveMode && styles.liveEmptyHint]}>Express your love through art</Text>
                                </View>
                            )}

                            {/* Sent State - Shows inside canvas */}
                            {sentScribble && paths.length === 0 && (
                                <TouchableOpacity
                                    style={styles.sentState}
                                    onPress={() => setSentScribble(null)}
                                    activeOpacity={0.9}
                                >
                                    {/* Success Badge */}
                                    <View style={styles.sentSuccessBadge}>
                                        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                                            <Path
                                                d="M20 6L9 17l-5-5"
                                                stroke="#FFFFFF"
                                                strokeWidth={3}
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />
                                        </Svg>
                                    </View>

                                    {/* Sent Text */}
                                    <Text style={styles.sentTitle}>Sent with love! 💕</Text>

                                    {/* Preview of sent scribble */}
                                    <View style={styles.sentPreviewInCanvas}>
                                        <Svg width={140} height={140} viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`}>
                                            {sentScribble.paths.map((path, index) => (
                                                <Path
                                                    key={path.id || `sent-path-${index}`}
                                                    d={path.d}
                                                    stroke={path.color}
                                                    strokeWidth={path.strokeWidth}
                                                    fill="none"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                            ))}
                                        </Svg>
                                    </View>

                                    {/* Hint */}
                                    <Text style={styles.sentHint}>Tap anywhere to draw another</Text>
                                </TouchableOpacity>
                            )}

                            {/* Paper texture overlay */}
                            <View style={styles.paperTexture} />
                        </View>
                    </LinearGradient>
                </View>
            </Animated.View>

                <View style={styles.canvasActions}>
                    <TouchableOpacity style={styles.canvasActionButton} onPress={handleUndo}>
                        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                            <Path
                                d="M3 10h10a5 5 0 015 5v2M3 10l5-5M3 10l5 5"
                                stroke={colors.text}
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </Svg>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.canvasActionButton} onPress={handleClear}>
                        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                            <Path
                                d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"
                                stroke={colors.text}
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </Svg>
                    </TouchableOpacity>
                </View>

                {!liveMode && (
                    <>
                        {/* Color Picker */}
                        <View style={styles.toolSection}>
                            <Text style={styles.toolLabel}>Color</Text>
                            <SpectrumColorPicker
                                selectedColor={selectedColor}
                                onColorChange={setSelectedColor}
                            />
                        </View>

                        {/* Brush Size */}
                        <View style={styles.toolSection}>
                            <Text style={styles.toolLabel}>Brush Size</Text>
                            <BrushSlider 
                                min={2}
                                max={30}
                                value={selectedSize}
                                onChange={setSelectedSize}
                                selectedColor={selectedColor}
                            />
                        </View>
                    </>
                )}

                {/* Send Button */}
                <View style={styles.sendContainer}>
                    {connectionError && (
                        <Text style={styles.connectionErrorText}>
                            Not connected to server. Please try again.
                        </Text>
                    )}
                    {liveMode ? (
                        <View style={styles.liveStatusBox}>
                            <Text style={styles.liveStatusText}>
                                {livePartnerAvailable
                                    ? (liveSaving ? 'Live On - Saving...' : 'Live On - Auto sending')
                                    : 'Live On - Partner offline'}
                            </Text>
                        </View>
                    ) : hasPartner ? (
                        <TouchableOpacity
                            onPress={handleSend}
                            disabled={paths.length === 0}
                            activeOpacity={0.9}
                            style={[
                                styles.scribbleSendButton,
                                !hasPendingScribbleChanges && styles.scribbleSendButtonIdle,
                                hasPendingScribbleChanges && styles.scribbleSendButtonPending,
                                paths.length === 0 && styles.scribbleSendButtonDisabled,
                            ]}
                        >
                            <View style={styles.scribbleSendContent}>
                                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                                    <Path
                                        d="M21 4L10 15M21 4l-7 17-4-6-6-4 17-7z"
                                        stroke={hasPendingScribbleChanges ? '#FFFFFF' : colors.textSecondary}
                                        strokeWidth={2.1}
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </Svg>
                                <Text style={[
                                    styles.scribbleSendText,
                                    !hasPendingScribbleChanges && styles.scribbleSendTextIdle,
                                ]}>
                                    Send to Your Love
                                </Text>
                            </View>
                        </TouchableOpacity>
                    ) : (
                        <Button
                            title="Link Partner to Send 🔗"
                            onPress={onLinkPartner}
                            variant="primary"
                            size="xl"
                            fullWidth
                        />
                    )}
                </View>

                {/* Widget Tutorial Modal */}
                <Modal
                    visible={showWidgetTutorial}
                    transparent
                    animationType="none"
                    onRequestClose={() => setShowWidgetTutorial(false)}
                >
                    <View style={styles.modalOverlay}>
                        <Animated.View
                            style={[
                                styles.modalContainer,
                                {
                                    opacity: modalOpacity,
                                    transform: [{ scale: modalScale }],
                                    maxHeight: '90%', // Ensure it doesn't overflow
                                },
                            ]}
                        >
                            {/* Header */}
                            <View style={styles.timelineHeader}>
                                <TouchableOpacity
                                    style={styles.timelineCloseX}
                                    onPress={() => setShowWidgetTutorial(false)}
                                >
                                    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                                        <Path
                                            d="M18 6L6 18M6 6l12 12"
                                            stroke={colors.text}
                                            strokeWidth={2}
                                            strokeLinecap="round"
                                        />
                                    </Svg>
                                </TouchableOpacity>
                                <Text style={styles.timelineHeaderText}>Widget Setup</Text>
                                <View style={{ width: 40 }} />
                            </View>

                            <ScrollView
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={styles.timelineContent}
                            >
                                {/* Intro */}
                                <View style={styles.timelineIntro}>
                                    <Text style={styles.timelineIntroTitle}>Add to Home Screen</Text>
                                    <Text style={styles.timelineIntroSubtitle}>
                                        Follow these simple steps to keep your stats visible at a glance on your iPhone.
                                    </Text>
                                </View>

                                {/* Steps Container */}
                                <View style={styles.stepsTimelineContainer}>
                                    {/* Vertical Line */}
                                    <View style={styles.timelineVerticalLine} />

                                    {/* Step 1 */}
                                    <View style={styles.timelineStepRow}>
                                        <View style={styles.timelineStepNumberContainer}>
                                            <View style={styles.timelineStepBadgeActive}>
                                                <Text style={styles.timelineStepBadgeTextActive}>1</Text>
                                            </View>
                                        </View>
                                        <View style={styles.timelineStepContent}>
                                            <Text style={styles.timelineStepTitle}>Long Press</Text>
                                            <Text style={styles.timelineStepDesc}>
                                                Go to your <Text style={{ fontWeight: 'bold', color: colors.text }}>home screen</Text> and long press on a <Text style={{ fontWeight: 'bold', color: colors.text }}>blank area</Text> of your wallpaper until the apps start to <Text style={{ fontWeight: 'bold', color: colors.text }}>jiggle</Text>.
                                            </Text>
                                            {/* Illustration 1 */}
                                            <View style={styles.mockupContainer1}>
                                                <View style={[styles.mockupPhoneScreen, { justifyContent: 'flex-start' }]}>
                                                    <View style={styles.mockupAppGrid}>
                                                        {[...Array(6)].map((_, i) => (
                                                            <View key={i} style={styles.mockupAppIconGray} />
                                                        ))}
                                                    </View>
                                                    {/* Finger indicator on blank wallpaper area - below app icons */}
                                                    <View style={styles.fingerPressContainer}>
                                                        {/* Pulsing rings to indicate long press */}
                                                        <View style={[styles.fingerPressRing, styles.fingerPressRingOuter]} />
                                                        <View style={[styles.fingerPressRing, styles.fingerPressRingMiddle]} />
                                                        <View style={[styles.fingerPressRing, styles.fingerPressRingInner]} />
                                                        {/* Pointing finger icon */}
                                                        <View style={styles.fingerIcon}>
                                                            <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                                                                <Path d="M12 2C12 2 12 8 12 10M12 10C10.5 10 9.5 10.5 9 12C8.5 13.5 9 15 10 16L11 17C12 18 13 18.5 15 18.5H16C18 18.5 19 17 19 15V12C19 10.5 18 9.5 16.5 9.5C15 9.5 14 10.5 14 12M12 10C13 10 14 9 14 7.5C14 6 13 5 12 5C11 5 10 6 10 7.5C10 9 11 10 12 10Z" stroke="#3b82f6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                                                            </Svg>
                                                        </View>
                                                    </View>
                                                </View>
                                            </View>
                                        </View>
                                    </View>

                                    {/* Step 2 */}
                                    <View style={styles.timelineStepRow}>
                                        <View style={styles.timelineStepNumberContainer}>
                                            <View style={styles.timelineStepBadge}>
                                                <Text style={styles.timelineStepBadgeText}>2</Text>
                                            </View>
                                        </View>
                                        <View style={styles.timelineStepContent}>
                                            <Text style={styles.timelineStepTitle}>
                                                {Platform.OS === 'ios' ? 'Tap "Edit"' : 'Tap "Widgets"'}
                                            </Text>
                                            <Text style={styles.timelineStepDesc}>
                                                {Platform.OS === 'ios'
                                                    ? <>Look for the <Text style={{ fontWeight: 'bold', color: colors.text }}>Edit</Text> or <Text style={{ fontWeight: 'bold', color: colors.text }}>plus button</Text> that appears at the top of your screen.</>
                                                    : <>A menu will appear. Tap on <Text style={{ fontWeight: 'bold', color: colors.text }}>Widgets</Text> to open the widget gallery.</>
                                                }
                                            </Text>
                                            {/* Illustration 2 */}
                                            <View style={styles.mockupContainer1}>
                                                <View style={styles.mockupPhoneScreen}>
                                                    {Platform.OS === 'ios' ? (
                                                        <>
                                                            <View style={styles.mockupStatusBar}>
                                                                <Text style={{ fontSize: 6, fontWeight: 'bold' }}>9:41</Text>
                                                            </View>
                                                            <View style={[styles.mockupPlusIndicator, { left: 8 }]}>
                                                                <View style={[styles.mockupPlusButton, { width: 36, height: 18, borderRadius: 9, backgroundColor: '#3b82f6' }]}>
                                                                    <Text style={{ color: '#fff', fontSize: 7, fontWeight: 'bold' }}>Edit</Text>
                                                                </View>
                                                                <View style={styles.mockupPlusRing} />
                                                            </View>
                                                            <View style={[styles.mockupAppGrid, { opacity: 0.1 }]}>
                                                                {[...Array(4)].map((_, i) => (
                                                                    <View key={i} style={styles.mockupAppIconGray} />
                                                                ))}
                                                            </View>
                                                        </>
                                                    ) : (
                                                        <>
                                                            {/* Android popup menu */}
                                                            <View style={[styles.mockupAppGrid, { opacity: 0.15 }]}>
                                                                {[...Array(4)].map((_, i) => (
                                                                    <View key={i} style={styles.mockupAppIconGray} />
                                                                ))}
                                                            </View>
                                                            <View style={styles.androidPopupMenu}>
                                                                <View style={styles.androidMenuItem}>
                                                                    <View style={styles.androidMenuIcon} />
                                                                    <Text style={styles.androidMenuText}>Wallpaper</Text>
                                                                </View>
                                                                <View style={[styles.androidMenuItem, styles.androidMenuItemHighlight]}>
                                                                    <View style={[styles.androidMenuIcon, { backgroundColor: '#3b82f6' }]} />
                                                                    <Text style={[styles.androidMenuText, { color: '#3b82f6', fontWeight: 'bold' }]}>Widgets</Text>
                                                                </View>
                                                                <View style={styles.androidMenuItem}>
                                                                    <View style={styles.androidMenuIcon} />
                                                                    <Text style={styles.androidMenuText}>Settings</Text>
                                                                </View>
                                                            </View>
                                                        </>
                                                    )}
                                                </View>
                                            </View>
                                        </View>
                                    </View>

                                    {/* Step 3 */}
                                    <View style={styles.timelineStepRow}>
                                        <View style={styles.timelineStepNumberContainer}>
                                            <View style={styles.timelineStepBadge}>
                                                <Text style={styles.timelineStepBadgeText}>3</Text>
                                            </View>
                                        </View>
                                        <View style={styles.timelineStepContent}>
                                            <Text style={styles.timelineStepTitle}>
                                                {Platform.OS === 'ios' ? 'Search App' : 'Find Penguin'}
                                            </Text>
                                            <Text style={styles.timelineStepDesc}>
                                                {Platform.OS === 'ios'
                                                    ? 'Use the search bar in the widget gallery to find our app.'
                                                    : 'Scroll through the widget list or search to find the Penguin widget.'
                                                }
                                            </Text>
                                            {/* Illustration 3 */}
                                            <View style={styles.mockupContainer1}>
                                                <View style={styles.mockupPhoneScreen}>
                                                    {Platform.OS === 'ios' ? (
                                                        <>
                                                            <View style={styles.mockupSearchBar}>
                                                                <Svg width={10} height={10} viewBox="0 0 24 24" fill="none">
                                                                    <Path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke="#999" strokeWidth={2} />
                                                                </Svg>
                                                                <Text style={{ fontSize: 8, color: colors.text, marginLeft: 4 }}>Penguin</Text>
                                                                <View style={styles.mockupCursor} />
                                                            </View>
                                                            <View style={styles.mockupAppResult}>
                                                                <View style={[styles.mockupAppLogo, { backgroundColor: '#FFFFFF' }]}>
                                                                    <Image source={penguinLogo} style={{ width: 24, height: 24 }} resizeMode="contain" />
                                                                </View>
                                                                <View style={styles.mockupAppTexts}>
                                                                    <Text style={{ fontSize: 9, fontWeight: '800', color: colors.text }}>Penguin</Text>
                                                                    <Text style={{ fontSize: 7, color: colors.textSecondary }}>Scribble Widget</Text>
                                                                </View>
                                                            </View>
                                                        </>
                                                    ) : (
                                                        <>
                                                            {/* Android widget list */}
                                                            <Text style={{ fontSize: 8, fontWeight: 'bold', color: colors.textSecondary, marginBottom: 8 }}>Widgets</Text>
                                                            <View style={styles.androidWidgetList}>
                                                                <View style={styles.androidWidgetItem}>
                                                                    <View style={[styles.androidWidgetIcon, { backgroundColor: '#ddd' }]} />
                                                                    <Text style={styles.androidWidgetName}>Other App</Text>
                                                                </View>
                                                                <View style={[styles.androidWidgetItem, styles.androidWidgetItemHighlight]}>
                                                                    <View style={[styles.androidWidgetIcon, { backgroundColor: '#FFFFFF' }]}>
                                                                        <Image source={penguinLogo} style={{ width: 20, height: 20 }} resizeMode="contain" />
                                                                    </View>
                                                                    <Text style={[styles.androidWidgetName, { color: '#3b82f6', fontWeight: 'bold' }]}>Penguin</Text>
                                                                </View>
                                                                <View style={styles.androidWidgetItem}>
                                                                    <View style={[styles.androidWidgetIcon, { backgroundColor: '#ddd' }]} />
                                                                    <Text style={styles.androidWidgetName}>Another App</Text>
                                                                </View>
                                                            </View>
                                                        </>
                                                    )}
                                                </View>
                                            </View>
                                        </View>
                                    </View>

                                    {/* Step 4 */}
                                    <View style={styles.timelineStepRow}>
                                        <View style={styles.timelineStepNumberContainer}>
                                            <View style={styles.timelineStepBadge}>
                                                <Text style={styles.timelineStepBadgeText}>4</Text>
                                            </View>
                                        </View>
                                        <View style={styles.timelineStepContent}>
                                            <Text style={styles.timelineStepTitle}>
                                                {Platform.OS === 'ios' ? 'Pick your Scribble' : 'Add Widget'}
                                            </Text>
                                            <Text style={styles.timelineStepDesc}>
                                                {Platform.OS === 'ios'
                                                    ? <>Swipe to pick your preferred size, then tap <Text style={{ fontWeight: 'bold', color: colors.text }}>"Add Widget"</Text> at the bottom.</>
                                                    : <>Tap the Penguin widget, then press <Text style={{ fontWeight: 'bold', color: colors.text }}>"Add"</Text> to place it on your home screen.</>
                                                }
                                            </Text>
                                            {/* Illustration 4 */}
                                            <View style={styles.mockupContainer1}>
                                                <View style={[styles.mockupPhoneScreen, { alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 }]}>
                                                    {Platform.OS === 'ios' ? (
                                                        <>
                                                            <View style={styles.mockupWidgetPreview}>
                                                                <Text style={{ fontSize: 6, fontWeight: 'bold', color: '#666', marginBottom: 4 }}>Scribble</Text>
                                                                <View style={styles.mockupWidgetContent} />
                                                            </View>
                                                            <View style={styles.mockupDotsIndicator}>
                                                                <View style={styles.mockupDot} />
                                                                <View style={[styles.mockupDot, { backgroundColor: '#3b82f6' }]} />
                                                                <View style={styles.mockupDot} />
                                                            </View>
                                                            <View style={styles.mockupAddWidgetBtn}>
                                                                <Text style={styles.mockupAddWidgetBtnText}>Add Widget</Text>
                                                            </View>
                                                        </>
                                                    ) : (
                                                        <>
                                                            {/* Android widget preview with Add button */}
                                                            <View style={styles.mockupWidgetPreview}>
                                                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                                                                    <Image source={penguinLogo} style={{ width: 16, height: 16, marginRight: 4 }} resizeMode="contain" />
                                                                    <Text style={{ fontSize: 6, fontWeight: 'bold', color: '#666' }}>Penguin</Text>
                                                                </View>
                                                                <View style={styles.mockupWidgetContent} />
                                                            </View>
                                                            <View style={styles.mockupAddWidgetBtn}>
                                                                <Text style={styles.mockupAddWidgetBtnText}>Add</Text>
                                                            </View>
                                                        </>
                                                    )}
                                                </View>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            </ScrollView>

                            {/* Sticky Footer */}
                            <View style={styles.timelineFooter}>
                                <TouchableOpacity
                                    style={styles.timelineReadyBtn}
                                    onPress={() => setShowWidgetTutorial(false)}
                                    activeOpacity={0.9}
                                >
                                    <Text style={styles.timelineReadyBtnText}>I'm Ready</Text>
                                </TouchableOpacity>
                            </View>
                        </Animated.View>
                    </View>
                </Modal>
            </View>
        </LinearGradient>
    );

};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 20,
    },
    header: {
        marginTop: 8,
        marginBottom: 10,
    },
    headerTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    backButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#FAE8FF',
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        elevation: 3,
    },
    backIcon: {
        fontSize: 22,
        color: colors.text,
    },
    headerContent: {
        flex: 1,
        marginLeft: 0,
        minWidth: 0,
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
        color: colors.text,
        // letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        fontWeight: '500',
        marginTop: 2,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flexShrink: 0,
    },
    headerAction: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(255,255,255,0.86)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F7DDEA',
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 3,
    },
    actionIcon: {
        fontSize: 18,
    },
    liveFullscreen: {
        flex: 1,
        backgroundColor: '#61B8EE',
    },
    liveStarsLayer: {
        ...StyleSheet.absoluteFillObject,
    },
    liveDismissLayer: {
        ...StyleSheet.absoluteFillObject,
    },
    liveBackButton: {
        position: 'absolute',
        left: 16,
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(7,17,68,0.28)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.22)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 4,
    },
    liveLockHeader: {
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    liveLockDate: {
        color: '#FFFFFF',
        fontSize: 28,
        lineHeight: 34,
        fontWeight: '800',
    },
    liveLockTime: {
        color: '#FFFFFF',
        fontSize: 122,
        lineHeight: 132,
        fontWeight: '800',
    },
    liveNamesBadge: {
        maxWidth: '86%',
        minHeight: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(255,255,255,0.18)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.28)',
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: -6,
    },
    liveNamesText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
    },
    livePaperStage: {
        flex: 1,
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: 32,
        paddingBottom: 94,
    },
    livePaperFrame: {
        borderRadius: 24,
        backgroundColor: 'transparent',
        shadowColor: '#02235F',
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0,
        shadowRadius: 0,
        elevation: 0,
    },
    livePaperClip: {
        flex: 1,
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 0,
        borderColor: 'transparent',
        backgroundColor: 'transparent',
    },
    liveTransparentCanvas: {
        backgroundColor: 'transparent',
    },
    liveFloatingToolbar: {
        position: 'absolute',
        left: 20,
        right: 20,
        minHeight: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(7,17,68,0.42)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.22)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.18,
        shadowRadius: 22,
        elevation: 8,
    },
    liveToolButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.16)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.22)',
    },
    liveSelectedColorButton: {
        width: 68,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.16)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.22)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    liveSelectedColorButtonActive: {
        borderColor: '#FFFFFF',
        backgroundColor: 'rgba(255,255,255,0.24)',
    },
    liveSelectedColorDot: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    liveSelectedBrushDot: {
        backgroundColor: 'rgba(255,255,255,0.82)',
    },
    liveBrushButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.16)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.22)',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    liveBrushButtonActive: {
        borderColor: '#FFFFFF',
        backgroundColor: 'rgba(255,255,255,0.24)',
    },
    liveBrushButtonDot: {
        position: 'absolute',
        right: 8,
        bottom: 8,
        borderWidth: 1,
        borderColor: '#FFFFFF',
    },
    liveBrushPanel: {
        position: 'absolute',
        left: 28,
        right: 28,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.34)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.38)',
        paddingHorizontal: 14,
        paddingTop: 12,
        paddingBottom: 10,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        elevation: 10,
    },
    liveGradientButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.16)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.22)',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    liveGradientButtonActive: {
        borderColor: '#FFFFFF',
        backgroundColor: 'rgba(255,255,255,0.24)',
    },
    liveGradientButtonPreview: {
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.72)',
    },
    liveGradientPanel: {
        position: 'absolute',
        left: 28,
        right: 28,
        minHeight: 66,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.34)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.38)',
        paddingHorizontal: 12,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        elevation: 10,
    },
    liveGradientOption: {
        width: 48,
        height: 42,
        borderRadius: 16,
        padding: 3,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    liveGradientOptionActive: {
        borderColor: '#FFFFFF',
        backgroundColor: 'rgba(255,255,255,0.22)',
    },
    liveGradientSwatch: {
        flex: 1,
        borderRadius: 13,
        overflow: 'hidden',
    },
    livePickerPanel: {
        position: 'absolute',
        left: 16,
        right: 16,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.34)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.38)',
        paddingHorizontal: 12,
        paddingTop: 10,
        paddingBottom: 6,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        elevation: 10,
    },
    livePickerSection: {
        marginBottom: 4,
    },
    canvasActions: {
        flexDirection: 'row',
        alignSelf: 'center',
        alignItems: 'center',
        gap: 10,
        marginTop: -10,
        marginBottom: spacing.sm,
    },
    canvasActionButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(255,255,255,0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F7DDEA',
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.08,
        shadowRadius: 9,
        elevation: 3,
    },
    canvasShadowContainer: {
        width: CANVAS_SIZE + 3,
        height: CANVAS_SIZE + 3,
        borderRadius: 24,
        backgroundColor: '#FFFFFF',
        alignSelf: 'center',
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
        elevation: 8,
        marginBottom: spacing.md,
    },
    liveCanvasShadowContainer: {
        borderRadius: 26,
        backgroundColor: '#27194F',
        shadowColor: '#EC7AB7',
        shadowOpacity: 0.24,
        shadowRadius: 26,
        marginBottom: spacing.sm,
    },
    canvasClippedContainer: {
        flex: 1,
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: '#F7DDEA',
    },
    liveCanvasClippedContainer: {
        borderRadius: 26,
        borderColor: 'rgba(255,255,255,0.28)',
    },
    canvasGradient: {
        flex: 1,
    },
    canvas: {
        backgroundColor: 'transparent',
        overflow: 'hidden',
        position: 'relative',
    },
    liveCanvas: {
        backgroundColor: '#1B1237',
    },
    paperTexture: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        pointerEvents: 'none',
    },
    emptyState: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        pointerEvents: 'none',
    },

    emptyEmoji: {
        fontSize: 56,
        marginBottom: spacing.md,
        opacity: 0.4,
    },
    emptyText: {
        fontSize: 16,
        color: colors.textMuted,
        fontWeight: '600',
    },
    emptyHint: {
        fontSize: 13,
        color: colors.textMuted,
        marginTop: spacing.xs,
        opacity: 0.7,
    },
    liveEmptyText: {
        color: '#FFFFFF',
        opacity: 0.92,
    },
    liveEmptyHint: {
        color: 'rgba(255,255,255,0.76)',
        opacity: 1,
    },
    toolSection: {
        marginBottom: spacing.md,
    },
    toolLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#000000',
        marginBottom: 4,
        marginLeft: spacing.xs,
    },
    spectrumContainer: {
        gap: 8,
    },
    spectrumMainRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    spectrumPreviewDot: {
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 2.5,
        borderColor: '#FFFFFF',
    },
    spectrumFilterBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F7DDEA',
    },
    spectrumFilterBtnActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    spectrumShadeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    spectrumShadeLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#FFFFFF',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        width: 36,
    },
    spectrumBarOuter: {
        flex: 1,
        height: 32,
        justifyContent: 'center',
        position: 'relative',
    },
    spectrumBar: {
        height: 14,
        borderRadius: 7,
    },
    spectrumThumb: {
        position: 'absolute',
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        borderWidth: 2.5,
        borderColor: '#FFFFFF',
        marginLeft: -12,
        top: 4,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    spectrumThumbDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    sliderWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 48,
        width: '100%',
    },
    sliderValueText: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.text,
        width: 42,
    },
    sliderTrackContainer: {
        flex: 1,
        height: 24,
        justifyContent: 'center',
        position: 'relative',
        marginHorizontal: 12,
    },
    sliderTrackBg: {
        height: 6,
        borderRadius: 3,
        backgroundColor: '#EAEAEA',
        width: '100%',
        overflow: 'hidden',
    },
    sliderTrackActive: {
        height: '100%',
        borderRadius: 3,
    },
    sliderThumb: {
        position: 'absolute',
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        marginLeft: -12,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
        elevation: 3,
    },
    sliderThumbInner: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    sliderPreviewContainer: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#FAE8FF',
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 1,
    },
    sliderPreviewDot: {
        maxHeight: 28,
        maxWidth: 28,
    },
    sendContainer: {
        marginTop: '0',
        paddingBottom: spacing['2xl'],
    },
    scribbleSendButton: {
        width: '100%',
        minHeight: 58,
        borderRadius: 20,
        backgroundColor: colors.primary,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.88)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.16,
        shadowRadius: 18,
        elevation: 5,
    },
    scribbleSendButtonDisabled: {
        backgroundColor: '#F1DDE8',
        shadowOpacity: 0.08,
        elevation: 2,
    },
    scribbleSendButtonIdle: {
        backgroundColor: '#EEF0F3',
        borderColor: '#D9DEE7',
        shadowColor: '#94A3B8',
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 2,
    },
    scribbleSendButtonPending: {
        backgroundColor: colors.primary,
        borderColor: '#FFFFFF',
        shadowColor: '#EC4899',
        shadowOpacity: 0.38,
        shadowRadius: 24,
        elevation: 10,
        transform: [{ translateY: -1 }],
    },
    scribbleSendContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingHorizontal: spacing.lg,
    },
    scribbleSendText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '800',
        textAlign: 'center',
    },
    scribbleSendTextIdle: {
        color: colors.textSecondary,
    },
    connectionErrorText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#EF4444',
        textAlign: 'center',
        marginBottom: 8,
    },
    liveStatusBox: {
        width: '100%',
        minHeight: 52,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderWidth: 1,
        borderColor: '#F7DDEA',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
    },
    liveStatusText: {
        fontSize: 15,
        fontWeight: '800',
        color: colors.text,
        textAlign: 'center',
    },
    // Sent state - displays inside the canvas
    sentState: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 24,
    },
    sentSuccessBadge: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#22C55E',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
        shadowColor: '#22C55E',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    sentTitle: {
        fontSize: 20,
        color: colors.text,
        fontWeight: '700',
        marginBottom: spacing.lg,
    },
    sentPreviewInCanvas: {
        width: 140,
        height: 140,
        backgroundColor: '#FFFFFF',
        borderRadius: borderRadius.xl,
        overflow: 'hidden',
        marginBottom: spacing.lg,
        borderWidth: 1.5,
        borderColor: '#FAE8FF',
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 4,
    },
    sentHint: {
        fontSize: 14,
        color: colors.textSecondary,
        fontWeight: '500',
    },
    addHomeButton: {
        minHeight: 32,
        maxWidth: 118,
        borderRadius: 16,
        paddingHorizontal: 8,
        backgroundColor: colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderWidth: 1,
        borderColor: colors.primary,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.16,
        shadowRadius: 12,
        elevation: 4,
    },
    addHomeButtonText: {
        flexShrink: 1,
        color: '#FFFFFF',
        fontSize: 11,
        lineHeight: 13,
        fontWeight: '800',
        textAlign: 'center',
    },
    liveToggleButton: {
        minHeight: 32,
        minWidth: 68,
        borderRadius: 16,
        paddingHorizontal: 8,
        backgroundColor: 'rgba(255,255,255,0.86)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#F7DDEA',
    },
    liveToggleButtonActive: {
        backgroundColor: '#22C55E',
        borderColor: '#22C55E',
    },
    liveToggleText: {
        color: colors.textSecondary,
        fontSize: 11,
        lineHeight: 13,
        fontWeight: '800',
        textAlign: 'center',
    },
    liveToggleTextActive: {
        color: '#FFFFFF',
    },
    headerSecondaryActions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 6,
        flexShrink: 0,
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
    },
    modalContainer: {
        width: '98%',
        maxWidth: 500,
        backgroundColor: '#FFFFFF',
        borderRadius: borderRadius['2xl'],
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: '#FAE8FF',
        ...shadows.xl,
    },
    modalHeader: {
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    modalIconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    platformBadge: {
        position: 'absolute',
        top: spacing.sm,
        right: spacing.sm,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xs,
        borderRadius: borderRadius.full,
    },
    platformBadgeText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '600',
    },
    modalContent: {
        paddingVertical: spacing.xl,
        paddingHorizontal: spacing.md,
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.text,
        marginBottom: spacing.xs,
        textAlign: 'center',
    },
    modalSubtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.lg,
        lineHeight: 20,
    },
    instructionsContainer: {
        width: '100%',
        marginBottom: spacing.lg,
    },
    instructionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    instructionStep: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.primarySoft,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.sm,
    },
    instructionStepNumber: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.primary,
    },
    instructionContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    instructionIcon: {
        fontSize: 18,
        marginRight: spacing.sm,
    },
    instructionText: {
        fontSize: 14,
        color: colors.text,
        flex: 1,
        lineHeight: 20,
    },
    widgetPreviewContainer: {
        marginBottom: spacing.lg,
        alignItems: 'center',
    },
    phoneFrame: {
        width: 100,
        height: 80,
        backgroundColor: colors.backgroundAlt,
        borderRadius: borderRadius.lg,
        padding: spacing.sm,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: colors.border,
    },
    widgetPreview: {
        width: 70,
        height: 50,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#EC4899',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    widgetPreviewLabel: {
        fontSize: 8,
        fontWeight: '600',
        color: colors.textSecondary,
        marginTop: 2,
    },
    modalCloseButton: {
        overflow: 'hidden',
        borderRadius: borderRadius.xl,
        width: '100%',
    },
    modalCloseButtonGradient: {
        paddingVertical: spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalCloseButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    // Timeline Tutorial Styles
    timelineHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: '#FAE8FF',
        backgroundColor: '#FFFFFF',
    },
    timelineCloseX: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    timelineHeaderText: {
        flex: 1,
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '700',
        color: colors.text,
    },
    timelineContent: {
        paddingTop: spacing.xl,
        paddingBottom: spacing['3xl'] * 2, // Space for sticky footer
    },
    timelineIntro: {
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
        marginBottom: spacing['2xl'],
    },
    timelineIntroTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: colors.text,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    timelineIntroSubtitle: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
    },
    stepsTimelineContainer: {
        paddingHorizontal: spacing.md,
        position: 'relative',
    },
    timelineVerticalLine: {
        position: 'absolute',
        left: spacing.md + 14,
        top: 14,
        bottom: 100,
        width: 2,
        backgroundColor: colors.borderLight,
        zIndex: 0,
    },
    timelineStepRow: {
        flexDirection: 'row',
        marginBottom: spacing['3xl'],
        zIndex: 1,
    },
    timelineStepNumberContainer: {
        width: 28,
        marginRight: spacing.md,
        alignItems: 'center',
    },
    timelineStepBadgeActive: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.text,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        borderWidth: 3,
        borderColor: colors.surface,
    },
    timelineStepBadgeTextActive: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '700',
    },
    timelineStepBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.surface,
        borderWidth: 2,
        borderColor: colors.text,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    timelineStepBadgeText: {
        color: colors.text,
        fontSize: 13,
        fontWeight: '700',
    },
    timelineStepContent: {
        flex: 1,
        paddingTop: 4,
    },
    timelineStepTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.text,
        marginBottom: spacing.xs,
    },
    timelineStepDesc: {
        fontSize: 14,
        color: colors.textSecondary,
        lineHeight: 20,
        marginBottom: spacing.md,
    },
    mockupContainer1: {
        width: '100%',
        aspectRatio: 4 / 3,
        backgroundColor: '#FFF5F7',
        borderRadius: borderRadius['2xl'],
        borderWidth: 1.5,
        borderColor: '#FAE8FF',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.md,
    },
    mockupPhoneScreen: {
        width: '80%',
        height: '80%',
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        borderWidth: 1,
        borderColor: colors.borderLight,
        padding: 12,
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        overflow: 'hidden',
    },
    mockupAppGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'center',
    },
    mockupAppIconGray: {
        width: 24,
        height: 24,
        backgroundColor: colors.backgroundAlt,
        borderRadius: 6,
    },
    mockupFingerIndicator: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        marginTop: -10,
        marginLeft: -10,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(236, 72, 153, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    fingerPressContainer: {
        marginTop: spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
        width: 80,
        height: 80,
        alignSelf: 'center',
    },
    fingerPressRing: {
        position: 'absolute',
        borderRadius: 100,
        borderWidth: 2,
        borderColor: 'rgba(236, 72, 153, 0.3)',
    },
    fingerPressRingOuter: {
        width: 70,
        height: 70,
        borderColor: 'rgba(236, 72, 153, 0.15)',
    },
    fingerPressRingMiddle: {
        width: 50,
        height: 50,
        borderColor: 'rgba(236, 72, 153, 0.25)',
    },
    fingerPressRingInner: {
        width: 30,
        height: 30,
        borderColor: 'rgba(236, 72, 153, 0.4)',
    },
    fingerIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(236, 72, 153, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    mockupStatusBar: {
        width: '100%',
        height: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        marginBottom: 8,
    },
    mockupPlusIndicator: {
        position: 'absolute',
        top: 8,
        left: 8,
    },
    mockupPlusButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.backgroundAlt,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mockupPlusRing: {
        position: 'absolute',
        top: -4,
        left: -4,
        right: -4,
        bottom: -4,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: colors.primary,
        opacity: 0.5,
    },
    mockupSearchBar: {
        height: 32,
        backgroundColor: colors.backgroundAlt,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        marginBottom: 12,
    },
    mockupSearchPlaceholder: {
        width: 50,
        height: 6,
        backgroundColor: colors.borderLight,
        borderRadius: 3,
        marginLeft: 6,
    },
    mockupCursor: {
        width: 1.5,
        height: 14,
        backgroundColor: colors.primary,
        marginLeft: 2,
    },
    mockupAppResult: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        backgroundColor: '#FFF5F7',
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: '#FAE8FF',
    },
    mockupAppLogo: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: colors.text,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mockupAppTexts: {
        marginLeft: spacing.sm,
        gap: 6,
    },
    mockupAppLabelTitle: {
        width: 60,
        height: 8,
        backgroundColor: colors.text,
        borderRadius: 4,
    },
    mockupAppLabelSub: {
        width: 40,
        height: 5,
        backgroundColor: colors.textSecondary,
        borderRadius: 3,
    },
    mockupWidgetPreview: {
        width: 100,
        height: 60,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#FAE8FF',
        padding: 8,
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    mockupWidgetTitle: {
        width: 30,
        height: 6,
        backgroundColor: '#cbd5e1',
        borderRadius: 3,
        marginBottom: 6,
    },
    mockupWidgetContent: {
        flex: 1,
        backgroundColor: 'rgba(236, 72, 153, 0.1)',
        borderRadius: 6,
    },
    mockupDotsIndicator: {
        flexDirection: 'row',
        gap: 4,
    },
    mockupDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: colors.borderLight,
    },
    mockupAddWidgetBtn: {
        width: '100%',
        height: 28,
        backgroundColor: colors.primary,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mockupAddWidgetBtnText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    timelineFooter: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: spacing.xl,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderTopWidth: 1.5,
        borderTopColor: '#FAE8FF',
    },
    timelineReadyBtn: {
        width: '100%',
        height: 56,
        backgroundColor: colors.primary,
        borderRadius: borderRadius.xl,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 6,
    },
    timelineReadyBtnText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '800',
    },
    // Android-specific styles
    androidPopupMenu: {
        position: 'absolute',
        top: '30%',
        left: '20%',
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 8,
        borderWidth: 1,
        borderColor: colors.borderLight,
    },
    androidMenuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderRadius: 6,
    },
    androidMenuItemHighlight: {
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
    },
    androidMenuIcon: {
        width: 16,
        height: 16,
        borderRadius: 4,
        backgroundColor: colors.borderLight,
        marginRight: 8,
    },
    androidMenuText: {
        fontSize: 8,
        color: colors.text,
    },
    androidWidgetList: {
        width: '100%',
        gap: 6,
    },
    androidWidgetItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        backgroundColor: colors.backgroundAlt,
        borderRadius: 8,
    },
    androidWidgetItemHighlight: {
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.3)',
    },
    androidWidgetIcon: {
        width: 24,
        height: 24,
        borderRadius: 6,
        justifyContent: 'center',
        alignItems: 'center',
    },
    androidWidgetName: {
        fontSize: 8,
        color: colors.text,
        marginLeft: 8,
    },
    androidDragContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
    },
    androidDragWidget: {
        alignItems: 'center',
        padding: 8,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#3b82f6',
        borderStyle: 'dashed',
    },
    androidDragArrow: {
        marginVertical: 4,
    },
    androidHomePreview: {
        width: '100%',
        backgroundColor: colors.backgroundAlt,
        borderRadius: 8,
        padding: 8,
        alignItems: 'center',
    },
    androidDropZone: {
        marginTop: 8,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderWidth: 2,
        borderColor: '#3b82f6',
        borderStyle: 'dashed',
        borderRadius: 8,
        backgroundColor: 'rgba(59, 130, 246, 0.05)',
    },
});

export default ScribbleScreen;
