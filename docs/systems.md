# Systems index

Which scripts own each feature. Use it to find every place a change must reach. Paths are short: `Services/X` = `ServerScriptService/Server/Services/X`, `Abilities/X` = `ServerScriptService/Server/Abilities/X`, `SPS/X` = `StarterPlayer/StarterPlayerScripts/X`, `Controllers/X` = `StarterPlayer/StarterPlayerScripts/Controllers/X`, `Shared/X` = `ReplicatedStorage/Shared/X`, `RF/X` = `ReplicatedFirst/X`. Remotes are in `ReplicatedStorage/Remotes` ([shared.md §2](shared.md)).

Keep this file current: when a system's owner scripts change, update its entry in the same task.

## Entry, menu and save slots

- **Server:** `ServerScriptService/PlayEntryServer`, `Services/SaveSlotService`, `Server/ServerMain` (join loop), `Server/GiftServer` (extra-slot receipts)
- **Client:** `RF/PlayEntryClient` (+ `MenuShowcase`, `SaveCards`, `CreditsList`, `CreditsView`), `RF/PlayHUD`, `RF/SaveSlotHUD`, `RF/PlayCamera`
- **Shared:** `Shared/SaveSlotConfig`, `Shared/SaveReady`
- **Remotes:** `PlayEntry`, `SaveSlot` (RF)
- **Data:** `WovenAccount_v1` (slots, last class); attributes `SaveSlot`, `SaveClass`, `SessionDataReady`, `EnteredWorld`, `PlayScreenActive`
- **World:** `camerapieceforloading`, `MenuStage`, menu vista (`tower`)
- **Doc:** [shared.md §4](shared.md)

## Persistence

- **Server:** `Services/DataService`, `Services/SaveSession`, `Services/EconomyStore`, `Services/LevelRules`
- **Data:** `PlayerData_V1`, `WarderProgress_v1` (read once)
- **Doc:** [server.md §5](server.md)

## Tutorial (First Journey)

- **Server:** `Services/FirstJourneyService`
- **Client:** `RF/FirstJourneyClient`, `StarterGui/TutorialTextPosition`, `SPS/OrcTutorialVisibility`
- **Remotes:** `FirstJourney`, `ChooseElementAlignment`
- **Data:** profile `Tutorial*` fields; attributes `TutorialActive`, `TutorialRequired`, `TutorialStep`, `TutorialTravelMessage`
- **World:** `FirstJourneySpawn`, `TutorialWaterSource`, `ServerStorage/TutorialLog`; Studio flag `Workspace.TestFirstJourney`
- **Doc:** [shared.md §4](shared.md)

## Settings and keybinds

- **Server:** `ServerScriptService/PlayerSettingsServer`
- **Client:** `Controllers/BookController` + `ScrapbookPanel` (settings UI, rebinding), every `Keybinds` consumer
- **Shared:** `Shared/Keybinds`, `Shared/KeyLabel`
- **Remotes:** `PlayerSettings` (RF)
- **Data:** `WovenPlayerSettings_v1`; attributes `Setting_*`, `Setting_Bind_<Action>_<PC|Pad>`
- **Doc:** [client.md §4–5](client.md)

## Input

- **Client:** `SPS/InputController`, `SPS/ChannelInputMode`, `SPS/ControllerCursorController`, `SPS/CameraController`, `SPS/KeybindListController`
- **Shared:** `Shared/InputActions`, `Shared/Keybinds`, `Shared/TouchUI`, `Shared/MobileTapGate`, `Shared/ControllerAim`, `Shared/ControllerCursor`, `Shared/ProjectileAimService`, `Shared/MobileTargetSelection`
- **Events:** `ClientEvents/ActionBegan`, `ActionEnded`, `ControllerElement`, `ControllerQuickSlot`
- **Doc:** [client.md §4](client.md)

## Combat state and PvP

- **Server:** `Services/CombatService`
- **Client:** `SPS/CameraController` (TogglePvP), `StarterCharacterScripts/Shiftlock`
- **Shared:** `Shared/CombatStates`
- **Remotes:** `CombatStateRequest`, `TiedWeaveAction`
- **Data:** attributes `CombatState`, `PvPMode`, `TiedWeave`, `TieWeaveAvailable`
- **Doc:** [server.md](server.md), [abilities.md §2](abilities.md)

## Damage, health and death

