const MAX_DOORS = 3000; // keep the grid small enough to draw

const form = document.getElementById("form");
const res = document.getElementById("res");
const player = document.getElementById("player");
const building = document.getElementById("building");
const playBtn = document.getElementById("playBtn");
const stepBtn = document.getElementById("stepBtn");
const finishBtn = document.getElementById("finishBtn");
const resetBtn = document.getElementById("resetBtn");
const speed = document.getElementById("speed");

const $ = (id) => document.getElementById(id);

let state = null; // { M, O, K, N, steps, cells, prev, done }
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
 * Walks the building exactly like the original nested loop,
 * pausing (yield) after every door so we can draw each step.
 */
function* walkDoors(M, O, K, N) {
  let result = 0;
  for (let entrance = 1; entrance <= M; entrance++) {
    for (let floor = 1; floor <= O; floor++) {
      for (let door = 1; door <= K; door++) {
        result++;
        yield { entrance, floor, door, result, found: result === N };
        if (result === N) return;
      }
    }
  }
}

function drawBuilding(M, O, K) {
  building.innerHTML = "";
  const cells = [];

  for (let e = 1; e <= M; e++) {
    const block = document.createElement("div");
    block.className = "entrance";
    block.innerHTML = `<h3>${e}-р орц</h3>`;

    const floors = document.createElement("div");
    floors.className = "floors";
    floors.style.setProperty("--doors", K);

    // Top floor first so floor 1 sits at the bottom, like a real building.
    for (let f = O; f >= 1; f--) {
      const label = document.createElement("span");
      label.className = "floor-label";
      label.textContent = f;
      floors.append(label);

      for (let d = 1; d <= K; d++) {
        const n = (e - 1) * O * K + (f - 1) * K + d;
        const cell = document.createElement("span");
        cell.className = "door";
        cell.textContent = n;
        cell.title = `${e}-р орц, ${f}-р давхар, ${d}-р хаалга`;
        cells[n] = cell;
        floors.append(cell);
      }
    }

    block.append(floors);
    building.append(block);
  }
  return cells;
}

function renderStep(step) {
  const { entrance, floor, door, result, found } = step;

  if (state.prev) state.prev.classList.replace("current", "visited");
  const cell = state.cells[result];
  cell.classList.add(found ? "found" : "current");
  cell.scrollIntoView({ block: "nearest", inline: "nearest" });
  state.prev = found ? null : cell;

  $("vE").textContent = `entrance = ${entrance}`;
  $("vF").textContent = `floor = ${floor}`;
  $("vD").textContent = `door = ${door}`;
  $("vR").textContent = `result = ${result}`;
  $("vC").textContent = found ? `${result} === ${state.N} ✔` : `${result} ≠ ${state.N}`;
  document.querySelector('[data-line="check"]').classList.toggle("hit", found);

  res.className = found ? "success" : "";
  res.textContent = found
    ? `Олдлоо! ${entrance}-р орц, ${floor}-р давхар, ${door}-р хаалга.`
    : `Алхам ${result}: ${entrance}-р орц, ${floor}-р давхар, ${door}-р хаалга`;
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

function start(M, O, K, N) {
  stop();
  state = {
    M, O, K, N,
    steps: walkDoors(M, O, K, N),
    cells: drawBuilding(M, O, K),
    prev: null,
    done: false,
  };

  $("vM").textContent = M;
  $("vO").textContent = O;
  $("vK").textContent = K;
  $("vN").textContent = N;
  for (const id of ["vE", "vF", "vD", "vC"]) $(id).textContent = "–";
  $("vR").textContent = "result = 0";
  document.querySelector('[data-line="check"]').classList.remove("hit");

  playBtn.disabled = stepBtn.disabled = finishBtn.disabled = false;
  res.className = "";
  res.textContent = `Нийт ${M * O * K} хаалга. ${N}-р тоотыг хайж байна…`;
  player.hidden = false;
}

function showError(message) {
  stop();
  player.hidden = true;
  res.className = "error";
  res.textContent = message;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const M = parseNumber($("M").value);
  const O = parseNumber($("O").value);
  const K = parseNumber($("K").value);
  const N = parseNumber($("N").value);

  if (![M, O, K, N].every((x) => Number.isInteger(x) && x > 0)) {
    return showError("Бүх утга 1-ээс их бүхэл тоо байх ёстой.");
  }

  const allDoors = M * O * K;
  if (allDoors > MAX_DOORS) {
    return showError(`Хэт том байна (${allDoors} хаалга). ${MAX_DOORS}-аас бага байлгана уу.`);
  }
  if (N > allDoors) {
    return showError(`Таны хайсан тоот олдсонгүй (нийт ${allDoors} хаалга).`);
  }

  start(M, O, K, N);
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
  if (state) start(state.M, state.O, state.K, state.N);
});
