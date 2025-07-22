// script.js

// ─────────────────────────────────────────────
// 1. Supabase Client Initialization
// ─────────────────────────────────────────────
const SUPABASE_URL      = 'https://huwqxkpovijdowetihrj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1d3F4a3BvdmlqZG93ZXRpaHJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3ODEyNzksImV4cCI6MjA2ODM1NzI3OX0.RT1QbJjmGEL4HfrOJl53mZbAcgHRfMaDKcNN1Lsl404'; // truncated
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
    setTimeout(() => window.location.href = 'login.html', 1000);
  })();
}

// ─────────────────────────────────────────────
// 4. Page Access Control
// ─────────────────────────────────────────────
(async () => {
  const path = window.location.pathname.split('/').pop();
  const publicPages = ['', 'index.html', 'login.html', 'register.html', 'logout.html'];
  const isAdminPage  = path === 'admin.html';
  const isMyBookings = path === 'my-bookings.html';
  const loggedIn     = await checkLoginStatus();

  if (!publicPages.includes(path) && !loggedIn) {
    alert('Please log in to access this page.');
    return (window.location.href = 'login.html');
  }

  if (isAdminPage && loggedIn) {
    const user = await getCurrentUser();
    // now querying profiles instead of users
    const { data: profile, error } = await client
      .from('profiles')
      .select('role, active')
      .eq('id', user.id)
      .single();
    if (error || !profile || !profile.active || profile.role !== 'Admin') {
      alert('You don’t have permission to view that page.');
      return (window.location.href = 'index.html');
    }
  }

  if (isMyBookings && !loggedIn) {
    alert('Please log in to view your bookings.');
    return (window.location.href = 'login.html');
  }
})();

