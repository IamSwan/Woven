# Server core

Taken from the live code in Roblox Studio (Edit DataModel), read-only, 2026-11-08. Citations are `Path/Script:line`. Paths under `ServerScriptService` drop that prefix, and `Server/Services` is written `Services/`. Line numbers drift as code changes.

Related docs: [architecture.md](architecture.md), [abilities.md](abilities.md) (`Server/Abilities`, `Server/CustomWeaving`, cast pipeline), [shared.md](shared.md) (full remote catalogue), [workflow.md](workflow.md).

## 1. Scope

- **Top-level scripts in ServerScriptService:** `HealthManager`, `PlayEntryServer`, `WeavePresentationObserver`, `BookPresentationServer`, `WaygateServer`, `ServerBootstrap`, `HideDefaultHealth`, `PlayerSettingsServer`, `MapDiscoveryServer`.
- **`ServerScriptService/Server`:**
  - `ServerMain`.
  - The top-level Scripts: `EconomyServer`, `MarksShopServer`, `GiftServer`, `MissionsServer`, `TitlesServer`, `InnTeleport`, `InnResidents`, `VillageTeachers`, `PlayerNametags`, `WovenOnboarding`, `WovenAmbience`, `FunnelAnalyticsServer`, `VoluntaryReset`, `TempestReadyWeather`, `ActiveAbilityBridge`.
  - `Server/Shared`: one module.
  - `Server/Services`: 144 ModuleScripts and 1 Script, including the `Trollocs/` and `Warder/` subfolders.

Out of scope here: `Server/Abilities` and `Server/CustomWeaving` (see [abilities.md](abilities.md)), ReplicatedStorage, client code, Workspace and ServerStorage. They appear only where this area calls into them:

- `AbilityService` loads the per-weave modules in `Server/Abilities` and starts them (`AbilityService:1579-1620`).
- `ServerBootstrap` requires `Server.CustomWeaving.ExperimentService` (`ServerBootstrap:61`) and starts `Server.Abilities.RawWater` (`ServerBootstrap:118`).
- `ServerMain`, `VoluntaryReset` and `DamageService` call `Abilities.CircleAbilities.Stilling` and `Abilities.RawEarth` directly (`ServerMain:82,100`, `VoluntaryReset:16`, `DamageService:423,494`).
- Nearly every module reads `ReplicatedStorage.Shared.*` configs.

Method: every top-level script was read in full. So were DataService, SaveSession, SaveSlotService, CombatService, DamageService, EconomyService, EconomyStore, EconomyRules, EconomyConfig and AdminConfig. For the rest of `Services/`, the header comments, the `Start` functions and every remote handler were read, plus pattern scans for remotes, DataStores, attributes, tags and TODOs. Anything not read line by line is marked as a guess or described at header level only.

## 2. Inventory

### 2.1 Top-level scripts (ServerScriptService)

All Scripts use `RunContext = Legacy`; none is disabled.

| Path | Lines | Responsibility | Key requires | Remotes |
|---|---|---|---|---|
| `ServerBootstrap` | 137 | Newer entry point. Starts about 17 subsystems, each in its own `task.spawn` + `xpcall` | Services listed in §3 | none directly |
| `HealthManager` | 65 | MaxHealth = base 250 plus tier, Vitality and Warder bonuses. Keeps missing HP when the max changes; full heal on spawn | Shared `ElementSkillConfig`, `AdvancedSkillConfig`, `WarderSkillConfig` | none |
| `PlayEntryServer` | 144 | Play and Back-to-Menu flow. Sets `CharacterAutoLoads=false`, owns spawning, kills at the void plane (Y < -200), builds the menu avatar | DataService, FirstJourneyService, SaveSlotService | `PlayEntry` (RE) |
| `WeavePresentationObserver` | 27 | Writes `WeaveReadySeed`/`WeaveReadyAt` when a player enters WeaveReady. Forwards `SpiritTechniqueActive` to presentation | WeavePresentationService | none |
| `BookPresentationServer` | 83 | Cosmetic held book: clone, weld, IK, `BookReading` attribute | Shared `BookPresentationConfig` | `BookReading` (RE) |
| `WaygateServer` | 160 | Waygate prompts (level 75+), phase timeline on gate attributes, crossing detection every 0.1 s, teleport | Shared `WaygateConfig`, WaygateSessions | `WaygateEvent` (RE) |
| `HideDefaultHealth` | 10 | Sets `HealthDisplayType=AlwaysOff` on every Humanoid in Workspace | none | none |
| `PlayerSettingsServer` | 139 | Per-save settings and keybinds, mirrored as `Setting_*` attributes. Saved in `WovenPlayerSettings_v1`; autosave every 120 s | DataService, SaveSession, Shared `Keybinds` | `PlayerSettings` (RF) |
| `MapDiscoveryServer` | 137 | Minimap fog-of-war cells (hex bitset), saved in `WovenMapDiscovery_v1`; mirrors `MapPos` for Circle members; autosave every 120 s | Shared `MapConfig` | `MapDiscovery` (RE) |

### 2.2 `Server/` top-level scripts

| Path | Lines | Responsibility | Key requires | Remotes |
|---|---|---|---|---|
| `ServerMain` | 152 | Legacy entry point. Runs `CircleIntegrationService.Install()`, then ordered `Start()` calls, the player load/unload loop, BindToClose, and the "how to play" chat reminder | about 20 core services, `Abilities.CircleAbilities.Stilling` | `BookChatReminder` (S→C) |
| `EconomyServer` | 136 | Economy and faction request router, push-on-change, 30 s faction upkeep, drains reward jobs on BindToClose | EconomyService, FactionService, EconomyRules, DataService, MockEconomyData (Studio only), TitlesService, CircleService, FactionNameRegistry | `EconomyRequest` (RF), `EconomyReady` (RE), `EconomyChanged` (S→C, created if missing) |
| `MarksShopServer` | 57 | Marks shop router and seller prompts; shop ticks every 5 s and 30 s. **Also starts FactionWarService and ChannelerNPCService** (`:53,55`) | MarksShopService, FunnelAnalyticsService, EconomyService | `MarksShopRequest` (RF), `MarksShopNotice` (S→C) |
| `GiftServer` | 174 | Gift purchases and delivery; retries delivery every 30 s. Holds the game's **only** `ProcessReceipt`, which also grants extra save slots | GiftProductConfig, GiftEntitlementService, GamepassBypassConfig, SaveSlotService, BeyondPatternService, MaximumAffinityService | `GiftRequest` (RF), `GiftNotice` (S→C) |
| `MissionsServer` | 33 | Stub: pushes empty mission state | none | `MissionsChanged` (S→C), `MissionsReady` (RE); creates both |
| `TitlesServer` | 4 | `require(TitlesService).Start()` | TitlesService | none |
| `InnTeleport` | 91 | Enter and Exit prompts for the inn, safe landing via raycast and overlap check | none | `InnTravel` (S→C) |
| `InnResidents` | 53 | Inn NPCs: idle animation, death, ragdoll, respawn after 90 s, scripted chatter every 35 s | VillageDamageService, RagdollService | `VillageSpeech` (S→C) |
| `VillageTeachers` | 208 | Teacher NPC dialogue trees; teaches weaves | LearnedWeaveService, VillageNPCService, Shared teaching, dialogue, personality and weave configs | `VillageConversation` (RE, created **unconditionally** at `:6`) |
| `PlayerNametags` | 115 | Server-built BillboardGui nametag: title, identity, level, faction | TitlesService, Shared `PlayerNametagConfig`, `TitlesConfig` | none |
| `WovenOnboarding` | 38 | **Disabled.** Old first-weave onboarding flags | DataService | none |
| `WovenAmbience` | 37 | Looped spatial ambience emitters in `workspace.WovenAmbience` | none | none |
| `FunnelAnalyticsServer` | 20 | Session funnel steps 1 (join) and 2 (EnteredWorld) | FunnelAnalyticsService | none |
| `VoluntaryReset` | 20 | Tells a self-reset apart from combat death and resolves Stilling. Rate limit 1 s | `Abilities.CircleAbilities.Stilling` | `VoluntaryCharacterReset` (RE, created if missing) |
| `TempestReadyWeather` | 28 | Heartbeat at 0.1 s: storm weather token while a player holds a Tempest ready | TempestWeatherService | none |
| `ActiveAbilityBridge` | 498 | Maps ready and held ability attributes to `IncomingThreadVisual` broadcasts | Shared `WeaveConfig`, `VfxBroadcast` | `IncomingThreadVisual` (S→C) |

### 2.3 `Server/Shared`

| Path | Lines | Responsibility |
|---|---|---|
| `Shared/ScreenShakeService` | 168 | Server-triggered screen shake with distance falloff (O(n) over players) |

### 2.4 `Server/Services`, grouped by subsystem

All entries are ModuleScripts unless marked. "Start" means the module exposes `Start()`. "Listens" names the remotes it handles.

**Persistence and session**

