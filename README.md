# Work Scrapping API

API para extraer y filtrar ofertas de trabajo desde múltiples plataformas de freelancing.

## Características

- Scraping automatizado con Playwright
- Filtros configurables por sitio (categorías, habilidades, fecha, presupuesto)
- Soporte multiidioma
- Cache en memoria con TTL configurable
- Autenticación por API Key para endpoints protegidos
- Servidor Express con CORS habilitado

## Tech Stack

- **Runtime**: Node.js >=20
- **Lenguaje**: TypeScript
- **Servidor**: Express.js
- **Scraping**: Playwright (Firefox)
- **Testing**: Playwright Test

## Instalación

```bash
npm install
```

## Configuración

| Variable | Default | Descripción |
|----------|---------|-------------|
| PORT | 3000 | Puerto del servidor |
| API_KEY | workana-api-key | Key para endpoints protegidos |

## Uso

### Desarrollo

```bash
npm run dev
```

### Producción

```bash
npm run build
npm start
```

## Estructura del Proyecto

```
src/
├── server.ts          # Servidor Express y endpoints
├── services/
│   ├── scraper.ts     # Lógica de scraping
│   └── cache.ts       # Cache en memoria
├── types.ts           # TypeScript interfaces
└── index.ts          # Entry point (si aplica)
```

## API Endpoints

### GET /health

Health check del servidor.

**Respuesta:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### GET /getJobs

Obtiene las ofertas de trabajo. Usa cache si está disponible.

**Respuesta:**
```json
{
  "data": [
    {
      "id": "proj_1_123456789",
      "title": "Desarrollador Web Full Stack",
      "description": "Descripción del proyecto...",
      "budget": "USD 500-1000",
      "skills": ["React", "Node.js", "TypeScript"],
      "url": "https://www.workana.com/job/123",
      "postedDate": "2 días atrás",
      "extractedAt": "2024-01-01T00:00:00.000Z",
      "paymentVerified": true,
      "language": "es"
    }
  ],
  "cached": false,
  "fetchedAt": "2024-01-01T00:00:00.000Z",
  "total": 10
}
```

### POST /refresh

Fuerza una nueva extracción de datos. Requiere autenticación.

**Headers:**
```
x-api-key: <API_KEY>
```

**Respuesta:** Mismo formato que `/getJobs`

## Agregar Nuevos Sitios

Para agregar un nuevo sitio de scrapping:

1. Crear un nuevo scraper en `src/services/scrapers/`
2. Implementar la función principal de scraping
3. Agregar las rutas corresponding en `server.ts`
4. Los filtros y estructura de datos deben seguir el formato de `types.ts`

### Estructura de un Proyecto

```typescript
interface Project {
  id: string;
  title: string;
  description: string;
  budget: string;
  skills: string[];
  url: string;
  postedDate: string;
  extractedAt: string;
  paymentVerified: boolean;
  language: 'es' | 'en';
}
```

## Testing

```bash
npx playwright test
```

Los tests generan:
- Screenshots de las páginas scrapeadas
- Archivos JSON con los proyectos extraídos

## Licencia

ISC License

Copyright (c) 2024 Adal Garcia

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