// ─────────────────────────────────────────────
// 5. Main Logic on DOMContentLoaded
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const isLoggedIn  = await checkLoginStatus();
  const currentUser = isLoggedIn ? await getCurrentUser() : null;

  // Navbar: Toggle Login / Logout Links
  const loginLink  = document.getElementById('loginLink');
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
      const role     = document.getElementById('role').value;
      const email    = emailRaw.toLowerCase();

      if (!username || !email || !password || !role) {
        return alert('Please fill in all fields.');
      }

      // duplicate check against profiles now
      const { data: existing = [], error: dupErr } = await client
        .from('profiles')
        .select('id')
        .eq('email', email);
      if (dupErr) return alert('Error checking for duplicates.');
      if (existing.length > 0) {
        return alert('⚠️ This email is already registered. Try logging in instead.');
      }

      // Create Supabase Auth account
      const { data: signUpData, error: signUpError } = await client.auth.signUp({ email, password });
      if (signUpError) return alert('Auth error: ' + signUpError.message);

      const userId = signUpData.user?.id;
      if (!userId) return alert('Unable to retrieve user ID.');

      // insert into profiles instead of users
      const { error: insertError } = await client
        .from('profiles')
        .insert([{
          id:       userId,
          username,
          email,
          role,
          active:   true
        }]);
      if (insertError) return alert('Insert error: ' + insertError.message);

      alert('✅ Registration successful! Please check your email for verification.');
      window.location.href = 'login.html';
    });
  }

  // ──────────────────────────────────────────
  // Login Handler (login.html)
  // ──────────────────────────────────────────
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async e => {
      e.preventDefault();
      const email    = document.getElementById('email').value.trim().toLowerCase();
      const password = document.getElementById('password').value;

      const { data, error: loginError } = await client.auth.signInWithPassword({ email, password });
      if (loginError) return alert('Login failed: ' + loginError.message);

      const user = data.user;
      // fetch role/active from profiles now
      const { data: profile, error: profErr } = await client
        .from('profiles')
        .select('role, active')
        .eq('id', user.id)
        .single();
      if (profErr || !profile || !profile.active) {
        return alert('Your account is inactive or missing.');
      }

      window.location.href = profile.role === 'Admin' ? 'admin.html' : 'index.html';
    });
  }

  // ──────────────────────────────────────────
  // Booking Form Guard & Submission (index.html)
  // ──────────────────────────────────────────
  const bookingForm        = document.getElementById('bookingForm');
  const bookingFormSection = document.getElementById('bookingFormSection');
  if (bookingForm && bookingFormSection) {
    if (!isLoggedIn) {
      bookingForm.style.display = 'none';
      const note = document.createElement('p');
      note.className   = 'login-note';
      note.textContent = 'Please log in to request a pitch.';
      bookingFormSection.appendChild(note);
    } else {
      bookingForm.addEventListener('submit', async e => {
        e.preventDefault();
        const pitch   = document.getElementById('pitch').value;
        const date    = document.getElementById('date').value;
        const time    = document.getElementById('time').value;
        const endTime = document.getElementById('endTime').value;
        const team    = document.getElementById('team').value;

        if (!pitch || !date || !time || !endTime || !team) {
          return alert('Please fill in all booking details.');
        }

        // Check for conflicts
        const { data: existing = [], error } = await client
          .from('bookings')
          .select('time,end_time')
          .eq('date', date)
          .eq('pitch', pitch)
          .neq('status', 'Rejected');
        if (error) return alert(error.message);

        const conflict = existing.some(b =>
          !(endTime <= b.time || time >= b.end_time)
        );
        if (conflict) {
          return alert('⚠️ That time slot is already booked.');
        }

        // Insert booking
        await client.from('bookings').insert([{
          user_id:   currentUser.id,
          team,
          pitch,
          date,
          time,
          end_time:  endTime,
          status:    'Pending'
        }]);

        alert('✅ Booking request submitted and pending approval.');
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

  const calendarDate  = document.getElementById('calendarDate');
  const calendarPitch = document.getElementById('calendarPitch');
  const calendarGrid  = document.getElementById('calendarGrid');
  if (calendarDate && calendarPitch && calendarGrid) {
    async function renderSlots() {
      calendarGrid.innerHTML = '';
      const date  = calendarDate.value;
      const pitch = calendarPitch.value;

      const { data: bookings = [], error } = await client
        .from('bookings')
        .select('*')
        .eq('date', date)
        .eq('pitch', pitch)
        .neq('status', 'Rejected')
        .order('time', { ascending: true });
      if (error) return alert(error.message);

      const parseTime = t => t.split(':').reduce((h, m) => h * 60 + Number(m), 0);

      for (let h = 8; h < 22; h++) {
        for (let m = 0; m < 60; m += 30) {
          const ts     = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          const slotEl = document.createElement('div');
          slotEl.className = 'calendarSlot';

          const slotMin = parseTime(ts);
          const match   = bookings.find(b => {
            const start = parseTime(b.time);
            const end   = parseTime(b.end_time);
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

    calendarDate.value  = new Date().toISOString().slice(0,10);
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
    const { data: bookings = [], error } = await client
      .from('bookings')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('date', { ascending: true });
    if (error) return alert(error.message);

    bookings.forEach(b => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${b.pitch}</td>
        <td>${b.date}</td>
        <td>${b.time}</td>
        <td>${b.team}</td>
        <td>${b.status}</td>
        <td>${b.status === 'Pending' ? '⏳ Awaiting Approval' : ''}</td>
      `;
      myBookingRows.appendChild(tr);
    });
  }

  // ──────────────────────────────────────────
  // Admin Calendar (admin.html)
  // ──────────────────────────────────────────
  const toggleAdminCal = document.getElementById('toggleAdminCalendar');
  const adminCalSec    = document.getElementById('adminCalendarSection');
  if (toggleAdminCal && adminCalSec) {
    toggleAdminCal.addEventListener('click', () => {
      adminCalSec.classList.toggle('hidden');
      toggleAdminCal.textContent = adminCalSec.classList.contains('hidden')
        ? '📆 View All Bookings Calendar'
        : '📆 Hide All Bookings Calendar';
    });
  }

  const adminCalDate  = document.getElementById('adminCalendarDate');
  const adminCalPitch = document.getElementById('adminCalendarPitch');
  const adminCalGrid  = document.getElementById('adminCalendarGrid');
  if (adminCalDate && adminCalPitch && adminCalGrid) {
    async function renderAdminCalendar() {
      adminCalGrid.innerHTML = '';
      const date  = adminCalDate.value;
      const pitch = adminCalPitch.value;

      let query = client
        .from('bookings')
        .select('*')
        .eq('date', date)
        .neq('status', 'Rejected')
        .order('time', { ascending: true });

      if (pitch) query = query.eq('pitch', pitch);

      const { data: bookings = [], error } = await query;
      if (error) return console.error('Calendar query error:', error);

      const parseTime = t => t.split(':').reduce((h, m) => h * 60 + Number(m), 0);

      for (let h = 8; h < 22; h++) {
        for (let m = 0; m < 60; m += 30) {
          const ts   = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
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

    adminCalDate.value  = new Date().toISOString().slice(0,10);
    adminCalPitch.value = '';
    adminCalDate.addEventListener('change', renderAdminCalendar);
    adminCalPitch.addEventListener('change', renderAdminCalendar);
    renderAdminCalendar();
  }

  // ──────────────────────────────────────────
  // Admin Booking Table & Actions
  // ──────────────────────────────────────────
  const adminTable  = document.getElementById('adminBookingTable');
  const filterDate  = document.getElementById('filterDate');
  const filterPitch = document.getElementById('filterPitch');
  if (adminTable) {
    const tbody = adminTable.querySelector('tbody');

    async function renderAdminTable() {
      tbody.innerHTML = '';
      const df = filterDate?.value || '';
      const pf = filterPitch?.value || '';

      const { data: bookings = [], error } = await client
        .from('bookings')
        // explicit join syntax using the FK constraint
        .select('*, profiles!bookings_user_id_fkey(username)')
        .order('date', { ascending: true });
      if (error) return console.error('Table query error:', error);

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

    // Event delegation for Approve/Reject/Delete
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
      // fetch from profiles instead of users
      const { data: profiles = [], error } = await client
        .from('profiles')
        .select('*')
        .order('username', { ascending: true });
      if (error) return console.error('Profiles query error:', error);

      profiles.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${u.username}</td>
          <td>${u.email}</td>
          <td>
            <select class="role-select" data-id="${u.id}">
              <option value="Manager"${u.role==='Manager'?' selected':''}>Manager</option>
              <option value="Admin"${u.role==='Admin'?' selected':''}>Admin</option>
            </select>
          </td>
          <td>
            <button class="toggle-active-btn" data-id="${u.id}">
              ${u.active ? 'Deactivate' : 'Activate'}
            </button>
          </td>
          <td>
            <button class="delete-user-btn" data-id="${u.id}">Delete</button>
            <button class="reset-password-btn" data-id="${u.id}" data-username="${u.username}">
              Reset Password
            </button>
          </td>`;
        tbody.appendChild(tr);
      });

      // Role change
      tbody.querySelectorAll('.role-select').forEach(sel =>
        sel.addEventListener('change', async () => {
          await client.from('profiles').update({ role: sel.value }).eq('id', sel.dataset.id);
          alert('Role updated.');
        })
      );

      // Toggle active
      tbody.querySelectorAll('.toggle-active-btn').forEach(btn =>
        btn.addEventListener('click', async () => {
          const { data: [pf], error } = await client.from('profiles').select('active').eq('id', btn.dataset.id);
          if (error) return console.error('Toggle active error:', error);
          await client.from('profiles').update({ active: !pf.active }).eq('id', btn.dataset.id);
          renderUsers();
        })
      );

      // Delete profile
      tbody.querySelectorAll('.delete-user-btn').forEach(btn =>
        btn.addEventListener('click', async () => {
          await client.from('profiles').delete().eq('id', btn.dataset.id);
          renderUsers();
        })
      );

      // Reset password (Supabase Auth)
      tbody.querySelectorAll('.reset-password-btn').forEach(btn =>
        btn.addEventListener('click', async () => {
          const newPass = prompt(`Enter new password for ${btn.dataset.username}:`);
          if (!newPass || newPass.length < 6) {
            return alert('Password must be at least 6 characters.');
          }
          await client.auth.admin.resetUserPassword(btn.dataset.id, { password: newPass });
          alert(`✅ Password for ${btn.dataset.username} reset.`);
        })
      );
    }

    renderUsers();
  }
}); // end DOMContentLoaded