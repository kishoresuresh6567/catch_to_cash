/* ==========================================================================
   LEVEL DATA - add new levels here. No other file needs to change.

   To add a level: copy a block in CTC.LEVELS, give it a new id, and edit it.
   - fish:   species in the water. `weight` is how common, `value` is the price,
             `size` is how big it looks. Add `food: N` for a fish that stays away
             unless the player throws food of quality N or better.
   - builds: purchased IN ORDER; each one appears as a glowing pad on the ground.
             The LAST build must have type "ship": paying it finishes the level.
   - `spot`: where the pad and the building go. See CTC.LAYOUT.spots below.

   Build types:
     rig      - net crane on the shore, drops fish in the crate automatically
     boat     - trawler that fishes at sea and unloads at the crate
     chain    - conveyor that delivers crate fish to the market stall
     cashier  - hires a seller, so customers are served without you
     home     - overhead chain that delivers stall fish to houses for a bonus
     ship     - ends the level

   Theme decor options: "palm", "coral", "pine".
   Theme weather options: null, "petals", "snow".
   ========================================================================== */
window.CTC = window.CTC || {};

CTC.LAYOUT = {
  width: 1280,
  height: 720,
  start: { x: 650, y: 400 },
  crate: { x: 640, y: 560 },
  stall: { x: 940, y: 455 },
  fire: { x: 665, y: 385 },
  shop: { x: 955, y: 650 },
  shopZone: { x: 862, y: 678, r: 62 },
  hotPad: { x: 830, y: 600 },
  hotBeltPath: [[625, 398], [586, 398], [586, 632], [872, 632]],
  shopQueue: { x: 1050, y: 648, gap: 44, max: 5 },
  trees: [[715, 95], [1235, 300], [770, 682], [1215, 668], [1110, 610], [750, 330]],
  stallZone: { x: 895, y: 515, r: 80 },
  queue: { x: 1010, y: 510, gap: 50, max: 6 },
  pier: { x0: 250, x1: 530, y0: 332, y1: 388 },
  ship: { x: 165, y: 530 },
  beltPath: [[668, 560], [760, 560], [760, 425], [858, 425]],
  cable: { y: 205, x0: 835, x1: 1190, stallX: 1005, stallY: 305 },
  houses: [{ x: 880, y: 165 }, { x: 1030, y: 160 }, { x: 1180, y: 168 }],
  spots: {
    rigA: { x: 560, y: 170 },
    rigB: { x: 560, y: 640 },
    rigC: { x: 570, y: 285 },
    rigD: { x: 560, y: 480 },
    boatA: { x: 650, y: 280 },
    boatB: { x: 650, y: 660 },
    chain: { x: 700, y: 465 },
    cashier: { x: 1085, y: 415 },
    home: { x: 940, y: 275 },
    dock: { x: 290, y: 360 }
  }
};

