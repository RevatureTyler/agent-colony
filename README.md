# Agent Colony

A tiny desktop dashboard for your Claude Code projects. Register project folders,
see them as tiles on a hex grid, and click one to drop straight into a `claude`
session in that directory.

## Requirements

- [Node.js](https://nodejs.org/) 18+
- [Claude Code](https://claude.com/claude-code) installed and on your `PATH` (`claude` command)

## Run it

```bash
npm install
npm start
```

## Build a standalone Windows app

```bash
npm run dist
```

Produces an installer in `dist/`.

## How it works

- "Add project" opens a folder picker; the folder is registered locally (`projects.json` in the app's user data directory).
- Clicking a tile spawns a terminal window running `claude` in that project's directory.
- A tile shows "session open" while that terminal process is alive.

## Credits

Two villager models in `assets/models/` were downloaded from Sketchfab and
added under a license permitting redistribution:

- `fantasy-villager.glb` — TODO: add creator name / source link
- `woman-villager.glb` — TODO: add creator name / source link

## Roadmap ideas

- Richer status (blocked / needs input) once Claude Code exposes session state
- Embedded terminal instead of spawning a separate window
- Multiple "planets" (tags/groups) for organizing many projects
