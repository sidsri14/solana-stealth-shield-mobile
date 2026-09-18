import React, { createContext, useContext, useEffect, useState } from 'react';
import { Connection } from '@solana/web3.js';
import { DEFAULT_RPC } from './client';

interface RpcCtx {
  rpcUrl: string;
  setRpcUrl: (url: string) => void;
  conn: Connection;
}

const Ctx = createContext<RpcCtx | null>(null);

export function RpcProvider({ children }: { children: React.ReactNode }) {
  const [rpcUrl, setRpcUrl] = useState(DEFAULT_RPC);
  const conn = new Connection(rpcUrl, 'confirmed');
  return <Ctx.Provider value={{ rpcUrl, setRpcUrl, conn }}>{children}</Ctx.Provider>;
}

export function useRpc(): RpcCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useRpc must be used within RpcProvider');
  return ctx;
}

export function useConnectionOnline(conn: Connection) {
  const [online, setOnline] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    conn
      .getVersion()
      .then(() => !cancelled && setOnline(true))
      .catch(() => !cancelled && setOnline(false));
    const timer = setInterval(() => {
      conn
        .getVersion()
        .then(() => !cancelled && setOnline(true))
        .catch(() => !cancelled && setOnline(false));
    }, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [conn]);
  return online;
}