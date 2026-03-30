import { firefox, type Browser, type Page } from 'playwright';
import type { Project } from '../types.js';

const BASE_FILTERS = {
  category: 'it-programming',
  publication: '3d',
  client_history: '1',
};

const LANGUAGE_FILTERS = {
  es: {
    ...BASE_FILTERS,
    language: 'es'
  },
  en: {
    ...BASE_FILTERS,
    language: 'en'
  },
};

function buildUrl(baseUrl: string, filters: Record<string, string>): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value && value.trim() !== '') {
      params.append(key, value);
    }
  });
  const queryString = params.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

// Función auxiliar LOCAL (dentro del evaluate)
function formatPanamaDate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Panama',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).format(date).replace(',', '');
}

function parseRelativeDate(text: string): string {
  const now = new Date();
  const ms = 60 * 1000;
  const hs = 60 * ms;
  const ds = 24 * hs;
  
  // MINUTOS
  const matchMinutesEs = text.match(/hace\s*(\d+)\s*minuto/i);
  const matchMinutesEn = text.match(/(\d+)\s*minutes?\s*ago/i);
  
  // HORAS
  const matchHoursEs = text.match(/hace\s*(\d+)\s*hora/i);
  const matchHoursEn = text.match(/(\d+)\s*hours?\s*ago/i);
  const matchHourGeneric = text.match(/(?:hora|an?\s*hour)/i);
  
  // DÍAS
  const matchDaysEs = text.match(/hace\s*(\d+)\s*d[ií]a/i);
  const matchDaysEn = text.match(/(\d+)\s*days?\s*ago/i);
  
  // SEMANAS
  const matchWeeksEs = text.match(/hace\s*(\d+)\s*semana/i);
  const matchWeeksEn = text.match(/(\d+)\s*weeks?\s*ago/i);
  
  // AYER / YESTERDAY
  const matchYesterday = text.match(/(?:ayer|yesterday)/i);
  
  // INSTANTE / JUST NOW
  const matchInstant = text.match(/(?:instante|just\s*now)/i);
  
  // Verificar con alternativa (ES o EN)
  const minutes = matchMinutesEs?.[1] || matchMinutesEn?.[1];
  const hours = matchHoursEs?.[1] || matchHoursEn?.[1];
  const days = matchDaysEs?.[1] || matchDaysEn?.[1];
  const weeks = matchWeeksEs?.[1] || matchWeeksEn?.[1];
  
  if (matchInstant) return formatPanamaDate(now);
  if (minutes) return formatPanamaDate(new Date(now.getTime() - parseInt(minutes) * ms));
  if (hours) return formatPanamaDate(new Date(now.getTime() - parseInt(hours) * hs));
  if (matchHourGeneric) return formatPanamaDate(new Date(now.getTime() - hs));
  if (days) return formatPanamaDate(new Date(now.getTime() - parseInt(days) * ds));
  if (matchYesterday) return formatPanamaDate(new Date(now.getTime() - ds));
  if (weeks) return formatPanamaDate(new Date(now.getTime() - parseInt(weeks) * 7 * ds));
  
  return text;
}

function parseDate(dateStr: string): Date {
  // Formato actual: "2026-03-28 15:15:51"
  const [datePart, timePart] = dateStr.split(' ');
  const [year, month, day] = datePart.split('-');
  const [hour, minute, second] = timePart.split(':');
  
  return new Date(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    parseInt(hour),
    parseInt(minute),
    parseInt(second)
  );
}

async function extractProjectsFromList(page: Page): Promise<Project[]> {
  return await page.evaluate(() => {
    const selectors = [
      '.project-item',
      '.job-item',
      '[data-testid="project-card"]',
      '.project-card',
      '.job-card',
      'article.project',
      '.project-list-item'
    ];
    
    let projectCards: NodeListOf<Element> | null = null;
    
    for (const selector of selectors) {
      projectCards = document.querySelectorAll(selector);
      if (projectCards && projectCards.length > 0) break;
    }
    
    if (!projectCards || projectCards.length === 0) {
      projectCards = document.querySelectorAll('article, .card, [class*="project"], [class*="job"]');
    }
    
    return Array.from(projectCards || []).slice(0, 10).map((card, index) => {
      const titleEl = card.querySelector('h2, h3, .project-title, .job-title, [class*="title"]');
      const title: string = titleEl?.textContent?.trim() ?? ''
      // general un identificador unico
      const id = btoa(encodeURIComponent(title))
      .replace(/[+/=]/g, '')
      .substring(0, 12);
      const descEl = card.querySelector('.description, .project-description, .job-description, p');
      const budgetEl = card.querySelector('.budget, .price, [class*="budget"], [class*="price"]');
      const skillsEls = card.querySelectorAll('.skill, .tag, [class*="skill"], [class*="tag"]');
      const linkEl = card.querySelector('a');
      const dateEl = card.querySelector('.date, .posted, [class*="date"], [class*="time"]');
      const bids = card.querySelector('.bids, [class*="bids"]')
      
      const paymentVerifiedEl = card.querySelector('span.payment-verified, .payment-verified span');
      const paymentVerified = paymentVerifiedEl ? true : false;

      let url = linkEl?.getAttribute('href') || '';
      if (url && url.startsWith('/')) {
        url = 'https://www.workana.com' + url;
      }

      return {
        id: id,
        title: title || 'N/A',
        description: descEl?.textContent?.trim() || '',
        budget: budgetEl?.textContent?.trim() || 'N/A',
        skills: Array.from(skillsEls).map(s => s.textContent?.trim()).filter(Boolean),
        url: url,
        postedDate: dateEl?.textContent?.trim() || 'N/A',
        extractedAt: new Date().toLocaleString('es-PA', { timeZone: 'America/Panama' }),
        paymentVerified: paymentVerified,
        bids: bids?.textContent?.trim()?.split(': ')?.[1] || '0',
      };
    }).filter((p: any) => p.title !== 'N/A' && p.url !== '')
  })
}