- **Server:** `Services/DamageService`, `Services/DamageModifierService`, `Services/FinisherService`, `Services/ElementalReactionService`, `Services/RagdollService`, `Services/PlayerProtectionService`, `Services/QuickProtectService`, `ServerScriptService/HealthManager`, `ServerScriptService/HideDefaultHealth`, `StarterCharacterScripts/Health` (server Script)
- **Client:** `SPS/HUDController`, `SPS/CombatFeedbackController`, `SPS/RagdollStateController`, `Controllers/BurnoutDeathVisualController`, `Controllers/QuickProtectController`
- **Shared:** `Shared/FinisherConfig`
- **Remotes:** `CombatFeedback`, `ProgressionFeedback`, `QuickProtectEffect`, `BurnoutDeathVisual`, `ScreenShake`
- **Data:** `Kills`, `Deaths` (profile and leaderstats)
- **Doc:** [server.md §9.8](server.md)

## Movement, sprint and stamina

- **Server:** `Services/MovementStateService`, `Services/MovementRestrictionService`, `Services/SprintService`, `Services/BrokenLegService`, `Services/StatModifierService`
- **Client:** `Controllers/SprintController`, `Controllers/StaminaUIController`, `SPS/BrokenLegAnimationController`, `StarterCharacterScripts/Animate`
- **Shared:** `Shared/SprintConfig`, `Shared/MovementStates`
- **Remotes:** `SprintRequest`
- **Data:** attributes `Stamina`, `MaxStamina`, `IsSprinting`, `MoveState`
- **Doc:** [server.md §9.9](server.md)

## Channeling, weaves and casting

- **Server:** `Services/ChannelService`, `Services/WeaveService`, `Services/AbilityService`, `Services/ManaService`, `Services/BurnoutService`, `Services/ChannelRecoveryService`, `Services/LearnedWeaveService`, `Services/AffinityService`, `Services/WeavePresentationService`, `Services/WeaveCastLog`, `Services/SoloWeaveRuntime`, `ServerScriptService/WeavePresentationObserver`, `Server/ActiveAbilityBridge`, `Abilities/*`
- **Client:** `SPS/ChannelController`, `SPS/ThreadVisualController`, `SPS/ChannelFeedbackController`, `SPS/ChannelAnimationController`, `SPS/WeaveFailureFeedbackController`, `SPS/AbilitySoundController`, per-weave controllers in `Controllers/`
- **Shared:** `Shared/WeaveConfig`, `Shared/CircleReworkConfig`, `Shared/WeaveInfoConfig`, `Shared/ElementConfig`, `Shared/WeaveGestureLibrary`, per-weave configs
- **Remotes:** `ChannelRequest`, `ElementCaught`, `CastRequest`, `ThreadVisual`, `WeaveFeedback`, `<Id>Action`, `<Id>Visual`, `<Id>Feedback`
- **Data:** `LearnedWeaves`, `WeaveAffinity`; attributes `ReadyWeave`, `GatheredThreadCount`, `Mana`, `<Id>Active`
- **Doc:** [abilities.md](abilities.md)

## Quick slots

- **Server:** `Services/QuickSlotService`
- **Client:** `Controllers/QuickSlotController`, `StarterGui/QuickSlotHUD`
- **Shared:** `Shared/WeaveInfoConfig` (recipes and cooldowns used by quick casts)
- **Remotes:** `QuickSlotAssign`, `QuickSlotUse`, `QuickSlotSwitch`, `QuickSlotCooldown`, `QuickSlotAnimation`
- **Data:** `QuickSlots`, `ExtraQuickSlots`
- **Doc:** [abilities.md §4](abilities.md)

## Element skills, tiers and mastery

- **Server:** `Services/ElementSkillService`, `Services/ElementAlignmentPolicy`, `ServerScriptService/HealthManager`
- **Client:** `Controllers/BookController` + `ScrapbookPanel`, `RF/FirstJourneyClient` (first alignment)
- **Shared:** `Shared/ElementSkillConfig`, `Shared/AdvancedSkillConfig`, `Shared/ElementMastery`
- **Remotes:** `ElementSkillPurchase`, `ChooseElementAlignment`, `ChangeElementAlignment` (RF, runtime)
- **Data:** `SkillPoints`, `ElementSkills`, `ElementAlignment`, `AdvancedSkills`; attributes `<Element>Tier`
- **Doc:** [abilities.md §2](abilities.md)

## Raw elements

