'use client'

import React, { useState } from 'react'
import { Calendar, ChevronDown, ChevronUp, Package } from 'lucide-react'

type EventItem = {
  name: string
  quantity: number
  cost: number
  unit: string
}

type EventStat = {
  key: string
  date: Date
  eventName: string
  count: number
  totalCost: number
  items: EventItem[]
}

export default function EventTable({ entries }: { entries: EventStat[] }) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  const toggleRow = (key: string) => {
    if (expandedRow === key) {
      setExpandedRow(null)
    } else {
      setExpandedRow(key)
    }
  }

  return (
    <table className="w-full text-left border-collapse">
      <thead className="bg-dark-900/80 sticky top-0 z-10">
        <tr>
          <th className="p-4 font-medium text-white/40 text-xs uppercase tracking-wider w-10"></th>
          <th className="p-4 font-medium text-white/40 text-xs uppercase tracking-wider">Tadbir Nomi</th>
          <th className="p-4 font-medium text-white/40 text-xs uppercase tracking-wider">Umumiy Olingan</th>
          <th className="p-4 font-medium text-white/40 text-xs uppercase tracking-wider text-right">Summasi</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-white/5">
        {entries.length === 0 ? (
          <tr>
            <td colSpan={4} className="p-12 text-center text-white/30 font-medium">Ma'lumot yo'q</td>
          </tr>
        ) : (
          entries.map((stats) => (
            <React.Fragment key={stats.key}>
              <tr 
                onClick={() => toggleRow(stats.key)}
                className="hover:bg-white/[0.04] transition-colors cursor-pointer group"
              >
                <td className="p-4 text-white/40 group-hover:text-white transition-colors">
                  {expandedRow === stats.key ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </td>
                <td className="p-4">
                  <div className="font-medium text-white/90">{stats.eventName}</div>
                  <div className="text-xs text-white/40 mt-1 flex items-center gap-1">
                    <Calendar size={12} />
                    {new Date(stats.date).toLocaleDateString('uz-UZ')}
                  </div>
                </td>
                <td className="p-4">
                  <span className="px-2 py-1 bg-white/5 rounded-lg text-white/60 text-sm">
                    {stats.count} ta mahsulot
                  </span>
                </td>
                <td className="p-4 text-right">
                  <span className="font-bold text-emerald-400">
                    {stats.totalCost.toLocaleString('uz-UZ')} UZS
                  </span>
                </td>
              </tr>
              {expandedRow === stats.key && (
                <tr className="bg-dark-900/30">
                  <td colSpan={4} className="p-0 border-b border-white/5">
                    <div className="p-4 pl-12 pr-4 bg-black/20">
                      <div className="text-xs font-bold text-white/30 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Package size={14} /> Olingan mahsulotlar ro'yxati
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {stats.items.map((item, i) => (
                          <div key={i} className="flex justify-between items-center p-3 rounded-lg bg-white/5 border border-white/5">
                            <div>
                              <div className="text-sm font-medium text-white/80">{item.name}</div>
                              <div className="text-xs text-rose-400 mt-1 font-bold">-{item.quantity} {item.unit.toLowerCase()}</div>
                            </div>
                            <div className="text-sm text-emerald-400/80 font-medium">
                              {item.cost.toLocaleString('uz-UZ')} UZS
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))
        )}
      </tbody>
    </table>
  )
}
