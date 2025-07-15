// ─────────────────────────────────────────────
// 🔐 AUTHENTICATION & DEFAULT ADMIN SETUP
// ─────────────────────────────────────────────
function checkLoginStatus() {
  return localStorage.getItem("isLoggedIn") === "true";
}

function getCurrentUser() {
  return JSON.parse(localStorage.getItem("currentUser") || '{}');
}

function logoutUser() {
  localStorage.removeItem("isLoggedIn");
  localStorage.removeItem("currentUser");
  alert("You’ve been logged out.");
  window.location.href = "login.html";
}

// Ensure there's always at least one Admin
(function initDefaultAdmin() {
  const users = JSON.parse(localStorage.getItem("users")) || [];
  if (!users.some(u => u.role === "Admin")) {
    users.unshift({
      username: "admin",
      email:    "admin@bugbrooke.com",
      password: "YourSecurePass123",
      role:     "Admin",
      active:   true
    });
    localStorage.setItem("users", JSON.stringify(users));
  }
})();

// Enforce login + role-based page access
(function enforcePageAccess() {
  const path = window.location.pathname;
  const user = getCurrentUser();

  if (
    !path.endsWith("login.html") &&
    !path.endsWith("register.html") &&
    !checkLoginStatus()
  ) {
    alert("Please log in to access this page.");
    window.location.href = "login.html";
    return;
  }

  if (path.endsWith("admin.html") && user.role !== "Admin") {
    alert("You don’t have permission to view that page.");
    window.location.href = "index.html";
  }
})();

