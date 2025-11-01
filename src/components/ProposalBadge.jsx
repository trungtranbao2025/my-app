import React, { useEffect, useState } from 'react'
import supabaseLib from '../lib/supabase'

const { supabase } = supabaseLib
import { useAuth } from '../contexts/AuthContext'

/**
 * Component hiển thị số lượng đề xuất chờ phê duyệt với realtime update
 */
const ProposalBadge = ({ onClick, className = '' }) => {
  const { profile } = useAuth()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!profile?.id) return

    // Load initial count
    loadCount()

    // Setup realtime subscription
    const channel = supabase
      .channel('proposals-count-channel')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'task_proposals',
          filter: `approver_id=eq.${profile.id}`
        },
        () => {
          // Reload count whenever proposals change
          loadCount()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile?.id])

  const loadCount = async () => {
    if (!profile?.id) return

    try {
      const { data, error } = await supabase.rpc('count_pending_task_proposals')
      if (error) throw error
      setCount(data || 0)
    } catch (error) {
      console.error('Error loading proposal count:', error)
    }
  }

  if (count === 0) return null

  return (
    <button
      onClick={onClick}
      className={`btn-warning flex items-center gap-2 relative ${className}`}
    >
      <span>Phê duyệt ({count})</span>
      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
        {count}
      </span>
    </button>
  )
}

export default ProposalBadge
