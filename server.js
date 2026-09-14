// Butun jarayon (Next.js server-komponentlari + bot) Toshkent vaqtida
// ishlasin — aks holda Railway UTC'da bo'lib vaqtlar 5 soat orqada chiqadi.
process.env.TZ = process.env.TZ || 'Asia/Tashkent';

const { spawn, spawnSync } = require('child_process');

console.log('Starting Next.js and Telegram Bot...');

// Qaysi bazaga ulanayotganimiz — parolsiz, faqat host va baza nomi.
// Build va ishga tushirish paytidagi DATABASE_URL har xil bo'lsa, sxema bir
// bazaga qo'shilib, ilova boshqasini o'qiydi — logda darhol ko'rinadi.
function dbTarget() {
  try {
    const u = new URL(process.env.DATABASE_URL || '');
    return `${u.host}${u.pathname}`;
  } catch {
    return "(DATABASE_URL o'qib bo'lmadi)";
  }
}

function sleepSync(seconds) {
  spawnSync('sleep', [String(seconds)], { shell: true });
}

// Sxemani bazaga moslash.
// Ilgari bu `npm start` ichida `prisma db push && node server.js` ko'rinishida
// edi va ikki tomondan xavfli edi: push xato bersa sayt umuman ko'tarilmasdi,
// push o'tkazib yuborilsa esa yangi ustunlar bazaga tushmay, sahifalar
// "server-side exception" berardi. Endi u shu yerda, qayta urinishlar bilan.
function syncSchema(attempts = 5) {
  for (let i = 1; i <= attempts; i++) {
    console.log(`[schema] Baza sxemasini moslash (${i}/${attempts}) -> ${dbTarget()}`);
    const r = spawnSync('npx', ['prisma', 'db', 'push', '--skip-generate'], {
      stdio: 'inherit',
      shell: true,
    });
    if (r.status === 0) {
      console.log('[schema] Baza sxemasi mos.');
      return true;
    }
    console.error(`[schema] Moslashtirib bo'lmadi (exit ${r.status}).`);
    if (i < attempts) {
      const wait = i * 5;
      console.log(`[schema] ${wait}s kutib qayta urinaman...`);
      sleepSync(wait);
    }
  }
  console.error(
    "[schema] DIQQAT: baza sxemasi moslanmadi. Sahifalar xato berishi mumkin. " +
    'Sayt baribir ko\'tariladi va fonda qayta urinib ko\'raman.'
  );
  return false;
}

// Helper to start a process
function startProcess(name, command, args) {
  const p = spawn(command, args, { stdio: 'inherit', shell: true });

  p.on('error', (err) => {
    console.error(`[${name}] Failed to start:`, err);
  });

  p.on('exit', (code, signal) => {
    if (code !== null) {
      console.log(`[${name}] Exited with code ${code}`);
    } else {
      console.log(`[${name}] Killed by signal ${signal}`);
    }
  });

  return p;
}

const schemaOk = syncSchema();

// Ensure the PORT is set for Next.js, default to 3000 if not provided
const port = process.env.PORT || 3000;

const nextArgs = ['start', '-H', '0.0.0.0', '-p', port];
const nextProcess = startProcess('Next.js', 'npx', ['next', ...nextArgs]);

const botProcess = startProcess('TelegramBot', 'npx', ['tsx', 'bot/index.ts']);

// Sxema moslanmagan bo'lsa fonda urinishda davom etamiz — baza qaytganda
// sayt qayta deploysiz o'ziga keladi (Prisma so'rovlari har so'rovda yangi).
if (!schemaOk) {
  const retry = setInterval(() => {
    console.log('[schema] Fonda qayta urinish...');
    const r = spawnSync('npx', ['prisma', 'db', 'push', '--skip-generate'], {
      stdio: 'inherit',
      shell: true,
    });
    if (r.status === 0) {
      console.log('[schema] Baza sxemasi mos — sayt normal ishlashi kerak.');
      clearInterval(retry);
    }
  }, 60_000);
  retry.unref();
}

// Handle graceful shutdown
let shuttingDown = false;
function shutdown() {
  shuttingDown = true;
  console.log('Shutting down processes...');
  nextProcess.kill('SIGTERM');
  botProcess.kill('SIGTERM');
  process.exit(0);
}

// Next.js o'lsa sayt ochilmaydi, lekin bu ota jarayon tirik qolgani uchun
// Railway konteynerni sog'lom deb biladi va qayta ishga tushirmaydi —
// sayt esa abadiy o'chiq qoladi. Shuning uchun biz ham chiqamiz.
nextProcess.on('exit', (code) => {
  if (shuttingDown) return;
  console.error('[Next.js] to\'xtab qoldi — konteynerni ham to\'xtatamiz, Railway qayta ishga tushiradi.');
  botProcess.kill('SIGTERM');
  process.exit(code || 1);
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
