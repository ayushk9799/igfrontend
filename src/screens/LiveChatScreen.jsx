import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    AppState,
    Image,
    KeyboardAvoidingView,
    Linking,
    Platform,
    StyleSheet,
    StatusBar,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    MediaStream,
    mediaDevices,
    permissions,
    RTCPeerConnection,
    RTCIceCandidate,
    RTCSessionDescription,
    RTCView,
} from 'react-native-webrtc';
import { useSocketContext } from '../context/SocketContext';
import { useCall } from '../calling/CallContext';
import { CALL_STATE, STUN_URLS } from '../calling/callConstants';
import { fontFamily, fontWeight } from '../constants/fonts';

const MAX_MESSAGE_LENGTH = 500;

const makeId = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function LiveChatScreen({
    userId,
    partnerId,
    partnerName = 'Partner',
    partnerAvatar,
    onBack,
}) {
    const { width } = useWindowDimensions();
    const { socket, isConnected } = useSocketContext();
    const { callState } = useCall();
    const compact = width < 370;

    const [sessionId, setSessionId] = useState(null);
    const [error, setError] = useState(null);
    const [cameraEnabled, setCameraEnabled] = useState(false);
    const [cameraDenied, setCameraDenied] = useState(false);
    const [partnerCameraEnabled, setPartnerCameraEnabled] = useState(false);
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);

    // Live Chat deliberately owns two scalar slots. There is no message array.
    const [myMessage, setMyMessage] = useState(null);
    const [partnerMessage, setPartnerMessage] = useState(null);
    const [myDraft, setMyDraft] = useState('');

    const sessionIdRef = useRef(null);
    const participantCountRef = useRef(0);
    const shouldOfferRef = useRef(false);
    const peerConnectionRef = useRef(null);
    const localStreamRef = useRef(null);
    const remoteStreamRef = useRef(null);
    const pendingCandidatesRef = useRef([]);
    const mountedRef = useRef(true);
    const cameraPermissionAttemptedRef = useRef(false);
    const offerInFlightRef = useRef(false);

    const emitMediaState = useCallback((enabled) => {
        if (!sessionIdRef.current) return;
        socket?.emit('liveChat:mediaState', {
            sessionId: sessionIdRef.current,
            cameraEnabled: enabled,
        });
    }, [socket]);

    const stopCamera = useCallback(() => {
        localStreamRef.current?.getTracks?.().forEach(track => track.stop());
        localStreamRef.current = null;
        setLocalStream(null);
        setCameraEnabled(false);
        emitMediaState(false);
    }, [emitMediaState]);

    const closePeerConnection = useCallback(() => {
        peerConnectionRef.current?.close?.();
        peerConnectionRef.current = null;
        pendingCandidatesRef.current = [];
        remoteStreamRef.current = null;
        setRemoteStream(null);
        setPartnerCameraEnabled(false);
    }, []);

    const ensureFrontCamera = useCallback(async () => {
        const existingTrack = localStreamRef.current?.getVideoTracks?.()[0];
        if (existingTrack?.readyState === 'live') return localStreamRef.current;

        try {
            let cameraStatus = await permissions.query({ name: 'camera' });
            if (cameraStatus !== permissions.RESULT.GRANTED) {
                if (cameraPermissionAttemptedRef.current) {
                    setCameraDenied(true);
                    emitMediaState(false);
                    return null;
                }
                cameraPermissionAttemptedRef.current = true;
                const granted = await permissions.request({ name: 'camera' });
                if (!granted) {
                    cameraStatus = await permissions.query({ name: 'camera' });
                    setCameraDenied(cameraStatus !== permissions.RESULT.GRANTED);
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
            const track = stream.getVideoTracks()[0];
            if (!track) throw new Error('Front camera did not provide a video track.');

            localStreamRef.current = stream;
            const sender = peerConnectionRef.current
                ?.getSenders?.()
                .find(item => item.track?.kind === 'video' || item.track == null);
            if (sender) await sender.replaceTrack(track);
            if (!mountedRef.current) {
                stream.getTracks().forEach(item => item.stop());
                localStreamRef.current = null;
                return null;
            }
            setLocalStream(stream);
            setCameraDenied(false);
            setCameraEnabled(true);
            emitMediaState(true);
            return stream;
        } catch (cameraError) {
            setCameraEnabled(false);
            setCameraDenied(true);
            emitMediaState(false);
            return null;
        }
    }, [emitMediaState]);

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

    const createPeerConnection = useCallback((id, { attachLocal = true } = {}) => {
        closePeerConnection();
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
            if (!event.candidate) return;
            socket?.emit('liveChat:webrtc:iceCandidate', {
                sessionId: id,
                candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
            });
        });

        pc.addEventListener('connectionstatechange', () => {
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
        offerInFlightRef.current = true;
        await ensureFrontCamera();
        try {
            const pc = createPeerConnection(id, { attachLocal: true });
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket?.emit('liveChat:webrtc:offer', { sessionId: id, description: offer });
        } catch (offerError) {
            setError('Unable to start live video. Messages still work.');
        } finally {
            offerInFlightRef.current = false;
        }
    }, [createPeerConnection, ensureFrontCamera, socket]);

    const leaveSession = useCallback(() => {
        const id = sessionIdRef.current;
        if (id) socket?.emit('liveChat:leave', { sessionId: id });
        sessionIdRef.current = null;
        closePeerConnection();
        stopCamera();
    }, [closePeerConnection, socket, stopCamera]);

    useEffect(() => {
        if (!socket || !isConnected) {
            sessionIdRef.current = null;
            participantCountRef.current = 0;
            setSessionId(null);
            closePeerConnection();
            setError('Reconnect to enter Live Chat.');
            return undefined;
        }
        if (!partnerId) {
            setError('Pair with a partner before starting Live Chat.');
            return undefined;
        }
        if (callState !== CALL_STATE.IDLE) {
            const activeSessionId = sessionIdRef.current;
            if (activeSessionId) socket.emit('liveChat:leave', { sessionId: activeSessionId });
            sessionIdRef.current = null;
            setSessionId(null);
            closePeerConnection();
            stopCamera();
            setError('End your video call before starting Live Chat.');
            return undefined;
        }

        const onJoined = async data => {
            sessionIdRef.current = data.sessionId;
            participantCountRef.current = data.participantCount || 1;
            shouldOfferRef.current = data.shouldOffer === true;
            setSessionId(data.sessionId);
            setMyMessage(data.myMessage || null);
            setPartnerMessage(data.partnerMessage || null);
            await ensureFrontCamera();
            if ((data.participantCount || 1) > 1 && data.shouldOffer) startOffer();
        };
        const onPartnerJoined = async data => {
            if (data.sessionId !== sessionIdRef.current) return;
            participantCountRef.current = data.participantCount || 2;
            if (data.shouldOffer) shouldOfferRef.current = true;
            if (shouldOfferRef.current) await startOffer();
        };
        const onPartnerLeft = data => {
            if (data.sessionId !== sessionIdRef.current) return;
            participantCountRef.current = data.participantCount || 1;
            shouldOfferRef.current = data.shouldOffer === true;
            setPartnerMessage(null);
            closePeerConnection();
        };
        const onOffer = async data => {
            if (data.sessionId !== sessionIdRef.current) return;
            try {
                await ensureFrontCamera();
                const pc = createPeerConnection(data.sessionId, { attachLocal: false });
                await pc.setRemoteDescription(new RTCSessionDescription(data.description));
                const localTrack = localStreamRef.current?.getVideoTracks?.()[0];
                if (localTrack) pc.addTrack(localTrack, localStreamRef.current);
                await flushCandidates();
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.emit('liveChat:webrtc:answer', { sessionId: data.sessionId, description: answer });
            } catch (answerError) {
                setError('Unable to answer live video. Messages still work.');
            }
        };
        const onAnswer = async data => {
            if (data.sessionId !== sessionIdRef.current || !peerConnectionRef.current) return;
            try {
                await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.description));
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
            if (String(data.senderId) === String(userId)) setMyMessage(data.message);
            else setPartnerMessage(data.message);
        };
        const onPartnerMediaState = data => {
            if (data.sessionId !== sessionIdRef.current || String(data.senderId) === String(userId)) return;
            setPartnerCameraEnabled(data.cameraEnabled === true);
            if (data.cameraEnabled === true && shouldOfferRef.current && participantCountRef.current > 1) {
                startOffer();
            }
        };
        const onError = data => {
            setError(data.message || 'Live Chat could not start.');
            if (data.code === 'NORMAL_CALL_ACTIVE') {
                closePeerConnection();
                stopCamera();
            }
        };

        socket.on('liveChat:joined', onJoined);
        socket.on('liveChat:partnerJoined', onPartnerJoined);
        socket.on('liveChat:partnerLeft', onPartnerLeft);
        socket.on('liveChat:webrtc:offer', onOffer);
        socket.on('liveChat:webrtc:answer', onAnswer);
        socket.on('liveChat:webrtc:iceCandidate', onCandidate);
        socket.on('liveChat:messageUpdated', onMessage);
        socket.on('liveChat:partnerMediaState', onPartnerMediaState);
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
            socket.off('liveChat:partnerMediaState', onPartnerMediaState);
            socket.off('liveChat:error', onError);
        };
    }, [callState, closePeerConnection, createPeerConnection, ensureFrontCamera, flushCandidates, isConnected, partnerId, socket, startOffer, stopCamera, userId]);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            leaveSession();
        };
    }, [leaveSession]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', async nextState => {
            if (nextState !== 'active') {
                stopCamera();
                return;
            }
            const cameraStatus = await permissions.query({ name: 'camera' }).catch(() => permissions.RESULT.DENIED);
            if (cameraStatus === permissions.RESULT.GRANTED && sessionIdRef.current) {
                await ensureFrontCamera();
                if (shouldOfferRef.current && participantCountRef.current > 1) startOffer();
            }
        });
        return () => subscription.remove();
    }, [ensureFrontCamera, startOffer, stopCamera]);

    const handleDraftChange = useCallback((text) => {
        setMyDraft(text);
    }, []);

    const handleSend = useCallback(() => {
        const text = myDraft.trim();
        if (!text || !sessionIdRef.current) return;
        socket?.emit('liveChat:message:set', {
            sessionId: sessionIdRef.current,
            text,
            clientMessageId: makeId('message'),
        });
        setMyDraft('');
    }, [myDraft, socket]);

    const toggleFrontCamera = useCallback(async () => {
        if (cameraEnabled) {
            stopCamera();
            return;
        }
        await ensureFrontCamera();
        if (shouldOfferRef.current && participantCountRef.current > 1) startOffer();
    }, [cameraEnabled, ensureFrontCamera, startOffer, stopCamera]);

    const handleBack = useCallback(() => {
        leaveSession();
        onBack?.();
    }, [leaveSession, onBack]);

    const partnerDisplayText = partnerMessage?.text || '';
    const myDisplayText = myDraft || myMessage?.text || '';
    const videoSize = compact ? { width: 62, height: 72 } : { width: 72, height: 84 };
    const canSend = Boolean(myDraft.trim() && sessionId);

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
                    <TouchableOpacity style={styles.headerButton} onPress={handleBack} accessibilityLabel="Back to chats">
                        <Text style={styles.backIcon}>‹</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Live Chat</Text>
                    <TouchableOpacity style={styles.headerButton} onPress={toggleFrontCamera} accessibilityLabel="Toggle front camera">
                        <Text style={styles.cameraButtonText}>{cameraEnabled ? '●' : '○'}</Text>
                    </TouchableOpacity>
                </View>

                {(error || cameraDenied) && (
                    <View style={styles.errorCard}>
                        <Text style={styles.errorText}>
                            {error || 'Front-camera permission is off. Messages still work.'}
                        </Text>
                        {cameraDenied && (
                            <TouchableOpacity onPress={() => Linking.openSettings()}>
                                <Text style={styles.settingsText}>Open Settings</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                <KeyboardAvoidingView
                    style={styles.body}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    keyboardVerticalOffset={0}
                >
                    <View style={styles.stage}>
                        <View style={styles.messageRow}>
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
                                                <Text style={styles.partnerInitial}>{partnerName.charAt(0).toUpperCase()}</Text>
                                            )}
                                        </LinearGradient>
                                    )}
                                </View>
                                <View style={[styles.liveDot, !(remoteStream && partnerCameraEnabled) && styles.liveDotOff]} />
                            </View>
                            <View style={styles.messageContent}>
                                <Text style={styles.personName}>{partnerName}</Text>
                                <Text style={[styles.messageText, !partnerDisplayText && styles.emptyMessageText]}>
                                    {partnerDisplayText || '...'}
                                </Text>
                            </View>
                        </View>

                        <View style={[styles.messageRow, styles.myMessageRow]}>
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
                                        </LinearGradient>
                                    )}
                                </View>
                                <View style={[styles.liveDot, styles.myLiveDot, !(localStream && cameraEnabled) && styles.liveDotOff]} />
                            </View>
                            <View style={styles.messageContent}>
                                <Text style={styles.personName}>You</Text>
                                <Text style={[styles.messageText, !myDisplayText && styles.emptyMessageText]}>
                                    {myDisplayText || '...'}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.composerArea}>
                        <View style={styles.composer}>
                            <TextInput
                                value={myDraft}
                                onChangeText={handleDraftChange}
                                style={styles.input}
                                placeholder="Type a message…"
                                placeholderTextColor="#A99CA9"
                                maxLength={MAX_MESSAGE_LENGTH}
                                multiline
                                editable={Boolean(sessionId)}
                            />
                            <TouchableOpacity
                                style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
                                onPress={handleSend}
                                disabled={!canSend}
                            >
                                <Text style={styles.sendIcon}>➤</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
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
    backIcon: { color: '#1B1237', fontSize: 38, lineHeight: 39, marginTop: -3 },
    cameraButtonText: { color: '#D84F86', fontSize: 23 },
    headerTitle: {
        color: '#1B1237', fontSize: 20, fontFamily: fontFamily.extraBold,
        fontWeight: fontWeight('800'),
    },
    errorCard: {
        marginHorizontal: 18, marginTop: 4, borderRadius: 14, padding: 11,
        backgroundColor: 'rgba(255,255,255,0.78)', borderWidth: 1, borderColor: '#F2BFD3',
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    },
    errorText: { color: '#7A3655', fontSize: 12, flex: 1, fontFamily: fontFamily.medium },
    settingsText: { color: '#D84F86', fontSize: 12, fontFamily: fontFamily.bold },
    body: { flex: 1 },
    stage: { flex: 1, justifyContent: 'center', paddingHorizontal: 16, paddingBottom: 10, gap: 12 },
    messageRow: {
        width: '92%', minHeight: 84, flexDirection: 'row', alignItems: 'stretch',
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
    liveDot: {
        position: 'absolute', width: 10, height: 10, borderRadius: 5,
        right: 7, bottom: 7, backgroundColor: '#42B883', borderWidth: 2, borderColor: '#FFFFFF',
    },
    myLiveDot: { backgroundColor: '#FF758F' },
    liveDotOff: { backgroundColor: '#B8ADB7' },
    messageContent: { flex: 1, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 9 },
    personName: { color: '#D84F86', fontSize: 10, fontFamily: fontFamily.bold, marginBottom: 3 },
    messageText: { color: '#1B1237', fontSize: 15, lineHeight: 20, fontFamily: fontFamily.medium },
    emptyMessageText: { color: '#B1A3AD' },
    composerArea: { paddingHorizontal: 16, paddingBottom: Platform.OS === 'android' ? 14 : 6 },
    composer: {
        minHeight: 62, maxHeight: 116, borderRadius: 31, borderWidth: 1.5,
        borderColor: '#F0B9D0', backgroundColor: 'rgba(255,255,255,0.92)',
        flexDirection: 'row', alignItems: 'flex-end', padding: 7,
        shadowColor: '#C15E89', shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1, shadowRadius: 12, elevation: 3,
    },
    input: {
        flex: 1, minHeight: 46, maxHeight: 98, color: '#1B1237', fontSize: 16,
        paddingHorizontal: 14, paddingVertical: 12, fontFamily: fontFamily.medium,
    },
    sendButton: {
        width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#FF758F',
    },
    sendButtonDisabled: { backgroundColor: '#E5D6DE' },
    sendIcon: { color: '#FFFFFF', fontSize: 23, transform: [{ rotate: '-45deg' }], marginLeft: 3 },
});
