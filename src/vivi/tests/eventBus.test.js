// Basic tests for the EventBus module.
// Run via: import and call runEventBusTests() or use exec_tool.

import { EventBus } from '../core/EventBus';

export function runEventBusTests() {
  const results = [];
  const assert = (name, cond) => {
    results.push({ name, passed: !!cond });
    if (!cond) throw new Error(`Assertion failed: ${name}`);
  };

  // 1. Subscribe and receive
  const bus1 = new EventBus();
  let received = null;
  bus1.on('test:event', (p) => { received = p; });
  bus1.emit('test:event', { hello: 'world' });
  assert('receives payload', received?.hello === 'world');

  // 2. Unsubscribe
  const bus2 = new EventBus();
  let count = 0;
  const unsub = bus2.on('count', () => count++);
  bus2.emit('count');
  bus2.emit('count');
  unsub();
  bus2.emit('count');
  assert('unsubscribe stops delivery', count === 2);

  // 3. Error isolation — one handler throwing doesn't block others
  const bus3 = new EventBus();
  let secondCalled = false;
  bus3.on('safe', () => { throw new Error('boom'); });
  bus3.on('safe', () => { secondCalled = true; });
  bus3.emit('safe');
  assert('error isolation', secondCalled);

  // 4. once() auto-unsubscribes
  const bus4 = new EventBus();
  let onceCount = 0;
  bus4.once('once', () => onceCount++);
  bus4.emit('once');
  bus4.emit('once');
  assert('once fires exactly once', onceCount === 1);

  // 5. off() removes specific handler
  const bus5 = new EventBus();
  let offCount = 0;
  const handler = () => offCount++;
  bus5.on('evt', handler);
  bus5.emit('evt');
  bus5.off('evt', handler);
  bus5.emit('evt');
  assert('off removes handler', offCount === 1);

  return results;
}