| Module | Lines | Responsibility | Notes |
|---|---|---|---|
| DataService | 900 | Player profile: load, save, cache, leaderstats, session hooks (`OnSession`), save-slot peek (`PeekSlots`: Exists, Level, Class, Kills, LastPlayed, Marks, Title), wipe | Store `PlayerData_V1`. Reads `WarderProgress_v1`. No Start. **No autosave loop**, though its header says there is one (`:2`) |
| SaveSession | 22 | Pure map player → open slot; `Key(player, base, suffix, slot)` | Has an assert-based `SelfCheck` child (30 lines) |
| SaveSlotService | 113 | Save picker (List/Buy/Choose) and account record | Start. Listens `SaveSlot` (RF). Store `WovenAccount_v1`. `GrantReceipt` is called from GiftServer |
| LevelRules | 87 | Pure level rules: legacy migration, Warder level merge, clamp, owner-only commands. `WARDER_STORE = "WarderProgress_v1"` | Has a `SelfCheck` child (66 lines) |
| EconomyStore | 82 | DataStore wrapper: Update (3 retries), Read (uncached), Rank/Top/RemoveRank (ordered), EachKey. **In-memory store in Studio** | Used by Economy, Factions, Shop, SaveSlot, Stilling, GuardianBond, Titles |

**Combat, health and state authority**

| Module | Lines | Responsibility | Notes |
|---|---|---|---|
| CombatService | 290 | `CombatState` attribute state machine, `PvPMode` flag, tied weaves | Start. Listens `CombatStateRequest`, `TiedWeaveAction` (created) |
| DamageService | 558 | Single damage choke point (`DealDamage`), attacker history, kill and assist credit, Marks and XP rewards | Start. Fires `ProgressionFeedback` |
| DamageModifierService | 144 | Damage modifiers | Start (guarded) |
| FinisherService | 160 | Applies the HP loss (`TakeDamage`) and the confirmed-death presentation | |
| ElementalReactionService | 187 | Element reactions; `FilterDamage`, `WaterAt` | Start (guarded) |
| PlayerProtectionService | 101 | Spawn and novice protection | Start (guarded) |
| QuickProtectService | 125 | Once-per-life Quick Protect | Start. Fires `QuickProtectEffect` |
| StatusDurationService | 48 | Counts down Stilled and Silenced time only while the player is in game | Start |
| StillingService | 72 | Stilled state; account-wide remaining time in `WovenAccount_v1` | |
| SilenceService | 107 | Silence and chat gating; starts ListeningWardVoiceService | Start |
| BrokenLegService | 81 | Broken-leg state | |
| RagdollService | 1233 | R15 ragdoll and recovery | Start |
| MovementStateService | 260 | **Single writer** for WalkSpeed, Jump and AutoRotate; priority states | Start (guarded) |
| MovementRestrictionService | 397 | Movement locks plus a watchdog for stuck locks | Start |
| SprintService | 461 | Sprint and stamina | Start. Listens `SprintRequest` |
| StatModifierService | 134 | Temporary stat modifiers (started by ManaService) | Start |
| DrowningService, WaterBreathingService | 417 / 30 | Drowning | Start |
| ContestInputGuard | 52 | Timing guard against autoclickers in contests | |
| ShieldingContestService | 76 | Click race for Shielding (Air Prison) | Listens `ShieldingContest` (created) |
| CompulsionService | 295 | Compulsion control and `MirrorCast` | |

**Channeling, mana, abilities and weaves** (details in [abilities.md](abilities.md))

| Module | Lines | Responsibility | Notes |
|---|---|---|---|
| ChannelService | 784 | Channel start, stop and confirm; element catching; ready weave | Start. Listens `ChannelRequest`, `ElementCaught` |
| ChannelRecoveryService | 27 | Stores the client's input mode (mobile or not) | Listens `ChannelInputMode` |
| ManaService | 1207 | Mana pool, regen, `SpendWithBurnout`, `Mana` attribute | Start |
| WeaveStatsService | 70 | Publishes read-only weave numbers to `ReplicatedStorage/WeaveStats` (ThreadCap, BurnoutBaseMultiplier, per-weave ManaCost/ReadyWindow/GateElement/GateTier), each read from the module gameplay uses | Start (guarded, from ServerBootstrap). Has a `SelfCheck` child. Nothing on the server reads WeaveStats |
| BurnoutService | 148 | Burnout state; `InitPlayer` | |
| AbilityService | 1691 | Routes casts to ability modules in `Server/Abilities` | Start. Listens `CastRequest` |
| WeaveService | 88 | Matches a recipe to a weave (`IdentifyWeave`) | |
| LearnedWeaveService | 207 | Learned-weave inventory, `LearnedWeave_*` attributes | Start |
| AbilityOwnershipService | 100 | `Abilities.weave` / `.warder`, shown as `HasAbility_*` attributes | Start → `OnSession` |
| QuickSlotService | 925 | Quick slots, loadouts, cooldowns, Extra Quick Slots pass | Start. Listens `QuickSlotAssign`, `QuickSlotUse`, `QuickSlotSwitch` |
| AffinityService, MaximumAffinityService | 425 / 76 | Weave affinity; the pass entitlement | Start / – |
| ElementSkillService, ElementAlignmentPolicy | 287 / 89 | Skill points, tiers, alignment purchase; mastery gate map in the pure child `ElementSkillService/MasteryGates` | Listens `ElementSkillPurchase`, `ChooseElementAlignment`, `ChangeElementAlignment` (RF, all created at require time) |
| ProgressionService | 510 | XP and level, 2x XP pass, kill and assist XP | Start |
| BeyondPatternService | 77 | Beyond the Pattern pass: level cap 100 or 500 | |
| SpiritTechniqueService, MagicCharacterService | 235 / 292 | Spirit techniques | Listens `SpiritTechnique` (created at require time) |
| WardService, HeldWardService | 940 / 380 | Wards; held ward | HeldWard: Start, listens `HeldWardAim`, `HeldWardStop` |
| ProjectileService | 793 | Projectile registry (deflect, pause, redirect) | |
| SoloWeaveRuntime, AuthoredWeaveCastService, WeavePresentationService, WeaveCastLog, FireGestureService, CrumbleAnimationService, ImportedFireballService, FollowingLightService | various | Runtime and presentation helpers for weaves | |
| RawAir*, RawFire*, RawWaterFormationService, TerrainWaterService, WaterResourceService, WaterInteractionService, Tempest*, TornadoControlService, BlackWindService | various | Raw element runtimes, terrain water, storms | `RawWaterFormationService` has no references (§8) |

**Circles (linked groups)**

| Module | Lines | Responsibility | Notes |
|---|---|---|---|
| CircleService | 716 | Circle formation, membership, shared weave | Start. Listens `CircleAction` |
| CircleIntegrationService | 1124 | **Wraps** ChannelService, ManaService and DamageService functions (`Install`, `:501-941`). Circle cast router | Listens `CastRequest`, connected before AbilityService |
| CircleWeaveService | 99 | Registry of Circle-only recipes | Start |
| CircleAbilityRuntime | 438 | Runtime for maintained Circle abilities | Start. Listens `CircleAbilityAction` |
| CircleTakeoverService, CircleKillRecipients, CircleFeedbackService, CircleFlameWallService, CircleEnvironmentService, CircleAttackUtility | small | Helpers | |
| CircleExpansionService | 4 | Compatibility stub; no references | §8 |

**Economy, monetization, social**

| Module | Lines | Responsibility | Notes |
|---|---|---|---|
| EconomyService | 426 | Marks profile, write lock, reward queue, codes, daily rewards, challenges, kills | Store `WovenEconomy_v1` |
| EconomyRules / EconomyConfig | 90 / 30 | Pure rules and tunables | |
| MockEconomyData | 115 | Studio-only fake economy and factions | |
| FactionService / FactionNameRegistry / FactionWarService / FactionWarRules | 686 / 102 / 228 / 15 | Factions, names, wars | Stores `WovenFactions_v1`, `WovenFactionNames_v1`, ordered `WovenFactionDirectory_v1`, `WovenFactionActiveWeeks_v1`. Messaging topic `WovenFactionWarWon_v1` |
| MarksShopService | 197 | Titles, bounties and boosts bought with Marks | Store `WovenBounties_v1` |
| GiftEntitlementService / GiftProductConfig / GamepassBypassConfig | 57 / 13 / 31 | Gifted pass entitlements, gift products, the bypass list | Store `WovenGiftEntitlements_v1` |
| TitlesService | 707 | Title inventory and custom definitions | Start. Listens `TitlesRequest` (RF), `TitlesReady`. Store `WovenTitleDefs_v1`, topic `WovenTitleDefsChanged_v1` |
| GuardianBondService (+ GuardianBondTest) | 425 / 184 | Bond between a Channeler and a Guardian | Start. Listens `GuardianBond`. Store `GuardianBonds_v1` |
| FunnelAnalyticsService | 140 | Funnel events through AnalyticsService | |
| GroupRoleService | 47 | Group roles for permissions | |
| FirstJourneyService | 499 | Once-only tutorial in a reserved server | Listens `FirstJourney` (created at require time) |
| WaygateSessions / BlackWindService | 134 / 145 | Waygate travelling parties and the hunter that chases them | |
| DayNightService | 22 | Day/night clock on workspace attributes | Start |
| ListeningWardVoiceService | 95 | Voice relay for listening wards | Start (guarded) |

**Admin**

