import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

const canvas = document.getElementById('scene');
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('start');
const ambientEl = document.getElementById('ambient');

// ——— Básicos de render/escena ———
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.xr.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x06080f);
scene.fog = new THREE.FogExp2(0x06080f, 0.03); // niebla nocturna

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 200);
camera.position.set(0, 1.7, 5); // altura “humana”

// ——— Iluminación “luna llena” ———
const hemi = new THREE.HemisphereLight(0x88aaff, 0x0a0c10, 0.35); // cielo/terreno
scene.add(hemi);

const moonLight = new THREE.DirectionalLight(0xbcd0ff, 0.9);
moonLight.position.set(-20, 25, 10);
moonLight.castShadow = true;
moonLight.shadow.mapSize.set(2048, 2048);
moonLight.shadow.camera.near = 0.5;
moonLight.shadow.camera.far = 100;
scene.add(moonLight);

const moonBillboard = new THREE.Mesh(
  new THREE.CircleGeometry(2.2, 64),
  new THREE.MeshBasicMaterial({ color: 0xcfe2ff })
);
moonBillboard.position.set(-60, 50, -40);
scene.add(moonBillboard);

// “AO” fake con luz muy suave desde abajo
const subtleFill = new THREE.AmbientLight(0x223344, 0.12);
scene.add(subtleFill);

// ——— Suelo ———
const groundSize = 200;
const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize, 1, 1);
const groundMat = new THREE.MeshStandardMaterial({
  color: 0x0b120e,
  roughness: 1.0,
  metalness: 0.0
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// ——— Árboles procedurales ———
function addTree(x, z) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.25, 3, 8),
    new THREE.MeshStandardMaterial({ color: 0x3a2b1a, roughness: 1 })
  );
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  trunk.position.set(x, 1.5, z);

  const crowns = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(1.8 - i * 0.35, 2.4 - i * 0.3, 10),
      new THREE.MeshStandardMaterial({ color: 0x0f2d1c, roughness: 0.9 })
    );
    crown.position.y = 2.2 + i * 0.8;
    crown.castShadow = true;
    crowns.add(crown);
  }

  const tree = new THREE.Group();
  tree.add(trunk, crowns);
  scene.add(tree);
}

THREE.MathUtils.seededRandom(42);
for (let i = 0; i < 140; i++) {
  const r = 60 + Math.random() * 80;
  const a = Math.random() * Math.PI * 2;
  addTree(Math.cos(a) * r, Math.sin(a) * r);
}

// ——— Calabazas aleatorias con “vela” interior ———
function addPumpkin(x, z) {
  // cuerpo
  const pumpkinMat = new THREE.MeshStandardMaterial({
    color: 0xff6a00,
    roughness: 0.6,
    metalness: 0.0,
    emissive: 0x1a0a00,
    emissiveIntensity: 0.1
  });

  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 24, 16),
    pumpkinMat
  );
  body.scale.x = 1.2; // achatada
  body.castShadow = true;
  body.receiveShadow = true;

  // estrías con torus finos
  const ribs = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(0.33, 0.02, 8, 32),
      new THREE.MeshStandardMaterial({ color: 0xff7f1a, roughness: 0.8 })
    );
    torus.rotation.x = Math.PI / 2;
    torus.rotation.z = (i / 8) * Math.PI;
    ribs.add(torus);
  }

  // tallo
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.07, 0.18, 8),
    new THREE.MeshStandardMaterial({ color: 0x3b7a2a, roughness: 0.9 })
  );
  stem.position.y = 0.38;

  // luz interna “vela”
  const candle = new THREE.PointLight(0xffa75a, 0.9, 5, 2.0);
  candle.position.set(0, 0.1, 0);
  const flicker = { t: Math.random() * 1000 }; // fase aleatoria

  const pumpkin = new THREE.Group();
  pumpkin.position.set(x, 0.35, z);
  pumpkin.add(body, ribs, stem, candle);

  pumpkin.userData.animate = (time) => {
    const intensity = 0.7 + Math.sin(time * 4.0 + flicker.t) * 0.2 + Math.random() * 0.05;
    candle.intensity = intensity;
  };

  scene.add(pumpkin);
  pumpkins.push(pumpkin);
}

