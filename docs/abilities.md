# Abilities and weaving

How the server ability system works, from the moment a player starts channeling to the moment a weave's effect resolves. Built from the live Edit DataModel, read-only, on 2026-11-08; nothing here was observed at runtime. Line numbers drift as code changes.

Related docs: [server.md](server.md) (services, boot, persistence), [client.md](client.md) (client VFX and input), [shared.md](shared.md) (full remote catalogue), [systems.md](systems.md).

## 1. Scope

- `ServerScriptService/Server/Abilities`: 33 direct children, which are 32 ModuleScripts plus the `CircleAbilities` folder of 14 modules (46 modules in total).
- The services that make up the cast pipeline in `ServerScriptService/Server/Services`: `ChannelService`, `WeaveService`, `AbilityService`, `CircleIntegrationService`, `CircleWeaveService`, `CircleAbilityRuntime`, `SoloWeaveRuntime`, `ManaService`, `CombatService`, `HeldWardService`, `WardService`, `QuickSlotService`, `ElementSkillService`, `LearnedWeaveService`, `WeavePresentationService`, `WarderSkillService`, `WarderCombatService`, `GuardianBondService`. Each is described only as far as the pipeline needs.
- The shared configs in `ReplicatedStorage/Shared` that drive weaves.
- On the client, only what starts a cast: `StarterPlayerScripts/InputController`, `StarterPlayerScripts/ChannelController`, `Controllers/FireballController`, `Controllers/FireballVisualController`.

Every module under `Abilities` is a ModuleScript; they run only because services require them. The pipeline is booted from `ServerScriptService/Server/ServerMain` (see [server.md §3](server.md)).

## 2. Mechanic model (as the code defines it)

**Combat state.** Every player has a server-owned state machine, stored as the `CombatState` attribute and written by `CombatService.SetState`. The states are `Idle`, `PvP`, `Channeling`, `WeaveReady`, `Casting`, `BurnedOut` and `Dead` (`ReplicatedStorage/Shared/CombatStates:8-36`). The whole pipeline is gated on these states.

**Channeling.** Pressing Channel (the `Channel` input action) sends `ChannelRequest("Start")`. The server accepts it only from `Idle`, and only when no suppression attribute is set (`ServerScriptService/Server/Services/ChannelService:125-204`). The player is slowed to walk speed 3 through `MovementStateService` at priority 60. An empty weave `{Elements = {}}` is stored per player in `activeWeaves` (`ChannelService:42,171-182`).

**Threads and elements.** While channeling, the player catches element buttons. Each catch sends `ElementCaught(elementName, spawnPosition)`, and the server appends the element to the weave (`ChannelService:257-343`). There are five elements: `Air`, `Fire`, `Water`, `Earth` and `Spirit`. A name is valid only when it is a key of `ElementConfig` (`ChannelService:79-91`, `ReplicatedStorage/Shared/ElementConfig:7-92`). A weave holds at most 10 threads (`MAX_THREADS_PER_WEAVE`, `ChannelService:35`, exposed read-only as `ChannelService.MaxThreadsPerWeave`). The server mirrors the thread list into the `GatheredThreadCount` and `GatheredThreadElements` attributes.

**Weave (recipe).** A weave is an entry in `WeaveConfig` with an `Elements` list. By default the order matters; `OrderMatters = false` turns it into multiset matching (`ServerScriptService/Server/Services/WeaveService:61-85`). Confirming (`ChannelRequest("Confirm")`) runs `WeaveService.IdentifyWeave`. On a match, the player becomes `WeaveReady`, the `ReadyWeave` attribute is set to the ability id, and walk speed drops to 5 (`ChannelService:441-463`). On no match, the server sends `WeaveFeedback("WeaveFailed")` and the channel collapses (`ChannelService:413-430`).

**Casting.** In `WeaveReady`, the PrimaryAction (click or tap) sends `CastRequest(aimPosition)`, and the server runs `AbilityService.CastCurrentWeave` (`ServerScriptService/Server/Services/AbilityService:973-1576`). Many weaves have several stages: Fireball, AirBlades, RockThrow, RockBarrage, Lightning and FireballBarrage put the player back to `Idle` or a custom state and expose their own `<Id>Action` remote for the follow-up click.

**Mana and burnout.** `ManaService.SpendWithBurnout(player, amount)` spends mana. When mana runs short, it zeroes mana and charges the shortfall as health damage: shortfall × `GetBurnoutHealthMultiplier`. If that damage is at least the player's current health, `TriggerBurnoutDeath` runs (`ServerScriptService/Server/Services/ManaService:793-862`). The `BurnoutRecovery` attribute then blocks every cast (`AbilityService:202-206,990`; `ChannelService:118-142`).

**Elements, tiers and alignment.** Each element has a skill tree of 10 tiers (`ReplicatedStorage/Shared/ElementSkillConfig:2-18`), replicated as `<Element>Tier` attributes. Fire tiers 5, 6 and 9 each add +10% damage to Fire weaves. Tier 10 in Air or Fire adds +30% unless the weave sets `MasteryDamageIncluded` (`ReplicatedStorage/Shared/ElementMastery:20-35`). Three "mastery weaves" need tier 10 in one element: Tornado (Air), Lightning (Fire) and Crumble (Earth), unless the player is "all-aligned" (`ServerScriptService/Server/Services/ElementSkillService:235-246`). The weave → element/tier map lives in the pure child `ElementSkillService/MasteryGates`. Without alignment to that element, they deal half damage (`ElementSkillService:249-253`). The level-100 "Advanced" trees (Vitality and Endurance) add HP and stamina only (`ReplicatedStorage/Shared/AdvancedSkillConfig:2-6`).

**Raw elements.** Weaves made of a single thread (`RawAir`, `RawWater`, `RawEarth`, `RawSpirit`, and `FireDrawing`, shown as "Raw Fire") are progressive multi-technique weaves. The recipe never changes; the element's tier gates the techniques. `RawAir` uses `AirTier × 10` as its level (`Abilities/RawAir:226-227`), and `RawSpiritProgression.GetLevel` uses `SpiritTier`. Each raw weave runs a long-lived server state machine and its own `Raw<El>Action` remote.

**Wards.** The `Ward` weave (`Air`+`Earth`) is implemented inline in `AbilityService`. Aimed at a "WardZone" doorway, it makes a timed doorway ward (`WardService.CreateDoorwayWard`); otherwise it makes a held ward through `HeldWardService.Begin` (`AbilityService:877-943`). `WardService.IsMagicPathBlocked` is the shared line-of-magic query that projectile weaves call during flight (e.g. `Abilities/Fireball:907`). `ListeningWard` ("Ward Against Listening") is a separate drain-per-second weave.

**Held and tied weaves.** Some weaves are "held" (`CombatService:167-169`). A player of level 100 or higher who owns Beyond the Pattern can "tie" a supported held weave (Compulsion, FireHold, PainInfliction, ListeningWard, GrandShield, MassHealing) through the `TiedWeaveAction` remote, which frees them to weave again (`CombatService:152-214`). `TiedWeave` and `TieWeaveAvailable` are attributes.

**Circles.** Players link into a Circle with a leader and up to 8 members (`ReplicatedStorage/Shared/CircleConfig` `Gameplay.MaxMembers`). Circle weaves are WeaveConfig entries with `CircleOnly = true` and a `MinimumCircleSize`. `WeaveService` skips them; only `CircleWeaveService` matches them, and only for a linked leader with enough members (`ServerScriptService/Server/Services/CircleIntegrationService:635-767`). Circle mana is pooled: the leader's spends are split proportionally across members (`CircleIntegrationService:863-939`). Circle-mates cannot damage each other (`CircleIntegrationService:963-967`).

**Circle rework.** `WeaveConfig` returns `CircleReworkConfig.Apply(WeaveConfig)` (`ReplicatedStorage/Shared/WeaveConfig:1962`), which rewrites entries at require time (`ReplicatedStorage/Shared/CircleReworkConfig:5-42`):

- It disables BindingThreads, SharedWard, Restoration and Earthrend (`Disabled = true`, empty recipes).
- It turns `AirPrison` into the **solo** weave "Shielding" with recipe Spirit×4.
- It sets Stilling to Spirit×5.
- It redefines CircleOfFlame, EarthBend, ConvergingFlame, EarthRampart and TimeChange.

The `WeaveConfig` file text is therefore *not* the live data. Always read it through `require`.

**Warders / Guardians.** A separate melee class. Players see "Guardian" and "Channeler"; ids in code still say "Warder" (`ReplicatedStorage/Shared/GuardianBondConfig:1`). A Warder has 6 skill branches of 10 nodes (`ReplicatedStorage/Shared/WarderSkillConfig:4-99`), bought with SkillPoints (Bond points for the WarderBond branch). The weaving system touches Warders in three places:

