// Account Screen - User profile and settings
import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Image,
    Alert,
    Platform,
    Linking,
    AppState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import GradientBackground from '../components/GradientBackground';
import { colors, spacing, borderRadius } from '../theme';
import { useAvatarUpload } from '../hooks/useAvatarUpload';
import { requestNotificationPermission, registerFCMToken } from '../utils/pushNotifications';
import { getApp } from '@react-native-firebase/app';
import { getMessaging, AuthorizationStatus } from '@react-native-firebase/messaging';
import { PermissionsAndroid } from 'react-native';

// Crown icon component for premium badge
const CrownIcon = ({ size = 20, color = colors.accentGold }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <Path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm0 3h14v2H5v-2z" />
    </Svg>
);

// Settings menu item
const MenuItem = ({ title, subtitle, onPress, danger = false }) => {
    return (
        <TouchableOpacity
            style={styles.menuItem}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={styles.menuContent}>
                <Text style={[styles.menuTitle, danger && styles.menuTitleDanger]}>
                    {title}
                </Text>
                {subtitle && (
                    <Text style={styles.menuSubtitle}>{subtitle}</Text>
                )}
            </View>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path
                    d="M9 18l6-6-6-6"
                    stroke={danger ? colors.error : colors.textMuted}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </Svg>
        </TouchableOpacity>
    );
};

