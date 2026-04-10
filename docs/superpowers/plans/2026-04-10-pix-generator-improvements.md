# Pix Generator Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** adicionar seleção explícita de tipo de chave Pix, validação por tipo e modal de resultado sem aumentar o escopo funcional do app.

**Architecture:** separar a lógica de chave Pix e payload em funções puras testáveis e manter a UI como camada fina de DOM e QR Code. A interface continua em HTML estático com Tailwind CDN, mas ganha seletor de tipo, mensagens de erro e modal central para o resultado.

**Tech Stack:** HTML, JavaScript vanilla, Node.js test runner (`node:test`), Tailwind CDN, QRCode.js via CDN

---

### Task 1: Preparar infraestrutura de testes

**Files:**
- Modify: `package.json`
- Create: `tests/pix.test.js`

- [ ] **Step 1: Write the failing test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePixKey } = require('../script.js');

test('normalizePixKey normalizes CPF to digits only', () => {
  const result = normalizePixKey('cpf', '529.982.247-25');
  assert.equal(result, '52998224725');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with `normalizePixKey is not a function` or equivalent export error

- [ ] **Step 3: Write minimal implementation**

```js
function normalizePixKey(type, value) {
  if (type === 'cpf') return value.replace(/\D/g, '');
  return value.trim();
}

if (typeof module !== 'undefined') {
  module.exports = { normalizePixKey };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS for the CPF normalization test

- [ ] **Step 5: Update test script**

```json
"scripts": {
  "test": "node --test"
}
```

### Task 2: Cobrir normalização e validação por tipo

**Files:**
- Modify: `script.js`
- Modify: `tests/pix.test.js`

- [ ] **Step 1: Write the failing tests**

```js
const { normalizePixKey, validatePixForm } = require('../script.js');

test('normalizePixKey normalizes CNPJ to digits only', () => {
  assert.equal(normalizePixKey('cnpj', '12.345.678/0001-90'), '12345678000190');
});

test('normalizePixKey trims email', () => {
  assert.equal(normalizePixKey('email', '  pix@empresa.com.br  '), 'pix@empresa.com.br');
});

test('normalizePixKey normalizes phone keeping leading plus', () => {
  assert.equal(normalizePixKey('phone', '+55 (11) 99876-5432'), '+5511998765432');
});

test('validatePixForm rejects invalid CPF length', () => {
  const result = validatePixForm({
    pixKeyType: 'cpf',
    pixKey: '123',
    merchantName: 'Empresa Teste',
    merchantCity: 'Sao Paulo',
    amount: 0,
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /CPF/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL because `validatePixForm` does not exist and new assertions are unmet

- [ ] **Step 3: Write minimal implementation**

```js
function normalizePixKey(type, value) {
  const trimmed = value.trim();

  if (type === 'cpf' || type === 'cnpj') return trimmed.replace(/\D/g, '');
  if (type === 'phone') {
    const keepPlus = trimmed.startsWith('+') ? '+' : '';
    return keepPlus + trimmed.replace(/[^\d]/g, '');
  }
  return trimmed;
}

function validatePixKey(type, normalizedKey) {
  if (type === 'cpf') return /^\d{11}$/.test(normalizedKey) ? null : 'CPF invalido';
  if (type === 'cnpj') return /^\d{14}$/.test(normalizedKey) ? null : 'CNPJ invalido';
  if (type === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedKey) ? null : 'E-mail invalido';
  if (type === 'phone') return /^\+55\d{10,11}$/.test(normalizedKey) ? null : 'Telefone invalido';
  if (type === 'random') return normalizedKey ? null : 'Chave aleatoria invalida';
  return 'Tipo de chave invalido';
}

function validatePixForm(input) {
  const normalizedKey = normalizePixKey(input.pixKeyType, input.pixKey);
  const keyError = validatePixKey(input.pixKeyType, normalizedKey);
  if (keyError) return { ok: false, error: keyError };
  if (!input.merchantName.trim()) return { ok: false, error: 'Nome do recebedor obrigatorio' };
  if (!input.merchantCity.trim()) return { ok: false, error: 'Cidade obrigatoria' };
  return { ok: true, normalizedKey };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS for normalization and validation tests

### Task 3: Cobrir geração de payload para todos os tipos

**Files:**
- Modify: `tests/pix.test.js`
- Modify: `script.js`

- [ ] **Step 1: Write the failing tests**

```js
const { buildPixPayload } = require('../script.js');

test('buildPixPayload generates payload for CPF key', () => {
  const payload = buildPixPayload({
    pixKeyType: 'cpf',
    pixKey: '529.982.247-25',
    merchantName: 'Loja Centro',
    merchantCity: 'Curitiba',
    amount: 10.5,
  });

  assert.match(payload, /br\.gov\.bcb\.pix/);
  assert.match(payload, /52998224725/);
  assert.match(payload, /540510\.50/);
});

test('buildPixPayload generates payload for random key without amount', () => {
  const payload = buildPixPayload({
    pixKeyType: 'random',
    pixKey: '123e4567-e89b-12d3-a456-426614174000',
    merchantName: 'Loja Centro',
    merchantCity: 'Curitiba',
    amount: 0,
  });

  assert.match(payload, /123e4567-e89b-12d3-a456-426614174000/);
  assert.doesNotMatch(payload, /54\d{2}/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL because `buildPixPayload` does not exist

- [ ] **Step 3: Write minimal implementation**

```js
function buildPixPayload(input) {
  const validation = validatePixForm(input);
  if (!validation.ok) throw new Error(validation.error);

  const pix = new PixPayload(
    validation.normalizedKey,
    input.merchantName.trim(),
    input.merchantCity.trim(),
    Number(input.amount) || 0
  );

  return pix.generate();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS for payload generation with and without amount

### Task 4: Atualizar formulário para tipo de chave e erro inline

**Files:**
- Modify: `index.html`
- Modify: `script.js`

- [ ] **Step 1: Write the failing tests**

```js
test('validatePixForm rejects invalid email format', () => {
  const result = validatePixForm({
    pixKeyType: 'email',
    pixKey: 'email-invalido',
    merchantName: 'Empresa Teste',
    merchantCity: 'Sao Paulo',
    amount: 0,
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /E-mail/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL until email validation behavior is confirmed in shared logic

- [ ] **Step 3: Write minimal implementation**

```html
<div>
  <label for="pixKeyType">Tipo de chave Pix</label>
  <select id="pixKeyType" required>
    <option value="cpf">CPF</option>
    <option value="cnpj">CNPJ</option>
    <option value="email">E-mail</option>
    <option value="phone">Telefone</option>
    <option value="random">Aleatoria</option>
  </select>
</div>
<p id="formError" class="hidden"></p>
```

```js
const PIX_KEY_CONFIG = {
  cpf: { placeholder: '000.000.000-00' },
  cnpj: { placeholder: '00.000.000/0000-00' },
  email: { placeholder: 'seuemail@dominio.com' },
  phone: { placeholder: '+55 11 99999-9999' },
  random: { placeholder: 'Chave aleatoria' },
};

function updatePixKeyPlaceholder() {
  const type = document.getElementById('pixKeyType').value;
  document.getElementById('pixKey').placeholder = PIX_KEY_CONFIG[type].placeholder;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS with email validation covered

### Task 5: Implementar modal de resultado e integrar geração

**Files:**
- Modify: `index.html`
- Modify: `script.js`

- [ ] **Step 1: Write the failing tests**

```js
test('validatePixForm accepts valid Brazilian phone with country code', () => {
  const result = validatePixForm({
    pixKeyType: 'phone',
    pixKey: '+55 (11) 99876-5432',
    merchantName: 'Empresa Teste',
    merchantCity: 'Sao Paulo',
    amount: 0,
  });

  assert.equal(result.ok, true);
  assert.equal(result.normalizedKey, '+5511998765432');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL until phone acceptance is implemented exactly as planned

- [ ] **Step 3: Write minimal implementation**

```html
<div id="resultModal" class="hidden">
  <div id="modalOverlay"></div>
  <div role="dialog" aria-modal="true">
    <button id="closeModalBtn" type="button">Fechar</button>
    <canvas id="qrCode"></canvas>
    <input id="pixCopyPaste" readonly>
    <button id="copyBtn" type="button">Copiar</button>
    <p id="amountDisplay" class="hidden"></p>
  </div>
</div>
```

```js
function showModal() {
  resultModal.classList.remove('hidden');
}

function hideModal() {
  resultModal.classList.add('hidden');
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearFormError();
  const payload = buildPixPayload(readFormValues());
  await QRCode.toCanvas(qrCanvas, payload, { width: 250, margin: 2 });
  pixCopyPaste.value = payload;
  showAmount();
  showModal();
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS for phone acceptance and no regressions in payload tests

### Task 6: Refinar fechamento da modal e verificação final

**Files:**
- Modify: `script.js`
- Modify: `index.html`

- [ ] **Step 1: Write the failing test**

```js
test('validatePixForm rejects empty random key', () => {
  const result = validatePixForm({
    pixKeyType: 'random',
    pixKey: '   ',
    merchantName: 'Empresa Teste',
    merchantCity: 'Sao Paulo',
    amount: 0,
  });

  assert.equal(result.ok, false);
  assert.match(result.error, /aleatoria/i);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL until empty random key is explicitly rejected

- [ ] **Step 3: Write minimal implementation**

```js
closeModalBtn.addEventListener('click', hideModal);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') hideModal();
});

function clearFormError() {
  formError.textContent = '';
  formError.classList.add('hidden');
}

function showFormError(message) {
  formError.textContent = message;
  formError.classList.remove('hidden');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS for all tests in `tests/pix.test.js`

- [ ] **Step 5: Run manual verification**

Run:
```bash
python3 -m http.server 4173
```

Then verify in browser:
- trocar o tipo altera o placeholder
- chave invalida mostra erro e nao abre modal
- chave valida gera QR Code e abre modal
- copia e cola recebe o payload
- fechar e `Escape` fecham a modal