const pumpkins = [];
for (let i = 0; i < 36; i++) {
  const r = 8 + Math.random() * 80;
  const a = Math.random() * Math.PI * 2;
  addPumpkin(Math.cos(a) * r, Math.sin(a) * r);
}

// ——— Controles: 1ª persona (desktop) ———
const controls = new PointerLockControls(camera, renderer.domElement);
let moveF = false, moveB = false, moveL = false, moveR = false, canJump = false;
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const GRAVITY = 18;
const SPEED = 8;

startBtn.addEventListener('click', async () => {
  overlay.style.display = 'none';

  // Intentar reproducir audio (requiere interacción del usuario)
  try {
    const listener = new THREE.AudioListener();
    camera.add(listener);

    const ambient = new THREE.Audio(listener);
    const mediaElement = ambientEl;
    mediaElement.volume = 0.45;
    await mediaElement.play();
    ambient.setMediaElementSource(mediaElement);
    ambient.setLoop(true);
    ambient.setVolume(0.8);
  } catch (e) {
    console.warn('No se pudo iniciar el audio hasta otra interacción:', e);
  }

  controls.lock();
});

controls.addEventListener('lock', () => {});
controls.addEventListener('unlock', () => { overlay.style.display = 'grid'; });

document.addEventListener('keydown', (e) => {
  switch (e.code) {
    case 'KeyW': moveF = true; break;
    case 'KeyS': moveB = true; break;
    case 'KeyA': moveL = true; break;
    case 'KeyD': moveR = true; break;
    case 'Space':
      if (canJump) { velocity.y += 6.0; canJump = false; }
      break;
  }
});
document.addEventListener('keyup', (e) => {
  switch (e.code) {
    case 'KeyW': moveF = false; break;
    case 'KeyS': moveB = false; break;
    case 'KeyA': moveL = false; break;
    case 'KeyD': moveR = false; break;
  }
});

// ——— Locomoción VR (joystick izquierdo) ———
const vrSpeed = 3.5;
renderer.xr.addEventListener('sessionstart', () => {
  // Mover la cámara ligeramente arriba para VR
  camera.position.y = 1.6;
});
function vrGamepadMove(dt) {
  const session = renderer.xr.getSession();
  if (!session) return;

  for (const src of session.inputSources) {
    if (!src.gamepad || !src.handedness) continue;

    // Joystick izquierdo (convención habitual): axes[2] (x), axes[3] (y)
    const [xAxis, yAxis] = src.gamepad.axes.slice(2, 4);
    if (Math.abs(xAxis) < 0.1 && Math.abs(yAxis) < 0.1) continue;

    // Avanzar en la dirección de la mirada (horizontal)
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();

    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0,1,0)).normalize();

    const move = new THREE.Vector3();
    move.addScaledVector(dir, -yAxis * vrSpeed * dt);
    move.addScaledVector(right, xAxis * vrSpeed * dt);

    camera.position.add(move);
  }
}

// ——— Actualización ———
const clock = new THREE.Clock();

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);

  // Desktop FPS movement
  if (!renderer.xr.isPresenting) {
    direction.set(Number(moveR) - Number(moveL), 0, Number(moveB) - Number(moveF)).normalize();

    if (moveF || moveB) velocity.z -= direction.z * SPEED * dt;
    if (moveL || moveR) velocity.x -= direction.x * SPEED * dt;

    // gravedad
    velocity.y -= GRAVITY * dt;

    // “rozamiento”
    velocity.x -= velocity.x * 10.0 * dt;
    velocity.z -= velocity.z * 10.0 * dt;

    controls.moveRight(-velocity.x * dt);
    controls.moveForward(-velocity.z * dt);

    camera.position.y += velocity.y * dt;

    if (camera.position.y < 1.7) {
      velocity.y = 0;
      camera.position.y = 1.7;
      canJump = true;
    }
  } else {
    vrGamepadMove(dt);
  }

  // parpadeo de velas en calabazas
  const t = performance.now() / 1000;
  for (const p of pumpkins) p.userData.animate?.(t);

  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

// ——— Redimensionado ———
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ——— VR Button (opcional) ———
const vrBtn = VRButton.createButton(renderer);
vrBtn.classList.add('vr-button');
document.body.appendChild(vrBtn);
