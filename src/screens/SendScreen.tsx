import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { PublicKey, Transaction } from '@solana/web3.js';
import { COLORS, SPACING } from '../ui/theme';
import { Btn, Card, Field, Mono, Pill, SectionDivider, Sub, Title } from '../components/ui';
import { useRpc } from '../solana/rpc';
import { sendToStealthAddress } from '../solana/client';
import { signTransaction, connectWallet } from '../solana/mwa';
import { deriveStealthAddress, generateIdentity } from '../crypto/stealth';
import { announceBlob, appendAnnouncement, lamportsFromSol } from '../store/announcements';

export function SendScreen() {
  const { conn } = useRpc();
  const [spendPk, setSpendPk] = useState('');
  const [viewPk, setViewPk] = useState('');
  const [amount, setAmount] = useState('0.05');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ stealthAddress?: string; viewTag?: string; signature?: string; blob?: string }>({});

  const validKeys = useMemo(() => spendPk.length > 8 && viewPk.length > 8, [spendPk, viewPk]);

  const derived = useMemo(() => {
    if (!validKeys || parseFloat(amount) <= 0) return null;
    try {
      return deriveStealthAddress(spendPk.trim(), viewPk.trim());
    } catch {
      return null;
    }
  }, [spendPk, viewPk, amount, validKeys]);

  const generateRecipient = () => {
    const r = generateIdentity();
    setSpendPk(r.spendingPubkey);
    setViewPk(r.viewingPubkey);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Title>Send a stealth payment</Title>
        <Sub>Derive a one-time address from the recipient's meta keys, then pay it through your SMS wallet.</Sub>
      </View>

      <Card>
        <Field label="Recipient spending pk" value={spendPk} onChangeText={setSpendPk} placeholder="ed25519 public key" mono />
        <Field label="Recipient viewing pk" value={viewPk} onChangeText={setViewPk} placeholder="x25519 public key" mono />
        <Btn variant="ghost" title="Generate a demo recipient" onPress={generateRecipient} />
        <Field label={`Amount (SOL) — ${amount}`} value={amount} onChangeText={setAmount} placeholder="0.05" />
        <Btn variant="danger" title={busy ? 'Signing…' : 'Derive + send via wallet'} disabled={!validKeys || !derived} onPress={() => void doSend()} loading={busy} />
      </Card>

      {derived ? (
        <Card>
          <Title style={styles.cardTitle}>Derived stealth address</Title>
          <Pill>{'view tag ' + derived.viewTag}</Pill>
          <Mono selectable style={styles.big}>
            {derived.stealthAddress}
          </Mono>
          <Text style={styles.hint}>ephemeral</Text>
          <Mono selectable>{derived.ephemeralPubkey}</Mono>
          <Text style={styles.hint}>The public key exists only for this payment. Only the recipient's view key can detect it.</Text>
        </Card>
      ) : null}

      {result.signature ? (
        <Card>
          <Title style={styles.cardTitle}>Sent ✓</Title>
          <Mono selectable style={styles.big}>…{result.signature.slice(-16)}</Mono>
          <Btn title="Copy announcement" onPress={() => void Clipboard.setStringAsync(result.blob ?? '')} />
          <Mono selectable>{result.blob}</Mono>
          <Text style={styles.hint}>Share this blob with the recipient — it is public and unlinkable to them until a scan.</Text>
        </Card>
      ) : null}
      <SectionDivider />
      <View style={styles.footer}>
        <Text style={styles.dimText}>
          Privacy: the receiver derives the spending key for {derived?.stealthAddress.slice(0, 12) ?? '…'} using their{' '}
          viewing + spending secrets. No third party can link the address to them.
        </Text>
      </View>
    </View>
  );

  async function doSend() {
    if (!derived) return;
    setBusy(true);
    setResult({});
    try {
      const lamports = lamportsFromSol(amount);
      const cw = await connectWallet();
      const payer = new PublicKey(cw.address);
      const signed = async (tx: Transaction) => signTransaction(tx);
      const res = await sendToStealthAddress(conn, payer, new PublicKey(derived.stealthAddress), lamports, signed);
      const blob = announceBlob({ ephemeralPubkey: derived.ephemeralPubkey, viewTag: derived.viewTagInt, amountLamports: lamports, index: 0 });
      await appendAnnouncement({
        id: `ann-${Date.now()}`,
        ephemeralPubkey: derived.ephemeralPubkey,
        viewTag: derived.viewTagInt,
        amountLamports: lamports,
        index: 0,
        createdAt: Date.now(),
        signature: res.signature,
      });
      setResult({ stealthAddress: res.stealthAddress, viewTag: derived.viewTag, signature: res.signature, blob });
    } catch (e) {
      setResult({});
      alert('Send failed: ' + String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: SPACING.lg },
  header: { marginBottom: SPACING.lg },
  cardTitle: { fontSize: 14 },
  big: { fontSize: 13, marginVertical: SPACING.sm },
  hint: { color: COLORS.textDim, fontSize: 11, marginTop: SPACING.xs },
  dimText: { color: COLORS.textDim, fontSize: 12 },
  footer: { flex: 1, justifyContent: 'flex-end' },
});