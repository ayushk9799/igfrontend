import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
    AppState,
    Linking,
    Platform,
} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import * as Haptics from 'expo-haptics';
import InCallManager from 'react-native-incall-manager';
import { useSelector } from 'react-redux';
import {
    MediaStream,
    mediaDevices,
    permissions,
    RTCAudioSession,
    RTCPeerConnection,
    RTCIceCandidate,
    RTCSessionDescription,
} from 'react-native-webrtc';
import { useSocketContext } from '../context/SocketContext';
import { selectUser } from '../store/slices/userSlice';
import { CALL_STATE, ICE_FAILURE_TIMEOUT_MS, STUN_URLS } from './callConstants';
import { collectSanitizedStats, getCandidateType } from './callDiagnostics';
import { translateUiTemplate, translateUiText } from '../i18n/uiTranslation';

const CallContext = createContext(null);
const RemoteAudioLevelContext = createContext(0);

const initialDiagnostic = () => ({
    startedAt: new Date().toISOString(),
    signalingCompleted: false,
    offerCreated: false,
    answerReceived: false,
    localCandidateTypes: new Set(),
    remoteCandidateTypes: new Set(),
    timeToFirstCandidateMs: undefined,
    timeToConnectedMs: undefined,
});

const initialPermissionState = {
    microphone: permissions.RESULT.PROMPT,
    camera: permissions.RESULT.PROMPT,
};

const initialMediaState = {
    microphoneEnabled: false,
    cameraEnabled: false,
};

