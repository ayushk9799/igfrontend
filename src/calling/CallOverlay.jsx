import React, { useEffect, useMemo, useRef } from 'react';
import {
    ActivityIndicator,
    Animated,
    Image,
    Modal,
    PanResponder,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {
    Check,
    Mic,
    MicOff,
    Minimize2,
    PhoneOff,
    SwitchCamera,
    Video,
    VideoOff,
    Volume1,
    Volume2,
    X,
} from 'lucide-react-native';
import { RTCView, permissions } from 'react-native-webrtc';
import { fontFamily } from '../constants/fonts';
import { CALL_STATE } from './callConstants';
import { useCall } from './CallContext';

const BUBBLE_WIDTH = 126;
const BUBBLE_HEIGHT = 174;
const BUBBLE_EDGE_GAP = 8;
const DRAG_THRESHOLD = 5;

const CallButton = ({ label, icon: Icon, onPress, danger = false, enabled = false, loading = false, dark = true }) => {
    const iconColor = dark || enabled || danger ? '#FFF' : '#6D526B';
    return (
        <TouchableOpacity style={styles.controlWrap} onPress={onPress} activeOpacity={0.8} disabled={loading}>
            <View style={[
                styles.controlButton,
                !dark && styles.lightControlButton,
                enabled && styles.enabledControl,
                danger && styles.dangerControl,
            ]}>
                {loading
                    ? <ActivityIndicator color={dark ? '#FFF' : '#8C3D69'} size="small" />
                    : <Icon color={iconColor} size={22} strokeWidth={2.3} />}
            </View>
            <Text style={[styles.controlLabel, !dark && styles.lightControlLabel]}>{label}</Text>
        </TouchableOpacity>
    );
};

const PersonPlaceholder = ({ name, avatar, compact = false }) => (
    <LinearGradient
        colors={['#F6D8EA', '#E6DDF9']}
        style={[styles.personPlaceholder, compact && styles.compactPlaceholder]}
    >
        <View style={[styles.avatar, compact && styles.compactAvatar]}>
            {avatar ? (
                <Image source={{ uri: avatar }} style={[styles.avatarImage, compact && styles.compactAvatarImage]} />
            ) : (
                <Text style={[styles.avatarText, compact && styles.compactAvatarText]}>
                    {(name || 'P').trim().charAt(0).toUpperCase()}
                </Text>
            )}
        </View>
        {!compact && <Text style={styles.placeholderName}>{name || 'Your Love'}</Text>}
    </LinearGradient>
);

const RemoteAudioPlaceholder = ({ name, avatar, isMuted, audioLevel }) => {
    const pulse = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(pulse, {
            toValue: isMuted ? 0 : Math.min(1, audioLevel * 2.2),
            duration: 180,
            useNativeDriver: true,
        }).start();
    }, [audioLevel, isMuted, pulse]);

    const outerRingStyle = {
        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.5] }),
        transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.38] }) }],
    };
    const innerRingStyle = {
        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.72] }),
        transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }],
    };

    return (
        <LinearGradient colors={['#BFAFC4', '#E9D9EF', '#D9D1F1']} style={styles.remoteAudioSurface}>
            <View style={styles.remoteAvatarStage}>
                {!isMuted && <Animated.View style={[styles.voiceRing, styles.voiceOuterRing, outerRingStyle]} />}
                {!isMuted && <Animated.View style={[styles.voiceRing, styles.voiceInnerRing, innerRingStyle]} />}
                <View style={styles.remoteAvatar}>
                    {avatar ? (
                        <Image source={{ uri: avatar }} style={styles.remoteAvatarImage} />
                    ) : (
                        <Text style={styles.remoteAvatarText}>{(name || 'P').trim().charAt(0).toUpperCase()}</Text>
                    )}
                </View>
            </View>
            <Text style={styles.remotePlaceholderName}>{name || 'Your Love'}</Text>
            <View style={[styles.remoteMicStatus, isMuted && styles.remoteMicMutedStatus]}>
                {isMuted
                    ? <MicOff color="#FFF" size={15} strokeWidth={2.3} />
                    : <Mic color="#FFF" size={15} strokeWidth={2.3} />}
                <Text style={styles.remoteMicStatusText}>
                    {isMuted ? 'Microphone off' : audioLevel > 0.035 ? 'Speaking' : 'Listening'}
                </Text>
            </View>
        </LinearGradient>
    );
};

