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

const { width } = Dimensions.get('window');
const CANVAS_SIZE = width - 40;

const brushColors = [
    { color: '#FF3B6F', name: 'Pink', glow: 'rgba(255, 59, 111, 0.4)' },
    { color: '#8B5CF6', name: 'Purple', glow: 'rgba(139, 92, 246, 0.4)' },
    { color: '#EF4444', name: 'Red', glow: 'rgba(239, 68, 68, 0.4)' },
    { color: '#F97316', name: 'Orange', glow: 'rgba(249, 115, 22, 0.4)' },
    { color: '#FACC15', name: 'Yellow', glow: 'rgba(250, 204, 21, 0.4)' },
    { color: '#22C55E', name: 'Green', glow: 'rgba(34, 197, 94, 0.4)' },
    { color: '#06B6D4', name: 'Cyan', glow: 'rgba(6, 182, 212, 0.4)' },
    { color: '#3B82F6', name: 'Blue', glow: 'rgba(59, 130, 246, 0.4)' },
    { color: '#1F2937', name: 'Dark', glow: 'rgba(31, 41, 55, 0.4)' },
];

const brushSizes = [
    { size: 4, name: 'S' },
    { size: 8, name: 'M' },
    { size: 14, name: 'L' },
    { size: 22, name: 'XL' },
];

