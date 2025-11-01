import supabaseLib from '../lib/supabase'

const { supabase } = supabaseLib

/**
 * Ensures that a user has a default reminder preference record.
 * If the user does not have one, it creates one using the default
 * values defined in the database schema.
 * This function is safe to call multiple times.
 *
 * @param {string} userId - The UUID of the user.
 */
export const ensureDefaultReminderPreferences = async (userId) => {
  if (!userId) {
    console.error('ensureDefaultReminderPreferences called without a userId.')
    return
  }

  try {
    // First, check if preferences for the user already exist.
    const { count, error: checkError } = await supabase
      .from('user_reminder_preferences')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (checkError) {
      // Don't throw on check error, but log it.
      console.error('Error checking for reminder preferences:', checkError.message)
      return;
    }

    // If no preferences exist (count is 0), then insert the default record.
    if (count === 0) {
      console.log(`No reminder preferences found for user ${userId}. Creating default record.`)
      const { error: insertError } = await supabase
        .from('user_reminder_preferences')
        .insert({ user_id: userId }) // The table has default values for config columns

      if (insertError) {
        // A race condition might occur if another process creates the record
        // between the check and the insert. Code '23505' is for unique_violation.
        if (insertError.code === '23505') {
          console.log('Default preferences were created by another process just now. No action needed.')
        } else {
          // For other errors, we should log them.
          console.error('Error creating default reminder preferences:', insertError.message)
        }
      } else {
        console.log(`Successfully created default reminder preferences for user ${userId}.`)
      }
    }
  } catch (error) {
    // Catch any other unexpected errors during the process.
    console.error('An unexpected error occurred in ensureDefaultReminderPreferences:', error.message)
  }
}

/**
 * Checks if a user has an existing reminder preference record.
 * @param {string} userId - The UUID of the user.
 * @returns {Promise<boolean>} - True if preferences exist, false otherwise.
 */
export async function hasReminderPreferences(userId) {
  if (!userId) return false
  try {
    const { count, error } = await supabase
      .from('user_reminder_preferences')
      .select('user_id', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (error) {
      console.error('Error checking for reminder preferences:', error.message)
      return false
    }
    
    return count > 0
  } catch (error) {
    console.error('Unexpected error in hasReminderPreferences:', error.message)
    return false
  }
}