| Module | Lines | Responsibility | Notes |
|---|---|---|---|
| AdminService | 910 | Commands, roles, bans, cross-server messaging, Discord webhook log | Start. Listens `AdminRequest` (RF). Stores `WovenModeration_v1`, `WovenPanelAllow_v1` |
| AdminConfig | 28 | Owners, topics, command list, webhook settings | **Contains a webhook secret (§10)** |
| AdminFlightService | 82 | Admin flight | Start |

**Guardian (Warder) melee**

| Module | Lines | Responsibility | Notes |
|---|---|---|---|
| WarderService **(Script)** | 89 | Routes melee V1 actions (M1, Block, Dodge). A Script inside the Services folder, so it runs by itself. Gated by `AbilityOwnershipService.Has(p,"warder")` | Listens `WarderRequest` (created if missing) |
| Warder/WarderState, WarderStun, WarderM1, WarderBlock, WarderDodge, WarderHitbox, WarderSound | 27–93 | Melee V1 parts | |
| WarderCombatService | 1789 | Warder Combat Test V2 (sword forms, dash, plunge) | Start (called by AdminService.Start). Listens `WarderTestRequest` |
| WarderSkillService | 180 | Guardian skill purchases | Start (called by WarderCombatService.Start). Listens `WarderSkillPurchase` (RF) |

**NPCs and AI**

| Module | Lines | Responsibility | Notes |
|---|---|---|---|
| VillageNPCService | 575 | Village residents: homes, routes, pathfinding, dialogue, fleeing, teachers | Start. Needs `workspace["Edmond's Field"].NPCMarkers`, `ServerStorage.VillageNPCAssets.Templates` |
| VillageDamageService / VillageCarryService / NPCOutfitService | 115 / 62 / 121 | NPC damage, carrying, stored outfits | |
| GuardService | 390 | Guards and militia: arm up at a safe house, leashed fights | Start. Needs `NPCMarkers.GuardPosts` |
| ChannelerNPCService / ChannelerNPCSpells | 598 / 278 | Channeler NPCs at the `workspace.SellerNPC` markers | Start (from MarksShopServer) |
| Trollocs/TrollocService | 178 | Orchestrator: spawn rig, AI, rewards; `MaxAlive` cap | Start (from TrollocSpawnService.Start and AdminService raid commands) |
| Trollocs/TrollocSpawnService, TrollocRaidDirector, TrollocRaidService | 167 / 253 / 81 | Spawning outside player view; night raids on the settlement | Start |
| Trollocs/TrollocAI, Decision, Movement, Senses, Scent, Noise, Targets, Pack, Assault, Combat, Death, Water, Animation, Audio, Metrics | 26–547 | AI subsystems (Init or Start shape) | |
| Trollocs/TrollocConfig | 93 | All Trolloc tuning | |
| Trollocs/TrollocDevCommands | 132 | Studio-only `ServerStorage.TrollocDev` BindableFunction | |
| TrollocEquipmentService | 106 | Mace visuals (CollectionService tag `E.Tag`) | Start |

## 3. Boot and lifecycle

### 3.1 Two entry points run in parallel

`ServerMain` and `ServerBootstrap` are both enabled Scripts. Roblox does not guarantee which runs first, and neither waits for the other. The order inside each script is well defined.

**ServerMain** (`Server/ServerMain`):

1. Requires DataService and about 20 core services (`:12-33`).
2. **`CircleIntegrationService.Install()`** (`:36`). This replaces public functions on ChannelService, ManaService and DamageService with Circle-aware wrappers (`CircleIntegrationService:501-941`). It must run before the services connect their remotes, because CircleIntegrationService's own `CastRequest` listener must connect before AbilityService's (`CircleIntegrationService:980-988`).
3. `DayNightService.Start()` (`:37`).
4. `Start()` in this order: Combat, DamageModifier, Circle, CircleWeave, Channel, Mana, Progression, Damage, Affinity, Ability, Sprint, Ragdoll, LearnedWeave, AbilityOwnership, QuickSlot, MovementRestriction, MovementState (`:39-55`).
5. `DataService.OnSession({Leave=...})`: ends the player's Stilling target, channel and Circle membership when a save closes (`:81-85`).
6. `SaveSlotService.Start()`, `GuardianBondService.Start()` (`:92-93`).
7. Connects PlayerAdded and PlayerRemoving, and runs the join handler for players already in the server (`:94-96`).
8. `BindToClose`: for each player in turn, resolve Stilling, then `DataService.SavePlayer` (`:98-103`).
9. Chat reminder block (`:106-150`).

**ServerBootstrap** (`ServerBootstrap:9-16`): each block is `task.spawn(xpcall(fn, debug.traceback))`. A failure warns `[ServerBootstrap] <name>` and does not stop the other blocks. The blocks:

1. CrumbleAnimation: binds attribute listeners inline.
2. `PlayerProtectionService.Start`.
3. `MovementStateService.Start` (ServerMain calls it too; the guard makes the second call a no-op).
4. `require(Server.CustomWeaving.ExperimentService)` (the require is the start).
5. `ListeningWardVoiceService.Start` (SilenceService also calls it; guarded).
6. `TrollocEquipmentService.Start`.
7. `TrollocSpawnService.Start` → `TrollocService.Start`, then `TrollocRaidDirector.Start`, then `TrollocDevCommands.Start`.
8. `require(WaterInteractionService)`.
9. `VillageNPCService.Start`.
10. `GuardService.Start`.
11. `HeldWardService.Start`.
12. `AdminService.Start` → `AdminFlightService.Start`, `WarderCombatService.Start` → `WarderSkillService.Start` (`AdminService:880-882`, `WarderCombatService:1540-1542`).
13. `require(ElementSkillService)` (the module body connects its RemoteFunctions, `ElementSkillService:172-220`).
14. `require(SpiritTechniqueService)` (the module body connects its remote).
15. `require(Server.Abilities.RawWater).Start()`.
16. `SilenceService.Start`.
17. `StatusDurationService.Start`.
18. `QuickProtectService.Start`.
19. `WeaveStatsService.Start` (builds `ReplicatedStorage/WeaveStats`; requires ChannelService and ManaService, which have no require-time side effects).

**Other starters spread across scripts:**

- `TitlesServer` → `TitlesService.Start`.
- `MarksShopServer:53,55` → `FactionWarService.Start`, `ChannelerNPCService.Start`.
- `EconomyServer:43` → `FactionNameRegistry.Ensure`.
- `ManaService.Start` → `StatModifierService.Start`.
- `CircleService.Start` → `DamageModifierService.Start` (guarded).
- `AbilityService.Start` auto-loads generic ability modules, then calls 11 named ability `Start()`s (`AbilityService:1579-1620`).
- **Require-time side effects** (module bodies that connect remotes or loops when first required): ElementSkillService, SpiritTechniqueService, ShieldingContestService, FirstJourneyService, ChannelRecoveryService, WaterInteractionService. Whichever script requires them first starts them.

**Guarding.** Most `Start()`s are guarded with `started`, `S.Started` or `Service.Started`. Not guarded, from the excerpts read: `ManaService.Start`, `ProgressionService.Start`, `TitlesService.Start`, `GuardianBondService.Start`, `FactionWarService.Start`, `CombatService.Start` (only its inner `StartTiedWeaves` is guarded), `DamageService.Start`. Each is called once today; a second call would double-connect.

### 3.2 Player lifecycle

1. **Join.** Each script handles PlayerAdded on its own: settings defaults, map discovery load, PlayEntry `watch` (`EnteredWorld=false`, menu avatar, ReplicationFocus on the menu camera), admin moderation check (kick if banned, or if the record cannot load and the player is not an owner; `AdminService:855-861`), and so on.
2. **Save pick** (only when `SaveSlotConfig.Enabled`). ServerMain loops until the `SaveSlot` attribute is set and no unload is running (`ServerMain:61-63`). `SaveSlot` and `SaveClass` are set only by `SaveSlotService` `Choose` (`SaveSlotService:103-104`).
3. **Load.** `DataService.LoadPlayer` (`DataService:377-484`):
   1. `GetAsync(key)`. On error, **kick** (`:410`).
   2. If new, build defaults. A slot above 1 gets `Class`; a Guardian gets the Warder ability and skips the tutorial.
   3. Migrations: `LevelRules.MigrateLegacy`, then `MergeWarderLevel` (one-time import from `WarderProgress_v1`).
   4. Reconcile with `DEFAULT_DATA`.
   5. Clamp the level by pass. If `BeyondPattern.ResolveMaxLevel` returns nil, it returns silently, leaving no profile and no slot.
   6. Store the profile and `Session.Open(player, slot)`.
   7. Build leaderstats and attributes.
   8. Spawn every registered `OnSession` `Load(player, slot)` hook.
4. **First load only:** `CombatService.InitPlayer`, `BurnoutService.InitPlayer` (`ServerMain:67-71`).
5. `FirstJourneyService.Prepare(player)`. If it returns true, set `SessionDataReady=true` (`:72-74`).
6. **Play.** The client fires `PlayEntry("Play")`. The server checks `SessionDataReady`, may send the player into the tutorial, sets `EnteredWorld=true`, and calls `LoadCharacterAsync` (`PlayEntryServer:125-141`). On death, a respawn is scheduled after `RespawnTime` (`:57-73`).
7. **Back to Main Menu.** The client fires `PlayEntry("Menu")`, which leads to `DataService.Unload(player)` (`PlayEntryServer:82-105`). On success the character is destroyed, the menu returns, and ServerMain's outer loop waits for the next pick (`ServerMain:76`).
8. **Unload** (`DataService:866-896`), in order:
   1. Clear the profile, which blocks writes through `GetData`.
   2. `savePlayer`. If it fails and the player is not leaving, restore the profile and return false.
   3. Run every hook's `Leave`.
   4. Run every hook's `Save(slot)`.
   5. `Session.Close`.
   6. Run every hook's `Unload`.
   7. If the player is staying, clear `SessionDataReady`, `SaveClass`, `SaveSlot`.
