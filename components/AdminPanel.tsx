'use client'

import { useRef, useState, useEffect } from 'react'
import { createNewItem, addStock } from '@/app/actions'
import { PlusCircle, ArrowDownCircle, Search, X, PackageOpen, Check } from 'lucide-react'

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
  items: { id: string, name: string }[], 
  name: string,
  onSelect: (item: {id: string, name: string} | null) => void,
  selectedItem: {id: string, name: string} | null
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
        className="w-full px-5 py-3 rounded-xl bg-dark-900/50 border border-white/10 text-white cursor-pointer flex justify-between items-center hover:bg-dark-900/80 transition-all shadow-inner group"
      >
        {selectedItem ? (
          <div className="flex items-center gap-3 w-full overflow-hidden">
            <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${getGradient(selectedItem.name)} flex items-center justify-center flex-shrink-0 shadow-lg`}>
              <span className="text-white font-bold text-sm">{selectedItem.name.charAt(0).toUpperCase()}</span>
            </div>
            <span className="text-white truncate font-medium">{selectedItem.name}</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-white/40">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10 border-dashed">
              <PackageOpen size={16} />
            </div>
            <span>Katalogdan mahsulot tanlang...</span>
          </div>
        )}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 backdrop-blur-xl bg-dark-900/80">
          <div className="w-full max-w-5xl bg-dark-800 border border-white/10 rounded-2xl shadow-2xl flex flex-col h-[85vh] sm:h-[80vh] animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1">
                <div className="w-12 h-12 rounded-2xl bg-brand-500/20 flex items-center justify-center text-brand-400">
                  <PackageOpen size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Mahsulot Katalogi</h2>
                  <p className="text-white/50 text-sm">Jami {items.length} ta mahsulot bazada mavjud</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 hover:text-rose-400 transition-colors text-white/50"
              >
                <X size={20} />
              </button>
            </div>

            {/* Search Bar */}
            <div className="px-6 py-4 border-b border-white/5 bg-dark-900/30">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={20} />
                <input 
                  type="text"
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Katalogdan qidirish..."
                  className="w-full bg-dark-900/80 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-white/30 focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all shadow-inner"
                />
              </div>
            </div>
            
            {/* Grid Catalog */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              {filteredItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-white/30 gap-4">
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
                          ? 'bg-brand-500/10 border-brand-500/50 shadow-brand-500/20' 
                          : 'bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.04]'
                      }`}
                    >
                      {/* Placeholder Image Box */}
                      <div className={`w-full aspect-square rounded-xl bg-gradient-to-br ${getGradient(item.name)} mb-4 flex items-center justify-center shadow-inner relative overflow-hidden group-hover:scale95 transition-transform`}>
                        <span className="text-5xl font-black text-white/30 group-hover:text-white/50 transition-colors">
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
                        <h3 className="text-sm font-semibold text-white/90 line-clamp-2 leading-snug group-hover:text-white transition-colors">{item.name}</h3>
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

export default function AdminPanel({ items }: { items: { id: string, name: string }[] }) {
  const [activeTab, setActiveTab] = useState<'NEW' | 'ADD'>('ADD')
  const formRef = useRef<HTMLFormElement>(null)
  const [msg, setMsg] = useState('')
  const [isError, setIsError] = useState(false)
  const [loading, setLoading] = useState(false)
  
  // Custom select state managed at parent to prevent reset bugs
  const [selectedItem, setSelectedItem] = useState<{id: string, name: string} | null>(null)

  const handleTabChange = (tab: 'NEW' | 'ADD') => {
    setActiveTab(tab)
    setMsg('')
    setSelectedItem(null)
    if (formRef.current) formRef.current.reset()
  }

  async function handleAction(formData: FormData) {
    if (activeTab === 'ADD' && !selectedItem) {
      setMsg('Iltimos, katalogdan mahsulotni tanlang')
      setIsError(true)
      return
    }

    setLoading(true)
    setMsg('Jarayonda...')
    setIsError(false)
    
    // Make sure formData has the correct itemId
    if (activeTab === 'ADD' && selectedItem) {
      formData.set('itemId', selectedItem.id)
    }

    const result = activeTab === 'NEW' 
      ? await createNewItem(formData) 
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
      setTimeout(() => setMsg(''), 4000)
    }
  }

  return (
    <div className="glass-card p-6 md:p-8 rounded-2xl mb-10 relative overflow-visible group border border-white/10 shadow-2xl z-20">
      {/* Background glow */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-brand-500/20 rounded-full blur-[80px] pointer-events-none"></div>
      
      <div className="flex gap-2 sm:gap-4 mb-8 border-b border-white/10 pb-4 relative z-10">
        <button 
          onClick={() => handleTabChange('ADD')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'ADD' 
              ? 'bg-brand-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.4)]' 
              : 'text-white/50 hover:text-white hover:bg-white/5'
          }`}
        >
          <ArrowDownCircle size={16} />
          Kirim qilish <span className="hidden sm:inline">(Mavjud mahsulot)</span>
        </button>
        <button 
          onClick={() => handleTabChange('NEW')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            activeTab === 'NEW' 
              ? 'bg-violet-500 text-white shadow-[0_0_15px_rgba(139,92,246,0.4)]' 
              : 'text-white/50 hover:text-white hover:bg-white/5'
          }`}
        >
          <PlusCircle size={16} />
          Yangi mahsulot <span className="hidden sm:inline">qo'shish</span>
        </button>
      </div>

      <form ref={formRef} action={handleAction} className="flex flex-col sm:flex-row gap-5 items-end relative z-10">
        {activeTab === 'NEW' ? (
          <div className="flex-1 w-full">
            <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">Mahsulot Nomi</label>
            <input 
              name="name" 
              type="text" 
              required 
              placeholder="Masalan: Kuler qog'oz stakani" 
              className="w-full px-5 py-3 rounded-xl bg-dark-900/50 border border-white/10 text-white placeholder-white/20 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all shadow-inner" 
            />
          </div>
        ) : (
          <div className="flex-1 w-full">
            <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">Katalogdan tanlang</label>
            <CatalogModal 
              items={items} 
              name="itemId" 
              onSelect={setSelectedItem} 
              selectedItem={selectedItem} 
            />
          </div>
        )}
        
        <div className="w-full sm:w-40">
          <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">Miqdori</label>
          <input 
            name="quantity" 
            type="number" 
            required 
            min="1" 
            placeholder="0" 
            className="w-full px-5 py-3 rounded-xl bg-dark-900/50 border border-white/10 text-white placeholder-white/20 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all shadow-inner" 
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className={`w-full sm:w-auto px-8 py-3 rounded-xl font-bold transition-all shadow-lg text-white ${
            loading ? 'bg-white/10 cursor-not-allowed opacity-70' : 
            activeTab === 'ADD' 
              ? 'bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 hover:shadow-brand-500/25 border border-brand-400/20 hover:-translate-y-0.5' 
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
