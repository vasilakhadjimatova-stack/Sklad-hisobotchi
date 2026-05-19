import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log("Google Sheets'dan barcha ma'lumotlar yuklab olinmoqda...");
  
  const response = await fetch("https://docs.google.com/spreadsheets/d/1AMuhzlh_WEYiPYnKOiiXKlSdGpZun4ycqecO5-i7RMg/export?format=csv");
  const text = await response.text();
  
  const lines = text.split('\n');
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

  // Tozalash: oldin barcha ma'lumotlarni tozalash
  await prisma.transaction.deleteMany({});
  await prisma.item.deleteMany({});

  const tempItemsMap = new Map();

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
            tempItemsMap.set(name, {
              name,
              quantity: qty,
              price: price,
              unit: unitStr || 'Dona',
              rawParts: parts
            });
          }
        }
      }
    }
  }

  const itemsArray = Array.from(tempItemsMap.values());
  console.log(`Foydali mahsulotlar soni: ${itemsArray.length} ta. Baza yuklanmoqda...`);

  // Bulk insert all items
  await prisma.item.createMany({
    data: itemsArray.map(item => ({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      unit: item.unit
    }))
  });

  // Fetch items back to get their IDs
  const dbItems = await prisma.item.findMany();
  const dbItemMap = new Map(dbItems.map(item => [item.name, item]));

  const transactionsToCreate: any[] = [];

  // Build transactions list
  for (const item of itemsArray) {
    const dbItem = dbItemMap.get(item.name);
    if (!dbItem) continue;

    for (const event of events) {
      const valStr = item.rawParts[event.colIndex] ? item.rawParts[event.colIndex].replace(/^"|"$/g, '').trim() : '';
      if (valStr) {
        const takenQty = parseFloat(valStr.replace(/\s/g, '').replace(',', '.'));
        if (!isNaN(takenQty) && takenQty > 0) {
          // Sana formati DD.MM.YYYY yoki DD,MM,YYYY bo'lishi mumkin
          let createdAt = new Date();
          if (event.dateStr) {
            const dParts = event.dateStr.replace(/,/g, '.').split('.');
            if (dParts.length === 3) {
               createdAt = new Date(`${dParts[2]}-${dParts[1]}-${dParts[0]}T12:00:00Z`);
            }
          }

          transactionsToCreate.push({
            userId: systemUser.id,
            itemId: dbItem.id,
            quantity: -takenQty, // qancha olingani
            type: 'TAKE',
            status: 'APPROVED',
            eventName: event.name,
            totalPrice: takenQty * item.price,
            createdAt: isNaN(createdAt.getTime()) ? new Date() : createdAt
          });
        }
      }
    }
  }

  console.log(`Tranzaksiyalar soni: ${transactionsToCreate.length} ta. Tranzaksiyalar yozilmoqda...`);

  // Bulk insert all transactions in chunks of 500 to prevent database packet limits
  const chunkSize = 500;
  for (let i = 0; i < transactionsToCreate.length; i += chunkSize) {
    const chunk = transactionsToCreate.slice(i, i + chunkSize);
    await prisma.transaction.createMany({
      data: chunk
    });
  }

  console.log(`✅ Muvaffaqiyatli: ${itemsArray.length} ta mahsulot va ularning ${transactionsToCreate.length} ta tarixiy operatsiyalari saqlandi!`);
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
