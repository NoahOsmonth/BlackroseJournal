import { chromium } from 'playwright';

const BASE_URL = process.env.EXPO_URL || 'http://localhost:8082';

async function run() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();

    console.log(`Navigating to ${BASE_URL}`);
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);

    const title = await page.title();
    console.log('Page title:', title);

    // Seed journal entry, intention check-in, and memory atom directly in
    // localStorage (web AsyncStorage backend).
    const now = Date.now();
    const entry = {
        id: 'entry_1_abc',
        title: 'Browser test entry',
        emoji: '📝',
        messages: [{ id: 'm1', role: 'user', content: 'I am testing the clear history flow.', timestamp: 1 }],
        status: 'completed',
        analysis: {
            insight: 'Testing clears data.',
            quote: 'Clean slate.',
            mood: 'Reflective',
            topics: ['Testing'],
            generatedAt: 1,
        },
        createdAt: now,
        updatedAt: now,
    };

    const checkIn = {
        id: 'checkin_1_abc',
        type: 'morning',
        title: 'Morning intention',
        summary: 'Stay focused today.',
        mood: 'Reflective',
        messages: [{ id: 'm2', role: 'user', content: 'Stay focused today.', timestamp: 2 }],
        status: 'completed',
        createdAt: now,
        updatedAt: now,
    };

    const memoryEnvelope = {
        schemaVersion: 2,
        atoms: {
            'manual:test': {
                id: 'manual:test',
                layer: 'note',
                source: 'manual',
                sourceId: 'test',
                title: 'Manual test memory',
                content: 'This should be cleared.',
                tags: ['testing'],
                salience: 0.9,
                confidence: 1,
                createdAt: now,
                updatedAt: now,
                accessCount: 0,
            },
        },
    };

    await page.evaluate(({ entry, checkIn, memoryEnvelope }) => {
        localStorage.setItem('@journal_entries', JSON.stringify({ [entry.id]: entry }));
        localStorage.setItem('@intention_checkins', JSON.stringify({ [checkIn.id]: checkIn }));
        localStorage.setItem('@rosebud_local_memory', JSON.stringify(memoryEnvelope));
    }, { entry, checkIn, memoryEnvelope });

    // Reload so the app picks up seeded data.
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(5000);

    const bodyAfterSeed = await page.evaluate(() => document.body.innerText);
    console.log('\nBody text after seed:');
    console.log(bodyAfterSeed.slice(0, 1500));

    if (!bodyAfterSeed.includes('Browser test entry') || !bodyAfterSeed.includes('Morning intention')) {
        throw new Error('Expected seeded entry and check-in on Today screen');
    }
    console.log('\n✅ Seeded entry and check-in appear on Today');

    // Navigate to Settings and verify the renamed clear row exists and is enabled.
    await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const settingsText = await page.evaluate(() => document.body.innerText);
    if (!settingsText.includes('Clear History & Memories')) {
        throw new Error('Expected "Clear History & Memories" row in Settings');
    }
    if (!settingsText.includes('Removes journal entries, intentions, chat sessions, insights, and saved AI memories.')) {
        throw new Error('Expected clear-row detail text in Settings');
    }

    const clearButton = await page.locator('button').filter({ hasText: /Clear History & Memories/ }).first();
    const isDisabled = await clearButton.evaluate((el) => el.disabled);
    if (isDisabled) {
        throw new Error('Expected Clear History row to be enabled');
    }
    console.log('\n✅ Found enabled "Clear History & Memories" row in Settings');

    // Navigate to Entries (History) and verify both data sources show up.
    await page.goto(`${BASE_URL}/entries`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const historyText = await page.evaluate(() => document.body.innerText);
    const hasEntry = historyText.includes('Browser test entry');
    const hasCheckIn = historyText.includes('Morning intention');
    console.log('\nHistory text preview:');
    console.log(historyText.slice(0, 1500));
    console.log(`\nEntry visible: ${hasEntry}`);
    console.log(`Check-in visible: ${hasCheckIn}`);

    if (!hasEntry || !hasCheckIn) {
        throw new Error('Expected seeded entry and check-in to appear in History');
    }
    console.log('\n✅ Seeded entry and check-in appear in History');

    // Navigate to Memory (Explore) and verify the seeded memory atom appears.
    await page.goto(`${BASE_URL}/explore`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const memoryText = await page.evaluate(() => document.body.innerText);
    console.log('\nMemory text preview:');
    console.log(memoryText.slice(0, 1500));

    if (!memoryText.includes('Manual test memory')) {
        throw new Error('Expected seeded memory atom to appear in Memory tab');
    }
    console.log('\n✅ Seeded memory atom appears in Memory');

    // Note: actually pressing the RN web "Clear History & Memories" button in a
    // headless browser does not trigger react-native-web's press responder
    // consistently. The clear code path is covered by unit tests instead.

    await browser.close();
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
