import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    BottomSheetBackdrop,
    BottomSheetModal,
    BottomSheetView,
} from '@gorhom/bottom-sheet';
import {
    Animated,
    ActivityIndicator,
    AppState,
    BackHandler,
    Dimensions,
    Image,
    InteractionManager,
    Keyboard,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    StatusBar,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    MediaStream,
    mediaDevices,
    permissions,
    RTCPeerConnection,
    RTCIceCandidate,
    RTCSessionDescription,
    RTCView,
} from 'react-native-webrtc';
import { createSafeAudioPlayer } from '../utils/safeAudioPlayer';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Camera, Settings, Video, VideoOff } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { useSocketContext } from '../context/SocketContext';
import { useCall } from '../calling/CallContext';
import { CALL_STATE, STUN_URLS } from '../calling/callConstants';
import { API_BASE } from '../constants/Api';
import { apiFetch } from '../utils/apiFetch';
import { fontFamily, fontWeight } from '../constants/fonts';
import { clearLiveChatActive, markLiveChatActive, storage } from '../utils/authStorage';
import { translateUiTemplate, translateUiText } from '../i18n/uiTranslation';

const MAX_MESSAGE_LENGTH = 500;
const VIDEO_NEGOTIATION_TIMEOUT_MS = 12_000;
const FREE_LIVE_CHAT_LIMIT_MS = 5 * 60 * 1000;
const LIVE_CHAT_USAGE_KEY = 'live_chat_free_usage_ms_v1';
const LIVE_CHAT_INSTRUCTION_KEY = 'live_chat_instruction_seen_v1';
const LIVE_CHAT_CAMERA_PREFERENCE_KEY = 'live_chat_camera_preference_v1';
const LIVE_CHAT_CARD_HEIGHT_KEY = 'live_chat_card_height_v2';
const DEFAULT_CARD_HEIGHT = 136;
const MIN_CARD_HEIGHT = 108;
const MAX_CARD_HEIGHT = 280;
const CARD_HEIGHT_BREATHING_ROOM = 16;

const getLiveChatUsageKey = userId => `${LIVE_CHAT_USAGE_KEY}:${userId || 'device'}`;

const readLiveChatUsage = key => {
    const usage = storage.getNumber(key);
    return Number.isFinite(usage)
        ? Math.max(0, Math.min(FREE_LIVE_CHAT_LIMIT_MS, usage))
        : 0;
};

const formatFreeTime = totalSeconds => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const readCachedCardHeight = (key) => {
    const height = storage.getNumber(key);
    return Number.isFinite(height) && height >= MIN_CARD_HEIGHT && height <= MAX_CARD_HEIGHT
        ? height
        : DEFAULT_CARD_HEIGHT;
};

const makeId = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function SmoothMessageText({ text }) {
    const [displayedText, setDisplayedText] = useState(text);
    const displayedTextRef = useRef(text);
    const opacity = useRef(new Animated.Value(1)).current;
    const translateY = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (text === displayedTextRef.current) return undefined;

        const fadeOut = Animated.parallel([
            Animated.timing(opacity, {
                toValue: 0,
                duration: 110,
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: -4,
                duration: 110,
                useNativeDriver: true,
            }),
        ]);
        let fadeIn = null;

        fadeOut.start(({ finished }) => {
            if (!finished) return;
            displayedTextRef.current = text;
            setDisplayedText(text);
            translateY.setValue(5);
            fadeIn = Animated.parallel([
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 170,
                    useNativeDriver: true,
                }),
                Animated.timing(translateY, {
                    toValue: 0,
                    duration: 170,
                    useNativeDriver: true,
                }),
            ]);
            fadeIn.start();
        });

        return () => {
            fadeOut.stop();
            fadeIn?.stop();
        };
    }, [opacity, text, translateY]);

    const visibleText = displayedText || '';
    return (
        <Animated.Text
            style={[
                styles.messageText,
                !visibleText && styles.emptyMessageText,
                { opacity, transform: [{ translateY }] },
            ]}
        >
            {visibleText || '...'}
        </Animated.Text>
    );
}