export const AccountScreen = ({
    userData = {},
    partnerName = null,
    partnerNickname = null,
    hasPartner = false,
    isPremium = false,
    premiumPlan = null,
    premiumExpiresAt = null,
    premiumSource = null,
    onLogout,
    onAvatarPress,
    onFindPartner,
    onDeleteAccount,
    onNavigateToPremium,
}) => {
    const insets = useSafeAreaInsets();

    const [localAvatar, setLocalAvatar] = useState(userData.avatarThumbnail || userData.avatar || null);
    const { isUploading, uploadProgress, error, uploadAvatar, clearError } = useAvatarUpload();

    useEffect(() => {
        // Prefer thumbnail for fast loading, fallback to full avatar URL
        setLocalAvatar(userData.avatarThumbnail || userData.avatar || null);
    }, [userData.avatarThumbnail, userData.avatar]);

    // Notification permission state
    const [notificationEnabled, setNotificationEnabled] = useState(true); // default true to hide button until checked

    const checkNotificationPermission = useCallback(async () => {
        try {
            if (Platform.OS === 'ios') {
                const messaging = getMessaging(getApp());
                const status = await messaging.hasPermission();
                setNotificationEnabled(
                    status === AuthorizationStatus.AUTHORIZED ||
                    status === AuthorizationStatus.PROVISIONAL
                );
            } else if (Platform.OS === 'android' && Platform.Version >= 33) {
                const result = await PermissionsAndroid.check(
                    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
                );
                setNotificationEnabled(result);
            } else {
                setNotificationEnabled(true);
            }
        } catch (e) {
        }
    }, []);

    useEffect(() => {
        checkNotificationPermission();
        const subscription = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'active') {
                checkNotificationPermission();
            }
        });
        return () => subscription.remove();
    }, [checkNotificationPermission]);

    const handleAllowNotifications = async () => {
        const granted = await requestNotificationPermission();
        if (granted) {
            setNotificationEnabled(true);
            // Register FCM token with backend now that permission is granted
            await registerFCMToken();
        } else {
            // Permission previously denied — guide user to settings
            Alert.alert(
                'Notifications Disabled',
                'Please enable notifications in your device settings to stay connected.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Open Settings',
                        onPress: () => {
                            if (Platform.OS === 'ios') {
                                Linking.openURL('app-settings:');
                            } else {
                                Linking.openSettings();
                            }
                        },
                    },
                ]
            );
        }
    };



    // Handle avatar selection via parent navigation
    const handleAvatarPress = () => {
        if (onAvatarPress) {
            onAvatarPress();
        }
    };

    const handleLogout = () => {
        // Directly logout without confirmation
        if (onLogout) {
            onLogout();
        }
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            'Delete Account',
            'Are you sure you want to permanently delete your account? This action cannot be undone and all your data will be lost.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        if (onDeleteAccount) {
                            onDeleteAccount();
                        }
                    },
                },
            ]
        );
    };

    return (
        <GradientBackground variant="warm">
            <ScrollView
                style={styles.container}
                contentContainerStyle={[
                    styles.scrollContent,
                    { paddingTop: insets.top + spacing.lg, paddingBottom: 100 }
                ]}
                showsVerticalScrollIndicator={false}
            >
                {/* Profile Header */}
                <View
                    style={styles.profileSection}
                >
                    <TouchableOpacity
                        style={styles.avatarContainer}
                        onPress={handleAvatarPress}
                        disabled={isUploading}
                        activeOpacity={0.8}
                    >
                        {localAvatar ? (
                            <Image
                                source={{ uri: localAvatar }}
                                style={styles.avatarImage}
                            />
                        ) : (
                            <LinearGradient
                                colors={[colors.primary + '30', colors.secondary + '20']}
                                style={styles.avatarLarge}
                            >
                                <Text style={styles.avatarEmoji}>
                                    {userData.gender === 'female' ? 'F' : 'M'}
                                </Text>
                            </LinearGradient>
                        )}
                        {/* Camera/Edit overlay */}
                        <View style={styles.avatarEditBadge}>
                            {isUploading ? (
                                <ActivityIndicator size="small" color={colors.surface} />
                            ) : (
                                <Text style={styles.avatarEditIcon}>+</Text>
                            )}
                        </View>
                        {/* Upload progress overlay */}
                        {isUploading && (
                            <View style={styles.uploadProgressOverlay}>
                                <Text style={styles.uploadProgressText}>
                                    {Math.round(uploadProgress)}%
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    {userData.nickname && (
                        <Text style={styles.profileNickname}>{userData.nickname}</Text>
                    )}
                    <Text style={styles.profileEmail}>{userData.email || ''}</Text>

                    {/* Partner Info - Only show when paired */}
                    {hasPartner && (
                        <Text style={styles.partnerText}>
                            With {partnerNickname || partnerName}
                        </Text>
                    )}
                </View>

                {/* Premium Section */}
                <View style={styles.menuSection}>
                    <Text style={styles.sectionTitle}>Premium</Text>
                    {isPremium ? (
                        <View style={styles.premiumCard}>
                            <View style={styles.premiumCardHeader}>
                                <CrownIcon size={20} color={colors.accentGold} />
                                <Text style={styles.premiumCardTitle}>
                                    {premiumSource === 'partner' ? 'Couple Premium ✨' : "You're Premium"}
                                </Text>
                            </View>
                            <View style={styles.premiumCardDetails}>
                                <View>
                                    <Text style={styles.premiumCardLabel}>Plan</Text>
                                    <Text style={styles.premiumCardValue}>
                                        {premiumPlan ? (premiumPlan.includes('month') ? 'Monthly' : premiumPlan.includes('six') ? '6 Month' : 'Active') : 'Active'}
                                    </Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={styles.premiumCardLabel}>Renews</Text>
                                    <Text style={styles.premiumCardValue}>
                                        {premiumExpiresAt ? new Date(premiumExpiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Active'}
                                    </Text>
                                </View>
                            </View>
                            {premiumSource === 'partner' && (
                                <Text style={styles.premiumCoupleSubtext}>
                                    Premium through your partner's subscription
                                </Text>
                            )}
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={styles.upgradePremiumButton}
                            onPress={onNavigateToPremium}
                            activeOpacity={0.8}
                        >
                            <View style={styles.upgradePremiumContent}>
                                <CrownIcon size={20} color="#FFFFFF" />
                                <Text style={styles.upgradePremiumText}>Upgrade to Premium</Text>
                                <Text style={styles.upgradePremiumArrow}>→</Text>
                            </View>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Notification Permission Button - only show when not granted */}
                {!notificationEnabled && (
                    <View style={styles.menuSection}>
                        <Text style={styles.sectionTitle}>Notifications</Text>
                        <TouchableOpacity
                            style={styles.allowNotifButton}
                            onPress={handleAllowNotifications}
                            activeOpacity={0.8}
                        >
                            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                                <Path
                                    d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"
                                    stroke="#FFFFFF"
                                    strokeWidth={2}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </Svg>
                            <Text style={styles.allowNotifText}>Allow Notifications</Text>
                            <Text style={styles.allowNotifArrow}>→</Text>
                        </TouchableOpacity>
                    </View>
                )}



                <View style={styles.menuSection}>
                    <Text style={styles.sectionTitle}>Support</Text>
                    <MenuItem
                        title="Help & FAQ"
                        onPress={() => { }}
                    />
                    <MenuItem
                        title="Privacy Policy"
                        onPress={() => Linking.openURL('https://ayushk9799.github.io/penguin-legal/privacy-policy.html')}
                    />
                    <MenuItem
                        title="Terms of Service"
                        onPress={() => Linking.openURL('https://ayushk9799.github.io/penguin-legal/terms-of-service.html')}
                    />
                    <MenuItem
                        title="Log Out"
                        onPress={handleLogout}
                        danger
                    />
                    <MenuItem
                        title="Delete Account"
                        subtitle="Permanently delete your account"
                        onPress={handleDeleteAccount}
                        danger
                    />
                </View>

                <Text style={styles.versionText}>penguin</Text>
            </ScrollView>
        </GradientBackground>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: spacing.lg,
    },
    profileSection: {
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    avatarLarge: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    avatarEmoji: {
        fontSize: 48,
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: spacing.md,
    },
    avatarImage: {
        width: 100,
        height: 100,
        borderRadius: 50,
    },
    avatarEditBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: colors.surface,
    },
    avatarEditIcon: {
        fontSize: 14,
    },
    uploadProgressOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    uploadProgressText: {
        color: colors.surface,
        fontSize: 16,
        fontWeight: '700',
    },
    profileName: {
        fontSize: 24,
        fontWeight: '800',
        color: colors.text,
        marginBottom: 4,
    },
    profileNickname: {
        fontSize: 15,
        fontWeight: '600',
        color: colors.textSecondary,
        fontStyle: 'italic',
        marginBottom: 4,
        letterSpacing: -0.5
    },
    profileEmail: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: spacing.lg,
    },
    partnerText: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: spacing.md,
    },
    menuSection: {
        marginBottom: spacing.xl,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: spacing.md,
        marginLeft: spacing.xs,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.borderLight,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.borderLight,
    },

    menuContent: {
        flex: 1,
        marginLeft: spacing.md,
    },
    menuTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
    },
    menuTitleDanger: {
        color: colors.error,
    },
    menuSubtitle: {
        fontSize: 13,
        color: colors.textSecondary,
        marginTop: 2,
    },
    versionText: {
        textAlign: 'center',
        fontSize: 12,
        color: colors.textMuted,
        marginTop: spacing.lg,
        marginBottom: spacing.xl,
    },
    // Premium section styles
    premiumCard: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.accentGold + '40',
        backgroundColor: colors.accentSoft,
    },
    premiumCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
    premiumCardTitle: {
        marginLeft: spacing.sm,
        fontSize: 16,
        fontWeight: '800',
        color: colors.text,
    },
    premiumCardDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    premiumCardLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.textMuted,
    },
    premiumCardValue: {
        fontSize: 14,
        fontWeight: '700',
        color: colors.text,
        marginTop: 2,
    },
    premiumCoupleSubtext: {
        fontSize: 12,
        color: colors.textSecondary,
        marginTop: spacing.sm,
        fontStyle: 'italic',
    },
    upgradePremiumButton: {
        borderRadius: borderRadius.lg,
        overflow: 'hidden',
        backgroundColor: colors.primary,
    },
    upgradePremiumContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
    },
    upgradePremiumText: {
        flex: 1,
        marginLeft: spacing.sm,
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    upgradePremiumArrow: {
        fontSize: 20,
        color: '#FFFFFF',
        fontWeight: '700',
    },
    allowNotifButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary,
        borderRadius: borderRadius.lg,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
    },
    allowNotifText: {
        flex: 1,
        marginLeft: spacing.sm,
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    allowNotifArrow: {
        fontSize: 20,
        color: '#FFFFFF',
        fontWeight: '700',
    },
});

export default AccountScreen;
