# Catch 2 Cash

A Silly Goose Studios production, now in 3D with real human characters.

Throw your net, sell fish to the townsfolk, then spend the cash to automate everything: net cranes, trawlers, belts between the crate, stall, fire and shop, and hired sellers. Then cook fish for more cash. Buy the ship to sail to the next place.

## Play

Double-click `index.html`. It needs no install, server, or internet connection, only a browser with 3D graphics (WebGL 2) turned on. Progress saves automatically in the browser, and saves from the 2D version still work.

| Action | Control |
|---|---|
| Throw net | Click the water, or press Space to auto-aim |
| Walk | Click land, or use WASD / arrow keys |
| Fish food (costs cash, draws fish to one spot) | Fish Food button or F, then click the water |
| Upgrade fish food | Time and Quality buttons under Fish Food |
| Add sellers, upgrade the cart or belt | Blue arrow above them, or the Upgrades panel |
| Chop wood (unlocks after hiring a stall seller) | Click a tree, then stand still next to it |
| Hire woodcutters, up to 3 (unlocks after hiring a stall seller) | Green Hire button, then the blue arrow above the woodcutter, or the Upgrades panel |
| Start or continue a place, or reach a new player level | The game pauses on a new screen with fish leaping into a river and the missions to do next. Press Start |
| Build the fireplace | Stand on its pad with enough wood and cash |
| Cook fish | Stand at the fire with raw fish; collect them when done |
| Sell cooked food | Stand in the dashed circle at the Hot Food shop |
| Food seller | Build on the orange pad beside the shop |
| Belts | Upgrades panel, or the green buttons beside their routes |
| Sea Farm: fence, Cloud Kitchen, Hotel and delivery people (unlocks once only the ship is left to buy) | Green buttons, or the Upgrades panel |
| Buy the ship | Appears once the fence, Cloud Kitchen, Hotel and both delivery people are in place |
| Catch sea creatures | Net them inside the fence |
| Sell sea creatures | Stand in the dashed circle at the Cloud Kitchen or Hotel, or hire a delivery person for each and upgrade how much they hold |
| Sell fish | Stand in the dashed circle at the stall |
| Build | Stand on the glowing pad; cash drains into it |
| Level up a crane or trawler | Click the blue arrow above it, or use the Upgrades panel |
| Upgrades | In the left panel, or U |
| Move buildings (free) | Move Buildings button in the left panel, or B. Drag a building to its new spot, or tap it and then tap the spot. The stall, crate, fireplace, Hot Food shop, Cloud Kitchen, Hotel and cranes can all move, and belts and queues follow them. Cranes stay on the shore. Press Done moving to finish |
| Goal and player level | Arrow at the top centre, or T |
| Missions | Player Level badge at the top, or M |
| Zoom | Pinch on a phone, mouse wheel on a computer; drag to look around. Each place starts zoomed in on your character. Zoom all the way out to see the whole map, which reaches well beyond the first view on every side |
| Basket, fish food, missions, upgrades, sound and pause | Arrow on the left edge, or O |
| Pause | Menu button in the left panel, or Esc |

On a phone, tap instead of clicking. The game is landscape only, so hold the phone sideways.

## Play on a phone

To try it on the same Wi-Fi, run `npm run serve` and open the "On your phone" address it prints. Your computer's firewall may ask for permission.

To install it as an app with offline play, the game needs a secure (HTTPS) web address. Upload this folder to any static host, such as GitHub Pages or Netlify, open that address on the phone, and choose **Add to Home Screen** or **Install app**.

If you add a new game file, also add it to `FILES` in `sw.js`.

## Player level and missions

Finishing missions earns XP and cash. There are 100 missions and 100 player levels, and your level stays with you in every place. One mission runs at a time, and each is a job of 2 to 5 minutes, sized from how well you're doing when it starts. The timer at the top right shows the time left. Edit the kinds of mission in `js/missions.js`.

## Failing a place

You fail a place, and start it again from the beginning, if either of these happens:

- A mission's timer runs out.
- Too many customers walk away unhappy: 5 in Sunny Cove, 3 in Coral Lagoon, 1 in Frozen Fjord. Set this with `unhappyLimit` in `js/levels.js`.

Customers start coming once your first fish reaches the stall, and Hot Food customers once your first cooked fish reaches the shop. Nobody joins a line unless there is enough food on the counter for them, and without a food seller the Hot Food line only forms while you are standing at the shop. People already waiting can still run out of patience. Your player level and building positions stay when you fail.

## Add a place

Open `js/levels.js`, copy a block in `CTC.LEVELS`, and edit it. The comment at the top of that file explains every option. The last build in a level must have the type `ship`. New places appear in the game automatically.

## Files

- `js/levels.js`: levels, fish, build order, upgrades, map layout
- `js/game.js`: game rules and simulation
- `js/render.js`: matches the 3D world to the game each frame, and draws the labels above it
- `js/3d/stage.js`: camera, light, terrain and water
- `js/3d/people.js`: the people, their clothes and their animations
- `js/3d/models.js`: fish, sea creatures, buildings, boats and trees, built from code
- `js/layout.js`: where buildings stand, moving them, and what follows them
- `js/art.js`: the small 2D pieces (badges, buttons, fish icons) and how each person looks
- `js/vendor/`: generated files, the 3D engine and the people. Don't edit these. To remake them, follow the note at the top of `tools/build-3d-assets.mjs`
- `assets/CREDITS.txt`: credits and licenses for the models and the 3D engine
- `js/audio.js`: synthesized sound and music (no audio files)
- `js/ui.js`, `css/style.css`: menus and HUD
- `js/main.js`: input, camera and the game loop
- `js/splash.js`: the launch sequence (the goose and pond art are in `index.html`, the animation in `css/style.css`)
- `manifest.webmanifest`, `sw.js`, `icons/`: installing and offline play
- `tools/local-server.js`: local server for phone testing
- `fonts/`: Righteous for the studio name and Bungee for the game logo (both SIL Open Font License, see the license files there)
