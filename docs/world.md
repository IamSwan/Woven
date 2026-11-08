# World, content and place settings

The non-code side of "[WARDERS] Woven" (PlaceId 103140548975456, GameId 10652880207, group-owned): the Workspace map, loose objects at the Workspace root, Lighting, terrain, sound and place settings, CollectionService tags, ServerStorage contents and the character setup. Read live from Studio in Edit mode, read-only, on 2026-11-08.

The place has 583 live script containers, excluding the backup folders and CoreGui ("live" means "not inside a backup folder", not that every one runs). Citations use `Service/Path/Script:line`; guesses are marked.

Related docs: [workflow.md](workflow.md) (how to edit, back up and clean up the place), [server.md](server.md), [client.md](client.md).

## 1. Scope

- Workspace regions, named anchors and runtime folders, with the scripts that depend on them.
- Workspace root clutter: what is live and what is stray.
- Lighting, terrain, sound, Players, StarterPlayer and other place settings.
- CollectionService tags.
- ServerStorage: live assets, parked features and backups.
- Character setup.

## 2. World map

The world is one large place with three playable regions far apart:

- **Edmond's Field**: the starting village, around the origin.
- **The Inn interior**: about 2,650 studs north.
- **Aiel Waste**: around X ≈ −7,000.

The Ways (an interior with waygates) link Edmond's Field and Aiel Waste. A separate menu vista sits at about (1,440, 350–550, −550). An effect-authoring area sits deep underground at about (0, −640, −4,100).

### Edmond's Field (`Workspace["Edmond's Field"]`, Folder, 28,525 descendants)

- **NPCMarkers** (Homes, Routes, GuardPosts): villager homes, walking routes and guard posts. Read by `ServerScriptService/Server/Services/VillageNPCService:475`, `…/ChannelerNPCService:438,446,488` and `…/GuardService:4,344`.
- **Nature** (5,723 descendants, about 428 tree/foliage models): scenery only. Brushtool tags (`_BrushtoolBrushed` 60, `_BrushtoolPPCenter` 51) live here.
- **Interactables / VillageProps** (2,133 descendants): props players can throw with Air (Barrel, Table, Bench) and a water Bucket.
  - The props carry many `Air*` attributes, e.g. `AirManipulatable`, `AirImpactDamage`, `AirBreakEffectFolder`, `AirRespawnDelay`.
  - Read by `ServerScriptService/Server/Services/RawAirObjectService:27`.
  - Note: `FirstJourneyService:89–90, 238` looks for `workspace.Interactables` at the Workspace root and creates that folder if missing. That is a different folder from `Edmond's Field.Interactables`.
- **TheInn** (3,200 descendants, at about (13, 79, 2656)) with an **InnResidents** folder. Used by `ServerScriptService/Server/InnTeleport:4–7` (which also needs `InnTeleportOutside` and `InnTeleportInside` under the map), `…/Server/InnResidents:1,4`, `…/Server/VillageTeachers:204`, `ReplicatedStorage/Shared/CombatTargets:43–44` and `…/Server/CustomWeaving/CombatAdapter:45`.
- **About 65 unnamed `Model`s**: houses with `Roof`, `Wall`, `Brick Furnace` and `OptimizedRoofGeometry`, plus gardens and haystacks. Scenery; names not referenced.
- Code finds this folder by the exact name `"Edmond's Field"`, apostrophe included (`InnTeleport:4`, `InnResidents:4`, `VillageTeachers:204`). Renaming it breaks the Inn.

### `Workspace.spawns` (9 SpawnLocations)

- All Neutral and Enabled, Duration 0, placed around the village (Y ≈ 3–7).
- The engine uses them for respawns.
- Code also uses them as a "settlement" no-spawn buffer for Trollocs: `ServerScriptService/Server/Services/Trollocs/TrollocSpawnService:43–45` and `…/Trollocs/TrollocAssault:7`.

### `Workspace.WardZones` (9 Parts named `WardZone`, attribute `Wardable=true`)

- The places where doorway wards can be set.
- Logic: `ServerScriptService/Server/Services/WardService:451–470` (accepts a part with `Wardable` or a sibling named `WardZone`) and `…/AbilityService:717`.
- Visuals: `StarterPlayer/StarterPlayerScripts/WardVisualController:566`.

