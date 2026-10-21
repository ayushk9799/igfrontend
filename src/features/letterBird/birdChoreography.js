// Poses for the Write Letter bird: waiting on the letter, then carrying it off.
// Everything is in screen points (y down) and seconds. Uses rig v2 extras: blink, jaw (chirp), head tilt.
import { FLICK, FOLD, GLIDE, flapPose, mixPose } from './letterBirdScene';

const TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = (u) => u * u * (3 - 2 * u);
const easeIn = (u) => u * u;
const arc = (u) => Math.sin(Math.PI * clamp(u));
const bump = (t, a, b) => (t >= a && t <= b ? arc(seg(t, a, b)) : 0);
// quick close-and-open, peaks at 1 halfway through `len` seconds
const blinkAt = (t, at, len = 0.16) => bump(t, at, at + len);
const bez = (p0, p1, p2, p3, u) => {
    const v = 1 - u;
    return [0, 1].map((i) => v * v * v * p0[i] + 3 * v * v * u * p1[i] + 3 * v * u * u * p2[i] + u * u * u * p3[i]);
};

// Perch geometry, shared by the screen (where the small canvas sits) and the flight.
export const BIRD_SIZE = 150;             // feet to crest, points
export const PERCH_W = 176;
export const PERCH_H = 150;
export const PERCH_RIGHT = 6;            // canvas inset from the paper's right edge
export const PERCH_FEET_FROM_BOTTOM = 6; // feet sit this far above the canvas bottom
export const PERCH_SINK = 14;            // feet sit this far down onto the paper, so it stands on the letter
export const PERCH_YAW = -Math.PI / 2 - 0.5;   // three-quarter view, turned toward the letter

// Rolled letter, as left by LetterSendAnimation.
export const SCROLL_RADIUS = 14;

const IDLE = 9.6;   // seconds per idle loop
// Wings held open for a big stretch.
const STRETCH = { flap: 0.62, sweep: -0.08, twist: 0.18, tipFlap: 0.3, tipFold: 0 };

/**
 * Idle on the letter, facing you: blinking and looking about, a big wing stretch and a little
 * hover flight. `t` is seconds since the bird appeared; it plays once, then holds still.
 */
export function perchedPose(t, x, y) {
    t = Math.min(Math.max(0, t), IDLE - 0.001);
    const k = t;
    const cycle = 0;
    const odd = cycle % 2 === 1;

    // --- wing stretch (even loops) or three quick flaps in place (odd loops), 2.2s - 3.9s
    const sIn = smooth(seg(k, 2.2, 2.55)), sOut = 1 - smooth(seg(k, 3.45, 3.9));
    const stretch = odd ? 0 : sIn * sOut;
    const flutter = stretch * 0.06 * Math.sin(k * TAU * 7);
    const flapBurst = odd ? sIn * sOut : 0;

    // --- hover: hop up, flap, hang there a moment, settle back down, 5.4s - 7.3s
    const hov = seg(k, 5.4, 7.3);
    const hovering = k >= 5.4 && k <= 7.3;
    const lift = hovering ? 38 * Math.pow(arc(hov), 0.7) : 0;
    const hoverSpread = smooth(seg(k, 5.3, 5.5)) * (1 - smooth(seg(k, 7.15, 7.4)));
    const land = bump(k, 7.3, 7.55);
    const takeoff = bump(k, 5.15, 5.42);

    // wings: folded, stretched, or flapping (burst / hover)
    let wing = mixPose(FOLD, mixPose(STRETCH, { ...STRETCH, flap: STRETCH.flap + flutter }, 1), stretch);
    const flapping = Math.max(flapBurst, hoverSpread);
    if (flapping > 0) {
        const ph = (k - (hovering || k > 7 ? 5.3 : 2.2)) * (hovering ? 4.8 : 5.5);
        wing = mixPose(wing, flapPose(ph), flapping);
    }
    const flick = bump(k, 8.6, 9.0);
    if (flick > 0) wing = mixPose(wing, FLICK, flick);

    // face and head
    const lookDown = smooth(seg(k, 4.1, 4.4)) * (1 - smooth(seg(k, 4.9, 5.15)));
    const tilt = bump(k, 0.3, 1.3) * (odd ? -1 : 1);
    const chirp = bump(k, 1.3, 1.46) + bump(k, 1.54, 1.7) + bump(k, 6.2, 6.38);
    const blink = Math.max(
        blinkAt(k, 0.95), blinkAt(k, 4.6), blinkAt(k, 8.1),
        odd ? blinkAt(k, 8.32) : 0,
        0.85 * stretch,            // eyes shut, enjoying the stretch
        0.3 * lookDown,
    );

    return {
        x, y: y - lift, size: BIRD_SIZE,
        yaw: -Math.PI / 2 + 0.1 * Math.sin(t * 0.4),
        pitch: -0.08 * stretch + 0.1 * hoverSpread - 0.12 * takeoff,
        breathe: Math.sin(t * TAU * 0.8) * (1 - flapping),
        headTurn: 0.25 * Math.sin(t * 0.75) * (1 - stretch) * (1 - hoverSpread * 0.6),
        headPitch: 0.1 * stretch + 0.05 * chirp - 0.13 * lookDown,
        headTilt: 0.2 * tilt,
        neckPitch: -0.06 * lookDown,
        crest: Math.max(stretch, hoverSpread, flapBurst, chirp * 0.6, flick),
        jaw: 0.7 * chirp + 0.4 * stretch * bump(k, 2.6, 3.3),
        blink,
        tailUp: 0.25 * stretch + 0.15 * hoverSpread + 0.08 * flick,
        tailSway: 0.06 * Math.sin(t * 1.3),
        crouch: 0.05 * takeoff + 0.05 * land,
        grip: 0.35 * smooth(seg(k, 5.45, 5.7)) * (1 - smooth(seg(k, 7.0, 7.3))),
        wing,
    };
}