- **Server:** `Abilities/RawAir`, `Abilities/RawWater`, `Abilities/RawEarth`, `Abilities/RawSpirit`, `Abilities/FireDrawing`, `Services/RawAir*`, `Services/RawFire*`, `Services/WaterResourceService`, `Services/WaterInteractionService`, `Services/TerrainWaterService`
- **Client:** `Controllers/RawAirController`, `RawWaterController`, `RawEarthController`, `RawSpiritController`, `FireDrawingController`, and their `*Visual*` controllers
- **Shared:** `Shared/Raw*Config`, `Shared/RawSpiritProgression`, `Shared/RawElementOptions`
- **Remotes:** `RawAirAction`, `RawWaterAction`, `RawEarthAction`, `RawSpiritAction`, `FireDrawingAction`, and their visuals
- **World:** `Edmond's Field/Interactables/VillageProps` (`Air*` attributes), `WaterSource` tag
- **Doc:** [abilities.md §2](abilities.md)

## Circles

- **Server:** `Services/CircleService`, `Services/CircleIntegrationService`, `Services/CircleWeaveService`, `Services/CircleAbilityRuntime`, `Services/Circle*` helpers, `Abilities/CircleAbilities/*`
- **Client:** `Controllers/CircleController`, `CircleAbilityController`, `CircleReworkController`, `CircleVisualController`, `CircleEnvironmentController`, `CircleScreenController`, `CircleAudioController`, `CircleVictimController`, `WovenFeedbackController`, `SPS/MobileHUDLayoutController` (Link button), `StarterGui/CircleUIPosition`
- **Shared:** `Shared/CircleConfig`, `Shared/CircleAbilityConfig`, `Shared/CircleReworkConfig`
- **Remotes:** `CircleAction`, `CircleState`, `CircleVisual`, `CircleEnvironment`, `CircleAbilityVisual`, `CircleAbilityAction`, `CircleVictimFeedback`, `CircleReworkVisual`
- **Doc:** [abilities.md §2, §10.2](abilities.md)

## Wards

- **Server:** `Services/WardService`, `Services/HeldWardService`, `Services/AbilityService` (`castWard`), `Abilities/ListeningWard`, `Services/ListeningWardVoiceService`
- **Client:** `SPS/WardVisualController`, `SPS/HeldWardController`, `Controllers/ListeningWardVisualController`
- **Shared:** `Shared/HeldWardConfig`, `Shared/WardImpactVisual`
- **Remotes:** `WardVisual`, `WardHitImpact`, `HeldWardAim`, `HeldWardStop`, `ListeningWardAction`
- **World:** `Workspace/WardZones`
- **Doc:** [abilities.md §2](abilities.md)

## Custom weaving

- **Server:** `Server/CustomWeaving/*`
- **Client:** `Controllers/BookController` (experiment page), `SPS/ThreadVisualController` (preview)
- **Shared:** `Shared/ExperimentBookPage`, `Shared/WeaveLoom`, `Shared/WeaveLoomPage`, `Shared/CustomWeavePreview`, `Shared/CustomWeaveMotion`, `Shared/CustomWeaveLabels`
- **Remotes:** `CustomWeaveExperiment`
- **Data:** custom-weave library in the profile; folder attributes `LiveCastingEnabled`, `DevelopmentOnly`
- **Doc:** [abilities.md §2, §3.4](abilities.md)

## Stilling, Silence, Compulsion and status effects

- **Server:** `Services/StillingService`, `Abilities/CircleAbilities/Stilling`, `Services/SilenceService`, `Services/StatusDurationService`, `Services/CompulsionService`, `Services/SpiritTechniqueService`, `Services/ShieldingContestService`, `Services/ContestInputGuard`, `Server/VoluntaryReset`
- **Client:** `Controllers/StillingController`, `Controllers/ShieldingContestController`, `Controllers/SilenceChatController`, `Controllers/CompulsionController`, `Controllers/SpiritTechniqueController`, `Controllers/VoluntaryResetController`
- **Shared:** `Shared/StillingContestConfig`
- **Remotes:** `StillingContest`, `StillingVisual`, `ShieldingContest`, `SilenceVisual`, `CompulsionVisual`, `SpiritTechnique`, `VoluntaryCharacterReset`
- **Data:** `WovenAccount_v1` (`StilledRemaining`); attributes `Stilled`, `Silenced`, `MagicSuppressed`
- **Doc:** [server.md](server.md)

## Guardian (Warder) combat