### `Workspace.FactionZoneEdmondsField` (Zone1–Zone6 Parts)

- Faction-war capture zones.
- Used by `ServerScriptService/Server/Services/FactionWarService:86,214` and `…/AdminService:220`.
- Excluded from boundary raycasts by `ReplicatedStorage/Shared/FactionZoneBoundary:12`. That line also checks a misspelt `"FactionZoneEdmondsFIeld"`, which suggests the folder was renamed at some point.

### `Workspace.TrollocSpawnRegions` (4 Parts: SouthernFields, WesternRoad, WesternWoods, SouthwestWilderness; `Enabled=true`)

- Each part carries the tag `TrollocSpawnRegion`.
- Found by tag in `…/Trollocs/TrollocSpawnService:105` and `…/Trollocs/TrollocAI:387` (tag name from `…/Trollocs/TrollocConfig:18`).
- Found by name in `…/Trollocs/TrollocWaterService:35–37`, which uses WesternWoods as a storm retreat.

### `Workspace.SellerNPC` (1 Part `EdmondsFieldStall`)

- The Marks shop stall anchor.
- Read by `ServerScriptService/Server/MarksShopServer:40`, `…/Services/MarksShopService:160` and `…/ChannelerNPCService:429–446`.

### `Workspace.NPC` (empty in Edit)

- Filled at runtime with villagers, guards, channelers and tutorial NPCs.
- About 45 references, e.g. `ReplicatedFirst/PlayEntryClient/MenuShowcase:448–449`, `StarterPlayer/StarterPlayerScripts/OrcTutorialVisibility:5`, `…/OrcMovementVisualController:23,61`, `…/FirstJourneyService:240`.
- Several scripts create the folder if missing.

### `Workspace.TestDummies` (empty Folder)

- No live script references it by name. The Warder test dummies are built in code (`ServerScriptService/Server/Services/WarderCombatService:1171–1173, 1405–1407`) and named `WarderTestDummy`; where they are parented was not verified.
- Verdict: an unused leftover folder.

### Runtime effect folders (all empty in Edit)

- **ActiveAbilityEffects**: about 40 references, e.g. `StarterPlayer/StarterPlayerScripts/AirBladesFormationController:4,12`, `…/Controllers/IncomingThreadController:36`. Server projectile and effect parts.
- **ActiveThreads**: `…/ThreadVisualController:52`, `…/Controllers/RawAirController:42`, `…/Controllers/AirPrisonController:40`, `ServerScriptService/Server/Abilities/RawAir:77`. Client thread actors.
- **RawEarthEffects**: `ServerScriptService/Server/Abilities/RawEarth:20–21`, `…/Controllers/RawEarthController:37,215`.
- **SoloWeaveEffects**: `ServerScriptService/Server/Services/SoloWeaveRuntime:17–18`, `…/ChannelerNPCSpells:123`, `…/CrumbleCastThreads:61`.
- `StarterPlayer/StarterPlayerScripts/MapAmbientController:15–28` skips all of these, plus runtime folders like `FireHoldVisuals` and `LocalMarksEffects`, when it distance-culls map effects.

### `Workspace.StillingVFX` (Folder with a `ToBody` attachment, `Left`/`Right` parts and about 20 emitters)

- A copy of `ReplicatedStorage.Assets.AbilityEffects.StillingVFX`. Code clones the ReplicatedStorage copy (`…/Controllers/StillingController:167,195`).
- The Workspace copy is only named in the MapAmbient exclusion list (`MapAmbientController:20`).
- Verdict: a stray authoring copy still visible in the world; probably safe to quarantine (guess).

### `Workspace["Link Repulse"]` (Folder: `Charge` Part and `VortexLayout` Model, at about (−450, −645, −4540))

- No references in code. Verdict: a stray effect-authoring workspace.

### `Workspace.AielWaste` (5,763 descendants: City, Camp, RhuideanSmall, and five loose Models)

- The second region.
- Referenced by `ReplicatedStorage/Shared/WaygateConfig:15` (only as `Location = "AielWaste"`) and `StarterPlayer/StarterPlayerScripts/Controllers/MinimapController:15`.
- No script references `RhuideanSmall`.

### `Workspace.Ways` (2,604 descendants)

