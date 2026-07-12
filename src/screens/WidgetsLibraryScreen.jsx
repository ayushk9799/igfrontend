import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    AppState,
    Linking,
    Modal,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDispatch } from 'react-redux';
import Svg, { Path } from 'react-native-svg';
import LottieView from 'lottie-react-native';
import { colors } from '../theme';
import { isLocationSettingsError, syncDistanceWidgetLocation } from '../utils/distanceWidgetSync';
import { reportWidgetIntent, syncNativeWidgetStatus } from '../api/widgetStatusApi';
import { updateUser } from '../store/slices/userSlice';

const DUMMY_TIME_TOGETHER_SECONDS = (1954 * 86400) + (11 * 3600) + (44 * 60) + 12;

const BackIcon = () => (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
        <Path d="M15 18 9 12l6-6" stroke="#2E1E3C" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);

const HeartIcon = ({ color = '#FF8AA7', size = 24 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
        <Path d="M12 21s-7.2-4.35-9.55-8.2C.54 9.66 1.32 5.83 4.6 4.53 7.1 3.54 9.53 4.5 12 7.15c2.47-2.65 4.9-3.61 7.4-2.62 3.28 1.3 4.06 5.13 2.15 8.27C19.2 16.65 12 21 12 21z" />
    </Svg>
);

const BrushIcon = () => (
    <Svg width={25} height={25} viewBox="0 0 24 24" fill="none">
        <Path d="M9.8 17.2 21 6a2.12 2.12 0 0 0-3-3L6.8 14.2" stroke="#FF758F" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M7 14c-2.4.25-4 1.9-4 4.15C3 20.25 4.75 22 6.85 22 9.1 22 10.75 20.4 11 18" stroke="#8B5CF6" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
);

const Avatar = ({ label, variant = 'pink', style }) => (
    <View style={[styles.avatar, variant === 'lavender' && styles.avatarLavender, style]}>
        <Text style={styles.avatarText}>{label}</Text>
    </View>
);

const TimeTogetherWidget = () => {
    const [elapsed, setElapsed] = useState(DUMMY_TIME_TOGETHER_SECONDS);

    useEffect(() => {
        const interval = setInterval(() => {
            setElapsed(previous => previous + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const values = useMemo(() => {
        return {
            days: Math.floor(elapsed / 86400),
            hr: Math.floor((elapsed % 86400) / 3600),
            min: Math.floor((elapsed % 3600) / 60),
            sec: elapsed % 60,
        };
    }, [elapsed]);

    return (
        <View style={styles.timeWidgetPreview}>
            <View style={styles.timeWidgetHeader}>
                <Text style={styles.timeWidgetHeaderText}>together for</Text>
                <HeartIcon color="#FFFFFF" size={13} />
            </View>
            <View style={styles.timeRows}>
                <TimeBlock value={values.days} label="days" />
                <TimeBlock value={String(values.hr).padStart(2, '0')} label="hr" />
                <TimeBlock value={String(values.min).padStart(2, '0')} label="min" />
                <TimeBlock value={String(values.sec).padStart(2, '0')} label="sec" />
            </View>
        </View>
    );
};

const TimeBlock = ({ value, label }) => (
    <View style={styles.timeBlock}>
        <Text style={styles.timeValue} numberOfLines={1}>{value}</Text>
        <Text style={styles.timeLabel}>{label}</Text>
    </View>
);

const LockDaysCard = ({ days }) => (
    <View style={styles.lockWidgetTile}>
        <LinearGradient colors={['#FFB8CF', '#BCA7FF', '#95D8FF']} style={styles.lockPhonePreview}>
            <Text style={styles.lockMockDate}>Tue 9 Jun</Text>
            <Text style={styles.lockMockTime}>11:44</Text>
            <View style={styles.accessoryCircle}>
                <HeartIcon size={16} color="#FFFFFF" />
                <Text style={styles.circleDaysNumber}>{days}</Text>
                <Text style={styles.circleDaysLabel}>days</Text>
            </View>
        </LinearGradient>
        <Text style={styles.widgetTileName}>Days Together</Text>
    </View>
);

const LockCountdownCard = () => (
    <View style={styles.lockWidgetTileWide}>
        <LinearGradient colors={['#B9A7FF', '#FF9EBD', '#8ED8FF']} style={styles.lockPhonePreviewWide}>
            <Text style={styles.lockMockDateWide}>Tue 9 Jun</Text>
            <Text style={styles.lockMockTimeWide}>11:44</Text>
            <View style={styles.accessoryRect}>
                <TimeTogetherWidget />
            </View>
        </LinearGradient>
        <Text style={styles.widgetTileName}>Time Together</Text>
    </View>
);

const MiniDoubleHeart = ({ style }) => (
    <Animated.View style={[styles.miniHeartWrap, style]}>
        <View style={[styles.miniHeart, styles.miniHeartBack]}>
            <HeartIcon size={14} color="rgba(255,255,255,0.92)" />
        </View>
        <View style={[styles.miniHeart, styles.miniHeartFront]}>
            <HeartIcon size={17} color="#FFFFFF" />
        </View>
    </Animated.View>
);

const AnimatedDistanceAccessory = () => {
    const animationProgress = React.useRef(new Animated.Value(0)).current;
    const [distanceText, setDistanceText] = useState('Our distance: 1,000 km');

    useEffect(() => {
        const id = animationProgress.addListener(({ value }) => {
            const steps = [
                'Our distance: 1,000 km',
                'Our distance: 700 km',
                'Our distance: 500 km',
                'Our distance: 300 km',
                'Our distance: 100 km',
                'Our distance: 50 km',
                "We're together!"
            ];
            const idx = Math.min(steps.length - 1, Math.floor(value * steps.length));
            setDistanceText(steps[idx]);
        });

        const startAnimation = () => {
            animationProgress.setValue(0);
            Animated.sequence([
                // Hold at 1,000 km distance state
                Animated.delay(2000),
                // Smooth transition (slide and fade)
                Animated.timing(animationProgress, {
                    toValue: 1,
                    duration: 3500,
                    useNativeDriver: false,
                }),
                // Hold at together state
                Animated.delay(3000),
                // Smooth transition back
                Animated.timing(animationProgress, {
                    toValue: 0,
                    duration: 3000,
                    useNativeDriver: false,
                }),
            ]).start(() => {
                startAnimation();
            });
        };

        startAnimation();

        return () => {
            animationProgress.stopAnimation();
            animationProgress.removeListener(id);
        };
    }, [animationProgress]);

    // Interpolations for left avatar sliding right
    const leftTranslate = animationProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 24],
    });

    // Interpolations for right avatar sliding left
    const rightTranslate = animationProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -24],
    });

    // Animate container width: shrinking from 70px to 22px
    const dotsWidth = animationProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [70, 22],
    });

    // Animate container left: shifting from 34px to 58px to stay centered
    const dotsLeft = animationProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [34, 58],
    });

    // Animate inner SVG left: offset by negative parent left so it stays fixed in screen coordinates
    const svgLeft = animationProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [-34, -58],
    });

    return (
        <View style={styles.distanceAccessoryRect}>
            {/* Title Container */}
            <View style={styles.distanceTitleContainer}>
                <Text style={styles.distanceAccessoryTitle}>
                    {distanceText}
                </Text>
            </View>

            {/* Row with dotted line, sliding avatars and double heart */}
            <View style={styles.distanceAccessoryRow}>
                <Animated.View style={[
                    styles.distanceAccessoryDots,
                    {
                        left: dotsLeft,
                        width: dotsWidth,
                        height: 34,
                        overflow: 'hidden',
                        opacity: 0.9,
                    }
                ]}>
                    <Animated.View style={{
                        position: 'absolute',
                        left: svgLeft,
                        width: 138,
                        height: 34,
                    }}>
                        <Svg width="138" height={34} viewBox="0 0 138 34">
                            <Path
                                d="M34 17H104"
                                stroke="#FFFFFF"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeDasharray="1 2.5"
                            />
                        </Svg>
                    </Animated.View>
                </Animated.View>

                {/* Left Avatar */}
                <Animated.View style={[
                    styles.distanceMiniAvatar,
                    styles.distanceMiniAvatarLeft,
                    { transform: [{ translateX: leftTranslate }] }
                ]}>
                    <Text style={styles.distanceMiniAvatarText}>R</Text>
                </Animated.View>

                {/* Double Heart */}
                <MiniDoubleHeart />

                {/* Right Avatar */}
                <Animated.View style={[
                    styles.distanceMiniAvatar,
                    styles.distanceMiniAvatarRight,
                    { transform: [{ translateX: rightTranslate }] }
                ]}>
                    <Text style={styles.distanceMiniAvatarText}>?</Text>
                </Animated.View>
            </View>
        </View>
    );
};

