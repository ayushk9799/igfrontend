/**
 * Safe AudioRecorderPlayer factory
 *
 * In Release builds (Hermes bytecode), if the native module
 * `RNAudioRecorderPlayer` is unavailable the constructor or its first native
 * call (`setSubscriptionDuration`) can throw and crash the app.
 *
 * This helper centralises the guard so every call-site doesn't need its own
 * try-catch around instantiation.
 */
import { NativeModules, Platform } from 'react-native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';

/**
 * @returns {AudioRecorderPlayer | null}  A ready-to-use player instance, or
 *          `null` when the native module is missing / broken.
 */
export function createSafeAudioPlayer() {
    try {
        // On iOS the library creates a NativeEventEmitter(RNAudioRecorderPlayer)
        // at playback-start time.  If the native module is undefined that call
        // throws `new NativeEventEmitter() requires a non-null argument`.
        // Guard early so we never reach that code path.
        if (Platform.OS === 'ios' && !NativeModules.RNAudioRecorderPlayer) {
            console.warn('[safeAudioPlayer] RNAudioRecorderPlayer native module is unavailable on iOS');
            return null;
        }

        // On Android the native module must also be present for
        // startPlayer / startRecorder / setSubscriptionDuration etc.
        if (Platform.OS === 'android' && !NativeModules.RNAudioRecorderPlayer) {
            console.warn('[safeAudioPlayer] RNAudioRecorderPlayer native module is unavailable on Android');
            return null;
        }

        const player = new AudioRecorderPlayer();
        return player;
    } catch (error) {
        console.warn('[safeAudioPlayer] Failed to create AudioRecorderPlayer:', error?.message || error);
        return null;
    }
}
