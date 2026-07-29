# Drive — Car Expense Tracker

Single-file web app for tracking every rupee one car costs. Built for a
Volkswagen Taigun (2024) on UP81DE4446, but the vehicle name and plate are
editable from the More screen.

**Live:** enable GitHub Pages on this repository (Settings → Pages → Deploy from
branch → `main` / root). The app is `index.html`; there is no build step.

## What it does

- **Fuel log** — litres are computed from amount ÷ price per litre, never typed.
  Each fill shows its own km/l with an up/down trend against the previous fill,
  plus cost per km. The earliest fill on record shows "first fill".
- **Service history** — either a next-service date *or* an odometer reading,
  never both. Whichever is set drives the reminder on Home.
- **Other expenses** — insurance, challans, tolls, EMI, accessories, other.
  Searchable, category-filterable, tap an entry to edit it.
- **Carpool split** — splits a month of running costs across riders and exports
  the breakdown as a shareable PNG receipt.
- **Home** — drag-to-spin vehicle hero, odometer readout, progress to next
  service, average mileage, monthly spend, renewal reminders, category doughnut
  and a 12-month bar chart.

## Formulas

```
litres      = amount / pricePerLitre

# per fill, sorted by odometer ascending, i > 0
distance    = odometer[i] - odometer[i-1]
kmpl        = distance / litres[i]
costPerKm   = amount[i] / distance
trend       = kmpl[i] >= kmpl[i-1] ? "up" : "down"

avgMileage  = mean(kmpl for every fill except the first)

# carpool split
fuelPerDay     = kmPerDay / mileage
fuelCostPerDay = fuelPerDay * petrolPrice
fullDailyCost  = fuelCostPerDay + maintenancePerDay + (tollPerMonth / runDays)
totalMonthly   = fullDailyCost * runDays
perHead        = round(totalMonthly / names.length)
```

Reference case: 13 km/l, ₹103/l, 80 km/day, ₹50/day maintenance, ₹360/month
toll, 23 run-days, 5 riders → ₹699.50/day, ₹16,088.46/month, ₹3,218/head.

## Data

Everything is stored in the browser. Nothing is sent anywhere; there is no
backend and no account. "Reset to sample data" in More restores the demo
records (Aug 2025 – Jul 2026). CSV export is on the same screen.

## Stack

Plain HTML, CSS and JavaScript in one file. The vehicle hero is an eight-frame
turntable (0°–315°) embedded as WebP, spun by pointer drag with arrow-key
support and a slow idle rotation that respects `prefers-reduced-motion`.
