"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredPseudo } from "@/lib/device-token";
import { CasinoTable } from "@/components/casino/CasinoTable";

export default function TablePage() {
  const router = useRouter();
  const [pseudo, setPseudo] = useState<string | null>(null);

  useEffect(() => {
    const stored = getStoredPseudo();
    if (!stored) {
      router.replace("/");
      return;
    }
    // One-time sync from localStorage (an external store) on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPseudo(stored);
  }, [router]);

  if (!pseudo) return null;
  return <CasinoTable pseudo={pseudo} />;
}
