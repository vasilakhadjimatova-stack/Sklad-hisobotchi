import { Telegraf, Markup } from 'telegraf';
import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env
dotenv.config({ path: resolve(process.cwd(), '.env') });

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const geminiKey = process.env.GEMINI_API_KEY;
const miniAppUrl = process.env.MINI_APP_URL || 'https://your-app.vercel.app/mini-app';


if (!botToken || botToken === 'BU_YERGA_TOKEN_YOZING') {
  console.warn('TELEGRAM_BOT_TOKEN kiritilmagan! Bot ishlamasligi mumkin.');
}

const bot = new Telegraf(botToken || 'DUMMY_TOKEN');
const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(geminiKey || '');

bot.start(async (ctx) => {
  if (ctx.chat.type !== 'private') {
    return ctx.reply("Assalomu alaykum! Sklad bot guruhga qo'shildi.\nQuyidagi tugma orqali mahsulotlarni to'g'ridan-to'g'ri kiritishingiz mumkin:",
      Markup.inlineKeyboard([
        [Markup.button.webApp('📦 Chiqim / Kirim', miniAppUrl)]
      ])
    );
  }

  const telegramId = String(ctx.from.id);
  const name = ctx.from.first_name || 'User';

  try {
    let user = await prisma.user.findUnique({ where: { telegramId } });
    if (!user) {
      user = await prisma.user.create({
        data: { telegramId, name, role: 'USER' }
      });
    }
    await ctx.reply(
      `Assalomu alaykum, ${name}! 👋\n\nSklad botiga xush kelibsiz.\nQuyidagi tugma orqali chiqimlarni kiritishingiz mumkin:`,
      Markup.inlineKeyboard([
        [Markup.button.webApp('📦 Chiqim / Kirim', miniAppUrl)]
      ])
    );
  } catch (error) {
    console.error("BOT START ERROR:", error);
    ctx.reply("Assalomu alaykum! Sklad botiga xush kelibsiz. (Tizimga ulanishda xatolik: Baza vaqtincha ishlamayapti)");
  }
});

// /chiqim command - quick access to Mini App
bot.command('chiqim', async (ctx) => {
  await ctx.reply(
    '📦 Chiqim kiritish uchun quyidagi tugmani bosing:',
    Markup.inlineKeyboard([
      [Markup.button.webApp('📦 Chiqim kiritish', miniAppUrl)]
    ])
  );
});


bot.command('id', (ctx) => {
  ctx.reply(`Ushbu chat/guruhning ID raqami: ${ctx.chat.id}`);
});

const SYSTEM_PROMPT = `Sen ombor (sklad) xodimisan. Foydalanuvchining matni yoki rasmidan quyidagilarni aniqlashing kerak:
1. "action" - agar u narsa olayotgan bo'lsa "TAKE", agar skladdan narsa qo'shayotgan bo'lsa "ADD". (Rasmdan tushunarsiz bo'lsa "TAKE" deb ol).
2. "itemName" - mahsulotning nomi. (Qisqa va aniq nom bering).
3. "quantity" - qancha miqdorda (faqat raqam).
4. "eventName" - (ixtiyoriy) Agar mahsulot biror tadbir uchun olinayotgan bo'lsa (Masalan: "Impulse", "assodiq", "Nodir aka"), o'sha tadbir nomini yozing. Agar tadbir aytilmagan bo'lsa, null qilib qaytaring.

Natijani FAQAT quyidagi JSON formatida qaytar, boshqa hech qanday so'z qo'shma:
{"action": "TAKE", "itemName": "Salfetka", "quantity": 5, "eventName": "Impulse"}

Agar xabar mazmuni tushunarsiz bo'lsa yoki omborga aloqasi bo'lmasa, qaytar:
{"error": "Tushunarsiz xabar"}`;

const pendingTxs = new Map();

