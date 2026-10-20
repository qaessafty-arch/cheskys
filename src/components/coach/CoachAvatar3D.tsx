/**
 * Real-time 3D coach character built from simple shapes with cel shading, so it
 * needs no model files. It breathes, blinks, follows the pointer with its head,
 * moves its mouth while the coach is talking, and plays a gesture for each mood.
 */
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CoachCharacter, CoachLook } from '../../coach/characters';

export type AvatarMood = 'idle' | 'explaining' | 'happy' | 'concerned' | 'thinking' | 'pointing' | 'celebrate';

export interface CoachAvatar3DProps {
  coach: CoachCharacter;
  mood: AvatarMood;
  speaking: boolean;
  /** Changes whenever a new gesture should start, even for the same mood. */
  gestureKey: number;
  width: number;
  height: number;
  onPoke?: () => void;
  onUnsupported?: () => void;
}

interface Rig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  mouth: THREE.Mesh;
  smile: THREE.Mesh;
  lids: THREE.Mesh[];
  brows: THREE.Mesh[];
  pupils: THREE.Mesh[];
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftElbow: THREE.Group;
  rightElbow: THREE.Group;
}

let toonGradient: THREE.DataTexture | null = null;
function gradientMap() {
  if (!toonGradient) {
    const tones = new Uint8Array([90, 160, 225, 255]);
    toonGradient = new THREE.DataTexture(tones, tones.length, 1, THREE.RedFormat);
    toonGradient.minFilter = THREE.NearestFilter;
    toonGradient.magFilter = THREE.NearestFilter;
    toonGradient.needsUpdate = true;
  }
  return toonGradient;
}

const toon = (color: string, extra: Partial<THREE.MeshToonMaterialParameters> = {}) =>
  new THREE.MeshToonMaterial({ color, gradientMap: gradientMap(), ...extra });

/** Black-and-white checked cloth, like a Kurdish jamana headscarf. */
function checkedCloth(base: string, pattern: string) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = pattern;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if ((x + y) % 2 === 0) ctx.fillRect(x * 8 + 2, y * 8 + 2, 4, 4);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, position: [number, number, number], scale?: [number, number, number]) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(...position);
  if (scale) m.scale.set(...scale);
  return m;
}

function buildArm(look: CoachLook, side: 1 | -1): { shoulder: THREE.Group; elbow: THREE.Group } {
  const coat = toon(look.coat);
  const skin = toon(look.skin);
  const shoulder = new THREE.Group();
  shoulder.position.set(side * 0.66, 1.08, 0);
  const upper = mesh(new THREE.CapsuleGeometry(0.14, 0.42, 6, 12), coat, [0, -0.3, 0]);
  shoulder.add(upper);
  const elbow = new THREE.Group();
  elbow.position.set(0, -0.6, 0);
  shoulder.add(elbow);
  elbow.add(mesh(new THREE.CapsuleGeometry(0.12, 0.36, 6, 12), coat, [0, -0.24, 0]));
  elbow.add(mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.05, 16), toon(look.shirt), [0, -0.48, 0]));
  elbow.add(mesh(new THREE.SphereGeometry(0.12, 16, 12), skin, [0, -0.58, 0], [1, 1.1, 0.85]));
  return { shoulder, elbow };
}

