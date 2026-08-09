import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AccessibilityInfo,
    ActivityIndicator,
    Animated,
    Image,
    Modal,
    PanResponder,
    Pressable,
    ScrollView,
    StatusBar,
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
import { useCall, useRemoteAudioLevel } from './CallContext';
import { translateUiTemplate, translateUiText } from '../i18n/uiTranslation';

const BUBBLE_WIDTH = 126;
const BUBBLE_HEIGHT = 174;
const BUBBLE_EDGE_GAP = 8;
const DRAG_THRESHOLD = 5;
const BUBBLE_ACCESSIBILITY_STEP = 32;

const useReduceMotion = () => {
    const [reduceMotion, setReduceMotion] = useState(false);

    useEffect(() => {
        let isMounted = true;
        AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
            if (isMounted) setReduceMotion(enabled);
        });
        const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);

        return () => {
            isMounted = false;
            subscription.remove();
        };
    }, []);

    return reduceMotion;
};

/** @param {{ stream: object, style: object, mirror?: boolean, zOrder?: number }} props */
const StreamView = memo(({ stream, style, mirror = false, zOrder }) => (
    <RTCView
        streamURL={stream.toURL()}
        style={style}
        objectFit="cover"
        mirror={mirror}
        zOrder={zOrder}
    />
));

/**
 * @param {{ label: string, icon: React.ComponentType, onPress: () => void,
 * danger?: boolean, enabled?: boolean, loading?: boolean, dark?: boolean }} props
 */
const CallButton = ({ label, icon: Icon, onPress, danger = false, enabled = false, loading = false, dark = true }) => {
    const iconColor = dark || enabled || danger ? '#FFF' : '#6D526B';
    return (
        <TouchableOpacity
            style={styles.controlWrap}
            onPress={onPress}
            activeOpacity={0.8}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ disabled: loading, selected: enabled }}
        >
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
            <Text
                style={[styles.controlLabel, !dark && styles.lightControlLabel]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
            >
                {label}
            </Text>
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
        {!compact && <Text style={styles.placeholderName}>{name || translateUiText("Partner")}</Text>}
    </LinearGradient>
);

const CallAvatar = ({ name, avatar }) => (
    <LinearGradient
        colors={['#F7DCEB', '#E9E0F6']}
        style={styles.sheetAvatar}
    >
        {avatar ? (
            <Image source={{ uri: avatar }} style={styles.sheetAvatarImage} />
        ) : (
            <Text style={styles.sheetAvatarText}>
                {(name || 'P').trim().charAt(0).toUpperCase()}
            </Text>
        )}
    </LinearGradient>
);

const RemoteAudioPlaceholder = ({ name, avatar, isMuted, audioLevel }) => {
    const pulse = useRef(new Animated.Value(0)).current;
    const reduceMotion = useReduceMotion();

    useEffect(() => {
        const targetValue = isMuted ? 0 : Math.min(1, audioLevel * 2.2);
        if (reduceMotion) {
            pulse.setValue(targetValue);
            return undefined;
        }

        const animation = Animated.timing(pulse, {
            toValue: targetValue,
            duration: 180,
            useNativeDriver: true,
        });
        animation.start();
        return () => animation.stop();
    }, [audioLevel, isMuted, pulse, reduceMotion]);

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
            <Text style={styles.remotePlaceholderName}>{name || translateUiText("Partner")}</Text>
            <View style={[styles.remoteMicStatus, isMuted && styles.remoteMicMutedStatus]}>
                {isMuted
                    ? <MicOff color="#FFF" size={15} strokeWidth={2.3} />
                    : <Mic color="#FFF" size={15} strokeWidth={2.3} />}
                <Text style={styles.remoteMicStatusText} accessibilityLiveRegion="polite">
                    {isMuted ? translateUiText("Microphone off") : audioLevel > 0.035 ? translateUiText("Speaking") : translateUiText("Listening")}
                </Text>
            </View>
        </LinearGradient>
    );
};

