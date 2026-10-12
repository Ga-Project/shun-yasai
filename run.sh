#!/usr/bin/env bash
# shun-yasai — static export（out/ 生成）のビルド & ローカル確認ラッパ。
# サーバランタイムは使わない（next start なし）。out/ を静的配信して確認する。
#
# 使い方:
#   ./run.sh            # pnpm build で out/ を生成（デプロイ物）
#   ./run.sh serve      # out/ をビルドしてローカル配信（http://localhost:3000）
#   ./run.sh dev        # 開発サーバ（pnpm dev・ホットリロード）
set -euo pipefail
cd "$(dirname "$0")"

cmd="${1:-build}"

case "$cmd" in
build)
  pnpm build
  echo "run.sh: out/ を生成しました。ローカル確認は './run.sh serve'。" >&2
  ;;
serve)
  pnpm build
  # basePath が /shun-yasai なので、out/ をそのままルートで配信すると
  # アセットとリンクが全て 404 になる。親ディレクトリを配信して階層を合わせる。
  serve_root="$(mktemp -d)"
  ln -sfn "$PWD/out" "$serve_root/shun-yasai"
  trap 'rm -rf "$serve_root"' EXIT
  echo "run.sh: http://localhost:3000/shun-yasai/ で配信します（Ctrl-C で停止）。" >&2
  python3 -m http.server -d "$serve_root" 3000
  ;;
dev)
  exec pnpm dev
  ;;
*)
  echo "run.sh: 不明なコマンド: '$cmd'（build | serve | dev）" >&2
  exit 64
  ;;
esac
