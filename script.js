// script.js

// ─────────────────────────────────────────────
// 1. Supabase Initialization
// ─────────────────────────────────────────────
const SUPABASE_URL     = 'https://YOUR-PROJECT-ID.supabase.co';   // ← replace with your Project URL
const SUPABASE_ANON_KEY = 'YOUR-PUBLIC-ANON-KEY';                 // ← replace with your anon public key
const supabase         = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─────────────────────────────────────────────
// 2. AUTHENTICATION & PAGE-ACCESS GUARD
// ─────────────────────────────────────────────

/**
 * Returns true if a Supabase session is active.
 */
async function checkLoginStatus() {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
}

/**
 * Returns the current Supabase user object.
 */
async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * Signs out, alerts the user, and redirects to login.
 */
async function logoutUser() {
  await supabase.auth.signOut();
  alert("You've been logged out.");
  window.location.href = 'login.html';
}

/**
 * Immediately enforce access rules on page load.
 */
(async function enforcePageAccess() {
  const path = window.location.pathname.split('/').pop();
  const isAuthPage = ['login.html', 'register.html'].includes(path);

  // Redirect unauthenticated users
  if (!isAuthPage && !(await checkLoginStatus())) {
    alert('Please log in to access this page.');
    return window.location.href = 'login.html';
  }

  // Admin-only guard
  if (path === 'admin.html') {
    const user = await getCurrentUser();
    if (user?.role !== 'Admin') {
      alert("You don't have permission to view that page.");
      return window.location.href = 'index.html';
    }
  }
})();

// ─────────────────────────────────────────────
// 3. AUTO LOGOUT AFTER 10 MINUTES INACTIVITY
// ─────────────────────────────────────────────
(async function setupAutoLogout() {
  if (!(await checkLoginStatus())) return;

  let lastActivity = Date.now();
  const recordActivity = () => (lastActivity = Date.now());
  window.addEventListener('mousemove', recordActivity);
  window.addEventListener('keydown', recordActivity);

  setInterval(async () => {
    if (Date.now() - lastActivity > 10 * 60 * 1000) {
      await logoutUser();
    }
  }, 60 * 1000);
})();