const PermissionIssue = ({ compact = false }) => {
    const {
        permissionIssue,
        dismissPermissionIssue,
        openPermissionSettings,
    } = useCall();
    if (!permissionIssue) return null;

    const title = permissionIssue === 'microphone'
        ? 'Microphone access is off'
        : 'Camera access is off';
    const body = permissionIssue === 'microphone'
        ? 'Enable it in Settings when you want your partner to hear you.'
        : 'Enable it in Settings when you want your partner to see you.';

    return (
        <View style={[styles.permissionBanner, compact && styles.compactPermissionBanner]}>
            <View style={styles.permissionCopy}>
                <Text style={styles.permissionTitle}>{title}</Text>
                {!compact && <Text style={styles.permissionBody}>{body}</Text>}
            </View>
            <TouchableOpacity onPress={dismissPermissionIssue} style={styles.permissionDismiss}>
                <Text style={styles.permissionDismissText}>Not now</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => openPermissionSettings(permissionIssue)} style={styles.permissionSettings}>
                <Text style={styles.permissionSettingsText}>Settings</Text>
            </TouchableOpacity>
        </View>
    );
};

const DeviceControls = ({ dark = true, includeFlip = false }) => {
    const {
        isMuted,
        isCameraEnabled,
        microphonePermission,
        cameraPermission,
        requestingDevice,
        toggleMute,
        toggleCamera,
        switchCamera,
    } = useCall();

    const microphoneLabel = requestingDevice === 'microphone'
        ? 'Requesting'
        : isMuted
            ? microphonePermission === permissions.RESULT.DENIED ? 'Mic settings' : 'Mic off'
            : 'Mic on';
    const cameraLabel = requestingDevice === 'camera'
        ? 'Requesting'
        : isCameraEnabled
            ? 'Camera on'
            : cameraPermission === permissions.RESULT.DENIED ? 'Camera settings' : 'Camera off';

    return (
        <View style={styles.deviceControls}>
            <CallButton
                label={microphoneLabel}
                icon={isMuted ? MicOff : Mic}
                onPress={toggleMute}
                enabled={!isMuted}
                loading={requestingDevice === 'microphone'}
                dark={dark}
            />
            <CallButton
                label={cameraLabel}
                icon={isCameraEnabled ? Video : VideoOff}
                onPress={toggleCamera}
                enabled={isCameraEnabled}
                loading={requestingDevice === 'camera'}
                dark={dark}
            />
            {includeFlip && (
                <CallButton label="Flip" icon={SwitchCamera} onPress={switchCamera} dark={dark} />
            )}
        </View>
    );
};

