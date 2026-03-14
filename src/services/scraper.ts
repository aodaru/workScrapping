import { chromium, type Browser, type Page } from 'playwright';
import type { Project } from '../types.js';

const BASE_FILTERS = {
  category: 'it-programming',
  publication: '3d',
  has_few_bids: '1',
  agreement: '',
  country: '',
};

const LANGUAGE_FILTERS = {
  es: {
    ...BASE_FILTERS,
    language: 'es',
    skills: 'programacion web, ia',
  },
  en: {
    ...BASE_FILTERS,
    language: 'en',
    skills: 'web development, ai',
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
      const descEl = card.querySelector('.description, .project-description, .job-description, p');
      const budgetEl = card.querySelector('.budget, .price, [class*="budget"], [class*="price"]');
      const skillsEls = card.querySelectorAll('.skill, .tag, [class*="skill"], [class*="tag"]');
      const linkEl = card.querySelector('a');
      const dateEl = card.querySelector('.date, .posted, [class*="date"], [class*="time"]');
      
      const paymentVerifiedEl = card.querySelector('span.payment-verified, .payment-verified span');
      const paymentVerified = paymentVerifiedEl ? true : false;

      let url = linkEl?.getAttribute('href') || '';
      if (url && url.startsWith('/')) {
        url = 'https://www.workana.com' + url;
      }
      
      return {
        id: `proj_${index}_${Date.now()}`,
        title: titleEl?.textContent?.trim() || 'N/A',
        description: descEl?.textContent?.trim() || '',
        budget: budgetEl?.textContent?.trim() || 'N/A',
        skills: Array.from(skillsEls).map(s => s.textContent?.trim()).filter(Boolean),
        url: url,
        postedDate: dateEl?.textContent?.trim() || 'N/A',
        extractedAt: new Date().toISOString(),
        paymentVerified: paymentVerified,
      };
    }).filter((p: any) => p.title !== 'N/A' && p.url !== '');
  });
}

function hasValidBudget(budget: string): boolean {
  if (!budget || budget === 'N/A') return false;
  const amountMatch = budget.match(/USD\s*([\d,\.]+)/);
  if (!amountMatch) return false;
  
  const amountStr = amountMatch[1].replace(/[,.]/g, '');
  const amount = parseInt(amountStr);
  return !isNaN(amount) && amount > 0;
}

function parsePostedDate(dateStr: string): number {
  if (!dateStr || dateStr === 'N/A') return 0;
  
  const now = new Date();
  const numMatch = dateStr.match(/(\d+)/);
  if (!numMatch) return now.getTime();
  
  const num = parseInt(numMatch[1]);
  
  if (dateStr.includes('hour') || dateStr.includes('hora')) {
    return now.getTime() - num * 60 * 60 * 1000;
  }
  if (dateStr.includes('day') || dateStr.includes('día') || dateStr.includes('dia')) {
    return now.getTime() - num * 24 * 60 * 60 * 1000;
  }
  if (dateStr.includes('min')) {
    return now.getTime() - num * 60 * 1000;
  }
  
  return now.getTime();
}

function sortByPostedDate(projects: Project[]): Project[] {
  return projects.sort((a, b) => {
    const dateA = parsePostedDate(a.postedDate);
    const dateB = parsePostedDate(b.postedDate);
    return dateB - dateA;
  });
}

export async function scrapeJobs(): Promise<Project[]> {
  let browser: Browser | null = null;
  const allFilteredProjects: Project[] = [];

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    for (const lang of ['es', 'en'] as const) {
      const filters = LANGUAGE_FILTERS[lang];
      const currentLanguageName = lang === 'es' ? 'ESPAÑOL' : 'INGLÉS';

      console.log(`\n🔍 Scraping Workana (${currentLanguageName})...`);

      const url = buildUrl('https://www.workana.com/jobs', filters);
      await page.goto(url);
      await page.waitForLoadState('networkidle');

      try {
        const acceptButton = page.locator('button:has-text("Accept"), button:has-text("Aceptar"), [data-testid="cookie-accept"]').first();
        await acceptButton.click({ timeout: 3000 });
      } catch {
        // Cookie banner not present
      }

      const basicProjects = await extractProjectsFromList(page);
      console.log(`   ${basicProjects.length} proyectos extraídos.`);

      if (basicProjects.length === 0) {
        continue;
      }

      const filteredProjects = basicProjects.filter(project => {
        const validBudget = hasValidBudget(project.budget);
        const paymentVerified = project.paymentVerified;
        return validBudget && paymentVerified;
      });

      console.log(`   ${filteredProjects.length} proyectos filtrados.`);

      allFilteredProjects.push(...filteredProjects.map(p => ({ ...p, language: lang })));
    }

    const sortedProjects = sortByPostedDate(allFilteredProjects);
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
