/* GameHub — frontend-only single-player platform
   - localStorage for persistence (users, profiles, scores)
   - Games: Tic-Tac-Toe, Number Guess, Memory Flip
   - Lightweight modular architecture
*/

(() => {
  const STORAGE_USERS = 'gh_users'; // stores users as object keyed by username
  const STORAGE_SESSION = 'gh_session'; // current logged-in username

  // Utility helpers
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // UI elements
  const UI = {
    gameList: $('#game-list'),
    content: $('#content'),
    authModal: $('#auth-modal'),
    authForm: $('#auth-form'),
    authUsername: $('#auth-username'),
    authDisplay: $('#auth-display'),
    authPassword: $('#auth-password'),
    authClose: $('#auth-close'),
    authBtn: $('#btn-login'),
    signupBtn: $('#btn-signup'),
    authDemo: $('#auth-demo'),
    btnProfile: $('#btn-profile'),
    btnLogout: $('#btn-logout'),
    welcomeTitle: $('#welcome-title'),
    welcomeMsg: $('#welcome-msg'),
    profileSummary: $('#profile-summary'),
  };

  // In-memory registry for games
  const games = [];

  /* ----------------- Persistence layer (localStorage) ----------------- */
  function loadUsers() {
    try { return JSON.parse(localStorage.getItem(STORAGE_USERS)) || {}; }
    catch { return {}; }
  }
  function saveUsers(obj) {
    localStorage.setItem(STORAGE_USERS, JSON.stringify(obj));
  }
  function getSessionUser() {
    return localStorage.getItem(STORAGE_SESSION);
  }
  function setSessionUser(username) {
    if (username) localStorage.setItem(STORAGE_SESSION, username);
    else localStorage.removeItem(STORAGE_SESSION);
  }

  function getUser(username) {
    const users = loadUsers();
    return users[username] || null;
  }
  function upsertUser(user) {
    const users = loadUsers();
    users[user.username] = user;
    saveUsers(users);
  }

  /* ----------------- Auth UI & logic ----------------- */
  function showAuthModal(prefill = {}) {
    UI.authModal.classList.remove('hidden');
    UI.authUsername.value = prefill.username || '';
    UI.authDisplay.value = prefill.displayName || '';
    UI.authPassword.value = '';
    UI.authUsername.focus();
  }
  function hideAuthModal() { UI.authModal.classList.add('hidden'); }

  UI.authBtn.addEventListener('click', () => showAuthModal());
  UI.signupBtn.addEventListener('click', () => showAuthModal());
  UI.authClose.addEventListener('click', hideAuthModal);
  UI.authDemo.addEventListener('click', () => {
    const demo = { username: 'demo', displayName: 'Demo Player', scores: {}, created: Date.now() };
    upsertUser(demo);
    setSessionUser('demo');
    hideAuthModal();
    renderAuth();
    navigateTo('home');
  });

  UI.authForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = UI.authUsername.value.trim();
    const displayName = UI.authDisplay.value.trim() || username;
    if (!username) return alert('Please enter username');
    let user = getUser(username);
    if (!user) {
      // create
      user = { username, displayName, created: Date.now(), scores: {} };
      upsertUser(user);
    }
    setSessionUser(username);
    hideAuthModal();
    renderAuth();
    navigateTo('home');
  });

  UI.btnLogout.addEventListener('click', () => {
    setSessionUser(null);
    renderAuth();
    navigateTo('home');
  });

  UI.btnProfile.addEventListener('click', () => {
    const username = getSessionUser();
    if (!username) { showAuthModal(); return; }
    const user = getUser(username);
    alert(`Profile: ${user.displayName}\nUsername: ${user.username}\nCreated: ${new Date(user.created).toLocaleString()}`);
  });

  function renderAuth() {
    const username = getSessionUser();
    if (username) {
      const user = getUser(username);
      UI.welcomeTitle.textContent = `Hi, ${user.displayName}`;
      UI.welcomeMsg.textContent = `Play games and save your best scores.`;
      UI.authBtn.classList.add('hidden');
      UI.signupBtn.classList.add('hidden');
      UI.btnLogout.classList.remove('hidden');
      UI.btnProfile.classList.remove('hidden');
      renderProfileSummary(user);
    } else {
      UI.welcomeTitle.textContent = 'Welcome';
      UI.welcomeMsg.textContent = 'Sign in to save scores and personalize your profile.';
      UI.authBtn.classList.remove('hidden');
      UI.signupBtn.classList.remove('hidden');
      UI.btnLogout.classList.add('hidden');
      UI.btnProfile.classList.remove('hidden');
      UI.profileSummary.innerHTML = '';
    }
  }

  function renderProfileSummary(user) {
    const scores = user.scores || {};
    const list = Object.keys(scores).map(k => `<li>${k}: <strong>${scores[k]}</strong></li>`).join('') || '<li class="muted">No scores yet</li>';
    UI.profileSummary.innerHTML = `
      <h3>Your Stats</h3>
      <ul>${list}</ul>
    `;
  }

  /* ----------------- Game registry & router ----------------- */
  function registerGame(id, title, initFn) {
    games.push({ id, title, init: initFn });
  }

  function buildGameList() {
    UI.gameList.innerHTML = '';
    // Home
    const homeLi = document.createElement('li');
    homeLi.textContent = 'Home';
    homeLi.addEventListener('click', () => navigateTo('home'));
    UI.gameList.appendChild(homeLi);
    games.forEach(g => {
      const li = document.createElement('li');
      li.textContent = g.title;
      li.tabIndex = 0;
      li.addEventListener('click', () => navigateTo(g.id));
      UI.gameList.appendChild(li);
    });
  }

  function activateListItem(id) {
    $$('li', UI.gameList).forEach(li => {
      li.classList.toggle('active', li.textContent === (id === 'home' ? 'Home' : getGame(id).title));
    });
  }

  function getGame(id) {
    return games.find(g => g.id === id);
  }

  function navigateTo(id) {
    activateListItem(id);
    UI.content.innerHTML = '';
    if (id === 'home') {
      const home = document.createElement('div');
      home.className = 'pane';
      home.innerHTML = `<h2>GameHub</h2><p>Choose a game to start. Sign in to save scores per profile.</p>`;
      UI.content.appendChild(home);
      return;
    }
    const g = getGame(id);
    if (!g) return;
    const container = document.createElement('div');
    container.className = 'pane';
    UI.content.appendChild(container);
    g.init(container, { saveScore, loadScore, isLoggedIn: !!getSessionUser() });
  }

  /* ----------------- Persistence helpers for scores ----------------- */
  function saveScore(gameId, value) {
    const username = getSessionUser() || 'anon';
    if (username === 'anon') return; // do not save for anonymous
    const user = getUser(username);
    if (!user.scores) user.scores = {};
    const prev = user.scores[gameId];
    // For games where lower is better (moves), user modules will handle decide logic.
    // Here we store highest numeric score by default.
    if (prev == null || value > prev) user.scores[gameId] = value;
    upsertUser(user);
    renderProfileSummary(user);
  }
  function loadScore(gameId) {
    const username = getSessionUser() || 'anon';
    const user = getUser(username);
    return user && user.scores ? user.scores[gameId] : null;
  }

  /* ----------------- Game: Tic-Tac-Toe ----------------- */
  registerGame('tictactoe', 'Tic-Tac-Toe', (container, helpers) => {
    container.innerHTML = `
      <div class="game-header">
        <h2>Tic-Tac-Toe</h2>
        <div>
          <button id="t3-new" class="btn small">New Game</button>
          <button id="t3-ai" class="btn small btn-ghost">Play vs AI</button>
        </div>
      </div>
      <div id="t3-board" class="board t3-grid"></div>
      <div id="t3-status" class="small muted" style="margin-top:8px"></div>
    `;
    const boardEl = $('#t3-board', container);
    const status = $('#t3-status', container);
    const newBtn = $('#t3-new', container);
    const aiBtn = $('#t3-ai', container);

    let board = Array(9).fill(null);
    let turn = 'X';
    let vsAI = false;
    let finished = false;

    function render() {
      boardEl.innerHTML = '';
      board.forEach((val, i) => {
        const cell = document.createElement('div');
        cell.className = 't3-cell';
        cell.textContent = val || '';
        cell.addEventListener('click', () => onCell(i));
        boardEl.appendChild(cell);
      });
      if (finished) status.textContent = 'Game over. Start a new game.';
      else status.textContent = `Turn: ${turn}`;
    }

    function onCell(i) {
      if (finished || board[i]) return;
      board[i] = turn;
      const winner = checkWin(board);
      if (winner || board.every(Boolean)) {
        finished = true;
        if (winner) {
          status.textContent = `Winner: ${winner}`;
          // Save score: +1 for win
          saveResult(winner === 'X' ? 'player' : 'ai');
        } else {
          status.textContent = 'Draw';
        }
      } else {
        turn = turn === 'X' ? 'O' : 'X';
        if (vsAI && turn === 'O') {
          // simple AI: pick random available
          const avail = board.map((v,i)=>v?null:i).filter(v=>v!=null);
          const pick = avail[Math.floor(Math.random()*avail.length)];
          setTimeout(()=> { onCell(pick); }, 250);
        }
      }
      render();
    }

    function checkWin(b) {
      const lines = [
        [0,1,2],[3,4,5],[6,7,8],
        [0,3,6],[1,4,7],[2,5,8],
        [0,4,8],[2,4,6]
      ];
      for (const [a,b1,c] of lines) {
        if (b[a] && b[a] === b[b1] && b[a] === b[c]) return b[a];
      }
      return null;
    }

    function startNew() {
      board = Array(9).fill(null);
      turn = 'X';
      finished = false;
      render();
    }

    function saveResult(who) {
      // simple scoring: player win -> +1, draw -> 0, AI win -> 0
      if (who === 'player') {
        // store numeric score (wins count)
        const cur = loadScore('tictactoe') || 0;
        saveScore('tictactoe', cur + 1);
      }
    }

    newBtn.addEventListener('click', startNew);
    aiBtn.addEventListener('click', () => { vsAI = !vsAI; aiBtn.textContent = vsAI ? 'AI: On' : 'Play vs AI'; });

    // init
    render();
  });

  /* ----------------- Game: Number Guess ----------------- */
  registerGame('number-guess', 'Number Guess', (container, helpers) => {
    container.innerHTML = `
      <div class="game-header">
        <h2>Number Guess</h2>
        <div><button id="ng-new" class="btn small">New Round</button></div>
      </div>
      <div id="ng-area">
        <p class="muted">Guess a number between 1 and 100. Fewer attempts = better.</p>
        <div style="margin:8px 0;">
          <input id="ng-input" type="number" min="1" max="100" placeholder="Your guess" />
          <button id="ng-try" class="btn small">Try</button>
        </div>
        <div id="ng-feedback" class="small muted"></div>
        <div id="ng-stats" class="small muted" style="margin-top:6px;"></div>
      </div>
    `;
    const input = $('#ng-input', container);
    const tryBtn = $('#ng-try', container);
    const feedback = $('#ng-feedback', container);
    const stats = $('#ng-stats', container);
    const newBtn = $('#ng-new', container);

    let secret = null;
    let attempts = 0;
    let best = loadScore('number-guess') || null;

    function newRound() {
      secret = Math.floor(Math.random() * 100) + 1;
      attempts = 0;
      feedback.textContent = 'New number chosen. Start guessing!';
      stats.textContent = best ? `Best attempts: ${best}` : 'No best yet.';
      input.value = '';
    }
    tryBtn.addEventListener('click', () => {
      const v = Number(input.value);
      if (!v || v < 1 || v > 100) return alert('Enter a number 1-100');
      attempts++;
      if (v === secret) {
        feedback.textContent = `Correct! You took ${attempts} guesses.`;
        // Save best: lower is better
        if (best == null || attempts < best) {
          best = attempts;
          saveScore('number-guess', best);
          stats.textContent = `Best attempts: ${best}`;
        }
      } else if (v < secret) {
        feedback.textContent = 'Too low';
      } else {
        feedback.textContent = 'Too high';
      }
    });
    newBtn.addEventListener('click', newRound);

    // init
    newRound();
  });

  /* ----------------- Game: Memory Flip ----------------- */
  registerGame('memory-flip', 'Memory Flip', (container, helpers) => {
    container.innerHTML = `
      <div class="game-header">
        <h2>Memory Flip</h2>
        <div><button id="mf-new" class="btn small">New Game</button></div>
      </div>
      <div id="mf-board" class="board memory-grid"></div>
      <div id="mf-stats" class="small muted" style="margin-top:8px"></div>
    `;
    const boardEl = $('#mf-board', container);
    const newBtn = $('#mf-new', container);
    const stats = $('#mf-stats', container);

    const symbols = ['▲','■','●','★','✿','♥','◆','◉'];
    const pairs = 8;
    let deck = [];
    let flipped = [];
    let matched = new Set();
    let moves = 0;
    let best = loadScore('memory-flip') || null;

    function shuffleDeck() {
      const sel = symbols.slice(0, pairs);
      deck = sel.concat(sel).map((s,i)=>({ symbol:s, id:i }));
      for (let i = deck.length -1; i>0; i--) {
        const j = Math.floor(Math.random()*(i+1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
    }

    function renderBoard() {
      boardEl.innerHTML = '';
      deck.forEach((card, idx) => {
        const el = document.createElement('div');
        el.className = 'mem-card';
        el.dataset.idx = idx;
        if (matched.has(idx)) {
          el.textContent = card.symbol;
          el.style.background = '#d1fae5';
        } else if (flipped.includes(idx)) {
          el.textContent = card.symbol;
          el.style.background = '#fff7ed';
        } else {
          el.textContent = '';
        }
        el.addEventListener('click', () => onFlip(idx));
        boardEl.appendChild(el);
      });
      stats.textContent = `Moves: ${moves} ${best ? ' • Best: ' + best : ''}`;
    }

    function onFlip(i) {
      if (flipped.includes(i) || matched.has(i)) return;
      if (flipped.length === 2) return;
      flipped.push(i);
      renderBoard();
      if (flipped.length === 2) {
        moves++;
        const [a,b] = flipped;
        if (deck[a].symbol === deck[b].symbol) {
          matched.add(a);
          matched.add(b);
          flipped = [];
          checkWin();
        } else {
          setTimeout(()=> { flipped = []; renderBoard(); }, 600);
        }
      }
    }

    function checkWin() {
      if (matched.size === deck.length) {
        // win -> lower moves is better
        if (best == null || moves < best) {
          best = moves;
          saveScore('memory-flip', best);
        }
        setTimeout(()=> alert(`You won in ${moves} moves! Best: ${best}`), 200);
      }
      renderBoard();
    }

    function startNew() {
      shuffleDeck();
      flipped = [];
      matched = new Set();
      moves = 0;
      renderBoard();
    }

    newBtn.addEventListener('click', startNew);
    startNew();
  });

  /* ----------------- Boot ----------------- */
  function init() {
    renderAuth();
    buildGameList();
    navigateTo('home');

    // modal controls
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') UI.authModal.classList.add('hidden'); });
    UI.authModal.addEventListener('click', (e) => { if (e.target === UI.authModal) hideAuthModal(); });

    // expose for console (handy while developing)
    window.GameHub = { registerGame, navigateTo, saveScore, loadScore, getUser, getSessionUser };
  }

  init();
})();
