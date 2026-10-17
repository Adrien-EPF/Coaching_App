/* @ds-bundle: {"format":4,"namespace":"Coach","components":[{"name":"Button"},{"name":"GoalBadge"},{"name":"SessionStatus"},{"name":"SetRow"},{"name":"RpePicker"},{"name":"ExerciseCard"},{"name":"RecommendationNote"},{"name":"PrStat"}]} */
(function () {
  var React = window.React;
  var h = React.createElement;

  function cx() {
    var out = [];
    for (var i = 0; i < arguments.length; i++) if (arguments[i]) out.push(arguments[i]);
    return out.join(' ');
  }
  function num(n) {
    if (n === null || n === undefined || n === '') return '';
    return String(n).replace('.', ',');
  }
  function load(n, unit, added) {
    if (n === null || n === undefined || n === '') return '';
    return (added && n >= 0 ? '+' : '') + num(n) + ' ' + (unit || 'kg');
  }
  function omit(props, keys) {
    var o = {};
    for (var k in props) if (keys.indexOf(k) < 0) o[k] = props[k];
    return o;
  }

  var GOALS = {
    strength: 'Force',
    hypertrophy: 'Hypertrophie',
    endurance: 'Endurance'
  };

  var RPE_SCALE = [
    { v: 6, label: '4 reps de plus ou plus, effort léger' },
    { v: 7, label: '3 reps de plus possibles' },
    { v: 8, label: '2 reps de plus possibles' },
    { v: 8.5, label: 'Peut-être 2 reps de plus' },
    { v: 9, label: '1 rep de plus possible' },
    { v: 9.5, label: 'Peut-être une rep de plus' },
    { v: 10, label: 'Aucune rep de plus possible' }
  ];

  function Glyph(props) {
    var p = { viewBox: '0 0 16 16', width: 14, height: 14, 'aria-hidden': 'true', className: 'ca-glyph', fill: 'none', stroke: 'currentColor', strokeWidth: 2.25, strokeLinecap: 'round', strokeLinejoin: 'round' };
    switch (props.name) {
      case 'check': return h('svg', p, h('path', { d: 'M3 8.5l3.2 3L13 4.5' }));
      case 'cross': return h('svg', p, h('path', { d: 'M4 4l8 8M12 4l-8 8' }));
      case 'up': return h('svg', p, h('path', { d: 'M8 13V3M3.5 7.5L8 3l4.5 4.5' }));
      case 'down': return h('svg', p, h('path', { d: 'M8 3v10M3.5 8.5L8 13l4.5-4.5' }));
      case 'equal': return h('svg', p, h('path', { d: 'M3.5 6h9M3.5 10h9' }));
      case 'dot': return h('svg', p, h('circle', { cx: 8, cy: 8, r: 3.5, fill: 'currentColor', stroke: 'none' }));
      case 'ring': return h('svg', p, h('circle', { cx: 8, cy: 8, r: 4.5 }));
      case 'plus': return h('svg', p, h('path', { d: 'M8 3v10M3 8h10' }));
      case 'shield': return h('svg', p, h('path', { d: 'M8 2l5 2v4c0 3-2.2 5-5 6-2.8-1-5-3-5-6V4z' }));
      default: return null;
    }
  }

  /* Button */
  function Button(props) {
    var variant = props.variant || 'primary';
    var size = props.size || 'md';
    var rest = omit(props, ['variant', 'size', 'block', 'className', 'children', 'type']);
    return h('button', Object.assign({ type: props.type || 'button' }, rest, {
      className: cx('ca-btn', 'ca-btn-' + variant, 'ca-btn-' + size, props.block && 'ca-btn-block', props.className)
    }), props.children);
  }

  /* GoalBadge */
  function GoalBadge(props) {
    var goal = props.goal || 'strength';
    return h('span', { className: cx('ca-goal', 'ca-goal-' + goal, props.size === 'sm' && 'ca-goal-sm', props.className) }, props.children || GOALS[goal]);
  }

  /* SessionStatus */
  var STATUS = {
    planned: { label: 'Prévue', glyph: 'ring' },
    today: { label: "Aujourd'hui", glyph: 'dot' },
    validated: { label: 'Validée', glyph: 'check' },
    missed: { label: 'Manquée', glyph: 'cross' },
    unplanned: { label: 'Hors programme', glyph: 'plus' },
    'not-completed': { label: 'Non effectuée', glyph: 'cross' }
  };
  function SessionStatus(props) {
    var s = STATUS[props.status] || STATUS.planned;
    return h('span', { className: cx('ca-status', 'ca-status-' + (props.status || 'planned'), props.className) },
      h(Glyph, { name: s.glyph }), props.children || s.label);
  }

  /* SetRow */
  function Cell(props) {
    var has = props.value !== undefined && props.value !== null && props.value !== '';
    return h('div', { className: cx('ca-cell', !has && 'ca-cell-empty', props.wide && 'ca-cell-wide') },
      h('span', { className: 'ca-cell-label' }, props.label),
      h('span', { className: 'ca-cell-value' }, has ? props.value : (props.planned !== undefined ? props.planned : '–')));
  }
  function SetRow(props) {
    var unit = props.unit || 'kg';
    var added = !!props.addedLoad;
    var planned = props.planned || {};
    var logged = props.logged || {};
    var last = props.last;
    var status = props.status || (logged.reps !== undefined ? 'done' : 'todo');
    var notDone = status === 'not-completed';
    var body;
    if (notDone) {
      body = h('div', { className: 'ca-set-skip' }, h(Glyph, { name: 'cross' }), 'Non effectuée');
    } else {
      body = h('div', { className: 'ca-set-cells' },
        h(Cell, { label: 'Charge', wide: true, value: load(logged.weight, unit, added), planned: load(planned.weight, unit, added) }),
        h(Cell, { label: 'Reps', value: logged.reps, planned: planned.reps }),
        h(Cell, { label: 'RPE', value: num(logged.rpe), planned: '–' }));
    }
    return h('div', { className: cx('ca-set', 'ca-set-' + status, props.active && 'ca-set-active', props.className), onClick: props.onSelect },
      h('div', { className: 'ca-set-index' },
        status === 'done' ? h(Glyph, { name: 'check' }) : null,
        h('span', null, 'S' + (props.index || 1))),
      h('div', { className: 'ca-set-main' }, body,
        last ? h('div', { className: 'ca-set-last' },
          'Dernière fois : ' + load(last.weight, unit, added) + ' × ' + last.reps + (last.rpe !== undefined ? ' · RPE ' + num(last.rpe) : '')) : null));
  }

  /* RpePicker */
  function RpePicker(props) {
    var controlled = props.value !== undefined;
    var st = React.useState(props.defaultValue !== undefined ? props.defaultValue : null);
    var value = controlled ? props.value : st[0];
    function pick(v) {
      if (!controlled) st[1](v);
      if (props.onChange) props.onChange(v);
    }
    var current = null;
    for (var i = 0; i < RPE_SCALE.length; i++) if (RPE_SCALE[i].v === value) current = RPE_SCALE[i];
    return h('div', { className: cx('ca-rpe', props.className) },
      h('div', { className: 'ca-rpe-head' },
        h('span', { className: 'ca-label' }, 'RPE'),
        props.max !== undefined ? h('span', { className: 'ca-rpe-max' }, 'Max pour monter : ' + num(props.max)) : null),
      h('div', { className: 'ca-rpe-steps', role: 'radiogroup', 'aria-label': 'RPE' },
        RPE_SCALE.map(function (s) {
          var on = s.v === value;
          var over = props.max !== undefined && s.v > props.max;
          return h('button', {
            key: s.v, type: 'button', role: 'radio', 'aria-checked': on ? 'true' : 'false',
            className: cx('ca-rpe-step', on && 'ca-rpe-on', over && 'ca-rpe-over'),
            onClick: function () { pick(s.v); }
          }, s.v === 6 ? '≤6' : num(s.v));
        })),
      h('p', { className: 'ca-rpe-meaning' }, current ? current.label : 'Combien de reps te restait-il ?'));
  }

  /* ExerciseCard */
  function ExerciseCard(props) {
    var unit = props.unit || 'kg';
    var plan = props.plan || {};
    return h('section', { className: cx('ca-ex', props.className) },
      h('header', { className: 'ca-ex-head' },
        h('div', { className: 'ca-ex-meta' },
          props.position ? h('span', { className: 'ca-label' }, 'Exercice ' + props.position) : null,
          props.goal ? h(GoalBadge, { goal: props.goal, size: 'sm' }) : null,
          props.status ? h(SessionStatus, { status: props.status }) : null),
        h('h3', { className: 'ca-ex-name' }, props.name),
        h('div', { className: 'ca-ex-plan' },
          h('span', { className: 'ca-ex-weight' }, load(plan.weight, unit, props.addedLoad)),
          plan.reps !== undefined ? h('span', { className: 'ca-ex-reps' }, '× ' + plan.reps) : null),
        h('p', { className: 'ca-ex-detail' }, [
          props.sets ? props.sets + ' séries' : null,
          props.range ? 'fourchette ' + props.range[0] + '-' + props.range[1] + ' reps' : null,
          props.equipment || null
        ].filter(Boolean).join(' · '))),
      props.note ? h('div', { className: 'ca-ex-note' }, props.note) : null,
      props.children ? h('div', { className: 'ca-ex-sets' }, props.children) : null);
  }

  /* RecommendationNote */
  function RecommendationNote(props) {
    var unit = props.unit || 'kg';
    var d = props.delta;
    var dir = d === undefined || d === null ? null : d > 0 ? 'up' : d < 0 ? 'down' : 'equal';
    var deltaText = dir === null ? null : dir === 'equal' ? 'Même charge' : (d > 0 ? '+' : '−') + num(Math.abs(d)) + (props.percent ? ' %' : ' ' + unit);
    return h('aside', { className: cx('ca-reco', props.variant === 'session' && 'ca-reco-session', props.className) },
      h('div', { className: 'ca-reco-head' },
        h('span', { className: 'ca-label' }, props.title || (props.variant === 'session' ? 'Cette séance' : 'Pourquoi cette charge')),
        dir ? h('span', { className: 'ca-delta ca-delta-' + dir }, h(Glyph, { name: dir }), deltaText) : null),
      h('p', { className: 'ca-reco-text' }, props.children),
      props.clamped ? h('div', { className: 'ca-reco-clamp' }, h(Glyph, { name: 'shield' }),
        typeof props.clamped === 'string' ? props.clamped : 'Limitée par les Guardrails') : null,
      props.source === 'rules' ? h('div', { className: 'ca-reco-source' }, 'Plan calculé avec tes règles seules (Gemini indisponible)') : null);
  }

  /* PrStat */
  function PrStat(props) {
    var unit = props.unit || 'kg';
    var obj = props.objective;
    var pct = null;
    if (obj && obj.target !== undefined && props.value !== undefined) {
      var from = obj.from || 0;
      pct = Math.max(0, Math.min(100, Math.round(((props.value - from) / (obj.target - from)) * 100)));
    }
    return h('div', { className: cx('ca-pr', props.isNew && 'ca-pr-new', props.className) },
      h('div', { className: 'ca-pr-head' },
        h('span', { className: 'ca-label' }, props.label),
        props.isNew ? h('span', { className: 'ca-pr-flag' }, 'Nouveau PR') : null),
      h('div', { className: 'ca-pr-value' },
        h('span', { className: 'ca-pr-num' }, (props.addedLoad && props.value >= 0 ? '+' : '') + num(props.value)),
        h('span', { className: 'ca-pr-unit' }, unit)),
      props.detail ? h('p', { className: 'ca-pr-detail' }, props.detail) : null,
      obj ? h('div', { className: 'ca-pr-obj' },
        h('div', { className: 'ca-pr-track', role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 },
          h('div', { className: 'ca-pr-fill', style: { width: pct + '%' } })),
        h('p', { className: 'ca-pr-obj-text' }, 'Objectif ' + (props.addedLoad ? '+' : '') + num(obj.target) + ' ' + unit + (obj.reps ? ' × ' + obj.reps : '') + (obj.by ? ' d’ici ' + obj.by : '') + ' · ' + pct + ' %')) : null);
  }

  window.Coach = Object.assign(window.Coach || {}, {
    Button: Button,
    GoalBadge: GoalBadge,
    SessionStatus: SessionStatus,
    SetRow: SetRow,
    RpePicker: RpePicker,
    ExerciseCard: ExerciseCard,
    RecommendationNote: RecommendationNote,
    PrStat: PrStat
  });
})();
