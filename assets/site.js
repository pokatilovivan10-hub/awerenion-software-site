(function () {
  'use strict';

  const heroNote = document.querySelector('.hero-home .hero-note');
  if (heroNote) heroNote.textContent = 'От задачи → к системе → к измеримому результату.';
  document.querySelectorAll('.smallprint').forEach((note) => note.remove());

  const menu = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('#main-nav');
  if (menu && navigation) {
    menu.addEventListener('click', () => {
      const expanded = menu.getAttribute('aria-expanded') === 'true';
      menu.setAttribute('aria-expanded', String(!expanded));
      navigation.classList.toggle('is-open', !expanded);
    });
    navigation.addEventListener('click', (event) => {
      if (!event.target.closest('a')) return;
      navigation.classList.remove('is-open');
      menu.setAttribute('aria-expanded', 'false');
    });
  }

  function goal(name) {
    if (!window.METRIKA_ID || typeof window.ym !== 'function') return;
    try { window.ym(window.METRIKA_ID, 'reachGoal', name); } catch (_) {}
  }

  document.querySelectorAll('a[href^="tel:"]').forEach((link) => link.addEventListener('click', () => goal('click_phone')));
  document.querySelectorAll('a[href^="mailto:"]').forEach((link) => link.addEventListener('click', () => goal('click_email')));
  document.querySelectorAll('a[data-messenger]').forEach((link) => link.addEventListener('click', () => goal('click_messenger')));

  function validContact(value) {
    const contact = value.trim();
    if (!contact) return false;
    if (contact.includes('@')) return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact);
    return contact.replace(/\D/g, '').length >= 10;
  }

  document.querySelectorAll('form[data-contact-form]').forEach((form) => {
    const status = form.querySelector('[role="status"]');
    const button = form.querySelector('button[type="submit"]');
    const contact = form.querySelector('input[name="contact"]');
    contact.addEventListener('input', () => contact.setAttribute('aria-invalid', 'false'));
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      status.textContent = '';
      if (!form.reportValidity()) return;
      if (!validContact(contact.value)) {
        contact.setAttribute('aria-invalid', 'true');
        status.textContent = 'Укажите корректный телефон или e-mail.';
        contact.focus();
        return;
      }
      if (form.querySelector('input[name="bot-field"]').value) return;
      if (location.protocol === 'file:') {
        status.textContent = 'Это локальный макет. Отправка заявок заработает после подключения формы на хостинге.';
        return;
      }
      button.disabled = true;
      const initialButtonMarkup = button.innerHTML;
      button.textContent = 'Отправляем…';
      try {
        const response = await fetch('/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(new FormData(form)).toString(),
        });
        if (!response.ok) throw new Error('server');
        status.textContent = 'Заявка отправлена. Спасибо!';
        form.reset();
        goal('submit_form');
      } catch (_) {
        status.textContent = 'Не удалось отправить заявку. Напишите на mail@z7technologies.com или позвоните по указанному номеру.';
      } finally {
        button.disabled = false;
        button.innerHTML = initialButtonMarkup;
      }
    });
  });
})();
