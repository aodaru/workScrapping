#!/usr/bin/env node

/**
 * Script para filtrar proyectos de Workana desde JSON
 * Uso: npx ts-node filter-projects.ts [archivo-json]
 */

import * as fs from 'fs';
import * as path from 'path';

// Leer archivo JSON
function loadProjects(filename: string): any[] {
  const filePath = path.resolve(filename);
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Archivo no encontrado: ${filePath}`);
    console.log('\nUso: npx ts-node filter-projects.ts workana-projects-es-2024-01-15.json');
    process.exit(1);
  }
  
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return data.projects || [];
}

// Función para parsear presupuesto y obtener valores numéricos
function parseBudget(budget: string): { min: number; max: number; hourly: boolean } {
  if (!budget || budget === 'N/A') return { min: 0, max: 0, hourly: false };
  
  // Detectar si es por hora
  const hourly = budget.includes('/hora') || budget.includes('/hour');
  
  // Extraer números del presupuesto
  // Formatos: "USD 100 - 250", "USD 250", "Menos de USD 15 / hora", "USD 15 - 45 / hora"
  const numbers = budget.match(/(\d+)/g);
  
  if (!numbers || numbers.length === 0) {
    return { min: 0, max: 0, hourly };
  }
  
  if (numbers.length === 1) {
    // Un solo número (ej: "USD 250" o "Menos de USD 15")
    const value = parseInt(numbers[0]);
    return { min: value, max: value, hourly };
  }
  
  // Rango (ej: "USD 100 - 250")
  return {
    min: parseInt(numbers[0]),
    max: parseInt(numbers[1]),
    hourly
  };
}

// Verificar si el presupuesto es válido (> 0)
function hasValidBudget(project: any): boolean {
  const budget = parseBudget(project.budget);
  return budget.min > 0 || budget.max > 0;
}

// Filtrar proyectos
function filterProjects(projects: any[], options: any): any[] {
  return projects.filter(project => {
    const budget = parseBudget(project.budget);
    
    // Filtro: Presupuesto mínimo
    if (options.minBudget && budget.min < options.minBudget) {
      return false;
    }
    
    // Filtro: Presupuesto máximo
    if (options.maxBudget && budget.max > options.maxBudget) {
      return false;
    }
    
    // Filtro: Solo por hora o solo fijo
    if (options.hourlyOnly && !budget.hourly) {
      return false;
    }
    
    if (options.fixedOnly && budget.hourly) {
      return false;
    }
    
    // Filtro: Skills específicos
    if (options.requiredSkills && options.requiredSkills.length > 0) {
      const projectSkills = project.skills?.map((s: string) => s.toLowerCase()) || [];
      const hasRequiredSkill = options.requiredSkills.some((skill: string) =>
        projectSkills.some((ps: string) => ps.includes(skill.toLowerCase()))
      );
      if (!hasRequiredSkill) return false;
    }
    
    // Filtro: Excluir skills
    if (options.excludeSkills && options.excludeSkills.length > 0) {
      const projectSkills = project.skills?.map((s: string) => s.toLowerCase()) || [];
      const hasExcludedSkill = options.excludeSkills.some((skill: string) =>
        projectSkills.some((ps: string) => ps.includes(skill.toLowerCase()))
      );
      if (hasExcludedSkill) return false;
    }
    
    // Filtro: Presupuesto > 0
    if (options.validBudgetOnly && !hasValidBudget(project)) {
      return false;
    }
    
    return true;
  });
}

// Mostrar proyectos filtrados
function displayFilteredProjects(projects: any[], originalCount: number) {
  console.log('\n' + '='.repeat(70));
  console.log('RESULTADOS DEL FILTRADO');
  console.log('='.repeat(70));
  console.log(`Proyectos originales: ${originalCount}`);
  console.log(`Proyectos filtrados: ${projects.length}`);
  console.log(`Descartados: ${originalCount - projects.length}`);
  console.log('='.repeat(70) + '\n');
  
  if (projects.length === 0) {
    console.log('⚠️ No hay proyectos que cumplan con los filtros aplicados.\n');
    return;
  }
  
  projects.forEach((project, index) => {
    const budget = parseBudget(project.budget);
    const budgetType = budget.hourly ? '/hora' : 'fijo';
    
    console.log(`${index + 1}. ${project.title}`);
    console.log(`   💰 Presupuesto: ${project.budget} (${budgetType})`);
    console.log(`   🔗 URL: ${project.url}`);
    console.log(`   🏷️ Skills: ${project.skills?.join(', ') || 'N/A'}`);
    console.log(`   📅 Fecha: ${project.postedDate}`);
    console.log(`   🌐 Idioma: ${project.language?.toUpperCase() || 'N/A'}`);
    console.log('');
  });
  
  // Calcular estadísticas
  const budgets = projects.map(p => parseBudget(p.budget));
  const avgMin = budgets.reduce((sum, b) => sum + b.min, 0) / budgets.length;
  const avgMax = budgets.reduce((sum, b) => sum + b.max, 0) / budgets.length;
  
  console.log('='.repeat(70));
  console.log('ESTADÍSTICAS');
  console.log('='.repeat(70));
  console.log(`Presupuesto promedio: USD ${avgMin.toFixed(0)} - ${avgMax.toFixed(0)}`);
  console.log(`Proyectos por hora: ${budgets.filter(b => b.hourly).length}`);
  console.log(`Proyectos de precio fijo: ${budgets.filter(b => !b.hourly).length}`);
  console.log('='.repeat(70) + '\n');
}

// Guardar resultados filtrados
function saveFilteredResults(projects: any[], originalFile: string) {
  const timestamp = new Date().toISOString().split('T')[0];
  const baseName = path.basename(originalFile, '.json');
  const outputFile = `${baseName}-filtered-${timestamp}.json`;
  
  const data = {
    filteredAt: new Date().toISOString(),
    totalFiltered: projects.length,
    filters: 'Ver configuración en el script',
    projects: projects
  };
  
  fs.writeFileSync(outputFile, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`💾 Resultados guardados en: ${outputFile}\n`);
}

// Función principal
function main() {
  // Obtener nombre del archivo de la línea de comandos
  const filename = process.argv[2];
  
  if (!filename) {
    console.error('❌ Debes proporcionar un archivo JSON');
    console.log('\nUso: npx ts-node filter-projects.ts workana-projects-es-2024-01-15.json');
    console.log('\nBusca archivos JSON en el directorio:');
    const files = fs.readdirSync('.').filter(f => f.endsWith('.json') && f.includes('workana'));
    if (files.length > 0) {
      console.log('\nArchivos disponibles:');
      files.forEach(f => console.log(`  • ${f}`));
    }
    process.exit(1);
  }
  
  // Cargar proyectos
  console.log(`\n📂 Cargando proyectos desde: ${filename}`);
  const projects = loadProjects(filename);
  console.log(`   Total cargado: ${projects.length} proyectos\n`);
  
  // Configuración de filtros - AJUSTA ESTOS VALORES
  const filterOptions = {
    // Presupuesto mínimo en USD (0 para desactivar)
    minBudget: 100,
    
    // Presupuesto máximo en USD (0 para desactivar)
    maxBudget: 0,
    
    // Solo proyectos por hora
    hourlyOnly: false,
    
    // Solo proyectos de precio fijo
    fixedOnly: false,
    
    // Skills requeridos (array vacío para desactivar)
    requiredSkills: [],
    
    // Skills excluidos (array vacío para desactivar)
    excludeSkills: [],
    
    // Solo presupuestos > 0
    validBudgetOnly: true,
  };
  
  console.log('🔧 Filtros aplicados:');
  console.log(`   • Presupuesto mínimo: USD ${filterOptions.minBudget || 'Sin límite'}`);
  console.log(`   • Presupuesto máximo: USD ${filterOptions.maxBudget || 'Sin límite'}`);
  console.log(`   • Solo por hora: ${filterOptions.hourlyOnly ? 'Sí' : 'No'}`);
  console.log(`   • Solo fijo: ${filterOptions.fixedOnly ? 'Sí' : 'No'}`);
  console.log(`   • Presupuesto válido: ${filterOptions.validBudgetOnly ? 'Sí' : 'No'}`);
  if (filterOptions.requiredSkills.length > 0) {
    console.log(`   • Skills requeridos: ${filterOptions.requiredSkills.join(', ')}`);
  }
  console.log('');
  
  // Aplicar filtros
  const filteredProjects = filterProjects(projects, filterOptions);
  
  // Mostrar resultados
  displayFilteredProjects(filteredProjects, projects.length);
  
  // Guardar resultados
  if (filteredProjects.length > 0) {
    saveFilteredResults(filteredProjects, filename);
  }
}

// Ejecutar
main();
