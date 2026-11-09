# AGENTS.md: Woven

Rules for any agent or person changing the Roblox game **Woven**. Read this first, then [docs/README.md](docs/README.md) and the doc for the area you touch.

## The project in one paragraph

Woven is a Roblox action RPG (Studio title "[WARDERS] Woven", PlaceId 103140548975456, GameId 10652880207, group-owned). A player picks a save as a **Channeler**, who channels five elements into weaves, or a **Guardian** (called Warder in code), a sword-form melee class. They fight Trollocs and other players around the village of Edmond's Field, the Inn, the Aiel Waste and the Ways. Around that core sit persistence with save slots, an economy (Marks, factions, titles, shop), linked circles, wards, village NPCs and a tutorial (First Journey).

## Where the game lives

- The game exists **only in Roblox Studio** and in Roblox cloud saves. There is no Rojo, no Wally, no git and no script files on disk.
- This folder holds only `AGENTS.md`, `docs/`, `opencode.jsonc` (MCP configuration) and `.opencode/`.
- Edit through the `roblox-studio` MCP:
  - Get the studio id with `list_roblox_studios` at the start of each session. It changes when Studio reconnects.
  - Always pass `datamodel_type: "Edit"` to `execute_luau`.
  - Read with `script_read`, `script_grep`, `script_search`, `search_game_tree` and `inspect_instance`.
- Place Version History (Game Settings → Places) is the real rollback. The in-place backups are a convenience.

## Place map

| Location | Holds | Doc |
|---|---|---|
| `ServerScriptService` top level | Entry flow, `ServerBootstrap`, settings, map discovery, waygates, health | [server.md](docs/server.md) |
| `ServerScriptService/Server` | `ServerMain`, `Services` (~145 modules), `Abilities` (~46), `CustomWeaving`, feature scripts | [server.md](docs/server.md), [abilities.md](docs/abilities.md) |
| `ReplicatedStorage/Remotes` | Every RemoteEvent and RemoteFunction (92 authored, ~46 created at runtime) | [shared.md §2](docs/shared.md) |
| `ReplicatedStorage/ClientEvents` | Client-only BindableEvents (the input bus) | [shared.md §2.6](docs/shared.md) |
| `ReplicatedStorage/Shared` | ~138 shared modules: configs, input, UI helpers, visuals | [shared.md §3](docs/shared.md), [abilities.md](docs/abilities.md) |
| `ReplicatedStorage/Assets` | Effect templates, animations, thread actors, rigs | [shared.md §3.6](docs/shared.md) |
| `ReplicatedFirst` | Loading screen, menu, save pick, tutorial UI | [shared.md §4](docs/shared.md) |
| `StarterPlayer/StarterPlayerScripts` | ~190 client LocalScripts; no loader | [client.md](docs/client.md) |
| `StarterPlayer/StarterCharacterScripts` | Shiftlock, Animate, Health, Init | [client.md](docs/client.md) |
| `StarterGui` | 21 ScreenGuis | [client.md §5](docs/client.md) |
| `Workspace` | Map regions, named anchors, runtime effect folders | [world.md](docs/world.md) |
| `ServerStorage` | NPC assets, parked features, **backups that never run** | [world.md §6](docs/world.md) |

## Rules

### Before you edit

1. Read the doc section for the area you touch.
2. Back up every script you will change. Clone it into `ServerStorage/MCPBackups/<Change>_<YYYYMMDD>_Before` and keep its name.
   - Set an `OriginalPath` attribute on each clone.
   - Set a `Note` attribute on the folder. It says what the change does and which instances it creates, renames or moves, so a rollback knows what to undo.
   - Use script clones, not StringValue snapshots.
3. Filter search results. Before you trust a `script_grep` or `script_search` hit, drop every hit under `ServerStorage/MCPBackups`, `ServerStorage/ReadabilityBackup_*`, `ServerStorage/RisingSteel*Backup_*` and `ServerStorage/DisabledFlood`. Those copies never run.
4. Grep a name before you rename or delete the instance. The names that code looks up directly ([workflow.md §4](docs/workflow.md)) must not change unless every caller changes too.

### Where new things go

- **Server service:** a ModuleScript in `ServerScriptService/Server/Services` with a guarded `Start()`, started from `ServerBootstrap`.
- **Ability (weave):** a module in `ServerScriptService/Server/Abilities`. Follow [abilities.md](docs/abilities.md), section "How to change this area".
- **Client controller:** a LocalScript in `StarterPlayer/StarterPlayerScripts/Controllers`.
- **Shared module or config:** `ReplicatedStorage/Shared`, but only if the client needs it. Server-only code stays in `ServerScriptService`.
- **Remote:** an authored instance in `ReplicatedStorage/Remotes`.
- **VFX template:** `ReplicatedStorage/Assets/AbilityEffects`. Never at the Workspace root.
- **Map content:** inside its region folder (`Edmond's Field/...`, `AielWaste`, `Ways`).
- **Test-only UI or tools:** a disabled ScreenGui, or code gated by `RunService:IsStudio()`.

