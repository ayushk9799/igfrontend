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
    Dimensions,
    StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useAvatarUpload } from '../hooks/useAvatarUpload';
import { requestNotificationPermission, registerFCMToken } from '../utils/pushNotifications';
import { getApp } from '@react-native-firebase/app';
import { getMessaging, AuthorizationStatus } from '@react-native-firebase/messaging';
import { PermissionsAndroid } from 'react-native';

const { width, height } = Dimensions.get('window');
const isCompactHeight = height < 760;
const navy = '#050E3E';

// --- SVG Icons ---
const CrownIcon = ({ size = 20, color = '#FFB800' }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <Path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm0 3h14v2H5v-2z" />
    </Svg>
);

const ChevronRight = ({ color = '#FFB5D0' }) => (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d="M9 18l6-6-6-6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);

const CloseIcon = () => (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path d="M18 6L6 18M6 6l12 12" stroke="#050E3E" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);

const BellIcon = () => (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);

const CameraIcon = () => (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
        <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" stroke="#FFFFFF" strokeWidth={2} />
    </Svg>
);

const Sparkle = ({ x, y, size = 8, delay = 0 }) => {
    const opacity = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        const animate = Animated.loop(
            Animated.sequence([
                Animated.delay(delay),
                Animated.timing(opacity, { toValue: 0.7, duration: 1200, useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 0.1, duration: 1200, useNativeDriver: true }),
                Animated.delay(800),
            ]),
        );
        animate.start();
        return () => animate.stop();
    }, [opacity, delay]);
    return (
        <Animated.View style={{ position: 'absolute', left: x, top: y, opacity, zIndex: 1 }}>
            <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
                <Path d="M8 0C8 4.418 4.418 8 0 8C4.418 8 8 11.582 8 16C8 11.582 11.582 8 16 8C11.582 8 8 4.418 8 0Z" fill="#FFB5D0" />
            </Svg>
        </Animated.View>
    );
};

