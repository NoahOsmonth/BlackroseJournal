import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { SupabaseStatusBanner } from '../../components/system/SupabaseStatusBanner';

jest.mock('@/hooks/supabase/useSupabaseSchemaStatus', () => ({
    useSupabaseSchemaStatus: () => ({
        warning: 'Supabase table missing: user_settings.',
    }),
}));

describe('SupabaseStatusBanner', () => {
    it('renders warning message', () => {
        render(<SupabaseStatusBanner />);

        expect(screen.getByText('Supabase setup needed')).toBeTruthy();
        expect(screen.getByText('Supabase table missing: user_settings.')).toBeTruthy();
    });
});
