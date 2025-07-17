// ─────────────────────────────────────────────
// 🔐 AUTHENTICATION & DEFAULT ADMIN SETUP
// ─────────────────────────────────────────────
function checkLoginStatus() {
  return localStorage.getItem("isLoggedIn") === "true";
}

function getCurrentUser() {
  return JSON.parse(localStorage.getItem("currentUser") || "{}");
}

function logoutUser() {
  localStorage.removeItem("isLoggedIn");
  localStorage.removeItem("currentUser");
  alert("You’ve been logged out.");
  window.location.href = "login.html";
}

(function initDefaultAdmin() {
  const users = JSON.parse(localStorage.getItem("users")) || [];
  if (!users.some(u => u.role === "Admin")) {
    users.unshift({
      username: "admin",
      email: "admin@bugbrooke.com",
      password: "YourSecurePass123",
      role: "Admin",
      active: true
    });
    localStorage.setItem("users", JSON.stringify(users));
  }
})();

// ─────────────────────────────────────────────
// 🚧 PAGE ACCESS CONTROL
// ─────────────────────────────────────────────
(function enforcePageAccess() {
  const path = window.location.pathname;
  const isAuthPage = path.endsWith("login.html") || path.endsWith("register.html");
  if (!isAuthPage && !checkLoginStatus()) {
    alert("Please log in to access this page.");
    window.location.href = "login.html";
    return;
  }
  if (path.endsWith("admin.html")) {
    const user = getCurrentUser();
    if (user.role !== "Admin") {
      alert("You don’t have permission to view that page.");
      window.location.href = "index.html";
    }
  }
})();

// ─────────────────────────────────────────────
// ⏲️ AUTO LOGOUT AFTER 10 MINUTES INACTIVITY
// ─────────────────────────────────────────────
if (checkLoginStatus()) {
  let lastActivity = Date.now();
  const recordActivity = () => (lastActivity = Date.now());
  window.addEventListener("mousemove", recordActivity);
  window.addEventListener("keydown", recordActivity);
  setInterval(() => {
    if (Date.now() - lastActivity > 10 * 60 * 1000) {
      logoutUser();
    }
  }, 60 * 1000);
}