9. **Leave.** `PlayerRemoving` → `DataService.Unload(player, true)` (`ServerMain:88-90`). Other scripts clean up their own per-player tables.
10. **Shutdown.** Several `BindToClose` handlers run. ServerMain saves profiles one after another. PlayerSettings and MapDiscovery save dirty players in parallel with a 20 s cap. EconomyServer drains queues and flushes reputation with a 25 s deadline.

## 4. Networking

The Remotes folder is `ReplicatedStorage.Remotes`; the full catalogue (fired-by and handled-by for every remote) is in [shared.md §2](shared.md). Most remotes are authored there. These are **created at runtime if missing**: `EconomyChanged`, `EconomyReady`, `MissionsChanged`, `MissionsReady`, `VoluntaryCharacterReset`, `TiedWeaveAction`, `VillageConversation` (always created: `VillageTeachers:6`), `ElementSkillPurchase`, `ChooseElementAlignment`, `ChangeElementAlignment`, `SpiritTechnique`, `ShieldingContest`, `FirstJourney`, `ChannelInputMode`, `WarderRequest`, `TitlesChanged`, `TitlesReady`, `TitlesRequest`. A client that waits on one of these with `WaitForChild` depends on the server creating it.

### 4.1 Remotes the server listens on (client → server)

| Remote | Type | Handler | Payload | Server validation |
|---|---|---|---|---|
| `PlayEntry` | RE | `PlayEntryServer:125` | `"Play"` / `"Menu"` | Exact string match. `busy[player]`. Play needs `SessionDataReady`. Menu checks tutorial, unloading, `EnteredWorld`, `SessionDataReady`, and a 3 s cooldown. **Play has no rate limit beyond `busy`.** |
| `BookReading` | RE | `BookPresentationServer:64` | boolean | `typeof=="boolean"`. Open checks alive, CombatState, ragdoll, PlayScreen. No rate limit (open is idempotent). |
| `WaygateEvent` | RE | `WaygateServer:87` | `"Cancel"` / `"Choose", id` | `id` must be a string in `C.Destinations`. Needs a pending gate session (30 s, set by a server ProximityPrompt), proximity, level ≥ `MinimumLevel`. |
| `PlayerSettings` | RF | `PlayerSettingsServer:105` | `key, value` or `"ResetBinds"` | Key whitelist (`DEFAULTS`). Per-key type checks; JSON layouts bounded (1200 / 40 chars, coordinate ranges). Keybinds checked against `Keybinds.Allowed`. Rate limit 0.2 s; **`ResetBinds` has none.** |
| `MapDiscovery` | RE | `MapDiscoveryServer:82` | `"Request"` | Needs `loaded[player]`. **No rate limit.** Each request fires one `"Full"` event per area. |
| `VoluntaryCharacterReset` | RE | `VoluntaryReset:8` | none | 1 s rate limit, alive check. |
| `EconomyRequest` | RF | `EconomyServer:64` | `action` (string ≤ 32), `payload` | Action whitelist. `busy` plus a 0.6 s rate on mutating actions; **`Snapshot` is unthrottled** (each call does `E.Touch` and may schedule a debounced write). Payload checks happen in each handler (e.g. `E.Redeem` string ≤ 64; `E.ClaimChallenge` id is a string). FactionService validation was not read. |
| `EconomyReady` | RE | `EconomyServer:37` | none | 2 s rate. |
| `MarksShopRequest` | RF | `MarksShopServer:8` | `action, payload` | `busy` plus a 0.4 s rate on non-Snapshot actions. Requires `Shop.NearSeller(p)`. Action whitelist. MarksShopService payload checks were not read. |
| `GiftRequest` | RF | `GiftServer:146` | `action, passId, targetId` | `busy` plus 0.5 s. `passId` must be a configured item. `targetId` must be a player in this server and not the sender. Ownership checked with `UserOwnsGamePassAsync`. Send reserves a gift atomically with `UpdateAsync`. |
| `MissionsReady` | RE | `MissionsServer:30` | none | **No rate limit** (stub; each call pushes an empty table). |
| `VillageConversation` | RE | `VillageTeachers:153` | `"Close"` / `"Choice", n` / `"Learn"` | Choice: 0.2 s rate, integer `n`, live session plus `eligible`. Learn: needs a server-made offer that has not expired, plus level, tier, Stilled and already-learned checks. |
| `SaveSlot` | RF | `Services/SaveSlotService:69` | `action, slot, class` | 0.5 s rate. `slot` must be an integer in `1..Owned`. `class` must be in `Config.Classes`, only for a new slot above 1. Refused while a save is open or unloading. |
| `CombatStateRequest` | RE | `Services/CombatService:133` | `"TogglePvP"` / `"SetPvP", bool` | Bool check, not while Dead. **No rate limit.** `PvPMode` is read only by client camera and aim code plus `Shared.ProjectileAimService`; no server gameplay check reads it, so the risk is low. |
| `TiedWeaveAction` | RE | `CombatService:234` | `"Tie"` / `"Untie"` | `busy` plus 0.15 s. Level ≥ 100 plus Beyond the Pattern, not Stilled, MagicSuppressed or BurnoutRecovery, alive, and a live candidate session. |
| `ChannelRequest` | RE | `Services/ChannelService:696` | `"Start"` / `"Stop"` / `"Confirm"` | Gated by the `CombatState` machine. Unknown strings are ignored. No rate limit; repeats are no-ops but each state change broadcasts. |
| `ElementCaught` | RE | `ChannelService:746` → `AddElement:257` | `elementName, spawnPosition` | Blocked while custom-experimenting, dragged, fire-held, being stilled, burnout recovering or spirit-stunned. State must be `Channeling`. `isValidElement`. Thread count ≤ 10. **No timing check by design** (`:309-314`). `spawnPosition` is only `typeof`-checked, then rebroadcast to nearby clients through `VfxBroadcast` with **no range or NaN check**. Wrapped by CircleIntegrationService. |
| `CastRequest` | RE | `CircleIntegrationService:988` (first), `AbilityService:1630` | `aimPosition` | Circle path: not Stilled, leader, WeaveReady, Circle weave, connected. Ability path: burnout lock, per-player re-entrancy lock, then `CastCurrentWeave` gates (`:973-1030`). **`aimPosition` is not validated centrally**; see [abilities.md](abilities.md) §11. |
| `SprintRequest` | RE | `Services/SprintService:247` | `isHeld` bool | Session exists, bool type, BrokenLeg, `canSprint`. |
| `QuickSlotAssign` / `QuickSlotUse` / `QuickSlotSwitch` | RE | `Services/QuickSlotService:288,667,812` | `(abilityId, slot)` / `(slot, aim, individual)` / `(inputMode)` | Assign: valid ability, quick-slot allowed, learned, `validSlot`; custom IDs must be in the player's library; loadout 2 needs the pass. Use: tutorial gate, pass, `isQuickCastBlocked`, cooldowns; `individualQuickCast` is forced on at level ≥ 100 (`:672`). |
| `CircleAction` | RE | `Services/CircleService:632` | `action, payload` | Invite needs a `Player` instance. Other actions check membership or leadership inside the service. |
| `CircleAbilityAction` | RE | `Services/CircleAbilityRuntime:376` | `"Release"` / `"Sync"` | Release needs an own active session older than 0.4 s. Sync is limited to once per 3 s. |
| `HeldWardAim` / `HeldWardStop` | RE | `Services/HeldWardService:281-282` | aim / none | `S.Aim` validation not read. Stop is ignored for tied wards. |
| `ChannelInputMode` | RE | `Services/ChannelRecoveryService:7` | bool | `typeof=="boolean"`. |
| `ShieldingContest` | RE | `Services/ShieldingContestService:41` | `token` | Must match the active contest token. `ContestInputGuard` detects autoclicking, writes an automatic **moderation warning** (`AdminService.AutoclickWarning`) and ends the contest. |
| `SpiritTechnique` | RE | `Services/SpiritTechniqueService:143` | `action, value` | Needs a server-issued `permit` (not expired, same character, `valid(p)`). Target via `Targets.FromCharacter` plus `allowedTarget`. Technique names checked against server `choices()`. |
| `FirstJourney` | RE | `Services/FirstJourneyService:416` | `action` | 0.25 s rate (except `Sync`). Each action checks profile and session state. |
| `ElementSkillPurchase` / `ChooseElementAlignment` / `ChangeElementAlignment` | RF | `Services/ElementSkillService:175,181,216` | `element, tier` | Shared `recent[p]` rate of 0.15 / 0.3 / 0.5 s. Tier must be `current+1`; cost checked; no yield between check and commit (`:168-169`). The change is paid through `Economy.Update` with a receipt. |
| `WarderSkillPurchase` | RF | `Services/WarderSkillService:169` | `id, tier` | 0.15 s rate; valid tree; not in tutorial; is a Warder; level and points. |
| `WarderRequest` | RE | `Services/WarderService:71` | `action, directionKey` | String type, `AbilityOwnershipService.Has(p,"warder")`, `WarderGate.HasLiveWeave`. Further checks are in the Warder/ modules (not read). |
| `WarderTestRequest` | RE | `Services/WarderCombatService:1543` | `action, arg…` | Needs a session (only created by the admin `WarderTest` command). At most 30 messages/s. `Vector2` clamped and NaN-checked. Stamina, tier and airborne raycasts checked on the server. The client controls Perfect-stroke timing (`:1628` shortcut). |
| `GuardianBond` | RE | `Services/GuardianBondService:394` | `action, arg` | Offer needs a `Player` instance plus the `GuardianBondWeaveReady` attribute. Respond, Mask and Release internals not read. **No rate limit seen at the handler.** |
| `TitlesRequest` | RF | `Services/TitlesService:641` | `"List"` / `"Equip", id` | `Equip` validated inside TitlesService (not read). No rate limit. |
| `TitlesReady` | RE | `TitlesService:632` | none | **No rate limit.** |
| `AdminRequest` | RF | `Services/AdminService:885` | `command, args` | `S.Execute`: command must be a string, `args` a table, and `CanUse(actor.UserId, command)` must pass (`:327-328`). Role comes from `AdminConfig.Owners`, the group role, or the stored Moderator role (`:60-65`). Non-read-only commands: `busy` plus 0.5 s. |

