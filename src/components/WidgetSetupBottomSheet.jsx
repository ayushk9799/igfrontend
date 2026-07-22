import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { GestureHandlerRootView, PanGestureHandler, State } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { fontFamily, fontWeight } from '../constants/fonts';

const ActionButton = ({ children, onPress, disabled = false, secondary = false }) => (
    <TouchableOpacity
        activeOpacity={0.86}
        disabled={disabled}
        onPress={onPress}
        style={[styles.actionButton, secondary && styles.secondaryButton, disabled && styles.disabledButton]}
    >
        {secondary ? (
            <Text style={styles.secondaryButtonText}>{children}</Text>
        ) : (
            <LinearGradient colors={['#FF699C', '#A66DE1']} style={styles.actionGradient}>
                {disabled ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.actionButtonText}>{children}</Text>}
            </LinearGradient>
        )}
    </TouchableOpacity>
);

const LocationPreview = ({ enabled, statusLabel }) => (
    <View style={styles.locationPreview}>
        <View style={[styles.initialBubble, styles.initialBubblePink]}><Text style={styles.initialText}>A</Text></View>
        <View style={styles.routeLine} />
        <View style={styles.pinCircle}>
            <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
                <Path d="M12 22s7-7.75 7-13a7 7 0 1 0-14 0c0 5.25 7 13 7 13Z" fill="#F45C91" />
                <Circle cx="12" cy="9" r="2.5" fill="#FFFFFF" />
            </Svg>
        </View>
        <View style={styles.routeLine} />
        <View style={[styles.initialBubble, styles.initialBubblePurple]}><Text style={styles.initialText}>B</Text></View>
        <View style={[styles.statusPill, enabled && styles.statusPillEnabled]}>
            <View style={[styles.statusDot, enabled && styles.statusDotEnabled]} />
            <Text style={styles.statusPillText}>{statusLabel || (enabled ? 'Location is on' : 'Not active')}</Text>
        </View>
    </View>
);

const PermissionRow = ({ icon, label, complete = false }) => (
    <View style={styles.permissionRow}>
        <View style={[styles.permissionIcon, complete && styles.permissionIconComplete]}>
            <Text style={styles.permissionIconText}>{complete ? '✓' : icon}</Text>
        </View>
        <Text style={styles.permissionText}>{label}</Text>
        {!complete && <Text style={styles.chevron}>›</Text>}
    </View>
);

const PhotoChoice = ({ onTakePhoto, onChoosePhoto, onHowToAdd, partnerPhoto, myPhoto }) => (
    <>
        <View style={styles.photoStack}>
            <View style={[styles.photoTile, styles.photoTileLeft]}>
                <Text style={styles.photoTileEmoji}>{partnerPhoto ? '💞' : '♡'}</Text>
            </View>
            <View style={[styles.photoTile, styles.photoTileRight]}>
                <Text style={styles.photoTileEmoji}>{myPhoto ? '💕' : '☺'}</Text>
            </View>
            <View style={styles.photoHeart}><Text style={styles.photoHeartText}>♥</Text></View>
        </View>
        <View style={styles.readyPill}><View style={styles.readyDot} /><Text style={styles.readyText}>Ready to share</Text></View>
        <View style={styles.photoActions}>
            <TouchableOpacity style={[styles.photoAction, styles.takePhotoAction]} onPress={onTakePhoto} activeOpacity={0.85}>
                <Text style={styles.photoActionIcon}>●</Text>
                <Text style={styles.photoActionText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.photoAction, styles.choosePhotoAction]} onPress={onChoosePhoto} activeOpacity={0.85}>
                <Text style={styles.photoActionIcon}>▣</Text>
                <Text style={styles.photoActionText}>Choose Photo</Text>
            </TouchableOpacity>
        </View>
        <ActionButton secondary onPress={onHowToAdd}>How to add widget</ActionButton>
    </>
);

