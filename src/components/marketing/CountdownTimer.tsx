import { useEffect, useState } from 'react';

interface Props {
  endsAt: string;
  onExpire?: () => void;
}

function pad(n: number) { return String(n).padStart(2, '0'); }

export default function CountdownTimer({ endsAt, onExpire }: Props) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const update = () => {
      const diff = Math.max(0, new Date(endsAt).getTime() - Date.now());
      setRemaining(diff);
      if (diff === 0) onExpire?.();
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [endsAt, onExpire]);

  const hours   = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  return (
    <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1.1em', color: remaining < 3600000 ? '#d91515' : '#0073bb' }}>
      {pad(hours)}:{pad(minutes)}:{pad(seconds)}
    </span>
  );
}
