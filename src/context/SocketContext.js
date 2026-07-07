// Socket Context - Provides socket connection to entire app
import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { AppState, NativeModules, Platform } from 'react-native';
import { API_BASE } from '../constants/Api';
import { getUser } from '../utils/authStorage';
import { setAuthErrorHandler } from '../utils/apiFetch';

// Create context
const SocketContext = createContext(null);

// Socket connection states
export const CONNECTION_STATE = {
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    ERROR: 'error',
};

// Get native widget bridge
const { ScribbleWidgetBridge } = NativeModules;

/**
 * Save scribble paths to widget storage for display
 * Works on both iOS (App Group) and Android (SharedPreferences)
 */
const getScribbleDimensions = (data = {}) => {
    const canvasWidth = Number(data.canvasWidth);
    const canvasHeight = Number(data.canvasHeight);
    return {
        canvasWidth: Number.isFinite(canvasWidth) && canvasWidth > 0 ? canvasWidth : 350,
        canvasHeight: Number.isFinite(canvasHeight) && canvasHeight > 0 ? canvasHeight : (
            Number.isFinite(canvasWidth) && canvasWidth > 0 ? canvasWidth : 350
        ),
    };
};

const createPartnerScribble = (data = {}, paths = data.paths || []) => {
    const dimensions = getScribbleDimensions(data);
    return {
        paths,
        canvasWidth: dimensions.canvasWidth,
        canvasHeight: dimensions.canvasHeight,
        fromUserName: data.fromUserName,
        timestamp: data.timestamp,
    };
};

const savePathsToWidget = async (paths, fromUserName, timestamp, dimensions = {}) => {
    if (!ScribbleWidgetBridge) {
        return;
    }
    try {
        await ScribbleWidgetBridge.saveScribblePaths(paths, {
            senderName: fromUserName || 'Your Love',
            timestamp: timestamp || new Date().toISOString(),
            ...getScribbleDimensions(dimensions),
        });

        // Debug: Check what's in the App Group after saving
        if (Platform.OS === 'ios' && ScribbleWidgetBridge.getScribbleStatus) {
            const status = await ScribbleWidgetBridge.getScribbleStatus();
        }
    } catch (error) {
        console.error('❌ Failed to save paths to widget:', error);
    }
};

/**
 * SocketProvider - Wrap your app with this to enable socket functionality
 */
