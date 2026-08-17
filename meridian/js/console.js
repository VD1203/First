/* ══════════════════════════════════════════════════════════════
   The product screen, as live DOM.

   Every number below is synthetic sample data. The point of the
   module is that the screen can explain its own state changes:
   selecting a sleeve, editing the trade size, approving, rejecting
   and resetting are all real transitions, keyboard included.
   ══════════════════════════════════════════════════════════════ */

const AUM = 18.42; // $M

/** One row of the mandate. drift = current - target; out of band if |drift| > band. */
const SLEEVES = [
  {
    id: 'us-equity', name: 'US Equity', target: 32.0, current: 36.4, band: 2.5,
    action: 'sell', trade: 810, post: 32.0,
    why: [
      ['§4.2', 'The equity band is <code>±2.5%</code>. This sleeve has held <code>+4.4%</code> for six consecutive sessions, so it reads as drift rather than noise.'],
      ['LOT', 'Highest-basis-first across both taxable accounts — two long-term lots plus one short-term lot carrying a loss worth harvesting.'],
      ['WASH', 'No substantially identical purchase anywhere in the household in the last 30 days, including the spouse&rsquo;s IRA.'],
      ['POST', 'After the trim the sleeve returns to <code>32.0%</code>, level with target.'],
    ],
    lots: [
      { d: '2019-03-14 · long-term', t: '$412.0K proceeds', v: '+$148.0K' },
      { d: '2021-11-02 · long-term', t: '$268.0K proceeds', v: '+$31.0K' },
      { d: '2024-08-19 · short-term', t: '$130.0K proceeds', v: '−$18.0K', loss: true },
    ],
    stats: [
      ['Est. realised gain', '$161.0K'],
      ['Harvested loss applied', '−$18.0K', 'pos'],
      ['Est. tax cost', '$38.3K'],
      ['Wash-sale check', 'Clear'],
    ],
  },
  {
    id: 'intl-dev', name: 'Intl Developed', target: 14.0, current: 12.1, band: 2.0,
    action: 'buy', trade: 350, post: 14.0,
    why: [
      ['§4.3', 'Inside its <code>±2.0%</code> band at <code>−1.9%</code>, so nothing here demands a correction on its own.'],
      ['FUND', 'Used as a funding leg instead: <code>$350K</code> of the equity proceeds lands here and closes the gap for free.'],
      ['FX', '40% of the sleeve is currency-hedged. The purchase follows the same ratio so the hedge does not drift.'],
    ],
    lots: null,
    stats: [
      ['Purchase value', '$350.0K'],
      ['Weight after trade', '14.0%'],
      ['Gain realised', '$0'],
      ['Funded by', 'US Equity trim'],
    ],
  },
  {
    id: 'em', name: 'Emerging Markets', target: 6.0, current: 4.4, band: 1.5,
    action: 'buy', trade: 295, post: 6.0,
    why: [
      ['§4.4', '<code>−1.6%</code> against a <code>±1.5%</code> band — outside, and the smaller of the two breaches in the book.'],
      ['FUND', '<code>$295K</code> of the equity proceeds restores the sleeve to <code>6.0%</code>.'],
      ['LIQ', 'Filled with the broad index sleeve rather than single-country funds, which keeps the round-trip spread near 4 bps.'],
    ],
    lots: null,
    stats: [
      ['Purchase value', '$295.0K'],
      ['Weight after trade', '6.0%'],
      ['Est. spread cost', '4 bps'],
      ['Funded by', 'US Equity trim'],
    ],
  },
  {
    id: 'core-fi', name: 'Core Fixed Income', target: 28.0, current: 26.2, band: 2.0,
    action: 'buy', trade: 165, post: 27.1,
    why: [
      ['§5.1', 'In band at <code>−1.8%</code>. Meridian would have left this alone if it were not already selling something.'],
      ['FUND', 'The remaining <code>$165K</code> completes the reallocation without opening a second sale.'],
      ['DUR', 'Duration-matched to <code>6.1y</code>, so the sleeve&rsquo;s rate sensitivity does not move with the weight.'],
    ],
    lots: null,
    stats: [
      ['Purchase value', '$165.0K'],
      ['Weight after trade', '27.1%'],
      ['Duration after trade', '6.1y'],
      ['Still in band', 'Yes'],
    ],
  },
  {
    id: 'priv-credit', name: 'Private Credit', target: 12.0, current: 11.6, band: 2.0,
    action: 'hold', trade: 0, post: 11.6,
    why: [
      ['§6.2', '<code>−0.4%</code> against a <code>±2.0%</code> band. No action.'],
      ['LOCK', 'The sleeve is inside a 24-month lock-up. It could not be trimmed this quarter even if it had drifted.'],
    ],
    lots: null,
    stats: [['Trade value', '$0'], ['Weight after trade', '11.6%'], ['Next liquidity window', 'Q3 2027']],
  },
  {
    id: 'real-assets', name: 'Real Assets', target: 5.0, current: 6.1, band: 1.5,
    action: 'hold', trade: 0, post: 6.1,
    why: [
      ['§6.1', '<code>+1.1%</code> against <code>±1.5%</code>. Inside the band, so it stays as it is.'],
      ['COST', 'Correcting it would realise about <code>$27K</code> of gains to fix 1.1% of drift. The tax outweighs the tracking benefit.'],
    ],
    lots: null,
    stats: [['Trade value', '$0'], ['Weight after trade', '6.1%'], ['Gain avoided', '$27.0K']],
  },
  {
    id: 'cash', name: 'Cash', target: 3.0, current: 3.2, band: 1.0,
    action: 'hold', trade: 0, post: 3.2,
    why: [
      ['§7.3', '<code>+0.2%</code>. Operating cash stays where it is.'],
      ['FLOW', 'Two distributions totalling <code>$46K</code> settle this month and will be absorbed here before the next review.'],
    ],
    lots: null,
    stats: [['Trade value', '$0'], ['Weight after trade', '3.2%'], ['Scheduled inflow', '$46.0K']],
  },
];

