// Butun jarayon (Next.js server-komponentlari + bot) Toshkent vaqtida
// ishlasin — aks holda Railway UTC'da bo'lib vaqtlar 5 soat orqada chiqadi.
process.env.TZ = process.env.TZ || 'Asia/Tashkent';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Starting Next.js and Telegram Bot...');

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

// ---------------------------------------------------------------------------
// 1. Avval veb-server. Uni HECH NARSA kutib turmasligi kerak.
// Sxema moslash ilgari shu yerdan oldin, sinxron ishlardi — u tiqilib qolsa
// sayt umuman ko'tarilmay "Application failed to respond" chiqardi.
// ---------------------------------------------------------------------------
const port = process.env.PORT || 3000;

const nextArgs = ['start', '-H', '0.0.0.0', '-p', port];
const nextProcess = startProcess('Next.js', 'npx', ['next', ...nextArgs]);

const botProcess = startProcess('TelegramBot', 'npx', ['tsx', 'bot/index.ts']);

// ---------------------------------------------------------------------------
// 2. Baza sxemasini moslash — fonda, sayt allaqachon javob berayotgan holda.
// ---------------------------------------------------------------------------

// Qaysi bazaga ulanayotganimiz — parolsiz, faqat host va baza nomi.
// Build va ishga tushirishdagi DATABASE_URL har xil bo'lsa, sxema bir bazaga
// qo'shilib ilova boshqasini o'qiydi — logda darhol ko'rinadi.
function dbTarget() {
  try {
    const u = new URL(process.env.DATABASE_URL || '');
    return `${u.host}${u.pathname}`;
  } catch {
    return "(DATABASE_URL o'qib bo'lmadi)";
  }
}

// To'g'ridan-to'g'ri lokal prisma binarisi. `npx prisma` ishlatib bo'lmaydi:
// paket topilmasa npx uni tarmoqdan yuklashga urinib cheksiz tiqilib qoladi.
const prismaBin = path.join(__dirname, 'node_modules', '.bin', 'prisma');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function pushSchema(verbose) {
  return new Promise((resolve) => {
    const p = spawn(prismaBin, ['db', 'push', '--skip-generate'], {
      stdio: verbose ? 'inherit' : 'ignore',
    });
    p.on('error', (err) => {
      console.error('[schema] prisma ishga tushmadi:', err.message);
      resolve(false);
    });
    p.on('exit', (code) => resolve(code === 0));
  });
}

async function syncSchema() {
  if (!fs.existsSync(prismaBin)) {
    console.error(
      `[schema] DIQQAT: prisma CLI topilmadi (${prismaBin}). ` +
      "Sxema moslanmaydi — yangi ustunlar bazaga qo'shilmaydi."
    );
    return;
  }

  const waits = [0, 5, 10, 20, 30, 60]; // soniya, oxirgisi takrorlanadi

  // Cheksiz urinamiz. Baza bir necha soat o'chiq tursa ham, u qaytgan zahoti
  // sxema moslanadi va sayt qayta deploysiz o'ziga keladi. Ilgari 30 urinishdan
  // (~26 daqiqa) keyin to'xtardi va undan uzoq uzilishda qo'lda deploy kerak edi.
  for (let i = 1; ; i++) {
    const wait = waits[Math.min(i - 1, waits.length - 1)];
    if (wait) await sleep(wait * 1000);

    // Logni bosib ketmaslik uchun: birinchi 5 urinish to'liq, keyin har 10-si
    // (ya'ni ~10 daqiqada bir marta). Qolganlari jim ishlaydi.
    const verbose = i <= 5 || i % 10 === 0;

    if (verbose) {
      console.log(`[schema] Baza sxemasini moslash, urinish ${i} -> ${dbTarget()}`);
    }
    if (await pushSchema(verbose)) {
      console.log(`[schema] Baza sxemasi mos (${i}-urinishda).`);
      return;
    }
    if (verbose) console.error('[schema] Moslashtirib bo\'lmadi.');

    if (i === 5) {
      console.error(
        '[schema] DIQQAT: baza javob bermayapti. Sayt ishlaydi, lekin ' +
        "ma'lumot talab qiladigan sahifalar xato beradi. Baza qaytguncha " +
        'fonda urinishda davom etaman.'
      );
    }
  }
}

syncSchema();

// ---------------------------------------------------------------------------
// 3. To'xtatish
// ---------------------------------------------------------------------------
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
  console.error("[Next.js] to'xtab qoldi — konteynerni ham to'xtatamiz, Railway qayta ishga tushiradi.");
  botProcess.kill('SIGTERM');
  process.exit(code || 1);
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
