// Login
function login() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  const users = JSON.parse(localStorage.getItem("registeredUsers")) || [];

  const matched = users.find(u => u.username === username && u.password === password);

  if (matched) {
    localStorage.setItem("loggedInUser", JSON.stringify(matched));
    window.location.href = matched.role === "admin" ? "admin.html" : "index.html";
  } else {
    document.getElementById("loginStatus").textContent = "Login failed. Please try again.";
  }
}

// Register
function registerUser() {
  const username = document.getElementById("newUsername").value;
  const password = document.getElementById("newPassword").value;
  const role = document.getElementById("userRole").value;

  const users = JSON.parse(localStorage.getItem("registeredUsers")) || [];

  const exists = users.find(u => u.username === username);
  if (exists) {
    document.getElementById("registerStatus").textContent = "Username already exists.";
    return;
  }

  users.push({ username, password, role });
  localStorage.setItem("registeredUsers", JSON.stringify(users));

  document.getElementById("registerStatus").textContent = "✅ Registration successful. You can now log in.";
}