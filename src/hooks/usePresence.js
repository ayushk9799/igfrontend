// usePresence - Hook for partner online/offline status
import { useCallback } from 'react';
import { useSocketContext } from '../context/SocketContext';

/**
 * Hook for partner presence (online/offline status)
 * @returns {{
 *   partnerOnline: boolean,
 *   isConnected: boolean,
 *   refreshPresence: () => void,
 *   sendNudge: (type?: string) => void
 * }}
 */
export const usePresence = () => {
    const { socket, isConnected, partnerOnline } = useSocketContext();

    /**
     * Refresh partner's online status
     */
    const refreshPresence = useCallback(() => {
        if (!socket || !isConnected) {
            return;
        }

        socket.emit('presence:getStatus');
    }, [socket, isConnected]);

    /**
     * Send a nudge/ping to partner
     */
    const sendNudge = useCallback((type = 'default') => {
        if (!socket || !isConnected) {
            console.warn('Socket not connected, cannot send nudge');
            return;
        }

        socket.emit('nudge:send', { type });
    }, [socket, isConnected]);

    return {
        partnerOnline,
        isConnected,
        refreshPresence,
        sendNudge,
    };
};

export default usePresence;
