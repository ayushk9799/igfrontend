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
const savePathsToWidget = async (paths, fromUserName, timestamp) => {
    if (!ScribbleWidgetBridge) {
        return;
    }
    try {
        await ScribbleWidgetBridge.saveScribblePaths(paths, {
            senderName: fromUserName || 'Your Love',
            timestamp: timestamp || new Date().toISOString(),
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
    const [partnerScribble, setPartnerScribble] = useState(null); // Partner's scribble
    const socketRef = useRef(null);
    const appState = useRef(AppState.currentState);
    const onMoodUpdatedRef = useRef(null); // Callback for when mood is updated

    // Initialize socket connection
    const connect = useCallback(() => {
        const user = getUser();
        if (!user?.id) {
            return;
        }

        // Check if already connected
        if (socketRef.current?.connected) {
            // If the connected userId matches the current user, we're good
            if (socketRef.current.auth?.userId === user.id) {
                return;
            }
            // Otherwise, we have a stale connection (e.g. after logout/login)
            socketRef.current.disconnect();
        }

        setConnectionState(CONNECTION_STATE.CONNECTING);


        // Create socket connection with auth
        const socketInstance = io(API_BASE, {
            auth: {
                userId: user.id,
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
                // Partner has no mood set - use default
                setPartnerMood({ id: 'relaxed', emoji: 'relaxed', label: 'Relaxed', updatedAt: null });
            }
        });

        // Mood events - user's own mood
        socketInstance.on('mood:myMood', (data) => {
            if (data.mood) {
                setUserMood(data.mood);
            }
        });


        // Scribble events - partner's scribble
        socketInstance.on('scribble:received', (data) => {
            setPartnerScribble({
                paths: data.paths,
                fromUserName: data.fromUserName,
                timestamp: data.timestamp,
            });
            // Save paths to App Group for widget
            savePathsToWidget(data.paths, data.fromUserName, data.timestamp);
        });

        socketInstance.on('scribble:sent', (data) => {
        });

        socketInstance.on('scribble:error', (data) => {
            console.error('❌ Scribble error:', data.message);
        });

        // Scribble loaded from DB (partner's scribble sent when user was offline)
        socketInstance.on('scribble:partnerScribble', (data) => {
            if (data.hasScribble && data.paths && data.paths.length > 0) {
                setPartnerScribble({
                    paths: data.paths,
                    fromUserName: data.fromUserName,
                    timestamp: data.timestamp,
                });
                // Save paths to App Group for widget
                savePathsToWidget(data.paths, data.fromUserName, data.timestamp);
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


    // Context value
    const value = {
        socket,
        connectionState,
        isConnected: connectionState === CONNECTION_STATE.CONNECTED,
        partnerOnline,
        partnerMood,
        userMood,
        partnerScribble,
        connect,
        disconnect,
        setOnMoodUpdated,
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
            partnerScribble: null,
            connect: () => { },
            disconnect: () => { },
            setOnMoodUpdated: () => { },
        };
    }
    return context;
};

export default SocketContext;
