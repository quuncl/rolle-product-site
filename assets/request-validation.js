// Local format checks only: no contact details leave the browser.
const controlCharacters = /[\u0000-\u001f\u007f]/;

export function validateName(raw) {
  const value = String(raw).normalize('NFC').trim().replace(/\p{Zs}+/gu, ' ');
  if (!value) return {value:'', error:''};
  if ([...value].length > 80) return {value, error:'Имя должно быть не длиннее 80 символов.'};
  const allowed = /^[\p{L}\p{M} .'’ʼ·\u2010\u2011-]+$/u;
  if (controlCharacters.test(raw) || !allowed.test(value) || !/\p{L}/u.test(value)) {
    return {value, error:'Укажите имя буквами, например «Анна-Мария».'};
  }
  return {value, error:''};
}

function isEmail(value) {
  const parts = value.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || local.length > 64 || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)) return false;
  const labels = domain.split('.');
  return labels.length >= 2
    && labels.every(label => /^[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?$/u.test(label))
    && /^(?:\p{L}{2,}|xn--[a-z0-9-]{2,})$/iu.test(labels.at(-1));
}

function isPhone(value) {
  if (!/^\+?[\d ().-]+$/.test(value)) return false;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15 || (value.startsWith('+') && digits.startsWith('0'))) return false;
  let depth = 0;
  for (const character of value) {
    if (character === '(' && ++depth > 1) return false;
    if (character === ')' && --depth < 0) return false;
  }
  return depth === 0;
}

export function validateContact(raw) {
  const value = String(raw).trim();
  if (!value) return {value:'', error:''};
  if (value.length > 120) return {value, error:'Контакт должен быть не длиннее 120 символов.'};
  const valid = !controlCharacters.test(raw) && (value.includes('@') ? isEmail(value) : isPhone(value));
  return {value, error:valid ? '' : 'Введите email, например name@example.com, или телефон: +7 999 123-45-67 (7–15 цифр).'};
}

export function createRequestValidation(form) {
  const fields = [
    {input:form.querySelector('#customerName'), error:form.querySelector('#customerNameError'), validate:validateName},
    {input:form.querySelector('#customerContact'), error:form.querySelector('#customerContactError'), validate:validateContact},
  ];
  const touched = new Set();

  function check(field) {
    const result = field.validate(field.input.value);
    field.input.setCustomValidity(result.error);
    field.input.setAttribute('aria-invalid', String(Boolean(result.error)));
    field.error.textContent = result.error;
    field.error.hidden = !result.error;
    return result;
  }

  for (const field of fields) {
    field.input.addEventListener('blur', () => {
      touched.add(field);
      const result = check(field);
      if (!result.error) field.input.value = result.value;
    });
    field.input.addEventListener('input', event => {
      if (!event.isComposing && touched.has(field)) check(field);
    });
    field.input.addEventListener('compositionend', () => {
      if (touched.has(field)) check(field);
    });
  }

  return {
    validateAndNormalize() {
      const results = fields.map(field => { touched.add(field); return check(field); });
      const firstInvalid = results.findIndex(result => result.error);
      if (firstInvalid !== -1) {
        fields[firstInvalid].input.focus();
        fields[firstInvalid].input.scrollIntoView({block:'nearest', behavior:'instant'});
        return false;
      }
      fields.forEach((field, index) => { field.input.value = results[index].value; });
      return true;
    },
  };
}
