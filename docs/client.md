# Client architecture

Covers everything that runs on the player's machine after the entry flow. Built from the live Studio place (Edit DataModel), read-only, on 2026-11-08. Line numbers are from the live source at that date and drift as code changes. Abbreviations: **SPS** = `StarterPlayer/StarterPlayerScripts`, **SCS** = `StarterPlayer/StarterCharacterScripts`, **RS** = `ReplicatedStorage`, **CE** = `ReplicatedStorage/ClientEvents` (BindableEvents). Citations use `Service/Path/Script:line`.

Related docs: [architecture.md](architecture.md) (whole-game view), [shared.md](shared.md) (remote catalogue and shared modules), [abilities.md](abilities.md) (cast pipeline), [workflow.md](workflow.md) (how to change things).

## 1. Scope

- `StarterPlayer/StarterPlayerScripts`: 51 top-level scripts, plus the `Controllers` folder (139 scripts, including the `AbilityVisuals` modules and `BookController.ScrapbookPanel`).
- `StarterPlayer/StarterCharacterScripts`: `Health`, `Shiftlock`, `Init`, `Animate`.
- `StarterGui`: 21 ScreenGuis and the one script inside them (`TopHUD.TopHUDController`), plus the ScreenGuis that client scripts build at runtime.
- The shared modules in `RS/Shared` only as far as they explain client behaviour.

Out of scope: the ReplicatedFirst entry flow (`PlayEntryClient`, `FirstJourneyClient`), server code, ability server logic, and the full remote catalogue (see [shared.md](shared.md)). Remotes appear here only by name.

Headline facts:

- **No loader.** Every client controller is its own LocalScript (`RunContext = Legacy`) and starts independently. Nothing orchestrates their order.
- **Player attributes are the state bus.** The server sets `CombatState`, `ReadyWeave`, `*Active`, `PvPMode`, `Setting_*` and more. Clients set UI flags such as `BookOpen`, `SettingsOpen`, `EconomyOpen`, `MapOpen`, `PlayScreenActive`. Almost every controller watches or polls these.
- **Two local BindableEvents carry input.** `CE/ActionBegan` and `CE/ActionEnded` carry abstract input actions from `SPS/InputController` to the per-ability controllers.
- **Every client draws every caster's VFX locally**, triggered by remote broadcasts (`ThreadVisual`, `WardVisual`, `<Ability>Visual`) or by per-frame polling of other players' attributes.

Project settings that matter (verified):

- `Players.CharacterAutoLoads = false`. Spawning is driven by the server / entry flow, not by Roblox.
- `StarterGui.ResetPlayerGuiOnSpawn = true`, but nearly every ScreenGui sets `ResetOnSpawn = false` (see §3).
- `StarterPlayer.EnableMouseLockOption = false`. The game uses its own `Shiftlock`.
- `CameraMaxZoomDistance = 60`. Touch and computer camera modes are both `UserChoice`.
- No custom `PlayerModule`. The default one is used; `AdminFlightController` requires it.

## 2. Inventory

Every script is a `LocalScript` with `RunContext = Legacy` unless noted. "L" is the line count. The "Remotes" column lists names reached with `WaitForChild("…")`; scripts that use dot access (`RS.Remotes.X`) may use more, so the column is a floor, not a full list. Disabled scripts are listed in §2.10.

### 2.1 Input and keybinds

| Path | L | Responsibility | Key requires | Remotes / events |
|---|---|---|---|---|
| SPS/InputController | 895 | Central PC/gamepad/touch action map. Fires ActionBegan/ActionEnded, primary-action casting, mobile Channel/Confirm/Sprint buttons, gamepad router, floating-word navigation | InputActions, TouchUI, Keybinds, UiManager, SprintConfig, ControllerAim, MobileTapGate, ProjectileAimService, ControllerCursor | CastRequest, HealingAction, FoldedLightAction, SprintRequest, ChannelRequest, ListeningWardAction, FireHoldAction, `<Id>Action` (multi-throw); CE: ActionBegan, ActionEnded, ControllerElement, ControllerQuickSlot |
| SPS/ChannelInputMode | 8 | Tells the server whether the player is on touch input | – | ChannelInputMode |
| SPS/ControllerCursorController | 89 | Gamepad virtual cursor toggle | ControllerCursor, Keybinds | CombatStateRequest |
| SPS/KeybindListController | 429 | On-screen controls list (`KeybindList` gui), touch "tie weave" button, `TiedWeaveWords` gui | ControllerAim, TouchUI, WarderGate, WarderSkillConfig, Keybinds, KeyLabel | TiedWeaveAction |
| SPS/CameraController | 27 | Forwards TogglePvP from ActionBegan to the server (no camera code left) | InputActions | CombatStateRequest; CE: ActionBegan |
| SPS/Controllers/SprintController | 178 | Sprint key (CAS `SprintAction`), toggle-vs-hold setting | SprintConfig, Keybinds | SprintRequest |
| SPS/Controllers/PowerChannelInputController | 124 | Power Channel release input | – | PowerChannelRelease |
| SPS/Controllers/BindingThreadsController | 21 | Binding release on primary action | – | BindingThreadsAction; CE: ActionBegan |
| SPS/Controllers/VoluntaryResetController | 26 | Replaces the Roblox reset button callback | – | VoluntaryCharacterReset |
| SPS/WarderClient | 266 | Warder/Guardian melee input and prediction (M1, block, dodge) | WarderConfig, WarderGate, Keybinds | WarderRequest, WarderAnimation |

### 2.2 Casting and ability client logic

