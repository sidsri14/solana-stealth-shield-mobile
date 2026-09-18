import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import { COLORS, SPACING } from '../ui/theme';
import { Btn, Card, Field, Mono, Pill } from '../components/ui';
import { useRpc, useConnectionOnline } from '../solana/rpc';
import { connectWallet } from '../solana/mwa';
import { fetchRecentTransfers } from '../solana/client';

interface TxRow {
  signature: string;
  from: string;
  to: string;
  lamports: number;
}

export function WalletScreen() {
  const { rpcUrl, setRpcUrl, conn } = useRpc();
  const online = useConnectionOnline(conn);
  const [wallet, setWallet] = useState<string | null>(null);
  const [walletLabel, setWalletLabel] = useState('');
  const [balance, setBalance] = useState<number | null>(null);
  const [txs, setTxs] = useState<TxRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState('');

  const refresh = useCallback(async () => {
    if (!wallet) return;
    try {
      const pk = new PublicKey(wallet);
      const [bal, transfers] = await Promise.all([
        conn.getBalance(pk),
        fetchRecentTransfers(conn, pk),
      ]);
      setBalance(bal);
      setTxs(transfers);
    } catch (e) {
      setLog(String(e instanceof Error ? e.message : e));
    }
  }, [conn, wallet]);

  useEffect(() => {
    if (wallet) void refresh();
  }, [wallet, refresh]);

  const connect = async () => {
    setBusy(true);
    setLog('');
    try {
      const cw = await connectWallet();
      setWallet(cw.address);
      setWalletLabel(cw.label);
    } catch (e) {
      setLog(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  };

  const faucet = async () => {
    if (!wallet) return;
    setBusy(true);
    setLog('');
    try {
      const Pk = new PublicKey(wallet);
      await conn.requestAirdrop(Pk, 2 * LAMPORTS_PER_SOL);
      setLog('airdrop requested — 2 SOL');
      await refresh();
    } catch (e) {
      setLog('airdrop failed: ' + String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pill color={online ? COLORS.mint : COLORS.danger}>{online ? 'RPC online' : 'RPC offline'}</Pill>
        <Text style={styles.title}>Wallet &amp; network</Text>
        <Text style={styles.sub}>Sign transactions through the Solana Mobile Stack (Mobile Wallet Adapter).</Text>
      </View>

      <Card>
        <Text style={styles.dim}>RPC endpoint</Text>
        <Field value={rpcUrl} onChangeText={setRpcUrl} mono placeholder="http://…" />
        {!online ? (
          <Text style={styles.warn}>
            Point this at your demo validator (local tunnel) or a devnet RPC. Try http://127.0.0.1:8899 for a local
            solana-test-validator.
          </Text>
        ) : null}
        <Btn
          title={wallet ? `Connected: ${wallet.slice(0, 6)}…${wallet.slice(-4)}` : 'Connect Solana Mobile wallet'}
          onPress={() => void connect()}
          loading={busy}
        />
        {balance !== null ? (
          <Text style={styles.bal}>
            {(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL {walletLabel ? `· ${walletLabel}` : ''}
          </Text>
        ) : null}
        {wallet ? (
          <View style={styles.row}>
            <View style={styles.rowBtn}>
              <Btn variant="ghost" title="Faucet 2 SOL" onPress={() => void faucet()} />
            </View>
            <View style={styles.rowBtn}>
              <Btn variant="ghost" title="Refresh" onPress={() => void refresh()} />
            </View>
          </View>
        ) : null}
        {log ? <Text style={styles.dim}>→ {log}</Text> : null}
      </Card>

      {wallet ? (
        <FlatList
          data={txs}
          keyExtractor={(item) => item.signature}
          ListHeaderComponent={<Text style={styles.dim}>recent inflows</Text>}
          renderItem={({ item }) => (
            <View style={styles.txRow}>
              <Mono style={styles.txSig}>{item.signature.slice(0, 22)}…</Mono>
              <Text style={styles.txAmt}>+{(item.lamports / LAMPORTS_PER_SOL).toFixed(4)} SOL</Text>
            </View>
          )}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: SPACING.lg },
  header: { marginBottom: SPACING.lg },
  title: { color: COLORS.text, fontSize: 18, fontWeight: '700', marginTop: SPACING.xs },
  sub: { color: COLORS.textDim, fontSize: 13, marginTop: 2 },
  dim: { color: COLORS.textDim, fontSize: 12, marginBottom: 6 },
  warn: { color: COLORS.ambar, fontSize: 11, marginBottom: SPACING.sm },
  bal: { color: COLORS.mint, fontSize: 16, fontWeight: '700', marginVertical: SPACING.sm },
  row: { flexDirection: 'row' },
  rowBtn: { flex: 1, marginRight: SPACING.xs },
  txRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.xs },
  txSig: { color: COLORS.text },
  txAmt: { color: COLORS.mint, fontSize: 12 },
});