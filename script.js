// script.js

// ─────────────────────────────────────────────
// 1. Supabase Client Initialization
// ─────────────────────────────────────────────
const SUPABASE_URL     = 'https://your-project-id.supabase.co'; // ← replace
const SUPABASE_ANON_KEY = 'your-public-anon-key';               // ← replace
const supabase         = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─────────────────────────────────────────────
// 2. Auth Helpers
// ─────────────────────────────────────────────
async function checkLoginStatus() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) console.error('Session error:', error.message);
  return !!session;
}

async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) console.error('GetUser error:', error.message);
  return user;
}

async function logoutUser() {
  await supabase.auth.signOut();
  alert("You’ve been logged out.");
  window.location.href = 'login.html';
}

// ─────────────────────────────────────────────
// 3. Page Access Control (runs immediately)
// ─────────────────────────────────────────────
(async () => {
  const path = window.location.pathname.split('/').pop();
  const publicPages = ['login.html', 'register.html', ''];
  const isAdminPage = path === 'admin.html';
  const loggedIn = await checkLoginStatus();
  if (!publicPages.includes(path) && !loggedIn) {
    alert('Please log in to access this page.');
    return window.location.href = 'login.html';
  }
  if (isAdminPage && loggedIn) {
    const user = await getCurrentUser();
    const { data: meta, error } = await supabase
      .from('users')
      .select('role, active')
      .eq('id', user.id)
      .single();
    if (error || meta.role !== 'Admin' || !meta.active) {
      alert('You don’t have permission to view that page.');
      return window.location.href = 'index.html';
    }
  }
})();

