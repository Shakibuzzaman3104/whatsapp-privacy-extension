#!/bin/zsh
# Renders the toolbar/store icons from design/icon/svg with headless Chrome.
set -e
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
SRC="$(cd "$(dirname "$0")/.." && pwd)/design/icon/svg"
OUT="$(cd "$(dirname "$0")/.." && pwd)/public/icon"
TMP=$(mktemp -d)
render() { # svg size out
  print "<html><body style='margin:0'><img src='file://$SRC/$1' width=$2 height=$2></body></html>" > $TMP/p.html
  "$CH" --headless=new --disable-gpu --hide-scrollbars --default-background-color=00000000 \
    --window-size=$2,$2 --screenshot=$OUT/$3 file://$TMP/p.html >/dev/null 2>&1
}
for s in 16 32; do render veil-small.svg $s $s.png; render veil-small-off.svg $s off-$s.png; done
for s in 48 128; do render veil.svg $s $s.png; render veil-off.svg $s off-$s.png; done
render veil.svg 512 ../../design/icon/veil-512.png