export default function LiveChatScreen({
    userId,
    partnerId,
    partnerName = 'Partner',
    partnerAvatar,
    onBack,
    hasPremiumAccess = false,
    onRequestPremium,
    onOpenFreeScreen,
}) {
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const screenDimensions = Dimensions.get('screen');
    const { socket, isConnected } = useSocketContext();
    const { callState } = useCall();
    const compact = width < 370;
    const instructionStorageKey = `${LIVE_CHAT_INSTRUCTION_KEY}:${userId || 'device'}`;
    const cameraPreferenceStorageKey = `${LIVE_CHAT_CAMERA_PREFERENCE_KEY}:${userId || 'device'}`;
    const cardHeightStorageKey = `${LIVE_CHAT_CARD_HEIGHT_KEY}:${Platform.OS}:${Math.round(screenDimensions.width)}x${Math.round(screenDimensions.height)}`;
    const freeUsageStorageKey = getLiveChatUsageKey(userId);
    const hasSeenInstruction = storage.getBoolean(instructionStorageKey) === true;

    const [sessionId, setSessionId] = useState(null);
    const [participantCount, setParticipantCount] = useState(0);
    const [error, setError] = useState(null);
    const [cameraEnabled, setCameraEnabled] = useState(false);
    const [cameraDenied, setCameraDenied] = useState(false);
    const [cameraPermissionState, setCameraPermissionState] = useState('checking');
    const [requestingCameraPermission, setRequestingCameraPermission] = useState(false);
    const [cameraFailureMessage, setCameraFailureMessage] = useState(null);
    const [partnerCameraEnabled, setPartnerCameraEnabled] = useState(false);
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);

    // Video Chat deliberately owns two scalar slots. There is no message array.
    const [myMessage, setMyMessage] = useState(null);
    const [partnerMessage, setPartnerMessage] = useState(null);
    const [partnerTyping, setPartnerTyping] = useState(false);
    const [partnerNickname, setPartnerNickname] = useState(null);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const [toastVisible, setToastVisible] = useState(false);
    const [myDraft, setMyDraft] = useState('');
    const [sendPending, setSendPending] = useState(false);
    const [screenReadyForKeyboard, setScreenReadyForKeyboard] = useState(false);
    const [cardHeight, setCardHeight] = useState(
        () => readCachedCardHeight(cardHeightStorageKey),
    );
    const [instructionVisible, setInstructionVisible] = useState(
        () => !hasSeenInstruction,
    );
    const [showChatGuidance, setShowChatGuidance] = useState(
        () => !hasSeenInstruction,
    );
    const [entryChoiceComplete, setEntryChoiceComplete] = useState(
        () => hasSeenInstruction,
    );
    const [freeUsageMs, setFreeUsageMs] = useState(
        () => readLiveChatUsage(freeUsageStorageKey),
    );
    const shouldBlockKeyboardForCamera = instructionVisible
        || cameraPermissionState === 'checking'
        || requestingCameraPermission;
    const isFreeLimitReached = !hasPremiumAccess && freeUsageMs >= FREE_LIVE_CHAT_LIMIT_MS;
    const remainingFreeSeconds = Math.max(
        0,
        Math.ceil((FREE_LIVE_CHAT_LIMIT_MS - freeUsageMs) / 1000),
    );

    const sessionIdRef = useRef(null);
    const participantCountRef = useRef(0);
    const shouldOfferRef = useRef(false);
    const peerConnectionRef = useRef(null);
    const localStreamRef = useRef(null);
    const remoteStreamRef = useRef(null);
    const pendingCandidatesRef = useRef([]);
    const negotiationTimeoutRef = useRef(null);
    const mountedRef = useRef(true);
    const cameraPermissionAttemptedRef = useRef(false);
    const cameraStartPromiseRef = useRef(null);
    const cameraRequestGenerationRef = useRef(0);
    const offerInFlightRef = useRef(false);
    const myDraftRef = useRef('');
    const pendingMessageRef = useRef(null);
    const pendingMessageTimeoutRef = useRef(null);
    const typingStopTimeoutRef = useRef(null);
    const typingActiveRef = useRef(false);
    const messageInputRef = useRef(null);
    const messageSoundPlayerRef = useRef(null);
    const messageSoundUrisRef = useRef({ send: null, receive: null });
    const messageSoundSequenceRef = useRef(Promise.resolve());
    const messageSoundDisposedRef = useRef(false);
    const appStateRef = useRef(AppState.currentState);
    const cameraWantedEnabledRef = useRef(
        storage.getBoolean(cameraPreferenceStorageKey) === true,
    );
    const instructionSheetRef = useRef(null);
    const instructionSheetPresentedRef = useRef(false);
    const instructionSheetDismissalHandledRef = useRef(false);
    const keyboardVisibleRef = useRef(false);
    const stageViewportHeightRef = useRef(0);
    const measuredCardHeightRef = useRef(cardHeight);
    const freeUsageMsRef = useRef(freeUsageMs);
    const onRequestPremiumRef = useRef(onRequestPremium);
    const limitSheetShownThisVisitRef = useRef(false);
    onRequestPremiumRef.current = onRequestPremium;

    useEffect(() => {
        const storedUsage = readLiveChatUsage(freeUsageStorageKey);
        freeUsageMsRef.current = storedUsage;
        setFreeUsageMs(storedUsage);
    }, [freeUsageStorageKey]);

    useEffect(() => {
        const cachedHeight = readCachedCardHeight(cardHeightStorageKey);
        measuredCardHeightRef.current = cachedHeight;
        setCardHeight(cachedHeight);
    }, [cardHeightStorageKey]);

    const calculateAndCacheCardHeight = useCallback((viewportHeight) => {
        if (!keyboardVisibleRef.current || viewportHeight <= 0) return;

        // Keep additional breathing room instead of filling the stage exactly.
        // The stage already uses 12px total padding and an 8px card gap.
        const availableHeight = viewportHeight - 20 - CARD_HEIGHT_BREATHING_ROOM;
        const nextHeight = Math.max(
            MIN_CARD_HEIGHT,
            Math.min(MAX_CARD_HEIGHT, Math.floor(availableHeight / 2)),
        );
        const storedHeight = storage.getNumber(cardHeightStorageKey);
        if (Math.abs(nextHeight - measuredCardHeightRef.current) < 2) {
            if (!Number.isFinite(storedHeight)) storage.set(cardHeightStorageKey, nextHeight);
            return;
        }

        measuredCardHeightRef.current = nextHeight;
        setCardHeight(nextHeight);
        storage.set(cardHeightStorageKey, nextHeight);
    }, [cardHeightStorageKey]);

    const handleStageLayout = useCallback((event) => {
        const viewportHeight = event.nativeEvent.layout.height;
        stageViewportHeightRef.current = viewportHeight;
        calculateAndCacheCardHeight(viewportHeight);
    }, [calculateAndCacheCardHeight]);

    useEffect(() => {
        if (!userId || !partnerId) {
            setPartnerNickname(null);
            return undefined;
        }

        let cancelled = false;
        const loadPartnerNickname = async () => {
            try {
                const response = await apiFetch(`${API_BASE}/api/partner/status/${userId}`);
                const json = await response.json();
                const nickname = json?.partner?.nickname?.trim();
                if (!cancelled) setPartnerNickname(nickname || null);
            } catch {
                if (!cancelled) setPartnerNickname(null);
            }
        };

        loadPartnerNickname();
        return () => {
            cancelled = true;
        };
    }, [partnerId, userId]);

    useEffect(() => {
        messageSoundDisposedRef.current = false;
        messageSoundPlayerRef.current = createSafeAudioPlayer();
        messageSoundUrisRef.current = {
            send: Image.resolveAssetSource(require('../../assets/sounds/send.mp3')).uri,
            receive: Image.resolveAssetSource(require('../../assets/sounds/recieve.mp3')).uri,
        };

        return () => {
            messageSoundDisposedRef.current = true;
            messageSoundPlayerRef.current?.stopPlayer().catch(() => {});
            messageSoundPlayerRef.current = null;
        };
    }, []);

    const playMessageSound = useCallback((type) => {
        const soundUri = messageSoundUrisRef.current[type];
        if (!soundUri || messageSoundDisposedRef.current) return;

        messageSoundSequenceRef.current = messageSoundSequenceRef.current
            .catch(() => {})
            .then(async () => {
                const player = messageSoundPlayerRef.current;
                if (!player || messageSoundDisposedRef.current) return;
                await player.stopPlayer().catch(() => {});
                if (messageSoundDisposedRef.current) return;
                await player.startPlayer(soundUri);
                await player.setVolume(1);
            })
            .catch(() => {});
    }, []);

    const emitMediaState = useCallback((enabled) => {
        if (!sessionIdRef.current) return;
        socket?.emit('liveChat:mediaState', {
            sessionId: sessionIdRef.current,
            cameraEnabled: enabled,
        });
    }, [socket]);

    const emitTypingState = useCallback((isTyping) => {
        const id = sessionIdRef.current;
        if (!id || !socket?.connected) {
            if (!isTyping) typingActiveRef.current = false;
            return;
        }
        if (typingActiveRef.current === isTyping) return;
        typingActiveRef.current = isTyping;
        socket.emit('liveChat:typing', {
            sessionId: id,
            isTyping,
        });
    }, [socket]);

    const stopCamera = useCallback(() => {
        cameraRequestGenerationRef.current += 1;
        localStreamRef.current?.getTracks?.().forEach(track => track.stop());
        localStreamRef.current = null;
        setLocalStream(null);
        setCameraEnabled(false);
        emitMediaState(false);
    }, [emitMediaState]);

    const closePeerConnection = useCallback(({ preservePendingCandidates = false } = {}) => {
        if (negotiationTimeoutRef.current) {
            clearTimeout(negotiationTimeoutRef.current);
            negotiationTimeoutRef.current = null;
        }
        peerConnectionRef.current?.close?.();
        peerConnectionRef.current = null;
        if (!preservePendingCandidates) pendingCandidatesRef.current = [];
        remoteStreamRef.current = null;
        setRemoteStream(null);
        setPartnerCameraEnabled(false);
    }, []);

    const ensureFrontCamera = useCallback(async ({ requestPermission = true } = {}) => {
        const existingTrack = localStreamRef.current?.getVideoTracks?.()[0];
        if (existingTrack?.readyState === 'live') return localStreamRef.current;
        if (cameraStartPromiseRef.current) return cameraStartPromiseRef.current;

        const requestGeneration = cameraRequestGenerationRef.current;
        const cameraStartPromise = (async () => {
            let capturedStream = null;
            try {
                let cameraStatus = await permissions.query({ name: 'camera' });
                if (cameraStatus !== permissions.RESULT.GRANTED) {
                    if (!requestPermission) {
                        setCameraPermissionState(
                            cameraPermissionAttemptedRef.current ? 'denied' : 'needed',
                        );
                        setCameraDenied(false);
                        emitMediaState(false);
                        return null;
                    }
                    if (cameraPermissionAttemptedRef.current) {
                        setCameraPermissionState('denied');
                        setCameraDenied(true);
                        setCameraFailureMessage(null);
                        emitMediaState(false);
                        return null;
                    }
                    cameraPermissionAttemptedRef.current = true;
                    const granted = await permissions.request({ name: 'camera' });
                    if (!granted) {
                        cameraStatus = await permissions.query({ name: 'camera' });
                        const permissionGranted = cameraStatus === permissions.RESULT.GRANTED;
                        setCameraPermissionState(permissionGranted ? 'granted' : 'denied');
                        setCameraDenied(!permissionGranted);
                        setCameraFailureMessage(null);
                        emitMediaState(false);
                        return null;
                    }
                }

                const stream = await mediaDevices.getUserMedia({
                    audio: false,
                    video: {
                        facingMode: 'user',
                        frameRate: 24,
                        width: { ideal: 480 },
                        height: { ideal: 640 },
                    },
                });
                capturedStream = stream;
                const track = stream.getVideoTracks()[0];
                if (!track) throw new Error('Front camera did not provide a video track.');

                if (
                    !mountedRef.current
                    || requestGeneration !== cameraRequestGenerationRef.current
                    || !sessionIdRef.current
                ) {
                    stream.getTracks().forEach(item => item.stop());
                    return null;
                }

                localStreamRef.current = stream;
                const sender = peerConnectionRef.current
                    ?.getSenders?.()
                    .find(item => item.track?.kind === 'video' || item.track == null);
                if (sender) await sender.replaceTrack(track);

                setLocalStream(stream);
                setCameraPermissionState('granted');
                setCameraDenied(false);
                setCameraFailureMessage(null);
                setCameraEnabled(true);
                emitMediaState(true);
                return stream;
            } catch {
                capturedStream?.getTracks?.().forEach(item => item.stop());
                if (localStreamRef.current === capturedStream) {
                    localStreamRef.current = null;
                }
                if (requestGeneration === cameraRequestGenerationRef.current) {
                    setCameraEnabled(false);
                    setCameraDenied(false);
                    setCameraFailureMessage('Front camera is unavailable. Messages still work.');
                    emitMediaState(false);
                }
                return null;
            }
        })();

        cameraStartPromiseRef.current = cameraStartPromise;
        try {
            return await cameraStartPromise;
        } finally {
            if (cameraStartPromiseRef.current === cameraStartPromise) {
                cameraStartPromiseRef.current = null;
            }
        }
    }, [emitMediaState]);

    useEffect(() => {
        let cancelled = false;

        permissions.query({ name: 'camera' })
            .then((cameraStatus) => {
                if (cancelled) return;
                setCameraPermissionState(
                    cameraStatus === permissions.RESULT.GRANTED ? 'granted' : 'needed',
                );
            })
            .catch(() => {
                if (!cancelled) setCameraPermissionState('needed');
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const flushCandidates = useCallback(async () => {
        const pc = peerConnectionRef.current;
        if (!pc?.remoteDescription) return;
        const queued = pendingCandidatesRef.current.splice(0);
        for (const candidate of queued) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (candidateError) {
                // Connection state below surfaces a useful failure if ICE cannot recover.
            }
        }
    }, []);

    const createPeerConnection = useCallback((
        id,
        { attachLocal = true, preservePendingCandidates = false } = {},
    ) => {
        closePeerConnection({ preservePendingCandidates });
        const pc = new RTCPeerConnection({
            iceServers: [{ urls: STUN_URLS }],
            iceCandidatePoolSize: 4,
        });
        peerConnectionRef.current = pc;

        if (attachLocal) {
            const track = localStreamRef.current?.getVideoTracks?.()[0];
            const streamOptions = localStreamRef.current ? { streams: [localStreamRef.current] } : {};
            pc.addTransceiver(track || 'video', { direction: 'sendrecv', ...streamOptions });
        }

        pc.addEventListener('track', event => {
            if (peerConnectionRef.current !== pc) return;
            const received = event.streams?.[0];
            if (received) {
                remoteStreamRef.current = received;
                setRemoteStream(received);
                setPartnerCameraEnabled(true);
                return;
            }
            if (!remoteStreamRef.current) remoteStreamRef.current = new MediaStream();
            const duplicate = remoteStreamRef.current.getTracks().some(track => track.id === event.track.id);
            if (!duplicate) remoteStreamRef.current.addTrack(event.track);
            setRemoteStream(new MediaStream(remoteStreamRef.current.getTracks()));
            setPartnerCameraEnabled(true);
        });

        pc.addEventListener('icecandidate', event => {
            if (peerConnectionRef.current !== pc || !event.candidate) return;
            socket?.emit('liveChat:webrtc:iceCandidate', {
                sessionId: id,
                candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
            });
        });

        pc.addEventListener('connectionstatechange', () => {
            if (peerConnectionRef.current !== pc) return;
            if (pc.connectionState === 'connected') {
                setError(null);
            } else if (pc.connectionState === 'failed') {
                setError('Live video could not connect on this network. Messages still work.');
                setPartnerCameraEnabled(false);
            }
        });
        return pc;
    }, [closePeerConnection, socket]);

    const startOffer = useCallback(async () => {
        const id = sessionIdRef.current;
        if (!id || participantCountRef.current < 2 || offerInFlightRef.current) return;
        const existingPc = peerConnectionRef.current;
        if (
            existingPc
            && existingPc.signalingState !== 'closed'
            && existingPc.connectionState !== 'failed'
            && existingPc.connectionState !== 'closed'
        ) return;
        offerInFlightRef.current = true;
        try {
            if (cameraWantedEnabledRef.current) {
                await ensureFrontCamera({ requestPermission: false });
            }
            if (
                !mountedRef.current
                || sessionIdRef.current !== id
                || participantCountRef.current < 2
            ) return;
            const pc = createPeerConnection(id, { attachLocal: true });
            const offer = await pc.createOffer();
            if (peerConnectionRef.current !== pc || sessionIdRef.current !== id) return;
            await pc.setLocalDescription(offer);
            socket?.emit('liveChat:webrtc:offer', { sessionId: id, description: offer });
            negotiationTimeoutRef.current = setTimeout(() => {
                if (
                    peerConnectionRef.current !== pc
                    || pc.remoteDescription
                    || pc.connectionState === 'connected'
                ) return;
                closePeerConnection();
                setError('Live video negotiation timed out. Tap the video button to retry.');
            }, VIDEO_NEGOTIATION_TIMEOUT_MS);
        } catch (offerError) {
            setError('Unable to start live video. Messages still work.');
        } finally {
            offerInFlightRef.current = false;
        }
    }, [closePeerConnection, createPeerConnection, ensureFrontCamera, socket]);

    const leaveSession = useCallback(() => {
        const id = sessionIdRef.current;
        emitTypingState(false);
        if (id) socket?.emit('liveChat:leave', { sessionId: id });
        sessionIdRef.current = null;
        participantCountRef.current = 0;
        setParticipantCount(0);
        shouldOfferRef.current = false;
        offerInFlightRef.current = false;
        setSessionId(null);
        setMyMessage(null);
        setPartnerMessage(null);
        setPartnerTyping(false);
        if (typingStopTimeoutRef.current) {
            clearTimeout(typingStopTimeoutRef.current);
            typingStopTimeoutRef.current = null;
        }
        if (pendingMessageTimeoutRef.current) {
            clearTimeout(pendingMessageTimeoutRef.current);
            pendingMessageTimeoutRef.current = null;
        }
        pendingMessageRef.current = null;
        setSendPending(false);
        closePeerConnection();
        stopCamera();
    }, [closePeerConnection, emitTypingState, socket, stopCamera]);

    const handleBack = useCallback(() => {
        clearLiveChatActive();
        leaveSession();
        onBack?.();
    }, [leaveSession, onBack]);

    useEffect(() => {
        if (Platform.OS !== 'android') return undefined;
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            handleBack();
            return true;
        });
        return () => subscription.remove();
    }, [handleBack]);

    useEffect(() => {
        if (!entryChoiceComplete) return undefined;
        if (isFreeLimitReached) {
            leaveSession();
            setError(null);
            return undefined;
        }
        if (!socket || !isConnected) {
            leaveSession();
            setError('Reconnect to enter Video Chat.');
            return undefined;
        }
        if (!partnerId) {
            leaveSession();
            setError('Pair with a partner before starting Video Chat.');
            return undefined;
        }
        if (callState !== CALL_STATE.IDLE) {
            leaveSession();
            setError('End your video call before starting Video Chat.');
            return undefined;
        }

        const onJoined = async data => {
            sessionIdRef.current = data.sessionId;
            participantCountRef.current = data.participantCount || 1;
            setParticipantCount(data.participantCount || 1);
            shouldOfferRef.current = data.shouldOffer === true;
            setSessionId(data.sessionId);
            setMyMessage(data.myMessage || null);
            setPartnerMessage(data.partnerMessage || null);
            setPartnerTyping(false);
            setError(null);
            if (data.freeLimitReached === true) {
                freeUsageMsRef.current = FREE_LIVE_CHAT_LIMIT_MS;
                storage.set(freeUsageStorageKey, FREE_LIVE_CHAT_LIMIT_MS);
                setFreeUsageMs(FREE_LIVE_CHAT_LIMIT_MS);
                limitSheetShownThisVisitRef.current = true;
                onRequestPremiumRef.current?.();
                return;
            }
            if (cameraWantedEnabledRef.current) {
                await ensureFrontCamera({ requestPermission: false });
            }
            if ((data.participantCount || 1) > 1 && data.shouldOffer) startOffer();
        };
        const onPartnerJoined = async data => {
            if (data.sessionId !== sessionIdRef.current) return;
            participantCountRef.current = data.participantCount || 2;
            setParticipantCount(data.participantCount || 2);
            if (data.shouldOffer) shouldOfferRef.current = true;
            if (cameraWantedEnabledRef.current) {
                await ensureFrontCamera({ requestPermission: false });
            }
            if (shouldOfferRef.current) await startOffer();
        };
        const onPartnerLeft = data => {
            if (data.sessionId !== sessionIdRef.current) return;
            participantCountRef.current = data.participantCount || 1;
            setParticipantCount(data.participantCount || 1);
            shouldOfferRef.current = data.shouldOffer === true;
            setPartnerMessage(null);
            setPartnerTyping(false);
            closePeerConnection();
        };
        const onOffer = async data => {
            if (data.sessionId !== sessionIdRef.current) return;
            const pc = createPeerConnection(data.sessionId, {
                attachLocal: false,
                preservePendingCandidates: true,
            });
            try {
                if (cameraWantedEnabledRef.current) {
                    await ensureFrontCamera({ requestPermission: false });
                }
                if (
                    !mountedRef.current
                    || sessionIdRef.current !== data.sessionId
                    || peerConnectionRef.current !== pc
                ) return;
                await pc.setRemoteDescription(new RTCSessionDescription(data.description));
                const localTrack = localStreamRef.current?.getVideoTracks?.()[0];
                if (localTrack) pc.addTrack(localTrack, localStreamRef.current);
                await flushCandidates();
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.emit('liveChat:webrtc:answer', { sessionId: data.sessionId, description: answer });
            } catch (answerError) {
                if (peerConnectionRef.current === pc) closePeerConnection();
                setError('Unable to answer live video. Messages still work.');
            }
        };
        const onAnswer = async data => {
            if (data.sessionId !== sessionIdRef.current || !peerConnectionRef.current) return;
            try {
                await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.description));
                if (negotiationTimeoutRef.current) {
                    clearTimeout(negotiationTimeoutRef.current);
                    negotiationTimeoutRef.current = null;
                }
                await flushCandidates();
            } catch (answerError) {
                setError('Live video negotiation failed. Messages still work.');
            }
        };
        const onCandidate = async data => {
            if (data.sessionId !== sessionIdRef.current || !data.candidate) return;
            const pc = peerConnectionRef.current;
            if (!pc?.remoteDescription) {
                pendingCandidatesRef.current.push(data.candidate);
                return;
            }
            try {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (candidateError) {
                // ICE state reports a visible failure if no route can be found.
            }
        };
        const onMessage = data => {
            if (data.sessionId !== sessionIdRef.current) return;
            if (String(data.senderId) === String(userId)) {
                setMyMessage(data.message);
                const pending = pendingMessageRef.current;
                const confirmed = pending && (
                    data.clientMessageId === pending.clientMessageId
                    || data.message?.text === pending.text
                );
                if (confirmed) {
                    if (pendingMessageTimeoutRef.current) {
                        clearTimeout(pendingMessageTimeoutRef.current);
                        pendingMessageTimeoutRef.current = null;
                    }
                    pendingMessageRef.current = null;
                    setSendPending(false);
                }
            } else {
                setPartnerMessage(data.message);
                setPartnerTyping(false);
                playMessageSound('receive');
            }
        };
        const onPartnerTyping = data => {
            if (
                data.sessionId !== sessionIdRef.current
                || String(data.senderId) === String(userId)
            ) return;
            setPartnerTyping(data.isTyping === true);
        };
        const onPartnerMediaState = data => {
            if (data.sessionId !== sessionIdRef.current || String(data.senderId) === String(userId)) return;
            setPartnerCameraEnabled(data.cameraEnabled === true);
            if (data.cameraEnabled === true && shouldOfferRef.current && participantCountRef.current > 1) {
                startOffer();
            }
        };
        const onError = data => {
            setError(data.message || 'Video Chat could not start.');
            if (pendingMessageRef.current) {
                const pendingMessage = pendingMessageRef.current;
                const previousMessage = pendingMessage.previousMessage;
                if (pendingMessageTimeoutRef.current) {
                    clearTimeout(pendingMessageTimeoutRef.current);
                    pendingMessageTimeoutRef.current = null;
                }
                pendingMessageRef.current = null;
                setSendPending(false);
                setMyMessage(previousMessage || null);
                if (myDraftRef.current === '') {
                    myDraftRef.current = pendingMessage.text;
                    setMyDraft(pendingMessage.text);
                }
            }
            if (data.code === 'NORMAL_CALL_ACTIVE') {
                closePeerConnection();
                stopCamera();
            }
        };
        const onFreeLimitReached = data => {
            if (data.sessionId !== sessionIdRef.current || hasPremiumAccess) return;
            freeUsageMsRef.current = FREE_LIVE_CHAT_LIMIT_MS;
            storage.set(freeUsageStorageKey, FREE_LIVE_CHAT_LIMIT_MS);
            setFreeUsageMs(FREE_LIVE_CHAT_LIMIT_MS);
            limitSheetShownThisVisitRef.current = true;
            onRequestPremiumRef.current?.();
        };

        socket.on('liveChat:joined', onJoined);
        socket.on('liveChat:partnerJoined', onPartnerJoined);
        socket.on('liveChat:partnerLeft', onPartnerLeft);
        socket.on('liveChat:webrtc:offer', onOffer);
        socket.on('liveChat:webrtc:answer', onAnswer);
        socket.on('liveChat:webrtc:iceCandidate', onCandidate);
        socket.on('liveChat:messageUpdated', onMessage);
        socket.on('liveChat:partnerTyping', onPartnerTyping);
        socket.on('liveChat:partnerMediaState', onPartnerMediaState);
        socket.on('liveChat:freeLimitReached', onFreeLimitReached);
        socket.on('liveChat:error', onError);
        socket.emit('liveChat:join');

        return () => {
            socket.off('liveChat:joined', onJoined);
            socket.off('liveChat:partnerJoined', onPartnerJoined);
            socket.off('liveChat:partnerLeft', onPartnerLeft);
            socket.off('liveChat:webrtc:offer', onOffer);
            socket.off('liveChat:webrtc:answer', onAnswer);
            socket.off('liveChat:webrtc:iceCandidate', onCandidate);
            socket.off('liveChat:messageUpdated', onMessage);
            socket.off('liveChat:partnerTyping', onPartnerTyping);
            socket.off('liveChat:partnerMediaState', onPartnerMediaState);
            socket.off('liveChat:freeLimitReached', onFreeLimitReached);
            socket.off('liveChat:error', onError);
        };
    }, [callState, closePeerConnection, createPeerConnection, ensureFrontCamera, entryChoiceComplete, flushCandidates, freeUsageStorageKey, hasPremiumAccess, isConnected, isFreeLimitReached, leaveSession, partnerId, playMessageSound, socket, startOffer, stopCamera, userId]);

    useEffect(() => {
        mountedRef.current = true;
        if (isFreeLimitReached || !entryChoiceComplete) {
            clearLiveChatActive();
        } else {
            markLiveChatActive(userId);
        }
        return () => {
            mountedRef.current = false;
            if (pendingMessageTimeoutRef.current) {
                clearTimeout(pendingMessageTimeoutRef.current);
                pendingMessageTimeoutRef.current = null;
            }
            leaveSession();
        };
    }, [entryChoiceComplete, isFreeLimitReached, leaveSession, userId]);

    useEffect(() => {
        let animationFrame = null;
        let cancelled = false;
        const interactionTask = InteractionManager.runAfterInteractions(() => {
            animationFrame = requestAnimationFrame(() => {
                if (!cancelled) setScreenReadyForKeyboard(true);
            });
        });

        return () => {
            cancelled = true;
            interactionTask.cancel();
            if (animationFrame !== null) cancelAnimationFrame(animationFrame);
        };
    }, []);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', async nextState => {
            appStateRef.current = nextState;
            if (nextState !== 'active') {
                stopCamera();
                return;
            }
            const cameraStatus = await permissions.query({ name: 'camera' }).catch(() => permissions.RESULT.DENIED);
            setCameraPermissionState(
                cameraStatus === permissions.RESULT.GRANTED
                    ? 'granted'
                    : cameraPermissionAttemptedRef.current
                        ? 'denied'
                        : 'needed',
            );
            if (
                cameraStatus === permissions.RESULT.GRANTED
                && sessionIdRef.current
                && cameraWantedEnabledRef.current
            ) {
                await ensureFrontCamera({ requestPermission: false });
                if (shouldOfferRef.current && participantCountRef.current > 1) startOffer();
            }
        });
        return () => subscription.remove();
    }, [ensureFrontCamera, startOffer, stopCamera]);

    useEffect(() => {
        if (
            hasPremiumAccess
            || isFreeLimitReached
            || !sessionId
            || participantCount < 2
        ) {
            return undefined;
        }

        let lastTickAt = Date.now();
        const recordElapsedTime = () => {
            const now = Date.now();
            const elapsed = now - lastTickAt;
            lastTickAt = now;

            if (
                AppState.currentState !== 'active'
                || appStateRef.current !== 'active'
                || elapsed <= 0
            ) {
                return;
            }

            const previousUsage = freeUsageMsRef.current;
            const nextUsage = Math.min(
                FREE_LIVE_CHAT_LIMIT_MS,
                previousUsage + elapsed,
            );
            freeUsageMsRef.current = nextUsage;
            storage.set(freeUsageStorageKey, nextUsage);
            setFreeUsageMs(nextUsage);

            if (
                previousUsage < FREE_LIVE_CHAT_LIMIT_MS
                && nextUsage >= FREE_LIVE_CHAT_LIMIT_MS
            ) {
                socket?.emit('liveChat:freeLimitReached', {
                    sessionId: sessionIdRef.current,
                });
                limitSheetShownThisVisitRef.current = true;
                onRequestPremiumRef.current?.();
            }
        };

        const timer = setInterval(recordElapsedTime, 1000);
        return () => {
            clearInterval(timer);
            recordElapsedTime();
        };
    }, [
        freeUsageStorageKey,
        hasPremiumAccess,
        isFreeLimitReached,
        participantCount,
        sessionId,
        socket,
    ]);

    useEffect(() => {
        if (hasPremiumAccess) {
            limitSheetShownThisVisitRef.current = false;
            return;
        }
        if (!isFreeLimitReached || limitSheetShownThisVisitRef.current) return;

        limitSheetShownThisVisitRef.current = true;
        onRequestPremium?.();
    }, [hasPremiumAccess, isFreeLimitReached, onRequestPremium]);

    useEffect(() => {
        if (shouldBlockKeyboardForCamera) {
            messageInputRef.current?.blur();
            Keyboard.dismiss();
            keyboardVisibleRef.current = false;
            setKeyboardVisible(false);
        }
    }, [shouldBlockKeyboardForCamera]);

    useEffect(() => {
        if (!sessionId || !screenReadyForKeyboard || shouldBlockKeyboardForCamera) {
            return undefined;
        }
        let focusTimer = null;

        const focusInput = (resetFocus = false) => {
            if (
                !mountedRef.current
                || !sessionIdRef.current
                || shouldBlockKeyboardForCamera
                || AppState.currentState !== 'active'
            ) return;

            if (focusTimer) clearTimeout(focusTimer);
            focusTimer = setTimeout(() => {
                const input = messageInputRef.current;
                if (!input || !sessionIdRef.current) return;
                if (resetFocus) input.blur();
                input.focus();
            }, 100);
        };

        focusInput();
        const keyboardShowSubscription = Keyboard.addListener('keyboardDidShow', event => {
            Keyboard.scheduleLayoutAnimation?.(event);
            keyboardVisibleRef.current = true;
            setKeyboardVisible(true);
            requestAnimationFrame(() => {
                calculateAndCacheCardHeight(stageViewportHeightRef.current);
            });
        });
        const keyboardSubscription = Keyboard.addListener('keyboardDidHide', event => {
            Keyboard.scheduleLayoutAnimation?.(event);
            keyboardVisibleRef.current = false;
            setKeyboardVisible(false);
        });
        const appStateSubscription = AppState.addEventListener('change', nextState => {
            appStateRef.current = nextState;
            if (nextState === 'active') focusInput(true);
        });
        const appBlurSubscription = Platform.OS === 'android'
            ? AppState.addEventListener('blur', () => {
                appStateRef.current = 'blurred';
            })
            : null;
        const appFocusSubscription = Platform.OS === 'android'
            ? AppState.addEventListener('focus', () => {
                appStateRef.current = AppState.currentState;
            })
            : null;

        return () => {
            keyboardShowSubscription.remove();
            keyboardSubscription.remove();
            appStateSubscription.remove();
            appBlurSubscription?.remove();
            appFocusSubscription?.remove();
            if (focusTimer) clearTimeout(focusTimer);
            keyboardVisibleRef.current = false;
            setKeyboardVisible(false);
        };
    }, [calculateAndCacheCardHeight, screenReadyForKeyboard, sessionId, shouldBlockKeyboardForCamera]);

    const completeEntryChoice = useCallback((useCamera) => {
        storage.set(instructionStorageKey, true);
        storage.set(cameraPreferenceStorageKey, useCamera);
        cameraWantedEnabledRef.current = useCamera;
        setEntryChoiceComplete(true);
        setShowChatGuidance(false);
        setInstructionVisible(false);
    }, [cameraPreferenceStorageKey, instructionStorageKey]);

    const dismissInstruction = useCallback(() => {
        if (!entryChoiceComplete) {
            completeEntryChoice(false);
            return;
        }
        setInstructionVisible(false);
    }, [completeEntryChoice, entryChoiceComplete]);

    const handleInstructionCameraAction = useCallback(async () => {
        messageInputRef.current?.blur();
        Keyboard.dismiss();

        if (cameraPermissionState === 'granted') {
            storage.set(cameraPreferenceStorageKey, true);
            cameraWantedEnabledRef.current = true;
            if (!entryChoiceComplete) {
                completeEntryChoice(true);
                return;
            }
            setInstructionVisible(false);
            await ensureFrontCamera({ requestPermission: false });
            if (shouldOfferRef.current && participantCountRef.current > 1) startOffer();
            return;
        }
        if (cameraPermissionState === 'denied') {
            await Linking.openSettings();
            return;
        }
        if (requestingCameraPermission) return;

        setRequestingCameraPermission(true);
        try {
            cameraPermissionAttemptedRef.current = true;
            await permissions.request({ name: 'camera' });
            const cameraStatus = await permissions.query({ name: 'camera' })
                .catch(() => permissions.RESULT.DENIED);
            const granted = cameraStatus === permissions.RESULT.GRANTED;
            setCameraPermissionState(granted ? 'granted' : 'denied');
            setCameraDenied(!granted);
            if (!granted) return;

            storage.set(cameraPreferenceStorageKey, true);
            cameraWantedEnabledRef.current = true;
            if (!entryChoiceComplete) {
                completeEntryChoice(true);
                return;
            }
            setInstructionVisible(false);
            await ensureFrontCamera({ requestPermission: false });
            if (shouldOfferRef.current && participantCountRef.current > 1) startOffer();
        } finally {
            if (mountedRef.current) setRequestingCameraPermission(false);
        }
    }, [
        cameraPreferenceStorageKey,
        cameraPermissionState,
        completeEntryChoice,
        entryChoiceComplete,
        ensureFrontCamera,
        requestingCameraPermission,
        startOffer,
    ]);

    useEffect(() => {
        const shouldShow = instructionVisible && !isFreeLimitReached;
        if (shouldShow) {
            const animationFrame = requestAnimationFrame(() => {
                instructionSheetDismissalHandledRef.current = false;
                instructionSheetPresentedRef.current = true;
                instructionSheetRef.current?.present();
            });
            return () => cancelAnimationFrame(animationFrame);
        }

        if (instructionSheetPresentedRef.current) {
            instructionSheetDismissalHandledRef.current = true;
            instructionSheetRef.current?.dismiss();
        }
        return undefined;
    }, [instructionVisible, isFreeLimitReached]);

    const renderInstructionBackdrop = useCallback(backdropProps => (
        <BottomSheetBackdrop
            {...backdropProps}
            appearsOnIndex={0}
            disappearsOnIndex={-1}
            opacity={0.42}
            pressBehavior="none"
        />
    ), []);

    const handleDraftChange = useCallback((text) => {
        if (isFreeLimitReached) return;
        myDraftRef.current = text;
        setMyDraft(text);
        if (typingStopTimeoutRef.current) {
            clearTimeout(typingStopTimeoutRef.current);
            typingStopTimeoutRef.current = null;
        }

        const hasText = Boolean(text.trim());
        emitTypingState(hasText);
        if (hasText) {
            typingStopTimeoutRef.current = setTimeout(() => {
                typingStopTimeoutRef.current = null;
                emitTypingState(false);
            }, 1200);
        }
    }, [emitTypingState, isFreeLimitReached]);

    const handleSend = useCallback(() => {
        if (isFreeLimitReached) return;
        const text = myDraft.trim();
        if (!text || !sessionIdRef.current || sendPending) return;
        if (!socket?.connected) {
            setError('Message was not sent because Video Chat is reconnecting.');
            return;
        }
        const clientMessageId = makeId('message');
        pendingMessageRef.current = { clientMessageId, text, previousMessage: myMessage };
        setSendPending(true);
        setMyMessage({ clientMessageId, text });
        messageInputRef.current?.clear();
        myDraftRef.current = '';
        setMyDraft('');
        setError(null);

        if (typingStopTimeoutRef.current) {
            clearTimeout(typingStopTimeoutRef.current);
            typingStopTimeoutRef.current = null;
        }
        emitTypingState(false);
        socket?.emit('liveChat:message:set', {
            sessionId: sessionIdRef.current,
            text,
            clientMessageId,
        });
        playMessageSound('send');
        messageInputRef.current?.focus();
        pendingMessageTimeoutRef.current = setTimeout(() => {
            if (pendingMessageRef.current?.clientMessageId !== clientMessageId) return;
            const pendingMessage = pendingMessageRef.current;
            const previousMessage = pendingMessage.previousMessage;
            pendingMessageRef.current = null;
            pendingMessageTimeoutRef.current = null;
            setSendPending(false);
            setMyMessage(previousMessage);
            if (myDraftRef.current === '') {
                myDraftRef.current = pendingMessage.text;
                setMyDraft(pendingMessage.text);
                setError('Message delivery was not confirmed. Your text is available to retry.');
            } else {
                setError('Message delivery was not confirmed. Please try again.');
            }
        }, 8000);
    }, [emitTypingState, isFreeLimitReached, myDraft, myMessage, playMessageSound, sendPending, socket]);

    const toggleFrontCamera = useCallback(async () => {
        if (isFreeLimitReached) {
            onRequestPremium?.();
            return;
        }
        if (cameraEnabled) {
            cameraWantedEnabledRef.current = false;
            storage.set(cameraPreferenceStorageKey, false);
            stopCamera();
            return;
        }
        const cameraStatus = await permissions.query({ name: 'camera' })
            .catch(() => permissions.RESULT.DENIED);
        if (cameraStatus !== permissions.RESULT.GRANTED) {
            messageInputRef.current?.blur();
            Keyboard.dismiss();
            setCameraPermissionState(
                cameraPermissionAttemptedRef.current ? 'denied' : 'needed',
            );
            setShowChatGuidance(false);
            setInstructionVisible(true);
            return;
        }
        setCameraPermissionState('granted');
        cameraWantedEnabledRef.current = true;
        storage.set(cameraPreferenceStorageKey, true);
        await ensureFrontCamera({ requestPermission: false });
        if (shouldOfferRef.current && participantCountRef.current > 1) startOffer();
    }, [cameraEnabled, cameraPreferenceStorageKey, ensureFrontCamera, isFreeLimitReached, onRequestPremium, startOffer, stopCamera]);

    const handleRequestPremium = useCallback(() => {
        Keyboard.dismiss();
        onRequestPremium?.();
    }, [onRequestPremium]);

    const handleFreeTierUpgrade = useCallback(() => {
        Keyboard.dismiss();
        if (onOpenFreeScreen) {
            onOpenFreeScreen();
            return;
        }
        onRequestPremium?.();
    }, [onOpenFreeScreen, onRequestPremium]);

    const partnerDisplayText = partnerMessage?.text || '';
    const myDisplayText = myMessage?.text || '';
    const fallbackPartnerName = typeof partnerName === 'string' && partnerName.trim()
        ? partnerName
        : 'Partner';
    const partnerDisplayName = partnerNickname || fallbackPartnerName;
    const sessionStatusText = !sessionId
        ? translateUiText('Getting Video Chat ready…')
        : participantCount < 2
            ? translateUiTemplate('Waiting for {{0}} to join…', [partnerDisplayName])
            : translateUiTemplate('{{0}} is here', [partnerDisplayName]);
    const partnerIsPresent = Boolean(sessionId && participantCount > 1);
    const videoSize = compact
        ? { width: 100 }
        : { width: 116 };
    const messageCardSize = { height: cardHeight };
    const instructionCardInsetStyle = {
        paddingBottom: Math.max(insets.bottom, 16) + 18,
    };
    const canSend = Boolean(
        !isFreeLimitReached
        && myDraft.trim()
        && sessionId
        && socket?.connected
        && !sendPending,
    );
    const showFreeTierCountdown = !hasPremiumAccess
        && !isFreeLimitReached
        && Boolean(sessionId)
        && remainingFreeSeconds > 0
        && remainingFreeSeconds <= 60
        && participantCount > 1;
    const visibleError = error
        || (cameraDenied ? 'Front-camera permission is off. Messages still work.' : null)
        || cameraFailureMessage;

    useEffect(() => {
        if (!visibleError) {
            setToastVisible(false);
            return undefined;
        }

        setToastVisible(true);
        const hideTimer = setTimeout(() => {
            setToastVisible(false);
        }, 4000);
        return () => clearTimeout(hideTimer);
    }, [visibleError]);

    return (
        <LinearGradient
            colors={['#F8D9EC', '#FFF7FA', '#FFF4F7', '#F7D8F2']}
            locations={[0, 0.34, 0.72, 1]}
            start={{ x: 0.25, y: 0 }}
            end={{ x: 0.75, y: 1 }}
            style={styles.screen}
        >
            <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
            <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={handleBack}
                        accessibilityRole="button"
                        accessibilityLabel={translateUiText("Back to chats")}
                    >
                        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                            <Path
                                d="M15 18l-6-6 6-6"
                                stroke="#1B1237"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </Svg>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{translateUiText("Video Chat")}</Text>
                    <TouchableOpacity
                        style={styles.headerButton}
                        onPress={toggleFrontCamera}
                        accessibilityRole="button"
                        accessibilityLabel={cameraEnabled ? translateUiText("Turn off front camera") : translateUiText("Turn on front camera")}
                        accessibilityState={{ checked: cameraEnabled }}
                    >
                        {cameraEnabled ? (
                            <Video color="#D84F86" size={23} strokeWidth={2.2} />
                        ) : (
                            <VideoOff color="#A99CA9" size={23} strokeWidth={2.2} />
                        )}
                    </TouchableOpacity>
                </View>
                <View style={styles.sessionStatus}>
                    <View style={[
                        styles.sessionStatusDot,
                        partnerIsPresent && styles.sessionStatusDotConnected,
                    ]} />
                    <Text style={styles.sessionStatusText}>
                        {sessionStatusText}
                    </Text>
                </View>

                <KeyboardAvoidingView
                    style={styles.body}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={0}
                >
                    <ScrollView
                        style={styles.stageScroll}
                        onLayout={handleStageLayout}
                        contentContainerStyle={[
                            styles.stage,
                            keyboardVisible && styles.stageKeyboardOpen,
                        ]}
                        keyboardDismissMode="none"
                        keyboardShouldPersistTaps="always"
                    >
                        <View style={[
                            styles.messageRow,
                            messageCardSize,
                        ]}>
                            <View style={[styles.videoTile, videoSize]}>
                                <View style={styles.videoClip}>
                                    {remoteStream && partnerCameraEnabled ? (
                                        <RTCView
                                            streamURL={remoteStream.toURL()}
                                            style={styles.liveVideo}
                                            objectFit="cover"
                                        />
                                    ) : (
                                        <LinearGradient colors={['#F5D8E8', '#E7DDF7']} style={styles.videoPlaceholder}>
                                            {partnerAvatar ? (
                                                <Image source={{ uri: partnerAvatar }} style={styles.partnerAvatar} />
                                            ) : (
                                                <Text style={styles.partnerInitial}>
                                                    {partnerDisplayName.charAt(0).toUpperCase()}
                                                </Text>
                                            )}
                                            <Text style={styles.videoOffLabel}>{translateUiText("Video is turned off")}</Text>
                                        </LinearGradient>
                                    )}
                                </View>
                                <View style={[styles.liveDot, !(remoteStream && partnerCameraEnabled) && styles.liveDotOff]} />
                            </View>
                            <View style={styles.messageContent}>
                                <View style={styles.nameRow}>
                                    <Text style={styles.personName}>{partnerDisplayName}</Text>
                                    {partnerTyping && (
                                        <Text style={styles.typingText}>{translateUiText("typing…")}</Text>
                                    )}
                                </View>
                                <SmoothMessageText text={partnerDisplayText} />
                            </View>
                        </View>

                        <View style={[
                            styles.messageRow,
                            styles.myMessageRow,
                            messageCardSize,
                        ]}>
                            <View style={[styles.videoTile, videoSize]}>
                                <View style={styles.videoClip}>
                                    {localStream && cameraEnabled ? (
                                        <RTCView
                                            streamURL={localStream.toURL()}
                                            style={styles.liveVideo}
                                            objectFit="cover"
                                            mirror
                                        />
                                    ) : (
                                        <LinearGradient colors={['#FFDCE8', '#F2DFF5']} style={styles.videoPlaceholder}>
                                            <Text style={styles.partnerInitial}>Y</Text>
                                            <Text style={styles.videoOffLabel}>{translateUiText("Video is turned off")}</Text>
                                        </LinearGradient>
                                    )}
                                </View>
                                <View style={[styles.liveDot, styles.myLiveDot, !(localStream && cameraEnabled) && styles.liveDotOff]} />
                            </View>
                            <View style={styles.messageContent}>
                                <View style={styles.nameRow}>
                                    <Text style={styles.personName}>{translateUiText("You")}</Text>
                                </View>
                                <Text style={[
                                    styles.messageText,
                                    !myDisplayText && styles.emptyMessageText,
                                ]}>
                                    {myDisplayText || '...'}
                                </Text>
                            </View>
                        </View>
                    </ScrollView>

                    {toastVisible && visibleError && (
                        <View style={styles.errorCard}>
                            <Text style={styles.errorText}>{translateUiText(visibleError)}</Text>
                            {cameraDenied && !error && (
                                <TouchableOpacity
                                    onPress={() => Linking.openSettings()}
                                    accessibilityRole="button"
                                    accessibilityLabel={translateUiText("Open app settings")}
                                >
                                    <Text style={styles.settingsText}>{translateUiText("Open Settings")}</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    <View style={styles.composerArea}>
                        {showFreeTierCountdown && (
                            <View style={styles.freeTierCountdown}>
                                <Text style={styles.freeTierCountdownText}>{translateUiText("Free tier left:")}{' '}
                                    <Text style={styles.freeTierCountdownTime}>
                                        {formatFreeTime(remainingFreeSeconds)}
                                    </Text>
                                </Text>
                                <TouchableOpacity
                                    onPress={handleFreeTierUpgrade}
                                    activeOpacity={0.7}
                                    accessibilityRole="button"
                                    accessibilityLabel={translateUiText("Upgrade Video Chat")}
                                >
                                    <Text style={styles.freeTierUpgradeText}>{translateUiText("Upgrade")}</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                        <View style={styles.composer}>
                            <TextInput
                                ref={messageInputRef}
                                value={myDraft}
                                onChangeText={handleDraftChange}
                                onPressIn={isFreeLimitReached ? handleRequestPremium : undefined}
                                style={styles.input}
                                placeholder={isFreeLimitReached ? translateUiText("Tap to unlock Video Chat") : translateUiText("Type a message…")}
                                placeholderTextColor="#A99CA9"
                                maxLength={MAX_MESSAGE_LENGTH}
                                multiline
                                editable={Boolean(sessionId)
                                    && !isFreeLimitReached
                                    && !shouldBlockKeyboardForCamera}
                                accessibilityLabel={isFreeLimitReached
                                    ? translateUiText("Unlock Video Chat")
                                    : translateUiText("Video Chat message")}
                            />
                            <TouchableOpacity
                                style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
                                onPress={handleSend}
                                disabled={!canSend}
                                accessibilityRole="button"
                                accessibilityLabel={sendPending ? translateUiText("Sending message") : translateUiText("Send message")}
                                accessibilityState={{ disabled: !canSend, busy: sendPending }}
                            >
                                <Text style={styles.sendIcon}>➤</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>

                <BottomSheetModal
                    ref={instructionSheetRef}
                    enableDynamicSizing
                    enablePanDownToClose
                    backdropComponent={renderInstructionBackdrop}
                    backgroundStyle={styles.instructionSheetBackground}
                    handleComponent={null}
                    onDismiss={() => {
                        instructionSheetPresentedRef.current = false;
                        if (!instructionSheetDismissalHandledRef.current) {
                            dismissInstruction();
                        }
                    }}
                >
                    <BottomSheetView
                        style={[styles.instructionCard, instructionCardInsetStyle]}
                        accessibilityViewIsModal
                    >
                        <View style={styles.instructionHandle} />
                        <View style={styles.instructionIcon}>
                            {showChatGuidance ? (
                                <Text style={styles.instructionIconText}>1</Text>
                            ) : (
                                <Camera color="#D84F86" size={25} strokeWidth={2.2} />
                            )}
                        </View>
                        <Text style={styles.instructionTitle}>
                            {translateUiText(showChatGuidance ? 'Video Chat' : 'Turn on camera')}
                        </Text>
                        <Text style={styles.instructionText}>
                            {translateUiText(
                                showChatGuidance
                                    ? 'Share one live message each. Your next message replaces your previous one.'
                                    : 'Turn on your front camera so your partner can see you.',
                            )}
                        </Text>
                        {showChatGuidance && !hasPremiumAccess && (
                            <View style={styles.freeTierNotice}>
                                <Text style={styles.freeTierNoticeText}>
                                    {translateUiText('You have 5 free minutes. Time counts only while you’re both connected.')}
                                </Text>
                            </View>
                        )}
                        {cameraPermissionState !== 'granted' && (
                            <View style={[
                                styles.cameraPermissionCard,
                                cameraPermissionState === 'denied'
                                    && styles.cameraPermissionCardDenied,
                            ]}>
                                <View style={styles.cameraPermissionIcon}>
                                    {cameraPermissionState === 'denied' ? (
                                        <Settings color="#D84F86" size={25} strokeWidth={2.2} />
                                    ) : (
                                        <Camera color="#D84F86" size={27} strokeWidth={2.2} />
                                    )}
                                </View>
                                <View style={styles.cameraPermissionCopy}>
                                    <Text style={styles.cameraPermissionTitle}>
                                        {cameraPermissionState === 'checking'
                                            ? translateUiText('Checking camera access…')
                                            : cameraPermissionState === 'denied'
                                                ? translateUiText('Camera permission is off')
                                                : translateUiText('Camera access is optional')}
                                    </Text>
                                    <Text style={styles.cameraPermissionText}>
                                        {cameraPermissionState === 'denied'
                                            ? translateUiText('Open Settings to enable video. Messages still work without it.')
                                            : translateUiText('We only use it while Video Chat is active.')}
                                    </Text>
                                </View>
                            </View>
                        )}
                        <TouchableOpacity
                            style={[
                                styles.instructionButton,
                                (cameraPermissionState === 'checking' || requestingCameraPermission)
                                    && styles.instructionButtonDisabled,
                            ]}
                            onPress={handleInstructionCameraAction}
                            disabled={cameraPermissionState === 'checking' || requestingCameraPermission}
                            activeOpacity={0.84}
                            accessibilityRole="button"
                            accessibilityLabel={cameraPermissionState === 'denied'
                                ? translateUiText('Open settings for camera permission')
                                : translateUiText('Start with camera')}
                        >
                            {requestingCameraPermission || cameraPermissionState === 'checking' ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.instructionButtonText}>
                                    {cameraPermissionState === 'denied'
                                        ? translateUiText('Open Settings')
                                        : translateUiText('Start with Camera')}
                                </Text>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.continueWithoutCameraButton}
                            onPress={dismissInstruction}
                            activeOpacity={0.75}
                            accessibilityRole="button"
                            accessibilityLabel={translateUiText('Continue without camera')}
                        >
                            <Text style={styles.continueWithoutCameraText}>
                                {translateUiText(
                                    showChatGuidance
                                        ? 'Continue without Camera'
                                        : 'Keep Camera Off',
                                )}
                            </Text>
                        </TouchableOpacity>
                    </BottomSheetView>
                </BottomSheetModal>
            </SafeAreaView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    safeArea: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 18, paddingTop: 8, paddingBottom: 10,
    },
    headerButton: {
        width: 44, height: 44, borderRadius: 18, borderWidth: 1,
        borderColor: '#F5CBDD', backgroundColor: 'rgba(255,255,255,0.86)',
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#C25A86', shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.1, shadowRadius: 10, elevation: 2,
    },
    backButton: {
        width: 44, height: 44, borderRadius: 22,
        backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#FAE8FF',
        justifyContent: 'center', alignItems: 'center',
        shadowColor: '#C084FC', shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
    },
    headerTitle: {
        color: '#1B1237', fontSize: 26, fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
    },
    sessionStatus: {
        minHeight: 28,
        marginHorizontal: 18,
        marginBottom: 2,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sessionStatusDot: {
        width: 8,
        height: 8,
        marginRight: 7,
        borderRadius: 4,
        backgroundColor: '#B8ADB7',
    },
    sessionStatusDotConnected: { backgroundColor: '#42B883' },
    sessionStatusText: {
        color: '#765F6E',
        fontSize: 12,
        fontFamily: fontFamily.bold,
    },
    errorCard: {
        position: 'absolute', bottom: Platform.OS === 'android' ? 76 : 68,
        left: 18, right: 18, zIndex: 50,
        borderRadius: 16, padding: 12,
        backgroundColor: 'rgba(255,255,255,0.96)', borderWidth: 1, borderColor: '#F2BFD3',
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
        shadowColor: '#9A4168', shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.16, shadowRadius: 16, elevation: 8,
    },
    errorText: { color: '#7A3655', fontSize: 12, flex: 1, fontFamily: fontFamily.medium },
    settingsText: { color: '#D84F86', fontSize: 12, fontFamily: fontFamily.bold },
    instructionSheetBackground: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
    },
    instructionCard: {
        width: '100%',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 10,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F2C5D9',
        shadowColor: '#4D243F',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.22,
        shadowRadius: 24,
        elevation: 14,
    },
    instructionHandle: {
        width: 44,
        height: 5,
        marginBottom: 18,
        borderRadius: 3,
        backgroundColor: '#E7C6D5',
    },
    instructionIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
        backgroundColor: '#FFE1EC',
    },
    instructionIconText: {
        color: '#D84F86',
        fontSize: 23,
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
    },
    instructionTitle: {
        color: '#1B1237',
        fontSize: 20,
        textAlign: 'center',
        fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
    },
    instructionText: {
        marginTop: 8,
        color: '#6F6070',
        fontSize: 14,
        lineHeight: 21,
        textAlign: 'center',
        fontFamily: fontFamily.medium,
    },
    freeTierNotice: {
        width: '100%',
        marginTop: 16,
        paddingHorizontal: 14,
        paddingVertical: 11,
        borderRadius: 14,
        backgroundColor: '#F8EFFB',
        borderWidth: 1,
        borderColor: '#E7D1F0',
    },
    freeTierNoticeText: {
        color: '#6F5572',
        fontSize: 12,
        lineHeight: 18,
        textAlign: 'center',
        fontFamily: fontFamily.medium,
    },
    cameraPermissionCard: {
        width: '100%',
        marginTop: 18,
        paddingHorizontal: 14,
        paddingVertical: 13,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF3F8',
        borderWidth: 1,
        borderColor: '#F2C5D9',
    },
    cameraPermissionCardDenied: {
        backgroundColor: '#FFF8ED',
        borderColor: '#F3D6A6',
    },
    cameraPermissionIcon: {
        width: 46,
        height: 46,
        borderRadius: 23,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFE1EC',
        borderWidth: 1,
        borderColor: '#F5C5D9',
    },
    cameraPermissionCopy: { flex: 1, marginLeft: 11 },
    cameraPermissionTitle: {
        color: '#3E2738',
        fontSize: 13,
        lineHeight: 18,
        fontFamily: fontFamily.bold,
    },
    cameraPermissionText: {
        marginTop: 2,
        color: '#7A6875',
        fontSize: 11,
        lineHeight: 16,
        fontFamily: fontFamily.medium,
    },
    instructionButton: {
        alignSelf: 'stretch',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 46,
        marginTop: 20,
        borderRadius: 23,
        backgroundColor: '#D84F86',
    },
    instructionButtonDisabled: { opacity: 0.65 },
    instructionButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontFamily: fontFamily.bold,
    },
    continueWithoutCameraButton: {
        minHeight: 38,
        paddingHorizontal: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    continueWithoutCameraText: {
        color: '#8A6E80',
        fontSize: 13,
        fontFamily: fontFamily.bold,
    },
    body: { flex: 1 },
    stageScroll: { flex: 1 },
    stage: {
        flexGrow: 1, justifyContent: 'center', paddingHorizontal: 16,
        paddingVertical: 12, gap: 12,
    },
    stageKeyboardOpen: { paddingVertical: 6, gap: 8 },
    messageRow: {
        width: '98%', minHeight: MIN_CARD_HEIGHT, flexDirection: 'row', alignItems: 'stretch',
        borderRadius: 18, overflow: 'visible', backgroundColor: 'rgba(255,255,255,0.9)',
        borderWidth: 1.5, borderColor: '#F1C9DA',
        shadowColor: '#C15E89', shadowOffset: { width: 0, height: 7 },
        shadowOpacity: 0.1, shadowRadius: 14, elevation: 3,
    },
    myMessageRow: { alignSelf: 'flex-end', borderColor: '#E5C9F1' },
    videoTile: {
        overflow: 'visible', backgroundColor: '#F4DBE8',
        borderTopLeftRadius: 16, borderBottomLeftRadius: 16,
    },
    videoClip: {
        width: '100%', height: '100%', overflow: 'hidden',
        borderTopLeftRadius: 16, borderBottomLeftRadius: 16,
    },
    liveVideo: {
        width: '100%', height: '100%', overflow: 'hidden',
        borderTopLeftRadius: 16, borderBottomLeftRadius: 16,
    },
    videoPlaceholder: {
        width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        borderTopLeftRadius: 16, borderBottomLeftRadius: 16,
    },
    partnerAvatar: { width: 38, height: 38, borderRadius: 19 },
    partnerInitial: { color: '#8A4C70', fontSize: 25, fontFamily: fontFamily.extraBold },
    videoOffLabel: {
        position: 'absolute', left: 6, right: 6, bottom: 9,
        paddingHorizontal: 5, paddingVertical: 3, borderRadius: 8,
        overflow: 'hidden', textAlign: 'center',
        color: '#FFFFFF', backgroundColor: 'rgba(47,38,48,0.66)',
        fontSize: 9, lineHeight: 12, fontFamily: fontFamily.bold,
    },
    liveDot: {
        position: 'absolute', width: 10, height: 10, borderRadius: 5,
        right: 7, bottom: 7, backgroundColor: '#42B883', borderWidth: 2, borderColor: '#FFFFFF',
    },
    myLiveDot: { backgroundColor: '#FF758F' },
    liveDotOff: { backgroundColor: '#B8ADB7' },
    messageContent: { flex: 1, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 9 },
    nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
    personName: { color: '#D84F86', fontSize: 13, fontFamily: fontFamily.bold },
    messageText: { color: '#1B1237', fontSize: 17, lineHeight: 24, fontFamily: fontFamily.medium },
    typingText: {
        color: '#42B883', fontSize: 11, lineHeight: 16,
        fontFamily: fontFamily.medium, marginLeft: 6,
    },
    emptyMessageText: { color: '#B1A3AD' },
    composerArea: { paddingHorizontal: 16, paddingBottom: Platform.OS === 'android' ? 14 : 6 },
    freeTierCountdown: {
        minHeight: 28,
        marginBottom: 7,
        paddingHorizontal: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    freeTierCountdownText: {
        color: '#765F6E',
        fontSize: 12,
        fontFamily: fontFamily.medium,
    },
    freeTierCountdownTime: {
        color: '#C24573',
        fontFamily: fontFamily.bold,
    },
    freeTierUpgradeText: {
        color: '#D84F86',
        fontSize: 13,
        textDecorationLine: 'underline',
        fontFamily: fontFamily.bold,
    },
    composer: {
        minHeight: 54, maxHeight: 104, borderRadius: 27, borderWidth: 1.5,
        borderColor: '#F0B9D0', backgroundColor: 'rgba(255,255,255,0.92)',
        flexDirection: 'row', alignItems: 'flex-end', padding: 6,
        shadowColor: '#C15E89', shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1, shadowRadius: 12, elevation: 3,
    },
    input: {
        flex: 1, minHeight: 42, maxHeight: 90, color: '#1B1237', fontSize: 16,
        paddingHorizontal: 14, paddingVertical: 9, fontFamily: fontFamily.medium,
    },
    sendButton: {
        width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#FF758F',
    },
    sendButtonDisabled: { backgroundColor: '#E5D6DE' },
    sendIcon: { color: '#FFFFFF', fontSize: 23, marginLeft: 3 },
});
