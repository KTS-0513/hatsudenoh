import { io, type Socket } from 'socket.io-client';
import type { ClientToServer, GameState, ServerToClient } from '../shared/types';

export const socket: Socket<ServerToClient, ClientToServer> = io();

// 接続・再接続のたびに現在の状態を要求し直す（初回イベントの取りこぼし防止）
socket.on('connect', () => socket.emit('sync'));

import { useEffect, useState } from 'react';

/** サーバーが配信するゲーム状態を購読するフック */
export function useGameState(): GameState | null {
  const [state, setState] = useState<GameState | null>(null);
  useEffect(() => {
    socket.on('state', setState);
    // 購読を登録してから状態を要求（登録前に届いて取りこぼすのを防ぐ）
    if (socket.connected) socket.emit('sync');
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
