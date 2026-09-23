const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const app = fs.readFileSync(path.join(__dirname, '..', 'dist', 'app.js'), 'utf8');
function source(name) {
  const start = app.indexOf(`  function ${name}(`);
  assert.notEqual(start, -1, name);
  const end = app.indexOf('\n  function ', start + 1);
  return app.slice(start, end);
}

// Run the production day processor and asynchronous controller together, with
// deterministic daily systems and timers so crossing a stop date is detectable.
function career({ matchDay = 6, daily = () => {} } = {}) {
  const timers = [];
  const elements = new Map();
  function element() {
    return { disabled: false, classList: { add() {}, remove() {} }, setAttribute() {}, removeAttribute() {} };
  }
  for (const id of ['#centralAdvancePanel', '#centralAdvanceDay', '#centralAdvanceNext']) elements.set(id, element());
  const state = {
    day: 0, saves: 0, locked: false, opened: null, decision: null,
    reviewOpened: 0, updates: [], toasts: [], calendarEvents: [],
  };
  const context = vm.createContext({
    console: { error() {} },
    centralAdvanceBusy: false, centralAdvanceToEventBusy: false,
    NOTIFICATION_PRIORITIES: ['ROUTINE', 'INTERESTING', 'IMPORTANT'],
    EVENT_PRIORITY: { INFO: 0, NORMAL: 1, IMPORTANT: 2, BLOCKING: 3 },
    roadToGlory: { seasonReview: { pending: false } },
    careerInboxMessages: [], currentClub: { id: 'club' },
    v202Performance: { deferredAdvanceSaveSkips: 0 },
    v37InboxDecision: () => null,
    initializeCareerCalendar() {}, v104Active: () => false,
    v104ProgressionBlock: () => null,
    pendingDecisionEvent: () => state.decision,
    currentCareerISO: () => state.day,
    addDaysISO: (date, days) => date + days,
    setCareerDate: date => { state.day = date; },
    userFixtureOnDate: date => date === matchDay ? { fixtureId: 'match' } : null,
    eventsOnDate: () => state.calendarEvents,
    processDailyPlayerUpdates: date => { state.updates.push(date); daily(date, context, state); },
    processLivingSquadDay() {},
    simulateWorldFixturesForDate: () => [], processScoutingForDate() {},
    processCareerEventsForDate: () => state.calendarEvents,
    processLivingCareerDay: () => ({}), processManagerMarketDay: () => ({ events: [] }),
    processMediaNarrativesDay: () => ({}), updateSeasonProgression: () => ({}),
    saveCareerState: () => { state.saves++; }, refreshActiveCareerScreen() {},
    renderCentral() {}, renderCentralAdvance() {},
    renderSeasonReviewOverlay: () => { state.reviewOpened++; },
    showCareerDecisionOverlay: decision => { state.opened = decision; },
    centralOpenOffice: (tab, id) => { assert.equal(state.locked, false); state.opened = { tab, id }; },
    goCareerScreen: screen => { state.opened = screen; },
    fixtureClubs: () => ({ home: { name: 'Home' }, away: { name: 'Away' } }),
    shortDateLabel: String,
    showToast: message => { state.toasts.push(message); },
    setCareerNavigationLocked: value => { state.locked = value; },
    $: id => elements.get(id),
    setTimeout: fn => { timers.push(fn); },
  });
  vm.runInContext(['notificationPriorityValue', 'notificationPriorityForMessage', 'eventShouldStopAdvance', 'advanceCareerDay', 'advanceCentralToNextEvent'].map(source).join('\n'), context);
  return {
    state, context, elements,
    advance() { context.advanceCentralToNextEvent(); },
    flush() {
      let ticks = 0;
      while (timers.length) { assert.ok(ticks++ < 100, 'advance terminates'); timers.shift()(); }
      assert.equal(context.centralAdvanceToEventBusy, false);
      assert.equal(state.locked, false);
      for (const element of elements.values()) assert.equal(element.disabled, false);
    },
  };
}

test('main Advance runs to events; secondary action retains manual one-day control', () => {
  const handlers = new Map();
  const eventAdvance = () => {};
  const dayAdvance = () => {};
  const binding = app.split('\n').filter(line => /\$\('#centralAdvance(?:Day|Next)'\).*addEventListener/.test(line)).join('\n');
  vm.runInNewContext(binding, {
    $: id => ({ addEventListener: (_, handler) => handlers.set(id, handler) }),
    advanceCentralToNextEvent: eventAdvance, advanceCentralCareerDay: dayAdvance,
  });
  assert.equal(handlers.get('#centralAdvanceDay'), eventAdvance);
  assert.equal(handlers.get('#centralAdvanceNext'), dayAdvance);
});