const HeartIcon = ({ color = '#FF758F', size = 16, style }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={style}>
        <Path d="M12 21s-7.2-4.35-9.55-8.2C.54 9.66 1.32 5.83 4.6 4.53 7.1 3.54 9.53 4.5 12 7.15c2.47-2.65 4.9-3.61 7.4-2.62 3.28 1.3 4.06 5.13 2.15 8.27C19.2 16.65 12 21 12 21z" />
    </Svg>
);

const DaysTogetherShowcase = ({ relationshipStartDate, daysTogether, onHowToAdd, onClose }) => {
    const [activeTab, setActiveTab] = useState('lock');
    const pulseAnim = useRef(new Animated.Value(1)).current;

    const initialElapsed = useMemo(() => {
        if (relationshipStartDate) {
            const start = new Date(relationshipStartDate).getTime();
            if (!Number.isNaN(start)) {
                return Math.max(0, Math.floor((Date.now() - start) / 1000));
            }
        }
        if (daysTogether && daysTogether > 0) {
            return (daysTogether * 86400) + (11 * 3600) + (44 * 60) + 12;
        }
        return (1954 * 86400) + (11 * 3600) + (44 * 60) + 12;
    }, [relationshipStartDate, daysTogether]);

    const [elapsed, setElapsed] = useState(initialElapsed);

    useEffect(() => {
        setElapsed(initialElapsed);
    }, [initialElapsed]);

    useEffect(() => {
        const interval = setInterval(() => {
            setElapsed(prev => prev + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.25,
                    duration: 750,
                    useNativeDriver: false,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 750,
                    useNativeDriver: false,
                }),
            ])
        );
        animation.start();
        return () => animation.stop();
    }, [pulseAnim]);

    const values = useMemo(() => {
        const d = Math.floor(elapsed / 86400);
        const hr = Math.floor((elapsed % 86400) / 3600);
        const min = Math.floor((elapsed % 3600) / 60);
        const sec = elapsed % 60;
        return {
            days: d,
            hr: String(hr).padStart(2, '0'),
            min: String(min).padStart(2, '0'),
            sec: String(sec).padStart(2, '0'),
        };
    }, [elapsed]);

    return (
        <View style={styles.timeShowcaseWrapper}>
            <View style={styles.tabSelectorRow}>
                <TouchableOpacity
                    activeOpacity={0.8}
                    style={[styles.tabSelectorButton, activeTab === 'lock' && styles.tabSelectorActive]}
                    onPress={() => setActiveTab('lock')}
                >
                    <Text style={[styles.tabSelectorText, activeTab === 'lock' && styles.tabSelectorActiveText]}>
                        🔒 Lock Screen
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    activeOpacity={0.8}
                    style={[styles.tabSelectorButton, activeTab === 'home' && styles.tabSelectorActive]}
                    onPress={() => setActiveTab('home')}
                >
                    <Text style={[styles.tabSelectorText, activeTab === 'home' && styles.tabSelectorActiveText]}>
                        🏠 Home Screen
                    </Text>
                </TouchableOpacity>
            </View>

            <LinearGradient
                colors={['#1F1133', '#3B184E', '#5B1B67', '#321042']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.lockShowcaseCard}
            >
                <View style={styles.lockDecorGlow1} />
                <View style={styles.lockDecorGlow2} />

                <Text style={styles.lockShowcaseDate}>
                    {activeTab === 'lock' ? 'Tue 9 Jun  •  11:44' : 'PENGUIN HOME WIDGET'}
                </Text>

                <View style={styles.lockShowcaseWidgetBox}>
                    <View style={styles.timeWidgetHeaderRow}>
                        <Text style={styles.timeWidgetHeaderLabel}>together for</Text>
                        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                            <HeartIcon color="#FF758F" size={13} />
                        </Animated.View>
                    </View>

                    <View style={styles.timeNumbersRow}>
                        <View style={styles.timeNumCol}>
                            <Text style={styles.timeShowcaseVal}>{values.days}</Text>
                        </View>
                        <Text style={styles.timeColon}>:</Text>
                        <View style={styles.timeNumCol}>
                            <Text style={styles.timeShowcaseVal}>{values.hr}</Text>
                        </View>
                        <Text style={styles.timeColon}>:</Text>
                        <View style={styles.timeNumCol}>
                            <Text style={styles.timeShowcaseVal}>{values.min}</Text>
                        </View>
                        <Text style={styles.timeColon}>:</Text>
                        <View style={styles.timeNumCol}>
                            <Text style={styles.timeShowcaseVal}>{values.sec}</Text>
                        </View>
                    </View>

                    <View style={styles.timeLabelsRow}>
                        <View style={styles.timeNumCol}>
                            <Text style={styles.timeShowcaseLbl}>days</Text>
                        </View>
                        <View style={styles.timeColonSpacer} />
                        <View style={styles.timeNumCol}>
                            <Text style={styles.timeShowcaseLbl}>hr</Text>
                        </View>
                        <View style={styles.timeColonSpacer} />
                        <View style={styles.timeNumCol}>
                            <Text style={styles.timeShowcaseLbl}>min</Text>
                        </View>
                        <View style={styles.timeColonSpacer} />
                        <View style={styles.timeNumCol}>
                            <Text style={styles.timeShowcaseLbl}>sec</Text>
                        </View>
                    </View>
                </View>
                <Text style={styles.previewCaption}>
                    {activeTab === 'lock' ? 'Lock Screen Accessory Widget' : 'Home Screen Square Widget'}
                </Text>
            </LinearGradient>

            <Text style={styles.timeShowcaseTitle}>Days Together Widget</Text>

            <ActionButton onPress={onHowToAdd}>How to add widget</ActionButton>
            <TouchableOpacity onPress={onClose} style={styles.quietAction}>
                <Text style={styles.quietActionText}>Done</Text>
            </TouchableOpacity>
        </View>
    );
};

