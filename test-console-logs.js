// ============================================
// KIỂM TRA CONSOLE LOGS
// ============================================
// Hướng dẫn: Mở DevTools Console (F12) và kiểm tra các logs sau

// 1. Tìm logs từ NotificationContext:
// ✅ Mong đợi thấy:
//    🔔 Loading notifications for user: xxx
//    ✅ Notifications loaded: 10 items
//    📊 Notification data: [...]

// 2. Nếu KHÔNG thấy logs trên, chạy test này:

console.log('=== MANUAL NOTIFICATION TEST ===');

// Kiểm tra user hiện tại
window.supabase.auth.getUser().then(({ data: { user }, error }) => {
  if (error) {
    console.error('❌ Auth error:', error);
    return;
  }
  
  if (!user) {
    console.error('❌ No user logged in');
    return;
  }
  
  console.log('✅ Current user:');
  console.log('   ID:', user.id);
  console.log('   Email:', user.email);
  
  // Test query notifications
  console.log('\n🔔 Testing notifications query...');
  
  window.supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)
    .then(({ data, error }) => {
      if (error) {
        console.error('❌ Query error:', error);
        console.error('❌ Error code:', error.code);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error details:', error.details);
        return;
      }
      
      console.log('✅ Query successful!');
      console.log('📊 Notifications count:', data?.length || 0);
      
      if (data && data.length > 0) {
        console.log('📋 Notifications:', data);
        console.table(data.map(n => ({
          type: n.type,
          title: n.title,
          is_read: n.is_read,
          created_at: n.created_at
        })));
        
        console.log('\n✅ SUCCESS! Notifications are in database and query works!');
        console.log('⚠️ If you don\'t see them in UI, the problem is in NotificationContext or NotificationBell component.');
      } else {
        console.warn('⚠️ Query returned 0 notifications');
        console.log('💡 This means RLS policies might be blocking the query');
        console.log('💡 Run SIMPLE-FIX-NOTIFICATIONS.sql to fix policies');
      }
    });
});

// 3. Kiểm tra NotificationContext có đang hoạt động không
setTimeout(() => {
  console.log('\n=== CHECKING REACT CONTEXT ===');
  console.log('Look for these logs in console:');
  console.log('  👤 NotificationContext useEffect - user: xxx');
  console.log('  ✅ User found, loading notifications...');
  console.log('  🔔 Loading notifications for user: xxx');
  console.log('  ✅ Notifications loaded: X items');
  console.log('\nIf you don\'t see these logs, NotificationContext is not initialized properly.');
}, 2000);
