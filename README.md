# Catch 2 Cash

A Silly Goose Studios production.

Throw your net, sell fish to the townsfolk, then spend the cash to automate everything: net cranes, trawlers, a delivery chain to the stall, a hired seller, and a chain that delivers right to people's homes. Buy the ship to sail to the next level.

## Play

Double-click `index.html`. It needs no install, server, or internet connection. Progress saves automatically in the browser.

| Action | Control |
|---|---|
| Throw net | Click the water, or press Space to auto-aim |
| Walk | Click land, or use WASD / arrow keys |
| Fish food (costs cash, draws fish to one spot) | Fish Food button or F, then click the water |
| Upgrade fish food | Time and Quality buttons under Fish Food |
| Add sellers, upgrade the cart or belt | Green buttons beside them, or the Upgrades panel |
| Chop wood (unlocks after hiring a stall seller) | Click a tree, then stand still next to it |
| Build the fireplace | Stand on its pad with enough wood and cash |
| Cook fish | Stand at the fire with raw fish; collect them when done |
| Sell cooked food | Stand in the dashed circle at the Hot Food shop |
| Hot Food belt and seller | Build them on the orange pad beside the shop |
| Sell fish | Stand in the dashed circle at the stall |
| Build | Stand on the glowing pad; cash drains into it |
| Level up a crane or trawler | Click its green button, or use the Upgrades panel |
| Upgrades | Upgrades button or U |
| Missions | Player Level badge or M |
| Zoom | Pinch on a phone, mouse wheel on a computer; drag to look around |
| Pause | Menu button or Esc |

On a phone, tap instead of clicking. The game is landscape only, so hold the phone sideways.

## Play on a phone

To try it on the same Wi-Fi, run `npm run serve` and open the "On your phone" address it prints. Your computer's firewall may ask for permission.

To install it as an app with offline play, the game needs a secure (HTTPS) web address. Upload this folder to any static host, such as GitHub Pages or Netlify, open that address on the phone, and choose **Add to Home Screen** or **Install app**.

If you add a new game file, also add it to `FILES` in `sw.js`.

## Player level and missions

Finishing missions earns XP and cash. There are 100 missions and 100 player levels, and they stay with you in every place. Edit them in `js/missions.js`.

## Add a place

Open `js/levels.js`, copy a block in `CTC.LEVELS`, and edit it. The comment at the top of that file explains every option. The last build in a level must have the type `ship`. New places appear in the game automatically.

## Files

- `js/levels.js`: levels, fish, build order, upgrades, map layout
- `js/game.js`: game rules and simulation
- `js/art.js`, `js/render.js`: all drawing (no image files)
- `js/audio.js`: synthesized sound and music (no audio files)
- `js/ui.js`, `css/style.css`: menus and HUD
- `js/main.js`: input, camera and the game loop
- `js/splash.js`: the launch sequence (the goose and pond art are in `index.html`, the animation in `css/style.css`)
- `manifest.webmanifest`, `sw.js`, `icons/`: installing and offline play
- `server.js`: local server for phone testing
- `fonts/`: Righteous for the studio name and Bungee for the game logo (both SIL Open Font License, see the license files there)
