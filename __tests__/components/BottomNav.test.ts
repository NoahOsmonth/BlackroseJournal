import { tabConfig } from '../../components/journal/BottomNav';

describe('BottomNav tabConfig', () => {
    it('exposes Explore as the Memory graph tab without removing active routes', () => {
        expect(tabConfig).toEqual(expect.arrayContaining([
            { name: 'explore', icon: 'hub', label: 'Memory' },
            { name: 'today', icon: 'today', label: 'Today' },
            { name: 'entries', icon: 'history-edu', label: 'History' },
            { name: 'insights', icon: 'lightbulb', label: 'Insights' },
            { name: 'settings', icon: 'settings', label: 'Settings' },
        ]));
    });
});
