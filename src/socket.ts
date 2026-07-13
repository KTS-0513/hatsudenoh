import { io, type Socket } from 'socket.io-client';
import type { ClientToServer, GameState, ServerToClient } from '../shared/types';

export const socket: Socket<ServerToClient, ClientToServer> = io();

import { useEffect, useState } from 'react';

/** サーバーが配信するゲーム状態を購読するフック */
export function useGameState(): GameState | null {
  const [state, setState] = useState<GameState | null>(null);
  useEffect(() => {
    socket.on('state', setState);
    return () => {
      socket.off('state', setState);
    };
  }, []);
  return state;
}

/** この端末のプレイヤーだけに配られる手札を購読するフック */
export function useHand(): string[] {
  const [hand, setHand] = useState<string[]>([]);
  useEffect(() => {
    socket.on('hand', setHand);
    return () => {
      socket.off('hand', setHand);
    };
  }, []);
  return hand;
}

/** サーバーからのエラーメッセージを一定時間表示するフック */
export function useServerError(): string | null {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    const handler = (m: string) => {
      setMsg(m);
      setTimeout(() => setMsg(null), 4000);
    };
    socket.on('errorMessage', handler);
    return () => {
      socket.off('errorMessage', handler);
    };
  }, []);
  return msg;
}
