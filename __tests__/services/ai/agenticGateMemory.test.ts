/**
 * Memory-branch shortlist coverage for the offline file-memory tools.
 *
 * Proves the E2E-learned lesson: a "run a memory dream" turn must actually
 * OFFER memory_dream (previously the shortlister only knew the 10 legacy
 * tools, so the model truthfully said "no tool for that").
 */
import { selectToolShortlist } from '../../../services/ai/agenticGate';

describe('memory shortlist branch', () => {
    it('dream request offers memory_dream', () => {
        const short = selectToolShortlist(
            'Please run a memory dream now to consolidate my staged memories into formal threads.'
        );
        expect(short.branch).toBe('memory');
        expect(short.names).toEqual(
            expect.arrayContaining([
                'get_clock',
                'memory_search',
                'memory_list',
                'memory_get',
                'memory_overview',
                'memory_flush',
                'memory_dream',
            ])
        );
        expect(short.names).not.toContain('create_goal');
    });

    it('memory_bank cleanup request offers the file tools, not just digests', () => {
        const short = selectToolShortlist('tidy up my memory threads, forget the duplicates');
        expect(short.branch).toBe('memory');
        expect(short.names).toContain('memory_dream');
    });

    it('remember-when leads with offline memory_search before Hindsight recall', () => {
        const short = selectToolShortlist('remember when I first mentioned running?');
        expect(short.branch).toBe('remember-when');
        expect(short.names).toContain('memory_search');
        expect(short.names).toContain('recall_memory');
    });

    it('history-days branch carries offline file search alongside digests', () => {
        const short = selectToolShortlist('what did I write about work last week?');
        expect(short.branch).toBe('history-days');
        expect(short.names).toContain('memory_search');
        expect(short.names).toContain('list_recent_days');
    });

    it('plain small talk does not fire the memory branch', () => {
        const short = selectToolShortlist('the sky is blue today');
        expect(short.branch).not.toBe('memory');
    });
});
