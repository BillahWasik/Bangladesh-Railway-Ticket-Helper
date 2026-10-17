// Coach and seat choice from the user's seat rules. Pure functions (no page access), so the
// choice can be tested on its own; content/seatmap.js reads the page and calls these.
const BRTHSeats = (() => {
  // coaches: [{ name, free }]; preferred: lower-cased coach names, best first.
  // The coach to be in: the first preferred coach with enough free seats; otherwise stay in the
  // current coach if it has enough; otherwise the coach with the most free seats. null = none has enough.
  function pickCoach(coaches, count, preferred, current) {
    const enough = coaches.filter((c) => c.free >= count);
    for (const p of preferred) {
      const hit = enough.find((c) => c.name.toLowerCase() === p);
      if (hit) return hit;
    }
    if (current && enough.includes(current)) return current;
    return [...enough].sort((a, b) => b.free - a.free)[0] ?? null;
  }

  // seats: [{ label, row, half, col, available, position: 'window' | 'aisle' | 'middle' }]
  // rules: { count, position: 'window' | 'aisle' | 'any', together }
  // Returns { seats, together } where together is 'side by side' | 'same row' | 'near' | 'apart',
  // or null when the coach doesn't have enough free seats.
  function pickSeats(seats, rules) {
    const count = rules.count;
    const free = seats.filter((s) => s.available);
    if (free.length < count) return null;

    const fit = (s) => {
      let score = 0;
      if (rules.position && rules.position !== 'any') {
        if (rules.position === 'lower_berth') score += s.isLower ? 0 : 2;
        else if (rules.position === 'upper_berth') score += (s.isLower === false) ? 0 : 2;
        else score += s.position === rules.position ? 0 : 2;
      }
      if (rules.avoidLavatory && s.isNearLavatory) {
        score += 5;
      }
      return score;
    };
    const front = (a, b) => a.row - b.row || a.col - b.col;
    const byRule = (a, b) => fit(a) - fit(b) || front(a, b);

    if (count === 1) return { seats: [[...free].sort(byRule)[0]], together: 'side by side' };
    if (!rules.together) return { seats: [...free].sort(byRule).slice(0, count), together: 'apart' };

    // A group suits the position rule if one of its seats does (e.g. one window seat for two people).
    const groupFit = (g) => Math.min(...g.map(fit));
    const best = (groups) => groups.sort((a, b) => groupFit(a) - groupFit(b) || front(a[0], b[0]))[0];

    const sideBySide = [];
    const sameRow = [];
    for (const rowSeats of groupBy(free, (s) => s.row).values()) {
      const ordered = rowSeats.sort((a, b) => a.col - b.col);
      for (const half of groupBy(ordered, (s) => s.half).values()) {
        for (let i = 0; i + count <= half.length; i++) {
          const g = half.slice(i, i + count);
          if (g.every((s, k) => k === 0 || s.col - g[k - 1].col === 1)) sideBySide.push(g);
        }
      }
      for (let i = 0; i + count <= ordered.length; i++) sameRow.push(ordered.slice(i, i + count));
    }
    if (sideBySide.length) return { seats: best(sideBySide), together: 'side by side' };
    if (sameRow.length) return { seats: best(sameRow), together: 'same row' };

    // Otherwise the seats spanning the fewest rows.
    const ordered = [...free].sort(front);
    let nearest = null;
    for (let i = 0; i + count <= ordered.length; i++) {
      const g = ordered.slice(i, i + count);
      const span = g[count - 1].row - g[0].row;
      if (!nearest || span < nearest.span) nearest = { g, span };
    }
    return { seats: nearest.g, together: nearest.span <= 1 ? 'near' : 'apart' };
  }

  // The free seats closest to the ones the user already selected, same row first.
  function pickNear(seats, selected, count) {
    const free = seats.filter((s) => s.available);
    if (free.length < count) return null;
    const distance = (s) => Math.min(...selected.map((t) => Math.abs(s.row - t.row) * 10 + Math.abs(s.col - t.col)));
    const nearest = [...free].sort((a, b) => distance(a) - distance(b) || a.row - b.row || a.col - b.col);
    return { seats: nearest.slice(0, count), together: 'near' };
  }

  function groupBy(items, key) {
    const map = new Map();
    for (const item of items) {
      const k = key(item);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(item);
    }
    return map;
  }

  // Plans seat allocations across one or more coaches according to the math rules:
  // - If any coach has >= wanted seats: allocate all in that single coach.
  // - If wanted === 4 and no coach has 4:
  //     Divide into 2 and 2 in different coaches (each with >= 2 free).
  //     If no two coaches have >= 2: fallback to [3, 1], then [2, 1, 1], then [1, 1, 1, 1].
  // - If wanted === 3 and no coach has 3:
  //     Try to keep 2 in one coach and 1 in another ([2, 1]).
  //     If no coach has >= 2: fallback to [1, 1, 1].
  // - If wanted === 2 and no coach has 2:
  //     Find 1 and 1 in different coaches ([1, 1]).
  // - Returns [{ coach, count }] or null if no seats available.
  function planAllocations(coaches, wanted, preferred = [], current = null) {
    if (!coaches || !coaches.length || wanted <= 0) return null;
    const available = coaches.filter((c) => c.free > 0);
    if (!available.length) return null;

    function coachScore(c) {
      let score = 0;
      const prefIdx = preferred.indexOf(c.name.toLowerCase());
      if (prefIdx !== -1) {
        score += 1000 - prefIdx * 10;
      }
      if (current && c.name.toLowerCase() === (current.name ?? '').toLowerCase()) {
        score += 50;
      }
      score += Math.min(c.free, 100);
      return score;
    }

    const sorted = [...available].sort((a, b) => coachScore(b) - coachScore(a));

    // 1. Single coach has all wanted seats
    const single = sorted.find((c) => c.free >= wanted);
    if (single) return [{ coach: single, count: wanted }];

    // 2. Multi-coach partitioning math
    if (wanted === 4) {
      // 2 and 2 in different coaches
      const with2 = sorted.filter((c) => c.free >= 2);
      if (with2.length >= 2) {
        return [
          { coach: with2[0], count: 2 },
          { coach: with2[1], count: 2 },
        ];
      }

      // Fallback: 3 in one coach, 1 in another
      const with3 = sorted.find((c) => c.free >= 3);
      if (with3) {
        const other = sorted.find((c) => c !== with3 && c.free >= 1);
        if (other) {
          return [
            { coach: with3, count: 3 },
            { coach: other, count: 1 },
          ];
        }
      }

      // Fallback: 2 in one coach, 1 each in two others
      if (with2.length >= 1) {
        const others = sorted.filter((c) => c !== with2[0] && c.free >= 1);
        if (others.length >= 2) {
          return [
            { coach: with2[0], count: 2 },
            { coach: others[0], count: 1 },
            { coach: others[1], count: 1 },
          ];
        }
      }

      // Fallback: 1 each in up to 4 coaches
      if (sorted.length >= 4) {
        return sorted.slice(0, 4).map((c) => ({ coach: c, count: 1 }));
      }

      return greedyFill(sorted, wanted);
    }

    if (wanted === 3) {
      // 2 in one coach and 1 in another coach
      const with2 = sorted.find((c) => c.free >= 2);
      if (with2) {
        const other = sorted.find((c) => c !== with2 && c.free >= 1);
        if (other) {
          return [
            { coach: with2, count: 2 },
            { coach: other, count: 1 },
          ];
        }
      }

      // Fallback: 1 each in 3 coaches
      if (sorted.length >= 3) {
        return sorted.slice(0, 3).map((c) => ({ coach: c, count: 1 }));
      }

      return greedyFill(sorted, wanted);
    }

    if (wanted === 2) {
      // 1 and 1 in different coaches
      if (sorted.length >= 2) {
        return [
          { coach: sorted[0], count: 1 },
          { coach: sorted[1], count: 1 },
        ];
      }

      return greedyFill(sorted, wanted);
    }

    return [{ coach: sorted[0], count: 1 }];
  }

  function greedyFill(sorted, wanted) {
    const plan = [];
    let rem = wanted;
    for (const c of sorted) {
      if (rem <= 0) break;
      const take = Math.min(c.free, rem);
      if (take > 0) {
        plan.push({ coach: c, count: take });
        rem -= take;
      }
    }
    return plan.length ? plan : null;
  }

  return { pickCoach, pickSeats, pickNear, planAllocations };
})();
