import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// Layout: entrances run along X, floors up Y, doors of a floor go back along Z.
// Buildings sit on a grid on the ground.
const CELL = 1; // spacing between door centers
const DOOR = 0.8; // door box size
const ENTRANCE_GAP = 0.6;
const BUILDING_GAP = 3;

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/**
 * @param {HTMLElement} container - element the canvas and labels are placed in
 */
export function createViz(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x445555, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(5, 10, 7);
  scene.add(sun);

  const tag = document.createElement("div");
  tag.className = "tag";
  tag.hidden = true;
  const tip = document.createElement("div");
  tip.className = "tag tip";
  tip.hidden = true;
  container.append(tag, tip);

  let colors = {};
  let group = null; // everything built for the current run
  let doors = null; // InstancedMesh, one instance per door
  let info = []; // info[i] = { b, e, f, d, pos }
  let labels = []; // { el, pos } building labels
  let current = -1;

  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();

  function readColors() {
    colors = {
      bg: new THREE.Color(css("--surface")),
      idle: new THREE.Color(css("--door")),
      visited: new THREE.Color(css("--visited")),
      current: new THREE.Color(css("--current")),
      found: new THREE.Color(css("--found")),
      frame: new THREE.Color(css("--border")),
    };
    scene.background = colors.bg;
  }

  function setInstance(i, status) {
    const scale = status === "found" ? 1.25 : status === "current" ? 1.15 : 1;
    matrix.makeScale(scale, scale, scale).setPosition(info[i].pos);
    doors.setMatrixAt(i, matrix);
    doors.setColorAt(i, color.copy(colors[status]));
    info[i].status = status;
    doors.instanceMatrix.needsUpdate = true;
    doors.instanceColor.needsUpdate = true;
  }

  /** Builds B buildings × M entrances × O floors × K doors. */
  function build(B, M, O, K) {
    if (group) {
      scene.remove(group);
      group.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose();
      });
    }
    for (const l of labels) l.el.remove();
    labels = [];
    info = [];
    current = -1;
    tag.hidden = tip.hidden = true;
    readColors();

    group = new THREE.Group();
    scene.add(group);

    const width = M * CELL + (M - 1) * ENTRANCE_GAP;
    const depth = K * CELL;
    const height = O * CELL;
    const cols = Math.ceil(Math.sqrt(B));
    const rows = Math.ceil(B / cols);

    doors = new THREE.InstancedMesh(
      new THREE.BoxGeometry(DOOR, DOOR, DOOR),
      new THREE.MeshStandardMaterial({ roughness: 0.6 }),
      B * M * O * K,
    );
    group.add(doors);

    const frameMat = new THREE.LineBasicMaterial({ color: colors.frame });
    const origin = new THREE.Vector3(
      -((cols * width + (cols - 1) * BUILDING_GAP) / 2),
      0,
      -((rows * depth + (rows - 1) * BUILDING_GAP) / 2),
    );

    for (let b = 1; b <= B; b++) {
      const bx = origin.x + ((b - 1) % cols) * (width + BUILDING_GAP);
      const bz = origin.z + Math.floor((b - 1) / cols) * (depth + BUILDING_GAP);

      for (let e = 1; e <= M; e++) {
        const ex = bx + (e - 1) * (CELL + ENTRANCE_GAP) + CELL / 2;

        // Wireframe shell around each entrance.
        const shell = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(CELL, height, depth)),
          frameMat,
        );
        shell.position.set(ex, height / 2, bz + depth / 2);
        group.add(shell);

        for (let f = 1; f <= O; f++) {
          for (let d = 1; d <= K; d++) {
            const pos = new THREE.Vector3(ex, (f - 0.5) * CELL, bz + (d - 0.5) * CELL);
            info.push({ b, e, f, d, pos });
            setInstance(info.length - 1, "idle");
          }
        }
      }

      const el = document.createElement("div");
      el.className = "tag label";
      el.textContent = `${b}-р байр`;
      container.append(el);
      labels.push({ el, pos: new THREE.Vector3(bx + width / 2, height + 0.8, bz + depth / 2) });
    }

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(cols * (width + BUILDING_GAP) + 4, rows * (depth + BUILDING_GAP) + 4),
      new THREE.MeshStandardMaterial({ color: colors.frame, transparent: true, opacity: 0.35 }),
    );
    ground.rotation.x = -Math.PI / 2;
    group.add(ground);

    // Frame the whole scene.
    const box = new THREE.Box3().setFromObject(group);
    const size = box.getSize(new THREE.Vector3()).length();
    const center = box.getCenter(new THREE.Vector3());
    controls.target.copy(center);
    camera.position.copy(center).add(new THREE.Vector3(0.8, 0.6, 1).normalize().multiplyScalar(size * 1.35));
    camera.near = size / 100;
    camera.far = size * 10;
    camera.updateProjectionMatrix();
  }

  /** Marks door number n (1-based) as current or found; the previous current becomes visited. */
  function visit(n, found) {
    if (current >= 0 && info[current].status === "current") setInstance(current, "visited");
    current = n - 1;
    setInstance(current, found ? "found" : "current");
    tag.textContent = n;
    tag.classList.toggle("found", found);
    tag.hidden = false;
  }

  // ---------- Hover tooltip ----------

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hoverEvent = null;

  renderer.domElement.addEventListener("pointermove", (ev) => (hoverEvent = ev));
  renderer.domElement.addEventListener("pointerleave", () => {
    hoverEvent = null;
    tip.hidden = true;
  });

  function updateHover() {
    if (!hoverEvent || !doors) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(
      ((hoverEvent.clientX - rect.left) / rect.width) * 2 - 1,
      -((hoverEvent.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(doors)[0];
    if (!hit) {
      tip.hidden = true;
      return;
    }
    const { b, e, f, d } = info[hit.instanceId];
    tip.textContent = `№${hit.instanceId + 1} · ${b}-р байр, ${e}-р орц, ${f}-р давхар, ${d}-р хаалга`;
    tip.style.left = `${hoverEvent.clientX - rect.left + 12}px`;
    tip.style.top = `${hoverEvent.clientY - rect.top + 12}px`;
    tip.hidden = false;
  }

  // ---------- Render loop ----------

  const v = new THREE.Vector3();
  function place(el, pos, dy = 0) {
    v.copy(pos).project(camera);
    const w = renderer.domElement.clientWidth;
    const h = renderer.domElement.clientHeight;
    el.style.transform = `translate(-50%, -100%) translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h + dy}px)`;
    el.style.visibility = v.z < 1 ? "visible" : "hidden";
  }

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return; // hidden
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);

  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (!doors) return;
    readColors();
    info.forEach((door, i) => setInstance(i, door.status));
  });

  renderer.setAnimationLoop(() => {
    controls.update();
    for (const l of labels) place(l.el, l.pos);
    if (current >= 0) place(tag, info[current].pos, -12);
    updateHover();
    renderer.render(scene, camera);
  });

  return { build, visit };
}