// ─────────────────────────────────────────────
// 🚦 MAIN LOGIC ON DOMContentLoaded
// ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const user     = getCurrentUser();
  const role     = user.role;
  let bookings   = JSON.parse(localStorage.getItem("bookings")) || [];
  let users      = JSON.parse(localStorage.getItem("users"))    || [];

  // ─────────── NAVIGATION & LOGOUT ───────────
  const loginLink  = document.getElementById("loginLink");
  const logoutLink = document.getElementById("logoutLink");
  const adminNav   = document.querySelector('nav a[href="admin.html"]');

  if (checkLoginStatus()) {
    loginLink?.classList.add("hidden");
    logoutLink?.classList.remove("hidden");
    if (role !== "Admin") adminNav?.classList.add("hidden");
    logoutLink?.addEventListener("click", e => {
      e.preventDefault();
      logoutUser();
    });
  } else {
    loginLink?.classList.remove("hidden");
    logoutLink?.classList.add("hidden");
  }

  // ─────────── AUTO-LOGOUT AFTER 10 MINUTES ───────────
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

  // ─────────── LOGIN FORM HANDLER ───────────
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", e => {
      e.preventDefault();
      const uname = document.getElementById("username").value.trim();
      const pwd   = document.getElementById("password").value;
      const match = users.find(u =>
        u.username.toLowerCase() === uname.toLowerCase() &&
        u.password === pwd &&
        u.active
      );
      if (match) {
        localStorage.setItem("isLoggedIn", "true");
        localStorage.setItem(
          "currentUser",
          JSON.stringify({
            username: match.username,
            email:    match.email,
            role:     match.role
          })
        );
        window.location.href = "index.html";
      } else {
        alert("Invalid credentials or account disabled.");
      }
    });
  }

  // ─────────── REGISTER FORM HANDLER ───────────
  const registerForm = document.getElementById("registerForm");
  if (registerForm) {
    registerForm.addEventListener("submit", e => {
      e.preventDefault();
      const uname   = document.getElementById("regUsername").value.trim();
      const email   = document.getElementById("regEmail").value.trim();
      const pwd     = document.getElementById("regPassword").value;
      const confirm = document.getElementById("regConfirm").value;
      if (!uname || !email || !pwd) {
        return alert("All fields are required.");
      }
      if (pwd !== confirm) {
        return alert("Passwords don’t match.");
      }
      if (users.some(u => u.username.toLowerCase() === uname.toLowerCase())) {
        return alert("Username already taken.");
      }
      users.push({ username: uname, email, password: pwd, role: "Manager", active: true });
      localStorage.setItem("users", JSON.stringify(users));
      alert("Registration successful! Please log in.");
      window.location.href = "login.html";
    });
  }

  // ─────────── TIME SELECTORS (08:00–22:00, 30m steps) ───────────
  ["time", "endTime"].forEach(id => {
    const sel = document.getElementById(id);
    if (sel) {
      for (let h = 8; h <= 22; h++) {
        for (let m = 0; m < 60; m += 30) {
          const label = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
          const opt   = document.createElement("option");
          opt.value   = label;
          opt.textContent = label;
          sel.appendChild(opt);
        }
      }
    }
  });

  // ─────────── TEAM DROPDOWN POPULATION ───────────
  const teamSelect = document.getElementById("team");
  if (teamSelect) {
    const teams = [
      "Minis", "U7", "U8 Black", "U8 White", "U9 White", "U9 Black",
      "U10", "U11", "U13 White", "U13 Blue", "U14 Black", "U14 White",
      "U15", "U16", "U18", "U18 Girls", "U13 Girls - Blacks",
      "U13 Girls - White", "1st Team", "Reserves", "Ladies"
    ];
    teamSelect.querySelectorAll("option:not([value=''])").forEach(opt => opt.remove());
    teams.forEach(name => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      teamSelect.appendChild(opt);
    });
  }

  // ─────────── MANAGER FIELD AUTO-FILL & LOCK ───────────
  const managerInput = document.getElementById("manager");
  if (managerInput) {
    managerInput.value    = user.username || "";
    managerInput.readOnly = true;
  }

  // ─────────── BOOKING FORM + EMAILJS DEBUGGING ───────────
  const bookingForm = document.getElementById("bookingForm");
  if (bookingForm) {
    if (!checkLoginStatus()) {
      bookingForm.style.display = "none";
      const note = document.createElement("p");
      note.className = "login-note";
      note.textContent = "Please log in to request a pitch.";
      document.getElementById("bookingFormSection")?.append(note);
    }

    bookingForm.addEventListener("submit", async e => {
      e.preventDefault();
      console.log("🔄 Booking form submitted");

      // Gather values
      const pitch   = document.getElementById("pitch").value;
      const date    = document.getElementById("date").value;
      const time    = document.getElementById("time").value;
      const endTime = document.getElementById("endTime").value;
      const team    = document.getElementById("team").value;
      const manager = user.username;

      console.log("👉 Saving booking:", { pitch, date, time, endTime, team, manager });

      // Save locally
      bookings.push({ pitch, date, time, endTime, team, manager, status: "Pending" });
      localStorage.setItem("bookings", JSON.stringify(bookings));

      // Debug EmailJS call
      const emailParams = {
        manager,
        team,
        pitch,
        date,
        time:     `${time}–${endTime}`,
        to_email: "ja2983@googlemail.com"
      };
      console.log("📧 About to call emailjs.send()", {
        service:  "service_zlij00k",
        template: "template_gfll1hl",
        params:   emailParams
      });

      try {
        const resp = await emailjs.send(
          "service_zlij00k",
          "template_gfll1hl",
          emailParams
        );
        console.log("✅ emailjs.send() success:", resp);
      } catch (err) {
        console.error("❌ emailjs.send() failed:", err);
      }

      document.getElementById("confirmation")?.classList.remove("hidden");
      bookingForm.reset();
    });
  }

  // ─────────── SHARED CALENDAR VIEW ───────────
  const pitchDropdown = document.getElementById("calendarPitch");
  const calendarDate   = document.getElementById("calendarDate");
  const calendarGrid   = document.getElementById("calendarGrid");
  const parseTime      = t => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  if (pitchDropdown && calendarDate && calendarGrid) {
    const pitches = [
      "Pitch 1 - 5v5", "Pitch 2 - 7v7", "Pitch 3 - Combi",
      "Pitch 4 - Small 11v11", "Pitch 5 - 9v9",
      "Pitch 6 - 11v11", "Pitch 7 - Main Pitch"
    ];
    pitches.forEach(p => {
      const opt = document.createElement("option");
      opt.value   = p;
      opt.textContent = p;
      pitchDropdown.appendChild(opt);
    });

    function renderSlots() {
      calendarGrid.innerHTML = "";
      const selDate  = calendarDate.value;
      const selPitch = pitchDropdown.value;

      for (let h = 8; h < 22; h++) {
        for (let m = 0; m < 60; m += 30) {
          const timeStr = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
          const slotMin = parseTime(timeStr);
          const slot    = document.createElement("div");
          slot.className = "calendarSlot";

          const match = bookings.find(b => {
            if (b.pitch !== selPitch || b.date !== selDate || b.status === "Rejected") return false;
            const start = parseTime(b.time);
            const end   = parseTime(b.endTime);
            return slotMin >= start && slotMin < end;
          });

          if (match) {
            slot.textContent = match.status === "Pending" ? "Pending" : match.team;
            slot.classList.add(match.status === "Pending" ? "pending" : "approved");
          } else {
            slot.textContent = timeStr;
            slot.classList.add("available");
          }
          calendarGrid.appendChild(slot);
        }
      }
    }

    calendarDate.addEventListener("change", renderSlots);
    pitchDropdown.addEventListener("change", renderSlots);
    calendarDate.value  = calendarDate.value  || new Date().toISOString().slice(0,10);
    pitchDropdown.value = pitchDropdown.value || pitches[0];
    renderSlots();
  }

  // ─────────── ADMIN: Manage Bookings ───────────
  const bookingRows = document.getElementById("bookingRows");
  if (bookingRows && role === "Admin") {
    function renderBookingTable() {
      bookingRows.innerHTML = "";
      bookings.forEach((b, i) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${b.pitch}</td>
          <td>${b.date}</td>
          <td>${b.time}–${b.endTime}</td>
          <td>${b.team}</td>
          <td>${b.manager}</td>
          <td>${b.status}</td>
          <td>
            <button onclick="approveBooking(${i})">Accept</button>
            <button onclick="setPending(${i})">Pending</button>
            <button onclick="rejectBooking(${i})">Reject</button>
            <button onclick="deleteBooking(${i})">Delete</button>
          </td>
        `;
        bookingRows.appendChild(tr);
      });
    }

    window.approveBooking = idx => {
      bookings[idx].status = "Approved";
      localStorage.setItem("bookings", JSON.stringify(bookings));
      renderBookingTable();
      calendarDate.dispatchEvent(new Event("change"));
    };
    window.setPending = idx => {
      bookings[idx].status = "Pending";
      localStorage.setItem("bookings", JSON.stringify(bookings));
      renderBookingTable();
      calendarDate.dispatchEvent(new Event("change"));
    };
    window.rejectBooking = idx => {
      bookings[idx].status = "Rejected";
      localStorage.setItem("bookings", JSON.stringify(bookings));
      renderBookingTable();
      calendarDate.dispatchEvent(new Event("change"));
    };
    window.deleteBooking = idx => {
      if (confirm(`Delete booking for ${bookings[idx].team} on ${bookings[idx].date}?`)) {
        bookings.splice(idx, 1);
        localStorage.setItem("bookings", JSON.stringify(bookings));
        renderBookingTable();
        calendarDate.dispatchEvent(new Event("change"));
      }
    };

    renderBookingTable();
  }

  // ─────────── ADMIN: Manage Users ───────────
  const userRows = document.getElementById("userRows");
  if (userRows && role === "Admin") {
    function renderUserTable() {
      userRows.innerHTML = "";
      users.forEach((u, i) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${u.username}</td>
          <td>${u.email}</td>
          <td>
            <select onchange="updateRole(${i}, this.value)">
              <option ${u.role === "Admin" ? "selected" : ""}>Admin</option>
              <option ${u.role === "Manager" ? "selected" : ""}>Manager</option>
            </select>
          </td>
          <td>${u.active ? "✅ Active" : "⛔ Disabled"}</td>
          <td>
            <button onclick="toggleUser(${i})">${u.active ? "Disable" : "Enable"}</button>
            <button onclick="deleteUser(${i})">Delete</button>
          </td>
        `;
        userRows.appendChild(tr);
      });
    }

    window.updateRole = (idx, newRole) => {
      users[idx].role = newRole;
      localStorage.setItem("users", JSON.stringify(users));
      renderUserTable();
    };
    window.toggleUser = idx => {
      users[idx].active = !users[idx].active;
      localStorage.setItem("users", JSON.stringify(users));
      renderUserTable();
    };
    window.deleteUser = idx => {
      if (confirm(`Permanently delete user ${users[idx].username}?`)) {
        users.splice(idx, 1);
        localStorage.setItem("users", JSON.stringify(users));
        renderUserTable();
      }
    };

    renderUserTable();
  }

  // ─────────── MY BOOKINGS (Manager View) ───────────
  const myBookingRows = document.getElementById("myBookingRows");
  if (myBookingRows) {
    function renderMyBookings() {
      myBookingRows.innerHTML = "";
      bookings.forEach((b, i) => {
        if (b.manager !== user.username) return;
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${b.pitch}</td>
          <td>${b.date}</td>
          <td>${b.time}–${b.endTime}</td>
          <td>${b.team}</td>
          <td>${b.status}</td>
          <td>
            <button onclick="deleteMyBooking(${i})">Delete</button>
          </td>
        `;
        myBookingRows.appendChild(tr);
      });
    }

    window.deleteMyBooking = idx => {
      if (confirm(`Delete booking for ${bookings[idx].team} on ${bookings[idx].date}?`)) {
        bookings.splice(idx, 1);
        localStorage.setItem("bookings", JSON.stringify(bookings));
        renderMyBookings();
        calendarDate.dispatchEvent(new Event("change"));
      }
    };

    renderMyBookings();
  }

}); // ─ end DOMContentLoaded