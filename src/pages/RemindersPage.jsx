import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

const priorities = ['low','medium','high','urgent']
const frequencies = ['daily','weekly','monthly']

export default function RemindersPage() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [today, setToday] = useState([])
  const [form, setForm] = useState({
    title: '',
    message: '',
    priority: 'medium',
    frequency: 'daily',
    interval_days: 1,
    weekday: 1,
    month_day: 1,
    time_of_day: '08:00',
    active: true
  })

  useEffect(() => { load(); loadToday() }, [])

  const load = async () => {
    const { data, error } = await supabase
      .from('recurring_reminders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (error) return toast.error('Không tải được danh sách')
    setItems(data || [])
  }
  const loadToday = async () => {
    const { data, error } = await supabase.from('v_today_reminders').select('*').eq('user_id', user.id)
    if (!error) setToday(data || [])
  }

  const createItem = async (e) => {
    e.preventDefault()
    try {
      const payload = { ...form, user_id: user.id }
      const { error } = await supabase.from('recurring_reminders').insert(payload)
      if (error) throw error
      toast.success('Đã tạo nhắc việc định kỳ')
      setForm({ ...form, title: '', message: '' })
      await load(); await loadToday()
    } catch (e) { toast.error('Không thể tạo') }
  }

  const toggleActive = async (it) => {
    const { error } = await supabase.from('recurring_reminders').update({ active: !it.active }).eq('id', it.id)
    if (!error) { await load(); await loadToday() }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Nhắc việc</h1>

      <form onSubmit={createItem} className="card grid grid-cols-1 md:grid-cols-4 gap-3">
        <input className="input" placeholder="Tiêu đề" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required />
        <input className="input" placeholder="Nội dung" value={form.message} onChange={e=>setForm({...form,message:e.target.value})} />
        <select className="input" value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}>
          {priorities.map(p=> <option key={p} value={p}>{p}</option>)}
        </select>
        <div className="flex gap-2">
          <select className="input" value={form.frequency} onChange={e=>setForm({...form,frequency:e.target.value})}>
            {frequencies.map(f=> <option key={f} value={f}>{f}</option>)}
          </select>
          <input className="input w-24" type="number" min="1" value={form.interval_days} onChange={e=>setForm({...form,interval_days:parseInt(e.target.value||'1',10)})} />
          <input className="input w-24" type="time" value={form.time_of_day} onChange={e=>setForm({...form,time_of_day:e.target.value})} />
        </div>
        <button className="btn-primary">Thêm</button>
      </form>

      <div className="card">
        <h2 className="font-semibold mb-2">Tin nhắn nhắc việc hôm nay</h2>
        {today.length === 0 ? <div className="text-gray-500 text-sm">Không có</div> : (
          <ul className="space-y-2">
            {today.map(t => (
              <li key={t.recurring_id} className="p-2 rounded border bg-white">
                <div className="text-sm font-medium">{t.title}</div>
                <div className="text-xs text-gray-600">{t.message} · {t.time_of_day}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h2 className="font-semibold mb-2">Danh sách nhắc việc định kỳ</h2>
        <ul className="divide-y">
          {items.map(it => (
            <li key={it.id} className="py-2 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{it.title} <span className="text-xs text-gray-500">[{it.priority}]</span></div>
                <div className="text-xs text-gray-600">{it.frequency} · {it.time_of_day}</div>
              </div>
              <div className="flex gap-2">
                <button className="btn-light" onClick={()=>toggleActive(it)}>{it.active ? 'Tắt' : 'Bật'}</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