### 4.2 Server → client remotes (seen in this area)

`EconomyChanged`, `EconomyNotice`, `MarksShopNotice`, `GiftNotice`, `MissionsChanged`, `TitlesChanged`, `AdminNotice`, `ProgressionFeedback`, `VillageSpeech`, `InnTravel`, `BookChatReminder` (FireAllClients, server-wide rate limit 30 s and per-player 60 s), `IncomingThreadVisual`, `ThreadVisual`, `CircleReworkVisual`, `CircleState`, `CircleAbilityVisual`, `QuickSlotCooldown`, `QuickProtectEffect`, `CircleVictimFeedback`, `SoloWeaveFeedback`, `FactionWarVisual`, `BurnoutDeathVisual`, `FireballImpactVisual`, `WardHitImpact`, `CompulsionVisual`. Bidirectional remotes also reply on the same instance (PlayEntry, Waygate, MapDiscovery, GuardianBond and others).

**Pattern: push on change plus a Ready resync.** The server pushes full state, and the client fires `*Ready` once its listener is live to get a resend (`EconomyServer:16-42`, `MissionsServer:2-4`, `TitlesService:631`).

## 5. State

### 5.1 DataStores

| Store | Owner | Key | Content |
|---|---|---|---|
| `PlayerData_V1` | DataService | `Player_<uid>` (slot 1), `Player_<uid>_S<n>` (slot n) via `SaveSession.Key` (`DataService:11-13`) | Main profile (§5.2) |
| `WarderProgress_v1` (`LevelRules.WARDER_STORE`) | DataService | `Warder_<uid>` | Old Guardian level. **Read once, never written** (`DataService:36-46`) |
| `WovenAccount_v1` | SaveSlotService, StillingService | `<uid>` | `{ExtraSlots, Receipts{PurchaseId=time}, LastSlot, LastClass, StilledRemaining}` (account-wide) |
| `WovenEconomy_v1` | EconomyService | `<uid>` (slot 1), `<uid>_S<n>` | Economy profile (`EconomyRules.Default`): Marks, LastLogin, FirstKillDay, DailyClaimDay, DailyIndex, ChangeAt, Rerolls, Codes, Receipts, Farm, Titles, Cosmetics, Boosts, XPRewards, RepOutbox, WeekHistory, WeeklyClaims, Daily, PendingAnalytics, CompletedBounties, FactionId… Faction fields are account-wide and copied from slot 1's record (`EconomyService:29-85`) |
| `WovenFactions_v1` | FactionService | `Faction:<id>`, `Invites:<uid>`, weekly result keys | Faction records and invite inboxes |
| `WovenFactionNames_v1` | FactionNameRegistry | (not read) | Name and tag uniqueness |
| `WovenFactionDirectory_v1` (ordered) | FactionService | faction id → CreatedAt | Directory listing |
| `WovenFactionActiveWeeks_v1` (ordered) | FactionService | week key | Week settlement |
| `WovenBounties_v1` | MarksShopService | `<target uid>` | Bounties |
| `WovenGiftPurchases_v1` | GiftServer | `<uid>` (sender) | Wallet `{[PurchaseId] = {PassId, At, Target?, SenderName?, Sent?}}` |
| `WovenGiftEntitlements_v1` | GiftEntitlementService | `<uid>` (receiver) | Gifted passes |
| `WovenTitleDefs_v1` | TitlesService | `Custom` (per header) | Custom title definitions |
| `GuardianBonds_v1` | GuardianBondService | `<uid>_<slot>` | Bond record |
| `WovenPlayerSettings_v1` | PlayerSettingsServer | `u<uid>` (slot 1), `u<uid>_s<n>` | Settings table |
| `WovenMapDiscovery_v1` | MapDiscoveryServer | `u<uid>` | `{[areaId] = hexBitString}`. **Not per slot.** |
| `WovenModeration_v1` | AdminService | `User_<uid>` | `{Role, Warnings[], History[], BanUntil, BanReason}` |
| `WovenPanelAllow_v1` | AdminService | `Allowed` | Panel allow-list |

**MessagingService topics:** `WovenModerationChanged_v1`, `WovenAnnounceAll_v1`, `WovenPanelChanged_v1`, `WovenAdminDirect_v1` (AdminConfig), `WovenTitleDefsChanged_v1`, `WovenFactionWarWon_v1`. All are skipped in Studio.

**AnalyticsService funnels:** `WovenSession_v1`, `WovenTutorial_v4`, `MarksShop_v1` (FunnelAnalyticsService), plus `LogEconomyEvent` for Marks.

**Studio behaviour:**

- DataService **never writes** in Studio (`DataService:489`).
- EconomyStore uses an in-memory table in Studio (`EconomyStore:16-21,34,41…`), so Economy, Account, Bonds and Titles start empty on every Studio run.
- GiftServer's wallet read and write are no-ops in Studio (`GiftServer:25,33`).
- Moderation uses `studioData` in Studio.
- PlayerSettings and MapDiscovery **do** use the real DataStore in Studio, if API access is on.

### 5.2 Main profile schema (`PlayerData_V1`)

**Defaults** (`DataService:52-121`):

```
Level=1, LevelGrant=0, LegacyLevelMigrated=true, XP=0, Kills=0, Deaths=0,
LearnedWeaves={}, Abilities={weave=true, warder=false}, WeaveAffinity={},
QuickSlots={"","","","",""}, Titles={Owned={}, Equipped="", Expires={}}
```

**Added outside the defaults:**

- `WarderLevelMerged`: set on fresh saves (`:177`) or by the merge.
- `Class`: only on slots above 1 (`:421`).
- `TutorialCompleted`, `TutorialSkipped`, `WovenTutorialCompleted`, `TutorialRequired`, `TutorialFromBook`: FirstJourney.
- `ExtraQuickSlots[5]` (`:794`).
- `EconomyXPReceipts` (`EconomyService:376`).
- `Stilled`, `StilledRemaining`, `Silenced`, `SilencedRemaining`, `LastPlayed`: written on save (`:550-556`).
- ElementSkillService fields: `SkillPoints`, `ElementSkills`, `ElementAlignment`, `AdvancedSkills` (inferred from `ElementSkillService:160-226`).
- Warder fields `WarderSkills`, `WarderForms`, and the custom-weave library (key name not checked).

**Versioning.** There is no schema version number. Compatibility relies on:

1. Recursive `reconcileTable` against the defaults (`:185-227`). It only adds missing keys; it never removes or renames.
2. One-time migration flags (`LegacyLevelMigrated`, `WarderLevelMerged`).
3. The store-name suffix (`_V1`). The comment at `:23-32` suggests a new store name for big restructures.

FirstJourney keeps its own `VERSION = 2` with lesson re-mapping tables (`FirstJourneyService:15-21`).

**Write path.**

- `UpdateAsync(key, function() return data end)` (`:570-577`). It **ignores `oldData`**, so in practice it is a blind overwrite.
- There is **no session lock** and no `MemoryStore`/`ProfileService`.
- The only guard against overwriting a save with defaults is the kick on load error (`:398-413`).

**When the main profile is saved:**

1. `Unload` (Back to Menu or leaving).
2. `BindToClose`.
3. `DataService.SavePlayer` from `EconomyService.deliverXP` (`EconomyService:385`).

**There is no periodic autosave**, despite the header comment at `DataService:2`.

**Live values that override the profile on save:**

- `leaderstats.Level/Kills` → `Level/Kills`, kept in sync through `.Changed` too (`:289-310`).
- Attributes `XP` and `Deaths` (`:344-372`).
- While `Disguised`, the pre-disguise values are restored before saving (`:533-548`).
- `TutorialTransferFrozen` skips the save (`:490`).

