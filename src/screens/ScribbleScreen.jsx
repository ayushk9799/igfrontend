// Premium Scribble Screen - Drawing Canvas
// Enhanced with ink effects and dynamic brush visualization
import React, { useState, useRef } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TouchableOpacity,
    PanResponder,
    Dimensions,
    Animated,
    Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle as SvgCircle } from 'react-native-svg';
import LinearGradient from 'react-native-linear-gradient';
import GradientBackground from '../components/GradientBackground';
import Button from '../components/Button';
import { colors, spacing, borderRadius, shadows, timing } from '../theme';
import { useSocketContext } from '../context/SocketContext';

const { width } = Dimensions.get('window');
const CANVAS_SIZE = width - spacing.xl * 2;

const brushColors = [
    { color: colors.primary, name: 'Pink', glow: colors.primaryGlow },
    { color: colors.secondary, name: 'Purple', glow: colors.secondaryGlow },
    { color: colors.heart, name: 'Red', glow: colors.heartGlow },
    { color: colors.accent, name: 'Rose', glow: colors.primaryGlow },
    { color: colors.accentGold, name: 'Gold', glow: 'rgba(255, 184, 0, 0.4)' },
    { color: colors.success, name: 'Green', glow: colors.successGlow },
    { color: colors.auroraBlue, name: 'Cyan', glow: 'rgba(0, 194, 255, 0.4)' },
    { color: colors.text, name: 'White', glow: 'rgba(255, 255, 255, 0.4)' },
];

const brushSizes = [
    { size: 4, name: 'Fine' },
    { size: 8, name: 'Medium' },
    { size: 14, name: 'Bold' },
    { size: 22, name: 'Thick' },
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

export const ScribbleScreen = ({
    onSend = () => { },
    onBack = () => { },
}) => {
    const [paths, setPaths] = useState([]);
    const [currentPath, setCurrentPath] = useState('');
    const [selectedColor, setSelectedColor] = useState(colors.primary);
    const [selectedSize, setSelectedSize] = useState(8);
    const [inkSplash, setInkSplash] = useState(null);
    const insets = useSafeAreaInsets();
    const { socket, isConnected } = useSocketContext();
    const canvasOpacity = useRef(new Animated.Value(0)).current;

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
            socket.emit('scribble:send', {
                paths: paths.map(p => ({
                    d: p.d,
                    color: p.color,
                    strokeWidth: p.strokeWidth,
                })),
            });
            // Call parent's onSend if provided
            onSend(paths);
        } else {
            Alert.alert('Connection Error', 'Not connected to server. Please try again.');
        }
    };

    return (
        <GradientBackground variant="midnight" showOrbs={false}>
            <View style={[styles.container, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onBack} style={styles.backButton}>
                        <Text style={styles.backIcon}>←</Text>
                    </TouchableOpacity>
                    <View style={styles.headerContent}>
                        <Text style={styles.title}>✏️ Scribble</Text>
                        <Text style={styles.subtitle}>Draw something sweet</Text>
                    </View>
                    <View style={styles.headerActions}>
                        <TouchableOpacity style={styles.headerAction} onPress={handleUndo}>
                            <Text style={styles.actionIcon}>↩️</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.headerAction} onPress={handleClear}>
                            <Text style={styles.actionIcon}>🗑️</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Canvas */}
                <Animated.View style={[styles.canvasContainer, { opacity: canvasOpacity }]}>
                    <LinearGradient
                        colors={[colors.surfaceLight, colors.surface]}
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
                            {paths.length === 0 && !currentPath && (
                                <View style={styles.emptyState}>
                                    <Text style={styles.emptyEmoji}>💕</Text>
                                    <Text style={styles.emptyText}>Draw with your finger</Text>
                                    <Text style={styles.emptyHint}>Express your love through art</Text>
                                </View>
                            )}

                            {/* Paper texture overlay */}
                            <View style={styles.paperTexture} />
                        </View>
                    </LinearGradient>
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
                    <Text style={styles.toolLabel}>Brush</Text>
                    <View style={styles.sizePicker}>
                        {brushSizes.map((item) => (
                            <TouchableOpacity
                                key={item.size}
                                style={[
                                    styles.sizeOption,
                                    selectedSize === item.size && styles.sizeSelected,
                                ]}
                                onPress={() => setSelectedSize(item.size)}
                            >
                                <View
                                    style={[
                                        styles.sizeDot,
                                        {
                                            width: item.size + 4,
                                            height: item.size + 4,
                                            backgroundColor: selectedColor,
                                        }
                                    ]}
                                />
                                <Text style={[
                                    styles.sizeName,
                                    selectedSize === item.size && styles.sizeNameSelected
                                ]}>
                                    {item.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Send Button */}
                <View style={styles.sendContainer}>
                    <Button
                        title="Send to Your Love 💌"
                        onPress={handleSend}
                        variant="glow"
                        size="xl"
                        fullWidth
                        disabled={paths.length === 0}
                    />
                </View>
            </View>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: spacing.xl,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    backButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: colors.glass,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.glassBorder,
    },
    backIcon: {
        fontSize: 22,
        color: colors.text,
    },
    headerContent: {
        flex: 1,
        marginLeft: spacing.md,
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: colors.text,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 13,
        color: colors.textSecondary,
        marginTop: 2,
    },
    headerActions: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    headerAction: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.glass,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.glassBorder,
    },
    actionIcon: {
        fontSize: 18,
    },
    canvasContainer: {
        borderRadius: borderRadius['2xl'],
        overflow: 'hidden',
        marginBottom: spacing.xl,
        ...shadows.card,
    },
    canvasGradient: {
        borderRadius: borderRadius['2xl'],
        padding: 3,
    },
    canvas: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius['2xl'] - 3,
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
        fontSize: 12,
        fontWeight: '700',
        color: colors.textSecondary,
        marginBottom: spacing.sm,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
    },
    colorPicker: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    colorWrapper: {
        padding: 3,
        position: 'relative',
    },
    colorGlow: {
        position: 'absolute',
        top: -4,
        left: -4,
        right: -4,
        bottom: -4,
        borderRadius: 24,
    },
    colorOption: {
        width: 38,
        height: 38,
        borderRadius: 19,
    },
    colorSelected: {
        transform: [{ scale: 1.15 }],
    },
    sizePicker: {
        flexDirection: 'row',
        gap: spacing.md,
    },
    sizeOption: {
        flex: 1,
        height: 64,
        borderRadius: borderRadius.lg,
        backgroundColor: colors.glass,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: 'transparent',
    },
    sizeSelected: {
        borderColor: colors.primary,
        backgroundColor: colors.primarySoft,
    },
    sizeDot: {
        borderRadius: 50,
        marginBottom: spacing.xs,
    },
    sizeName: {
        fontSize: 10,
        fontWeight: '600',
        color: colors.textSecondary,
    },
    sizeNameSelected: {
        color: colors.primary,
    },
    sendContainer: {
        marginTop: 'auto',
        paddingBottom: spacing['2xl'],
    },
});

export default ScribbleScreen;
