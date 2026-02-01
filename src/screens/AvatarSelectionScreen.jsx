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
import { Camera } from 'react-native-camera-kit';

import { colors, spacing, borderRadius } from '../theme';
import useAvatarUpload from '../hooks/useAvatarUpload';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const AvatarSelectionScreen = ({ onComplete, onBack }) => {
    const { uploadAvatar, isUploading } = useAvatarUpload();

    const cameraRef = useRef(null);
    const isProcessingRef = useRef(false);

    const [hasPermission, setHasPermission] = useState(Platform.OS === 'ios');
    const [previewUri, setPreviewUri] = useState(null); // { uri, isFrontCamera }
    const [showCamera, setShowCamera] = useState(true);
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

            const finalUri = source.startsWith('file://') ? source : `file://${source}`;

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
            // Upload directly
            const result = await uploadAvatar({
                uri: previewUri.uri,
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
            <StatusBar barStyle="light-content" backgroundColor="#000" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                        <Path d="M15 18l-6-6 6-6" stroke="#555" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                </TouchableOpacity>

                {/* Progress Bar */}
                <View style={styles.progressBarContainer}>
                    <View style={styles.progressBarFill} />
                    <View style={styles.progressBarTrack} />
                </View>

                {/* Placeholder for right side to balance header */}
                <View style={{ width: 40 }} />
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
                                style={styles.camera}
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
                                (previewUri?.isFrontCamera) && { transform: [{ scaleX: -1 }] }
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
                                    <Path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                                </Svg>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={handleCapture} style={styles.controlBtnPrimary}>
                                <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                                    <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                                    <Circle cx="12" cy="13" r="4" stroke="#fff" strokeWidth={2} />
                                </Svg>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={toggleCamera} style={styles.controlBtnSecondary}>
                                {/* Flip Icon */}
                                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                                    <Path d="M1 4v6h6" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                                    <Path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                                </Svg>
                            </TouchableOpacity>
                        </>
                    ) : (
                        <TouchableOpacity onPress={handleRetake} style={styles.controlBtnSecondary}>
                            <Text style={{ color: '#fff', fontWeight: '600' }}>Retake</Text>
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
        backgroundColor: '#000',
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
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1A1A1A',
        borderRadius: 20,
    },
    progressBarContainer: {
        flex: 1,
        height: 6,
        backgroundColor: '#333',
        borderRadius: 3,
        marginHorizontal: spacing.xl,
        overflow: 'hidden',
        flexDirection: 'row',
    },
    progressBarFill: {
        flex: 0.6, // 60% progress example
        backgroundColor: '#fff', // White or Green
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
        color: '#fff',
        fontSize: 28,
        fontWeight: '600',
        textAlign: 'center',
        marginTop: spacing.lg,
        marginBottom: spacing.xl,
        lineHeight: 36,
    },
    cameraBoxContainer: {
        width: SCREEN_WIDTH - 48, // Padding on sides
        height: SCREEN_WIDTH - 48, // Square aspect ratio
        borderRadius: 32,
        overflow: 'hidden',
        backgroundColor: '#1A1A1A',
        marginBottom: spacing.xl,
        borderWidth: 1,
        borderColor: '#333',
    },
    camera: {
        flex: 1,
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
        backgroundColor: '#1A1A1A',
        alignItems: 'center',
        justifyContent: 'center',
    },
    controlBtnPrimary: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#1A1A1A', // Dark container
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#333',
    },
    footer: {
        paddingHorizontal: spacing.lg,
        paddingBottom: Platform.OS === 'ios' ? 0 : spacing.lg,
        marginBottom: spacing.lg,
    },
    nextButton: {
        height: 56,
        backgroundColor: '#1A1A1A',
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    nextButtonDisabled: {
        opacity: 0.5,
    },
    nextButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default AvatarSelectionScreen;