export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [connectionState, setConnectionState] = useState(CONNECTION_STATE.DISCONNECTED);
    const [partnerOnline, setPartnerOnline] = useState(false);
    const [partnerMood, setPartnerMood] = useState(null);
    const [userMood, setUserMood] = useState(null); // User's own saved mood
    const [moodHistory, setMoodHistory] = useState([]);
    const [partnerMoodHistory, setPartnerMoodHistory] = useState([]);
    const [partnerScribble, setPartnerScribble] = useState(null); // Partner's scribble
    const socketRef = useRef(null);
    const appState = useRef(AppState.currentState);
    const onMoodUpdatedRef = useRef(null); // Callback for when mood is updated

    // Initialize socket connection
    const connect = useCallback(() => {
        const user = getUser();
        const userId = user?.id || user?._id;
        if (!userId) {
            return;
        }

        // Check if already connected
        if (socketRef.current?.connected) {
            // If the connected userId matches the current user, we're good
            if (socketRef.current.auth?.userId === userId) {
                return;
            }
            // Otherwise, we have a stale connection (e.g. after logout/login)
            socketRef.current.disconnect();
        }

        setConnectionState(CONNECTION_STATE.CONNECTING);


        // Create socket connection with auth
        const socketInstance = io(API_BASE, {
            auth: {
                userId,
            },
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
        });


        // Connection events
        socketInstance.on('connect', () => {
            setConnectionState(CONNECTION_STATE.CONNECTED);

            // Request current moods and status
            socketInstance.emit('presence:getStatus');
            socketInstance.emit('mood:getPartner');
            socketInstance.emit('mood:getMyMood'); // Fetch user's own saved mood
            socketInstance.emit('mood:getHistory', { days: 31 });
            socketInstance.emit('mood:getPartnerHistory', { days: 31 });
            socketInstance.emit('scribble:getPartner'); // Fetch partner's scribble
        });

        socketInstance.on('disconnect', (reason) => {
            setConnectionState(CONNECTION_STATE.DISCONNECTED);
        });

        socketInstance.on('connect_error', (error) => {
            console.error(`❌ Socket connection error: ${error.message}`);
            setConnectionState(CONNECTION_STATE.ERROR);

            // Check if this is an authentication error
            const errorMsg = error.message?.toLowerCase() || '';
            if (errorMsg.includes('authentication') ||
                errorMsg.includes('user not found') ||
                errorMsg.includes('unauthorized') ||
                errorMsg.includes('invalid token')) {
                // Trigger global auth error handler
                const { triggerAuthError } = require('../utils/apiFetch');
                triggerAuthError({
                    status: 401,
                    message: error.message || 'Socket authentication failed',
                    source: 'socket',
                });
            }
        });

        // Presence events
        socketInstance.on('presence:online', (data) => {
            setPartnerOnline(true);
        });

        socketInstance.on('presence:offline', (data) => {
            setPartnerOnline(false);
        });

        socketInstance.on('presence:status', (data) => {
            setPartnerOnline(data.isOnline);
        });

        // Mood events - partner's mood
        socketInstance.on('mood:changed', (data) => {
            setPartnerMood(data.mood);
        });

        socketInstance.on('mood:partnerMood', (data) => {
            if (data.mood && data.mood.emoji) {
                setPartnerMood(data.mood);
                setPartnerOnline(data.isOnline);
            } else {
                setPartnerMood(null);
            }
        });

        // Mood events - user's own mood
        socketInstance.on('mood:myMood', (data) => {
            setUserMood(data.mood || null);
        });

        socketInstance.on('mood:history', (data) => {
            setMoodHistory(Array.isArray(data.history) ? data.history : []);
        });

        socketInstance.on('mood:partnerHistory', (data) => {
            setPartnerMoodHistory(Array.isArray(data.history) ? data.history : []);
        });

        socketInstance.on('mood:historyItemAdded', (data) => {
            if (data.mood) {
                setMoodHistory(prev => [data.mood, ...prev].slice(0, 200));
            }
        });

        socketInstance.on('mood:partnerHistoryItemAdded', (data) => {
            if (data.mood) {
                setPartnerMoodHistory(prev => [data.mood, ...prev].slice(0, 200));
            }
        });


        // Scribble events - partner's scribble
        socketInstance.on('scribble:received', (data) => {
            const scribble = createPartnerScribble(data);
            setPartnerScribble(scribble);
            // Save paths to App Group for widget
            savePathsToWidget(data.paths, data.fromUserName, data.timestamp, scribble);
        });

        socketInstance.on('scribble:liveStrokeReceived', (data) => {
            if (!data.stroke?.d) return;
            setPartnerScribble(prev => {
                const nextPaths = [...(prev?.paths || []), data.stroke];
                const scribble = createPartnerScribble({
                    ...prev,
                    ...data,
                    canvasWidth: data.canvasWidth || prev?.canvasWidth,
                    canvasHeight: data.canvasHeight || prev?.canvasHeight,
                }, nextPaths);
                savePathsToWidget(nextPaths, data.fromUserName, data.timestamp, scribble);
                return scribble;
            });
        });

        socketInstance.on('scribble:liveCleared', (data) => {
            const scribble = createPartnerScribble(data, []);
            setPartnerScribble(scribble);
            savePathsToWidget([], data.fromUserName, data.timestamp, scribble);
        });

        socketInstance.on('scribble:liveUndone', (data) => {
            if (!data.strokeId) return;
            setPartnerScribble(prev => {
                const nextPaths = (prev?.paths || []).filter(path => path.id !== data.strokeId);
                const scribble = createPartnerScribble({
                    ...prev,
                    ...data,
                    canvasWidth: data.canvasWidth || prev?.canvasWidth,
                    canvasHeight: data.canvasHeight || prev?.canvasHeight,
                }, nextPaths);
                savePathsToWidget(nextPaths, data.fromUserName, data.timestamp, scribble);
                return scribble;
            });
        });

        socketInstance.on('scribble:sent', (data) => {
            if (!Array.isArray(data.paths)) return;
            const scribble = createPartnerScribble(data);
            setPartnerScribble(scribble);
            savePathsToWidget(data.paths, data.fromUserName, data.timestamp, scribble);
        });

        socketInstance.on('scribble:liveSaved', (data) => {
            if (!Array.isArray(data.paths)) return;
            const scribble = createPartnerScribble(data);
            setPartnerScribble(scribble);
            savePathsToWidget(data.paths, data.fromUserName, data.timestamp, scribble);
        });

        socketInstance.on('scribble:error', (data) => {
            console.error('❌ Scribble error:', data.message);
        });

        // Scribble loaded from DB (partner's scribble sent when user was offline)
        socketInstance.on('scribble:partnerScribble', (data) => {
            if (data.hasScribble && data.paths && data.paths.length > 0) {
                const scribble = createPartnerScribble(data);
                setPartnerScribble(scribble);
                // Save paths to App Group for widget
                savePathsToWidget(data.paths, data.fromUserName, data.timestamp, scribble);
            } else if (Array.isArray(data.paths) && data.paths.length === 0) {
                const scribble = createPartnerScribble(data, []);
                setPartnerScribble(scribble);
                savePathsToWidget([], data.fromUserName, data.timestamp, scribble);
            }
        });

        socketRef.current = socketInstance;
        setSocket(socketInstance);
    }, []);

    // Disconnect socket
    const disconnect = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
            setSocket(null);
            setConnectionState(CONNECTION_STATE.DISCONNECTED);
        }
    }, []);

    // Handle app state changes (background/foreground)
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
                // App came to foreground - reconnect if disconnected
                connect();
            } else if (nextAppState.match(/inactive|background/)) {
                // App went to background - could optionally disconnect
                // We keep the connection alive for push-like behavior
            }
            appState.current = nextAppState;
        });

        return () => {
            subscription?.remove();
        };
    }, [connect]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    // Function to set the mood updated callback
    const setOnMoodUpdated = useCallback((callback) => {
        onMoodUpdatedRef.current = callback;
    }, []);

    const refreshMoodHistory = useCallback((days = 31) => {
        socketRef.current?.emit('mood:getHistory', { days });
        socketRef.current?.emit('mood:getPartnerHistory', { days });
    }, []);


    // Context value
    const value = {
        socket,
        connectionState,
        isConnected: connectionState === CONNECTION_STATE.CONNECTED,
        partnerOnline,
        partnerMood,
        userMood,
        moodHistory,
        partnerMoodHistory,
        partnerScribble,
        connect,
        disconnect,
        setOnMoodUpdated,
        refreshMoodHistory,
    };

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
};

/**
 * Hook to access socket context
 */
export const useSocketContext = () => {
    const context = useContext(SocketContext);
    // Return safe defaults instead of throwing to prevent hooks order error
    if (!context) {
        return {
            socket: null,
            connectionState: CONNECTION_STATE.DISCONNECTED,
            isConnected: false,
            partnerOnline: false,
            partnerMood: null,
            userMood: null,
            moodHistory: [],
            partnerMoodHistory: [],
            partnerScribble: null,
            connect: () => { },
            disconnect: () => { },
            setOnMoodUpdated: () => { },
            refreshMoodHistory: () => { },
        };
    }
    return context;
};

export default SocketContext;