### 5.3 Session hooks (`DataService.OnSession`)

Registered by:

- ServerMain: Leave.
- PlayerSettingsServer: Load, Save, Unload.
- EconomyServer: Load=`init`, Save=`Drain`+`FlushReputation`, Unload=`E.Remove`.
- WovenOnboarding: disabled.
- QuickSlotService: Load.
- AbilityOwnershipService: Load.
- WarderSkillService: Load.
- TitlesService: Load.
- GuardianBondService: Load, Save, Unload.

`OnSession` replays `Load` for profiles that are already loaded (`DataService:852-854`), so registering late is safe.

### 5.4 Player attributes (main ones written in this area)

- **Session and flow:** `SaveSlot`, `SaveClass`, `SessionDataReady`, `EnteredWorld`, `TutorialActive`/`TutorialRequired`/`TutorialSkipped`/`TutorialStep`/`TutorialTransferFrozen`/…, `PlayScreenActive` (read only), `LocationId`, `WaysGroupId`, `WaysEnteredAt`.
- **Combat:** `CombatState` (set only through `CombatService.SetState`), `PvPMode`, `ReadyWeave`, `WeaveReadyAt`, `WeaveReadySeed`, `WeaveCastAt`/`WeaveCastId`, `GatheredThreadCount`/`Elements`, `TiedWeave`, `TieWeaveAvailable`, `LastAttacker`, `MagicSuppressed`, `Stilled`/`StilledRemaining`, `Silenced`/`SilencedRemaining`, `BurnoutRecovery`, `TornadoCaught`, `BrokenLeg`, `IsSprinting`/`SprintHeld`, `Stamina`/`MaxStamina`, `Mana`/`MaxMana`/`EffectiveMaxMana`, `HeldWardActive`/`HeldWardHealth`, and the Circle family (`CircleLinked`, `CircleSize`, `CircleMana`, …).
- **Character attributes:** `IFrames`, `Dodging`, `Blocking`, `PerfectWindow`, `Stunned`, `Action`, `IsRagdolled`, `MoveState`, `MoveStatePriority`.
- **Progression and economy:** `XP`, `Deaths`, `XPToNextLevel`, `XPMultiplier`, `SkillPoints`, `<Element>Tier`, `ElementAlignment`, `LearnedWeave_<id>`, `HasAbility_<id>`, `Marks`, `MarksReady`, `FactionId`, `XPBoostUntil`/`Multiplier`, `ExtraQuickSlots`, `BeyondThePattern`, `EquippedTitleId`/`Name`/`Color`.
- **Admin:** `AdminRole`, `EffectiveRole`, `PanelAccess`, `WarningCount`, `AdminGodMode`, `Disguised` and the `Disguise*` family.
- **Settings:** `Setting_<key>`.
- **Map:** `MapPos`.

There are about 380 distinct attribute names in total, many on NPCs (`VillageState`, `TrollocState`, `GuardState`, `ResidentId`, `LessonClaimed`, `ConversationUntil`). The scan counted `SetAttribute("Name")` literals only; dynamic names like `Setting_..` appear as prefixes.

**Workspace and instance attributes:** `DayNightStartClock`, `DayNightEpoch`, `DayNightClock` (DayNightService). Gate `Phase`, `Destination`, `StartedAt`, `ClosesAt`, `CasterUserId`, `IsExit`, `Template` (WaygateServer). `TestFirstJourney` (Studio flag). Prompt `Cooldown`, `CooldownGroup`.

### 5.5 CollectionService tags

The code uses only a few literal tags: `RawFireSource` (RawFireSourceService), `TrollocSpawnRegion` and `TrollocWater` (TrollocConfig), and `TrollocEquipmentService`'s `E.Tag` (`WovenTrolloc`). NPC and target classification is mostly done with **attributes**, through Shared `CombatTargets.IsNPC`. Full tag catalogue: [world.md §5](world.md).

### 5.6 In-memory server state of note

- DamageService `damageHistory[humanoid][attacker] = {LastHitTime, TotalDamage}`, 10 s assist window (`DamageService:17-25,50`).
- EconomyService `cache`, `queues` (retrying reward jobs, each tied to the slot open when queued: `jobSlots`), and `writeLocks` per UserId.
- `SaveSession.slots`.

## 6. Configuration

**1. Server-only config modules in `Services/`:**

- `EconomyConfig`: rewards, daily cycle, challenges, faction costs, promo `Codes` (enabled with `Enabled=true`).
- `AdminConfig`: owners, topics, command list, webhook.
- `GiftProductConfig`: gift developer products.
- `GamepassBypassConfig`: user IDs that get passes free; also counts gifted entitlements.
- `Trollocs/TrollocConfig`: all AI, combat, spawn and raid tuning, `DamageScale=2`, `Enabled`.
- `EconomyRules` and `LevelRules`: rules, plus `MAX`/`ADMIN_MAX_LEVEL`.

**2. ReplicatedStorage `Shared` configs** read by this area: `SaveSlotConfig`, `WaygateConfig`, `MapConfig`, `Keybinds`, `BookPresentationConfig`, `ElementSkillConfig`, `AdvancedSkillConfig`, `WarderSkillConfig`, `WarderTest`, `GuardianBondConfig`, `SprintConfig`, `CombatStates`, `WeaveConfig`, `WeaveInfoConfig`, `VillageTeachingConfig`, `VillageDialogueConfig`, `VillagePersonalityConfig`, `TitlesConfig`, `PlayerNametagConfig`, `SoundConfig`, `RawEarthConfig` (see [shared.md §3](shared.md)).

**3. Constants inside scripts:**

- `BASE_HEALTH=250` (`HealthManager:7`).
- `VOID_KILL_Y=-200` (`PlayEntryServer:8`).
- `MAX_LEVEL=100`, `TEST_PROGRESSION_IN_STUDIO=false`, `TEST_USER_ID=45262117` (`DataService:125-129`).
- Settings `DEFAULTS` (`PlayerSettingsServer:15`).
- Guard numbers `HEALTH, DAMAGE, …` (`GuardService:13-15`).
- Ambience sound IDs and positions (`WovenAmbience:25-34`).
- Inn exchanges (`InnResidents:28-32`).
- Pass IDs: `1998494742` Beyond the Pattern (`BeyondPatternService:6`), `1998608571` 2x XP (`ProgressionService:25`), `2005094975` Maximum Affinity, `2007614501` Extra Quick Slots (`GiftServer:41-44`). These **are repeated** in GiftServer.
- Rate limits are inline numbers in each handler.

**4. Workspace content the code expects:** `workspace.Ways` (including `GateRuntime` and `WaysStart`), `workspace["Edmond's Field"].TheInn.InnResidents`, `InnTeleportOutside`/`Inside`, `workspace.SellerNPC`, `NPCMarkers` (`Homes`, `Routes`, `GuardPosts`), `FirstJourneySpawn`, `camerapieceforloading`, `map.Structures.Smithy`, `ServerStorage.VillageNPCAssets.Templates`, `ReplicatedStorage.Assets.OpenBook`, `Assets.Trolloc.trolloc`. Many use `WaitForChild` with no timeout, so a missing one hangs the script (§10).

**Debug flags:** `workspace:GetAttribute("TestFirstJourney")` (Studio only), `TEST_PROGRESSION_IN_STUDIO`, `AdminConfig.WebhookDryRun`, the `TrollocDebug` attribute and `ServerStorage.TrollocDev` BindableFunction (Studio), and `RunService:IsStudio()` branches throughout.

## 7. Conventions observed

**Module shape.** Each module returns a table, named `Service`, `S`, `E`, `G`, `T`, `D` or after the module. Public functions live on that table. `Start()` connects events and remotes and usually has a `started` guard. Some modules start at require time (§3.1). Init/Start pairs are rare: only `RawFireRuntime` and the Trolloc AI pieces (`TrollocAI`, `TrollocDecision`, `TrollocMovement`, `TrollocSenses` have `Init`).

**Header comment.** Every script opens with `-- Name: one-line responsibility.` Larger modules add `Responsibilities:` and `Data touched:` lines (e.g. `TitlesService:1-11`). Short `-- Verb phrase.` comments sit above each function.

**Requires.**

- `script.Parent.X` inside Services.
- `game.ServerScriptService.Server.Services.X` from top-level scripts.
- **Lazy `require` inside functions** is used everywhere to break circular dependencies (e.g. `DataService` → `StillingService`, `StatusDurationService`, `QuickSlotService`, `FirstJourneyService`, `FunnelAnalyticsService`; `DamageService` → about 10 modules at call time). This is deliberate; it is the main way the code avoids require cycles.

**State authority.**

- State is published as **attributes on the Player**; some on the character (combat flags) and some on workspace.
- Clients send only *intents* over remotes.
- `CombatService.SetState` is the only intended writer of `CombatState`.
- `MovementStateService` is the only writer of WalkSpeed, Jump and AutoRotate. Many `ponytail:` comments mark code moved to it (`SprintService:178,224,316`, `HeldWardService:105,309,365`, `Warder/*`). One exception: `CombatService:256` sets `h.WalkSpeed` directly when tying a weave.