function hasValidBudget(budget: string): boolean {
  if (!budget || budget === 'N/A') return false;
  const amountMatch = budget.match(/USD\s*([\d,\.]+)/);
  if (!amountMatch) return false;
  
  const amountStr = amountMatch[1].replace(/[,.]/g, '');
  const amount = parseInt(amountStr);
  return !isNaN(amount) && amount > 0;
}

function formatedPost(projects: Project[]): Project[] {
  return projects.map(p => {
    console.log(`DEBUG - postedDate: "${p.postedDate}", language: ${p.language}`);
    const postedDate = parseRelativeDate(p.postedDate)
    console.log(`DEBUG - transformed: "${postedDate}"`);
    return {
      id: p.id,
      title: p.title,
      description: p.description,
      budget: p.budget,
      skills: p.skills, 
      url: p.url,
      postedDate: postedDate,
      extractedAt: p.extractedAt,
      paymentVerified: p.paymentVerified,
      bids: p.bids
    }
  });
}

function sortByPostedDate(projects: Project[]): Project[] {
  return projects.sort((a, b) => {
    const dateA = new Date(parseDate(a.postedDate));
    const dateB = new Date(parseDate(b.postedDate));

    // Si alguna fecha es inválida, ponerla al final
    if (!isFinite(dateA.getTime())) return 1;
    if (!isFinite(dateB.getTime())) return -1;

    return dateB.getTime() - dateA.getTime();
  });
}

async function getPageCount(page: Page): Promise<number[]> {
  return await page.evaluate(() => {
    // Selector más específico para los números de paginación
    const paginationItems = document.querySelectorAll('.pagination a, [class*="page-number"], [data-page]');
    const pageNumbers = Array.from(paginationItems)
      .map(el => parseInt(el.textContent?.trim() || '0'))
      .filter(n => n > 0);
    
    // Retorna array único y ordenado
    return [...new Set(pageNumbers)].sort((a, b) => a - b);
  });
}

export async function scraperWorkana(): Promise<Project[]> {
  let browser: Browser | null = null;
  const allFilteredProjects: Project[] = [];

  try {
    browser = await firefox.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    for (const lang of ['es', 'en'] as const) {
      const filters = LANGUAGE_FILTERS[lang];
      const currentLanguageName = lang === 'es' ? 'ESPAÑOL' : 'INGLÉS';
      const allProjectsByLang: Project[] = [];

      console.log(`\n🔍 Scraping Workana (${currentLanguageName})...`);

      const url = buildUrl('https://www.workana.com/jobs', filters);
      await page.goto(url, { timeout: 15000 });
      await page.waitForLoadState('domcontentloaded');

      const pageNumbers = await getPageCount(page)

// codigo bucle de paginacion
      for (const pag of pageNumbers){
        await page.goto(`${url}&page=${pag}`, { timeout: 15000 });
        await page.waitForLoadState('domcontentloaded');
        const basicProjects = await extractProjectsFromList(page);
        allProjectsByLang.push(...basicProjects)
      }

      console.log(`   ${allProjectsByLang.length} proyectos extraídos.`);
      if (allProjectsByLang.length === 0) {
        continue;
      }

      const filteredProjects = allProjectsByLang.filter(project => {
        const validBudget = hasValidBudget(project.budget);
        const paymentVerified = project.paymentVerified;

        if (!validBudget || !paymentVerified) {
          console.log('❌ Descartado:', JSON.stringify({
            title: project.title,
            budget: project.budget,
            validBudget,
            paymentVerified
          }));
        }

        return validBudget && paymentVerified;
      });

      console.log(`   ${filteredProjects.length} proyectos filtrados.`);

      allFilteredProjects.push(...filteredProjects.map(p => ({ ...p, language: lang })));
    }

    const formatedPosts = formatedPost(allFilteredProjects)
    const sortedProjects = sortByPostedDate(formatedPosts);
    console.log(`\n✅ Total de proyectos: ${sortedProjects.length}`);

    return sortedProjects;

  } catch (error) {
    console.error('❌ Error durante el scraping:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
