import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldSubmitOnEnter } from '../src/utils/validation.js';

test('Enter triggers submission when valid text is present', () => {
  const event = { key: 'Enter', shiftKey: false };
  const canSubmit = shouldSubmitOnEnter(event, {
    inputText: 'Congratulations! You have been selected for a part-time job.',
    isLoading: false,
    attachedFile: null
  });
  assert.equal(canSubmit, true);
});

test('Shift + Enter does not submit so a newline can be inserted normally', () => {
  const event = { key: 'Enter', shiftKey: true };
  const canSubmit = shouldSubmitOnEnter(event, {
    inputText: 'First line of offer details',
    isLoading: false,
    attachedFile: null
  });
  assert.equal(canSubmit, false);
});

test('Empty input does not trigger submission on Enter', () => {
  const event = { key: 'Enter', shiftKey: false };
  assert.equal(shouldSubmitOnEnter(event, { inputText: '', isLoading: false, attachedFile: null }), false);
  assert.equal(shouldSubmitOnEnter(event, { inputText: null, isLoading: false, attachedFile: null }), false);
});

test('Whitespace-only input does not trigger submission on Enter', () => {
  const event = { key: 'Enter', shiftKey: false };
  assert.equal(shouldSubmitOnEnter(event, { inputText: '   \n\t   ', isLoading: false, attachedFile: null }), false);
});

test('Repeated Enter presses while loading do not trigger multiple submissions', () => {
  const event = { key: 'Enter', shiftKey: false };
  const canSubmit = shouldSubmitOnEnter(event, {
    inputText: 'Valid offer text awaiting analysis',
    isLoading: true,
    attachedFile: null
  });
  assert.equal(canSubmit, false);
});

test('IME composition Enter does not accidentally trigger submission', () => {
  // Test standard isComposing flag
  const imeEvent1 = { key: 'Enter', shiftKey: false, isComposing: true };
  assert.equal(shouldSubmitOnEnter(imeEvent1, { inputText: 'こんにちは', isLoading: false }), false);

  // Test nativeEvent.isComposing flag
  const imeEvent2 = { key: 'Enter', shiftKey: false, nativeEvent: { isComposing: true } };
  assert.equal(shouldSubmitOnEnter(imeEvent2, { inputText: 'こんにちは', isLoading: false }), false);

  // Test keyCode 229 (standard IME composition keycode)
  const imeEvent3 = { key: 'Enter', shiftKey: false, keyCode: 229 };
  assert.equal(shouldSubmitOnEnter(imeEvent3, { inputText: 'こんにちは', isLoading: false }), false);
});

test('Attached file allows Enter submission even if textarea text is empty', () => {
  const event = { key: 'Enter', shiftKey: false };
  const canSubmit = shouldSubmitOnEnter(event, {
    inputText: '',
    isLoading: false,
    attachedFile: { name: 'offer_letter.pdf', size: 1024 }
  });
  assert.equal(canSubmit, true);
});

test('Non-Enter keys do not trigger submission', () => {
  assert.equal(shouldSubmitOnEnter({ key: 'Tab' }, { inputText: 'Valid text' }), false);
  assert.equal(shouldSubmitOnEnter({ key: 'Escape' }, { inputText: 'Valid text' }), false);
  assert.equal(shouldSubmitOnEnter({ key: 'a' }, { inputText: 'Valid text' }), false);
});

test('Simulated handleKeyDown dispatch behavior matches requirements', () => {
  function createSimulator(state) {
    let preventDefaultCalled = false;
    let submitted = false;

    const handleSubmit = () => {
      if (state.isLoading) return;
      if (!state.attachedFile && (!state.inputText || state.inputText.trim().length === 0)) return;
      submitted = true;
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        if (e.isComposing || e.nativeEvent?.isComposing || e.keyCode === 229) {
          return;
        }
        e.preventDefault();
        if (shouldSubmitOnEnter(e, state)) {
          handleSubmit(e);
        }
      }
    };

    return {
      dispatch: (event) => {
        event.preventDefault = () => { preventDefaultCalled = true; };
        handleKeyDown(event);
      },
      get preventDefaultCalled() { return preventDefaultCalled; },
      get submitted() { return submitted; }
    };
  }

  // 1. Enter on valid text -> prevents default (no newline) and submits
  const sim1 = createSimulator({ inputText: 'Earn Rs 5000 daily', isLoading: false, attachedFile: null });
  sim1.dispatch({ key: 'Enter', shiftKey: false });
  assert.equal(sim1.preventDefaultCalled, true);
  assert.equal(sim1.submitted, true);

  // 2. Shift + Enter -> allows default (inserts newline) and does NOT submit
  const sim2 = createSimulator({ inputText: 'Earn Rs 5000 daily', isLoading: false, attachedFile: null });
  sim2.dispatch({ key: 'Enter', shiftKey: true });
  assert.equal(sim2.preventDefaultCalled, false);
  assert.equal(sim2.submitted, false);

  // 3. Empty input -> prevents default (prevents empty newline) but does NOT submit
  const sim3 = createSimulator({ inputText: '   ', isLoading: false, attachedFile: null });
  sim3.dispatch({ key: 'Enter', shiftKey: false });
  assert.equal(sim3.preventDefaultCalled, true);
  assert.equal(sim3.submitted, false);

  // 4. Repeated Enter while loading -> prevents default but does NOT submit again
  const sim4 = createSimulator({ inputText: 'Valid text', isLoading: true, attachedFile: null });
  sim4.dispatch({ key: 'Enter', shiftKey: false });
  assert.equal(sim4.preventDefaultCalled, true);
  assert.equal(sim4.submitted, false);

  // 5. IME composition Enter -> does NOT prevent default (allows IME candidate confirmation) and does NOT submit
  const sim5 = createSimulator({ inputText: 'typing', isLoading: false, isComposing: true });
  sim5.dispatch({ key: 'Enter', shiftKey: false, isComposing: true });
  assert.equal(sim5.preventDefaultCalled, false);
  assert.equal(sim5.submitted, false);
});
