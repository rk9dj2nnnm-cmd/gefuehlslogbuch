/* ---------- Zugangscode-Hürde (index.html) ---------- */
function initAccessGate() {
  const gate = $a('accessGate');
  const authSection = $a('authSection');

  if (localStorage.getItem('gefuehlstaucher_gate') === 'passed') {
    gate.style.display = 'none';
    authSection.style.display = '';
    return;
  }

  const gateForm = $a('gateForm');
  const gateSubmitBtn = gateForm.querySelector('button[type="submit"]');

  gateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $a('gateCode');
    const errorEl = $a('gateError');
    errorEl.textContent = '';
    gateSubmitBtn.disabled = true;

    try {
      const res = await fetch('/api/check-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: input.value })
      });
      const data = await res.json();
      if (data.valid) {
        localStorage.setItem('gefuehlstaucher_gate', 'passed');
        gate.style.display = 'none';
        authSection.style.display = '';
      } else {
        errorEl.textContent = 'Falscher Code.';
      }
    } catch (err) {
      errorEl.textContent = 'Prüfung gerade nicht möglich. Versuch es nochmal.';
    } finally {
      gateSubmitBtn.disabled = false;
    }
  });
}

/* ---------- Login/Registrierung (index.html) ---------- */
function initAuthPage() {
  const form = $a('authForm');
  const tabLogin = $a('tabLogin');
  const tabRegister = $a('tabRegister');
  const authTitle = $a('authTitle');
  const submitBtn = $a('submitBtn');
  const errorMsg = $a('errorMsg');
  const hintMsg = $a('hintMsg');

  let mode = 'login';

  function setMode(newMode) {
    mode = newMode;
    errorMsg.textContent = '';
    hintMsg.textContent = '';
    const isLogin = mode === 'login';
    tabLogin.classList.toggle('active', isLogin);
    tabRegister.classList.toggle('active', !isLogin);
    authTitle.textContent = isLogin ? 'Willkommen zurück' : 'Konto erstellen';
    submitBtn.textContent = isLogin ? 'Anmelden' : 'Registrieren';
  }

  tabLogin.addEventListener('click', () => setMode('login'));
  tabRegister.addEventListener('click', () => setMode('register'));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMsg.textContent = '';
    hintMsg.textContent = '';
    submitBtn.disabled = true;

    const email = $a('email').value.trim();
    const password = $a('password').value;

    try {
      if (mode === 'login') {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = '/app';
      } else {
        const { data, error } = await supabaseClient.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          window.location.href = '/app';
        } else if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          // Supabase gibt aus Sicherheitsgründen (kein E-Mail-Enumeration-Leak) keinen Fehler zurück,
          // wenn die E-Mail schon ein bestätigtes Konto hat – stattdessen eine leere identities-Liste.
          setMode('login');
          errorMsg.textContent = 'Für diese E-Mail existiert bereits ein Konto. Bitte melde dich an.';
        } else {
          setMode('login');
          hintMsg.textContent = 'Fast geschafft: Bitte bestätige deine E-Mail-Adresse über den Link, den wir dir geschickt haben, und melde dich danach an.';
        }
      }
    } catch (err) {
      errorMsg.textContent = translateAuthError(err.message);
    } finally {
      submitBtn.disabled = false;
    }
  });

  // Schon eingeloggt? Direkt weiter zur App.
  supabaseClient.auth.getSession().then(({ data }) => {
    if (data.session) window.location.href = '/app';
  });
}

/* ---------- Geschützte App-Seite (app.html) ---------- */
function initAppAuthGuard() {
  const userEmailEl = $a('userEmail');
  const logoutBtn = $a('logoutBtn');

  window.authReady = supabaseClient.auth.getSession().then(({ data }) => {
    if (!data.session) {
      window.location.href = '/';
      return null;
    }
    userEmailEl.textContent = data.session.user.email;
    return data.session.user;
  });

  logoutBtn.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = '/';
  });
}

function translateAuthError(message) {
  if (/Invalid login credentials/i.test(message)) return 'E-Mail oder Passwort ist falsch.';
  if (/User already registered/i.test(message)) return 'Für diese E-Mail existiert bereits ein Konto.';
  if (/Password should be at least/i.test(message)) return 'Das Passwort muss mindestens 6 Zeichen lang sein.';
  return message;
}

function $a(id) { return document.getElementById(id); }

if (document.getElementById('authForm')) {
  initAccessGate();
  initAuthPage();
} else if (document.getElementById('logoutBtn')) {
  initAppAuthGuard();
}
