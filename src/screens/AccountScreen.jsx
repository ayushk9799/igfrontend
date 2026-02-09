// Account Screen - User profile and settings
import React, { useRef, useEffect, useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Image,
    Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import GradientBackground from '../components/GradientBackground';
import { colors, spacing, borderRadius } from '../theme';
import { useAvatarUpload } from '../hooks/useAvatarUpload';

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
                                <Text style={styles.premiumCardTitle}>You're Premium</Text>
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

                {/* Menu Items */}
                <View style={styles.menuSection}>
                    <Text style={styles.sectionTitle}>Settings</Text>
                    <MenuItem
                        title="Notifications"
                        subtitle="Manage push notifications"
                        onPress={() => { }}
                    />

                </View>



                <View style={styles.menuSection}>
                    <Text style={styles.sectionTitle}>Support</Text>
                    <MenuItem
                        title="Help & FAQ"
                        onPress={() => { }}
                    />
                    <MenuItem
                        title="Privacy Policy"
                        onPress={() => { }}
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
});

export default AccountScreen;