**Damage.** Every damage call goes through `DamageService.DealDamage(attackerPlayer, humanoid, amount, weaveId)`, which returns false on any refusal. Player victims go to `FinisherService.TakeDamage`; NPC victims to `VillageDamageService.DealDamage`; Earth constructs to `RawEarth.HitConstruct`. CircleIntegrationService wraps it at boot.

**Persistence.**

- Every per-save store derives its key from `SaveSession.Key(player, base, suffix[, slot])`, never from the live `SaveSlot` attribute. Slot 1 keeps the original key.
- Per-save services register with `DataService.OnSession`.
- Shared stores go through `EconomyStore` (UpdateAsync with retries, in-memory fallback in Studio).
- Receipts and idempotency keys (`Receipts`, `PurchaseId`, `rewardId:uid`, weekly claim keys) make retries safe.

**Remote handler shape.**

- `busy[p]` re-entrancy plus `rate[p]=os.clock()+t`. Snapshot and read-only actions are usually exempt.
- `type`/`typeof` checks on arguments.
- Work runs in `pcall`/`xpcall(debug.traceback)`.
- The reply is a table with `{Error=…}` or `{Ok=…, Message=…}`, or `(bool, message)`.
- Per-player tables are cleared on `PlayerRemoving`.

**Error handling and logging.** `warn("[Tag] …")` with a subsystem tag (`[Data]`, `[Economy]`, `[Admin]`, `[PlayEntry]`, `[TiedWeave]`, `[ServerBootstrap]`); `print('[Admin]', …)` for command audit; Heartbeat loops wrap each player in `pcall` (e.g. `CombatService:265`); DataStore calls retry 3 times with backoff `attempt*2` or `attempt` seconds.

**Throttled loops.** Heartbeat loops accumulate `elapsed` and run at 0.1–0.25 s (`WaygateServer:136`, `TempestReadyWeather:8`, `CombatService:262`, `StatusDurationService:32`). Background `while task.wait(n)` loops handle upkeep (economy 30 s, gifts 30 s, settings autosave 120 s).

**Self-checks.** `SaveSession.SelfCheck` and `LevelRules.SelfCheck` are assert-based modules returning `"n/n passed"`, run in Edit with `require(...)()`.

**Style drift.** Older files (DataService, DamageService, CombatService, AbilityService) are formatted with one token per line and lots of vertical whitespace, which inflates line counts. Newer files are dense one-liners. Quote style mixes `'` and `"`.

## 8. Legacy and dead code

- **`Server/WovenOnboarding`: disabled.** Its flags (`WovenTutorialCompleted`, `WovenTutorialReady`) still exist in data; FirstJourneyService replaced it (guess).
- **Two entry points.** `ServerMain` calls itself legacy and points to ServerBootstrap as the newer one (`ServerMain:1-5`, `ServerBootstrap:1-3`). Both are live; nothing has migrated yet. ServerMain also hosts the chat-reminder hook, flagged as a candidate for extraction (`ServerMain:4-5`).
- **Double starts (guarded, harmless):** `MovementStateService.Start` from both entry points; `DamageModifierService.Start` from ServerMain and CircleService.Start.
- **Unreferenced modules** (name scan across all scripts; dynamic `require` by name not checked):
  - `Services/RawWaterFormationService`: 0 references, 806 lines. It still fires `RawWaterVisual`, which has no client listener.
  - `Services/CircleExpansionService`: 0 references; a 4-line "compatibility entry".
- **Studio and dev-only modules shipped in the live tree:** `MockEconomyData` (guarded by `IsStudio`), `GuardianBondTest` (Studio bond dummy), `TrollocDevCommands` (Studio), and the `TEST_PROGRESSION_IN_STUDIO` branch in DataService. The second check of that flag in `savePlayer` (`:493`) is dead because `:489` already returns in Studio.
- **Stubs:** `MissionsServer` pushes empty state (`MissionsServer:14` "replace with real mission store"). No client listens to `MissionsChanged` or fires `MissionsReady`.
- **Warder V1 next to V2.** `WarderService` (Script) plus the `Warder/` modules (melee V1) coexist with `WarderCombatService` ("Warder Combat Test V2 prototype"). While V2 is on, `HasAbility_*` read false so V1 stands down (`WarderCombatService:4`). Which one ships is an open question.
- **Header that no longer matches the code.** DataService claims "autosave, BindToClose flush" (`DataService:2`). No autosave exists, and the BindToClose lives in ServerMain.
- **`DataService.RemovePlayer`** (`:842`) has no caller found; Unload replaced it.
- **`DataService.DeleteStoredData`** only deletes the slot-1 key `Player_<uid>` (`:634-642`). Other slots, economy, account, settings, map, bonds and gifts stay. It is probably the admin `Wipe` command (guess).
- **Backups in `ServerStorage/MCPBackups`** clutter searches (e.g. `SaveCards_20261106_Before` holds disabled `GiftServer_v2`, `PlayEntryServer_v2`, `SaveSlotService_v2`; `GiftProductConfig` shows a reference from `GiftServer_v2`). Filter them out.
- **TODO-style markers.** There are no `TODO`/`FIXME`. Known limits use `shortcut:` comments (`WarderCombatService:435,673,1280,1628`, `TrollocScent:30`). `ponytail:` comments mark design decisions about movement ownership (§7).

## 9. How to change this area

### 9.1 Add a service

1. Create a ModuleScript in `Server/Services` with the standard header (`-- MyService: one line.`).
2. Shape: `local S = {}`, `local started = false`, `function S.Start() if started then return end; started = true … end`, then `return S`.
3. Require dependencies at the top only if they cannot require you back. Otherwise require them lazily inside functions, as DataService does.
4. Start it from **ServerBootstrap** with `start("MyService", function() require(Services.MyService).Start() end)` (`ServerBootstrap:9-16`). This isolates failures. Use ServerMain only when the service must start in a fixed order relative to the core services there, e.g. after `CircleIntegrationService.Install()`.
5. If it holds per-save state, register `DataService.OnSession({Load=…, Save=…, Unload=…})` inside `Start()`. Do not use PlayerAdded for save data.
6. Clear per-player tables on `PlayerRemoving`.

### 9.2 Add a client → server remote

1. Author the instance under `ReplicatedStorage.Remotes`. If it must be created at runtime, use `RS.Remotes:FindFirstChild("X") or Instance.new("RemoteEvent")` and set `Name` and `Parent` (`VoluntaryReset:5-6`).
2. Connect it inside your service's `Start()`.
3. In the handler:
   1. Type-check every argument. For `Vector3`, also check NaN (`v == v`) and range from the character root.
   2. Add `busy[p]` and `rate[p]` throttling.
   3. Re-check server state (alive, `CombatState`, `SessionDataReady`, Stilled, MagicSuppressed, ownership via `AbilityOwnershipService.Has`).
   4. Wrap the work in `xpcall(…, debug.traceback)`.
   5. Return `{Error=…}` or `(false, msg)` on refusal.
4. Never accept a target or a value from the client that the server can compute itself. Follow the permit/offer pattern (`SpiritTechniqueService:152-153`, `VillageTeachers:168-169`, `WaygateServer:90-92`): the server issues a short-lived token on a server-observed event (ProximityPrompt, ready state), and the remote only redeems it.
5. Clean up the throttle tables on `PlayerRemoving`.
6. Add the remote to [shared.md §2](shared.md).

### 9.3 Add a saved field to the main profile

1. Add it with a default to `DEFAULT_DATA` (`DataService:52-121`). Reconcile adds it to old saves on their next load; nested tables reconcile recursively.
2. If old saves need a *computed* value (not the default), add a one-time migration flag. Set the flag on fresh saves in `createDefaultData` (like `WarderLevelMerged`, `:177`) and run the migration in `LoadPlayer` before `reconcileData` (`:430-440`).
3. Read and write through `DataService.GetData(player)`. It returns nil when no save is open, which is also how Unload blocks late writes. Always handle nil.
4. If the field mirrors a live attribute, copy it into `data` in `savePlayer` (`:529-556`) and publish it in `createAttributes` or the owning service's `OnSession.Load`.
5. Remember it is saved only on Unload and shutdown (§10).
6. Persistence can only be verified in a published place; Studio never writes `PlayerData_V1`.

### 9.4 Add a separate per-save store

1. Build the key from `SaveSession.Key(player, base, suffix)`, as `PlayerSettingsServer:10-12` does. A nil key means do not write.
2. Load in `OnSession.Load(player, slot)`. After any yield, drop the result if `DataService.SessionSlot(player) ~= slot` (`PlayerSettingsServer:92`).
3. Save in `OnSession.Save`; it runs while the key is still open. Clear state in `Unload`.
4. Use `EconomyStore.Update` for UpdateAsync with retries and an in-memory store in Studio, or follow PlayerSettings' 3-retry `SetAsync` pattern.
5. Add the store to §5.1 with a `_v1` suffix.

### 9.5 Add an economy reward or action

1. Server-earned reward: call `EconomyService.Record(p, event, receipt, …)` or `GrantOnce(p, receipt, reward)` with a **stable receipt ID**. Mutations run inside `E.Update(p, function(d) … return true end)`; return `false` to abort without writing.
2. New request action: add a branch in `EconomyServer:75-89`. Mutating actions get the `busy`/`rate` limit automatically.
3. Tunables go in `EconomyConfig`; pure logic in `EconomyRules`.

### 9.6 Add a promo code