CTC.UPGRADES = [
  { id: "sellers", group: "cart", name: "More Sellers", desc: "Another seller: faster service, more customers", lockedText: "Hire your first seller on the pad", base: 150, growth: 2.5, max: 3, needs: ["cashier"] },
  { id: "cart", group: "cart", name: "Better Cart", desc: "Holds 15 more fish, all fish sell for 10% more", base: 100, growth: 2.6, max: 4 },
  { id: "belt", group: "cart", name: "Faster Belt", desc: "Moves fish quicker and sends more per minute", lockedText: "Build the Delivery Chain first", base: 80, growth: 2.4, max: 4, needs: ["chain"] },
  { id: "hotSellers", group: "hot", name: "More Food Sellers", desc: "Another seller: faster service, more customers", lockedText: "Hire your first food seller on the pad", base: 150, growth: 2.5, max: 3, needs: ["hotSeller"] },
  { id: "hotCart", group: "hot", name: "Better Food Shop", desc: "Holds 10 more meals, cooked fish sell for 10% more", lockedText: "Build the fireplace first", base: 100, growth: 2.6, max: 4, needs: ["fire"] },
  { id: "hotBelt", group: "hot", name: "Faster Food Belt", desc: "Moves cooked fish quicker and sends more per minute", lockedText: "Build the Hot Food Belt first", base: 80, growth: 2.4, max: 4, needs: ["hotBelt"] },
  { id: "grill", group: "hot", name: "Bigger Grill", desc: "2 more grill spaces, cooks 10% faster", lockedText: "Build the fireplace first", base: 60, growth: 2.3, max: 4, needs: ["fire"] },
  { id: "net", name: "Wider Net", desc: "Bigger throw, +1 fish per throw", base: 15, growth: 2.1, max: 6 },
  { id: "bag", name: "Bigger Basket", desc: "Carry 2 more fish, up to 20", base: 20, growth: 2.0, max: 7 },
  { id: "boots", name: "Fast Boots", desc: "Walk 12% faster", base: 25, growth: 2.0, max: 5 },
  { id: "price", name: "Fresh Prices", desc: "All fish sell for 15% more", base: 60, growth: 2.2, max: 8 },
  { id: "foodTime", name: "Longer-Lasting Food", desc: "Food lasts 4 seconds longer", base: 15, growth: 2.0, max: 6 },
  { id: "foodQuality", name: "Better Food Quality", desc: "Attracts bigger fish, costs more per throw", base: 40, growth: 2.4, max: 5 },
  { id: "rig", name: "Oiled Gears", desc: "Machines catch 15% faster", base: 120, growth: 2.2, max: 6, needs: ["rig", "boat"] },
  { id: "traffic", name: "Town Signs", desc: "Customers arrive 15% faster", base: 200, growth: 2.2, max: 5 }
];

// Each crane and trawler levels up on its own. Level N catches N fish each time.
// Costs are multiplied by the level's costScale.
CTC.CATCHER_UPGRADE = { max: 6, growth: 2.2, rig: 40, boat: 150 };

// Thrown food draws fish to one spot. Cost is multiplied by the level's costScale.
// rareBoost makes rare fish that many times more likely among the extra fish.
// Each Time level adds timePerLevel seconds; each Quality level adds extraPerQuality fish.
CTC.FISH_FOOD = { cost: 5, duration: 12, timePerLevel: 4, pull: 380, extraFish: 8, extraPerQuality: 2, rareBoost: 3 };

// Chop trees for wood, build a fireplace, cook fish, and sell them for more.
// Fishing comes first: all of this unlocks in each place after hiring the stall seller.
// buildCash is multiplied by the level's costScale.
CTC.COOKING = {
  buildWood: 6, buildCash: 15, woodCap: 20, logsPerTree: 3, chopTime: 0.45, regrow: 30,
  grillSlots: 4, cookTime: 5, fishPerLog: 3, pileCap: 20, priceMult: 2.5,
  dinerEvery: 3, dinerMaxWant: 2,
  hotBeltCost: 150, hotSellerCost: 300
};

