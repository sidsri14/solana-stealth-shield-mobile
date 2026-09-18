import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { Buffer } from 'buffer';
import { COLORS, SPACING } from '../ui/theme';
import { Btn, Card, Field, Mono, Pill } from '../components/ui';
import { useRpc } from '../solana/rpc';
import { connectWallet } from '../solana/mwa';
import { Announcement, announceBlob, loadAnnouncements } from '../store/announcements';
import { StealthIdentity, scanStealthAddress } from '../crypto/stealth';
import { deriveSweepKey, signWithScalar } from '../crypto/sweep';

const SCAN_FEE = 5000;

export function ScanScreen({ identity }: { identity: StealthIdentity | null }) {
  const { conn } = useRpc();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [importBlob, setImportBlob] = useState('');
  const [overrideViewPriv, setOverrideViewPriv] = useState('');
  const [overrideSpendPriv, setOverrideSpendPriv] = useState('');
  const [scanned, setScanned] = useState(0);
  const [busy, setBusy] = useState(false);
  const [sweepLog, setSweepLog] = useState<string | null>(null);

  const reload = useCallback(async () => setAnnouncements(await loadAnnouncements()), []);
  useEffect(() => {
    void reload();
  }, [reload]);

  const scanKeys = useMemo(() => {
    if (identity && overrideViewPriv && overrideSpendPriv) {
      return { viewPriv: overrideViewPriv, spendPriv: overrideSpendPriv, label: 'override' };
    }
    if (identity) return { viewPriv: identity.viewingPrivkey, spendPriv: identity.spendingPrivkey, label: 'me' };
    return null;
  }, [identity, overrideViewPriv, overrideSpendPriv]);

  const matched = useMemo(() => {
    if (!scanKeys) return [];
    return announcements
      .map((a) => {
        const s = scanStealthAddress(scanKeys.viewPriv, scanKeys.spendPriv, a.ephemeralPubkey, a.viewTag, a.index);
        return s.matched && s.stealthAddress ? { announcement: a, stealthAddress: s.stealthAddress } : null;
      })
      .filter((r): r is { announcement: Announcement; stealthAddress: string } => r !== null);
  }, [announcements, scanKeys]);

  const doImport = async () => {
    try {
      const { addImportedAnnouncement } = await import('../store/announcements');
      await addImportedAnnouncement(importBlob);
      setImportBlob('');
      await reload();
    } catch (e) {
      alert(String(e instanceof Error ? e.message : e));
    }
  };

  const copyAll = async () => {
    const blob = announcements.map((a) => announceBlob(a)).join('\n');
    await Clipboard.setStringAsync(blob);
    setSweepLog('copied announcement blobs');
  };

  const sweep = async (a: Announcement) => {
    if (!scanKeys) return;
    setBusy(true);
    setSweepLog(null);
    try {
      const sweepKey = deriveSweepKey(scanKeys.viewPriv, scanKeys.spendPriv, a.ephemeralPubkey, a.viewTag, a.index);
      if (!sweepKey.matched || !sweepKey.scalarBytes) throw new Error('cannot derive sweep key for this announcement');
      const cw = await connectWallet();
      const target = new PublicKey(cw.address);
      const scalar = sweepKey.scalarBytes;
      const derivedPub = new PublicKey(sweepKey.stealthAddress!);
      const amount = Math.max(0, a.amountLamports - SCAN_FEE);
      const tx = new Transaction();
      tx.feePayer = derivedPub;
      tx.add(SystemProgram.transfer({ fromPubkey: derivedPub, toPubkey: target, lamports: amount }));
      const message = tx.serializeMessage();
      const { signature } = signWithScalar(sha256(message), scalar);
      tx.addSignature(derivedPub, Buffer.from(signature));
      await conn.sendRawTransaction(tx.serialize());
      const { markAnnouncementSwept } = await import('../store/announcements');
      setAnnouncements(await markAnnouncementSwept(a.id, 'swept'));
      setSweepLog(`swept ${(amount / 1e9).toLocaleString('en-US', { maximumFractionDigits: 4 })} SOL → ${target.toString().slice(0, 8)}…`);
    } catch (e) {
      setSweepLog('sweep failed: ' + String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pill>on-device · view-tag scan</Pill>
        <Text style={styles.title}>Scan incoming stealth payments</Text>
        <Text style={styles.sub}>
          {announcements.length} announcements, {matched.length} matched by your view keys.
          {scanned > 0 ? ` last scan found ${scanned}.` : ''}
        </Text>
      </View>

      <Card>
        <Field label="Paste a public announcement (stealth1:…)" value={importBlob} onChangeText={setImportBlob} mono placeholder="stealth1:…" />
        <View style={styles.row}>
          <View style={styles.rowBtn}>
            <Btn title="Import" onPress={() => void doImport()} />
          </View>
          <View style={styles.rowBtn}>
            <Btn variant="ghost" title="Copy all" onPress={() => void copyAll()} />
          </View>
          <View style={styles.rowBtn}>
            <Btn
              variant="success"
              title={busy ? '…' : `Scan (${announcements.length})`}
              onPress={() => {
                setScanned(matched.length);
                setBusy(false);
              }}
            />
          </View>
        </View>
      </Card>

      {scanKeys?.label === 'override' ? (
        <Card>
          <Field label="Override viewing privkey (scan as other party)" value={overrideViewPriv} onChangeText={setOverrideViewPriv} mono />
          <Field label="Override spending privkey" value={overrideSpendPriv} onChangeText={setOverrideSpendPriv} mono />
        </Card>
      ) : (
        <Btn
          variant="ghost"
          title="Scan as another identity (paste their private keys)"
          onPress={() => setOverrideViewPriv('paste-here')}
        />
      )}

      {sweepLog ? <Text style={styles.sweep}>{sweepLog}</Text> : null}

      <FlatList
        data={matched}
        keyExtractor={(item) => item.announcement.id}
        ListEmptyComponent={
          <Card>
            <Text style={styles.dim}>No matched payments yet. Send one from the Send tab, or import a blob.</Text>
          </Card>
        }
        renderItem={({ item }) => (
          <Card style={styles.payCard}>
            <View style={styles.rowBetween}>
              <Pill color={COLORS.mint}>{'RECEIVED ' + (item.announcement.amountLamports / 1e9).toLocaleString('en-US')} SOL</Pill>
              {item.announcement.swept ? <Pill color={COLORS.textDim}>swept</Pill> : null}
            </View>
            <Text style={styles.dim}>stealth address</Text>
            <Mono selectable>{item.stealthAddress}</Mono>
            {!item.announcement.swept ? (
              <Btn title={busy ? '…' : 'Sweep to my wallet'} onPress={() => void sweep(item.announcement)} />
            ) : null}
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: SPACING.lg },
  header: { marginBottom: SPACING.lg },
  title: { color: COLORS.text, fontSize: 18, fontWeight: '700', marginTop: SPACING.xs },
  sub: { color: COLORS.textDim, fontSize: 13, marginTop: 2 },
  row: { flexDirection: 'row' },
  rowBtn: { flex: 1, marginRight: SPACING.xs },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.xs },
  dim: { color: COLORS.textDim, fontSize: 12, marginTop: 4 },
  sweep: { color: COLORS.mint, fontSize: 12, marginBottom: SPACING.sm },
  payCard: { borderColor: COLORS.mint },
});