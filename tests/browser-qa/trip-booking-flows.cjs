/**
 * Playtest: All Three Trip Booking Entry Points
 * Fresh browser context per flow — no contamination.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = process.env.TARGET_URL || 'http://127.0.0.1:3001';
const ARTIFACTS = path.join(__dirname, 'screenshots', 'booking-flows');

fs.mkdirSync(ARTIFACTS, { recursive: true });

const results = [];

async function screenshot(page, name) {
  const p = path.join(ARTIFACTS, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  console.log(`  📸 ${p}`);
  return p;
}

async function testFlowA(browser) {
  console.log('\n═══ FLOW A: Build Your Own Trip ═══');
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  // 1. Navigate to homepage
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await screenshot(page, 'flowA-01-homepage');

  // 2. Check for the three entry cards
  const buildBtn = page.getByRole('button', { name: /build trip myself/i });
  const readyBtn = page.getByRole('button', { name: /explore ready/i });
  const aiBtn = page.getByRole('button', { name: /get my plan/i });
  
  const buildVisible = await buildBtn.isVisible().catch(() => false);
  const readyVisible = await readyBtn.isVisible().catch(() => false);
  const aiVisible = await aiBtn.isVisible().catch(() => false);
  
  console.log(`  Entry cards: Build=${buildVisible} Ready=${readyVisible} AI=${aiVisible}`);

  // Check if we're on first-visit or returning-traveler variant
  const plannerVisible = await page.getByText('Describe your trip').isVisible().catch(() => false);
  const entrySectionVisible = await page.getByText('What kind of trip do you want').isVisible().catch(() => false);
  console.log(`  Planner visible: ${plannerVisible}, Entry section visible: ${entrySectionVisible}`);

  if (buildVisible) {
    // First-visit variant — test Build Myself entry
    await buildBtn.click();
    await page.waitForTimeout(2000);
    await screenshot(page, 'flowA-02-planner');
    
    // Test trip setup: duration, travelers, budget
    const durationSlider = page.locator('[data-testid="duration"], input[type="range"]').first();
    const travelerBtns = page.locator('button:has-text("1"), button:has-text("2"), button:has-text("3")');
    
    console.log(`  URL after Build click: ${page.url()}`);
    
    // Look for trip configuration options
    const configOptions = await page.locator('button, select, input').count();
    console.log(`  Interactive elements on planner: ${configOptions}`);
  } else {
    // Returning traveler — navigate directly
    console.log('  Returning traveler variant detected — navigating directly to /trip-planner');
    await page.goto(`${BASE}/trip-planner`, { waitUntil: 'networkidle' });
    await screenshot(page, 'flowA-02-planner');
    console.log(`  URL: ${page.url()}`);
  }

  // 3. Test the planner form (if accessible)
  // Look for configuration fields
  const allText = await page.textContent('main').catch(() => '');
  const hasDuration = /duration|days|nights/i.test(allText);
  const hasTravelers = /travelers?|guests?|adults?|people/i.test(allText);
  const hasBudget = /budget|price|cost/i.test(allText);
  const hasInterests = /interest|prefer|activit/i.test(allText);
  
  console.log(`  Config sections: duration=${hasDuration} travelers=${hasTravelers} budget=${hasBudget} interests=${hasInterests}`);

  // 4. Check console errors
  console.log(`  Console errors: ${errors.length}`);
  errors.forEach(e => console.log(`    ⚠️ ${e.substring(0, 120)}`));

  results.push({
    flow: 'A — Build Your Own',
    entryCardsVisible: buildVisible && readyVisible && aiVisible,
    plannerAccessible: page.url().includes('trip-planner') || plannerVisible,
    configSections: { hasDuration, hasTravelers, hasBudget, hasInterests },
    consoleErrors: errors.length,
    url: page.url()
  });

  await ctx.close();
}

async function testFlowB(browser) {
  console.log('\n═══ FLOW B: Ready-Made Packages ═══');
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await screenshot(page, 'flowB-01-homepage');

  // Look for the ready-made programmes carousel
  const programmesSection = page.getByText('5 Handcrafted Dahab Itineraries');
  const hasProgrammes = await programmesSection.isVisible().catch(() => false);
  console.log(`  Programmes section visible: ${hasProgrammes}`);

  if (hasProgrammes) {
    await programmesSection.scrollIntoViewIfNeeded();
    await screenshot(page, 'flowB-02-carousel');

    // Test category filters
    const filterBtns = ['All 5 Programs', 'First Timers', 'Adventure & Safari', 'Diving & Reefs', 'Slow & Wellness'];
    for (const filter of filterBtns) {
      const btn = page.getByRole('button', { name: filter });
      if (await btn.isVisible().catch(() => false)) {
        await btn.click();
        await page.waitForTimeout(500);
      }
    }

    // Open first programme
    const viewBtn = page.getByRole('button', { name: /view program.*dahab first timer/i }).first();
    if (await viewBtn.isVisible().catch(() => false)) {
      await viewBtn.click();
      await page.waitForTimeout(1000);
      await screenshot(page, 'flowB-03-programme-detail');

      // Check for programme details
      const detailText = await page.textContent('main').catch(() => '');
      const hasItinerary = /day\s*[1-7]/i.test(detailText);
      const hasPrice = /egp|price/i.test(detailText);
      const hasDuration = /days?|nights?/i.test(detailText);
      
      console.log(`  Programme detail: itinerary=${hasItinerary} price=${hasPrice} duration=${hasDuration}`);
    }

    // Test Compare Programs button
    const compareBtn = page.getByRole('button', { name: /compare programs/i });
    if (await compareBtn.isVisible().catch(() => false)) {
      await compareBtn.click();
      await page.waitForTimeout(1000);
      await screenshot(page, 'flowB-04-compare');
      console.log('  Compare modal opened');
    }
  }

  console.log(`  Console errors: ${errors.length}`);
  results.push({
    flow: 'B — Ready Packages',
    programmesVisible: hasProgrammes,
    consoleErrors: errors.length,
    url: page.url()
  });

  await ctx.close();
}

async function testFlowC(browser) {
  console.log('\n═══ FLOW C: AI Trip Planner ═══');
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await screenshot(page, 'flowC-01-homepage');

  // Find the AI planner
  const plannerInput = page.getByPlaceholder(/describe your trip/i);
  const hasPlanner = await plannerInput.isVisible().catch(() => false);
  console.log(`  AI planner input visible: ${hasPlanner}`);

  if (hasPlanner) {
    // Test empty state
    const planBtn = page.getByRole('button', { name: /plan my trip/i });
    const isDisabled = await planBtn.isDisabled().catch(() => true);
    console.log(`  Plan button disabled when empty: ${isDisabled}`);

    // Test preset prompts
    const presetBtns = await page.locator('button:has-text("days")').all();
    console.log(`  Preset prompt buttons: ${presetBtns.length}`);

    // Enter a trip description
    await plannerInput.fill('3 days diving and beach relaxation for 2 people');
    await page.waitForTimeout(500);
    
    const planBtnEnabled = !(await planBtn.isDisabled().catch(() => true));
    console.log(`  Plan button enabled after typing: ${planBtnEnabled}`);
    await screenshot(page, 'flowC-02-typed');

    // Generate plan
    if (planBtnEnabled) {
      const startTime = Date.now();
      await planBtn.click();
      
      // Wait for generation
      await page.waitForTimeout(15000);
      const genTime = Date.now() - startTime;
      console.log(`  Generation time: ~${Math.round(genTime/1000)}s`);
      
      await screenshot(page, 'flowC-03-plan-generated');

      // Check plan output
      const planText = await page.textContent('main').catch(() => '');
      const hasDays = /day\s*[1-7]/i.test(planText);
      const hasActivities = /activity|experience|dive|snorkel|safari|beach/i.test(planText);
      const hasPrice = /egp|\d{1,3},?\d{3}/i.test(planText);
      const hasFit = /\d+%/i.test(planText);
      
      console.log(`  Plan output: days=${hasDays} activities=${hasActivities} price=${hasPrice} fit=${hasFit}`);

      // Check for day-by-day breakdown
      const dayButtons = await page.locator('button:has-text("Day")').all();
      console.log(`  Day buttons: ${dayButtons.length}`);

      // Test tweak buttons
      const tweakBtns = ['+1 day', 'More relaxed', 'Tighter budget'];
      for (const tweak of tweakBtns) {
        const btn = page.getByRole('button', { name: tweak });
        if (await btn.isVisible().catch(() => false)) {
          console.log(`  Tweak "${tweak}" available ✓`);
        }
      }

      // Test save
      const saveBtn = page.getByRole('button', { name: /save this plan/i });
      if (await saveBtn.isVisible().catch(() => false)) {
        await saveBtn.click();
        await page.waitForTimeout(3000);
        await screenshot(page, 'flowC-04-saved');
        console.log(`  URL after save: ${page.url()}`);
        
        // Verify trip was saved
        const isMyTrip = page.url().includes('my-trip');
        console.log(`  Navigated to My Trip: ${isMyTrip}`);
      }
    }
  }

  console.log(`  Console errors: ${errors.length}`);
  results.push({
    flow: 'C — AI Planner',
    plannerVisible: hasPlanner,
    consoleErrors: errors.length,
    url: page.url()
  });

  await ctx.close();
}

async function testNegativeCases(browser) {
  console.log('\n═══ NEGATIVE TESTING ═══');
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await page.goto(BASE, { waitUntil: 'networkidle' });

  // Test 1: Empty AI prompt
  const planBtn = page.getByRole('button', { name: /plan my trip/i });
  const isDisabled = await planBtn.isDisabled().catch(() => true);
  console.log(`  Empty prompt → button disabled: ${isDisabled} ✓`);

  // Test 2: Very short prompt
  const plannerInput = page.getByPlaceholder(/describe your trip/i);
  if (await plannerInput.isVisible().catch(() => false)) {
    await plannerInput.fill('hi');
    await page.waitForTimeout(300);
    const enabledAfterShort = !(await planBtn.isDisabled().catch(() => true));
    console.log(`  Very short prompt "hi" → button enabled: ${enabledAfterShort}`);

    // Test 3: Very long prompt
    await plannerInput.fill('A'.repeat(500));
    await page.waitForTimeout(300);
    const enabledAfterLong = !(await planBtn.isDisabled().catch(() => true));
    console.log(`  500-char prompt → button enabled: ${enabledAfterLong}`);
    
    // Clear
    await plannerInput.fill('');
  }

  // Test 4: Rapid clicking
  console.log('  Testing rapid double-click on Plan button...');
  if (await plannerInput.isVisible().catch(() => false)) {
    await plannerInput.fill('test trip');
    await page.waitForTimeout(300);
    try {
      await planBtn.click({ timeout: 2000 });
      await planBtn.click({ timeout: 2000 }).catch(() => {});
      console.log('  Rapid click completed without crash ✓');
    } catch (e) {
      console.log(`  Rapid click result: ${e.message.substring(0, 80)}`);
    }
  }

  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  
  try {
    await testFlowA(browser);
    await testFlowB(browser);
    await testFlowC(browser);
    await testNegativeCases(browser);
  } finally {
    await browser.close();
  }

  console.log('\n═══ SUMMARY ═══');
  console.log(JSON.stringify(results, null, 2));
})();
