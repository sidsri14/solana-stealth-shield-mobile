import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PublicKey } from '@solana/web3.js';
import { COLORS, SPACING } from '../ui/theme';
import { Btn, Card, Mono, Pill, SectionDivider, Sub, Title } from '../components/ui';
import { useRpc } from '../solana/rpc';
import { buildRegisterMetaKeyIx, fetchMetaKey } from '../solana/client';
import { connectWallet, signAndSend } from '../solana/mwa';
import { StealthIdentity, stealthMetaAddress, PROGRAM_ID } from '../crypto/stealth';
import { base58ToBytes } from '../crypto/base58';

export function HomeScreen({
  identity,
  onCreateIdentity,
  onReset,
}: {
  identity: StealthIdentity | null;
  onCreateIdentity: () => Promise<void>;
  onReset: () => Promise<void>;
}) {
  const { conn } = useRpc();
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [wallet, setWallet] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ owner: string; registeredAt: number } | null>(null);

  const push = (m: string) => setLog((prev) => [...prev.slice(-9), m]);

  if (!identity) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Title>StealthShield ⟠ Mobile</Title>
        <Sub>
          Private payments for the Solana Mobile Seeker. Real X25519 stealth addresses, view-tag scanning on-device,
          and the StealthShield on-chain registry — signed through your Solana Mobile Stack wallet.
        </Sub>
        <Btn title="Create your StealthShield identity" onPress={() => void onCreateIdentity()} />
        <Card>
          <Pill>zero-knowledge · zcash-grade stealth</Pill>
          <Sub>Keys are generated on-device and stored in the Secure Enclave. Nothing leaves your phone.</Sub>
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Title>StealthShield ⟠ Mobile</Title>
      <Sub>Your meta keys, registered on-chain.</Sub>

      <Card>
        <Title style={styles.cardTitle}>Stealth Identity</Title>
        <Mono selectable>{stealthMetaAddress(identity.spendingPubkey, identity.viewingPubkey)}</Mono>
        <SectionDivider />
        <View style={styles.kv}>
          <Text style={styles.k}>spending pk</Text>
          <Mono selectable style={styles.v}>
            {identity.spendingPubkey.slice(0, 20)}…
          </Mono>
        </View>
        <View style={styles.kv}>
          <Text style={styles.k}>viewing pk</Text>
          <Mono selectable style={styles.v}>
            {identity.viewingPubkey.slice(0, 20)}…
          </Mono>
        </View>
        <View style={styles.kv}>
          <Text style={styles.k}>created</Text>
          <Text style={styles.v}>{new Date(identity.createdAt).toLocaleString()}</Text>
        </View>
        <Btn
          variant="ghost"
          title={busy ? 'Signing…' : wallet ? 'Register meta keys on-chain' : 'Connect wallet + register'}
          onPress={() => void register()}
          loading={busy}
        />
        {log.map((line, i) => (
          <Mono key={i} style={[styles.log, i === 0 && styles.logFresh]}>
            → {line}
          </Mono>
        ))}
      </Card>

      <Card>
        <Title style={styles.cardTitle}>On-chain registry</Title>
        <Text style={styles.label4}>program</Text>
        <Mono selectable>{PROGRAM_ID}</Mono>
        <Text style={styles.label4}>meta account</Text>
        <Text style={styles.dimText}>
          {meta
            ? `✓ registered — owner ${meta.owner.slice(0, 8)}… on ${new Date(meta.registeredAt * 1000).toLocaleString()}`
            : 'not registered yet'}
        </Text>
      </Card>

      <Btn variant="danger" title="Reset identity" onPress={() => void onReset()} />
    </ScrollView>
  );

  async function register() {
    if (!identity) return;
    setBusy(true);
    setLog([]);
    try {
      push('opening Mobile Wallet Adapter session…');
      const cw = await connectWallet();
      setWallet(cw.address);
      push(`authorized ${cw.label} ${shortAddr(cw.address)}`);
      const payer = new PublicKey(cw.address);
      const tx = buildRegisterMetaKeyIx(payer, base58ToBytes(identity.spendingPubkey), base58ToBytes(identity.viewingPubkey));
      push('asking wallet to sign register_meta_key…');
      const { signature } = await signAndSend(tx);
      push(`confirmed ${signature.slice(0, 40)}…`);
      const metaKey = await fetchMetaKey(conn, payer);
      if (metaKey) {
        setMeta({ owner: metaKey.owner.toString(), registeredAt: metaKey.registeredAt });
        push('meta key verified on-chain');
      } else {
        push('meta account not found — is the program deployed on this RPC?');
      }
    } catch (e) {
      push('error: ' + String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }
}

function shortAddr(a: string): string {
  return a.slice(0, 6) + '…' + a.slice(-4);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  cardTitle: { fontSize: 14, marginBottom: SPACING.sm },
  kv: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.xs },
  k: { color: COLORS.textDim, fontSize: 12 },
  v: { color: COLORS.text, fontSize: 12 },
  log: { color: COLORS.textDim, fontSize: 11, marginTop: SPACING.xs },
  logFresh: { color: COLORS.mint },
  label4: { color: COLORS.textDim, fontSize: 11, marginTop: SPACING.sm },
  dimText: { color: COLORS.textDim, fontSize: 12, marginTop: 2 },
});