// Jest setup (runs after the test framework is installed)
// Keep test output clean by mocking modules that schedule async updates.

jest.mock('@expo/vector-icons', () => {
    const NullIcon = () => null;
    NullIcon.displayName = 'ExpoVectorIcon';

    return {
        __esModule: true,
        Ionicons: NullIcon,
        MaterialIcons: NullIcon,
    };
});

jest.mock('@expo/vector-icons/MaterialIcons', () => {
    const NullIcon = () => null;
    NullIcon.displayName = 'MaterialIcons';

    return {
        __esModule: true,
        default: NullIcon,
    };
});

jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
