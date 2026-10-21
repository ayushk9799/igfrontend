// Face rig for the rig v2 bird: eyelids that slide down over the painted eyes, and the jaw.
// Shared by the Write Letter bird (birdSprite) and the Letter scene (letterBirdScene).
import * as THREE from 'three';

/**
 * Adds eyelid meshes to a bird built with BIRD_RIG_V2 and returns setFace({ blink, jaw }).
 * blink: 0 open .. 1 closed.  jaw: 0 shut .. 1 open (chirp).
 * With the old rig (no lids / jaw) it returns a no-op so callers don't need to care.
 */
export function attachFaceRig(model, built, rig, track = (x) => x) {
    const bones = {};
    built.bones.forEach((b) => { bones[b.name] = b; });
    // Eyelids: smooth caps fitted to the head over each painted eye.
    // Painted with the feather colour just above the eye; a shader reveals them top-down along
    // the eye's own curve, with a dark lash line on the closing edge.
    const lidUniform = { value: 0 };
    const lidMeshes = [];
    if (rig && rig.lids) {
        const skinned = model.children.find((c) => c.isSkinnedMesh);
        const lidMat = track(new THREE.MeshStandardMaterial({
            map: skinned.material.map, roughness: 0.8, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
        }));
        lidMat.onBeforeCompile = (shader) => {
            shader.uniforms.uBlink = lidUniform;
            shader.vertexShader = shader.vertexShader
                .replace('#include <common>', '#include <common>\nattribute float lidv;\nvarying float vLid;')
                .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLid = lidv;');
            shader.fragmentShader = shader.fragmentShader
                .replace('#include <common>', '#include <common>\nuniform float uBlink;\nvarying float vLid;')
                .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vLid > uBlink) discard;')
                .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.rgb *= mix(1.0, 0.18, smoothstep(uBlink - 0.07, uBlink - 0.01, vLid));');
        };
        rig.lids.forEach((l) => {
            const n = l.position.length / 3;
            const boneIndex = built.bones.findIndex((b) => b.name === l.bone);
            const g = track(new THREE.BufferGeometry());
            g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(l.position), 3));
            g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(l.normal), 3));
            g.setAttribute('lidv', new THREE.BufferAttribute(new Float32Array(l.lidv), 1));
            const uvs = new Float32Array(n * 2); for (let i = 0; i < n; i++) { uvs[i * 2] = l.uv[0]; uvs[i * 2 + 1] = l.uv[1]; }
            g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
            const si2 = new Uint8Array(n * 4), sw2 = new Float32Array(n * 4);
            for (let i = 0; i < n; i++) { si2[i * 4] = boneIndex; sw2[i * 4] = 1; }
            g.setAttribute('skinIndex', new THREE.BufferAttribute(si2, 4));
            g.setAttribute('skinWeight', new THREE.BufferAttribute(sw2, 4));
            g.setIndex(l.index);
            const mesh = new THREE.SkinnedMesh(g, lidMat);
            mesh.frustumCulled = false;
            mesh.bind(skinned.skeleton, skinned.bindMatrix);
            model.add(mesh);
            lidMeshes.push(mesh);
        });
    }


    return function setFace({ blink = 0, jaw = 0 } = {}) {
        const b = Math.min(1, Math.max(0, blink));
        if (bones.jaw) bones.jaw.rotation.set(0.5 * jaw, 0, 0);
        if (bones.eye_L) {
            // the eye narrows a touch as the lid comes down
            const squint = 1 - 0.1 * b;
            bones.eye_L.scale.set(1, squint, 1);
            bones.eye_R.scale.set(1, squint, 1);
        }
        lidUniform.value = b;
        lidMeshes.forEach((m) => { m.visible = b > 0.02; });
    };
}
