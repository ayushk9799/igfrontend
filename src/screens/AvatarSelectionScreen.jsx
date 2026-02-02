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
    SafeAreaView,
    StatusBar,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import ExpoImageCropTool from 'expo-image-crop-tool';
import { ImageManipulator, FlipType, SaveFormat } from 'expo-image-manipulator';
import { Camera } from 'react-native-camera-kit';
import { useSelector } from 'react-redux';

import { colors, spacing, borderRadius } from '../theme';
import useAvatarUpload from '../hooks/useAvatarUpload';
import { selectUser } from '../store/slices/userSlice';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const AvatarSelectionScreen = ({ onComplete, onBack }) => {
    const { uploadAvatar, isUploading } = useAvatarUpload();
    const userData = useSelector(selectUser);

    // Get existing avatar from store
    const existingAvatar = userData?.avatarThumbnail || userData?.avatar || null;

    const cameraRef = useRef(null);
    const isProcessingRef = useRef(false);

    const [hasPermission, setHasPermission] = useState(Platform.OS === 'ios');
    // Initialize with existing avatar if available
    const [previewUri, setPreviewUri] = useState(
        existingAvatar ? { uri: existingAvatar, isFrontCamera: false } : null
    );
    const [showCamera, setShowCamera] = useState(!existingAvatar); // Hide camera if avatar exists
    const [cameraType, setCameraType] = useState('front');
    const [isCameraInitialized, setIsCameraInitialized] = useState(false);

    // Animations
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
        }).start();
    }, []);

    useEffect(() => {
        const task = InteractionManager.runAfterInteractions(() => {
            setIsCameraInitialized(true);
            requestCameraPermission();
        });

        return () => task.cancel();
    }, []);

    const requestCameraPermission = async () => {
        if (Platform.OS === 'android') {
            const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
            setHasPermission(result === PermissionsAndroid.RESULTS.GRANTED);
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
            console.log('Capture error:', e);
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
            console.log('Gallery error:', e);
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
                    // Decide if we should return or proceed with unflipped image. 
                    // Proceeding might be safer ensuring the user doesn't get stuck.
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
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                        <Path d="M15 18l-6-6 6-6" stroke={colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                </TouchableOpacity>

                {/* Progress Bar */}
                <View style={styles.progressBarContainer}>
                    <View style={styles.progressBarFill} />
                    <View style={styles.progressBarTrack} />
                </View>

                {/* Placeholder */}
                <View style={{ width: 44 }} />
            </View>

            <View style={styles.content}>

                <Text style={styles.title}>
                    {previewUri ? 'Look good?' : 'Choose a\nprofile picture'}
                </Text>

                {/* Camera / Preview Box */}
                <View style={styles.cameraBoxContainer}>
                    {showCamera && !previewUri ? (
                        isCameraInitialized ? (
                            <Camera
                                ref={cameraRef}
                                style={[
                                    styles.camera
                                ]}
                                cameraType={cameraType}
                                flashMode={cameraType === 'front' ? 'off' : 'auto'}
                            />
                        ) : (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color={colors.primary} />
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
                </View>

                {/* Controls */}
                <View style={styles.controlsRow}>
                    {!previewUri ? (
                        <>
                            <TouchableOpacity onPress={handlePickFromGallery} style={styles.controlBtnSecondary}>
                                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                                    <Path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" stroke={colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                                </Svg>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={handleCapture} style={styles.controlBtnPrimary}>
                                <View style={styles.captureInner} />
                            </TouchableOpacity>

                            <TouchableOpacity onPress={toggleCamera} style={styles.controlBtnSecondary}>
                                {/* Flipping Icon */}
                                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                                    <Path d="M1 4v6h6" stroke={colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                                    <Path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" stroke={colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                                </Svg>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <TouchableOpacity onPress={handleRetake} style={styles.controlBtnText}>
                            <Text style={styles.retakeText}>Retake Photo</Text>
                        </TouchableOpacity>
                    )}
                </View>

            </View>

            {/* Footer Button */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.nextButton, (!previewUri && !isUploading) && styles.nextButtonDisabled]}
                    onPress={handleNext}
                    disabled={isUploading}
                >
                    {isUploading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.nextButtonText}>Next</Text>
                    )}
                </TouchableOpacity>
            </View>

        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background, // Light theme background
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingTop: Platform.OS === 'android' ? spacing.lg : 0,
        height: 60,
    },
    backButton: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surface,
        borderRadius: 22,
        shadowColor: colors.shadowLight,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    progressBarContainer: {
        flex: 1,
        height: 6,
        backgroundColor: colors.borderLight,
        borderRadius: 3,
        marginHorizontal: spacing.xl,
        overflow: 'hidden',
        flexDirection: 'row',
    },
    progressBarFill: {
        flex: 0.6,
        backgroundColor: colors.primary,
        borderRadius: 3,
    },
    progressBarTrack: {
        flex: 0.4,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
    },
    title: {
        color: colors.text,
        fontSize: 28,
        fontWeight: '700',
        textAlign: 'center',
        marginTop: spacing.lg,
        marginBottom: spacing.xl,
        lineHeight: 36,
    },
    cameraBoxContainer: {
        width: '100%',
        aspectRatio: 1, // Square aspect ratio
        borderRadius: 32,
        overflow: 'hidden',
        backgroundColor: colors.surface,
        marginBottom: spacing.xl,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: colors.shadowMedium,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
    },
    camera: {
        // Make camera taller than container and center it to fill width
        position: 'absolute',
        top: '-38.5%', // Center the 16:9 camera in the 1:1 box
        left: 0,
        width: '100%',
        height: '177%', // 16:9 Aspect Ratio within the square
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
        marginTop: spacing.sm,
    },
    controlBtnSecondary: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: colors.shadowLight,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    controlBtnPrimary: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 4,
        borderColor: colors.borderLight,
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
        backgroundColor: colors.surface,
        borderRadius: borderRadius.full,
        borderWidth: 1,
        borderColor: colors.border,
    },
    retakeText: {
        color: colors.textSecondary,
        fontWeight: '600',
        fontSize: 16,
    },
    footer: {
        paddingHorizontal: spacing.lg,
        paddingBottom: Platform.OS === 'ios' ? 0 : spacing.lg,
        marginBottom: spacing.lg,
    },
    nextButton: {
        height: 56,
        backgroundColor: colors.primary,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 6,
    },
    nextButtonDisabled: {
        opacity: 0.6,
        shadowOpacity: 0.1,
    },
    nextButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
});

export default AvatarSelectionScreen;