Contents: `GateRuntime`; the Ways interior `Model` at (−6737, 632, 2262); `EdmondWaygate` at (645, 28, 312) and `AielWaygate`; `EdmondCamera`, `AielCamera`, `EdmondWayTP`, `AielWayTP`, `WaysStart` and `WaysEnd`.

Users: `ServerScriptService/WaygateServer:6,8,82,107–108,142`, `…/Services/WaygateSessions:77,128`, `StarterPlayer/StarterPlayerScripts/Controllers/WaygateController:11–12,100`, `ReplicatedStorage/Shared/WaygateConfig:14–15`. `GateRuntime` is also used by `ReplicatedStorage/Shared/BlackWindSwarm:35` and `…/Services/BlackWindService:40`. No script references `WaysEnd` by name.

### Entry and tutorial parts at the Workspace root (all live)

- **`FirstJourneySpawn`** (Part at (−199, 9, 564)): required by `ServerScriptService/PlayEntryServer:26–27` and `…/Services/FirstJourneyService:25–26, 235–237, 273`. The code asserts it exists.
- **`TutorialWaterSource`** (Part at (−210, 0, 580)): `FirstJourneyService:234`, through `WaitForChild` with no timeout.
- **`MenuStage`** (Part at (1429, 351, −551)): `ReplicatedFirst/PlayEntryClient:456`. The menu showcase starts at its CFrame (not in Studio unless `PreviewInStudio` is set, `PlayEntryClient:39–40`).
- **`camerapieceforloading`** (Part at (1435, 355, −551)): the menu camera position (`ReplicatedFirst/PlayEntryClient:221`) and the server ReplicationFocus target (`ServerScriptService/PlayEntryServer:38–39`).

## 3. Workspace root clutter

"Referenced by code?" was decided by searching every live script for the name in quotes or as a `.Name` access, and checking whether those lines also mention `workspace`. Many of these names also exist as templates in `ReplicatedStorage.Assets.AbilityEffects`; code clones those templates, not the Workspace copies.

Physics note: `Workspace.FallenPartsDestroyHeight` is −500, and several unanchored items below sit at Y ≈ −620 to −646. They are destroyed as soon as physics runs, so they cannot be runtime dependencies.

| Name | Class | Location | Referenced by code? | Verdict |
|---|---|---|---|---|
| FirstJourneySpawn | Part | (−199, 9, 564) | yes: `FirstJourneyService:235` | **live** |
| TutorialWaterSource | Part | (−210, 0, 580) | yes: `FirstJourneyService:234` | **live** |
| MenuStage | Part | (1429, 351, −551) | yes: `PlayEntryClient:456` | **live** |
| camerapieceforloading | Part | (1435, 355, −551) | yes: `PlayEntryClient:221`, `PlayEntryServer:38` | **live** |
| tower | Model (8,177 descendants) | about (1446, 447, −549) | no (by name) | **live scenery** (guess): the menu vista the camera looks at |
| Part ×2 (43×179×11, opaque) | Part | (1446/1453, 443, −606/−491) | no | probably menu-vista backdrop walls (guess) |
| Part (130×6×131, opaque) | Part | (1446, 552, −551) | no | probably the menu-vista roof or backdrop (guess) |
| Fullshield | Model (364 descendants) | (17, −605, −4099) | name only: `Controllers/GrandShieldController:27–28` watches any Workspace child named `Fullshield` to strip CanQuery | **stray authoring copy** (guess); the watcher also picks it up |
| shield | Model (365 descendants; contains `Aes Sedai` parts) | (0, −642, −4082) | no | **stray** |
| Aes Sedai | Part (transparent, anchored) | (0, −646, −4100) | no; template is `RS.Assets.AbilityEffects.HeldWard.AesSedai` | **stray** |
| AirBlades | Model | (0, −643, −4089) | no; code uses `RS.Assets.AbilityEffects.NewAirBlades.AirBlades` (`MenuShowcase:42`) | **stray** |
| Tornado | Part (anchored, emitters) | (0, −645, −4089) | no | **stray** |
| SPiritBinding | Part (unanchored) | (0, −645, −4089) | no | **stray** |
| Fireball | Part (unanchored; contains `Explosion`) | (0, −646, −4085) | no; code uses `RS.Assets.AbilityEffects.ImportedFireball` (`ChannelerNPCSpells:157`) | **stray** |
| Explosion | Part (unanchored) | (52, −620, −3967) | no; code uses `RS…ImportedFireball.Explosion` | **stray** |
| LightningHit | Part (unanchored) | (23, −633, −4087) | no; code uses `RS.Assets.AbilityEffects.LightningHit` (`Controllers/LightningVisualController:132`) | **stray duplicate** |
| Ward Hit Impact | Part (unanchored) | (−8, −630, −4164) | no; code uses RS (`ReplicatedStorage/Shared/WardImpactVisual:9`) | **stray duplicate** |
| Water Splash | Part (unanchored) | (−76, −646, −4156) | no; RS copy (`Shared/WaterSplashVisual:17`). `Shared/RawWaterAuthoredVisual:67` only parents a clone of the RS copy into Workspace | **stray duplicate** |
| TempestCloud | Part (unanchored) | (19, −575, −4099) | no; RS copy (`Shared/TempestHelixVisual:34–36`) | **stray duplicate** |
| 2 | Part (transparent, anchored, `VFX_Attachment`) | (29, −633, −4105) | no | **stray** |
| Link Repulse | Folder | (−450, −645, −4540) | no | **stray** |
| StillingVFX | Folder | n/a | name only, in the cull exclusion list (`MapAmbientController:20`) | **stray duplicate** |
| Candle ×12 | Model | Inn area, Y ≈ 63–68, Z ≈ 2638–2686 | no | **misfiled Inn decor**. 6 are full candles (16 descendants); 6 contain only a `Flame` (2 descendants), probably leftovers from an ungroup (guess) |
| Sword_SP | Model (3 MeshParts) | Inn area (46, 70, 2656) | no | **misfiled Inn decor** (guess) |
| Part (106×25×85, transparent, CanCollide=true, anchored) | Part | (14, 46, 2658), under the Inn floor | no | **unknown**: invisible but solid; maybe a floor filler or an old blocker |
| Model (`Big Rock3` MeshPart) | Model | (−7096, 73, −332), inside the Aiel area | no | **misfiled scenery** (belongs in AielWaste) |
| Camera, Terrain | engine | n/a | n/a | engine objects |

