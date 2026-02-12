import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';

const canvas = document.getElementById('scene');
const slider = document.getElementById('clutchRange');
const stateText = document.getElementById('stateText');
const stepsContainer = document.getElementById('steps');

const lessonSteps = [
  {
    title: '1. Eingekuppelt',
    body: 'Reibbeläge pressen auf Schwungrad und Druckplatte: fast volle Drehmomentübertragung.',
    threshold: [0, 25],
  },
  {
    title: '2. Schleifpunkt',
    body: 'Beläge greifen teilweise: ideal zum Anfahren und feinfühligen Lastaufbau.',
    threshold: [26, 65],
  },
  {
    title: '3. Ausgekuppelt',
    body: 'Druckplatte entfernt sich: Motordrehung wird vom Getriebe entkoppelt.',
    threshold: [66, 100],
  },
];

const stepNodes = lessonSteps.map((step) => {
  const card = document.createElement('article');
  card.className = 'step';
  card.innerHTML = `<h3>${step.title}</h3><p>${step.body}</p>`;
  stepsContainer.append(card);
  return card;
});

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070512);
scene.fog = new THREE.Fog(0x070512, 13, 34);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

const camera = new THREE.PerspectiveCamera(46, canvas.clientWidth / canvas.clientHeight, 0.1, 130);
camera.position.set(7.2, 4.6, 9.5);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.04;
controls.minDistance = 4.5;
controls.maxDistance = 18;
controls.maxPolarAngle = Math.PI * 0.48;
controls.target.set(0.5, 0.25, 0);

const ambient = new THREE.AmbientLight(0x7f89be, 0.45);
scene.add(ambient);

const pinkRim = new THREE.PointLight(0xff58ca, 26, 24, 2.1);
pinkRim.position.set(-5.5, 2.3, -4.5);
scene.add(pinkRim);

const cyanRim = new THREE.PointLight(0x52e6ff, 30, 26, 2);
cyanRim.position.set(6.2, 3.8, 4.5);
scene.add(cyanRim);

const keyLight = new THREE.DirectionalLight(0xd9e6ff, 1.45);
keyLight.position.set(6, 7.5, 3);
scene.add(keyLight);

const gradientTexture = (() => {
  const data = new Uint8Array([
    28, 35, 82,
    80, 98, 164,
    151, 124, 230,
    250, 155, 226,
  ]);
  const tex = new THREE.DataTexture(data, 4, 1, THREE.RGBFormat);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
})();

const matCore = new THREE.MeshToonMaterial({ color: 0xaeb6d4, gradientMap: gradientTexture });
const matDark = new THREE.MeshToonMaterial({ color: 0x3e4762, gradientMap: gradientTexture });
const matFriction = new THREE.MeshToonMaterial({ color: 0xe67f59, gradientMap: gradientTexture });
const matAccent = new THREE.MeshToonMaterial({ color: 0x62d8ff, emissive: 0x104054, gradientMap: gradientTexture });

const stage = new THREE.Mesh(
  new THREE.CylinderGeometry(8.8, 9.8, 0.85, 84, 1, true),
  new THREE.MeshToonMaterial({ color: 0x11172c, gradientMap: gradientTexture })
);
stage.position.y = -2.65;
scene.add(stage);

const stageTop = new THREE.Mesh(
  new THREE.CylinderGeometry(8.8, 8.8, 0.28, 84),
  new THREE.MeshToonMaterial({ color: 0x161d39, gradientMap: gradientTexture })
);
stageTop.position.y = -2.12;
scene.add(stageTop);

const gridRingGroup = new THREE.Group();
for (let i = 0; i < 4; i += 1) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3 + i * 1.15, 0.02, 10, 120),
    new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff65cc : 0x55dfff, transparent: true, opacity: 0.36 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = -1.96;
  gridRingGroup.add(ring);
}
scene.add(gridRingGroup);

const clutchGroup = new THREE.Group();
scene.add(clutchGroup);

const buildFlywheel = () => {
  const g = new THREE.Group();

  const outer = new THREE.Mesh(new THREE.CylinderGeometry(2.28, 2.28, 0.62, 92), matDark);
  outer.rotation.z = Math.PI / 2;
  g.add(outer);

  const lip = new THREE.Mesh(new THREE.TorusGeometry(2.22, 0.07, 14, 120), matAccent);
  lip.rotation.y = Math.PI / 2;
  g.add(lip);

  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.72, 16), matCore);
    bolt.position.set(0, Math.cos(angle) * 1.58, Math.sin(angle) * 1.58);
    bolt.rotation.z = Math.PI / 2;
    g.add(bolt);
  }

  return g;
};

