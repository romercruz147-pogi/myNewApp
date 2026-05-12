import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Device } from '../types';

export function useDevices(uid?: string) {
  const [devices, setDevices] = useState<Device[]>([]);
  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'devices'), where('uid', '==', uid));
    return onSnapshot(q, (snap) => {
      setDevices(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Device) })));
    });
  }, [uid]);
  return devices;
}
