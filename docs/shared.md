# Shared layer, remotes and entry flow

Built from the live Edit DataModel of place 103140548975456, read-only, on 2026-11-08. Remote fire and listen sites come from a scripted scan of every `LuaSourceContainer`, cross-checked by grep, with `ServerStorage/MCPBackups` skipped. Disabled scripts are marked **(disabled)**. Line numbers drift as code changes.

Related docs: [server.md](server.md) (server validation of each remote), [abilities.md](abilities.md) (weave remotes in depth), [client.md](client.md) (who uses them on the client).

## 1. Scope

- **ReplicatedStorage:** `Remotes`, `ClientEvents`, `Design`, `Assets`, `Shared` (138 ModuleScripts plus the `Lightning` folder), and the session and scene folders `FireHoldSessions`, `RawFireSessions`, `WaygateScenes`, `FollowingLights`, `WaygateEffectTemplates` and `NewThread`.
- **ReplicatedFirst:** `FirstJourneyClient`, `PlayEntryClient` and its children, `PlayHUD`, `SaveSlotHUD`, `PlayCamera`.
- **The server side of the entry handshake:** `PlayEntryServer`, `SaveSlotService`, the join loop in `ServerMain`, the gating in `FirstJourneyService`, and `ServerBootstrap` (startup only).

**Path abbreviations**

| Short | Full |
|---|---|
| `SSS/` | `ServerScriptService/` (scripts directly under it, e.g. PlayEntryServer, PlayerSettingsServer, MapDiscoveryServer, BookPresentationServer, WaygateServer, HealthManager, ServerBootstrap) |
| `SSS/Server/` | `ServerScriptService/Server/` (ServerMain, MarksShopServer, InnTeleport, InnResidents, ActiveAbilityBridge, Services, Abilities…) |
| `SPS/` | `StarterPlayer/StarterPlayerScripts/` |
| `SPS/C/` | `StarterPlayer/StarterPlayerScripts/Controllers/` |
| `Shared/` | `ReplicatedStorage/Shared/` |
| `RF/` | `ReplicatedFirst/` |
| `Remotes/` | `ReplicatedStorage/Remotes/` |

## 2. Remote catalogue

### 2.1 How remotes exist

- **Authored in Studio.** `Remotes/` holds 92 instances at edit time: 85 RemoteEvents and 7 RemoteFunctions (AdminRequest, GiftRequest, EconomyRequest, MarksShopRequest, PlayerSettings, WarderSkillPurchase, SaveSlot). There are no UnreliableRemoteEvents.
- **Created at runtime.** 46 more are created by server scripts, which put them in `Remotes/` while the server runs. The usual pattern is `RS.Remotes:FindFirstChild(name) or Instance.new("RemoteEvent")`, sometimes through local helpers named `getRemote`, `getOrCreateRemote` or `remote(name)`. These are marked **RT** below. Clients reach them with `WaitForChild` and no timeout.
- **Two server helpers wrap most broadcasts:**
  - `Shared/VfxBroadcast.FireNearby(remote, pos, radius, ...)` fires only to players whose HumanoidRootPart is within `radius` of `pos`. Presets: SMALL 180, MEDIUM 250, LARGE 350 studs. When `pos` is not a Vector3 it falls back to `FireAllClients` (`Shared/VfxBroadcast:12-29`).
  - `VfxBroadcast.FireNearbyMembers(remote, pos, radius, members, ...)` does the same and also sends to each listed member outside the radius (`Shared/VfxBroadcast:33-59`).
  - `Shared/CombatTargets.FireClient(remote, target, ...)` fires only when `target` is a Player still in the game (`Shared/CombatTargets:58-59`).
  - In the tables, "VFX" means fired through VfxBroadcast and "CT" through CombatTargets.FireClient.
- **ServerStorage leftover.** `ServerStorage/DisabledFlood/FloodVisual` is a RemoteEvent whose only listener is a disabled script.

Columns: **Dir** is the direction (C→S, S→C, or both). **Fired by** and **Handled by** cite script:line; for long lists only the first few are given, with the total in brackets. **Payload** shows argument order from the handler signature and call sites.

### 2.2 Entry, saves and session

