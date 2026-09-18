import './src/polyfills';
import React, { useCallback, useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { RpcProvider } from './src/solana/rpc';
import { createIdentity, clearIdentity, loadIdentity } from './src/store/identity';
import { StealthIdentity } from './src/crypto/stealth';
import { HomeScreen } from './src/screens/HomeScreen';
import { SendScreen } from './src/screens/SendScreen';
import { ScanScreen } from './src/screens/ScanScreen';
import { WalletScreen } from './src/screens/WalletScreen';
import { COLORS } from './src/ui/theme';

type Tab = 'home' | 'send' | 'scan' | 'wallet';

const TABS: { key: Tab; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'send', label: 'Send' },
  { key: 'scan', label: 'Scan' },
  { key: 'wallet', label: 'Wallet' },
];

export default function App() {
  return (
    <SafeAreaProvider>
      <RpcProvider>
        <Root />
      </RpcProvider>
    </SafeAreaProvider>
  );
}

function Root() {
  const [tab, setTab] = useState<Tab>('home');
  const [identity, setIdentity] = useState<StealthIdentity | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      const existing = await loadIdentity();
      setIdentity(existing);
      setLoaded(true);
    })();
  }, []);

  const onCreateIdentity = useCallback(async () => {
    const id = await createIdentity();
    setIdentity(id);
  }, []);

  const onReset = useCallback(async () => {
    await clearIdentity();
    setIdentity(null);
  }, []);

  if (!loaded) return <View style={styles.boot} />;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.body}>
        {tab === 'home' ? <HomeScreen identity={identity} onCreateIdentity={onCreateIdentity} onReset={onReset} /> : null}
        {tab === 'send' ? <SendScreen /> : null}
        {tab === 'scan' ? <ScanScreen identity={identity} /> : null}
        {tab === 'wallet' ? <WalletScreen /> : null}
      </View>
      <View style={styles.tabBar}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <Pressable key={t.key} style={styles.tab} onPress={() => setTab(t.key)}>
              <View style={[styles.tabDot, active && styles.tabDotActive]} />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  boot: { flex: 1, backgroundColor: COLORS.bg },
  body: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingVertical: 8,
  },
  tab: { flex: 1, alignItems: 'center', gap: 4 },
  tabDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.border },
  tabDotActive: { backgroundColor: COLORS.accent },
  tabLabel: { color: COLORS.textDim, fontSize: 12, fontWeight: '600' },
  tabLabelActive: { color: COLORS.text },
});