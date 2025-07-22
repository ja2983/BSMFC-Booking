// script.js

// ─────────────────────────────────────────────
// 0. Global Toast Injection & Helper
// ─────────────────────────────────────────────

function showToast(message, icon = '⚠️', timeout = 5000) {
  const toast = document.getElementById('globalToast');
  if (!toast) return console.warn('Toast element not found.');
  toast.querySelector('.icon').textContent = icon;
  toast.querySelector('.message').textContent = message;
  // start animation
  toast.classList.remove('hidden');
  toast.classList.add('visible');

  // close handler
  toast.querySelector('.close').onclick = () => {
    toast.classList.remove('visible');
    setTimeout(() => toast.classList.add('hidden'), 5000);
  };

  // auto-dismiss
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.classList.add('hidden'), 5000);
  }, timeout);
}

document.addEventListener('DOMContentLoaded', () => {
  // inject animated toast CSS once
  if (!document.getElementById('globalToastStyles')) {
    const style = document.createElement('style');
    style.id = 'globalToastStyles';
    style.textContent = `
.toast {
  position: fixed;
  bottom: -80px;
  right: 20px;
  background: #004c93;
  color: #f9c74f;
  padding: 12px 16px;
  border-radius: 6px;
  font-size: 14px;
  display: flex;
  align-items: center;
  z-index: 9999;
  box-shadow: 0 4px 10px rgba(0,0,0,0.3);
  opacity: 0;
  transform: translateY(0);
  transition: transform 0.4s ease, opacity 0.4s ease;
}
.toast.visible {
  opacity: 1;
  transform: translateY(-80px);
}
.toast.hidden {
  display: none;
}
.toast .icon {
  margin-right: 8px;
}
.toast .close {
  background: none;
  border: none;
  color: #f9c74f;
  font-size: 16px;
  margin-left: auto;
  cursor: pointer;
}`;
    document.head.appendChild(style);
  }

  // inject toast HTML once
  if (!document.getElementById('globalToast')) {
    document.body.insertAdjacentHTML('beforeend', `
<div id="globalToast" class="toast hidden">
  <span class="icon">⚠️</span>
  <span class="message"></span>
  <button class="close">✖</button>
</div>`);
  }
});

// ─────────────────────────────────────────────
// 1. Supabase Client Initialization
// ─────────────────────────────────────────────

const SUPABASE_URL = 'https://huwqxkpovijdowetihrj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1d3F4a3BvdmlqZG93ZXRpaHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3ODEyNzksImV4cCI6MjA2ODM1NzI3OX0.RT1QbJjmGEL4HfrOJl53mZbAcgHRfMaDKcNN1Lsl404';
const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─────────────────────────────────────────────
// 2. Auth Helpers
// ─────────────────────────────────────────────

async function checkLoginStatus() {
  const { data: { session }, error } = await client.auth.getSession();
  if (error) console.error('Session error:', error.message);
  return !!session;
}

async function getCurrentUser() {
  const { data: { user }, error } = await client.auth.getUser();
  if (error) console.error('GetUser error:', error.message);
  return user;
}

async function logoutUser() {
  await client.auth.signOut();
  window.location.href = 'login.html';
}

// ─────────────────────────────────────────────
// 3. Auto-Logout Handler
// ─────────────────────────────────────────────

if (window.location.pathname.endsWith('logout.html')) {
  (async () => {
    await client.auth.signOut();
    setTimeout(() => window.location.href = 'login.html', 5000);
  })();
}

// ─────────────────────────────────────────────
// 4. Page Access Control
// ─────────────────────────────────────────────

(async () => {
  const path = window.location.pathname.split('/').pop();
  const publicPages = ['', 'index.html', 'login.html', 'register.html', 'logout.html'];
  const isAdminPage = path === 'admin.html';
  const isMyBooks = path === 'my-bookings.html';
  const loggedIn = await checkLoginStatus();

  if (!publicPages.includes(path) && !loggedIn) {
    showToast('🔐 Please log in to access this page.', '🔐', 5000);
    setTimeout(() => { window.location.href = 'login.html'; }, 2000);

  }

  if (isAdminPage && loggedIn) {
    const user = await getCurrentUser();
    const { data: profile, error } = await client
      .from('profiles')
      .select('role, active')
      .eq('id', user.id)
      .single();
    if (error || !profile || !profile.active || profile.role !== 'Admin') {
      showToast('⛔ You don’t have permission to view that page.', '⛔', 5000);
      setTimeout(() => { window.location.href = 'index.html'; }, 2000);

    }
  }

  if (isMyBooks && !loggedIn) {
    showToast('🔐 Please log in to view your bookings.');
    return window.location.href = 'login.html';
  }
})();