Add `["CODE"] = {Enabled=true, Marks=…, XP=…, SkillPoints=…, Boosts=…, ExpiresAt=unix}` in `EconomyConfig.Codes`. Codes are upper-cased and redeemed once per save (`EconomyService:205-223`).

### 9.7 Add an admin command

1. Add the name to `AdminConfig.Commands`. If moderators may use it, also add it to `ModeratorCommands`.
2. If owner-only, list it in `LevelRules.OwnerOnly` or in the owner branch of `AdminService.CanUse` (`AdminService:90-96`).
3. Implement it in `S.Execute` (`AdminService:327+`). Add read-only commands to `READ_ONLY` (`:884`).
4. Check that `webhookSkip` and `webhookDetail` do the right thing for its arguments.
5. Add autocomplete hints in `Shared/AdminAutocompleteConfig`.

### 9.8 Add a damage source

Call `DamageService.DealDamage(attackerPlayer, targetHumanoid, amount, "WeaveId")`. Never call `Humanoid:TakeDamage` directly: kill and assist credit, bounties, Marks, XP, wards, blocks, i-frames and Guardian Instinct all depend on it.

### 9.9 Change movement speed

Use `MovementStateService` states with a priority (e.g. `MoveState.Lock(c, 'Name', {priority=…, walkSpeed=…})`, as at `HeldWardService:224`). Never write `Humanoid.WalkSpeed` directly.

### 9.10 Tune NPCs

- Trolloc numbers: `Trollocs/TrollocConfig`.
- Guard numbers: constants at `GuardService:13-15`.
- Village NPC placement: `NPCMarkers` parts in Workspace.
- To exercise raids, the admin commands `RaidSmall/Standard/Major` force night and start the director (`AdminService:330-341`).

## 10. Risks and gotchas

**Security**

1. **A secret is stored in a server module.** `AdminConfig:18` holds a full Discord webhook URL with its token, plus a third-party relay URL (`:19`). ServerScriptService is not sent to clients, but the token is visible to anyone with edit access or a copy of the place. Rotate the webhook and move it to a Secret (`HttpService:GetSecret`). Admin command logs also go to a third-party relay, `discord-webhook.com`. The token is deliberately not reproduced in these docs.
2. **Owner and bypass user IDs are hard-coded** in `AdminConfig.Owners` and `GamepassBypassConfig.Users`. Changes need a publish and fresh servers.
3. **Unthrottled remotes** that cause server work or replies: `MapDiscovery "Request"` (one FireClient per area), `MissionsReady`, `TitlesReady`, `TitlesRequest`, `EconomyRequest "Snapshot"`, `CombatStateRequest`, `PlayerSettings "ResetBinds"`, `GuardianBond`, `ChannelRequest`, `ElementCaught`. Each is cheap, but a flood costs bandwidth and CPU.
4. **`ElementCaught` `spawnPosition`** goes to nearby clients after only a `typeof` check (`ChannelService:326-336`). It is cosmetic, but a NaN or huge vector reaches other clients. Add a NaN and distance clamp.
5. **`aimPosition` on `CastRequest` / `QuickSlotUse`** is not validated centrally; each ability must validate it ([abilities.md](abilities.md) §11).
6. **The client controls Perfect-stroke timing** in Warder V2 (`WarderCombatService:1628`, a known shortcut).
7. **`TrollocDevCommands`** uses a BindableFunction in ServerStorage (server only). Safe as long as it stays Studio-only, as its header says.

**Data loss and integrity**

8. **No autosave of the main profile.** `PlayerData_V1` is written only on Unload, shutdown, and incidentally by economy XP delivery. A server crash or a shutdown past the BindToClose budget loses the **whole session's** level, XP, kills, learned weaves and quick slots. Settings and map autosave every 120 s; economy writes on every transaction.
9. **No session locking.** `UpdateAsync` returns `data` unconditionally (`DataService:570-577`). On a fast rejoin to another server, the new server can load before the old server's leave-save lands; the old save then overwrites the newer one, or the reverse. Back-to-Menu followed by picking the same slot is safe inside one server (`Unloading` blocks it and `PeekSlots` reads uncached), but not across servers.
10. **Shutdown saves run one after another.** ServerMain's BindToClose calls `SavePlayer` for each player in turn (`ServerMain:98-103`), and `PlayerRemoving → Unload(player, true)` may also run for the same players. With many players, slow DataStore calls can exceed the 30 s budget.
11. **Leaving after a failed save.** When `leaving=true` and `savePlayer` fails, Unload still continues (`DataService:879`); that progress is lost after one try (no retry in savePlayer).
12. **Stuck on the menu.** A failed load kicks the player (`DataService:410`), which is safe. But if `BeyondPattern.ResolveMaxLevel` returns nil, the code returns silently (`:454-455`): no profile, no session, `SessionDataReady` never set (guess whether it can return nil, e.g. on a MarketplaceService error).
13. **Map discovery is account-wide, not per save** (`MapDiscoveryServer:54,64`, key `u<uid>`). Every other per-save store uses `SaveSession`. May be intentional; undocumented.
14. **The data-wipe helper is incomplete.** `DeleteStoredData` only removes slot 1 of `PlayerData_V1` (§8). A data-deletion request needs every key in §5.1.
15. **Studio vs live.** DataService never saves in Studio; EconomyStore and others are in-memory there; PlayerSettings and MapDiscovery write the real stores from Studio. Studio persistence tests prove nothing for `PlayerData_V1`.
16. **`EconomyService.E.Update` lock** spins with `task.wait(.03)` while waiting for `writeLocks[uid]` (`EconomyService:104`). A hanging DataStore call blocks every economy write for that user.

**Ordering**

17. **The two entry points have no defined order.** ServerBootstrap services can require core modules before `CircleIntegrationService.Install()` runs in ServerMain. Today callers look up `DamageService.DealDamage` and `ChannelService.AddElement` on the table at call time, so the wrappers still apply. Any module that caches `local Deal = DamageService.DealDamage` at require time would skip the Circle wrapper (none found in the excerpts read).
18. **CastRequest double handling** relies on the Circle handler moving the leader out of WeaveReady, so AbilityService's listener ignores the same event (`CircleIntegrationService:984-987`). Reordering connections or adding yields there breaks this.
19. **Require-time starts** (ElementSkillService, SpiritTechniqueService, ShieldingContestService, FirstJourneyService). Requiring them from a new place changes *when* their remotes connect, and remotes they create may be missing when a client first calls `WaitForChild`.
20. **`WaitForChild` with no timeout** on world objects (`InnTeleport:4-8`, `InnResidents:4`, `WaygateServer:6-8`, `MarksShopServer:40`, `VillageTeachers:204`, `HealthManager:54` leaderstats). If the map changes, the script hangs forever with no error. MarksShopServer would then never start FactionWarService and ChannelerNPCService (`:53,55` run after the `WaitForChild` at `:40`).
21. **`CombatService.InitPlayer` and `BurnoutService.InitPlayer` run only after the first save loads** (`ServerMain:67-71`). Until then `CombatState` is nil.
22. **One ProcessReceipt.** `GiftServer` owns `MarketplaceService.ProcessReceipt` and routes the save-slot product (`GiftServer:72-75`). Assigning `ProcessReceipt` anywhere else silently breaks gifts or slots.

**Performance**

23. **Heartbeat loops over all players:** WaygateServer (every gate, each 0.1 s), the PlayEntry void check (every frame, not throttled: `PlayEntryServer:106`), TempestReadyWeather, CombatService tie loop, StatusDuration, SprintService, CircleAbilityRuntime, HeldWard PreSimulation, ElementalReactionService.
24. `HideDefaultHealth` and `ElementalReactionService` hook `workspace.DescendantAdded` for the whole workspace. `ListeningWardVoiceService` hooks `game.DescendantAdded`.
25. `ScreenShakeService` is O(n) per shake (noted in the code).

## 11. Open questions

1. **Which entry point is the target?** Should `ServerMain` be folded into `ServerBootstrap`? If so, how is the `Install()`-before-remotes ordering kept?
2. **Is the missing autosave intentional** (DataStore budget trade-off)? Is session locking planned (MemoryStore lease, or `UpdateAsync` comparing a session ID)?
3. **Should map discovery be per save?**
4. **Which Guardian melee ships**, `WarderService` V1 or `WarderCombatService` V2? Can one be deleted? Why do AdminService and WarderCombatService start `WarderSkillService`, a gameplay purchase path?
5. **Can `RawWaterFormationService` (806 lines) and `CircleExpansionService` be deleted?** Dynamic `require` by name was not checked (e.g. `AbilityService.loadGenericAbilityModules`).
6. **What does the `Wipe` admin command do** beyond `DeleteStoredData` (slot 1 only)?
7. **Validation not read:** FactionService payloads (`Create`, `Manage`, `PaidEdit`), MarksShopService (`Title`, `Bounty`), `HeldWardService.Aim`, `TitlesService.Equip`, GuardianBondService respond/mask/release, `Warder/*` handlers.
8. **Can `BeyondPatternService.ResolveMaxLevel` return nil** on a MarketplaceService error (§10.12)?
9. **Is `MissionsServer` meant to get a real store**, and in which DataStore?
10. **Webhook relay:** is sending moderation logs through a third-party relay approved, and who owns that service?