// ─────────────────────────────────────────────
// 4. Main Logic on DOMContentLoaded
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const isLoggedIn = await checkLoginStatus();
  const currentUser = isLoggedIn ? await getCurrentUser() : null;

  // ──────────────────────────────────────────
  // Navbar: Toggle Login / Logout Links
  // ──────────────────────────────────────────
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
  // Auto-logout after 10 minutes inactivity
  // ──────────────────────────────────────────
  if (isLoggedIn) {
    let lastActivity = Date.now();
    const record = () => (lastActivity = Date.now());
    window.addEventListener('mousemove', record);
    window.addEventListener('keydown', record);
    setInterval(async () => {
      if (Date.now() - lastActivity > 10 * 60 * 1000) {
        await logoutUser();
      }
    }, 60 * 1000);
  }

  // ──────────────────────────────────────────
  // Register Page Logic
  // ──────────────────────────────────────────
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async e => {
      e.preventDefault();
      const username = document.getElementById('username').value.trim();
      const email    = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const role     = document.getElementById('role').value;

      if (!username || !email || !password || !role) {
        return alert('Please fill in all fields.');
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
      if (authError) return alert(authError.message);

      await supabase.from('users').insert([{
        id: authData.user.id,
        username,
        email,
        role,
        active: true
      }]);

      alert('✅ Registration successful! Please check your email.');
      window.location.href = 'login.html';
    });
  }

  // ──────────────────────────────────────────
  // Login Page Logic
  // ──────────────────────────────────────────
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async e => {
      e.preventDefault();
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;

      const { data: meta, error: lookupErr } = await supabase
        .from('users')
        .select('email, role, active')
        .eq('username', username)
        .single();
      if (lookupErr || !meta) {
        return alert('Invalid username or password.');
      }
      if (!meta.active) {
        return alert('Your account is inactive.');
      }

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email:    meta.email,
        password
      });
      if (signInErr) {
        return alert('Login failed: ' + signInErr.message);
      }

      alert(`Welcome, ${username}!`);
      window.location.href = meta.role === 'Admin' ? 'admin.html' : 'index.html';
    });
  }

  // ──────────────────────────────────────────
  // Calendar Toggle (Index & My-Bookings)
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

  // ──────────────────────────────────────────
  // Calendar Rendering (Index)
  // ──────────────────────────────────────────
  const calendarDate  = document.getElementById('calendarDate');
  const calendarPitch = document.getElementById('calendarPitch');
  const calendarGrid  = document.getElementById('calendarGrid');
  if (calendarDate && calendarPitch && calendarGrid) {
    async function renderSlots() {
      calendarGrid.innerHTML = '';
      const date  = calendarDate.value;
      const pitch = calendarPitch.value;

      const { data: bookings = [], error } = await supabase
        .from('bookings')
        .select('*')
        .eq('date', date)
        .eq('pitch', pitch)
        .neq('status', 'Rejected')
        .order('time', { ascending: true });
      if (error) return alert(error.message);

      const parseTime = t => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
      };

      for (let h = 8; h < 22; h++) {
        for (let m = 0; m < 60; m += 30) {
          const timeStr = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
          const slotMin = parseTime(timeStr);
          const slotEl  = document.createElement('div');
          slotEl.className = 'calendarSlot';

          const match = bookings.find(b => {
            const start = parseTime(b.time);
            const end   = parseTime(b.end_time);
            return slotMin >= start && slotMin < end;
          });

          if (match) {
            slotEl.textContent = match.status === 'Pending' ? 'Pending' : match.team;
            slotEl.classList.add(match.status === 'Pending' ? 'pending' : 'approved');
          } else {
            slotEl.textContent = timeStr;
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
  // Booking Form Guard & Submission (Index)
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

        const { data: existing = [] } = await supabase
          .from('bookings')
          .select('time, end_time, status')
          .eq('date', date)
          .eq('pitch', pitch)
          .neq('status', 'Rejected');
        const conflict = existing.some(b =>
          !(endTime <= b.time || time >= b.end_time)
        );
        if (conflict) {
          return alert('⚠️ That time slot is already booked.');
        }

        await supabase.from('bookings').insert([{
          user_id:  currentUser.id,
          team,
          pitch,
          date,
          time,
          end_time: endTime,
          status:   'Pending'
        }]);

        alert('✅ Booking request submitted and pending approval.');
        bookingForm.reset();
        if (typeof renderSlots === 'function') renderSlots();
      });
    }
  }

  // ──────────────────────────────────────────
  // My Bookings Table (my-bookings.html)
  // ──────────────────────────────────────────
  const myBookingRows = document.getElementById('myBookingRows');
  if (myBookingRows) {
    const { data: bookings = [], error } = await supabase
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
  // Admin Calendar Toggle & Render (admin.html)
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

      const { data: bookings = [], error } = await supabase
        .from('bookings')
        .select('*')
        .eq('date', date)
        .eq('pitch', pitch)
        .neq('status', 'Rejected')
        .order('time', { ascending: true });
      if (error) return console.error(error);

      const parseTime = t => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
      };

      for (let h = 8; h < 22; h++) {
        for (let m = 0; m < 60; m += 30) {
          const ts  = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
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
  // Admin Bookings Table & Actions (admin.html)
  // ──────────────────────────────────────────
  const adminTable  = document.getElementById('adminBookingTable');
  const filterDate  = document.getElementById('filterDate');
  const filterPitch = document.getElementById('filterPitch');
  if (adminTable) {
    const tbody = adminTable.querySelector('tbody');
    async function renderAdminTable() {
      tbody.innerHTML = '';
      const dateFilter  = filterDate?.value || '';
      const pitchFilter = filterPitch?.value || '';

      const { data: bookings = [], error } = await supabase
        .from('bookings')
        .select('*')
        .order('date', { ascending: true });
      if (error) return console.error(error);

      bookings
        .filter(b => (!dateFilter || b.date === dateFilter) && (!pitchFilter || b.pitch === pitchFilter))
        .forEach(b => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${b.team}</td>
            <td>${b.pitch}</td>
            <td>${b.date}</td>
            <td>${b.time}</td>
            <td>${b.end_time}</td>
            <td>${b.user_id}</td>
            <td>${b.status}</td>
            <td>
              <button class="approve-btn" data-id="${b.id}">✅ Approve</button>
              <button class="reject-btn" data-id="${b.id}">❌ Reject</button>
              <button class="delete-btn"  data-id="${b.id}">🗑 Delete</button>
            </td>`;
          tbody.appendChild(tr);
        });

      tbody.querySelectorAll('.approve-btn').forEach(btn =>
        btn.addEventListener('click', async () => {
          await supabase.from('bookings').update({ status: 'Approved' }).eq('id', btn.dataset.id);
          renderAdminTable();
        })
      );
      tbody.querySelectorAll('.reject-btn').forEach(btn =>
        btn.addEventListener('click', async () => {
          await supabase.from('bookings').update({ status: 'Rejected' }).eq('id', btn.dataset.id);
          renderAdminTable();
        })
      );
      tbody.querySelectorAll('.delete-btn').forEach(btn =>
        btn.addEventListener('click', async () => {
          await supabase.from('bookings').delete().eq('id', btn.dataset.id);
          renderAdminTable();
        })
      );
    }

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
      const { data: users = [], error } = await supabase
        .from('users')
        .select('*')
        .order('username', { ascending: true });
      if (error) return console.error(error);

      users.forEach(u => {
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

      tbody.querySelectorAll('.role-select').forEach(sel =>
        sel.addEventListener('change', async () => {
          await supabase.from('users').update({ role: sel.value }).eq('id', sel.dataset.id);
          alert('Role updated.');
        })
      );

      tbody.querySelectorAll('.toggle-active-btn').forEach(btn =>
        btn.addEventListener('click', async () => {
          const { data: [usr] } = await supabase.from('users').select('active').eq('id', btn.dataset.id);
          await supabase.from('users').update({ active: !usr.active }).eq('id', btn.dataset.id);
          renderUsers();
        })
      );

      tbody.querySelectorAll('.delete-user-btn').forEach(btn =>
        btn.addEventListener('click', async () => {
          await supabase.from('users').delete().eq('id', btn.dataset.id);
          renderUsers();
        })
      );

      tbody.querySelectorAll('.reset-password-btn').forEach(btn =>
        btn.addEventListener('click', async () => {
          const newPass = prompt(`Enter new password for ${btn.dataset.username}:`);
          if (!newPass || newPass.length < 6) {
            return alert('Password must be at least 6 characters.');
          }
          // Use Supabase Admin API or custom RPC to reset
          await supabase.auth.admin.resetUserPassword(btn.dataset.id, { password: newPass });
          alert(`✅ Password for ${btn.dataset.username} reset.`);
        })
      );
    }

    renderUsers();
  }

}); // end DOMContentLoaded