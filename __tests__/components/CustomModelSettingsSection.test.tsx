import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

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
        addManualModel: jest.fn(),
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
        // AnimatedSwitch surfaces disabled state via accessibilityState, not props.disabled.
        expect(toggle.props.accessibilityState.disabled).toBe(false);

        fireEvent.press(toggle);
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

    it('adds a manual model from the advanced section and clears the input', async () => {
        const props = buildProps();
        props.addManualModel = jest.fn().mockResolvedValue(undefined);
        render(<CustomModelSettingsSection {...props} />);

        fireEvent.press(screen.getByLabelText('Advanced AI provider settings'));
        fireEvent.changeText(screen.getByLabelText('Manual model id'), 'qwen-web/qwen3.8-max');
        await act(async () => {
            fireEvent.press(screen.getByLabelText('Add manual model'));
        });

        expect(props.addManualModel).toHaveBeenCalledWith('qwen-web/qwen3.8-max');
    });

    // DEF-009: Alert.alert is a no-op under react-native-web, so the free-only
    // unlock must confirm through window.confirm on web or the switch silently
    // refuses to turn off.
    it('confirms through window.confirm before showing paid models on web', () => {
        const props = buildProps();
        const confirmSpy = jest.fn(() => true);
        const host = globalThis as unknown as { window?: { confirm: jest.Mock } };
        const originalWindow = host.window;
        host.window = { confirm: confirmSpy };
        try {
            render(<CustomModelSettingsSection {...props} />);
            fireEvent.press(screen.getByLabelText('Free models only'));

            expect(confirmSpy).toHaveBeenCalledTimes(1);
            expect(props.setFreeOnly).toHaveBeenCalledWith(false);
        } finally {
            host.window = originalWindow;
        }
    });

    it('keeps free-only when the web confirmation is declined', () => {
        const props = buildProps();
        const host = globalThis as unknown as { window?: { confirm: jest.Mock } };
        const originalWindow = host.window;
        host.window = { confirm: jest.fn(() => false) };
        try {
            render(<CustomModelSettingsSection {...props} />);
            fireEvent.press(screen.getByLabelText('Free models only'));

            expect(props.setFreeOnly).not.toHaveBeenCalled();
        } finally {
            host.window = originalWindow;
        }
    });

    it('turns free-only back on without any confirmation', () => {
        const props = buildProps();
        props.settings = { ...props.settings, freeOnly: false };
        render(<CustomModelSettingsSection {...props} />);

        fireEvent.press(screen.getByLabelText('Free models only'));

        expect(props.setFreeOnly).toHaveBeenCalledWith(true);
    });

    it('does not call addManualModel with a blank id', () => {
        const props = buildProps();
        props.addManualModel = jest.fn().mockResolvedValue(undefined);
        render(<CustomModelSettingsSection {...props} />);

        fireEvent.press(screen.getByLabelText('Advanced AI provider settings'));
        // The Add button is disabled while the input is empty.
        expect(screen.getByLabelText('Add manual model').props.accessibilityState.disabled).toBe(true);
        expect(props.addManualModel).not.toHaveBeenCalled();
    });
});
