import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { CustomModelSettingsSection } from '../../components/settings/CustomModelSettingsSection';
import type { UseCustomAiModelsReturn } from '../../hooks/settings/useCustomAiModels';

jest.mock('../../hooks/use-color-scheme', () => ({
    useColorScheme: () => 'light',
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
            selectedModelId: 'openai/gpt-4',
            fallbackContextWindow: 128000,
            updatedAt: 1,
            models: [
                {
                    id: 'openai/gpt-4',
                    name: 'GPT-4',
                    contextWindow: 8192,
                    contextWindowSource: 'api',
                },
                {
                    id: 'local/unknown',
                    contextWindow: 128000,
                    contextWindowSource: 'fallback',
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
    };
}

describe('CustomModelSettingsSection', () => {
    it('renders provider inputs, model metadata, and fallback warnings', () => {
        render(<CustomModelSettingsSection {...buildProps()} />);

        expect(screen.getByLabelText('Custom AI base URL')).toBeTruthy();
        expect(screen.getByLabelText('Custom AI API key')).toBeTruthy();
        expect(screen.getByText('GPT-4')).toBeTruthy();
        expect(screen.getByText('Context: 8,192 tokens')).toBeTruthy();
        expect(screen.getByText(/Fallback tokens are used/)).toBeTruthy();
    });

    it('wires input edits and model actions', () => {
        const props = buildProps();
        render(<CustomModelSettingsSection {...props} />);

        fireEvent.changeText(screen.getByLabelText('Custom AI base URL'), 'https://openrouter.ai');
        fireEvent.changeText(screen.getByLabelText('Custom AI API key'), 'new-key');
        fireEvent.changeText(screen.getByLabelText('Fallback context tokens'), '64000');
        fireEvent.press(screen.getByText('Fetch models'));
        fireEvent.press(screen.getByText('Save'));
        fireEvent.press(screen.getAllByText('local/unknown')[0]);

        expect(props.setBaseUrl).toHaveBeenCalledWith('https://openrouter.ai');
        expect(props.setApiKey).toHaveBeenCalledWith('new-key');
        expect(props.setFallbackContextWindow).toHaveBeenCalledWith('64000');
        expect(props.fetchModels).toHaveBeenCalledTimes(1);
        expect(props.saveSettings).toHaveBeenCalledTimes(1);
        expect(props.selectModel).toHaveBeenCalledWith('local/unknown');
    });
});
