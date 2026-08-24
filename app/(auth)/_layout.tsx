import { Stack } from 'expo-router';

export default function AuthLayout() {
    return (
        <Stack initialRouteName="login" screenOptions={{ headerShown: false }}>
            <Stack.Screen name="login" />
            <Stack.Screen name="signup" />
            <Stack.Screen name="forgot-password" />
            <Stack.Screen name="update-password" />
        </Stack>
    );
}
