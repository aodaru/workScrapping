import express from 'express';
import cors from 'cors';
import { jobCache } from './services/cache.ts';
import { scraperWorkana } from './services/scraperWorkana.ts';
import type { JobsResponse } from './types.ts';

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || 'workana-api-key';

const corsOptions = {
  origin: [
    'localhost',
    'https://teapartyn8n.duckdns.org/'
  ]
}

app.use(cors(corsOptions));
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

app.get('/listworkana', authMiddleware, async (_req, res) => {
  try {
    const cached = jobCache.get();
    
    console.log('🔄 Ejecutando scraping...');
    const jobs = await scraperWorkana();

    // modificar esta parte
    if (cached) {
      const dataCached = cached.data

      console.log(`cantidad de cache ${dataCached.length}`);

      const cachedIndex = dataCached.reduce((acc, cache) => {
        const id = cache.id 

        if(!acc[id]) {
          acc[id] = []
        }

        acc[id].push(cache)

        return acc
      }, {} as Record<string, Project[]>)

      const jobsFilter = jobs.filter(job => !cachedIndex[job.id]) 

      const response: JobsResponse = {
        data: jobsFilter,
        cached: false,
        fetchedAt: new Date().toISOString(),
        total: jobs.length,
      };

      res.json(response);
      jobCache.set(jobsFilter);
    }else{
      jobCache.set(jobs);

      // esto debe devolver los trabajos filtrados
      const response: JobsResponse = {
        data: jobs,
        cached: false,
        fetchedAt: new Date().toISOString(),
        total: jobs.length,
      };

      res.json(response);
    }
  } catch (error) {
    console.error('❌ Error en /listworkana:', error);
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
    const jobs = await scraperWorkana();
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