const buildFrictionDisc = () => {
  const g = new THREE.Group();

  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.72, 1.72, 0.26, 84), matFriction);
  disc.rotation.z = Math.PI / 2;
  g.add(disc);

  const innerHub = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.5, 44), matCore);
  innerHub.rotation.z = Math.PI / 2;
  g.add(innerHub);

  for (let i = 0; i < 6; i += 1) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.09, 0.12), matCore);
    const angle = (i / 6) * Math.PI * 2;
    spoke.position.set(0, Math.cos(angle) * 0.82, Math.sin(angle) * 0.82);
    spoke.rotation.x = angle;
    g.add(spoke);
  }

  return g;
};

const buildPressurePlate = () => {
  const g = new THREE.Group();

  const shell = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 0.44, 84), matCore);
  shell.rotation.z = Math.PI / 2;
  g.add(shell);

  const diaphragm = new THREE.Mesh(new THREE.ConeGeometry(1.25, 0.3, 44, 1, true), matDark);
  diaphragm.position.x = -0.05;
  diaphragm.rotation.z = Math.PI / 2;
  g.add(diaphragm);

  for (let i = 0; i < 12; i += 1) {
    const angle = (i / 12) * Math.PI * 2;
    const finger = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.055, 0.06), matAccent);
    finger.position.set(0.18, Math.cos(angle) * 0.68, Math.sin(angle) * 0.68);
    finger.lookAt(new THREE.Vector3(0.18, 0, 0));
    g.add(finger);
  }

  return g;
};

const flywheel = buildFlywheel();
flywheel.position.x = -2.35;
clutchGroup.add(flywheel);

const frictionDisc = buildFrictionDisc();
clutchGroup.add(frictionDisc);

const pressurePlate = buildPressurePlate();
pressurePlate.position.x = 1.55;
clutchGroup.add(pressurePlate);

const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 5.9, 30), matDark);
shaft.rotation.z = Math.PI / 2;
shaft.position.x = 2.65;
clutchGroup.add(shaft);

const shaftSplines = new THREE.Group();
for (let i = 0; i < 9; i += 1) {
  const tooth = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.04, 0.06), matCore);
  const angle = (i / 9) * Math.PI * 2;
  tooth.position.set(0.6, Math.cos(angle) * 0.25, Math.sin(angle) * 0.25);
  tooth.lookAt(new THREE.Vector3(0.6, 0, 0));
  shaftSplines.add(tooth);
}
clutchGroup.add(shaftSplines);

const energyRing = new THREE.Mesh(
  new THREE.TorusGeometry(2.04, 0.08, 16, 128),
  new THREE.MeshBasicMaterial({ color: 0x5de3ff, transparent: true, opacity: 0.85 })
);
energyRing.rotation.y = Math.PI / 2;
energyRing.position.x = 1.5;
clutchGroup.add(energyRing);

const directionArrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(-3.6, 0, 0), 7.1, 0xff6bc4, 0.4, 0.2);
clutchGroup.add(directionArrow);

const updateLessonUI = (value) => {
  let status = 'Eingekuppelt (Kraftschluss aktiv)';
  if (value > 65) status = 'Ausgekuppelt (Kraftfluss getrennt)';
  else if (value > 25) status = 'Schleifpunkt (teilweiser Kraftschluss)';
  stateText.textContent = `Status: ${status}`;

  lessonSteps.forEach((step, index) => {
    const [min, max] = step.threshold;
    stepNodes[index].classList.toggle('active', value >= min && value <= max);
  });
};

const updateClutch = (value) => {
  const t = value / 100;
  pressurePlate.position.x = 1.55 + t * 1.55;
  energyRing.position.x = 1.5 + t * 1.55;

  const transfer = 1 - t;
  energyRing.material.opacity = 0.2 + transfer * 0.9;
  matFriction.color.setHSL(0.05 + t * 0.07, 0.74, 0.45 + transfer * 0.18);

  frictionDisc.scale.setScalar(0.97 + transfer * 0.06);

  updateLessonUI(value);
};

slider.addEventListener('input', () => updateClutch(Number(slider.value)));

const clock = new THREE.Clock();
const renderLoop = () => {
  const t = clock.getElapsedTime();
  const clutchValue = Number(slider.value);
  const transfer = 1 - clutchValue / 100;

  flywheel.rotation.x = t * 4.4;
  frictionDisc.rotation.x = t * (0.6 + transfer * 3.4);
  pressurePlate.rotation.x = t * (0.35 + transfer * 2.7);
  shaft.rotation.x = t * (0.2 + transfer * 1.9);
  shaftSplines.rotation.x = shaft.rotation.x;

  clutchGroup.rotation.y = Math.sin(t * 0.33) * 0.08;
  clutchGroup.position.y = Math.sin(t * 1.2) * 0.03;

  gridRingGroup.rotation.y = t * 0.1;

  pinkRim.intensity = 22 + Math.sin(t * 2.2) * 4;
  cyanRim.intensity = 24 + Math.cos(t * 2.5) * 4;

  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(renderLoop);
};

const onResize = () => {
  const { clientWidth, clientHeight } = canvas;
  camera.aspect = clientWidth / clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(clientWidth, clientHeight, false);
};

window.addEventListener('resize', onResize);
updateClutch(0);
renderLoop();
