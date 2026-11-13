# RetroWave for Herdr

A [Herdr](https://herdr.dev) mod that shows
[RetroWave](https://github.com/craigday/homebrew-retrowave), the LED
spectrum analyzer for macOS, live inside your Herdr window: as a block in a
layout or as a floating window.

![RetroWave in the Herdr sidebar](preview.png)

## Requirements

- RetroWave 0.1.6 or later: `brew install --cask craigday/retrowave/retrowave`
- In RetroWave's menu, turn on **Herdr ▸ Send Frames to Herdr**. RetroWave
  then serves frames on `127.0.0.1:47613`, reachable only from this Mac.

## Install

Ask your agent to add `https://github.com/craigday/retrowave-herdr`, or
copy the mod into your Herdr home and check it:

```sh
cp -R mods/retrowave ~/.config/herdr-app/mods/
herdr-app check ~/.config/herdr-app/mods/retrowave
```

## Use

Open it as a floating window (it reopens with Herdr; right-click closes it):

```sh
herdr-app do mod.open '{"name":"retrowave"}'
```

Or add it to a layout as a block. Herdr's own layouts are read-only, so
clone one first (`herdr-app do layout.clone '{"name":"main","as":"mine"}'`).
In the clone of `main`, this block sits in the sidebar between Spaces and
Agents when added to `sidebar-lists` between `spaces` and `agents`:

```json
{ "id": "retrowave", "type": "block", "size": { "px": 110 }, "content": { "mod": "retrowave" } }
```

Click the display for RetroWave's next colour mode. While Herdr shows it,
RetroWave hides its own window (**Herdr ▸ Hide Window While Herdr Shows
It**). See [RECIPE.md](RECIPE.md) for the protocol and details.
