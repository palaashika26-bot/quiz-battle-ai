// ================================================
// script.js — QuizBattle AI
// Works on BOTH XAMPP (local) and Render (online)!
// ================================================

// ── 1. GAME STATE ─────────────────────────────────
const state = {
  p1name:      'Player 1',
  p2name:      'Player 2',
  topic:       '',
  qCount:      10,
  questions:   [],
  currentQ:    0,
  currentTurn: 1,
  scores:      { 1: 0, 2: 0 },
  streaks:     { 1: 0, 2: 0 },
  correct:     { 1: 0, 2: 0 },
  timer:       null,
  timeLeft:    15,
  totalTime:   15,
  answered:    false,
};

// ── 2. API ENDPOINT DETECTION ─────────────────────
// Automatically detects if running on XAMPP or Render
// On XAMPP (localhost) → calls api.php
// On Render (online)   → calls /api (Flask)
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'api.php'   // XAMPP local
  : '/api';     // Render online

// ── 3. SETUP FUNCTIONS ────────────────────────────
function setTopic(t) {
  document.getElementById('topicInput').value = t;
}

function setQCount(n, btn) {
  state.qCount = n;
  document.querySelectorAll('.q-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ── 4. START GAME ─────────────────────────────────
async function startGame() {
  const p1    = document.getElementById('p1name').value.trim() || 'Player 1';
  const p2    = document.getElementById('p2name').value.trim() || 'Player 2';
  const topic = document.getElementById('topicInput').value.trim();

  if (!topic) { alert('Please enter a topic!'); return; }

  state.p1name      = p1;
  state.p2name      = p2;
  state.topic       = topic;
  state.scores      = { 1: 0, 2: 0 };
  state.streaks     = { 1: 0, 2: 0 };
  state.correct     = { 1: 0, 2: 0 };
  state.currentQ    = 0;
  state.currentTurn = 1;

  showPage('loadingPage');
  document.getElementById('loadingTopic').textContent = '⚡ Topic: ' + topic;

  // Animate loading bar
  let pct = 0;
  const msgs = [
    'Initialising AI engine...',
    'Crafting questions...',
    'Setting difficulty...',
    'Building answer choices...',
    'Preparing battle arena...'
  ];
  const barInterval = setInterval(() => {
    pct = Math.min(pct + Math.random() * 6, 88);
    document.getElementById('loadingBar').style.width = pct + '%';
    document.getElementById('loadingStatus').textContent = msgs[Math.floor(pct / 20)] || msgs[4];
  }, 200);

  try {
    const questions = await getQuestions(topic, state.qCount);
    clearInterval(barInterval);
    document.getElementById('loadingBar').style.width = '100%';
    document.getElementById('loadingStatus').textContent = 'Ready! Let the battle begin...';
    await sleep(500);
    state.questions = questions;
    initGame();
  } catch (e) {
    clearInterval(barInterval);
    alert('Error: ' + e.message);
    showPage('setupPage');
  }
}

// ── 5. CALL API (works on XAMPP and Render) ───────
async function getQuestions(topic, count) {

  // Build form data
  const formData = new FormData();
  formData.append('topic', topic);
  formData.append('count', count);

  // Call either api.php or /api depending on where we are
  const response = await fetch(API_URL, {
    method: 'POST',
    body:   formData
  });

  if (!response.ok) {
  let msg = 'Server error (' + response.status + ')';
  try {
    const err = await response.json();
    if (err.error) msg = err.error;
  } catch (e) {}
  throw new Error(msg);
}

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error);
  }

  if (!data.questions || data.questions.length === 0) {
    throw new Error('No questions received from AI.');
  }

  return data.questions;
}

// ── 6. GAME INITIALISER ───────────────────────────
function initGame() {
  document.getElementById('p1label').textContent = state.p1name.toUpperCase();
  document.getElementById('p2label').textContent = state.p2name.toUpperCase();
  showPage('gamePage');
  showQuestion();
}

