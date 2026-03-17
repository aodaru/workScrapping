import express from 'express';
import cors from 'cors';
import { jobCache } from './services/cache.js';
import { scrapeJobs } from './services/scraper.js';
import type { JobsResponse } from './types.js';

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'workana-api-key';

app.use(cors());
app.use(express.json());

const authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const providedKey = req.headers['x-api-key'];
  if (!providedKey || providedKey !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/getJobs', async (_req, res) => {
  try {
    const cached = jobCache.get();

    if (cached) {
      console.log('📦 Retornando datos desde cache');
      const response: JobsResponse = {
        data: cached.data,
        cached: true,
        fetchedAt: new Date().toISOString(),
        total: cached.data.length,
      };
      return res.json(response);
    }

    console.log('🔄 Ejecutando scraping...');
    const jobs = await scrapeJobs();
    jobCache.set(jobs);

    const response: JobsResponse = {
      data: jobs,
      cached: false,
      fetchedAt: new Date().toISOString(),
      total: jobs.length,
    };

    res.json(response);
  } catch (error) {
    console.error('❌ Error en /getJobs:', error);
    res.status(500).json({
      error: 'Failed to fetch jobs',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.post('/refresh', authMiddleware, async (_req, res) => {
  try {
    console.log('🔄 Forzando refresh...');
    jobCache.clear();
    const jobs = await scrapeJobs();
    jobCache.set(jobs);

    const response: JobsResponse = {
      data: jobs,
      cached: false,
      fetchedAt: new Date().toISOString(),
      total: jobs.length,
    };

    res.json(response);
  } catch (error) {
    console.error('❌ Error en /refresh:', error);
    res.status(500).json({
      error: 'Failed to refresh jobs',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📋 Endpoints:`);
  console.log(`   GET  /getJobs  - Obtener jobs (usa cache si disponible)`);
  console.log(`   POST /refresh  - Forzar refresh (requiere x-api-key: ${API_KEY})`);
  console.log(`   GET  /health   - Health check`);
});
