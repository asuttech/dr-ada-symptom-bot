// Simple in-memory session store, keyed by WhatsApp JID.
// Good enough for a hackathon demo. Swap for Redis/DB if you take this further —
// in-memory state disappears on every restart and won't scale past one process.

const sessions = new Map();

function getSession(jid) {
  if (!sessions.has(jid)) {
    sessions.set(jid, { history: [], turnCount: 0 });
  }
  return sessions.get(jid);
}

function updateSession(jid, session) {
  sessions.set(jid, session);
}

function resetSession(jid) {
  sessions.delete(jid);
}

// --- Per-user message queue ---
//
// Without this, two quick messages from the SAME user race each other:
// both read the session before either finishes writing back to it, so the
// second message's text can get appended to history before the first
// message's AI reply does — scrambling the conversation order sent to
// Gemini. This chains each user's async work onto a per-JID promise so
// their messages are always handled strictly one at a time, in order.
//
// Different users are unaffected by this and still run fully in parallel —
// each JID gets its own independent chain.
const queues = new Map();

function runInOrder(jid, asyncFn) {
  const previous = queues.get(jid) || Promise.resolve();
  // .catch here prevents one failed message from permanently jamming a
  // user's queue — the chain continues regardless of whether the previous
  // call succeeded or threw.
  const next = previous.catch(() => {}).then(asyncFn);
  queues.set(jid, next);
  return next;
}

module.exports = { getSession, updateSession, resetSession, runInOrder };
