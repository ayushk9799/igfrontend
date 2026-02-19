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
    InteractionManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';

import { Camera } from 'react-native-camera-kit';
import { ImageManipulator, FlipType, SaveFormat } from 'expo-image-manipulator';

import GradientBackground from '../components/GradientBackground';
import { colors, spacing, borderRadius } from '../theme';
import { usePuzzle } from '../hooks/usePuzzle';
import Button from '../components/Button';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const JigsawCreateScreen = ({ navigation, route, onLinkPartner }) => {
    const { partnerId, partnerName } = route.params || {};
    const { createPuzzle, isUploading } = usePuzzle();

    const cameraRef = useRef(null);
    const isProcessingRef = useRef(false);

    const [hasPermission, setHasPermission] = useState(false);
    const [previewUri, setPreviewUri] = useState(null);
    const [showCamera, setShowCamera] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [cameraType, setCameraType] = useState('back');

    // 2. Add state to track if navigation transition is done
    const [isCameraInitialized, setIsCameraInitialized] = useState(false);

    // Animations
    const puzzleFloat = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const piece1Rotate = useRef(new Animated.Value(0)).current;
    const piece2Rotate = useRef(new Animated.Value(0)).current;
    const piece3Rotate = useRef(new Animated.Value(0)).current;

    // 3. Wait for navigation animation to finish before loading camera
    useEffect(() => {
        const task = InteractionManager.runAfterInteractions(() => {
            setIsCameraInitialized(true);
            checkCameraPermission();
        });

        return () => task.cancel();
    }, []);

    // Animation Effect
    useEffect(() => {
        if (showCamera && !previewUri) return;

        Animated.loop(
            Animated.sequence([
                Animated.timing(puzzleFloat, { toValue: -10, duration: 1500, useNativeDriver: true }),
                Animated.timing(puzzleFloat, { toValue: 0, duration: 1500, useNativeDriver: true }),
            ])
        ).start();

        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
            ])
        ).start();

        Animated.loop(Animated.timing(piece1Rotate, { toValue: 1, duration: 8000, useNativeDriver: true })).start();
        Animated.loop(Animated.timing(piece2Rotate, { toValue: -1, duration: 10000, useNativeDriver: true })).start();
        Animated.loop(Animated.timing(piece3Rotate, { toValue: 1, duration: 6000, useNativeDriver: true })).start();
    }, [showCamera, previewUri]);

    const checkCameraPermission = async () => {
        if (Platform.OS === 'ios') {
            setHasPermission(true);
            return;
        }
        const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
        setHasPermission(granted);
    };

    const requestCameraPermission = async () => {
        if (Platform.OS === 'ios') {
            setHasPermission(true);
            return true;
        }
        const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
        const granted = result === PermissionsAndroid.RESULTS.GRANTED;
        setHasPermission(granted);
        if (!granted) {
            Alert.alert(
                'Camera Permission Needed',
                'We need camera access to take photos for puzzles. Please grant camera permission.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Try Again', onPress: () => requestCameraPermission() },
                ]
            );
        }
        return granted;
    };

    const handleOpenCamera = async () => {
        // If coming from gallery back to camera, ensure perms
        const granted = await requestCameraPermission();
        setShowCamera(true);
    };

    const toggleCamera = () => {
        setCameraType(prev => prev === 'back' ? 'front' : 'back');
    };

    const handleCapture = async () => {
        if (isProcessingRef.current) return;
        isProcessingRef.current = true;

        try {
            const data = await cameraRef.current?.capture();
            const source = data?.uri || (data?.path ? `file://${data.path}` : null);
            if (!source) throw new Error('No image captured');

            const finalUri = source.startsWith('file://') ? source : `file://${source}`;

            setPreviewUri({
                uri: finalUri,
                isFrontCamera: cameraType === 'front'
            });

            setShowCamera(false);
        } catch (e) {
            Alert.alert('Error', 'Could not capture photo');
        } finally {
            isProcessingRef.current = false;
        }
    };

    const handlePickFromGallery = async () => {
        try {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
                Alert.alert(
                    'Gallery Permission Needed',
                    'We need gallery access to pick photos for puzzles. Please grant gallery permission.',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Try Again', onPress: () => handlePickFromGallery() },
                    ]
                );
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                quality: 1,
            });

            if (result.canceled) return;
            const asset = result.assets ? result.assets[0] : result;
            const sourceUri = asset?.uri;
            if (!sourceUri) return;

            const finalUri = sourceUri.startsWith('file://') ? sourceUri : `file://${sourceUri}`;
            setPreviewUri({ uri: finalUri, isFrontCamera: false });
        } catch (e) {
        }
    };

    const handleCropImage = async () => {
        const uri = typeof previewUri === 'string' ? previewUri : previewUri?.uri;
        if (!uri) return null;

        try {
            // Get image dimensions to perform center crop
            const { width, height } = await new Promise((resolve, reject) => {
                Image.getSize(uri, (w, h) => resolve({ width: w, height: h }), (err) => reject(err));
            });

            const size = Math.min(width, height);
            const originX = (width - size) / 2;
            const originY = (height - size) / 2;

            const cropResult = await ImageManipulator.manipulateAsync(
                uri,
                [{ crop: { originX, originY, width: size, height: size } }],
                { compress: 0.9, format: SaveFormat.JPEG }
            );

            const finalUri = cropResult.uri.startsWith('file://') ? cropResult.uri : `file://${cropResult.uri}`;
            setPreviewUri({ uri: finalUri, isFrontCamera: previewUri?.isFrontCamera || false });
            return finalUri;
        } catch (e) {
            // If crop fails, return the original URI as a fallback
            return uri.startsWith('file://') ? uri : `file://${uri}`;
        }
    };

    const handleSendPuzzle = async () => {
        if (!previewUri || isSending) return;
        setIsSending(true);

        try {
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
            Alert.alert('Oops!', 'Failed to send puzzle');
        }
        setIsSending(false);
    };

    const piece1Spin = piece1Rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
    const piece2Spin = piece2Rotate.interpolate({ inputRange: [-1, 0], outputRange: ['-360deg', '0deg'] });
    const piece3Spin = piece3Rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

    return (
        <View style={{ flex: 1, backgroundColor: '#1A1A1A' }}>
            <SafeAreaView style={styles.container} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                            <Path d="M15 18l-6-6 6-6" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                        </Svg>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Create Puzzle</Text>
                    <View style={{ width: 40 }} />
                </View>

                <Animated.View style={[styles.floatingPiece, styles.piece1, { transform: [{ rotate: piece1Spin }] }]}>
                    <PuzzlePieceIcon size={60} color={colors.primaryLight} />
                </Animated.View>
                <Animated.View style={[styles.floatingPiece, styles.piece2, { transform: [{ rotate: piece2Spin }] }]}>
                    <PuzzlePieceIcon size={45} color={colors.secondaryLight} />
                </Animated.View>
                <Animated.View style={[styles.floatingPiece, styles.piece3, { transform: [{ rotate: piece3Spin }] }]}>
                    <PuzzlePieceIcon size={50} color={colors.accent} />
                </Animated.View>

                <View style={styles.content}>
                    <Text style={styles.title}>Send a Puzzle!</Text>
                    <Text style={styles.subtitle}>
                        {previewUri ? 'Your puzzle preview 🧩' : `Pick a photo and challenge ${partnerName || 'your partner'} to solve it`}
                    </Text>

                    {/* Camera / Preview Box */}
                    <View style={styles.cameraBoxContainer}>
                        {showCamera && !previewUri ? (
                            isCameraInitialized && hasPermission ? (
                                <Camera
                                    ref={cameraRef}
                                    style={styles.camera}
                                    cameraType={cameraType}
                                    flashMode={cameraType === 'front' ? 'off' : 'auto'}
                                />
                            ) : !hasPermission && isCameraInitialized ? (
                                <View style={styles.loadingContainer}>
                                    <Text style={{ color: colors.textSecondary, fontSize: 16, textAlign: 'center', marginBottom: 16, paddingHorizontal: 20 }}>
                                        Camera access is needed to take puzzle photos
                                    </Text>
                                    <TouchableOpacity
                                        onPress={requestCameraPermission}
                                        style={{ backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 }}
                                    >
                                        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>Grant Camera Access</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View style={styles.loadingContainer}>
                                    <ActivityIndicator size="large" color={colors.primary} />
                                </View>
                            )
                        ) : (
                            <Image
                                source={{ uri: typeof previewUri === 'string' ? previewUri : previewUri?.uri }}
                                style={[
                                    styles.previewImage,
                                    (previewUri?.isFrontCamera) && { transform: [{ scaleX: -1 }] }
                                ]}
                                resizeMode="cover"
                            />
                        )}
                        {/* Grid Overlay on Preview */}
                        {previewUri && (
                            <View style={styles.gridOverlay}>
                                {[...Array(9)].map((_, i) => (
                                    <View key={i} style={styles.gridCell} />
                                ))}
                            </View>
                        )}
                    </View>

                    {/* Controls Row */}
                    <View style={styles.controlsRow}>
                        {!previewUri ? (
                            <>
                                <TouchableOpacity onPress={handlePickFromGallery} style={styles.controlBtnSecondary}>
                                    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                                        <Rect x="3" y="3" width="18" height="18" rx="2" stroke="#FFFFFF" strokeWidth={2} />
                                        <Path d="M3 15l5-5 4 4 3-3 6 6" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                                        <Circle cx="8.5" cy="8.5" r="1.5" fill="#FFFFFF" />
                                    </Svg>
                                </TouchableOpacity>

                                <TouchableOpacity onPress={handleCapture} style={styles.controlBtnPrimary}>
                                    <View style={styles.captureInner} />
                                </TouchableOpacity>

                                <TouchableOpacity onPress={toggleCamera} style={styles.controlBtnSecondary}>
                                    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                                        <Path d="M1 4v6h6" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                                        <Path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                                    </Svg>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <TouchableOpacity onPress={() => { setPreviewUri(null); setShowCamera(true); }} style={styles.controlBtnText}>
                                <Text style={styles.retakeText}>Retake Photo</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Footer with Send Button */}
                <View style={styles.footer}>
                    {partnerId ? (
                        <Button
                            title={`Send to ${partnerName} 🧩`}
                            onPress={handleSendPuzzle}
                            variant="glow"
                            size="xl"
                            fullWidth
                            disabled={!previewUri || isSending}
                            loading={isSending}
                        />
                    ) : (
                        <Button
                            title="Link Partner to Send 🔗"
                            onPress={() => {
                                if (onLinkPartner) {
                                    onLinkPartner();
                                } else {
                                    navigation.goBack();
                                }
                            }}
                            variant="primary"
                            size="xl"
                            fullWidth
                        />
                    )}
                </View>
            </SafeAreaView>
        </View>
    );
};

