// useSocket - Simple hook to get socket instance
import { useSocketContext } from '../context/SocketContext';

/**
 * Hook to get the socket instance directly
 * Use this in components that need direct socket access
 * 
 * @returns {Socket | null} The socket.io socket instance
 */
export const useSocket = () => {
    const { socket } = useSocketContext();
    return socket;
};

export default useSocket;
