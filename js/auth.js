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
        window.location.href = 'app.html';
      } else {
        const { data, error } = await supabaseClient.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          window.location.href = 'app.html';
        } else {
          hintMsg.textContent = 'Fast geschafft: Bitte bestätige deine E-Mail-Adresse über den Link, den wir dir geschickt haben, und melde dich danach an.';
          setMode('login');
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
    if (data.session) window.location.href = 'app.html';
  });
}

/* ---------- Geschützte App-Seite (app.html) ---------- */
function initAppAuthGuard() {
  const userEmailEl = $a('userEmail');
  const logoutBtn = $a('logoutBtn');

  supabaseClient.auth.getSession().then(({ data }) => {
    if (!data.session) {
      window.location.href = 'index.html';
      return;
    }
    userEmailEl.textContent = data.session.user.email;
  });

  logoutBtn.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
    window.location.href = 'index.html';
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
  initAuthPage();
} else if (document.getElementById('logoutBtn')) {
  initAppAuthGuard();
}