// Icons components ... (PuzzlePieceIcon, BigPuzzleIcon) remain the same
const PuzzlePieceIcon = ({ size = 40, color = colors.primary }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d="M20 11V7a2 2 0 00-2-2h-3.5a2.5 2.5 0 110-5 2.5 2.5 0 110 5H11a2 2 0 00-2 2v3.5a2.5 2.5 0 11-5 0 2.5 2.5 0 115 0V14a2 2 0 002 2h3.5a2.5 2.5 0 110 5 2.5 2.5 0 110-5H18a2 2 0 002-2v-3z" fill={color} opacity={0.6} />
    </Svg>
);

const BigPuzzleIcon = () => (
    <View style={styles.bigPuzzleContainer}>
        <Svg width={120} height={120} viewBox="0 0 100 100" fill="none">
            <Path d="M10 10 H40 V20 C40 25, 45 30, 50 30 C55 30, 60 25, 60 20 V10 H90 V40 H80 C75 40, 70 45, 70 50 C70 55, 75 60, 80 60 H90 V90 H60 V80 C60 75, 55 70, 50 70 C45 70, 40 75, 40 80 V90 H10 V60 H20 C25 60, 30 55, 30 50 C30 45, 25 40, 20 40 H10 Z" fill={colors.primary} stroke={colors.primaryLight} strokeWidth="2" />
        </Svg>
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: spacing.xl,
    },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md },
    backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255, 255, 255, 0.1)', alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
    content: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.md },
    title: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: spacing.xs },
    subtitle: { fontSize: 14, color: 'rgba(255, 255, 255, 0.7)', textAlign: 'center', marginBottom: spacing.xl, paddingHorizontal: spacing.sm },

    // Camera Box
    cameraBoxContainer: {
        width: '100%',
        aspectRatio: 1, // Square
        borderRadius: 32,
        overflow: 'hidden',
        backgroundColor: '#1A1A1A',
        marginBottom: spacing.xl,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 5,
    },
    camera: {
        position: 'absolute',
        top: '-38.5%', // Center 16:9 camera in 1:1 box
        left: 0,
        width: '100%',
        height: '177%',
    },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    previewImage: { flex: 1 },

    // Controls
    controlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xl,
        marginTop: spacing.sm,
        marginBottom: spacing.lg,
    },
    controlBtnSecondary: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    controlBtnPrimary: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 4,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    captureInner: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: colors.primary,
    },
    controlBtnText: {
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    retakeText: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontWeight: '600',
        fontSize: 16,
    },

    // Footer / Send
    footer: {
        width: '100%',
        marginTop: 0,
        paddingBottom: spacing['2xl'],
    },


    // Grid Overlay
    gridOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row', flexWrap: 'wrap' },
    gridCell: { width: '33.33%', height: '33.33%', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },

    // Floating pieces
    floatingPiece: { position: 'absolute', opacity: 0.3 },
    piece1: { top: 120, left: 20 },
    piece2: { top: 200, right: 30 },
    piece3: { bottom: 150, left: 50 },
    uploadSection: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60 },
    bigPuzzleContainer: { marginBottom: spacing.xl },
    optionsRow: { flexDirection: 'row', gap: spacing.lg },
    optionBtn: { borderRadius: borderRadius.xl, overflow: 'hidden', shadowColor: colors.shadowDark, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
    optionGradient: { width: 130, height: 130, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
    optionText: { fontSize: 16, fontWeight: '600', color: '#fff' },
    previewSection: { flex: 1, alignItems: 'center', paddingTop: spacing.xl },
    previewTitle: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.lg },
    previewContainer: { width: SCREEN_WIDTH - 80, height: SCREEN_WIDTH - 80, borderRadius: borderRadius.lg, overflow: 'hidden', position: 'relative' },
    previewActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
    retakeBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: colors.borderLight, borderRadius: borderRadius.lg },
    retakeBtnText: { fontSize: 16, fontWeight: '600', color: colors.text },
    sendBtn: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, backgroundColor: colors.primary, borderRadius: borderRadius.lg, minWidth: 160, alignItems: 'center' },
    sendBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
    previewHint: { fontSize: 14, color: colors.textSecondary, marginTop: spacing.md },
});

export default JigsawCreateScreen;