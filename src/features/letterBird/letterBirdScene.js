// Letter Bird — native three.js scene (rendered through expo-gl, no WebView).
// A blue bird walks in, notices a letter falling, picks it up, takes off, flies away and comes back.
// Everything here is renderer-agnostic: build the scene once, then call update(t) every frame.
import * as THREE from 'three';
import { BIRD_RIG } from './birdRig';

// ------------------------------------------------------------ math helpers
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, u) => a + (b - a) * u;
const smooth = (u) => u * u * (3 - 2 * u);
const smoother = (u) => u * u * u * (u * (u * 6 - 15) + 10);
const easeOut = (u) => 1 - Math.pow(1 - u, 3);
const easeIn = (u) => u * u * u;
const arc = (u) => Math.sin(Math.PI * clamp(u));
const bump = (t, a, b) => (t >= a && t <= b ? arc(seg(t, a, b)) : 0);
const TAU = Math.PI * 2;
const bez = (p0, p1, p2, p3, u) => {
    const v = 1 - u;
    return p0.map((_, i) => v * v * v * p0[i] + 3 * v * v * u * p1[i] + 3 * v * u * u * p2[i] + u * u * u * p3[i]);
};

// ------------------------------------------------------------ timeline (seconds)
const T = {
    walk1: [0.2, 1.75], fall: [0.6, 1.8], notice: [1.9, 2.22], walk2: [2.6, 3.45],
    lean: [3.5, 3.9], grab: [3.84, 4.05], rise: [4.05, 4.5], happy: [[4.6, 4.88], [4.93, 5.2]],
    crouch: [5.3, 5.6], launch: 5.6, climb: [5.6, 6.4], cruise: [6.4, 8.0], glide: [8.0, 8.7],
    away: [8.7, 10.2], back: [10.45, 12.0], end: 12.6,
};
export const LETTER_BIRD_END = T.end;
export const LETTER_BIRD_STEPS = [
    [0, 'Walks in'], [1.85, 'Notices the letter'], [2.6, 'Walks over'], [3.5, 'Picks it up'],
    [4.05, 'Holds it'], [5.3, 'Takes off'], [6.4, 'Flies'], [8.0, 'Glides'], [8.7, 'Flies away'],
    [10.45, 'Comes back'],
];
export const stepIndexAt = (t) => {
    let idx = 0;
    for (let i = 0; i < LETTER_BIRD_STEPS.length; i++) if (t >= LETTER_BIRD_STEPS[i][0]) idx = i;
    return idx;
};

// ground path: the bird walks along FWD (a three-quarter turn toward the camera)
const YAW = -0.3;
const FWD = [Math.cos(YAW), 0, -Math.sin(YAW)];
const P0 = [-1.45, 0, -0.42];
const WALK1 = 0.75, WALK2 = 0.4;
const along = (d) => [P0[0] + FWD[0] * d, 0, P0[2] + FWD[2] * d];
const P_LAUNCH = along(WALK1 + WALK2);
const LETTER_AT = (() => { const p = along(WALK1 + WALK2 + 0.36); p[1] = 0.008; return p; })();
const P_CLIMB = [P_LAUNCH[0] + 0.55, 0.85, P_LAUNCH[2] + 0.35];
const P_CRUISE = [P_LAUNCH[0] + 1.6, 1.0, P_LAUNCH[2] + 0.95];
const P_GLIDE = [P_LAUNCH[0] + 2.15, 1.1, P_LAUNCH[2] + 1.15];
const AWAY = [P_GLIDE, [P_GLIDE[0] + 0.7, 1.3, 0.6], [3.0, 2.1, -5], [3.3, 2.6, -14]];
const BACK = [[-5.5, 2.4, -3], [-3.2, 1.6, -1.2], [P0[0] - 0.7, 0.6, P0[2]], P0];

const STRIDE = 0.2;
function walkSeg(t, [a, b], dist) {
    const r = 0.18, u = seg(t, a, b);
    const area = 1 - r;
    let s;
    if (u < r) s = 0.5 * u * u / r;
    else if (u < 1 - r) s = 0.5 * r + (u - r);
    else { const v = 1 - u; s = area - 0.5 * v * v / r; }
    const speed = u <= 0 || u >= 1 ? 0 : Math.min(1, u / r, (1 - u) / r);
    return { d: dist * s / area, g: speed };
}
function walking(t) {
    const w1 = walkSeg(t, T.walk1, WALK1), w2 = walkSeg(t, T.walk2, WALK2);
    return { D: w1.d + w2.d, gait: Math.max(w1.g, w2.g) };
}

