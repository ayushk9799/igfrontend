import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Image,
    Platform,
    PermissionsAndroid,
    Alert,
    ActivityIndicator,
    Animated,
    Dimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import ExpoImageCropTool from 'expo-image-crop-tool';
import { Camera } from 'react-native-camera-kit';

import GradientBackground from '../components/GradientBackground';
import { colors, spacing, borderRadius } from '../theme';
import { usePuzzle } from '../hooks/usePuzzle';
import { getUser } from '../utils/authStorage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * JigsawCreateScreen - Fun UI for creating and sending puzzles
 */
const JigsawCreateScreen = ({ navigation, route }) => {
    const { partnerId, partnerName } = route.params || {};
    const { createPuzzle, isUploading } = usePuzzle();

    const cameraRef = useRef(null);
    const isProcessingRef = useRef(false);

    const [hasPermission, setHasPermission] = useState(Platform.OS === 'ios');
    const [previewUri, setPreviewUri] = useState(null); // Can be { uri, isFrontCamera } or null
    const [showCamera, setShowCamera] = useState(true); // Auto-open camera on mount
    const [isSending, setIsSending] = useState(false);
    const [cameraType, setCameraType] = useState('back'); // 'back' or 'front'

    // Animations
    const puzzleFloat = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const piece1Rotate = useRef(new Animated.Value(0)).current;
    const piece2Rotate = useRef(new Animated.Value(0)).current;
    const piece3Rotate = useRef(new Animated.Value(0)).current;

    // Request camera permission on mount
    useEffect(() => {
        requestCameraPermission();
    }, []);

    useEffect(() => {
        // Floating animation
        Animated.loop(
            Animated.sequence([
                Animated.timing(puzzleFloat, {
                    toValue: -10,
                    duration: 1500,
                    useNativeDriver: true,
                }),
                Animated.timing(puzzleFloat, {
                    toValue: 0,
                    duration: 1500,
                    useNativeDriver: true,
                }),
            ])
        ).start();

        // Pulse animation
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.1,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ])
        ).start();

        // Piece rotation animations
        Animated.loop(
            Animated.timing(piece1Rotate, {
                toValue: 1,
                duration: 8000,
                useNativeDriver: true,
            })
        ).start();
        Animated.loop(
            Animated.timing(piece2Rotate, {
                toValue: -1,
                duration: 10000,
                useNativeDriver: true,
            })
        ).start();
        Animated.loop(
            Animated.timing(piece3Rotate, {
                toValue: 1,
                duration: 6000,
                useNativeDriver: true,
            })
        ).start();
    }, []);

    const requestCameraPermission = async () => {
        if (Platform.OS === 'android') {
            const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
            const granted = result === PermissionsAndroid.RESULTS.GRANTED;
            setHasPermission(granted);
            if (!granted) {
                Alert.alert('Permission required', 'Please allow Camera access to take a photo.');
                return false;
            }
            return true;
        }
        return true;
    };

    const handleOpenCamera = async () => {
        const granted = await requestCameraPermission();
        if (granted) setShowCamera(true);
    };

    const toggleCamera = () => {
        setCameraType(prev => prev === 'back' ? 'front' : 'back');
    };

    const handleCapture = async () => {
        if (isProcessingRef.current) return;
        isProcessingRef.current = true;

        try {
            // 1. Capture the image
            const data = await cameraRef.current?.capture();

            const source = data?.uri || (data?.path ? `file://${data.path}` : null);
            if (!source) throw new Error('No image captured');

            const finalUri = source.startsWith('file://') ? source : `file://${source}`;

            // 2. IMMEDIATE SWITCH: Set preview URI and hide camera instantly
            setPreviewUri({
                uri: finalUri,
                isFrontCamera: cameraType === 'front'
            });

            setShowCamera(false);

        } catch (e) {
            console.log('Capture error:', e);
            Alert.alert('Error', 'Could not capture photo');
        } finally {
            isProcessingRef.current = false;
        }
    };

    const handlePickFromGallery = async () => {
        try {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
                Alert.alert('Permission required', 'Please allow gallery access.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                quality: 1,
            });

            if (result.cancelled || result.canceled) return;
            const asset = result.assets ? result.assets[0] : result;
            const sourceUri = asset?.uri;
            if (!sourceUri) return;

            // Show preview immediately for instant feedback
            const finalUri = sourceUri.startsWith('file://') ? sourceUri : `file://${sourceUri}`;
            setPreviewUri({ uri: finalUri, isFrontCamera: false });
        } catch (e) {
            console.log('Gallery error:', e);
        }
    };

    const handleCropImage = async () => {
        const uri = typeof previewUri === 'string' ? previewUri : previewUri?.uri;
        if (!uri) return null;

        try {
            const cropResult = await ExpoImageCropTool.openCropperAsync({
                imageUri: uri,
                shape: 'rectangle',
                format: 'jpeg',
                compressImageQuality: 0.9,
            });

            const out = typeof cropResult === 'string' ? cropResult : cropResult?.uri || cropResult?.path;
            if (!out) return null;
            const finalUri = out.startsWith('file://') ? out : `file://${out}`;

            // Keep the same camera type info after cropping
            setPreviewUri({ uri: finalUri, isFrontCamera: previewUri?.isFrontCamera || false });
            return finalUri;
        } catch (e) {
            console.log('Crop error:', e);
            return null;
        }
    };

    const handleSendPuzzle = async () => {
        if (!previewUri || isSending) return;

        setIsSending(true);

        try {
            // Crop the image before sending
            const croppedUri = await handleCropImage();
            if (!croppedUri) {
                setIsSending(false);
                return;
            }

            const result = await createPuzzle(
                { uri: croppedUri, fileName: `puzzle_${Date.now()}.jpg` },
                partnerId
            );

            if (result.success) {
                Alert.alert('🧩 Puzzle Sent!', `${partnerName || 'Your partner'} will receive a notification to solve it!`, [
                    { text: 'Awesome!', onPress: () => navigation.goBack() }
                ]);
            } else {
                Alert.alert('Oops!', result.error || 'Failed to send puzzle');
            }
        } catch (error) {
            console.error('Send puzzle error:', error);
            Alert.alert('Oops!', 'Failed to send puzzle');
        }

        setIsSending(false);
    };

    // Camera View
    if (showCamera && !previewUri) {
        return (
            <View style={styles.cameraContainer}>
                <Camera
                    ref={cameraRef}
                    style={styles.camera}
                    cameraType={cameraType}
                    flashMode={cameraType === 'front' ? 'off' : 'auto'}
                />

                <View style={styles.cameraOverlay}>
                    <TouchableOpacity onPress={() => setShowCamera(false)} style={styles.cameraBackBtn}>
                        <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                            <Path d="M15 18l-6-6 6-6" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                        </Svg>
                    </TouchableOpacity>
                </View>
                <View style={styles.cameraBottomBar}>
                    <TouchableOpacity onPress={handlePickFromGallery} style={styles.galleryBtn}>
                        <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
                            <Path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                        </Svg>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleCapture} style={styles.captureBtn}>
                        <View style={styles.captureBtnInner} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={toggleCamera} style={styles.flipCameraBtn}>
                        <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                            <Path d="M1 4v6h6" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                            <Path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                            <Circle cx="12" cy="12" r="3" stroke="#fff" strokeWidth={2} />
                        </Svg>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    const piece1Spin = piece1Rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
    const piece2Spin = piece2Rotate.interpolate({ inputRange: [-1, 0], outputRange: ['-360deg', '0deg'] });
    const piece3Spin = piece3Rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

    return (
        <GradientBackground>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                            <Path d="M15 18l-6-6 6-6" stroke={colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                        </Svg>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Create Puzzle</Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* Floating Puzzle Pieces Background */}
                <Animated.View style={[styles.floatingPiece, styles.piece1, { transform: [{ rotate: piece1Spin }] }]}>
                    <PuzzlePieceIcon size={60} color={colors.primaryLight} />
                </Animated.View>
                <Animated.View style={[styles.floatingPiece, styles.piece2, { transform: [{ rotate: piece2Spin }] }]}>
                    <PuzzlePieceIcon size={45} color={colors.secondaryLight} />
                </Animated.View>
                <Animated.View style={[styles.floatingPiece, styles.piece3, { transform: [{ rotate: piece3Spin }] }]}>
                    <PuzzlePieceIcon size={50} color={colors.accent} />
                </Animated.View>

                {/* Main Content */}
                <View style={styles.content}>
                    {previewUri ? (
                        // Preview with puzzle grid overlay
                        <View style={styles.previewSection}>
                            <Text style={styles.previewTitle}>Your puzzle preview 🧩</Text>
                            <View style={styles.previewContainer}>
                                <Image
                                    source={{ uri: typeof previewUri === 'string' ? previewUri : previewUri?.uri }}
                                    style={[
                                        styles.previewImage,
                                        (previewUri?.isFrontCamera) && { transform: [{ scaleX: -1 }] }
                                    ]}
                                    resizeMode="cover"
                                />
                                {/* Puzzle Grid Overlay */}
                                <View style={styles.gridOverlay}>
                                    {[...Array(9)].map((_, i) => (
                                        <View key={i} style={styles.gridCell} />
                                    ))}
                                </View>
                            </View>
                            <Text style={styles.previewHint}>3x3 puzzle pieces</Text>

                            <View style={styles.previewActions}>
                                <TouchableOpacity
                                    onPress={() => {
                                        setPreviewUri(null);
                                    }}
                                    style={styles.retakeBtn}
                                >
                                    <Text style={styles.retakeBtnText}>Choose Different</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleSendPuzzle}
                                    style={styles.sendBtn}
                                    disabled={isSending}
                                >
                                    {isSending ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <Text style={styles.sendBtnText}>Send to {partnerName || 'Partner'} 🧩</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        // Upload Options
                        <View style={styles.uploadSection}>
                            <Animated.View style={{ transform: [{ translateY: puzzleFloat }] }}>
                                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                                    <BigPuzzleIcon />
                                </Animated.View>
                            </Animated.View>

                            <Text style={styles.title}>Send a Puzzle!</Text>
                            <Text style={styles.subtitle}>
                                Pick a photo and challenge {partnerName || 'your partner'} to solve it
                            </Text>

                            <View style={styles.optionsRow}>
                                <TouchableOpacity onPress={handleOpenCamera} style={styles.optionBtn}>
                                    <LinearGradient colors={colors.gradientPrimary} style={styles.optionGradient}>
                                        <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
                                            <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                                            <Circle cx="12" cy="13" r="4" stroke="#fff" strokeWidth={2} />
                                        </Svg>
                                        <Text style={styles.optionText}>Camera</Text>
                                    </LinearGradient>
                                </TouchableOpacity>

                                <TouchableOpacity onPress={handlePickFromGallery} style={styles.optionBtn}>
                                    <LinearGradient colors={colors.gradientSecondary} style={styles.optionGradient}>
                                        <Svg width={40} height={40} viewBox="0 0 24 24" fill="none">
                                            <Rect x="3" y="3" width="18" height="18" rx="2" stroke="#fff" strokeWidth={2} />
                                            <Path d="M3 15l5-5 4 4 3-3 6 6" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                                            <Circle cx="8.5" cy="8.5" r="1.5" fill="#fff" />
                                        </Svg>
                                        <Text style={styles.optionText}>Gallery</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>
            </View>
        </GradientBackground>
    );
};

// Puzzle Piece Icon Component
const PuzzlePieceIcon = ({ size = 40, color = colors.primary }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
            d="M20 11V7a2 2 0 00-2-2h-3.5a2.5 2.5 0 110-5 2.5 2.5 0 110 5H11a2 2 0 00-2 2v3.5a2.5 2.5 0 11-5 0 2.5 2.5 0 115 0V14a2 2 0 002 2h3.5a2.5 2.5 0 110 5 2.5 2.5 0 110-5H18a2 2 0 002-2v-3z"
            fill={color}
            opacity={0.6}
        />
    </Svg>
);

// Big Puzzle Icon for main display
const BigPuzzleIcon = () => (
    <View style={styles.bigPuzzleContainer}>
        <Svg width={120} height={120} viewBox="0 0 100 100" fill="none">
            {/* Puzzle pieces forming a square */}
            <Path d="M10 10 H40 V20 C40 25, 45 30, 50 30 C55 30, 60 25, 60 20 V10 H90 V40 H80 C75 40, 70 45, 70 50 C70 55, 75 60, 80 60 H90 V90 H60 V80 C60 75, 55 70, 50 70 C45 70, 40 75, 40 80 V90 H10 V60 H20 C25 60, 30 55, 30 50 C30 45, 25 40, 20 40 H10 Z"
                fill={colors.primary}
                stroke={colors.primaryLight}
                strokeWidth="2"
            />
        </Svg>
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingTop: Platform.OS === 'ios' ? 60 : 20,
        paddingBottom: spacing.md,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.glass,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.text,
    },
    content: {
        flex: 1,
        paddingHorizontal: spacing.lg,
    },
    // Floating pieces
    floatingPiece: {
        position: 'absolute',
        opacity: 0.3,
    },
    piece1: { top: 120, left: 20 },
    piece2: { top: 200, right: 30 },
    piece3: { bottom: 150, left: 50 },
    // Upload section
    uploadSection: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 60,
    },
    bigPuzzleContainer: {
        marginBottom: spacing.xl,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: colors.text,
        marginBottom: spacing.sm,
    },
    subtitle: {
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.xl,
        paddingHorizontal: spacing.lg,
    },
    optionsRow: {
        flexDirection: 'row',
        gap: spacing.lg,
    },
    optionBtn: {
        borderRadius: borderRadius.xl,
        overflow: 'hidden',
        shadowColor: colors.shadowDark,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 5,
    },
    optionGradient: {
        width: 130,
        height: 130,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
    },
    optionText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    // Preview section
    previewSection: {
        flex: 1,
        alignItems: 'center',
        paddingTop: spacing.xl,
    },
    previewTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: colors.text,
        marginBottom: spacing.lg,
    },
    previewContainer: {
        width: SCREEN_WIDTH - 80,
        height: SCREEN_WIDTH - 80,
        borderRadius: borderRadius.lg,
        overflow: 'hidden',
        position: 'relative',
    },
    previewImage: {
        width: '100%',
        height: '100%',
    },
    gridOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    gridCell: {
        width: '33.33%',
        height: '33.33%',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.6)',
    },
    previewHint: {
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: spacing.md,
    },
    previewActions: {
        flexDirection: 'row',
        gap: spacing.md,
        marginTop: spacing.xl,
    },
    retakeBtn: {
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        backgroundColor: colors.borderLight,
        borderRadius: borderRadius.lg,
    },
    retakeBtnText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
    },
    sendBtn: {
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        backgroundColor: colors.primary,
        borderRadius: borderRadius.lg,
        minWidth: 160,
        alignItems: 'center',
    },
    sendBtnText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
    },
    // Camera styles
    cameraContainer: {
        flex: 1,
        backgroundColor: '#000',
    },
    camera: {
        flex: 1,
    },
    cameraOverlay: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 20,
        left: 20,
    },
    cameraBackBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cameraBottomBar: {
        position: 'absolute',
        bottom: 40,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingHorizontal: 40,
    },
    galleryBtn: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    flipCameraBtn: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    captureBtn: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    captureBtnInner: {
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: colors.primary,
    },
});

export default JigsawCreateScreen;
