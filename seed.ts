import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log("Google Sheets'dan barcha ma'lumotlar yuklab olinmoqda...");
  
  const response = await fetch("https://docs.google.com/spreadsheets/d/1AMuhzlh_WEYiPYnKOiiXKlSdGpZun4ycqecO5-i7RMg/export?format=csv");
  const text = await response.text();
  
  const lines = text.split('\n');
  const items = [];
  const events = []; // Array of { index, name, date }
  
  // Tadbirlar va Sanalarni o'qish (Qatorlar: 1=Tadbir, 2=Sana - 0-indexed)
  if (lines.length > 5) {
    const eventRow = lines[1].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    const dateRow = lines[2].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    
    for (let i = 5; i < eventRow.length; i++) {
      let eventName = eventRow[i] ? eventRow[i].replace(/^"|"$/g, '').trim() : '';
      let dateStr = dateRow[i] ? dateRow[i].replace(/^"|"$/g, '').trim() : '';
      
      // Smart Swap: Ba'zida Excelda Tadbir nomi o'rnida Sana, Sana o'rnida Tadbir nomi yozilgan bo'ladi
      const dateRegex = /^\d{1,2}[.,/]\d{1,2}[.,/]\d{4}$/;
      if (dateRegex.test(eventName) && !dateRegex.test(dateStr) && dateStr !== '') {
        const temp = eventName;
        eventName = dateStr;
        dateStr = temp;
      }

      if (eventName || dateStr) {
        events.push({ colIndex: i, name: eventName || 'Umumiy', dateStr });
      }
    }
  }

  console.log(`Topilgan tadbirlar ustunlari: ${events.length} ta.`);

  // Create a default system user for historical transactions
  const systemUser = await prisma.user.upsert({
    where: { telegramId: 'system' },
    update: {},
    create: {
      telegramId: 'system',
      name: 'Eski Tizim (Google Sheets)',
      role: 'ADMIN'
    }
  });

  // Tozalash: Faqat test emas, balki to'g'ri bo'lishi uchun oldin barcha ma'lumotlarni tozalash (Ixtiyoriy, lekin yaxshi)
  await prisma.transaction.deleteMany({});
  await prisma.item.deleteMany({});

  for (let i = 6; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    
    if (parts.length > 4) {
      let name = parts[1] ? parts[1].replace(/^"|"$/g, '').trim() : '';
      let qtyStr = parts[2] ? parts[2].replace(/^"|"$/g, '').trim() : '';
      let unitStr = parts[3] ? parts[3].replace(/^"|"$/g, '').trim() : 'Dona';
      let priceStr = parts[4] ? parts[4].replace(/^"|"$/g, '').trim() : '0';
      
      if (name && qtyStr && name !== "Mahsulot lar" && !name.toLowerCase().includes("mahsulotlar")) {
        qtyStr = qtyStr.replace(/\s/g, '').replace(',', '.');
        priceStr = priceStr.replace(/\s/g, '').replace(',', '.');
        
        const qty = parseFloat(qtyStr);
        const price = parseFloat(priceStr) || 0;
        
        if (!isNaN(qty)) {
          name = name.replace(/^\d+\s*/, '').trim(); 
          if(name !== "") {
            
            // Mahsulotni saqlash
            const savedItem = await prisma.item.create({
              data: {
                name,
                quantity: qty,
                price: price,
                unit: unitStr || 'Dona'
              }
            });

            // Shu mahsulotga tegishli eski operatsiyalarni tekshirish
            let transactionCount = 0;
            for (const event of events) {
              const valStr = parts[event.colIndex] ? parts[event.colIndex].replace(/^"|"$/g, '').trim() : '';
              if (valStr) {
                const takenQty = parseFloat(valStr.replace(/\s/g, '').replace(',', '.'));
                if (!isNaN(takenQty) && takenQty > 0) {
                  // Yaratamiz Transaction
                  
                  // Sana formati DD.MM.YYYY yoki DD,MM,YYYY bo'lishi mumkin
                  let createdAt = new Date();
                  if (event.dateStr) {
                    const dParts = event.dateStr.replace(/,/g, '.').split('.');
                    if (dParts.length === 3) {
                       createdAt = new Date(`${dParts[2]}-${dParts[1]}-${dParts[0]}T12:00:00Z`);
                    }
                  }

                  await prisma.transaction.create({
                    data: {
                      userId: systemUser.id,
                      itemId: savedItem.id,
                      quantity: -takenQty, // qancha olingani
                      type: 'TAKE',
                      status: 'APPROVED',
                      eventName: event.name,
                      totalPrice: takenQty * price,
                      createdAt: isNaN(createdAt.getTime()) ? new Date() : createdAt
                    }
                  });
                  transactionCount++;
                }
              }
            }
            
            items.push({ name, transactions: transactionCount });
          }
        }
      }
    }
  }

  console.log(`✅ Muvaffaqiyatli: ${items.length} ta mahsulot va ularning tarixiy operatsiyalari saqlandi!`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
