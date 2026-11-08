# Workflow: how to change Woven

This is how to make, check, ship and clean up a change, given that the game lives only in Roblox Studio. The rules themselves are in [../AGENTS.md](../AGENTS.md); this doc explains the procedure behind them.

## 1. How the project is edited today

- **Source of truth.** Roblox Studio and Roblox cloud saves only. There is no Rojo project, no Wally, no `Packages` folder, no PackageLinks and no git. No script mentions Rojo or Wally.
- **Who edits.** AI agents edit the place directly through the Studio MCP (`roblox-studio` in `opencode.jsonc`, launched through `%LOCALAPPDATA%\Roblox\mcp.bat`). A `blender` MCP (`uvx mcp-for-blender`) is configured but disabled. Agent roles are configured outside this folder.
- **Backup habit.** Before each change, the agent clones the scripts it is about to touch into `ServerStorage/MCPBackups/<Change>_<YYYYMMDD>_Before`.
  - There are 56 such folders, dated 2026-11-05 to 2026-11-07.
  - Together they hold 236 scripts and 118k lines.
  - Only one folder (`MenuReturn_20261107_Before`) has a `Note` saying what a rollback must also undo.
  - Script names are sometimes prefixed, for example `Combat_WarderCombatService`.
  - Nothing prunes these folders.
- **Older backups** store source as StringValues instead of script clones:
  - `ReadabilityBackup_2026_10_25` and `ReadabilityBackup_2026_11`: ~500 scripts each, ~3.5 MB each.
  - `RisingSteelBackup_*` and `RisingSteelFacingBackup_*`: Warder scripts.
- **Comment conventions:**
  - `-- Name: purpose.` header on every script.
  - `-- ponytail: …` notes design decisions (59 lines in 34 scripts).
  - `-- shortcut: <limit>, <when to upgrade>` marks known limits.

### Test and QA tools already in the place

| Tool | Where | What it does |
|---|---|---|
| Warder test kit | `Controllers/WarderTestController`, `Shared/WarderTest`, `WarderTestHUD`, `WarderSwordFormHUD`, `WarderQuickSlotHUD`, `WarderShowcaseHUD` | Guardian Combat Test V2. Toggled from the admin panel (`AdminController:70-93`). Dummies are spawned by `WarderCombatService:1171`. |
| Trolloc dev | `Services/Trollocs/TrollocDevCommands`, `ServerStorage.TrollocDev` (BindableFunction, Studio only), `TrollocDebugOverlay` | Spawn and inspect Trollocs. |
| Tutorial QA | `Workspace` attribute `TestFirstJourney`, `ServerStorage.FirstJourneyTestAdvance` | Run the First Journey in Studio and step through it. |
| Menu preview | `ReplicatedFirst/PlayEntryClient` attribute `PreviewInStudio` | Show the menu in Studio. By default the menu is skipped there. |
| Touch simulation | Player attribute `ForceTouchUI` (Studio only) | Force the touch UI. Only TopHUD and MobileLayoutController honour it. |
| Debug logging | `Shared/DebugLog` attribute `DebugLogging` | Gated prints. No live script uses it yet. |
| Edit-mode self-checks | `Services/LevelRules/SelfCheck`, `Services/SaveSession/SelfCheck`; `Shared/WarderSwordForms/SelfCheck` needs Play | Assert-based. Run with `require(...)()`. |
| Admin panel | `StarterPlayerScripts/AdminController`, `AdminFlightController`, `Services/AdminService`, `Services/AdminConfig` | Commands, raids, flight, Warder test, moderation. Access: owners, the panel allow-list, group admins and moderators. |

## 2. Before a work session

1. Make sure the place is saved or published, and note the current version in Version History. That version is the real rollback point.
2. For risky changes, also use File → Save to File and keep a dated `Woven_YYYYMMDD_HHMM.rbxl` outside this folder.
3. Run `list_roblox_studios` to get the current studio id.

## 3. Making a change