const WidgetSetupBottomSheet = ({
    visible,
    kind,
    onClose,
    isLocationLoading = false,
    locationMessage,
    locationPermissionStatus,
    distanceReason,
    hasPartner = false,
    partnerName = 'your partner',
    onEnableLocation,
    onOpenSettings,
    onTakePhoto,
    onChoosePhoto,
    onAllowCamera,
    cameraMessage,
    onHowToAdd,
    onConnectPartner,
    partnerPhoto,
    myPhoto,
    daysTogether,
    relationshipStartDate,
}) => {
    const insets = useSafeAreaInsets();
    const [isMounted, setIsMounted] = useState(visible);
    const backdropOpacity = useRef(new Animated.Value(0)).current;
    const sheetTranslateY = useRef(new Animated.Value(500)).current;
    const onCloseRef = useRef(onClose);

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    const handleSheetGesture = ({ nativeEvent }) => {
        sheetTranslateY.setValue(Math.max(0, nativeEvent.translationY));
    };

    const handleSheetGestureState = ({ nativeEvent }) => {
        if (nativeEvent.state === State.BEGAN) {
            sheetTranslateY.stopAnimation();
            return;
        }
        if (![State.END, State.CANCELLED, State.FAILED].includes(nativeEvent.state)) return;

        if (nativeEvent.translationY > 100 || nativeEvent.velocityY > 850) {
            onCloseRef.current?.();
            return;
        }
        Animated.spring(sheetTranslateY, {
            toValue: 0,
            tension: 75,
            friction: 11,
            useNativeDriver: true,
        }).start();
    };

    const locationServicesEnabled = locationPermissionStatus?.servicesEnabled !== false;
    const hasForegroundLocation = locationServicesEnabled && locationPermissionStatus?.foregroundGranted === true;
    const hasBackgroundLocation = locationPermissionStatus?.backgroundGranted === true;
    const hasCompleteLocationAccess = hasForegroundLocation && hasBackgroundLocation;
    const locationAccessBlocked = (Platform.OS === 'ios' && ['denied', 'restricted'].includes(locationPermissionStatus?.status))
        || /settings/i.test(locationMessage || '');

    const locationStatusLabel = !hasForegroundLocation
        ? 'Not active'
        : !hasBackgroundLocation
            ? 'Always access needed'
        : !hasPartner
            ? 'Partner needed'
            : distanceReason === 'partner_sharing_disabled'
            ? 'Waiting for partner'
                : 'Location is on';

    const locationCopy = !hasForegroundLocation
        ? `Give us access to your location so we can show the distance between you and ${hasPartner ? partnerName : 'your partner'}.`
        : !hasBackgroundLocation
            ? 'Allow location access all the time so your distance stays updated even when Penguin is closed.'
        : !hasPartner
            ? 'Your location is ready. Connect with your partner to see the distance between you.'
            : distanceReason === 'partner_sharing_disabled'
            ? `${partnerName} still needs to enable location. Your distance will appear automatically once you’re both sharing.`
                : `Your location is ready. We’ll use it to keep the distance between you and ${partnerName} updated.`;

    useEffect(() => {
        if (visible) {
            setIsMounted(true);
            backdropOpacity.setValue(0);
            sheetTranslateY.setValue(500);
            requestAnimationFrame(() => {
                Animated.parallel([
                    Animated.timing(backdropOpacity, {
                        toValue: 1,
                        duration: 180,
                        useNativeDriver: true,
                    }),
                    Animated.spring(sheetTranslateY, {
                        toValue: 0,
                        tension: 72,
                        friction: 12,
                        useNativeDriver: true,
                    }),
                ]).start();
            });
            return undefined;
        }

        Animated.parallel([
            Animated.timing(backdropOpacity, {
                toValue: 0,
                duration: 160,
                useNativeDriver: true,
            }),
            Animated.timing(sheetTranslateY, {
                toValue: 500,
                duration: 190,
                useNativeDriver: true,
            }),
        ]).start(({ finished }) => {
            if (finished) setIsMounted(false);
        });
        return undefined;
    }, [backdropOpacity, sheetTranslateY, visible]);

    return (
        <Modal visible={isMounted} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
            <GestureHandlerRootView style={styles.modalRoot}>
                <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]} />
                <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
                <PanGestureHandler
                    activeOffsetY={8}
                    failOffsetX={[-28, 28]}
                    onGestureEvent={handleSheetGesture}
                    onHandlerStateChange={handleSheetGestureState}
                >
                    <Animated.View
                        style={[
                            styles.sheet,
                            {
                                paddingBottom: Math.max(insets.bottom, 16) + 10,
                                transform: [{ translateY: sheetTranslateY }],
                            },
                        ]}
                    >
                    <View style={styles.handle} />
                    {kind === 'distance' && (
                        <>
                            <LocationPreview enabled={hasCompleteLocationAccess} statusLabel={locationStatusLabel} />
                            <Text style={styles.locationCopy}>{locationCopy}</Text>
                            <View style={styles.permissionList}>
                                <PermissionRow icon="➤" label="While using the app" complete={hasForegroundLocation} />
                                <PermissionRow icon="▣" label={Platform.OS === 'ios' ? 'Always allow' : 'Allow in background'} complete={hasBackgroundLocation} />
                            </View>
                            {!!locationMessage && <Text style={styles.inlineMessage}>{locationMessage}</Text>}
                            {locationAccessBlocked ? (
                                <ActionButton onPress={onOpenSettings}>Open Settings</ActionButton>
                            ) : !hasCompleteLocationAccess ? (
                                <ActionButton disabled={isLocationLoading} onPress={onEnableLocation}>
                                    {hasForegroundLocation ? 'Enable Always Access' : 'Enable Location'}
                                </ActionButton>
                            ) : !hasPartner ? (
                                <ActionButton onPress={onConnectPartner}>Connect Partner</ActionButton>
                            ) : locationMessage ? (
                                <ActionButton onPress={onOpenSettings}>Open Settings</ActionButton>
                            ) : (
                                <ActionButton onPress={onHowToAdd}>How to add widget</ActionButton>
                            )}
                            <TouchableOpacity disabled={isLocationLoading} onPress={onClose} style={styles.quietAction}>
                                <Text style={styles.quietActionText}>{hasCompleteLocationAccess ? 'Done' : 'Not now'}</Text>
                            </TouchableOpacity>
                        </>
                    )}
                    {kind === 'photo' && (
                        <PhotoChoice
                            onTakePhoto={onTakePhoto}
                            onChoosePhoto={onChoosePhoto}
                            onHowToAdd={onHowToAdd}
                            partnerPhoto={partnerPhoto}
                            myPhoto={myPhoto}
                        />
                    )}
                    {kind === 'cameraPermission' && (
                        <>
                            <View style={styles.cameraPermissionPreview}>
                                <LinearGradient colors={['#F26F9F', '#A670DD']} style={styles.cameraIconCircle}>
                                    <Text style={styles.cameraIcon}>▣</Text>
                                </LinearGradient>
                            </View>
                            <View style={styles.cameraStatusRow}>
                                <Text style={styles.cameraStatusIcon}>▣</Text>
                                <Text style={styles.cameraStatusText}>Camera access needed</Text>
                            </View>
                            {!!cameraMessage && <Text style={styles.inlineMessage}>{cameraMessage}</Text>}
                            <ActionButton onPress={cameraMessage ? onOpenSettings : onAllowCamera}>
                                {cameraMessage ? 'Open Settings' : 'Allow Camera'}
                            </ActionButton>
                            {!cameraMessage && <ActionButton secondary onPress={onOpenSettings}>Open Settings</ActionButton>}
                            <TouchableOpacity onPress={onClose} style={styles.quietAction}><Text style={styles.quietActionText}>Cancel</Text></TouchableOpacity>
                        </>
                    )}
                    {kind === 'time' && (
                        <DaysTogetherShowcase
                            relationshipStartDate={relationshipStartDate}
                            daysTogether={daysTogether}
                            onHowToAdd={onHowToAdd}
                            onClose={onClose}
                        />
                    )}
                    </Animated.View>
                </PanGestureHandler>
            </GestureHandlerRootView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalRoot: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { backgroundColor: 'rgba(35,20,40,0.48)' },
    sheet: { backgroundColor: '#FFFCFE', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 20, paddingTop: 10 },
    handle: { width: 42, height: 5, borderRadius: 3, backgroundColor: '#D7D0D8', alignSelf: 'center', marginBottom: 20 },
    locationPreview: { height: 124, borderRadius: 24, backgroundColor: '#FFF7FB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingBottom: 24, overflow: 'hidden' },
    initialBubble: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', elevation: 3 },
    initialBubblePink: { backgroundColor: '#F66D9D' },
    initialBubblePurple: { backgroundColor: '#A47DE2' },
    initialText: { color: '#FFFFFF', fontSize: 20, fontFamily: fontFamily.bold, fontWeight: fontWeight('700') },
    routeLine: { width: 46, borderTopWidth: 2, borderStyle: 'dashed', borderColor: '#D17AC2' },
    pinCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
    statusPill: { position: 'absolute', bottom: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 6, borderRadius: 16, backgroundColor: '#EEECEF' },
    statusPillEnabled: { backgroundColor: '#E6F7E8' },
    statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#9B969D', marginRight: 7 },
    statusDotEnabled: { backgroundColor: '#49B657' },
    statusPillText: { color: '#4B424C', fontSize: 12, fontFamily: fontFamily.bold, fontWeight: fontWeight('700') },
    permissionList: { borderRadius: 18, borderWidth: 1, borderColor: '#E8E2E9', overflow: 'hidden', marginTop: 14, marginBottom: 14 },
    permissionRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E8E2E9' },
    permissionIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#F0E6FA', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
    permissionIconComplete: { backgroundColor: '#DDF4E0' },
    permissionIconText: { color: '#8159B3', fontSize: 13, fontFamily: fontFamily.bold },
    permissionText: { flex: 1, color: '#352B39', fontSize: 14, fontFamily: fontFamily.bold, fontWeight: fontWeight('700') },
    chevron: { color: '#8A818D', fontSize: 25 },
    inlineMessage: { color: '#9A6039', fontSize: 12, lineHeight: 17, textAlign: 'center', marginHorizontal: 12, marginBottom: 12, fontFamily: fontFamily.regular },
    locationCopy: { color: '#5F5262', fontSize: 14, lineHeight: 20, textAlign: 'center', marginHorizontal: 12, marginTop: 14, fontFamily: fontFamily.regular },
    actionButton: { width: '100%', height: 52, borderRadius: 17, overflow: 'hidden', marginTop: 2 },
    actionGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    actionButtonText: { color: '#FFFFFF', fontSize: 15, fontFamily: fontFamily.bold, fontWeight: fontWeight('700') },
    secondaryButton: { borderWidth: 1.5, borderColor: '#AD79D2', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
    secondaryButtonText: { color: '#74469B', fontSize: 14, fontFamily: fontFamily.bold, fontWeight: fontWeight('700') },
    disabledButton: { opacity: 0.7 },
    quietAction: { alignSelf: 'center', paddingHorizontal: 22, paddingVertical: 14 },
    quietActionText: { color: '#74469B', fontSize: 14, fontFamily: fontFamily.bold, fontWeight: fontWeight('700') },
    photoStack: { height: 150, alignItems: 'center', justifyContent: 'center' },
    photoTile: { position: 'absolute', width: 142, height: 118, borderRadius: 25, borderWidth: 4, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', elevation: 5 },
    photoTileLeft: { left: '10%', backgroundColor: '#FFD8E5', transform: [{ rotate: '-5deg' }] },
    photoTileRight: { right: '10%', backgroundColor: '#DDD4FF', transform: [{ rotate: '5deg' }] },
    photoTileEmoji: { fontSize: 42 },
    photoHeart: { position: 'absolute', bottom: 6, width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', elevation: 5 },
    photoHeartText: { color: '#EE6898', fontSize: 20 },
    readyPill: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', borderRadius: 15, paddingHorizontal: 13, paddingVertical: 6, backgroundColor: '#F1EFF1', marginBottom: 15 },
    readyDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#56B84F', marginRight: 7 },
    readyText: { color: '#4A414B', fontSize: 12, fontFamily: fontFamily.bold },
    photoActions: { flexDirection: 'row', gap: 12, marginBottom: 12 },
    photoAction: { flex: 1, height: 112, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    takePhotoAction: { backgroundColor: '#FFE9F0' },
    choosePhotoAction: { backgroundColor: '#F0EAFF' },
    photoActionIcon: { color: '#C35B9B', fontSize: 30, marginBottom: 9 },
    photoActionText: { color: '#573A67', fontSize: 14, fontFamily: fontFamily.bold, fontWeight: fontWeight('700') },
    cameraPermissionPreview: { height: 142, alignItems: 'center', justifyContent: 'center' },
    cameraIconCircle: { width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center', elevation: 7 },
    cameraIcon: { color: '#FFFFFF', fontSize: 40 },
    cameraStatusRow: { height: 52, borderRadius: 17, borderWidth: 1, borderColor: '#E8E2E9', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    cameraStatusIcon: { color: '#D58C27', fontSize: 18, marginRight: 10 },
    cameraStatusText: { color: '#352B39', fontSize: 14, fontFamily: fontFamily.bold, fontWeight: fontWeight('700') },

    // Days Together Showcase styles
    timeShowcaseWrapper: {
        width: '100%',
        alignItems: 'center',
    },
    tabSelectorRow: {
        flexDirection: 'row',
        backgroundColor: '#F3EFF5',
        borderRadius: 14,
        padding: 3,
        marginBottom: 14,
        width: '100%',
    },
    tabSelectorButton: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 11,
    },
    tabSelectorActive: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#000000',
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: 2,
    },
    tabSelectorText: {
        fontSize: 12,
        color: '#7D7382',
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
    },
    tabSelectorActiveText: {
        color: '#2E1E3C',
    },
    lockShowcaseCard: {
        width: '100%',
        height: 185,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        overflow: 'hidden',
        position: 'relative',
    },
    lockDecorGlow1: {
        position: 'absolute',
        top: -30,
        right: -20,
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(255, 117, 143, 0.18)',
    },
    lockDecorGlow2: {
        position: 'absolute',
        bottom: -40,
        left: -30,
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: 'rgba(166, 109, 225, 0.22)',
    },
    lockShowcaseDate: {
        color: 'rgba(255, 255, 255, 0.85)',
        fontSize: 12,
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
        letterSpacing: 0.5,
    },
    lockShowcaseTime: {
        color: '#FFFFFF',
        fontSize: 38,
        lineHeight: 42,
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('900'),
        marginTop: 2,
        marginBottom: 10,
    },
    lockShowcaseWidgetBox: {
        backgroundColor: 'rgba(255, 255, 255, 0.14)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.26)',
        borderRadius: 18,
        paddingHorizontal: 18,
        paddingVertical: 8,
        alignItems: 'center',
        shadowColor: '#000000',
        shadowOpacity: 0.25,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 10,
        elevation: 4,
    },
    timeWidgetHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginBottom: 4,
    },
    timeWidgetHeaderLabel: {
        color: 'rgba(255, 255, 255, 0.92)',
        fontSize: 11,
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
        textTransform: 'lowercase',
    },
    timeNumbersRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    timeLabelsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 1,
    },
    timeNumCol: {
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 32,
    },
    timeShowcaseVal: {
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('900'),
        lineHeight: 20,
    },
    timeColon: {
        color: 'rgba(255, 255, 255, 0.85)',
        fontSize: 15,
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('900'),
        marginHorizontal: 3,
        lineHeight: 20,
    },
    timeColonSpacer: {
        width: 10,
    },
    timeShowcaseLbl: {
        color: 'rgba(255, 255, 255, 0.75)',
        fontSize: 9,
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
    },
    previewCaption: {
        marginTop: 10,
        color: 'rgba(255, 255, 255, 0.55)',
        fontSize: 10,
        fontFamily: fontFamily.regular,
    },
    homeShowcaseCard: {
        width: '100%',
        height: 180,
        borderRadius: 22,
        paddingHorizontal: 20,
        paddingVertical: 16,
        justifyContent: 'space-between',
        overflow: 'hidden',
    },
    homeBadgeTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    homeBadgeTag: {
        backgroundColor: 'rgba(255, 255, 255, 0.22)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    homeBadgeTagText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
    },
    homeHeartBadgeCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    homeDaysNumberContainer: {
        alignItems: 'center',
        marginVertical: 4,
    },
    homeDaysNumberText: {
        color: '#FFFFFF',
        fontSize: 42,
        lineHeight: 46,
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('900'),
        letterSpacing: -0.5,
    },
    homeDaysUnitText: {
        color: 'rgba(255, 255, 255, 0.88)',
        fontSize: 11,
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('800'),
        letterSpacing: 1.2,
        marginTop: 2,
    },
    homeTimerPill: {
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.16)',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 12,
    },
    homeTimerDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#4EFA9D',
        marginRight: 6,
    },
    homeTimerText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
        letterSpacing: 0.5,
    },
    previewCaptionHome: {
        position: 'absolute',
        bottom: 4,
        right: 14,
        color: 'rgba(255, 255, 255, 0.45)',
        fontSize: 9,
        fontFamily: fontFamily.regular,
    },
    featurePillsRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 14,
        marginBottom: 10,
    },
    featurePill: {
        backgroundColor: '#FFF0F5',
        borderWidth: 1,
        borderColor: '#FFD6E5',
        paddingHorizontal: 11,
        paddingVertical: 5,
        borderRadius: 14,
    },
    featurePillText: {
        color: '#D44474',
        fontSize: 11,
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('700'),
    },
    timeShowcaseTitle: {
        color: '#2E1E3C',
        fontSize: 18,
        fontFamily: fontFamily.bold,
        fontWeight: fontWeight('800'),
        textAlign: 'center',
        marginTop: 4,
        marginBottom: 4,
    },
    timeShowcaseCopy: {
        color: '#6E5E77',
        fontSize: 13,
        lineHeight: 18,
        textAlign: 'center',
        marginHorizontal: 10,
        marginBottom: 16,
        fontFamily: fontFamily.regular,
    },
});

export default WidgetSetupBottomSheet;
