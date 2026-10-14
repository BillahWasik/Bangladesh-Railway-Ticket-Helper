// Parts 2b-2e: when a seat map is open, read its coaches and seats and outline the seats that
// best match the user's seat rules. Once per seat map, before any seat is selected, switch the
// Select Coach dropdown to a better coach (preferred, or the current one is short of seats);
// that only changes what the map shows. Seats are clicked (which holds them) only on a seat map
// opened by the extension's own BOOK NOW click after a "Search trains" click (BRTHFlow.seatPick).
// When every seat is selected, it highlights the Boarding Station and CONTINUE PURCHASE and stops.
(() => {
  const SETTLE_MS = 300;
  const MAX_WAIT_MS = 1500;
  const SWITCH_WAIT_MS = 8000;
  const SEAT_ARM_MAX_AGE_MS = 60 * 1000;
  const SEAT_CLICK_WAIT_MS = 10 * 1000;
  const MAX_COOLDOWN_S = 5 * 60;
  const COOLDOWN_BUFFER_S = 2;
  const POSITION_TEXT = { window: 'window ', aisle: 'aisle ', any: '' };
  const TOGETHER_TEXT = {
    'same row': 'Same row, across the aisle.',
    near: 'In neighbouring rows.',
    apart: 'Not together: no free seats close to each other.',
  };

  let timer = null;
  let pendingSince = 0;
  let lastSummary = null;
  let awaiting = null;           // { name, since } while the map loads the coach we switched to
  let picking = false;           // true while selectSeats() is clicking seats
  let autoSelecting = false;     // true while automated multi-coach selection is running
  let handedOff = null;          // seats we last scrolled CONTINUE PURCHASE into view for
  const selectedByCoach = new Map(); // coachName (lower) -> Set of seat labels

  injectStyles();
  // Selecting or deselecting a seat only changes its class, so watch class/disabled changes on
  // the seat map too, but not the brth-* classes this script adds itself (that would loop).
  new MutationObserver((records) => {
    if (records.some(matters)) schedule();
  }).observe(document.body, {
    childList: true, subtree: true, characterData: true,
    attributes: true, attributeFilter: ['class', 'disabled'], attributeOldValue: true,
  });
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.trip || changes.settings) {
      lastSummary = null;
      schedule();
    }
  });
  schedule();

  function matters(record) {
    if (record.type !== 'attributes') return true;
    if (!record.target.closest?.('app-seat-layout')) return false;
    if (record.attributeName !== 'class') return true;
    const siteClasses = (value) => (value ?? '').split(/\s+/).filter((c) => c && !c.startsWith('brth-')).sort().join(' ');
    return siteClasses(record.oldValue) !== siteClasses(record.target.getAttribute('class'));
  }

  function schedule() {
    const now = Date.now();
    if (!timer) pendingSince = now;
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      scan();
    }, now - pendingSince > MAX_WAIT_MS ? 0 : SETTLE_MS);
  }

  async function scan() {
    const layout = document.querySelector('app-seat-layout');
    const select = layout?.querySelector('select#select-bogie');
    if (!layout || !select) {
      clearHighlight();
      if (lastSummary) {
        BRTHBadge.hide('seats');
        BRTHBadge.hide('coach');
      }
      lastSummary = null;
      awaiting = null;
      handedOff = null;
      selectedByCoach.clear();
      autoSelecting = false;
      return;
    }

    const { trip, settings } = await BRTH.load(['trip', 'settings']);
    const rules = BRTH.seatRules(trip, settings);
    const coaches = readCoaches(select);
    const seats = readSeats(layout);

    // The seat labels ("KA-12") say which coach is really on screen; the dropdown can run ahead.
    const shownName = seats.find((s) => s.label)?.label.split('-')[0].toLowerCase() || '';
    const current = coaches.find((c) => c.name.toLowerCase() === shownName)
      ?? coaches.find((c) => c.selected) ?? coaches[0];
    const freeHere = seats.filter((s) => s.available).length;

    // Track selected seats in the current coach
    if (shownName) {
      const selectedHere = seats.filter((s) => s.selected).map((s) => s.label);
      selectedByCoach.set(shownName, new Set(selectedHere));
    }

    // Collect all selected seats across all coaches
    const allSelected = [];
    for (const set of selectedByCoach.values()) {
      for (const label of set) allSelected.push(label);
    }
    const totalSelected = allSelected.length;
    trackHold(totalSelected);

    // After switching coach, wait until the map shows the new coach's seats.
    if (awaiting) {
      if (shownName === awaiting.name.toLowerCase()) {
        awaiting = null;
      } else if (Date.now() - awaiting.since > SWITCH_WAIT_MS) {
        // Put the dropdown back so it matches the seats on screen.
        select.value = awaiting.fromValue;
        BRTHBadge.show(`Couldn't switch to coach ${awaiting.name}. Choose it in Select Coach yourself.`,
          'warn', 0, 'coach');
        awaiting = null;
      } else {
        return;
      }
    }

    const card = layout.closest('app-single-trip');
    const lines = [[
      card?.querySelector('.trip-name h2')?.textContent.replace(/\s+/g, ' ').trim(),
      card?.querySelector('.single-seat-class.selected .seat-class-name')?.textContent.trim(),
    ].filter(Boolean).join(' · ')].filter(Boolean);

    const others = coaches.filter((c) => c !== current && c.free > 0).map((c) => `${c.name} ${c.free}`);
    lines.push(`Coach ${current?.name ?? '?'}: ${freeHere} free. Other coaches: ${others.length ? others.join(', ') : 'none free'}.`);

    if (allSelected.length) {
      const total = layout.querySelector('#tickets_total')?.textContent.replace(/^\s*Total:\s*/i, '').trim();
      lines.push(`Selected: ${allSelected.join(', ')}${total ? ` · Total ${total}` : ''}.`);
    }

    const stillNeeded = rules.count - totalSelected;
    if (stillNeeded <= 0) {
      autoSelecting = false;
      takeSeatArm(card); // nothing left to select: use up permission
      clearHighlight();
      handOff(layout, allSelected, lines, settings);
      render(lines, 'info');
      return;
    }

    // Compute coach allocation plan using math rules:
    // If no single coach has enough: 4 -> [2, 2]; 3 -> [2, 1]; 2 -> [1, 1]
    const plan = (rules.splitCoaches !== false && BRTHSeats.planAllocations)
      ? BRTHSeats.planAllocations(coaches, rules.count, rules.coaches, current)
      : (BRTHSeats.pickCoach(coaches, rules.count, rules.coaches, current)
          ? [{ coach: BRTHSeats.pickCoach(coaches, rules.count, rules.coaches, current), count: rules.count }]
          : null);

    if (!plan || !plan.length) {
      lines.push(`No coach has free seats for your trip.`);
      clearHighlight();
      render(lines, 'warn');
      return;
    }

    const isSplit = plan.length > 1;
    if (isSplit) {
      const planDesc = plan.map((p) => `${p.count} in coach ${p.coach.name}`).join(' + ');
      lines.push(`Multi-coach split: allocating ${planDesc} (${totalSelected}/${rules.count} selected).`);
    }

    // Find the first coach in the plan whose quota is not yet met
    let targetItem = null;
    for (const item of plan) {
      const key = item.coach.name.toLowerCase();
      const countInCoach = selectedByCoach.get(key)?.size || 0;
      if (countInCoach < item.count) {
        targetItem = item;
        break;
      }
    }

    if (!targetItem) {
      autoSelecting = false;
      takeSeatArm(card);
      clearHighlight();
      handOff(layout, allSelected, lines, settings);
      render(lines, 'info');
      return;
    }

    // If we are not currently in the target coach, switch to it
    if (shownName && shownName !== targetItem.coach.name.toLowerCase()) {
      if (!awaiting) {
        const why = isSplit
          ? `allocated ${targetItem.count} seat${targetItem.count > 1 ? 's' : ''} here in multi-coach plan`
          : coachReason(targetItem.coach, rules);
        switchCoach(select, targetItem.coach, why);
        return; // Next scan reads the new coach
      }
    }

    // We are in the target coach!
    const inThisCoach = selectedByCoach.get(shownName)?.size || 0;
    const neededInThisCoach = targetItem.count - inThisCoach;
    const countNeededHere = Math.min(neededInThisCoach, stillNeeded);

    const selectedInThisCoach = seats.filter((s) => s.selected);
    const pick = selectedInThisCoach.length && rules.together
      ? BRTHSeats.pickNear(seats, selectedInThisCoach, countNeededHere)
      : BRTHSeats.pickSeats(seats, { ...rules, count: countNeededHere });

    clearHighlight();
    pick?.seats.forEach((s) => s.button.classList.add('brth-seat-pick'));

    // Auto-select seats if armed from results.js or continuing multi-coach flow
    const isArmed = takeSeatArm(card);
    if (!picking && (isArmed || autoSelecting) && settings?.autoPickSeats !== false) {
      autoSelecting = true;
      picking = true;
      selectSeats(layout, rules, countNeededHere, targetItem).finally(() => {
        picking = false;
        lastSummary = null;
        schedule();
      });
    }

    if (pick) {
      const labels = pick.seats.map((s) => s.label).join(', ');
      if (isSplit) {
        lines.push(`Best in ${targetItem.coach.name} (${countNeededHere} seat${countNeededHere > 1 ? 's' : ''}): ${labels} (outlined).`);
      } else if (selectedInThisCoach.length && rules.together) {
        lines.push(`Closest to your selected seat${selectedInThisCoach.length > 1 ? 's' : ''}: ${labels} (outlined).`);
      } else {
        const wanted = countNeededHere === 1
          ? `1 ${POSITION_TEXT[rules.position]}seat`
          : `${countNeededHere} seats${rules.position === 'any' ? '' : ` with a${rules.position === 'aisle' ? 'n' : ''} ${rules.position} seat`}`;
        lines.push(`Best for ${wanted}: ${labels} (outlined).`);
        if (rules.position !== 'any' && !pick.seats.some((s) => s.position === rules.position)) {
          lines.push(`No ${rules.position} seat free here; these are the closest match.`);
        }
        if (countNeededHere > 1 && rules.together && TOGETHER_TEXT[pick.together]) lines.push(TOGETHER_TEXT[pick.together]);
      }
      lines.push((picking || autoSelecting) ? 'Selecting them for you…' : 'Click the outlined seat(s) yourself.');
    } else {
      lines.push(`Only ${freeHere} free in ${current?.name ?? 'this coach'}; need ${countNeededHere} here.`);
    }

    render(lines, pick ? 'info' : 'warn');
  }

  // Starts the hold countdown (content/hold.js) at the first selected seat; stops it if every
  // seat is deselected. Not called once the seat map is gone, so the countdown survives the
  // move to the payment pages.
  async function trackHold(selectedCount) {
    const { holdStart, settings } = await BRTH.load(['holdStart', 'settings']);
    const holdMs = (Number(settings?.holdMinutes ?? 5) || 5) * 60 * 1000;
    const running = holdStart && Date.now() - holdStart < holdMs;
    if (selectedCount && !running) await BRTH.save({ holdStart: Date.now() });
    else if (!selectedCount && holdStart && !picking) await chrome.storage.local.remove('holdStart');
  }

  // 2e: all seats selected. Point at the Boarding Station and CONTINUE PURCHASE and stop there:
  // the user clicks CONTINUE PURCHASE, then enters the OTP and pays.
  function handOff(layout, selected, lines, settings) {
    const boarding = layout.querySelector('select#boardingpoint');
    const proceed = layout.querySelector('button.continue-btn');
    boarding?.classList.add('brth-next');
    proceed?.classList.add('brth-next');

    const stop = boarding?.selectedOptions[0]?.textContent.replace(/\s+/g, ' ').trim();
    if (stop) {
      const choices = boarding.options.length;
      lines.push(`Boarding Station: ${stop}${choices > 1 ? ` (${choices} to choose from; check it's yours)` : ''}.`);
    }
    lines.push(proceed
      ? 'Next: click CONTINUE PURCHASE (highlighted in green). Then you enter the OTP and pay.'
      : 'Next: continue the purchase on the page.');

    // Scroll once per finished selection, not on every page update.
    const key = selected.map((s) => s.label || s).join(',');
    if (proceed && handedOff !== key) {
      handedOff = key;
      proceed.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      if (settings?.autoContinuePurchase !== false) {
        lines.push('Clicking CONTINUE PURCHASE for you...');
        setTimeout(() => proceed.click(), 500);
      }
    }
  }

  // True (once) if results.js armed seat selection for this train and class moments ago.
  function takeSeatArm(card) {
    const arm = BRTHFlow.seatPick;
    if (!arm) return false;
    if (Date.now() - arm.at > SEAT_ARM_MAX_AGE_MS) {
      BRTHFlow.seatPick = null;
      return false;
    }
    const train = card?.querySelector('.trip-name h2')?.textContent.replace(/\s+/g, ' ').trim();
    const cls = card?.querySelector('.single-seat-class.selected .seat-class-name')?.textContent.trim();
    if (train !== arm.train || (cls && cls !== arm.cls)) return false;
    BRTHFlow.seatPick = null;
    return true;
  }

  // Click seats one at a time, waiting for the site to confirm each, re-choosing after every
  // click so a seat someone else takes first is replaced by the next best. Stops on a site error.
  async function selectSeats(layout, rules, needCount = rules.count, targetItem = null) {
    const say = (message, tone = 'info') => BRTHBadge.show(message, tone, 0, 'picking');
    const got = [];
    const lost = [];
    let waitedOnce = false;
    const coachName = targetItem?.coach?.name || '';
    say(`Selecting ${needCount} seat${needCount > 1 ? 's' : ''}${coachName ? ` in coach ${coachName}` : ''} for you…`);

    for (let attempt = 0; attempt < needCount + 3; attempt++) {
      if (!layout.isConnected) {
        autoSelecting = false;
        return say('The seat map was closed, so seat selection stopped.', 'warn');
      }
      const seats = readSeats(layout).map((s) => ({ ...s, available: s.clickable }));
      const selectedInThisCoach = seats.filter((s) => s.selected);
      const inThisCoach = selectedInThisCoach.length;
      const targetInThisCoach = targetItem ? targetItem.count : rules.count;
      const need = targetInThisCoach - inThisCoach;
      if (need <= 0) break;

      const pick = selectedInThisCoach.length && rules.together
        ? BRTHSeats.pickNear(seats, selectedInThisCoach, need)
        : BRTHSeats.pickSeats(seats, { ...rules, count: need });
      if (!pick) break;

      const seat = pick.seats[0];
      seat.button.click();
      const result = await waitForSeat(layout, seat.label);
      if (result.alert) {
        // Wait out a cooldown the site names, once; any other error stops selection.
        const wait = BRTH.cooldownSeconds(result.alert);
        if (wait === null || wait > MAX_COOLDOWN_S || waitedOnce) {
          autoSelecting = false;
          return say(`Stopped selecting seats. The site says: "${result.alert}"`, 'warn');
        }
        waitedOnce = true;
        BRTH.dismissSiteAlert();
        const stillOpen = await BRTH.countdown(wait + COOLDOWN_BUFFER_S,
          (left) => say(`The site says: "${result.alert}"\nTrying again in ${left} s…`, 'warn'),
          () => layout.isConnected);
        if (!stillOpen) {
          autoSelecting = false;
          return say('The seat map was closed, so seat selection stopped.', 'warn');
        }
        continue;
      }
      (result.selected ? got : lost).push(seat.label);
      say(`Selecting seats in ${coachName || 'coach'}… ${got.length ? `got ${got.join(', ')}` : ''}${lost.length ? `; ${lost.join(', ')} taken` : ''}`);
    }

    const seatsNow = readSeats(layout);
    const selectedNowInThis = seatsNow.filter((s) => s.selected).map((s) => s.label);
    const lostText = lost.length ? ` ${lost.join(', ')} went to someone else first.` : '';

    const shownName = seatsNow.find((s) => s.label)?.label.split('-')[0].toLowerCase() || '';
    if (shownName) {
      selectedByCoach.set(shownName, new Set(selectedNowInThis));
    }

    let totalCountNow = 0;
    for (const set of selectedByCoach.values()) totalCountNow += set.size;

    if (totalCountNow >= rules.count) {
      say(`Selected all ${totalCountNow} seats for you!${lostText}`);
    } else if (selectedNowInThis.length >= (targetItem ? targetItem.count : rules.count)) {
      say(`Got ${selectedNowInThis.join(', ')} in coach ${coachName}.${lostText} Preparing next coach…`);
    } else {
      say(`Selected ${selectedNowInThis.length} of ${targetItem ? targetItem.count : rules.count} in ${coachName}.${lostText}`, 'warn');
    }
  }

  // { selected: true } once the seat shows as selected, {} if it went to someone else or nothing
  // happened, { alert } if the site showed an error pop-up.
  async function waitForSeat(layout, label) {
    const started = Date.now();
    while (Date.now() - started < SEAT_CLICK_WAIT_MS) {
      await sleep(200);
      const alert = BRTH.siteAlertText();
      if (alert) return { alert };
      const button = [...layout.querySelectorAll('button.btn-seat')].find((b) => b.title.trim() === label);
      if (!button) continue;
      if (button.classList.contains('seat-selected')) return { selected: true };
      if (button.disabled || !button.classList.contains('seat-available')) return {};
    }
    return {};
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function coachReason(coach, rules) {
    return rules.coaches.includes(coach.name.toLowerCase()) ? 'your preferred coach' : 'most free seats';
  }

  // The site loads the chosen coach's seats on the dropdown's change event.
  function switchCoach(select, coach, why) {
    const fromValue = select.value;
    select.value = coach.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    awaiting = { name: coach.name, since: Date.now(), fromValue };
    BRTHBadge.show(`Switched to coach ${coach.name} (${coach.free} free, ${why}).`, 'info', 6000, 'coach');
    setTimeout(schedule, SWITCH_WAIT_MS + 500); // report a failed switch even if the page never changes
  }

  function render(lines, tone) {
    const summary = lines.join('\n');
    if (summary === lastSummary) return;
    lastSummary = summary;
    BRTHBadge.show(summary, tone, 0, 'seats');
  }

  // "CHA - 27 Seat(s)" -> { name: 'CHA', free: 27 }
  function readCoaches(select) {
    return [...select.options].map((o) => {
      const m = o.textContent.match(/^\s*(.+?)\s*-\s*(\d+)\s*Seat/i);
      return { name: m ? m[1] : o.textContent.trim(), free: m ? Number(m[2]) : 0, value: o.value, selected: o.selected };
    });
  }

  // Each .seat-row has two .seat-in-row halves, left and right of the aisle. Slots are numbered
  // across the whole row; a slot that is empty in every row is aisle space, not a seat.
  function readSeats(layout) {
    const slots = [];
    layout.querySelectorAll('.seat-row').forEach((rowEl, row) => {
      let col = 0;
      rowEl.querySelectorAll(':scope > .seat-in-row').forEach((halfEl, half) => {
        halfEl.querySelectorAll(':scope > .seat-wrapper').forEach((wrapper) => {
          const button = wrapper.querySelector('button.btn-seat');
          const hidden = !button || button.classList.contains('seat-hidden');
          // A selected seat keeps "seat-available". Once 4 are selected the site adds
          // "seat-disabled" to the other free seats; they are still free, just not clickable now.
          const selected = !hidden && button.classList.contains('seat-selected');
          const available = !hidden && !selected && !button.disabled && button.classList.contains('seat-available');
          slots.push({
            row, half, col: col++, hidden, button, selected, available,
            label: button?.title.trim() ?? '',
            clickable: available && !button.classList.contains('seat-disabled'),
          });
        });
      });
    });

    const seats = slots.filter((s) => !s.hidden);
    const colsByHalf = new Map();
    for (const s of seats) {
      if (!colsByHalf.has(s.half)) colsByHalf.set(s.half, new Set());
      colsByHalf.get(s.half).add(s.col);
    }
    const allCols = seats.map((s) => s.col);
    const first = Math.min(...allCols);
    const last = Math.max(...allCols);
    const halves = [...colsByHalf.keys()].sort((a, b) => a - b);

    for (const s of seats) {
      const cols = [...colsByHalf.get(s.half)];
      const aisleSide = (s.half !== halves[halves.length - 1] && s.col === Math.max(...cols)) ||
        (s.half !== halves[0] && s.col === Math.min(...cols));
      s.position = s.col === first || s.col === last ? 'window' : aisleSide ? 'aisle' : 'middle';
    }
    return seats;
  }

  function clearHighlight() {
    document.querySelectorAll('.brth-seat-pick').forEach((el) => el.classList.remove('brth-seat-pick'));
    document.querySelectorAll('.brth-next').forEach((el) => el.classList.remove('brth-next'));
  }

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .brth-seat-pick {
        outline: 3px solid #d97706 !important;
        outline-offset: 2px;
        box-shadow: 0 0 10px 2px rgba(217, 119, 6, 0.6) !important;
      }
      .brth-next {
        outline: 3px solid #079d49 !important;
        outline-offset: 3px;
        box-shadow: 0 0 12px 3px rgba(7, 157, 73, 0.55) !important;
      }
    `;
    document.head.append(style);
  }
})();