async function processGeminiResponse(ctx: any, msg: any, result: any) {
    const responseText = result.response.text();
    
    let parsedData;
    try {
      const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedData = JSON.parse(jsonStr);
    } catch (e) {
      return ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, '❌ Kechirasiz, xabaringizni/rasmni tushuna olmadim. Iltimos, aniqroq yozing.');
    }

    if (parsedData.error) {
      return ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, '❌ ' + parsedData.error + '\n\nYoki quyidagi tugma orqali oson kiriting:',
        Markup.inlineKeyboard([
          [Markup.button.webApp('📦 Dastur orqali kiritish', miniAppUrl)]
        ])
      );
    }

    const { action, itemName, quantity, eventName } = parsedData;
    const actionText = action === 'TAKE' ? 'olindi' : "qo'shildi";
    
    const txId = Math.random().toString(36).substring(2, 10);
    pendingTxs.set(txId, parsedData);

    let confirmMsg = `📦 Mahsulot: ${itemName}\n🔢 Miqdor: ${quantity} ta\n`;
    if (action === 'TAKE') {
      confirmMsg += `🎪 Tadbir: ${eventName ? eventName : 'Kiritilmagan (Umumiy)'}\n`;
    }
    confirmMsg += `\n🔄 Amal turini tasdiqlang (${action}):`;

    ctx.telegram.editMessageText(ctx.chat.id, msg.message_id, undefined, 
      confirmMsg, 
      Markup.inlineKeyboard([
        [Markup.button.callback('✅ Tasdiqlash', `confirm_tx_${txId}`)],
        [Markup.button.callback('❌ Bekor qilish', 'cancel_tx')],
        [Markup.button.webApp('📦 Mini App', miniAppUrl)]
      ])
    );
}

bot.on('text', async (ctx) => {
  if (ctx.message.text.startsWith('/')) return;

  if (ctx.chat.type !== 'private') {
    const botUsername = ctx.botInfo.username;
    const isMentioned = ctx.message.text.includes(`@${botUsername}`);
    const isReply = ctx.message.reply_to_message?.from?.id === ctx.botInfo.id;
    if (!isMentioned && !isReply) return;
  }

  if (!geminiKey || geminiKey === 'BU_YERGA_GEMINI_KEY_YOZING') {
      return ctx.reply('⚠️ Gemini API kaliti kiritilmagan.');
  }

  try {
    const msg = await ctx.reply('⏳ Matn tahlil qilinmoqda...');
    const items = await prisma.item.findMany({ select: { name: true } });
    const itemNames = items.map((i: any) => i.name).join(', ');
    const dynamicPrompt = SYSTEM_PROMPT + `\n\nSkladimizdagi mavjud mahsulotlar ro'yxati: [${itemNames}]. Iloji boricha mahsulot nomini shu ro'yxatdagilarga moslashtir, agar ro'yxatda yo'q bo'lsa o'zing mos nom top.`;
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(dynamicPrompt + "\n\nFoydalanuvchi xabari: " + ctx.message.text);
    await processGeminiResponse(ctx, msg, result);
  } catch (err) {
    console.error(err);
    ctx.reply("⚠️ AI bilan ulanishda xatolik yuz berdi.");
  }
});