// wing poses (values for the +x wing; the other mirrors)
const FOLD = { flap: -1.25, sweep: 0.55, twist: 0, tipFlap: -0.25, tipFold: 0.95 };
function flapPose(ph) {
    const a = TAU * ph, s = Math.sin(a), up = Math.max(0, -s);
    return {
        flap: 0.2 + 0.88 * Math.cos(a),
        sweep: 0.06 + 0.22 * up,
        twist: -0.22 * s,
        tipFlap: 0.38 * Math.cos(a - 0.65),
        tipFold: 0.8 * Math.pow(up, 0.8),
    };
}
const GLIDE = { flap: 0.14, sweep: 0.05, twist: -0.06, tipFlap: 0.06, tipFold: 0 };
const FLARE = { flap: 0.85, sweep: -0.18, twist: 0.45, tipFlap: 0.25, tipFold: 0 };
const FLICK = { flap: -0.55, sweep: 0.3, twist: 0, tipFlap: -0.1, tipFold: 0.45 };
const KEYS = ['flap', 'sweep', 'twist', 'tipFlap', 'tipFold'];
const mixPose = (a, b, u) => { const o = {}; KEYS.forEach((k) => { o[k] = lerp(a[k], b[k], u); }); return o; };

function flapPhase(t) {
    const parts = [[T.launch, T.climb[1], 4.4], [T.climb[1], T.away[1], 3.4], [T.back[0], T.end, 3.8]];
    let ph = 0;
    for (const [a, b, f] of parts) { if (t > a) ph += (Math.min(t, b) - a) * f; }
    return ph;
}

// ------------------------------------------------------------ textures built in code (no canvas in RN)
function makeSkyTexture() {
    const h = 256, data = new Uint8Array(4 * h);
    const top = [0xdc, 0xeb, 0xff], bottom = [0xff, 0xf6, 0xea];
    for (let y = 0; y < h; y++) {
        const u = clamp((y / (h - 1)) / 0.78);           // row 0 = top of the screen (flipY off)
        for (let c = 0; c < 3; c++) data[y * 4 + c] = Math.round(lerp(top[c], bottom[c], u));
        data[y * 4 + 3] = 255;
    }
    const tex = new THREE.DataTexture(data, 1, h, THREE.RGBAFormat);
    tex.flipY = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
}
function makeMeadowTexture() {
    const n = 128, data = new Uint8Array(n * n * 4);
    const stops = [[0, [170, 214, 140, 1]], [0.6, [182, 220, 150, 0.96]], [1, [210, 234, 186, 0]]];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const d = Math.hypot(x + 0.5 - n / 2, y + 0.5 - n / 2) / (n / 2);
        const u = clamp((d - 20 / 128) / (1 - 20 / 128));
        const k = u < 0.6 ? 0 : 1, a = stops[k], b = stops[k + 1];
        const w = (u - a[0]) / (b[0] - a[0]);
        const i = (y * n + x) * 4;
        for (let c = 0; c < 3; c++) data[i + c] = Math.round(lerp(a[1][c], b[1][c], w));
        data[i + 3] = Math.round(255 * lerp(a[1][3], b[1][3], w));
    }
    const tex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    return tex;
}
function pixelTexture({ pixels, width, height }, srgb) {
    const tex = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);
    tex.flipY = false;                                    // glTF UV convention
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
}