- **Server:** `Services/WarderService` (Script, V1) + `Services/Warder/*`, `Services/WarderCombatService` (V2 test), `Services/WarderSkillService`
- **Client:** `SPS/WarderClient`, `Controllers/WarderTestController`, `Controllers/DashAfterimageController`, `StarterGui/WarderTestHUD`, `WarderSwordFormHUD`, `WarderQuickSlotHUD`, `WarderShowcaseHUD`
- **Shared:** `Shared/WarderConfig`, `Shared/WarderTest`, `Shared/WarderSkillConfig`, `Shared/WarderSwordForms`, `Shared/WarderAnimation`, `Shared/WarderGate`, `Shared/GuardianBookPages`
- **Assets:** `ReplicatedStorage/Assets/WarderSword`, `WarderDashClips`, `WarderJumpDashClips`, `WarderSwordFormClips`, `WarderAirSlashClip`; dev tool `ServerStorage/WarderFormClipBuilder`
- **Remotes:** `WarderRequest`, `WarderTestRequest`, `WarderSkillPurchase` (RF)
- **Data:** `WarderSkills`, `WarderForms`; attributes `HasAbility_warder`, `<Branch>Tier`
- **Doc:** [abilities.md §10.5](abilities.md)

## Guardian Bond

- **Server:** `Services/GuardianBondService`, `Services/GuardianBondTest` (Studio), `Abilities/GuardianBond`
- **Client:** `Controllers/GuardianBondController`, `StarterGui/GuardianBondHUD`
- **Shared:** `Shared/GuardianBondConfig`
- **Remotes:** `GuardianBond`
- **Data:** `GuardianBonds_v1`
- **Doc:** [server.md](server.md)

## Progression

- **Server:** `Services/ProgressionService`, `Services/LearnedWeaveService`, `Services/BeyondPatternService`, `Services/LevelRules`
- **Client:** `SPS/XPUIController`, `StarterGui/TopHUD/TopHUDController`, `Controllers/LearnedWeaveNotificationController`
- **Remotes:** `ProgressionFeedback`, `WeaveLearned`
- **Data:** `Level`, `XP`, `LevelGrant`; attributes `XP`, `XPToNextLevel`, `XPMultiplier`
- **Doc:** [server.md](server.md)

## Economy (Marks, daily rewards, codes, challenges)

- **Server:** `Server/EconomyServer`, `Services/EconomyService`, `Services/EconomyRules`, `Services/EconomyConfig`, `Services/EconomyStore`, `Services/MockEconomyData` (Studio)
- **Client:** `Controllers/EconomyController`, `StarterGui/ButtonTemplateHUD`
- **Shared:** `Shared/ButtonTemplateView`
- **Remotes:** `EconomyRequest` (RF), `EconomyChanged`, `EconomyReady`, `EconomyNotice`
- **Data:** `WovenEconomy_v1`; attributes `Marks`, `MarksReady`
- **Doc:** [server.md §9.5–9.6](server.md)

## Factions and faction war

- **Server:** `Services/FactionService`, `Services/FactionNameRegistry`, `Services/FactionWarService`, `Services/FactionWarRules`
- **Client:** `Controllers/EconomyController`, `SPS/MarksWorldVisuals`, `Controllers/MinimapController`
- **Shared:** `Shared/MarksShopConfig` (zone timings), `Shared/FactionZoneBoundary`, `Shared/GroundGuide`
- **Remotes:** `EconomyRequest`, `FactionWarVisual`, `MarksShopNotice`
- **Data:** `WovenFactions_v1`, `WovenFactionNames_v1`, `WovenFactionDirectory_v1`, `WovenFactionActiveWeeks_v1`; topic `WovenFactionWarWon_v1`
- **World:** `Workspace/FactionZoneEdmondsField`
- **Doc:** [server.md](server.md)

## Marks shop

- **Server:** `Server/MarksShopServer`, `Services/MarksShopService`, `Services/ChannelerNPCService` (opens shop)
- **Client:** `SPS/MarksShopClient`, `StarterGui/ShopHUD`
- **Shared:** `Shared/MarksShopConfig`
- **Remotes:** `MarksShopRequest` (RF), `MarksShopNotice`
- **Data:** `WovenBounties_v1`
- **World:** `Workspace/SellerNPC`
- **Doc:** [server.md](server.md)

## Gifts and game passes