### Code rules

- The first line of every script is `-- Name: purpose.`
- A known limit gets `-- shortcut: <the limit>, <when to upgrade>`.
- The server is the authority. Clients send intents only. Every remote handler must:
  - type-check every argument, and for a `Vector3` also check NaN (`v == v`) and distance from the character;
  - throttle per player (`busy[p]` plus `rate[p]`);
  - re-check server state (alive, `CombatState`, `SessionDataReady`, Stilled, ownership);
  - prefer the server-issued permit or offer pattern over a client-supplied target ([server.md §9.2](docs/server.md)).
- Single writers. Never bypass them:
  - Damage: `DamageService.DealDamage(attacker, humanoid, amount, weaveId)`. Never `Humanoid:TakeDamage`.
  - Movement (WalkSpeed, Jump, AutoRotate): `MovementStateService`.
  - `CombatState`: `CombatService.SetState`.
  - `MarketplaceService.ProcessReceipt`: only `Server/GiftServer`.
- Remote names:
  - `<Feature>Action`: client→server input.
  - `<Feature>Visual`: server→client broadcast.
  - `<Feature>Feedback`: caster only.
  - `<Feature>Request`: a RemoteFunction or a command remote.
  - The first argument is a command string.
- Broadcast VFX with `Shared/VfxBroadcast.FireNearby`. Send caster-only events to targets that may be NPCs with `Shared/CombatTargets.FireClient`.
- Client scripts start in no fixed order. `WaitForChild` what you need, handle `CharacterAdded` yourself, and give each ScreenGui exactly one owner script.
- Keybinds live only in `Shared/Keybinds`. Add a new action Id instead of changing a default, because saved binds override defaults.
- Detect touch with `Shared/TouchUI.IsTouchUI()`. Register menus with `Shared/UiManager`.
- Break require cycles with a lazy `require` inside the function, as the existing services do.
- No secrets in scripts. Use `HttpService:GetSecret`.

### Saves

- **New saved field:** add it with a default to `DEFAULT_DATA` in `Services/DataService`. Reconcile adds it to old saves on their next load.
- **Per-save store:** build the key with `SaveSession.Key(...)`, and load and save through `DataService.OnSession`.
- Never write save data from `PlayerAdded`.
- Studio never writes `PlayerData_V1`, and `EconomyStore` is in-memory in Studio. A Studio test proves nothing about persistence.
- Never wipe or migrate live DataStores without the owner's word.

### Checks

- Check in Edit mode only: the script compiles, the Output log is clean, and the existing self-checks pass:
  - `require(game.ServerScriptService.Server.Services.LevelRules.SelfCheck)()`
  - `require(game.ServerScriptService.Server.Services.SaveSession.SelfCheck)()`
  - `require(game.ReplicatedStorage.Shared.WovenUI.SelfCheck)()`
  - `require(game.ServerScriptService.Server.Services.WeaveStatsService.SelfCheck)()`
- Read back the lines you changed.
- No Play sessions, captures or timed runs unless the owner asks for them. The owner tests by hand in Play.

### Outward-facing actions

These need the owner's explicit word: publishing, asset uploads, DataStore wipes, real purchases, and any webhook or HTTP change.

### Docs write-back

A change is not done until the docs match it. In the same task, update:

- the inventory row of every script you add, remove, disable or repurpose ([server.md](docs/server.md), [client.md](docs/client.md), [abilities.md](docs/abilities.md), [shared.md §3](docs/shared.md));
- the remote catalogue ([shared.md §2](docs/shared.md)) for every remote you add, remove or change;
- the DataStore table ([server.md §5.1](docs/server.md)) for every store or key change;
- [systems.md](docs/systems.md) when a system's owner scripts change;
- the "Legacy and dead code" section when you delete or revive something.

## Known hazards

Read these before touching the systems they name:

- `PlayerData_V1` has **no autosave** and **no session lock** ([server.md §10](docs/server.md)).
- Two server entry points, `ServerMain` and `ServerBootstrap`, start in no defined order ([server.md §3](docs/server.md)).
- `CastRequest` has two handlers. Their order depends on `CircleIntegrationService.Install()` running first ([server.md §10](docs/server.md)).
- `Services/AdminConfig` contains a Discord webhook URL with its token. Never copy it anywhere. It needs rotating and moving to a Secret.
- Many `WaitForChild` calls have no timeout. Renaming a world object can hang a script without any error.