import { Animated } from 'react-native';

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
            <ChevronRight color={danger ? '#FF6B6B' : '#FFB5D0'} />
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
    onBack,
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
        <View style={styles.root}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <LinearGradient
                colors={['#F8D9EC', '#FFF7FA', '#FFF4F7', '#F7D8F2']}
                locations={[0, 0.34, 0.72, 1]}
                start={{ x: 0.25, y: 0 }}
                end={{ x: 0.75, y: 1 }}
                style={styles.gradient}
            >
                {/* Background sparkles */}
                <Sparkle x={width * 0.08} y={height * 0.06} size={7} delay={0} />
                <Sparkle x={width * 0.85} y={height * 0.12} size={9} delay={600} />
                <Sparkle x={width * 0.9} y={height * 0.4} size={7} delay={1200} />

                {onBack && (
                    <TouchableOpacity
                        style={[styles.closeButton, { top: insets.top + 10 }]}
                        onPress={onBack}
                        activeOpacity={0.7}
                    >
                        <CloseIcon />
                    </TouchableOpacity>
                )}

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={[
                        styles.scrollContent,
                        { paddingTop: insets.top + (onBack ? 64 : 16), paddingBottom: 100 }
                    ]}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Profile Header */}
                    <View style={styles.profileSection}>
                        <TouchableOpacity
                            style={styles.avatarContainer}
                            onPress={handleAvatarPress}
                            disabled={isUploading}
                            activeOpacity={0.8}
                        >
                            <View style={styles.avatarRing}>
                                {localAvatar ? (
                                    <Image
                                        source={{ uri: localAvatar }}
                                        style={styles.avatarImage}
                                    />
                                ) : (
                                    <LinearGradient
                                        colors={['#FFD1E3', '#FFA1C9']}
                                        style={styles.avatarPlaceholder}
                                    >
                                        <Text style={styles.avatarInitial}>
                                            {(userData.nickname || userData.email || '?')[0].toUpperCase()}
                                        </Text>
                                    </LinearGradient>
                                )}
                            </View>
                            {/* Camera edit badge */}
                            <View style={styles.avatarEditBadge}>
                                {isUploading ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <CameraIcon />
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
                            <View style={styles.partnerBadge}>
                                <Text style={styles.partnerBadgeText}>
                                    💕 With {partnerNickname || partnerName}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Premium Section */}
                    <View style={styles.menuSection}>
                        <Text style={styles.sectionTitle}>Premium</Text>
                        {isPremium ? (
                            <View style={styles.premiumCard}>
                                <View style={styles.premiumCardHeader}>
                                    <CrownIcon size={20} color="#FFB800" />
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
                            <LinearGradient
                                colors={['#FF5E97', '#FFA1C9']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.upgradePremiumGradient}
                            >
                                <TouchableOpacity
                                    style={styles.upgradePremiumInner}
                                    onPress={onNavigateToPremium}
                                    activeOpacity={0.85}
                                >
                                    <CrownIcon size={20} color="#FFFFFF" />
                                    <Text style={styles.upgradePremiumText}>Upgrade to Premium</Text>
                                    <Text style={styles.upgradePremiumArrow}>→</Text>
                                </TouchableOpacity>
                            </LinearGradient>
                        )}
                    </View>

                    {/* Notification Permission Button - only show when not granted */}
                    {!notificationEnabled && (
                        <View style={styles.menuSection}>
                            <Text style={styles.sectionTitle}>Notifications</Text>
                            <LinearGradient
                                colors={['#FF5E97', '#FFA1C9']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.allowNotifGradient}
                            >
                                <TouchableOpacity
                                    style={styles.allowNotifInner}
                                    onPress={handleAllowNotifications}
                                    activeOpacity={0.85}
                                >
                                    <BellIcon />
                                    <Text style={styles.allowNotifText}>Allow Notifications</Text>
                                    <Text style={styles.allowNotifArrow}>→</Text>
                                </TouchableOpacity>
                            </LinearGradient>
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

                {/* Bottom Clouds */}
                <View style={styles.cloudsContainer}>
                    <View style={[styles.cloud, styles.cloudOne]} />
                    <View style={[styles.cloud, styles.cloudTwo]} />
                    <View style={[styles.cloud, styles.cloudThree]} />
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
    scrollView: {
        flex: 1,
        zIndex: 2,
    },
    scrollContent: {
        paddingHorizontal: 24,
    },
    profileSection: {
        alignItems: 'center',
        marginBottom: isCompactHeight ? 20 : 30,
    },
    avatarContainer: {
        position: 'relative',
        marginBottom: 12,
    },
    avatarRing: {
        width: 100,
        height: 100,
        borderRadius: 50,
        padding: 3,
        borderWidth: 2,
        borderColor: '#FFB5D0',
        borderStyle: 'solid',
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
        borderRadius: 48,
    },
    avatarPlaceholder: {
        width: '100%',
        height: '100%',
        borderRadius: 48,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarInitial: {
        fontSize: 36,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    avatarEditBadge: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#FF5E97',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
        shadowColor: '#FF5E97',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
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
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    uploadProgressText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    profileNickname: {
        fontSize: 20,
        fontWeight: '800',
        color: navy,
        marginBottom: 4,
        letterSpacing: -0.3,
    },
    profileEmail: {
        fontSize: 13,
        color: '#7380A1',
        marginBottom: 10,
        fontWeight: '500',
    },
    partnerBadge: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        shadowColor: '#FFB5D0',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 3,
    },
    partnerBadgeText: {
        fontSize: 13,
        color: '#FF5E97',
        fontWeight: '700',
    },
    menuSection: {
        marginBottom: isCompactHeight ? 18 : 24,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#7380A1',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 10,
        marginLeft: 4,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        marginBottom: 8,
        shadowColor: '#FFB5D0',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 3,
    },
    menuContent: {
        flex: 1,
    },
    menuTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: navy,
    },
    menuTitleDanger: {
        color: '#FF6B6B',
    },
    menuSubtitle: {
        fontSize: 12,
        color: '#7380A1',
        marginTop: 2,
        fontWeight: '500',
    },
    versionText: {
        textAlign: 'center',
        fontSize: 12,
        color: '#C4ADBC',
        marginTop: 10,
        marginBottom: 20,
        fontWeight: '600',
    },
    // Premium section styles
    premiumCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 18,
        shadowColor: '#FFB5D0',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 5,
    },
    premiumCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    premiumCardTitle: {
        marginLeft: 10,
        fontSize: 16,
        fontWeight: '800',
        color: navy,
    },
    premiumCardDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    premiumCardLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#7380A1',
    },
    premiumCardValue: {
        fontSize: 14,
        fontWeight: '700',
        color: navy,
        marginTop: 2,
    },
    premiumCoupleSubtext: {
        fontSize: 12,
        color: '#7380A1',
        marginTop: 10,
        fontStyle: 'italic',
    },
    upgradePremiumGradient: {
        borderRadius: 20,
        shadowColor: '#FF5E97',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 5,
    },
    upgradePremiumInner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20,
    },
    upgradePremiumText: {
        flex: 1,
        marginLeft: 10,
        fontSize: 15,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    upgradePremiumArrow: {
        fontSize: 18,
        color: '#FFFFFF',
        fontWeight: '700',
    },
    allowNotifGradient: {
        borderRadius: 20,
        shadowColor: '#FF5E97',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 5,
    },
    allowNotifInner: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 20,
    },
    allowNotifText: {
        flex: 1,
        marginLeft: 10,
        fontSize: 15,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    allowNotifArrow: {
        fontSize: 18,
        color: '#FFFFFF',
        fontWeight: '700',
    },
    cloudsContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 150,
        zIndex: 1,
        pointerEvents: 'none',
    },
    cloud: {
        position: 'absolute',
        backgroundColor: '#FFFFFF',
        borderRadius: 100,
        opacity: 0.6,
    },
    cloudOne: {
        width: 120,
        height: 120,
        bottom: -60,
        left: -40,
    },
    cloudTwo: {
        width: 180,
        height: 180,
        bottom: -90,
        left: 60,
        opacity: 0.8,
    },
    cloudThree: {
        width: 150,
        height: 150,
        bottom: -70,
        right: -30,
    },
    closeButton: {
        position: 'absolute',
        left: 20,
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
        shadowColor: '#FFB5D0',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 3,
    },
});

export default AccountScreen;