- **Server:** `Server/GiftServer` (only `ProcessReceipt`), `Services/GiftEntitlementService`, `Services/GiftProductConfig`, `Services/GamepassBypassConfig`, `Services/BeyondPatternService`, `Services/MaximumAffinityService`, `Services/ProgressionService` (2x XP)
- **Client:** `Controllers/EconomyController`
- **Remotes:** `GiftRequest` (RF), `GiftNotice`
- **Data:** `WovenGiftPurchases_v1`, `WovenGiftEntitlements_v1`
- **Doc:** [server.md §6](server.md)

## Titles and nametags

- **Server:** `Services/TitlesService`, `Server/TitlesServer`, `Server/PlayerNametags`
- **Client:** `Controllers/BookController`, `Controllers/TitlesChatController`
- **Shared:** `Shared/TitlesConfig`, `Shared/PlayerNametagConfig`
- **Remotes:** `TitlesRequest` (RF), `TitlesChanged`, `TitlesReady`
- **Data:** `WovenTitleDefs_v1`, profile `Titles`; topic `WovenTitleDefsChanged_v1`
- **Doc:** [server.md](server.md)

## Book

- **Server:** `ServerScriptService/BookPresentationServer`
- **Client:** `Controllers/BookController` + `ScrapbookPanel`, `Controllers/BookPromptController`, `Controllers/ElementSkillController`, `StarterGui/NewBookHUD`
- **Shared:** `Shared/BookPageConfig`, `Shared/GuardianBookPages`, `Shared/BookPresentationConfig`
- **Assets:** `ReplicatedStorage/Assets/OpenBook`
- **Remotes:** `BookReading`, `BookChatReminder`
- **Doc:** [client.md §5](client.md)

## HUD, top bar and menus

- **Client:** `SPS/HUDController` (`MainHUD`), `StarterGui/TopHUD/TopHUDController`, `Controllers/StaminaUIController`, `SPS/KeybindListController`, `Controllers/ResponsiveUIController`, `Controllers/LowDeviceModeController`
- **Shared:** `Shared/UiManager`, `Shared/TopButtonTheme`, `Shared/ScreenEffectLayout`
- **Doc:** [client.md §5](client.md)

## Mobile layout

- **Server:** `ServerScriptService/PlayerSettingsServer` (stores the layout)
- **Client:** `Controllers/MobileLayoutController`, `SPS/MobileHUDLayoutController`, `StarterGui/MobileChannelHUD`, `MobileElements`, `MobilePVPPlacement`, `MobileLayoutEditor`
- **Shared:** `Shared/TouchUI`, `Shared/MobileTapGate`
- **Remotes:** `PlayerSettings`, `ChannelInputMode`
- **Data:** `Setting_MobileLayout`
- **Doc:** [client.md §4, §9](client.md)

## Map and discovery

- **Server:** `ServerScriptService/MapDiscoveryServer`
- **Client:** `Controllers/MinimapController`
- **Shared:** `Shared/MapConfig`, `Shared/GroundGuide`
- **Remotes:** `MapDiscovery`
- **Data:** `WovenMapDiscovery_v1` (account-wide); attribute `MapPos`
- **Doc:** [server.md](server.md)

## Waygates and the Ways

- **Server:** `ServerScriptService/WaygateServer`, `Services/WaygateSessions`, `Services/BlackWindService`
- **Client:** `Controllers/WaygateController`, `Controllers/WaysAtmosphere`
- **Shared:** `Shared/WaygateConfig`, `Shared/WaygateOpeningPose`, `Shared/BlackWindSwarm`, `ReplicatedStorage/WaygateScenes`, `ReplicatedStorage/WaygateEffectTemplates`
- **Remotes:** `WaygateEvent`
- **World:** `Workspace/Ways`, `Workspace/AielWaste`
- **Doc:** [world.md §2](world.md)

## The Inn

- **Server:** `Server/InnTeleport`, `Server/InnResidents`
- **Client:** `SPS/InnTravelClient`
- **Remotes:** `InnTravel`, `VillageSpeech`
- **World:** `Edmond's Field/TheInn`, `InnResidents`, `InnTeleportOutside`, `InnTeleportInside`
- **Doc:** [world.md §2](world.md)

## Village NPCs and teachers

