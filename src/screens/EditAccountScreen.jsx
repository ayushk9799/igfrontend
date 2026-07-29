import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    BackHandler,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { updateOnboardingProfile } from '../api/onboardingApi';
import { fontFamily, fontWeight } from '../constants/fonts';
import { translateUiText } from '../i18n/uiTranslation';
import { selectUser, updateUser as updateUserRedux } from '../store/slices/userSlice';
import { updateUser as updateUserStorage } from '../utils/authStorage';
import { useAvatarUpload } from '../hooks/useAvatarUpload';

const navy = '#050E3E';

const BackIcon = () => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path
            d="M15 18 9 12l6-6"
            stroke={navy}
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </Svg>
);

const CameraIcon = () => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path
            d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"
            stroke="#FFFFFF"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <Path d="M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" stroke="#FFFFFF" strokeWidth={2} />
    </Svg>
);

const EditAccountScreen = ({ onBack, onSaved, onDeleteAccount }) => {
    const user = useSelector(selectUser);
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const { uploadAvatar, isUploading } = useAvatarUpload();
    const saveInFlightRef = useRef(false);
    const mountedRef = useRef(true);

    const initialName = user?.name || '';
    const initialNickname = user?.nickname || '';
    const currentAvatar = user?.avatarThumbnail || user?.avatar || null;
    const [name, setName] = useState(initialName);
    const [nickname, setNickname] = useState(initialNickname);
    const [pendingAvatar, setPendingAvatar] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    const avatarSize = Math.min(144, Math.max(112, width * 0.34));
    const avatarStyles = useMemo(() => StyleSheet.create({
        frame: {
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarSize / 2,
        },
        image: {
            width: '100%',
            height: '100%',
            borderRadius: avatarSize / 2,
        },
    }), [avatarSize]);

    const displayAvatar = pendingAvatar?.uri || currentAvatar;
    const trimmedName = name.trim();
    const trimmedNickname = nickname.trim();
    const textHasChanges = trimmedName !== initialName || trimmedNickname !== initialNickname;
    const hasChanges = textHasChanges || !!pendingAvatar;
    const isBusy = isSaving || isUploading;

    useEffect(() => () => {
        mountedRef.current = false;
    }, []);

    const requestClose = () => {
        if (isBusy) return;
        if (!hasChanges) {
            onBack?.();
            return;
        }

        Alert.alert(
            translateUiText('Discard changes?'),
            translateUiText('Your unsaved profile changes will be lost.'),
            [
                { text: translateUiText('Keep editing'), style: 'cancel' },
                { text: translateUiText('Discard'), style: 'destructive', onPress: onBack },
            ],
        );
    };

    useEffect(() => {
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            requestClose();
            return true;
        });
        return () => subscription.remove();
    });

    const chooseAvatarSource = () => {
        if (isBusy) return;
        Alert.alert(
            translateUiText('Change profile picture'),
            translateUiText('Choose where your new photo should come from.'),
            [
                { text: translateUiText('Take Photo'), onPress: () => pickAvatar('camera') },
                { text: translateUiText('Choose Photo'), onPress: () => pickAvatar('library') },
                { text: translateUiText('Cancel'), style: 'cancel' },
            ],
        );
    };

    const pickAvatar = async (source) => {
        try {
            const permission = source === 'camera'
                ? await ImagePicker.requestCameraPermissionsAsync()
                : await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
                Alert.alert(
                    translateUiText('Permission needed'),
                    source === 'camera'
                        ? translateUiText('Camera access is needed to take a profile photo.')
                        : translateUiText('Photo library access is needed to choose a profile photo.'),
                );
                return;
            }

            const options = {
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.9,
            };
            const result = source === 'camera'
                ? await ImagePicker.launchCameraAsync(options)
                : await ImagePicker.launchImageLibraryAsync(options);
            if (result.canceled || !result.assets?.[0]?.uri || !mountedRef.current) return;

            const asset = result.assets[0];
            setPendingAvatar({
                uri: asset.uri,
                fileName: asset.fileName || `avatar_${Date.now()}.jpg`,
                mimeType: asset.mimeType || 'image/jpeg',
            });
        } catch (error) {
            console.error('Failed to select profile picture:', error);
            Alert.alert(
                translateUiText('Could not select photo'),
                translateUiText('Please try again.'),
            );
        }
    };

    const handleSave = async () => {
        if (saveInFlightRef.current || isBusy) return;
        if (!trimmedName || trimmedName.length > 80) {
            Alert.alert(
                translateUiText('Check your name'),
                translateUiText('Name must be between 1 and 80 characters.'),
            );
            return;
        }
        if (!trimmedNickname || trimmedNickname.length > 20) {
            Alert.alert(
                translateUiText('Check your nickname'),
                translateUiText('Nickname must be between 1 and 20 characters.'),
            );
            return;
        }

        const userId = user?.id || user?._id;
        if (!userId) {
            Alert.alert(translateUiText('Could not save profile'), translateUiText('Please sign in again.'));
            return;
        }

        saveInFlightRef.current = true;
        setIsSaving(true);
        try {
            if (pendingAvatar) {
                const uploadResult = await uploadAvatar(pendingAvatar);
                if (!uploadResult.success) {
                    throw new Error(uploadResult.error || translateUiText('Could not upload avatar'));
                }
                if (mountedRef.current) setPendingAvatar(null);
            }

            if (textHasChanges) {
                const response = await updateOnboardingProfile(userId, {
                    name: trimmedName,
                    nickname: trimmedNickname,
                });
                const updates = {
                    name: response.user?.name || trimmedName,
                    nickname: response.user?.nickname || trimmedNickname,
                };
                updateUserStorage(updates);
                dispatch(updateUserRedux(updates));
            }
            onSaved?.();
        } catch (error) {
            console.error('Failed to update account:', error);
            if (mountedRef.current) {
                Alert.alert(
                    translateUiText('Could not save profile'),
                    translateUiText(error?.message || 'Please try again.'),
                );
            }
        } finally {
            saveInFlightRef.current = false;
            if (mountedRef.current) setIsSaving(false);
        }
    };

    const handleDeleteAccount = () => {
        if (isBusy || !onDeleteAccount) return;
        Alert.alert(
            t('account.deleteAccount'),
            t('account.deleteAccountMessage'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.delete'),
                    style: 'destructive',
                    onPress: onDeleteAccount,
                },
            ],
        );
    };

    return (
        <View style={styles.root}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <LinearGradient
                colors={['#F8D9EC', '#FFF7FA', '#FFF4F7', '#F7D8F2']}
                locations={[0, 0.34, 0.72, 1]}
                start={{ x: 0.25, y: 0 }}
                end={{ x: 0.75, y: 1 }}
                style={StyleSheet.absoluteFill}
            />
            <KeyboardAvoidingView
                style={styles.root}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
                    <TouchableOpacity
                        style={styles.headerButton}
                        onPress={requestClose}
                        disabled={isBusy}
                        accessibilityRole="button"
                        accessibilityLabel={translateUiText('Back')}
                        accessibilityState={{ disabled: isBusy }}
                    >
                        <BackIcon />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{translateUiText('Edit Account')}</Text>
                    <View style={styles.headerButtonPlaceholder} />
                </View>

                <ScrollView
                    contentContainerStyle={[
                        styles.content,
                        { paddingBottom: insets.bottom + 24 },
                    ]}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.photoSection}>
                        <TouchableOpacity
                            onPress={chooseAvatarSource}
                            disabled={isBusy}
                            activeOpacity={0.82}
                            accessibilityRole="button"
                            accessibilityLabel={translateUiText('Change profile picture')}
                            accessibilityState={{ disabled: isBusy }}
                        >
                            <View style={[styles.avatarFrame, avatarStyles.frame]}>
                                {displayAvatar ? (
                                    <Image source={{ uri: displayAvatar }} style={avatarStyles.image} />
                                ) : (
                                    <LinearGradient
                                        colors={['#FFD1E3', '#FFA1C9']}
                                        style={[styles.avatarPlaceholder, avatarStyles.image]}
                                    >
                                        <Text style={styles.avatarInitial}>
                                            {(trimmedNickname || trimmedName || user?.email || '?')[0].toUpperCase()}
                                        </Text>
                                    </LinearGradient>
                                )}
                            </View>
                            <View style={styles.cameraBadge}>
                                <CameraIcon />
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={chooseAvatarSource} disabled={isBusy}>
                            <Text style={styles.changePhotoText}>
                                {isUploading
                                    ? translateUiText('Uploading photo…')
                                    : translateUiText('Change profile picture')}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.formCard}>
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>{translateUiText('Name')}</Text>
                            <TextInput
                                style={styles.input}
                                value={name}
                                onChangeText={setName}
                                placeholder={translateUiText('Your name')}
                                placeholderTextColor="#A4A9BA"
                                autoCapitalize="words"
                                autoCorrect={false}
                                maxLength={80}
                                editable={!isBusy}
                                returnKeyType="next"
                                accessibilityLabel={translateUiText('Name')}
                            />
                            <Text style={styles.counter}>{name.length}/80</Text>
                        </View>

                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>{translateUiText('Nickname')}</Text>
                            <TextInput
                                style={styles.input}
                                value={nickname}
                                onChangeText={setNickname}
                                placeholder={translateUiText('Your nickname')}
                                placeholderTextColor="#A4A9BA"
                                autoCapitalize="words"
                                maxLength={20}
                                editable={!isBusy}
                                returnKeyType="done"
                                onSubmitEditing={handleSave}
                                accessibilityLabel={translateUiText('Nickname')}
                            />
                            <Text style={styles.counter}>{nickname.length}/20</Text>
                            <Text style={styles.helperText}>
                                {translateUiText('This is the name your partner sees in the app.')}
                            </Text>
                        </View>

                        {!!user?.email && (
                            <View style={styles.emailRow}>
                                <Text style={styles.emailLabel}>{translateUiText('Account email')}</Text>
                                <Text style={styles.emailValue} numberOfLines={1}>{user.email}</Text>
                            </View>
                        )}
                    </View>

                    <TouchableOpacity
                        style={[styles.saveWrapper, (!hasChanges || isBusy) && styles.saveDisabled]}
                        onPress={handleSave}
                        disabled={!hasChanges || isBusy}
                        activeOpacity={0.86}
                        accessibilityRole="button"
                        accessibilityLabel={translateUiText('Save changes')}
                        accessibilityState={{ disabled: !hasChanges || isBusy, busy: isBusy }}
                    >
                        <LinearGradient
                            colors={['#FF5E97', '#FFA1C9']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.saveButton}
                        >
                            <Text style={styles.saveText}>
                                {isBusy ? translateUiText('Saving…') : translateUiText('Save changes')}
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    <View style={styles.deleteSection}>
                        <View style={styles.dangerZoneHeader}>
                            <Text style={styles.dangerZoneTitle}>
                                {translateUiText('Danger Zone')}
                            </Text>
                        </View>
                        <Text style={styles.dangerZoneMessage}>
                            {translateUiText('Deleting your account permanently removes your profile and cannot be undone.')}
                        </Text>
                        <TouchableOpacity
                            style={styles.deleteButton}
                            onPress={handleDeleteAccount}
                            disabled={isBusy || !onDeleteAccount}
                            activeOpacity={0.75}
                            accessibilityRole="button"
                            accessibilityLabel={t('account.deleteAccount')}
                            accessibilityState={{ disabled: isBusy || !onDeleteAccount }}
                        >
                            <Text style={styles.deleteButtonText}>{t('account.deleteAccount')}</Text>
                        </TouchableOpacity>
                        <Text style={styles.deleteDescription}>
                            {t('account.deleteAccountSubtitle')}
                        </Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
    header: {
        minHeight: 62,
        paddingHorizontal: 18,
        paddingBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 2,
    },
    headerButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.86)',
        borderWidth: 1,
        borderColor: '#F4D8E5',
    },
    headerButtonPlaceholder: {
        width: 44,
    },
    headerTitle: {
        color: navy,
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        fontSize: 20,
    },
    content: {
        paddingHorizontal: 24,
        paddingTop: 20,
    },
    photoSection: {
        alignItems: 'center',
        marginBottom: 26,
    },
    avatarFrame: {
        padding: 4,
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
        borderWidth: 3,
        borderColor: '#FFFFFF',
        shadowColor: '#D95C8D',
        shadowOffset: { width: 0, height: 7 },
        shadowOpacity: 0.2,
        shadowRadius: 14,
        elevation: 5,
    },
    avatarPlaceholder: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarInitial: {
        color: '#FFFFFF',
        fontSize: 44,
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
    },
    cameraBadge: {
        position: 'absolute',
        right: 3,
        bottom: 3,
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FF5E97',
        borderWidth: 3,
        borderColor: '#FFFFFF',
    },
    changePhotoText: {
        color: '#D83E78',
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
        fontSize: 14,
        marginTop: 13,
        paddingVertical: 6,
    },
    formCard: {
        padding: 18,
        borderRadius: 24,
        backgroundColor: 'rgba(255,255,255,0.82)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.92)',
        shadowColor: '#D48CAA',
        shadowOffset: { width: 0, height: 7 },
        shadowOpacity: 0.11,
        shadowRadius: 18,
        elevation: 3,
    },
    fieldGroup: {
        marginBottom: 20,
    },
    label: {
        color: navy,
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
        fontSize: 14,
        marginBottom: 8,
    },
    input: {
        minHeight: 52,
        borderWidth: 1.5,
        borderColor: '#EED7E2',
        borderRadius: 15,
        paddingHorizontal: 15,
        paddingRight: 54,
        color: navy,
        backgroundColor: '#FFFFFF',
        fontFamily: fontFamily.medium,
        fontWeight: fontWeight('600'),
        fontSize: 16,
    },
    counter: {
        position: 'absolute',
        right: 12,
        top: 46,
        color: '#9A91A0',
        fontSize: 11,
        fontWeight: fontWeight('600'),
    },
    helperText: {
        color: '#7380A1',
        fontSize: 12,
        fontWeight: fontWeight('500'),
        lineHeight: 17,
        marginTop: 7,
    },
    emailRow: {
        paddingTop: 15,
        borderTopWidth: 1,
        borderTopColor: '#F1DFE7',
    },
    emailLabel: {
        color: '#8D8393',
        fontSize: 11,
        fontWeight: fontWeight('700'),
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    emailValue: {
        color: navy,
        fontSize: 14,
        fontWeight: fontWeight('600'),
        marginTop: 5,
    },
    saveWrapper: {
        height: 52,
        borderRadius: 18,
        overflow: 'hidden',
        marginTop: 24,
        shadowColor: '#FF5E97',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.24,
        shadowRadius: 12,
        elevation: 4,
    },
    saveDisabled: {
        opacity: 0.5,
    },
    saveButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    saveText: {
        color: '#FFFFFF',
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        fontSize: 16,
    },
    deleteSection: {
        marginTop: 28,
        padding: 18,
        borderWidth: 1.5,
        borderColor: 'rgba(210, 55, 80, 0.38)',
        borderRadius: 20,
        backgroundColor: 'rgba(255, 241, 243, 0.88)',
    },
    dangerZoneHeader: {
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 9,
        backgroundColor: '#FAD8DE',
    },
    dangerZoneTitle: {
        color: '#AE263F',
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
        fontSize: 13,
        textTransform: 'uppercase',
        letterSpacing: 0.7,
    },
    dangerZoneMessage: {
        color: '#874F5A',
        fontSize: 13,
        lineHeight: 19,
        fontWeight: fontWeight('500'),
        marginTop: 12,
        marginBottom: 16,
    },
    deleteButton: {
        minHeight: 46,
        width: '100%',
        paddingHorizontal: 22,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 15,
        borderWidth: 1.5,
        borderColor: '#E15A70',
        backgroundColor: 'rgba(255,255,255,0.72)',
    },
    deleteButtonText: {
        color: '#C83750',
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
        fontSize: 14,
    },
    deleteDescription: {
        marginTop: 9,
        color: '#9A6571',
        fontSize: 12,
        lineHeight: 17,
        textAlign: 'center',
        fontWeight: fontWeight('500'),
    },
});

export default EditAccountScreen;
