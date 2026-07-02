'use client'

import { useRef, useState, useEffect } from 'react'
import { createNewItem, addStock, setItemUnit } from '@/app/actions'
import { PlusCircle, ArrowDownCircle, Search, X, PackageOpen, Check, Settings2 } from 'lucide-react'

type AdminItem = { id: string, name: string, unit?: string, packUnit?: string, packSize?: number, price?: number, quantity?: number, boxUnit?: string, boxSize?: number }

// O'yin uslubidagi chiroyli ranglar
const gradientColors = [
  'from-indigo-500 to-purple-500',
  'from-emerald-400 to-cyan-500',
  'from-rose-400 to-red-500',
  'from-amber-400 to-orange-500',
  'from-fuchsia-500 to-pink-500',
  'from-blue-400 to-indigo-500',
  'from-lime-400 to-emerald-500',
]

// Ismga qarab har doim bir xil rang olish
const getGradient = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return gradientColors[Math.abs(hash) % gradientColors.length];
}

// Custom Catalog Modal component
function CatalogModal({ items, name, onSelect, selectedItem }: {
  items: AdminItem[],
  name: string,
  onSelect: (item: AdminItem | null) => void,
  selectedItem: AdminItem | null
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filteredItems = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))

  // Esc bosganda yopish
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="relative w-full">
      <input type="hidden" name={name} value={selectedItem?.id || ''} required />

      <div
        onClick={() => setIsOpen(true)}
        className="w-full px-5 py-3 rounded-xl bg-white/50 border border-white/60 text-zinc-900 cursor-pointer flex justify-between items-center hover:bg-white/80 transition-all shadow-inner group"
      >
        {selectedItem ? (
          <div className="flex items-center gap-3 w-full overflow-hidden">
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getGradient(selectedItem.name)} flex items-center justify-center flex-shrink-0 shadow-lg`}>
              <span className="text-zinc-900 font-bold text-sm">{selectedItem.name.charAt(0).toUpperCase()}</span>
            </div>
            <span className="text-zinc-900 truncate font-medium">{selectedItem.name}</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-zinc-900/40">
            <div className="w-8 h-8 rounded-lg bg-white/40 flex items-center justify-center border border-white/60 border-dashed">
              <PackageOpen size={16} />
            </div>
            <span>Katalogdan mahsulot tanlang...</span>
          </div>
        )}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 backdrop-blur-xl bg-white/80">
          <div className="w-full max-w-5xl bg-dark-800 border border-white/60 rounded-2xl shadow-2xl flex flex-col h-[85vh] sm:h-[80vh] animate-in zoom-in-95 duration-200">

            {/* Modal Header */}
            <div className="p-6 border-b border-white/60 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1">
                <div className="w-12 h-12 rounded-2xl bg-brand-500/20 flex items-center justify-center text-brand-400">
                  <PackageOpen size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-zinc-900">Mahsulot Katalogi</h2>
                  <p className="text-zinc-900/50 text-sm">Jami {items.length} ta mahsulot bazada mavjud</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-10 h-10 rounded-full bg-white/40 flex items-center justify-center hover:bg-white/10 hover:text-rose-400 transition-colors text-zinc-900/50"
              >
                <X size={20} />
              </button>
            </div>

            {/* Search Bar */}
            <div className="px-6 py-4 border-b border-white/60 bg-white/30">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-900/40" size={20} />
                <input
                  type="text"
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Katalogdan qidirish..."
                  className="w-full bg-white/80 border border-white/60 rounded-xl py-3 pl-12 pr-4 text-zinc-900 placeholder-white/30 focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all shadow-inner"
                />
              </div>
            </div>

            {/* Grid Catalog */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              {filteredItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-zinc-900/30 gap-4">
                  <Search size={48} className="opacity-20" />
                  <p className="text-lg font-medium">Bunday mahsulot topilmadi</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {filteredItems.map(item => (
                    <div
                      key={item.id}
                      onClick={() => {
                        onSelect(item)
                        setIsOpen(false)
                        setSearch('')
                      }}
                      className={`relative flex flex-col group cursor-pointer rounded-2xl border p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                        selectedItem?.id === item.id
                          ? 'bg-brand-500/10 border-brand-500/50 shadow-black/10'
                          : 'bg-white/40 border-white/60 hover:border-white/20 hover:bg-white/60'
                      }`}
                    >
                      {/* Placeholder Image Box */}
                      <div className={`w-full aspect-square rounded-xl bg-gradient-to-br ${getGradient(item.name)} mb-4 flex items-center justify-center shadow-inner relative overflow-hidden group-hover:scale95 transition-transform`}>
                        <span className="text-5xl font-black text-zinc-900/30 group-hover:text-zinc-900/50 transition-colors">
                          {item.name.charAt(0).toUpperCase()}
                        </span>

                        {/* Overlay if selected */}
                        {selectedItem?.id === item.id && (
                          <div className="absolute inset-0 bg-brand-500/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in">
                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-lg">
                              <Check size={24} className="text-brand-600" />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 flex flex-col">
                        <h3 className="text-sm font-semibold text-zinc-900/90 line-clamp-2 leading-snug group-hover:text-zinc-900 transition-colors">{item.name}</h3>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminPanel({ items }: { items: AdminItem[] }) {
  const [activeTab, setActiveTab] = useState<'NEW' | 'ADD' | 'UNIT'>('ADD')
  const formRef = useRef<HTMLFormElement>(null)
  const [msg, setMsg] = useState('')
  const [isError, setIsError] = useState(false)
  const [loading, setLoading] = useState(false)

  // Custom select state managed at parent to prevent reset bugs
  const [selectedItem, setSelectedItem] = useState<AdminItem | null>(null)

  // Tahrirlash/Yangi maydonlari (UNIT/NEW tab uchun nazoratli holat)
  const [nameField, setNameField] = useState('')
  const [unitField, setUnitField] = useState('dona')
  const [packUnitField, setPackUnitField] = useState('pachka')
  const [packSizeField, setPackSizeField] = useState('1')
  const [priceField, setPriceField] = useState('')
  // Yangi mahsulot boshlang'ich miqdori (pachka + dona)
  const [qtyPackField, setQtyPackField] = useState('')
  const [qtyPieceField, setQtyPieceField] = useState('')
  // Katta pachka (3-pog'ona) sozlamasi — NEW/UNIT tab
  const [boxSizeField, setBoxSizeField] = useState('1')
  const [boxUnitField, setBoxUnitField] = useState('karobka')
  // Kirim (ADD): miqdor + kelgan narx (har biri o'z birlik rejimi bilan)
  const [addQtyField, setAddQtyField] = useState('')
  const [addQtyMode, setAddQtyMode] = useState<'piece' | 'pack' | 'box'>('piece')
  const [addPriceField, setAddPriceField] = useState('')
  const [addPriceMode, setAddPriceMode] = useState<'piece' | 'pack' | 'box'>('piece')
  // Yangi mahsulot: narx + boshlang'ich miqdor (katta pachka)
  const [qtyBoxField, setQtyBoxField] = useState('')
  const [newPriceField, setNewPriceField] = useState('')
  const [newPriceMode, setNewPriceMode] = useState<'piece' | 'pack' | 'box'>('piece')

  const resetUnitFields = () => {
    setNameField('')
    setUnitField('dona')
    setPackUnitField('pachka')
    setPackSizeField('1')
    setBoxUnitField('karobka')
    setBoxSizeField('1')
    setPriceField('')
    setQtyPackField('')
    setQtyPieceField('')
    setQtyBoxField('')
    setAddQtyField('')
    setAddQtyMode('piece')
    setAddPriceField('')
    setAddPriceMode('piece')
    setNewPriceField('')
    setNewPriceMode('piece')
  }

  const handleTabChange = (tab: 'NEW' | 'ADD' | 'UNIT') => {
    setActiveTab(tab)
    setMsg('')
    setSelectedItem(null)
    resetUnitFields()
    if (formRef.current) formRef.current.reset()
  }

  // Tahrirlash tabida mahsulot tanlanса — hozirgi nom va birlik sozlamasini ko'rsatish
  const handleSelectForUnit = (item: AdminItem | null) => {
    setSelectedItem(item)
    if (item) {
      setNameField(item.name || '')
      setUnitField(item.unit || 'dona')
      setPackUnitField(item.packUnit || 'pachka')
      setPackSizeField(String(item.packSize ?? 1))
      setBoxUnitField(item.boxUnit || 'karobka')
      setBoxSizeField(String(item.boxSize ?? 1))
      setPriceField(item.price != null ? String(item.price) : '')
    } else {
      resetUnitFields()
    }
  }

  async function handleAction(formData: FormData) {
    if ((activeTab === 'ADD' || activeTab === 'UNIT') && !selectedItem) {
      setMsg('Iltimos, katalogdan mahsulotni tanlang')
      setIsError(true)
      return
    }

    // Yangi mahsulot: pachka + dona dan kamida biri kiritilgan bo'lsin
    if (activeTab === 'NEW') {
      const ps = Math.max(1, Math.floor(Number(packSizeField) || 1))
      const bs = Math.max(1, Math.floor(Number(boxSizeField) || 1))
      // Pachka/katta pachka maydonlari faqat mos daraja bo'lganda hisobga olinadi
      const pk = ps > 1 ? Math.max(0, Math.floor(Number(qtyPackField) || 0)) : 0
      const bx = (ps > 1 && bs > 1) ? Math.max(0, Math.floor(Number(qtyBoxField) || 0)) : 0
      const pc = Math.max(0, Math.floor(Number(qtyPieceField) || 0))
      if (bx * bs * ps + pk * ps + pc <= 0) {
        setMsg("Boshlang'ich miqdorni kiriting (0 dan katta bo'lsin)")
        setIsError(true)
        return
      }
    }

    setLoading(true)
    setMsg('Jarayonda...')
    setIsError(false)

    // Make sure formData has the correct itemId
    if ((activeTab === 'ADD' || activeTab === 'UNIT') && selectedItem) {
      formData.set('itemId', selectedItem.id)
    }

    const result = activeTab === 'NEW'
      ? await createNewItem(formData)
      : activeTab === 'UNIT'
        ? await setItemUnit(formData)
        : await addStock(formData)

    setLoading(false)
    if (result?.error) {
      setMsg(result.error)
      setIsError(true)
    } else {
      setMsg('Muvaffaqiyatli saqlandi!')
      setIsError(false)
      formRef.current?.reset()
      setSelectedItem(null)
      resetUnitFields()
      setTimeout(() => setMsg(''), 4000)
    }
  }

  const packSizeNum = Math.max(1, Math.floor(Number(packSizeField) || 1))
  const hasPack = packSizeNum > 1
  // Katta pachka (3-pog'ona)
  const boxSizeNum = Math.max(1, Math.floor(Number(boxSizeField) || 1))
  const hasBox = hasPack && boxSizeNum > 1
  const donaPerBox = packSizeNum * boxSizeNum   // 1 katta pachka = nechta dona

  // Yangi mahsulot boshlang'ich miqdori — katta pachka + pachka + dona → bazaviy dona
  const qtyBoxNum = Math.max(0, Math.floor(Number(qtyBoxField) || 0))
  const qtyPackNum = Math.max(0, Math.floor(Number(qtyPackField) || 0))
  const qtyPieceNum = Math.max(0, Math.floor(Number(qtyPieceField) || 0))
  const totalBaseQty = qtyBoxNum * donaPerBox + qtyPackNum * packSizeNum + qtyPieceNum

  // Kirim (ADD): tanlangan mahsulot pog'onalari
  const addPackSize = Math.max(1, Math.floor(Number(selectedItem?.packSize ?? 1)))
  const addBoxSize = Math.max(1, Math.floor(Number(selectedItem?.boxSize ?? 1)))
  const addHasPack = addPackSize > 1
  const addHasBox = addHasPack && addBoxSize > 1
  const addDonaPerBox = addPackSize * addBoxSize
  // Kirim miqdori tanlangan birlikda -> bazaviy dona
  const addQtyNum = Math.max(0, Math.floor(Number(addQtyField) || 0))
  const addQtyBase = (addQtyMode === 'box' && addHasBox)
    ? addQtyNum * addDonaPerBox
    : (addQtyMode === 'pack' && addHasPack)
      ? addQtyNum * addPackSize
      : addQtyNum
  // Kelgan narx tanlangan birlikda -> 1 dona narxi
  const addPriceRaw = Math.max(0, Number(addPriceField) || 0)
  const addPricePerDona = (addPriceMode === 'box' && addHasBox)
    ? Math.round((addPriceRaw / addDonaPerBox) * 100) / 100
    : (addPriceMode === 'pack' && addHasPack)
      ? Math.round((addPriceRaw / addPackSize) * 100) / 100
      : addPriceRaw
  const curStockQty = Math.max(0, Number(selectedItem?.quantity ?? 0))
  const curStockPrice = Math.max(0, Number(selectedItem?.price ?? 0))
  const newAvgPrice = addPricePerDona > 0
    ? (curStockQty > 0 ? (curStockQty * curStockPrice + addQtyBase * addPricePerDona) / (curStockQty + addQtyBase) : addPricePerDona)
    : curStockPrice
  const fmtSom = (n: number) => Math.round(n).toLocaleString('ru-RU')

  // Yangi mahsulot: narx dona/pachka/katta pachkada -> 1 dona narxi
  const newPriceRaw = Math.max(0, Number(newPriceField) || 0)
  const newPricePerDona = (newPriceMode === 'box' && hasBox)
    ? Math.round((newPriceRaw / donaPerBox) * 100) / 100
    : (newPriceMode === 'pack' && hasPack)
      ? Math.round((newPriceRaw / packSizeNum) * 100) / 100
      : newPriceRaw

  // Birlik sozlash bloki (NEW va UNIT tab uchun umumiy)
  const unitConfigBlock = (
    <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div>
        <label className="block text-xs font-semibold text-zinc-900/60 uppercase tracking-wider mb-2">Bazaviy birlik</label>
        <input
          name="unit"
          type="text"
          value={unitField}
          onChange={(e) => setUnitField(e.target.value)}
          placeholder="dona"
          className="w-full px-5 py-3 rounded-xl bg-white/50 border border-white/60 text-zinc-900 placeholder-white/20 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all shadow-inner"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-zinc-900/60 uppercase tracking-wider mb-2">1 pachkada nechta dona</label>
        <input
          name="packSize"
          type="number"
          min="1"
          value={packSizeField}
          onChange={(e) => setPackSizeField(e.target.value)}
          placeholder="1 = pachka yo'q"
          className="w-full px-5 py-3 rounded-xl bg-white/50 border border-white/60 text-zinc-900 placeholder-white/20 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all shadow-inner"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-zinc-900/60 uppercase tracking-wider mb-2">Pachka birligi nomi</label>
        <input
          name="packUnit"
          type="text"
          value={packUnitField}
          onChange={(e) => setPackUnitField(e.target.value)}
          placeholder="pachka"
          disabled={!hasPack}
          className="w-full px-5 py-3 rounded-xl bg-white/50 border border-white/60 text-zinc-900 placeholder-white/20 focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all shadow-inner disabled:opacity-40"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-zinc-900/60 uppercase tracking-wider mb-2">1 {boxUnitField || 'karobka'} = nechta {packUnitField || 'pachka'}</label>
        <input
          name="boxSize"
          type="number"
          min="1"
          value={boxSizeField}
          onChange={(e) => setBoxSizeField(e.target.value)}
          placeholder="1 = katta pachka yo'q"
          disabled={!hasPack}
          className="w-full px-5 py-3 rounded-xl bg-white/50 border border-white/60 text-zinc-900 placeholder-white/20 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all shadow-inner disabled:opacity-40"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-zinc-900/60 uppercase tracking-wider mb-2">Katta pachka nomi</label>
        <input
          name="boxUnit"
          type="text"
          value={boxUnitField}
          onChange={(e) => setBoxUnitField(e.target.value)}
          placeholder="karobka"
          disabled={!hasBox}
          className="w-full px-5 py-3 rounded-xl bg-white/50 border border-white/60 text-zinc-900 placeholder-white/20 focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all shadow-inner disabled:opacity-40"
        />
      </div>
      <div className="sm:col-span-3 text-xs text-zinc-900/40 font-medium -mt-1">
        {hasBox
          ? `1 ${boxUnitField || 'karobka'} = ${boxSizeNum} ${packUnitField || 'pachka'} = ${donaPerBox} ${unitField || 'dona'} · 1 ${packUnitField || 'pachka'} = ${packSizeNum} ${unitField || 'dona'}.`
          : hasPack
            ? `1 ${packUnitField || 'pachka'} = ${packSizeNum} ${unitField || 'dona'}. Katta pachka (karobka) uchun "1 karobka = nechta pachka" ni 1 dan katta qiling.`
            : `Pachka yo'q — faqat ${unitField || 'dona'}. Pachka qo'shish uchun "1 pachkada nechta dona" ni 1 dan katta qiling.`}
      </div>
    </div>
  )

  // Yangi mahsulot boshlang'ich miqdori bloki — pachkali bo'lsa pachka + dona, aks holda faqat dona
  const newQtyBlock = (
    <div className="w-full">
      <label className="block text-xs font-semibold text-zinc-900/60 uppercase tracking-wider mb-2">
        Boshlang'ich miqdor {hasBox ? '(katta pachka / pachka / dona)' : hasPack ? '(pachka va/yoki dona)' : `(${unitField || 'dona'})`}
      </label>
      <div className="flex flex-wrap items-start gap-4">
        {hasBox && (
          <div className="w-32">
            <input
              name="qtyBox"
              type="number"
              min="0"
              value={qtyBoxField}
              onChange={(e) => setQtyBoxField(e.target.value)}
              placeholder="0"
              className="w-full px-5 py-3 rounded-xl bg-white/50 border border-white/60 text-zinc-900 placeholder-white/20 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all shadow-inner text-center"
            />
            <span className="block mt-1.5 text-[11px] text-zinc-900/50 font-semibold text-center uppercase tracking-wider">{boxUnitField || 'karobka'}</span>
          </div>
        )}
        {hasPack && (
          <div className="w-32">
            <input
              name="qtyPack"
              type="number"
              min="0"
              value={qtyPackField}
              onChange={(e) => setQtyPackField(e.target.value)}
              placeholder="0"
              className="w-full px-5 py-3 rounded-xl bg-white/50 border border-white/60 text-zinc-900 placeholder-white/20 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all shadow-inner text-center"
            />
            <span className="block mt-1.5 text-[11px] text-zinc-900/50 font-semibold text-center uppercase tracking-wider">{packUnitField || 'pachka'}</span>
          </div>
        )}
        <div className="w-32">
          <input
            name="qtyPiece"
            type="number"
            min="0"
            value={qtyPieceField}
            onChange={(e) => setQtyPieceField(e.target.value)}
            placeholder="0"
            className="w-full px-5 py-3 rounded-xl bg-white/50 border border-white/60 text-zinc-900 placeholder-white/20 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all shadow-inner text-center"
          />
          <span className="block mt-1.5 text-[11px] text-zinc-900/50 font-semibold text-center uppercase tracking-wider">{unitField || 'dona'}</span>
        </div>
        {hasPack && (
          <div className="flex-1 min-w-[150px] flex items-center pt-1">
            <div className="px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm font-bold text-emerald-600">
              Jami: {totalBaseQty} {unitField || 'dona'}
              {(qtyBoxNum > 0 || qtyPackNum > 0 || qtyPieceNum > 0) && (
                <span className="text-emerald-600/60 font-medium"> · {qtyBoxNum > 0 ? `${qtyBoxNum} ${boxUnitField || 'karobka'} ` : ''}{qtyPackNum > 0 ? `${qtyPackNum} ${packUnitField || 'pachka'} ` : ''}{qtyPieceNum > 0 ? `${qtyPieceNum} ${unitField || 'dona'}` : ''}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="glass-card p-6 md:p-8 rounded-2xl mb-10 relative overflow-visible group border border-white/60 shadow-2xl z-20">
      {/* Background glow */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-brand-500/20 rounded-full blur-[80px] pointer-events-none"></div>

      <div className="flex flex-wrap gap-2 sm:gap-4 mb-8 border-b border-white/60 pb-4 relative z-10">
        <button
          onClick={() => handleTabChange('ADD')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'ADD'
              ? 'bg-brand-500 text-zinc-900 shadow-[0_0_15px_rgba(99,102,241,0.4)]'
              : 'text-zinc-900/50 hover:text-zinc-900 hover:bg-white/40'
          }`}
        >
          <ArrowDownCircle size={16} />
          Kirim qilish <span className="hidden sm:inline">(Mavjud mahsulot)</span>
        </button>
        <button
          onClick={() => handleTabChange('NEW')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'NEW'
              ? 'bg-violet-500 text-zinc-900 shadow-[0_0_15px_rgba(139,92,246,0.4)]'
              : 'text-zinc-900/50 hover:text-zinc-900 hover:bg-white/40'
          }`}
        >
          <PlusCircle size={16} />
          Yangi mahsulot <span className="hidden sm:inline">qo'shish</span>
        </button>
        <button
          onClick={() => handleTabChange('UNIT')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'UNIT'
              ? 'bg-amber-500 text-zinc-900 shadow-[0_0_15px_rgba(245,158,11,0.4)]'
              : 'text-zinc-900/50 hover:text-zinc-900 hover:bg-white/40'
          }`}
        >
          <Settings2 size={16} />
          Tahrirlash <span className="hidden sm:inline">(nom, narx, birlik)</span>
        </button>
      </div>

      <form ref={formRef} action={handleAction} className="flex flex-col gap-5 relative z-10">
        {activeTab === 'NEW' && (
          <>
            <div className="flex flex-col sm:flex-row gap-5 items-end">
              <div className="flex-1 w-full">
                <label className="block text-xs font-semibold text-zinc-900/60 uppercase tracking-wider mb-2">Mahsulot Nomi</label>
                <input
                  name="name"
                  type="text"
                  required
                  placeholder="Masalan: Kuler qog'oz stakani"
                  className="w-full px-5 py-3 rounded-xl bg-white/50 border border-white/60 text-zinc-900 placeholder-white/20 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all shadow-inner"
                />
              </div>
              <div className="w-full sm:w-64">
                <label className="block text-xs font-semibold text-zinc-900/60 uppercase tracking-wider mb-2">
                  Narx — 1 {newPriceMode === 'box' && hasBox ? (boxUnitField || 'karobka') : newPriceMode === 'pack' && hasPack ? (packUnitField || 'pachka') : (unitField || 'dona')} (so'm)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    value={newPriceField}
                    onChange={(e) => setNewPriceField(e.target.value)}
                    placeholder="0"
                    className="flex-1 w-full px-5 py-3 rounded-xl bg-white/50 border border-white/60 text-zinc-900 placeholder-white/20 focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all shadow-inner"
                  />
                  {hasPack && (
                    <div className="flex rounded-xl border border-white/60 overflow-hidden shrink-0 shadow-inner">
                      <button
                        type="button"
                        onClick={() => setNewPriceMode('piece')}
                        className={`px-3 text-xs font-bold transition-colors ${newPriceMode === 'piece' ? 'bg-amber-500 text-white' : 'bg-white/50 text-zinc-900/50 hover:bg-white/80'}`}
                      >
                        {unitField || 'dona'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewPriceMode('pack')}
                        className={`px-3 text-xs font-bold transition-colors ${newPriceMode === 'pack' ? 'bg-amber-500 text-white' : 'bg-white/50 text-zinc-900/50 hover:bg-white/80'}`}
                      >
                        {packUnitField || 'pachka'}
                      </button>
                      {hasBox && (
                        <button
                          type="button"
                          onClick={() => setNewPriceMode('box')}
                          className={`px-3 text-xs font-bold transition-colors ${newPriceMode === 'box' ? 'bg-amber-500 text-white' : 'bg-white/50 text-zinc-900/50 hover:bg-white/80'}`}
                        >
                          {boxUnitField || 'karobka'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {/* Server har doim 1 dona narxini oladi */}
                <input type="hidden" name="price" value={String(newPricePerDona)} readOnly />
                {newPriceRaw > 0 && ((newPriceMode === 'pack' && hasPack) || (newPriceMode === 'box' && hasBox)) && (
                  <p className="mt-1.5 text-[11px] font-semibold text-emerald-600">
                    = {fmtSom(newPricePerDona)} so'm / {unitField || 'dona'} · (1 {newPriceMode === 'box' ? (boxUnitField || 'karobka') : (packUnitField || 'pachka')} = {newPriceMode === 'box' ? donaPerBox : packSizeNum} {unitField || 'dona'})
                  </p>
                )}
              </div>
            </div>
            {unitConfigBlock}
            {newQtyBlock}
            <p className="text-xs text-zinc-900/40 font-medium -mt-1">
              Narxni {hasPack ? `1 ${unitField || 'dona'}ga yoki 1 ${packUnitField || 'pachka'}ga` : `1 ${unitField || 'dona'}ga`} hisoblab kiriting — tizim ichkarida har doim 1 {unitField || 'dona'} narxida saqlaydi (chiqim shu narxdan hisoblanadi).
            </p>
          </>
        )}

        {activeTab === 'ADD' && (
          <>
            <div className="flex flex-col sm:flex-row gap-5 items-end">
              <div className="flex-1 w-full">
                <label className="block text-xs font-semibold text-zinc-900/60 uppercase tracking-wider mb-2">Katalogdan tanlang</label>
                <CatalogModal
                  items={items}
                  name="itemId"
                  onSelect={setSelectedItem}
                  selectedItem={selectedItem}
                />
              </div>
              <div className="w-full sm:w-60">
                <label className="block text-xs font-semibold text-zinc-900/60 uppercase tracking-wider mb-2">
                  Miqdori — {addQtyMode === 'box' && addHasBox ? (selectedItem?.boxUnit || 'karobka') : addQtyMode === 'pack' && addHasPack ? (selectedItem?.packUnit || 'pachka') : (selectedItem?.unit || 'dona')}
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    required
                    min="1"
                    value={addQtyField}
                    onChange={(e) => setAddQtyField(e.target.value)}
                    placeholder="0"
                    className="flex-1 w-full px-5 py-3 rounded-xl bg-white/50 border border-white/60 text-zinc-900 placeholder-white/20 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all shadow-inner"
                  />
                  {addHasPack && (
                    <div className="flex rounded-xl border border-white/60 overflow-hidden shrink-0 shadow-inner">
                      <button type="button" onClick={() => setAddQtyMode('piece')}
                        className={`px-2.5 text-xs font-bold transition-colors ${addQtyMode === 'piece' ? 'bg-emerald-500 text-white' : 'bg-white/50 text-zinc-900/50 hover:bg-white/80'}`}>
                        {selectedItem?.unit || 'dona'}
                      </button>
                      <button type="button" onClick={() => setAddQtyMode('pack')}
                        className={`px-2.5 text-xs font-bold transition-colors ${addQtyMode === 'pack' ? 'bg-emerald-500 text-white' : 'bg-white/50 text-zinc-900/50 hover:bg-white/80'}`}>
                        {selectedItem?.packUnit || 'pachka'}
                      </button>
                      {addHasBox && (
                        <button type="button" onClick={() => setAddQtyMode('box')}
                          className={`px-2.5 text-xs font-bold transition-colors ${addQtyMode === 'box' ? 'bg-emerald-500 text-white' : 'bg-white/50 text-zinc-900/50 hover:bg-white/80'}`}>
                          {selectedItem?.boxUnit || 'karobka'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <input type="hidden" name="quantity" value={String(addQtyBase)} readOnly />
                {addQtyMode !== 'piece' && addQtyNum > 0 && (
                  <p className="mt-1.5 text-[11px] font-semibold text-emerald-600">= {addQtyBase} {selectedItem?.unit || 'dona'}</p>
                )}
              </div>
              <div className="w-full sm:w-56">
                <label className="block text-xs font-semibold text-zinc-900/60 uppercase tracking-wider mb-2">
                  Kelgan narx — 1 {addPriceMode === 'box' && addHasBox ? (selectedItem?.boxUnit || 'karobka') : addPriceMode === 'pack' && addHasPack ? (selectedItem?.packUnit || 'pachka') : (selectedItem?.unit || 'dona')} (so'm)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    value={addPriceField}
                    onChange={(e) => setAddPriceField(e.target.value)}
                    placeholder="ixtiyoriy"
                    className="flex-1 w-full px-5 py-3 rounded-xl bg-white/50 border border-white/60 text-zinc-900 placeholder-white/20 focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all shadow-inner"
                  />
                  {addHasPack && (
                    <div className="flex rounded-xl border border-white/60 overflow-hidden shrink-0 shadow-inner">
                      <button
                        type="button"
                        onClick={() => setAddPriceMode('piece')}
                        className={`px-3 text-xs font-bold transition-colors ${addPriceMode === 'piece' ? 'bg-amber-500 text-white' : 'bg-white/50 text-zinc-900/50 hover:bg-white/80'}`}
                      >
                        {selectedItem?.unit || 'dona'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddPriceMode('pack')}
                        className={`px-3 text-xs font-bold transition-colors ${addPriceMode === 'pack' ? 'bg-amber-500 text-white' : 'bg-white/50 text-zinc-900/50 hover:bg-white/80'}`}
                      >
                        {selectedItem?.packUnit || 'pachka'}
                      </button>
                      {addHasBox && (
                        <button
                          type="button"
                          onClick={() => setAddPriceMode('box')}
                          className={`px-3 text-xs font-bold transition-colors ${addPriceMode === 'box' ? 'bg-amber-500 text-white' : 'bg-white/50 text-zinc-900/50 hover:bg-white/80'}`}
                        >
                          {selectedItem?.boxUnit || 'karobka'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {/* Server har doim 1 dona narxini oladi */}
                <input type="hidden" name="price" value={String(addPricePerDona)} readOnly />
                {addPriceRaw > 0 && ((addPriceMode === 'pack' && addHasPack) || (addPriceMode === 'box' && addHasBox)) && (
                  <p className="mt-1.5 text-[11px] font-semibold text-emerald-600">
                    = {fmtSom(addPricePerDona)} so'm / {selectedItem?.unit || 'dona'} · (1 {addPriceMode === 'box' ? (selectedItem?.boxUnit || 'karobka') : (selectedItem?.packUnit || 'pachka')} = {addPriceMode === 'box' ? addDonaPerBox : addPackSize} {selectedItem?.unit || 'dona'})
                  </p>
                )}
              </div>
            </div>

            {selectedItem && addQtyBase > 0 && addPriceRaw > 0 && (
              <div className="px-5 py-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-sm">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-zinc-900/70">
                  <span>Hozirgi: <b className="text-zinc-900">{curStockQty}</b> × {fmtSom(curStockPrice)} so'm</span>
                  <span className="text-zinc-900/30">+</span>
                  <span>keldi: <b className="text-zinc-900">{addQtyBase}</b> {selectedItem.unit || 'dona'} × {fmtSom(addPricePerDona)} so'm</span>
                  <span className="text-zinc-900/30">→</span>
                  <span className="font-bold text-emerald-700">yangi o'rtacha: {fmtSom(newAvgPrice)} so'm</span>
                  <span className="text-zinc-900/40">· yangi qoldiq {curStockQty + addQtyBase} {selectedItem.unit || 'dona'}</span>
                </div>
              </div>
            )}

            <p className="text-xs text-zinc-900/40 font-medium -mt-1">
              <b>Kelgan narx</b> kiritilsa — tizim <b>tortilgan o'rtacha narx</b>ni avtomatik hisoblaydi (eski qoldiq + yangi partiya). Bo'sh qoldirsangiz eski narx saqlanadi.
              {addHasPack ? ` Miqdor va narxni dona / ${selectedItem?.packUnit || 'pachka'}${addHasBox ? ` / ${selectedItem?.boxUnit || 'karobka'}` : ''} hisobida — yonidagi tugmadan tanlab kiriting.` : ''}
            </p>
          </>
        )}

        {activeTab === 'UNIT' && (
          <>
            <div className="w-full">
              <label className="block text-xs font-semibold text-zinc-900/60 uppercase tracking-wider mb-2">Mahsulotni tanlang</label>
              <CatalogModal
                items={items}
                name="itemId"
                onSelect={handleSelectForUnit}
                selectedItem={selectedItem}
              />
            </div>
            {selectedItem && (
              <div className="flex flex-col sm:flex-row gap-5 items-end">
                <div className="flex-1 w-full">
                  <label className="block text-xs font-semibold text-zinc-900/60 uppercase tracking-wider mb-2">Mahsulot nomi</label>
                  <input
                    name="name"
                    type="text"
                    required
                    value={nameField}
                    onChange={(e) => setNameField(e.target.value)}
                    placeholder="Mahsulot nomi"
                    className="w-full px-5 py-3 rounded-xl bg-white/50 border border-white/60 text-zinc-900 placeholder-white/20 focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all shadow-inner"
                  />
                </div>
                <div className="w-full sm:w-52">
                  <label className="block text-xs font-semibold text-zinc-900/60 uppercase tracking-wider mb-2">Narx — 1 {unitField || 'dona'} (so'm)</label>
                  <input
                    name="price"
                    type="number"
                    min="0"
                    value={priceField}
                    onChange={(e) => setPriceField(e.target.value)}
                    placeholder="0"
                    className="w-full px-5 py-3 rounded-xl bg-white/50 border border-white/60 text-zinc-900 placeholder-white/20 focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all shadow-inner"
                  />
                </div>
              </div>
            )}
            {selectedItem && unitConfigBlock}
            {selectedItem && (
              <p className="text-xs text-zinc-900/40 font-medium -mt-1">
                Nom yoki pachka/dona o'zgarsa tarix buzilmaydi (operatsiyalar mahsulotga ID orqali bog'langan), zaxira (qoldiq) ham o'zgarmaydi. Narx yangilansa keyingi chiqimlar yangi narxda hisoblanadi.
              </p>
            )}
            {!selectedItem && (
              <p className="text-sm text-zinc-900/40 font-medium">Nom, narx yoki pachka/dona sozlamasini o'zgartirish uchun avval mahsulotni tanlang. Zaxira (qoldiq) o'zgarmaydi.</p>
            )}
          </>
        )}

        <button
          type="submit"
          disabled={loading}
          className={`w-full sm:w-auto sm:self-end px-8 py-3 rounded-xl font-bold transition-all shadow-lg text-zinc-900 ${
            loading ? 'bg-white/10 cursor-not-allowed opacity-70' :
            activeTab === 'ADD'
              ? 'bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 hover:shadow-brand-500/25 border border-brand-400/20 hover:-translate-y-0.5'
              : activeTab === 'UNIT'
                ? 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 hover:shadow-amber-500/25 border border-amber-400/20 hover:-translate-y-0.5'
                : 'bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 hover:shadow-violet-500/25 border border-violet-400/20 hover:-translate-y-0.5'
          }`}
        >
          {loading ? 'Bajarilmoqda...' : 'Tasdiqlash'}
        </button>
      </form>

      {msg && (
        <div className={`mt-6 p-4 rounded-xl flex items-center gap-3 text-sm font-medium border relative z-10 animate-in fade-in slide-in-from-bottom-2 ${
          isError
            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
        }`}>
          {isError ? (
            <div className="w-6 h-6 rounded-full bg-rose-500/20 flex items-center justify-center">!</div>
          ) : (
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">✓</div>
          )}
          {msg}
        </div>
      )}
    </div>
  )
}
