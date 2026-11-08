# Woven documentation

This is the documentation for the Roblox game **Woven**. It was written from the live Studio place (Edit DataModel, read-only) on 2026-11-08.

Line numbers cite the source as of that date and drift as the code changes. If a cited line no longer matches, search by script name and function name.

Start with [../AGENTS.md](../AGENTS.md) for the rules of change.

## The game

Woven is an action RPG. On joining, the player sees a menu and picks a save slot, each with a class:

- **Channeler**: presses Channel, catches falling element buttons to gather threads, confirms them into a weave, and casts it.
- **Guardian** (called Warder in code): fights in melee with sword forms.

The world has three regions:

- the village of **Edmond's Field**, with the Inn;
- the **Aiel Waste**;
- **the Ways**, an interior reached through waygates.

Trollocs roam and raid the village at night. Players can link into circles, set wards, learn weaves from village teachers, earn Marks, join factions and fight for faction zones. New players go through a tutorial, the First Journey, in a reserved server.

## Quick facts

| Item | Value |
|---|---|
| Place | "[WARDERS] Woven", PlaceId 103140548975456, GameId 10652880207, group-owned |
| Source of truth | Roblox Studio only. No Rojo, no git |
| Live code | ~580 script containers, ~133k lines (not counting backups) |
| Server | Two entry points (`ServerMain`, `ServerBootstrap`), ~145 service modules, ~46 ability modules |
| Client | ~190 independent LocalScripts, no loader |
| Shared | ~138 modules in `ReplicatedStorage/Shared` |
| Network | ~138 remotes (92 authored, ~46 created at runtime), plus 7 client BindableEvents |
| Players | MaxPlayers 60, `CharacterAutoLoads = false`, R15 avatars |
| Streaming | StreamingEnabled, TargetRadius 1024 |
| Saves | 2 save slots by default (up to 10 bought), each Channeler or Guardian |

## Doc map

| Doc | Read it to learn |
|---|---|
| [../AGENTS.md](../AGENTS.md) | The rules for changing the game |
| [architecture.md](architecture.md) | How the pieces fit: layers, boot, state, networking, data flow |
| [systems.md](systems.md) | Which scripts own a given feature, on server, client and shared |
| [server.md](server.md) | Server boot, services, persistence, remotes handled, economy, admin, NPCs |
| [abilities.md](abilities.md) | Channeling, weaves, elements, circles, wards, the cast pipeline, adding a weave |
| [shared.md](shared.md) | The remote catalogue, shared modules, and the join, menu, save and tutorial flow |
| [client.md](client.md) | Client controllers, input, UI ownership, the VFX pattern |
| [world.md](world.md) | Map regions, named anchors, tags, place settings, ServerStorage contents |
| [workflow.md](workflow.md) | How to make, check and ship a change; backups; cleanup |
| [ui-kit/index.html](ui-kit/index.html) | The UI kit (open in a browser): the target design we build toward in game (tokens, components, HUD, channeling, Book, mobile, Guardian and entry screens), then the live UI rendered from the place, each live screen marked kept, reworked or no target yet |

## Glossary

The exact rules are in [abilities.md](abilities.md) and [server.md](server.md).

| Term | Meaning |
|---|---|
| Channeler | The magic class. Save slot 1 is always a Channeler. |
| Guardian / Warder | The sword melee class. Gated by `HasAbility_warder`. Code still uses "Warder". |
| Channel | The press toggle (default Q) that puts the player in the `Channeling` state. |
| Element | Fire, Air, Water, Earth, Spirit. Caught with the element keys (default F/G/V/R/C). |
| Thread | One caught element. Drawn around the caster by `ThreadVisualController`. |
| Weave | A recipe of threads, matched by `WeaveService`. Confirm (default X or right mouse) readies it. |
| WeaveReady | The `CombatState` in which a confirmed weave is held, ready to cast with the primary action. |
| CombatState | The player attribute state machine: Idle, PvP, Channeling, WeaveReady, Casting, BurnedOut, Dead. |
| Quick slot / quickcast | Keys 1–5. They cast learned weaves directly, with cooldowns. |
| Tied weave | A ready weave kept tied (level 100+ and the Beyond the Pattern pass). |
| Raw element | An element used directly: Raw Air hold and push, Raw Fire drawing, Raw Water, Raw Earth, Raw Spirit dreamwalking. |
| Circle | A linked group of channelers. The leader casts circle weaves with pooled power. |
| Ward | A protective weave. It can be set only at `WardZones`; there is also a held ward. |
| Custom weaving | Experimenting with your own recipes from the book (the Loom). |
| Burnout | The state reached by overspending mana (`BurnedOut`). |
| Stilling / Stilled | Being cut off from channeling for a time, tracked account-wide. |
| Mana, Stamina | The casting resource and the sprint resource, shown as player attributes. |
| Marks | The currency. It buys shop items, titles, bounties and boosts. |
| Faction | A player group, account-wide. Factions fight over `FactionZoneEdmondsField` zones. |
| Book | `NewBookHUD`: the in-game journal with basics, weaves, skills, titles and settings. |
| First Journey | The tutorial. It runs in a reserved server. |
| Trollocs | The AI enemies. They spawn in `TrollocSpawnRegions` and raid at night. |
| The Ways / Waygate | Travel between Edmond's Field and the Aiel Waste, from level 75. |
| Guardian Bond | A bond between a Channeler and a Guardian. |
| Beyond the Pattern | A game pass that raises the level cap. |

## Where to look

| Task | Start here |
|---|---|
| Add or tune a weave | [abilities.md](abilities.md), "How to change this area" |
| Add a remote | [shared.md §7](shared.md), [../AGENTS.md](../AGENTS.md) |
| Add a saved field | [server.md §9.3](server.md) |
| Add a server service | [server.md §9.1](server.md) |
| Add a client controller or HUD element | [client.md §9](client.md) |
| Add a keybind | [client.md §9](client.md), [shared.md §7](shared.md) |
| Add an admin command | [server.md §9.7](server.md) |
| Add a promo code | [server.md §9.6](server.md) |
| Move or rename map objects | [world.md §2](world.md), [workflow.md §4](workflow.md) |
| Ship a change | [workflow.md](workflow.md) |

## Top open risks

These were found while writing the docs. Each one links to its detail.

1. Main profile saves have no autosave and no session lock ([server.md §10](server.md)).
2. A Discord webhook token is stored in `Services/AdminConfig` ([server.md §10](server.md)).
3. Two server entry points start in no defined order ([server.md §3](server.md)).
4. Dead and half-dead remotes still send traffic ([shared.md §6](shared.md)).
5. Client per-frame load grows with player count: 191 per-frame hooks ([client.md §10](client.md)).
6. About 7 MB of backups sit inside the place file ([world.md §6](world.md)).
