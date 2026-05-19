// Butun jarayon (Next.js server-komponentlari + bot) Toshkent vaqtida
// ishlasin — aks holda Railway UTC'da bo'lib vaqtlar 5 soat orqada chiqadi.
process.env.TZ = process.env.TZ || 'Asia/Tashkent';

const { spawn } = require('child_process');

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

// Ensure the PORT is set for Next.js, default to 3000 if not provided
const port = process.env.PORT || 3000;

const nextArgs = ['start', '-H', '0.0.0.0', '-p', port];
const nextProcess = startProcess('Next.js', 'npx', ['next', ...nextArgs]);

const botProcess = startProcess('TelegramBot', 'npx', ['tsx', 'bot/index.ts']);

// Handle graceful shutdown
function shutdown() {
  console.log('Shutting down processes...');
  nextProcess.kill('SIGTERM');
  botProcess.kill('SIGTERM');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
