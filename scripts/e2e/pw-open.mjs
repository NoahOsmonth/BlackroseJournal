state.page = context.pages().find((p) => p.url() === "about:blank") ?? (await context.newPage());
await state.page.goto("http://localhost:8081", { waitUntil: "domcontentloaded" });
console.log("URL:", state.page.url());
console.log(await getLatestLogs({ page: state.page, sinceLastCall: true }));
console.log(await snapshot({ page: state.page, showDiffSinceLastCall: false }));