const PermissionIssue = ({ compact = false }) => {
    const {
        activeCall,
        permissionIssue,
        dismissPermissionIssue,
        openPermissionSettings,
    } = useCall();
    if (!permissionIssue) return null;
    const partnerName = activeCall?.partnerName || 'Partner';

    const title = permissionIssue === 'microphone'
        ? translateUiText("Microphone access is off")
        : translateUiText("Camera access is off");
    const body = permissionIssue === 'microphone'
        ? translateUiTemplate("Enable it in Settings when you want {{0}} to hear you.", [partnerName])
        : translateUiTemplate("Enable it in Settings when you want {{0}} to see you.", [partnerName]);

    return (
        <View style={[styles.permissionBanner, compact && styles.compactPermissionBanner]}>
            <View style={styles.permissionCopy}>
                <Text style={styles.permissionTitle}>{title}</Text>
                {!compact && <Text style={styles.permissionBody}>{body}</Text>}
            </View>
            <TouchableOpacity
                onPress={dismissPermissionIssue}
                style={styles.permissionDismiss}
                accessibilityRole="button"
                accessibilityLabel={translateUiText("Dismiss permission message")}
            >
                <Text style={styles.permissionDismissText}>{translateUiText("Not now")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
                onPress={() => openPermissionSettings(permissionIssue)}
                style={styles.permissionSettings}
                accessibilityRole="button"
                accessibilityLabel={translateUiTemplate("Open {{0}} settings", [translateUiText(permissionIssue)])}
            >
                <Text style={styles.permissionSettingsText}>{translateUiText("Settings")}</Text>
            </TouchableOpacity>
        </View>
    );
};

const CallPermissionPrompt = () => {
    const {
        allowCallPermissions,
        continueCallWithoutPermissions,
        requestingDevice,
    } = useCall();
    const isRequesting = Boolean(requestingDevice);

    return (
        <View style={styles.callPermissionSheet} accessibilityViewIsModal>
            <Text style={styles.callPermissionTitle}>{translateUiText("Allow camera and microphone")}</Text>
            <Text style={styles.callPermissionBody}>{translateUiText("Use video and audio during your calls.")}</Text>
            <View style={styles.callPermissionDevices}>
                <View style={styles.callPermissionDevice}>
                    <View style={styles.callPermissionIcon}>
                        <Video color="#D84F86" size={23} strokeWidth={2.2} />
                    </View>
                    <Text style={styles.callPermissionDeviceLabel}>{translateUiText("Camera")}</Text>
                </View>
                <View style={styles.callPermissionDevice}>
                    <View style={styles.callPermissionIcon}>
                        <Mic color="#D84F86" size={23} strokeWidth={2.2} />
                    </View>
                    <Text style={styles.callPermissionDeviceLabel}>{translateUiText("Microphone")}</Text>
                </View>
            </View>
            <TouchableOpacity
                style={[styles.callPermissionAllow, isRequesting && styles.callPermissionDisabled]}
                onPress={allowCallPermissions}
                disabled={isRequesting}
                activeOpacity={0.86}
                accessibilityRole="button"
                accessibilityLabel={translateUiText("Continue and allow camera and microphone access")}
            >
                {isRequesting
                    ? <ActivityIndicator color="#FFFFFF" />
                    : <Text style={styles.callPermissionAllowText}>{translateUiText("Continue")}</Text>}
            </TouchableOpacity>
            <TouchableOpacity
                style={styles.callPermissionNotNow}
                onPress={continueCallWithoutPermissions}
                disabled={isRequesting}
                activeOpacity={0.72}
                accessibilityRole="button"
                accessibilityLabel={translateUiText("Continue without camera and microphone")}
            >
                <Text style={styles.callPermissionNotNowText}>{translateUiText("Not now")}</Text>
            </TouchableOpacity>
        </View>
    );
};

const DeviceControls = ({ dark = true, includeFlip = false, unwrapped = false }) => {
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

    const controls = (
        <>
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
                <CallButton label={translateUiText("Flip")} icon={SwitchCamera} onPress={switchCamera} dark={dark} />
            )}
        </>
    );

    return unwrapped ? controls : <View style={styles.deviceControls}>{controls}</View>;
};

