// A transparent expo-gl surface that draws the Letter Bird over whatever is behind it.
// The caller drives the bird each frame through `onFrame(sprite, t, dt)`; return false to stop.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, PixelRatio, Platform, StyleSheet, View } from 'react-native';
import { GLView } from 'expo-gl';
import * as THREE from 'three';
import { getCachedLetterBirdAssets, loadLetterBirdAssets } from './letterBirdAssets';
import { createBirdSprite } from './birdSprite';

const TARGET_DENSITY = Platform.OS === 'ios' ? 2 : 1.75;
const RENDER_SCALE = Math.min(1, TARGET_DENSITY / PixelRatio.get());
// three.js asks for a few WebGL-only pixelStorei flags that expo-gl does not implement.
const IGNORED_PIXEL_STORE = new Set([0x9240, 0x9241, 0x9243]);
const nowMs = () => (global.performance?.now ? global.performance.now() : Date.now());

const LetterBirdCanvas = ({ style, onFrame, onReady, onError, paperColor }) => {
    const [assets, setAssets] = useState(getCachedLetterBirdAssets);
    const [size, setSize] = useState(null);
    const engine = useRef(null);
    const onFrameRef = useRef(onFrame);
    const onReadyRef = useRef(onReady);
    onFrameRef.current = onFrame;
    onReadyRef.current = onReady;

    useEffect(() => {
        if (assets) return undefined;
        let alive = true;
        loadLetterBirdAssets()
            .then((a) => { if (alive) setAssets(a); })
            .catch((e) => {
                console.warn('[LetterBirdCanvas] failed to load bird', e);
                onError?.(e);
            });
        return () => { alive = false; };
    }, [assets, onError]);

    const stop = useCallback(() => {
        const e = engine.current;
        if (!e) return;
        e.running = false;
        if (e.raf != null) cancelAnimationFrame(e.raf);
        e.raf = null;
    }, []);

    const frame = useCallback(() => {
        const e = engine.current;
        if (!e || !e.running) return;
        const now = nowMs();
        const dt = Math.min(0.05, (now - e.last) / 1000);
        e.last = now;
        e.t += dt;
        const keepGoing = onFrameRef.current?.(e.sprite, e.t, dt);
        e.renderer.render(e.sprite.scene, e.sprite.camera);
        e.gl.endFrameEXP();
        if (!e.readySent) {
            e.readySent = true;
            onReadyRef.current?.();
        }
        if (keepGoing === false) {
            e.running = false;
            return;
        }
        e.raf = requestAnimationFrame(frame);
    }, []);

    const start = useCallback(() => {
        const e = engine.current;
        if (!e || e.running) return;
        e.running = true;
        e.last = nowMs();
        e.raf = requestAnimationFrame(frame);
    }, [frame]);

    const onContextCreate = useCallback((gl) => {
        if (!assets || !size) return;
        if (engine.current) {
            stop();
            engine.current.sprite.dispose();
            engine.current.renderer.dispose();
            engine.current = null;
        }
        const nativePixelStorei = gl.pixelStorei.bind(gl);
        gl.pixelStorei = (pname, value) => {
            if (!IGNORED_PIXEL_STORE.has(pname)) nativePixelStorei(pname, value);
        };
        const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
        const canvas = {
            width: W, height: H, clientWidth: W, clientHeight: H, style: {},
            addEventListener: () => {}, removeEventListener: () => {}, getContext: () => gl,
        };
        const renderer = new THREE.WebGLRenderer({
            canvas, context: gl, antialias: false, alpha: true, premultipliedAlpha: true, stencil: false,
            powerPreference: 'high-performance',
        });
        renderer.setPixelRatio(1);
        renderer.setSize(W, H, false);
        renderer.setClearColor(0x000000, 0);

        const sprite = createBirdSprite(assets);
        sprite.setViewport(size.width, size.height);
        if (paperColor) sprite.setPaperColor(paperColor);
        renderer.compile(sprite.scene, sprite.camera);
        engine.current = { gl, renderer, sprite, raf: null, last: 0, t: 0, running: false, readySent: false };
        if (AppState.currentState === 'active') start();
        // paperColor is only read when the surface is created.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [assets, size, start, stop]);

    useEffect(() => {
        const sub = AppState.addEventListener('change', (state) => {
            if (state === 'active') start();
            else stop();
        });
        return () => sub.remove();
    }, [start, stop]);

    useEffect(() => () => {
        const e = engine.current;
        engine.current = null;
        if (!e) return;
        e.running = false;
        if (e.raf != null) cancelAnimationFrame(e.raf);
        e.sprite.dispose();
        e.renderer.dispose();
    }, []);

    const glFrame = useMemo(() => {
        if (!size) return null;
        const w = Math.round(size.width * RENDER_SCALE), h = Math.round(size.height * RENDER_SCALE);
        return {
            position: 'absolute', width: w, height: h,
            left: (size.width - w) / 2, top: (size.height - h) / 2,
            backgroundColor: 'transparent',
            transform: [{ scale: 1 / RENDER_SCALE }],
        };
    }, [size]);

    const onLayout = useCallback((e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize((prev) => (prev && Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1
            ? prev : { width, height }));
    }, []);

    const glKey = size ? `${Math.round(size.width)}x${Math.round(size.height)}` : 'none';

    return (
        <View style={[styles.container, style]} onLayout={onLayout} pointerEvents="none">
            {assets && size ? (
                <GLView key={glKey} style={glFrame} msaaSamples={4} onContextCreate={onContextCreate} />
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'transparent',
        overflow: 'hidden',
    },
});

export default LetterBirdCanvas;