Summary:

- **Live:** the 4 entry and tutorial parts.
- **Live by position, not by name:** the menu vista (`tower` plus 3 Parts), as a guess.
- **Stray:** about 15 objects form an underground VFX "lab". Code actually uses their duplicates in `ReplicatedStorage.Assets.AbilityEffects`.
- **Misfiled decor:** 13 objects belong to the Inn, 1 rock to Aiel Waste.

How to clean these up safely: [workflow.md §9](workflow.md).

## 4. Lighting, terrain, sound and place settings

**Lighting**

- Ambient and OutdoorAmbient (70, 70, 70), Brightness 1, ClockTime 12.
- GeographicLatitude 6.893, GlobalShadows on, ShadowSoftness 0.21.
- EnvironmentDiffuseScale 0.294, EnvironmentSpecularScale 0.235, ExposureCompensation 0.
- FogEnd 100,000 (fog effectively off).
- `Lighting.Technology` cannot be read from Luau.
- Children: `SunRays`, `DepthOfField` and `Bloom` (all enabled), `SunsetSereneSky` (Sky), `Atmosphere` (Density 0.373, Haze 1.87, Glare 5.33).
- Scripts change the look at runtime: day/night through `DayNightService` + `DayNightConfig`, storms through `Controllers/TempestWeatherController`, the Ways mood through `Controllers/WaysAtmosphere`, fog through `MakingFogScreen`.

**Terrain**

- Extent about 2,044 × 252 × 2,044 studs around the origin, so it covers Edmond's Field. Aiel Waste and the Ways are built from parts.
- CountCells returns 64,108,054.
- Decoration (grass) on, GrassLength 0.7.
- Water: colour (12, 84, 92), Reflectance 1, Transparency 1, WaveSize 0.15, WaveSpeed 10.

**SoundService**

- AmbientReverb NoReverb, DistanceFactor 3.33, DopplerScale and RolloffScale 1.
- RespectFilteringEnabled true, DefaultListenerLocation Camera.
- No Sound instances under SoundService. Audio comes from scripts such as `AbilitySoundController`, `Controllers/CircleAudioController` and `Server/WovenAmbience`, with IDs in `ReplicatedStorage/Shared/SoundConfig`.

**Teams:** none.

**Workspace**

