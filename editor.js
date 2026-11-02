import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';

const viewport = document.querySelector('#viewport');
const loading = document.querySelector('#viewport-loading');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f8fb);
scene.fog = new THREE.Fog(0xf0f8fb, 28, 65);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 300);
camera.position.set(11, 10, 13);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setSize(viewport.clientWidth, viewport.clientHeight);
viewport.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff, 0xb5c8d1, 2.0));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(8, 15, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -20; sun.shadow.camera.right = 20;
sun.shadow.camera.top = 20; sun.shadow.camera.bottom = -20;
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshStandardMaterial({ color: 0xe4eff1, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.035;
ground.receiveShadow = true;
scene.add(ground);
const grid = new THREE.GridHelper(40, 40, 0x9dbbc5, 0xcbdde2);
grid.position.y = 0;
scene.add(grid);
const axes = new THREE.AxesHelper(2.5);
axes.position.set(0, 0.02, 0);
scene.add(axes);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0.5, 0);
controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 3;
controls.maxDistance = 70;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const objects = [];
let selected = null;
let nextId = 1;
const defaultColor = '#8bb8d8';

const $ = (selector) => document.querySelector(selector);
const status = (message) => { $('#status-message').textContent = message; };
const makeMaterial = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.02 });

function geometryFor(type) {
  if (type === 'sphere') return new THREE.SphereGeometry(0.65, 32, 20);
  if (type === 'cylinder') return new THREE.CylinderGeometry(0.55, 0.55, 1.3, 32);
  if (type === 'plane') return new THREE.BoxGeometry(2, 0.08, 2);
  return new THREE.BoxGeometry(1.2, 1.2, 1.2);
}
function labelFor(type) {
  return ({ box: 'Cube', sphere: 'Sphere', cylinder: 'Cylinder', plane: 'Plane' })[type] || 'Object';
}
function createObject(type, data = {}) {
  const id = data.id || 'obj_' + nextId++;
  const color = data.color || defaultColor;
  const mesh = new THREE.Mesh(geometryFor(type), makeMaterial(color));
  mesh.position.set(data.position?.x ?? 0, data.position?.y ?? (type === 'plane' ? 0.05 : 0.65), data.position?.z ?? 0);
  mesh.rotation.set(data.rotation?.x ?? 0, data.rotation?.y ?? 0, data.rotation?.z ?? 0);
  mesh.scale.set(data.scale?.x ?? 1, data.scale?.y ?? 1, data.scale?.z ?? 1);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { id, type, name: data.name || labelFor(type) + ' ' + id.split('_').pop(), color };
  scene.add(mesh);
  objects.push(mesh);
  nextId = Math.max(nextId, Number(id.split('_').pop()) + 1 || nextId);
  renderObjectList();
  selectObject(mesh);
  status(mesh.userData.name + ' を追加したよ。');
  return mesh;
}
function clearSelectionVisual() {
  objects.forEach((obj) => {
    obj.material.emissive.set(0x000000);
    obj.material.emissiveIntensity = 0;
  });
}
function selectObject(mesh) {
  selected = mesh || null;
  clearSelectionVisual();
  if (selected) {
    selected.material.emissive.set(0x234e5a);
    selected.material.emissiveIntensity = 0.22;
  }
  $('#inspector-empty').hidden = !!selected;
  $('#inspector').hidden = !selected;
  $('#selection-status').textContent = selected ? selected.userData.name : '未選択';
  $('#delete-button').disabled = !selected;
  $('#duplicate-button').disabled = !selected;
  if (selected) syncInspector();
  renderObjectList();
}
function renderObjectList() {
  const list = $('#object-list');
  list.replaceChildren();
  if (!objects.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-list';
    empty.textContent = 'まだ何もないよ。世界の始まりだね。';
    list.append(empty);
  }
  objects.forEach((obj) => {
    const button = document.createElement('button');
    button.className = 'object-item' + (obj === selected ? ' active' : '');
    button.type = 'button';
    const dot = document.createElement('span');
    dot.className = 'object-dot';
    dot.style.background = '#' + obj.userData.color.replace('#', '');
    const name = document.createElement('span');
    name.textContent = obj.userData.name;
    const type = document.createElement('small');
    type.textContent = obj.userData.type.toUpperCase();
    button.append(dot, name, type);
    button.addEventListener('click', () => selectObject(obj));
    list.append(button);
  });
  $('#object-count').textContent = objects.length + ' OBJECT' + (objects.length === 1 ? '' : 'S');
}
function syncInspector() {
  if (!selected) return;
  $('#object-name').value = selected.userData.name;
  $('#object-color').value = selected.userData.color;
  $('#color-value').textContent = selected.userData.color.toUpperCase();
  document.querySelectorAll('[data-transform]').forEach((input) => {
    const group = input.dataset.transform;
    const axis = input.dataset.axis;
    const value = group === 'rotation' ? THREE.MathUtils.radToDeg(selected.rotation[axis]) : selected[group][axis];
    input.value = Number(value.toFixed(2));
  });
}
function deleteSelected() {
  if (!selected) return;
  const name = selected.userData.name;
  scene.remove(selected);
  selected.geometry.dispose();
  selected.material.dispose();
  objects.splice(objects.indexOf(selected), 1);
  selected = null;
  selectObject(null);
  status(name + ' を削除したよ。');
}
function duplicateSelected() {
  if (!selected) return;
  const data = serializeObject(selected);
  data.id = 'obj_' + nextId++;
  data.name = selected.userData.name + ' Copy';
  data.position.x += 1;
  data.position.z += 1;
  createObject(data.type, data);
}
function serializeObject(obj) {
  return {
    id: obj.userData.id,
    type: obj.userData.type,
    name: obj.userData.name,
    color: obj.userData.color,
    position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
    rotation: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z },
    scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z }
  };
}
function saveMap() {
  const map = {
    format: 'VOID_STOREHOUSE_MAP',
    version: 1,
    mapName: $('#map-name').value.trim() || 'Untitled Map',
    createdAt: new Date().toISOString(),
    editor: 'VOID STOREHOUSE 3D MAP EDITOR',
    settings: { unit: 'meter', gridSize: 1 },
    objects: objects.map(serializeObject)
  };
  const blob = new Blob([JSON.stringify(map, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'MAP.JSON';
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  status('MAP.JSON を保存したよ。オブジェクト ' + objects.length + ' 個。');
}
function loadMap(map) {
  if (!map || map.format !== 'VOID_STOREHOUSE_MAP' || !Array.isArray(map.objects)) {
    status('このJSONは対応していない形式だよ。');
    return;
  }
  objects.splice(0).forEach((obj) => { scene.remove(obj); obj.geometry.dispose(); obj.material.dispose(); });
  selected = null;
  nextId = 1;
  $('#map-name').value = map.mapName || 'Untitled Map';
  map.objects.forEach((data) => {
    const allowed = ['box', 'sphere', 'cylinder', 'plane'];
    if (allowed.includes(data.type)) createObject(data.type, data);
  });
  if (!objects.length) selectObject(null);
  status('マップを読み込んだよ。');
}
document.querySelectorAll('[data-add]').forEach((button) => {
  button.addEventListener('click', () => createObject(button.dataset.add));
});
$('#delete-button').addEventListener('click', deleteSelected);
$('#duplicate-button').addEventListener('click', duplicateSelected);
$('#save-button').addEventListener('click', saveMap);
$('#reset-view').addEventListener('click', () => {
  camera.position.set(11, 10, 13);
  controls.target.set(0, 0.5, 0);
  controls.update();
});
$('#object-name').addEventListener('input', (event) => {
  if (!selected) return;
  selected.userData.name = event.target.value || 'Unnamed Object';
  $('#selection-status').textContent = selected.userData.name;
  renderObjectList();
});
$('#object-color').addEventListener('input', (event) => {
  if (!selected) return;
  selected.userData.color = event.target.value;
  selected.material.color.set(event.target.value);
  $('#color-value').textContent = event.target.value.toUpperCase();
  renderObjectList();
});
document.querySelectorAll('[data-transform]').forEach((input) => {
  input.addEventListener('change', () => {
    if (!selected) return;
    const group = input.dataset.transform;
    const axis = input.dataset.axis;
    const value = Number(input.value);
    if (!Number.isFinite(value)) return syncInspector();
    if (group === 'rotation') selected.rotation[axis] = THREE.MathUtils.degToRad(value);
    else selected[group][axis] = group === 'scale' ? Math.max(0.1, value) : value;
    syncInspector();
  });
});
$('#load-button').addEventListener('click', () => $('#file-input').click());
$('#file-input').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try { loadMap(JSON.parse(await file.text())); }
  catch { status('JSONを読み込めなかったよ。ファイルの内容を確認してね。'); }
  event.target.value = '';
});

renderer.domElement.addEventListener('pointerdown', (event) => {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(objects, false);
  if (hits.length) selectObject(hits[0].object);
});
function resize() {
  const width = viewport.clientWidth;
  const height = viewport.clientHeight;
  if (!width || !height) return;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}
new ResizeObserver(resize).observe(viewport);
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
loading.hidden = true;
renderObjectList();
status('準備完了。まずはオブジェクトを追加してみよう。');
