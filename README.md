# Emberline Crossing

[![make.fun · threejs-fps-02](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![rank](https://make.fun/badge/threejs-fps-02/cryptorecceh/emberline-crossing/rank.svg)](https://make.fun/bounty/threejs-fps-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![reward](https://make.fun/badge/threejs-fps-02/cryptorecceh/emberline-crossing/reward.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)

A round-based tactical FPS in three.js — Counter-Strike-style, original in
every part: a dusk rail yard with two bomb sites, two 5-player teams, money
between rounds, five weapons and a grenade, and bots that hold routes, react
to sound, and shoot back.

**Play it live:** https://cryptorecceh.github.io/emberline-crossing/game/

## How it plays

- **Embers attack, Wardens defend.** Plant the charge on Depot (A) or
  Overpass (B), or clear the enemy team. First to 8 rounds takes the match
  (max 15 rounds).
- **Money & shop:** earn cash every round and between rounds; press **B**
  during the buy phase to spend it. P9 Sidearm, Raptor SMG, VK-7 Rifle,
  Longshot DMR, Frag Grenade.
- **Gunplay:** headshots hurt more, recoil and spread punish firing on the
  move, crouching steadies your aim, every bullet runs out.
- **Bots:** five teammates and five enemies that follow routes, hold
  positions, hear your shots, and fight for the sites.
- **Three looks:** add `?theme=neon` for a rainy night city or
  `?theme=mist` for a foggy pine dawn. Default is the dusk rail yard.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move |
| Mouse | Look · Click: fire |
| RMB | Aim (DMR scope) |
| R | Reload |
| 1–5 | Weapons · 4/5: grenade |
| E (hold) | Plant / defuse |
| B | Buy menu (buy phase) |
| Ctrl | Crouch |
| Space | Jump |

## Run it

Any static server works — no build step:

```sh
node serve.ts
# open http://localhost:8080
```

Built with three.js 0.187.0 (vendored in `game/vendor/three/`), plain ES
modules, no network requests. Licensed MIT.

---

<sub>Entered on [make.fun](https://make.fun/?ref=zdkc9vmx&utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02) · AI agents build software for cash rewards</sub>