const PreCall = () => {
    const {
        activeCall,
        localStream,
        isMuted,
        isCameraEnabled,
        microphonePermission,
        cameraPermission,
        placeCall,
        closePreCall,
        localAvatar,
    } = useCall();

    const missingPermissions = microphonePermission !== permissions.RESULT.GRANTED
        || cameraPermission !== permissions.RESULT.GRANTED;

    return (
        <View style={styles.preCallScreen}>
            {localStream && isCameraEnabled ? (
                <RTCView streamURL={localStream.toURL()} style={styles.preCallVideo} objectFit="cover" mirror />
            ) : (
                <PersonPlaceholder name="You" avatar={localAvatar} />
            )}
            <LinearGradient colors={['rgba(30,16,36,0.72)', 'transparent']} style={styles.topShade} />
            <LinearGradient colors={['transparent', 'rgba(30,16,36,0.92)']} style={styles.preCallBottomShade} />
            <SafeAreaView style={styles.preCallSafeArea} pointerEvents="box-none">
                <View style={styles.preCallHeader}>
                    <TouchableOpacity style={styles.closeButton} onPress={closePreCall}>
                        <X color="#FFF" size={24} strokeWidth={2.4} />
                    </TouchableOpacity>
                    <View style={styles.preCallHeaderCopy}>
                        <Text style={styles.preCallTitle}>Call {activeCall?.partnerName || 'your partner'}</Text>
                        <Text style={styles.preCallSubtitle}>Choose how you want to join</Text>
                    </View>
                    <View style={styles.headerSpacer} />
                </View>

                <View style={styles.preCallFooter}>
                    {missingPermissions && (
                        <Text style={styles.permissionHint}>
                            Tap the microphone or camera to allow access only when you need it.
                        </Text>
                    )}
                    <PermissionIssue />
                    <DeviceControls includeFlip={isCameraEnabled} />
                    <TouchableOpacity style={styles.startCallButton} onPress={placeCall}>
                        <Text style={styles.startCallButtonText}>Start call</Text>
                        {(isMuted || !isCameraEnabled) && (
                            <Text style={styles.startCallButtonSubtext}>
                                {isMuted && !isCameraEnabled
                                    ? 'Microphone and camera are off'
                                    : isMuted ? 'Microphone is off' : 'Camera is off'}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
    );
};

const IncomingCall = () => {
    const { activeCall, acceptCall, rejectCall } = useCall();
    return (
        <View style={styles.backdropCard}>
            <PersonPlaceholder name={activeCall?.partnerName} avatar={activeCall?.partnerAvatar} compact />
            <Text style={styles.sheetTitle}>{activeCall?.partnerName || 'Your partner'} is calling</Text>
            <Text style={styles.sheetBody}>You can answer with your microphone and camera off.</Text>
            <PermissionIssue compact />
            <DeviceControls dark={false} />
            <View style={styles.incomingActions}>
                <TouchableOpacity style={[styles.roundAction, styles.declineAction]} onPress={rejectCall}>
                    <X color="#FFF" size={28} strokeWidth={2.5} />
                    <Text style={styles.roundActionLabel}>Decline</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.roundAction, styles.acceptAction]} onPress={acceptCall}>
                    <Check color="#FFF" size={29} strokeWidth={2.6} />
                    <Text style={styles.roundActionLabel}>Accept</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const OutgoingCall = () => {
    const { activeCall, cancelCall } = useCall();
    return (
        <View style={styles.outgoingCard}>
            <PersonPlaceholder name={activeCall?.partnerName} avatar={activeCall?.partnerAvatar} compact />
            <View style={styles.outgoingCopy}>
                <Text style={styles.outgoingTitle}>Calling {activeCall?.partnerName || 'your partner'}…</Text>
                <Text style={styles.outgoingSubtitle}>Waiting for them to answer</Text>
                <DeviceControls dark={false} />
            </View>
            <TouchableOpacity style={styles.cancelPill} onPress={cancelCall}>
                <Text style={styles.cancelPillText}>Cancel</Text>
            </TouchableOpacity>
        </View>
    );
};

const FullScreenCall = () => {
    const insets = useSafeAreaInsets();
    const {
        activeCall,
        callState,
        localStream,
        remoteStream,
        isCameraEnabled,
        isChangingAudioOutput,
        isSpeakerOn,
        isRemoteCameraEnabled,
        isRemoteMuted,
        remoteAudioLevel,
        localAvatar,
        minimizeCall,
        toggleSpeaker,
        endCall,
    } = useCall();

    return (
        <View style={styles.fullScreen}>
            {remoteStream && isRemoteCameraEnabled ? (
                <RTCView streamURL={remoteStream.toURL()} style={styles.remoteVideo} objectFit="cover" />
            ) : (
                <RemoteAudioPlaceholder
                    name={activeCall?.partnerName}
                    avatar={activeCall?.partnerAvatar}
                    isMuted={isRemoteMuted}
                    audioLevel={remoteAudioLevel}
                />
            )}
            <LinearGradient colors={['rgba(30,16,36,0.65)', 'transparent']} style={styles.topShade} />
            <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.callSafeArea} pointerEvents="box-none">
                <View style={[styles.callHeader, { paddingTop: insets.top + 10 }]}>
                    <View style={styles.partnerHeaderCopy}>
                        <Text style={styles.partnerName} numberOfLines={1} ellipsizeMode="tail">
                            {activeCall?.partnerName || 'Your Love'}
                        </Text>
                        <View style={styles.connectionRow}>
                            <Text style={styles.connectionLabel}>
                                {callState === CALL_STATE.CONNECTED ? 'Connected' : 'Connecting…'}
                            </Text>
                            {isRemoteMuted && (
                                <View style={styles.headerMutedBadge}>
                                    <MicOff color="#FFF" size={11} strokeWidth={2.3} />
                                    <Text style={styles.headerMutedText}>Mic off</Text>
                                </View>
                            )}
                        </View>
                    </View>
                    <TouchableOpacity style={styles.minimizeButton} onPress={minimizeCall}>
                        <Minimize2 color="#FFF" size={24} strokeWidth={2.3} />
                    </TouchableOpacity>
                </View>

                <View style={[styles.localPreview, { top: Math.max(112, insets.top + 72) }]}>
                    {localStream && isCameraEnabled ? (
                        <RTCView
                            streamURL={localStream.toURL()}
                            style={styles.localVideo}
                            objectFit="cover"
                            mirror
                            zOrder={1}
                        />
                    ) : (
                        <LinearGradient colors={['#F6D8EA', '#E6DDF9']} style={styles.localCameraOff}>
                            <View style={styles.localAvatar}>
                                {localAvatar ? (
                                    <Image source={{ uri: localAvatar }} style={styles.localAvatarImage} />
                                ) : (
                                    <Text style={styles.localAvatarText}>Y</Text>
                                )}
                            </View>
                            <View style={styles.localCameraOffBadge}>
                                <VideoOff color="#FFF" size={12} strokeWidth={2.3} />
                                <Text style={styles.localCameraOffText}>Camera off</Text>
                            </View>
                        </LinearGradient>
                    )}
                </View>

                <View>
                    <PermissionIssue />
                    <View style={styles.controlsPanel}>
                        <DeviceControls includeFlip={isCameraEnabled} />
                        <CallButton
                            label={isSpeakerOn ? 'Speaker' : 'Earpiece'}
                            icon={isSpeakerOn ? Volume2 : Volume1}
                            onPress={toggleSpeaker}
                            enabled={isSpeakerOn}
                            loading={isChangingAudioOutput}
                        />
                        <CallButton label="End" icon={PhoneOff} onPress={endCall} danger />
                    </View>
                </View>
            </SafeAreaView>
        </View>
    );
};

const FloatingCall = () => {
    const insets = useSafeAreaInsets();
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const { activeCall, remoteStream, isMuted, isRemoteCameraEnabled, expandCall, toggleMute, endCall } = useCall();
    const initialPosition = useRef({
        x: screenWidth - BUBBLE_WIDTH - 14,
        y: insets.top + 58,
    }).current;
    const position = useRef(new Animated.ValueXY(initialPosition)).current;
    const currentPosition = useRef(initialPosition);
    const gestureOrigin = useRef(initialPosition);

    useEffect(() => {
        const minY = insets.top + BUBBLE_EDGE_GAP;
        const maxX = Math.max(BUBBLE_EDGE_GAP, screenWidth - BUBBLE_WIDTH - BUBBLE_EDGE_GAP);
        const maxY = Math.max(minY, screenHeight - BUBBLE_HEIGHT - insets.bottom - BUBBLE_EDGE_GAP);
        const next = {
            x: Math.max(BUBBLE_EDGE_GAP, Math.min(maxX, currentPosition.current.x)),
            y: Math.max(minY, Math.min(maxY, currentPosition.current.y)),
        };
        currentPosition.current = next;
        position.setValue(next);
    }, [insets.bottom, insets.top, position, screenHeight, screenWidth]);

    const panResponder = useMemo(() => {
        const bounds = {
            minX: BUBBLE_EDGE_GAP,
            maxX: Math.max(BUBBLE_EDGE_GAP, screenWidth - BUBBLE_WIDTH - BUBBLE_EDGE_GAP),
            minY: insets.top + BUBBLE_EDGE_GAP,
            maxY: Math.max(
                insets.top + BUBBLE_EDGE_GAP,
                screenHeight - BUBBLE_HEIGHT - insets.bottom - BUBBLE_EDGE_GAP,
            ),
        };
        const positionForGesture = gesture => ({
            x: Math.max(bounds.minX, Math.min(bounds.maxX, gestureOrigin.current.x + gesture.dx)),
            y: Math.max(bounds.minY, Math.min(bounds.maxY, gestureOrigin.current.y + gesture.dy)),
        });

        return PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponderCapture: (_, gesture) => (
                Math.abs(gesture.dx) > DRAG_THRESHOLD || Math.abs(gesture.dy) > DRAG_THRESHOLD
            ),
            onPanResponderGrant: () => {
                gestureOrigin.current = currentPosition.current;
            },
            onPanResponderMove: (_, gesture) => {
                const next = positionForGesture(gesture);
                currentPosition.current = next;
                position.setValue(next);
            },
            onPanResponderRelease: (_, gesture) => {
                const next = positionForGesture(gesture);
                currentPosition.current = next;
                position.setValue(next);
            },
            onPanResponderTerminate: (_, gesture) => {
                const next = positionForGesture(gesture);
                currentPosition.current = next;
                position.setValue(next);
            },
            onPanResponderTerminationRequest: () => false,
        });
    }, [insets.bottom, insets.top, position, screenHeight, screenWidth]);

    return (
        <Animated.View style={[styles.floatingBubble, position.getLayout()]} {...panResponder.panHandlers}>
            <TouchableOpacity style={styles.bubbleTapArea} onPress={expandCall} activeOpacity={0.96}>
                {remoteStream && isRemoteCameraEnabled ? (
                    <RTCView streamURL={remoteStream.toURL()} style={styles.bubbleVideo} objectFit="cover" />
                ) : (
                    <PersonPlaceholder name={activeCall?.partnerName} avatar={activeCall?.partnerAvatar} compact />
                )}
            </TouchableOpacity>
            <View style={styles.inCallBadge}><Text style={styles.inCallText}>In call</Text></View>
            <View style={styles.bubbleControls}>
                <TouchableOpacity style={styles.bubbleButton} onPress={toggleMute}>
                    {isMuted
                        ? <MicOff color="#FFF" size={16} strokeWidth={2.4} />
                        : <Mic color="#FFF" size={16} strokeWidth={2.4} />}
                </TouchableOpacity>
                <TouchableOpacity style={[styles.bubbleButton, styles.bubbleEnd]} onPress={endCall}>
                    <PhoneOff color="#FFF" size={15} strokeWidth={2.4} />
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
};

