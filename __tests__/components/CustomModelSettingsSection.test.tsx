import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { CustomModelSettingsSection } from '../../components/settings/CustomModelSettingsSection';
import type { UseCustomAiModelsReturn } from '../../hooks/settings/useCustomAiModels';
import {
    TEST_PROVIDER_HOST,
    makeProviderSettings,
    testModel,
} from '../mocks/providerSettings';

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

const HY3 = { ...testModel('tencent/hy3:free', 262_000), name: 'Hy3 free' };

function buildProps(): UseCustomAiModelsReturn {
    const settings = makeProviderSettings({
        enabled: false,
        selectedModelId: HY3.id,
        models: [HY3],
        recentModelIds: [HY3.id],
        modelFilterPatterns: [':free'],
        label: 'Work provider',
    });

    return {
        settings,
        profile: settings.profiles[0],
        draft: {
            label: 'Work provider',
            baseUrl: TEST_PROVIDER_HOST,
            apiKey: 'test-key',
            fallbackContextWindow: '128000',
            modelFilterPatterns: ':free',
        },
        isLoading: false,
        isFetching: false,
        isSaving: false,
        status: { kind: 'idle', message: '' },
        setLabel: jest.fn(),
        setBaseUrl: jest.fn(),
        setApiKey: jest.fn(),
        setFallbackContextWindow: jest.fn(),
        setModelFilterPatterns: jest.fn(),
    clearModelFilter: jest.fn(),
        fetchModels: jest.fn(),
        saveSettings: jest.fn(),
        selectModel: jest.fn(),
        addManualModel: jest.fn().mockResolvedValue(undefined),
        setEnabled: jest.fn(),
        addProfile: jest.fn().mockResolvedValue(undefined),
        removeActiveProfile: jest.fn().mockResolvedValue(undefined),
        selectProfile: jest.fn().mockResolvedValue(undefined),
        renameProfile: jest.fn().mockResolvedValue(undefined),
    };
}