const LockDistanceCard = ({ onPress, isEnabled, isPremium }) => (
    <TouchableOpacity style={styles.lockWidgetTileFull} onPress={onPress} activeOpacity={0.85}>
        <LinearGradient colors={['#D4B3FF', '#9CCBFF', '#FFB3C8']} style={styles.lockPhonePreviewWide}>
            <Text style={styles.lockMockDateWide}>Tue 9 Jun</Text>
            <Text style={styles.lockMockTimeWide}>11:44</Text>
            <AnimatedDistanceAccessory />
        </LinearGradient>
        <Text style={styles.widgetTileName}>Our Distance</Text>
        <Text style={[styles.widgetPermissionHint, isEnabled && isPremium && styles.widgetPermissionEnabled]}>
            {!isPremium ? 'Premium widget' : (isEnabled ? 'Location sharing active ✓' : 'Requires location permission')}
        </Text>
    </TouchableOpacity>
);

const DaysTogetherCard = ({ days }) => (
    <View style={styles.daysTogetherCard}>
        <LinearGradient
            colors={['rgba(255,117,143,0.22)', 'rgba(139,92,246,0.2)', 'rgba(255,255,255,0.4)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
        />
        <View style={styles.daysLeftPane}>
            <View style={styles.daysAvatars}>
                <Avatar label="R" />
                <Avatar label="?" variant="lavender" style={styles.overlapAvatar} />
            </View>
            <Text style={styles.daysTogetherNumber}>{days} days</Text>
            <Text style={styles.daysTogetherText}>together</Text>
        </View>
    </View>
);

const ScribbleCard = () => (
    <View style={styles.lockWidgetTile}>
        <View style={styles.scribbleCard}>
            <LottieView
                source={require('../../assets/canvas.lottie')}
                autoPlay
                loop
                style={styles.scribbleCardLottie}
            />
        </View>
        <Text style={styles.widgetTileName}>Scribble</Text>
        <Text style={styles.widgetDescription}>Send doodles to home screen</Text>
    </View>
);

export const WidgetsLibraryScreen = ({
    userData = {},
    isPremium = false,
    onBack,
    onNavigateToPremium,
}) => {
    const insets = useSafeAreaInsets();
    const dispatch = useDispatch();
    const retryLocationSyncOnActiveRef = useRef(false);
    const relationshipStartDate = userData.relationshipStartDate ||
        userData.pendingRelationshipStartDate ||
        userData.connectionDate;
    const primaryWidgetSectionTitle = Platform.OS === 'ios' ? 'Lock screen' : 'Home screen';
    const showSeparateHomeSectionTitle = Platform.OS === 'ios';

    const daysTogether = useMemo(() => {
        const start = relationshipStartDate ? new Date(relationshipStartDate) : null;
        if (!start || Number.isNaN(start.getTime())) {
            return 0;
        }
        return Math.max(0, Math.floor((Date.now() - start.getTime()) / 86400000));
    }, [relationshipStartDate]);

    const [locationSyncing, setLocationSyncing] = useState(false);
    const [distanceModalVisible, setDistanceModalVisible] = useState(false);
    const [customAlert, setCustomAlert] = useState(null);

    const handleConfirmLocation = useCallback(async () => {
        if (locationSyncing) return;
        setLocationSyncing(true);
        const isAlreadyEnabled = userData?.locationSharingEnabled === true;
        try {
            const result = await syncDistanceWidgetLocation({
                user: userData,
                enableSharing: true,
                enableBackgroundUpdates: true,
            });
            if (result?.user) {
                dispatch(updateUser(result.user));
            }
            setDistanceModalVisible(false);
            if (result?.backgroundUpdatesError && ['ios', 'android'].includes(Platform.OS)) {
                Alert.alert(
                    'Allow Always Location',
                    result.backgroundUpdatesError.message || 'Background distance updates need Location set to Always in Settings.',
                    [
                        { text: 'Later', style: 'cancel' },
                        {
                            text: 'Open Settings',
                            onPress: () => {
                                retryLocationSyncOnActiveRef.current = true;
                                Linking.openSettings();
                            },
                        },
                    ]
                );
                return;
            }
            if (result?.skipped) {
                setCustomAlert({
                    title: 'Location Saved',
                    message: 'Your initials have been saved to the widget. Full distance tracking requires location access.',
                    type: 'info',
                });
            } else {
                setCustomAlert({
                    title: isAlreadyEnabled ? 'Location Synced ✓' : 'Location Enabled ✓',
                    message: isAlreadyEnabled
                        ? 'Your latest coordinates have been synced and the widget updated!'
                        : 'Distance widget is now active! Add it to your lock screen.',
                    type: 'success',
                });
            }
        } catch (error) {
            setDistanceModalVisible(false);
            if (isLocationSettingsError(error)) {
                Alert.alert(
                    'Location Permission Needed',
                    error?.message || 'Please enable location access in Settings.',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        {
                            text: 'Open Settings',
                            onPress: () => {
                                retryLocationSyncOnActiveRef.current = true;
                                Linking.openSettings();
                            },
                        },
                    ]
                );
                return;
            }
            setCustomAlert({
                title: 'Could Not Enable',
                message: error?.message || 'Failed to enable location sharing. Please try again.',
                type: 'error',
            });
        } finally {
            setLocationSyncing(false);
        }
    }, [dispatch, userData, locationSyncing]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextState) => {
            if (nextState !== 'active' || !retryLocationSyncOnActiveRef.current) {
                return;
            }

            retryLocationSyncOnActiveRef.current = false;
            handleConfirmLocation();
        });

        return () => subscription.remove();
    }, [handleConfirmLocation]);

    const handleEnableDistance = useCallback(() => {
        if (!isPremium) {
            if (onNavigateToPremium) {
                onNavigateToPremium();
            } else {
                setCustomAlert({
                    title: 'Premium Widget',
                    message: 'Our Distance is available for premium couples.',
                    type: 'info',
                });
            }
            return;
        }

        reportWidgetIntent('distance', userData).catch(() => {});
        syncNativeWidgetStatus(userData).catch(() => {});

        if (userData?.locationSharingEnabled === true) {
            handleConfirmLocation();
        } else {
            setDistanceModalVisible(true);
        }
    }, [isPremium, onNavigateToPremium, userData, handleConfirmLocation]);

    return (
        <View style={styles.root}>
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <LinearGradient
                colors={['#FFF6F6', '#FFF0F5', '#F5F3FF', '#EAF7FF']}
                locations={[0, 0.38, 0.72, 1]}
                start={{ x: 0.08, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={styles.gradient}
            >
                <ScrollView
                    contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 34 }]}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.header}>
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={onBack}
                            activeOpacity={0.8}
                        >
                            <BackIcon />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.sectionTitle}>{primaryWidgetSectionTitle}</Text>
                    <View style={styles.widgetGrid}>
                        <LockDaysCard days={daysTogether} />
                        <LockCountdownCard />
                        <LockDistanceCard
                            onPress={handleEnableDistance}
                            isEnabled={userData?.locationSharingEnabled === true}
                            isPremium={isPremium}
                        />
                    </View>

                    {showSeparateHomeSectionTitle && (
                        <Text style={[styles.sectionTitle, styles.homeTitle]}>Home screen</Text>
                    )}
                    <View style={styles.widgetGrid}>
                        <ScribbleCard />
                    </View>
                </ScrollView>
            </LinearGradient>

            {/* Distance Permission Modal */}
            <Modal
                visible={distanceModalVisible}
                transparent
                animationType="fade"
                statusBarTranslucent
                onRequestClose={() => !locationSyncing && setDistanceModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <LinearGradient
                            colors={['#D4B3FF', '#9CCBFF', '#FFB3C8']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.modalIconCircle}
                        >
                            <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                                <Path
                                    d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"
                                    fill="#FFFFFF"
                                />
                            </Svg>
                        </LinearGradient>

                        <Text style={styles.modalTitle}>Enable Location Sharing</Text>
                        <Text style={styles.modalBody}>
                            To show the distance between you and your partner on your lock screen widget, we need access to your location.
                        </Text>
                        <Text style={styles.modalNote}>
                            Your partner will also need to enable this for the widget to work.
                        </Text>

                        <TouchableOpacity
                            style={styles.modalEnableButton}
                            onPress={handleConfirmLocation}
                            activeOpacity={0.85}
                            disabled={locationSyncing}
                        >
                            <LinearGradient
                                colors={['#C084FC', '#8B5CF6']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.modalEnableGradient}
                            >
                                {locationSyncing ? (
                                    <ActivityIndicator color="#FFFFFF" size="small" />
                                ) : (
                                    <Text style={styles.modalEnableText}>Enable Location</Text>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.modalCancelButton}
                            onPress={() => setDistanceModalVisible(false)}
                            activeOpacity={0.7}
                            disabled={locationSyncing}
                        >
                            <Text style={styles.modalCancelText}>Not Now</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Custom Alert Modal */}
            <Modal
                visible={customAlert !== null}
                transparent
                animationType="fade"
                statusBarTranslucent
                onRequestClose={() => setCustomAlert(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        {customAlert?.type === 'success' && (
                            <LinearGradient
                                colors={['#56C596', '#329D9C']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.modalIconCircle}
                            >
                                <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                                    <Path
                                        d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"
                                        fill="#FFFFFF"
                                    />
                                </Svg>
                            </LinearGradient>
                        )}
                        {customAlert?.type === 'info' && (
                            <LinearGradient
                                colors={['#FFB3C8', '#FF758F']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.modalIconCircle}
                            >
                                <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                                    <Path
                                        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"
                                        fill="#FFFFFF"
                                    />
                                </Svg>
                            </LinearGradient>
                        )}
                        {customAlert?.type === 'error' && (
                            <LinearGradient
                                colors={['#FF7B7B', '#FF4E50']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.modalIconCircle}
                            >
                                <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                                    <Path
                                        d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"
                                        fill="#FFFFFF"
                                    />
                                </Svg>
                            </LinearGradient>
                        )}

                        <Text style={styles.modalTitle}>{customAlert?.title}</Text>
                        <Text style={styles.modalBody}>{customAlert?.message}</Text>

                        <TouchableOpacity
                            style={styles.modalEnableButton}
                            onPress={() => setCustomAlert(null)}
                            activeOpacity={0.85}
                        >
                            <LinearGradient
                                colors={
                                    customAlert?.type === 'success'
                                        ? ['#56C596', '#329D9C']
                                        : customAlert?.type === 'info'
                                        ? ['#FFB3C8', '#FF758F']
                                        : ['#FF7B7B', '#FF4E50']
                                }
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.modalEnableGradient}
                            >
                                <Text style={styles.modalEnableText}>Got it</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: colors.background,
    },
    gradient: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    backButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        marginRight: 12,
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderWidth: 1,
        borderColor: '#F7DDEA',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#FFB5D0',
        shadowOpacity: 0.12,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 10,
        elevation: 3,
    },
    content: {
        paddingHorizontal: 20,
    },
    sectionTitle: {
        marginBottom: 10,
        color: colors.textSecondary,
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    homeTitle: {
        marginTop: 26,
        marginBottom: 10,
    },
    subsectionTitle: {
        marginTop: 4,
        marginBottom: 10,
        color: colors.text,
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 0,
    },
    subsectionTitleAfterShelf: {
        marginTop: 26,
    },
    horizontalShelf: {
        paddingRight: 4,
        gap: 10,
    },
    widgetGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 4,
    },
    lockWidgetTile: {
        width: '42%',
        padding: 8,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.82)',
        borderWidth: 1,
        borderColor: 'rgba(255,117,143,0.16)',
        shadowColor: '#FFB5D0',
        shadowOpacity: 0.12,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 14,
        elevation: 3,
    },
    lockWidgetTileWide: {
        width: '54%',
        padding: 8,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.82)',
        borderWidth: 1,
        borderColor: 'rgba(192,132,252,0.16)',
        shadowColor: '#C084FC',
        shadowOpacity: 0.12,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 14,
        elevation: 3,
    },
    lockWidgetTileFull: {
        width: '100%',
        padding: 8,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.82)',
        borderWidth: 1,
        borderColor: 'rgba(192,132,252,0.16)',
        shadowColor: '#C084FC',
        shadowOpacity: 0.12,
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 14,
        elevation: 3,
    },
    lockPhonePreview: {
        height: 170,
        borderRadius: 16,
        overflow: 'hidden',
        alignItems: 'center',
        paddingTop: 12,
    },
    lockPhonePreviewWide: {
        height: 170,
        borderRadius: 16,
        overflow: 'hidden',
        alignItems: 'center',
        paddingTop: 12,
    },
    lockMockDate: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '800',
    },
    lockMockTime: {
        marginTop: 1,
        color: 'rgba(255,255,255,0.92)',
        fontSize: 36,
        fontWeight: '900',
        letterSpacing: 0,
        lineHeight: 41,
    },
    lockMockDateWide: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '800',
    },
    lockMockTimeWide: {
        marginTop: 1,
        color: 'rgba(255,255,255,0.92)',
        fontSize: 48,
        fontWeight: '900',
        letterSpacing: 0,
        lineHeight: 54,
    },
    widgetTileName: {
        marginTop: 8,
        color: colors.text,
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0,
    },
    accessoryCircle: {
        marginTop: 7,
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: 'rgba(46,30,60,0.38)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.24)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    circleDaysNumber: {
        marginTop: 1,
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 0,
    },
    circleDaysLabel: {
        color: 'rgba(255,255,255,0.86)',
        fontSize: 8,
        fontWeight: '800',
    },
    accessoryRect: {
        marginTop: 1,
        width: 154,
        minHeight: 44,
        borderRadius: 13,
        backgroundColor: 'rgba(46,30,60,0.36)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.24)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    distanceAccessoryRect: {
        marginTop: 1,
        width: 154,
        minHeight: 48,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
        paddingVertical: 6,
    },
    distanceAccessoryTitle: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0,
    },
    distanceTitleContainer: {
        height: 16,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    distanceTitleAbsolute: {
        position: 'absolute',
    },
    distanceAccessoryRow: {
        marginTop: 4,
        width: 138,
        height: 34,
        alignItems: 'center',
        justifyContent: 'center',
    },
    distanceAccessoryDots: {
        position: 'absolute',
        left: 0,
        top: 0,
    },
    distanceMiniAvatar: {
        position: 'absolute',
        top: 0,
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(255,255,255,0.18)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.35)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    distanceMiniAvatarLeft: {
        left: 0,
    },
    distanceMiniAvatarRight: {
        right: 0,
    },
    distanceMiniAvatarText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '900',
        letterSpacing: 0,
    },
    miniHeartWrap: {
        position: 'absolute',
        top: 7,
        left: '50%',
        marginLeft: -11,
        width: 22,
        height: 19,
    },
    miniHeart: {
        position: 'absolute',
        shadowColor: '#000000',
        shadowOpacity: 0.28,
        shadowOffset: { width: 0, height: 1 },
        shadowRadius: 3,
        elevation: 2,
    },
    miniHeartBack: {
        left: 9,
        top: -3,
    },
    miniHeartFront: {
        left: 0,
        top: 1,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFF4F8',
        borderWidth: 2,
        borderColor: '#FFD0DE',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarLavender: {
        backgroundColor: '#F3EAFF',
        borderColor: '#DDC4FF',
    },
    avatarText: {
        color: colors.primary,
        fontSize: 16,
        fontWeight: '900',
    },
    timeWidgetPreview: {
        minWidth: 130,
        alignItems: 'center',
    },
    timeWidgetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginBottom: 4,
    },
    timeWidgetHeaderText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '800',
    },
    timeRows: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'center',
        gap: 6,
    },
    timeBlock: {
        alignItems: 'center',
        minWidth: 27,
    },
    timeValue: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 0,
        lineHeight: 17,
    },
    timeLabel: {
        marginTop: 1,
        color: 'rgba(255,255,255,0.82)',
        fontSize: 8,
        fontWeight: '800',
    },
    overlapAvatar: {
        marginLeft: -8,
    },
    daysTogetherCard: {
        width: '57%',
        height: 128,
        borderRadius: 18,
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.14)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.18)',
        flexDirection: 'row',
    },
    daysLeftPane: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    daysAvatars: {
        flexDirection: 'row',
        marginBottom: 7,
    },
    daysTogetherNumber: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: 0,
    },
    daysTogetherText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '900',
        letterSpacing: 0,
    },

    scribbleCard: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.88)',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    scribbleCardLottie: {
        width: '88%',
        height: '88%',
    },
    widgetPermissionHint: {
        marginTop: 2,
        color: '#8B5CF6',
        fontSize: 9,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    widgetPermissionEnabled: {
        color: '#10B981',
    },
    widgetDescription: {
        marginTop: 2,
        color: '#766F9B',
        fontSize: 9,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(30, 15, 40, 0.55)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 30,
    },
    modalCard: {
        width: '100%',
        maxWidth: 320,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        alignItems: 'center',
        paddingTop: 28,
        paddingBottom: 20,
        paddingHorizontal: 24,
        shadowColor: '#8B5CF6',
        shadowOpacity: 0.18,
        shadowOffset: { width: 0, height: 12 },
        shadowRadius: 28,
        elevation: 12,
    },
    modalIconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        color: '#2E1E3C',
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: 0,
        marginBottom: 10,
        textAlign: 'center',
    },
    modalBody: {
        color: '#5A4670',
        fontSize: 13,
        fontWeight: '500',
        lineHeight: 19,
        textAlign: 'center',
        marginBottom: 8,
    },
    modalNote: {
        color: '#9B8AAE',
        fontSize: 11,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 22,
    },
    modalEnableButton: {
        width: '100%',
        height: 48,
        borderRadius: 14,
        overflow: 'hidden',
        marginBottom: 10,
    },
    modalEnableGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalEnableText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    modalCancelButton: {
        paddingVertical: 10,
        alignItems: 'center',
    },
    modalCancelText: {
        color: '#9B8AAE',
        fontSize: 14,
        fontWeight: '700',
    },
});

export default WidgetsLibraryScreen;
