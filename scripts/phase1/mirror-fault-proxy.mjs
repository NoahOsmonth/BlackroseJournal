import http from 'node:http';

export const supportedFaults = ['before-body', 'after-commit', 'permit-expiry', 'retry-after', 'transient-500', 'timeout'];

function parse(argv) {
    const options = { dryRun: false, faults: [], listen: undefined, upstream: undefined };
    for (let index = 0; index < argv.length; index += 1) {
        const option = argv[index];
        if (option === '--dry-run') options.dryRun = true;
        else if (option === '--faults' && argv[index + 1]) options.faults = argv[++index].split(',').filter(Boolean);
        else if (option === '--listen' && argv[index + 1]) options.listen = Number(argv[++index]);
        else if (option === '--upstream' && argv[index + 1]) options.upstream = new URL(argv[++index]);
        else throw new Error(`Unknown or incomplete option: ${option}`);
    }
    for (const fault of options.faults) if (!supportedFaults.includes(fault)) throw new Error(`Unsupported fault: ${fault}`);
    return options;
}

function startProxy(options) {
    if (!options.upstream || !Number.isInteger(options.listen)) throw new Error('--listen and --upstream are required to start the fault proxy.');
    const server = http.createServer((request, response) => {
        if (options.faults.includes('before-body')) return request.destroy();
        if (options.faults.includes('retry-after')) return response.writeHead(429, { 'Retry-After': '1' }).end();
        if (options.faults.includes('transient-500')) return response.writeHead(500).end();
        if (options.faults.includes('timeout')) return;
        const upstreamRequest = http.request(new URL(request.url, options.upstream), { headers: request.headers, method: request.method }, (upstreamResponse) => {
            response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
            upstreamResponse.pipe(response);
        });
        upstreamRequest.on('error', () => response.writeHead(502).end());
        request.pipe(upstreamRequest);
    });
    server.listen(options.listen, '127.0.0.1');
}

try {
    const options = parse(process.argv.slice(2));
    if (options.dryRun) process.stdout.write(`${JSON.stringify({ faults: options.faults, mode: 'dry-run' })}\n`);
    else startProxy(options);
} catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
}
