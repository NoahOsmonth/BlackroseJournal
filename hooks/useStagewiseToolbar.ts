import { useEffect } from 'react';

import { setupStagewiseToolbar } from '../services/stagewiseToolbar';

export const useStagewiseToolbar = (): void => {
    useEffect(() => {
        void setupStagewiseToolbar();
    }, []);
};
