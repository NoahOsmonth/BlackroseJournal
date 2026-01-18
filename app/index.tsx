/**
 * Index Route
 * Redirects to the main entries tab on app launch
 */

import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/(tabs)/entries" />;
}
