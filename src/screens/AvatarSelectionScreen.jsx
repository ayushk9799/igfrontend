import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
    InteractionManager,
    StatusBar,
    ScrollView,
    useWindowDimensions,
    Linking,
    AppState,
    BackHandler,
} from 'react-native';
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop, Text as SvgText } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import ExpoImageCropTool from 'expo-image-crop-tool';
import { ImageManipulator, FlipType, SaveFormat } from 'expo-image-manipulator';
import { Camera } from 'react-native-camera-kit';
import { useSelector } from 'react-redux';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';

import useAvatarUpload from '../hooks/useAvatarUpload';
import { selectUser } from '../store/slices/userSlice';
import { fontFamily, fontWeight } from '../constants/fonts';
import { translateUiText } from '../i18n/uiTranslation';

// --- SVG Icons ---
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
        <Path d="M12 17C14.7614 17 17 14.7614 17 12C17 9.23858 14.7614 7 12 7C9.23858 7 7 9.23858 7 12C7 14.7614 9.23858 17 12 17Z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M22 8V18C22 19.1046 21.1046 20 20 20H4C2.89543 20 2 19.1046 2 18V8C2 6.89543 2.89543 6 4 6H7.17157C7.70201 6 8.21071 5.78929 8.58579 5.41421L9.41421 4.58579C9.78929 4.21071 10.298 4 10.8284 4H13.1716C13.702 4 14.2107 4.21071 14.5858 4.58579L15.4142 5.41421C15.7893 5.78929 16.298 6 16.8284 6H20C21.1046 6 22 6.89543 22 8Z" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);

const CheckIconBig = () => (
    <Svg width={30} height={30} viewBox="0 0 24 24" fill="none">
        <Path d="M9 16.17L4.83 12L3.41 13.41L9 19L21 7L19.59 5.59L9 16.17Z" fill="#FF5E97" />
    </Svg>
);

const ReplaceIcon = () => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" fill="#FF5E97" />
    </Svg>
);

