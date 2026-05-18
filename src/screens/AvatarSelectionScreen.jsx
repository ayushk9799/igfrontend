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
    StatusBar,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import ExpoImageCropTool from 'expo-image-crop-tool';
import { ImageManipulator, FlipType, SaveFormat } from 'expo-image-manipulator';
import { Camera } from 'react-native-camera-kit';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';

import { spacing } from '../theme';
import useAvatarUpload from '../hooks/useAvatarUpload';
import { selectUser } from '../store/slices/userSlice';

const { width, height } = Dimensions.get('window');
const isCompactHeight = height < 760;
const navy = '#050E3E';

// --- SVG Icons ---
const CloseIcon = () => (
    <Svg width={12} height={12} viewBox="0 0 14 14" fill="none">
        <Path d="M13 1L1 13M1 1l12 12" stroke="#FF5E97" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);

const TinyHeart = ({ color = "#FFB5D0" }) => (
    <Svg width={14} height={12} viewBox="0 0 14 12" fill="none">
        <Path d="M7 12L6.0125 11.0825C2.4 7.755 0 5.5425 0 2.8425C0 0.81 1.575 -0.75 3.5 -0.75C4.585 -0.75 5.6175 -0.255 6.265 0.4425C6.545 0.705 6.7825 1.0125 7 1.3425C7.2175 1.0125 7.455 0.705 7.735 0.4425C8.3825 -0.255 9.415 -0.75 10.5 -0.75C12.425 -0.75 14 0.81 14 2.8425C14 5.5425 11.6 7.755 7.9875 11.09L7 12Z" fill={color} />
    </Svg>
);

const DecorativeHeart = ({ size = 24, color = "#FFB5D0" }) => (
    <Svg width={size} height={size * 0.875} viewBox="0 0 24 21" fill="none">
        <Path d="M12 21L10.3071 19.4708C4.11429 13.925 0 10.2375 0 5.7375C0 2.35 2.7 0 6 0C7.86 0 9.63 0.85 10.74 2.01667C11.22 2.45417 11.6271 2.96667 12 3.51667C12.3729 2.96667 12.78 2.45417 13.26 2.01667C14.37 0.85 16.14 0 18 0C21.3 0 24 2.35 24 5.7375C24 10.2375 19.8857 13.925 13.6929 19.4833L12 21Z" fill={color} />
    </Svg>
);

const SparkleIcon = ({ size = 16, color = "#FFB5D0" }) => (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
        <Path d="M8 0C8 4.418 4.418 8 0 8C4.418 8 8 11.582 8 16C8 11.582 11.582 8 16 8C11.582 8 8 4.418 8 0Z" fill={color} />
    </Svg>
);

const TitleBurst = () => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path d="M6 16L9 14" stroke="#FF8FAB" strokeWidth={2.5} strokeLinecap="round" />
        <Path d="M4 8L8 10" stroke="#FF8FAB" strokeWidth={2.5} strokeLinecap="round" />
        <Path d="M12 4L13 8" stroke="#FF8FAB" strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
);

const GalleryIcon = () => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path d="M21 19V5C21 3.9 20.1 3 19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19ZM8.5 13.5L11 16.51L14.5 12L19 18H5L8.5 13.5Z" fill="#FF5E97" />
    </Svg>
);

const FlipIcon = () => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path d="M12 4V1L8 5L12 9V6C15.31 6 18 8.69 18 12C18 13.01 17.75 13.97 17.3 14.8L18.76 16.26C19.54 15.03 20 13.57 20 12C20 7.58 16.42 4 12 4ZM12 18C8.69 18 6 15.31 6 12C6 10.99 6.25 10.03 6.7 9.2L5.24 7.74C4.46 8.97 4 10.43 4 12C4 16.42 7.58 20 12 20V23L16 19L12 15V18Z" fill="#FF5E97" />
    </Svg>
);

const CameraIconOutline = ({ color = "#FF5E97" }) => (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
        <Path d="M12 17C14.7614 17 17 14.7614 17 12C17 9.23858 14.7614 7 12 7C9.23858 7 7 9.23858 7 12C7 14.7614 9.23858 17 12 17Z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        <Path d="M22 8V18C22 19.1046 21.1046 20 20 20H4C2.89543 20 2 19.1046 2 18V8C2 6.89543 2.89543 6 4 6H7.17157C7.70201 6 8.21071 5.78929 8.58579 5.41421L9.41421 4.58579C9.78929 4.21071 10.298 4 10.8284 4H13.1716C13.702 4 14.2107 4.21071 14.5858 4.58579L15.4142 5.41421C15.7893 5.78929 16.298 6 16.8284 6H20C21.1046 6 22 6.89543 22 8Z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
);

