/**
 * Index Route
 * Redirects to the Today tab on app launch
 */

import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/(tabs)/today" />;
}
