const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startButton = document.getElementById('startButton');
const scoreEl = document.getElementById('score');
const comboEl = document.getElementById('combo');
const bestEl = document.getElementById('best');
const comboBanner = document.getElementById('comboBanner');
const leaderboardBox = document.getElementById('leaderboard');

const telegram = window.Telegram?.WebApp;
if (telegram) {
  telegram.ready();
  telegram.expand();
  telegram.enableClosingConfirmation();
}

const groundY = canvas.height - 64;
const gravity = 1800;
const jumpForce = 680;

const player = {
  x: 120,
  y: groundY,
  width: 46,
  height: 58,
  velocityY: 0,
  jumping: false,
  doubleJumpAvailable: true,
  glowPhase: 0
};

const state = {
  running: false,
  score: 0,
  bestScore: Number(localStorage.getItem('cosmo-best-score') || 0),
  combo: 1,
  comboTimer: 0,
  maxCombo: 1,
  speed: 320,
  obstacleTimer: 0,
  backgroundOffset: 0,
  portalPulse: 0,
  lastTimestamp: 0,
  leaderboard: []
};

function roundRectPath(context, x, y, width, height, radius) {
  let r = radius;
  if (width < 2 * r) r = width / 2;
  if (height < 2 * r) r = height / 2;
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

let userId = telegram?.initDataUnsafe?.user?.id || null;
let nickname =
  telegram?.initDataUnsafe?.user?.username ||
  [telegram?.initDataUnsafe?.user?.first_name, telegram?.initDataUnsafe?.user?.last_name]
    .filter(Boolean)
    .join(' ');

let tonConnectUI;
if (window.TON_CONNECT_UI) {
  tonConnectUI = new window.TON_CONNECT_UI.TonConnectUI({
    manifestUrl: `${window.location.origin}/tonconnect-manifest.json`,
    buttonRootId: 'ton-connect',
    actionsConfiguration: {
      twaReturnUrl: window.location.href
    }
  });

  tonConnectUI.onStatusChange((wallet) => {
    if (wallet?.account?.address) {
      nickname = `@${wallet.account.address.slice(0, 6)}…${wallet.account.address.slice(-4)}`;
    }
  });
}

function resetGame() {
  state.running = true;
  state.score = 0;
  state.combo = 1;
  state.comboTimer = 0;
  state.maxCombo = 1;
  state.speed = 320;
  state.obstacleTimer = 0;
  state.backgroundOffset = 0;
  state.portalPulse = 0;
  state.lastTimestamp = performance.now();
  obstacles.length = 0;
  particles.length = 0;
  player.y = groundY;
  player.velocityY = 0;
  player.jumping = false;
  player.doubleJumpAvailable = true;
  hideComboBanner();
  hideLeaderboard();
}

const obstacles = [];
const particles = [];

function spawnObstacle() {
  const sizeVariants = [
    { width: 32, height: 60, type: 'cactus' },
    { width: 28, height: 70, type: 'crystal' },
    { width: 42, height: 48, type: 'tree' },
    { width: 36, height: 56, type: 'portal' }
  ];
  const variant = sizeVariants[Math.floor(Math.random() * sizeVariants.length)];
  obstacles.push({
    x: canvas.width + Math.random() * 120,
    width: variant.width,
    height: variant.height,
    type: variant.type,
    passed: false
  });
}

function updateObstacles(delta) {
  state.obstacleTimer -= delta;
  if (state.obstacleTimer <= 0) {
    spawnObstacle();
    state.obstacleTimer = Math.max(0.7, 1.8 - state.speed / 420);
  }

  for (const obstacle of obstacles) {
    obstacle.x -= state.speed * delta;

    if (!obstacle.passed && obstacle.x + obstacle.width < player.x) {
      obstacle.passed = true;
      state.combo += 1;
      state.comboTimer = 2.6;
      state.maxCombo = Math.max(state.maxCombo, state.combo);
      state.portalPulse = 1;
      showComboBanner();
    }
  }

  const alive = obstacles.filter((o) => o.x + o.width > -60);
  obstacles.length = 0;
  obstacles.push(...alive);
}

function updatePlayer(delta) {
  player.velocityY += gravity * delta;
  player.y += player.velocityY * delta;

  if (player.y >= groundY) {
    player.y = groundY;
    player.velocityY = 0;
    player.jumping = false;
    player.doubleJumpAvailable = true;
  }

  player.glowPhase += delta * 3;
}

function updateState(delta) {
  state.speed += delta * 12;
  state.score += state.speed * delta * 0.18;
  state.backgroundOffset = (state.backgroundOffset + state.speed * delta * 0.12) % canvas.width;
  state.portalPulse = Math.max(0, state.portalPulse - delta * 2.4);

  if (state.combo > 1) {
    state.comboTimer -= delta;
    if (state.comboTimer <= 0) {
      state.combo = 1;
      hideComboBanner();
    }
  }
}

function detectCollisions() {
  for (const obstacle of obstacles) {
    const top = groundY - obstacle.height;
    if (
      player.x < obstacle.x + obstacle.width - 6 &&
      player.x + player.width - 6 > obstacle.x &&
      player.y > top + 6
    ) {
      endGame();
      break;
    }
  }
}

function updateParticles(delta) {
  for (const particle of particles) {
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.life -= delta;
  }
  const alive = particles.filter((p) => p.life > 0);
  particles.length = 0;
  particles.push(...alive);
}

function drawBackground() {
  ctx.fillStyle = '#0d1024';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#141b40');
  gradient.addColorStop(1, '#050714');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawParallaxLayer('#1f2246', 0.2, 80);
  drawParallaxLayer('#262a56', 0.4, 48);
  drawParallaxLayer('#2e346d', 0.6, 32);

  ctx.strokeStyle = 'rgba(123, 91, 255, 0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, groundY + 6);
  ctx.lineTo(canvas.width, groundY + 4);
  ctx.stroke();
}

function drawParallaxLayer(color, speedFactor, amplitude) {
  ctx.fillStyle = color;
  const offset = state.backgroundOffset * speedFactor;
  for (let x = -offset; x < canvas.width + 120; x += 120) {
    ctx.beginPath();
    ctx.moveTo(x, groundY + 8);
    ctx.lineTo(x + 60, groundY - amplitude * 0.4);
    ctx.lineTo(x + 120, groundY + 8);
    ctx.closePath();
    ctx.fill();
  }
}

function drawPlayer() {
  const glow = (Math.sin(player.glowPhase) + 1) * 0.5;
  const top = player.y - player.height;
  const gradient = ctx.createLinearGradient(player.x, top, player.x, top + player.height);
  gradient.addColorStop(0, `rgba(54, 231, 255, ${0.5 + glow * 0.4})`);
  gradient.addColorStop(1, `rgba(123, 91, 255, ${0.6 + glow * 0.3})`);
  ctx.fillStyle = gradient;
  roundRectPath(ctx, player.x, top, player.width, player.height, 16);
  ctx.fill();

  ctx.fillStyle = 'rgba(8, 10, 30, 0.9)';
  ctx.fillRect(player.x + 8, top + 14, 10, 10);
  ctx.fillRect(player.x + 26, top + 14, 10, 10);

  ctx.strokeStyle = `rgba(54, 231, 255, ${0.35 + glow * 0.3})`;
  ctx.lineWidth = 3;
  roundRectPath(ctx, player.x - 6, top - 6, player.width + 12, player.height + 12, 20);
  ctx.stroke();
}

function drawObstacle(obstacle) {
  const x = obstacle.x;
  const baseY = groundY;
  const height = obstacle.height;
  const width = obstacle.width;

  switch (obstacle.type) {
    case 'crystal':
      drawCrystal(x, baseY, width, height);
      break;
    case 'tree':
      drawTree(x, baseY, width, height);
      break;
    case 'portal':
      drawPortal(x, baseY, width, height);
      break;
    default:
      drawCactus(x, baseY, width, height);
  }
}

function drawCactus(x, baseY, width, height) {
  ctx.fillStyle = 'rgba(102, 255, 163, 0.9)';
  roundRectPath(ctx, x, baseY - height, width, height, 12);
  ctx.fill();

  ctx.fillStyle = 'rgba(29, 210, 154, 0.8)';
  roundRectPath(
    ctx,
    x + width * 0.2,
    baseY - height * 0.7,
    width * 0.25,
    height * 0.6,
    10
  );
  ctx.fill();
  roundRectPath(
    ctx,
    x + width * 0.55,
    baseY - height * 0.55,
    width * 0.22,
    height * 0.45,
    10
  );
  ctx.fill();
}

function drawTree(x, baseY, width, height) {
  ctx.fillStyle = 'rgba(255, 115, 175, 0.9)';
  ctx.beginPath();
  ctx.moveTo(x + width / 2, baseY - height);
  ctx.lineTo(x + width, baseY);
  ctx.lineTo(x, baseY);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(96, 64, 128, 0.8)';
  ctx.fillRect(x + width * 0.42, baseY - height * 0.4, width * 0.16, height * 0.4);
}

function drawCrystal(x, baseY, width, height) {
  ctx.fillStyle = 'rgba(54, 231, 255, 0.85)';
  ctx.beginPath();
  ctx.moveTo(x + width / 2, baseY - height);
  ctx.lineTo(x + width, baseY - height * 0.4);
  ctx.lineTo(x + width * 0.7, baseY);
  ctx.lineTo(x + width * 0.3, baseY);
  ctx.lineTo(x, baseY - height * 0.4);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(11, 211, 255, 0.7)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawPortal(x, baseY, width, height) {
  const pulse = 0.3 + state.portalPulse * 0.4;
  const innerRadius = width * 0.35;
  const outerRadius = width * (0.7 + pulse * 0.3);
  const centerX = x + width / 2;
  const centerY = baseY - height / 2;

  const gradient = ctx.createRadialGradient(centerX, centerY, innerRadius, centerX, centerY, outerRadius);
  gradient.addColorStop(0, `rgba(123, 91, 255, ${0.8 + pulse * 0.2})`);
  gradient.addColorStop(1, 'rgba(54, 231, 255, 0.1)');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, outerRadius, height / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `rgba(54, 231, 255, ${0.4 + pulse * 0.4})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, outerRadius * 0.7, height * 0.35, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawParticles() {
  for (const particle of particles) {
    ctx.fillStyle = `rgba(54, 231, 255, ${particle.life})`;
    ctx.fillRect(particle.x, particle.y, 3, 3);
  }
}

function spawnTrail() {
  particles.push({
    x: player.x - 6,
    y: player.y - player.height / 2,
    vx: -120,
    vy: 40 * (Math.random() - 0.5),
    life: 0.6
  });
}

function showComboBanner() {
  if (state.combo < 2) {
    hideComboBanner();
    return;
  }
  comboBanner.classList.remove('hidden');
  const messages = [
    'x2 Скорость!',
    'x3 Плазменный поток!',
    'x4 Космическое безумие!',
    'x5 Нейрофьюжн!',
    'x6+ Ультра комбо!'
  ];
  const index = Math.min(messages.length - 1, state.combo - 2);
  comboBanner.textContent = `${messages[index]} (${state.combo})`;
}

function hideComboBanner() {
  comboBanner.classList.add('hidden');
}

function updateStats() {
  scoreEl.textContent = Math.round(state.score);
  comboEl.textContent = `x${state.combo}`;
  bestEl.textContent = state.bestScore;
}

function showLeaderboard() {
  if (!state.leaderboard.length) {
    leaderboardBox.classList.add('hidden');
    return;
  }
  leaderboardBox.classList.remove('hidden');
  const items = state.leaderboard
    .map(
      (entry, idx) =>
        `<li><span>${idx + 1}. ${entry.nickname || `Пилот #${idx + 1}`}</span><span>${entry.bestScore}</span></li>`
    )
    .join('');
  leaderboardBox.innerHTML = `<h3>ТОП ПИЛОТОВ</h3><ul>${items}</ul>`;
}

function hideLeaderboard() {
  leaderboardBox.classList.add('hidden');
}

function gameLoop(timestamp) {
  if (!state.running) return;
  const delta = Math.min(0.035, (timestamp - state.lastTimestamp) / 1000);
  state.lastTimestamp = timestamp;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  updateState(delta);
  updateObstacles(delta);
  updatePlayer(delta);
  updateParticles(delta);
  detectCollisions();
  spawnTrail();

  drawBackground();
  for (const obstacle of obstacles) {
    drawObstacle(obstacle);
  }
  drawParticles();
  drawPlayer();

  updateStats();

  requestAnimationFrame(gameLoop);
}

function startGame() {
  telegram?.MainButton?.hide();
  resetGame();
  state.lastTimestamp = performance.now();
  requestAnimationFrame(gameLoop);
}

function endGame() {
  if (!state.running) return;
  state.running = false;
  hideComboBanner();
  state.bestScore = Math.max(state.bestScore, Math.round(state.score));
  localStorage.setItem('cosmo-best-score', state.bestScore);
  updateStats();
  pushScore();
  fetchLeaderboard().then(() => {
    showLeaderboard();
  });

  const data = JSON.stringify({
    type: 'score',
    score: Math.round(state.score),
    comboMax: state.maxCombo
  });
  telegram?.sendData?.(data);

  if (telegram?.HapticFeedback) {
    telegram.HapticFeedback.notificationOccurred('error');
  }

  if (telegram?.MainButton) {
    telegram.MainButton.setText('Еще один забег');
    telegram.MainButton.show();
  }
}

function jump() {
  if (!state.running) return;
  if (!player.jumping) {
    player.velocityY = -jumpForce;
    player.jumping = true;
    player.doubleJumpAvailable = true;
    emitJumpEffect();
  } else if (player.doubleJumpAvailable) {
    player.velocityY = -jumpForce * 0.85;
    player.doubleJumpAvailable = false;
    emitJumpEffect(true);
  }
}

function emitJumpEffect(doubleJump = false) {
  if (telegram?.HapticFeedback) {
    telegram.HapticFeedback.impactOccurred(doubleJump ? 'soft' : 'light');
  }
  for (let i = 0; i < 14; i++) {
    particles.push({
      x: player.x + player.width / 2,
      y: player.y - player.height / 3,
      vx: (Math.random() - 0.5) * 280,
      vy: -Math.random() * 360,
      life: 0.4 + Math.random() * 0.2
    });
  }
}

startButton.addEventListener('click', startGame);
canvas.addEventListener('pointerdown', () => {
  if (!state.running) {
    startGame();
  } else {
    jump();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.code === 'Space' || event.code === 'ArrowUp') {
    event.preventDefault();
    if (!state.running) {
      startGame();
    } else {
      jump();
    }
  }
});

if (telegram?.MainButton) {
  telegram.MainButton.onClick(() => {
    startGame();
  });
}

async function pushScore() {
  if (!userId) return;
  try {
    const response = await fetch('/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        score: Math.round(state.score),
        comboMax: state.maxCombo,
        nickname: nickname || 'Гость'
      })
    });
    const result = await response.json();
    if (result.leaderboard) {
      state.leaderboard = result.leaderboard;
    }
  } catch (error) {
    console.error('Failed to push score', error);
  }
}

async function fetchLeaderboard() {
  try {
    const response = await fetch('/score/top');
    const result = await response.json();
    state.leaderboard = result.leaderboard || [];
  } catch (error) {
    console.error('Failed to load leaderboard', error);
  }
}

fetchLeaderboard().then(() => {
  showLeaderboard();
});

updateStats();
