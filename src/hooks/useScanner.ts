import { useCallback, useMemo, useState } from 'react';
import { Announcement, loadAnnouncements } from '../store/announcements';
import { FoundPayment, loadPayments, savePayments } from '../store/identity';
import { StealthIdentity, scanStealthAddress } from '../crypto/stealth';
import { deriveSweepKey } from '../crypto/sweep';

export function useScanner(identity: StealthIdentity | null, announcements: Announcement[]) {
  const [payments, setPayments] = useState<FoundPayment[]>([]);

  const refresh = useCallback(async () => {
    setPayments(await loadPayments());
  }, []);

  const matched = useMemo(() => {
    if (!identity) return [];
    return announcements
      .map((a) => scanOne(identity!, a))
      .filter((r): r is { announcement: Announcement; stealthAddress: string; canSweep: boolean; alreadyKnown: boolean } => r !== null);
  }, [identity, announcements]);

  const scanAll = useCallback(async () => {
    if (!identity) return 0;
    const current = await loadPayments();
    const known = new Set(current.map((p) => p.signature));
    let found = 0;
    const results: FoundPayment[] = [...current];
    for (const a of announcements) {
      const r = scanOne(identity, a);
      if (!r || r.alreadyKnown || known.has(a.signature ?? a.ephemeralPubkey)) continue;
      known.add(a.signature ?? a.ephemeralPubkey);
      found += 1;
      results.push({
        id: a.id,
        amountLamports: a.amountLamports,
        amountSol: (a.amountLamports / 1e9).toLocaleString('en-US', { maximumFractionDigits: 4 }),
        stealthAddress: r.stealthAddress,
        ephemeralPubkey: a.ephemeralPubkey,
        viewTag: a.viewTag,
        signature: a.signature ?? '',
        index: a.index,
        discoveredAt: Date.now(),
        swept: false,
      });
    }
    await savePayments(results);
    setPayments(results);
    return found;
  }, [identity, announcements]);

  return { payments, matched, scanAll, refresh, setPayments };
}

function scanOne(
  identity: StealthIdentity,
  a: Announcement,
): { announcement: Announcement; stealthAddress: string; canSweep: boolean; alreadyKnown: boolean } | null {
  const s = scanStealthAddress(identity.viewingPrivkey, identity.spendingPrivkey, a.ephemeralPubkey, a.viewTag, a.index);
  if (!s.matched || !s.stealthAddress) return null;
  const sweep = deriveSweepKey(identity.viewingPrivkey, identity.spendingPrivkey, a.ephemeralPubkey, a.viewTag, a.index);
  return { announcement: a, stealthAddress: s.stealthAddress, canSweep: !!sweep.scalarBytes, alreadyKnown: false };
}

export function useAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const load = useCallback(async () => {
    setAnnouncements(await loadAnnouncements());
  }, []);
  void load;
  return { announcements, setAnnouncements };
}