const AvatarSelectionScreen = ({ onComplete, onBack }) => {
    const { uploadAvatar, isUploading } = useAvatarUpload();
    const userData = useSelector(selectUser);
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions();
    const styles = useMemo(() => createStyles(width, height), [width, height]);
    const isNarrow = width < 380;
    const partnerTitle = translateUiText("for your partner.");
    const titleGlyphRatio = /[\u3000-\u9fff\uac00-\ud7af]/.test(partnerTitle) ? 1 : 0.58;
    const partnerTitleFontSize = Math.max(
        18,
        Math.min(isNarrow ? 25 : 29, (width - 64) / (partnerTitle.length * titleGlyphRatio))
    );

    // This screen renders the avatar at full card size, so prefer the full image.
    const existingAvatar = userData?.avatar || userData?.avatarThumbnail || null;

    const cameraRef = useRef(null);
    const isProcessingRef = useRef(false);
    const isUploadInFlightRef = useRef(false);
    const isPickerInFlightRef = useRef(false);
    const isMountedRef = useRef(true);
    const hasSyncedExistingAvatarRef = useRef(Boolean(existingAvatar));

    const [permissionStatus, setPermissionStatus] = useState('checking');
    const [permissionCanAskAgain, setPermissionCanAskAgain] = useState(true);
    const [previewUri, setPreviewUri] = useState(
        existingAvatar ? { uri: existingAvatar, isFrontCamera: false, isExisting: true } : null
    );
    const [cameraType, setCameraType] = useState('front');
    const [isCameraInitialized, setIsCameraInitialized] = useState(false);
    const [isPickingImage, setIsPickingImage] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false);
    const [isPreparingUpload, setIsPreparingUpload] = useState(false);

    const hasPermission = permissionStatus === 'granted';
    const isBusy = isUploading || isPickingImage || isCapturing || isPreparingUpload;

    useEffect(() => {
        isMountedRef.current = true;
        const task = InteractionManager.runAfterInteractions(() => {
            setIsCameraInitialized(true);
            checkCameraPermission();
        });
        return () => {
            isMountedRef.current = false;
            task.cancel();
        };
    }, []);

    useEffect(() => {
        if (hasSyncedExistingAvatarRef.current || !existingAvatar || previewUri) return;
        hasSyncedExistingAvatarRef.current = true;
        setPreviewUri({ uri: existingAvatar, isFrontCamera: false, isExisting: true });
    }, [existingAvatar, previewUri]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', nextState => {
            if (nextState === 'active') checkCameraPermission();
        });
        return () => subscription.remove();
    }, []);

    useEffect(() => {
        if (!onBack) return undefined;
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            if (isUploadInFlightRef.current || isPickerInFlightRef.current || isProcessingRef.current) {
                return true;
            }
            onBack();
            return true;
        });
        return () => subscription.remove();
    }, [onBack]);

    const checkCameraPermission = async () => {
        try {
            if (Platform.OS === 'ios') {
                const { status, canAskAgain } = await ImagePicker.getCameraPermissionsAsync();
                if (!isMountedRef.current) return;
                setPermissionStatus(status === 'granted' ? 'granted' : 'denied');
                setPermissionCanAskAgain(canAskAgain !== false);
                return;
            }
            const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
            if (!isMountedRef.current) return;
            setPermissionStatus(granted ? 'granted' : 'denied');
        } catch (error) {
            console.error('Failed to check camera permission:', error);
            if (isMountedRef.current) setPermissionStatus('denied');
        }
    };

    const requestCameraPermission = async () => {
        try {
            if (Platform.OS === 'ios') {
                if (!permissionCanAskAgain) {
                    await Linking.openSettings();
                    return;
                }
                const { status, canAskAgain } = await ImagePicker.requestCameraPermissionsAsync();
                const granted = status === 'granted';
                setPermissionStatus(granted ? 'granted' : 'denied');
                setPermissionCanAskAgain(canAskAgain !== false);
                if (!granted) showCameraPermissionAlert(canAskAgain !== false);
                return;
            }
            const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
            const granted = result === PermissionsAndroid.RESULTS.GRANTED;
            const canAskAgain = result !== PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;
            setPermissionStatus(granted ? 'granted' : 'denied');
            setPermissionCanAskAgain(canAskAgain);
            if (!granted) showCameraPermissionAlert(canAskAgain);
        } catch (error) {
            console.error('Failed to request camera permission:', error);
            Alert.alert(
                translateUiText("Error"),
                translateUiText("Camera access is needed to take your profile photo. You can still choose a photo from Gallery.")
            );
        }
    };

    const showCameraPermissionAlert = (canAskAgain) => {
        Alert.alert(
            translateUiText("Camera Permission Needed"),
            translateUiText("Camera access is needed to take your profile photo. You can still choose a photo from Gallery."),
            [
                { text: translateUiText("Cancel"), style: 'cancel' },
                canAskAgain
                    ? { text: translateUiText("Try Again"), onPress: requestCameraPermission }
                    : { text: translateUiText("Open Settings"), onPress: () => Linking.openSettings() },
            ]
        );
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
        setIsCapturing(true);

        try {
            if (!cameraRef.current) throw new Error('Camera is not ready yet');
            const data = await cameraRef.current.capture();
            const source = data?.uri || (data?.path ? `file://${data.path}` : null);
            if (!source) throw new Error('No image captured');

            const finalUri = source.startsWith('file://') ? source : `file://${source}`;

            setPreviewUri({
                uri: finalUri,
                isFrontCamera: cameraType === 'front',
                isExisting: false,
            });

        } catch (e) {
            console.error('Failed to capture avatar photo:', e);
            Alert.alert(translateUiText("Error"), translateUiText("Couldn’t take photo"));
        } finally {
            isProcessingRef.current = false;
            if (isMountedRef.current) setIsCapturing(false);
        }
    };

    const handlePickFromGallery = async () => {
        if (isPickerInFlightRef.current || isBusy) return;
        isPickerInFlightRef.current = true;
        setIsPickingImage(true);
        try {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
                Alert.alert(translateUiText("Photo Library Needed"), translateUiText("Photo library access is needed to choose a profile photo."));
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
                setPreviewUri({ uri: finalUri, isFrontCamera: false, isExisting: false });
            }
        } catch (e) {
            console.error('Failed to select an image:', e);
            Alert.alert(
                translateUiText("Error"),
                translateUiText("Could not open photos")
            );
        } finally {
            isPickerInFlightRef.current = false;
            if (isMountedRef.current) setIsPickingImage(false);
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
            if (!/cancel/i.test(e?.message || '')) {
                console.error('Failed to crop selected image:', e);
                Alert.alert(
                    translateUiText("Error"),
                    translateUiText("Could not load photo")
                );
            }
            return null;
        }
    };

    const getImageSize = useCallback((uri) => (
        new Promise((resolve, reject) => {
            Image.getSize(
                uri,
                (imageWidth, imageHeight) => resolve({ width: imageWidth, height: imageHeight }),
                reject
            );
        })
    ), []);

    const prepareImageForUpload = async ({ uri, isFrontCamera }) => {
        const { width: imageWidth, height: imageHeight } = await getImageSize(uri);
        const squareSize = Math.min(imageWidth, imageHeight);
        const context = ImageManipulator.manipulate(uri);
        context.crop({
            originX: Math.max(0, (imageWidth - squareSize) / 2),
            originY: Math.max(0, (imageHeight - squareSize) / 2),
            width: squareSize,
            height: squareSize,
        });
        if (isFrontCamera) context.flip(FlipType.Horizontal);
        if (squareSize > 1080) context.resize({ width: 1080, height: 1080 });
        const rendered = await context.renderAsync();
        const saved = await rendered.saveAsync({
            compress: 0.9,
            format: SaveFormat.JPEG,
        });
        return saved.uri;
    };

    const handleNext = async () => {
        if (!previewUri) {
            Alert.alert(translateUiText("Photo Required"), translateUiText("Please take a photo or select one from the gallery."));
            return;
        }
        await handleConfirmAvatar();
    };

    const handleConfirmAvatar = async () => {
        if (!previewUri || isUploading || isUploadInFlightRef.current) return;

        if (previewUri.isExisting) {
            onComplete();
            return;
        }

        isUploadInFlightRef.current = true;
        setIsPreparingUpload(true);
        try {
            const finalUploadUri = await prepareImageForUpload(previewUri);
            if (isMountedRef.current) setIsPreparingUpload(false);

            const result = await uploadAvatar({
                uri: finalUploadUri,
                fileName: `avatar_${Date.now()}.jpg`,
                mimeType: 'image/jpeg',
            });

            if (result.success) {
                onComplete();
            } else {
                Alert.alert(
                    translateUiText("Upload Failed"),
                    translateUiText(result.error || "Could not upload avatar"),
                );
            }
        } catch (error) {
            console.error('Avatar upload error:', error);
            Alert.alert(translateUiText("Error"), translateUiText("Failed to set profile picture"));
        } finally {
            isUploadInFlightRef.current = false;
            if (isMountedRef.current) setIsPreparingUpload(false);
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
                <View style={[styles.container, { paddingTop: insets.top + 10 }]}>

                    {/* Top Row: Brand Logo & Close Button */}
                    <View style={styles.topRowContainer}>
                        <Image
                            source={require('../../assets/images/penguin-text-logo.png')}
                            style={styles.brandLogo}
                            resizeMode="contain"
                        />
                        <View style={styles.headerActions}>
                            {onBack && (
                                <TouchableOpacity
                                    onPress={onBack}
                                    style={styles.headerButton}
                                    activeOpacity={0.85}
                                    disabled={isBusy}
                                    accessibilityRole="button"
                                    accessibilityLabel={translateUiText("Back")}
                                    accessibilityState={{ disabled: isBusy }}
                                >
                                    <Text style={styles.headerButtonText}>{translateUiText("Back")}</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                onPress={onComplete}
                                style={styles.headerButton}
                                activeOpacity={0.85}
                                disabled={isBusy}
                                accessibilityRole="button"
                                accessibilityLabel={translateUiText("Skip")}
                                accessibilityState={{ disabled: isBusy }}
                            >
                                <Text style={styles.headerButtonText}>{translateUiText("Skip")}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <ScrollView
                        style={styles.scrollView}
                        contentContainerStyle={[styles.contentCentered, { paddingBottom: insets.bottom + 20 }]}
                        showsVerticalScrollIndicator={false}
                        bounces={false}
                    >
                        {/* Centered Premium Title Block inspired by other onboarding screens */}
                        <View style={styles.titleBlock}>
                            <Text style={styles.titlePrimary}>{translateUiText("Add a photo")}</Text>
                            <Svg height={isNarrow ? 44 : 50} width={width - 40} style={styles.gradientTitle}>
                                <Defs>
                                    <SvgGradient id="titleGradAvatar" x1="0" y1="0" x2="1" y2="0">
                                        <Stop offset="0" stopColor="#FF435F" />
                                        <Stop offset="0.52" stopColor="#D34AA2" />
                                        <Stop offset="1" stopColor="#6756D8" />
                                    </SvgGradient>
                                </Defs>
                                <SvgText
                                    fill="url(#titleGradAvatar)"
                                    fontFamily={fontFamily.extraBold}
                                    fontSize={partnerTitleFontSize}
                                    fontWeight={fontWeight('700')}
                                    stroke="url(#titleGradAvatar)"
                                    strokeWidth={0.15}
                                    textAnchor="middle"
                                    x={(width - 40) / 2}
                                    y={isNarrow ? 31 : 36}
                                >{partnerTitle}</SvgText>
                            </Svg>
                            <View style={styles.titleDivider}>
                                <View style={styles.dividerLine} />
                                <Text style={styles.dividerHeart}>♡</Text>
                                <View style={styles.dividerLine} />
                            </View>
                        </View>

                        {/* Centered Section Label above the card */}
                        <Text style={styles.cardLabelText}>{translateUiText("profile photo")}</Text>

                        {/* Main Camera / Mascot Box */}
                        <View style={styles.cardContainer}>
                            <View style={[styles.dashedBox, (hasPermission || previewUri) && styles.dashedBoxHiddenBorder]}>

                                {/* Decorative Sparkles & Hearts */}
                                {!previewUri && !hasPermission && (
                                    <>
                                        <View style={[styles.decor, styles.decorLeftTop]}><SparkleIcon size={14} color="#FFA6C9" /></View>
                                        <View style={[styles.decor, styles.decorLeftUpper]}><DecorativeHeart size={20} color="#FF8FAB" /></View>
                                        <View style={[styles.decor, styles.decorLeftLower]}><SparkleIcon size={12} color="#FFA6C9" /></View>
                                        <View style={[styles.decor, styles.decorRightTop]}><SparkleIcon size={18} color="#FF8FAB" /></View>
                                        <View style={[styles.decor, styles.decorRightUpper]}><SparkleIcon size={10} color="#FFA6C9" /></View>
                                        <View style={[styles.decor, styles.decorRightMiddle]}><DecorativeHeart size={24} color="#FF8FAB" /></View>
                                        <View style={[styles.decor, styles.decorRightLower]}><SparkleIcon size={14} color="#FFA6C9" /></View>
                                    </>
                                )}

                                {permissionStatus === 'checking' && !previewUri ? (
                                    <View style={styles.permissionLoading}>
                                        <ActivityIndicator color="#FF5E97" size="large" />
                                        <Text style={styles.permissionPromptText}>{translateUiText("Checking camera access…")}</Text>
                                    </View>
                                ) : previewUri ? (
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
                                                resizeMode="cover"
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
                                        <Text style={styles.permissionPromptText}>{translateUiText("Camera access is needed")}</Text>
                                        <TouchableOpacity
                                            style={styles.grantButton}
                                            onPress={permissionCanAskAgain ? requestCameraPermission : () => Linking.openSettings()}
                                            activeOpacity={0.85}
                                            accessibilityRole="button"
                                            accessibilityLabel={permissionCanAskAgain
                                                ? translateUiText("Continue")
                                                : translateUiText("Open Settings")}
                                        >
                                            <LinearGradient
                                                colors={['#FF5E97', '#FFA1C9']}
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 0 }}
                                                style={styles.grantButtonGradient}
                                            >
                                                <CameraIconOutline color="#FFFFFF" />
                                                <Text style={styles.grantButtonText}>
                                                    {permissionCanAskAgain ? translateUiText("Continue") : translateUiText("Open Settings")}
                                                </Text>
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
                                <TouchableOpacity
                                    style={styles.smallCircleButton}
                                    onPress={handlePickFromGallery}
                                    disabled={isBusy}
                                    accessibilityRole="button"
                                    accessibilityLabel={translateUiText("Gallery")}
                                    accessibilityState={{ disabled: isBusy }}
                                >
                                    <GalleryIcon />
                                </TouchableOpacity>
                                <Text style={styles.controlLabel}>{translateUiText("Gallery")}</Text>
                            </View>

                            <View style={styles.controlItem}>
                                <TouchableOpacity
                                    style={[styles.captureRing, (!previewUri && !hasPermission) && styles.controlDisabled]}
                                    onPress={previewUri ? handleNext : handleCapture}
                                    disabled={(!previewUri && !hasPermission) || isBusy}
                                    accessibilityRole="button"
                                    accessibilityLabel={previewUri ? translateUiText("Done") : translateUiText("Take Photo")}
                                    accessibilityState={{ disabled: (!previewUri && !hasPermission) || isBusy, busy: isBusy }}
                                >
                                    <LinearGradient colors={['#FFB5D0', '#FF8FAB', '#FF5E97']} style={styles.captureRingGradient}>
                                        <View style={styles.captureInnerCircle}>
                                            {isUploading || isPreparingUpload ? (
                                                <ActivityIndicator color="#FF5E97" size="small" />
                                            ) : previewUri ? (
                                                <CheckIconBig />
                                            ) : null}
                                        </View>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.controlItem}>
                                <TouchableOpacity
                                    style={styles.smallCircleButton}
                                    onPress={previewUri ? () => setPreviewUri(null) : toggleCamera}
                                    disabled={isBusy}
                                    accessibilityRole="button"
                                    accessibilityLabel={previewUri ? translateUiText("Replace") : translateUiText("Flip")}
                                    accessibilityState={{ disabled: isBusy }}
                                >
                                    {previewUri ? <ReplaceIcon /> : <FlipIcon />}
                                </TouchableOpacity>
                                <Text style={styles.controlLabel}>{previewUri ? translateUiText("Replace") : translateUiText("Flip")}</Text>
                            </View>
                        </View>
                    </ScrollView>
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

const createStyles = (width, height) => {
    const isCompactHeight = height < 760;
    const cardSize = Math.min(width - 48, isCompactHeight ? 330 : 420);

    return StyleSheet.create({
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
    contentCentered: {
        flexGrow: 1,
        justifyContent: height > 700 ? 'center' : 'flex-start',
    },
    scrollView: {
        flex: 1,
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
        width: isCompactHeight ? 120 : 140,
        height: isCompactHeight ? 36 : 42,
        marginLeft: -14,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerButton: {
        minWidth: 46,
        minHeight: 34,
        paddingHorizontal: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerButtonText: {
        fontFamily: fontFamily.bold,
        fontSize: 14,
        fontWeight: fontWeight('700'),
        color: '#FF5E97',
    },
    titleBlock: {
        alignItems: 'center',
        marginTop: isCompactHeight ? 0 : 6,
    },
    titlePrimary: {
        color: '#050E3E',
        fontFamily: fontFamily.extraBold,
        fontSize: isCompactHeight ? 26 : 30,
        fontWeight: fontWeight('800'),
        textAlign: 'center',
        letterSpacing: 0.2,
    },
    gradientTitle: {
        marginTop: -6,
    },
    titleDivider: {
        marginTop: 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
        marginBottom: isCompactHeight ? 10 : 16,
    },
    dividerLine: {
        width: 62,
        height: 2,
        borderRadius: 1,
        backgroundColor: 'rgba(255, 143, 171, 0.34)',
    },
    dividerHeart: {
        color: '#FF6B82',
        fontFamily: fontFamily.regular,
        fontSize: 16,
        lineHeight: 18,
    },
    cardLabelText: {
        fontFamily: fontFamily.bold,
        fontSize: 13,
        fontWeight: fontWeight('700'),
        color: '#FF5E97',
        textAlign: 'center',
        marginBottom: isCompactHeight ? 8 : 12,
        textTransform: 'uppercase',
        letterSpacing: 1.5,
    },
    cardContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 36,
        padding: 12,
        width: cardSize,
        height: cardSize,
        alignSelf: 'center',
        shadowColor: '#FFB5D0',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 0,
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
    dashedBoxHiddenBorder: {
        borderWidth: 0,
    },
    decor: {
        position: 'absolute',
        zIndex: 1,
    },
    decorLeftTop: { top: '8%', left: '10%' },
    decorLeftUpper: { top: '30%', left: '4%' },
    decorLeftLower: { top: '55%', left: '8%' },
    decorRightTop: { top: '10%', right: '12%' },
    decorRightUpper: { top: '25%', right: '6%' },
    decorRightMiddle: { top: '45%', right: '3%' },
    decorRightLower: { top: '60%', right: '10%' },
    noPermissionContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingBottom: 20,
        paddingHorizontal: 16,
    },
    permissionLoading: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
    },
    mascotImage: {
        width: isCompactHeight ? 320 : 360,
        height: isCompactHeight ? 320 : 360,
        position: 'absolute',
        top: isCompactHeight ? '-24%' : '-18%',
        zIndex: 2,
    },
    permissionPromptText: {
        fontFamily: fontFamily.medium,
        fontSize: isCompactHeight ? 13 : 14,
        fontWeight: fontWeight('500'),
        color: '#7380A1',
        textAlign: 'center',
        marginBottom: 12,
        zIndex: 3,
    },
    grantButton: {
        width: '100%',
        height: isCompactHeight ? 44 : 48,
        borderRadius: 24,
        shadowColor: '#FF5E97',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 0,
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
        fontFamily: fontFamily.extraBold,
        color: '#FFFFFF',
        fontSize: isCompactHeight ? 14 : 15,
        fontWeight: fontWeight('800'),
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
        marginBottom: isCompactHeight ? 10 : 15,
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
        elevation: 0,
        marginBottom: 8,
    },
    controlLabel: {
        fontFamily: fontFamily.bold,
        fontSize: 13,
        fontWeight: fontWeight('600'),
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
        elevation: 0,
        marginBottom: 20,
    },
    controlDisabled: {
        opacity: 0.5,
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
        alignItems: 'center',
        justifyContent: 'center',
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
};

export default AvatarSelectionScreen;