- StreamingEnabled true: TargetRadius 1024, MinRadius 64, IntegrityMode PauseOutsideLoadedArea, StreamOutBehavior Opportunistic.
- Gravity 196.2, FallenPartsDestroyHeight −500.
- AllowThirdPartySales false.
- Attribute `TestFirstJourney=false`: a debug flag on Workspace itself.

**Players**

- MaxPlayers and PreferredPlayers 60. RespawnTime 3.
- **CharacterAutoLoads false.** Characters are loaded by `PlayEntryServer:22` (`LoadCharacterAsync`) after the menu.

**Chat:** `TextChatService.ChatVersion` is TextChatService; `Chat.LoadDefaultChat` true.

**HttpService.HttpEnabled:** true.

**StarterGui:** ResetPlayerGuiOnSpawn true, ScreenOrientation Sensor.

**StarterPlayer**

- CameraMode Classic, zoom 5–60.
- Computer and touch movement modes UserChoice.
- WalkSpeed 10, JumpHeight 4 (CharacterUseJumpPower=false), MaxSlopeAngle 89, AutoJump on.
- **EnableMouseLockOption false.** A custom shift-lock replaces it: `StarterCharacterScripts/Shiftlock`, toggled with LeftAlt.
- LoadCharacterAppearance true, UserEmotesEnabled true, AllowCustomAnimations true, CharacterBreakJointsOnDeath false.

## 5. Tags catalogue

Every tag from `CollectionService:GetAllTags()`, with instance counts and the code that uses it:

| Tag | Instances | Where | Used by |
|---|---|---|---|
| `TrollocSpawnRegion` | 4 | Workspace.TrollocSpawnRegions | `Trollocs/TrollocSpawnService:105`, `Trollocs/TrollocAI:387` (constant `TrollocConfig:18`) |
| `WaterSource` | 1 | Edmond's Field (Bucket, also attribute `WaterSource=true`) | `Services/WaterResourceService:26,40`, `Controllers/RawWaterSourceController:17,19` |
| `WovenTrolloc` | 1 | ReplicatedStorage.Assets | `Services/TrollocEquipmentService:5,75,80,92–97` |
| `Bench` | 8 | Edmond's Field 4, AielWaste 4 | none (benches are found by the `VillagePropType` attribute) |
| `Seat` | 12 | Edmond's Field | none |
| `AuraInstance` | 128 | ReplicatedStorage.Assets | none (probably from an imported asset pack, guess) |
| `_BrushtoolBrushed` / `_BrushtoolPPCenter` | 60 / 51 | Edmond's Field.Nature | none; Brushtool 2 plugin markers |
| `Assistant:<uuid>` (20 distinct) | 1–9 each | ServerStorage hair/face packs, VillageNPCAssets, RS.Assets, 3 in Edmond's Field | none; likely Roblox Studio Assistant insert markers (guess) |
| `TagEditorTagContainer` | 0 | n/a | Tag Editor plugin leftover |
| CoreGui tags (`gui-object-defaults`, `size-full`, `data-testid=…`) | n/a | CoreGui | Studio UI; ignore |

Three tags are checked in code but have **no tagged instances** in Edit: `Vegetation` (`RawWaterSourceController:17,55`, `WaterResourceService:55`), `RawFireSource` (`Services/RawFireSourceService:39,86`) and `TrollocWater` (`TrollocConfig:18`, `TrollocWaterService:76–79`). All three paths fall back to attributes or `Fire` instances, or are populated at runtime. No live code calls `AddTag`.

## 6. ServerStorage

Scripts inside ServerStorage never run, so none of the backups execute. The real risks are that someone moves a backup somewhere it runs, and that the backups make the place file bigger.

### Live assets (referenced by code)

| Item | Contents | Referenced by |
|---|---|---|
| `VillageNPCAssets` (3,223 descendants; attrs `WardrobeStatus=Complete`, `WardrobeCount=12`) | Templates, Hairs, Outfits, GuardOutfit, Bodies, Faces, Accessories | `Services/VillageNPCService:335,474`, `Services/FirstJourneyService:242`, `Services/ChannelerNPCService:407,426` (needs `Hairs.Hair_02` and `Templates.Resident_02` by name), `Services/GuardService:273`, `Services/NPCOutfitService:3` |
| `ChannelerNPCAssets` | Shirt, Pants | `ChannelerNPCService:398` |
| `TutorialLog` (Part 3×0.65×0.65) | log template | `FirstJourneyService:91` (fallback) |
| Runtime-created: `FirstJourneyTestAdvance` (BindableEvent), `TrollocDev` (BindableFunction) | Studio QA hooks | `FirstJourneyService:487–489`, `Trollocs/TrollocDevCommands:2–4,116–122` |