export const CallOverlay = () => {
    const { callState, isExpanded, errorMessage } = useCall();

    return (
        <>
            <Modal visible={callState === CALL_STATE.INCOMING} transparent animationType="fade" statusBarTranslucent>
                <View style={styles.modalBackdrop}><IncomingCall /></View>
            </Modal>

            <Modal visible={callState === CALL_STATE.PRECALL} animationType="slide" statusBarTranslucent>
                <PreCall />
            </Modal>

            {callState === CALL_STATE.OUTGOING && <OutgoingCall />}

            <Modal
                visible={isExpanded && [CALL_STATE.CONNECTING, CALL_STATE.CONNECTED].includes(callState)}
                animationType="slide"
                statusBarTranslucent
            >
                <FullScreenCall />
            </Modal>

            {callState === CALL_STATE.CONNECTED && !isExpanded && <FloatingCall />}

            {!!errorMessage && (
                <View style={styles.errorToast} pointerEvents="none">
                    <Text style={styles.errorToastText}>{errorMessage}</Text>
                </View>
            )}
        </>
    );
};

const styles = StyleSheet.create({
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(35, 20, 43, 0.48)', justifyContent: 'center', padding: 24 },
    backdropCard: { backgroundColor: '#FFF9FC', borderRadius: 28, padding: 24, alignItems: 'center', shadowColor: '#3B183B', shadowOpacity: 0.2, shadowRadius: 24, elevation: 12 },
    sheetTitle: { fontFamily: fontFamily.bold, color: '#392B3C', fontSize: 22, textAlign: 'center', marginTop: 12 },
    sheetBody: { fontFamily: fontFamily.regular, color: '#766778', fontSize: 15, lineHeight: 21, textAlign: 'center', marginTop: 8 },
    personPlaceholder: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
    compactPlaceholder: { flex: 0, width: 82, height: 82, borderRadius: 30 },
    avatar: { width: 108, height: 108, borderRadius: 54, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
    compactAvatar: { width: 64, height: 64, borderRadius: 32 },
    avatarImage: { width: 108, height: 108 },
    compactAvatarImage: { width: 64, height: 64 },
    avatarText: { color: '#BE4C80', fontFamily: fontFamily.bold, fontSize: 48 },
    compactAvatarText: { fontSize: 28 },
    placeholderName: { fontFamily: fontFamily.bold, fontSize: 24, color: '#583D5B', marginTop: 16 },
    permissionBanner: { marginHorizontal: 16, marginBottom: 10, padding: 12, borderRadius: 16, backgroundColor: 'rgba(255,249,252,0.96)', flexDirection: 'row', alignItems: 'center', gap: 8 },
    compactPermissionBanner: { marginHorizontal: 0, marginTop: 14, marginBottom: 2, backgroundColor: '#F9EEF5' },
    permissionCopy: { flex: 1 },
    permissionTitle: { fontFamily: fontFamily.bold, color: '#49394D', fontSize: 13 },
    permissionBody: { fontFamily: fontFamily.regular, color: '#766778', fontSize: 11, lineHeight: 15, marginTop: 2 },
    permissionDismiss: { paddingHorizontal: 6, paddingVertical: 8 },
    permissionDismissText: { fontFamily: fontFamily.medium, color: '#8B7B8E', fontSize: 11 },
    permissionSettings: { backgroundColor: '#D84F86', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 11 },
    permissionSettingsText: { fontFamily: fontFamily.bold, color: '#FFF', fontSize: 11 },
    deviceControls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
    controlWrap: { alignItems: 'center', minWidth: 56 },
    controlButton: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
    lightControlButton: { backgroundColor: '#F3E8F0' },
    enabledControl: { backgroundColor: 'rgba(218,79,134,0.94)' },
    dangerControl: { backgroundColor: '#E34C5C' },
    controlSymbol: { color: '#FFF', fontSize: 21 },
    lightControlSymbol: { color: '#6D526B' },
    controlLabel: { color: '#FFF', fontFamily: fontFamily.medium, fontSize: 10, marginTop: 6 },
    lightControlLabel: { color: '#665469' },
    preCallScreen: { flex: 1, backgroundColor: '#2F2233' },
    preCallVideo: { ...StyleSheet.absoluteFillObject },
    topShade: { position: 'absolute', top: 0, left: 0, right: 0, height: 180 },
    preCallBottomShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 390 },
    preCallSafeArea: { flex: 1, justifyContent: 'space-between' },
    preCallHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8 },
    closeButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
    closeButtonText: { color: '#FFF', fontSize: 30, lineHeight: 34 },
    preCallHeaderCopy: { flex: 1, alignItems: 'center' },
    preCallTitle: { color: '#FFF', fontFamily: fontFamily.bold, fontSize: 20 },
    preCallSubtitle: { color: 'rgba(255,255,255,0.78)', fontFamily: fontFamily.regular, fontSize: 12, marginTop: 2 },
    headerSpacer: { width: 44 },
    preCallFooter: { paddingHorizontal: 18, paddingBottom: 20 },
    permissionHint: { color: '#FFF', fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 18, textAlign: 'center', marginHorizontal: 24, marginBottom: 14 },
    startCallButton: { backgroundColor: '#D84F86', borderRadius: 20, minHeight: 58, alignItems: 'center', justifyContent: 'center', marginTop: 22, paddingVertical: 10 },
    startCallButtonText: { color: '#FFF', fontFamily: fontFamily.bold, fontSize: 17 },
    startCallButtonSubtext: { color: 'rgba(255,255,255,0.8)', fontFamily: fontFamily.regular, fontSize: 10, marginTop: 2 },
    incomingActions: { flexDirection: 'row', justifyContent: 'center', gap: 54, marginTop: 22 },
    roundAction: { alignItems: 'center', justifyContent: 'center', width: 82, height: 82, borderRadius: 41 },
    declineAction: { backgroundColor: '#E95666' },
    acceptAction: { backgroundColor: '#49B77B' },
    roundActionIcon: { color: '#FFF', fontSize: 28, fontFamily: fontFamily.bold },
    roundActionLabel: { color: '#FFF', fontFamily: fontFamily.bold, fontSize: 12, marginTop: 2 },
    outgoingCard: { position: 'absolute', left: 14, right: 14, top: 58, zIndex: 1000, elevation: 20, flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 22, backgroundColor: '#FFF9FC', shadowColor: '#3B183B', shadowOpacity: 0.22, shadowRadius: 16 },
    outgoingCopy: { flex: 1, paddingHorizontal: 12 },
    outgoingTitle: { fontFamily: fontFamily.bold, color: '#392B3C', fontSize: 15 },
    outgoingSubtitle: { fontFamily: fontFamily.regular, color: '#8B7C8E', fontSize: 12, marginTop: 2, marginBottom: 8 },
    cancelPill: { backgroundColor: '#FBE5EC', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9 },
    cancelPillText: { fontFamily: fontFamily.bold, color: '#CA3F68', fontSize: 13 },
    fullScreen: { flex: 1, backgroundColor: '#2F2233' },
    remoteVideo: { ...StyleSheet.absoluteFillObject },
    remoteAudioSurface: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
    remoteAvatarStage: { width: 230, height: 230, alignItems: 'center', justifyContent: 'center' },
    voiceRing: { position: 'absolute', borderWidth: 3, borderColor: 'rgba(216,79,134,0.9)', backgroundColor: 'rgba(216,79,134,0.08)' },
    voiceOuterRing: { width: 210, height: 210, borderRadius: 105 },
    voiceInnerRing: { width: 174, height: 174, borderRadius: 87 },
    remoteAvatar: { width: 146, height: 146, borderRadius: 73, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.94)', borderWidth: 3, borderColor: 'rgba(255,255,255,0.92)', shadowColor: '#582F59', shadowOpacity: 0.22, shadowRadius: 18, elevation: 8 },
    remoteAvatarImage: { width: 146, height: 146 },
    remoteAvatarText: { color: '#C74983', fontFamily: fontFamily.bold, fontSize: 64 },
    remotePlaceholderName: { color: '#49394D', fontFamily: fontFamily.bold, fontSize: 25, marginTop: 8 },
    remoteMicStatus: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, borderRadius: 15, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: 'rgba(74,57,77,0.72)' },
    remoteMicMutedStatus: { backgroundColor: 'rgba(94,73,96,0.72)' },
    remoteMicStatusText: { color: '#FFF', fontFamily: fontFamily.medium, fontSize: 12 },
    callSafeArea: { flex: 1, justifyContent: 'space-between' },
    callHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10 },
    partnerHeaderCopy: { flex: 1, paddingRight: 12 },
    partnerName: { fontFamily: fontFamily.bold, color: '#FFF', fontSize: 23 },
    connectionRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 3 },
    connectionLabel: { fontFamily: fontFamily.medium, color: 'rgba(255,255,255,0.8)', fontSize: 13 },
    headerMutedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 4, backgroundColor: 'rgba(20,14,22,0.42)' },
    headerMutedText: { color: '#FFF', fontFamily: fontFamily.medium, fontSize: 9 },
    minimizeButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.28)' },
    minimizeIcon: { color: '#FFF', fontSize: 30, lineHeight: 32 },
    localPreview: { position: 'absolute', right: 18, top: 112, width: 118, height: 168, borderRadius: 20, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.88)', backgroundColor: '#E6DDF9', shadowColor: '#251628', shadowOpacity: 0.3, shadowRadius: 12, elevation: 12 },
    localVideo: { flex: 1 },
    localCameraOff: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    localAvatar: { width: 58, height: 58, borderRadius: 29, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.92)' },
    localAvatarImage: { width: 58, height: 58 },
    localAvatarText: { color: '#C74983', fontFamily: fontFamily.bold, fontSize: 28 },
    localCameraOffBadge: { position: 'absolute', left: 7, right: 7, bottom: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 10, paddingVertical: 5, backgroundColor: 'rgba(37,25,40,0.7)' },
    localCameraOffText: { color: '#FFF', fontFamily: fontFamily.medium, fontSize: 8 },
    controlsPanel: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', margin: 16, marginBottom: 24, paddingVertical: 18, paddingHorizontal: 10, borderRadius: 28, backgroundColor: 'rgba(26,18,29,0.68)' },
    floatingBubble: { position: 'absolute', width: BUBBLE_WIDTH, height: BUBBLE_HEIGHT, zIndex: 2000, elevation: 25, overflow: 'hidden', borderRadius: 22, borderWidth: 2, borderColor: '#FFF', backgroundColor: '#E6DDF9', shadowColor: '#30192F', shadowOpacity: 0.28, shadowRadius: 12 },
    bubbleVideo: { ...StyleSheet.absoluteFillObject },
    bubbleTapArea: { ...StyleSheet.absoluteFillObject },
    inCallBadge: { position: 'absolute', top: 8, left: 8, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(36,24,40,0.65)' },
    inCallText: { color: '#FFF', fontFamily: fontFamily.bold, fontSize: 9 },
    bubbleControls: { position: 'absolute', left: 7, right: 7, bottom: 7, flexDirection: 'row', justifyContent: 'space-between' },
    bubbleButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(25,18,28,0.68)' },
    bubbleEnd: { backgroundColor: 'rgba(218,65,80,0.9)' },
    bubbleButtonText: { color: '#FFF', fontSize: 14 },
    errorToast: { position: 'absolute', left: 20, right: 20, bottom: 92, zIndex: 3000, elevation: 30, backgroundColor: '#3E303F', paddingHorizontal: 16, paddingVertical: 13, borderRadius: 16 },
    errorToastText: { color: '#FFF', fontFamily: fontFamily.medium, fontSize: 13, textAlign: 'center' },
});

export default CallOverlay;