- **Server:** `Services/VillageNPCService`, `Server/VillageTeachers`, `Services/VillageDamageService`, `Services/VillageCarryService`, `Services/NPCOutfitService`, `Services/GuardService`, `Services/ChannelerNPCService`, `Services/ChannelerNPCSpells`
- **Client:** `SPS/VillageNPCController`, `Controllers/VillageConversationController`
- **Shared:** `Shared/VillageTeachingConfig`, `Shared/VillageDialogueConfig`, `Shared/VillagePersonalityConfig`, `Shared/NPCWeaponPoses`
- **Remotes:** `VillageSpeech`, `VillageConversation`
- **World:** `Edmond's Field/NPCMarkers`, `Workspace/NPC`, `ServerStorage/VillageNPCAssets`, `ServerStorage/ChannelerNPCAssets`
- **Doc:** [server.md §9.10](server.md)

## Trollocs

- **Server:** `Services/Trollocs/*` (TrollocService, TrollocSpawnService, TrollocRaidDirector, TrollocRaidService, AI modules, TrollocConfig, TrollocDevCommands), `Services/TrollocEquipmentService`
- **Client:** `SPS/OrcMovementVisualController`, `SPS/DetectionUIController`, `SPS/TrollocDebugOverlay`, `SPS/OrcTutorialVisibility`
- **Shared:** `Shared/TrollocCodeClips`, `Shared/TrollocSoundBank`
- **Assets:** `ReplicatedStorage/Assets/Trolloc`
- **Remotes:** `VillageSpeech` (raid lines), `BurnoutDeathVisual`
- **World:** `Workspace/TrollocSpawnRegions` (tag `TrollocSpawnRegion`), `Workspace/spawns` (settlement buffer)
- **Doc:** [server.md §9.10](server.md)

## Day/night, weather and ambience

- **Server:** `Services/DayNightService`, `Services/TempestWeatherService`, `Server/TempestReadyWeather`, `Server/WovenAmbience`
- **Client:** `Controllers/TempestWeatherController`, `Controllers/TempestCameraSway`, `SPS/MapAmbientController`, `SPS/MakingFogScreen`
- **Shared:** `Shared/DayNightConfig`, `Shared/SoundConfig`
- **Data:** workspace attributes `DayNightStartClock`, `DayNightEpoch`, `DayNightClock`
- **Doc:** [world.md §4](world.md)

## Water and drowning

- **Server:** `Services/DrowningService`, `Services/WaterBreathingService`, `Services/TerrainWaterService`, `Abilities/Drowning`
- **Client:** `SPS/DrowningController`, `Controllers/SwimmingScreenController`, `Controllers/Drowning*Controller`, `Controllers/RawWaterSourceController`
- **Remotes:** `DrowningVisual`, `DrowningCastApproved`, `DrowningRelease`
- **Doc:** [abilities.md](abilities.md)

## Admin and moderation

- **Server:** `Services/AdminService`, `Services/AdminConfig`, `Services/AdminFlightService`, `Services/GroupRoleService`
- **Client:** `SPS/AdminController`, `SPS/AdminFlightController`
- **Shared:** `Shared/AdminAutocompleteConfig`, `Shared/FlightConfig`
- **Remotes:** `AdminRequest` (RF), `AdminNotice`
- **Data:** `WovenModeration_v1`, `WovenPanelAllow_v1`; topics `WovenModerationChanged_v1`, `WovenAnnounceAll_v1`, `WovenPanelChanged_v1`, `WovenAdminDirect_v1`
- **Doc:** [server.md §9.7](server.md)

## Analytics

- **Server:** `Services/FunnelAnalyticsService`, `Server/FunnelAnalyticsServer`, `Services/WeaveCastLog`
- **Data:** AnalyticsService funnels `WovenSession_v1`, `WovenTutorial_v4`, `MarksShop_v1`; `LogEconomyEvent`
- **Doc:** [server.md §5.1](server.md)

## Missions (stub)

- **Server:** `Server/MissionsServer` (pushes empty state)
- **Client:** none
- **Remotes:** `MissionsChanged`, `MissionsReady` (no client side)
- **Doc:** [server.md §8](server.md)

## Visibility and performance options

- **Client:** `Controllers/LowDeviceModeController`, `SPS/MapAmbientController`, `Controllers/FoldedLightVisualController`, `Controllers/WaysAtmosphere`, every `WeaveVisibility` consumer
- **Shared:** `Shared/VisibilityRules`, `Shared/LocalVisibilityMask`, `Shared/WeaveVisibility`, `Shared/IncrementalDescendantScan`, `Shared/CasterActors`
- **Data:** `Setting_LowDevice`
- **Doc:** [client.md §6](client.md)
