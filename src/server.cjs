require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const { context, trace, SpanStatusCode } = require('@opentelemetry/api');

const app = express();
const port = Number(process.env.PORT || 3000);
const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 10
});
const tracer = trace.getTracer('pulsedesk.workflow');

function log(level, message, fields = {}) {
  const activeSpan = trace.getSpan(context.active());
  const spanContext = activeSpan?.spanContext();
  console.log(JSON.stringify({ level, message, time: new Date().toISOString(), trace_id: spanContext?.traceId, span_id: spanContext?.spanId, ...fields }));
}

app.use(express.json());
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => log('info', 'request.complete', { method: req.method, path: req.path, status_code: res.statusCode, duration_ms: Date.now() - startedAt }));
  next();
});
app.use(express.static('public'));

app.get('/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.status(200).json({ status: 'ok' }); }
  catch (error) { log('error', 'health.database_failed', { error: error.message }); res.status(503).json({ status: 'unavailable' }); }
});

app.get('/api/overview', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(`SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE state = 'active')::int AS active,
      COUNT(*) FILTER (WHERE state = 'blocked')::int AS blocked
      FROM work_items`);
    res.json(rows[0]);
  } catch (error) { next(error); }
});

app.get('/api/work-items', async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id, title, owner, state, priority, created_at FROM work_items ORDER BY created_at DESC LIMIT 30');
    res.json(rows);
  } catch (error) { next(error); }
});

app.get('/api/activity', async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id, title, owner, state, created_at FROM work_items ORDER BY created_at DESC LIMIT 20');
    res.json(rows.map(item => ({
      id: item.id,
      message: `Work item created: ${item.title}`,
      owner: item.owner,
      state: item.state,
      created_at: item.created_at
    })));
  } catch (error) { next(error); }
});

app.post('/api/work-items', async (req, res, next) => {
  const { title, owner = 'Unassigned', priority = 'medium' } = req.body;
  if (typeof title !== 'string' || title.trim().length < 3) return res.status(400).json({ error: 'title must contain at least 3 characters' });
  if (!['low', 'medium', 'high'].includes(priority)) return res.status(400).json({ error: 'priority must be low, medium, or high' });

  try {
    await tracer.startActiveSpan('workflow.create_work_item', async (span) => {
      span.setAttribute('app.work_item.priority', priority);
      span.setAttribute('app.work_item.owner', owner);
      try {
        const { rows } = await pool.query(
          'INSERT INTO work_items (title, owner, priority) VALUES ($1, $2, $3) RETURNING id, title, owner, state, priority, created_at',
          [title.trim(), owner.trim().slice(0, 80), priority]
        );
        span.setAttribute('app.work_item.id', rows[0].id);
        res.status(201).json(rows[0]);
      } catch (error) {
        span.recordException(error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
        throw error;
      } finally { span.end(); }
    });
  } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => {
  log('error', 'request.failed', { error: error.message });
  res.status(500).json({ error: 'Unexpected server error' });
});

app.listen(port, () => log('info', 'server.started', { port }));