### Unreferenced assets (dev tools, parked features, source packs)

| Item | What it is | Notes |
|---|---|---|
| `WarderFormClipBuilder` (ModuleScript, 223 lines) | Command-bar dev tool. Builds preview KeyframeSequences from `Animations/WarderSwordForms/forms.json` and mentions `build_forms.py` | Those files are not in the Woven folder on disk |
| `VillagerBase` (R15 Model with its own `Animate`, 972 lines) | Base rig | Not referenced (guess: source of the VillageNPCAssets templates) |
| `Medieval Villager StarterCharacter` | **R6** StarterCharacter model | Not installed and not referenced |
| `Curly Hair`, `Hair pack`, `Brown Hair`, `Brown Hair Girl`, `Brown Floof Hair`, `Action Ponytail`, `All roblox classic faces pack` (1,321 descendants) | Imported accessory and face packs | Not referenced by name; probably source material for VillageNPCAssets (guess). **`Action Ponytail` contains an enabled `Script` (`Handle.HairAttachment.PoseTexture`, 472 lines) and a ModuleScript (327 lines), not reviewed.** Treat them as unvetted third-party code |
| `MasonryUploadPilot` (MeshPart, no MeshId or TextureID) | Leftover from a mesh upload test (guess) | Not referenced |
| `DisabledFlood` (5 scripts, 2,941 lines, plus 1 RemoteEvent) | The Flood ability, removed from play. Each item has an `OriginalLocation` attribute (e.g. `ServerScriptService.Server.Abilities`) | Not referenced. A parked feature, not a backup |

### Backups (nothing live references any of them)

| Folder | Format | Size |
|---|---|---|
| `MCPBackups` | 56 sub-folders named `<Change>_<YYYYMMDD>_Before`, dated 2026-11-05 to 2026-11-07, each holding clones of the scripts (sometimes ScreenGuis) as they were before that change | 236 scripts, 118,029 lines, 571 descendants |
| `ReadabilityBackup_2026_10_25` | 521 StringValues named by flattened path (`ServerScriptService_Server_Services_WeaveService`, `Shared_InputActions`, …) | about 3.62 MB of text, 173k lines |
| `ReadabilityBackup_2026_11` | 513 StringValues, same format | about 3.51 MB, 110k lines |
| `RisingSteelBackup_1794017827` | 3 StringValues: WarderCombatService, WarderTestController, WarderSwordForms | 168 KB. Suffix is a Unix time, about 2026-11-06 UTC |
| `RisingSteelFacingBackup_1794018032` | 2 StringValues: WarderCombatService, WarderTestController | 157 KB, about 3 minutes later |
| `Brushtool2_Plugin_Storage` | Plugin data: BrushObjects, StampObjects, References, Table | 46 descendants. The Brushtool plugin needs it; keep it while the plugin is in use |

Most backed-up scripts in `MCPBackups`: WarderCombatService (20 copies), GuardianBookPages (14), WarderSkillConfig (14), GuardianBondService (11), GuardianBondController (11), ScrapbookPanel (10), WarderTestController (7), BookController (7). Only one folder (`MenuReturn_20261107_Before`) has a `Note` attribute. In total about 7 MB of source text plus 118k lines of script copies sit in the place file. Backup procedure and pruning: [workflow.md](workflow.md).

## 7. Character setup

**Rig: R15 in practice.** The game's Avatar setting (R6/R15) cannot be read from Edit-mode Luau, but everything points to R15:

- The menu avatar and the test dummies are built with `Enum.HumanoidRigType.R15` (`PlayEntryServer:44`, `WarderCombatService:1171,1405`).
- Ragdoll is "R15-only" (`Services/RagdollService:219,447`).
- `StillingController:165,193` looks for `UpperTorso` first.
- `InnTeleport:30` still has an R6 height branch.
- `WarderCombatService:435`: "shortcut: R15 targets only".