test('quiet days continue and routine mail is skipped until an unplayed matchday', () => {
  const run = career({ daily(day, context) {
    context.careerInboxMessages.unshift({ id: `routine-${day}`, notificationPriority: 'ROUTINE' });
  } });
  run.advance(); run.advance(); // Repeated clicks cannot start a second loop.
  run.flush();
  assert.deepEqual(run.state.updates, [1, 2, 3, 4, 5, 6]);
  assert.equal(run.state.saves, 1);
  assert.match(run.state.toasts.at(-1), /Home v Away/);
  run.advance(); run.flush();
  assert.equal(run.state.opened, 'matchday');
  assert.equal(run.state.day, 6);
});

test('an important loan email stops on arrival and opens that email', () => {
  const run = career({ daily(day, context) {
    if (day === 3) context.careerInboxMessages.unshift({ id: 'loan-offer-1', type: 'TRANSFERS', subject: 'Loan offer: Player' });
  } });
  run.advance(); run.flush();
  assert.equal(run.state.day, 3);
  assert.deepEqual(run.state.opened, { tab: 'inbox', id: 'loan-offer-1' });
  // Even if mail remains unread, a subsequent Advance can continue.
  run.advance(); run.flush();
  assert.equal(run.state.day, 6);
});

test('new important email is detected even when the capped inbox stays at 60 messages', () => {
  const run = career({ daily(day, context) {
    if (day === 2) context.careerInboxMessages = [{ id: 'new-mail', requiresAction: true }, ...context.careerInboxMessages].slice(0, 60);
  } });
  run.context.careerInboxMessages = Array.from({ length: 60 }, (_, n) => ({ id: `old-${n}`, notificationPriority: 'IMPORTANT' }));
  run.advance(); run.flush();
  assert.equal(run.state.day, 2);
  assert.equal(run.state.opened.id, 'new-mail');
});

test('required decisions stop immediately and never consume a further day', () => {
  const run = career({ daily(day, context, state) {
    if (day === 2) state.decision = { id: 'decision', title: 'Resolve this' };
  } });
  run.advance(); run.flush();
  assert.equal(run.state.day, 2);
  assert.equal(run.state.opened.id, 'decision');
  run.advance(); run.flush();
  assert.equal(run.state.day, 2);
});

test('season review stops even without an important-event payload', () => {
  const run = career({ daily(day, context) {
    if (day === 2) context.roadToGlory.seasonReview.pending = true;
  } });
  run.advance(); run.flush();
  assert.equal(run.state.day, 2);
  assert.equal(run.state.reviewOpened, 1);
});

test('blocking calendar events and transfer deadlines stop progression', () => {
  for (const event of [{ blocking: true }, { requiresAction: true }, { priority: 'IMPORTANT', type: 'TRANSFER_WINDOW_CLOSE' }]) {
    const run = career({ daily(day, context, state) {
      if (day === 2) state.calendarEvents = [{ ...event, title: 'Important event' }];
    } });
    run.advance(); run.flush();
    assert.equal(run.state.day, 2);
  }
});

test('shared-calendar barriers do not advance local time', () => {
  const run = career();
  run.context.v104ProgressionBlock = () => ({ message: 'Waiting for the other manager' });
  run.advance(); run.flush();
  assert.equal(run.state.day, 0);
  assert.equal(run.state.saves, 0);
  assert.match(run.state.toasts.at(-1), /other manager/);
});

test('a simulation or save error releases navigation and reports failure', () => {
  for (const operation of ['processDailyPlayerUpdates', 'saveCareerState']) {
    const run = career({ matchDay: 1 });
    run.context[operation] = () => { throw new Error('Test failure'); };
    run.advance(); run.flush();
    assert.match(run.state.toasts.at(-1), /Advance failed/);
  }
});

test('quiet off-season advances retain the existing 35-day safety bound', () => {
  const run = career({ matchDay: 100 });
  run.advance(); run.flush();
  assert.equal(run.state.day, 35);
  assert.equal(run.state.saves, 1);
});
