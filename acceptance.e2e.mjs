/**
 * 旬やさい相場ナビ 受入E2E — コンソール check_items の機械実行版。
 * キーは check_items.key と一致させること（ずれるとランナーが警告を出す）。
 *
 * 方針: 実装内部を覗かず、利用者と同じ操作だけで判定する。
 */

const MEMO_PLACE = 'input#memo-place';
const MEMO_PRICE = 'input#memo-price';

export const items = {
  /** トップに今週の結論と品目の一覧が出る */
  "weekly-verdict": async (h) => {
    await h.goto("/");
    await h.expectMatch(/\d+年\d+月\d+日の週/, "調査週");
    await h.expectText("価格はすべて 円/kg");
    // 「安い野菜が何品目あるか」の結論。0品目の週もあるので両方を許す。
    await h.expectMatch(/今週、平年より安い野菜は(ありません|\s*\d+\s*品目です)/, "今週の結論");
    await h.expectText("買い時順");
    await h.expectText("平年比");
  },

  /** 品目を選ぶと、その野菜の平年比と値動きが見られる */
  "item-detail": async (h) => {
    await h.goto("/");
    await h.clickText("キャベツ");
    await h.expectPath("/item/cabbage/");
    await h.expectText("キャベツ");
    await h.expectText("平年比のうつりかわり");
    await h.expectText("例年、どの月が安いか");
    await h.expectMatch(/平年より\s*\d+%\s*(高い|安い)|平年並み|調査対象外/, "この品目の状態");
  },

  /** 調査時期でない品目は「調査対象外」と分かる（古い値を今週の値として出さない） */
  "off-season-is-labeled": async (h) => {
    await h.goto("/");
    await h.expectText("今週は調査対象外");
    await h.goto("/item/daikon/");
    // 出回り期外の品目の見出しで「いま」と言い切らないこと。
    await h.expectText("調査対象外");
    await h.expectNoText("だいこんの値段は、いま平年より");
  },

  /** 月から「例年その月に安い野菜」を調べられる */
  "month-page": async (h) => {
    await h.goto("/month/9/");
    // 見出しは「N品目が安くなる」か「目立って安い品目は無い」のどちらか。
    await h.expectMatch(/9月は\s*\d+\s*品目が例年より安くなります|9月に、例年より目立って安くなる品目はありません/, "9月の結論");
    await h.expectText("9月の安い順");
    await h.expectText("調査のあった月の平均");
    // 品目名と月別の平均価格が並んでいること
    await h.expectText("キャベツ");
  },

  /** 直売所メモを記録すると一覧に残り、再読み込みしても消えない */
  "memo-persists": async (h) => {
    await h.goto("/item/cabbage/");
    await h.expectText("直売所の価格メモ");
    await h.expectText("この端末のブラウザにだけ保存されます");
    await h.fill(MEMO_PLACE, "みどりの里");
    await h.fill(MEMO_PRICE, "180");
    await h.clickText("記録する");
    await h.wait(300);
    await h.expectText("みどりの里");
    // 再読み込みしても残ること（端末内保存が効いていること）
    await h.goto("/item/cabbage/");
    await h.wait(300);
    await h.expectText("みどりの里");
    h.note("記録 → 再読み込み後も残存を確認");
  },

  /** どの数字がどこから来たのかが明示されている */
  "source-is-shown": async (h) => {
    await h.goto("/");
    await h.expectText("食品価格動向調査");
    await h.expectText("円/kg");
    await h.goto("/about/");
    await h.expectText("平年比とは");
    await h.expectText("政府標準利用規約");
  },

  /** 狭い画面でも横に見切れない */
  "mobile-no-overflow": async (h) => {
    await h.viewport(375, 800);
    await h.goto("/");
    await h.expectNoHorizontalOverflow();
    await h.goto("/item/cabbage/");
    await h.expectNoHorizontalOverflow();
    await h.viewport(1280, 800);
  },
};

export const designStates = {
  /** 値が入って結果が出ている既定状態（トップ＝常にデータが載っている） */
  "main-populated": async (h) => {
    await h.goto("/");
    await h.wait(200);
  },

  /** 暗い配色 */
  dark: async (h) => {
    await h.page.emulateMediaFeatures([
      { name: "prefers-color-scheme", value: "dark" },
    ]);
    await h.goto("/");
    await h.wait(200);
  },

  /**
   * メモが1件入った状態。空状態からの遷移は総当たりクローラでは作れない
   * （入力して送信しないと現れないため）ので明示する。
   */
  "memo-filled": async (h) => {
    await h.goto("/item/cabbage/");
    await h.fill(MEMO_PLACE, "みどりの里");
    await h.fill(MEMO_PRICE, "180");
    await h.clickText("記録する");
    await h.wait(400);
  },

  /** 出回り期外の品目のページ（一級の状態として設計している） */
  "off-season-item": async (h) => {
    await h.goto("/item/daikon/");
    await h.wait(200);
  },

  /** 推移グラフに欠測の分断が現れる品目 */
  "trend-with-gaps": async (h) => {
    await h.goto("/item/hakusai/");
    await h.wait(200);
  },
};