// ------------------------------------------------------------ the rigged bird from bird.bin
function buildBird(buffer, textures) {
    const L = BIRD_RIG.layout;
    const f32 = (k) => new Float32Array(buffer, L[k][0], L[k][1]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(f32('position'), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(f32('normal'), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(f32('uv'), 2));
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(new Uint8Array(buffer, L.skinIndex[0], L.skinIndex[1]), 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(f32('skinWeight'), 4));
    geo.setIndex(new THREE.BufferAttribute(new Uint16Array(buffer, L.index[0], L.index[1]), 1));
    geo.computeBoundingSphere();

    const mr = pixelTexture(textures.mr, false);
    const material = new THREE.MeshStandardMaterial({
        map: pixelTexture(textures.color, true),
        metalnessMap: mr,
        roughnessMap: mr,
        normalMap: pixelTexture(textures.normal, false),
        normalScale: new THREE.Vector2(1, -1),           // same as GLTFLoader without vertex tangents
        metalness: 1,
        roughness: 1,
        side: THREE.DoubleSide,
    });

    const bones = BIRD_RIG.bones.map((b) => {
        const bone = new THREE.Bone();
        bone.name = b.name;
        bone.position.fromArray(b.t);
        return bone;
    });
    BIRD_RIG.bones.forEach((b, i) => { if (b.parent >= 0) bones[b.parent].add(bones[i]); });
    const inv = f32('inverseBind');
    const inverses = bones.map((_, i) => new THREE.Matrix4().fromArray(inv, i * 16));

    const mesh = new THREE.SkinnedMesh(geo, material);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    const model = new THREE.Group();
    model.add(mesh);
    model.add(bones[0]);
    mesh.bind(new THREE.Skeleton(bones, inverses), new THREE.Matrix4());
    mesh.normalizeSkinWeights();
    return { model, bones, disposables: [geo, material, material.map, mr, material.normalMap] };
}

// ------------------------------------------------------------ scene factory
/**
 * @param {{ birdBuffer: ArrayBuffer, textures: { color, mr, normal } }} assets
 *   textures are { pixels: Uint8Array (RGBA), width, height }
 */
export function createLetterBirdScene(assets) {
    const disposables = [];
    const track = (x) => { disposables.push(x); return x; };

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 16 / 10, 0.1, 100);
    const CAM_POS = new THREE.Vector3(0.45, 1.55, 4.3), CAM_LOOK = new THREE.Vector3(0.45, 0.62, 0);
    camera.position.copy(CAM_POS); camera.lookAt(CAM_LOOK);
    scene.background = track(makeSkyTexture());

    // lights (×π: three r155+ uses physical light units; values match the original r128 look)
    scene.add(new THREE.HemisphereLight(0xe4eeff, 0xf3e2c8, 0.85 * Math.PI));
    const sun = new THREE.DirectionalLight(0xfff1dd, 1.25 * Math.PI);
    sun.position.set(2.5, 6, 4.5); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.01;
    Object.assign(sun.shadow.camera, { left: -4, right: 5, top: 4, bottom: -2, near: 1, far: 20 });
    sun.shadow.camera.updateProjectionMatrix();
    scene.add(sun, sun.target);
    const rim = new THREE.DirectionalLight(0xbfd6ff, 0.45 * Math.PI); rim.position.set(-4, 3, -3); scene.add(rim);

    // ground
    const groundShadow = new THREE.Mesh(track(new THREE.PlaneGeometry(30, 30)), track(new THREE.ShadowMaterial({ opacity: 0.18 })));
    groundShadow.rotation.x = -Math.PI / 2; groundShadow.receiveShadow = true; scene.add(groundShadow);
    scene.fog = new THREE.Fog(0xeef3fb, 9, 24);
    const meadow = new THREE.Mesh(track(new THREE.PlaneGeometry(2, 2)),
        track(new THREE.MeshStandardMaterial({ map: track(makeMeadowTexture()), transparent: true, roughness: 1, depthWrite: false })));
    meadow.rotation.x = -Math.PI / 2; meadow.position.set(0.3, -0.002, -1.2); meadow.scale.set(7, 4.2, 1); scene.add(meadow);
    const hillGeo = track(new THREE.SphereGeometry(1, 40, 20));
    [[-7, -16, 6, 0x9fcf9b], [2, -18, 8, 0x93c69d], [11, -15, 5, 0xa8d4a0]].forEach(([x, z, r, c]) => {
        const h = new THREE.Mesh(hillGeo, track(new THREE.MeshStandardMaterial({ color: c, roughness: 1 })));
        h.position.set(x, -r * 0.16, z); h.scale.set(r * 1.7, r * 0.42, r * 0.8); scene.add(h);
    });

    // materials + primitives
    const C = { paper: 0xf7e8c6, fold: 0xd8bf8e, heart: 0xea4350 };
    const mats = {};
    const mat = (c, rough = 0.55) => mats[c + ':' + rough]
        || (mats[c + ':' + rough] = track(new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0 })));
    const SPHERE = track(new THREE.SphereGeometry(1, 24, 16));
    const group = (parent, pos = [0, 0, 0]) => { const g = new THREE.Group(); g.position.set(...pos); parent.add(g); return g; };

    // the bird
    const MODEL_SCALE = 1.3;
    const BEAK_TIP = new THREE.Vector3(0, -0.03, 0.22);
    const built = buildBird(assets.birdBuffer, assets.textures);
    built.disposables.forEach(track);
    const holder = group(scene);
    const bankG = group(holder);
    const model = built.model;
    model.rotation.y = Math.PI / 2;
    model.scale.setScalar(MODEL_SCALE);
    model.position.x = -0.08 * MODEL_SCALE;
    bankG.add(model);
    const bones = {};
    built.bones.forEach((o) => { bones[o.name] = o; o.rotation.order = 'YZX'; });
    const beakTip = new THREE.Object3D(); beakTip.position.copy(BEAK_TIP); bones.head.add(beakTip);
    const rest = {}; for (const n in bones) rest[n] = bones[n].position.clone();
    const bird = { root: holder, bank: bankG, bones, rest, beakTip };

    // the letter
    const heartShape = () => {
        const s = new THREE.Shape();
        s.moveTo(0, -0.5); s.bezierCurveTo(-0.15, -0.35, -0.6, -0.1, -0.6, 0.2);
        s.bezierCurveTo(-0.6, 0.5, -0.25, 0.6, 0, 0.35); s.bezierCurveTo(0.25, 0.6, 0.6, 0.5, 0.6, 0.2);
        s.bezierCurveTo(0.6, -0.1, 0.15, -0.35, 0, -0.5); return s;
    };
    const HEART_GEO = track(new THREE.ExtrudeGeometry(heartShape(), { depth: 0.25, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 3, curveSegments: 10 }));
    HEART_GEO.center();
    const letter = new THREE.Group();
    {
        const paper = new THREE.Mesh(track(new THREE.BoxGeometry(0.44, 0.29, 0.016)), mat(C.paper, 0.8));
        paper.castShadow = true; letter.add(paper);
        const lineGeo = track(new THREE.BoxGeometry(0.26, 0.008, 0.018));
        [-1, 1].forEach((s) => {
            const line = new THREE.Mesh(lineGeo, mat(C.fold, 0.8));
            line.position.set(0.106 * s, 0.055, 0); line.rotation.z = -0.62 * s; letter.add(line);
        });
        const seal = new THREE.Mesh(HEART_GEO, mat(C.heart, 0.4));
        seal.scale.setScalar(0.085); seal.position.set(0, -0.005, 0.012); letter.add(seal);
        scene.add(letter);
    }
    letter.scale.setScalar(0.82);

    const hearts = [0, 1, 2].map(() => {
        const m = new THREE.Mesh(HEART_GEO, track(new THREE.MeshStandardMaterial({ color: C.heart, roughness: 0.4, transparent: true })));
        m.visible = false; scene.add(m); return m;
    });
    const dust = [0, 1, 2, 3, 4].map(() => {
        const m = new THREE.Mesh(SPHERE, track(new THREE.MeshStandardMaterial({ color: 0xeadcc8, roughness: 1, transparent: true, depthWrite: false })));
        m.visible = false; scene.add(m); return m;
    });
    const cloudMat = track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xd6e4ff, emissiveIntensity: 0.35 }));
    const clouds = [[-2.6, 2.7, -4, 0.9], [2.8, 3.1, -6, 1.3], [4.4, 0.9, -3.5, 1.0], [0.9, 3.6, -9, 1.6]].map(([x, y, z, k]) => {
        const g = group(scene, [x, y, z]);
        [[-0.5, 0, 0, 0.45], [0, 0.18, 0, 0.6], [0.55, 0.02, 0, 0.42], [0.2, -0.1, 0.2, 0.5]].forEach(([a, b, c, r]) => {
            const m = new THREE.Mesh(SPHERE, cloudMat);
            m.position.set(a, b, c); m.scale.set(r, r * 0.8, r * 0.7); g.add(m);
        });
        g.scale.setScalar(k); g.userData.x = x; return g;
    });

    // grass + flowers (instanced, kept off the bird's path)
    {
        let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
        const offPath = (x, z) => {
            const dx = x - P0[0], dz = z - P0[2], al = dx * FWD[0] + dz * FWD[2];
            const side = Math.abs(-dx * FWD[2] + dz * FWD[0]);
            return al < -0.6 || al > WALK1 + WALK2 + 0.9 || side > 0.42;
        };
        const blade = track(new THREE.ConeGeometry(0.01, 0.085, 4)); blade.translate(0, 0.0425, 0);
        const grass = new THREE.InstancedMesh(blade, track(new THREE.MeshStandardMaterial({ roughness: 0.9 })), 900);
        const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
        const v = new THREE.Vector3(), sc = new THREE.Vector3();
        let n = 0;
        for (let i = 0; i < 140 && n < 900; i++) {
            const a = rnd() * TAU, r = Math.sqrt(rnd());
            const x = 0.2 + Math.cos(a) * r * 3.6, z = -0.4 + Math.sin(a) * r * 2.1;
            if (!offPath(x, z)) continue;
            for (let k = 0; k < 5; k++) {
                e.set((rnd() - 0.5) * 0.9, rnd() * TAU, (rnd() - 0.5) * 0.7); q.setFromEuler(e);
                const s = 0.6 + rnd() * 0.8;
                m4.compose(v.set(x + (rnd() - 0.5) * 0.07, 0, z + (rnd() - 0.5) * 0.07), q, sc.set(s, s * (0.8 + rnd() * 0.6), s));
                grass.setMatrixAt(n, m4);
                grass.setColorAt(n, col.setHSL(0.26 + rnd() * 0.05, 0.38, 0.4 + rnd() * 0.12));
                n++;
            }
        }
        grass.count = n; grass.castShadow = true; scene.add(grass);
        const petal = track(new THREE.SphereGeometry(0.018, 8, 6));
        const flowers = new THREE.InstancedMesh(petal, track(new THREE.MeshStandardMaterial({ roughness: 0.6 })), 60);
        const hues = [0xffffff, 0xffe27a, 0xffb3c7, 0xc9b8ff];
        let f = 0;
        for (let i = 0; i < 200 && f < 60; i++) {
            const a = rnd() * TAU, r = Math.sqrt(rnd());
            const x = 0.2 + Math.cos(a) * r * 3.4, z = -0.4 + Math.sin(a) * r * 2.0;
            if (!offPath(x, z)) continue;
            m4.compose(v.set(x, 0.06 + rnd() * 0.04, z), q.identity(), sc.set(1, 0.7, 1));
            flowers.setMatrixAt(f, m4); flowers.setColorAt(f, col.set(hues[f % 4])); f++;
        }
        flowers.count = f; scene.add(flowers);
    }

    // ------------------------------------------------------------ legs: two-bone IK
    const FOOT_LAT = 0.057 * MODEL_SCALE;
    const FOOT_Y = 0.035 * MODEL_SCALE;
    const vT = new THREE.Vector3(), vH = new THREE.Vector3();
    function legIK(B, side, target, toe) {
        const thigh = B['thigh_' + side], shin = B['shin_' + side], foot = B['foot_' + side];
        thigh.parent.worldToLocal(vT.copy(target));
        vH.copy(thigh.position);
        const dy = vT.y - vH.y, dz = vT.z - vH.z;
        const L1 = shin.position.length(), L2 = foot.position.length();
        const rest1 = Math.atan2(shin.position.z, -shin.position.y), rest2 = Math.atan2(foot.position.z, -foot.position.y);
        const dist = clamp(Math.hypot(dy, dz), 1e-4, (L1 + L2) * 0.999);
        const phi = Math.atan2(dz, -dy);
        const a1 = Math.acos(clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1));
        const a2 = Math.acos(clamp((L1 * L1 + L2 * L2 - dist * dist) / (2 * L1 * L2), -1, 1));
        const ang1 = phi - a1;
        const ang2 = ang1 + (Math.PI - a2);
        thigh.rotation.set(-(ang1 - rest1), 0, 0);
        shin.rotation.set(-(ang2 - rest2 - (ang1 - rest1)), 0, 0);
        foot.rotation.set(-(thigh.rotation.x + shin.rotation.x + thigh.parent.rotation.x) + toe, 0, 0);
    }

    // ------------------------------------------------------------ framing for any screen shape
    // The visible "stage" is the screen minus the header and the controls / tab bar. The camera keeps
    // the original 16:10 composition on wide screens; on tall phones it keeps a sensible horizontal
    // field of view (dollying back a little if needed) and centres the action inside the stage.
    const view = { dolly: 1, portrait: 0 };
    function setViewport(width, height, top = 0, bottom = 0) {
        const W = Math.max(1, width), H = Math.max(1, height);
        const regionH = Math.max(1, H - top - bottom);
        const aspect = W / regionH;
        const deg = Math.PI / 180;
        let vfov;
        if (aspect >= 1.2) vfov = 32 * deg;
        else vfov = Math.min(58 * deg, 2 * Math.atan(Math.tan(20 * deg) / aspect));
        const hHalf = Math.atan(Math.tan(vfov / 2) * aspect);
        view.dolly = aspect >= 1.2 ? 1 : Math.max(1, Math.tan(20 * deg) / Math.tan(hHalf));
        view.portrait = clamp((1.2 - aspect) / 0.55);
        // virtual frame whose optical centre sits in the middle of the stage
        const yc = top + regionH / 2;
        const H2 = H + 2 * Math.abs(H / 2 - yc);
        const offY = H2 / 2 - yc;
        camera.fov = (2 * Math.atan(Math.tan(vfov / 2) * H2 / regionH)) / deg;
        camera.aspect = W / H2;
        camera.setViewOffset(W, H2, 0, offY, W, H);
        camera.updateProjectionMatrix();
    }

    // ------------------------------------------------------------ pose everything for time t
    const tmpM = new THREE.Matrix4(), qA = new THREE.Quaternion(), qB = new THREE.Quaternion(),
        pA = new THREE.Vector3(), pB = new THREE.Vector3(), sV = new THREE.Vector3(), wv = new THREE.Vector3(),
        eul = new THREE.Euler(), camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
    const LETTER_HELD = new THREE.Matrix4().compose(new THREE.Vector3(-0.01, -0.06, 0.06),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12, -Math.PI / 2 + 0.25, 0.05)), new THREE.Vector3(1, 1, 1));
    const LETTER_GROUND_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2 + 0.12, 0, 0.35));
    const SIDES = [['L', 0, -1, 1], ['R', 0.5, 1, -1]];

    function update(t) {
        const b = bird;
        const { D, gait } = walking(t);
        let pos = along(D), yaw = YAW, pitch = 0, lift = 0, crouch = 0;
        let neckPitch = 0, headPitch = 0, headTurn = 0, crestPerk = 0, headFwd = 0;
        let spread = 0, wing = FOLD, tuck = 0, tailUp = 0, tailSway = 0, flying = false, flick = 0, bankRoll = 0, hipsYaw = 0;
        let feetPinned = true, feetLift = 0;

        // ---------- on the ground
        const breathe = Math.sin(t * TAU * 0.8);
        const cyc = D / STRIDE;
        bankRoll += 0.075 * gait * Math.sin(TAU * cyc);
        hipsYaw = 0.07 * gait * Math.sin(TAU * cyc);
        crouch += 0.012 * gait * (0.5 + 0.5 * Math.cos(2 * TAU * cyc));
        pitch -= 0.08 * gait;
        {
            const s = (2 * cyc) % 1;
            headFwd = gait * (s < 0.65 ? -0.03 * (s / 0.65) : lerp(-0.03, 0, smooth((s - 0.65) / 0.35)));
        }
        tailUp += 0.08 * gait * Math.sin(2 * TAU * cyc + 1);
        tailSway = -0.12 * gait * Math.sin(TAU * cyc);
        headPitch += 0.35 * bump(t, T.fall[0] - 0.1, T.fall[1] + 0.2) - 0.12 * gait;
        headTurn = 0.15 * bump(t, T.fall[0], T.fall[1]);
        {
            const [a, c] = T.notice, u = seg(t, a, c);
            if (t >= a && t <= c) { lift = 0.1 * arc(u); feetPinned = false; feetLift = 0.025 * arc(u); }
            crestPerk += bump(t, a, c + 0.15); flick = Math.max(flick, bump(t, a, c));
            headPitch += 0.15 * bump(t, a, c) - 0.3 * bump(t, c, T.walk2[0] + 0.1);
            headTurn += 0.25 * bump(t, c, T.walk2[0] + 0.1);
        }
        headPitch -= 0.25 * bump(t, T.walk2[0], T.walk2[1] + 0.1);
        const lean = smoother(seg(t, ...T.lean)) * (1 - smoother(seg(t, ...T.rise)));
        pitch -= 0.62 * lean; neckPitch -= 0.5 * lean; headPitch -= 0.3 * lean; tailUp += 0.5 * lean;
        crouch += 0.03 * lean;
        const proud = smoother(seg(t, ...T.rise)) * (1 - smoother(seg(t, T.crouch[0], T.launch)));
        headPitch += 0.18 * proud;
        T.happy.forEach(([a, c]) => {
            const u = seg(t, a, c);
            if (t >= a && t <= c) { lift += 0.08 * arc(u); feetPinned = false; feetLift = 0.02 * arc(u); }
            crouch += 0.03 * bump(t, c, c + 0.12);
            flick = Math.max(flick, 0.7 * bump(t, a, c)); crestPerk += bump(t, a, c);
        });
        const cr = smooth(seg(t, ...T.crouch));
        if (t < T.launch) { crouch += 0.075 * cr; pitch -= 0.22 * cr; flick = Math.max(flick, cr); tailUp += 0.3 * cr; }

        // ---------- airborne
        const ph = flapPhase(t);
        if (t >= T.launch && t < T.away[1] + 0.2) {
            flying = true;
            const cu = seg(t, ...T.climb);
            if (t < T.climb[1]) {
                const e = easeOut(cu);
                pos = [lerp(P_LAUNCH[0], P_CLIMB[0], e), lerp(0, P_CLIMB[1], e), lerp(P_LAUNCH[2], P_CLIMB[2], e)];
                pitch = lerp(-0.22, 0.28, smooth(seg(t, T.launch, T.launch + 0.25))) * (1 - 0.6 * smooth(cu));
                spread = lerp(0.55, 1, smooth(seg(t, T.launch, T.launch + 0.12)));
                crouch = 0.075 * (1 - smooth(seg(t, T.launch, T.launch + 0.1)));
            } else if (t < T.glide[0]) {
                const u = smooth(seg(t, ...T.cruise));
                pos = [lerp(P_CLIMB[0], P_CRUISE[0], u), lerp(P_CLIMB[1], P_CRUISE[1], u), lerp(P_CLIMB[2], P_CRUISE[2], u)];
                pitch = 0.1; spread = 1;
                yaw = lerp(YAW, -0.75, smooth(seg(t, T.climb[1] - 0.4, T.climb[1] + 0.4)));
            } else if (t < T.away[0]) {
                const u = seg(t, ...T.glide);
                pos = [lerp(P_CRUISE[0], P_GLIDE[0], u), lerp(P_CRUISE[1], P_GLIDE[1], smooth(u)) + 0.05 * arc(u), lerp(P_CRUISE[2], P_GLIDE[2], u)];
                pitch = 0.06 + 0.06 * arc(u); spread = 1; yaw = -0.75;
            } else {
                const u = seg(t, ...T.away);
                pos = bez(...AWAY, easeIn(u) * 0.35 + smooth(u) * 0.65);
                pitch = 0.12 + 0.15 * smooth(u); spread = 1;
                yaw = lerp(-0.75, 0.75, smooth(u));
            }
            if (t < T.climb[0] + 0.03) yaw = YAW;
            const stroke = Math.sin(TAU * ph);
            const glideW = smooth(seg(t, T.glide[0] - 0.15, T.glide[0] + 0.2)) * (1 - smooth(seg(t, T.away[0] - 0.15, T.away[0] + 0.25)));
            pos[1] += 0.05 * stroke * (1 - glideW) * smooth(seg(t, T.launch, T.launch + 0.3));
            pitch += 0.06 * stroke * (1 - glideW);
            bankRoll = 0.18 * Math.sin(TAU * seg(t, T.climb[1], T.glide[1])) - 0.4 * bump(t, T.away[0], T.away[1]);
            wing = mixPose(FOLD, mixPose(flapPose(ph), GLIDE, glideW), spread);
            tuck = smooth(seg(t, T.launch + 0.1, T.launch + 0.35));
            feetPinned = t < T.launch + 0.12;
            headPitch = -0.05; neckPitch = 0.05; headTurn = 0; headFwd = 0;
            tailUp = 0.1 + 0.15 * glideW; tailSway = 0; hipsYaw = 0;
        }
        // ---------- coming back in to land
        if (t >= T.back[0]) {
            flying = t < T.back[1];
            const u = seg(t, ...T.back);
            pos = bez(...BACK, smooth(u));
            const flare = smooth(seg(t, T.back[1] - 0.45, T.back[1] - 0.05));
            const fold = smooth(seg(t, T.back[1] - 0.05, T.end - 0.1));
            spread = 1 - fold;
            wing = mixPose(FOLD, mixPose(flapPose(ph), FLARE, flare), spread);
            pitch = lerp(0.08, 0.45, flare) * (1 - fold);
            tuck = 1 - smooth(seg(t, T.back[1] - 0.6, T.back[1] - 0.25));
            feetPinned = t >= T.back[1];
            feetLift = -0.02 * (1 - feetPinned);
            headPitch = lerp(0.1, -0.05, fold); tailUp = 0.3 * flare; headTurn = 0; headFwd = 0;
            pos[1] += 0.045 * Math.sin(TAU * ph) * (1 - flare);
            bankRoll = 0.25 * bump(t, T.back[0], T.back[1] - 0.4);
            yaw = YAW; tailSway = 0; hipsYaw = 0;
            crouch = 0.04 * bump(t, T.back[1] - 0.02, T.back[1] + 0.3);
        }

        // ---------- apply to the rig
        if (!flying && t < T.back[0]) wing = mixPose(FOLD, FLICK, flick);
        const B = b.bones, R = b.rest;
        b.root.visible = !(t > T.away[1] && t < T.back[0]);
        b.root.position.set(pos[0], pos[1] + lift, pos[2]);
        b.root.rotation.y = yaw;
        b.bank.rotation.x = bankRoll;
        B.hips.position.y = R.hips.y - crouch / MODEL_SCALE;
        B.hips.rotation.set(-pitch, hipsYaw, 0);
        B.chest.scale.set(1, 1 + 0.01 * breathe * (flying ? 0 : 1), 1);
        B.neck.rotation.x = -neckPitch;
        B.neck.position.z = R.neck.z + headFwd;
        B.head.rotation.set(-headPitch, headTurn, 0);
        B.crest.rotation.x = -0.35 * crestPerk;
        B.tail.rotation.set(tailUp, tailSway, 0);
        B.wing_L.rotation.set(wing.twist, wing.sweep, wing.flap);
        B.wingtip_L.rotation.set(0, wing.tipFold, wing.tipFlap);
        B.wing_R.rotation.set(wing.twist, -wing.sweep, -wing.flap);
        B.wingtip_R.rotation.set(0, -wing.tipFold, -wing.tipFlap);
        b.root.updateMatrixWorld(true);

        // feet: walking gait or planted, solved with IK, blended into the flight tuck
        const stance = 0.6;
        for (let si = 0; si < 2; si++) {
            const [side, off, lat] = SIDES[si];
            let fwd = 0, up = 0, toe = 0;
            if (gait > 0) {
                const uu = cyc + off, k = Math.floor(uu), p = uu - k;
                const Fk = (k - off + stance / 2) * STRIDE;
                let F = Fk;
                if (p >= stance) {
                    const w = smooth((p - stance) / (1 - stance));
                    F = lerp(Fk, Fk + STRIDE, w); up = 0.045 * Math.sin(Math.PI * w); toe = -0.5 * Math.sin(Math.PI * w);
                }
                fwd = (F - D) * gait; up *= gait; toe *= gait;
            }
            wv.set(fwd, FOOT_Y + up + feetLift, lat * FOOT_LAT);
            b.root.localToWorld(wv);
            if (feetPinned && wv.y > FOOT_Y + up) wv.y = FOOT_Y + up;
            legIK(B, side, wv, toe);
            if (tuck > 0) {
                const th = B['thigh_' + side], sh = B['shin_' + side], ft = B['foot_' + side];
                th.rotation.x = lerp(th.rotation.x, 0.75, tuck);
                sh.rotation.x = lerp(sh.rotation.x, 1.1, tuck);
                ft.rotation.x = lerp(ft.rotation.x, 0.9, tuck);
            }
        }
        b.root.updateMatrixWorld(true);

        // ---------- the letter
        const holding = t >= T.grab[0] && t < T.back[0];
        const onGround = t < T.grab[1];
        letter.visible = t >= T.fall[0] && t < T.back[0] && !(t > T.away[1] + 0.2);
        if (onGround) {
            const u = seg(t, ...T.fall);
            const e = easeIn(u) * 0.5 + u * 0.5;
            pA.set(LETTER_AT[0] + 0.3 * Math.sin(u * 7) * (1 - u), lerp(2.6, LETTER_AT[1], e), LETTER_AT[2]);
            if (u < 1) {
                eul.set(-Math.PI / 2 + (1 - u) * 0.9 * Math.sin(u * 9), (1 - u) * 0.6 * Math.cos(u * 6), 0.35 + (1 - u) * 1.2 * Math.sin(u * 5));
                qA.setFromEuler(eul);
            } else {
                qA.copy(LETTER_GROUND_Q);
                const k = Math.exp(-9 * (t - T.fall[1])) * Math.sin((t - T.fall[1]) * 30);
                pA.y += 0.012 * Math.abs(k);
            }
        }
        if (holding) {
            tmpM.multiplyMatrices(b.beakTip.matrixWorld, LETTER_HELD);
            tmpM.decompose(pB, qB, sV);
        }
        if (onGround && holding) {
            const u = smoother(seg(t, ...T.grab));
            letter.position.lerpVectors(pA, pB, u); letter.quaternion.copy(qA).slerp(qB, u);
        } else if (holding) { letter.position.copy(pB); letter.quaternion.copy(qB); }
        else { letter.position.copy(pA); letter.quaternion.copy(qA); }

        // ---------- hearts
        for (let i = 0; i < hearts.length; i++) {
            const h = hearts[i];
            const a = T.happy[0][0] - 0.15 + i * 0.22, u = seg(t, a, a + 1.0);
            h.visible = t >= a && t <= a + 1.0;
            if (!h.visible) continue;
            h.position.set(letter.position.x + 0.06 * (i - 1) + 0.05 * Math.sin(u * 7 + i), letter.position.y + 0.18 + 0.75 * easeOut(u), letter.position.z + 0.1);
            h.scale.setScalar(0.1 * (i === 1 ? 0.8 : 1) * easeOut(seg(u, 0, 0.25)));
            h.rotation.set(0, 0.6 * Math.sin(u * 5 + i), Math.PI);
            h.material.opacity = 1 - easeIn(seg(u, 0.5, 1));
        }
        // ---------- dust at take-off and touchdown
        for (let i = 0; i < dust.length; i++) {
            const d = dust[i];
            d.visible = false;
            for (const [a0, at] of [[T.launch - 0.03, P_LAUNCH], [T.back[1] - 0.03, P0]]) {
                const a = a0 + i * 0.025, u = seg(t, a, a + 0.65);
                if (t < a || t > a + 0.65) continue;
                d.visible = true;
                const ang = (i / dust.length) * Math.PI + 0.2;
                d.position.set(at[0] + Math.cos(ang) * (0.12 + 0.45 * easeOut(u)), 0.05 + 0.12 * easeOut(u), at[2] + Math.sin(ang) * 0.25 * easeOut(u) + 0.1);
                d.scale.set(0.03 + 0.07 * easeOut(u), 0.02 + 0.04 * easeOut(u), 0.03 + 0.07 * easeOut(u));
                d.material.opacity = 0.3 * (1 - easeIn(u));
            }
        }
        // ---------- clouds drift
        for (let i = 0; i < clouds.length; i++) clouds[i].position.x = clouds[i].userData.x + 0.25 * Math.sin(t / T.end * TAU + i);

        // ---------- camera
        // focusX moves continuously (walk -> launch spot -> home) so the ground camera never jumps,
        // including across the loop point.
        const focusX = t < T.launch ? pos[0]
            : t < T.back[0] ? P_LAUNCH[0]
                : lerp(P_LAUNCH[0], P0[0], smooth(seg(t, T.back[0], T.back[1])));
        const panWide = 0.35 * (focusX - P_LAUNCH[0]);
        const panTall = 0.5 * (focusX + LETTER_AT[0]) + 0.1 - CAM_LOOK.x;   // keep bird + letter in a narrow frame
        const groundPan = lerp(panWide, panTall, view.portrait);
        const clampP = (p) => [clamp(p[0], -1, 2.4), clamp(p[1], 0, 1.4), clamp(p[2], -0.5, 1.3)];
        let cx, cy, cz, lx, ly, lz, w;
        if (t < T.away[0]) {
            w = smooth(seg(t, T.launch, T.launch + 0.9));
            const cur = clampP(pos);
            cx = cur[0] + 0.35; cy = cur[1] + 1.35; cz = cur[2] + 3.4;
            lx = cur[0] + 0.15; ly = cur[1] + 0.18; lz = cur[2];
        } else {
            const at = clampP(AWAY[0]);
            w = 1 - smoother(seg(t, T.away[1] - 0.25, T.back[0] + 0.55));   // slow, gentle return to the ground view
            cx = at[0] + 0.35; cy = at[1] + 1.35; cz = at[2] + 3.4;
            const u = smooth(seg(t, T.away[0], T.away[0] + 0.8));
            lx = lerp(at[0] + 0.15, pos[0], 0.55 * u);
            ly = lerp(at[1] + 0.18, pos[1] * 0.6, 0.55 * u);
            lz = lerp(at[2], pos[2] * 0.4, 0.55 * u);
        }
        camPos.set(lerp(CAM_POS.x + groundPan, cx, w), lerp(CAM_POS.y, cy, w), lerp(CAM_POS.z, cz, w));
        camLook.set(lerp(CAM_LOOK.x + groundPan, lx, w), lerp(CAM_LOOK.y, ly, w), lerp(0, lz, w));
        if (view.dolly !== 1) camPos.sub(camLook).multiplyScalar(view.dolly).add(camLook);
        camera.position.copy(camPos);
        camera.lookAt(camLook);
    }

    function dispose() {
        disposables.forEach((d) => d && d.dispose && d.dispose());
        disposables.length = 0;
    }

    return { scene, camera, update, setViewport, dispose };
}