// ── 7. SHOW QUESTION ──────────────────────────────
function showQuestion() {
  const q        = state.questions[state.currentQ];
  state.answered = false;
  const isP1Turn = state.currentTurn === 1;

  document.getElementById('p1score').textContent   = state.scores[1];
  document.getElementById('p2score').textContent   = state.scores[2];
  document.getElementById('qProgress').textContent = 'Q ' + (state.currentQ + 1) + ' / ' + state.questions.length;
  document.getElementById('qNumber').textContent   = 'QUESTION ' + (state.currentQ + 1) + ' OF ' + state.questions.length;
  document.getElementById('qText').textContent     = q.question;

  updateStreakDisplay();

  const badge     = document.getElementById('turnBadge');
  badge.className = 'turn-badge ' + (isP1Turn ? 't1' : 't2');
  document.getElementById('turnText').textContent  =
    (isP1Turn ? state.p1name : state.p2name).toUpperCase() + "'S TURN";

  const grid     = document.getElementById('optionsGrid');
  grid.innerHTML = '';
  const letters  = ['A', 'B', 'C', 'D'];

  q.options.forEach((opt, i) => {
    const btn     = document.createElement('button');
    btn.className = 'opt-btn';
    btn.innerHTML = '<span class="opt-letter">' + letters[i] + '</span><span>' + opt + '</span>';
    btn.onclick   = () => answer(i, q.correct, btn);
    grid.appendChild(btn);
  });

  startTimer();
}

// ── 8. TIMER ──────────────────────────────────────
function startTimer() {
  clearInterval(state.timer);
  state.timeLeft = state.totalTime;
  updateTimerUI();

  state.timer = setInterval(() => {
    state.timeLeft--;
    updateTimerUI();
    if (state.timeLeft <= 0) {
      clearInterval(state.timer);
      if (!state.answered) timeOut();
    }
  }, 1000);
}

function updateTimerUI() {
  const pct  = (state.timeLeft / state.totalTime) * 100;
  const fill = document.getElementById('timerFill');
  fill.style.width      = pct + '%';
  fill.style.background = pct > 50
    ? 'linear-gradient(90deg, #00f5ff, #00ff88)'
    : pct > 25
    ? 'linear-gradient(90deg, #ffd700, #ff8c00)'
    : 'linear-gradient(90deg, #ff4444, #ff6b6b)';
  document.getElementById('timerNum').textContent = state.timeLeft + 's';
}

function timeOut() {
  state.answered = true;
  const q = state.questions[state.currentQ];
  disableOptions(q.correct, -1);
  state.streaks[state.currentTurn] = 0;
  updateStreakDisplay();
  showFlash('⏰', "TIME'S UP!", 'No points awarded', false);
  setTimeout(nextQuestion, 2200);
}

// ── 9. ANSWER HANDLER ─────────────────────────────
function answer(chosen, correct, btn) {
  if (state.answered) return;
  state.answered = true;
  clearInterval(state.timer);

  const player      = state.currentTurn;
  const isCorrect   = chosen === correct;
  const timeBonus   = Math.floor(state.timeLeft * 5);
  const streakBonus = state.streaks[player] >= 2 ? 50 : 0;
  const points      = isCorrect ? 100 + timeBonus + streakBonus : 0;

  if (isCorrect) {
    state.scores[player]  += points;
    state.streaks[player]++;
    state.correct[player]++;
    btn.classList.add('correct');

    const scoreEl = document.getElementById('p' + player + 'score');
    scoreEl.textContent = state.scores[player];
    scoreEl.classList.add('score-anim');
    setTimeout(() => scoreEl.classList.remove('score-anim'), 400);

    const msg = state.streaks[player] >= 3 ? '🔥 ON FIRE!'
              : state.streaks[player] >= 2 ? '⚡ COMBO!'
              : '✅ CORRECT!';
    showFlash('🎯', msg, '+' + points + ' pts' + (streakBonus ? ' (STREAK BONUS!)' : ''), true);

  } else {
    state.streaks[player] = 0;
    btn.classList.add('wrong');
    const grid = document.getElementById('optionsGrid');
    grid.style.animation = 'shake 0.4s';
    setTimeout(() => grid.style.animation = '', 400);
    showFlash('💥', 'WRONG!', 'Better luck next time', false);
  }

  updateStreakDisplay();
  disableOptions(correct, chosen);
  setTimeout(nextQuestion, 2200);
}

function disableOptions(correct, chosen) {
  document.querySelectorAll('.opt-btn').forEach((btn, i) => {
    btn.disabled = true;
    if (i === correct && i !== chosen) btn.classList.add('correct');
    if (i !== correct && i !== chosen) btn.classList.add('disabled-fade');
  });
}

// ── 10. NEXT QUESTION ─────────────────────────────
function nextQuestion() {
  document.getElementById('resultFlash').classList.remove('show', 'correct-flash', 'wrong-flash');
  state.currentQ++;
  if (state.currentQ >= state.questions.length) { showResults(); return; }
  state.currentTurn = state.currentTurn === 1 ? 2 : 1;
  showQuestion();
}