| Remote | Type | Dir | Fired by | Handled by | Payload |
|---|---|---|---|---|---|
| `Remotes/PlayEntry` | RemoteEvent | both | C: `RF/PlayEntryClient:414` ("Play"), `SPS/C/BookController:807` ("Menu"). S: `SSS/PlayEntryServer:81` (MenuRefused), `:104` (Menu), `:128`,`:136` (Started), `:129`,`:139` (Retry) | S: `SSS/PlayEntryServer:125`. C: `RF/PlayEntryClient:423` (Started/Retry), `:544` (Menu/MenuRefused) | C→S `(action: "Play"\|"Menu")`; S→C `(action, message?)` |
| `Remotes/SaveSlot` | RemoteFunction | C→S | `RF/PlayEntryClient:332` ("Choose", slot, class), `:360` ("List"), `:370` ("Buy") | `SSS/Server/Services/SaveSlotService:69` | `List`→`{Saves, Owned, Max, Price, LastSlot}`; each `Saves[i]` = `{Exists, Level, Class, Kills, LastPlayed?, Marks, Title?}` (`DataService.PeekSlots`; `Title` = that save's equipped title display name, nil when none); `Choose`→`true` or `false, msg`; `Buy`→bool |
| `Remotes/FirstJourney` (RT, `FirstJourneyService:37`) | RemoteEvent | both | C: `RF/FirstJourneyClient:284` Retry, `:292` Skip, `:294` Begin, `:322` Finish, `:367` Sync; `SPS/C/BookController:271` StartFromBook. S: `SSS/Server/Services/FirstJourneyService:138`,`:148` (Step), `:425`,`:428` (Notice) | S: `FirstJourneyService:416`. C: `RF/FirstJourneyClient:347` | C→S `(action)`; S→C `("Step", payload{Step,Total,Title,Text,Recipe,Kind,Kills,QuickSlot,WardRaised,Done,Focus,Welcome,Complete})` or `("Notice", text)` |
| `Remotes/ChooseElementAlignment` (RT, `ElementSkillService:179`) | RemoteFunction | C→S | `RF/FirstJourneyClient:212`, `SPS/C/BookController:449`, `SPS/C/BookController/ScrapbookPanel:287` | `SSS/Server/Services/ElementSkillService:181` | `(element)` → `ok, message` |
| `Remotes/ChangeElementAlignment` (RT, `:214`) | RemoteFunction | C→S | `SPS/C/BookController:506`, `ScrapbookPanel:316` | `ElementSkillService:216` | `(element)` → `ok, message` |
| `Remotes/ElementSkillPurchase` (RT, `:172`) | RemoteFunction | C→S | `SPS/C/BookController:422`,`:483`; `ScrapbookPanel:272`,`:310` | `ElementSkillService:175` | `(element, tier)` → `ok, message` |
| `Remotes/PlayerSettings` | RemoteFunction | C→S | `SPS/C/BookController:374`; `ScrapbookPanel:224` (`"Bind_<Action>_<PC\|Pad>"`), `:494`, `:546` ("ResetBinds"); `SPS/C/MobileLayoutController:292`,`:317`; `SPS/C/GuardianBondController:225`,`:228` | `SSS/PlayerSettingsServer:105` | `(key, value)`; mirrored to `Setting_<key>` player attributes |
| `Remotes/VoluntaryCharacterReset` (RT, `SSS/Server/VoluntaryReset:5`) | RemoteEvent | C→S | `SPS/C/VoluntaryResetController:7` | `SSS/Server/VoluntaryReset:8` | `()` |
| `Remotes/BookChatReminder` | RemoteEvent | S→C | `SSS/Server/ServerMain:141` (FireAllClients) | `SPS/RawSpiritChatController:141` | `()` |
| `Remotes/BookReading` | RemoteEvent | both | C: `SPS/C/BookController:715`,`:743`,`:760`,`:776`. S: `SSS/BookPresentationServer:33`,`:37` | S: `SSS/BookPresentationServer:64`. C: `SPS/C/BookController:829` | C→S `(wantsOpen: bool)`; S→C `(allowed: false)` |
| `Remotes/TitlesChanged` (RT, `TitlesService:621`) | RemoteEvent | S→C | `SSS/Server/Services/TitlesService:179`,`:300` | `SPS/C/BookController:830` | `(list)` |
| `Remotes/TitlesReady` (RT, `:627`) | RemoteEvent | C→S | `SPS/C/BookController:836` | `TitlesService:632` | `()` |
| `Remotes/TitlesRequest` (RT, `:637`) | RemoteFunction | C→S | `SPS/C/BookController:82`,`:539`; `ScrapbookPanel:186`,`:470` | `TitlesService:641` | `("List")`, `("Equip", id)` |
| `Remotes/MissionsChanged` (RT, `SSS/Server/MissionsServer:10`) | RemoteEvent | S→C | `MissionsServer:21` | **no client listener found** | `(state)` |
| `Remotes/MissionsReady` (RT, `:25`) | RemoteEvent | C→S | **no client fire found** | `MissionsServer:30` | `()` |
| `Remotes/MapDiscovery` | RemoteEvent | both | C: `SPS/C/MinimapController:844` ("Request"). S: `SSS/MapDiscoveryServer:45` ("Full"), `:103` ("Reveal") | S: `SSS/MapDiscoveryServer:82`. C: `SPS/C/MinimapController:740` | S→C `(action, areaId, payload)` |
| `Remotes/AdminRequest` | RemoteFunction | C→S | `SPS/AdminController:80`,`:205`,`:491` | `SSS/Server/Services/AdminService:885` | `(command, argsTable)` |
| `Remotes/AdminNotice` | RemoteEvent | S→C | `AdminService:365`,`:370` (FireAllClients), `:512`, `:873` | `SPS/AdminController:569` | `(kind: "Announcement"\|"Warning", message)` |

### 2.3 Economy, shop, gifts, factions, NPCs, world

| Remote | Type | Dir | Fired by | Handled by | Payload |
|---|---|---|---|---|---|
| `Remotes/EconomyRequest` | RemoteFunction | C→S | `SPS/C/EconomyController:162`, `SPS/C/WovenFeedbackController:487` | `SSS/Server/EconomyServer:64` | `(action, payload)` |
| `Remotes/EconomyChanged` (RT, `EconomyServer:12`) | RemoteEvent | S→C | `EconomyServer:25`, `SSS/Server/Services/EconomyService:138`, `SSS/Server/Services/FactionService:149` | `SPS/C/EconomyController:384`, `SPS/C/WovenFeedbackController:479` | `(payloadTable)` |
| `Remotes/EconomyReady` (RT, `:31`) | RemoteEvent | C→S | `SPS/C/EconomyController:391`,`:395` | `EconomyServer:37` | `()` |
| `Remotes/EconomyNotice` | RemoteEvent | S→C | `EconomyService:171` | `SPS/C/EconomyController:429` | `(text, amount)` |
| `Remotes/GiftRequest` | RemoteFunction | C→S | `SPS/C/EconomyController:173`; `SPS/C/SettingsController:110` (disabled) | `SSS/Server/GiftServer:146` | `(action, passId, targetId)` |
| `Remotes/GiftNotice` | RemoteEvent | S→C | `GiftServer:67`,`:85` | `SPS/C/EconomyController:227`; `SettingsController:183` (disabled) | `(message, paid?)` |
| `Remotes/MarksShopRequest` | RemoteFunction | C→S | `SPS/MarksShopClient:100`,`:219` | `SSS/Server/MarksShopServer:8` | `(action, payload)` |
| `Remotes/MarksShopNotice` | RemoteEvent | S→C | `SSS/Server/MarksShopServer:48`; `SSS/Server/Services/MarksShopService:15`; `FactionWarService:79`,`:126`,`:151`,`:158`,`:207`; `ChannelerNPCService:415` ("OpenShop"); `SSS/Server/Abilities/NoMoreFatigue:14`,`:15` (FireAllClients "FatigueVisual"),`:19`; `SSS/Server/Abilities/FireHold:109` [13] | `SPS/MarksShopClient:13`, `SPS/MarksWorldVisuals:90` | `(title\|action, text\|...)`; doubles as a general notice channel |
| `Remotes/FactionWarVisual` | RemoteEvent | S→C | `SSS/Server/Services/FactionWarService:42`,`:78`,`:157` ("State"), `:184`,`:185` ("Notice") | `SPS/MarksWorldVisuals:62`, `SPS/C/MinimapController:755` | `(action, data)` |
| `Remotes/InnTravel` | RemoteEvent | S→C | `SSS/Server/InnTeleport:58` | `SPS/InnTravelClient:4` | `(position)` |
| `Remotes/VillageSpeech` | RemoteEvent | S→C | `SSS/Server/InnResidents:46`; `SSS/Server/Services/VillageNPCService:33`; `GuardService:26`; `Services/Trollocs/TrollocRaidDirector:127` | `SPS/VillageNPCController:21` | `(model, text)` |
| `Remotes/VillageConversation` (RT, `SSS/Server/VillageTeachers:6`, unconditional `Instance.new`) | RemoteEvent | both | C: `SPS/C/VillageConversationController:120`,`:163`,`:170`. S: `VillageTeachers:77`,`:126`,`:128`,`:173`,`:191` | S: `VillageTeachers:153`. C: `VillageConversationController:149` | C→S `("Close"\|"Choice"\|"Learn", choiceId?)`; S→C `(npc, dialogue, teaching?, conversation?)` |
| `Remotes/WaygateEvent` | RemoteEvent | both | C: `SPS/C/WaygateController:46`,`:53`. S: `SSS/WaygateServer:29`,`:80`,`:130`; `SSS/Server/Services/BlackWindService:78`,`:118` | S: `SSS/WaygateServer:87`. C: `SPS/C/WaygateController:59` | C→S `("Cancel"\|"Choose", id)`; S→C `("Notice"\|"Choose"\|"Arrived", value)` |
| `Remotes/GuardianBond` | RemoteEvent | both | C: `SPS/C/GuardianBondController:36`,`:118`,`:173`. S: `SSS/Server/Services/GuardianBondService:35`,`:133`,`:153`,`:175`; `WarderCombatService:1462`; `GuardianBondTest:133`; `SSS/Server/Abilities/GuardianBond:30`,`:32` | S: `GuardianBondService:394`. C: `SPS/C/GuardianBondController:504`, `SPS/C/MinimapController:43` | C→S `("Respond"\|"Mask"\|"Release", arg)`; S→C `(kind, a, b, c)` |
| `Remotes/ProgressionFeedback` | RemoteEvent | S→C | `SSS/Server/Services/ProgressionService:233`,`:331`; `DamageService:116`; `VillageDamageService:32` | `SPS/XPUIController:278`,`:375` | `(action, data)` |
| `Remotes/WeaveLearned` | RemoteEvent | S→C | `SSS/Server/Services/LearnedWeaveService:174` | `SPS/C/LearnedWeaveNotificationController:25` | `(displayName)` |

### 2.4 Input, channeling, combat core

| Remote | Type | Dir | Fired by | Handled by | Payload |
|---|---|---|---|---|---|
| `Remotes/CastRequest` | RemoteEvent | C→S | `SPS/InputController:180`; `SPS/C/FireDrawingController:173`,`:182` | `SSS/Server/Services/AbilityService:1630`; `SSS/Server/Services/CircleIntegrationService:988` (**two handlers**) | `(aimPosition)` |
| `Remotes/ChannelRequest` | RemoteEvent | C→S | `SPS/ChannelController:574`,`:575`,`:582`,`:590`,`:602`; `SPS/InputController:205` | `SSS/Server/Services/ChannelService:696`; `SSS/Server/Abilities/RawEarth:630` | `("Start"\|"Confirm"\|"Stop")` |
| `Remotes/ElementCaught` | RemoteEvent | C→S | `SPS/ChannelController:334` | `ChannelService:746` | `(elementName, spawnPosition)` |
| `Remotes/ChannelInputMode` | RemoteEvent | C→S | `SPS/ChannelInputMode:5` | `SSS/Server/Services/ChannelRecoveryService:7` | `(isMobile: bool)` |
| `Remotes/CombatStateRequest` | RemoteEvent | C→S | `SPS/CameraController:23`; `SPS/ControllerCursorController:29` | `SSS/Server/Services/CombatService:133` | `("TogglePvP")`, `("SetPvP", bool)` |
| `Remotes/TiedWeaveAction` (RT, `CombatService:220`) | RemoteEvent | C→S | `SPS/KeybindListController:400`,`:403` | `CombatService:234` | `("Tie"\|"Untie")` |
| `Remotes/SprintRequest` | RemoteEvent | both | C: `SPS/InputController:437`,`:446`,`:643`,`:847`,`:881`; `SPS/AdminFlightController:94`. S: `SSS/Server/Services/SprintService:264`,`:279` | S: `SprintService:414`. C: `SPS/C/SprintController:55` | C→S `(wantSprint: bool)`; S→C `("BrokenLeg"\|"SprintRejected")` |
| `Remotes/CombatFeedback` | RemoteEvent | S→C | `AbilityService:460`,`:615`,`:908` | `SPS/CombatFeedbackController:37` | `(action, ...)` |
| `Remotes/WeaveFeedback` | RemoteEvent | S→C | `ChannelService:394`,`:418` | `SPS/WeaveFailureFeedbackController:200` | `(action, ...)` |
| `Remotes/ThreadVisual` | RemoteEvent | S→C | VFX in `ChannelService:198`,`:245`,`:335`,`:459`…; `CircleService:71`,`:98`,`:113`; `AbilityService`; `CircleIntegrationService`; `GrandShield:268`,`:622`; `GuardianBondTest:65`,`:71`,`:79` [43] | `SPS/ThreadVisualController:3431`; `SPS/C/WovenFeedbackController:256` | `(action: "Add"\|"Finalize"\|"Clear"…, character, element?, index?)` |
| `Remotes/AbilityEffects` | RemoteEvent | S→C | VFX `AbilityService:467` | `SPS/AbilitySoundController:463` | `(action, character, abilityId, value)` |
| `Remotes/ScreenShake` | RemoteEvent | S→C | CT `SSS/Server/Shared/ScreenShakeService:44`,`:82`,`:110`,`:137`; CT `SSS/Server/Abilities/Healing:596`,`:601`; CT `SSS/Server/Abilities/InsectControl:408`,`:475`,`:476` | `SPS/C/ScreenShakeController:353` | `(action: "Cast"\|"StartHeld"\|"StopHeld"\|"StopAllHeld", presetName)` |
| `Remotes/CircleReworkVisual` | RemoteEvent | S→C | `ChannelService:433`,`:437`,`:539`,`:543`; `AbilityService:1040`,`:1044`; `QuickSlotService:669`; `CircleAbilityRuntime:59`; `PlayerProtectionService:48`,`:60`; `Abilities/SpiritStun:43`; `Lightning:797`,`:810`; `Tornado:43`,`:54`; `ConvergingFlame:22`; `Tempest:65` [24] | `SPS/C/CircleReworkController:48` | `("Notice", title, text)`; the de facto general toast channel |
| `Remotes/QuickSlotAssign` | RemoteEvent | C→S | `SPS/C/BookController:361` | `SSS/Server/Services/QuickSlotService:891` | `(weaveId, slot)` |
| `Remotes/QuickSlotUse` | RemoteEvent | C→S | `SPS/C/QuickSlotController:129` | `QuickSlotService:892` | `(slot, aimPosition, ...)` |
| `Remotes/QuickSlotSwitch` | RemoteEvent | C→S | `SPS/C/QuickSlotController:289`,`:315` | `QuickSlotService:835` | `()` or `("Shortcut")` |
| `Remotes/QuickSlotCooldown` | RemoteEvent | S→C | `QuickSlotService:439`,`:457`,`:781`,`:903` | `SPS/C/QuickSlotController:191` | `(abilityId, seconds)` |
| `Remotes/QuickSlotAnimation` (RT, `QuickSlotService:41`) | RemoteEvent | S→C | `QuickSlotService:554`,`:626` | `SPS/ChannelAnimationController:636` | `(abilityId)` |

### 2.5 Weave and ability remotes

Kept short here; validation details are in [abilities.md §5](abilities.md).

| Remote | Type | Dir | Fired by | Handled by | Payload |
|---|---|---|---|---|---|
| `AirBladesAction` (RT) | RE | C→S | `SPS/C/AirBladesController:68`,`:88` | `SSS/Server/Abilities/AirBlades:1136` | `(aim, clicked, "All"?)` |
| `AirPushVisual` | RE | S→C | VFX `AbilityService:631` | `SPS/C/AirPushVisualController:16`, `SPS/AirPushWeaveShapeController:78`; `SPS/AirPushCastThreadController:51` (disabled) | `(start, end, dir, impacts)` |
| `AirSlashThreadRelease` | RE | S→C | VFX `Abilities/AirSlash:23` | only `SPS/AirSlashWeaveTrailController:24` (disabled) | `(char, blade)` |
| `AirPrisonAction` (RT) | RE | C→S | `SPS/C/AirPrisonController:649` | `Abilities/CircleAbilities/AirPrison:505` | `("Release")` |
| `AirPrisonVisual` (RT) | RE | S→C | VFX `AirPrison:315`,`:472` | `SPS/C/AirPrisonController:425` | `(action, leader, target)` |
| `BindingThreadsAction` (RT) | RE | C→S | `SPS/C/BindingThreadsController:11` | `CircleAbilities/BindingThreads:200` | `("Release")` |
| `BoneBreakVisual` | RE | S→C | VFX `Abilities/BoneBreak:104`,`:147`,`:167`; `ChannelerNPCSpells:233` | `SPS/C/BoneBreakVisualController:28` | `(event, token, caster, target, at)` |
| `BurnoutDeathVisual` | RE | S→C | VFX `ManaService:739`, `Trollocs/TrollocDeathService:26` | `SPS/C/BurnoutDeathVisualController:342` | `(player, character)` |
| `CircleAction` (RT, `CircleService:34`) | RE | C→S | `SPS/C/CircleController:75` (invite toast Accept/Decline),`:133`,`:337` (pad A/B); `WovenFeedbackController:249` | `CircleService:654` | `("AcceptInvite"\|"DeclineInvite"\|"LeaveCircle"\|…)` |
| `CircleState` (RT, CircleService) | RE | S→C | `CircleService:435`,`:452`,`:482`,`:485`,`:513`,`:530`,`:636` | `SPS/C/CircleController:257` | `(action, ...)` |
| `CircleVisual` (RT) | RE | S→C | VFX-members `CircleService:205`,`:386`,`:432`… [9] | `SPS/C/CircleVisualController:75` | `(event, leader, members, element, index)` |
| `CircleEnvironment` (RT) | RE | S→C | VFX-members `CircleService:389`,`:434`,`:519`,`:575`,`:627` | `SPS/C/CircleScreenController:66`, `CircleEnvironmentController:127` | `(event, leader, pos, power, size, element)` |
| `CircleAnimation` (RT) | RE | S→C | VFX-members `CircleService:204`,`:487`,`:515`,`:604` | **no listener found** | n/a |
| `CircleAbilityVisual` (RT, CircleAbilityRuntime) | RE | S→C | VFX `CircleAbilityRuntime:109`; CT `:381` | `SPS/C/CircleAbilityController:236`, `CircleVictimController:42`, `CircleReworkController:76` | `(event, data)` |
| `CircleAbilityAction` (RT, CircleAbilityRuntime) | RE | C→S | `SPS/C/CircleAbilityController:292`,`:296` | `CircleAbilityRuntime:376` | `("Release"\|"Sync")` |
| `CircleVictimFeedback` (RT) | RE | S→C | `CircleFeedbackService:13` | `SPS/C/CircleVictimController:35` | `(id, strength 0..1)` |
| `CompulsionVisual` | RE | S→C | VFX `CompulsionService:75`,`:148`,`:197`,`:201` | `SPS/C/CompulsionController:20` | `(action, caster, target, at, duration)` |
| `CrumbleVisual` | RE | S→C | VFX `Abilities/Crumble:49`,`:56`,`:101`,`:189` | `SPS/CrumbleCastThreads:98` | `(action, ...)` |
| `DrowningVisual` | RE | S→C | VFX `Abilities/Drowning:206`,`:224`,`:236`,`:385` | `SPS/C/DrowningVisualController:19`, `DrowningFeedbackController:152` | `(action, v1, v2)` |
| `DrowningCastApproved` | RE | S→C | CT `Abilities/Drowning:504` | `SPS/C/DrowningAnimationController:95` | `()` |
| `DrowningRelease` | RE | C→S | `SPS/C/DrowningAnimationController:90` | `Abilities/Drowning:537` | `()` |
| `FireballAction` (RT) | RE | C→S | `SPS/C/FireballController:56` | `Abilities/Fireball:1162` | `(aim, clicked)` |
| `FireballBarrageAction` | RE | C→S | `SPS/C/FireballBarrageController:56` | `Abilities/FireballBarrage:825` | `(aim, clicked)` |
| `FireballVisual` (RT, created by two scripts) | RE | S→C | VFX `Fireball:524`,`:711`,`:716`,`:987`; FireballBarrage | `SPS/C/FireballVisualController:14`, `SPS/FireballWeaveShapeController:48` | `(action, arg1, arg2)` |
| `FireballAnimation` (RT) | RE | S→C | **never fired** | `SPS/C/FireballAnimationController:109` | n/a |
| `FireballFeedback` (RT) | RE | S→C | `Fireball:490`,`:714`; `FireballBarrage:488`,`:538` | `SPS/C/FireballFeedbackController:166` | `(action)` |
| `FireballImpactVisual` | RE | S→C | VFX `Services/ImportedFireballService:65` | `SPS/C/FireballImpactController:52` | `(pos, normal, player)` |
| `FireDrawingAction` (RT) | RE | both | C: `SPS/C/FireDrawingController` [13]. S: `Services/RawFireRuntime:14` | S: `Abilities/FireDrawing:1021`. C: `FireDrawingController:222` | C→S `(cmd, pos)`; S→C `("Notice", text)` |
| `FireHoldAction` | RE | C→S | `SPS/InputController:524`; `SPS/C/FireHoldController:50` | `Abilities/FireHold:223` | `(action)` |
| `FoldedLightAction` | RE | C→S | `SPS/InputController:259`,`:462` | `Abilities/FoldedLight:396` | `("Stop")` |
| `GrandShieldAction` (RT) | RE | C→S | `SPS/C/GrandShieldController:89` | `CircleAbilities/GrandShield:727` | `("Release")` |
| `GrandShieldVisual` (RT) | RE | S→C | `GrandShield:239`,`:266`,`:288`,`:638` (FireAllClients) | `SPS/C/CircleScreenController:86`, `GrandShieldController:64` | `(action, leader, ...)` |
| `HealingAction` | RE | C→S | `SPS/InputController:526`; `SPS/C/HealingController:50` | `Abilities/Healing:1127` | `(...)` / `("Stop")` |
| `HealingVisual` | RE | S→C | VFX `Healing:571`,`:964`; `ChannelerNPCSpells:254`,`:259`; `MassHealing:16` [7] | `SPS/C/HealingVisualController:18` | `(action, session, caster, target)` |
| `HealingFeedback` | RE | S→C | `Healing:1180`; CT `Healing:279` | `SPS/C/HealingFeedbackController:202` | `(action, message)` |
| `HeldWardAim` | RE | C→S | `SPS/HeldWardController:70` (throttled 0.05 s) | `Services/HeldWardService:281` | `(aimPos)` |
| `HeldWardStop` | RE | C→S | `SPS/HeldWardController:23`,`:28` | `HeldWardService:282` | `()` |
| `IgniteCastApproved` | RE | S→C | CT `Abilities/Ignite:347` | `SPS/ChannelAnimationController:665` | `()` |
| `IgniteVisual` | RE | S→C | VFX `Ignite:186`,`:224`,`:264`; `ElementalReactionService:72` [6] | `SPS/C/IgniteVisualController:20` | `(action, v1, v2)` |
| `IncomingThreadVisual` | RE | S→C | none (sends removed 2026-11-09; kept for re-enabling) | only `SPS/C/IncomingThreadController:1110` (disabled) | `(action, caster, abilityId)` |
| `InsectControlAction` (RT) | RE | C→S | `SPS/C/InsectControlController:66` | **no server handler found** | `(aim, clicked)` |
| `InsectControlVisual` (RT) | RE | S→C | VFX `InsectControl:468` | `SPS/C/InsectControlVisualController:18` | `(action, caster, target)` |
| `InsectControlAnimation` (RT) | RE | S→C | CT `InsectControl:405`,`:472` | `SPS/C/InsectControlAnimationController:88` | `("Start"\|"Stop")` |
| `LightningAction` | RE | both | C: `SPS/C/LightningController:145`. S: CT `Abilities/Lightning:674`,`:694`,`:740` | S: `Lightning:946`. C: `LightningController:203` | `("Strike", aim)` / `("Rejected"\|"StrikeAccepted", x)` |
| `LightningVisual` | RE | S→C | VFX `Lightning:473`,`:490`,`:726`; `Tempest:200`; `ChannelerNPCSpells:227` | `SPS/LightningCastThreads:11`, `SPS/C/LightningAnimationController:173`, `LightningVisualController:385` | `(action, caster, data, index)` |
| `ListeningWardAction` | RE | C→S | `SPS/InputController:253`,`:533` | `Abilities/ListeningWard:40` | `("Stop")` |
| `PainInflictionAction` | RE | C→S | `SPS/C/PainInflictionController:410`,`:425` | `Abilities/PainInfliction:627` | `("Release")` |
| `PainInflictionVisual` | RE | S→C | VFX `PainInfliction:250`,`:587`; `:684`; CT `:241` | `SPS/C/PainInflictionController:354` | `(action, a1, a2, a3)` |
| `PainContest` | RE | both | only `SPS/C/PainContestController` (disabled) | none live | n/a |
| `PowerChannelVisual` | RE | S→C | VFX `Abilities/PowerChannel:236`,`:306`,`:352`,`:473` | `SPS/C/PowerChannelVisualController:18`, `PowerChannelAnimationController:141`, `PowerChannelSoundController:108` | `(action, character)` |
| `PowerChannelRelease` | RE | C→S | `SPS/C/PowerChannelInputController:38` | `PowerChannel:890` | `()` |
| `PowerChannelNotification` | RE | S→C | `PowerChannel:136` | `SPS/C/PowerChannelFeedbackController:52`, `PowerChannelSoundController:141` | `(payloadTable)` |
| `QuickProtectEffect` | RE | S→C | VFX `Services/QuickProtectService:52` | `SPS/C/QuickProtectController:6` | `(character)` |
| `RawAirAction` | RE | both | C: `SPS/C/RawAirController:1121`… [9]. S: `Abilities/RawAir:535`,`:574`,`:742`…; `Services/RawAirAlignmentService:148` | S: `RawAir:1666`. C: `RawAirController:1256`, `RawAirAlignmentVisual:64` | `(cmd, table)` / `(action, value, extra)` |
| `RawAirAnimation` | RE | S→C | `RawAir:572`,`:610`,`:696`,`:1035`,`:1462` | `SPS/C/RawAirController:1386` | `(animId)` |
| `RawEarthAction` (RT) | RE | both | C: `SPS/C/RawEarthController:121`…`:154`; `SPS/ChannelController:577`. S: `Abilities/RawEarth:30`,`:392` | S: `RawEarth:629`. C: `RawEarthController:194` | `(cmd, target/point)` / `("Notice"\|"Bound", text)` |
| `RawEarthVisual` (RT) | RE | S→C | VFX `RawEarth:227`,`:290`,`:291`,`:500` | `SPS/C/RawEarthVisualController:410` | `(kind, pos, value)` |
| `RawSpiritAction` | RE | both | C: `SPS/C/RawSpiritController:1012`,`:1051`,`:1053`. S: `Abilities/RawSpirit:492`,`:548`,`:577`,`:581`,`:1077`,`:1104` | S: `RawSpirit:1130`. C: `RawSpiritController:1344` | `(action, value)` |
| `RawSpiritVisual` | RE | S→C | `RawSpirit:623`,`:640`,`:662`,`:839`,`:883`,`:989`,`:1038`; `SpiritStun:28` | `SPS/C/RawSpiritController:1369` | `(action, value, extra)` |
| `RawWaterAction` | RE | both | C: `SPS/C/RawWaterController:26`. S: `Abilities/RawWater:24` | S: `RawWater:485`. C: `RawWaterController:149` | `(name, table)` / `("Notice", msg)` |
| `RawWaterVisual` | RE | S→C | VFX `Services/RawWaterFormationService:565`,`:720` | **no listener found** | n/a |
| `RawWaterSplash` (RT) | RE | S→C | VFX `RawWater:87` | `SPS/C/RawWaterVisualController:5` | `(pos, normal)` |
| `RockThrowAction` | RE | C→S | `SPS/C/RockThrowController:56` | `Abilities/RockThrow:1229` | `(aim, clicked)` |
| `RockThrowVisual` | RE | S→C | VFX `RockThrow:318`,`:571`,`:839`,`:885`… [10] | `SPS/C/RockThrowVisualController:18` | `(action, rock, index)` |
| `RockThrowFeedback` | RE | S→C | `RockThrow:367`,`:555`,`:822`,`:883`,`:1044`; `RockBarrage:466`,`:554`,`:643`,`:752`,`:923` | `SPS/C/RockThrowFeedbackController:37`, `RockThrowAnimationController:78`, `RockThrowSoundController:70` | `(action, rockIndex)` |
| `RockBarrageAction` (RT) | RE | C→S | `SPS/C/RockBarrageController:60` | `RockBarrage:1112` | `(aim, clicked)` |
| `RockBarrageAnimation` (RT) | RE | S→C | `RockBarrage:556`,`:754` | `SPS/C/RockBarrageAnimationController:183` | `("Interrupted"\|"Throw")` |
| `ShieldingContest` | RE | both | C: `SPS/C/ShieldingContestController:46` (≤120 Hz). S: `Services/ShieldingContestService:22`,`:24`,`:34`,`:36`,`:50` | S: `ShieldingContestService:41`. C: `ShieldingContestController:28`,`:66` | C→S `(token)`; S→C `(action, token, a, b)` |
| `SilenceVisual` | RE | S→C | VFX `Abilities/Silence:26`,`:58` | `SPS/C/SilenceVisualController:38` | `(event, token, caster, target, at)` |
| `SoloWeaveFeedback` (RT, `SoloWeaveRuntime:19`) | RE | S→C | `R.Remote:FireClient` in `Abilities/AirSlash:64`, `Abilities/Tornado:133` | `SPS/C/SoloWeaveController:190` | `(event, position?)` |
| `SpiritStunVisual` / `SpiritStunFeedback` / `SpiritStunSound` / `SpiritStunAnimation` | RE ×4 | S→C | **never fired** | `SPS/C/SpiritStunVisualController:316`, `SpiritStunFeedbackController:123`, `SpiritStunSoundController:59`, `SpiritStunAnimationController:60` | n/a |
| `SpiritTechnique` (RT) | RE | both | C: `SPS/C/SpiritTechniqueController:100`…`:194` [13]. S: `Services/SpiritTechniqueService:59`…`:223`; `CompulsionService:79`,`:149`,`:187`,`:239`; CT `SpiritTechniqueService:56` | S: `SpiritTechniqueService:143`. C: `SpiritTechniqueController:107` | `(action, value, extra)` |
| `StillingContest` (RT) | RE | both | C: `SPS/C/StillingController:66`. S: `CircleAbilities/Stilling:86`,`:87`,`:139`,`:220`,`:221`,`:294`,`:295` | S: `Stilling:282`. C: `StillingController:48` | as ShieldingContest |
| `StillingVisual` (RT) | RE | S→C | VFX `Stilling:90`,`:217`,`:259`,`:265` | `SPS/C/StillingController:131` | `(action, caster, target, restore, contested, started)` |
| `WardVisual` | RE | S→C | `Services/WardService:640`,`:783`,`:870`,`:901`,`:925` (FireAllClients) | `SPS/WardVisualController:1064` | `(action, v1..v4)` |
| `WardHitImpact` | RE | S→C | VFX `HeldWardService:54` | `SPS/HeldWardController:75` | `(pos, normal)` |
| `WarderRequest` (RT, `WarderService:20`) | RE | C→S | `SPS/WarderClient:135`,`:239`,`:243`,`:248`,`:261` | `Services/WarderService:71` | `(action, directionKey)` |
| `WarderTestRequest` | RE | both | C: `SPS/C/WarderTestController` [26], `SPS/C/BookController:325`. S: `Services/WarderCombatService:124`…`:1728` [~20] | S: `WarderCombatService:1543`. C: `WarderTestController:956` | `(action, arg, arg2, arg3)` / `(kind, ...)` |
| `WarderSkillPurchase` | RF | C→S | `ScrapbookPanel:258` | `Services/WarderSkillService:169` | `(id, tier)` |
| `RagdollToggle`, `WaterInteractionVisual`, `RawWaterAnimation` | RE ×3 | n/a | **no references in any script** | none | n/a |

### 2.6 ClientEvents (BindableEvents, client only)

| Event | Fired by | Handled by | Payload |
|---|---|---|---|
| `ClientEvents/ActionBegan` | `SPS/InputController:245`; `SPS/MobileHUDLayoutController:65` | `SPS/CameraController:21`, `ChannelAnimationController:566`, `ChannelController:563`, `SPS/C/HealingController:55`, `BindingThreadsController:13`, `CircleAbilityController:294`, `SpiritTechniqueController:186`, `RawEarthController:137`, `FireHoldController:55`, `StarterPlayer/StarterCharacterScripts/Shiftlock:140` | `(actionName)`; names from `Shared/InputActions` |
| `ClientEvents/ActionEnded` | `SPS/InputController:296` | `ChannelController:597`, `HealingController:72`, `FireHoldController:72` | `(actionName)` |
| `ClientEvents/ChannelFeedback` | `SPS/ChannelController:341` | `SPS/ChannelFeedbackController:485` | `(action, element, button, threadNumber)` |
| `ClientEvents/ThreadHandChosen` | `SPS/ThreadVisualController:557` | `SPS/AbilitySoundController:387`, `ChannelAnimationController:552` | `(hand, element, threadIndex)` |
| `ClientEvents/ControllerElement` | `SPS/InputController:853` | `SPS/ChannelController:641` | `(element)` |
| `ClientEvents/ControllerQuickSlot` | `SPS/InputController:837` | `SPS/C/QuickSlotController:232` | `(slot)` |
| `ClientEvents/ManaPreview` | none yet (the channeling round will fire it) | `SPS/HUDController` (desktop plate: mana preview, burnout shortfall, warning line; ignored while `ReadyWeave` is set) | `(cost, weaveName?)` or `(nil)`; weaveName optional, names the warning line |
| `ClientEvents/Toast` | Round 1 callers: `SPS/XPUIController` (kill credit), `SPS/Controllers/LearnedWeaveNotificationController` (Unlock), `SPS/Controllers/CircleController` (Social invite) | `SPS/Controllers/ToastController` | `(props)`: WovenUI.Toast props plus `id` (same id replaces; `{id=x, dismiss=true}` closes), `recipe` (element names, shown as medallions), `onShow(instance, api)`. Not queued: a Fire before ToastController connects is lost |
| `ClientEvents/ThreadVisualLocal` | `RF/PlayEntryClient/MenuShowcase` (~`:121-123`, local menu caster) | `SPS/ThreadVisualController:3434` | same arguments as the ThreadVisual remote |

Client scripts also create BindableEvents at runtime: `ToggleShop` (`SPS/MarksShopClient:244`), `OpenMenu` and `ToggleMenu` (`SPS/C/EconomyController:397`,`:400`), `WovenResetCharacter` (`SPS/C/VoluntaryResetController:5`), `Open` and `ResetLayout` (`SPS/C/MobileLayoutController:314`,`:316`), `Closed` (`Shared/ButtonTemplateView:119`), and BookController menu events (`SPS/C/BookController:858`). The server creates `FirstJourneyTestAdvance` in ServerStorage (`FirstJourneyService:489`), plus internal events in ProjectileService, CircleService and MaximumAffinityService.

## 3. Shared module inventory

"Used by" counts are scripts that name the module outside comments, including disabled scripts. S = server, C = client, M = other Shared modules.

### 3.1 Config (data tables)

| Module | Responsibility | Used by | Notes |
|---|---|---|---|
| `SaveSlotConfig` | `Enabled=true`, `Slots=2`, `MaxSlots=10`, `ExtraSlotProduct=3728719801`, `Classes={Channeler,Guardian}` (`:5-11`) | both: RF/PlayEntryClient, PlayEntryServer, ServerMain, DataService, SaveSlotService, GiftServer | `Enabled=false` restores the old one-save flow (`:1`) |
| `MapConfig` | Minimap areas (image, origin, size, fog grid ≤32). One area now: `EmondsField` (`:7-17`) | both: MinimapController, MapDiscoveryServer | |
| `DayNightConfig` | 24-minute day (`DaySeconds=1440`, `StartClock=16.6`) and lighting grades (`:3`) | both: DayNightService, TimeChange, TempestWeatherController | |
| `SoundConfig` | Sound ids per system | both: AbilitySoundController, MenuShowcase, FireDrawing, RawAir, Stilling, HeldWardService, WeaveAudio, RawFireRuntime | |
| `AnimationConfig` | Animation ids for channeling and casts | both: ChannelAnimationController, MenuShowcase, CompulsionService, SpiritTechniqueService, GuardianBondTest | |
| `TitlesConfig` | Title definitions, colors, order, auto-grants | both: BookController, ScrapbookPanel, TitlesService, AdminService, PlayerNametags; M: AdminAutocompleteConfig | |
| `MarksShopConfig` | Marks shop prices; faction-war zone timings (`:4-9`) | both: MarksShopClient, MarksShopService, FactionService, FactionWarService, TitlesService | Zone timings live in a "shop" config |
| `VillageTeachingConfig` | Teachers: ExcludedWeaves, spawn counts, delays | S: VillageTeachers, VillageNPCService | |
| `VillageDialogueConfig` | Local village stories; choices validated on the server | S: VillageTeachers | Server-only, yet in ReplicatedStorage |
| `VillagePersonalityConfig` | Per-villager temperament for chatter | S: VillageTeachers, VillageNPCService | Server-only, yet in ReplicatedStorage |
| `BookPageConfig` | Book info-page text and PageOrder; requires Keybinds (`:4`) | C: BookController | |
| `GuardianBookPages` | Basics pages for Guardian saves | C: BookController | |
| `HowToInfoConfig` | Game information text | **none** | Dead (§6) |
| `AdminAutocompleteConfig` | `hints[command][argIndex]`; builds warp names from WaygateConfig (`:4-8`) | C: AdminController | |
| `PlayerNametagConfig`, `BookPresentationConfig`, `HeldWardConfig`, `FinisherConfig`, `MovementStates`, `TrollocCodeClips`, `TrollocSoundBank`, `FlightConfig` | Single-consumer tuning tables | mostly S | |
| Weave and ability configs: `WeaveConfig`, `CircleReworkConfig`, `CircleAbilityConfig`, `CircleConfig`, `CircleAnimationConfig`, `FireGestureConfig`, `ElementConfig`, `ElementSkillConfig`, `AdvancedSkillConfig`, `WeaveInfoConfig`, `WeaveMotionConfig`, `PowerChannelConfig`, `RockThrowConfig`, `SprintConfig`, `SpiritStunConfig`, `FireballConfig`, `AirBladesConfig`, `LightningConfig`, `RawSpiritConfig`, `RawSpiritProgression`, `RawWaterConfig`, `RawEarthConfig`, `RawFireConfig`, `BoneBreakConfig`, `CrumbleConfig`, `HealingFlowConfig`, `StillingContestConfig`, `WaygateConfig`, `GuardianBondConfig`, `WarderConfig`, `WarderTest`, `WarderSkillConfig`, `WarderSwordForms`, `CombatStates` | See [abilities.md §7](abilities.md) | both | `WeaveConfig` (1962 lines) has the most dependents: 36 S, 14 C, 8 M |

### 3.2 Input

| Module | Responsibility | Used by | Deps |
|---|---|---|---|
| `Keybinds` | The single table of rebindable actions (`M.Actions`, `:11-48`) with PC and Pad defaults and a Context field (Channel/Free/Fire/Quick/Any). API: `Label`, `Get(action, device, player)`, `Key`, `Is(input, action)`, `Keys`, `Conflicts`, `Changed(fn)` (`:76-145`). Reads player attributes `Setting_Bind_<Action>_<PC\|Pad>`, validated against `M.Allowed` (`:85-92`) | C (14): InputController, ChannelController, BookController, ScrapbookPanel, KeybindListController, QuickSlotController, MinimapController, FireDrawingController, ControllerCursorController, SprintController, RF/FirstJourneyClient… S: PlayerSettingsServer (builds DEFAULTS, `SSS/PlayerSettingsServer:16-21`). M: BookPageConfig | KeyLabel |
| `KeyLabel` | Display text for a KeyCode in the player's keyboard layout (`GetStringForKeyCode`), never cached; `selfTest()` (`:23-46`) | C: KeybindListController, BookPromptController, QuickSlotController; M: Keybinds | none |
| `InputActions` | Four action-name constants: TogglePvP, Channel, ConfirmWeave, PrimaryAction (`:8-35`) | C (16): InputController, ChannelController, CameraController, ability controllers… | none |
| `TouchUI` | `IsTouchUI()`: gamepad never counts; Touch preferred counts; otherwise touch without keyboard (`:9-17`) | C: InputController, KeybindListController, WarderTestController | none |
| `MobileTapGate` | Tells hold apart from drag on touch (DRAG_THRESHOLD 20 px, HOLD_TIME 0.25 s); subscriber broadcast (`:10-23`) | C (9): InputController and ability controllers | none |
| `MobileTargetSelection` | Touch target highlight state | C (4); M: ProjectileAimService | |
| `ControllerAim` | Gamepad-aware aim: screen center with a gamepad, else the mouse; `World(distance, exclude)` raycast (`:5-22`) | C (20+) | none |
| `ControllerCursor` | GamepadCursor Active/Open/Close; Open picks the first visible "words" button (`:8-36`) | C (6) | none |
| `ProjectileAimService` | Projectile aim for mouse, touch and controller | C (9) | MobileTargetSelection, CombatTargets |

### 3.3 UI helpers

| Module | Responsibility | Used by |
|---|---|---|
| `UiManager` | `Register(id,{isOpen,open,close})`; `Toggle(id)` closes the others first (`:8-26`) | C: BookController, EconomyController, MinimapController, MarksShopClient, InputController, `StarterGui/TopHUD/TopHUDController`; SettingsController (disabled) |
| `ButtonTemplateView` | Parchment button factory (Fondamento font, ink colors, strip images); creates a `Closed` BindableEvent (`:5-10`, `:119`) | C: EconomyController; SettingsController (disabled) |
| `TopButtonTheme` | Top-bar button style and `Y()` from `GuiService.TopbarInset` (`:3-17`) | C: AdminController, EconomyController, ElementSkillController, MinimapController, MobileHUDLayoutController; SettingsController (disabled) |
| `WovenTheme` | Tokens of the redesign: colours, resource and element hues, fonts, min text 12/14 px, 44 px touch target, panel and strip images with slices. `TextMin()` returns 14 on touch; `TouchOverride` is a test hook. `TextSize(px, font)` turns a kit px size into the Roblox TextSize that draws as large as the kit (Roblox TextSize is the line height): Merriweather ×1.245 (bold ×1.22), Fondamento ×1.37, BuilderSans ×1.27; without a font, or for other fonts, the size is unchanged. `BoardScale()` = clamp(min(W / 1600, H / 900), 0.8, 1.5) from the whole screen, the combat HUD's one scale rule. Image native sizes measured in Play: parchment about 558 px wide, knot frame about 1024; both cut at 16 % of the width like the kit, the parchment's side insets wider (164) because Roblox crops a 9-slice middle narrower than its source | M: WovenUI; Round 1 HUD scripts |
| `WovenUI` | Component kit of the redesign, per `docs/ui-kit` "Target design": Panel (paper/silver), Button (red/grey/purple/danger/plain), CloseButton, Tabs with badge, Bar (trail, cost preview, burnout shortfall; `Bar:SetHue(colorOrName)`; the trail only reacts to a changed fraction), Slot (ready, weaveReady, cooldown sweep, noMana, suppressed, empty), StatusIcon, Toast, Tooltip, ConfirmDialog, Glyph, Label. Each is `(props, parent) -> (instance, api)`. `textSize` props are kit px; Label converts them for its font (`WovenTheme.TextSize(px, font)`). `Slot`'s `cost` may be a number or text (e.g. `"12/s"`). Has `WovenUI.SelfCheck` (98 checks, desktop and touch). `Slot`: recipe glyphs at 16/76 of the face, centred on the face inside the 6/76 inset; the row moves, and scales down only when it must, to stay 2 px clear of the key and cost rects; `api:FitRecipe()` refits after an outside layout change. | no screen yet; M: WovenTheme, WovenGlyphs |
| `WovenGlyphs` | Rects of each glyph in the uploaded glyph sheet (`SheetId` 0 until uploaded; `WovenUI.Glyph` draws nothing while 0). Generated from `tools/ui-kit/glyphs` | M: WovenUI |
| `ScreenEffectLayout` | `Fullscreen(gui)`: ignore inset and safe areas for combat overlays (`:6-10`) | C (9) |
| `SaveReady` | `Connect(fn)` runs when `SessionDataReady` turns true again after Back to Main Menu; the first save of a join is skipped (`:9-18`) | C: BookController, EconomyController, MarksShopClient |
| `JournalArt` | Journal palette and frame builders | **none** (dead) |
| `RawElementOptions` | Element option picker wiring | C (3) |

### 3.4 Visuals and presentation (client-only unless noted)

| Module | Responsibility | Used by |
|---|---|---|
| `VfxBroadcast` | **Server-only**, despite sitting in Shared. Distance-culled broadcast (§2.1) | S (≈50 scripts) |
| `CasterActors` | Cached presentation roster of players and NPCs; `Candidates()` hot set; `ShadowCheckEnabled` dev flag (`:1-13`) | C (18) |
| `VisibilityRules` | `Owner`, `CanSee(viewer, subject)` using WaysGroupId, Dreamwalking and SpiritBlockUntil (`:7-24`) | both (S 5, C 12, M 3) |
| `LocalVisibilityMask` | One ledger of original values for local concealment, `Apply(owner, desired)` (`:9-`) | C (4), M: WeaveVisibility |
| `WeaveVisibility` | Per-caster weave concealment | C (30) |
| `IncrementalDescendantScan` | Frame-budgeted descendant scan (192 visits or 1 ms per frame, `:8-9`) | C: ConcealedOwnedEffects, RawSpiritDreamVisualController, RawWaterSourceController, ThreadAppearanceController |
| `CinematicFeedback` | Bounded camera-offset compositor | C (10) |
| `GroundGuide` | The player's single waypoint (gold ground arrows); creates a BindableEvent (`:6`) | C: MinimapController, MarksWorldVisuals |
| `BlackWindSwarm`, `WaygateOpeningPose`, `FactionZoneBoundary` | Ways/waygate and faction-zone visuals | C |
| `Lightning/LightningBolt` (+ `PartCache/PartCache`, `PartCache/Table`) | Open-source bolt renderer, license headers kept | C: `SPS/C/LightningVisualController:50-53` |
| `WardImpactVisual`, `WaterSplashVisual`, `CharacterBurnVisual` (also S), `ThreadTrailGroup`, `WeaveTrailTaper`, `WeaveVisualOpacity`, `WeaveRingLayout`, `ReadyThreadPaths`, `ReadyGroundEnvelope`, `ThreadStartFade`, `ChannelReadyHandoff`, `CircleBeamSource`, `CirclePlacementThreads`, `CircleFlowMotion`, `Tempest*`, `GrandShield*`, `Healing*` (HealingTargeting also S), `RawFire*`, `RawWater*`, `RawAir*`, `RawEarthWallVisual`, `AirPush*`, `AirSlash*`, `FireballWeavePattern`, `SoloWeavePatterns`, `ShieldingShellVisual` (C: AirPrisonController), `WeaveGestureLibrary` (also S: WeavePresentationService), `NPCWeaponPoses` (both), `WarderAnimation`, `ElementMastery` (both), `SpiritBlockProtection` (**S only**), `CombatTargets` (both, S 22) | Weave and ability presentation; see [abilities.md](abilities.md) and [client.md §6](client.md) | |

### 3.5 Utilities

| Module | Responsibility | Used by |
|---|---|---|
| `DebugLog` | `Trace(...)` prints only when the module's `DebugLogging` attribute is true (`:6-8`) | **none** (dead) |
| `WarderGate` | "Does this player have a live weave" rule | both |
| `WarderSwordForms/SelfCheck` | Manual self-test, run with `require(...)()` (needs Play) | none (by design) |
| `KeyLabel.selfTest` | Manual self-test | none (by design) |

### 3.6 Non-module contents

- `ReplicatedStorage/Design`: `StyleSheet` derives from `BaseStyleSheet` and has StyleRules per GuiObject class, plus an empty `Folder`. No script references these sheets by name; they are probably linked through StyleLink instances (not checked).
- `ReplicatedStorage/Assets` (35,770 descendants):
  - `ThreadActors`, `AbilityEffects` (1,930 descendants; read by many visual controllers and MenuShowcase), `CircleAudio`, `Tempest`, `Animations` (1,829), `StoneSoldierRig`, `OpenBook`, `Trolloc` (contains an `AnimateScript` with a `PlayEmote` BindableFunction), `WarderSword`.
  - `WarderDashClips` (888), `WarderJumpDashClips` (2,112), `WarderSwordFormClips` (27,553), `WarderAirSlashClip` (a KeyframeSequence). The Warder clip folders are KeyframeSequence trees and make up most of the replicated weight.
- `ReplicatedStorage/WeaveStats` (built at runtime by `Services/WeaveStatsService`; read-only for clients): folder attributes `ThreadCap`, `BurnoutBaseMultiplier`; one Configuration per weave id (every WeaveInfoConfig id that is also a WeaveConfig weave) with `ManaCost` (only when the cost is fixed), `ManaPerSecond` (only when above 0), `ReadyWindow` (seconds, when the weave has one), `GateElement`/`GateTier` (when gated). Built once at server start; a missing attribute means no fixed value.
- Session and scene folders (replicate session state through instances and attributes instead of remotes):
  - `FireHoldSessions`: written by `SSS/Server/Abilities/FireHold:50`, read by `SPS/FireHoldVisualController:11`. Empty at edit time.
  - `RawFireSessions`: created by the server if missing (`Services/RawFireRuntime:11-12`); read by `SPS/C/RawFireThreadController:11`.
  - `FollowingLights`: created by the server if missing (`Services/FollowingLightService:5-6`); read by `SPS/C/FollowingLightController:5`.
  - `WaygateScenes` (Ways, Edmond, Aiel models) and `WaygateEffectTemplates` (Edmond, Aiel): read only by `SPS/C/WaygateController:13-14`.
  - `NewThread`: a Part with Top and Bottom attachments and four Trails. The thread template for AirPushWeaveShapeController, FireballWeaveShapeController, HealingCasterShapeController, SoloWeaveShapeController, RawWaterSourceFlowController and IncomingWeaveBeamController; also cloned by the disabled AirPushCastThreadController and AirSlashWeaveTrailController.
- `ReplicatedFirst`:
  - `PlayCamera`: a CFrameValue, the fallback menu camera.
  - `PlayHUD`: the menu template. Frame `1` holds the title, Play and Credits plates, SaveCard, Dots and the SaveBack/Left/Right buttons. Frame `2` holds arrows and a ChannelerButton. A `Credits` frame holds the credits page.
  - `SaveSlotHUD`: the class picker template (Channeler, Guardian, Back).
  - `PlayEntryClient` children: `MenuShowcase`, `CreditsList`, `CreditsView`, `SaveCards`.

## 4. Join and entry flow

**Server startup**

1. `SSS/Server/ServerMain` installs CircleIntegrationService first (`:36`), then calls `Start()` on the core services in a fixed order (`:37-55`). Later it starts `SaveSlotService` and `GuardianBondService` (`:92-93`).
2. `SSS/ServerBootstrap` starts other services in parallel, each in its own guarded `xpcall` thread (`:9-16`). See [server.md §3](server.md).
3. `SSS/PlayEntryServer:6` sets `Players.CharacterAutoLoads = false`, so no character exists until Play.

**Player joins (server side)**

4. `PlayEntryServer.watch` (`:57-73`) sets `EnteredWorld=false`. `menuScreen` (`:36-54`):
   - sets `ReplicationFocus` to `workspace.camerapieceforloading`;
   - builds the player's own R15 avatar as `PlayerGui/MenuAvatar`;
   - when save slots are on, sets the avatar's `MenuClass` attribute from `SaveSlotService.MenuInfo` (last slot and class from the account record).
5. `ServerMain.onPlayerAdded` (`:58-78`) waits while `DataService.Unloading` is true, or while slots are on and the `SaveSlot` attribute is nil (`:63`). **Nothing loads until the player picks a save.**

**Client: intro and menu**

6. `RF/PlayEntryClient` runs `showMenu(true)` (`:552`):
   - clones PlayHUD into `ActivePlayHUD` with DisplayOrder 10000 (`:25-26`);
   - removes the default loading screen (`:151`, `:452`) and sets the `PlayScreenActive` attribute;
   - suppresses every other ScreenGui except `FirstJourneyHUD` and `ActiveSaveSlotHUD` (`:155-165`), and hides CoreGui and ProximityPrompts (`:174-178`);
   - hides other players (`:181-202`);
   - drives a scriptable camera from `camerapieceforloading` or `PlayCamera` with mouse lean (`:216-243`).
7. **Studio shortcut:** in Studio on the first join, unless the script's `PreviewInStudio` attribute is true, the intro is skipped and Play is requested at once (`:40`, `:460-466`).
8. Otherwise the intro runs: spinning ring and quotes while music fades in (`:468-495`). The client waits 1.5–20 s for `loaded()` (`:497-500`), which needs all of:
   - `SessionDataReady`, or (slots on and no save yet);
   - streaming done (`RequestStreamAroundAsync` twice, `:444-451`);
   - art preloaded;
   - `Showcase.Ready`, or 8 seconds passed.
9. The menu reveals and, with slots on, `mountCards` runs (`:533-534`). It calls `SaveSlot:InvokeServer("List")`. The server waits for any closing save, then returns `{Saves, Owned, Max, Price, LastSlot}` (`SaveSlotService:73-81`). Each save in `Saves` carries `Title`, its equipped title display name (nil when none; `DataService.PeekSlots`).

**Save pick**

10. **Play** runs `requestPlay` (`:399-415`). With slots on and no `SaveSlot` yet, it opens the save card instead of entering (`:401-405`).
11. Picking a card runs `enterSelected` (`:337-357`):
    - An **empty** card opens the class picker (`SaveSlotHUD`, via `SaveCards.ChooseClass`).
    - Then `SaveSlot:InvokeServer("Choose", slot, class)`. The server validates (0.5 s throttle, slot range, class allowed; slot 1 is always Channeler), sets `SaveClass` and `SaveSlot`, and turns `BeyondThePattern` off for Guardians (`SaveSlotService:88-107`).
    - A **Buy** card calls `InvokeServer("Buy")`, waits on `PromptProductPurchaseFinished`, then polls `List` for up to 10 s (`:366-383`). The receipt is granted through `SaveSlotService.GrantReceipt`, called from GiftServer's ProcessReceipt (`SaveSlotService:40-55`).
12. On the server, `SaveSlot` being set releases ServerMain:
    - `DataService.LoadPlayer` runs (`:65`);
    - on the first load only, `CombatService.InitPlayer` and `BurnoutService.InitPlayer` run (`:67-71`);
    - then `FirstJourneyService.Prepare(player)`. **Only if it returns true** is `SessionDataReady=true` set (`:72-74`).
13. The client polls `SessionDataReady` for up to 30 s (`PlayEntryClient:354`), then calls `requestPlay` again, which sends `PlayEntry:FireServer("Play")` (`:414`).

**Tutorial gating inside Prepare (`FirstJourneyService:368-395`)**

- Writes the `TutorialCompleted` and `TutorialSkipped` attributes. If `Required(p)` is false, returns true.
- `Required` (`:72-77`) is true when the tutorial is not completed and either it was flagged required, or it was not skipped and the player's level is 10 or lower.
- In Studio, the tutorial only runs if `Workspace.TestFirstJourney` is true and the player is alone. Otherwise it sets `TutorialTravelMessage` and returns false, and `SessionDataReady` is never set.
- In a matching reserved private server it claims `TutorialOwner`, calls `start(p)` and returns true.
- Otherwise it calls `transfer(p, false)` and returns false. From the TeleportService hook at `:410`, this teleports the player to a private tutorial server (transfer body not read).

**Spawn**

14. `PlayEntryServer` OnServerEvent (`:125-141`) handles "Play":
    - Already in the world: replies "Started".
    - `SessionDataReady` not set: replies "Retry". The client retries quietly up to 8 times, 1.5 s apart (`PlayEntryClient:425-439`).
    - If `FirstJourneyService.Required` and the tutorial is not active, it calls `Prepare` and returns without replying.
    - Otherwise it sets `EnteredWorld=true` and calls `spawn()` (`LoadCharacterAsync`, `:15-33`); tutorial players are placed at the FirstJourney spawn. Then it replies "Started", or "Retry" on failure.
15. On "Started" the client runs `finish()` (`:284-309`): restores GUIs and CoreGui (Health stays off), sets the camera to Custom, stops the Showcase, unhides players, fades the music and destroys the HUD.

**Tutorial UI**

16. `RF/FirstJourneyClient` sends `FirstJourney:FireServer("Sync")` on start (`:367`). The card shows only while (`TutorialActive` and `EnteredWorld`) or `TutorialTravelMessage` is set, and the book or skill tree is closed (`:260-264`).
    - Welcome screen: Begin or Skip; Skip asks for confirmation (`:285-297`).
    - Lessons: the recipe as key chips and element orbs.
    - Skills choice: calls `ChooseElementAlignment`.
    - Complete: "Enter the village" sends "Finish" (`:322`).
17. The server applies a 0.25 s throttle except for Sync, and handles StartFromBook, Begin, Retry, Finish and Skip (`FirstJourneyService:416-445+`). The book can restart the tutorial with "StartFromBook" (`SPS/C/BookController:271`).

**Back to Main Menu**

18. `SPS/C/BookController:807` sends `PlayEntry:FireServer("Menu")`. `PlayEntryServer.menu` (`:82-105`) refuses when the tutorial is active, the save is unloading or the player is busy, the player has not entered the world or the save is not ready, or less than 3 s passed since the last request. Otherwise it sets `EnteredWorld=false` and calls `DataService.Unload`, which saves and clears `SaveSlot`, `SessionDataReady` and `SaveClass` (`DataService:863`, `:890`). It destroys the character, re-runs `menuScreen` and fires "Menu". The client runs `showMenu(false)` (`PlayEntryClient:545`). ServerMain's loop waits for the next pick (`:76`). When the next save opens, client caches reset through `Shared/SaveReady`.

**Death and void**

- After a death, PlayEntryServer respawns the player once `Players.RespawnTime` has passed, but only if `EnteredWorld` is still true (`:60-72`).
- A Heartbeat check kills a player below Y -200, or without a HumanoidRootPart, at most once every 5 s (`:106-123`).

## 5. Conventions

- **Module shape.** One table returned per file, called `M`, `S`, `T`, `A` or the module's own name. The first line is `-- Name: one-line purpose` (nearly universal). Pure config modules `return { ... }` directly (SaveSlotConfig, MarksShopConfig, TitlesConfig).
- **Require patterns:**
  - `require(RS.Shared.X)` and `require(RS:WaitForChild("Shared"):WaitForChild("X"))` are both used.
  - Inside Shared, modules use `require(script.Parent.X)` or `script.Parent:WaitForChild("X")` (`Keybinds:5`, `WeaveConfig:1962`).
  - Lazy `require` calls inside functions are common on the server (e.g. `PlayEntryServer:26`, `:49`, `:130`) to avoid circular requires and startup ordering problems.
- **Remote naming.** `<Feature>Action` is client→server input. `<Feature>Visual` is a server→client broadcast. `<Feature>Feedback` and `<Feature>Notification` are caster-only messages. `<Feature>Request` is a RemoteFunction, or a RemoteEvent with a command string. `<Feature>Changed`/`<Feature>Ready` pairs implement push-on-ready: the client fires Ready and the server pushes a full snapshot (Economy, Titles, Missions).
- **Remote payloads.** The first argument is a command string (`"Start"`, `"Release"`, `"Notice"`…) followed by positional arguments. Contest remotes carry a token. Server handlers start with throttles of the form `os.clock() - last[p] < x` and an early `BeingStilled` return for abilities.
- **State replication.** Player attributes are the main state channel (`SaveSlot`, `SaveClass`, `SessionDataReady`, `EnteredWorld`, `TutorialActive`, `Setting_*`, `CombatState`, …). Clients listen through `GetAttributeChangedSignal`. Session folders in ReplicatedStorage carry per-session instances.
- **Config structure.** Tuning values are constants with inline comments giving units and assets. Display text lives in `*Config` modules. Settings are stored by `PlayerSettingsServer` and mirrored to `Setting_<key>` attributes (`SSS/PlayerSettingsServer:60`).
- **Self-checks.** Pure `selfTest`/`SelfCheck` functions run by hand in Edit (`KeyLabel:37`, `WarderSwordForms/SelfCheck`, `LevelRules/SelfCheck`, `SaveSession/SelfCheck`).
- **Code comments.** `ponytail:` and `shortcut:` comments mark design decisions and known limits (`VfxBroadcast:3`, `PlayEntryServer:7`).

## 6. Legacy and dead code

Each item was checked by name grep across all live scripts, excluding MCPBackups.

**Dead Shared modules (no reference outside themselves):** `DebugLog`, `HowToInfoConfig`, `JournalArt`, `WaygatePillarProfiles`.

**Shared modules used only by disabled scripts:**

- `ReadyGroundEnvelope`: only `ReadyGroundFlowController` (disabled).
- `AirSlashMovementVisual`: only `AirSlashWeaveTrailController` and `IncomingWeaveBeamController`, both disabled.

**Dead or half-dead remotes:**

- No references at all: `RagdollToggle`, `WaterInteractionVisual`, `RawWaterAnimation`.
- Listened to but never fired: `SpiritStunVisual`, `SpiritStunFeedback`, `SpiritStunSound`, `SpiritStunAnimation`, `FireballAnimation`. Five client controllers wait for nothing.
- Fired but never listened to (wasted bandwidth): `CircleAnimation` (`CircleService:204` and others), `RawWaterVisual` (`RawWaterFormationService:565`,`:720`), `MissionsChanged`.
- Fired, but the only listener is disabled: `AirSlashThreadRelease`. (`IncomingThreadVisual` is no longer fired: sends removed 2026-11-09.)
- `MissionsReady` has a server handler and no client sender, so the missions handshake has no client at all.
- `InsectControlAction` is fired by the client (`InsectControlController:66`) and no server handler was found: either a bug or dead input.
- `PainContest` is referenced only by the disabled `PainContestController`.
- `ServerStorage/DisabledFlood/FloodVisual` is listened to only by a disabled controller.

**Disabled client scripts seen in this scan:** AirPushCastThreadController, AirSlashWeaveTrailController, IncomingWeaveBeamController, IncomingThreadController, ReadyGroundFlowController, PainContestController, SettingsController. They still require Shared modules and name remotes.

**Duplicate or overlapping code:**

- Two server entry points: `ServerMain` (labelled legacy in its own header, `:1-5`) and `ServerBootstrap` (the newer guarded one). Both run; startup is split between them with no single ordering.
- `InputActions` (4 names) and `Keybinds` (the full action table) both name "Channel". `TouchUI` repeats the touch-detection logic of InputController and KeybindListController (`TouchUI:3-5` says so).
- Notices go through several channels: `CircleReworkVisual("Notice", …)`, `MarksShopNotice(title, text)`, `FirstJourney("Notice")`, `WaygateEvent("Notice")`, and `RawEarthAction`/`RawWaterAction`/`FireDrawingAction("Notice")`.
- One remote, two runtime creators: `FireballVisual`, `FireballAnimation` and `FireballFeedback` are created by both `Fireball:51-54` and `FireballBarrage:38-41`.
- A second folder named `Shared` exists on the server: `ServerScriptService/Server/Shared` (ScreenShakeService).
- `ServerStorage/MCPBackups` holds 56 dated folders with 236 script copies (183 modules, 40 LocalScripts, 13 Scripts). They do not run, but they pollute every grep.

## 7. How to change this area

**Add a remote**

1. Prefer an authored instance in `Remotes/`, so clients' `WaitForChild` never hangs.
2. If it must be created at runtime, use `RS.Remotes:FindFirstChild(name) or Instance.new("RemoteEvent")`, then set Name and Parent. Never a bare `Instance.new`, as `VillageTeachers:6` does.
3. Name it `<Feature>Action`, `<Feature>Visual`, `<Feature>Feedback` or `<Feature>Request` (§5).
4. On the server, validate types, throttle per player, and return early on `BeingStilled` for ability input ([server.md §9.2](server.md)).
5. For transient VFX, use `VfxBroadcast.FireNearby`, or `FireNearbyMembers` when involved players must always receive it.
6. For caster-only events on targets that may be NPCs, use `CombatTargets.FireClient`.
7. Add a row to §2 of this document.

**Add a shared module**

1. Put it in `ReplicatedStorage/Shared` only if a client needs it. Server-only modules belong under `ServerScriptService/Server` (VfxBroadcast, SpiritBlockProtection and the Village dialogue configs break this rule today).
2. Start with a `-- Name: purpose` line and return one table.
3. Inside Shared, require siblings with `script.Parent.X`.
4. Add a row to §3.

**Add a config value**

1. Add a commented constant to the matching `*Config` module.
2. If changing a value could break saves (binds, slots), read `Keybinds:35`: a saved setting overrides a changed default, so introduce a new id instead.
3. For a save-slot change, edit `SaveSlotConfig`. `Enabled=false` falls back to the single-save flow in both PlayEntryClient and ServerMain.

**Add a keybind**

1. Append `{Id, Name, Group, PC=?, Pad=?, Context=?}` to `Keybinds.Actions` (`Shared/Keybinds:11-48`). Allowed keys come from `M.Allowed` (`:69-74`).
2. In the controller, use `Keybinds.Is(input, "Id")` or `Keybinds.Keys("Id")`, and listen to `Keybinds.Changed(fn)` for rebinds.
3. On-screen labels come from `Keybinds.Label(Keybinds.Get(id, "PC"))`, as in `FirstJourneyClient:25`.
4. PlayerSettingsServer builds the `Bind_<Id>_<Device>` defaults from the same table (`SSS/PlayerSettingsServer:16-21`), so no server change is needed.
5. The Settings page reads `Keybinds.Actions` generically; check that the new action appears.

## 8. Risks and gotchas

1. **Players can get stuck on the menu.** `SessionDataReady` is set only when `FirstJourneyService.Prepare` returns true (`ServerMain:72-74`). In Studio without `Workspace.TestFirstJourney`, a player who needs the tutorial never becomes ready: Play returns "Retry" 8 times, then shows the error. In live servers the teleport path also returns false; if the teleport fails, recovery depends on the user pressing Retry (`FirstJourneyService:413`, `:438`).
2. **Unbounded waits.** Clients wait on runtime-created remotes with `WaitForChild` and no timeout (EconomyReady, TitlesReady, CircleAbilityVisual…). If a server script errors before creating its remote, client controllers hang with no warning.
3. **`CastRequest` has two server handlers** (`AbilityService:1630`, `CircleIntegrationService:988`). Their behaviour depends on `CircleIntegrationService.Install()` running before `AbilityService.Start()` (`ServerMain:35-48`). Reordering startup can break casting.
4. **Startup is split between ServerMain and ServerBootstrap.** Some services are started from both (e.g. `MovementStateService.Start`, `ServerMain:55`, `ServerBootstrap:55-57`); those are guarded, but several other `Start()`s are not ([server.md §3.1](server.md)).
5. **VfxBroadcast culls by distance to HumanoidRootPart.** Players on the menu have no character, so they receive no nearby VFX. When the server passes a nil position, VfxBroadcast falls back to FireAllClients.
6. **Remotes overloaded as general notice channels** (`CircleReworkVisual`, `MarksShopNotice`). Changing a handler's argument order breaks unrelated systems.
7. **Server-only code in ReplicatedStorage** (VfxBroadcast, SpiritBlockProtection, VillageDialogue/Personality configs) is visible to exploiters and costs replication size.
8. **Replicated asset weight.** `Assets` holds about 35.8k descendants, 27.5k of them in `WarderSwordFormClips`. All of it replicates to every client before the menu's `loaded()` check completes.
9. **Purchase event in SaveCards.** `PlayEntryClient` waits on `PromptProductPurchaseFinished:Wait()` (`:372`). If another purchase prompt finishes first, the wrong event is consumed.
10. **One-shot menu flag.** `PlayEntryClient` keeps a module-level `menuOpen` flag; `showMenu(false)` only runs when the menu is not already open (`:545`).
11. **Grep noise.** `MCPBackups` duplicates most server code; filter its hits before trusting a search.

## 9. Open questions

- What does `FirstJourneyService.transfer` do exactly (TeleportService API, reserved-server handling), and what happens to the main-server session after a transfer?
- Is `InsectControlAction` handled somewhere missed (e.g. a generic dispatcher)? The grep found only its creation at `Abilities/InsectControl:60`.
- Should the SpiritStun* remotes be fired by `Abilities/SpiritStun`, or are their four client controllers legacy?
- Do `Design/StyleSheet` and `BaseStyleSheet` reach the UI through StyleLink instances?
- `MenuShowcase`, `SaveCards`, `CreditsView` and `CreditsList` were read only at their call sites; the ThreadVisualLocal line numbers (`MenuShowcase:121-123`) come from grep only.
