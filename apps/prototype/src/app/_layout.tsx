import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PrototypeProvider } from '@/components/prototype-provider';
import { palette } from '@/components/ui';

export default function RootLayout() { return <PrototypeProvider><StatusBar style="light" /><Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: palette.rainforest } }} /></PrototypeProvider>; }
