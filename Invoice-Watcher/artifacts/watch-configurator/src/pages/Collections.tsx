import { useEffect } from 'react';
import { useLocation } from 'wouter';

export default function Collections() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation('/collections/0', { replace: true }); }, [setLocation]);
  return null;
}
