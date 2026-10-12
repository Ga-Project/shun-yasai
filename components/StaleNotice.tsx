"use client";

import { useEffect, useState } from "react";
import { formatWeek } from "@/lib/logic";

/**
 * データが古くなっていることを閲覧時に判定して伝える。
 *
 * 静的書き出しなのでビルド時に計算すると値が固定され、公開後どれだけ放置しても
 * 「古い」と言えない。黙って古い数字を新しい顔で出さないための表示なので、
 * 判定は必ず閲覧している側で行う。
 */
const STALE_DAYS = 21;

export function StaleNotice({ latestWeek }: { latestWeek: string }) {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (!latestWeek) return;
    const days = Math.floor((Date.now() - new Date(latestWeek).getTime()) / 86_400_000);
    setStale(days >= STALE_DAYS);
  }, [latestWeek]);

  if (!stale) return null;
  return (
    <p className="stale" role="status">
      このサイトのデータは{formatWeek(latestWeek)}の調査分で止まっています。
    </p>
  );
}