export const CallProvider = ({ children }) => {
    const { socket, isConnected, partnerOnline } = useSocketContext();
    const user = useSelector(selectUser);
    const userId = String(user?.id || user?._id || '');
    const partnerId = String(user?.partnerId || '');
    const partnerDisplayName = user?.partnerNickname
        || user?.partnerUsername
        || user?.partnerName
        || 'Partner';

    const [callState, setCallState] = useState(CALL_STATE.IDLE);
    const [activeCall, setActiveCall] = useState(null);
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [isCameraEnabled, setIsCameraEnabled] = useState(false);
    const [isSpeakerOn, setIsSpeakerOn] = useState(false);
    const [isChangingAudioOutput, setIsChangingAudioOutput] = useState(false);
    const [remoteMediaState, setRemoteMediaState] = useState(initialMediaState);
    const [remoteAudioLevel, setRemoteAudioLevel] = useState(0);
    const [permissionState, setPermissionState] = useState(initialPermissionState);
    const [permissionIssue, setPermissionIssue] = useState(null);
    const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);
    const [requestingDevice, setRequestingDevice] = useState(null);
    const [errorMessage, setErrorMessage] = useState(null);

    const peerConnectionRef = useRef(null);
    const localStreamRef = useRef(null);
    const remoteStreamRef = useRef(null);
    const audioTrackRef = useRef(null);
    const videoTrackRef = useRef(null);
    const audioSenderRef = useRef(null);
    const videoSenderRef = useRef(null);
    const activeCallRef = useRef(null);
    const pendingCandidatesRef = useRef([]);
    const diagnosticRef = useRef(initialDiagnostic());
    const disconnectTimerRef = useRef(null);
    const connectionTimeoutRef = useRef(null);
    const finishingRef = useRef(false);
    const pendingOutgoingRef = useRef(false);
    const startingCallRef = useRef(false);
    const permissionActionRef = useRef(false);
    const settingsDeviceRef = useRef(null);
    const speakerPreferenceRef = useRef(true);
    const userMinimizedCallRef = useRef(false);
    const errorTimerRef = useRef(null);

    useEffect(() => {
        activeCallRef.current = activeCall;
    }, [activeCall]);

    const notifyError = useCallback((message) => {
        if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
        setErrorMessage(translateUiText(message));
        errorTimerRef.current = setTimeout(() => {
            errorTimerRef.current = null;
            setErrorMessage(null);
        }, 4000);
    }, []);

    useEffect(() => () => {
        if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    }, []);

    const refreshPermissionStatuses = useCallback(async () => {
        try {
            const [microphone, camera] = await Promise.all([
                permissions.query({ name: 'microphone' }),
                permissions.query({ name: 'camera' }),
            ]);
            const next = { microphone, camera };
            setPermissionState(next);
            return next;
        } catch (error) {
            return initialPermissionState;
        }
    }, []);

    const ensureLocalStream = useCallback(() => {
        if (!localStreamRef.current) {
            localStreamRef.current = new MediaStream();
            setLocalStream(localStreamRef.current);
        }
        return localStreamRef.current;
    }, []);

    const stopCallSounds = useCallback(() => {
        try {
            InCallManager.stopRingback();
        } catch (error) {
            // Ringback may not have started on this device.
        }
        try {
            InCallManager.stopRingtone();
        } catch (error) {
            // Ringtone may not have started on this device.
        }
    }, []);

    const stopMedia = useCallback(() => {
        if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current);
        if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
        disconnectTimerRef.current = null;
        connectionTimeoutRef.current = null;
        peerConnectionRef.current?.close();
        peerConnectionRef.current = null;
        audioSenderRef.current = null;
        videoSenderRef.current = null;
        localStreamRef.current?.getTracks()?.forEach(track => track.stop());
        localStreamRef.current = null;
        remoteStreamRef.current = null;
        audioTrackRef.current = null;
        videoTrackRef.current = null;
        pendingCandidatesRef.current = [];
        setLocalStream(null);
        setRemoteStream(null);
    }, []);

    const resetCall = useCallback(() => {
        stopCallSounds();
        stopMedia();
        activeCallRef.current = null;
        setActiveCall(null);
        setCallState(CALL_STATE.IDLE);
        setIsExpanded(false);
        setIsMuted(true);
        setIsCameraEnabled(false);
        setIsSpeakerOn(false);
        setIsChangingAudioOutput(false);
        speakerPreferenceRef.current = true;
        userMinimizedCallRef.current = false;
        setRemoteMediaState(initialMediaState);
        setRemoteAudioLevel(0);
        setPermissionIssue(null);
        setShowPermissionPrompt(false);
        setRequestingDevice(null);
        finishingRef.current = false;
        pendingOutgoingRef.current = false;
        startingCallRef.current = false;
        permissionActionRef.current = false;
        settingsDeviceRef.current = null;
    }, [stopCallSounds, stopMedia]);

    const sendDiagnostic = useCallback(async ({ outcome, failureCode }) => {
        const call = activeCallRef.current;
        if (!socket || !call?.callId) return;

        const pc = peerConnectionRef.current;
        const stats = await collectSanitizedStats(pc);
        const diagnostic = diagnosticRef.current;
        socket.emit('call:diagnostic', {
            callId: call.callId,
            partnerId,
            platform: Platform.OS,
            appVersion: DeviceInfo.getVersion(),
            outcome,
            failureCode,
            signalingCompleted: diagnostic.signalingCompleted,
            offerCreated: diagnostic.offerCreated,
            answerReceived: diagnostic.answerReceived,
            localCandidateTypes: [...diagnostic.localCandidateTypes],
            remoteCandidateTypes: [...diagnostic.remoteCandidateTypes],
            iceGatheringState: pc?.iceGatheringState,
            iceConnectionState: pc?.iceConnectionState,
            peerConnectionState: pc?.connectionState,
            timeToFirstCandidateMs: diagnostic.timeToFirstCandidateMs,
            timeToConnectedMs: diagnostic.timeToConnectedMs,
            startedAt: diagnostic.startedAt,
            localAudioTrackPresent: audioTrackRef.current?.readyState === 'live',
            localVideoTrackPresent: videoTrackRef.current?.readyState === 'live',
            localAudioTrackEnabled: audioTrackRef.current?.enabled === true,
            localVideoTrackEnabled: videoTrackRef.current?.enabled === true,
            remoteAudioTrackPresent: (remoteStreamRef.current?.getAudioTracks?.().length || 0) > 0,
            remoteVideoTrackPresent: (remoteStreamRef.current?.getVideoTracks?.().length || 0) > 0,
            ...stats,
        });
    }, [partnerId, socket]);

    const finishCall = useCallback(async ({
        outcome = 'ended',
        failureCode,
        notifyServer = false,
        reason = 'hangup',
        message,
    } = {}) => {
        if (finishingRef.current) return;
        finishingRef.current = true;
        stopCallSounds();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        const call = activeCallRef.current;

        if (notifyServer && socket && call?.callId) {
            socket.emit('call:end', { callId: call.callId, reason });
        }
        await sendDiagnostic({ outcome, failureCode });
        resetCall();
        if (message) notifyError(message);
        if (outcome === 'failed') setCallState(CALL_STATE.FAILED);
    }, [notifyError, resetCall, sendDiagnostic, socket, stopCallSounds]);

    const dismissFailedCall = useCallback(() => {
        if (errorTimerRef.current) {
            clearTimeout(errorTimerRef.current);
            errorTimerRef.current = null;
        }
        setErrorMessage(null);
        setCallState(current => current === CALL_STATE.FAILED ? CALL_STATE.IDLE : current);
    }, []);

    const emitLocalMediaState = useCallback((overrides = {}) => {
        const callId = activeCallRef.current?.callId;
        if (!socket || !callId) return;
        socket.emit('call:media-state', {
            callId,
            microphoneEnabled: audioTrackRef.current?.enabled === true,
            cameraEnabled: videoTrackRef.current?.enabled === true,
            ...overrides,
        });
    }, [socket]);

    const activateDevice = useCallback(async (device, requestIfNeeded = true) => {
        const isMicrophone = device === 'microphone';
        const existingTrack = isMicrophone ? audioTrackRef.current : videoTrackRef.current;
            if (existingTrack && existingTrack.readyState !== 'ended') {
            existingTrack.enabled = true;
            if (isMicrophone) setIsMuted(false);
            else setIsCameraEnabled(true);
            setPermissionIssue(current => current === device ? null : current);
            emitLocalMediaState({ [isMicrophone ? 'microphoneEnabled' : 'cameraEnabled']: true });
            return true;
        }

        setRequestingDevice(device);
        try {
            let status = await permissions.query({ name: device });
            if (status === permissions.RESULT.DENIED) {
                setPermissionState(current => ({ ...current, [device]: status }));
                setPermissionIssue(device);
                return false;
            }

            if (status !== permissions.RESULT.GRANTED) {
                if (!requestIfNeeded) return false;
                const granted = await permissions.request({ name: device });
                if (!granted) {
                    status = await permissions.query({ name: device });
                    setPermissionState(current => ({
                        ...current,
                        [device]: status === permissions.RESULT.GRANTED
                            ? status
                            : permissions.RESULT.DENIED,
                    }));
                    setPermissionIssue(device);
                    return false;
                }
                status = permissions.RESULT.GRANTED;
            }

            const capturedStream = await mediaDevices.getUserMedia({
                audio: isMicrophone,
                video: isMicrophone ? false : {
                    facingMode: 'user',
                    frameRate: 24,
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                },
            });
            const track = isMicrophone
                ? capturedStream.getAudioTracks()[0]
                : capturedStream.getVideoTracks()[0];
            if (!track) throw new Error(`No ${device} track was created.`);

            const stream = ensureLocalStream();
            stream.addTrack(track);
            const sender = isMicrophone ? audioSenderRef.current : videoSenderRef.current;
            if (sender) {
                await sender.replaceTrack(track);
                if (sender.track?.id !== track.id) {
                    stream.removeTrack(track);
                    track.stop();
                    throw new Error(`The ${device} track could not be attached to WebRTC.`);
                }
            }

            track.enabled = true;
            if (isMicrophone) {
                audioTrackRef.current = track;
                setIsMuted(false);
            } else {
                videoTrackRef.current = track;
                setIsCameraEnabled(true);
            }
            setLocalStream(new MediaStream(stream.getTracks()));
            setPermissionState(current => ({ ...current, [device]: permissions.RESULT.GRANTED }));
            setPermissionIssue(null);
            emitLocalMediaState({ [isMicrophone ? 'microphoneEnabled' : 'cameraEnabled']: true });
            return true;
        } catch (error) {
            const status = await permissions.query({ name: device }).catch(() => permissions.RESULT.DENIED);
            setPermissionState(current => ({ ...current, [device]: status }));
            if (status === permissions.RESULT.DENIED) setPermissionIssue(device);
            else notifyError(translateUiTemplate("Unable to start the {{0}}. Please try again.", [
                translateUiText(device),
            ]));
            return false;
        } finally {
            setRequestingDevice(null);
        }
    }, [emitLocalMediaState, ensureLocalStream, notifyError]);

    const toggleMute = useCallback(async () => {
        const track = audioTrackRef.current;
        if (!track || track.readyState === 'ended') {
            await activateDevice('microphone');
            return;
        }
        track.enabled = !track.enabled;
        setIsMuted(!track.enabled);
        emitLocalMediaState({ microphoneEnabled: track.enabled });
    }, [activateDevice, emitLocalMediaState]);

    const toggleCamera = useCallback(async () => {
        const track = videoTrackRef.current;
        if (!track || track.readyState === 'ended') {
            await activateDevice('camera');
            return;
        }
        track.enabled = !track.enabled;
        setIsCameraEnabled(track.enabled);
        emitLocalMediaState({ cameraEnabled: track.enabled });
    }, [activateDevice, emitLocalMediaState]);

    const createPeerConnection = useCallback(async (callId, { attachLocalMedia = true } = {}) => {
        peerConnectionRef.current?.close();
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: STUN_URLS }],
            iceCandidatePoolSize: 4,
        });
        peerConnectionRef.current = pc;

        if (attachLocalMedia) {
            const streamOptions = localStreamRef.current ? { streams: [localStreamRef.current] } : {};
            const audioTransceiver = audioTrackRef.current
                ? pc.addTransceiver(audioTrackRef.current, { direction: 'sendrecv', ...streamOptions })
                : pc.addTransceiver('audio', { direction: 'sendrecv' });
            const videoTransceiver = videoTrackRef.current
                ? pc.addTransceiver(videoTrackRef.current, { direction: 'sendrecv', ...streamOptions })
                : pc.addTransceiver('video', { direction: 'sendrecv' });
            audioSenderRef.current = audioTransceiver.sender;
            videoSenderRef.current = videoTransceiver.sender;

            if (audioTrackRef.current && audioSenderRef.current.track?.id !== audioTrackRef.current.id) {
                throw new Error('The microphone track was not attached to the peer connection.');
            }
            if (videoTrackRef.current && videoSenderRef.current.track?.id !== videoTrackRef.current.id) {
                throw new Error('The camera track was not attached to the peer connection.');
            }
        } else {
            audioSenderRef.current = null;
            videoSenderRef.current = null;
        }

        pc.addEventListener('track', event => {
            const streamFromEvent = event.streams?.[0];
            if (streamFromEvent) {
                remoteStreamRef.current = streamFromEvent;
                setRemoteStream(streamFromEvent);
                return;
            }
            if (!remoteStreamRef.current) remoteStreamRef.current = new MediaStream();
            const alreadyAdded = remoteStreamRef.current.getTracks().some(track => track.id === event.track.id);
            if (!alreadyAdded) remoteStreamRef.current.addTrack(event.track);
            setRemoteStream(new MediaStream(remoteStreamRef.current.getTracks()));
        });

        pc.addEventListener('icecandidate', event => {
            if (!event.candidate) return;
            const diagnostic = diagnosticRef.current;
            diagnostic.localCandidateTypes.add(getCandidateType(event.candidate));
            if (diagnostic.timeToFirstCandidateMs === undefined) {
                diagnostic.timeToFirstCandidateMs = Date.now() - new Date(diagnostic.startedAt).getTime();
            }
            socket?.emit('webrtc:ice-candidate', {
                callId,
                candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
            });
        });

        const connectionFailure = () => {
            const signalingCompleted = diagnosticRef.current.signalingCompleted;
            return {
                failureCode: signalingCompleted ? 'ice_connectivity_failed_no_relay' : 'signaling_timeout',
                message: signalingCompleted
                    ? 'Couldn’t connect on this network. Try switching between Wi-Fi and mobile data.'
                    : 'The call could not finish connecting. Please try again.',
            };
        };

        const handleConnectionChange = () => {
            const state = pc.connectionState;
            if (state === 'connected') {
                if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current);
                if (connectionTimeoutRef.current) clearTimeout(connectionTimeoutRef.current);
                connectionTimeoutRef.current = null;
                diagnosticRef.current.signalingCompleted = true;
                diagnosticRef.current.timeToConnectedMs = Date.now() - new Date(diagnosticRef.current.startedAt).getTime();
                setCallState(CALL_STATE.CONNECTED);
                if (!userMinimizedCallRef.current) setIsExpanded(true);
            } else if (state === 'failed') {
                const failure = connectionFailure();
                finishCall({
                    outcome: 'failed',
                    failureCode: failure.failureCode,
                    notifyServer: true,
                    reason: 'ice_failed',
                    message: failure.message,
                });
            } else if (state === 'disconnected') {
                if (disconnectTimerRef.current) clearTimeout(disconnectTimerRef.current);
                disconnectTimerRef.current = setTimeout(() => {
                    if (pc.connectionState === 'disconnected') {
                        const failure = connectionFailure();
                        finishCall({
                            outcome: 'failed',
                            failureCode: failure.failureCode,
                            notifyServer: true,
                            reason: 'ice_disconnected',
                            message: diagnosticRef.current.signalingCompleted
                                ? 'The call lost its network connection.'
                                : failure.message,
                        });
                    }
                }, ICE_FAILURE_TIMEOUT_MS);
            }
        };

        pc.addEventListener('connectionstatechange', handleConnectionChange);
        connectionTimeoutRef.current = setTimeout(() => {
            if (!['connected', 'closed'].includes(pc.connectionState)) {
                const failure = connectionFailure();
                finishCall({
                    outcome: 'failed',
                    failureCode: failure.failureCode,
                    notifyServer: true,
                    reason: 'ice_timeout',
                    message: failure.message,
                });
            }
        }, 12_000);
        return pc;
    }, [finishCall, socket]);

    const attachAnswerTracks = useCallback((pc) => {
        const stream = ensureLocalStream();
        const attachTrack = (track, senderRef, label) => {
            if (!track || track.readyState === 'ended') return;
            const sender = pc.addTrack(track, stream);
            if (sender.track?.id !== track.id) {
                throw new Error(`The ${label} track was not attached to the answer.`);
            }
            senderRef.current = sender;
        };

        // With the remote offer already applied, addTrack reuses its matching
        // recv-only transceiver and promotes it to sendrecv for the answer.
        attachTrack(audioTrackRef.current, audioSenderRef, 'microphone');
        attachTrack(videoTrackRef.current, videoSenderRef, 'camera');
    }, [ensureLocalStream]);

    const flushPendingCandidates = useCallback(async () => {
        const pc = peerConnectionRef.current;
        if (!pc?.remoteDescription) return;
        const queued = pendingCandidatesRef.current.splice(0);
        for (const candidate of queued) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
    }, []);

    const beginOutgoingCall = useCallback(() => {
        permissionActionRef.current = false;
        if (!pendingOutgoingRef.current || !activeCallRef.current || activeCallRef.current.callId) {
            startingCallRef.current = false;
            setShowPermissionPrompt(false);
            return;
        }
        if (!socket?.connected) {
            resetCall();
            notifyError('You are offline. Reconnect before starting a call.');
            return;
        }

        setShowPermissionPrompt(false);
        startingCallRef.current = false;
        diagnosticRef.current = initialDiagnostic();
        socket.emit('call:start', {
            mediaType: 'video',
            microphoneEnabled: audioTrackRef.current?.enabled === true,
            cameraEnabled: videoTrackRef.current?.enabled === true,
        });
    }, [notifyError, resetCall, socket]);

    const allowCallPermissions = useCallback(async () => {
        if (!pendingOutgoingRef.current || requestingDevice || permissionActionRef.current) return;
        permissionActionRef.current = true;
        try {
            await activateDevice('camera', true);
            if (!pendingOutgoingRef.current) return;
            await activateDevice('microphone', true);
            if (!pendingOutgoingRef.current) return;
            beginOutgoingCall();
        } finally {
            permissionActionRef.current = false;
        }
    }, [activateDevice, beginOutgoingCall, requestingDevice]);

    const continueCallWithoutPermissions = useCallback(() => {
        if (!pendingOutgoingRef.current || requestingDevice || permissionActionRef.current) return;
        permissionActionRef.current = true;
        beginOutgoingCall();
    }, [beginOutgoingCall, requestingDevice]);

    const startCall = useCallback(async () => {
        if (startingCallRef.current) return;
        if (!partnerId) {
            notifyError('Pair with a partner before starting a call.');
            return;
        }
        if (!isConnected || !socket) {
            notifyError('You are offline. Reconnect before starting a call.');
            return;
        }
        if (callState !== CALL_STATE.IDLE) {
            setIsExpanded(true);
            return;
        }

        const pendingCall = {
            callId: null,
            callerId: userId,
            calleeId: partnerId,
            partnerName: partnerDisplayName,
            partnerAvatar: user.partnerAvatarThumbnail || user.partnerAvatar || null,
            mediaType: 'video',
        };
        startingCallRef.current = true;
        activeCallRef.current = pendingCall;
        userMinimizedCallRef.current = false;
        pendingOutgoingRef.current = true;
        setActiveCall(pendingCall);
        setCallState(CALL_STATE.OUTGOING);
        setIsExpanded(true);
        setPermissionIssue(null);

        const statuses = await refreshPermissionStatuses();

        if (!pendingOutgoingRef.current || activeCallRef.current !== pendingCall) {
            resetCall();
            return;
        }

        const permissionsReady = statuses.camera === permissions.RESULT.GRANTED
            && statuses.microphone === permissions.RESULT.GRANTED;
        if (!permissionsReady) {
            setShowPermissionPrompt(true);
            return;
        }

        await activateDevice('camera', false);
        if (!pendingOutgoingRef.current || activeCallRef.current !== pendingCall) {
            resetCall();
            return;
        }
        await activateDevice('microphone', false);
        if (!pendingOutgoingRef.current || activeCallRef.current !== pendingCall) {
            resetCall();
            return;
        }
        beginOutgoingCall();
    }, [activateDevice, beginOutgoingCall, callState, isConnected, notifyError, partnerDisplayName, partnerId, refreshPermissionStatuses, resetCall, socket, user.partnerAvatar, user.partnerAvatarThumbnail, userId]);

    const acceptCall = useCallback(async () => {
        const call = activeCallRef.current;
        if (!call?.callId) return;
        stopCallSounds();
        diagnosticRef.current = initialDiagnostic();

        // The caller prepares devices before the outgoing screen appears.
        // Do the equivalent for the answering side only after they tap Accept,
        // so a video call is symmetric without activating devices while ringing.
        await refreshPermissionStatuses();
        if (!audioTrackRef.current) {
            await activateDevice('microphone', true);
        }
        if (call.mediaType !== 'audio' && !videoTrackRef.current) {
            await activateDevice('camera', true);
        }

        setCallState(CALL_STATE.CONNECTING);
        userMinimizedCallRef.current = false;
        setIsExpanded(true);
        socket.emit('call:accept', {
            callId: call.callId,
            microphoneEnabled: audioTrackRef.current?.enabled === true,
            cameraEnabled: videoTrackRef.current?.enabled === true,
        });
    }, [activateDevice, refreshPermissionStatuses, socket, stopCallSounds]);

    const rejectCall = useCallback(() => {
        const call = activeCallRef.current;
        if (call?.callId) socket?.emit('call:reject', { callId: call.callId });
        finishCall({ outcome: 'rejected' });
    }, [finishCall, socket]);

    const cancelCall = useCallback(() => {
        const call = activeCallRef.current;
        if (call?.callId) socket?.emit('call:cancel', { callId: call.callId });
        finishCall({ outcome: 'cancelled' });
    }, [finishCall, socket]);

    const endCall = useCallback(() => {
        finishCall({ outcome: 'ended', notifyServer: true, reason: 'hangup' });
    }, [finishCall]);

    const switchCamera = useCallback(() => {
        videoTrackRef.current?._switchCamera?.();
    }, []);

    const applySpeakerRoute = useCallback(async (enabled) => {
        if (Platform.OS === 'ios') {
            const result = await RTCAudioSession.setAudioOutput(enabled);
            if (result.speaker !== enabled) {
                throw new Error(`Native audio route remained ${result.route}.`);
            }
            return result;
        }

        InCallManager.setForceSpeakerphoneOn(enabled);
        InCallManager.setSpeakerphoneOn(enabled);
        return { route: enabled ? 'speaker' : 'earpiece', speaker: enabled };
    }, []);

    const applyConfirmedSpeakerRoute = useCallback(async (enabled) => {
        let lastError;
        const retryDelays = [0, 300, 700];

        for (const delay of retryDelays) {
            if (delay) {
                await new Promise(resolve => setTimeout(resolve, delay));
            }
            try {
                return await applySpeakerRoute(enabled);
            } catch (error) {
                lastError = error;
            }
        }

        throw lastError;
    }, [applySpeakerRoute]);

    const toggleSpeaker = useCallback(async () => {
        if (isChangingAudioOutput) return;
        const previous = speakerPreferenceRef.current;
        const next = !speakerPreferenceRef.current;

        // Audio-route confirmation is intentionally delayed on iOS. Reflect the
        // user's choice immediately and verify/retry the native route silently.
        speakerPreferenceRef.current = next;
        setIsSpeakerOn(next);
        setIsChangingAudioOutput(true);
        try {
            await applyConfirmedSpeakerRoute(next);
        } catch (error) {
            speakerPreferenceRef.current = previous;
            setIsSpeakerOn(previous);
            notifyError('The phone did not change its audio output.');
        } finally {
            setIsChangingAudioOutput(false);
        }
    }, [applyConfirmedSpeakerRoute, isChangingAudioOutput, notifyError]);

    const openPermissionSettings = useCallback((device = permissionIssue) => {
        settingsDeviceRef.current = device;
        Linking.openSettings();
    }, [permissionIssue]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', async nextState => {
            if (nextState !== 'active') return;
            const statuses = await refreshPermissionStatuses();
            if (statuses.microphone !== permissions.RESULT.GRANTED && audioTrackRef.current) {
                audioTrackRef.current.enabled = false;
                setIsMuted(true);
                emitLocalMediaState({ microphoneEnabled: false });
            }
            if (statuses.camera !== permissions.RESULT.GRANTED && videoTrackRef.current) {
                videoTrackRef.current.enabled = false;
                setIsCameraEnabled(false);
                emitLocalMediaState({ cameraEnabled: false });
            }
            const device = settingsDeviceRef.current;
            if (device && statuses[device] === permissions.RESULT.GRANTED) {
                settingsDeviceRef.current = null;
                setPermissionIssue(null);
                await activateDevice(device, false);
            }
        });
        return () => subscription.remove();
    }, [activateDevice, emitLocalMediaState, refreshPermissionStatuses]);

    useEffect(() => {
        try {
            if (callState === CALL_STATE.INCOMING) {
                InCallManager.startRingtone('_BUNDLE_', [0, 700, 500, 700, 500, 700]);
            }
        } catch (error) {
            // A ringtone failure should not prevent the call from continuing.
        }

        return stopCallSounds;
    }, [callState, stopCallSounds]);

    const isCallAudioActive = [CALL_STATE.CONNECTING, CALL_STATE.CONNECTED].includes(callState);
    useEffect(() => {
        if (!isCallAudioActive) return undefined;

        if (Platform.OS === 'android') {
            try {
                InCallManager.start({ media: 'video', auto: true });
            } catch (error) {
                notifyError('Unable to start call audio.');
            }
        }

        return () => {
            if (Platform.OS === 'android') {
                try {
                    InCallManager.setForceSpeakerphoneOn(null);
                    InCallManager.stop();
                } catch (error) {
                    // Native audio routing may already be released during teardown.
                }
            }
        };
    }, [isCallAudioActive, notifyError]);

    useEffect(() => {
        if (callState !== CALL_STATE.CONNECTED) return undefined;

        // WebRTC activates its native audio session while the peer connection
        // becomes connected. Reassert the selected route after that transition
        // so its session configuration cannot return video audio to the earpiece.
        let cancelled = false;
        const reapplyRoute = async (isFinalAttempt = false) => {
            try {
                const desiredSpeaker = speakerPreferenceRef.current;
                const result = await applySpeakerRoute(desiredSpeaker);
                if (!cancelled && speakerPreferenceRef.current === desiredSpeaker) {
                    setIsSpeakerOn(result.speaker);
                }
            } catch (error) {
                if (isFinalAttempt && !cancelled) {
                    notifyError('The phone did not switch to loudspeaker.');
                }
            }
        };
        reapplyRoute();
        const settleTimer = setTimeout(reapplyRoute, 500);
        const finalTimer = setTimeout(() => reapplyRoute(true), 1500);
        return () => {
            cancelled = true;
            clearTimeout(settleTimer);
            clearTimeout(finalTimer);
        };
    }, [applySpeakerRoute, callState, notifyError]);

    useEffect(() => {
        if (callState !== CALL_STATE.CONNECTED || !remoteMediaState.microphoneEnabled) {
            setRemoteAudioLevel(0);
            return undefined;
        }

        let cancelled = false;
        let reading = false;
        let previousEnergy;
        let previousDuration;
        const readAudioLevel = async () => {
            if (reading || !peerConnectionRef.current) return;
            reading = true;
            try {
                const report = await peerConnectionRef.current.getStats();
                const values = [];
                report?.forEach?.(value => values.push(value));
                const inboundAudio = values.find(value => (
                    value.type === 'inbound-rtp'
                    && !value.isRemote
                    && (value.kind === 'audio' || value.mediaType === 'audio')
                ));
                let level = Number(inboundAudio?.audioLevel);
                const energy = Number(inboundAudio?.totalAudioEnergy);
                const duration = Number(inboundAudio?.totalSamplesDuration);
                if (!Number.isFinite(level) && Number.isFinite(energy) && Number.isFinite(duration)
                    && Number.isFinite(previousEnergy) && duration > previousDuration) {
                    level = Math.sqrt(Math.max(0, (energy - previousEnergy) / (duration - previousDuration)));
                }
                previousEnergy = energy;
                previousDuration = duration;
                if (!cancelled) {
                    const normalized = Number.isFinite(level) ? Math.min(1, Math.max(0, level * 2.4)) : 0;
                    setRemoteAudioLevel(current => (current * 0.62) + (normalized * 0.38));
                }
            } catch (error) {
                if (!cancelled) setRemoteAudioLevel(0);
            } finally {
                reading = false;
            }
        };

        readAudioLevel();
        const interval = setInterval(readAudioLevel, 250);
        return () => {
            cancelled = true;
            clearInterval(interval);
            setRemoteAudioLevel(0);
        };
    }, [callState, remoteMediaState.microphoneEnabled]);

    useEffect(() => {
        if (!socket) return undefined;

        const onOutgoing = call => {
            if (!pendingOutgoingRef.current) {
                socket.emit('call:cancel', { callId: call.callId });
                return;
            }
            pendingOutgoingRef.current = false;
            const outgoingCall = {
                ...activeCallRef.current,
                ...call,
                partnerName: partnerDisplayName,
                partnerAvatar: user.partnerAvatarThumbnail || user.partnerAvatar || null,
            };
            activeCallRef.current = outgoingCall;
            setActiveCall(outgoingCall);
            emitLocalMediaState();
        };
        const onIncoming = async call => {
            if (activeCallRef.current) return;
            diagnosticRef.current = initialDiagnostic();
            const incomingCall = {
                ...call,
                partnerName: user.partnerNickname || call.callerNickname || call.callerName || partnerDisplayName,
                partnerAvatar: user.partnerAvatarThumbnail || user.partnerAvatar || null,
            };
            activeCallRef.current = incomingCall;
            setActiveCall(incomingCall);
            setCallState(CALL_STATE.INCOMING);
            setIsMuted(true);
            setIsCameraEnabled(false);
            setPermissionIssue(null);
            setRemoteMediaState(call.partnerMediaState || initialMediaState);
            await refreshPermissionStatuses();
        };
        const onAccepted = async data => {
            const call = activeCallRef.current;
            if (!call || data.callId !== call.callId || call.callerId !== userId) return;
            stopCallSounds();
            try {
                setRemoteMediaState(data.partnerMediaState || initialMediaState);
                setCallState(CALL_STATE.CONNECTING);
                userMinimizedCallRef.current = false;
                setIsExpanded(true);
                const pc = await createPeerConnection(call.callId);
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                diagnosticRef.current.offerCreated = true;
                socket.emit('webrtc:offer', { callId: call.callId, description: offer });
            } catch (error) {
                finishCall({ outcome: 'failed', failureCode: 'offer_failed', notifyServer: true, message: translateUiText("Unable to start the video connection.") });
            }
        };
        const onOffer = async data => {
            const call = activeCallRef.current;
            if (!call || data.callId !== call.callId) return;
            try {
                // Apply the offer before adding answer-side tracks. This lets
                // addTrack reuse the offer's audio/video transceivers instead
                // of creating unrelated transceivers that negotiate recv-only.
                const pc = await createPeerConnection(call.callId, { attachLocalMedia: false });
                await pc.setRemoteDescription(new RTCSessionDescription(data.description));
                attachAnswerTracks(pc);
                await flushPendingCandidates();
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                diagnosticRef.current.signalingCompleted = true;
                socket.emit('webrtc:answer', { callId: call.callId, description: answer });
            } catch (error) {
                finishCall({ outcome: 'failed', failureCode: 'answer_failed', notifyServer: true, message: translateUiText("Unable to answer the video connection.") });
            }
        };
        const onAnswer = async data => {
            const call = activeCallRef.current;
            if (!call || data.callId !== call.callId || !peerConnectionRef.current) return;
            try {
                await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.description));
                diagnosticRef.current.answerReceived = true;
                diagnosticRef.current.signalingCompleted = true;
                await flushPendingCandidates();
            } catch (error) {
                finishCall({ outcome: 'failed', failureCode: 'answer_failed', notifyServer: true, message: translateUiText("The call negotiation failed.") });
            }
        };
        const onCandidate = async data => {
            const call = activeCallRef.current;
            if (!call || data.callId !== call.callId || !data.candidate) return;
            diagnosticRef.current.remoteCandidateTypes.add(getCandidateType(data.candidate));
            const pc = peerConnectionRef.current;
            if (!pc?.remoteDescription) {
                pendingCandidatesRef.current.push(data.candidate);
                return;
            }
            try {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (error) {
                // Connection-state diagnostics capture any useful ICE failure later.
            }
        };
        const onPartnerMediaState = data => {
            if (!activeCallRef.current || data.callId !== activeCallRef.current.callId) return;
            setRemoteMediaState({
                microphoneEnabled: data.microphoneEnabled === true,
                cameraEnabled: data.cameraEnabled === true,
            });
        };
        const remoteFinish = ({ outcome, failureCode, message }) => data => {
            if (!activeCallRef.current || data.callId !== activeCallRef.current.callId) return;
            finishCall({ outcome, failureCode, message });
        };
        const onError = data => {
            if (data.callId && data.callId !== activeCallRef.current?.callId) return;
            finishCall({ outcome: 'failed', failureCode: 'signaling_timeout', message: data.message || 'The call could not be started.' });
        };

        socket.on('call:outgoing', onOutgoing);
        socket.on('call:incoming', onIncoming);
        socket.on('call:accepted', onAccepted);
        socket.on('webrtc:offer', onOffer);
        socket.on('webrtc:answer', onAnswer);
        socket.on('webrtc:ice-candidate', onCandidate);
        socket.on('call:partner-media-state', onPartnerMediaState);
        const onRejected = data => {
            const call = activeCallRef.current;
            if (!call || data.callId !== call.callId) return;
            finishCall({
                outcome: 'rejected',
                failureCode: 'partner_rejected',
                message: `${call.partnerName || partnerDisplayName} declined the call.`,
            });
        };
        const onCancelled = remoteFinish({ outcome: 'cancelled', message: translateUiText("The call was cancelled.") });
        const onMissed = remoteFinish({ outcome: 'missed', failureCode: 'ring_timeout', message: translateUiText("The call was not answered.") });
        const onEnded = remoteFinish({ outcome: 'ended', failureCode: 'remote_ended', message: translateUiText("The call ended.") });

        socket.on('call:rejected', onRejected);
        socket.on('call:cancelled', onCancelled);
        socket.on('call:missed', onMissed);
        socket.on('call:ended', onEnded);
        socket.on('call:busy', onError);
        socket.on('call:error', onError);

        const requestPendingCall = () => socket.emit('call:getPending');
        socket.on('connect', requestPendingCall);
        if (socket.connected) {
            requestPendingCall();
        }

        return () => {
            socket.off('call:outgoing', onOutgoing);
            socket.off('call:incoming', onIncoming);
            socket.off('call:accepted', onAccepted);
            socket.off('webrtc:offer', onOffer);
            socket.off('webrtc:answer', onAnswer);
            socket.off('webrtc:ice-candidate', onCandidate);
            socket.off('call:partner-media-state', onPartnerMediaState);
            socket.off('call:rejected', onRejected);
            socket.off('call:cancelled', onCancelled);
            socket.off('call:missed', onMissed);
            socket.off('call:ended', onEnded);
            socket.off('call:busy', onError);
            socket.off('call:error', onError);
            socket.off('connect', requestPendingCall);
        };
    }, [attachAnswerTracks, createPeerConnection, emitLocalMediaState, finishCall, flushPendingCandidates, partnerDisplayName, refreshPermissionStatuses, socket, stopCallSounds, user.partnerAvatar, user.partnerAvatarThumbnail, user.partnerNickname, userId]);

    useEffect(() => () => stopMedia(), [stopMedia]);

    useEffect(() => {
        if (activeCall && (!userId || !partnerId)) {
            finishCall({ outcome: 'ended', notifyServer: true, reason: 'signed_out' });
        }
    }, [activeCall, finishCall, partnerId, userId]);

    const isRemoteCameraEnabled = remoteMediaState.cameraEnabled
        && (remoteStream?.getVideoTracks?.().length || 0) > 0;

    const value = useMemo(() => ({
        callState,
        activeCall,
        localStream,
        remoteStream,
        isExpanded,
        isMuted,
        isCameraEnabled,
        isSpeakerOn,
        isChangingAudioOutput,
        isRemoteCameraEnabled,
        isRemoteMuted: !remoteMediaState.microphoneEnabled,
        localAvatar: user.avatarThumbnail || user.avatar || null,
        microphonePermission: permissionState.microphone,
        cameraPermission: permissionState.camera,
        permissionIssue,
        showPermissionPrompt,
        requestingDevice,
        errorMessage,
        dismissFailedCall,
        partnerOnline,
        allowCallPermissions,
        continueCallWithoutPermissions,
        startCall,
        acceptCall,
        rejectCall,
        cancelCall,
        endCall,
        toggleMute,
        toggleCamera,
        toggleSpeaker,
        switchCamera,
        minimizeCall: () => {
            userMinimizedCallRef.current = true;
            setIsExpanded(false);
        },
        expandCall: () => {
            userMinimizedCallRef.current = false;
            setIsExpanded(true);
        },
        dismissPermissionIssue: () => setPermissionIssue(null),
        openPermissionSettings,
    }), [
        acceptCall, activeCall, allowCallPermissions, callState, cancelCall, continueCallWithoutPermissions,
        dismissFailedCall, endCall, errorMessage, isCameraEnabled, isChangingAudioOutput, isExpanded, isMuted, isRemoteCameraEnabled, isSpeakerOn, localStream,
        openPermissionSettings, partnerOnline, permissionIssue,
        permissionState.camera, permissionState.microphone, rejectCall,
        remoteMediaState.microphoneEnabled, remoteStream, requestingDevice,
        showPermissionPrompt, startCall, switchCamera, toggleCamera, toggleMute, toggleSpeaker, user.avatar, user.avatarThumbnail,
    ]);

    return (
        <CallContext.Provider value={value}>
            <RemoteAudioLevelContext.Provider value={remoteAudioLevel}>
                {children}
            </RemoteAudioLevelContext.Provider>
        </CallContext.Provider>
    );
};

export const useCall = () => {
    const context = useContext(CallContext);
    if (!context) throw new Error('useCall must be used inside CallProvider');
    return context;
};

export const useRemoteAudioLevel = () => useContext(RemoteAudioLevelContext);

export default CallContext;
