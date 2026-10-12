"use client";

import { useEffect, useRef, useState } from "react";
import {
  MEMO_STORE_NAME,
  buildMemo,
  margin,
  parseMemos,
  priceGap,
  sortMemos,
  type Memo,
  type MemoDraft,
} from "@/lib/memo";

type Availability = "ready" | "unavailable";

function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function emptyDraft(item: string, date: string = today()): MemoDraft {
  return { date, place: "", item, price: "", rivalPrice: "", cost: "", note: "" };
}

export function StallMemo({ itemName }: { itemName: string }) {
  // 楽観的に「使える」状態で描く。静的HTMLの時点で disabled を焼き込むと、
  // JS が無い/失敗した環境に、理由の説明もない操作不能なフォームだけが残る。
  const [availability, setAvailability] = useState<Availability>("ready");
  const [memos, setMemos] = useState<Memo[]>([]);
  // 日付の初期値はマウント後に入れる。プリレンダ時に today() を呼ぶと
  // 静的HTMLにビルド日が焼き込まれ、閲覧日と食い違って hydration が壊れる。
  const [draft, setDraft] = useState<MemoDraft>(() => emptyDraft(itemName, ""));
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [undo, setUndo] = useState<Memo | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      const probe = "__shun_yasai_probe__";
      window.localStorage.setItem(probe, "1");
      window.localStorage.removeItem(probe);
      const stored = window.localStorage.getItem(MEMO_STORE_NAME);
      setMemos(stored ? parseMemos(JSON.parse(stored)) : []);
      setAvailability("ready");
      setDraft((d) => (d.date === "" ? { ...d, date: today() } : d));
    } catch {
      // プライベートモードや保存無効の環境。フォームは消さず、使えない旨だけ伝える。
      setAvailability("unavailable");
    }
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  function persist(next: Memo[]): boolean {
    try {
      window.localStorage.setItem(MEMO_STORE_NAME, JSON.stringify(next));
      return true;
    } catch {
      setError("保存できませんでした（端末の空き容量が足りない可能性があります）。");
      return false;
    }
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = buildMemo(draft);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const next = sortMemos([result.memo, ...memos]);
    if (!persist(next)) return;
    setMemos(next);
    setDraft(emptyDraft(itemName));
    setError(null);
    setStatus(`${result.memo.place || "店名なし"}の記録を追加しました。`);
  }

  function remove(memo: Memo) {
    const next = memos.filter((m) => m.id !== memo.id);
    if (!persist(next)) return;
    setMemos(next);
    setError(null);
    setUndo(memo);
    setStatus("1件削除しました。元に戻せます。");
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 5000);
  }

  function restore() {
    if (!undo) return;
    const next = sortMemos([undo, ...memos]);
    if (!persist(next)) return;
    setMemos(next);
    setUndo(null);
    setStatus("削除を取り消しました。");
  }

  const disabled = availability !== "ready";

  return (
    <aside className="memo" aria-labelledby="memo-h">
      <div className="wrap">
        <h2 className="memo__h" id="memo-h">
          直売所の価格メモ
        </h2>
        <p className="memo__note">
          この端末のブラウザにだけ保存されます。サーバーには送信されません。
          端末やブラウザを変えると消えます。
        </p>

        <noscript>
          {/* JS 無しで送信するとネイティブ送信でページが再読込され、入力が黙って消える。
              説明だけ残してフォームは出さない。 */}
          <style>{`.memo__form{display:none}`}</style>
          <p className="memo__error">
            このメモ機能はブラウザの中だけで動くため、JavaScript が必要です。
          </p>
        </noscript>

        {availability === "unavailable" ? (
          <p className="memo__error">
            このブラウザでは保存できない設定になっています（プライベートモードなど）。
          </p>
        ) : null}

        <form className="memo__form" onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="memo-place">直売所・店名</label>
            <input
              id="memo-place"
              maxLength={40}
              value={draft.place}
              disabled={disabled}
              onChange={(e) => setDraft({ ...draft, place: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="memo-item">品目</label>
            <input
              id="memo-item"
              maxLength={40}
              value={draft.item}
              disabled={disabled}
              onChange={(e) => setDraft({ ...draft, item: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="memo-price">自分の価格（円）</label>
            <input
              id="memo-price"
              inputMode="numeric"
              value={draft.price}
              disabled={disabled}
              onChange={(e) => setDraft({ ...draft, price: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="memo-rival">まわりの価格（円・任意）</label>
            <input
              id="memo-rival"
              inputMode="numeric"
              value={draft.rivalPrice}
              disabled={disabled}
              onChange={(e) => setDraft({ ...draft, rivalPrice: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="memo-cost">原価（円・任意）</label>
            <input
              id="memo-cost"
              inputMode="numeric"
              value={draft.cost}
              disabled={disabled}
              onChange={(e) => setDraft({ ...draft, cost: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="memo-date">日付</label>
            <input
              id="memo-date"
              type="date"
              value={draft.date}
              disabled={disabled}
              onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="memo-note">メモ（任意）</label>
            <input
              id="memo-note"
              maxLength={80}
              value={draft.note}
              disabled={disabled}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            />
          </div>
          <button className="btn" type="submit" disabled={disabled}>
            記録する
          </button>
        </form>

        {error ? (
          <p className="memo__error" role="alert">
            {error}
          </p>
        ) : null}

        <p className="visually-hidden" aria-live="polite">
          {status}
        </p>

        {undo ? (
          <p className="meta">
            1件削除しました。{" "}
            <button className="btn btn--quiet" type="button" onClick={restore}>
              元に戻す
            </button>
          </p>
        ) : null}

        {memos.length === 0 ? (
          <p className="memo__empty">
            まだメモはありません。よく行く直売所の値段を書き留めておくと、平年比と見比べられます。
          </p>
        ) : (
          <div className="table-scroll">
            <table>
              <caption className="visually-hidden">記録した直売所の価格</caption>
              <thead>
                <tr>
                  <th scope="col">日付</th>
                  <th scope="col">直売所</th>
                  <th scope="col">品目</th>
                  <th scope="col">自分</th>
                  <th scope="col">まわり</th>
                  <th scope="col">差</th>
                  <th scope="col">粗利</th>
                  <th scope="col">メモ</th>
                  <th scope="col">
                    <span className="visually-hidden">操作</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {memos.map((memo) => {
                  const gap = priceGap(memo);
                  const m = margin(memo);
                  return (
                    <tr key={memo.id}>
                      <th scope="row">{memo.date}</th>
                      <td>{memo.place || "—"}</td>
                      <td>{memo.item || "—"}</td>
                      <td>{memo.price}</td>
                      <td>{memo.rivalPrice ?? "—"}</td>
                      <td>{gap === null ? "—" : gap > 0 ? `+${gap}` : gap}</td>
                      <td>{m ?? "—"}</td>
                      <td>{memo.note || "—"}</td>
                      <td>
                        <button
                          className="btn btn--quiet"
                          type="button"
                          onClick={() => remove(memo)}
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </aside>
  );
}