// Animated Color Bubble Component
const ColorBubble = ({ item, isSelected, onSelect, index }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const floatAnim = useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        const float = Animated.loop(
            Animated.sequence([
                Animated.timing(floatAnim, {
                    toValue: 1,
                    duration: 2000 + index * 300,
                    useNativeDriver: true,
                }),
                Animated.timing(floatAnim, {
                    toValue: 0,
                    duration: 2000 + index * 300,
                    useNativeDriver: true,
                }),
            ])
        );
        float.start();
        return () => float.stop();
    }, [floatAnim, index]);

    const handlePress = () => {
        Animated.sequence([
            Animated.timing(scaleAnim, {
                toValue: 0.8,
                duration: 100,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: isSelected ? 1.2 : 1,
                ...timing.springBouncy,
                useNativeDriver: true,
            }),
        ]).start();
        onSelect(item.color);
    };

    const translateY = floatAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -6],
    });

    return (
        <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
            <Animated.View
                style={[
                    styles.colorWrapper,
                    {
                        transform: [{ scale: scaleAnim }, { translateY }],
                    },
                ]}
            >
                {/* Selection glow */}
                {isSelected && (
                    <View style={[styles.colorGlow, { backgroundColor: item.glow }]} />
                )}
                <View
                    style={[
                        styles.colorOption,
                        { backgroundColor: item.color },
                        isSelected && styles.colorSelected,
                        isSelected && {
                            shadowColor: item.color,
                            shadowOffset: { width: 0, height: 0 },
                            shadowOpacity: 0.8,
                            shadowRadius: 12,
                        },
                    ]}
                />
            </Animated.View>
        </TouchableOpacity>
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
}) => {
    const [paths, setPaths] = useState([]);
    const [currentPath, setCurrentPath] = useState('');
    const [selectedColor, setSelectedColor] = useState(colors.primary);
    const [selectedSize, setSelectedSize] = useState(8);
    const [inkSplash, setInkSplash] = useState(null);
    const [sentScribble, setSentScribble] = useState(null); // Store sent scribble for preview
    const [showWidgetTutorial, setShowWidgetTutorial] = useState(false);
    const [tutorialStep, setTutorialStep] = useState(0);
    const [connectionError, setConnectionError] = useState(false);
    const insets = useSafeAreaInsets();
    const { socket, isConnected } = useSocketContext();
    const canvasOpacity = useRef(new Animated.Value(0)).current;
    const modalOpacity = useRef(new Animated.Value(0)).current;
    const modalScale = useRef(new Animated.Value(0.85)).current;

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
    const selectedColorRef = useRef(selectedColor);
    const selectedSizeRef = useRef(selectedSize);
    const pathIdCounter = useRef(0);

    // Keep refs in sync with state
    React.useEffect(() => {
        selectedColorRef.current = selectedColor;
    }, [selectedColor]);

    React.useEffect(() => {
        selectedSizeRef.current = selectedSize;
    }, [selectedSize]);

    React.useEffect(() => {
        Animated.timing(canvasOpacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
        }).start();
    }, [canvasOpacity]);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (evt) => {
                const { locationX, locationY } = evt.nativeEvent;
                const newPath = `M${locationX.toFixed(1)},${locationY.toFixed(1)}`;
                currentPathRef.current = newPath;
                setCurrentPath(newPath);

                // Show ink splash effect
                setInkSplash({ x: locationX, y: locationY });
                setTimeout(() => setInkSplash(null), 300);
            },
            onPanResponderMove: (evt) => {
                const { locationX, locationY } = evt.nativeEvent;
                const updatedPath = `${currentPathRef.current} L${locationX.toFixed(1)},${locationY.toFixed(1)}`;
                currentPathRef.current = updatedPath;
                setCurrentPath(updatedPath);
            },
            onPanResponderRelease: () => {
                if (currentPathRef.current) {
                    const newPath = {
                        id: pathIdCounter.current++,
                        d: currentPathRef.current,
                        color: selectedColorRef.current,
                        strokeWidth: selectedSizeRef.current
                    };
                    setPaths(prev => [...prev, newPath]);
                    currentPathRef.current = '';
                    setCurrentPath('');
                }
            },
        })
    ).current;

    const handleClear = () => {
        setPaths([]);
        setCurrentPath('');
    };

    const handleUndo = () => {
        setPaths(prev => prev.slice(0, -1));
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

            // Save sent scribble for preview and clear canvas
            setSentScribble({
                paths: [...paths],
                sentAt: new Date(),
            });
            setPaths([]);
            setCurrentPath('');

            // Call parent's onSend if provided
            onSend(pathsToSend);
        } else {
            setConnectionError(true);
            setTimeout(() => setConnectionError(false), 3000);
        }
    };

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
                    <View style={styles.headerContent}>
                        <Text style={styles.title}>Canvas</Text>
                    </View>
                    <View style={styles.headerActions}>
                        <TouchableOpacity style={styles.headerAction} onPress={handleUndo}>
                            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                                <Path
                                    d="M3 10h10a5 5 0 015 5v2M3 10l5-5M3 10l5 5"
                                    stroke={colors.text}
                                    strokeWidth={2}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </Svg>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.headerAction} onPress={handleClear}>
                            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                                <Path
                                    d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"
                                    stroke={colors.text}
                                    strokeWidth={2}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </Svg>
                        </TouchableOpacity>
                        {/* Widget Button */}
                        <TouchableOpacity style={[styles.headerAction, styles.widgetButton]} onPress={() => setShowWidgetTutorial(true)}>
                            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                                <Path
                                    d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"
                                    stroke={colors.text}
                                    strokeWidth={2}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </Svg>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Canvas */}
                <Animated.View style={[styles.canvasShadowContainer, { opacity: canvasOpacity }]}>
                    <View style={styles.canvasClippedContainer}>
                        <LinearGradient
                            colors={['#FFFFFF', '#FFF9FB']}
                            style={styles.canvasGradient}
                        >
                        <View
                            style={[styles.canvas, { width: CANVAS_SIZE, height: CANVAS_SIZE }]}
                            {...panResponder.panHandlers}
                        >
                            <Svg width={CANVAS_SIZE} height={CANVAS_SIZE}>
                                {/* Draw completed paths */}
                                {paths.map((path) => (
                                    <Path
                                        key={path.id}
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
                                    <Text style={styles.emptyText}>Draw with your finger</Text>
                                    <Text style={styles.emptyHint}>Express your love through art</Text>
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
                                            {sentScribble.paths.map((path) => (
                                                <Path
                                                    key={path.id}
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

                {/* Color Picker */}
                <View style={styles.toolSection}>
                    <Text style={styles.toolLabel}>Color</Text>
                    <View style={styles.colorPicker}>
                        {brushColors.map((item, index) => (
                            <ColorBubble
                                key={item.name}
                                item={item}
                                index={index}
                                isSelected={selectedColor === item.color}
                                onSelect={setSelectedColor}
                            />
                        ))}
                    </View>
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

                {/* Send Button */}
                <View style={styles.sendContainer}>
                    {connectionError && (
                        <Text style={styles.connectionErrorText}>
                            Not connected to server. Please try again.
                        </Text>
                    )}
                    {hasPartner ? (
                        <Button
                            title="Send to Your Love"
                            onPress={handleSend}
                            variant="glow"
                            size="xl"
                            fullWidth
                            disabled={paths.length === 0}
                        />
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
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        marginBottom: 18,
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
    },
    title: {
        fontSize: 24,
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
        gap: 8,
    },
    headerAction: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: 'rgba(255,255,255,0.86)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F7DDEA',
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 18,
        elevation: 5,
    },
    actionIcon: {
        fontSize: 18,
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
        marginBottom: spacing.xl,
    },
    canvasClippedContainer: {
        flex: 1,
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: '#F7DDEA',
    },
    canvasGradient: {
        flex: 1,
    },
    canvas: {
        backgroundColor: 'transparent',
        overflow: 'hidden',
        position: 'relative',
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
    toolSection: {
        marginBottom: spacing.lg,
    },
    toolLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: spacing.md,
        marginLeft: spacing.xs,
    },
    colorPicker: {
        flexDirection: 'row',
        gap: spacing.sm,
        justifyContent: 'space-between',
    },
    colorWrapper: {
        padding: 2,
        position: 'relative',
    },
    colorGlow: {
        position: 'absolute',
        top: -3,
        left: -3,
        right: -3,
        bottom: -3,
        borderRadius: 20,
    },
    colorOption: {
        width: 30,
        height: 30,
        borderRadius: 15,
    },
    colorSelected: {
        transform: [{ scale: 1.2 }],
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
    connectionErrorText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#EF4444',
        textAlign: 'center',
        marginBottom: 8,
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
    // Widget button style
    widgetButton: {
        backgroundColor: 'rgba(255,255,255,0.86)',
        borderColor: '#F7DDEA',
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
