import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Device } from '../types';

export function useDevices(uid?: string) {
  const [devices, setDevices] = useState<Device[]>([]);
  useEffect(() => {
    if (!uid) {
      setDevices([]);
      return;
    }
    const q = query(collection(db, 'devices'), where('uid', '==', uid));
    return onSnapshot(q, (snap) => {
      setDevices(
        snap.docs
          .map((d) => {
            const data = d.data() as Partial<Device>;
            return {
              ...data,
              id: data.id || d.id,
              uid: data.uid || uid,
            } as Device;
          })
          .filter((device) => Boolean(device.id)),
      );
    });
  }, [uid]);
  return devices;
}