function buildCharacter(coach: CoachCharacter): Rig {
  const look = coach.look;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const coat = toon(look.coat);
  const trim = toon(look.coatTrim);
  const skin = toon(look.skin);
  const shirt = toon(look.shirt);

  // Torso, shoulders, shirt front and lapels.
  body.add(mesh(new THREE.CylinderGeometry(0.56, 0.72, 1.25, 32), coat, [0, 0.55, 0]));
  body.add(mesh(new THREE.SphereGeometry(0.27, 20, 14), coat, [-0.56, 1.06, 0], [1.05, 0.75, 0.9]));
  body.add(mesh(new THREE.SphereGeometry(0.27, 20, 14), coat, [0.56, 1.06, 0], [1.05, 0.75, 0.9]));
  body.add(mesh(new THREE.SphereGeometry(0.58, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), coat, [0, 1.15, 0], [1, 0.35, 0.95]));
  if (coach.id === 'mamosta') {
    // Collarless Kurdish jacket: closed front with a placket, shirt showing at the neck.
    const placket = mesh(new THREE.BoxGeometry(0.07, 0.95, 0.04), trim, [0, 0.62, 0.66]);
    placket.rotation.x = -0.12;
    body.add(placket);
    body.add(mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.1, 20), shirt, [0, 1.2, 0.02]));
  } else {
    const front = mesh(new THREE.BoxGeometry(0.34, 0.62, 0.04), shirt, [0, 0.92, 0.565]);
    front.rotation.x = -0.12;
    body.add(front);
    for (const side of [-1, 1]) {
      const lapel = mesh(new THREE.BoxGeometry(0.12, 0.62, 0.05), trim, [side * 0.17, 0.9, 0.585]);
      lapel.rotation.set(-0.12, 0, side * -0.32);
      body.add(lapel);
    }
  }
  for (let i = 0; i < 3; i++) {
    body.add(mesh(new THREE.SphereGeometry(0.03, 10, 8), toon(look.coatTrim), [0, 0.5 - i * 0.16, 0.7 - i * 0.012]));
  }

  // Neckwear: cravat for Morphy, tie for Capablanca, a collarless shirt and sash for the Mamosta.
  if (coach.id === 'morphy') {
    const cravat = toon(look.neckwear);
    body.add(mesh(new THREE.SphereGeometry(0.09, 14, 10), cravat, [-0.09, 1.16, 0.5], [1.3, 0.7, 0.6]));
    body.add(mesh(new THREE.SphereGeometry(0.09, 14, 10), cravat, [0.09, 1.16, 0.5], [1.3, 0.7, 0.6]));
    body.add(mesh(new THREE.SphereGeometry(0.05, 12, 8), cravat, [0, 1.16, 0.53]));
  } else if (coach.id === 'capablanca') {
    const tie = toon(look.neckwear);
    const knot = mesh(new THREE.BoxGeometry(0.09, 0.08, 0.05), tie, [0, 1.15, 0.52]);
    body.add(knot);
    const blade = mesh(new THREE.BoxGeometry(0.1, 0.5, 0.03), tie, [0, 0.86, 0.6]);
    blade.rotation.x = -0.12;
    body.add(blade);
    body.add(mesh(new THREE.BoxGeometry(0.12, 0.05, 0.02), toon('#FFFFFF'), [-0.36, 0.95, 0.54]));
  }
  if (look.sash) {
    body.add(mesh(new THREE.CylinderGeometry(0.69, 0.71, 0.22, 32, 1, true), toon(look.sash, { side: THREE.DoubleSide }), [0, 0.18, 0]));
  }

  body.add(mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.3, 16), skin, [0, 1.3, 0]));

  // Head.
  const head = new THREE.Group();
  head.position.set(0, 1.78, 0);
  body.add(head);
  head.add(mesh(new THREE.SphereGeometry(0.42, 32, 24), skin, [0, 0, 0], [1, 1.12, 1]));
  head.add(mesh(new THREE.SphereGeometry(0.09, 12, 10), skin, [-0.42, 0.0, 0], [0.6, 1, 1]));
  head.add(mesh(new THREE.SphereGeometry(0.09, 12, 10), skin, [0.42, 0.0, 0], [0.6, 1, 1]));
  head.add(mesh(new THREE.SphereGeometry(0.07, 14, 10), skin, [0, -0.04, 0.42], [0.85, 1.1, 1]));

  const white = toon('#FFFFFF');
  const iris = new THREE.MeshBasicMaterial({ color: look.eyes });
  const lids: THREE.Mesh[] = [];
  const pupils: THREE.Mesh[] = [];
  const brows: THREE.Mesh[] = [];
  const browMat = toon(look.beard ?? look.hair);
  for (const side of [-1, 1]) {
    head.add(mesh(new THREE.SphereGeometry(0.064, 16, 12), white, [side * 0.15, 0.07, 0.355], [1, 0.9, 0.8]));
    const pupil = mesh(new THREE.SphereGeometry(0.036, 12, 10), iris, [side * 0.15, 0.07, 0.395]);
    head.add(pupil);
    pupils.push(pupil);
    // Upper eyelid: a skin-coloured cap over the top of the eye that rotates down to blink.
    const lid = mesh(new THREE.SphereGeometry(0.07, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), skin, [side * 0.15, 0.07, 0.355], [1, 0.9, 0.85]);
    head.add(lid);
    lids.push(lid);
    const brow = mesh(new THREE.BoxGeometry(0.14, 0.028, 0.03), browMat, [side * 0.15, 0.19, 0.38]);
    head.add(brow);
    brows.push(brow);
  }

  const mouthMat = new THREE.MeshBasicMaterial({ color: '#3A1A16' });
  const mouth = mesh(new THREE.SphereGeometry(0.1, 16, 10), mouthMat, [0, -0.22, 0.375], [1, 0.12, 0.4]);
  head.add(mouth);
  const smile = mesh(new THREE.TorusGeometry(0.1, 0.018, 8, 20, Math.PI), mouthMat, [0, -0.19, 0.385]);
  smile.rotation.z = Math.PI;
  smile.visible = false;
  head.add(smile);

  // Hair, beard and headwear.
  const hair = toon(look.hair);
  if (coach.id === 'morphy') {
    // Full dark hair, parted, covering the ears' tops as in his portraits.
    const cap = mesh(new THREE.SphereGeometry(0.455, 32, 16, 0, Math.PI * 2, 0, Math.PI / 1.9), hair, [0, 0.04, -0.04], [1.04, 1.08, 1.06]);
    cap.rotation.x = -0.32;
    head.add(cap);
    head.add(mesh(new THREE.SphereGeometry(0.22, 16, 10), hair, [0.12, 0.4, 0.16], [1.5, 0.55, 0.9]));
    for (const side of [-1, 1]) head.add(mesh(new THREE.SphereGeometry(0.16, 14, 10), hair, [side * 0.37, 0.12, -0.06], [0.7, 1.1, 1.1]));
  } else if (coach.id === 'capablanca') {
    // Short hair combed straight back with a side parting.
    const cap = mesh(new THREE.SphereGeometry(0.445, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2.05), hair, [0, 0.05, -0.04], [1.02, 1.04, 1.05]);
    cap.rotation.x = -0.42;
    head.add(cap);
    const parting = mesh(new THREE.BoxGeometry(0.016, 0.01, 0.26), toon(look.skin), [-0.15, 0.475, 0.04]);
    parting.rotation.x = -0.35;
    head.add(parting);
  } else {
    // White hair at the sides, beard and moustache, and a checked headwrap.
    for (const side of [-1, 1]) head.add(mesh(new THREE.SphereGeometry(0.12, 12, 10), hair, [side * 0.38, -0.02, -0.05], [0.7, 1.2, 1.2]));
    const beard = toon(look.beard!);
    head.add(mesh(new THREE.SphereGeometry(0.34, 24, 16, 0, Math.PI * 2, Math.PI / 2.2, Math.PI / 2), beard, [0, -0.08, 0.06], [1.05, 1.25, 1]));
    for (const side of [-1, 1]) {
      const stache = mesh(new THREE.CapsuleGeometry(0.035, 0.12, 4, 8), beard, [side * 0.08, -0.15, 0.4]);
      stache.rotation.z = side * 1.25;
      head.add(stache);
    }
    const cloth = new THREE.MeshToonMaterial({ map: checkedCloth(look.headwrap!.base, look.headwrap!.pattern), gradientMap: gradientMap() });
    head.add(mesh(new THREE.CylinderGeometry(0.47, 0.45, 0.28, 32), cloth, [0, 0.36, -0.02]));
    head.add(mesh(new THREE.TorusGeometry(0.44, 0.08, 12, 32), cloth, [0, 0.3, -0.02], [1, 1, 1]).rotateX(Math.PI / 2));
    head.add(mesh(new THREE.SphereGeometry(0.44, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), cloth, [0, 0.47, -0.02], [1, 0.45, 1]));
  }

  const left = buildArm(look, 1);
  const right = buildArm(look, -1);
  body.add(left.shoulder, right.shoulder);

  return {
    root,
    body,
    head,
    mouth,
    smile,
    lids,
    brows,
    pupils,
    leftArm: left.shoulder,
    rightArm: right.shoulder,
    leftElbow: left.elbow,
    rightElbow: right.elbow,
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const UPPER_ARM = 0.6;
const SHOULDER_Y = 1.08;
const SHOULDER_X = 0.66;
const DOWN = new THREE.Vector3(0, -1, 0);
type ArmTarget = { elbow: [number, number, number]; hand: [number, number, number] };

/**
 * Where the right arm's elbow and hand go for each mood, in body space (the left arm
 * mirrors x). The right arm is on the viewer's left, next to the board.
 */
function armTargets(mood: AvatarMood, t: number, active: boolean): { right: ArmTarget; left: ArmTarget } {
  const rest: ArmTarget = { elbow: [-0.76, 0.5, 0.06], hand: [-0.74, -0.06, 0.24] };
  const mirror = (a: ArmTarget): ArmTarget => ({ elbow: [-a.elbow[0], a.elbow[1], a.elbow[2]], hand: [-a.hand[0], a.hand[1], a.hand[2]] });
  if (!active) return { right: rest, left: mirror(rest) };
  switch (mood) {
    case 'explaining':
      return { right: { elbow: [-0.86, 0.58, 0.3], hand: [-1.0, 0.98, 0.6] }, left: mirror(rest) };
    case 'thinking':
      return { right: { elbow: [-0.35, 0.95, 0.6], hand: [-0.05, 1.42, 0.5] }, left: mirror({ elbow: [-0.7, 0.62, 0.4], hand: [-0.2, 0.72, 0.62] }) };
    case 'happy':
      return { right: { elbow: [-0.84, 0.62, 0.24], hand: [-0.8, 1.16, 0.5] }, left: mirror(rest) };
    case 'concerned': {
      const open: ArmTarget = { elbow: [-0.82, 0.56, 0.24], hand: [-1.02, 0.86, 0.52] };
      return { right: open, left: mirror(open) };
    }
    case 'pointing':
      return { right: { elbow: [-1.14, 1.0, 0.28], hand: [-1.68, 1.12, 0.5] }, left: mirror(rest) };
    case 'celebrate': {
      const bounce = Math.sin(t * 10) * 0.08;
      const up: ArmTarget = { elbow: [-0.98, 1.55 + bounce, 0.1], hand: [-1.08, 2.1 + bounce, 0.18] };
      return { right: up, left: mirror(up) };
    }
    default:
      return { right: rest, left: mirror(rest) };
  }
}

const tmpU = new THREE.Vector3();
const tmpF = new THREE.Vector3();
const tmpE = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();

/** Rotations for shoulder and elbow that point the arm at the target elbow and hand. */
function solveArm(side: 1 | -1, target: ArmTarget, shoulderQ: THREE.Quaternion, elbowQ: THREE.Quaternion) {
  const shoulder = new THREE.Vector3(side * SHOULDER_X, SHOULDER_Y, 0);
  tmpU.set(...target.elbow).sub(shoulder).normalize();
  shoulderQ.setFromUnitVectors(DOWN, tmpU);
  tmpE.copy(shoulder).addScaledVector(tmpU, UPPER_ARM);
  tmpF.set(...target.hand).sub(tmpE).normalize();
  tmpQ.copy(shoulderQ).invert();
  tmpF.applyQuaternion(tmpQ);
  elbowQ.setFromUnitVectors(DOWN, tmpF);
}

export const CoachAvatar3D: React.FC<CoachAvatar3DProps> = ({ coach, mood, speaking, gestureKey, width, height, onPoke, onUnsupported }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ mood, speaking, gestureStart: 0 });
  stateRef.current.mood = mood;
  stateRef.current.speaking = speaking;

  useEffect(() => {
    stateRef.current.gestureStart = performance.now();
  }, [gestureKey, mood]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      onUnsupported?.();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 50);
    camera.position.set(0, 1.6, 5.4);
    camera.lookAt(0, 1.38, 0);
    scene.add(new THREE.HemisphereLight('#ffffff', '#40342a', 1.6));
    const key = new THREE.DirectionalLight('#ffffff', 2.2);
    key.position.set(2, 4, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(coach.accent, 1.4);
    rim.position.set(-3, 2, -3);
    scene.add(rim);

    const rig = buildCharacter(coach);
    scene.add(rig.root);

    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const pointer = { x: 0, y: 0 };
    const onPointerMove = (e: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      pointer.x = Math.max(-1, Math.min(1, (e.clientX - (rect.left + rect.width / 2)) / 500));
      pointer.y = Math.max(-1, Math.min(1, (e.clientY - (rect.top + rect.height / 3)) / 500));
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    let visible = true;
    const observer = new IntersectionObserver(entries => {
      visible = entries.some(e => e.isIntersecting);
    });
    observer.observe(host);

    let nextBlink = performance.now() + 2000;
    let frame = 0;
    const start = performance.now();
    const pose = { headX: 0, headY: 0, headZ: 0 };
    const goal = { rs: new THREE.Quaternion(), re: new THREE.Quaternion(), ls: new THREE.Quaternion(), le: new THREE.Quaternion() };

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      if (!visible || document.hidden) return;
      const t = (now - start) / 1000;
      const { mood: currentMood, speaking: isSpeaking, gestureStart } = stateRef.current;
      const phase = Math.min(1, (now - gestureStart) / 1600);
      const motion = reduceMotion ? 0 : 1;

      // Breathing and a gentle sway.
      rig.body.scale.y = 1 + Math.sin(t * 1.7) * 0.01 * motion;
      rig.root.rotation.y = Math.sin(t * 0.45) * 0.05 * motion;

      // Head follows the pointer, plus nods and shakes for reactions.
      let targetX = pointer.y * 0.25;
      let targetY = pointer.x * 0.45;
      let targetZ = 0;
      if (phase < 1 && motion) {
        const env = Math.sin(phase * Math.PI);
        if (currentMood === 'happy' || currentMood === 'celebrate') targetX += Math.sin(phase * Math.PI * 6) * 0.18 * env;
        if (currentMood === 'concerned') targetY += Math.sin(phase * Math.PI * 6) * 0.3 * env;
        if (currentMood === 'pointing') targetY -= 0.35 * env;
        if (currentMood === 'explaining') targetX += Math.sin(phase * Math.PI * 2) * 0.05 * env;
      }
      if (currentMood === 'thinking') {
        targetZ = 0.12;
        targetX += 0.08;
      }
      pose.headX = lerp(pose.headX, targetX, 0.12);
      pose.headY = lerp(pose.headY, targetY, 0.12);
      pose.headZ = lerp(pose.headZ, targetZ, 0.08);
      rig.head.rotation.set(pose.headX, pose.headY, pose.headZ);
      for (const p of rig.pupils) {
        p.position.x = Math.sign(p.position.x) * 0.15 + pointer.x * 0.02;
        p.position.y = 0.08 - pointer.y * 0.015;
      }

      // Arms: hold the gesture while the coach is talking, then relax.
      const gestureActive = currentMood === 'thinking' || phase < 1 || isSpeaking;
      const targets = armTargets(currentMood, t, gestureActive && motion > 0);
      solveArm(-1, targets.right, goal.rs, goal.re);
      solveArm(1, targets.left, goal.ls, goal.le);
      rig.rightArm.quaternion.slerp(goal.rs, 0.12);
      rig.rightElbow.quaternion.slerp(goal.re, 0.12);
      rig.leftArm.quaternion.slerp(goal.ls, 0.12);
      rig.leftElbow.quaternion.slerp(goal.le, 0.12);

      // Eyebrows: raised when happy, knitted when concerned.
      const browTilt = currentMood === 'concerned' ? 0.35 : currentMood === 'thinking' ? 0.15 : 0;
      const browLift = currentMood === 'happy' || currentMood === 'celebrate' ? 0.03 : 0;
      rig.brows.forEach((b, i) => {
        const side = i === 0 ? -1 : 1;
        b.rotation.z = lerp(b.rotation.z, -side * browTilt, 0.15);
        b.position.y = lerp(b.position.y, 0.2 + browLift, 0.15);
      });

      // Blinking.
      // Eyelids rest a little lowered (rotation back = open) and sweep down to blink.
      let lid = -0.55;
      if (currentMood === 'happy' || currentMood === 'celebrate') lid = -0.75;
      if (now > nextBlink) {
        const k = (now - nextBlink) / 150;
        if (k >= 1) nextBlink = now + 2200 + Math.random() * 3000;
        else lid = lerp(lid, 1.15, Math.sin(k * Math.PI));
      }
      for (const l of rig.lids) l.rotation.x = lid;

      // Mouth: moves while talking, smiles when pleased.
      const smiling = !isSpeaking && currentMood !== 'concerned' && currentMood !== 'thinking';
      rig.smile.visible = smiling;
      rig.mouth.visible = !smiling;
      const open = isSpeaking ? 0.25 + Math.abs(Math.sin(t * 13) * Math.sin(t * 5.3)) * 0.9 : 0.08;
      rig.mouth.scale.y = lerp(rig.mouth.scale.y, open, 0.35);

      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      scene.traverse(obj => {
        const m = obj as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        for (const mat of mats) {
          (mat as THREE.MeshToonMaterial).map?.dispose();
          mat.dispose();
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
    // Rebuild only when the character or the size changes; mood and speech are read live.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coach.id, width, height]);

  return (
    <div
      ref={hostRef}
      role="img"
      aria-label={`${coach.name}, your coach`}
      onClick={onPoke}
      style={{ width, height, cursor: onPoke ? 'pointer' : 'default' }}
    />
  );
};

export default CoachAvatar3D;