| Path | L | Responsibility | Key requires | Remotes |
|---|---|---|---|---|
| SPS/ChannelController | 665 | Channelling minigame: falling element buttons (desktop floating, mobile `MobileElements`), weave display, element keys | InputActions, CombatStates, ElementConfig, Keybinds | ChannelRequest, ElementCaught; CE: ActionBegan/Ended, ChannelFeedback, ControllerElement |
| SPS/Controllers/QuickSlotController | 354 | Quickcast slots on `QuickSlotHUD`, cooldown display | WeaveInfoConfig, ControllerAim, Keybinds | QuickSlotUse, QuickSlotCooldown; CE: ControllerQuickSlot |
| SPS/HeldWardController | 77 | Held-ward aiming UI (`HeldWardHUD`, `WardFloatingWords`) | ProjectileAimService, WardImpactVisual | HeldWardAim, HeldWardStop, WardHitImpact |
| SPS/Controllers/RockThrowController | 133 | Rock throw aim and fire | ControllerAim, ProjectileAimService, MobileTapGate | RockThrowAction |
| SPS/Controllers/RockBarrageController | 137 | Rock barrage aim and fire | same | RockBarrageAction |
| SPS/Controllers/FireballController | 133 | Fireball aim and fire | same | FireballAction |
| SPS/Controllers/FireballBarrageController | 133 | Fireball barrage | same | FireballBarrageAction |
| SPS/Controllers/AirBladesController | 183 | Air Blades: click for one volley, hold for all | same | AirBladesAction |
| SPS/Controllers/InsectControlController | 167 | Insect control targeting | MobileTargetSelection, ProjectileAimService | InsectControlAction |
| SPS/Controllers/HealingController | 140 | Healing hold and release | – | HealingAction |
| SPS/Controllers/LightningController | 238 | Lightning input | – | LightningAction |
| SPS/Controllers/FireDrawingController | 300 | Raw Fire drawing input, `RawFireWords` gui, charge meter | RawFireConfig, RawElementOptions, ControllerCursor, Keybinds | FireDrawingAction, CastRequest |
| SPS/Controllers/FireHoldController | 116 | Fire Hold input | – | FireHoldAction |
| SPS/Controllers/RawAirController | 1614 | Raw Air object hold, push and slam: aim, visuals, animation | RawAirHoldVisual, VisibilityRules, MobileTargetSelection | RawAirAction, RawAirAnimation |
| SPS/Controllers/RawWaterController | 205 | Raw Water input, `RawWaterWords` gui | RawWaterConfig, RawElementOptions, ControllerCursor | RawWaterAction |
| SPS/Controllers/RawEarthController | 284 | Raw Earth input, `RawEarthWords` gui | RawEarthConfig, RawElementOptions, CirclePlacementThreads | RawEarthAction |
| SPS/Controllers/RawSpiritController | 1418 | Dreamwalking: dream camera, `RawSpiritGui`, spirit sense | CombatTargets, LocalVisibilityMask, VisibilityRules | RawSpiritAction, RawSpiritVisual |
| SPS/Controllers/PainInflictionController | 458 | Pain infliction input, shake, animation | CinematicFeedback | PainInflictionAction, PainInflictionVisual |
| SPS/Controllers/SpiritTechniqueController | 214 | Spirit techniques, `SpiritFloatingWords`, its own `TiedWeaveWords` | SpiritIllusionVisual, CombatTargets, ProjectileAimService | SpiritTechnique |
| SPS/Controllers/CompulsionController | 76 | Compulsion | VisibilityRules, CombatTargets | CompulsionVisual |
| SPS/Controllers/AirPrisonController | 653 | Air Prison / Shielding input and shell visuals | ShieldingShellVisual, CircleConfig | AirPrisonAction, AirPrisonVisual |
| SPS/Controllers/GrandShieldController | 94 | Grand Shield input and visuals | GrandShieldVisualModel, WardImpactVisual | GrandShieldAction, GrandShieldVisual |
| SPS/Controllers/SoloWeaveController | 206 | Solo weave presentation, `WardingLineAlerts` | WeaveConfig, SoloWeavePatterns | SoloWeaveEffects, SoloWeaveFeedback |
| SPS/Controllers/StillingController | 233 | Stilling contest UI | StillingContestConfig | StillingContest, StillingVisual |
| SPS/Controllers/ShieldingContestController | 112 | Shielding contest UI | StillingContestConfig | ShieldingContest |
| SPS/Controllers/CircleController | 407 | Circle linking UI and invites (`CircleControllerInvite`) | WarderSkillConfig, MobileTapGate, ControllerCursor | CircleAction, CircleState |
| SPS/Controllers/CircleAbilityController | 295 | Circle ability visuals and input | TempestFade, TempestHelixVisual, CircleAbilityConfig | CircleAbilityVisual, CircleAbilityAction |
| SPS/Controllers/CircleReworkController | 142 | Circle rework visuals | CircleFlowMotion, CirclePlacementThreads, CharacterBurnVisual | CircleReworkVisual, CircleAbilityVisual |
| SPS/Controllers/WovenFeedbackController | 488 | Target selection, circle member panel in `CircleUIPosition`, `WovenFeedback` gui | HealingTargeting, CombatTargets, MobileTargetSelection | ThreadVisual, EconomyChanged |
| SPS/Controllers/QuickProtectController | 23 | Quick-protect effect | – | QuickProtectEffect |
| SPS/Controllers/WaygateController | 316 | Waygate travel UI and scene | WaygateConfig, WaygateOpeningPose | WaygateEvent |

### 2.3 VFX (thread and weave rendering)