const IncomingCall = () => {
    const insets = useSafeAreaInsets();
    const { activeCall, acceptCall, rejectCall } = useCall();
    const partnerName = activeCall?.partnerName || 'Partner';

    return (
        <View style={[styles.incomingSheet, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.sheetHandle} />
            <ScrollView
                showsVerticalScrollIndicator={false}
                bounces={false}
                contentContainerStyle={styles.incomingScrollContent}
            >
                <View style={styles.incomingHeader}>
                    <CallAvatar name={partnerName} avatar={activeCall?.partnerAvatar} />
                    <View style={styles.incomingHeaderCopy}>
                        <View style={styles.incomingTypeRow}>
                            <Video color="#B43D73" size={14} strokeWidth={2.4} />
                            <Text style={styles.incomingType}>{translateUiText("Incoming video call")}</Text>
                        </View>
                        <Text style={styles.incomingName} numberOfLines={1}>{partnerName}</Text>
                        <Text style={styles.incomingBody}>{translateUiText("Choose how you want to answer.")}</Text>
                    </View>
                </View>
                <PermissionIssue compact />
                <View style={styles.incomingPreferences}>
                    <Text style={styles.incomingPreferencesLabel}>{translateUiText("Join preferences")}</Text>
                    <DeviceControls dark={false} />
                </View>
                <View style={styles.incomingActions}>
                    <TouchableOpacity
                        style={styles.declineAction}
                        onPress={rejectCall}
                        activeOpacity={0.84}
                        accessibilityRole="button"
                        accessibilityLabel={translateUiText("Decline video call")}
                    >
                        <PhoneOff color="#C7465B" size={21} strokeWidth={2.4} />
                        <Text style={styles.declineActionLabel}>{translateUiText("Decline")}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.acceptAction}
                        onPress={acceptCall}
                        activeOpacity={0.84}
                        accessibilityRole="button"
                        accessibilityLabel={translateUiText("Accept video call")}
                    >
                        <Check color="#FFF" size={22} strokeWidth={2.7} />
                        <Text style={styles.acceptActionLabel}>{translateUiText("Accept")}</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
};

const FullScreenCall = () => {
    const insets = useSafeAreaInsets();
    const { height: screenHeight } = useWindowDimensions();
    const remoteAudioLevel = useRemoteAudioLevel();
    const isCompactHeight = screenHeight < 620;
    const [controlsVisible, setControlsVisible] = useState(true);
    const {
        activeCall,
        callState,
        localStream,
        remoteStream,
        isCameraEnabled,
        isSpeakerOn,
        isRemoteCameraEnabled,
        isRemoteMuted,
        localAvatar,
        cameraPermission,
        showPermissionPrompt,
        requestingDevice,
        cancelCall,
        minimizeCall,
        toggleSpeaker,
        endCall,
    } = useCall();
    const isOutgoing = callState === CALL_STATE.OUTGOING;
    const outgoingStatus = showPermissionPrompt
        ? 'Video call'
        : activeCall?.callId
        ? 'Ringing…'
        : requestingDevice === 'microphone'
            ? 'Preparing microphone…'
            : requestingDevice === 'camera'
                ? 'Preparing camera…'
                : 'Starting call…';
    const callStatus = isOutgoing
        ? outgoingStatus
        : callState === CALL_STATE.CONNECTED ? 'Connected' : 'Connecting…';

    return (
        <View style={styles.fullScreen}>
            <StatusBar
                barStyle="light-content"
                translucent
                backgroundColor="transparent"
                hidden={!controlsVisible}
                animated
            />
            {isOutgoing && localStream && isCameraEnabled ? (
                <StreamView stream={localStream} style={styles.remoteVideo} mirror />
            ) : isOutgoing ? (
                <View style={styles.cameraPreparingSurface} accessibilityLiveRegion="polite">
                    <View style={styles.cameraPreparingIcon}>
                        {requestingDevice === 'camera' ? (
                            <ActivityIndicator color="#D84F86" size="large" />
                        ) : (
                            <VideoOff color="#D84F86" size={34} strokeWidth={2.1} />
                        )}
                    </View>
                    <Text style={styles.cameraPreparingTitle}>
                        {cameraPermission === permissions.RESULT.DENIED
                            ? translateUiText("Camera access is off")
                            : translateUiText("Preparing your camera")}
                    </Text>
                    <Text style={styles.cameraPreparingBody}>
                        {cameraPermission === permissions.RESULT.DENIED
                            ? translateUiText("Enable camera access from Settings to share your video.")
                            : translateUiText("Allow camera access to show your preview before the call connects.")}
                    </Text>
                </View>
            ) : remoteStream && isRemoteCameraEnabled ? (
                <StreamView stream={remoteStream} style={styles.remoteVideo} />
            ) : (
                <RemoteAudioPlaceholder
                    name={activeCall?.partnerName}
                    avatar={activeCall?.partnerAvatar}
                    isMuted={isRemoteMuted}
                    audioLevel={remoteAudioLevel}
                />
            )}
            <Pressable
                style={styles.callSurfaceTapTarget}
                onPress={() => {
                    if (!showPermissionPrompt) {
                        setControlsVisible(current => !current);
                    }
                }}
                accessibilityRole="button"
                accessibilityLabel={controlsVisible ? translateUiText("Hide call controls") : translateUiText("Show call controls")}
            />
            {controlsVisible && (
                <LinearGradient
                    colors={['rgba(30,16,36,0.65)', 'transparent']}
                    style={styles.topShade}
                    pointerEvents="none"
                />
            )}
            <SafeAreaView edges={['left', 'right', 'bottom']} style={styles.callSafeArea} pointerEvents="box-none">
                {controlsVisible && (
                    <View style={[styles.callHeader, { paddingTop: insets.top + 10 }]}>
                        <View style={styles.callHeaderSide}>
                            {showPermissionPrompt ? (
                                <TouchableOpacity
                                    style={styles.minimizeButton}
                                    onPress={cancelCall}
                                    accessibilityRole="button"
                                    accessibilityLabel={translateUiText("Close permission prompt and cancel call")}
                                >
                                    <X color="#FFF" size={24} strokeWidth={2.3} />
                                </TouchableOpacity>
                            ) : !isOutgoing ? (
                                <TouchableOpacity
                                    style={styles.minimizeButton}
                                    onPress={minimizeCall}
                                    accessibilityRole="button"
                                    accessibilityLabel={translateUiText("Minimize call")}
                                >
                                    <Minimize2 color="#FFF" size={24} strokeWidth={2.3} />
                                </TouchableOpacity>
                            ) : null}
                        </View>
                        <View style={styles.partnerHeaderCopy}>
                            <View style={styles.connectionRow}>
                                <Text style={styles.connectionLabel} accessibilityLiveRegion="polite">
                                    {callStatus}
                                </Text>
                                {!isOutgoing && isRemoteMuted && (
                                    <View style={styles.headerMutedBadge}>
                                        <MicOff color="#FFF" size={11} strokeWidth={2.3} />
                                        <Text style={styles.headerMutedText}>{translateUiText("Mic off")}</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                        <View style={styles.callHeaderSide} />
                    </View>
                )}

                {!isOutgoing && (
                    <View style={[
                        styles.localPreview,
                        isCompactHeight && styles.localPreviewCompact,
                        { top: Math.max(32, insets.top + 32) },
                    ]}>
                        {localStream && isCameraEnabled ? (
                            <StreamView
                                stream={localStream}
                                style={styles.localVideo}
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
                                    <Text style={styles.localCameraOffText}>{translateUiText("Camera off")}</Text>
                                </View>
                            </LinearGradient>
                        )}
                    </View>
                )}

                {showPermissionPrompt ? (
                    <CallPermissionPrompt />
                ) : controlsVisible && (
                    <View>
                        <PermissionIssue />
                        <View style={[styles.controlsPanel, isCompactHeight && styles.controlsPanelCompact]}>
                            <DeviceControls includeFlip={isCameraEnabled} unwrapped />
                            <CallButton
                                label={isSpeakerOn ? translateUiText("Speaker") : translateUiText("Earpiece")}
                                icon={isSpeakerOn ? Volume2 : Volume1}
                                onPress={toggleSpeaker}
                                enabled={isSpeakerOn}
                            />
                            <CallButton
                                label={isOutgoing ? translateUiText("Cancel") : translateUiText("End")}
                                icon={PhoneOff}
                                onPress={isOutgoing ? cancelCall : endCall}
                                danger
                            />
                        </View>
                    </View>
                )}
            </SafeAreaView>
        </View>
    );
};

const FloatingCall = () => {
    const insets = useSafeAreaInsets();
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const { activeCall, callState, remoteStream, isMuted, isRemoteCameraEnabled, expandCall, toggleMute, endCall } = useCall();
    const initialPosition = useRef({
        x: screenWidth - BUBBLE_WIDTH - 14,
        y: insets.top + 58,
    }).current;
    const position = useRef(new Animated.ValueXY(initialPosition)).current;
    const currentPosition = useRef(initialPosition);
    const gestureOrigin = useRef(initialPosition);

    const clampPosition = useCallback((nextPosition) => {
        const minY = insets.top + BUBBLE_EDGE_GAP;
        const maxX = Math.max(BUBBLE_EDGE_GAP, screenWidth - BUBBLE_WIDTH - BUBBLE_EDGE_GAP);
        const maxY = Math.max(minY, screenHeight - BUBBLE_HEIGHT - insets.bottom - BUBBLE_EDGE_GAP);
        return {
            x: Math.max(BUBBLE_EDGE_GAP, Math.min(maxX, nextPosition.x)),
            y: Math.max(minY, Math.min(maxY, nextPosition.y)),
        };
    }, [insets.bottom, insets.top, screenHeight, screenWidth]);

    const setBubblePosition = useCallback((nextPosition) => {
        const next = clampPosition(nextPosition);
        currentPosition.current = next;
        position.setValue(next);
    }, [clampPosition, position]);

    useEffect(() => {
        setBubblePosition(currentPosition.current);
    }, [setBubblePosition]);

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

    const handleAccessibilityAction = useCallback((event) => {
        const { x, y } = currentPosition.current;
        switch (event.nativeEvent.actionName) {
            case 'activate':
                expandCall();
                break;
            case 'moveLeft':
                setBubblePosition({ x: x - BUBBLE_ACCESSIBILITY_STEP, y });
                break;
            case 'moveRight':
                setBubblePosition({ x: x + BUBBLE_ACCESSIBILITY_STEP, y });
                break;
            case 'moveUp':
                setBubblePosition({ x, y: y - BUBBLE_ACCESSIBILITY_STEP });
                break;
            case 'moveDown':
                setBubblePosition({ x, y: y + BUBBLE_ACCESSIBILITY_STEP });
                break;
            default:
                break;
        }
    }, [expandCall, setBubblePosition]);

    return (
        <Animated.View style={[styles.floatingBubble, position.getLayout()]} {...panResponder.panHandlers}>
            <TouchableOpacity
                style={styles.bubbleTapArea}
                onPress={expandCall}
                activeOpacity={0.96}
                accessibilityRole="button"
                accessibilityLabel={callState === CALL_STATE.CONNECTING ? translateUiText("Connecting call") : translateUiText("Active video call")}
                accessibilityHint={translateUiText("Activate to expand. Accessibility actions can move the call window.")}
                accessibilityActions={[
                    { name: 'activate', label: translateUiText("Expand call") },
                    { name: 'moveLeft', label: translateUiText("Move left") },
                    { name: 'moveRight', label: translateUiText("Move right") },
                    { name: 'moveUp', label: translateUiText("Move up") },
                    { name: 'moveDown', label: translateUiText("Move down") },
                ]}
                onAccessibilityAction={handleAccessibilityAction}
            >
                {remoteStream && isRemoteCameraEnabled ? (
                    <StreamView stream={remoteStream} style={styles.bubbleVideo} />
                ) : (
                    <PersonPlaceholder name={activeCall?.partnerName} avatar={activeCall?.partnerAvatar} compact />
                )}
            </TouchableOpacity>
            <View style={styles.inCallBadge}>
                <Text style={styles.inCallText} accessibilityLiveRegion="polite">
                    {callState === CALL_STATE.CONNECTING ? translateUiText("Connecting") : translateUiText("In call")}
                </Text>
            </View>
            <View style={styles.bubbleControls}>
                <TouchableOpacity
                    style={styles.bubbleButton}
                    onPress={toggleMute}
                    accessibilityRole="button"
                    accessibilityLabel={isMuted ? translateUiText("Unmute microphone") : translateUiText("Mute microphone")}
                    accessibilityState={{ selected: !isMuted }}
                >
                    {isMuted
                        ? <MicOff color="#FFF" size={16} strokeWidth={2.4} />
                        : <Mic color="#FFF" size={16} strokeWidth={2.4} />}
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.bubbleButton, styles.bubbleEnd]}
                    onPress={endCall}
                    accessibilityRole="button"
                    accessibilityLabel={translateUiText("End call")}
                >
                    <PhoneOff color="#FFF" size={15} strokeWidth={2.4} />
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
};

const ErrorToast = ({ message }) => {
    if (!message) return null;

    return (
        <View
            style={styles.errorToast}
            accessibilityRole="alert"
            accessibilityLiveRegion="assertive"
            pointerEvents="none"
        >
            <Text style={styles.errorToastText}>{translateUiText(message)}</Text>
        </View>
    );
};

const FailedCall = ({ message, onClose }) => (
    <View style={styles.failedBackdrop}>
        <View style={styles.failedCard} accessibilityRole="alert">
            <PhoneOff color="#D84F68" size={30} strokeWidth={2.3} />
            <Text style={styles.failedTitle}>{translateUiText("Call ended")}</Text>
            <Text style={styles.failedMessage}>{translateUiText(message || "The video call could not be connected.")}</Text>
            <TouchableOpacity
                style={styles.failedCloseButton}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel={translateUiText("Close call error")}
            >
                <Text style={styles.failedCloseText}>{translateUiText("Close")}</Text>
            </TouchableOpacity>
        </View>
    </View>
);

export const CallOverlay = () => {
    const {
        callState,
        isExpanded,
        errorMessage,
        cancelCall,
        dismissFailedCall,
        minimizeCall,
        rejectCall,
    } = useCall();
    const [isIncomingSheetReady, setIsIncomingSheetReady] = useState(false);
    const isModalCallVisible = callState === CALL_STATE.INCOMING
        || (isExpanded && [CALL_STATE.OUTGOING, CALL_STATE.CONNECTING, CALL_STATE.CONNECTED].includes(callState));

    useEffect(() => {
        if (callState !== CALL_STATE.INCOMING) {
            setIsIncomingSheetReady(false);
            return undefined;
        }

        // Give an already-presented native app modal one moment to dismiss.
        // Without this handoff iOS can reject the incoming-call presentation.
        const timer = setTimeout(() => setIsIncomingSheetReady(true), 180);
        return () => clearTimeout(timer);
    }, [callState]);

    return (
        <>
            <Modal
                visible={callState === CALL_STATE.INCOMING && isIncomingSheetReady}
                transparent
                animationType="slide"
                statusBarTranslucent
                onRequestClose={rejectCall}
            >
                <View style={styles.incomingBackdrop}>
                    <IncomingCall />
                    <ErrorToast message={errorMessage} />
                </View>
            </Modal>

            <Modal
                visible={isExpanded && [CALL_STATE.OUTGOING, CALL_STATE.CONNECTING, CALL_STATE.CONNECTED].includes(callState)}
                animationType="slide"
                statusBarTranslucent
                onRequestClose={callState === CALL_STATE.OUTGOING ? cancelCall : minimizeCall}
            >
                <FullScreenCall />
                <ErrorToast message={errorMessage} />
            </Modal>

            {[CALL_STATE.CONNECTING, CALL_STATE.CONNECTED].includes(callState) && !isExpanded && <FloatingCall />}

            <Modal
                visible={callState === CALL_STATE.FAILED}
                transparent
                animationType="fade"
                statusBarTranslucent
                onRequestClose={dismissFailedCall}
            >
                <FailedCall message={errorMessage} onClose={dismissFailedCall} />
            </Modal>

            {!isModalCallVisible && callState !== CALL_STATE.FAILED && <ErrorToast message={errorMessage} />}
        </>
    );
};

const styles = StyleSheet.create({
    incomingBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(35,20,43,0.42)' },
    incomingSheet: { maxHeight: '92%', backgroundColor: '#FFF9FC', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 20, paddingTop: 10, shadowColor: '#321B33', shadowOpacity: 0.18, shadowRadius: 24, elevation: 0 },
    incomingScrollContent: { paddingBottom: 2 },
    sheetHandle: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: '#DDCFD9', marginBottom: 20 },
    sheetAvatar: { width: 68, height: 68, borderRadius: 24, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFF' },
    sheetAvatarImage: { width: '100%', height: '100%' },
    sheetAvatarText: { color: '#B94378', fontFamily: fontFamily.bold, fontSize: 29 },
    incomingHeader: { flexDirection: 'row', alignItems: 'center' },
    incomingHeaderCopy: { flex: 1, marginLeft: 14 },
    incomingTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    incomingType: { color: '#B43D73', fontFamily: fontFamily.bold, fontSize: 12 },
    incomingName: { color: '#3D303F', fontFamily: fontFamily.bold, fontSize: 23, marginTop: 3 },
    incomingBody: { color: '#817282', fontFamily: fontFamily.regular, fontSize: 13, marginTop: 2 },
    incomingPreferences: { marginTop: 18, paddingVertical: 15, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#F8EEF4' },
    incomingPreferencesLabel: { color: '#766378', fontFamily: fontFamily.bold, fontSize: 11, textAlign: 'center', marginBottom: 12 },
    personPlaceholder: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
    compactPlaceholder: { flex: 0, width: 82, height: 82, borderRadius: 30 },
    avatar: { width: 108, height: 108, borderRadius: 54, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
    compactAvatar: { width: 64, height: 64, borderRadius: 32 },
    avatarImage: { width: 108, height: 108 },
    compactAvatarImage: { width: 64, height: 64 },
    avatarText: { color: '#BE4C80', fontFamily: fontFamily.bold, fontSize: 48 },
    compactAvatarText: { fontSize: 28 },
    placeholderName: { fontFamily: fontFamily.bold, fontSize: 24, color: '#583D5B', marginTop: 16 },
    permissionBanner: { marginHorizontal: 16, marginBottom: 10, padding: 12, borderRadius: 16, backgroundColor: 'rgba(255,249,252,0.96)', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
    compactPermissionBanner: { marginHorizontal: 0, marginTop: 14, marginBottom: 2, backgroundColor: '#F9EEF5' },
    permissionCopy: { flex: 1 },
    permissionTitle: { fontFamily: fontFamily.bold, color: '#49394D', fontSize: 13 },
    permissionBody: { fontFamily: fontFamily.regular, color: '#766778', fontSize: 11, lineHeight: 15, marginTop: 2 },
    permissionDismiss: { paddingHorizontal: 6, paddingVertical: 8 },
    permissionDismissText: { fontFamily: fontFamily.medium, color: '#8B7B8E', fontSize: 11 },
    permissionSettings: { backgroundColor: '#D84F86', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 11 },
    permissionSettingsText: { fontFamily: fontFamily.bold, color: '#FFF', fontSize: 11 },
    callPermissionSheet: {
        marginHorizontal: 12,
        marginBottom: 12,
        paddingHorizontal: 20,
        paddingTop: 22,
        paddingBottom: 12,
        borderRadius: 28,
        backgroundColor: '#FFF9FC',
        shadowColor: '#170D19',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.26,
        shadowRadius: 20,
        elevation: 0,
    },
    callPermissionTitle: {
        color: '#2E2030',
        fontFamily: fontFamily.bold,
        fontSize: 19,
        textAlign: 'center',
    },
    callPermissionBody: {
        marginTop: 7,
        color: '#766778',
        fontFamily: fontFamily.regular,
        fontSize: 13,
        lineHeight: 19,
        textAlign: 'center',
    },
    callPermissionDevices: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 30,
        marginTop: 20,
        marginBottom: 20,
    },
    callPermissionDevice: {
        minWidth: 96,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
    },
    callPermissionIcon: {
        width: 43,
        height: 43,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FBE7F0',
    },
    callPermissionDeviceLabel: {
        color: '#3B2C3D',
        fontFamily: fontFamily.medium,
        fontSize: 13,
    },
    callPermissionAllow: {
        minHeight: 54,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#D84F86',
    },
    callPermissionDisabled: {
        opacity: 0.72,
    },
    callPermissionAllowText: {
        color: '#FFFFFF',
        fontFamily: fontFamily.bold,
        fontSize: 16,
    },
    callPermissionNotNow: {
        minHeight: 45,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
    },
    callPermissionNotNowText: {
        color: '#B43D73',
        fontFamily: fontFamily.bold,
        fontSize: 14,
    },
    deviceControls: { flexDirection: 'row', flexWrap: 'nowrap', justifyContent: 'center', alignItems: 'center', gap: 4 },
    controlWrap: { width: 52, alignItems: 'center' },
    controlButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
    lightControlButton: { backgroundColor: '#F3E8F0' },
    enabledControl: { backgroundColor: 'rgba(218,79,134,0.94)' },
    dangerControl: { backgroundColor: '#E34C5C' },
    controlLabel: { color: '#FFF', fontFamily: fontFamily.medium, fontSize: 10, marginTop: 6 },
    lightControlLabel: { color: '#665469' },
    topShade: { position: 'absolute', top: 0, left: 0, right: 0, height: 180 },
    incomingActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
    declineAction: { flex: 1, minHeight: 54, borderRadius: 18, backgroundColor: '#FBE8EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    declineActionLabel: { color: '#C7465B', fontFamily: fontFamily.bold, fontSize: 15 },
    acceptAction: { flex: 1.2, minHeight: 54, borderRadius: 18, backgroundColor: '#35A978', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: '#237553', shadowOpacity: 0.18, shadowRadius: 8, elevation: 0 },
    acceptActionLabel: { color: '#FFF', fontFamily: fontFamily.bold, fontSize: 15 },
    fullScreen: { flex: 1, backgroundColor: '#2F2233' },
    callSurfaceTapTarget: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
    cameraPreparingSurface: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34, backgroundColor: '#E9DFF0' },
    cameraPreparingIcon: { width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.86)' },
    cameraPreparingTitle: { marginTop: 20, color: '#49394D', fontFamily: fontFamily.bold, fontSize: 22, textAlign: 'center' },
    cameraPreparingBody: { maxWidth: 330, marginTop: 8, color: '#766778', fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, textAlign: 'center' },
    remoteVideo: { ...StyleSheet.absoluteFillObject },
    remoteAudioSurface: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
    remoteAvatarStage: { width: 230, height: 230, alignItems: 'center', justifyContent: 'center' },
    voiceRing: { position: 'absolute', borderWidth: 3, borderColor: 'rgba(216,79,134,0.9)', backgroundColor: 'rgba(216,79,134,0.08)' },
    voiceOuterRing: { width: 210, height: 210, borderRadius: 105 },
    voiceInnerRing: { width: 174, height: 174, borderRadius: 87 },
    remoteAvatar: { width: 146, height: 146, borderRadius: 73, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.94)', borderWidth: 3, borderColor: 'rgba(255,255,255,0.92)', shadowColor: '#582F59', shadowOpacity: 0.22, shadowRadius: 18, elevation: 0 },
    remoteAvatarImage: { width: 146, height: 146 },
    remoteAvatarText: { color: '#C74983', fontFamily: fontFamily.bold, fontSize: 64 },
    remotePlaceholderName: { color: '#49394D', fontFamily: fontFamily.bold, fontSize: 25, marginTop: 8 },
    remoteMicStatus: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, borderRadius: 15, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: 'rgba(74,57,77,0.72)' },
    remoteMicMutedStatus: { backgroundColor: 'rgba(94,73,96,0.72)' },
    remoteMicStatusText: { color: '#FFF', fontFamily: fontFamily.medium, fontSize: 12 },
    callSafeArea: { flex: 1, justifyContent: 'space-between', zIndex: 2 },
    callHeader: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 12, paddingTop: 10 },
    callHeaderSide: { width: 100, minHeight: 44, alignItems: 'flex-start' },
    partnerHeaderCopy: { flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: 6 },
    connectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 3 },
    connectionLabel: { fontFamily: fontFamily.medium, color: 'rgba(255,255,255,0.8)', fontSize: 13 },
    headerMutedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 4, backgroundColor: 'rgba(20,14,22,0.42)' },
    headerMutedText: { color: '#FFF', fontFamily: fontFamily.medium, fontSize: 9 },
    minimizeButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.28)' },
    localPreview: { position: 'absolute', right: 12, top: 8, width: 96, height: 136, borderRadius: 18, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.88)', backgroundColor: '#E6DDF9', shadowColor: '#251628', shadowOpacity: 0.3, shadowRadius: 12, elevation: 0 },
    localPreviewCompact: { right: 10, width: 82, height: 108, borderRadius: 15 },
    localVideo: { flex: 1 },
    localCameraOff: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    localAvatar: { width: 58, height: 58, borderRadius: 29, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.92)' },
    localAvatarImage: { width: 58, height: 58 },
    localAvatarText: { color: '#C74983', fontFamily: fontFamily.bold, fontSize: 28 },
    localCameraOffBadge: { position: 'absolute', left: 7, right: 7, bottom: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 10, paddingVertical: 5, backgroundColor: 'rgba(37,25,40,0.7)' },
    localCameraOffText: { color: '#FFF', fontFamily: fontFamily.medium, fontSize: 8 },
    controlsPanel: { flexDirection: 'row', flexWrap: 'nowrap', justifyContent: 'space-evenly', alignItems: 'center', gap: 4, marginHorizontal: 8, marginTop: 8, marginBottom: 24, paddingVertical: 14, paddingHorizontal: 4, borderRadius: 28, backgroundColor: 'rgba(26,18,29,0.68)' },
    controlsPanelCompact: { marginHorizontal: 6, marginTop: 6, marginBottom: 10, paddingVertical: 8, gap: 2 },
    floatingBubble: { position: 'absolute', width: BUBBLE_WIDTH, height: BUBBLE_HEIGHT, zIndex: 2000, elevation: 0, overflow: 'hidden', borderRadius: 22, borderWidth: 2, borderColor: '#FFF', backgroundColor: '#E6DDF9', shadowColor: '#30192F', shadowOpacity: 0.28, shadowRadius: 12 },
    bubbleVideo: { ...StyleSheet.absoluteFillObject },
    bubbleTapArea: { ...StyleSheet.absoluteFillObject },
    inCallBadge: { position: 'absolute', top: 8, left: 8, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(36,24,40,0.65)' },
    inCallText: { color: '#FFF', fontFamily: fontFamily.bold, fontSize: 9 },
    bubbleControls: { position: 'absolute', left: 7, right: 7, bottom: 7, flexDirection: 'row', justifyContent: 'space-between' },
    bubbleButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(25,18,28,0.68)' },
    bubbleEnd: { backgroundColor: 'rgba(218,65,80,0.9)' },
    failedBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'rgba(35,20,43,0.5)' },
    failedCard: { width: '100%', maxWidth: 360, alignItems: 'center', padding: 24, borderRadius: 24, backgroundColor: '#FFF9FC' },
    failedTitle: { marginTop: 12, color: '#3D303F', fontFamily: fontFamily.bold, fontSize: 20 },
    failedMessage: { marginTop: 8, color: '#766778', fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, textAlign: 'center' },
    failedCloseButton: { minWidth: 120, minHeight: 48, marginTop: 20, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D84F86' },
    failedCloseText: { color: '#FFF', fontFamily: fontFamily.bold, fontSize: 15 },
    errorToast: { position: 'absolute', left: 20, right: 20, bottom: 92, zIndex: 3000, elevation: 0, backgroundColor: '#3E303F', paddingHorizontal: 16, paddingVertical: 13, borderRadius: 16 },
    errorToastText: { color: '#FFF', fontFamily: fontFamily.medium, fontSize: 13, textAlign: 'center' },
});

export default CallOverlay;
