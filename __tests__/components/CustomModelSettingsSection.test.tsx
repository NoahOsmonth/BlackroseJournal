import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { CustomModelSettingsSection } from '../../components/settings/CustomModelSettingsSection';
import type { UseCustomAiModelsReturn } from '../../hooks/settings/useCustomAiModels';

jest.mock('../../hooks/use-color-scheme', () => ({
    useColorScheme: () => 'light',
}));

jest.mock('react-native-safe-area-context', () => ({
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@expo/vector-icons', () => ({
    Ionicons: ({ name }: { name: string }) => {
        const React = jest.requireActual('react');
        const { Text } = jest.requireActual('react-native');
        return <Text>{name}</Text>;
    },
}));

function buildProps(): UseCustomAiModelsReturn {
    return {
        settings: {
            enabled: false,
            baseUrl: 'https://openrouter.ai/api/v1',
            apiKey: 'sk-or-test',
            selectedModelId: 'tencent/hy3:free',
            freeOnly: true,
            recentModelIds: ['tencent/hy3:free'],
            fallbackContextWindow: 128000,
            updatedAt: 1,
            models: [
                {
                    id: 'tencent/hy3:free',
                    name: 'Hy3 free',
                    contextWindow: 262000,
                    contextWindowSource: 'api',
                },
            ],
        },
        draft: {
            baseUrl: 'https://openrouter.ai/api/v1',
            apiKey: 'sk-or-test',
            fallbackContextWindow: '128000',
        },
        isLoading: false,
        isFetching: false,
        isSaving: false,
        status: { kind: 'idle', message: '' },
        setBaseUrl: jest.fn(),
        setApiKey: jest.fn(),
        setFallbackContextWindow: jest.fn(),
        fetchModels: jest.fn(),
        saveSettings: jest.fn(),
        selectModel: jest.fn(),
        setEnabled: jest.fn(),
        setFreeOnly: jest.fn(),
    };
}

describe('CustomModelSettingsSection', () => {
    it('renders AI model section with free-only controls', () => {
        render(<CustomModelSettingsSection {...buildProps()} />);

        expect(screen.getByLabelText('Custom AI API key')).toBeTruthy();
        expect(screen.getByLabelText('Free models only')).toBeTruthy();
        expect(screen.getByText('Hy3 free')).toBeTruthy();
        expect(screen.getByText(/free models cached/i)).toBeTruthy();
    });

    it('keeps the provider toggle pressable even when no models are loaded', () => {
        const props = buildProps();
        props.settings = { ...props.settings, models: [], selectedModelId: null };
        render(<CustomModelSettingsSection {...props} />);

        const toggle = screen.getByLabelText('Enable custom AI provider');
        expect(toggle.props.disabled).toBe(false);

        fireEvent(toggle, 'valueChange', true);
        expect(props.setEnabled).toHaveBeenCalledWith(true);
    });

    it('wires API key, fetch, save, and advanced base URL', () => {
        const props = buildProps();
        render(<CustomModelSettingsSection {...props} />);

        fireEvent.changeText(screen.getByLabelText('Custom AI API key'), 'new-key');
        fireEvent.press(screen.getByText('Fetch models'));
        fireEvent.press(screen.getByText('Save'));
        fireEvent.press(screen.getByLabelText('Advanced AI provider settings'));
        fireEvent.changeText(screen.getByLabelText('Custom AI base URL'), 'https://openrouter.ai');
        fireEvent.changeText(screen.getByLabelText('Fallback context tokens'), '64000');

        expect(props.setApiKey).toHaveBeenCalledWith('new-key');
        expect(props.fetchModels).toHaveBeenCalledTimes(1);
        expect(props.saveSettings).toHaveBeenCalledTimes(1);
        expect(props.setBaseUrl).toHaveBeenCalledWith('https://openrouter.ai');
        expect(props.setFallbackContextWindow).toHaveBeenCalledWith('64000');
    });
});
