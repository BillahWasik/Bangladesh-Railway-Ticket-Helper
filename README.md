# BR Ticket Helper (Chrome Extension)

A high-performance Google Chrome extension (Manifest V3) designed to streamline and automate ticket booking on Bangladesh Railway's official portal ([eticket.railway.gov.bd](https://eticket.railway.gov.bd)).

## Key Features

- **Emerald Transit UI Design System**: Built with modern CSS design tokens supporting both crisp Light Mode and Obsidian Dark Mode.
- **Smart Station Picker**: Comprehensive verified dropdown of 137 Bangladesh Railway stations categorized into `★ Popular Hubs` and alphabetical stations, preventing misspelled search parameters.
- **Dynamic Multi-Coach Seat Partitioning**: When a single coach doesn't have enough seats (e.g. 4 seats needed but coaches only have 2 or 3), mathematically splits seats across coaches (e.g. 2+2, 2+1, 1+1) and automatically switches coaches during seat selection.
- **8:00 AM Automated Booking Scheduler**: Alarms API integration to pre-arm and auto-launch search queries at the exact 8:00 AM ticket release window.
- **Fallback Class Priority Matrix**: Define primary class (e.g. `SNIGDHA`) and fallback priority order (e.g. `S_CHAIR`, `AC_B`) so available seats are never missed.
- **Auto-Refresh & Hold Protections**: Automatically refreshes train search listings when seats are sold out, and tracks seat hold cooldown timers.
- **Gateway Auto-Selection**: Pre-selects preferred payment gateways (bKash, Nagad, Rocket, Cards) upon reaching the checkout stage.

## Project Structure

```
├── manifest.json         # Extension Manifest V3 configuration
├── shared.js             # Shared helpers, station databases & date utilities
├── background.js         # Service worker handling alarms & background schedules
├── ui.css                # Obsidian Dark & Light design system styles
├── popup.html            # Extension popup layout
├── popup.js              # Popup controller, station picker & search triggers
├── options.html          # Full-page settings & automation dashboard
├── options.js            # Settings controller & storage sync
└── content/              # Content scripts injected into eticket.railway.gov.bd
    ├── badge.js          # In-page floating status HUD
    ├── disclaimer.js     # Safety & disclaimer overlay
    ├── hold.js           # Cooldown & session timer management
    ├── login.js          # Automated login form filling
    ├── payment.js        # Automated checkout & gateway selection
    ├── results.js        # Train search results scanner & auto-book trigger
    ├── seatmap.js        # Seat selection & multi-coach switching engine
    └── seatpick.js       # Mathematical seat allocation & grouping algorithm
```

## Installation

1. Clone or download this repository.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle switch in the top right corner.
4. Click **Load unpacked** and select the project directory.
5. The **BR Ticket Helper** icon will appear in your Chrome toolbar.

## Disclaimer

This extension is an open-source productivity assistant designed to help users navigate and book train tickets efficiently. It complies with standard browser automation practices and does not bypass captcha or official security mechanisms.
