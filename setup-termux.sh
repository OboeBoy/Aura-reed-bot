#!/data/data/com.termux/files/usr/bin/bash
mkdir -p node_modules
ln -sfn "$(pwd)/.mocks/ffmpeg-static" node_modules/ffmpeg-static
if [ -f "node_modules/sharp/lib/utility.js" ]; then
  sed -i 's/format\.jp2k\.output\.alias =/if (format.jp2k?.output) format.jp2k.output.alias =/' node_modules/sharp/lib/utility.js
  sed -i 's/format\.jp2k?\.output?\.alias =/if (format.jp2k?.output) format.jp2k.output.alias =/' node_modules/sharp/lib/utility.js
fi
