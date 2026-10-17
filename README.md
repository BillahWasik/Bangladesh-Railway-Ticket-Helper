# BR Ticket Helper (Chrome Extension)

A high-performance Google Chrome extension (Manifest V3) designed to streamline and automate ticket booking on Bangladesh Railway's official portal ([eticket.railway.gov.bd](https://eticket.railway.gov.bd)).

## Key Features

- **Emerald Transit UI Design System**: Built with modern CSS design tokens supporting both crisp Light Mode and Obsidian Dark Mode.
- **Live Drop Countdown HUD**: High-frequency millisecond countdown display synchronized with real-time **Bangladesh Standard Time (BST)**, showing exact time until the next 8:00 AM / 2:00 PM ticket drop or active schedule.
- **Smart Station Picker & Favorite Routes**: Comprehensive verified dropdown of 137 Bangladesh Railway stations categorized into `★ Popular Hubs` and alphabetical stations, with 1-click popular route presets (*Dhaka ⇄ Cox's Bazar*, *Dhaka ⇄ Chattogram*, *Dhaka ⇄ Sylhet*, *Dhaka ⇄ Rajshahi*).
- **Dual-Zone Ticket Drop Engine (8 AM Western & 2 PM Eastern)**: Automatically detects whether your route belongs to the Eastern Zone (2:00 PM release) or Western Zone (8:00 AM release) and presets the exact drop time.
- **Train Weekly Off-Day (ছুটির দিন) Smart Detector**: Warns you immediately if a preferred train (e.g. Suborno, Sonar Bangla, Cox's Bazar Express, Bonolota, Kalni, etc.) has its official weekly off-day on your selected journey date.
- **Sleeper Berth Preferences**: Select between Lower Berth (preferential for elderly/children) or Upper Berth on overnight sleeper trains.
- **Co-Passenger Autofill Manager**: Saves travel companion names and passenger types (Adult/Child) in settings to instantly auto-fill passenger fields (Seats 2, 3, 4) at checkout.
- **Direct Purchase Mode**: Configurable checkbox toggle to either automatically advance through checkout to OTP/payment or hold seats to inspect them before purchasing.
- **OTP Assistant & Auto-Submit**: Detects OTP arrival, plays an attention chime, focuses the OTP field, and automatically triggers submission once 6 digits are entered.
- **Web Audio Chimes**: Melodic sound alerts for available seat discovery during auto-refresh, OTP arrival, and booking completion.
- **Desktop Push Notifications**: Chrome desktop notifications (`chrome.notifications`) alert you even when Chrome is minimized or in another window.
- **Anti-Logout Session Keep-Alive**: Background heartbeat pings the railway portal every 4 minutes to prevent idle session logouts right before 8 AM / 2 PM drops.
- **Dynamic Multi-Coach Seat Partitioning**: When a single coach doesn't have enough seats, mathematically splits seats across coaches (2+2, 2+1, 1+1) and automatically switches bogies.
- **1-Click Profile Backup & Restore**: Export your complete configuration (login, co-passengers, payment gateways, preferences) to an encrypted JSON file and import it anytime.
- **Payment Gateway Auto-Advance**: Pre-selects preferred payment gateways (bKash, Nagad, Rocket, Cards) and advances into checkout without delay.

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
