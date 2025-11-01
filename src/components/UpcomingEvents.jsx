import React, { useState, useEffect } from 'react'
import { CakeIcon, SparklesIcon } from '@heroicons/react/24/outline'
import supabaseLib from '../lib/supabase'

const { supabase } = supabaseLib
import { formatDate } from '../utils/helpers'

const UpcomingEvents = ({ daysAhead = 30 }) => {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadUpcomingEvents()
  }, [daysAhead])

  const loadUpcomingEvents = async () => {
    try {
      setLoading(true)
      
      // Call Supabase function to get upcoming events
      const { data, error } = await supabase.rpc('get_upcoming_events', {
        days_ahead: daysAhead
      })

      if (error) throw error

      setEvents(data || [])
    } catch (error) {
      console.error('Error loading upcoming events:', error)
    } finally {
      setLoading(false)
    }
  }

  const getEventIcon = (eventType) => {
    return eventType === 'birthday' ? (
      <CakeIcon className="w-5 h-5 text-pink-500" />
    ) : (
      <SparklesIcon className="w-5 h-5 text-purple-500" />
    )
  }

  const getEventText = (event) => {
    if (event.event_type === 'birthday') {
      const age = event.years + 1 // Next birthday age
      return `Sinh nhật lần ${age}`
    } else {
      return `Kỷ niệm ${event.years} năm công ty`
    }
  }

  const getDaysText = (daysUntil) => {
    if (daysUntil === 0) return 'Hôm nay'
    if (daysUntil === 1) return 'Ngày mai'
    if (daysUntil <= 7) return `Còn ${daysUntil} ngày`
    return formatDate(new Date(Date.now() + daysUntil * 24 * 60 * 60 * 1000))
  }

  const getEventBadgeColor = (daysUntil) => {
    if (daysUntil === 0) return 'bg-red-100 text-red-700 border-red-300'
    if (daysUntil <= 3) return 'bg-orange-100 text-orange-700 border-orange-300'
    if (daysUntil <= 7) return 'bg-yellow-100 text-yellow-700 border-yellow-300'
    return 'bg-blue-100 text-blue-700 border-blue-300'
  }

  if (loading) {
    return (
      <div className="card">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <CakeIcon className="w-6 h-6 text-pink-500" />
          Sự kiện sắp tới
        </h3>
        <p className="text-gray-500 text-center py-8">
          Không có sinh nhật hoặc kỷ niệm nào trong {daysAhead} ngày tới
        </p>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <CakeIcon className="w-6 h-6 text-pink-500" />
          Sự kiện sắp tới
        </h3>
        <span className="text-sm text-gray-500">
          {events.length} sự kiện
        </span>
      </div>

      <div className="space-y-3">
        {events.map((event, index) => (
          <div
            key={`${event.user_id}-${event.event_type}-${index}`}
            className={`p-3 rounded-lg border transition-all hover:shadow-md ${
              event.days_until === 0 ? 'bg-gradient-to-r from-pink-50 to-purple-50' : 'bg-gray-50'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-1">
                {getEventIcon(event.event_type)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h4 className="font-semibold text-gray-900 truncate">
                    {event.full_name}
                  </h4>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full border ${getEventBadgeColor(
                      event.days_until
                    )}`}
                  >
                    {getDaysText(event.days_until)}
                  </span>
                </div>
                
                <p className="text-sm text-gray-600">
                  {getEventText(event)}
                </p>
                
                {event.days_until === 0 && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-pink-600 font-medium">
                    🎉 Đừng quên chúc mừng!
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {events.length > 5 && (
        <div className="mt-3 text-center">
          <button
            onClick={() => {/* Could open a modal with all events */}}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Xem tất cả →
          </button>
        </div>
      )}
    </div>
  )
}

export default UpcomingEvents
