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
    Linking,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import ExpoImageCropTool from 'expo-image-crop-tool';
import { ImageManipulator, FlipType, SaveFormat } from 'expo-image-manipulator';
import { Camera } from 'react-native-camera-kit';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GradientBackground from '../components/GradientBackground';
import { colors, spacing, borderRadius, shadows } from '../theme';
import useAvatarUpload from '../hooks/useAvatarUpload';
import { selectUser } from '../store/slices/userSlice';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const AvatarSelectionScreen = ({ onComplete }) => {
    const { uploadAvatar, isUploading } = useAvatarUpload();
    const userData = useSelector(selectUser);
    const insets = useSafeAreaInsets();

    // Get existing avatar from store
    const existingAvatar = userData?.avatarThumbnail || userData?.avatar || null;

    const cameraRef = useRef(null);
    const isProcessingRef = useRef(false);

    const [hasPermission, setHasPermission] = useState(false);
    // Initialize with existing avatar if available
    const [previewUri, setPreviewUri] = useState(
        existingAvatar ? { uri: existingAvatar, isFrontCamera: false } : null
    );
    const [showCamera, setShowCamera] = useState(!existingAvatar); // Hide camera if avatar exists
    const [cameraType, setCameraType] = useState('front');
    const [isCameraInitialized, setIsCameraInitialized] = useState(false);

    // Animations
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 600,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    useEffect(() => {
        const task = InteractionManager.runAfterInteractions(() => {
            setIsCameraInitialized(true);
            checkCameraPermission();
        });

        return () => task.cancel();
    }, []);

    const checkCameraPermission = async () => {
        if (Platform.OS === 'ios') {
            const { status } = await ImagePicker.getCameraPermissionsAsync();
            setHasPermission(status === 'granted');
            return;
        }
        const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
        setHasPermission(granted);
    };

    const requestCameraPermission = async () => {
        if (Platform.OS === 'ios') {
            const { status, canAskAgain } = await ImagePicker.requestCameraPermissionsAsync();
            const granted = status === 'granted';
            setHasPermission(granted);
            if (!granted && !canAskAgain) {
                Alert.alert(
                    'Camera Permission Needed',
                    'Camera access was denied. Please enable it in Settings to take your profile photo.',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Open Settings', onPress: () => Linking.openSettings() },
                    ]
                );
            }
            return;
        }
        const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
        const granted = result === PermissionsAndroid.RESULTS.GRANTED;
        setHasPermission(granted);
        if (!granted) {
            Alert.alert(
                'Camera Permission Needed',
                'We need camera access to take your profile photo. Please grant camera permission.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Try Again', onPress: () => requestCameraPermission() },
                ]
            );
        }
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

            let finalUri = source.startsWith('file://') ? source : `file://${source}`;

            setPreviewUri({
                uri: finalUri,
                isFrontCamera: cameraType === 'front'
            });

            setShowCamera(false);
        } catch (e) {
            Alert.alert('Error', e.message);
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

            if (result.canceled) return;
            const asset = result.assets ? result.assets[0] : result;
            let sourceUri = asset?.uri;
            if (!sourceUri) return;

            // Open Cropper immediately for Gallery selections
            const croppedUri = await handleCropImage(sourceUri);
            if (croppedUri) {
                const finalUri = croppedUri.startsWith('file://') ? croppedUri : `file://${croppedUri}`;
                setPreviewUri({ uri: finalUri, isFrontCamera: false });
                setShowCamera(false);
            }
        } catch (e) {
        }
    };

    const handleCropImage = async (uri) => {
        if (!uri) return null;

        try {
            const cropResult = await ExpoImageCropTool.openCropperAsync({
                imageUri: uri,
                shape: 'rectangle',
                aspectRatio: 1, // Square
                format: 'jpeg',
                compressImageQuality: 0.9,
            });

            const out = typeof cropResult === 'string' ? cropResult : cropResult?.uri || cropResult?.path;
            if (!out) return null;
            return out.startsWith('file://') ? out : `file://${out}`;
        } catch (e) {
            console.warn("Crop cancelled or failed", e);
            return null;
        }
    };

    const handleNext = async () => {
        if (!previewUri && showCamera) {
            Alert.alert('Photo Required', 'Please take a photo or select one from the gallery.');
            return;
        }

        await handleConfirmAvatar();
    };

    const handleConfirmAvatar = async () => {
        if (!previewUri || isUploading) return;

        try {
            let finalUploadUri = previewUri.uri;

            // If it was a front camera capture, flip it now before uploading
            if (previewUri.isFrontCamera) {
                try {
                    const context = ImageManipulator.manipulate(finalUploadUri);
                    context.flip(FlipType.Horizontal);
                    const result = await context.renderAsync();
                    const saved = await result.saveAsync({ format: SaveFormat.JPEG });
                    finalUploadUri = saved.uri;
                } catch (err) {
                    console.error('Failed to flip image before upload:', err);
                }
            }

            // Upload directly
            const result = await uploadAvatar({
                uri: finalUploadUri,
                fileName: `avatar_${Date.now()}.jpg`,
                mimeType: 'image/jpeg',
            });

            if (result.success) {
                onComplete();
            } else {
                Alert.alert('Upload Failed', result.error || 'Could not upload avatar');
            }
        } catch (error) {
            console.error('Avatar upload error:', error);
            Alert.alert('Error', 'Failed to set profile picture');
        }
    };

    const handleRetake = () => {
        setPreviewUri(null);
        setShowCamera(true);
    }


    return (
        <View style={{ flex: 1, backgroundColor: '#000000' }}>
            <View style={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
                {/* Brand Name */}
                <View style={styles.brandContainer}>
                    <Text style={styles.brandName}>penguin.</Text>
                </View>

                {/* Skip Button (Cross) */}
                <TouchableOpacity onPress={onComplete} style={styles.skipButton}>
                    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                        <Path d="M18 6L6 18M6 6l12 12" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                </TouchableOpacity>

                {/* Title Section */}
                <Animated.View
                    style={[
                        styles.titleSection,
                        {
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }],
                        },
                    ]}
                >
                    <Text style={styles.title}>
                        {previewUri ? 'looking good?' : 'add a photo'}
                    </Text>
                    <Text style={styles.subtitle}>
                        {previewUri ? 'Your partner will love it' : 'Let your partner see you'}
                    </Text>
                </Animated.View>

                {/* Camera / Preview Box */}
                <Animated.View
                    style={[
                        styles.cameraBoxContainer,
                        {
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }],
                        },
                    ]}
                >
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
                                <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16, textAlign: 'center', marginBottom: 16, paddingHorizontal: 20 }}>
                                    Camera access is needed to take your profile photo
                                </Text>
                                <TouchableOpacity
                                    onPress={requestCameraPermission}
                                    style={{ backgroundColor: '#FFFFFF', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20 }}
                                >
                                    <Text style={{ color: '#000', fontWeight: '600', fontSize: 15 }}>Grant Camera Access</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color="#FFFFFF" />
                            </View>
                        )
                    ) : (
                        <Image
                            source={{ uri: previewUri?.uri }}
                            style={[
                                styles.previewImage,
                                previewUri?.isFrontCamera && { transform: [{ scaleX: -1 }] }
                            ]}
                            resizeMode="cover"
                        />
                    )}
                </Animated.View>

                {/* Controls */}
                <View style={styles.controlsRow}>
                    {!previewUri ? (
                        <>
                            <TouchableOpacity onPress={handlePickFromGallery} style={styles.controlBtnSecondary}>
                                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                                    <Path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" stroke="#FFFFFF" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                                </Svg>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={handleCapture} style={styles.controlBtnPrimary}>
                                <View style={styles.captureInner} />
                            </TouchableOpacity>

                            <TouchableOpacity onPress={toggleCamera} style={styles.controlBtnSecondary}>
                                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                                    <Path d="M1 4v6h6" stroke="#FFFFFF" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                                    <Path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" stroke="#FFFFFF" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                                </Svg>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <TouchableOpacity onPress={handleRetake} activeOpacity={0.7}>
                            <Text style={styles.retakeText}>Retake Photo →</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Spacer */}
                <View style={styles.spacer} />

                {/* Footer Button */}
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.continueButton, (!previewUri && !isUploading) && styles.continueButtonDisabled]}
                        onPress={handleNext}
                        disabled={isUploading}
                        activeOpacity={0.9}
                    >
                        {isUploading ? (
                            <ActivityIndicator color="#000000" />
                        ) : (
                            <Text style={[
                                styles.continueButtonText,
                                (!previewUri && !isUploading) && styles.continueButtonTextDisabled,
                            ]}>
                                Continue →
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: spacing.xl,
    },
    brandContainer: {
        alignSelf: 'flex-start',
        marginBottom: spacing.md,
    },
    brandName: {
        fontSize: 28,
        fontWeight: '600',
        color: '#FFFFFF',
        letterSpacing: -0.5,
    },
    skipButton: {
        alignSelf: 'flex-end',
        marginBottom: spacing.xl,
        padding: spacing.xs,
    },
    titleSection: {
        alignSelf: 'flex-start',
        marginBottom: spacing.xl,
    },
    title: {
        fontSize: 34,
        fontWeight: '600',
        color: '#FFFFFF',
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.6)',
        marginTop: spacing.xs,
    },
    cameraBoxContainer: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: borderRadius['2xl'],
        overflow: 'hidden',
        backgroundColor: '#1A1A1A',
        marginBottom: spacing.xl,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        ...shadows.sm,
    },
    camera: {
        position: 'absolute',
        top: '-38.5%',
        left: 0,
        width: '100%',
        height: '177%',
    },
    previewImage: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    controlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xl,
    },
    controlBtnSecondary: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#1A1A1A',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        ...shadows.xs,
    },
    controlBtnPrimary: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#1A1A1A',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 3,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    captureInner: {
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: '#FFFFFF',
    },
    retakeText: {
        fontSize: 15,
        color: 'rgba(255,255,255,0.6)',
        fontWeight: '500',
        paddingVertical: spacing.sm,
    },
    spacer: {
        flex: 1,
    },
    footer: {
        marginBottom: spacing.sm,
    },
    continueButton: {
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: borderRadius.xl,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    continueButtonDisabled: {
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
    },
    continueButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000000',
    },
    continueButtonTextDisabled: {
        color: 'rgba(0, 0, 0, 0.4)',
    },
});

export default AvatarSelectionScreen;
