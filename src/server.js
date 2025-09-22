import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const scores = new Map();

export function createServer() {
  const app = express();

  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/score', (req, res) => {
    const { userId, score, comboMax, nickname } = req.body || {};

    if (!userId || typeof score !== 'number') {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    const entry = scores.get(userId) || {
      bestScore: 0,
      bestCombo: 0,
      nickname: nickname || 'Безымянный герой'
    };

    entry.bestScore = Math.max(entry.bestScore, Math.round(score));
    entry.bestCombo = Math.max(entry.bestCombo, Math.round(comboMax || 0));
    entry.nickname = nickname || entry.nickname;

    scores.set(userId, entry);

    res.json({ ok: true, leaderboard: getLeaderboard() });
  });

  app.get('/score/top', (_req, res) => {
    res.json({ leaderboard: getLeaderboard() });
  });

  return app;
}

function getLeaderboard() {
  return Array.from(scores.entries())
    .map(([userId, entry]) => ({ userId, ...entry }))
    .sort((a, b) => b.bestScore - a.bestScore)
    .slice(0, 10);
}
