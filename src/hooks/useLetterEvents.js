import { useEffect, useRef } from 'react';
import { useSocketContext } from '../context/SocketContext';

export const LETTER_SOCKET_EVENTS = ['letter:sent', 'letter:delivered', 'letter:read', 'letter:recalled'];

/**
 * Calls onEvent(eventName, payload) when a letter changes for this couple.
 * Payloads carry no letter text, so callers refetch to get what they may see.
 */
const useLetterEvents = (onEvent) => {
    const { socket } = useSocketContext();
    const handlerRef = useRef(onEvent);
    handlerRef.current = onEvent;

    useEffect(() => {
        if (!socket) return undefined;
        const listeners = LETTER_SOCKET_EVENTS.map((eventName) => {
            const listener = (payload) => handlerRef.current?.(eventName, payload);
            socket.on(eventName, listener);
            return [eventName, listener];
        });
        return () => {
            listeners.forEach(([eventName, listener]) => socket.off(eventName, listener));
        };
    }, [socket]);
};

export default useLetterEvents;
