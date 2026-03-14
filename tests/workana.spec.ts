import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// --- Configuración de Filtros --- //
// Filtros base aplicables a ambos idiomas
const BASE_FILTERS = {
  category: 'it-programming',
  publication: '3d', // Últimos 3 días
  has_few_bids: '1', // Proyectos con 0-4 propuestas
  agreement: '',
  country: '',
};

// Filtros específicos por idioma (combinan BASE_FILTERS con skills y language)
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

// --- Funciones Auxiliares --- //

// Construir URL con filtros
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

// Extraer datos de proyectos directamente de la vista de listado, incluyendo verificación de pago
async function extractProjectsFromList(page: any): Promise<any[]> {
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
      
      // Verificar el estado de pago directamente desde la tarjeta del listado
      const paymentVerifiedEl = card.querySelector('span.payment-verified, .payment-verified span');
      const paymentVerified = paymentVerifiedEl ? true : false;

      let url = linkEl?.getAttribute('href') || '';
      if (url && url.startsWith('/')) {
        url = 'https://www.workana.com' + url; // Convertir a URL absoluta
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
    }).filter(p => p.title !== 'N/A' && p.url !== '');
  });
}

// Verificar si el presupuesto es válido (> 0 USD)
function hasValidBudget(budget: string): boolean {
  if (!budget || budget === 'N/A') return false;
  const amountMatch = budget.match(/USD\s*([\d,\.]+)/); // Soporta miles con coma o punto
  if (!amountMatch) return false;
  
  const amountStr = amountMatch[1].replace(/[,.]/g, ''); // Eliminar separadores de miles
  const amount = parseInt(amountStr);
  return !isNaN(amount) && amount > 0;
}

// Función para guardar en JSON
function saveToJson(data: any[], filename: string) {
  const outputPath = path.join(process.cwd(), filename);
  const jsonData = {
    extractedAt: new Date().toISOString(),
    total: data.length,
    projects: data
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(jsonData, null, 2), 'utf-8');
  console.log(`\n💾 Datos guardados en: ${outputPath}`);
  console.log(`   Total de proyectos: ${data.length}\n`);
}

// --- Test Principal --- //
test('scrape and filter workana projects to JSON', async ({ page }) => {
  const allFilteredProjects: any[] = [];
  
  for (const lang of ['es', 'en']) {
    const filters = LANGUAGE_FILTERS[lang as keyof typeof LANGUAGE_FILTERS];
    const currentLanguageName = lang === 'es' ? 'ESPAÑOL' : 'INGLÉS';
    
    console.log('\n' + '='.repeat(70));
    console.log(`BÚSQUEDA Y FILTRADO EN ${currentLanguageName}`);
    console.log('='.repeat(70));
    
    const url = buildUrl('https://www.workana.com/jobs', filters);
    console.log(`\nURL: ${url}`);
    console.log('Filtros aplicados (URL):');
    Object.entries(filters).forEach(([key, value]) => {
      if (value) console.log(`  • ${key}: ${value}`);
    });
    console.log('');
    
    // 1. Navegar y aceptar cookies
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    try {
      const acceptButton = page.locator('button:has-text("Accept"), button:has-text("Aceptar"), [data-testid="cookie-accept"]').first();
      await acceptButton.click({ timeout: 3000 });
    } catch {
      // Cookie banner no presente
    }
    
    // 2. Extraer proyectos básicos del listado (incluye paymentVerified)
    console.log(`🔍 Extrayendo proyectos del listado en ${currentLanguageName}...`);
    const basicProjects = await extractProjectsFromList(page);
    console.log(`   ${basicProjects.length} proyectos básicos extraídos.`);
    
    if (basicProjects.length === 0) {
      console.log(`⚠️ No se encontraron proyectos en ${currentLanguageName} con los filtros de URL.\n`);
      continue; // Continuar con el siguiente idioma
    }
    
    // 3. Aplicar filtros de presupuesto y pago verificado en memoria
    console.log(`
⚙️ Aplicando filtros de presupuesto y pago verificado en memoria para ${currentLanguageName}...`);
    const filteredAndVerifiedProjects = basicProjects.filter(project => {
      const validBudget = hasValidBudget(project.budget);
      const paymentVerified = project.paymentVerified;

      if (!validBudget) {
        console.log(`     ❌ DESCARTADO (Presupuesto inválido): "${project.title}"`);
      }
      if (!paymentVerified) {
        console.log(`     ❌ DESCARTADO (Pago no verificado): "${project.title}"`);
      }

      return validBudget && paymentVerified;
    });

    console.log(`   ${filteredAndVerifiedProjects.length} proyectos aprobados después del filtrado en memoria.`);
    
    allFilteredProjects.push(...filteredAndVerifiedProjects.map(p => ({ ...p, language: lang })));
    
    await page.screenshot({ path: `workana-screenshot-${lang}-filtered.png`, fullPage: true });
  }
  
  // --- Resumen Final y Guardado JSON --- //
  console.log('\n' + '='.repeat(70));
  console.log('✅ PROCESO DE EXTRACCIÓN Y FILTRADO COMPLETADO');
  console.log('='.repeat(70));
  
  if (allFilteredProjects.length === 0) {
    console.log('\n⚠️ No se encontraron proyectos que cumplan con TODOS los criterios.\n');
  } else {
    console.log(`\n🎉 Total de proyectos aprobados: ${allFilteredProjects.length}\n`);
    
    // Guardar todos los proyectos filtrados en un único JSON
    const filename = `workana-filtered-projects-${new Date().toISOString().split('T')[0]}.json`;
    saveToJson(allFilteredProjects, filename);
    
    console.log('\n📋 LISTADO COMPLETO DE PROYECTOS FILTRADOS:\n');
    allFilteredProjects.forEach((project, index) => {
      const langFlag = project.language === 'es' ? '🇪🇸' : '🇬🇧';
      console.log(`${langFlag} ${index + 1}. ${project.title}`);
      console.log(`   URL: ${project.url}`);
      console.log(`   Presupuesto: ${project.budget}`);
      console.log(`   Idioma: ${project.language.toUpperCase()}`);
      console.log(`   Skills: ${project.skills?.slice(0, 3).join(', ') || 'N/A'}${project.skills?.length > 3 ? '...' : ''}`);
      console.log(`   Estado de pago: ${project.paymentVerified ? 'Verificado ✅' : 'No verificado ❌'}`);
      console.log('');
    });
  }
  
  // Screenshots para referencia
  console.log('\n📸 Screenshots guardados:');
  console.log('  - workana-screenshot-es-filtered.png (Búsqueda en español)');
  console.log('  - workana-screenshot-en-filtered.png (Búsqueda en inglés)');
  console.log('\nRecuerda: El JSON contiene solo los proyectos que pasaron todos los filtros.\n');
});
