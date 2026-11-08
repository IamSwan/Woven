# Woven UI kit: how to rebuild

`docs/ui-kit/index.html` is a self-contained preview of Woven's authored UI: tokens, components and every
ScreenGui on a mock screen. It is generated from the live Studio place. Open it by double-click (file://); no server.

The export is read-only. It changes nothing in the place and needs no Play session.

## Files

| File | Role |
|---|---|
| `tools/ui-kit/export.luau` | Luau run in Studio (Edit) through the roblox-studio MCP. Modes: `list`, `gui` (one ScreenGui), `meta` (place info and the ButtonTemplateView/TopButtonTheme source), `sizes` (native image sizes via EditableImage), `pixels` (row strips of an image's pixels via EditableImage), `runtime` (scripts that name each runtime-built gui). |
| `tools/ui-kit/run-export.js` | Code Mode script: runs every export mode, reads the pixels of every image Studio can open, and posts the results to the receiver. |
| `tools/ui-kit/receive.mjs` | Localhost receiver (127.0.0.1:47821). Serves `export.luau` and the runtime gui names, writes Studio pixel reads to `docs/ui-kit/assets/studio/<id>.png`, merges the other chunks into `docs/ui-kit/data/ui.json`, then exits. It keeps the data out of the agent's context. |
| `tools/ui-kit/png.mjs` | Minimal PNG decode/encode used by build.mjs (tints) and receive.mjs (Studio pixels). |
| `tools/ui-kit/docs.mjs` | Reads the UI map in `docs/client.md` §5 (owner, status, runtime-built guis). |
| `tools/ui-kit/build.mjs` | Builds the page from `ui.json`: downloads missing images, writes tinted copies, embeds fonts, derives tokens. |
| `tools/ui-kit/renderer.js`, `page.js` | Browser code that build.mjs inlines into the page (layout renderer and page controls). |
| `docs/ui-kit/data/ui.json` | Raw export. |
| `docs/ui-kit/assets/` | `studio/<assetId>.png` exact pixels read in Studio, `<assetId>.png` public thumbnails, `tint/<id>_<hex>.png`, `images.json` (manifest: source, sha256, placeholder flag), `fonts.css` (Roblox fonts as data URIs). |

## Steps

1. Open the place in Studio with the roblox-studio MCP connected.
2. Start the receiver from the project folder and leave it running:
   ```
   node tools/ui-kit/receive.mjs
   ```
3. In an agent session with the roblox-studio MCP, call the Code Mode `execute` tool with the **whole contents of
   `tools/ui-kit/run-export.js`** as `code`. The runtime cannot load files or use `eval`, so paste the file. It
   finds the Woven studio by name, so the studio id does not matter. It takes about three minutes, most of it
   reading image pixels (about 0.4 s per strip, ~75 strips per 1024×1024 image). It returns a summary such as
   `{ guis: 23, images: 70, sizeFailures: 64, studioPixelImages: 6, pixelErrors: [], runtimeNames: 30, merged: "...; studio pixels written 6" }`.
   `pixelErrors` must be empty. The receiver then writes `docs/ui-kit/data/ui.json` and exits.
4. Build the page:
   ```
   node tools/ui-kit/build.mjs
   ```
   It prints the counts: ScreenGuis, GuiObjects, colours, fonts, public thumbnails used, placeholders detected,
   images recovered via Studio pixels, images still unavailable (with ids), slice sizes exact or estimated, and
   components found.
5. Open `docs/ui-kit/index.html`.

To refresh only the page (renderer or layout change, no Studio change), run step 4 alone.

## Notes

- **Images, two sources.**
  - *Studio pixels (exact).* Images Studio can open with `AssetService:CreateEditableImageAsync` are the group's
    own uploads (creator "Woven Studios"). The public thumbnails API answers those with Roblox's grey "image
    unavailable" placeholder while reporting state `Completed`, so the export reads their pixels in Studio instead,
    in row strips small enough for execute_luau's 100,000-character result limit. Nothing is parented or saved
    in the place. These files win over thumbnails.
  - *Public thumbnails.* Every other image is downloaded with GET requests to `thumbnails.roblox.com/v1/assets`
    (700x700 box, aspect kept) and its CDN, with a generic User-Agent. A thumbnail still `Pending` is retried on
    the next build. Delete `docs/ui-kit/assets/<id>.png` and its `assets/images.json` entry to force a fresh copy.
- **Placeholder detection.** build.mjs hashes every thumbnail. A file that matches the known placeholder
  (`PLACEHOLDER_SHA256` in build.mjs) or is byte-identical to another id's file is deleted, flagged
  `placeholder` in `images.json` and counted as failed. Without a Studio pixel read it stays unavailable: the page
  draws a labelled box ("image unavailable · id") and lists the id in the header. If a new group image shows up as
  unavailable, rerun steps 2-4 so Studio reads it.
- **Open Cloud is not used.** The asset delivery endpoint (`/asset-delivery-api/v1/assetId/{id}`) needs the
  `legacy-asset:manage` scope, which is not granted to the Studio MCP. If the owner grants it, it could replace the
  pixel reads.
- **Native sizes.** Slice centres and rect crops are in the image's native pixels. Studio pixel reads are exact.
  For thumbnails, the size comes from Studio (EditableImage) when it can open the image. Otherwise build.mjs
  estimates the native size from the thumbnail aspect (the smallest of 128/256/512/1024 that holds every slice
  coordinate). The page lists those as approximate.
- **Fonts.** build.mjs copies the Roblox font files that the page uses from the newest
  `%LOCALAPPDATA%\Roblox\Versions\*\content\fonts` (override with `ROBLOX_FONTS_DIR`). Fonts are embedded as data
  URIs because browsers block file:// font loads. Without a Studio install it falls back to Google Fonts
  look-alikes. The font files are Roblox's: keep the kit internal.
- **Status labels** come from the table in `docs/client.md` §5. The two ReplicatedFirst guis are not in that table;
  their owner is set in `RF_STATUS` in build.mjs.
- **Components** are listed in `components` in build.mjs by gui key and child path. A path that no longer exists is
  reported as missing in the build summary.

## Target design (v2)

`docs/ui-kit/v2/index.html` is the proposed redesign that follows the UI audit (2026-11-08). It is a target, not an
export: nothing in it is built in Studio yet, and `build.mjs` does not touch it. The page above stays the record of
the live place.

- **Source.** A static export of the Claude Design canvas "Woven UI kit", the editable source. Change the canvas
  first, then re-export, so the two stay in step.
- **Assets.** It reuses the images in `docs/ui-kit/assets` (by asset id) and the fonts in `assets/fonts.css`. The
  only new file is `v2/book-spread.png`: the Book art (studio/118181077777367) cropped, with the old two-column rules
  removed from the left page.
- **What is real.** Weave recipes and Fireball's numbers (65 mana, range 60, 15 s ready window) come from the docs.
  Bracketed labels such as [Player] or [Form 1] are placeholders; levels, kills, Marks and timers are examples.
- **Top bar.** The V1 `TopHUD` is kept unchanged: same images (with their tints), layout from the export, BuilderSans
  and key hints, Quests and Inventory still dimmed. v2 only adds information: live level and XP, a badge for
  unspent skill points on the Book slot, and a line under the bar for time of day and Marks.
- **Minimap.** Also kept as in V1. `MinimapController` builds it at runtime, so the boards only mark its place with a
  labelled outline; they don't redraw it.
- **Open choices** it assumes: Air drawn gold (its mobile medallion) rather than cream (the Book), and the composer
  in the credits.
- **Building toward it.** Tokens go in one `Shared/WovenTheme` module and components in a `Shared/WovenUI` kit
  grown from `ButtonTemplateView`. When a screen is built, re-export the place and rebuild the main page as above.