| Path | L | Responsibility | Key requires | Remotes |
|---|---|---|---|---|
| SPS/ThreadVisualController | 3497 | Channel and ready threads for every caster (Add/Finalize/Release/Clear) in `Workspace.ActiveThreads` | ThreadStartFade, WeaveMotionConfig, ElementConfig, WeaveVisibility, ReadyThreadPaths, CustomWeavePreview, ChannelReadyHandoff | ThreadVisual; CE: ThreadHandChosen, ThreadVisualLocal |
| SPS/WardVisualController | 1123 | Ward meshes and threads, hit impacts | ElementConfig, WeaveVisibility | WardVisual |
| SPS/AirPushWeaveShapeController | 137 | Air Push shape threads (attribute-driven) | AirPushBodyPath, CasterActors, WeaveVisualOpacity, WeaveTrailTaper | – |
| SPS/FireballWeaveShapeController | 202 | Fireball shape threads | CasterActors, FireballWeavePattern | FireballVisual (listens) |
| SPS/HealingCasterShapeController | 158 | Healing caster shape | HealingFlowConfig, HealingBezier, CasterActors | – |
| SPS/SoloWeaveShapeController | 136 | Solo weave shape | SoloWeavePatterns, GrandShieldCasterThreads | – |
| SPS/RawWaterSourceFlowController | 123 | Raw Water source flow threads | CasterActors | – |
| SPS/RockThrowRiseThreads | 48 | Rock rise threads | CasterActors | – |
| SPS/LightningCastThreads | 61 | Lightning cast threads | WeaveConfig | LightningVisual |
| SPS/CrumbleCastThreads | 141 | Crumble cast threads | CrumbleConfig | CrumbleVisual |
| SPS/FireHoldVisualController | 243 | Fire Hold visuals | CharacterBurnVisual, CasterActors | FireHoldSessions (folder, unverified) |
| SPS/TornadoFormationController | 77 | Tornado formation | CasterActors | – |
| SPS/AuthoredHandStreamController | 70 | Authored hand streams | CasterActors | – |
| SPS/AirBladesFormationController | 146 | Air Blades formation (server owns the blades) | WeaveTrailTaper | – |
| SPS/Controllers/ReadyHandBeamController | 1038 | Ready hand beams | CircleBeamSource, WeaveRingLayout, WeaveGestureLibrary, CasterActors | – |
| SPS/Controllers/RawFireThreadController | 135 | Pooled Raw Fire thread paths | RawFireConfig, RawFireOutburstVisual | – |
| SPS/Controllers/RawFireEffectController | 28 | Primes replicated Raw Fire emitters | – | – |
| SPS/Controllers/ConflagrationReadyController | 57 | Conflagration ready threads | CasterActors | – |
| SPS/Controllers/RawAirReadyThreads | 92 | Two one-shot Air trails per ready session | RawAirReadyPath, CasterActors | – |
| SPS/Controllers/RawAirAlignmentVisual | 127 | Air alignment meter | RawAirHoldVisual | RawAirAction |
| SPS/Controllers/RawWaterVisualController | 255 | Raw Water visuals | WaterSplashVisual, RawWaterAuthoredVisual | RawWaterSplash |
| SPS/Controllers/RawWaterSourceController | 94 | Raw Water source markers | IncrementalDescendantScan | – |
| SPS/Controllers/RawEarthVisualController | 483 | Raw Earth visuals | RawEarthWallVisual, BoneBreakConfig | RawEarthVisual |
| SPS/Controllers/BoneBreakVisualController | 135 | Bone break visuals | BoneBreakConfig | BoneBreakVisual |
| SPS/Controllers/SilenceVisualController | 112 | Silence visuals | BoneBreakConfig | SilenceVisual |
| SPS/Controllers/ListeningWardVisualController | 40 | Listening ward visuals | WeaveVisibility | – |
| SPS/Controllers/FoldedLightVisualController | 102 | Folded Light visibility | LocalVisibilityMask, VisibilityRules | – |
| SPS/Controllers/FireballImpactController | 54 | Fireball impact | ElementMastery | FireballImpactVisual |
| SPS/Controllers/FireballBarrageVisual | 96 | Fireball barrage visuals | ElementMastery | – |
| SPS/Controllers/CircleVisualController | 132 | Circle contribution beams | ElementMastery | – |
| SPS/Controllers/CircleEnvironmentController | 135 | Circle aura and cosmetic reactions | CircleConfig | CircleEnvironment |
| SPS/Controllers/TempestReadyController | 46 | Tempest charge countdown (BillboardGui) | TempestFade, TempestHelixVisual | – |
| SPS/Controllers/TempestHandTrails | 104 | Tempest hand trails | TempestMotion | – |
| SPS/Controllers/TempestProtectionController | 40 | Tempest protection visuals | – | – |
| SPS/Controllers/ShieldingCasterController | 67 | Shielding left-hand effect | CasterActors | – |
| SPS/Controllers/FullshieldAlignmentController | 25 | Aligns the shield to the locally rendered character | – | – |
| SPS/Controllers/SpiritIllusionVisual | 261 | **ModuleScript**: spirit illusion | WeaveConfig | – |
| SPS/Controllers/ThreadAppearanceController | 27 | Thread appearance registry | IncrementalDescendantScan | – |
| SPS/Controllers/ConcealedOwnedEffects | 22 | Registers owned effects with WeaveVisibility | WeaveVisibility | – |
| SPS/Controllers/RawSpiritDreamVisualController | 29 | Dream body visibility | WeaveVisibility | – |
| SPS/Controllers/DashAfterimageController | 76 | Dash afterimages for every Guardian | – | – |
| SPS/Controllers/BurnoutDeathVisualController | 347 | Burnout death visuals | – | BurnoutDeathVisual |
| Bridges in SPS/Controllers: AirPushVisualController (22), IgniteVisualController (64), DrowningVisualController (47), PowerChannelVisualController (28), RockThrowVisualController (104), FireballVisualController (31), InsectControlVisualController (29), HealingVisualController (37), LightningVisualController (437), SpiritStunVisualController (362) | – | Remote → AbilityVisuals module router | AbilityVisuals.* | `<Ability>Visual` |
| SPS/Controllers/AbilityVisuals/* (**ModuleScripts**): AirPushVisual 591, IgniteVisual 632, DrowningVisual 545, PowerChannelVisual 554, PowerChannelCasterVisual 134, RockThrowVisual 890, FireballVisual 504, InsectControlVisual 350, HealingVisual 136, PowerChannelImportedVisual 108 | – | Per-ability effect implementations | ElementConfig, Assets.ThreadActors | – |

### 2.4 Feedback, audio, shake, animation

| Path | L | Responsibility | Remotes |
|---|---|---|---|
| SPS/ChannelFeedbackController | 678 | Channelling screen feedback (`ChannelFeedbackGui`) | CE: ChannelFeedback |
| SPS/CombatFeedbackController | 302 | Hit feedback | CombatFeedback |
| SPS/WeaveFailureFeedbackController | 218 | Weave failure feedback | WeaveFeedback |
| SPS/AbilitySoundController | 502 | Ability sounds | CE: ThreadHandChosen |
| SPS/Controllers/ScreenShakeController | 506 | Global screen shake (BindToRenderStep around Camera priority) | ScreenShake |
| SPS/Controllers/{Drowning,RockThrow,Fireball,Healing,FireDrawing,SpiritStun,PowerChannel}FeedbackController | 55–421 | Per-ability screen feedback guis | `<Ability>Feedback`, `<Ability>Visual` |
| SPS/Controllers/{RockThrow,SpiritStun,PowerChannel}SoundController | 91–164 | Per-ability sounds | as named |
| SPS/Controllers/PowerChannelShakeController | 306 | Power Channel shake | – |
| SPS/Controllers/CircleScreenController / CircleAudioController / CircleVictimController | 189/50/75 | Circle screen effects, spatial audio, victim presentation | CircleEnvironment, CircleVictimFeedback |
| SPS/Controllers/TempestCameraSway / TempestWeatherController | 40/62 | Tempest camera sway; the only Lighting blend owner during Tempest | – |
| SPS/ChannelAnimationController | 734 | Channelling animations | IgniteCastApproved, QuickSlotAnimation |
| SPS/Controllers/{Drowning,PowerChannel,RockThrow,RockBarrage,Fireball,InsectControl,Lightning,SpiritStun,RawWater,RawEarth,Circle,FlowingWeave}AnimationController | 39–223 | Per-ability animations (some upper-body procedural) | `<Ability>Animation` etc. |
| SPS/BrokenLegAnimationController | 67 | Broken-leg limp | – |
| SPS/RagdollStateController | 144 | Ragdoll state presentation | – |

### 2.5 HUD and UI

| Path | L | Responsibility | Remotes |
|---|---|---|---|
| SPS/HUDController | 724 | `MainHUD` vitals (health/mana), `DamageVignette` | – |
| SPS/XPUIController | 482 | XP popups on `MainHUD.XPContainer` | ProgressionFeedback |
| StarterGui/TopHUD/TopHUDController | 274 | Top bar: avatar, XP bar, Book/Settings/Map/Marks slots, hide toggle, PC hotkeys for Marks/Settings/HideHUD | – |
| SPS/Controllers/StaminaUIController | 66 | `StaminaGui` bar | – |
| SPS/Controllers/BookController (+ ScrapbookPanel module, 660) | 944 | `NewBookHUD`: Basics/Weaves/Skills/Titles/Settings, key rebinding | PlayerSettings (RF), TitlesRequest, TitlesChanged, ChooseElementAlignment, ChangeElementAlignment, ElementSkillPurchase, WarderSkillPurchase, BookReading |
| SPS/Controllers/EconomyController | 587 | Marks and factions menu (`MarksAndFactionsHUD`), gifts | EconomyRequest, EconomyNotice, EconomyChanged, GiftRequest, GiftNotice, EconomyReady |
| SPS/MarksShopClient | 254 | `ShopHUD` shop | MarksShopRequest, MarksShopNotice |
| SPS/Controllers/MinimapController | 838 | `MinimapHUD` and `MapHUD` | MapDiscovery, FactionWarVisual, GuardianBond |
| SPS/Controllers/BookPromptController | 370 | World "read book" prompts (`BookPrompts`) | – |
| SPS/Controllers/ElementSkillController | 70 | Creates `WovenTopNavigation` and a hidden `BookButton` | – |
| SPS/Controllers/GuardianBondController | 376 | `GuardianBondHUD` card and panel, TopHUD portrait | GuardianBond, PlayerSettings |
| SPS/Controllers/VillageConversationController | 180 | `VillageConversation` dialogue panel | VillageConversation |
| SPS/Controllers/LearnedWeaveNotificationController | 21 | SetCore notification on unlock | WeaveLearned |
| SPS/Controllers/BurnoutRecoveryController | 78 | Burnout notice | – |
| SPS/Controllers/GrandShieldHealthController / HealingChargeMeterController | 40/33 | Small meters | – |
| SPS/Controllers/TitlesChatController / SilenceChatController / SPS/RawSpiritChatController | 20/36/150 | TextChat title tags, Silence chat block, Raw Spirit chat | BookChatReminder |
| SPS/Controllers/LowDeviceModeController | 79 | `Setting_LowDevice`: shadows off, textures stripped locally | – |
| SPS/Controllers/ResponsiveUIController | 36 | Resizes some runtime guis to the viewport | – |

### 2.6 Camera and character

| Path | Type | L | Responsibility |
|---|---|---|---|
| SCS/Shiftlock | LocalScript | 172 | Applies the shift-lock camera (CameraOffset, LockCenter, RotationType) when the `PvPMode` attribute is set. Owns `PvPCrosshairGui` |
| SCS/Init | LocalScript | 12 | Disables the core Health gui, with retries |
| SCS/Health | **Script** (server, in character) | 25 | Replaces the default Health script: regen of 2 HP every 0.25 s after 6 s without damage |
| SCS/Animate | LocalScript | 971 | Customised Roblox Animate (walk/run blend threshold, emotes) |
| SPS/Controllers/SwimmingScreenController | LocalScript | 50 | Swimming screen effect |
| SPS/DrowningController | LocalScript | 497 | Drowning screen presentation |
| SPS/MakingFogScreen | LocalScript | 53 | Personal fog veil |

### 2.7 Admin and debug

| Path | L | Responsibility | Remotes |
|---|---|---|---|
| SPS/AdminController | 574 | `WovenAdmin` command UI with autocomplete | AdminRequest (RF), AdminNotice |
| SPS/AdminFlightController | 180 | Admin flight | FireServer (remote name not caught) |
| SPS/TrollocDebugOverlay | 51 | AI labels while `TrollocDebug` is set | – |
| SPS/Controllers/WarderTestController | 1661 | Warder Combat Test V2: whole Guardian HUD swap, prediction | WarderTestRequest |
| SPS/Controllers/CustomWeaveTestVFX | 6 | Comment only, no code | – |

### 2.8 NPC and world

| Path | L | Responsibility | Remotes |
|---|---|---|---|
| SPS/VillageNPCController | 170 | NPC speech bubbles and weapon poses | VillageSpeech |
| SPS/OrcTutorialVisibility | 51 | Tutorial-only NPC visibility | – |
| SPS/OrcMovementVisualController | 175 | Trolloc movement weight and sounds | – |
| SPS/DetectionUIController | 97 | Trolloc awareness billboard | – |
| SPS/MapAmbientController | 150 | Distance-culls map emitters, beams and lights | – |
| SPS/MarksWorldVisuals | 95 | Faction zone ground guides | (OnClientEvent) |
| SPS/InnTravelClient | 9 | Preloads after inn teleport | InnTravel |
| SPS/Controllers/WaysAtmosphere | 72 | The Ways atmosphere and party visibility | – |
| SPS/Controllers/FollowingLightController | 66 | Following lights | – |

### 2.9 Mobile

| Path | L | Responsibility | Remotes |
|---|---|---|---|
| SPS/Controllers/MobileLayoutController | 330 | Drag-to-arrange editor (`MobileLayoutEditor`); saves `Setting_MobileLayout` JSON | PlayerSettings |
| SPS/MobileHUDLayoutController | 90 | Mobile Circle "Link" button, PvP button in `MobilePVPPlacement` | CE: ActionBegan |
| SPS/Controllers/ResponsiveUIController | 36 | See 2.5 | – |

### 2.10 Disabled scripts (not live)

`SPS/HealthRegenController`, `SPS/PvPCrosshairController`, `SPS/IncomingWeaveBeamController`, `SPS/AirPushCastThreadController`, `SPS/AirSlashWeaveTrailController`, `SPS/Controllers/FireDrawingAnimationController`, `SPS/Controllers/IncomingThreadController` (1305 lines), `SPS/Controllers/DreamAnimationBridge`, `SPS/Controllers/ReadyGroundFlowController`, `SPS/Controllers/SettingsController`, `SPS/Controllers/PainContestController`. See §8.

## 3. Startup and lifecycle

**There is no loader.** Nothing `require`s a controller. The only ModuleScripts under SPS are `ScrapbookPanel`, `SpiritIllusionVisual` and `AbilityVisuals/*`. Roblox starts sibling LocalScripts in no guaranteed order, so scripts sync through:

- `WaitForChild` on shared modules, remotes, PlayerGui children and `ClientEvents`. Used everywhere.
- `ChildAdded` / `DescendantAdded` watchers for guis that may appear later, for example `ChannelController:648-659` (MobileElements) and `StaminaUIController:59`.
- Retry loops when another script may create something later. `InputController:557-570` retries hiding SprintController's CAS button 40 times; its comment says "Their startup order is not guaranteed."
- `pcall` retry loops around `StarterGui:SetCore` / `SetCoreGuiEnabled`, because core scripts register late: `SCS/Init`, `HUDController:7`, `InputController:186-200`.

**Character dependency.** `CharacterAutoLoads = false`, so nothing spawns until the entry flow or the server calls `LoadCharacter`. `HUDController:23` blocks on `player.Character or player.CharacterAdded:Wait()`. Scripts that `WaitForChild` a StarterGui gui in PlayerGui also wait for the first copy. (Roblox copies StarterGui into PlayerGui on character spawn; not tested here in Play.)

**Respawn behaviour:**

- SPS scripts run once per session and survive respawns. Each handles `CharacterAdded` itself, for example `InputController:632` resets channel and sprint state, and `StaminaUIController:60`.
- SCS scripts (`Shiftlock`, `Init`, `Animate`, `Health`) are re-cloned into each character. `Shiftlock` re-applies the camera on `CharacterAdded` (`SCS/Shiftlock:155-162`) and reuses `PvPCrosshairGui` if it already exists (`:24-32`).
- Every StarterGui ScreenGui has `ResetOnSpawn=false` except `TutorialTextPosition`, `MobilePVPPlacement` and `NewQuickSlot`. Several scripts also force `ResetOnSpawn=false` at runtime: `InputController:426`, `ChannelController:653`, `StaminaUIController:28`, `MobileHUDLayoutController:45`, `BookController:114`. Runtime-created guis all set `ResetOnSpawn=false`.
- The one gui-embedded script, `TopHUD.TopHUDController`, therefore runs once.

**State gates set elsewhere.** These player attributes gate most of the HUD:

- `PlayScreenActive`, set by the entry flow. Read by InputController, TopHUDController:166, StaminaUIController:37 and MobileHUDLayoutController:73.
- `BookOpen` / `SettingsOpen` / `EconomyOpen` / `MapOpen` / `MarksShopOpen` / `SkillTreeOpen`.

`PlayEntryClient` clones its own `ReplicatedFirst.PlayHUD` and disables the StarterGui copy (`ReplicatedFirst/PlayEntryClient:25,156`).

**Mode switches:**

- `WarderTestController` runs only while the server sets `WarderTestOn` (`:1658-1661`). It hides the channeler UI and restores it on exit (`:1194-1215`).
- `WarderClient` is gated by `HasAbility_warder` (from its header).

## 4. Input model

### Keybind source of truth

`RS/Shared/Keybinds` holds the bind table:

- `M.Actions` defines Id, Group, PC default, Pad default and Context (`Channel`/`Free`/`Fire`/`Quick`/`Any`). Defaults include Q Channel, X Confirm, F/G/V/R/C elements, 1–5 quickcasts, LeftShift Sprint, LeftAlt Shiftlock, B Book, M Map, P Marks, L Settings and H HideHUD.
- Player overrides live in `Setting_Bind_<Action>_<PC|Pad>` player attributes, written by the server (`PlayerSettingsServer`) after `ScrapbookPanel:224` calls `PlayerSettings:InvokeServer("Bind_"..action.."_"..device, name)`.
- `Keybinds.Get/Key/Is/Keys` resolve the bind, `Keybinds.Changed` fires on any `Setting_Bind_` change, and `Keybinds.Conflicts` drives the overlap warning.
- `M.Allowed` restricts which keys may be bound. WASD, Space, Esc, Tab and `/` are fixed.

`RS/Shared/InputActions` holds only the four logical action names: `TogglePvP`, `Channel`, `ConfirmWeave`, `PrimaryAction`.

### Keyboard and mouse

`InputController` binds with ContextActionService:

- `TogglePvP` → Shiftlock key, `Channel` → `handleChannelToggle`, `ConfirmWeave` → MouseButton2 plus the Confirm key (`InputController:361-371`). It rebinds on `Keybinds.Changed`.
- `PrimaryAction` → MouseButton1 (`:375`).
- Channel is a **press toggle** with a 0.18 s debounce, decided by the server's `CombatState` attribute (`:335-358`).
- `beginAction` (`:203`) fires `CE/ActionBegan`. On desktop, PrimaryAction also handles ListeningWard, FoldedLight and Raw Air exceptions, then calls `CastRequest:FireServer(aimPos)` with a camera raycast of 500 studs.

Other scripts read keys themselves with `UIS.InputBegan` plus `Keybinds.Is`: `TopHUDController:239-250` (HideHUD, Marks, Settings), `BookController:873-879` (Book, Esc/B to close), SprintController, QuickSlotController, ChannelController (element keys, `:622`), FireDrawingController, WarderClient and WarderTestController. Ability controllers listen to `CE/ActionBegan` / `ActionEnded` for PrimaryAction instead of reading the mouse directly (Rock, Fireball, AirBlades, Healing, FireHold, Binding, Circle, SpiritTechnique).

### Gamepad

- One CAS action, `"WovenController"`, at priority 3000 takes every face, shoulder, stick and D-pad button (`InputController:870-873`). The router `controllerAction` (`:793`) reads pad binds from Keybinds (`readPadBinds`).
- LT (QuickModifier) plus a face button fires `CE/ControllerQuickSlot` (handled by QuickSlotController `:232`).
- While channelling, face buttons fire `CE/ControllerElement` (ChannelController `:641-645`).
- RT is primary/cast and also drives multi-throw sessions (`controllerMultiThrow`). B and RT are fixed (comment above `readPadBinds`).
- `ControllerAim` aims at screen centre when `PreferredInput == Gamepad`.
- `ControllerCursor` and `ControllerCursorController` wrap the `GamepadService` virtual cursor.
- The per-frame `"WovenWordNavigation"` render step (`InputController:727`) rewires `NextSelection*` between floating-word buttons.
- Gamepad hints live in `KeybindListController` (comment near `InputController:875`).

### Touch

- "Is touch UI" is defined in `RS/Shared/TouchUI.IsTouchUI`: gamepad never counts, explicit Touch always counts, otherwise touchscreen without a keyboard.
- Channel, Sprint and Confirm are authored buttons in `MobileChannelHUD.Frame`, wired in `InputController:422-512`. Confirm shows only while confirming is possible (`layoutMobileStack`). The default CAS sprint button is hidden.
- World taps cast through `RS/Shared/MobileTapGate.OnTap` (`InputController:517`), only in `WeaveReady`. Aim comes from `ProjectileAimService.GetMobileAim`.
- Elements use `MobileElements` (ChannelController), quickcasts use `QuickSlotHUD`, PvP uses the button in `MobilePVPPlacement` (MobileHUDLayoutController).
- Players can rearrange buttons through `MobileLayoutController`.
- `ChannelInputMode` reports touch mode to the server.

**Inconsistency to fix over time:** several scripts define "is mobile" their own way:

- `QuickSlotController:17` uses `TouchEnabled and not KeyboardEnabled`, computed once and never updated.
- `ResponsiveUIController:16` uses `TouchEnabled or vp.X<760 or vp.Y<500`.
- `TopHUDController:207` and `MobileHUDLayoutController:32` reimplement TouchUI logic, plus a Studio `ForceTouchUI` attribute in TopHUD.
- `BookController:109` uses PreferredInput only.

## 5. UI map

A rendered version of every ScreenGui below, with its colours, fonts and images, is in the "Live place" part of [ui-kit/index.html](ui-kit/index.html). The "Target design" part of the same page is what we build toward in game: build new or reworked UI toward it. Each live screen there is marked kept, reworked or no target yet.

| ScreenGui (StarterGui) | Enabled / ResetOnSpawn / DisplayOrder | Owner script | Other writers | Purpose | Status |
|---|---|---|---|---|---|
| MainHUD | on / off / 0 | HUDController (vitals) | XPUIController (XP popups), TopHUDController:104-107 (hides old LevelText/XPBackground/XPText), MobileLayoutController (moves VitalsContainer), WarderTestController (hides mana bar) | Health/mana and the old XP container | Live; XP bar part replaced by TopHUD |
| TopHUD (+ TopHUDController) | on / off / 5 | TopHUDController | GuardianBondController (portrait), EconomyController, InputController (focuses BookSlot) | Top bar | Live |
| QuickSlotHUD | on / off / 15 | QuickSlotController | MobileLayoutController (positions), VillageConversationController:123,174 (hide during dialogue), BookController:691, WarderTestController (hides) | Quickcast slots | Live |
| WarderQuickSlotHUD | off / off / 15 | WarderTestController (`:1287`) | – | Guardian sword-form bar | Live in Warder mode only |
| NewQuickSlot | off / **on** / 0 | none | WarderTestController only adds it to its hide list (`:1195`) | 4 bare ImageButtons | **Legacy / dead** |
| StaminaGui | off / off / 20 | StaminaUIController (enables when alive) | ResponsiveUIController:23 (bar width) | Stamina bar | Live |
| MobileChannelHUD | off / off / 0 | InputController (`:425`, enables on touch) | KeybindListController (TieButton), MobileLayoutController (positions), WarderTestController (Warder buttons, hides Channel/Confirm/Tie) | Touch Channel, Sprint, Confirm, Tie and Warder buttons | Live, many writers |
| MobileElements | off / off / 30 | ChannelController | ChannelFeedbackController (skips its buttons), WarderTestController (hides) | Touch element buttons during channel | Live |
| MobilePVPPlacement | off / on→off at runtime / 0 | MobileHUDLayoutController | MobileLayoutController (position) | Touch PvP button holder | Live |
| MobileLayoutEditor | off / off / 950 | MobileLayoutController | ScrapbookPanel (opens it) | Layout editor | Live |
| NewBookHUD | on / off / 1001 at runtime | BookController (+ ScrapbookPanel) | ElementSkillController, MobileHUDLayoutController (anchors to BookButton), EconomyController, MinimapController | Book, skills, settings | Live |
| ShopHUD | off / off / 0 | MarksShopClient | – | Marks shop | Live |
| GuardianBondHUD | on / off / 200 | GuardianBondController | – | Bond card and panel | Live |
| CircleUIPosition | on / off / 0 | WovenFeedbackController (`:85`) | MinimapController:263 (anchor), WarderTestController (hides) | Circle member panel anchor | Live |
| WarderTestHUD / WarderSwordFormHUD / WarderShowcaseHUD | off / off / on | WarderTestController | – | Warder test HUD, sword-form drawing, showcase caption | Live in Warder mode (Showcase enabled but caption hidden) |
| TutorialTextPosition | off / on / 0 | ReplicatedFirst/FirstJourneyClient | InputController (gamepad focus list) | Tutorial text | Live (entry flow) |
| PlayHUD | on / off / 0 | none; PlayEntryClient disables this copy and uses its own clone from ReplicatedFirst | – | Play screen | **Duplicate; StarterGui copy is legacy** |
| SettingsHUD | off / off / 1010 | only the disabled SettingsController (`:17`) | – | Old gifting/settings panel | **Legacy / dead** |
| ButtonTemplateHUD | on / off / 0 | `RS/Shared/ButtonTemplateView` (used by EconomyController) | – | Button template source | Live (template) |
| ReplicatedFirst/PlayHUD | template; cloned at runtime as ActivePlayHUD (DisplayOrder 10000) | RF/PlayEntryClient | – | Menu, save cards, credits | Live (entry flow) |
| ReplicatedFirst/SaveSlotHUD | template | RF/PlayEntryClient (SaveCards) | – | Class picker | Live (entry flow) |

Runtime-created guis (not in StarterGui):

- Feedback and overlays: `KeybindList`, `TiedWeaveWords` (**created by both** KeybindListController:22 and SpiritTechniqueController:210), `RawFireWords`, `RawEarthWords`, `RawWaterWords`, `SpiritFloatingWords`, `ChannelGui`, `ChannelFeedbackGui`, `DamageVignette`, `HeldWardHUD`, `WardFloatingWords`, `PvPCrosshairGui` (Shiftlock).
- Menus and panels: `MinimapHUD`, `MapHUD`, `MarksAndFactionsHUD`, `VillageConversation`, `BookPrompts`, `WovenTopNavigation` (ElementSkillController:16), `WovenAdmin`, `AdminFlightControls`, `CircleControllerInvite`, `CircleScreenFX`, `WovenFeedback`, `WardingLineAlerts`, `WaygateChoices`, `RawSpiritGui`.
- Per-ability feedback HUDs: `*FeedbackHUD`, `DrowningFeedbackHUD`, `MakingFogScreen`, `SpiritStunFeedbackGui`.

**Menu switching.** `RS/Shared/UiManager` is a registry: `Register(id, {isOpen, open, close})` and `Toggle(id)`; Toggle closes the other menus first. Registered menus: `Book` and `Settings` (BookController:860-872), `Marks` (EconomyController:402), `MarksShop` (MarksShopClient:246), `Map` (MinimapController:704), `Gifts` (SettingsController:201, disabled). The open state is mirrored in player attributes (`BookOpen`, `SettingsOpen`, `EconomyOpen`, `MapOpen`, `MarksShopOpen`, …), which TopHUD, Shiftlock, InputController and MobileHUDLayout read.

**Settings.** The settings UI is the Settings section of `ScrapbookPanel`. Toggles at `ScrapbookPanel:63-67`: ScreenShake, SprintToggle, MinimapAlwaysOn, LowDevice, LiveViewport. Values persist as `Setting_<Key>` player attributes, written through the `PlayerSettings` RemoteFunction. Consumers read the attributes directly: ScreenShakeController, SprintController, MinimapController, LowDeviceModeController, TopHUDController:83, MobileLayoutController:134, GuardianBondController:70.

## 6. VFX and replication pattern on the client

Every client draws every caster's weave VFX locally. The server sends events or sets attributes; it does not replicate thread effect parts. Three patterns:

1. **Event broadcast keyed by character (`ThreadVisual`).**
   - `ThreadVisualController.onThreadVisual(action, character, …)` (`SPS/ThreadVisualController:3333-3430`) handles `Add`, `Finalize`, `Release`, `SpiritStunEnd` and `Clear`.
   - Connected to the remote (`:3431`) and to `CE/ThreadVisualLocal` (`:3433-3434`). The second serves local-only casters such as the play-screen menu caster.
   - Thread actors are cloned from `RS/Assets/ThreadActors/ThreadActor` (`:399`, `:440`) into `Workspace.ActiveThreads`.
   - One `PreRender` loop (`:2060`) animates every caster in `activeCasters`. It disables trails beyond 250 studs (`62500` squared, `:2080`), hides threads when the caster is `WeaveReady`, starts `ChannelReadyHandoff` (`:2072-2075`), and clears a caster whose character has no Parent (`:2107-2109`).
   - Server senders include ChannelService, AbilityService, CircleService and most ability modules.
   - `WardVisualController` follows the same pattern with `WardVisual` (`:1064`, PreRender `:994`).
2. **Attribute polling over the actor roster ("shape" controllers).**
   - `FireballWeaveShapeController`, `AirPushWeaveShapeController`, `HealingCasterShapeController`, `TornadoFormationController`, `RawAirReadyThreads`, `ReadyHandBeamController` iterate `RS/Shared/CasterActors.Candidates(scan, records, wanted)` every frame.
   - They read replicated attributes on each actor (`ReadyWeave`, `CombatState`, `FireballActive`, `Stilled`, …), clone `RS/NewThread` into their own workspace folder, and call `Actors.Verify`.
   - Example: `SPS/FireballWeaveShapeController:98-112`, with a 150-stud distance gate at `:106`.
   - `CasterActors` treats players and channeler NPCs (`ChannelerNPC` attribute) as one roster and limits iteration to a "hot set" with a periodic full sweep (`RS/Shared/CasterActors:1-6`).
3. **Remote → module bridge.**
   - Small `<Ability>VisualController` scripts forward a remote's actions to `Controllers/AbilityVisuals/<Ability>Visual`. Example: `SPS/Controllers/FireballVisualController:14-28` routes `Ready`, `Launch`, `End`.
   - The modules clone from `RS/Assets/AbilityEffects` / `ThreadActors` and run their own `PreRender` connection per effect record.

**Concealment and visibility.**

- `RS/Shared/WeaveVisibility.Track(root, caster)` registers effect instances.
- One `BindToRenderStep("WeaveVisibility", Last+40)` applies `LocalVisibilityMask.Apply("WeaveEffects", desired)` based on `VisibilityRules.CanSee(LocalPlayer, caster)` and clears trails and particles on hide (`RS/Shared/WeaveVisibility:20-44`).
- Shape controllers call `Track` right after parenting (for example `FireballWeaveShapeController:40`).
- FoldedLight and Ways use their own render steps on the same mask.

**Authority.** All VFX scripts are presentation-only. InputController predicts sprint speed locally and the server corrects it (`InputController:44-50`). Shiftlock applies instantly and reconciles from `PvPMode` (`SCS/Shiftlock:139-153`).

## 7. Conventions observed

- **File header:** first line `-- Name: purpose.`, often followed by `Responsibilities:` lines. Some headers are stale (§8).
- **WaitForChild everywhere** at module load, including chained `RS:WaitForChild("Remotes"):WaitForChild("X")`. Some scripts mix this with dot access (`RS.Remotes.X`, `RS.Shared.X`).
- **Player attributes are the state bus.** Server-written: `CombatState`, `ReadyWeave`, `ActiveAbility`, `TiedWeave`, `<Ability>Active`, `HasAbility_*`, `PvPMode`, `Stilled`, `Stamina`, `XP`, `Setting_*`. Client-written UI flags: `BookOpen`, `MobileCirclePanelOpen`, `MobileLayoutEditing`, … Controllers react with `GetAttributeChangedSignal`, or poll.
- **ClientEvents BindableEvents** (`ActionBegan`, `ActionEnded`, `ChannelFeedback`, `ThreadHandChosen`, `ControllerElement`, `ControllerQuickSlot`, `ThreadVisualLocal`) are the only inter-script bus. There is no shared controller module API.
- **Remote action strings:** one remote per ability, with an action verb as first argument (`"Ready"`, `"Launch"`, `"Stop"`, `"Add"`, …).
- **Authored GUI first:** "artist-authored HUD owns every size, position and scale" (InputController, near `:378`); runtime scripts add only behaviour. Many smaller guis are still built in code.
- **Single sources:** UiManager for menus, Keybinds for keys, TouchUI for touch detection. Followed partly (§4).
- `pcall` around SetCore and EditableImage calls. `task.defer` coalesces layout work (ResponsiveUIController:27).
- Weak-keyed tables (`setmetatable({}, {__mode='k'})`) for per-instance caches.
- Comment tags such as `-- ponytail:` (InputController:44) and dated `DISABLED yyyy-mm-dd` headers (SettingsController).

## 8. Legacy and dead code

**Disabled scripts** (`Enabled=false`):

| Script | Notes |
|---|---|
| SPS/HealthRegenController | Superseded by `SCS/Health`. Nothing references it. |
| SPS/PvPCrosshairController | Superseded by Shiftlock's own `PvPCrosshairGui` (Shiftlock:23-32). |
| SPS/IncomingWeaveBeamController | Only mentioned in a comment in GuardianBondController:199. |
| SPS/AirPushCastThreadController, SPS/AirSlashWeaveTrailController | No references. Server `AirSlash` still references `AirSlashThreadRelease`; AirSlashWeaveTrailController was its only listener found. |
| SPS/Controllers/IncomingThreadController (1305 L) | The server still fires `IncomingThreadVisual` (ActiveAbilityBridge, ChannelerNPCSpells, SpiritStun), but no live client listener connects. Likely dead network traffic. |
| SPS/Controllers/FireDrawingAnimationController, DreamAnimationBridge, ReadyGroundFlowController, PainContestController | Disabled. The `PainContest` remote still exists. |
| SPS/Controllers/SettingsController | "DISABLED 2026-10-31: gifting moved into the Marks menu" (header). Would register `Gifts` in UiManager if re-enabled. |

**Dead or duplicate GUIs:**

- `NewQuickSlot`: no owner; only WarderTestController adds it to its hide list.
- `SettingsHUD`: only the disabled SettingsController uses it.
- `StarterGui.PlayHUD`: duplicate of `ReplicatedFirst.PlayHUD`; PlayEntryClient disables it at runtime.
- `MainHUD.XPContainer` LevelText/XPBackground/XPText: hidden by TopHUDController:104-107. XPUIController still writes to them; only the popups matter.
- Quick-slot bars: QuickSlotHUD is the live channeler bar, WarderQuickSlotHUD the live Guardian bar (swapped in by WarderTestController), NewQuickSlot is dead.

**Stale or empty:**

- `SPS/Controllers/CustomWeaveTestVFX`: comment only.
- `SPS/CameraController`: now only a 27-line forwarder. Shiftlock's header (`:5`) says CameraController is disabled; it is not.
- ThreadVisualController's header claims "thread actor pooling"; there is no pool (actors are cloned at `:399/:440` and destroyed with `task.delay` at `:701`).
- InputController has empty "Device debugging" `if` blocks.
- `MobileHUDLayoutController` anchors its Link button to a `BookButton` that its own comment says "stays hidden now (TopHUD replaced it)" (`:77`).

**Backups:** `ServerStorage/MCPBackups` holds many dated copies of client scripts. They do not run, but they pollute `script_grep` / `script_search` results. Filter them out (see [workflow.md](workflow.md)).

## 9. How to change this area

**Add a controller.**

1. Add a LocalScript under `SPS/Controllers` with the `-- Name: purpose.` header.
2. Do not count on load order: `WaitForChild` everything you need from other scripts, and watch `PlayerGui.ChildAdded` for guis another script creates.
3. Read state from player attributes. Listen to `CE/ActionBegan` / `ActionEnded` for primary, channel and confirm instead of binding MouseButton1 again.
4. Handle `CharacterAdded` yourself; SPS scripts persist across respawns.

**Add a HUD element.**

1. Author it in StarterGui with `ResetOnSpawn=false`.
2. Give it exactly one owner script that sets `Enabled`. Other scripts change it through attributes, not by writing to it.
3. For a menu: register it with `UiManager.Register`, set an `<Name>Open` attribute while open, and add that attribute to TopHUD's `MENUS` (`TopHUDController:174`) and Shiftlock's `UI_ATTRS` (`SCS/Shiftlock:57`) so the top bar slides away and the cursor unlocks.
4. Hide it while `PlayScreenActive` is true.
5. If touch users should be able to move it, add an entry to MobileLayoutController's piece list (`:22-39`).

**Add a keybind.**

1. Add an entry to `RS/Shared/Keybinds.Actions` with a **new Id**; changed defaults don't reach saved players.
2. Pick the right `Context` so the conflict warning is correct.
3. Read the bind with `Keybinds.Is(input, id)` in `InputBegan`, or `Keybinds.Keys(id)` for CAS, and re-bind on `Keybinds.Changed`.
4. For gamepad, add the action to `readPadBinds` and route it in `InputController.controllerAction`. The router only sees buttons listed at `:870-873`.
5. The rebinding UI (ScrapbookPanel) lists actions generically; check the new one appears.

**Add a VFX for a weave.**

- **Event-driven:** add actions to the ability's `<Ability>Visual` remote, then add a bridge LocalScript plus an `AbilityVisuals/<Ability>Visual` module, following FireballVisualController and FireballVisual.
- **State-driven (persistent ready or held shapes):** copy the shape-controller pattern: `CasterActors.NewScan`, `Candidates`, `Verify`; a distance gate (≈150 studs); clone `NewThread` into your own folder; apply `WeaveTrailTaper` and the `ElementConfig` colour; call `WeaveVisibility.Track(part, char)`; destroy records when the character leaves.
- If the weave uses the standard channel threads, ThreadVisualController already draws them; the server only sends `ThreadVisual` Release with a new `releaseType`, handled in `releaseCaster` (`:1853`).

**Support mobile.**

1. Use `RS/Shared/TouchUI.IsTouchUI()`, not a local check.
2. Put buttons in an authored gui, not CAS-generated buttons. Hide any CAS button you create, as InputController does with SprintAction.
3. Route world taps through `MobileTapGate.OnTap`, target selection through `MobileTargetSelection`.
4. Register the button with MobileLayoutController.
5. Test with the Studio `ForceTouchUI` attribute (only TopHUD honours it today).

## 10. Risks and gotchas

- **Per-frame load.** 191 per-frame hook sites (RenderStepped / Heartbeat / PreRender / Stepped / BindToRenderStep) across 102 live client scripts. Some exist only during an effect; many run from join to leave and iterate `Players:GetPlayers()` or the actor roster every frame (TempestHandTrails:56, TempestProtectionController:18, ListeningWardVisualController:27, FireballBarrageVisual:77). Cost grows with players × scripts. Main scaling risk; profile on a full server.
- **ThreadVisualController (3.5k lines)** does all channel-thread work in one PreRender loop (`:2060`) and walks every trail of every thread on each hidden/visible flip. No actor pooling despite its header.
- **Always-on UI polling loops:** `KeybindListController:420` (Heartbeat), `MobileHUDLayoutController:69` (every 0.25 s), `StaminaUIController:62` (every 0.15 s), `MinimapController:792` (RenderStepped), `InputController:727` (re-sorts navigation every frame). `TrollocDebugOverlay:37` runs a `while true` loop even for non-debug players.
- **Many writers on one GUI.** MobileChannelHUD, QuickSlotHUD and MainHUD each have four or five writers (§5). WarderTestController forces `Enabled`/`Visible` back to false on property change (`:1185-1191`), so any new feature that toggles those guis will fight it while Warder mode is on.
- **`TiedWeaveWords`** is created by two scripts (KeybindListController:22, SpiritTechniqueController:210); `FindFirstChild` may pick either.
- **Startup races:** order-dependent hacks (the 40× sprint-button hide loop, InputController:557-570); `QuickSlotController:17` computes `isMobile` once; `HUDController:23` blocks until the first character, so the HUD stays dead until the entry flow spawns the player.
- **Split camera/cursor ownership:** Shiftlock owns `MouseBehavior`/`RotationType`, but WarderTestController reads `MouseBehavior` (`:548`, `:585`); RawSpiritController sets `CameraSubject` (`:1091`, `:1132`); ScreenShake, CircleScreen, TempestCameraSway, FireDrawingFeedback, FireballFeedback and PainInfliction all apply camera offsets with `BindToRenderStep` around `RenderPriority.Camera` (offsets −1, +2, +3).
- **LowDeviceModeController** keeps a `saved` table of every stripped instance while on; destroyed instances stay referenced until restore (likely memory leak in long sessions; not measured).
- **ResponsiveUIController** fires on every `DescendantAdded` under PlayerGui and overwrites sizes/positions of runtime guis other scripts also set (HeldWardHUD, VillageConversation, WovenAdmin).
- **Dead traffic:** the server fires `IncomingThreadVisual` (and probably `AirSlashThreadRelease`) with no live client listener.
- **Grep noise:** `ServerStorage/MCPBackups` copies match most searches; filter them out before concluding where something is used.

## 11. Open questions

1. Is `IncomingThreadVisual` still needed, or should the disabled IncomingThreadController be deleted together with the server sends? Same for `AirSlashThreadRelease`.
2. Should `NewQuickSlot`, `SettingsHUD` and `StarterGui.PlayHUD` be deleted? Is any art in them still wanted?
3. Who should own MobileChannelHUD and QuickSlotHUD visibility? A single "HUD mode" attribute (Channeler / Guardian / Dialogue / Menu) could replace WarderTestController's force-hide and VillageConversation's direct writes (design suggestion).
4. Does PlayerGui population wait for the first `LoadCharacter`, given `CharacterAutoLoads=false`? Needs a Play test.
5. Is `TrollocDebugOverlay`'s `while true` loop cheap for non-dev players?
