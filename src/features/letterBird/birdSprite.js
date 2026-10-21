// The Letter Bird on its own, for drawing over regular UI (transparent background).
// Units are screen points: x to the right, y down, so a position measured with
// measureInWindow / onLayout can be handed straight in.
import * as THREE from 'three';
import { buildBird } from './letterBirdScene';
import { BIRD_RIG_V2 } from './birdRigV2';
import { BIRD_RIG_V3 } from './birdRigV3';
import { attachFaceRig } from './birdFace';

const MODEL_SCALE = 1.3;   // same proportions as the Letter scene

export function createBirdSprite(assets) {
    const disposables = [];
    const track = (x) => { disposables.push(x); return x; };

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(0, 1, 0, -1, 1, 4000);
    camera.position.set(0, 0, 2000);

    scene.add(new THREE.HemisphereLight(0xe4eeff, 0xf3e2c8, 0.95 * Math.PI));
    const sun = new THREE.DirectionalLight(0xfff1dd, 1.25 * Math.PI);
    sun.position.set(2.5, 6, 4.5);
    scene.add(sun, sun.target);
    const rim = new THREE.DirectionalLight(0xbfd6ff, 0.45 * Math.PI);
    rim.position.set(-4, 3, -3);
    scene.add(rim);

    // ---------- bird (same rig set-up as the Letter scene)
    // Rig v2: rigid face, proper neck, plus jaw and eyelid bones.
    // Best bird available: v3 (new model), v2 (old model, fixed face), or the original.
    const rig = assets.v3 ? BIRD_RIG_V3 : assets.birdBufferV2 ? BIRD_RIG_V2 : null;
    const built = assets.v3
        ? buildBird(assets.v3.birdBuffer, assets.v3.textures, BIRD_RIG_V3)
        : buildBird(rig ? assets.birdBufferV2 : assets.birdBuffer, assets.textures, rig || undefined);
    built.disposables.forEach(track);
    const holder = new THREE.Group();
    const bank = new THREE.Group();
    holder.add(bank);
    const model = built.model;
    model.rotation.y = Math.PI / 2;
    model.scale.setScalar(MODEL_SCALE);
    model.position.x = -0.08 * MODEL_SCALE;
    bank.add(model);
    scene.add(holder);
    const bones = {};
    built.bones.forEach((o) => { bones[o.name] = o; o.rotation.order = 'YZX'; });
    const rest = {};
    Object.keys(bones).forEach((n) => { rest[n] = bones[n].position.clone(); });

    const setFace = attachFaceRig(model, built, rig, track);

    // Height of the bird in model units, feet to crest, from the bind pose.
    const geo = model.children.find((c) => c.isSkinnedMesh).geometry;
    geo.computeBoundingBox();
    const box = geo.boundingBox;
    const feetY = box.min.y * MODEL_SCALE;
    const birdHeight = (box.max.y - box.min.y) * MODEL_SCALE;

    // ---------- rolled letter the bird carries
    const scroll = new THREE.Group();
    const scrollBody = new THREE.Mesh(
        track(new THREE.CylinderGeometry(1, 1, 1, 32)),
        track(new THREE.MeshStandardMaterial({ color: 0xf7ebd2, roughness: 0.85, metalness: 0 })),
    );
    scrollBody.rotation.z = Math.PI / 2;
    const ribbon = new THREE.Mesh(
        track(new THREE.CylinderGeometry(1.07, 1.07, 0.16, 32)),
        track(new THREE.MeshStandardMaterial({ color: 0xd23f66, roughness: 0.5, metalness: 0 })),
    );
    ribbon.rotation.z = Math.PI / 2;
    scroll.add(scrollBody, ribbon);
    scroll.visible = false;
    scene.add(scroll);

    function setViewport(widthPt, heightPt) {
        camera.left = 0;
        camera.right = Math.max(1, widthPt);
        camera.top = 0;
        camera.bottom = -Math.max(1, heightPt);
        camera.updateProjectionMatrix();
    }

    function setPaperColor(hex) {
        scrollBody.material.color.set(hex);
    }

    /**
     * Pose the bird for one frame. All positions in points.
     * x, y: where the feet are.  size: bird height (feet to crest).
     * yaw: 0 faces right, -PI/2 faces the viewer.  wing: a pose from letterBirdScene.
     * scroll: null, or { x, y, length, radius } for the rolled letter.
     */
    function pose(p) {
        const k = (p.size || 80) / birdHeight;
        holder.position.set(p.x, -p.y - feetY * k, 0);
        holder.scale.setScalar(k);
        holder.rotation.y = p.yaw ?? -Math.PI / 2;
        bank.rotation.x = p.bank || 0;

        const B = bones, R = rest, w = p.wing;
        B.hips.position.y = R.hips.y - (p.crouch || 0) / MODEL_SCALE;
        B.hips.rotation.set(-(p.pitch || 0), 0, 0);
        B.chest.scale.set(1, 1 + 0.012 * (p.breathe || 0), 1);
        B.neck.rotation.x = -(p.neckPitch || 0);
        B.head.rotation.set(-(p.headPitch || 0), p.headTurn || 0, p.headTilt || 0);
        B.crest.rotation.x = -0.35 * (p.crest || 0);
        B.tail.rotation.set(p.tailUp || 0, p.tailSway || 0, 0);
        B.wing_L.rotation.set(w.twist, w.sweep, w.flap);
        B.wingtip_L.rotation.set(0, w.tipFold, w.tipFlap);
        B.wing_R.rotation.set(w.twist, -w.sweep, -w.flap);
        B.wingtip_R.rotation.set(0, -w.tipFold, -w.tipFlap);
        // legs: `tuck` folds them up under the body, `grip` hangs them down with the toes curled
        // round something (the scroll).
        const tuck = p.tuck || 0, grip = p.grip || 0;
        const legs = [0.75 * tuck - 0.55 * grip, 1.1 * tuck + 0.5 * grip, 0.9 * tuck + 0.85 * grip];
        ['L', 'R'].forEach((side, i) => {
            const splay = (i ? -1 : 1) * 0.08 * grip;
            B['thigh_' + side].rotation.set(legs[0], 0, splay);
            B['shin_' + side].rotation.set(legs[1], 0, 0);
            B['foot_' + side].rotation.set(legs[2], 0, 0);
        });
        setFace({ blink: p.blink, jaw: p.jaw });

        if (p.scroll) {
            scroll.visible = true;
            scroll.position.set(p.scroll.x, -p.scroll.y, 0.06 * k);   // just in front of the feet
            scroll.scale.set(p.scroll.length, p.scroll.radius, p.scroll.radius);
            // angled a little so the rolled ends show
            scroll.rotation.set(0.25, 0.5, p.scroll.tilt || 0);
        } else {
            scroll.visible = false;
        }
    }

    function dispose() {
        disposables.forEach((d) => d && d.dispose && d.dispose());
        disposables.length = 0;
    }

    return { scene, camera, setViewport, setPaperColor, pose, dispose };
}