// ─────────────────────────────────────────────
// 🎯 MAIN LOGIC ON DOM CONTENT LOADED
// ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", function() {

  // ──────────────────────────────────────────
  // 🔄 NAVBAR LOGIN / LOGOUT TOGGLE
  // ──────────────────────────────────────────
  const loginLink = document.getElementById("loginLink");
  const logoutLink = document.getElementById("logoutLink");
  if (loginLink && logoutLink) {
    if (checkLoginStatus()) {
      loginLink.classList.add("hidden");
      logoutLink.classList.remove("hidden");
      logoutLink.addEventListener("click", e => {
        e.preventDefault();
        logoutUser();
      });
    } else {
      loginLink.classList.remove("hidden");
      logoutLink.classList.add("hidden");
    }
  }

  // ──────────────────────────────────────────
  // 🆕 ROLE-BASED REGISTRATION (register.html)
  // ──────────────────────────────────────────
  const registerForm = document.getElementById("registerForm");
  if (registerForm) {
    registerForm.addEventListener("submit", function(e) {
      e.preventDefault();
      const username = document.getElementById("username").value.trim();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      const role = document.getElementById("role").value;
      if (!username || !email || !password || !role) {
        alert("Please fill in all fields.");
        return;
      }
      const users = JSON.parse(localStorage.getItem("users")) || [];
      if (users.some(u => u.username === username)) {
        alert("Username already exists.");
        return;
      }
      users.push({ username, email, password, role, active: true });
      localStorage.setItem("users", JSON.stringify(users));
      alert("Registration successful. You can now log in.");
      window.location.href = "login.html";
    });
  }

  // ──────────────────────────────────────────
  // 🔐 LOGIN HANDLER (login.html)
  // ──────────────────────────────────────────
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", function(e) {
      e.preventDefault();
      const username = document.getElementById("username").value.trim();
      const password = document.getElementById("password").value;
      const users = JSON.parse(localStorage.getItem("users")) || [];
      const user = users.find(u => u.username === username && u.password === password);
      if (!user) {
        alert("Invalid username or password.");
        return;
      }
      if (!user.active) {
        alert("Your account is inactive.");
        return;
      }
      localStorage.setItem("isLoggedIn", "true");
      localStorage.setItem("currentUser", JSON.stringify(user));
      alert(`Welcome, ${user.username}!`);
      window.location.href = user.role === "Admin" ? "admin.html" : "index.html";
    });
  }

  // ──────────────────────────────────────────
  // 📆 COLLAPSIBLE CALENDAR TOGGLE (index.html, my-bookings.html)
  // ──────────────────────────────────────────
  document.querySelectorAll("#toggleCalendar").forEach(btn => {
    const section = document.getElementById("calendarSection");
    if (btn && section) {
      btn.addEventListener("click", function() {
        section.classList.toggle("hidden");
        btn.textContent = section.classList.contains("hidden")
          ? "📆 View Availability Calendar"
          : "📆 Hide Availability Calendar";
      });
    }
  });

  // ──────────────────────────────────────────
  // 📅 CALENDAR RENDERING (index.html)
  // ──────────────────────────────────────────
  const calendarDate = document.getElementById("calendarDate");
  const calendarPitch = document.getElementById("calendarPitch");
  const calendarGrid = document.getElementById("calendarGrid");
  if (calendarDate && calendarPitch && calendarGrid) {
    const bookings = JSON.parse(localStorage.getItem("bookings")) || [];
    const parseTime = t => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    const renderSlots = () => {
      calendarGrid.innerHTML = "";
      const selDate = calendarDate.value;
      const selPitch = calendarPitch.value;
      for (let h = 8; h < 22; h++) {
        for (let m = 0; m < 60; m += 30) {
          const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
          const slotMin = parseTime(timeStr);
          const slotEl = document.createElement("div");
          slotEl.className = "calendarSlot";
          const match = bookings.find(b => {
            if (
              b.pitch !== selPitch ||
              b.date  !== selDate  ||
              b.status === "Rejected"
            ) return false;
            const start = parseTime(b.time);
            const end   = parseTime(b.endTime);
            return slotMin >= start && slotMin < end;
          });
          if (match) {
            slotEl.textContent = match.status === "Pending" ? "Pending" : match.team;
            slotEl.classList.add(match.status === "Pending" ? "pending" : "approved");
          } else {
            slotEl.textContent = timeStr;
            slotEl.classList.add("available");
          }
          calendarGrid.appendChild(slotEl);
        }
      }
    };
    calendarDate.value = new Date().toISOString().slice(0, 10);
    calendarPitch.value = "Pitch 1 - 5v5";
    calendarDate.addEventListener("change", renderSlots);
    calendarPitch.addEventListener("change", renderSlots);
    renderSlots();
  }

  // ──────────────────────────────────────────
  // 🛡️ BOOKING FORM ENFORCEMENT & SUBMISSION (index.html)
  // ──────────────────────────────────────────
  const bookingForm        = document.getElementById("bookingForm");
  const bookingFormSection = document.getElementById("bookingFormSection");
  if (bookingForm && bookingFormSection) {
    if (!checkLoginStatus()) {
      bookingForm.style.display = "none";
      const note = document.createElement("p");
      note.className   = "login-note";
      note.textContent = "Please log in to request a pitch.";
      bookingFormSection.appendChild(note);
    }
    bookingForm.addEventListener("submit", function(e) {
      e.preventDefault();
      if (!checkLoginStatus()) {
        alert("❌ You must be logged in to submit a booking.");
        return;
      }
      const currentUser = getCurrentUser();
      const pitch   = document.getElementById("pitch").value;
      const date    = document.getElementById("date").value;
      const time    = document.getElementById("time").value;
      const endTime = document.getElementById("endTime").value;
      const team    = document.getElementById("team").value;
      if (!pitch || !date || !time || !endTime || !team) {
        alert("Please fill in all booking details.");
        return;
      }
      const bookings = JSON.parse(localStorage.getItem("bookings")) || [];
      const conflict = bookings.some(b =>
        b.pitch === pitch &&
        b.date  === date  &&
        !(endTime <= b.time || time >= b.endTime) &&
        b.status !== "Rejected"
      );
      if (conflict) {
        alert("⚠️ That time slot is already booked.");
        return;
      }
      bookings.push({
        username: currentUser.username,
        team,
        pitch,
        date,
        time,
        endTime,
        status: "Pending"
      });
      localStorage.setItem("bookings", JSON.stringify(bookings));
      alert("✅ Booking request submitted and pending approval.");
      bookingForm.reset();
    });
  }

  // ──────────────────────────────────────────
  // 🗂️ MY BOOKINGS RENDER (my-bookings.html)
  // ──────────────────────────────────────────
  const myBookingRows = document.getElementById("myBookingRows");
  if (myBookingRows) {
    const all  = JSON.parse(localStorage.getItem("bookings")) || [];
    const user = getCurrentUser();
    const mine = all.filter(b => b.username === user.username);
    myBookingRows.innerHTML = "";
    mine.forEach(b => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${b.pitch}</td>
        <td>${b.date}</td>
        <td>${b.time} – ${b.endTime}</td>
        <td>${b.team}</td>
        <td>${b.status}</td>
        <td>${b.status === "Pending" ? "⏳ Awaiting Approval" : ""}</td>
      `;
      myBookingRows.appendChild(tr);
    });
  }

  // ──────────────────────────────────────────
  // 📊 ADMIN CALENDAR TOGGLE & RENDER (admin.html)
  // ──────────────────────────────────────────
  const toggleAdminCal = document.getElementById("toggleAdminCalendar");
  const adminCalSec    = document.getElementById("adminCalendarSection");
  if (toggleAdminCal && adminCalSec) {
    toggleAdminCal.addEventListener("click", function() {
      adminCalSec.classList.toggle("hidden");
      toggleAdminCal.textContent = adminCalSec.classList.contains("hidden")
        ? "📆 View All Bookings Calendar"
        : "📆 Hide All Bookings Calendar";
    });
  }
  const adminCalDate  = document.getElementById("adminCalendarDate");
  const adminCalPitch = document.getElementById("adminCalendarPitch");
  const adminCalGrid  = document.getElementById("adminCalendarGrid");
  if (adminCalDate && adminCalPitch && adminCalGrid) {
    const bookings = JSON.parse(localStorage.getItem("bookings")) || [];
    const parseTime = t => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    const renderAdminCalendar = () => {
      adminCalGrid.innerHTML = "";
      const d = adminCalDate.value;
      const p = adminCalPitch.value;
      for (let h = 8; h < 22; h++) {
        for (let m = 0; m < 60; m += 30) {
          const ts  = `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
          const min = parseTime(ts);
          const slot = document.createElement("div");
          slot.className = "calendarSlot";
          const occ = bookings.find(b => {
            if (b.pitch !== p || b.date !== d || b.status === "Rejected") return false;
            const s = parseTime(b.time);
            const e = parseTime(b.endTime);
            return min >= s && min < e;
          });
          if (occ) {
            slot.textContent = occ.status === "Pending" ? "Pending" : occ.team;
            slot.classList.add(occ.status === "Pending" ? "pending" : "approved");
          } else {
            slot.textContent = ts;
            slot.classList.add("available");
          }
          adminCalGrid.appendChild(slot);
        }
      }
    };
    adminCalDate.value  = new Date().toISOString().slice(0,10);
    adminCalPitch.value = "";
    adminCalDate.addEventListener("change", renderAdminCalendar);
    adminCalPitch.addEventListener("change", renderAdminCalendar);
    renderAdminCalendar();
  }

  // ──────────────────────────────────────────
  // 🛠️ ADMIN BOOKINGS TABLE + FILTERS + ACTIONS (admin.html)
  // ──────────────────────────────────────────
  const adminTable  = document.getElementById("adminBookingTable");
  const filterDate  = document.getElementById("filterDate");
  const filterPitch = document.getElementById("filterPitch");
  if (adminTable) {
    const bookings = JSON.parse(localStorage.getItem("bookings")) || [];
    const tbody    = adminTable.querySelector("tbody");

    function renderAdminTable() {
      tbody.innerHTML = "";
      const d = filterDate?.value || "";
      const p = filterPitch?.value || "";
      const list = bookings.filter(b => (!d || b.date === d) && (!p || b.pitch === p));

      list.forEach(b => {
        const idx = bookings.indexOf(b);
        const tr  = document.createElement("tr");
        tr.innerHTML = `
          <td>${b.team}</td>
          <td>${b.pitch}</td>
          <td>${b.date}</td>
          <td>${b.time}</td>
          <td>${b.endTime}</td>
          <td>${b.username}</td>
          <td>${b.status}</td>
          <td>
            <button data-index="${idx}" class="approve-btn">✅ Approve</button>
            <button data-index="${idx}" class="reject-btn">❌ Reject</button>
            <button data-index="${idx}" class="delete-btn">🗑 Delete</button>
          </td>
        `;
        tbody.appendChild(tr);
      });

      // Approve
      tbody.querySelectorAll(".approve-btn").forEach(btn =>
        btn.addEventListener("click", () => {
          const i = +btn.dataset.index;
          bookings[i].status = "Approved";
          localStorage.setItem("bookings", JSON.stringify(bookings));
          renderAdminTable();
        })
      );

      // Reject
      tbody.querySelectorAll(".reject-btn").forEach(btn =>
        btn.addEventListener("click", () => {
          const i = +btn.dataset.index;
          bookings[i].status = "Rejected";
          localStorage.setItem("bookings", JSON.stringify(bookings));
          renderAdminTable();
        })
      );

      // Delete booking
      tbody.querySelectorAll(".delete-btn").forEach(btn =>
        btn.addEventListener("click", () => {
          const i = +btn.dataset.index;
          bookings.splice(i, 1);
          localStorage.setItem("bookings", JSON.stringify(bookings));
          renderAdminTable();
        })
      );
    }

    filterDate?.addEventListener("change", renderAdminTable);
    filterPitch?.addEventListener("change", renderAdminTable);
    renderAdminTable();
  }

  // ──────────────────────────────────────────
  // 🔧 USER MANAGEMENT (admin.html) with Reset Password
  // ──────────────────────────────────────────
  const userTable = document.getElementById("userManagementTable");
  if (userTable) {
    const users = JSON.parse(localStorage.getItem("users")) || [];
    const tbody = userTable.querySelector("tbody");

    function renderUsers() {
      tbody.innerHTML = "";
      users.forEach((u, i) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${u.username}</td>
          <td>${u.email}</td>
          <td>
            <select class="role-dropdown" data-index="${i}">
              <option value="Manager"${u.role === "Manager" ? " selected" : ""}>
                Manager
              </option>
              <option value="Admin"${u.role === "Admin" ? " selected" : ""}>
                Admin
              </option>
            </select>
          </td>
          <td>${u.active ? "Active" : "Inactive"}</td>
          <td>
            <button data-index="${i}" class="toggle-active-btn">
              ${u.active ? "Deactivate" : "Activate"}
            </button>
            <button data-index="${i}" class="delete-user-btn">Delete</button>
            <button data-index="${i}" class="reset-password-btn">
              Reset Password
            </button>
          </td>
        `;
        tbody.appendChild(tr);
      });

      // Toggle active/inactive
      tbody.querySelectorAll(".toggle-active-btn").forEach(btn =>
        btn.addEventListener("click", () => {
          const i = +btn.dataset.index;
          users[i].active = !users[i].active;
          localStorage.setItem("users", JSON.stringify(users));
          renderUsers();
        })
      );

      // Delete user
      tbody.querySelectorAll(".delete-user-btn").forEach(btn =>
        btn.addEventListener("click", () => {
          const i = +btn.dataset.index;
          users.splice(i, 1);
          localStorage.setItem("users", JSON.stringify(users));
          renderUsers();
        })
      );

      // Change role
      tbody.querySelectorAll(".role-dropdown").forEach(sel =>
        sel.addEventListener("change", () => {
          const i = +sel.dataset.index;
          users[i].role = sel.value;
          localStorage.setItem("users", JSON.stringify(users));
          renderUsers();
        })
      );

      // Reset password
      tbody.querySelectorAll(".reset-password-btn").forEach(btn =>
        btn.addEventListener("click", () => {
          const i = +btn.dataset.index;
          const newPass = prompt(`Enter a new password for ${users[i].username}:`);
          if (!newPass || newPass.length < 6) {
            alert("Password must be at least 6 characters.");
            return;
          }
          users[i].password = newPass;
          localStorage.setItem("users", JSON.stringify(users));
          alert(`✅ Password for ${users[i].username} has been reset.`);
        })
      );
    }

    renderUsers();
  }

});