const AvatarSelectionScreen = ({ onComplete }) => {
    const { uploadAvatar, isUploading } = useAvatarUpload();
    const userData = useSelector(selectUser);
    const insets = useSafeAreaInsets();

    const existingAvatar = userData?.avatarThumbnail || userData?.avatar || null;

    const cameraRef = useRef(null);
    const isProcessingRef = useRef(false);

    const [hasPermission, setHasPermission] = useState(false);
    const [previewUri, setPreviewUri] = useState(
        existingAvatar ? { uri: existingAvatar, isFrontCamera: false } : null
    );
    const [cameraType, setCameraType] = useState('front');
    const [isCameraInitialized, setIsCameraInitialized] = useState(false);

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
        if (!hasPermission) {
            requestCameraPermission();
            return;
        }
        setCameraType(prev => prev === 'back' ? 'front' : 'back');
    };

    const handleCapture = async () => {
        if (!hasPermission) {
            requestCameraPermission();
            return;
        }
        if (previewUri) {
            // Retake
            setPreviewUri(null);
            return;
        }

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

            const croppedUri = await handleCropImage(sourceUri);
            if (croppedUri) {
                const finalUri = croppedUri.startsWith('file://') ? croppedUri : `file://${croppedUri}`;
                setPreviewUri({ uri: finalUri, isFrontCamera: false });
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
                aspectRatio: 1, 
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
        if (!previewUri) {
            Alert.alert('Photo Required', 'Please take a photo or select one from the gallery.');
            return;
        }
        await handleConfirmAvatar();
    };

    const handleConfirmAvatar = async () => {
        if (!previewUri || isUploading) return;

        try {
            let finalUploadUri = previewUri.uri;
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

    return (
        <View style={styles.root}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <LinearGradient
                colors={['#F8D9EC', '#FFF7FA', '#FFF4F7', '#F7D8F2']}
                locations={[0, 0.34, 0.72, 1]}
                start={{ x: 0.25, y: 0 }}
                end={{ x: 0.75, y: 1 }}
                style={styles.gradient}
            >
                <View style={[styles.container, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 10 }]}>
                    
                    {/* Top Row: Brand Logo & Close Button */}
                    <View style={styles.topRowContainer}>
                        <Image 
                            source={require('../../assets/images/penguin-text-logo.png')} 
                            style={styles.brandLogo} 
                            resizeMode="contain" 
                        />
                        <TouchableOpacity onPress={onComplete} style={styles.closeButton}>
                            <CloseIcon />
                        </TouchableOpacity>
                    </View>

                    {/* Header */}
                    <View style={styles.headerContainer}>
                        <View style={styles.headerTextCol}>
                            <View style={styles.titleRow}>
                                <View style={styles.heartWrapper}>
                                    <TinyHeart />
                                </View>
                                <Text style={styles.title}>add a photo</Text>
                                <View style={styles.burstWrapper}>
                                    <TitleBurst />
                                </View>
                            </View>
                            <Text style={styles.subtitle}>
                                Let your partner see you
                            </Text>
                        </View>
                    </View>

                    {/* Main Camera / Mascot Box */}
                    <View style={styles.cardContainer}>
                        <View style={styles.dashedBox}>
                            
                            {/* Decorative Sparkles & Hearts */}
                            {!previewUri && !hasPermission && (
                                <>
                                    <View style={[styles.decor, { top: '8%', left: '10%' }]}><SparkleIcon size={14} color="#FFA6C9" /></View>
                                    <View style={[styles.decor, { top: '30%', left: '4%' }]}><DecorativeHeart size={20} color="#FF8FAB" /></View>
                                    <View style={[styles.decor, { top: '55%', left: '8%' }]}><SparkleIcon size={12} color="#FFA6C9" /></View>
                                    <View style={[styles.decor, { top: '10%', right: '12%' }]}><SparkleIcon size={18} color="#FF8FAB" /></View>
                                    <View style={[styles.decor, { top: '25%', right: '6%' }]}><SparkleIcon size={10} color="#FFA6C9" /></View>
                                    <View style={[styles.decor, { top: '45%', right: '3%' }]}><DecorativeHeart size={24} color="#FF8FAB" /></View>
                                    <View style={[styles.decor, { top: '60%', right: '10%' }]}><SparkleIcon size={14} color="#FFA6C9" /></View>
                                </>
                            )}

                            {previewUri ? (
                                <View style={styles.cameraWrapper}>
                                    <Image
                                        source={{ uri: previewUri.uri }}
                                        style={[
                                            styles.previewImage,
                                            previewUri.isFrontCamera && { transform: [{ scaleX: -1 }] }
                                        ]}
                                        resizeMode="cover"
                                    />
                                </View>
                            ) : hasPermission ? (
                                <View style={styles.cameraWrapper}>
                                    {isCameraInitialized && (
                                        <Camera
                                            ref={cameraRef}
                                            style={styles.camera}
                                            cameraType={cameraType}
                                            flashMode="auto"
                                        />
                                    )}
                                </View>
                            ) : (
                                // No Permission State
                                <View style={styles.noPermissionContent}>
                                    <Image 
                                        source={require('../../assets/images/camera-photo.png')} 
                                        style={styles.mascotImage} 
                                        resizeMode="contain" 
                                    />
                                    <View style={styles.permissionInfoBox}>
                                        <View style={styles.permissionIconCircle}>
                                            <CameraIconOutline color="#FF5E97" />
                                        </View>
                                        <View style={styles.permissionTextCol}>
                                            <Text style={styles.permissionTitle}>Camera access is needed</Text>
                                            <Text style={styles.permissionSubtitle}>to take your profile photo</Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity style={styles.grantButton} onPress={requestCameraPermission} activeOpacity={0.85}>
                                        <LinearGradient 
                                            colors={['#FF5E97', '#FFA1C9']} 
                                            start={{ x: 0, y: 0 }} 
                                            end={{ x: 1, y: 0 }} 
                                            style={styles.grantButtonGradient}
                                        >
                                            <CameraIconOutline color="#FFFFFF" />
                                            <Text style={styles.grantButtonText}>Grant Camera Access</Text>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </View>
                            )}

                        </View>
                    </View>

                    <View style={styles.spacer} />

                    {/* Bottom Controls */}
                    <View style={styles.controlsRow}>
                        <View style={styles.controlItem}>
                            <TouchableOpacity style={styles.smallCircleButton} onPress={handlePickFromGallery}>
                                <GalleryIcon />
                            </TouchableOpacity>
                            <Text style={styles.controlLabel}>Gallery</Text>
                        </View>

                        <View style={styles.controlItem}>
                            <TouchableOpacity style={styles.captureRing} onPress={handleCapture}>
                                <LinearGradient colors={['#FFB5D0', '#FF8FAB', '#FF5E97']} style={styles.captureRingGradient}>
                                    <View style={styles.captureInnerCircle} />
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.controlItem}>
                            <TouchableOpacity style={styles.smallCircleButton} onPress={toggleCamera}>
                                <FlipIcon />
                            </TouchableOpacity>
                            <Text style={styles.controlLabel}>Flip</Text>
                        </View>
                    </View>

                    {/* Footer Continue Button */}
                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[styles.continueButtonWrapper, (!previewUri && !hasPermission) && styles.continueButtonDisabled]}
                            onPress={handleNext}
                            disabled={!previewUri || isUploading}
                            activeOpacity={0.85}
                        >
                            <LinearGradient
                                colors={['#FF5E97', '#FFA1C9']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.continueButtonGradient}
                            >
                                {isUploading ? (
                                    <ActivityIndicator color="#FFFFFF" />
                                ) : (
                                    <View style={styles.continueButtonContent}>
                                        <Text style={[styles.continueButtonText, (!previewUri && !hasPermission) && styles.continueButtonTextDisabled]}>
                                            Continue →
                                        </Text>
                                    </View>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Bottom Clouds background decoration */}
                <View style={styles.cloudsContainer}>
                    <View style={[styles.cloud, styles.cloudOne]} />
                    <View style={[styles.cloud, styles.cloudTwo]} />
                    <View style={[styles.cloud, styles.cloudThree]} />
                    <View style={[styles.cloud, styles.cloudFour]} />
                </View>

            </LinearGradient>
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    gradient: {
        flex: 1,
    },
    container: {
        flex: 1,
        zIndex: 2,
    },
    topRowContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        marginTop: isCompactHeight ? 0 : 5,
        marginBottom: 10,
    },
    brandLogo: {
        width: isCompactHeight ? 100 : 120,
        height: isCompactHeight ? 30 : 36,
        marginLeft: -10,
    },
    headerContainer: {
        paddingHorizontal: 24,
        marginBottom: isCompactHeight ? 15 : 25,
    },
    headerTextCol: {
        flex: 1,
        alignItems: 'flex-start',
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#FFB5D0',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        position: 'relative',
    },
    heartWrapper: {
        position: 'absolute',
        top: -6,
        left: 22,
    },
    burstWrapper: {
        position: 'absolute',
        top: -10,
        right: -20,
        transform: [{ scale: 0.8 }],
    },
    title: {
        fontSize: 26,
        fontWeight: '800',
        color: navy,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 14,
        color: '#7380A1',
        marginTop: 4,
        fontWeight: '500',
    },
    cardContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 36,
        padding: 12,
        marginHorizontal: 24,
        shadowColor: '#FFB5D0',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 6,
        height: isCompactHeight ? 380 : 440,
    },
    dashedBox: {
        flex: 1,
        borderWidth: 2,
        borderColor: '#FFD1E3',
        borderStyle: 'dashed',
        borderRadius: 24,
        overflow: 'hidden',
        position: 'relative',
    },
    decor: {
        position: 'absolute',
        zIndex: 1,
    },
    noPermissionContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingBottom: 20,
        paddingHorizontal: 16,
    },
    mascotImage: {
        width: 400,
        height: 400,
        position: 'absolute',
        top: '-10%',
        zIndex: 2,
    },
    permissionInfoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF5F8',
        borderWidth: 1,
        borderColor: '#FFE0EE',
        borderStyle: 'dashed',
        borderRadius: 16,
        padding: 12,
        width: '100%',
        marginBottom: 16,
        zIndex: 3,
    },
    permissionIconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
        shadowColor: '#FFB5D0',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
    },
    permissionTextCol: {
        flex: 1,
    },
    permissionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: navy,
    },
    permissionSubtitle: {
        fontSize: 13,
        color: '#7380A1',
        marginTop: 2,
    },
    grantButton: {
        width: '100%',
        height: isCompactHeight ? 44 : 48,
        borderRadius: 24,
        shadowColor: '#FF5E97',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 5,
        zIndex: 3,
    },
    grantButtonGradient: {
        flex: 1,
        borderRadius: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    grantButtonText: {
        color: '#FFFFFF',
        fontSize: isCompactHeight ? 16 : 18,
        fontWeight: '800',
        marginLeft: 8,
    },
    cameraWrapper: {
        flex: 1,
        borderRadius: 22,
        overflow: 'hidden',
    },
    camera: {
        flex: 1,
    },
    previewImage: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    spacer: {
        height: isCompactHeight ? 10 : 24,
    },
    controlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 30,
        marginBottom: isCompactHeight ? 20 : 30,
    },
    controlItem: {
        alignItems: 'center',
    },
    smallCircleButton: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#FFB5D0',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 4,
        marginBottom: 8,
    },
    controlLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#7380A1',
    },
    captureRing: {
        width: 84,
        height: 84,
        borderRadius: 42,
        shadowColor: '#FF5E97',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 5,
        marginBottom: 20,
    },
    captureRingGradient: {
        flex: 1,
        borderRadius: 42,
        alignItems: 'center',
        justifyContent: 'center',
    },
    captureInnerCircle: {
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: '#FFFFFF',
    },
    footer: {
        paddingHorizontal: 24,
        marginBottom: isCompactHeight ? 10 : 20,
    },
    continueButtonWrapper: {
        width: '100%',
        height: isCompactHeight ? 44 : 48,
        borderRadius: 24,
        overflow: 'hidden',
        shadowColor: '#FF5E97',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 5,
    },
    continueButtonGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    continueButtonDisabled: {
        opacity: 0.45,
    },
    continueButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    continueButtonText: {
        fontSize: isCompactHeight ? 16 : 18,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    continueButtonTextDisabled: {
        color: 'rgba(255, 255, 255, 0.7)',
    },
    cloudsContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 90,
        zIndex: 1,
        flexDirection: 'row',
        pointerEvents: 'none',
    },
    cloud: {
        position: 'absolute',
        backgroundColor: 'rgba(255, 255, 255, 0.75)',
    },
    cloudOne: {
        width: 180,
        height: 180,
        borderRadius: 90,
        bottom: -100,
        left: -50,
    },
    cloudTwo: {
        width: 240,
        height: 240,
        borderRadius: 120,
        bottom: -130,
        left: 50,
    },
    cloudThree: {
        width: 200,
        height: 200,
        borderRadius: 100,
        bottom: -110,
        right: 30,
    },
    cloudFour: {
        width: 160,
        height: 160,
        borderRadius: 80,
        bottom: -85,
        right: -50,
    },
});

export default AvatarSelectionScreen;
