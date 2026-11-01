// WPA-style rules for 8-ball, 9-ball and 10-ball. Pure logic: the caller measures what
// happened during the shot (see `report`) and the game decides fouls / turn / winner.
//
// report = {
//   firstContact: id|null,           first object ball touched by the cue ball
//   pocketed: [{id, pocket}],        object balls that dropped (cue ball excluded)
//   scratch: bool,                   cue ball pocketed
//   off: [id],                       balls (incl. cue = 0) that left the table
//   railAfterContact: bool,          any ball hit a cushion after first contact
//   railCount: number,               distinct object balls that touched a cushion (for the break)
//   call: {ball, pocket}|null,
//   pushOut: bool,
// }

export const KINDS = { 8: '8-ball', 9: '9-ball', 10: '10-ball' };
const SOLIDS = [1, 2, 3, 4, 5, 6, 7];
const STRIPES = [9, 10, 11, 12, 13, 14, 15];

export const groupOf = (id) => (id >= 1 && id <= 7 ? 'solid' : id >= 9 && id <= 15 ? 'stripe' : null);

export function createGame({ kind, players = ['Người chơi 1', 'Người chơi 2'] }) {
  const maxBall = kind === 8 ? 15 : kind === 9 ? 9 : 10;
  const onTable = new Set(Array.from({ length: maxBall }, (_, i) => i + 1));
  const g = {
    kind,
    maxBall,
    players: players.map((name) => ({ name, group: null, pocketed: [], fouls: 0 })),
    current: 0,
    breaker: 0,
    isBreak: true,
    ballInHand: true,
    breakBox: true, // cue ball must be placed behind the head string
    afterBreak: false,
    onTable,
    winner: null,
    pendingRerack: false,
    pendingPushout: null, // {pusher}
    message: 'Phá bi: đặt bi cái trong break box.',
  };

  const other = (i) => 1 - i;
  const remaining = () => [...g.onTable].sort((a, b) => a - b);
  const groupBalls = (grp) => (grp === 'solid' ? SOLIDS : STRIPES);
  const groupCleared = (p) => p.group && groupBalls(p.group).every((id) => !g.onTable.has(id));

  /** Ball ids the current player may legally touch first. */
  g.legalFirst = () => {
    if (kind !== 8) return [Math.min(...g.onTable)];
    const p = g.players[g.current];
    if (!p.group) return remaining().filter((id) => id !== 8);
    if (groupCleared(p)) return [8];
    return groupBalls(p.group).filter((id) => g.onTable.has(id));
  };

  g.needsCall = () => {
    if (g.isBreak) return false;
    if (kind === 10) return true;
    if (kind === 8) return g.legalFirst().length === 1 && g.legalFirst()[0] === 8;
    return false;
  };

  g.canPushOut = () => kind === 9 && g.afterBreak && g.current !== g.breaker && !g.pendingRerack;

  function finish(res) {
    Object.assign(g, { current: res.next, ballInHand: res.ballInHand, breakBox: !!res.breakBox });
    g.message = res.message;
    if (res.winner !== null && res.winner !== undefined) g.winner = res.winner;
    g.isBreak = !!res.stillBreak;
    return res;
  }

  function endBreak(report) {
    const me = g.current;
    const foul = [];
    if (report.scratch) foul.push('Bi cái xuống lỗ khi phá bi');
    if (report.off.length) foul.push('Bi nhảy khỏi bàn');
    const pocketed = report.pocketed.map((p) => p.id);
    const legal = pocketed.length > 0 || report.railCount >= 4;
    const respot = [];
    let winner = null;

    for (const id of pocketed) g.onTable.delete(id);

    if (kind === 8 && pocketed.includes(8)) { g.onTable.add(8); respot.push(8); }
    if (kind === 10 && pocketed.includes(10)) { g.onTable.add(10); respot.push(10); }
    if (kind === 9 && pocketed.includes(9) && !foul.length) winner = me;
    if (kind === 9 && pocketed.includes(9) && foul.length) { g.onTable.add(9); respot.push(9); }
    for (const id of report.off) if (id !== 0 && kind !== 8 && !respot.includes(id)) { g.onTable.add(id); respot.push(id); }

    const kept = pocketed.filter((id) => !respot.includes(id));
    g.players[me].pocketed.push(...kept);
    g.afterBreak = true;
    g.breaker = me;

    if (foul.length) {
      g.players[me].fouls++;
      return finish({
        foul, fouler: me, next: other(me), ballInHand: true, breakBox: !!report.scratch, respot, winner,
        message: `Lỗi phá bi: ${foul.join(', ')}. ${g.players[other(me)].name} cầm bi (${report.scratch ? 'sau head string' : 'toàn bàn'}).`,
      });
    }
    if (!legal) {
      g.pendingRerack = true;
      return finish({
        foul: [], next: other(me), ballInHand: false, rerackOffer: true, respot,
        message: `Phá bi không hợp lệ (cần ≥4 bi chạm băng hoặc có bi xuống lỗ). ${g.players[other(me)].name} chọn chơi tiếp hoặc xếp lại.`,
      });
    }
    // Legal break: keep shooting if something dropped.
    const keep = kept.length > 0 || winner !== null;
    return finish({
      foul: [], next: keep ? me : other(me), ballInHand: false, respot, winner,
      message: keep ? `${g.players[me].name} tiếp tục đánh.` : `Đến lượt ${g.players[other(me)].name}.`,
    });
  }

  g.endShot = (report) => {
    if (g.winner !== null) return null;
    if (g.isBreak) return endBreak(report);

    const me = g.current;
    const opp = other(me);
    const P = g.players[me];
    const foul = [];
    const pocketed = report.pocketed;
    const pocketedIds = pocketed.map((p) => p.id);
    const targets = g.legalFirst();
    const eightWasTarget = kind === 8 && targets.length === 1 && targets[0] === 8;

    if (report.scratch) foul.push('Bi cái xuống lỗ');
    if (report.off.length) foul.push('Bi nhảy khỏi bàn');
    if (report.firstContact === null) foul.push('Không chạm bi nào');
    else if (!targets.includes(report.firstContact)) {
      foul.push(kind === 8 ? `Chạm sai bi trước (bi ${report.firstContact})` : `Phải chạm bi ${targets[0]} trước`);
    }
    if (!report.railAfterContact && pocketedIds.length === 0 && report.firstContact !== null) {
      foul.push('Không có bi nào chạm băng sau va chạm');
    }

    if (report.pushOut && kind === 9 && g.canPushOut()) {
      // Push-out: only scratch/off are fouls; the opponent may take the shot or hand it back.
      const pf = foul.filter((f) => f.startsWith('Bi cái') || f.startsWith('Bi nhảy'));
      for (const id of pocketedIds) g.onTable.delete(id);
      const respot = [];
      if (pocketedIds.includes(9)) { g.onTable.add(9); respot.push(9); }
      g.afterBreak = false;
      if (pf.length) {
        P.fouls++;
        return finish({ foul: pf, fouler: me, next: opp, ballInHand: true, respot, message: `Lỗi push-out: ${pf.join(', ')}.` });
      }
      g.pendingPushout = { pusher: me };
      return finish({ foul: [], next: opp, ballInHand: false, pushOutDone: true, respot, message: `${g.players[opp].name}: chơi từ thế này hoặc trả lượt.` });
    }
    g.afterBreak = false;

    let valid = []; // pocketed balls that count
    const respot = [];
    let winner = null;

    if (kind === 8) {
      const nonCue = pocketed;
      if (eightWasTarget && pocketedIds.includes(8)) {
        const okCall = report.call && report.call.ball === 8 && nonCue.find((p) => p.id === 8).pocket === report.call.pocket;
        if (!foul.length && okCall) winner = me;
        else winner = opp;
      } else if (pocketedIds.includes(8)) {
        winner = opp; // 8 dropped early
      }
      if (winner === null) {
        valid = nonCue.filter((p) => p.id !== 8).map((p) => p.id);
        if (!P.group && !foul.length && valid.length) {
          const groups = new Set(valid.map(groupOf));
          if (groups.size === 1) {
            const grp = [...groups][0];
            P.group = grp;
            g.players[opp].group = grp === 'solid' ? 'stripe' : 'solid';
          }
        }
      }
      for (const id of pocketedIds) g.onTable.delete(id);
      for (const id of pocketedIds) {
        const grp = groupOf(id);
        const owner = g.players.findIndex((pl) => pl.group === grp);
        (owner >= 0 ? g.players[owner] : P).pocketed.push(id);
      }
      for (const id of report.off) if (id !== 0) g.onTable.delete(id);
      for (const id of report.off) if (id === 8) winner = opp;
      const mine = valid.filter((id) => !P.group || groupOf(id) === P.group);
      const keep = !foul.length && mine.length > 0 && winner === null;
      return conclude({ foul, keep, winner, respot });
    }

    if (kind === 9) {
      for (const id of pocketedIds) g.onTable.delete(id);
      if (pocketedIds.includes(9)) {
        if (!foul.length) winner = me;
        else { g.onTable.add(9); respot.push(9); }
      }
      for (const id of report.off) if (id !== 0 && !g.onTable.has(id)) { g.onTable.add(id); respot.push(id); }
      valid = pocketedIds.filter((id) => !respot.includes(id));
      P.pocketed.push(...valid);
      return conclude({ foul, keep: !foul.length && (valid.length > 0 || winner !== null), winner, respot });
    }

    // 10-ball: ball and pocket must be called, combos do not count.
    const call = report.call;
    const callOk = (p) => call && p.id === call.ball && p.pocket === call.pocket;
    const good = pocketed.filter(callOk);
    for (const p of pocketed) {
      if (callOk(p) && !foul.length) { g.onTable.delete(p.id); }
      else respot.push(p.id);
    }
    for (const id of report.off) if (id !== 0 && !respot.includes(id)) respot.push(id);
    valid = good.map((p) => p.id);
    if (!foul.length) {
      if (valid.includes(10)) winner = me;
      P.pocketed.push(...valid);
    } else {
      for (const id of valid) respot.push(id);
    }
    for (const id of respot) g.onTable.add(id);
    return conclude({ foul, keep: !foul.length && valid.length > 0, winner, respot });
  };

  function conclude({ foul, keep, winner, respot }) {
    const me = g.current;
    const opp = other(me);
    const P = g.players[me];
    if (foul.length) {
      P.fouls++;
      if (kind !== 8 && P.fouls >= 3) winner = opp;
    } else P.fouls = 0;
    if (winner !== null) {
      return finish({
        foul, fouler: foul.length ? me : null, next: me, ballInHand: false, respot, winner,
        message: `${g.players[winner].name} thắng ván!`,
      });
    }
    if (foul.length) {
      const warn = kind !== 8 && P.fouls === 2 ? ` (${P.name} đã phạm 2 lỗi liên tiếp)` : '';
      return finish({
        foul, fouler: me, next: opp, ballInHand: true, respot,
        message: `Lỗi: ${foul.join(', ')}. ${g.players[opp].name} được cầm bi.${warn}`,
      });
    }
    return finish({
      foul, next: keep ? me : opp, ballInHand: false, respot,
      message: keep ? `${P.name} tiếp tục đánh.` : `Đến lượt ${g.players[opp].name}.`,
    });
  }

  /** Opponent's answer to an illegal break: true = play on, false = re-rack and break again. */
  g.resolveRerack = (accept) => {
    g.pendingRerack = false;
    if (accept) {
      g.isBreak = false;
      g.message = `${g.players[g.current].name} chơi tiếp từ thế bi hiện tại.`;
      return { rerack: false };
    }
    g.current = g.breaker;
    g.isBreak = true;
    g.ballInHand = true;
    g.breakBox = true;
    g.afterBreak = false;
    g.onTable.clear();
    for (let i = 1; i <= g.maxBall; i++) g.onTable.add(i);
    g.players.forEach((p) => { p.pocketed = []; p.group = null; });
    g.message = `Xếp lại. ${g.players[g.current].name} phá bi.`;
    return { rerack: true };
  };

  /** After a push-out: true = receiver shoots, false = hand the shot back to the pusher. */
  g.resolvePushout = (takeShot) => {
    const pusher = g.pendingPushout?.pusher;
    g.pendingPushout = null;
    if (!takeShot && pusher !== undefined) {
      g.current = pusher;
      g.message = `${g.players[pusher].name} đánh tiếp (đối thủ trả lượt).`;
    } else g.message = `${g.players[g.current].name} đánh từ thế push-out.`;
  };

  return g;
}