bot.on('photo', async (ctx) => {
    if (ctx.chat.type !== 'private') {
      const botUsername = ctx.botInfo.username;
      const caption = ctx.message.caption || '';
      const isMentioned = caption.includes(`@${botUsername}`);
      const isReply = ctx.message.reply_to_message?.from?.id === ctx.botInfo.id;
      if (!isMentioned && !isReply) return;
    }

    if (!geminiKey || geminiKey === 'BU_YERGA_GEMINI_KEY_YOZING') {
        return ctx.reply('⚠️ Gemini API kaliti kiritilmagan.');
    }
  
    try {
      const msg = await ctx.reply('⏳ Rasm tahlil qilinmoqda...');
      
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const fileLink = await ctx.telegram.getFileLink(photo.file_id);
      
      const response = await fetch(fileLink.href);
      const buffer = await response.arrayBuffer();
      const base64Data = Buffer.from(buffer).toString('base64');
  
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const imageParts = [
        {
          inlineData: {
            data: base64Data,
            mimeType: "image/jpeg"
          }
        }
      ];
      
      const items = await prisma.item.findMany({ select: { name: true } });
      const itemNames = items.map((i: any) => i.name).join(', ');
      const dynamicPrompt = SYSTEM_PROMPT + `\n\nSkladimizdagi mavjud mahsulotlar ro'yxati: [${itemNames}]. Iloji boricha mahsulot nomini shu ro'yxatdagilarga moslashtir, agar ro'yxatda yo'q bo'lsa o'zing mos nom top.`;
      const prompt = dynamicPrompt + "\n\nBu rasmda qanday mahsulot va nechta borligini toping. " + (ctx.message.caption ? "Izoh: " + ctx.message.caption : "");
      const result = await model.generateContent([prompt, ...imageParts]);
      await processGeminiResponse(ctx, msg, result);
    } catch (err) {
      console.error(err);
      ctx.reply("⚠️ Rasm tahlil qilishda xatolik yuz berdi.");
    }
});

bot.action(/confirm_tx_(.+)/, async (ctx) => {
  const txId = ctx.match[1];
  const txData = pendingTxs.get(txId);

  if (!txData) {
    return ctx.editMessageText('❌ Bu amal eskirgan yoki topilmadi. Qaytadan urinib ko\'ring.');
  }

  const { action, itemName, quantity, eventName } = txData;
  const telegramId = String(ctx.from.id);

  try {
    let user = await prisma.user.findUnique({ where: { telegramId } });
    if (!user) {
        user = await prisma.user.create({ data: { telegramId, name: ctx.from.first_name || 'User' } });
    }

    let item = await prisma.item.findUnique({ where: { name: itemName } });
    if (!item) {
        item = await prisma.item.create({ data: { name: itemName, quantity: 0, price: 0 } });
    }

    const newQuantity = action === 'TAKE' ? item.quantity - quantity : item.quantity + quantity;

    await prisma.item.update({
        where: { id: item.id },
        data: { quantity: newQuantity }
    });

    const totalPrice = action === 'TAKE' ? (quantity * item.price) : null;

    await prisma.transaction.create({
        data: {
            userId: user.id,
            itemId: item.id,
            quantity: action === 'TAKE' ? -quantity : quantity,
            type: action,
            status: 'APPROVED',
            eventName: action === 'TAKE' ? (eventName || null) : null,
            totalPrice: totalPrice
        }
    });

    pendingTxs.delete(txId);

    const harakat = action === 'TAKE' ? 'olindi' : "qo'shildi";
    let msg = `✅ Bajarildi!\n\n📦 ${itemName}: ${quantity} ta ${harakat}.`;
    if (action === 'TAKE' && eventName) msg += `\n🎪 Tadbir: ${eventName}`;
    msg += `\n📊 Skladdagi joriy qoldiq: ${newQuantity} ${item.unit.toLowerCase() || 'ta'}.`;

    ctx.editMessageText(msg);
  } catch (err) {
    console.error(err);
    ctx.editMessageText('❌ Ma\'lumotlar bazasiga yozishda xatolik yuz berdi.');
  }
});

bot.action('cancel_tx', (ctx) => {
  ctx.editMessageText('❌ Amal bekor qilindi.');
});

bot.launch().then(async () => {
  console.log('🤖 Telegram Bot ishga tushdi...');

  // Botning pastki menyusini Mini App tugmasi sifatida o'rnatish
  try {
    await bot.telegram.setChatMenuButton({
      menuButton: {
        type: 'web_app',
        text: 'Rasxod',
        web_app: { url: miniAppUrl }
      }
    });
    console.log('✅ Menu button o\'rnatildi:', miniAppUrl);
  } catch (err) {
    console.error('Menu button o\'rnatishda xato:', err);
  }
}).catch(err => {
  console.error('Bot ishga tushishida xato:', err);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