describe('CustomModelSettingsSection', () => {
    it('renders the provider section with the active model and its host', () => {
        render(<CustomModelSettingsSection {...buildProps()} />);

        expect(screen.getByLabelText('AI access key')).toBeTruthy();
        expect(screen.getByLabelText('Turn on your own AI service')).toBeTruthy();
        expect(screen.getByLabelText('Change AI')).toBeTruthy();
        expect(screen.getByText('Hy3 free')).toBeTruthy();
        expect(screen.getByText('api.example.com')).toBeTruthy();
        expect(screen.getByText(/1 AI option saved\./)).toBeTruthy();
    });

    it('flags the picker as filtered when the profile carries filter patterns', () => {
        render(<CustomModelSettingsSection {...buildProps()} />);

        expect(screen.getByText('Narrowed')).toBeTruthy();
    });

    it('omits the filtered flag when the profile has no filter patterns', () => {
        const props = buildProps();
        props.profile = { ...props.profile!, modelFilterPatterns: [] };
        render(<CustomModelSettingsSection {...props} />);

        expect(screen.queryByText('Narrowed')).toBeNull();
    });

    it('keeps the provider toggle pressable even when no models are loaded', () => {
        const props = buildProps();
        props.profile = { ...props.profile!, models: [], selectedModelId: null };
        render(<CustomModelSettingsSection {...props} />);

        const toggle = screen.getByLabelText('Turn on your own AI service');
        // AnimatedSwitch surfaces disabled state via accessibilityState, not props.disabled.
        expect(toggle.props.accessibilityState.disabled).toBe(false);

        fireEvent.press(toggle);
        expect(props.setEnabled).toHaveBeenCalledWith(true);
    });

    it('wires API key, fetch, save, and the advanced provider fields', () => {
        const props = buildProps();
        render(<CustomModelSettingsSection {...props} />);

        fireEvent.changeText(screen.getByLabelText('AI access key'), 'new-key');
        // Base URL and Provider name are in the main form now — reachable with
        // Advanced collapsed.
        fireEvent.changeText(screen.getByLabelText('AI service address'), 'https://api.other.test/v1');
        fireEvent.changeText(screen.getByLabelText('Service name'), 'Renamed');
        fireEvent.press(screen.getByText('Find AI options'));
        fireEvent.press(screen.getByText('Save'));
        fireEvent.press(screen.getByLabelText('Advanced AI settings'));
        fireEvent.changeText(screen.getByLabelText('Words to match in option names'), ':free,qwen-web/');
        fireEvent.changeText(screen.getByLabelText('Memory size if not detected'), '64000');

        expect(props.setApiKey).toHaveBeenCalledWith('new-key');
        expect(props.fetchModels).toHaveBeenCalledTimes(1);
        expect(props.saveSettings).toHaveBeenCalledTimes(1);
        expect(props.setLabel).toHaveBeenCalledWith('Renamed');
        expect(props.setBaseUrl).toHaveBeenCalledWith('https://api.other.test/v1');
        expect(props.setModelFilterPatterns).toHaveBeenCalledWith(':free,qwen-web/');
        expect(props.setFallbackContextWindow).toHaveBeenCalledWith('64000');
    });

    // Regression guard. The fields you cannot add a service without must be in
    // the main form, not inside the collapsed "Advanced" block. Address: without
    // it there is nothing to reach. Service name: without it a freshly added
    // service keeps its generated "AI service 2" title, which is what the user hit.
    //
    // The test above could not catch either — it pressed the Advanced toggle
    // first, so it found the fields wherever they lived.
    it('offers the address and service name without expanding Advanced', () => {
        const props = buildProps();
        render(<CustomModelSettingsSection {...props} />);

        // No press on the Advanced toggle anywhere in this test.
        expect(screen.queryByLabelText('Words to match in option names')).toBeNull();
        expect(screen.getByLabelText('AI service address')).toBeTruthy();
        expect(screen.getByLabelText('Service name')).toBeTruthy();

        fireEvent.changeText(screen.getByLabelText('AI service address'), 'https://api.mine.test/v1');
        expect(props.setBaseUrl).toHaveBeenCalledWith('https://api.mine.test/v1');

        fireEvent.changeText(screen.getByLabelText('Service name'), 'My gateway');
        expect(props.setLabel).toHaveBeenCalledWith('My gateway');
    });

    it('disables Save while the profile has no cached models', () => {
        const props = buildProps();
        props.profile = { ...props.profile!, models: [] };
        render(<CustomModelSettingsSection {...props} />);

        fireEvent.press(screen.getByText('Save'));

        expect(props.saveSettings).not.toHaveBeenCalled();
    });

    // Kept synchronous: in an async test the advanced panel's inputs are not
    // yet attached when `changeText` runs, so RNTL cannot resolve the host view.
    it('adds a manual model from the advanced section', () => {
        const props = buildProps();
        render(<CustomModelSettingsSection {...props} />);

        fireEvent.press(screen.getByLabelText('Advanced AI settings'));
        fireEvent.changeText(screen.getByLabelText('AI option name'), 'qwen-web/qwen3.8-max');
        fireEvent.press(screen.getByLabelText('Add option by name'));

        expect(props.addManualModel).toHaveBeenCalledWith('qwen-web/qwen3.8-max');
    });

    it('does not call addManualModel with a blank id', () => {
        const props = buildProps();
        render(<CustomModelSettingsSection {...props} />);

        fireEvent.press(screen.getByLabelText('Advanced AI settings'));
        // The Add button is disabled while the input is empty.
        expect(screen.getByLabelText('Add option by name').props.accessibilityState.disabled).toBe(true);
        expect(props.addManualModel).not.toHaveBeenCalled();
    });

    it('offers Add service, and Remove only once a second profile exists', () => {
        const single = buildProps();
        render(<CustomModelSettingsSection {...single} />);

        fireEvent.press(screen.getByText('Add service'));
        // "Add service" now asks which service first; nothing is created until
        // the user picks one (see the service-kind tests below).
        expect(single.addProfile).not.toHaveBeenCalled();
        expect(screen.queryByText('Saved services')).toBeNull();
        expect(screen.queryByText('Remove')).toBeNull();

        const multi = buildProps();
        const second = { ...multi.settings.profiles[0], id: 'profile-2', label: 'Second AI service' };
        multi.settings = { ...multi.settings, profiles: [multi.settings.profiles[0], second] };
        render(<CustomModelSettingsSection {...multi} />);

        expect(screen.getByText('Saved services')).toBeTruthy();
        fireEvent.press(screen.getByLabelText('Use Second AI service'));
        expect(multi.selectProfile).toHaveBeenCalledWith('profile-2');

        fireEvent.press(screen.getByText('Remove'));
        expect(multi.removeActiveProfile).toHaveBeenCalledTimes(1);
    });

    it('asks for the service type and adds the one the user picked', () => {
        const props = buildProps();
        render(<CustomModelSettingsSection {...props} />);

        fireEvent.press(screen.getByText('Add service'));

        // All three kinds are offered, by name — this is the whole point of the
        // modal: a Google or Anthropic user should not have to know that their
        // service happens to work the way OpenAI does.
        expect(screen.getByLabelText('Add OpenAI compatible as the AI service')).toBeTruthy();
        expect(screen.getByLabelText('Add Google AI Studio as the AI service')).toBeTruthy();
        expect(screen.getByLabelText('Add Anthropic as the AI service')).toBeTruthy();

        fireEvent.press(screen.getByLabelText('Add Anthropic as the AI service'));
        expect(props.addProfile).toHaveBeenCalledWith('anthropic');
    });

    it('adds nothing when the service-type sheet is cancelled', () => {
        const props = buildProps();
        render(<CustomModelSettingsSection {...props} />);

        fireEvent.press(screen.getByText('Add service'));
        fireEvent.press(screen.getByLabelText('Cancel adding a service'));

        expect(props.addProfile).not.toHaveBeenCalled();
        expect(screen.queryByLabelText('Add Anthropic as the AI service')).toBeNull();
    });

    it('constrains a long saved-provider chip so it cannot overflow its row', () => {
        const props = buildProps();
        const longLabel = 'Work account with a deliberately long provider name';
        const second = { ...props.settings.profiles[0], id: 'profile-2', label: longLabel };
        props.settings = { ...props.settings, profiles: [props.settings.profiles[0], second] };
        render(<CustomModelSettingsSection {...props} />);

        // Measured in the browser at 390px: an unconstrained chip sized to its
        // label (396px) inside a 342px row, so it ran 30px past the viewport with
        // no right border and a hard-clipped word. The guard sits on a plain child
        // View, not the pressable — `className` is dropped on pressables here
        // (AGENTS.md), so asserting on the TouchableOpacity would assert nothing.
        const chip = screen.getByTestId('provider-chip-profile-2');
        expect(chip.props.className).toContain('max-w-full');
        expect(chip.props.className).toContain('min-w-0');
        expect(screen.getByText(longLabel).props.numberOfLines).toBe(1);
    });
});
