import { test, expect } from '@playwright/test';

test('get started link', async ({ page }) => {
  await page.goto('https://adalgarcia.com/');

  // Click the get started link.
  const getStarted = page.getByRole('link', { name: 'Blog' });

  await getStarted.click();

  // Wait for navigation to the blog category page
  await page.waitForURL('**/category/blog/');

  // Extract all blog data from the page
  const blogs = await page.evaluate(() => {
    const cards = document.querySelectorAll('.blog-card-link');
    return Array.from(cards).map(card => {
      const title = card.querySelector('.card-title')?.textContent?.trim();
      const url = card.getAttribute('href');
      const description = card.querySelector('.card-description')?.textContent?.trim();
      const tags = Array.from(card.querySelectorAll('.tag')).map(t => t.textContent?.trim()).filter(Boolean);
      return { title, url, description, tags };
    });
  });

  // Display results in console
  console.log('\n=== LISTADO DE BLOGS ===\n');
  blogs.forEach((blog, index) => {
    console.log(`${index + 1}. ${blog.title}`);
    console.log(`   URL: ${blog.url}`);
    console.log(`   Descripción: ${blog.description}`);
    console.log(`   Tags: ${blog.tags?.join(', ') || 'N/A'}`);
    console.log('');
  });
  console.log(`Total: ${blogs.length} blogs encontrados`);

  // Verify we found at least one blog
  expect(blogs.length).toBeGreaterThan(0);
});