// ── 11. RESULTS ───────────────────────────────────
function showResults() {
  const s1     = state.scores[1];
  const s2     = state.scores[2];
  const winner = s1 > s2 ? 1 : s2 > s1 ? 2 : 0;

  document.getElementById('tieBanner').style.display = winner === 0 ? 'block' : 'none';

  if (winner === 0) {
    document.getElementById('resultsTitle').textContent = '🤝 TIE GAME!';
    document.getElementById('resultsSub').textContent   = 'Equally matched warriors!';
  } else {
    const winnerName = winner === 1 ? state.p1name : state.p2name;
    document.getElementById('resultsTitle').textContent = '🏆 ' + winnerName.toUpperCase() + ' WINS!';
    document.getElementById('resultsSub').textContent   = 'What a battle! Check the final scores.';
    spawnConfetti();
  }

  const grid = document.getElementById('resultsGrid');
  grid.innerHTML =
    '<div class="result-card p1card ' + (winner === 1 ? 'winner' : 'loser') + '">' +
      (winner === 1 ? '<div class="winner-crown">👑</div>' : '') +
      '<div class="result-name">' + state.p1name + '</div>' +
      '<div class="result-score-big">' + s1 + '</div>' +
      '<div class="result-stats">' +
        '<div>Correct: <span>' + state.correct[1] + ' / ' + state.questions.length + '</span></div>' +
        '<div>Accuracy: <span>' + Math.round(state.correct[1] / state.questions.length * 100) + '%</span></div>' +
      '</div>' +
    '</div>' +
    '<div class="result-card p2card ' + (winner === 2 ? 'winner' : 'loser') + '">' +
      (winner === 2 ? '<div class="winner-crown">👑</div>' : '') +
      '<div class="result-name">' + state.p2name + '</div>' +
      '<div class="result-score-big">' + s2 + '</div>' +
      '<div class="result-stats">' +
        '<div>Correct: <span>' + state.correct[2] + ' / ' + state.questions.length + '</span></div>' +
        '<div>Accuracy: <span>' + Math.round(state.correct[2] / state.questions.length * 100) + '%</span></div>' +
      '</div>' +
    '</div>';

  showPage('resultsPage');
}

function playAgain() {
  state.scores      = { 1: 0, 2: 0 };
  state.streaks     = { 1: 0, 2: 0 };
  state.correct     = { 1: 0, 2: 0 };
  state.currentQ    = 0;
  state.currentTurn = 1;
  initGame();
}

function changeTopic() {
  clearInterval(state.timer);
  showPage('setupPage');
}

// ── 12. HELPER FUNCTIONS ──────────────────────────
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showFlash(emoji, text, sub, isCorrect) {
  const el = document.getElementById('resultFlash');
  document.getElementById('flashEmoji').textContent  = emoji;
  document.getElementById('flashText').textContent   = text;
  document.getElementById('flashPoints').textContent = sub;
  el.className = 'result-flash show ' + (isCorrect ? 'correct-flash' : 'wrong-flash');
}

function updateStreakDisplay() {
  [1, 2].forEach(p => {
    const s  = state.streaks[p];
    const el = document.getElementById('p' + p + 'streak');
    if      (s >= 3)  el.textContent = '🔥 ' + s + 'x FIRE STREAK!';
    else if (s >= 2)  el.textContent = '⚡ ' + s + 'x Combo';
    else if (s === 1) el.textContent = '✓ 1 Correct';
    else              el.textContent = '—';
  });
}

function spawnConfetti() {
  const colors = ['#00f5ff','#ff4d8d','#ffd700','#00ff88','#7b61ff'];
  for (let i = 0; i < 60; i++) {
    setTimeout(() => {
      const el     = document.createElement('div');
      el.className = 'confetti-piece';
      el.style.cssText =
        'left:'               + (Math.random() * 100)                             + 'vw;' +
        'background:'         + colors[Math.floor(Math.random() * colors.length)] + ';' +
        'border-radius:'      + (Math.random() > 0.5 ? '50%' : '2px')            + ';' +
        'width:'              + (6 + Math.random() * 8)                           + 'px;' +
        'height:'             + (6 + Math.random() * 8)                           + 'px;' +
        'animation-duration:' + (2 + Math.random() * 2)                           + 's;' +
        'animation-delay:'    + (Math.random())                                   + 's;';
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 4000);
    }, i * 30);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