// ─────────────────────────────────────────────
// 4. MAIN LOGIC (runs on every page)
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // ──────────────────────────────────────────
  // 4.1 Navbar: Toggle Login/Logout Links
  // ──────────────────────────────────────────
  const loginLink  = document.getElementById('loginLink');
  const logoutLink = document.getElementById('logoutLink');

  (async () => {
    const loggedIn = await checkLoginStatus();
    if (loginLink && logoutLink) {
      loginLink.classList.toggle('hidden', loggedIn);
      logoutLink.classList.toggle('hidden', !loggedIn);
      logoutLink.addEventListener('click', e => {
        e.preventDefault();
        logoutUser();
      });
    }
  })();

  // ──────────────────────────────────────────
  // 4.2 Register Page Logic (register.html)
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

      // 1) Sign up via Supabase Auth
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password
      });
      if (signUpError) return alert(signUpError.message);

      // 2) Insert profile record into users table
      const { error: insertError } = await supabase
        .from('users')
        .insert([{ 
          id:       signUpData.user.id, 
          username, 
          email, 
          role 
        }]);
      if (insertError) return alert(insertError.message);

      alert('Registration successful! Please check your email to confirm.');
      window.location.href = 'login.html';
    });
  }

  // ──────────────────────────────────────────
  // 4.3 Login Page Logic (login.html)
  // ──────────────────────────────────────────
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async e => {
      e.preventDefault();

      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;

      // 1) Fetch user record by username to get email & role
      const { data: userRecord, error: lookupError } = await supabase
        .from('users')
        .select('email, role')
        .eq('username', username)
        .single();
      if (lookupError || !userRecord) {
        return alert('Invalid username or user does not exist.');
      }

      // 2) Sign in with email & password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email:    userRecord.email,
        password
      });
      if (signInError) return alert(signInError.message);

      // 3) Redirect based on role
      if (userRecord.role === 'Admin') {
        window.location.href = 'admin.html';
      } else {
        window.location.href = 'index.html';
      }
    });
  }

  // ──────────────────────────────────────────
  // 4.4 Booking Form (index.html)
  // ──────────────────────────────────────────
  const bookingForm = document.getElementById('bookingForm');
  if (bookingForm) {
    bookingForm.addEventListener('submit', async e => {
      e.preventDefault();

      const user = await getCurrentUser();
      if (!user) return alert('Please log in to submit a booking.');

      const payload = {
        user_id:  user.id,
        pitch:    document.getElementById('pitch').value,
        date:     document.getElementById('date').value,
        time:     document.getElementById('time').value,
        end_time: document.getElementById('endTime').value,
        team:     document.getElementById('team').value,
        status:   'Pending'
      };

      const { error } = await supabase.from('bookings').insert([payload]);
      if (error) return alert(error.message);

      alert('✅ Booking submitted and is pending approval.');
      bookingForm.reset();
      loadCalendar();  // refresh calendar if visible
    });
  }

  // ──────────────────────────────────────────
  // 4.5 Toggle Availability Calendar
  // ──────────────────────────────────────────
  document.querySelectorAll('#toggleCalendar, #toggleAdminCalendar')
    .forEach(btn =>
      btn.addEventListener('click', () => {
        const target = btn.id === 'toggleCalendar'
          ? document.getElementById('calendarSection')
          : document.getElementById('adminCalendarSection');
        target.classList.toggle('hidden');
      })
    );

  // ──────────────────────────────────────────
  // 4.6 Calendar Loader (index & my-bookings)
  // ──────────────────────────────────────────
  async function loadCalendar() {
    const dateInput  = document.getElementById('calendarDate');
    const pitchInput = document.getElementById('calendarPitch');
    if (!dateInput || !pitchInput) return;

    const date  = dateInput.value;
    const pitch = pitchInput.value;
    if (!date || !pitch) return;

    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('*')
      .eq('date', date)
      .eq('pitch', pitch)
      .order('time', { ascending: true });

    if (error) return alert(error.message);

    const grid = document.querySelector('#calendarGrid, #adminCalendarGrid');
    if (!grid) return;
    grid.innerHTML = '';

    bookings.forEach(b => {
      const slot = document.createElement('div');
      slot.className = 'calendar-slot';
      slot.textContent = `${b.time}–${b.end_time} : ${b.team} (${b.status})`;
      grid.appendChild(slot);
    });
  }

  // Hook calendar inputs
  document.querySelectorAll('#calendarDate, #adminCalendarDate').forEach(i =>
    i.addEventListener('change', loadCalendar)
  );
  document.querySelectorAll('#calendarPitch, #adminCalendarPitch').forEach(i =>
    i.addEventListener('change', loadCalendar)
  );

  // ──────────────────────────────────────────
  // 4.7 My Bookings Page (my-bookings.html)
  // ──────────────────────────────────────────
  const myBookingRows = document.getElementById('myBookingRows');
  if (myBookingRows) {
    (async () => {
      const user = await getCurrentUser();
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('user_id', user.id)
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
          <td>
            ${b.status === 'Pending'
              ? `<button class="cancel-btn" data-id="${b.id}">Cancel</button>`
              : ''}
          </td>`;
        myBookingRows.appendChild(tr);
      });

      // Cancel booking
      document.querySelectorAll('.cancel-btn').forEach(btn =>
        btn.addEventListener('click', async () => {
          await supabase.from('bookings').delete().eq('id', btn.dataset.id);
          btn.closest('tr').remove();
        })
      );
    })();
  }

  // ──────────────────────────────────────────
  // 4.8 Admin Dashboard (admin.html)
  // ──────────────────────────────────────────
  const adminBookingBody = document.querySelector('#adminBookingTable tbody');
  if (adminBookingBody) {
    (async () => {
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('*')
        .order('date', { ascending: true });

      if (error) return alert(error.message);

      bookings.forEach(b => {
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
            <button class="approve-btn" data-id="${b.id}">Approve</button>
            <button class="reject-btn" data-id="${b.id}">Reject</button>
            <button class="delete-btn"  data-id="${b.id}">Delete</button>
          </td>`;
        adminBookingBody.appendChild(tr);
      });

      // Approve / Reject / Delete actions
      document.querySelectorAll('.approve-btn').forEach(btn =>
        btn.addEventListener('click', async () => {
          await supabase.from('bookings')
            .update({ status: 'Approved' })
            .eq('id', btn.dataset.id);
          window.location.reload();
        })
      );
      document.querySelectorAll('.reject-btn').forEach(btn =>
        btn.addEventListener('click', async () => {
          await supabase.from('bookings')
            .update({ status: 'Rejected' })
            .eq('id', btn.dataset.id);
          window.location.reload();
        })
      );
      document.querySelectorAll('.delete-btn').forEach(btn =>
        btn.addEventListener('click', async () => {
          await supabase.from('bookings')
            .delete()
            .eq('id', btn.dataset.id);
          window.location.reload();
        })
      );
    })();
  }

  // ──────────────────────────────────────────
  // 4.9 User Management (admin.html)
  // ──────────────────────────────────────────
  const userMgmtBody = document.querySelector('#userManagementTable tbody');
  if (userMgmtBody) {
    (async () => {
      const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .order('username', { ascending: true });

      if (error) return alert(error.message);

      users.forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${u.username}</td>
          <td>${u.email}</td>
          <td>
            <select class="role-select" data-id="${u.id}">
              <option ${u.role === 'Manager' ? 'selected' : ''}>Manager</option>
              <option ${u.role === 'Admin'   ? 'selected' : ''}>Admin</option>
            </select>
          </td>
          <td>
            <button class="toggle-active-btn" data-id="${u.id}">
              ${u.active ? 'Deactivate' : 'Activate'}
            </button>
          </td>
          <td>
            <button class="reset-password-btn" data-id="${u.id}">
              Reset Password
            </button>
          </td>`;
        userMgmtBody.appendChild(tr);
      });

      // Change role
      document.querySelectorAll('.role-select').forEach(sel =>
        sel.addEventListener('change', async () => {
          await supabase.from('users')
            .update({ role: sel.value })
            .eq('id', sel.dataset.id);
          alert('Role updated.');
        })
      );

      // Toggle active status
      document.querySelectorAll('.toggle-active-btn').forEach(btn =>
        btn.addEventListener('click', async () => {
          const { data: [user] } = await supabase
            .from('users')
            .select('active')
            .eq('id', btn.dataset.id);
          await supabase.from('users')
            .update({ active: !user.active })
            .eq('id', btn.dataset.id);
          window.location.reload();
        })
      );

      // Reset Password (simple prompt; requires backend support)
      document.querySelectorAll('.reset-password-btn').forEach(btn =>
        btn.addEventListener('click', () => {
          const newPass = prompt('Enter new password:');
          if (!newPass) return;
          // NOTE: resetting a user's password via anon key is not supported.
          // You must implement a server-side function or use Supabase Admin API.
          alert('Password reset must be done via Admin API on the server.');
        })
      );
    })();
  }

}); // end DOMContentLoaded