**No StarterCharacter.** `StarterPlayer.StarterCharacter` is nil. Players spawn with their own avatar (LoadCharacterAppearance true). The R6 "Medieval Villager StarterCharacter" in ServerStorage is not installed.

**StarterCharacterScripts**

- **`Animate`** (972 lines): a customised Animate with a walk/run blend at threshold 10 (line 5). Custom IDs: idle `rbxassetid://90920017167930`, walk `122439328945106`, run `103924287891227`, jump `131672978701545`, fall `103709361109080`, climb `90050677242216`, swim `114107506033488`, swimidle `115288905141929`, mood `14618196485`. Emotes and tool animations are stock Roblox IDs.
- **`Health`** (26 lines, a server Script): replaces default regeneration (2 HP every 0.25 s after 6 s without damage).
- **`Shiftlock`** (173 lines): ported from an earlier project, toggled by LeftAlt through the PvP toggle.
- **`Init`** (13 lines): disables StarterGui core GUIs, retrying until they are ready.

**Accessories.** Players keep their own accessories. NPCs get hair, faces, bodies and outfits from `ServerStorage.VillageNPCAssets`, applied by `NPCOutfitService` and `VillageNPCService:335`. The walk speed of 10 is low for Roblox, which is deliberate given the sprint system (`Controllers/SprintController`, `Services/SprintService`).

## 8. Risks and gotchas

1. **The underground VFX lab is below the kill plane.** FallenPartsDestroyHeight is −500, and unanchored parts at about −620 to −646 are destroyed at runtime. Code pointed at those Workspace copies gets nil at runtime even though the part exists in Edit.
2. **The stray `Fullshield` at the Workspace root matches the name `GrandShieldController:27–28` watches**, so it gets local CanQuery stripping. Harmless today, but it shows how name collisions at the root matter.
3. **`StillingVFX`, `LightningHit`, `Ward Hit Impact`, `Water Splash` and `TempestCloud` exist twice**, in the Workspace and in RS.Assets. Editing the Workspace copy changes nothing in game, which is an easy trap for VFX work.
4. **An invisible, solid 106×25×85 Part sits under the Inn** (Workspace root `Part` at (14, 46, 2658)). Its purpose is unknown; it may block movement, raycasts or streaming.
5. **Exact-name lookups with `WaitForChild` and no timeout** (`InnTeleport:4–7`, `FirstJourneyService:234`) hang forever if those objects are renamed or moved.
6. **There are two `Interactables` folders.** `RawAirObjectService` uses the map folder; `FirstJourneyService` creates and uses a root-level one.
7. **ServerStorage backups are about 7 MB of text plus 118k lines of scripts.** This slows saving, publishing and Studio load. A script dragged out of a backup into a running service would execute at once, with old code.
8. **`Action Ponytail` contains an enabled third-party Script nobody has reviewed.** Harmless in ServerStorage, but it would run if the accessory were given to a character.
9. **`WarderShowcaseHUD` is enabled in StarterGui.** The other Warder test HUDs are disabled; confirm this one is meant for live players.
10. **An R6 StarterCharacter sits next to an R15-only codebase.** Installing it would break Ragdoll and the Stilling and Warder code.
11. **Unused tags (`Bench`, `Seat`, `AuraInstance`, Assistant tags) and checked-but-empty tags (`Vegetation`, `RawFireSource`, `TrollocWater`)** make it hard to tell what is meant to be data.

## 9. Open questions

1. Is the menu vista (`tower` and the three large `Part`s near `MenuStage`) all intended, and is the transparent solid block under the Inn needed?
2. Can the underground VFX lab (`shield`, `Fullshield`, `AirBlades`, `Aes Sedai`, `Tornado`, `SPiritBinding`, `Fireball`, `Explosion`, `2`, `Link Repulse` and the duplicates) be moved to a quarantine folder?
3. Should the 12 root `Candle`s and `Sword_SP` move into `TheInn`, and `Big Rock3` into `AielWaste`? Are the six Flame-only candles leftovers?
4. What is the game's Avatar setting (R15 only?), and is the R6 Medieval Villager StarterCharacter still wanted?
5. Where are `forms.json` and `build_forms.py` (mentioned by `WarderFormClipBuilder`)? They are not in the Woven folder on disk.
6. Is `DisabledFlood` parked for return or abandoned?
7. Should `WarderShowcaseHUD` ship enabled?