CTC.LEVELS = [
  {
    id: "sunny-cove",
    name: "Sunny Cove",
    tagline: "One net, one stall, big dreams.",
    costScale: 1,
    fishCount: 26,
    machineEvery: 3.2,
    customerEvery: 2.0,
    theme: {
      deep: "#0a6aa6", mid: "#159bc0", shallow: "#43d6cf", foam: "#ffffff",
      sand: "#f6dd9f", sandDark: "#e6c47c", ground: "#8ed06a", groundDark: "#73bb58",
      path: "#d9c6a0", awning: "#e4574c", decor: "palm", seabed: "rock",
      weather: null, tint: null
    },
    fish: [
      { name: "Anchovy", value: 2, weight: 35, size: 0.55, speed: 70, body: "#c4dce8", belly: "#f4fbff", fin: "#8db4c9" },
      { name: "Sardine", value: 3, weight: 30, size: 0.75, speed: 62, body: "#9fd3ea", belly: "#eef9ff", fin: "#5da7c9" },
      { name: "Mackerel", value: 5, weight: 22, size: 0.95, speed: 54, body: "#4e9f8f", belly: "#dff4e6", fin: "#2f7468" },
      { name: "Snapper", value: 9, weight: 10, size: 1.2, speed: 46, body: "#ef7461", belly: "#ffe1d4", fin: "#c44a3c" },
      { name: "Goldfin", value: 40, weight: 2, size: 1.1, speed: 72, body: "#ffcd3c", belly: "#fff3b8", fin: "#e49a0f", rare: true },
      { name: "Grouper", value: 25, weight: 8, size: 1.6, speed: 40, body: "#8a6d4f", belly: "#e8d8c0", fin: "#5f4a35", food: 1 },
      { name: "Tuna", value: 60, weight: 5, size: 2.0, speed: 50, body: "#2f5f8f", belly: "#dbe9f3", fin: "#f0c040", food: 3 },
      { name: "Marlin", value: 150, weight: 2, size: 2.5, speed: 58, body: "#23407a", belly: "#cfe0f0", fin: "#4aa8d8", food: 5 }
    ],
    builds: [
      { type: "rig", spot: "rigA", name: "Auto-Net Crane", cost: 30, says: "It catches fish for you. Collect them from the crate!" },
      { type: "rig", spot: "rigB", name: "Second Crane", cost: 90, says: "Two cranes, twice the fish." },
      { type: "chain", spot: "chain", name: "Delivery Chain", cost: 220, says: "Fish now ride from the crate to the stall on their own." },
      { type: "cashier", spot: "cashier", name: "Hire a Seller", cost: 400, says: "Customers get served while you're away." },
      { type: "rig", spot: "rigC", name: "Third Crane", cost: 650, says: "More fish on the chain." },
      { type: "home", spot: "home", name: "Home Delivery Chain", cost: 1000, says: "Fish go straight to people's homes, at a 50% bonus!" },
      { type: "rig", spot: "rigD", name: "Fourth Crane", cost: 1400, says: "The cove runs itself now." },
      { type: "ship", spot: "dock", name: "Buy the Ship", cost: 2500 }
    ]
  },
  {
    id: "coral-lagoon",
    name: "Coral Lagoon",
    tagline: "Sunset waters and pricier fish.",
    costScale: 5,
    fishCount: 28,
    machineEvery: 3.0,
    customerEvery: 1.9,
    theme: {
      deep: "#3c2f8f", mid: "#a2478f", shallow: "#ff9a86", foam: "#ffe9d6",
      sand: "#f8cf9e", sandDark: "#e5a877", ground: "#c8a763", groundDark: "#b08e50",
      path: "#c79a7a", awning: "#7b4fd0", decor: "coral", seabed: "coral",
      weather: "petals", tint: "rgba(255,120,70,0.07)"
    },
    fish: [
      { name: "Damselfish", value: 8, weight: 35, size: 0.55, speed: 68, body: "#6fb7ff", belly: "#e6f4ff", fin: "#3f7fd0" },
      { name: "Angelfish", value: 12, weight: 30, size: 0.8, speed: 60, body: "#ffb347", belly: "#fff0c9", fin: "#e9722a" },
      { name: "Parrotfish", value: 20, weight: 22, size: 1.0, speed: 52, body: "#3ad6a8", belly: "#d7ffe9", fin: "#2c8ed6" },
      { name: "Lionfish", value: 40, weight: 10, size: 1.2, speed: 44, body: "#e0486c", belly: "#ffe0e4", fin: "#8a2343" },
      { name: "Pearl Ray", value: 180, weight: 3, size: 1.25, speed: 74, body: "#f5edff", belly: "#ffffff", fin: "#c5a7ff", rare: true },
      { name: "Barracuda", value: 100, weight: 8, size: 1.6, speed: 56, body: "#8fa6b5", belly: "#eef4f7", fin: "#54697a", food: 1 },
      { name: "Wrasse", value: 250, weight: 5, size: 2.0, speed: 42, body: "#2fa89a", belly: "#d5f5ee", fin: "#1f6f8a", food: 3 },
      { name: "Reef Shark", value: 650, weight: 2, size: 2.5, speed: 54, body: "#7c8a99", belly: "#f0f3f6", fin: "#566372", food: 5 }
    ],
    builds: [
      { type: "rig", spot: "rigA", name: "Auto-Net Crane", cost: 150, says: "Back in business." },
      { type: "chain", spot: "chain", name: "Delivery Chain", cost: 500, says: "The chain is rolling again." },
      { type: "rig", spot: "rigB", name: "Second Crane", cost: 1000, says: "Keep it coming." },
      { type: "cashier", spot: "cashier", name: "Hire a Seller", cost: 2000, says: "Your seller is on duty." },
      { type: "boat", spot: "boatA", name: "Trawler", cost: 4000, says: "A trawler fishes at sea and hauls big catches to shore!" },
      { type: "home", spot: "home", name: "Home Delivery Chain", cost: 7000, says: "The whole lagoon gets delivery." },
      { type: "boat", spot: "boatB", name: "Second Trawler", cost: 11000, says: "A proper fleet." },
      { type: "ship", spot: "dock", name: "Buy the Icebreaker", cost: 22000 }
    ]
  },
  {
    id: "frozen-fjord",
    name: "Frozen Fjord",
    tagline: "Bitter cold, priceless catch.",
    costScale: 25,
    fishCount: 30,
    machineEvery: 2.8,
    customerEvery: 1.8,
    theme: {
      deep: "#123a63", mid: "#2b77a3", shallow: "#a9e3ee", foam: "#ffffff",
      sand: "#e9f2f8", sandDark: "#c9dcea", ground: "#f7fbff", groundDark: "#dbe9f3",
      path: "#b7cbda", awning: "#2f7fd6", decor: "pine", seabed: "ice",
      weather: "snow", tint: "rgba(70,130,220,0.08)"
    },
    fish: [
      { name: "Capelin", value: 35, weight: 35, size: 0.55, speed: 66, body: "#b8cfd9", belly: "#f3fafc", fin: "#7f9dab" },
      { name: "Arctic Char", value: 60, weight: 30, size: 0.8, speed: 58, body: "#d98c7a", belly: "#fff0e6", fin: "#a85d4e" },
      { name: "Cod", value: 100, weight: 22, size: 1.05, speed: 48, body: "#9aa77a", belly: "#f4f2d8", fin: "#6c7853" },
      { name: "Halibut", value: 200, weight: 10, size: 1.3, speed: 40, body: "#5c6b80", belly: "#dfe7ee", fin: "#3b4758" },
      { name: "Aurora Salmon", value: 900, weight: 3, size: 1.15, speed: 78, body: "#6ff0c2", belly: "#e8fff7", fin: "#b06dff", rare: true },
      { name: "Wolffish", value: 500, weight: 8, size: 1.6, speed: 38, body: "#6a6f7c", belly: "#d8dbe2", fin: "#44485a", food: 1 },
      { name: "King Salmon", value: 1250, weight: 5, size: 2.0, speed: 52, body: "#c9606a", belly: "#ffe6e0", fin: "#8c3a48", food: 3 },
      { name: "Greenland Shark", value: 3200, weight: 2, size: 2.5, speed: 34, body: "#4c5a68", belly: "#c9d3dc", fin: "#333e4a", food: 5 }
    ],
    builds: [
      { type: "rig", spot: "rigA", name: "Auto-Net Crane", cost: 800, says: "Ice-proof gears, same great catch." },
      { type: "chain", spot: "chain", name: "Delivery Chain", cost: 2500, says: "The chain keeps moving in the cold." },
      { type: "cashier", spot: "cashier", name: "Hire a Seller", cost: 5000, says: "Your seller's bundled up and ready." },
      { type: "boat", spot: "boatA", name: "Ice Trawler", cost: 12000, says: "Big hauls from deep water." },
      { type: "rig", spot: "rigB", name: "Second Crane", cost: 20000, says: "More fish for the chain." },
      { type: "home", spot: "home", name: "Home Delivery Chain", cost: 35000, says: "Hot deliveries for cold neighbours." },
      { type: "boat", spot: "boatB", name: "Second Ice Trawler", cost: 60000, says: "You own the fjord." },
      { type: "ship", spot: "dock", name: "Buy the Flagship", cost: 120000 }
    ]
  }
];
