// ============================================
// TEST NOTIFICATIONS TRONG BROWSER CONSOLE
// ============================================
// Copy và paste đoạn code này vào Browser Console (F12)
// để test notifications trực tiếp

console.log('🔍 Testing notifications...');

// Get supabase instance from window (if available)
const testNotifications = async () => {
  try {
    console.log('1️⃣ Checking auth user...');
    const { data: { user }, error: authError } = await window.supabase.auth.getUser();
    
    if (authError) {
      console.error('❌ Auth error:', authError);
      return;
    }
    
    if (!user) {
      console.error('❌ No user logged in');
      return;
    }
    
    console.log('✅ User:', user.id, user.email);
    
    console.log('2️⃣ Fetching notifications...');
    const { data: notifications, error: notifError } = await window.supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (notifError) {
      console.error('❌ Notification query error:', notifError);
      console.error('Error details:', JSON.stringify(notifError, null, 2));
      return;
    }
    
    console.log('✅ Notifications loaded:', notifications?.length || 0);
    console.log('📊 Notifications:', notifications);
    
    if (notifications && notifications.length > 0) {
      console.log('✅ SUCCESS! Notifications are working!');
      console.table(notifications);
    } else {
      console.warn('⚠️ No notifications found for this user');
      
      // Try to check if notifications exist for ANY user
      console.log('3️⃣ Checking total notifications in database...');
      const { count, error: countError } = await window.supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true });
      
      if (!countError) {
        console.log('Total notifications in database:', count);
      }
    }
    
  } catch (err) {
    console.error('❌ Exception:', err);
  }
};

// Run the test
testNotifications();

// Also check if NotificationContext is loaded
console.log('4️⃣ Checking React context...');
console.log('NotificationProvider should have logged messages with 🔔');
