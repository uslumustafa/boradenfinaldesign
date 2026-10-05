import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeMail, MAIL_MAX } from '../src/assets/js/modules/form-kit.js';

test('mail body stays bounded when header alone exceeds the limit', () => {
  const input = { to: 'test@example.invalid', subject: 'Test', header: ['Şirket: ' + '🙂'.repeat(1000)], message: 'Mesaj korunmalı. '.repeat(200) };
  const mail = composeMail(input);
  assert.ok(mail.body.length <= MAIL_MAX, `body length: ${mail.body.length}`);
  assert.ok(mail.body.includes('kısaltıldı'));
  assert.ok(mail.full.includes(input.header[0]) && mail.full.includes(input.message));
  assert.ok(mail.body.isWellFormed());
});

test('message truncation preserves Unicode and full copy payload', () => {
  const message = 'Türkçe çğıöşü 🙂 '.repeat(300);
  const mail = composeMail({ to: 'test@example.invalid', subject: 'Test', header: ['Ad: Test'], message });
  assert.ok(mail.cut && mail.body.length <= MAIL_MAX && mail.body.isWellFormed());
  assert.ok(mail.full.endsWith(message));
});

test('short messages remain complete', () => {
  const mail = composeMail({ to: 'test@example.invalid', subject: 'Test', header: ['Ad: Test'], message: 'Kısa mesaj' });
  assert.equal(mail.body, 'Ad: Test\n\nMesaj:\nKısa mesaj');
  assert.equal(mail.cut, false);
});

test('custom small body limits remain bounded', () => {
  for (const max of [0, 1, 80, 140, 1800]) {
    const mail = composeMail({ to: 'test@example.invalid', subject: 'Test', header: ['🙂'.repeat(1000)], message: '🙂'.repeat(1000), max });
    assert.ok(mail.body.length <= max && mail.body.isWellFormed(), `limit ${max}`);
    assert.ok(mail.full.includes('🙂'.repeat(1000)));
  }
});