// ─────────────────────────────────────────────
// 5. Main Logic on DOMContentLoaded
// ─────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  const isLoggedIn = await checkLoginStatus();
  const currentUser = isLoggedIn ? await getCurrentUser() : null;

  // Navbar Links
  const loginLink = document.getElementById('loginLink');
  const logoutLink = document.getElementById('logoutLink');
  if (loginLink && logoutLink) {
    loginLink.classList.toggle('hidden', isLoggedIn);
    logoutLink.classList.toggle('hidden', !isLoggedIn);
    logoutLink.addEventListener('click', e => {
      e.preventDefault();
      logoutUser();
    });
  }

  // ──────────────────────────────────────────
  // Registration Handler (register.html)
  // ──────────────────────────────────────────

  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async e => {
      e.preventDefault();
      const username = document.getElementById('username').value.trim();
      const emailRaw = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const role = document.getElementById('role').value;
      const email = emailRaw.toLowerCase();

      if (!username || !email || !password || !role) {
        return showToast('⚠️ Please fill in all fields.');
      }

      // duplicate email check
      const { data: existing = [], error: dupErr } = await client
        .from('profiles')
        .select('id')
        .eq('email', email);
      if (dupErr) {
        console.error(dupErr);
        return showToast('⚠️ Error checking duplicates.');
      }
      if (existing.length > 0) {
        return showToast('⚠️ This email is already registered.');
      }

      // Create Supabase Auth account
      const { data: signUpData, error: signUpError } =
        await client.auth.signUp({ email, password });
      if (signUpError) {
        console.error(signUpError);
        return showToast('⚠️ Auth error: ' + signUpError.message);
      }

      // Auto-login immediately
      const { error: signInError } =
        await client.auth.signInWithPassword({ email, password });
      if (signInError) {
        console.error(signInError);
        return showToast('⚠️ Auto-login failed. Please log in manually.');
      }

      // Re-fetch logged-in user
      const { data: { user: authUser }, error: userErr } = await client.auth.getUser();
      if (userErr || !authUser) {
        console.error(userErr);
        return showToast('⚠️ Unable to fetch logged-in user.');
      }
      const userId = authUser.id;

      // Insert into profiles (RLS safe), skip returning
      const { error: insertError } = await client
        .from('profiles')
        .insert([{
          id: userId,
          username,
          email,
          role,
          active: true
        }], { returning: 'minimal' });
      if (insertError) {
        console.error(insertError);
        return showToast('⚠️ Insert error: ' + insertError.message);
      }

      showToast('✅ Registration successful! You are now logged in.', '✅');
      window.location.href = 'index.html';
    });
  }

  // ──────────────────────────────────────────
  // Login Handler (login.html)
  // ──────────────────────────────────────────

  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async e => {
      e.preventDefault();
      const email = document.getElementById('email').value.trim().toLowerCase();
      const password = document.getElementById('password').value;

      const { data, error: loginError } = await client.auth.signInWithPassword({ email, password });
      if (loginError) {
        console.error(loginError);
        return showToast('⚠️ Login failed: ' + loginError.message);
      }

      const user = data.user;
      const { data: profile, error: profErr } = await client
        .from('profiles')
        .select('role, active')
        .eq('id', user.id)
        .single();
      if (profErr || !profile || !profile.active) {
        console.error(profErr);
        return showToast('⚠️ Your account is inactive or missing.');
      }

      window.location.href = profile.role === 'Admin' ? 'admin.html' : 'index.html';
    });
  }

  // ──────────────────────────────────────────
  // Booking Form Guard & Submission (index.html)
  // ──────────────────────────────────────────

  const bookingForm = document.getElementById('bookingForm');
  const bookingFormSection = document.getElementById('bookingFormSection');
  if (bookingForm && bookingFormSection) {
    if (!isLoggedIn) {
      bookingForm.style.display = 'none';
      showToast('🔐 Please log in to request a pitch.', '🔐');
    } else {
      bookingForm.addEventListener('submit', async e => {
        e.preventDefault();
        const pitch = document.getElementById('pitch').value;
        const date = document.getElementById('date').value;
        const time = document.getElementById('time').value;
        const endTime = document.getElementById('endTime').value;
        const team = document.getElementById('team').value;

        if (!pitch || !date || !time || !endTime || !team) {
          return showToast('⚠️ Please fill in all booking details.');
        }

        const { data: existing = [], error } = await client
          .from('bookings')
          .select('time,end_time')
          .eq('date', date)
          .eq('pitch', pitch)
          .neq('status', 'Rejected');
        if (error) {
          console.error(error);
          return showToast('⚠️ ' + error.message);
        }

        const conflict = existing.some(b =>
          !(endTime <= b.time || time >= b.end_time)
        );
        if (conflict) {
          return showToast('⚠️ That time slot is already booked.');
        }

        await client.from('bookings').insert([{
          user_id: currentUser.id,
          team,
          pitch,
          date,
          time,
          end_time: endTime,
          status: 'Pending'
        }]);
        showToast('✅ Booking request submitted and pending approval.', '✅');
        bookingForm.reset();
        if (typeof renderSlots === 'function') renderSlots();
      });
    }
  }

  // ──────────────────────────────────────────
  // Calendar Toggle & Rendering
  // ──────────────────────────────────────────

  document.querySelectorAll('#toggleCalendar').forEach(btn => {
    const section = document.getElementById('calendarSection');
    btn.addEventListener('click', () => {
      section.classList.toggle('hidden');
      btn.textContent = section.classList.contains('hidden')
        ? '📆 View Availability Calendar'
        : '📆 Hide Availability Calendar';
    });
  });

  const calendarDate = document.getElementById('calendarDate');
  const calendarPitch = document.getElementById('calendarPitch');
  const calendarGrid = document.getElementById('calendarGrid');
  if (calendarDate && calendarPitch && calendarGrid) {
    async function renderSlots() {
      calendarGrid.innerHTML = '';
      const date = calendarDate.value;
      const pitch = calendarPitch.value;

      const { data: bookings = [], error } = await client
        .from('bookings')
        .select('*')
        .eq('date', date)
        .eq('pitch', pitch)
        .neq('status', 'Rejected')
        .order('time', { ascending: true });
      if (error) return showToast('⚠️ ' + error.message);

      const parseTime = t => t.split(':').reduce((h, m) => h * 60 + Number(m), 0);
      for (let h = 8; h < 22; h++) {
        for (let m = 0; m < 60; m += 30) {
          const ts = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          const slotEl = document.createElement('div');
          slotEl.className = 'calendarSlot';

          const slotMin = parseTime(ts);
          const match = bookings.find(b => {
            const start = parseTime(b.time);
            const end = parseTime(b.end_time);
            return slotMin >= start && slotMin < end;
          });

          if (match) {
            slotEl.textContent = match.status === 'Pending' ? 'Pending' : match.team;
            slotEl.classList.add(match.status === 'Pending' ? 'pending' : 'approved');
          } else {
            slotEl.textContent = ts;
            slotEl.classList.add('available');
          }

          calendarGrid.appendChild(slotEl);
        }
      }
    }

    calendarDate.value = new Date().toISOString().slice(0, 10);
    calendarPitch.value = 'Pitch 1 - 5v5';
    calendarDate.addEventListener('change', renderSlots);
    calendarPitch.addEventListener('change', renderSlots);
    renderSlots();
  }

  // ──────────────────────────────────────────
  // My Bookings (my-bookings.html)
  // ──────────────────────────────────────────

  const myBookingRows = document.getElementById('myBookingRows');
  if (myBookingRows && currentUser) {
    async function renderMyBookings() {
      myBookingRows.innerHTML = '';
      const { data: bookings = [], error } = await client
        .from('bookings')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('date', { ascending: true });
      if (error) return showToast('⚠️ ' + error.message);

      bookings.forEach(b => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${b.pitch}</td>
          <td>${b.date}</td>
          <td>${b.time}</td>
          <td>${b.team}</td>
          <td>${b.status}</td>
          <td>${b.status === 'Pending' ? '⏳ Awaiting Approval' : ''}</td>
          <td><button class="delete-booking-btn" data-id="${b.id}">🗑 Delete</button></td>`;
        myBookingRows.appendChild(tr);
      });
    }

    await renderMyBookings();

    myBookingRows.addEventListener('click', async e => {
      if (!e.target.matches('.delete-booking-btn')) return;
      const id = e.target.dataset.id;
      await client.from('bookings').delete().eq('id', id);
      await renderMyBookings();
      if (typeof renderSlots === 'function') renderSlots();
      if (typeof renderAdminTable === 'function') renderAdminTable();
    });
  }

  // ──────────────────────────────────────────
  // Admin Calendar (admin.html)
  // ──────────────────────────────────────────

  const toggleAdminCal = document.getElementById('toggleAdminCalendar');
  const adminCalSec = document.getElementById('adminCalendarSection');
  if (toggleAdminCal && adminCalSec) {
    toggleAdminCal.addEventListener('click', () => {
      adminCalSec.classList.toggle('hidden');
      toggleAdminCal.textContent = adminCalSec.classList.contains('hidden')
        ? '📆 View All Bookings Calendar'
        : '📆 Hide All Bookings Calendar';
    });
  }

  const adminCalDate = document.getElementById('adminCalendarDate');
  const adminCalPitch = document.getElementById('adminCalendarPitch');
  const adminCalGrid = document.getElementById('adminCalendarGrid');
  if (adminCalDate && adminCalPitch && adminCalGrid) {
    async function renderAdminCalendar() {
      adminCalGrid.innerHTML = '';
      const date = adminCalDate.value;
      const pitch = adminCalPitch.value;
      let query = client
        .from('bookings')
        .select('*')
        .eq('date', date)
        .neq('status', 'Rejected')
        .order('time', { ascending: true });
      if (pitch) query = query.eq('pitch', pitch);
      const { data: bookings = [], error } = await query;
      if (error) return showToast('⚠️ ' + error.message);

      const parseTime = t => t.split(':').reduce((h, m) => h * 60 + Number(m), 0);
      for (let h = 8; h < 22; h++) {
        for (let m = 0; m < 60; m += 30) {
          const ts = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '00')}`;
          const slot = document.createElement('div');
          slot.className = 'calendarSlot';
          const min = parseTime(ts);
          const occ = bookings.find(b => {
            const s = parseTime(b.time);
            const e = parseTime(b.end_time);
            return min >= s && min < e;
          });
          if (occ) {
            slot.textContent = occ.status === 'Pending' ? 'Pending' : occ.team;
            slot.classList.add(occ.status === 'Pending' ? 'pending' : 'approved');
          } else {
            slot.textContent = ts;
            slot.classList.add('available');
          }
          adminCalGrid.appendChild(slot);
        }
      }
    }

    adminCalDate.value = new Date().toISOString().slice(0, 10);
    adminCalPitch.value = '';
    adminCalDate.addEventListener('change', renderAdminCalendar);
    adminCalPitch.addEventListener('change', renderAdminCalendar);
    renderAdminCalendar();
  }

  // ──────────────────────────────────────────
  // Admin Booking Table & Actions
  // ──────────────────────────────────────────

  const adminTable = document.getElementById('adminBookingTable');
  const filterDate = document.getElementById('filterDate');
  const filterPitch = document.getElementById('filterPitch');
  if (adminTable) {
    const tbody = adminTable.querySelector('tbody');

    async function renderAdminTable() {
      tbody.innerHTML = '';
      const df = filterDate?.value || '';
      const pf = filterPitch?.value || '';
      const { data: bookings = [], error } = await client
        .from('bookings')
        .select('*, profiles!bookings_user_id_fkey(username)')
        .order('date', { ascending: true });
      if (error) {
        console.error(error);
        return showToast('⚠️ ' + error.message);
      }
      bookings
        .filter(b => (!df || b.date === df) && (!pf || b.pitch === pf))
        .forEach(b => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${b.team}</td>
            <td>${b.pitch}</td>
            <td>${b.date}</td>
            <td>${b.time}</td>
            <td>${b.end_time}</td>
            <td>${b.profiles?.username || ''}</td>
            <td>${b.status}</td>
            <td>
              <button class="approve-btn" data-id="${b.id}">✅ Approve</button>
              <button class="reject-btn"  data-id="${b.id}">❌ Reject</button>
              <button class="delete-btn"   data-id="${b.id}">🗑 Delete</button>
            </td>`;
          tbody.appendChild(tr);
        });
    }

    tbody.addEventListener('click', async e => {
      const btn = e.target;
      if (btn.matches('.approve-btn')) {
        await client.from('bookings').update({ status: 'Approved' }).eq('id', btn.dataset.id);
        setTimeout(renderAdminTable, 100);
      }
      if (btn.matches('.reject-btn')) {
        await client.from('bookings').update({ status: 'Rejected' }).eq('id', btn.dataset.id);
        setTimeout(renderAdminTable, 100);
      }
      if (btn.matches('.delete-btn')) {
        await client.from('bookings').delete().eq('id', btn.dataset.id);
        setTimeout(renderAdminTable, 100);
      }
    });

    filterDate?.addEventListener('change', renderAdminTable);
    filterPitch?.addEventListener('change', renderAdminTable);
    renderAdminTable();
  }

  // ──────────────────────────────────────────
  // User Management Panel (admin.html)
  // ──────────────────────────────────────────

  const userTable = document.getElementById('userManagementTable');
  if (userTable) {
    const tbody = userTable.querySelector('tbody');

    async function renderUsers() {
      tbody.innerHTML = '';
      const { data: profiles = [], error } = await client
        .from('profiles')
        .select('*')
        .order('username', { ascending: true });
      if (error) {
        console.error(error);
        return showToast('⚠️ ' + error.message);
      }

      profiles.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${u.username}</td>
          <td>${u.email}</td>`
          + `<td><select class="role-select" data-id="${u.id}">
              <option value="Manager"${u.role === 'Manager' ? ' selected' : ''}>Manager</option>
              <option value="Admin"${u.role === 'Admin' ? ' selected' : ''}>Admin</option>
            </select></td>`
          + `<td><button class="toggle-active-btn" data-id="${u.id}">
              ${u.active ? 'Deactivate' : 'Activate'}
            </button></td>`
          + `<td>
             <button class="delete-user-btn" data-id="${u.id}">Delete</button>
             <button class="reset-password-btn" data-id="${u.id}" data-username="${u.username}">
               Reset Password
             </button>
           </td>`;
        tbody.appendChild(tr);
      });

      // role changes
      tbody.querySelectorAll('.role-select').forEach(sel =>
        sel.addEventListener('change', async () => {
          await client.from('profiles').update({ role: sel.value }).eq('id', sel.dataset.id);
          showToast('✅ Role updated.');
        })
      );

      // toggle active
      tbody.querySelectorAll('.toggle-active-btn').forEach(btn =>
        btn.addEventListener('click', async () => {
          const { data: [pf], error } = await client.from('profiles').select('active').eq('id', btn.dataset.id);
          if (error) {
            console.error(error);
            return showToast('⚠️ ' + error.message);
          }
          await client.from('profiles').update({ active: !pf.active }).eq('id', btn.dataset.id);
          renderUsers();
        })
      );

      // delete user
      tbody.querySelectorAll('.delete-user-btn').forEach(btn =>
        btn.addEventListener('click', async () => {
          await client.from('profiles').delete().eq('id', btn.dataset.id);
          showToast('✅ User deleted.');
          renderUsers();
        })
      );

      // reset password
      tbody.querySelectorAll('.reset-password-btn').forEach(btn =>
        btn.addEventListener('click', async () => {
          const newPass = prompt(`Enter new password for ${btn.dataset.username}:`);
          if (!newPass || newPass.length < 6) {
            return showToast('⚠️ Password must be at least 6 characters.');
          }
          await client.auth.admin.resetUserPassword(btn.dataset.id, { password: newPass });
          showToast(`✅ Password for ${btn.dataset.username} reset.`);
        })
      );
    }

    renderUsers();
  }

}); // end DOMContentLoaded