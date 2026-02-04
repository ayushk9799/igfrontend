// Account Screen - User profile and settings
import React, { useRef, useEffect, useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import GradientBackground from '../components/GradientBackground';
import { colors, spacing, borderRadius } from '../theme';
import { useAvatarUpload } from '../hooks/useAvatarUpload';

// Settings menu item
const MenuItem = ({ icon, title, subtitle, onPress, danger = false }) => {
    return (
        <TouchableOpacity
            style={styles.menuItem}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={[styles.menuIcon, danger && styles.menuIconDanger]}>
                <Text style={styles.menuIconText}>{icon}</Text>
            </View>
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
    hasPartner = false,
    daysTogether = 0,
    onLogout,

    onEditProfile,
    onAvatarPress,
    onFindPartner,
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
        Alert.alert(
            'Log Out',
            'Are you sure you want to log out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Log Out',
                    style: 'destructive',
                    onPress: onLogout,
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
                                    {userData.gender === 'female' ? '👩' : '👨'}
                                </Text>
                            </LinearGradient>
                        )}
                        {/* Camera/Edit overlay */}
                        <View style={styles.avatarEditBadge}>
                            {isUploading ? (
                                <ActivityIndicator size="small" color={colors.surface} />
                            ) : (
                                <Text style={styles.avatarEditIcon}>📷</Text>
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
                    <Text style={styles.profileName}>{userData.name || 'You'}</Text>
                    {userData.nickname && (
                        <Text style={styles.profileNickname}>"{userData.nickname}"</Text>
                    )}
                    <Text style={styles.profileEmail}>{userData.email || ''}</Text>

                    {/* Connection Stats - Only show when paired */}
                    {hasPartner ? (
                        <View style={styles.statsCard}>
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{daysTogether}</Text>
                                <Text style={styles.statLabel}>Days Together</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>💕</Text>
                                <Text style={styles.statLabel}>With {partnerName}</Text>
                            </View>
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={styles.soloModeCard}
                            onPress={onFindPartner}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={[colors.primary + '20', colors.secondary + '15']}
                                style={StyleSheet.absoluteFill}
                            />
                            <Text style={styles.soloModeEmoji}>💝</Text>
                            <View style={styles.soloModeText}>
                                <Text style={styles.soloModeTitle}>Solo Mode</Text>
                                <Text style={styles.soloModeSubtitle}>Tap to find your partner</Text>
                            </View>
                            <Text style={styles.soloModeArrow}>→</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Menu Items */}
                <View style={styles.menuSection}>
                    <Text style={styles.sectionTitle}>Settings</Text>
                    <MenuItem
                        icon="👤"
                        title="Edit Profile"
                        subtitle="Change your name and photo"
                        onPress={onEditProfile}
                    />
                    <MenuItem
                        icon="🔔"
                        title="Notifications"
                        subtitle="Manage push notifications"
                        onPress={() => { }}
                    />
                    <MenuItem
                        icon="🎨"
                        title="Appearance"
                        subtitle="Theme and display settings"
                        onPress={() => { }}
                    />
                </View>

                <View style={styles.menuSection}>
                    <Text style={styles.sectionTitle}>Connection</Text>
                    {hasPartner ? (
                        <MenuItem
                            icon="💑"
                            title="Partner Settings"
                            subtitle={`Connected with ${partnerName}`}
                            onPress={() => { }}
                        />
                    ) : (
                        <MenuItem
                            icon="💝"
                            title="Find a Partner"
                            subtitle="Connect with your special someone"
                            onPress={onFindPartner}
                        />
                    )}
                    <MenuItem
                        icon="🔗"
                        title="Invite Link"
                        subtitle="Share your connection link"
                        onPress={() => { }}
                    />
                </View>

                <View style={styles.menuSection}>
                    <Text style={styles.sectionTitle}>Support</Text>
                    <MenuItem
                        icon="❓"
                        title="Help & FAQ"
                        onPress={() => { }}
                    />
                    <MenuItem
                        icon="📝"
                        title="Privacy Policy"
                        onPress={() => { }}
                    />
                    <MenuItem
                        icon="🚪"
                        title="Log Out"
                        onPress={handleLogout}
                        danger
                    />
                </View>

                <Text style={styles.versionText}>LoveNest v1.0.0</Text>
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
    },
    profileEmail: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: spacing.lg,
    },
    statsCard: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.borderLight,
        width: '100%',
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 28,
        fontWeight: '800',
        color: colors.primary,
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: colors.textSecondary,
        fontWeight: '600',
    },
    statDivider: {
        width: 1,
        backgroundColor: colors.glassBorder,
        marginHorizontal: spacing.md,
    },
    soloModeCard: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        borderRadius: borderRadius.xl,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: colors.primary + '30',
        overflow: 'hidden',
    },
    soloModeEmoji: {
        fontSize: 32,
        marginRight: spacing.md,
    },
    soloModeText: {
        flex: 1,
    },
    soloModeTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
    },
    soloModeSubtitle: {
        fontSize: 13,
        color: colors.textSecondary,
        marginTop: 2,
    },
    soloModeArrow: {
        fontSize: 20,
        color: colors.primary,
        fontWeight: '600',
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
    menuIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: colors.primarySoft,
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuIconDanger: {
        backgroundColor: colors.error + '20',
    },
    menuIconText: {
        fontSize: 20,
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
});

export default AccountScreen;