/**
 * Flight timeline. `perch` is where the feet start, `scroll` is the rolled
 * letter { x, y, length } (centre), `screen` is { width }.
 */
export const FLIGHT = { crouch: [0, 0.3], hop: [0.3, 0.9], grab: [0.9, 1.25], away: [1.25, 2.75], end: 2.8 };

export function flightPose(t, perch, scroll, screen) {
    const F = FLIGHT;
    const grabAt = [scroll.x, scroll.y - SCROLL_RADIUS * 0.6];
    const ph = Math.max(0, t - F.crouch[1] + 0.06) * 4.4;    // flap phase, cycles
    let pos, yaw, pitch = 0, bank = 0, size = BIRD_SIZE, crouch = 0, spread = 0, grip = 0;
    let headPitch = 0, headTurn = 0;

    if (t < F.hop[0]) {
        // wind up: crouch, crest up, a chirp
        const u = smooth(seg(t, ...F.crouch));
        pos = perch;
        yaw = lerp(PERCH_YAW, -Math.PI / 2, u);
        crouch = 0.06 * u;
        pitch = -0.22 * u;
        spread = 0.35 * smooth(seg(t, 0.15, 0.3));
        headPitch = 0.08 * u;
    } else if (t < F.grab[0]) {
        // hop across and drop onto the scroll, legs reaching for it
        const u = seg(t, ...F.hop);
        const e = smooth(u);
        pos = [lerp(perch[0], grabAt[0], e), lerp(perch[1], grabAt[1], e) - 64 * arc(u)];
        yaw = -Math.PI / 2 + 0.4 * arc(u) * Math.sign(grabAt[0] - perch[0]);
        pitch = 0.12 * arc(u);
        spread = 1;
        grip = smooth(seg(u, 0.1, 0.6));
        headPitch = -0.12 * smooth(seg(u, 0.5, 1));          // eyes on the scroll
        headTurn = 0.2 * arc(u) * Math.sign(grabAt[0] - perch[0]);
    } else if (t < F.away[0]) {
        // hover, grab it, turn to go
        const u = seg(t, ...F.grab);
        pos = [grabAt[0], grabAt[1] - 5 * Math.sin(TAU * ph)];
        yaw = lerp(-Math.PI / 2, -0.3, smooth(seg(u, 0.35, 1)));
        pitch = 0.1;
        spread = 1;
        grip = 1;
        headPitch = lerp(-0.12, 0.06, smooth(u));
        headTurn = -0.25 * smooth(seg(u, 0.3, 0.8)) * (1 - smooth(seg(u, 0.8, 1)));   // a glance back at you
    } else {
        // carry it off to the top-right
        const u = seg(t, ...F.away);
        const p0 = grabAt;
        const p1 = [grabAt[0] + 50, grabAt[1] + 34];
        const p2 = [screen.width * 0.85, grabAt[1] - 150];
        const p3 = [screen.width + BIRD_SIZE * 1.4, -BIRD_SIZE * 1.6];
        pos = bez(p0, p1, p2, p3, easeIn(u) * 0.4 + smooth(u) * 0.6);
        pos[1] += 6 * Math.sin(TAU * ph) * (1 - u);
        yaw = lerp(-0.3, 0.3, smooth(u));
        pitch = 0.08 + 0.2 * smooth(u);
        bank = -0.28 * arc(u);
        size = BIRD_SIZE * lerp(1, 0.58, smooth(u));
        spread = 1;
        grip = 1;
        headPitch = 0.04;
    }

    const glideW = t > F.away[0] ? 0.3 * bump(t, F.away[0] + 0.55, F.away[0] + 1.05) : 0;
    const wing = mixPose(FOLD, mixPose(flapPose(ph), GLIDE, glideW), spread);

    // the scroll stays where it was rolled until the feet close on it
    const held = smooth(seg(t, F.grab[0] + 0.04, F.grab[0] + 0.2));
    const k = size / BIRD_SIZE;
    const carried = { x: pos[0], y: pos[1] + SCROLL_RADIUS * 0.6 * k };
    const scrollPose = {
        x: lerp(scroll.x, carried.x, held),
        y: lerp(scroll.y, carried.y, held),
        length: scroll.length * k,
        radius: SCROLL_RADIUS * k,
        tilt: -bank * 0.5 * held,
    };

    const chirp = bump(t, 0.08, 0.22) + bump(t, F.grab[0] + 0.15, F.grab[0] + 0.32);
    return {
        pose: {
            x: pos[0], y: pos[1], size, yaw, pitch, bank, crouch, grip, wing,
            headPitch, headTurn,
            crest: Math.max(bump(t, 0, 0.45), bump(t, F.grab[0], F.grab[1] + 0.2)),
            jaw: 0.8 * chirp,
            // blink on take-off, then a pleased half-squint as it flies off
            blink: Math.max(blinkAt(t, F.hop[0] - 0.05, 0.18), 0.4 * smooth(seg(t, F.away[0] + 0.1, F.away[0] + 0.4))),
            tailUp: 0.15,
            scroll: scrollPose,
        },
        done: t >= F.end,
    };
}