- the `GuardianBond` weave (Spirit×6, unordered), which offers a bond to a nearby Guardian (`Abilities/GuardianBond:8-34`);
- `WarderGate.HasLiveWeave`, which blocks melee while any weave is live, judged by state, `TiedWeave` or any attribute ending in `Active` (`ReplicatedStorage/Shared/WarderGate:10-24`);
- `WarderCombatService.BlockWeave`, the "Falling Leaf" weave-projectile block (`Services/WarderCombatService:1777`).

## 3. Inventory

Shorthand: **R** = key requires, **Rm** = remotes used (`*` = created at runtime by the module; absent from the Edit tree). From a scan of `require(...)` and `Remotes` lookups in each module's source.

### 3.1 Pipeline services (`ServerScriptService/Server/...`)

| Path | Type | Responsibility | R | Rm |
|---|---|---|---|---|
| `ServerMain` | Script | Entry point. Calls `CircleIntegrationService.Install()` **before** the services' `Start()`s (`:36-55`) | all core services | BookChatReminder |
| `Services/ChannelService` | Module | Server authority for channel start/add/confirm/cancel/quick-prepare/custom-ready | CombatService, ManaService, WeaveService, MovementStateService | ChannelRequest, ElementCaught, ThreadVisual, WeaveFeedback, CircleReworkVisual |
| `Services/WeaveService` | Module | `IdentifyWeave(elements)` matches solo recipes | WeaveConfig | — |
| `Services/AbilityService` | Module | `CastRequest` handler. Routes to per-weave modules, applies the post-cast policy | Ability modules, Mana/Combat/Channel/Ward/LearnedWeave/Affinity | CastRequest, CombatFeedback, ThreadVisual, AbilityEffects, AirPushVisual, CircleReworkVisual |
| `Services/CircleIntegrationService` | Module | Monkey-patches ChannelService/ManaService/DamageService for Circles; second `CastRequest` listener for Circle casts | CircleService, CircleWeaveService, GrandShield, AirPrison, BindingThreads, CircleAbilityRuntime | CastRequest, ThreadVisual, CircleState |
| `Services/CircleWeaveService` | Module | Registry of Circle modules; `Identify(elements, size)` | `Abilities/CircleAbilities/*` | — |
| `Services/CircleAbilityRuntime` | Module | Shared Begin/Step/Cleanup lifecycle for Circle spells | CircleAbilityConfig, Circle/Mana/Combat/Channel/Damage, Lightning, GrandShield | CircleAbilityVisual*, CircleAbilityAction*, CircleReworkVisual, ThreadVisual |
| `Services/SoloWeaveRuntime` | Module | Shared windup lifecycle for newer solo weaves (`Begin`, `Windup`, `Hit`) | WeaveConfig, Combat/Mana/Circle/Damage, GrandShield | SoloWeaveFeedback |
| `Services/AuthoredWeaveCastService` | Module | Plays a server cast animation, sets `AuthoredWeaveCast/At/Duration` | — | — |
| `Services/WeavePresentationService` | Module | Picks a gesture variant, sets `WeaveCastId/Variant/At` | WeaveGestureLibrary | — |
| `Services/WeaveCastLog` | Module | Forwards each cast to `EconomyService.Cast` | WeaveInfoConfig, WeaveConfig | — |
| `Services/HeldWardService` | Module | Held-ward lifecycle, block queries, tie adapter | HeldWardConfig, Mana, Movement, Projectile | HeldWardAim, HeldWardStop, WardHitImpact |
| `Services/WardService` | Module | Doorway/defensive wards, `IsMagicPathBlocked` | — | WardVisual |
| `Services/QuickSlotService` | Module | Quick-cast slots: validation, cooldowns, prepare-then-cast | ChannelService, AbilityService, LearnedWeaveService, WeaveInfoConfig | QuickSlotAssign/Use/Cooldown/Switch, CircleReworkVisual |
| `Services/ElementSkillService` | Module | Element tiers, alignment, mastery gates (map in the pure child `MasteryGates`) | ElementSkillConfig, AdvancedSkillConfig, DataService | ElementSkillPurchase*, ChooseElementAlignment*, ChangeElementAlignment* (RemoteFunctions) |
| `Services/LearnedWeaveService` | Module | Known-weave inventory (`LearnedWeaves` in the profile) | DataService | — |
| `Services/WeaveStatsService` | Module | Builds `ReplicatedStorage/WeaveStats` once at start: read-only `ThreadCap`, `BurnoutBaseMultiplier` and per-weave `ManaCost`/`ManaPerSecond`/`ReadyWindow`/`GateElement`/`GateTier` for the UI. When retuning Healing, PainInfliction or FireDrawing drain, update the copy in WeaveStatsService and its SelfCheck pin. Has a `SelfCheck` child | WeaveConfig, WeaveInfoConfig, BoneBreakConfig, ChannelService, ManaService, `MasteryGates`, ability `Settings` children | — |
| `ActiveAbilityBridge` | Script | Derives `ActiveAbility` from `IncomingThreads.Activation` attributes | WeaveConfig | none |
| `Services/WarderSkillService` | Module | Warder tree purchase and sync | WarderSkillConfig, WarderSwordForms, DataService | WarderSkillPurchase (RemoteFunction) |
| `Services/WarderCombatService` | Module | Warder Combat Test V2 prototype; melee hitboxes; `BlockWeave` | WarderTest, WarderSwordForms, WarderSkillConfig | WarderTestRequest, GuardianBond |
| `Services/WarderService` | Script (enabled) | V1 Warder melee router | Warder/* | WarderRequest* |
| `Services/GuardianBondService` | Module | Bond offer, accept and lifecycle | — | GuardianBond |

### 3.2 `Abilities`: solo weave modules

"Policy" is how `AbilityService` treats each module. **Legacy** = named in `LEGACY_ROUTED_ABILITIES` (`AbilityService:47-75`) and routed by an `if` chain. **Generic** = auto-loaded and routed through `AbilityServicePolicy` (`AbilityService:81-160,1287-1309`).

| Module | Lines | Responsibility | Policy | Action / visual remotes |
|---|---|---|---|---|
| `Ignite` | 417 | Fire+Fire burn over time | Legacy | IgniteVisual, IgniteCastApproved, ThreadVisual |
| `Drowning` | 546 | Water+Water drowning hold | Legacy | DrowningVisual, DrowningCastApproved, DrowningRelease (listens) |
| `PowerChannel` | 943 | 10-thread held power channel (2 of every element) | Legacy, owns mana | PowerChannelVisual/Release (listens)/Notification |
| `RockThrow` | 1240 | Single rock summon and throw; tunables in the pure child `RockThrow/Settings` | Legacy, owns mana | RockThrowAction (listens), RockThrowVisual, RockThrowFeedback |
| `RockBarrage` | 1143 | Earth×10 rock arc; tunables in the pure child `RockBarrage/Settings` | Legacy, owns mana | RockBarrageAction* (listens), RockThrowVisual/Feedback |
| `SpiritStun` | 83 | "Spirit Block" | Legacy route + generic policy | RawSpiritVisual, CircleReworkVisual |
| `FireDrawing` | 1100 | Raw Fire draw/hold | Legacy, owns lifecycle | FireDrawingAction* (listens), ThreadVisual |
| `Fireball` | 1184 | Two-stage homing fireball; tunables in the pure child `Fireball/Settings` | Legacy, owns mana | FireballAction* (listens), FireballVisual*, FireballAnimation*, FireballFeedback* |
| `AirBlades` | 1159 | Air×5 blade halo, volleys; tunables in the pure child `AirBlades/Settings` (`BladeCount`/`VolleyCount` set by AirBlades) | Legacy, owns mana | AirBladesAction* (listens) |
| `MakingFog` | 319 | Water+Water+Air fog | Legacy | ThreadVisual |
| `InsectControl` | 699 | Earth+Earth swarm | Legacy, owns mana | InsectControlAction* (created; **no server listener found**), InsectControlVisual*, InsectControlAnimation*, ScreenShake |
| `Healing` | 1187 | Held heal | Generic | HealingAction (listens), HealingVisual, HealingFeedback |
| `FoldedLight` | 441 | Invisibility toggle with drain | Generic | FoldedLightAction (listens) |
| `Lightning` | 1023 | Two-stage double bolt; Fire T10 | Generic | LightningAction (listens), LightningVisual, ThreadVisual |
| `RawSpirit` | 1265 | Dreamwalk family | Generic | RawSpiritAction (listens), RawSpiritVisual |
| `PainInfliction` | 691 | Held Air+Spirit hold → ragdoll | Generic | PainInflictionAction (listens), PainInflictionVisual |
| `RawAir` | 1724 | Lift/push/slam/deflect | Generic | RawAirAction (listens), RawAirAnimation |
| `RawWater` | 515 | Draw/conjure/encase | Generic | RawWaterAction* (listens), RawWaterVisual*, RawWaterSplash* |
| `RawEarth` | 660 | Raw Earth state machine | Generic | RawEarthAction* (listens), RawEarthVisual*, **also listens to ChannelRequest** (`:630`) |
| `AirSlash` | 77 | Curved Air projectile (SoloWeaveRuntime) | Generic | AirSlashThreadRelease |
| `Tornado` | 144 | Air×6 column; Air T10 | Generic | CircleReworkVisual |
| `NoMoreFatigue` | 37 | Stamina-immunity buff | Generic | MarksShopNotice |
| `ListeningWard` | 78 | Voice-relay ward | Generic | ListeningWardAction (listens) |
| `BoneBreak` | 189 | Two-snap curse | Generic | BoneBreakVisual |
| `Silence` | 83 | Chat/cast suppression | Generic | SilenceVisual |
| `FireballBarrage` | 849 | Three-fireball volley | Generic | FireballBarrageAction* (listens), FireballVisual, FireballAnimation, FireballFeedback |
| `Crumble` | 212 | Earth T10 rubble burst | Generic | CrumbleVisual |
| `FireHold` | 268 | Held fire lift | Generic | FireHoldAction (listens), MarksShopNotice |
| `Conflagration` | 39 | Fire ground field | Generic | — |
| `GuardianBond` | 36 | Spirit×6 bond offer | Generic | GuardianBond |
| `AirPrison` | 2 | Re-export `return require(script.Parent.CircleAbilities.AirPrison)` so solo "Shielding" routes generically | Generic | — |
| `FutureAbilityTemplate` | 90 | Documented interface / template | Loaded as generic, never routed (no WeaveConfig entry) | — |

`Ward` and `AirPush` have **no module**: they are inline functions in `AbilityService` (`castAirPush :416`, `castWard :877`).

### 3.3 `Abilities/CircleAbilities`

`CircleWeaveService` loads every module here **except** AirPrison, BindingThreads, SharedWard, Restoration and Earthrend (`Services/CircleWeaveService:52`). Each loaded module must return `{Id, Recipe, MinimumCircleSize}` (asserts at `:54-58`).

| Module | Lines | Responsibility | Registered? | Remotes |
|---|---|---|---|---|
| `AirPrison` | 543 | Now the solo "Shielding" hold (Spirit×4, contestable, 18 mana/s) | No (solo) | AirPrisonAction*, AirPrisonVisual* |
| `GrandShield` | 771 | Sustained shield dome; also `BlocksDamage` used everywhere | Yes | GrandShieldAction*, GrandShieldVisual*, MarksShopNotice |
| `BindingThreads` | 234 | Disabled by the rework | No | BindingThreadsAction* |
| `SharedWard`, `Restoration`, `Earthrend` | 23–29 | Disabled stubs on CircleAbilityRuntime | No | — |
| `EarthRampart`, `ConvergingFlame`, `MassHealing`, `TimeChange`, `CircleOfFlame`, `EarthBend` | 40–121 | CircleAbilityRuntime spells | Yes | CircleReworkVisual (+ThreadVisual / HealingVisual) |
| `Tempest` | 248 | Storm (lightning plus flood) | Yes | CircleReworkVisual, LightningVisual |
| `Stilling` | 358 | Stilling / Untying Knots (Spirit×5, min 4) | Yes | StillingContest*, StillingVisual* |

### 3.4 Shared configs and helpers (`ReplicatedStorage/Shared`)

Counts are the number of non-backup scripts that name the module (server/client).

| Module | Consumers | Role |
|---|---|---|
| `WeaveConfig` (1961 lines) | 36/21 | Recipe and tuning per weave, plus the `IncomingThreads` visual block; finished by `CircleReworkConfig.Apply` |
| `CircleReworkConfig` | WeaveConfig only | Rewrites entries at require time |
| `CircleAbilityConfig` | 1/2 | Aliases 7 Circle entries of WeaveConfig |
| `CircleConfig` | 2/3 | Circle ranges, size damage multipliers, thread visuals |
| `WeaveInfoConfig` (917) | 9/4 | Book/quickslot metadata: `DisplayName`, `Category`, `Recipe`, `QuickSlotCastMode`, `QuickSlotCooldown`, `ManaText`, ... |
| `ElementConfig` | 4/65 | Element names, icon, `ThreadColor`, `MovementMultiplier`, `Order` |
| `ElementSkillConfig`, `AdvancedSkillConfig`, `ElementMastery` | — | Tiers, alignment and damage multipliers (§2) |
| `PowerChannelConfig`, `FireballConfig`, `AirBladesConfig`, `LightningConfig`, `RockThrowConfig`, `SpiritStunConfig`, `BoneBreakConfig`, `CrumbleConfig`, `HealingFlowConfig`, `FinisherConfig`, `StillingContestConfig`, `FlightConfig`, `HeldWardConfig`, `Raw*Config`, `RawSpiritProgression` | — | Per-weave animation, sound and timing tuning (§7) |
| `FireballWeavePattern`, `AirPushWeavePattern`, `AirSlashWeavePattern`, `SoloWeavePatterns`, `WeaveGestureLibrary`, `WeaveMotionConfig`, `FireGestureConfig` | client only (except WeaveGestureLibrary: 1 server) | Presentation: thread routes and poses |
| `CombatStates`, `CombatTargets`, `VfxBroadcast`, `SpiritBlockProtection`, `ProjectileAimService` | — | Shared plumbing |
| `WarderConfig`, `WarderTest`, `WarderSkillConfig`, `WarderSwordForms`, `WarderAnimation`, `WarderGate`, `GuardianBondConfig`, `GuardianBookPages` | — | Warder / Guardian |

## 4. Cast pipeline: Fireball, end to end

Fireball has the recipe `Fire, Fire, Air` with order mattering (`WeaveConfig` entry at `:1108`; live data `Elements = {Fire, Fire, Air}`, `ManaCost = 0`, `Range = 60`).

**Step 0: boot.** `ServerMain:36` calls `CircleIntegrationService.Install()`. Install saves the originals and **replaces** `ChannelService.StartChanneling`, `CancelChanneling`, `AddElement`, `ConfirmWeave`, `PrepareQuickWeave` and `ClearWeave`, plus `ManaService.CanSpend/Spend/SpendWithBurnout` and `DamageService.DealDamage` (`CircleIntegrationService:509-529,531-979`). It also connects its own `CastRequest` listener (`:988`). Then `AbilityService.Start()` (`ServerMain:48`) loads the generic modules, calls every module's `Start()` (`AbilityService:1579-1620`; `Fireball.Start` connects `FireballAction`, `Abilities/Fireball:1162`) and connects the main `CastRequest` listener (`AbilityService:1630`).

**Step 1: start the channel (client).** `ChannelController` receives `ActionBegan(Channel)` and sends `ChannelRequest:FireServer("Start")` when `CombatState` is `Idle` or `WeaveReady` (`StarterPlayerScripts/ChannelController:580-584`).

**Step 2: start the channel (server).** In `ChannelService:696-727`, `"Start"` from `Idle` calls `ChannelService.StartChanneling` (the Circle wrapper). The wrapper refuses players who are `CircleAirPrisoned` or contributing followers (`CircleIntegrationService:531-544`), then calls the original. The original checks `CompulsionService.CanAct`, `HasAbility_weave`, the suppression attributes (`RawAirDraggedBy`, `FireHoldVictim`, `BeingStilled`, `MagicSuppressed`, `Stilled`, `SpiritMindBound`), `ChannelRecoveryService.CanStart`, burnout recovery, `FoldedLightActive`, Spirit Stun, and `CombatState == Idle`. It creates the empty weave, applies the walk-speed-3 movement state, sets `Channeling`, and broadcasts `ThreadVisual("Clear", character)` (`ChannelService:125-204`). "Start" sent from `WeaveReady` cancels the ready weave instead (`:713-718`).

**Step 3: catch threads.** For each catch, the client sends `ElementCaught:FireServer(elementName, spawnPosition)` (`ChannelController:334`). The server's `AddElement` requires `Channeling`, a valid element and fewer than 10 threads. It appends the element, updates `GatheredThreadCount`/`GatheredThreadElements`, and broadcasts `ThreadVisual("Add", character, element, index, spawnPosition)` within 180 studs (`ChannelService:257-343`; `VfxBroadcast.SMALL = 180`). There is **no catch-rate limit**: the comment at `:310-314` says it was removed on purpose, and `MINIMUM_CATCH_INTERVAL` (`:37`) is unused. A Circle leader's elements are mirrored to members (`CircleIntegrationService:611-630`).

**Step 4: confirm.** The client sends `ChannelRequest:FireServer("Confirm")` while `Channeling` (`ChannelController:587-592`). The Circle wrapper first tests `CircleWeaveService.Identify(elements, math.huge)`; Fire+Fire+Air is not a Circle recipe, so control falls to the original (`CircleIntegrationService:635-779`). The original calls `WeaveService.IdentifyWeave` and gets `"Fireball"`. It checks the mastery gates, sets walk speed 5, `ReadyWeave = "Fireball"`, `CombatState = WeaveReady`, and broadcasts `ThreadVisual("Finalize")` (`ChannelService:409-463`). `ActiveAbilityBridge` sees `ReadyWeave` and sets the `ActiveAbility` attribute; it no longer broadcasts `IncomingThreadVisual` (sends removed 2026-11-09, [client.md §8](client.md)).

**Step 5: cast request (client).** On PrimaryAction (desktop), `InputController.beginAction` calls `requestCast(getDesktopAimPosition())` unless `ActiveAbility == "RawAir"` (`StarterPlayerScripts/InputController:274-276`). `requestCast` refuses RawEarth, FireDrawing and contest states, checks `typeof(aim) == "Vector3"`, then sends `CastRequest:FireServer(aimPosition)` (`:169-181`). On mobile: tap → `ProjectileAimService.GetMobileAim` → `requestCast` (`:536-557`).

**Step 6: cast request (server).** Two listeners receive the same event:

1. The Circle router returns early unless the sender is a Circle leader with a Circle `ReadyWeave` (`CircleIntegrationService:988-1008`).
2. The `AbilityService` listener refuses during `BurnoutRecovery`, takes a per-player re-entrancy lock (`activeCastRequests`), and calls `CastCurrentWeave` inside `pcall` (`AbilityService:1630-1672`).

`CastCurrentWeave` (`:973-1576`) then:

- re-checks Compulsion, the victim and suppression attributes, `TornadoCaught`, burnout and `MagicSuppressed`, and that the state is `WeaveReady` (`:974-1008`);
- ignores Circle `ReadyWeave`s (`:1024`);
- re-identifies the recipe from the server weave (`:1026`), never from client input;
- re-checks the mastery, Crumble and Healing (`HealingFlowConfig.CanCast`) gates (`:1038-1047`);
- calls `CombatService.BeforeHeldWeave` (`:1048`);
- routes `"Fireball"` to `Fireball.Cast(context)`, with context `{Player, Character, RootPart, AimPosition, AbilityData}` (`:946-970,1130-1144`).

**Step 7: `Fireball.Cast` (server).** It refuses a second session or a dead humanoid. It spends `SETTINGS.ManaCost = 65` (`Abilities/Fireball/Settings`) with `ManaService.SpendWithBurnout` (the Circle-aware wrapper, `Abilities/Fireball:1068-1073`). It creates the session, arms a birth timeout (`:1095-1102`), sets `FireballActive = true` and `FireballReady = false` (`:1104-1105`), creates the ball through `ImportedFireballService.Create(player, ActiveAbilityEffects)` (`:171`), connects interrupt-on-damage (`HealthChanged`) and `Died` (`:1114-1138`), sets `CombatState = Idle` (`:1140`), and spawns `riseBall` (`:1145`).

**Step 8: after `Cast` returns true (AbilityService).** The water-extinguish check does not apply to Fireball (`:1319-1325`). The service runs `CompulsionService.MirrorCast`, `WeaveCastLog.Cast` (→ EconomyService), `WeavePresentationService.Cast` and `AffinityService.RecordCast` (`:1338-1341`). It learns the weave and pays `ManaService.RewardWeaveLearn` on the first cast (`:1349-1381`). The Fireball branch then calls `ChannelService.ClearWeave(player, true)` (keeps the threads visible), followed by `ThreadVisual("Clear")` (`:1482-1494`).

**Step 9: rise and ready.** `riseBall` lerps the server ball from below the torso to the ready pose over `RiseDuration = 0.7` s and plays the `FireLift` gesture (`FireGestureService`). It then sets `FireballReady = true`, broadcasts `FireballVisual("Ready", character, ball)` within 180 studs, starts the follow loop, and arms a 15 s `ReadyTimeout` (`Abilities/Fireball:607-684`).

**Step 10: throw (client).** `FireballController` listens to `ActionBegan(PrimaryAction)`. When `FireballActive` and `FireballReady` are both true (0.25 s local debounce), it sends `FireballAction:FireServer(mouse.Hit.Position, mouse.Target)`, or the controller/mobile aim (`Controllers/FireballController:26-118`). The same click also sends a `CastRequest`, which the server ignores because the state is no longer `WeaveReady` (inferred from the code paths).

**Step 11: throw (server).** `onFireballAction` checks `CompulsionService.CanAct`, that the session is `Ready`, and `typeof(aimPosition) == "Vector3"`. It runs `findTarget`, which only locks onto targets within `MaxTargetRange = 60` of the caster and within `TargetSelectionRadius + 4` of the aim (`:246-273`), mirrors the action for Compulsion, and spawns `throwFireball` (`:1039-1068`). The `FireballAction` listener also drops `BeingStilled` players (`:1196`). `throwFireball` clears `Ready`, plays the throw animation on the server, sets `FireballThrowAt`, broadcasts `FireballVisual("ThrowStart", ball, character, stamp)` and `("Launch", ball, character)`, sends `FireballFeedback("CasterThrow")` to the caster, and starts homing flight (`:721-760`).

**Step 12: flight and impact.** The ball is registered with `ProjectileService`, so it can be air-deflected (`:823`). Each step checks `WardService.IsMagicPathBlocked` (`:941`) and runs `Workspace:Blockcast` (`:971`). On a hit, `damageImpact`:

- sets non-character parts on fire;
- skips the caster and dead humanoids;
- skips friendly faction-war targets (`FactionWarService.BlocksFriendlyEffect`);
- deals `DamageService.DealDamage(src, hum, 35, "Fireball")` through the Circle wrapper (GrandShield blocking, same-Circle filter, `DamageModifierService`, `CircleExpansion.FilterDamage`);
- applies knockback and a burn of 3 × 5 ticks;
- sends `FireballFeedback("TargetImpact")` to the victim, plus screen shake (`:494-533`).

The session ends through `endSession`, which resets the attributes and broadcasts `FireballVisual("End", ball)` (`:552-601`).

**Step 13: client VFX.** `FireballVisualController` forwards `Ready`, `Launch` and `End` from `FireballVisual` to `Controllers/AbilityVisuals/FireballVisual`; it does **not** handle `ThrowStart`. `FireballWeaveShapeController` also listens on `FireballVisual` (whether it consumes `ThrowStart` is unverified). `FireballFeedbackController` handles `CasterThrow` and `TargetImpact`. The ball is a server-owned part in `Workspace.ActiveAbilityEffects`, so it replicates by itself; clients only add effects to it.

**Quick-slot variant.** `QuickSlotUse(slot, aim, individual)` → `QuickSlotService.useSlot` (`Services/QuickSlotService:667-795`) checks the tutorial gate, extra-slot ownership, `isQuickCastBlocked`, slot validity, learned state, `isQuickSlotAllowed`, exclusive abilities, `HasAbility_weave`, `MagicSuppressed`, the Lightning manual cooldown, the per-ability and global cooldowns, and `Idle`. It then calls `ChannelService.PrepareQuickWeave(player, WeaveInfoConfig[id].Recipe)`, which sets `WeaveReady` straight away (`ChannelService:468-601`), and `AbilityService.CastCurrentWeave(player, aim)` (`QuickSlotService:563,601,635`).

## 5. Networking

All remotes here are RemoteEvents unless marked (RF). `*` marks remotes created at runtime by the owning module (absent from the Edit tree; clients `WaitForChild` them). Fired-by and handled-by sites for every remote: [shared.md §2](shared.md).

### 5.1 Core pipeline

| Remote | Dir | Payload | Server validation |
|---|---|---|---|
| `ChannelRequest` | C→S | `"Start" \| "Stop" \| "Confirm"` | State machine plus suppression attributes (`ChannelService:125-465`). No rate limit. Also listened to by `Abilities/RawEarth:630`. |
| `ElementCaught` | C→S | `elementName, spawnPosition` | Must be `Channeling`, element in `ElementConfig`, under 10 threads. `spawnPosition` is only type-checked and used for visuals only (`ChannelService:326-339`). No rate limit (on purpose, `:310-314`). |
| `CastRequest` | C→S | `aimPosition` | Burnout lock plus re-entrancy lock (`AbilityService:1635-1650`). **`aimPosition` is not type-checked here**; each module validates it (§11). The Circle listener checks leader, `WeaveReady`, a registered Circle id and connection (`CircleIntegrationService:988-1012`). |
| `WeaveFeedback` | S→C | `"WeaveFailed"` | — |
| `ThreadVisual` | S→nearby (180) | `"Clear"/"Add"/"Finalize"/"Release"/"SpiritStunEnd", character, ...` | Sent via `VfxBroadcast.FireNearby` |
| `IncomingThreadVisual` | S→nearby | caster, abilityId | no sender (removed 2026-11-09); only client listener is disabled |
| `CircleReworkVisual` | S→C | `"Notice", title, text` (also Circle cast visuals) | Used for rejection notices (mastery, cooldown) |
| `QuickSlotUse` | C→S | `slot, aim, individualQuickCast` | Full checklist in §4. `individualQuickCast` is decided on the server (level ≥ 100 overrides) (`QuickSlotService:672`). |
| `QuickSlotAssign` / `QuickSlotCooldown` / `QuickSlotSwitch` | C→S / S→C | — | See [server.md §4.1](server.md) |
| `TiedWeaveAction`* | C→S | `"Tie" \| "Untie"` | Level ≥ 100 plus Beyond the Pattern; adapter session must exist (`CombatService:182-259`) |

### 5.2 Per-weave follow-up remotes (C→S unless noted)

| Remote | Owner | Payload (as read) | Validation observed |
|---|---|---|---|
| `FireballAction`* | Fireball | `aim, clickedInstance` | CanAct, session Ready, Vector3 aim, target lock ≤ 60 studs, `BeingStilled` drop. Mana paid at the first stage. No cooldown in the module; quickslot cooldown is 10 (`WeaveInfoConfig`). |
| `AirBladesAction`* | AirBlades | `aim, clickedInstance, mode("All"\|...)` | CanAct, session Ready and not barraging, Vector3 aim, Instance check (`Abilities/AirBlades:979-1015`) |
| `LightningAction` | Lightning | `"Strike"\|"Cancel", aim` | CanAct, mastery, suppression, per-strike timer, Vector3, horizontal distance ≤ `AbilityData.Range` (75), shelter check. Manual cooldown = affinity-adjusted `WeaveInfoConfig.Lightning.QuickSlotCooldown` (20) (`Abilities/Lightning:620-677,769-906,946-960`) |
| `FireballBarrageAction`* | FireballBarrage | aim, … | Module has cooldown code (not traced) |
| `RockThrowAction`, `RockBarrageAction`* | RockThrow/RockBarrage | aim, clicked | Type and range check patterns present (not traced) |
| `FireDrawingAction`* | FireDrawing | — | Not traced; also used S→C for notices (`Services/RawFireRuntime:14`) |
| `HealingAction` | Healing | `"Stop"`, … | Not traced in detail |
| `FoldedLightAction` | FoldedLight | `"Stop"` | — |
| `PainInflictionAction`, `FireHoldAction`, `ListeningWardAction`, `DrowningRelease`, `PowerChannelRelease` | held weaves | `"Stop"`/release | — |
| `RawAirAction`, `RawWaterAction`*, `RawEarthAction`*, `RawSpiritAction` | raw weaves | technique-specific | Server-owned state machines; the RawEarth header says clients "never damage or charge" |
| `HeldWardAim` / `HeldWardStop` | HeldWardService | aim / — | Stop ignored while tied (`Services/HeldWardService:281-282`) |
| `AirPrisonAction`*, `GrandShieldAction`*, `BindingThreadsAction`*, `CircleAbilityAction`*, `StillingContest`* | Circle / Shielding | — | Not traced (CircleAbilityAction: see [server.md §4.1](server.md)) |
| `GuardianBond` | GuardianBondService | — | See [server.md §4.1](server.md) |
| `WarderSkillPurchase` (RF) | WarderSkillService | `id, tier` | 0.15 s throttle; valid tree; not in tutorial; is a Warder; level and points (`Services/WarderSkillService:147-173`, `WarderSkillConfig:154-175`) |
| `ElementSkillPurchase`*, `ChooseElementAlignment`*, `ChangeElementAlignment`* (RF) | ElementSkillService | — | See [server.md §4.1](server.md) |
| `WarderTestRequest`, `WarderRequest`* | Warder combat | `action, args...` | Server validates state, cooldowns and stamina (`WarderCombatService` header `:2-3`) |

### 5.3 Server → client visual/feedback remotes

`FireballVisual`*, `FireballFeedback`*, `FireballAnimation`* (created but never fired), `IgniteVisual`, `IgniteCastApproved`, `DrowningVisual`, `DrowningCastApproved`, `PowerChannelVisual`, `PowerChannelNotification`, `RockThrowVisual`, `RockThrowFeedback`, `SpiritStunVisual/Feedback/Sound/Animation` (never fired), `HealingVisual`, `HealingFeedback`, `LightningVisual`, `RawSpiritVisual`, `PainInflictionVisual`, `RawAirAnimation`, `RawWaterVisual` (no listener), `BoneBreakVisual`, `SilenceVisual`, `CrumbleVisual`, `AirSlashThreadRelease`, `SoloWeaveFeedback`, `WardVisual`, `WardHitImpact`, `CombatFeedback`, `AbilityEffects`, `AirPushVisual`, `ScreenShake`, `CircleState` (created at runtime by CircleService).

Most transient visuals go through `VfxBroadcast.FireNearby(remote, pos, radius, ...)`, which sends only to players whose root is within the radius (SMALL 180 / MEDIUM 250 / LARGE 350), and falls back to `FireAllClients` when the position is not a Vector3 (`ReplicatedStorage/Shared/VfxBroadcast`).

## 6. State

### 6.1 Server-only tables (not replicated)

- `ChannelService.activeWeaves[player] = {Elements, LastCatchTime, IsQuickSlot?, MoveHandle}` (`ChannelService:42`).
- `AbilityService.activeCastRequests` (`:181`).
- A per-module `sessions[player]` table in almost every ability (e.g. `Fireball:97`).
- `SoloWeaveRuntime.casting`; `CombatService.tiedWeaves`; the Circle registries in `CircleAbilityRuntime` (`active`, `tiedMaintained`, `placedFlames`, `wards`, `walls`).

### 6.2 Player attributes (server-set, replicated)

A source scan found 257 attribute names set by the ability modules and core services. The most load-bearing:

- **Pipeline:** `CombatState`, `ReadyWeave`, `ActiveAbility` (ActiveAbilityBridge / HeldWard), `GatheredThreadCount`, `GatheredThreadElements`, `WeaveReadyAt`, `WeaveCastId`, `WeaveCastVariant`, `WeaveCastAt`, `AuthoredWeaveCast`/`At`/`Duration`, `SoloWeaveCasting`, `SoloCastStartedAt`, `SoloCastDuration`, `TiedWeave`, `TieWeaveAvailable`.
- **Suppression gates (read everywhere):** `MagicSuppressed`, `SpiritStunned`, `BurnoutRecovery`, `BurnoutDeath`, `Stilled`, `BeingStilled`, `SpiritMindBound`, `RawAirDraggedBy`, `FireHoldVictim` (player and character), `PainInflictionVictim`, `TornadoCaught`, `CircleAirPrisoned`, `CompulsionMemoryUntil`, `HasAbility_weave`, `HasAbility_warder`.
- **Mana:** `Mana`, `MaxMana`, `EffectiveMaxMana`, `TemporaryManaCap`, `BurnoutRecoveryEndsAt`, `PendingBurnoutRecovery`, and `CircleMana`/`CircleMaxMana` on Circle leaders.
- **Per-weave `<Id>Active` / `<Id>Ready` flags:** `FireballActive`, `FireballReady`, `FireballThrowAt`, `AirBladesActive`, `AirBladesReady`, `RockThrowActive`, `RockBarrageActive`, `LightningPrepared`, `HealingActive`, `PainInflictionActive`, `FireHoldActive`, `FoldedLightActive`, `ListeningWardActive`, `PowerChannelActive`, `RawAirActive`, `RawWaterActive`, `RawEarthActive`, `FireDrawingActive`, `GrandShieldActive`, `HeldWardActive`, `StillingActive`, `BoneBreakActive`, and others. These names matter in two places:
  1. `WeaveConfig.<Id>.IncomingThreads.Activation.Attribute` keys `ActiveAbilityBridge` (`ActiveAbilityBridge`).
  2. `WarderGate.HasLiveWeave` treats **any** attribute ending in `Active` as a live weave (`WarderGate:14-21`).
- **Progression:** `<Element>Tier` (AirTier, FireTier, ...), `ElementAlignment`, `AllElementAlignment`, `SkillPoints`, `XP`, `<WarderBranch>Tier`, `GuardianBond`, `GuardianBondRole`, `GuardianBondXP`.

### 6.3 Workspace folders

| Folder | Created by | Holds |
|---|---|---|
| `ActiveAbilityEffects` | Fireball, AirBlades, RockThrow, RockBarrage, FireDrawing, FireHold, FireballBarrage, MakingFog, Conflagration, RawFireRuntime (find-or-create, e.g. `Fireball:100-105`) | Server projectile and effect parts |
| `SoloWeaveEffects` | `SoloWeaveRuntime:17-18`, ChannelerNPCSpells | Invisible marker parts for AirSlash/Tornado/Crumble |
| `RawEarthEffects` | RawEarth | Rocks, walls, soldiers |
| `ActiveThreads` | Client `ThreadVisualController` (also referenced by server `Abilities/RawAir`) | Client thread actors |
| `ActiveCircleShields` | GrandShield | Shield domes |
| `WardZones` | Authored; read by `WardVisualController` and WardService | Doorway ward zones |

### 6.4 Persistent data (`DataService` profile)

`LearnedWeaves` (`Services/DataService:75,695-698`), `WeaveAffinity` (cast counts for cooldown reduction, `:91,710-784`; `AffinityService.GetAdjustedCooldown`), `QuickSlots` and `ExtraQuickSlots` (`:97,794-823`), `ElementSkills` (read by `ElementSkillService:239`), `AdvancedSkills`, `SkillPoints`, `WarderSkills`, `WarderForms`, `Level`. The custom-weave library from the removed custom weaving (2026-11-09) is the profile field `CustomWeaves` (`{Schema = 1, Entries = {...}}`, never in `DEFAULT_DATA`); it is left in saves and no longer read or written.

## 7. Configuration

**`WeaveConfig`**: one entry per weave id. The id doubles as the ability module name and the `ReadyWeave` value.

- Common fields: `Name`, `Elements` (the matched recipe), `Recipe` (duplicate used by Circle and info code), `OrderMatters`, `ManaCost`, `Range`/`MaxRange`, `Cooldown`, `CastTime` (SoloWeaveRuntime windup), `Damage`, `RagdollDuration`, `Duration`, `Sounds`, `Animations`, `Visuals`.
- `IncomingThreads = {Enabled, ThreadCount, Activation = {Attribute|AnyTrueAttributes|AllTrueAttributes, Equals, Priority}, radii/heights/timing}` drives ActiveAbilityBridge and the client IncomingThreadController.
- Circle fields: `CircleOnly`, `MinimumCircleSize`, `Maintained`, `ManaPerSecond`, `Kind` (Placement/Radial/Storm/Heal/Time), `ChargeTime`, `InterruptOnDamage`, `AllowBurnout`, `Disabled`.
- Mastery fields: `RequiredFireTier`, `RequiredAirTier`, `MasteryDamageIncluded`.
- After the entries, a defaults loop runs over all weaves (`WeaveConfig:1909-1917`), followed by `CircleReworkConfig.Apply` (`:1962`).
- **Where `ManaCost` takes effect depends on the route.** Generic modules without `OwnsMana` are charged `ManaCost` *after* a successful `Cast`. Legacy modules that own mana carry their own constant (Fireball `SETTINGS.ManaCost = 65` while `WeaveConfig.Fireball.ManaCost = 0`). SoloWeaveRuntime charges `ManaCost` up front in `Begin` (`SoloWeaveRuntime:96-97`).

Live recipes, read through `require`:

| Weave | Recipe |
|---|---|
| AirPush | Air×3 |
| Ward | Air+Earth |
| Ignite | Fire×2 |
| Drowning | Water×2 |
| InsectControl | Earth×2 |
| SpiritStun ("Spirit Block") | Spirit×2 |
| PainInfliction | Air+Spirit |
| AirSlash | Air×2 |
| Fireball | Fire+Fire+Air |
| FoldedLight | Air+Air+Fire |
| MakingFog | Water+Water+Air |
| ListeningWard | Air+Spirit+Spirit |
| BoneBreak | Air+Air+Spirit |
| Silence | Spirit×3 |
| AirPrison ("Shielding") | Spirit×4 |
| Conflagration | Fire×4 |
| FireballBarrage | Fire×3+Air |
| NoMoreFatigue | Earth+Earth+Fire+Water |
| RockThrow | Earth×4+Air |
| AirBlades | Air×5 |
| Healing | Spirit+Spirit+Air+Water+Water |
| Crumble | Earth+Earth+Fire+Fire+Air |
| Tornado | Air×6 |
| Lightning | Air+Air+Fire+Air+Fire+Fire |
| FireHold | Fire×4+Air×2 |
| GuardianBond | Spirit×6 (unordered) |
| PowerChannel | 2 of each element (unordered) |
| RockBarrage | Earth×10 (unordered) |
| Raw weaves | the single element |
| **Circle:** CircleOfFlame | Air+Air+Fire+Fire (min 2) |
| **Circle:** EarthBend | Earth×4 (min 3) |
| **Circle:** ConvergingFlame | Fire×3+Air×2 (min 4) |
| **Circle:** EarthRampart | Earth×5 (min 3) |
| **Circle:** TimeChange | Spirit+Air+Water+Earth+Fire, unordered (min 2) |
| **Circle:** GrandShield | Air×3+Spirit (min 3) |
| **Circle:** MassHealing | Spirit+Spirit+Water+Water+Air (min 3) |
| **Circle:** Stilling | Spirit×5 (min 4) |
| **Circle:** Tempest | Air+Air+Water+Water+Fire+Spirit (min 6) |

No two enabled entries share a recipe signature.

**Other configs:**

- **`WeaveInfoConfig`**: presentation and quick-slot metadata: `DisplayName`, `Category` (order in `CategoryOrder`), `Recipe`, `OrderMatters`, `QuickSlotCastMode` (e.g. `"FollowUp"`), `QuickSlotCooldown`, `AllowQuickSlot`/`QuickSlotAllowed`, `ManaText`, `DamageText`, `Description`, `IsCircleWeave`, `MinimumCircleSize`. **Gameplay reads it too:** quick-slot recipes come from `WeaveInfoConfig[id].Recipe` (`QuickSlotService:601`), and Lightning's manual cooldown comes from `QuickSlotCooldown` (`Lightning:773,903`). The header's claim that it is display-only (`WeaveInfoConfig:3`) is wrong. Its `Recipe` lists currently match WeaveConfig for every entry (checked by script).
- **`ElementConfig`**: `Name`, `Image`, `MovementMultiplier`, `ThreadColor` per element, plus `Order`.
- **`ElementSkillConfig`**: `PointsPerLevel 1`, `StartingPoints 1`, `MaxTier 10`, per-tier `{Cost, Description, Change, MaxHealthBonus}`. Water, Earth and Fire tiers come from `RawWaterConfig`, `RawEarthConfig` and `RawFireConfig.Tiers` (`:28-33`).
- **`ElementMastery`**: `HasElement`, `IsMastered` (tier ≥ 10), `DamageMultiplier`. `TintFire` and `ThreadColor` are no-ops (`:38-42`).
- **`CircleConfig`**: `Gameplay` (InviteRange 35, Break/ConnectionRange 200, MaxMembers 8, `DamageMultiplierBySize` 1.0 → 2.3) and `Threads` (visual).
- **`CircleReworkConfig`**: see §2.
- **`CircleAbilityConfig`**: aliases 7 WeaveConfig entries for CircleAbilityRuntime and the clients.
- **Per-weave:** `PowerChannelConfig` (animation and sound ids), `FireballConfig` (`Procedural = true`; legacy clip ids), `AirBladesConfig` (sounds, blade rotation offset), `LightningConfig` (client only), `RockThrowConfig`, `SpiritStunConfig` (client only; server SpiritStun does not read it), `BoneBreakConfig` (authored timeline), `CrumbleConfig` (animations, converge timings), `HealingFlowConfig` (`CastDelay 2` gate via `WeaveReadyAt`), `FinisherConfig` (finisher sound profile per weave; `Resolve(id)`), `StillingContestConfig` (contest payment and click race), `FlightConfig` (admin flight), `HeldWardConfig` (`ManaPerSecond 8`, `WalkSpeed 6`, radii), `RawSpiritConfig` / `RawSpiritProgression` (SpiritTier gates), `RawWaterConfig`, `RawEarthConfig` (charge, cost and construct numbers), `RawFireConfig`.
- **Presentation-only:** `*WeavePattern`, `SoloWeavePatterns`, `WeaveGestureLibrary` (`Sets[id]` = gesture variants; `Excluded[id]` skips presentation: Crumble, FireHold, RockBarrage, RockThrow), `WeaveMotionConfig`, `FireGestureConfig`.
- **Warder:** `WarderConfig` (V1 melee numbers), `WarderTest` (V2 prototype), `WarderSkillConfig` (`Order`, `Costs`, `Levels`, `Caps`, `Trees[branch].Nodes[tier] = {Name, Effect, stat bonuses such as WarderHealth/FightingStamina/Agility/StaminaRegen/Strength/Uppercut}`), `GuardianBondConfig` (bond numbers).

## 8. Conventions observed

- **Ids are names.** The WeaveConfig key = the ability module name = the `ReadyWeave` value = the WeaveInfoConfig key = the `LearnedWeaves` key = the `WeaveGestureLibrary.Sets` key.
- **Module contract** (`Abilities/FutureAbilityTemplate`): `Cast(context) -> bool`, optional `Start()`, optional `AbilityServicePolicy {OwnsMana, ClearServerWeave, ClearReadyThreads, SetIdle, LearnOnSuccess}`. Defaults: `false, true, false, true, true` (`AbilityService:131-160`).
- Multi-stage weaves keep `sessions[player]`, set `<Id>Active`/`<Id>Ready` attributes, expose one `<Id>Action` remote, re-validate the session on every action, and drop `BeingStilled` senders in the `OnServerEvent` wrapper.
- Several modules export `CompulsionAction` (Fireball, AirBlades, RockBarrage) so Compulsion can replay actions.
- Remotes are mostly find-or-create (`getOrCreateRemote`) inside the modules, not authored in the tree.
- Transient VFX use `VfxBroadcast.FireNearby` with SMALL/MEDIUM/LARGE radii. The server owns gameplay parts in Workspace folders; clients only decorate them.
- Movement slows are priority states through `MovementStateService.Apply/Remove`, not saved walk speeds (`ChannelService:57-75`).
- Manual cooldowns are weak-keyed tables using `workspace:GetServerTimeNow()`. They honour `NoCooldowns` and show a "can't grab the threads" notice through `CircleReworkVisual` (`CircleAbilities/ConvergingFlame:8-25`, `Lightning:769-906`).
- Each module starts with a one-line header comment (`-- Name: role`). Code also carries `ponytail:` and `shortcut:` comments.
- Circle behaviour is layered by **wrapping** other modules' functions at boot (`CircleIntegrationService.Install`), not built into ChannelService or ManaService.

## 9. Legacy and dead code

- **Two routers in `AbilityService`.** The legacy `if/elseif` chain for 13 ids (`:47-75,1069-1285`) has hard-coded post-cast branches (`:1445-1536`). The generic, policy-driven path (`:1286-1311,1386-1443`) is the one to use for new work. `abilityOwnsMana` (`:1050-1062`) is computed and never read.
- **`Abilities/FutureAbilityTemplate`** is required and `Start()`ed as a generic module even though no weave uses it.
- **`Abilities/AirPrison`** is a 2-line re-export, kept so the generic loader finds a module named after the WeaveConfig id. The real module is under `CircleAbilities` and is now a solo weave.
- **Disabled Circle spells:** `BindingThreads`, `SharedWard`, `Restoration`, `Earthrend` (`CircleReworkConfig:6-8`; skipped by `CircleWeaveService:52`). `CircleIntegrationService:735,797-800` still maps the ListeningWard recipe to BindingThreads for linked players. Because BindingThreads now has an empty recipe, that remap only fires through `PrepareQuickWeave`. **Possible bug:** a linked quick-cast of ListeningWard would become a disabled weave (not verified at runtime).
- **`WeaveConfig.WardingLine`** is defined (`:1888`) and then set to `nil` (`:1940`). `WeaveGestureLibrary.Sets` still has entries for `WardingLine` and `UntyingKnots`, plus several Raw Spirit techniques.
- **`ChannelService`:** `MINIMUM_CATCH_INTERVAL` (`:37`), `storeOriginalWalkSpeed` (no-op, `:58`) and `PreviousWalkSpeed` fields are unused.
- **`SoloWeaveRuntime`:** the `cooldowns` table and the local `cd` in `Begin` are unused (`:21,95`).
- **`FireballAnimation` remote** is created but never fired. `FireballConfig.Animation` clip ids are superseded (`FireballConfig.Procedural = true`); the throw clip id is hard-coded in `Fireball:705`.
- **`ElementMastery.TintFire` and `ThreadColor`** are no-op stubs.
- **`InsectControlAction`** is created and the client waits for it, but no server listener was found.
- **Backups:** `ServerStorage/MCPBackups` (contains copies of ability scripts such as `AlliesAll_20261106_Before.Lightning`), `ReadabilityBackup_*`, `DisabledFlood`. They do not run, but search tools return hits inside them.
- **Warder V1 vs V2:** `Services/WarderService` (Script, V1 melee via `WarderRequest`) and `Services/WarderCombatService` (V2 "Combat Test" prototype, entered only via `AdminService.Execute`, `:2-4`) both exist.
- **Two server entry points:** `ServerMain` (legacy, boots this pipeline) and `ServerBootstrap` (newer); see [server.md §3](server.md).
- Custom weaving: removed 2026-11-09 (server folder, remote, Shared book and Loom modules). Backup in `ServerStorage/MCPBackups/RemoveCustomWeaving_20261109_Before`; the saved library field stays in saves, unread. Saved quick slots holding a `Custom:` id are cleared to empty on load.

## 10. How to change this area

### 10.1 Add a new solo weave (generic path, recommended)

1. **`ReplicatedStorage/Shared/WeaveConfig`**: add `WeaveConfig.<Id> = {Name, Elements = {...}, OrderMatters, ManaCost, Range, Cooldown?, CastTime?, IncomingThreads = {Enabled, ThreadCount, Activation = {Attribute = "<Id>Active", Equals = true, Priority}}, Sounds?}` before the `return` on `:1962`. Do not reuse a live recipe: `WeaveService` returns the first `pairs()` match, so a duplicate resolves nondeterministically. Check that `CircleReworkConfig.Apply` does not overwrite the id.
2. **`ServerScriptService/Server/Abilities/<Id>`** (ModuleScript, same name): implement `Cast(context)` and an optional `Start()`. Set `AbilityServicePolicy` when the module owns mana, keeps the weave, or manages state (copy from `FutureAbilityTemplate`). It is picked up automatically (`AbilityService:81-128`). For a windup weave, use `SoloWeaveRuntime.Begin` / `Windup` / `Hit` with `R.Policy` (`SoloWeaveRuntime:16`). Validate `context.AimPosition` yourself (type, finite, range), because `CastRequest` does not.
3. **Follow-up input** (if multi-stage): create `<Id>Action` with find-or-create in the module (or author it in `ReplicatedStorage/Remotes`), wrap `OnServerEvent` with the `BeingStilled` drop, and keep `sessions[player]` and `<Id>Active`/`<Id>Ready` attributes. Add a client controller under `StarterPlayerScripts/Controllers` that listens to `ClientEvents.ActionBegan` (pattern: `Controllers/FireballController`).
4. **Visuals**: a client controller listening to the module's visual remote, `ThreadVisual` / `IncomingThreads` through the WeaveConfig block, and optionally a pattern in `SoloWeavePatterns` or `*WeavePattern`. See [client.md §9](client.md).
5. **`ReplicatedStorage/Shared/WeaveInfoConfig`**: add `DisplayName`, `Category`, `Recipe` (**must equal** `Elements`, because quick slots cast this list), `QuickSlotCastMode`, `QuickSlotCooldown`, `ManaText`, `DamageText`, `Description`. Without it the book, quick slots and `WeaveCastLog` names fall back or fail.
6. **`ReplicatedStorage/Shared/WeaveGestureLibrary`**: add `Sets.<Id>` for cast gestures, or `Excluded.<Id>`. `WeavePresentationService` does nothing without one (`:9`).
7. **If held:** add the id to `heldWeaveIds` in `Services/CombatService:167-169`. If it should be tieable, add a `tieAdapters` entry and implement `TieSession` / `DetachTie` / `StopTie` (`:158-166`).
8. **If it is a projectile:** register it with `ProjectileService` and check `WardService.IsMagicPathBlocked`, `HeldWardService.BlockPath`, `GrandShield.BlocksDamage` and `FactionWarService.BlocksFriendlyEffect` (copy from Fireball). Deal damage only through `DamageService.DealDamage(src, hum, amount, "<Id>")` so the Circle and modifier wrappers apply.
9. **If it should be mastery-gated:** add the weave to `Services/ElementSkillService/MasteryGates` (the gate, also published in `ReplicatedStorage/WeaveStats`) and to the damage-penalty map at `ElementSkillService:250` *and* the notice strings repeated in `ChannelService:431-439`, `:537-545` and `AbilityService:1038-1046`.
10. **Optional:** `FinisherConfig.Resolve` (Fire weaves automatically get "Charred"), AffinityService cooldown behaviour (automatic through `RecordCast`), a `VillageTeachingConfig` / `FirstJourneyService` lesson (not traced).
11. **Warder interaction:** if the weave's live attribute ends in `Active`, `WarderGate` handles it automatically.
12. **Docs:** add the module to §3.2, its recipe to §7, its remotes to [shared.md §2.5](shared.md), and its client scripts to [client.md](client.md).

### 10.2 Add a Circle weave

1. Add the WeaveConfig entry with `CircleOnly = true`, `MinimumCircleSize`, `Recipe = Elements`, `Kind`, `ChargeTime`, `Maintained`, `ManaCost` / `ManaPerSecond`, `Sounds`, `Animations` and `Visuals`. If the id is defined inside `CircleReworkConfig.Apply`, add it there instead.
2. Add `Abilities/CircleAbilities/<Id>` returning `{Id, Recipe, MinimumCircleSize, OrderMatters}`, plus `Cast(c)` (usually `CircleAbilityRuntime.Cast(Id, c)`), `Begin(s, R)`, `Step(s, dt, age, R)` and `Cleanup` (pattern: `ConvergingFlame:6-53`). `CircleWeaveService` asserts on these fields at load.
3. Add the alias to `ReplicatedStorage/Shared/CircleAbilityConfig` if CircleAbilityRuntime or the clients need it.
4. Add a `WeaveInfoConfig` entry with `IsCircleWeave = true` and `MinimumCircleSize`.
5. Add client handling in `CircleAbilityController` / `CircleReworkController` (not traced).

### 10.3 Tune a weave

- Numbers in `WeaveConfig` reach generic and SoloWeaveRuntime weaves directly. **Legacy modules carry hard-coded `SETTINGS`:** Fireball's mana, damage, speed and range live in the pure child `Abilities/Fireball/Settings`, not in WeaveConfig (RockBarrage, RockThrow and AirBlades have the same `Settings` child; AirBlades sets `BladeCount`/`VolleyCount` itself). InsectControl, FireballBarrage and NoMoreFatigue read their cost from `WeaveConfig.<Id>.ManaCost`. Check the module's SETTINGS first.
- `Services/WeaveStatsService` publishes the fixed costs, held-weave drain (`ManaPerSecond`), ready windows and gates to `ReplicatedStorage/WeaveStats` for the UI; its mana-route list (`WEAVE_CONFIG_COST`, `OWN`) must change when a weave changes how it pays mana. Run its `SelfCheck` after retuning (it pins Fireball 65/15, RockBarrage 400/20, RockThrow 12, AirBlades 14, InsectControl 70, FireballBarrage 90, NoMoreFatigue 150). When retuning Healing, PainInfliction or FireDrawing drain, update the copy in WeaveStatsService and its SelfCheck pin.
- Change the display text in `WeaveInfoConfig` (`ManaText`, `DamageText`) to match.
- Change the quick-slot cooldown in `WeaveInfoConfig.QuickSlotCooldown`; that number also sets Lightning's manual cooldown.
- Check `CircleReworkConfig` for overrides of the same field.

### 10.4 Add an element

A large change: every place below hard-codes the five elements.

1. `ElementConfig`: the new entry plus `Order`. Clients build their buttons from it (`ChannelController`); the server validates names against it (`ChannelService:79-91`).
2. `ElementSkillConfig.Elements` and its tree (`:2-18`).
3. `ElementMastery` (Air/Fire special cases, `:23-33`), `ElementSkillService` alignment and mastery maps.
4. Client channel UI (desktop floating and mobile fixed buttons, F/G/V/R/C shortcuts per the `ChannelController` header, a new `Keybinds` action) and `ThreadVisualController` colours.
5. `DataService` defaults (`ElementSkills`) and any `<Element>Tier` replication.
6. A raw weave for the element: a WeaveConfig entry and an `Abilities/Raw<El>` module.
7. `PowerChannel` ("two of every element"), `TimeChange` (one of each, unordered), and any UI that lists all elements (BookController, ScrapbookPanel; not traced).

### 10.5 Add a Warder skill node

1. Edit `WarderSkillConfig.Trees[branch].Nodes`. Each branch has exactly 10 nodes, and `Costs`/`Levels` have 10 entries, so an 11th node also needs `Costs`, `Levels` and `Spent` reviewed (`:6-10,100`). Stat bonuses go in the node table and are summed by `W.Bonus(p, stat)` (`:119-127`). Mark unbuilt mechanics `Training = true` (`:3`).
2. Gate the mechanic with `WarderSkills.Has(player, branch, tier)` on both the server (`WarderCombatService`, e.g. `:150-1678`) and the client (`WarderClient` / `WarderTestController`; not traced).
3. Purchase, persistence and replication are automatic: `WarderSkillService.Purchase` / `Sync` writes `<Branch>Tier` attributes. Book UI text comes from `Name`/`Effect` (BookController / ScrapbookPanel read WarderSkillConfig).
4. Stats that change max health or stamina must flow through `combatHealthMax` / `fightingStaminaMax` (`WarderCombatService:1007-1013`) and `applySkills` (`:1018-1029`).

## 11. Risks and gotchas

1. **`CastRequest`'s `aimPosition` is untrusted and unvalidated** at `AbilityService:1632` and `createAbilityContext`. Every module must check type, NaN, magnitude and range. A crude scan suggests several modules never type-check `AimPosition` (e.g. `EarthBend`, plus modules whose WeaveConfig has a `Range` but no visible check). Audit each module.
2. **No rate limit on `ElementCaught` or `ChannelRequest`.** The 10-thread cap bounds each weave, but start/cancel spam is unthrottled and each call broadcasts `ThreadVisual` to nearby players.
3. **Order of monkey-patching.** `CircleIntegrationService.Install()` must run before any service caches `ChannelService.X` or `ManaService.X` in a local. Code that captures `local Spend = ManaService.Spend` before Install bypasses Circle mana and damage rules. Keep calls as `Module.Fn(...)`.
4. **Two `CastRequest` listeners.** Correctness depends on the Circle listener firing first and leaving `WeaveReady` (`CircleIntegrationService:981-987`), and on `AbilityService` returning early on a Circle `ReadyWeave` (`:1024`). Roblox does not document listener firing order; the code relies on connection order plus the state change, and the Circle handler "may yield before leaving WeaveReady", which is why `:1024` exists.
5. **WeaveConfig text ≠ live data.** `CircleReworkConfig.Apply` rewrites entries. Comments and file text disagree with live values (AirPrison is Spirit×4 "Shielding"; the `Ward` comment says "Spirit + Earth" while the recipe is Air+Earth, `WeaveConfig:996`). Read values through `require`.
6. **Mana is owned in three different ways:** legacy hard-coded, AbilityService post-cast, and SoloWeaveRuntime up-front. Setting `ManaCost` in WeaveConfig on a legacy weave does nothing. A generic module that also spends mana itself without `OwnsMana = true` gets charged twice.
7. **Recipe matching uses `pairs()` order** (`WeaveService:65`). Two entries with the same recipe resolve nondeterministically (none today).
8. **`WeaveInfoConfig.Recipe` is gameplay data.** Quick slots cast it. If it drifts from `WeaveConfig.Elements`, the quick slot prepares the wrong weave or fails.
9. **`WarderGate` relies on naming.** Any attribute ending in `Active` (even a non-weave one, such as `StoneSoldierActive`) blocks Warder melee; a new weave that marks itself live under a different name is not seen.
10. **Fireball rise/throw yields** inside `task.spawn`. Sessions use token checks (good), but `throwFireball` loads an animation on the server every throw (`:738-744`).
11. **The mastery-gate notice text is duplicated** in three files (§10.1 step 9).
12. **Grep noise.** `ServerStorage` backups contain old copies of ability scripts (§9).

## 12. Open questions

- Does any client listener handle `FireballVisual("ThrowStart")`? Possibly `FireballWeaveShapeController`; not verified.
- Is `InsectControlAction` really unused on the server, or connected some other way? Does InsectControl select targets wholly server-side?
- Is the linked ListeningWard → disabled BindingThreads quick-cast remap (`CircleIntegrationService:797-800`) a live bug?
- What is the full validation in `RockThrowAction`, `RockBarrageAction`, `FireballBarrageAction`, `HealingAction`, `RawAirAction`, `RawWaterAction`, `RawEarthAction`, `PainInflictionAction`, `GrandShieldAction`, `AirPrisonAction` and `GuardianBond`? Only Fireball, AirBlades and Lightning were fully traced.
- Is `WarderService` (V1) still in use, given that `WarderCombatService` (V2) exists and is admin-only?
- Do clients build their channel element buttons from `ElementConfig.Order`, as the comment at `ElementConfig:79-84` says?