const ACTION_LABEL = { sell: 'Sell', buy: 'Buy', hold: 'Hold' };
const fmtSigned = (n, d = 1) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(d)}%`;

export function initConsole(root) {
  if (!root) return () => {};

  const q = (sel) => root.querySelector(sel);
  const rowsHost   = q('[data-sleeve-rows]');
  const whyTitle   = q('[data-why-title]');
  const whyList    = q('[data-why-list]');
  const lotsBox    = q('[data-why-lots]');
  const lotRows    = q('[data-why-lot-rows]');
  const statsBox   = lotsBox?.nextElementSibling;
  const editBox    = q('[data-edit]');
  const editInput  = q('[data-edit-input]');
  const stateLabel = q('[data-state-label]');
  const footLeft   = q('[data-foot-left]');
  const footRight  = q('[data-foot-right]');
  const acts       = { approve: q('[data-act="approve"]'), edit: q('[data-act="edit"]'), reject: q('[data-act="reject"]') };
  const replay     = document.querySelector('[data-replay]');

  if (!rowsHost) return () => {};

  let selected = 0;   // index into SLEEVES
  let size = 1;       // trade size multiplier set by the Edit control
  let state = 'draft';

  /* ── the sleeve table ──────────────────────────────────── */
  // The drift bar spans ±6% around the target; the centre line is the target.
  const SPAN = 6;
  const barGeometry = (drift) => {
    const half = Math.min(Math.abs(drift), SPAN) / SPAN * 50;
    return drift >= 0 ? { left: 50, width: half } : { left: 50 - half, width: half };
  };

  // Once approved the table shows the post-trade book instead of the drifted one.
  const weightOf = (s) => (state === 'approved' ? s.current + (s.post - s.current) * size : s.current);

  function renderRows() {
    rowsHost.innerHTML = SLEEVES.map((s, i) => {
      const live  = weightOf(s) - s.target;
      const out   = Math.abs(live) > s.band;
      const g     = barGeometry(live);
      const traded = Math.round(s.trade * size);
      const action = traded === 0 ? 'hold' : s.action;
      return `
        <tr tabindex="${i === selected ? 0 : -1}" aria-selected="${i === selected}" data-i="${i}">
          <td><span class="cell-name"><i class="swatch" style="background:${out ? 'var(--warn)' : 'var(--ink-4)'}"></i><b>${s.name}</b></span></td>
          <td><span class="cell">${s.target.toFixed(1)}</span></td>
          <td><span class="cell">${weightOf(s).toFixed(1)}</span></td>
          <td><span class="cell ${out ? 'd-out' : 'd-ok'}">${fmtSigned(live)}</span></td>
          <td><span class="cell"><span class="bar"><i class="bar__mid"></i><i class="bar__fill${out ? ' is-out' : ''}" style="left:${g.left}%;width:${g.width}%"></i></span></span></td>
          <td><span class="cell-act"><span class="tag tag--${action}">${ACTION_LABEL[action]}${traded ? ` $${traded}K` : ''}</span></span></td>
        </tr>`;
    }).join('');
  }

  /* ── the rationale panel ───────────────────────────────── */
  function renderWhy() {
    const s = SLEEVES[selected];
    const traded = Math.round(s.trade * size);
    const verb = s.action === 'sell' ? 'trim' : s.action === 'buy' ? 'add' : 'hold';
    const delta = Math.abs(s.current - s.post) * size;

    whyTitle.textContent = s.action === 'hold'
      ? `${s.name} — no action`
      : `${s.name} — ${verb} ${delta.toFixed(1)}%`;

    whyList.innerHTML = s.why
      .map(([k, t]) => `<li><span class="why__k">${k.replace('§', '')}</span><span>${t}</span></li>`)
      .join('');

    if (s.lots && traded > 0) {
      lotsBox.hidden = false;
      lotRows.innerHTML = s.lots.map((l) => `
        <div class="lot">
          <span class="lot__d">${l.d}</span>
          <span class="lot__t">${l.t}</span>
          <span class="lot__v${l.loss ? ' is-loss' : ''}">${l.v}</span>
        </div>`).join('');
    } else {
      lotsBox.hidden = true;
    }

    // Cash figures scale with the edited trade size; the resulting weight is recomputed.
    const scaled = s.stats.map(([label, value, tone]) => {
      if (label === 'Weight after trade') {
        return [label, `${(s.current + (s.post - s.current) * size).toFixed(1)}%`, tone];
      }
      if (size === 1 || !/^−?\$[\d.]+K$/.test(value)) return [label, value, tone];
      const neg = value.startsWith('−');
      const n = parseFloat(value.replace(/[^\d.]/g, '')) * size;
      return [label, `${neg ? '−' : ''}$${n.toFixed(1)}K`, tone];
    });

    statsBox.innerHTML = scaled
      .map(([label, value, tone]) => `<div class="stat"><span>${label}</span><b${tone === 'pos' ? ' style="color:var(--pos)"' : ''}>${value}</b></div>`)
      .join('');
  }

  function renderFoot() {
    // Buys and sells net to zero, so the sell leg is the trade value.
    const value = SLEEVES.filter((s) => s.action === 'sell').reduce((sum, s) => sum + s.trade * size, 0);
    const buys = SLEEVES.filter((s) => s.action === 'buy' && s.trade * size >= 1).length;
    const sells = SLEEVES.filter((s) => s.action === 'sell' && s.trade * size >= 1).length;
    const breached = SLEEVES.filter((s) => Math.abs(weightOf(s) - s.target) > s.band).length;
    const after = SLEEVES.filter((s) => Math.abs(s.current + (s.post - s.current) * size - s.target) > s.band).length;

    footLeft.textContent = value >= 1
      ? `Net trade value $${Math.round(value)}K · ${buys} buys, ${sells} sell${sells === 1 ? '' : 's'}`
      : 'No orders drafted at this size';
    footRight.textContent = state === 'approved'
      ? `Queued to custodian 08:44 ET · file mrdn-2471.csv`
      : `Now ${breached} outside band → ${after} after the trade`;
  }

  /* ── state machine: draft → editing → approved | rejected ─ */
  const STATE_TEXT = {
    draft: 'Draft · awaiting advisor',
    editing: 'Editing · unsaved change',
    approved: 'Approved · queued 08:44 ET',
    rejected: 'Rejected · returned to draft queue',
  };

  function setState(next) {
    state = next;
    root.dataset.state = next;
    stateLabel.textContent = STATE_TEXT[next] + (size !== 1 && next === 'approved' ? ` · edited to ${Math.round(size * 100)}%` : '');
    const settled = next === 'approved' || next === 'rejected';
    acts.approve.disabled = settled;
    acts.edit.disabled = settled;
    acts.reject.disabled = settled;
    acts.approve.textContent = next === 'approved' ? 'Approved' : 'Approve';
    editBox.classList.toggle('is-open', next === 'editing');
    renderAll();
  }

  function renderAll() {
    // The table is re-rendered wholesale, so keep focus where the user left it.
    const hadFocus = rowsHost.contains(document.activeElement);
    renderRows();
    renderWhy();
    renderFoot();
    if (hadFocus) rowsHost.querySelector(`tr[data-i="${selected}"]`)?.focus();
  }

  /* ── events ────────────────────────────────────────────── */
  function select(i) {
    selected = Math.max(0, Math.min(SLEEVES.length - 1, i));
    renderAll();
    rowsHost.querySelector(`tr[data-i="${selected}"]`)?.focus();
  }

  const onRowClick = (e) => {
    const tr = e.target.closest('tr[data-i]');
    if (tr) select(Number(tr.dataset.i));
  };

  const onRowKey = (e) => {
    const tr = e.target.closest('tr[data-i]');
    if (!tr) return;
    const i = Number(tr.dataset.i);
    if (e.key === 'ArrowDown') { e.preventDefault(); select(i + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); select(i - 1); }
    else if (e.key === 'Home') { e.preventDefault(); select(0); }
    else if (e.key === 'End') { e.preventDefault(); select(SLEEVES.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(i); }
  };

  const onApprove = () => setState('approved');
  const onReject = () => setState('rejected');
  const onEdit = () => setState(state === 'editing' ? 'draft' : 'editing');

  const onEditInput = () => {
    const pct = Math.max(0, Math.min(100, Number(editInput.value) || 0));
    size = pct / 100;
    renderAll();
  };

  function reset() {
    selected = 0; size = 1;
    editInput.value = 100;
    setState('draft');
  }

  rowsHost.addEventListener('click', onRowClick);
  rowsHost.addEventListener('keydown', onRowKey);
  acts.approve.addEventListener('click', onApprove);
  acts.reject.addEventListener('click', onReject);
  acts.edit.addEventListener('click', onEdit);
  editInput.addEventListener('input', onEditInput);
  replay?.addEventListener('click', reset);

  setState('draft');

  return () => {
    rowsHost.removeEventListener('click', onRowClick);
    rowsHost.removeEventListener('keydown', onRowKey);
    acts.approve.removeEventListener('click', onApprove);
    acts.reject.removeEventListener('click', onReject);
    acts.edit.removeEventListener('click', onEdit);
    editInput.removeEventListener('input', onEditInput);
    replay?.removeEventListener('click', reset);
  };
}

export { SLEEVES, AUM };
