import { createViz } from "./viz3d.js";

const MAX_DOORS = 20000; // keep the scene small enough to draw smoothly

const form = document.getElementById("form");
const res = document.getElementById("res");
const player = document.getElementById("player");
const playBtn = document.getElementById("playBtn");
const stepBtn = document.getElementById("stepBtn");
const finishBtn = document.getElementById("finishBtn");
const resetBtn = document.getElementById("resetBtn");
const speed = document.getElementById("speed");

const $ = (id) => document.getElementById(id);

const viz = createViz($("scene"));

let state = null; // { B, M, O, K, N, steps, done }
let timer = null;

/**
 * @param {string} str - raw input value
 * @returns {number} parsed number, or NaN if str is empty / not numeric
 */
function parseNumber(str) {
  const trimmed = str.trim();
  return trimmed === "" ? NaN : Number(trimmed);
}

/**
 * Walks every building exactly like the 4-level nested loop,
 * pausing (yield) after every door so we can draw each step.
 */
function* walkDoors(B, M, O, K, N) {
  let result = 0;
  for (let building = 1; building <= B; building++) {
    for (let entrance = 1; entrance <= M; entrance++) {
      for (let floor = 1; floor <= O; floor++) {
        for (let door = 1; door <= K; door++) {
          result++;
          yield { building, entrance, floor, door, result, found: result === N };
          if (result === N) return;
        }
      }
    }
  }
}

function where({ building, entrance, floor, door }) {
  return `${building}-р байр, ${entrance}-р орц, ${floor}-р давхар, ${door}-р хаалга`;
}

function renderStep(step) {
  const { building, entrance, floor, door, result, found } = step;

  viz.visit(result, found);

  $("vBl").textContent = `building = ${building}`;
  $("vE").textContent = `entrance = ${entrance}`;
  $("vF").textContent = `floor = ${floor}`;
  $("vD").textContent = `door = ${door}`;
  $("vR").textContent = `result = ${result}`;
  $("vC").textContent = found ? `${result} === ${state.N} ✔` : `${result} ≠ ${state.N}`;
  document.querySelector('[data-line="check"]').classList.toggle("hit", found);

  res.className = found ? "success" : "";
  res.textContent = found ? `Олдлоо! ${where(step)}.` : `Алхам ${result}: ${where(step)}`;
}

function nextStep() {
  if (!state || state.done) return false;
  const { value, done } = state.steps.next();
  if (done) {
    finish();
    return false;
  }
  renderStep(value);
  if (value.found) finish();
  return true;
}

function finish() {
  state.done = true;
  stop();
  playBtn.disabled = stepBtn.disabled = finishBtn.disabled = true;
}

function delay() {
  // speed 1 → 1000ms, speed 20 → ~20ms
  return Math.round(1000 / speed.value ** 1.3);
}

function play() {
  playBtn.textContent = "⏸ Зогсоох";
  const tick = () => {
    if (nextStep()) timer = setTimeout(tick, delay());
  };
  tick();
}

function stop() {
  clearTimeout(timer);
  timer = null;
  playBtn.textContent = "▶ Тоглуулах";
}

function start(B, M, O, K, N) {
  stop();
  // Show the player first so the scene container has a size when it's built.
  player.hidden = false;
  viz.build(B, M, O, K);
  state = { B, M, O, K, N, steps: walkDoors(B, M, O, K, N), done: false };

  $("vB").textContent = B;
  $("vM").textContent = M;
  $("vO").textContent = O;
  $("vK").textContent = K;
  $("vN").textContent = N;
  for (const id of ["vBl", "vE", "vF", "vD", "vC"]) $(id).textContent = "–";
  $("vR").textContent = "result = 0";
  document.querySelector('[data-line="check"]').classList.remove("hit");

  playBtn.disabled = stepBtn.disabled = finishBtn.disabled = false;
  res.className = "";
  res.textContent = `Нийт ${B * M * O * K} хаалга. ${N}-р тоотыг хайж байна…`;
}

function showError(message) {
  stop();
  player.hidden = true;
  res.className = "error";
  res.textContent = message;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const B = parseNumber($("B").value);
  const M = parseNumber($("M").value);
  const O = parseNumber($("O").value);
  const K = parseNumber($("K").value);
  const N = parseNumber($("N").value);

  if (![B, M, O, K, N].every((x) => Number.isInteger(x) && x > 0)) {
    return showError("Бүх утга 1-ээс их бүхэл тоо байх ёстой.");
  }

  const allDoors = B * M * O * K;
  if (allDoors > MAX_DOORS) {
    return showError(`Хэт том байна (${allDoors} хаалга). ${MAX_DOORS}-аас бага байлгана уу.`);
  }
  if (N > allDoors) {
    return showError(`Таны хайсан тоот олдсонгүй (нийт ${allDoors} хаалга).`);
  }

  start(B, M, O, K, N);
  play();
});

playBtn.addEventListener("click", () => (timer ? stop() : play()));

stepBtn.addEventListener("click", () => {
  stop();
  nextStep();
});

finishBtn.addEventListener("click", () => {
  stop();
  while (nextStep());
});

resetBtn.addEventListener("click", () => {
  if (state) start(state.B, state.M, state.O, state.K, state.N);
});