1. **Scope it.** Read the doc section for the area. Grep every caller of what you touch, with backup hits filtered out (§5).
2. **Back it up.** Create `ServerStorage/MCPBackups/<Change>_<YYYYMMDD>_Before`.
   - Clone every script you will edit, keeping its original name.
   - Set `OriginalPath` on each clone.
   - Set a `Note` on the folder listing what the change creates, renames or moves.
3. **Edit.** Follow the patterns in the area doc ("How to change this area"). Keep the header line, and add `shortcut:` comments for known limits.
4. **Check it in Edit (§6).**
5. **Write back the docs (§8)** in the same task.
6. **Hand over.** The owner tests by hand in Play.

## 4. Names code depends on

Code finds these instances by exact name, often with `WaitForChild` and no timeout. A rename hangs or breaks the caller without any error. Grep before you change any of them:

- `Workspace["Edmond's Field"]` (including the apostrophe), `TheInn`, `InnResidents`, `InnTeleportOutside`, `InnTeleportInside`, `NPCMarkers` (`Homes`, `Routes`, `GuardPosts`), `Interactables/VillageProps`
- `Workspace.FirstJourneySpawn`, `TutorialWaterSource`, `MenuStage`, `camerapieceforloading`
- `Workspace.SellerNPC`, `FactionZoneEdmondsField`, `TrollocSpawnRegions` (and its region names), `WardZones` / `WardZone`, `spawns`
- `Workspace.Ways` children: `GateRuntime`, `EdmondWaygate`, `AielWaygate`, `EdmondCamera`, `AielCamera`, `EdmondWayTP`, `AielWayTP`, `WaysStart`
- `Workspace.AielWaste`; runtime folders `NPC`, `ActiveAbilityEffects`, `ActiveThreads`, `RawEarthEffects`, `SoloWeaveEffects`
- `ServerStorage.VillageNPCAssets` (including `Templates.Resident_02` and `Hairs.Hair_02`), `ChannelerNPCAssets`, `TutorialLog`
- `ReplicatedStorage.Assets` (`AbilityEffects`, `ThreadActors`, `OpenBook`, `Trolloc`), `ReplicatedStorage.NewThread`, and the session folders (`FireHoldSessions`, `RawFireSessions`, `FollowingLights`, `WaygateScenes`, `WaygateEffectTemplates`)
- Every remote name in `ReplicatedStorage/Remotes`

Give new anchors descriptive PascalCase names. Avoid `Part`, `Model` and `2`.

## 5. Searching the code

- `script_grep` and `script_search` also return the backup copies in ServerStorage, so drop every hit under:
  - `ServerStorage/MCPBackups`
  - `ServerStorage/ReadabilityBackup_*` (stored as StringValues, so script tools usually miss them)
  - `ServerStorage/RisingSteel*Backup_*`
  - `ServerStorage/DisabledFlood`
- Disabled scripts (`Enabled = false`) still match a grep. Check `Enabled` before you count a hit as live.
- Dot access (`RS.Remotes.X`) and `WaitForChild("X")` both appear. Search for the bare name.

## 6. Checking a change

The minimal check, in Edit only:

1. The edited script compiles (no syntax error in the Output when the script is saved).
2. The Output log is clean.
3. The existing self-checks pass:
   - `require(game.ServerScriptService.Server.Services.LevelRules.SelfCheck)()`
   - `require(game.ServerScriptService.Server.Services.SaveSession.SelfCheck)()`
4. Read back the changed lines.
5. New non-trivial pure logic gets one small assert-based `SelfCheck` module next to it, following those two.

Do not start Play sessions, captures or timed runs unless the owner asks. Logic that needs a long run goes in a pure check script that runs in Edit in seconds.

Remember the Studio limits: `PlayerData_V1` is never written in Studio, and `EconomyStore` is in-memory there. `PlayerSettings` and `MapDiscovery` do write the real stores from Studio when API access is on.

## 7. Publishing gate

Publishing is the owner's call. Before the owner publishes, all of these should hold:

- The owner's Play test is clean.
- Dev flags are reset: `Workspace.TestFirstJourney = false`, `PreviewInStudio` unset, `DebugLogging` off, `TEST_PROGRESSION_IN_STUDIO = false` in DataService.
- Test HUD enablement is intentional. `WarderShowcaseHUD` is enabled today; the other Warder test HUDs are disabled.
- The published version number is written into the `Note` of the change's backup folder.

## 8. Docs write-back

In the same task as the change, update:

- the inventory rows of added, removed, disabled or repurposed scripts ([server.md](server.md), [client.md](client.md), [abilities.md](abilities.md), [shared.md §3](shared.md));
- the remote catalogue ([shared.md §2](shared.md));
- the DataStore table ([server.md §5.1](server.md));
- [systems.md](systems.md) when a system's owner scripts change;
- "Legacy and dead code" sections when something is deleted or revived;
- the "Open questions" sections when a question is answered.
- the UI kit ([ui-kit/index.html](ui-kit/index.html)) when a ScreenGui changes: follow [tools/ui-kit/README.md](../tools/ui-kit/README.md) (export through the Studio MCP, then `node tools/ui-kit/build.mjs`). The kit embeds Roblox's own font files, so keep it internal.

Keep docs in normal prose. Cite code as `Service/Path/Script:line`, and mark guesses as guesses.

## 9. Cleaning up

### Backups

- A change's `MCPBackups` folder becomes redundant once the change is published and has played cleanly, because Version History holds it.
- Suggested rule: keep the last 7 days or the last 10 changes. Export older folders to a `.rbxm` on disk before deleting them.
- Export and remove first: the two `ReadabilityBackup_*` folders (~7 MB of text) and the `RisingSteel*Backup_*` StringValue backups.
- Do not delete `ServerStorage/Brushtool2_Plugin_Storage` while the Brushtool plugin is in use.
- Deleting backups is irreversible inside the place. Do it only with the owner's word.

### Workspace clutter

[world.md §3](world.md) lists stray objects at the Workspace root: an underground VFX "lab", duplicate effect copies, and misfiled Inn decor.

- Move them into `ServerStorage/_Quarantine_<YYYYMMDD>`. Do not delete them.
- Then have the owner run a Play test.
- Delete the quarantine folder only after the owner confirms nothing broke.

### Dead code

The "Legacy and dead code" sections of each area doc list candidates. Remove a dead remote together with its senders and listeners, and update the remote catalogue.

## 10. Option to consider: Rojo plus git

This is a recommendation for the owner to weigh, not a decision.

- **Gains:**
  - Real diffs and history per change.
  - Review of agent edits.
  - Backups that do not bloat the place.
  - Agents can edit files with normal tools.
- **Costs:**
  - A one-time export of ~580 scripts into a file tree.
  - Learning the Rojo sync workflow (`rojo serve`).
  - Choosing a partially managed tree, because the world and assets (tens of thousands of parts) stay in the place file.
  - The current edit-in-Studio flow would change to edit files plus sync.
- **Lighter middle ground:** keep editing in Studio, and periodically export all scripts to disk and commit them to git, purely as history.

## 11. Change recipes

| Change | Recipe |
|---|---|
| Add a server service | [server.md §9.1](server.md) |
| Add a client→server remote | [server.md §9.2](server.md), [shared.md §7](shared.md) |
| Add a saved field | [server.md §9.3](server.md) |
| Add a per-save store | [server.md §9.4](server.md) |
| Add an economy reward or action | [server.md §9.5](server.md) |
| Add a promo code | [server.md §9.6](server.md) |
| Add an admin command | [server.md §9.7](server.md) |
| Add a damage source | [server.md §9.8](server.md) |
| Change movement speed | [server.md §9.9](server.md) |
| Tune NPCs | [server.md §9.10](server.md) |
| Add or tune a weave, element or Guardian skill | [abilities.md](abilities.md), "How to change this area" |
| Add a client controller, HUD element, keybind, weave VFX, mobile support | [client.md §9](client.md) |
| Add a shared module or config value | [shared.md §7](shared.md) |
